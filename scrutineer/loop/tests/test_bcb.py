"""BigCodeBench-Hard, and the exclusions that make a number on it honest.

Two things have to hold. The agent must never be able to see the unittest module that grades it,
and every task dropped from the set must be dropped for a reason decided before any candidate
existed — otherwise the exclusion is a thumb on the scale.
"""

from scrutineer.bcb import NETWORK_BOUND, SKIPPED_LIBS, build_pool, three_way

POOL = build_pool()
IDS = lambda xs: {i.id for i in xs}  # noqa: E731


def test_the_set_is_what_survived_two_declared_exclusions():
    assert len(POOL) == 134, "148 tasks, 8 dropped on dependencies, 6 on live network"
    assert len(build_pool.dropped) == 14


def test_nothing_excluded_for_a_reason_invented_after_the_fact():
    """Both exclusion lists are constants, not predicates over results. A task is dropped because
    of what it imports or because its own reference implementation cannot run under
    --network none, never because of how a candidate did on it."""
    assert SKIPPED_LIBS and NETWORK_BOUND
    assert all(isinstance(x, str) for x in SKIPPED_LIBS | NETWORK_BOUND)
    assert not IDS(POOL) & NETWORK_BOUND


def test_the_three_splits_partition_the_set():
    practice, season_sealed, final_held = three_way(POOL)
    assert not IDS(practice) & IDS(season_sealed)
    assert not IDS(practice) & IDS(final_held)
    assert not IDS(season_sealed) & IDS(final_held)
    assert len(IDS(practice) | IDS(season_sealed) | IDS(final_held)) == len(POOL)
    assert len(final_held) >= 70, "the headline needs room to be a number rather than a coin"


def test_the_season_cannot_reach_the_final_set():
    """The split the controller builds must not intersect the set the headline is measured on."""
    import os

    from scrutineer.circuits import split_pool

    old = os.environ.get("SCRUTINEER_TASKS")
    os.environ["SCRUTINEER_TASKS"] = "bcb"
    try:
        sp = split_pool(1994, 12, 12)
    finally:
        if old is None:
            os.environ.pop("SCRUTINEER_TASKS", None)
        else:
            os.environ["SCRUTINEER_TASKS"] = old
    _, _, final_held = three_way(POOL)
    assert not (IDS(sp.quali) | IDS(sp.sealed)) & IDS(final_held)


def test_what_the_agent_is_handed_never_contains_the_grader():
    for item in POOL[:40]:
        assert item.tests not in item.prompt
        assert "unittest" not in item.prompt or "import unittest" not in item.prompt


def test_the_scorer_runs_the_held_out_unittest_module():
    item = POOL[0]
    h = item.harness("def task_func():\n    pass\n")
    assert item.tests in h
    assert "loadTestsFromTestCase(TestCases)" in h
    assert "wasSuccessful" in h


def test_the_scorer_forces_a_headless_plotting_backend():
    """A third of these tasks import pyplot. Without this they wait for a window that never opens
    and the lap dies on a timeout that has nothing to do with the code."""
    h = POOL[0].harness("x = 1")
    assert h.index("matplotlib.use('Agg')") < h.index("x = 1")


def test_the_comparison_cannot_print_a_regression_as_a_gain():
    """The direction bug that nearly shipped. `compare` takes (baseline, loop); handing it the
    champion first reported a 6.6-point regression as a 6.6-point gain, and the console line read
    exactly like a win. Any measurement tool whose sign depends on argument order needs this."""
    from scrutineer.bcbrun import compare

    base = {"benchmark": "b", "harness": "starting", "n": 3, "pass_at_1": 1.0, "solved": 3,
            "cost_usd": 0.0, "per_item": {"a": True, "b": True, "c": True}}
    worse = {"benchmark": "b", "harness": "champion", "n": 3, "pass_at_1": 0.0, "solved": 0,
             "cost_usd": 0.0, "per_item": {"a": False, "b": False, "c": False}}
    c = compare(base, worse)
    assert c["delta_pp"] < 0, "a worse loop harness must produce a negative delta"
    assert c["baseline"]["harness"] == "starting"
    assert c["loop"]["harness"] == "champion"
    assert len(c["broken"]) == 3 and not c["fixed"]


def test_mcnemar_is_symmetric_and_calls_a_tie_a_tie():
    from scrutineer.bcbrun import mcnemar

    assert mcnemar(0, 0) == 1.0
    assert mcnemar(9, 4) == mcnemar(4, 9)
    assert mcnemar(20, 0) < 0.01
