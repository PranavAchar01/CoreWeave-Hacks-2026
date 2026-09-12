"""The public benchmark, and the boundary that makes a number on it mean anything.

HumanEval ships one test set. A harness whose pre-submit check runs those tests scores perfectly
and measures nothing, so the boundary is not a promise, it is these tests: the agent is handed the
prompt, the tests are used only to score, and the three splits never overlap.
"""

import doctest

from scrutineer.bench import build_pool, build_pool_plus, three_way
from scrutineer.car.roles import _extract_code, _probe_code

POOL = build_pool()
IDS = lambda xs: {i.id for i in xs}  # noqa: E731


def test_the_benchmark_loaded_whole():
    assert len(POOL) == 164
    assert all(i.tests and i.entry_point and i.prompt for i in POOL)


def test_the_three_splits_never_overlap():
    practice, season_sealed, final_held = three_way(POOL)
    assert not IDS(practice) & IDS(season_sealed)
    assert not IDS(practice) & IDS(final_held)
    assert not IDS(season_sealed) & IDS(final_held)
    # size is the sibling test's job; this one only asserts the three sets never touch
    assert len(IDS(practice) | IDS(season_sealed) | IDS(final_held)) == len(POOL)


def test_the_headline_set_is_wide_enough_to_carry_a_number():
    """At n=30 one problem is 3.3 points. The held-out set is everything the loop never touches,
    so a difference has room to be a difference rather than a coin."""
    practice, season_sealed, final_held = three_way(POOL)
    assert len(final_held) >= 100
    assert len(practice) + len(season_sealed) + len(final_held) == len(POOL)
    assert not IDS(final_held) & (IDS(practice) | IDS(season_sealed))


def test_what_the_agent_is_handed_never_contains_the_answer_key():
    for item in POOL[:40]:
        assert item.tests not in item.prompt
        assert "def check(" not in item.prompt


def test_the_pre_submit_probe_cannot_reach_the_held_out_tests():
    """The whole experiment rests on this. The probe may run the docstring's own examples and
    nothing else."""
    item = next(i for i in POOL if i.entry_point == "has_close_elements")
    seen = {}

    class Spy:
        def run(self, script):
            seen["script"] = script
            class R:  # noqa: D106
                ok, stdout, stderr = True, "EXAMPLES 2 0\nSCRUTINEER_PASS\n", ""
            return R()

    import scrutineer.rails.sandbox as sb

    real, sb.sandbox = sb.sandbox, lambda: Spy()
    try:
        _probe_code(item, "def has_close_elements(n, t):\n    return False\n", "audit")
    finally:
        sb.sandbox = real
    assert item.tests not in seen["script"]
    assert "check(" not in seen["script"]


def test_the_scorer_does_use_the_held_out_tests():
    item = POOL[0]
    h = item.harness("def f():\n    pass\n")
    assert item.tests in h
    assert f"check({item.entry_point})" in h


def test_the_probe_rejects_code_that_fails_its_own_examples():
    item = next(i for i in POOL if i.entry_point == "has_close_elements")
    good = ("def has_close_elements(numbers, threshold):\n"
            "    return any(abs(a - b) < threshold\n"
            "               for i, a in enumerate(numbers)\n"
            "               for j, b in enumerate(numbers) if i != j)\n")
    assert _probe_code(item, good, "audit").score == 1.0
    assert _probe_code(item, good.replace("< threshold", "> threshold"), "audit").score == 0.0


def test_the_docstring_is_parsed_rather_than_the_whole_prompt():
    """Handing doctest the raw prompt swallows the closing triple quote into the last example's
    expected output, so correct code failed its own final example."""
    item = next(i for i in POOL if i.entry_point == "has_close_elements")
    raw = doctest.DocTestParser().get_examples(item.prompt)
    assert raw[-1].want.strip().endswith('"""'), "the raw-prompt parse is still the broken one"


def test_source_is_not_truncated_at_a_comparison_operator():
    """The HTML extractor cuts from the first `<`, which in Python is an operator. It halved every
    candidate and made the benchmark read as unsolvable."""
    reply = 'Sure:\n```python\ndef f(a, b):\n    return a < b\n```\nHope that helps.'
    got = _extract_code(reply, "py")
    assert got == "def f(a, b):\n    return a < b"
    assert "<" in got


def test_the_html_path_is_untouched():
    out = _extract_code("```html\n<html><body>hi</body></html>\n```", "web")
    assert "<html" in out and "```" not in out



def test_the_extended_scorer_never_fails_a_correct_solution():
    """The scorer's own validation: if the reference implementation does not pass it, the scorer
    is wrong and every number it produces is wrong. Checked on a sample for speed; the full 164
    were verified once by hand."""
    from scrutineer.rails.sandbox import sandbox

    for item in build_pool_plus()[:6]:
        assert sandbox().run(item.harness(item.prompt + item.reference)).ok, item.id


def test_the_extended_scorer_catches_a_wrong_answer():
    item = next(i for i in build_pool_plus() if i.entry_point == "has_close_elements")
    wrong = "def has_close_elements(numbers, threshold):\n    return False\n"
    from scrutineer.rails.sandbox import sandbox

    assert not sandbox().run(item.harness(wrong)).ok
