"""PARC FERMÉ REPLAY — the counterfactual that turns a guess into a credit row.

Three modes, chosen by the state of the role's artifact:

  ghost-swap    θ_r changed since the ghost: put the ghost's artifact back and re-run the lap.
  patch-replay  θ_r unchanged since the ghost, so ghost-swap is identically zero: hand the role a
                diagnosis-specific corrected artifact and re-run.
  null-stub     always, and cheap: replace the role with a null artifact. Separates "r is worse
                than it could be" from "r is load-bearing".

POWER_UNIT is deliberately excluded from patch-replay: a corrected driver output is the solution
itself, which would conflate "better driver" with "someone solved it".

THE NULL ARM. Every one of those three modes re-runs the lap, and re-running a lap re-samples the
driver. A failed lap that passes on replay may have been fixed by the intervention or simply by
drawing again, and the first version of this file could not tell the two apart: it credited the
role for both. That is not a subtle bias. AERO's patch-replay *adds references*, which perturbs the
prompt and forces a fresh draw, so AERO collected the resampling credit of every lap it was named
on — n=33 confirmed incidents, every gate cleared, and then 6.6 points lost out of sample.

Causal Agent Replay (arXiv:2606.08275) names the fix. Its intervention algebra has five operations
— do_resample, do_action, do_observation, do_context, do_policy — and it treats plain resampling,
`do_resample`, as *the null intervention*: the arm every other arm must be measured against. Our
ghost-swap is do_policy, patch-replay is do_context, null-stub is do_observation, and none of them
meant anything without the fourth.

So every replay now runs paired against a null arm: the same lap, the same seeds, the *unmodified*
harness. Credit is the contrast between the two, not the distance from the original lap. A role is
only credited for what resampling alone would not have bought.
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
    "images": 'Every <img> needs alt; decorative images take alt="".',
    "language": '<html lang="en"> and a non-empty <title>.',
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
        t = _edit(
            theta,
            "skills/aero/policy.yaml",
            lambda d: d.update({"retrieval": "concept-match", "n_refs": max(5, d.get("n_refs", 2))}),
        )
        needed = sorted(item.concepts)
        block = f"\n\n## ref-replay-{item.family}\nconcepts: {', '.join(needed)}\n{_WCAG_HINTS(needed)}\n"
        files = dict(t.files)
        files["skills/aero/references.md"] = files.get("skills/aero/references.md", "") + block
        return Theta.from_files(theta.root, files)
    if role == "STRATEGIST":
        return _edit(
            theta,
            "skills/strategist/thresholds.yaml",
            lambda d: d.update(
                {
                    "box_when_p_finish_under_cap": 0.15,
                    "retire_when": 0.02,
                    "min_steps_before_box": 2,
                    "ladder": [0.99, 0.90, 0.60, 0.35, 0.20],
                }
            ),
        )
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
        return _edit(
            theta,
            "skills/data/tools.yaml",
            lambda d: d.update(
                {
                    "probe": {**d.get("probe", {}), "enabled": True, "mode": "audit", "reaudit": True},
                    "schema_version": 2,
                }
            ),
        )
    return theta


def stubbed(theta: Theta, role: str) -> Theta:
    if role == "AERO":
        return _edit(
            theta,
            "skills/aero/policy.yaml",
            lambda d: d.update({"retrieval": "none", "n_refs": 0, "budget_tokens": 120}),
        )
    if role == "STRATEGIST":
        return _edit(
            theta,
            "skills/strategist/thresholds.yaml",
            lambda d: d.update(
                {
                    "box_when_p_finish_under_cap": 1.0,
                    "retire_when": 0.0,
                    "min_steps_before_box": 0,
                    "ladder": [0, 0, 0, 0, 0],
                }
            ),
        )
    if role == "TYRES":
        return _edit(
            theta,
            "skills/tyres/tyres.yaml",
            lambda d: d.update(
                {
                    "modes": {
                        k: {"temperature": 0.95, "samples": 1, "max_tokens": 400, "compound": "HARD"}
                        for k in (1, 2, 3, 4, 5)
                    }
                }
            ),
        )
    if role == "DATA":
        return _edit(
            theta,
            "skills/data/tools.yaml",
            lambda d: d.update({"probe": {**d.get("probe", {}), "enabled": False, "mode": "none"}}),
        )
    if role == "POWER_UNIT":
        return _edit(theta, "skills/power_unit/recipe.yaml", lambda d: d.update({"competence": 0.05}))
    return theta


@dataclass
class NullArm:
    """`do_resample`: the same lap, the same seeds, the harness untouched.

    This is what the lap does when nothing is fixed and it is simply run again. It is computed
    once per failing lap and shared by every role replayed against that lap, so N roles on one lap
    cost one null arm rather than N.
    """

    item_id: str
    resampled_s: float
    passes: int
    seeds: int

    def obj(self) -> dict[str, Any]:
        return {
            "item": self.item_id,
            "resampled_s": round(self.resampled_s, 3),
            "passes": self.passes,
            "seeds": self.seeds,
        }


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
    null_s: float | None = None
    null_passes: int | None = None

    @property
    def raw_credit_s(self) -> float:
        """Distance from the original lap. Contains the resampling effect and is kept only so the
        record shows what the uncorrected estimator would have said."""
        return self.actual_s - self.replayed_s

    @property
    def credit_s(self) -> float:
        """Seconds this role cost us, over and above what running the lap again would have bought.

        The contrast `null_s - replayed_s` is the intervention effect with the `do_resample` null
        subtracted. With no null arm recorded this falls back to the uncontrolled distance from the
        original lap, which is what the loop used to do everywhere; `controlled` says which.
        """
        if self.null_s is None:
            return self.raw_credit_s
        return self.null_s - self.replayed_s

    @property
    def controlled(self) -> bool:
        return self.null_s is not None

    @property
    def resample_credit_s(self) -> float:
        """What resampling alone was worth on this lap — the credit the old estimator handed out
        for free. Reported so a generation can show how much of its evidence was never real."""
        return 0.0 if self.null_s is None else self.actual_s - self.null_s


def _run_arm(
    *,
    variant: Theta,
    item: Item,
    lap_index: int,
    regs: Regs,
    seed: int,
    tracer: Tracer,
    cap_usd: float,
    race_id: str,
    seeds: int,
) -> tuple[float, int, list[float]]:
    """Run one arm of the pair. Seeds are derived identically for every arm, so the null and the
    intervention see the same draws and the comparison is paired rather than two independent
    samples — the variance reduction Miller (arXiv:2411.00640) gets for free from pairing."""
    times: list[float] = []
    passes = 0
    for k in range(seeds):
        lap = run_lap(
            theta=variant,
            item=item,
            tracer=tracer,
            regs=regs,
            seed=seed + 7919 * k,
            lap_index=lap_index,
            race_id=race_id,
            cap_usd=cap_usd,
        )
        ok = verify(item, lap.submitted)
        passes += int(ok)
        times.append(
            score_lap(
                regs,
                passed=ok,
                cost_usd=lap.cost_usd,
                wall_s=lap.wall_s,
                cap_usd=max(cap_usd, 1e-9),
                timed_out=lap.retired,
            ).lap_s
        )
    return sum(times) / len(times), passes, times


def resample_null(
    *,
    theta: Theta,
    item: Item,
    lap_index: int,
    regs: Regs,
    seed: int,
    tracer: Tracer,
    cap_usd: float,
) -> NullArm:
    """`do_resample` — re-run the lap with the harness untouched.

    One per failing lap, shared by every role replayed against it. Without this arm a role is
    credited for whatever a second draw would have produced anyway.
    """
    seeds = int(regs.g("credit", "replay_seeds"))
    mean_s, passes, _ = _run_arm(
        variant=theta,
        item=item,
        lap_index=lap_index,
        regs=regs,
        seed=seed,
        tracer=tracer,
        cap_usd=cap_usd,
        race_id="replay-do_resample",
        seeds=seeds,
    )
    return NullArm(item_id=item.id, resampled_s=mean_s, passes=passes, seeds=seeds)


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
    null: NullArm | None = None,
) -> ReplayRecord:
    mode = "null-stub"
    if ghost is not None and ghost.hash_for(role) != theta.hash_for(role):
        variant, mode = theta.swap(role, ghost), "ghost-swap"
    elif role in PATCHABLE:
        variant, mode = patched(theta, role, item), "patch-replay"
    else:
        variant, mode = stubbed(theta, role), "null-stub"

    seeds = int(regs.g("credit", "replay_seeds"))
    mean_s, passes, times = _run_arm(
        variant=variant,
        item=item,
        lap_index=lap_index,
        regs=regs,
        seed=seed,
        tracer=tracer,
        cap_usd=cap_usd,
        race_id=f"replay-{mode}-{role}",
        seeds=seeds,
    )
    # A flip is the intervention passing laps the null arm did not. With no null arm this falls
    # back to the old, uncontrolled test — "it passed at least once" — which resampling alone
    # satisfies often enough to manufacture an entire generation's evidence.
    flipped = passes > null.passes if null is not None else passes > 0
    return ReplayRecord(
        lap_index=lap_index,
        item_id=item.id,
        role=role,
        mode=mode,
        actual_s=actual_s,
        replayed_s=mean_s,
        seeds=seeds,
        flipped=flipped,
        detail={
            "passes": passes,
            "times": [round(t, 3) for t in times],
            "null_passes": None if null is None else null.passes,
            "controlled": null is not None,
        },
        null_s=None if null is None else null.resampled_s,
        null_passes=None if null is None else null.passes,
    )
