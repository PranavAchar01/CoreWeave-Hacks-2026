"""PARC FERMÉ REPLAY — the counterfactual that turns a guess into a credit row.

Three modes, chosen by the state of the role's artifact:

  ghost-swap    θ_r changed since the ghost: put the ghost's artifact back and re-run the lap.
  patch-replay  θ_r unchanged since the ghost, so ghost-swap is identically zero: hand the role a
                diagnosis-specific corrected artifact and re-run.
  null-stub     always, and cheap: replace the role with a null artifact. Separates "r is worse
                than it could be" from "r is load-bearing".

POWER_UNIT is deliberately excluded from patch-replay: a corrected driver output is the solution
itself, which would conflate "better driver" with "someone solved it".
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import yaml

from .car.lap import run_lap
from .circuits import Item
from .evaluator import verify
from .objective import score_lap
from .regs import Regs
from .telemetry import Tracer
from .theta import Theta

PATCHABLE = ["AERO", "STRATEGIST", "TYRES", "DATA"]


_HINTS = {
    "labels": "Every control needs a programmatic name: <label for> beside the input, or aria-label.",
    "names": "Every button and link needs discernible text; an icon-only control needs aria-label.",
    "contrast": "Body text needs 4.5:1 against its background, large text 3:1. Grey on white fails.",
    "landmarks": "All content sits inside <header>, <nav>, <main> or <footer>.",
    "headings": "Exactly one <h1>, and heading levels do not skip.",
    "tables": "Data tables need <th scope>; a sortable header needs aria-sort.",
    "dialogs": "A modal needs role=dialog, aria-modal=true and an accessible name.",
    "keyboard": "Everything operable by mouse is operable by keyboard, with a visible focus style.",
    "images": "Every <img> needs alt; decorative images take alt=\"\".",
    "language": "<html lang=\"en\"> and a non-empty <title>.",
    "lists": "Grouped items belong in <ul>/<ol> with <li> children.",
    "status": "A message that appears after an action needs role=status or role=alert.",
}


def _WCAG_HINTS(concepts: list[str]) -> str:
    return "\n".join(_HINTS[c] for c in concepts if c in _HINTS)


def _edit(theta: Theta, path: str, mutate) -> Theta:
    doc = yaml.safe_load(theta.files.get(path, "") or "{}") or {}
    mutate(doc)
    files = dict(theta.files)
    files[path] = yaml.safe_dump(doc, sort_keys=False)
    return Theta.from_files(theta.root, files)


def patched(theta: Theta, role: str, item: Item) -> Theta:
    """The corrected artifact for a role, defined per role exactly as LOOP.md specifies."""
    if role == "AERO":
        # hand it the reference for exactly the rules this spec is judged on, and retrieve by
        # concept rather than by whichever words happen to appear in the brief
        t = _edit(theta, "skills/aero/policy.yaml",
                  lambda d: d.update({"retrieval": "concept-match", "n_refs": max(5, d.get("n_refs", 2))}))
        needed = sorted(item.concepts)
        block = (f"\n\n## ref-replay-{item.family}\nconcepts: {', '.join(needed)}\n"
                 f"{_WCAG_HINTS(needed)}\n")
        files = dict(t.files)
        files["skills/aero/references.md"] = files.get("skills/aero/references.md", "") + block
        return Theta.from_files(theta.root, files)
    if role == "STRATEGIST":
        return _edit(theta, "skills/strategist/thresholds.yaml",
                     lambda d: d.update({"box_when_p_finish_under_cap": 0.15, "retire_when": 0.02,
                                         "min_steps_before_box": 2,
                                         "ladder": [0.99, 0.90, 0.60, 0.35, 0.20]}))
    if role == "TYRES":
        def cooler(d: dict) -> None:
            modes = d.get("modes", {})
            for m in modes.values():
                m["temperature"] = round(max(0.05, float(m.get("temperature", 0.25)) - 0.15), 3)
                m["samples"] = int(m.get("samples", 1)) + 1
            d["modes"] = modes
        return _edit(theta, "skills/tyres/tyres.yaml", cooler)
    if role == "DATA":
        # let it open its own page in a browser and run the same engine it is judged by
        return _edit(theta, "skills/data/tools.yaml",
                     lambda d: d.update({"probe": {**d.get("probe", {}), "enabled": True,
                                                   "mode": "audit", "reaudit": True},
                                         "schema_version": 2}))
    return theta


def stubbed(theta: Theta, role: str) -> Theta:
    if role == "AERO":
        return _edit(theta, "skills/aero/policy.yaml",
                     lambda d: d.update({"retrieval": "none", "n_refs": 0, "budget_tokens": 120}))
    if role == "STRATEGIST":
        return _edit(theta, "skills/strategist/thresholds.yaml",
                     lambda d: d.update({"box_when_p_finish_under_cap": 1.0, "retire_when": 0.0,
                                         "min_steps_before_box": 0, "ladder": [0, 0, 0, 0, 0]}))
    if role == "TYRES":
        return _edit(theta, "skills/tyres/tyres.yaml",
                     lambda d: d.update({"modes": {k: {"temperature": 0.95, "samples": 1,
                                                       "max_tokens": 400, "compound": "HARD"}
                                                   for k in (1, 2, 3, 4, 5)}}))
    if role == "DATA":
        return _edit(theta, "skills/data/tools.yaml",
                     lambda d: d.update({"probe": {**d.get("probe", {}), "enabled": False,
                                                   "mode": "none"}}))
    if role == "POWER_UNIT":
        return _edit(theta, "skills/power_unit/recipe.yaml", lambda d: d.update({"competence": 0.05}))
    return theta


@dataclass
class ReplayRecord:
    lap_index: int
    item_id: str
    role: str
    mode: str
    actual_s: float
    replayed_s: float
    seeds: int
    flipped: bool
    detail: dict[str, Any]

    @property
    def credit_s(self) -> float:
        """Seconds gained if this role were corrected. Positive = this role cost us time."""
        return self.actual_s - self.replayed_s


def replay(
    *,
    theta: Theta,
    ghost: Theta | None,
    role: str,
    item: Item,
    lap_index: int,
    actual_s: float,
    regs: Regs,
    seed: int,
    tracer: Tracer,
    cap_usd: float,
) -> ReplayRecord:
    mode = "null-stub"
    if ghost is not None and ghost.hash_for(role) != theta.hash_for(role):
        variant, mode = theta.swap(role, ghost), "ghost-swap"
    elif role in PATCHABLE:
        variant, mode = patched(theta, role, item), "patch-replay"
    else:
        variant, mode = stubbed(theta, role), "null-stub"

    seeds = int(regs.g("credit", "replay_seeds"))
    times: list[float] = []
    passes = 0
    for k in range(seeds):
        lap = run_lap(theta=variant, item=item, tracer=tracer, regs=regs, seed=seed + 7919 * k,
                      lap_index=lap_index, race_id=f"replay-{mode}-{role}", cap_usd=cap_usd)
        ok = verify(item, lap.submitted)
        passes += int(ok)
        times.append(score_lap(regs, passed=ok, cost_usd=lap.cost_usd, wall_s=lap.wall_s,
                               cap_usd=max(cap_usd, 1e-9), timed_out=lap.retired).lap_s)
    mean_s = sum(times) / len(times)
    return ReplayRecord(
        lap_index=lap_index, item_id=item.id, role=role, mode=mode,
        actual_s=actual_s, replayed_s=mean_s, seeds=seeds,
        flipped=passes > 0,
        detail={"passes": passes, "times": [round(t, 3) for t in times]},
    )
