"""The optimizer step: `selection:gen-n`.

This object is the only thing that can start an upgrade. Nothing else in the loop may nominate a
role, and the upgrade scene's caption is generated from it, so a scene cannot exist without the
evidence chain behind it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .ledger import Standing
from .regs import Regs
from .telemetry import publish_object
from .theta import ALL_ROLES

PATHS = {
    "AERO": "harness", "DATA": "harness", "ENGINEER": "harness", "HISTORIAN": "harness",
    "PIT_CREW": "harness", "SCRUTINEER": "harness",
    "STRATEGIST": "thresholds", "TYRES": "thresholds",
    "POWER_UNIT": "weights", "SIMULATOR": "circuit",
}


@dataclass
class Selection:
    generation: int
    role: str | None
    path: str | None
    rule_fired: str
    blame_s: float = 0.0
    ci: tuple[float, float] = (0.0, 0.0)
    n: int = 0
    p_fix: float = 0.5
    p_fix_is_prior: bool = True
    cost_usd: float = 0.0
    hours: float = 0.0
    expected_gain_per_usd: float = 0.0
    alternatives: list[dict[str, Any]] = field(default_factory=list)
    parked: str | None = None
    notes: list[str] = field(default_factory=list)

    def obj(self) -> dict[str, Any]:
        return {
            "generation": self.generation,
            "r_star": self.role,
            "path": self.path,
            "rule_fired": self.rule_fired,
            "blame_s": round(self.blame_s, 3),
            "ci": [round(self.ci[0], 3), round(self.ci[1], 3)],
            "n": self.n,
            "p_fix": round(self.p_fix, 3),
            "p_fix_is_prior": self.p_fix_is_prior,
            "cost_usd": self.cost_usd,
            "hours": self.hours,
            "expected_gain_per_usd": round(self.expected_gain_per_usd, 2),
            "alternatives": self.alternatives,
            "parked": self.parked,
            "notes": self.notes,
        }

    def publish(self) -> str:
        return publish_object(f"selection:gen-{self.generation}", self.obj(),
                              tags=[f"gen-{self.generation}"])


def gain_per_usd(regs: Regs, role: str, blame_s: float, p_fix: float) -> float:
    rc = regs.roles[role]
    denom = rc.cost_usd + regs.lam * rc.hours
    return blame_s * p_fix / denom if denom else 0.0


def select(
    *,
    regs: Regs,
    generation: int,
    table: dict[str, Standing],
    generalisation_gap: float,
    zero_variance_groups: float,
    agent_error_share: float,
    harness_flip_share: float,
    p_fix: dict[str, float],
    p_fix_counts: dict[str, int],
    override_pick: str | None = None,
    phase_b: dict[str, bool] | None = None,
    exhausted: set[str] | None = None,
    last_attempt: dict[str, int] | None = None,
) -> Selection:
    """The rule, in the order LOOP.md fixes it. Every branch names itself in `rule_fired`."""
    min_n = int(regs.g("credit", "min_incidents"))
    gap_thr = float(regs.g("gates", "generalisation_gap"))
    zv_thr = float(regs.g("gates", "zero_variance_groups"))
    prior = float(regs.g("credit", "p_fix_prior"))

    def pf(role: str) -> tuple[float, bool]:
        n = p_fix_counts.get(role, 0)
        # Below three outcomes the prior is what gets *used*, not merely what gets labelled.
        # Returning the measured value here while flagging it as a prior meant a role that failed
        # once was treated as having a zero fix rate on a sample of one.
        return (prior, True) if n < 3 else (p_fix.get(role, prior), False)

    out_of_moves = set(exhausted or set())
    # A component whose every attempt has been rejected has a measured fix rate of zero, so its
    # expected gain is zero however much blame it carries. Without this it stays eligible on blame
    # alone, and because `max` over a single-element set always returns that element, it keeps
    # being picked no matter how low its gain-per-dollar falls.
    #
    # This rule is only as good as its input. It was previously fed by the promotion *decision*,
    # so three refusals on budget grounds — which say nothing about the component — were enough to
    # strike a component off permanently. The controller now feeds it the measured outcome, so a
    # zero here means the component's upgrades really have never moved OFFICIAL.
    #
    # It still violates the property the Darwin Godel Machine states outright: "All agents retain
    # a non-zero selection probability, ensuring that any path to improvement remains feasible
    # given sufficient compute" (arXiv:2505.22954 C.2). Striking off is permanent here. Making
    # retirement time-limited is a separate change with its own measurement; see the ledger.
    # Retirement is a cooling-off period, not a life sentence. A component whose every measured
    # attempt failed is ranked out for `retire_generations`, then allowed back. Striking it off
    # for good closed the search permanently and violated the property the Darwin Godel Machine
    # states outright: "All agents retain a non-zero selection probability, ensuring that any path
    # to improvement remains feasible given sufficient compute" (arXiv:2505.22954 C.2). The
    # evidence that retires a component is a fact about the past; the harness it would be changing
    # is not the harness it failed on.
    cool = int(regs.g("credit", "retire_generations"))
    seen = last_attempt or {}
    spent = {r for r, n in p_fix_counts.items()
             if n >= 3 and p_fix.get(r, prior) <= 0.0
             and generation - seen.get(r, generation) < cool}
    out_of_moves |= spent
    eligible = {r: s for r, s in table.items()
                if s.n >= min_n and s.ci_lo > 0 and r not in out_of_moves}
    alts = [
        {"role": r, "n": s.n, "blame_s": round(s.blame_s, 3), "ci_lo": round(s.ci_lo, 3),
         "gain_per_usd": round(gain_per_usd(regs, r, s.blame_s, pf(r)[0]), 2),
         "eligible": r in eligible,
         "exhausted": r in out_of_moves,
         "n_attempts": p_fix_counts.get(r, 0),
         "fix_rate": None if p_fix_counts.get(r, 0) < 3 else round(p_fix.get(r, prior), 3)}
        for r, s in sorted(table.items(), key=lambda kv: -kv[1].blame_s)
    ]

    def make(role: str | None, path: str | None, rule: str, **kw) -> Selection:
        s = table.get(role) if role else None
        p, is_prior = pf(role) if role else (prior, True)
        rc = regs.roles[role] if role else None
        return Selection(
            generation=generation, role=role, path=path, rule_fired=rule,
            blame_s=s.blame_s if s else 0.0, ci=(s.ci_lo, s.ci_hi) if s else (0.0, 0.0),
            n=s.n if s else 0, p_fix=p, p_fix_is_prior=is_prior,
            cost_usd=rc.cost_usd if rc else 0.0, hours=rc.hours if rc else 0.0,
            expected_gain_per_usd=gain_per_usd(regs, role, s.blame_s, p) if (role and s) else 0.0,
            alternatives=alts, **kw,
        )

    if generalisation_gap > gap_thr or zero_variance_groups >= zv_thr:
        sel = make("SIMULATOR", "circuit", "circuit")
        sel.notes.append(
            f"generalisation gap {generalisation_gap:.3f} > {gap_thr} or "
            f"{zero_variance_groups:.2f} of rollout groups had zero reward variance; a circuit "
            "generation mutates no harness and re-times the ghost on the new circuit")
        return sel

    if agent_error_share >= 0.60 and harness_flip_share < 0.60:
        sel = make("POWER_UNIT", "weights", "agent_error")
        sel.notes.append(f"{agent_error_share:.0%} of confirmed incidents were agent_error and no "
                         f"harness role flipped {harness_flip_share:.0%} of them")
        return sel

    if override_pick:
        return make(override_pick, PATHS.get(override_pick, "harness"), "principal_override")

    for role, fired in (phase_b or {}).items():
        if fired:
            sel = make(role, PATHS.get(role, "harness"), "phase_b")
            sel.notes.append(f"Phase B: {role} missed its own service threshold")
            return sel

    if not eligible:
        sel = make(None, None, "no_upgrade")
        why = (f"no role reached n >= {min_n} with a positive 90 % lower bound"
               if not out_of_moves else
               f"no role reached n >= {min_n} with a positive 90 % lower bound and a fix rate "
               f"above zero ({', '.join(sorted(out_of_moves))} have failed every attempt so far)")
        sel.notes.append(why + "; the matched-budget test-time-scaling ghost runs instead")
        return sel

    best = max(eligible, key=lambda r: (gain_per_usd(regs, r, eligible[r].blame_s, pf(r)[0]),
                                        eligible[r].var))
    return make(best, PATHS.get(best, "harness"), "gain_per_usd")


def phase_b_checks(regs: Regs, metrics: dict[str, float], accepted: int,
                   exhausted: set[str] | None = None, last_fired_at: int | None = None) -> dict[str, bool]:
    """Service roles are considered on every third *accepted* generation — once, not on every
    generation while the count happens to divide — and only on evidence from their own record."""
    cfg = regs.g("phase_b")
    if accepted == 0 or accepted % int(cfg["every"]) != 0 or accepted == last_fired_at:
        return {}
    out = {
        "ENGINEER": metrics.get("fix_precision", 1.0) < cfg["engineer_fix_precision"]
        or metrics.get("regression_precision", 1.0) < cfg["engineer_regression_precision"],
        "SCRUTINEER": metrics.get("router_precision", 1.0) < cfg["router_precision"],
        "HISTORIAN": metrics.get("marimo_first_pass", 1.0) < cfg["historian_first_pass"]
        or metrics.get("page_utility", 1.0) < cfg["historian_page_utility"],
        "PIT_CREW": metrics.get("sandbox_fail_rate", 0.0) > cfg["pitcrew_sandbox_fail"],
    }
    return {r: v for r, v in out.items() if r not in (exhausted or set())}


ROLE_ORDER = ALL_ROLES
