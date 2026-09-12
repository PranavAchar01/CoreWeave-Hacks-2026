"""A comparison states what it could have seen, and the headline obeys it.

The recorded BigCodeBench-Hard result is the fixture throughout: 76 held-out items, 4 fixed and 9
broken by the champion, 32.9 % -> 26.3 %, exact McNemar p = 0.267. It is the case these rules were
written for — a difference big enough to look like something, on a sample too small to say what.
"""

import pytest
import yaml

from scrutineer.bcbrun import compare, mcnemar
from scrutineer.resolution import mde, n_star, paired, power, resolve, verdict
from scrutineer.theta import Theta
from scrutineer.trial import scaling_harness, starting_harness

RECORDED = dict(fixed=4, broken=9, n=76)


def _arm(name, passes, n=76, cost=1.0):
    per = {f"bcb{i:04d}": i in passes for i in range(n)}
    return {
        "benchmark": "BigCodeBench-Hard",
        "harness": name,
        "n": n,
        "per_item": per,
        "pass_at_1": sum(per.values()) / n,
        "solved": sum(per.values()),
        "cost_usd": cost,
    }


# -- the maths ---------------------------------------------------------------------------------


def test_the_recorded_p_value_is_reproduced_exactly():
    assert resolve(**RECORDED)["p_two_sided"] == pytest.approx(0.26685, abs=1e-5)
    assert mcnemar(4, 9) == pytest.approx(0.26685, abs=1e-5)


def test_exact_power_agrees_with_an_independent_simulation():
    """The simulated table in research/R10 (20,000 draws per row) was computed before this module
    existed. Exact and simulated must agree to within simulation error."""
    pd = 13 / 76
    for pp, simulated in {5: 0.11, 10: 0.47, 13: 0.77, 15: 0.92}.items():
        d = pp / 100
        assert power(76, (pd + d) / 2, (pd - d) / 2) == pytest.approx(simulated, abs=0.02)


def test_the_exact_test_never_rejects_more_than_alpha_under_no_effect():
    pd = 13 / 76
    assert power(76, pd / 2, pd / 2) <= 0.05


def test_power_rises_with_the_effect_and_with_the_sample():
    pd = 0.2
    assert power(76, 0.15, 0.05) > power(76, 0.12, 0.08)
    assert power(300, (pd + 0.066) / 2, (pd - 0.066) / 2) > power(76, (pd + 0.066) / 2, (pd - 0.066) / 2)


def test_the_minimum_detectable_effect_at_n76_is_larger_than_the_observed_effect():
    m = mde(76, 13 / 76)
    assert 0.12 <= m <= 0.15
    assert m > 0.066


def test_n_star_says_how_far_short_the_sample_fell():
    ns = n_star(
        5 / 76,  # |4 fixed - 9 broken| / 76 = 6.6 pp
        13 / 76,
    )
    assert ns > 76 * 3, "a 6.6-point effect at this discordance needs several times 76 items"
    assert n_star(0.0, 0.2) is None


# -- what may be said --------------------------------------------------------------------------


def test_an_unresolved_comparison_never_says_better_or_worse():
    r = resolve(**RECORDED)
    assert not r["resolved"]
    assert r["claim"].startswith("unresolved")
    assert "worse" not in r["claim"] and "better" not in r["claim"]
    assert r["q"] < 1


def test_a_resolved_comparison_says_which_way():
    r = resolve(fixed=20, broken=2, n=76)
    assert r["resolved"] and r["claim"].startswith("better")
    assert resolve(fixed=2, broken=20, n=76)["claim"].startswith("worse")


def test_identical_harnesses_are_reported_as_identical():
    assert resolve(fixed=0, broken=0, n=76)["claim"] == "identical on every item"


def test_paired_counts_only_items_both_harnesses_ran():
    a = {"x": True, "y": False, "z": True}
    b = {"x": True, "y": True}
    r = paired(a, b)
    assert r["n"] == 2 and r["fixed"] == 1 and r["broken"] == 0


def test_compare_keeps_its_old_fields_and_adds_resolution():
    """dash.js reads bcb_compare.json; the new fields are additive or the dashboard breaks."""
    a, b = _arm("starting", set(range(25))), _arm("champion", set(range(4, 25)) | {70, 71, 72, 73})
    c = compare(a, b)
    for k in ("benchmark", "n", "baseline", "loop", "delta_pp", "fixed", "broken", "p_two_sided"):
        assert k in c
    assert c["resolution"]["n"] == 76


# -- the headline ------------------------------------------------------------------------------


def test_the_recorded_result_headlines_as_unresolved_not_regression():
    base = _arm("starting", set(range(25)))
    champ = _arm("champion", (set(range(25)) - set(range(9))) | {60, 61, 62, 63})
    assert verdict(base, champ, None)["headline"] == "unresolved"


def test_beating_the_baseline_but_not_resampling_is_not_a_harness_gain():
    """The case arXiv:2607.12227 warns about: the loop's gain is real, and spending the same money on
    more draws buys it too."""
    base = _arm("starting", set(range(20)))
    win = set(range(45))
    v = verdict(base, _arm("champion", win), _arm("scaling", win - {44}))
    assert v["loop_vs_baseline"]["resolved"]
    assert "not distinguishable from spending the budget on more samples" in v["headline"]


def test_a_harness_gain_has_to_beat_both_arms():
    base = _arm("starting", set(range(10)))
    v = verdict(base, _arm("champion", set(range(60))), _arm("scaling", set(range(12))))
    assert v["headline"].startswith("harness gain")


def test_budget_matching_is_checked_not_assumed():
    base = _arm("starting", set(range(10)), cost=1.0)
    v = verdict(base, _arm("champion", set(range(10)), cost=3.0), _arm("scaling", set(range(10)), cost=1.0))
    assert v["budget_ratio_loop_to_scaling"] == 3.0
    assert v["budget_matched"] is False


# -- the resampling arm ------------------------------------------------------------------------


def test_the_scaling_harness_changes_only_how_many_draws_and_how_one_is_chosen():
    base = Theta.load(None)
    start, scale = starting_harness(base), scaling_harness(base)
    changed = {p for p in start.files if start.files[p] != scale.files.get(p)}
    assert changed == {"skills/tyres/tyres.yaml", "skills/data/tools.yaml"}, f"scaling touched {changed}"
    a = yaml.safe_load(start.files["skills/tyres/tyres.yaml"])["modes"]
    b = yaml.safe_load(scale.files["skills/tyres/tyres.yaml"])["modes"]
    for mode in a:
        assert b[mode]["samples"] == a[mode]["samples"] + 1
        assert {k: v for k, v in b[mode].items() if k != "samples"} == {
            k: v for k, v in a[mode].items() if k != "samples"
        }
    da = yaml.safe_load(start.files["skills/data/tools.yaml"])
    db = yaml.safe_load(scale.files["skills/data/tools.yaml"])
    assert db["probe"]["mode"] == "audit"
    assert {k: v for k, v in db.items() if k != "probe"} == {k: v for k, v in da.items() if k != "probe"}


def test_extra_draws_without_a_selector_would_be_thrown_away():
    """Why the scaling arm carries a selector. At `syntax` two different correct-looking candidates
    score identically, so the car keeps the first and the second draw bought nothing."""
    from scrutineer.bcb import build_pool
    from scrutineer.car.roles import _probe_code

    item = build_pool()[0]
    one = f"def {item.entry_point}(*a, **k):\n    return 1\n"
    two = f"def {item.entry_point}(*a, **k):\n    return 2\n"
    assert _probe_code(item, one, "syntax").score == _probe_code(item, two, "syntax").score == 1.0
