"""One generation of the real loop, and the document gate that stands in front of promotion."""

import pytest

from scrutineer import historian as H
from scrutineer.controller import Season
from scrutineer.telemetry import publish_object, state_dir


@pytest.fixture(scope="module")
def report():
    s = Season()
    return s.run_generation()


def test_a_generation_produces_every_artifact(report):
    assert report.claimed_s > 0 and report.official_s > 0
    assert report.rule_fired
    assert report.standings
    assert report.selection["generation"] == report.generation
    if report.rule_fired in ("no_upgrade", "circuit"):
        # A generation that refuses to change anything has no candidate, so no gates to run and
        # no debrief to homologate. That is the branch working, not a missing artifact.
        assert not report.gates
        assert report.notes
        return
    assert report.debrief["marimo_check"] is True
    assert {g["gate"] for g in report.gates} >= {
        "seesaw", "correlation", "regression", "cost_cap", "scrutineering", "novelty",
        "evidence", "diff_size", "comparable_ab", "rl_entropy"}


def test_selection_is_the_only_thing_that_names_a_role(report):
    assert report.role == report.selection["r_star"]
    if report.promoted:
        assert report.part and report.part.startswith(report.prefix)


def test_debrief_blocks_on_a_black_flag(tmp_path):
    for name in ("standings", "selection", "official", "ledger"):
        publish_object(f"{name}:gen-900", {"generation": 900, "roles": {}, "r_star": None,
                                           "race_s": 1.0, "rows": []})
    p = H.write_debrief(round_id=900, state_dir=state_dir(), verdict="BLACK_FLAG", seesaw_ok=True,
                        correlation_ok=True, regression_ok=True, cost_ok=True, champions={},
                        circuit="c", cost_cap=3.0, incident_threshold=0.5)
    res = H.run_debrief(p, 900)
    assert not res.gate_ok
    assert "HOMOLOGATION FAILED" in res.script_output
    p.unlink()


def test_debrief_blocks_when_the_ledger_disagrees_with_the_standings():
    publish_object("standings:gen-901", {"generation": 901,
                                         "roles": {"AERO": {"n": 3, "blame_s": 30.0}}})
    publish_object("selection:gen-901", {"generation": 901, "r_star": "AERO"})
    publish_object("official:gen-901", {"generation": 901, "race_s": 70.0})
    publish_object("ledger:gen-901", {"rows": [{"role": "AERO", "delta_s": 1.0}]})
    p = H.write_debrief(round_id=901, state_dir=state_dir(), verdict="LEGAL", seesaw_ok=True,
                        correlation_ok=True, regression_ok=True, cost_ok=True, champions={},
                        circuit="c", cost_cap=3.0, incident_threshold=0.5)
    res = H.run_debrief(p, 901)
    assert not res.gate_ok
    assert "could not reproduce" in res.script_output
    p.unlink()
