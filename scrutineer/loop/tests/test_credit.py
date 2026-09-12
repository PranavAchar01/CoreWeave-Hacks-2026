"""Credit assignment: the router proposes, replay disposes, standings are statistical."""

from scrutineer.ledger import Standing, bootstrap_ci
from scrutineer.regs import regs
from scrutineer.selection import gain_per_usd, phase_b_checks, select


def _standing(role, xs):
    s = Standing(role=role, incidents=list(xs))
    s.n = len(xs)
    s.blame_s = sum(xs)
    s.ci_lo, s.ci_hi = bootstrap_ci(xs)
    if s.n > 1:
        m = s.blame_s / s.n
        s.var = sum((x - m) ** 2 for x in xs) / (s.n - 1)
    return s


def test_ci_excludes_zero_only_with_evidence():
    lo, hi = bootstrap_ci([10.0] * 9)
    assert lo > 0 and hi >= lo
    assert bootstrap_ci([]) == (0.0, 0.0)


def test_thin_evidence_never_upgrades():
    r = regs()
    table = {"AERO": _standing("AERO", [9.9])}
    sel = select(regs=r, generation=1, table=table, generalisation_gap=0.0,
                 zero_variance_groups=0.0, agent_error_share=0.0, harness_flip_share=1.0,
                 p_fix={}, p_fix_counts={})
    assert sel.role is None and sel.rule_fired == "no_upgrade"


def test_gain_per_usd_can_lose_to_an_ineligible_role():
    """LOOP.md's worked example: the strategist has the better ratio and is still not picked."""
    r = regs()
    table = {"AERO": _standing("AERO", [9.9] * 9), "STRATEGIST": _standing("STRATEGIST", [5.2] * 4)}
    assert gain_per_usd(r, "STRATEGIST", table["STRATEGIST"].blame_s, 0.5) > \
           gain_per_usd(r, "AERO", table["AERO"].blame_s, 0.5)
    sel = select(regs=r, generation=7, table=table, generalisation_gap=0.0,
                 zero_variance_groups=0.0, agent_error_share=0.0, harness_flip_share=1.0,
                 p_fix={}, p_fix_counts={})
    assert sel.role == "AERO" and sel.rule_fired == "gain_per_usd"


def test_circuit_branch_beats_everything():
    r = regs()
    table = {"AERO": _standing("AERO", [9.9] * 9)}
    sel = select(regs=r, generation=3, table=table, generalisation_gap=0.4,
                 zero_variance_groups=0.0, agent_error_share=0.9, harness_flip_share=0.1,
                 p_fix={}, p_fix_counts={})
    assert sel.role == "SIMULATOR" and sel.rule_fired == "circuit"


def test_agent_error_routes_to_weights():
    r = regs()
    table = {"AERO": _standing("AERO", [9.9] * 9)}
    sel = select(regs=r, generation=3, table=table, generalisation_gap=0.0,
                 zero_variance_groups=0.0, agent_error_share=0.7, harness_flip_share=0.2,
                 p_fix={}, p_fix_counts={})
    assert sel.role == "POWER_UNIT" and sel.path == "weights"


def test_exhausted_roles_are_not_picked():
    r = regs()
    table = {"AERO": _standing("AERO", [9.9] * 9), "DATA": _standing("DATA", [4.0] * 9)}
    sel = select(regs=r, generation=5, table=table, generalisation_gap=0.0,
                 zero_variance_groups=0.0, agent_error_share=0.0, harness_flip_share=1.0,
                 p_fix={}, p_fix_counts={}, exhausted={"AERO"})
    assert sel.role == "DATA"


def test_phase_b_fires_once_per_accepted_milestone():
    r = regs()
    m = {"fix_precision": 0.1, "router_precision": 1.0, "marimo_first_pass": 1.0,
         "page_utility": 1.0, "sandbox_fail_rate": 0.0}
    assert phase_b_checks(r, m, accepted=3)["ENGINEER"] is True
    assert phase_b_checks(r, m, accepted=3, last_fired_at=3) == {}
    assert phase_b_checks(r, m, accepted=2) == {}


def test_a_role_that_has_failed_every_attempt_stops_being_picked():
    """Blame alone kept one component eligible forever: it was the only name that cleared the
    evidence bar, and `max` over a single-element set always returns that element. A measured fix
    rate of zero has to take it out of the running."""
    r = regs()
    table = {"AERO": _standing("AERO", [9.9] * 9), "DATA": _standing("DATA", [4.0] * 9)}
    kw = dict(regs=r, generation=9, table=table, generalisation_gap=0.0, zero_variance_groups=0.0,
              agent_error_share=0.0, harness_flip_share=1.0)
    # two attempts, both failed: still a prior, still eligible
    assert select(p_fix={"AERO": 0.0}, p_fix_counts={"AERO": 2}, **kw).role == "AERO"
    # a third failure makes the zero real, and the pick moves on
    assert select(p_fix={"AERO": 0.0}, p_fix_counts={"AERO": 3}, **kw).role == "DATA"


def test_every_role_spent_means_no_upgrade():
    r = regs()
    table = {"AERO": _standing("AERO", [9.9] * 9)}
    sel = select(regs=r, generation=9, table=table, generalisation_gap=0.0, zero_variance_groups=0.0,
                 agent_error_share=0.0, harness_flip_share=1.0,
                 p_fix={"AERO": 0.0}, p_fix_counts={"AERO": 4})
    assert sel.role is None and sel.rule_fired == "no_upgrade"
    assert "failed every attempt" in sel.notes[0]


def test_retirement_expires_so_no_path_closes_for_good():
    """A component whose every attempt failed is ranked out, not struck off for good.

    The evidence that retires it is a fact about the past: the harness it would be changing three
    generations later is not the harness it failed on. A permanent strike-off closed the search
    and broke the property the Darwin Godel Machine states outright — every path stays feasible
    given enough compute (arXiv:2505.22954 C.2).
    """
    from scrutineer.regs import Regs
    from scrutineer.selection import Standing, select

    regs = Regs.load()
    table = {"AERO": Standing(role="AERO", n=9, blame_s=90.0, ci_lo=60.0, ci_hi=120.0, var=1.0)}
    dead = {"AERO": 0.0}
    counts = {"AERO": 3}
    common = dict(regs=regs, table=table, generalisation_gap=0.0, zero_variance_groups=0.0,
                  agent_error_share=0.0, harness_flip_share=1.0, p_fix=dead, p_fix_counts=counts)

    cool = int(regs.g("credit", "retire_generations"))
    just_failed = select(generation=5, last_attempt={"AERO": 5}, **common)
    assert just_failed.role is None, "a component that just failed is ranked out"

    later = select(generation=5 + cool, last_attempt={"AERO": 5}, **common)
    assert later.role == "AERO", "and is eligible again once the cooling-off period has passed"
