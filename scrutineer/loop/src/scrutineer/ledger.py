"""The credit ledger and the CONSTRUCTORS' STANDINGS.

A ledger row is a feedback row on the original role call, kept under the 1 KB cap; the full
replay record is published as an object and referenced by ref. Standings are statistical, not
instance-level: a role is only eligible for an upgrade once it has enough confirmed incidents
that a bootstrap lower bound clears zero.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Any

from .regs import Regs
from .replay import ReplayRecord
from .telemetry import Tracer, publish_object
from .theta import CAR_ROLES


@dataclass
class Standing:
    role: str
    n: int = 0
    blame_s: float = 0.0
    ci_lo: float = 0.0
    ci_hi: float = 0.0
    var: float = 0.0
    incidents: list[float] = field(default_factory=list)
    modes: dict[str, int] = field(default_factory=dict)

    def row(self) -> dict[str, Any]:
        return {
            "role": self.role,
            "n": self.n,
            "blame_s": round(self.blame_s, 3),
            "ci": [round(self.ci_lo, 3), round(self.ci_hi, 3)],
            "var": round(self.var, 3),
            "modes": self.modes,
        }


def bootstrap_ci(xs: list[float], level: float = 0.90, iters: int = 2000, seed: int = 7) -> tuple[float, float]:
    """CI over the *sum* of credits, because that is the quantity the selection rule spends."""
    if not xs:
        return (0.0, 0.0)
    rng = random.Random(seed)
    n = len(xs)
    sums = []
    for _ in range(iters):
        sums.append(sum(xs[rng.randrange(n)] for _ in range(n)))
    sums.sort()
    lo_i = int((1.0 - level) / 2 * iters)
    hi_i = min(iters - 1, int((1.0 + level) / 2 * iters))
    return (sums[lo_i], sums[hi_i])


def record_credit(tracer: Tracer, call_id: str, rec: ReplayRecord) -> dict[str, Any]:
    """Publish the full replay record as an object, then write the short row that references it."""
    ref = publish_object(
        f"replay-{rec.role.lower()}-{rec.item_id}-{rec.mode}",
        {
            "role": rec.role, "mode": rec.mode, "item": rec.item_id,
            "actual_s": rec.actual_s, "replayed_s": rec.replayed_s,
            "seeds": rec.seeds, "flipped": rec.flipped, **rec.detail,
        },
    )
    row = {
        "role": rec.role,
        "delta_s": round(rec.credit_s, 3),
        "mode": rec.mode,
        "seeds": rec.seeds,
        "flipped": rec.flipped,
        "replay_ref": ref,
    }
    tracer.add_feedback(call_id, "scrutineer.credit", row)
    return row


def standings(tracer: Tracer, regs: Regs, seed: int = 7) -> dict[str, Standing]:
    thr = float(regs.g("credit", "incident_threshold_s"))
    level = float(regs.g("credit", "ci"))
    out = {r: Standing(role=r) for r in CAR_ROLES}
    for _call, row in tracer.feedback_rows("scrutineer.credit"):
        role = row["role"]
        st = out.setdefault(role, Standing(role=role))
        st.modes[row["mode"]] = st.modes.get(row["mode"], 0) + 1
        if float(row["delta_s"]) > thr:
            st.incidents.append(float(row["delta_s"]))
    for st in out.values():
        st.n = len(st.incidents)
        st.blame_s = sum(st.incidents)
        st.ci_lo, st.ci_hi = bootstrap_ci(st.incidents, level, seed=seed)
        if st.n > 1:
            m = st.blame_s / st.n
            st.var = sum((x - m) ** 2 for x in st.incidents) / (st.n - 1)
    return out


def publish_standings(generation: int, table: dict[str, Standing], extra: dict[str, Any] | None = None) -> str:
    obj = {"generation": generation, "roles": {r: s.row() for r, s in table.items()}, **(extra or {})}
    return publish_object(f"standings:gen-{generation}", obj, tags=[f"gen-{generation}"])
