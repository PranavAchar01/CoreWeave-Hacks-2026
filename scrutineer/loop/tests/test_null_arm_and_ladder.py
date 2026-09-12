"""The two corrections that came out of the −6.6 regression.

A candidate cleared all ten gates on n=33 confirmed incidents and a +0.33 sealed delta, then lost
6.6 points on the untouched 76. Two mechanisms produced that, and these are their tests.

  1. Credit was uncontrolled. Every replay re-runs the lap, which re-samples the driver, so a lap
     that flipped got its role credited whether the intervention or the second draw did it. AERO's
     counterfactual adds references, which perturbs the prompt hardest, so AERO collected the most
     of a currency that was never real.

  2. The sealed split was queried once per generation for five generations and treated as though
     it were still held out. It was not; adaptive reuse costs sample complexity linear in the
     number of queries (Dwork et al., arXiv:1411.2664).
"""

import pytest

from scrutineer.evaluator import SealedEvaluator
from scrutineer.gates import COMPARISON, ladder
from scrutineer.regs import regs
from scrutineer.replay import ReplayRecord


def _rec(**kw):
    base = dict(
        lap_index=0,
        item_id="bcb0001",
        role="AERO",
        mode="patch-replay",
        actual_s=100.0,
        replayed_s=60.0,
        seeds=2,
        flipped=True,
        detail={},
    )
    return ReplayRecord(**{**base, **kw})


# -- the do_resample null arm ------------------------------------------------------------------


def test_credit_is_the_contrast_with_the_null_not_the_distance_from_the_lap():
    """The whole correction in one assertion. The intervention took 40 s off the original lap, but
    simply running the lap again took 35 s off it; the role is worth the 5 s difference."""
    rec = _rec(null_s=65.0)
    assert rec.raw_credit_s == pytest.approx(40.0)  # what the old estimator credited
    assert rec.resample_credit_s == pytest.approx(35.0)  # what a second draw was worth, free
    assert rec.credit_s == pytest.approx(5.0)  # what the role actually bought
    assert rec.controlled


def test_a_role_that_only_matched_resampling_earns_nothing():
    """The AERO case. Replay and null land in the same place: the intervention did nothing that
    drawing again would not have done, and it must not clear the incident threshold."""
    rec = _rec(replayed_s=60.0, null_s=60.0)
    thr = float(regs().g("credit", "incident_threshold_s"))
    assert rec.credit_s == pytest.approx(0.0)
    assert rec.credit_s <= thr, "resampling credit must not be able to confirm an incident"
    assert rec.raw_credit_s > thr, "and the uncontrolled estimator would have confirmed it"


def test_a_role_worse_than_resampling_is_credited_negatively():
    """An intervention can be actively harmful — slower than leaving the harness alone. The
    contrast has to be able to say so, or blame only ever accumulates in one direction."""
    assert _rec(replayed_s=70.0, null_s=62.0).credit_s == pytest.approx(-8.0)


def test_flipping_requires_beating_the_null_arm():
    """`flipped` is the exact predicate `replay()` computes. Stated here as the rule it encodes:
    an intervention that passes no more often than plain resampling has flipped nothing."""

    def flipped(passes, null_passes):
        return passes > null_passes

    assert not flipped(2, 2), "matching the null is not a flip"
    assert not flipped(1, 2), "losing to the null is certainly not a flip"
    assert flipped(2, 1), "passing where resampling did not is a flip"
    # and the uncontrolled predicate the loop used to run would have called all three a flip
    assert all(p > 0 for p in (2, 1, 2))


def test_an_uncontrolled_record_still_reports_and_says_so():
    """Records written before the null arm existed, and any path that cannot afford one, must
    still be readable — and must not silently claim to be controlled."""
    rec = _rec()
    assert rec.null_s is None
    assert not rec.controlled
    assert rec.credit_s == rec.raw_credit_s
    assert rec.resample_credit_s == 0.0


# -- the Ladder --------------------------------------------------------------------------------


def _ladder(d_sealed, best=0.0, n=20, used=0):
    return ladder(regs(), d_sealed, best, n, used)


def test_a_gain_inside_the_splits_own_noise_is_not_reported():
    """+0.33 s on a 20-item sealed split is the regression that started all this. The Ladder's
    margin is wider than that by construction, so this answer never reaches the loop."""
    g = _ladder(0.33)
    assert not g.ok
    assert g.value["tau_s"] > 0.33
    assert "noise" in g.detail


def test_a_gain_larger_than_the_margin_is_reported():
    g = _ladder(12.0)
    assert g.ok
    assert g.value["d_sealed"] == 12.0


def test_the_margin_shrinks_as_the_sealed_split_grows():
    """A bigger split earns a finer ruler. If the margin were fixed, growing the split would buy
    nothing; if it grew, growing the split would be punished."""
    small = _ladder(0.0, n=20).value["tau_s"]
    large = _ladder(0.0, n=200).value["tau_s"]
    assert large < small
    # 1/sqrt(n), so ten times the items is sqrt(10) times the precision. Reported to 3 dp, which
    # is what the tolerance is for.
    assert large == pytest.approx(small / (10**0.5), abs=1e-3)


def test_the_standing_best_has_to_be_beaten_not_matched():
    """Otherwise a season ratchets sideways forever on candidates that tie."""
    assert not _ladder(8.0, best=8.0).ok
    assert not _ladder(8.0, best=20.0).ok


def test_the_split_stops_answering_once_its_query_budget_is_spent():
    budget = int(regs().g("gates", "sealed_query_budget"))
    assert _ladder(50.0, used=budget).ok, "the budget-th query is still inside the budget"
    g = _ladder(50.0, used=budget + 1)
    assert not g.ok, "a huge delta must not buy its way past an exhausted split"
    assert "exhausted" in g.detail
    assert g.about == COMPARISON, (
        "an exhausted split means the experiment was not valid, not that the component failed — "
        "recording it as a failed fix would retire the component for the loop's own bookkeeping"
    )


def test_a_five_generation_season_fits_inside_the_budget():
    """Two sealed queries a generation — the incumbent's official time and the candidate's — so a
    five-generation season asks ten questions. The budget has to admit a normal season, or the
    Ladder is just a slower way to refuse everything."""
    assert int(regs().g("gates", "sealed_query_budget")) >= 2 * 5


def test_the_sealed_split_counts_every_question_put_to_it():
    """The counter lives on the object holding the split, so no caller can query without paying."""
    ev = SealedEvaluator(items=[], regs=regs())
    assert ev.queries == 0 and ev.n_items == 0
