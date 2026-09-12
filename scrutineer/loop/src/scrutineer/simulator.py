"""SIMULATOR ENGINEER — the curriculum.

Mines the failing QUALI turns, clusters them by what actually went wrong, pulls the nearest items
out of the reserve pool, and band-filters to a car pass-rate inside the frontier band over k
samples. A circuit generation mutates no harness, and the ghost is re-timed on the new circuit
before any seesaw, because a delta across two different datasets is not a delta.
"""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from dataclasses import dataclass, field
from typing import Any

from .car.lap import LapRecord
from .circuits import Item, Split
from .evaluator import verify
from .objective import LapScore
from .regs import Regs
from .telemetry import Tracer, publish_object, state_dir
from .theta import Theta


@dataclass
class Circuit:
    version: int
    items: list[Item]
    source: str
    clusters: dict[str, int] = field(default_factory=dict)
    band: tuple[float, float] = (0.30, 0.80)
    corner_names: list[str] = field(default_factory=list)

    def obj(self) -> dict[str, Any]:
        return {"version": self.version, "n_items": len(self.items), "source": self.source,
                "clusters": self.clusters, "band": list(self.band),
                "item_ids": [i.id for i in self.items], "corners": self.corner_names}

    def publish(self) -> str:
        return publish_object(f"practice-circuit:v{self.version}", self.obj(),
                              tags=[f"circuit-v{self.version}"])


def cluster_failures(laps: list[LapRecord], scores: list[LapScore]) -> dict[str, int]:
    c: Counter[str] = Counter()
    for lap, sc in zip(laps, scores, strict=True):
        if sc.passed:
            continue
        if lap.missing_concepts:
            c[f"context-miss:{lap.missing_concepts[0]}"] += 1
        elif lap.tool_errors:
            c["tool-fault"] += 1
        elif lap.retired:
            c["retired-under-cap"] += 1
        elif lap.boxed and lap.steps <= 1:
            c["boxed-too-early"] += 1
        else:
            c["driver-shortfall"] += 1
    return dict(c)


def _corner_name(cluster: str) -> str:
    kind, _, detail = cluster.partition(":")
    pretty = {
        "context-miss": "MISREAD", "tool-fault": "SENSOR", "retired-under-cap": "FUEL",
        "boxed-too-early": "EARLY-STOP", "driver-shortfall": "TRACTION",
    }.get(kind, kind.upper())
    return f"{pretty}{(' ' + detail.upper()) if detail else ''} CHICANE"


def measure_rates(
    *, theta: Theta, items: list[Item], regs: Regs, seed: int, k: int, workers: int = 16,
) -> dict[str, float]:
    """Pass rate of the current car on each item, over k samples.

    This is the measurement the frontier band is taken from. It is cached on disk against the
    car's own hash and the driver it raced, because it costs one sample per item per k."""
    from .evaluator import run_race
    from .rails.inference import inference

    key = hashlib.sha256(
        f"{theta.full_hash}|{inference().backend.name}|{seed}|{k}|{len(items)}".encode()).hexdigest()[:16]
    cache_file = state_dir() / "rates.json"
    cache = json.loads(cache_file.read_text()) if cache_file.exists() else {}
    if key in cache:
        return {k2: float(v) for k2, v in cache[key].items()}
    res = run_race(theta=theta, items=items, regs=regs, generation=-1, name="smoke", seed=seed,
                   trials=k, tracer=Tracer(generation=-1), workers=workers,
                   cap_usd=regs.race_cap_usd)
    hits: dict[str, int] = {}
    for item_key, passed in res.per_item.items():
        base = item_key.split("#")[0]
        hits[base] = hits.get(base, 0) + int(passed)
    rates = {i: n / k for i, n in hits.items()}
    cache[key] = rates
    cache_file.write_text(json.dumps(cache, indent=0))
    return rates


def opening_circuit(
    *, theta: Theta, pool: list[Item], regs: Regs, seed: int, n_quali: int, n_sealed: int,
    k: int = 4, ceiling: float = 0.75,
) -> tuple[list[Item], list[Item], list[Item], dict[str, float]]:
    """Build the season's opening QUALI and SEALED circuits the same way every later circuit is
    built: by measuring the car and keeping the items it does not already always solve.

    An item the car passes every time teaches the loop nothing — it cannot be the evidence for an
    upgrade, and in an RL group it gives every rollout the same reward. Drawing the opening
    circuit at random instead would hand the loop a season with no headroom, which is exactly what
    happened the first time this ran against a real driver: 85 % of the pool was already solved.
    """
    rates = measure_rates(theta=theta, items=pool, regs=regs, seed=seed, k=k)
    live = sorted((i for i in pool if rates.get(i.id, 1.0) <= ceiling),
                  key=lambda i: (rates.get(i.id, 1.0), i.id))
    solved = sorted((i for i in pool if rates.get(i.id, 1.0) > ceiling),
                    key=lambda i: (-rates.get(i.id, 1.0), i.id))
    # Pad with items the car already owns: the regression gate needs passing items to protect,
    # and a circuit made only of failures would have nothing to lose.
    want = n_quali + n_sealed
    pad = max(0, want - len(live))
    chosen = live + solved[:pad]
    chosen.sort(key=lambda i: (rates.get(i.id, 1.0), i.id))
    # deal alternately so the two circuits get the same difficulty mix
    quali = chosen[0::2][:n_quali]
    sealed = chosen[1::2][:n_sealed]
    used = {i.id for i in quali} | {i.id for i in sealed}
    reserve = [i for i in chosen + solved if i.id not in used]
    return quali, sealed, reserve, rates


def band_filter(
    *, theta: Theta, candidates: list[Item], regs: Regs, seed: int, k: int, band: tuple[float, float],
    limit: int,
) -> list[Item]:
    """Keep only items the current car solves sometimes: an item it always passes teaches nothing,
    and one it never passes gives every rollout group the same reward."""
    from .car.lap import run_lap

    tracer = Tracer(generation=-1)
    keep: list[Item] = []
    for item in candidates:
        passes = 0
        for i in range(k):
            lap = run_lap(theta=theta, item=item, tracer=tracer, regs=regs, seed=seed + 131 * i,
                          lap_index=i, race_id="band", cap_usd=0.02)
            passes += int(verify(item, lap.submitted))
        rate = passes / k
        if band[0] <= rate <= band[1]:
            keep.append(item)
        if len(keep) >= limit:
            break
    return keep


def new_circuit(
    *, theta: Theta, split: Split, current: list[Item], laps: list[LapRecord], scores: list[LapScore],
    regs: Regs, version: int, seed: int,
) -> Circuit:
    clusters = cluster_failures(laps, scores)
    failing_families = {
        lap.item_id.split("-")[0] for lap, sc in zip(laps, scores, strict=True) if not sc.passed
    }
    # nearest reserve items are the ones from the families the car is currently losing on
    near = [i for i in split.reserve if i.id.split("-")[0] in failing_families]
    rest = [i for i in split.reserve if i not in near]
    band = tuple(regs.g("circuit", "band"))                       # type: ignore[assignment]
    k = int(regs.g("circuit", "band_samples"))
    picked = band_filter(theta=theta, candidates=near + rest, regs=regs, seed=seed, k=k,
                         band=band, limit=max(6, len(current) // 3))
    kept = [i for i in current if i.id not in {p.id for p in picked}]
    items = (kept + picked)[: len(current)]
    return Circuit(version=version, items=items, source="mined-failures", clusters=clusters,
                   band=band, corner_names=[_corner_name(c) for c in sorted(clusters, key=lambda x: -clusters[x])][:4])
