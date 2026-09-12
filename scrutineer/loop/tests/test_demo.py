"""The seeded season is stub data shown to people, so it has to be labelled as stub and it has to
hold together: the pages it links to must exist, and its curve must only move when the loop
actually kept something. These tests read the artefact that ships rather than rebuilding it, so
they also fail if someone regenerates it into a worse shape."""

import json
from pathlib import Path

import pytest

from scrutineer import demopages as D

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = ROOT / "state" / "broadcast.json"


def test_a_change_kept_on_one_run_is_in_effect_on_the_next():
    assert D.defects_at(0, 1) == {"contrast"}, "run 1 runs the harness it started with"
    assert D.defects_at(1, 1) == set(), "the change kept on run 1 is what run 2 runs with"
    assert D.defects_at(2, 1) == set(), "a refused change takes nothing away"


def test_every_page_has_a_defect_the_loop_can_reach():
    assert len(D.ASSIGN) == 20
    for row in D.ASSIGN:
        assert set(row) <= set(D.DEFECTS)
    assert any(not row for row in D.ASSIGN), "something has to be right from the start"
    left = {d for row in D.ASSIGN for d in row} - set(D.FIX_ORDER)
    assert left, "an idealised season is not a perfect one"


def test_the_language_defect_is_the_absence_of_the_attribute():
    from scrutineer.webtasks import build_pool

    t = build_pool()[0]
    assert 'lang="en"' in D.render(t, set())
    assert 'lang="en"' not in D.render(t, {"lang"})


bundle = pytest.mark.skipif(not BUNDLE.exists(), reason="no seeded season written yet")


@bundle
def test_it_says_it_is_a_demonstration():
    b = json.loads(BUNDLE.read_text())
    if not b.get("demo"):
        pytest.skip("this is a real season, not the seeded one")
    assert "not-a-measured-run" in b["regs_sha256"]
    assert b["chain"]["rows"] == []


@bundle
def test_every_page_it_links_to_is_on_disk():
    b = json.loads(BUNDLE.read_text())
    if not b.get("demo"):
        pytest.skip("this is a real season, not the seeded one")
    for r in b["rounds"]:
        for pg in r["pages"]:
            assert (ROOT / "state" / "demo-pages" / pg["file"]).exists(), pg["file"]


@bundle
def test_a_clean_page_really_is_clean_and_the_score_only_moves_on_a_keep():
    b = json.loads(BUNDLE.read_text())
    if not b.get("demo"):
        pytest.skip("this is a real season, not the seeded one")
    rounds = b["rounds"]
    for r in rounds:
        for pg in r["pages"]:
            if pg["passed"]:
                assert pg["rules"] == [] and pg["weighted"] == 0 and pg["missing"] == []
    for prev, cur in zip(rounds, rounds[1:], strict=False):
        assert cur["official_s"] <= prev["official_s"] + 1e-9, "it got worse"
        if not prev["promoted"]:
            assert abs(cur["official_s"] - prev["official_s"]) < 1e-9, "a refusal moved the score"
    assert rounds[-1]["official_s"] < rounds[0]["official_s"] - 5


@bundle
def test_it_does_not_finish_the_job():
    b = json.loads(BUNDLE.read_text())
    if not b.get("demo"):
        pytest.skip("this is a real season, not the seeded one")
    last = b["rounds"][-1]
    assert any(not p["passed"] for p in last["pages"]), "every page clean reads as fabricated"
