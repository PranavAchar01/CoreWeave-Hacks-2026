"""What a gate is evidence about.

A refusal only tells you something about a component if the gate was judging the component. This
was not always true here: every non-promotion fed the credit model as a failed fix, so a budget
cap left over from a different inference provider vetoed seven generations in a row, recorded the
two largest held-out gains of the season as failures, and retired both components that had earned
credit. These tests pin the distinction so it cannot quietly come back.
"""

from scrutineer import gates as G
from scrutineer.regs import Regs


def _row(name, ok, about):
    return {"gate": name, "ok": ok, "about": about}


def test_a_budget_veto_is_not_evidence_about_the_change():
    """cost_cap says the run was expensive. The score still moved or it did not."""
    cost = G.cost(Regs.load(), 99.0)
    assert not cost.ok
    assert cost.about == G.RUN
    assert G.measured([cost]), "a refusal on resources still leaves a valid measurement"


def test_an_invalid_ab_means_nothing_was_measured():
    same = G.comparable_ab("--- a\n+++ b\n+x", "--- a\n+++ b\n+x")
    assert not same.ok
    assert same.about == G.COMPARISON
    assert not G.measured([same]), "if the experiment was not valid there is no outcome to record"


def test_the_gates_that_judge_the_change_say_so():
    r = Regs.load()
    for g in (G.seesaw(r, 1.0, 1.0), G.diff_size(r, 40), G.evidence(["pattern-0001"]),
              G.novelty(r, "+x", []), G.verdict_gate(r, "LEGAL", 0.95, True)):
        assert g.about == G.CHANGE, g.name


def test_a_gate_that_can_never_pass_is_reported_rather_than_absorbed():
    """Three generations of the same non-change gate failing is a misconfigured harness."""
    history = [[_row("cost_cap", False, G.RUN), _row("seesaw", True, G.CHANGE)] for _ in range(3)]
    assert G.stuck(history) == ["cost_cap"]


def test_a_gate_that_judges_the_change_is_never_called_stuck():
    """seesaw failing three times running is the loop working, not a broken threshold."""
    history = [[_row("seesaw", False, G.CHANGE)] for _ in range(4)]
    assert G.stuck(history) == []


def test_two_failures_are_bad_luck_and_three_are_a_pattern():
    rows = [[_row("cost_cap", False, G.RUN)] for _ in range(2)]
    assert G.stuck(rows) == []
    assert G.stuck([*rows, [_row("cost_cap", False, G.RUN)]]) == ["cost_cap"]


def test_a_gate_that_recovers_is_not_stuck():
    history = [[_row("cost_cap", False, G.RUN)], [_row("cost_cap", True, G.RUN)],
               [_row("cost_cap", False, G.RUN)]]
    assert G.stuck(history) == []


def test_the_cap_is_reachable_on_the_rail_in_use():
    """The failure this whole module exists for: a cap below what a generation actually costs.

    Measured spend on the Anthropic rail was $3.28-$4.08 per generation across seven generations
    (state/season.json). A cap under that can never pass."""
    assert Regs.load().race_cap_usd > 4.08
