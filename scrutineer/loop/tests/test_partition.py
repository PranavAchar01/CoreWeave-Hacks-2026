"""Whether the task population is one population.

The detector's job is to be capable of saying no. These tests spend most of their effort on the
null case, because a separability test that always finds a split is not a test.
"""

import json
from pathlib import Path

from scrutineer.partition import Split, _tv, analyse, matrix, report


def test_identical_profiles_are_not_separable():
    a = [0.25, 0.25, 0.25, 0.25]
    assert _tv(a, a) == 0.0


def test_disjoint_profiles_are_maximally_separable():
    assert _tv([1.0, 0.0], [0.0, 1.0]) == 1.0


def test_the_matrix_sums_credit_per_component_and_family():
    inc = [("AERO", "dialog", 3.0), ("AERO", "dialog", 2.0), ("DATA", "checkout", 4.0)]
    assert matrix(inc) == {"AERO": {"dialog": 5.0}, "DATA": {"checkout": 4.0}}


def test_a_flat_matrix_reports_not_separable(tmp_path, monkeypatch):
    """Both components failing on the same tasks must come back NOT separable, whatever the
    volume of evidence. This is the result that kills the idea, so it has to be reachable."""
    import scrutineer.partition as P

    fams = {f"w{i:02d}": ["checkout", "dialog", "tabs", "signup"][i % 4] for i in range(20)}
    monkeypatch.setattr(P, "families", lambda: fams)
    rows = []
    for i in range(20):
        for role in ("AERO", "DATA"):
            rows.append({"role": role, "delta_s": 3.0,
                         "replay_ref": f"scrutineer:///replay-{role.lower()}-w{i:02d}-patch-replay@x"})
    obj = tmp_path / "objects"
    obj.mkdir()
    (obj / "ledger:gen-0.json").write_text(json.dumps({"generation": 0, "rows": rows}))

    s = analyse(tmp_path, draws=400)
    assert s is not None
    assert s.tv < 0.05
    assert not s.separable
    assert "NOT SEPARABLE" in report(tmp_path)


def test_disjoint_evidence_reports_separable(tmp_path, monkeypatch):
    import scrutineer.partition as P

    fams = {f"w{i:02d}": ("checkout" if i < 10 else "dialog") for i in range(20)}
    monkeypatch.setattr(P, "families", lambda: fams)
    rows = []
    for i in range(20):
        role = "DATA" if i < 10 else "AERO"
        rows.append({"role": role, "delta_s": 4.0,
                     "replay_ref": f"scrutineer:///replay-{role.lower()}-w{i:02d}-patch-replay@x"})
    obj = tmp_path / "objects"
    obj.mkdir()
    (obj / "ledger:gen-0.json").write_text(json.dumps({"generation": 0, "rows": rows}))

    s = analyse(tmp_path, draws=400)
    assert s is not None and s.separable
    assert s.tv > 0.9
    assert set(s.sides["DATA"]) == {"checkout"}
    assert set(s.sides["AERO"]) == {"dialog"}


def test_thin_evidence_says_nothing(tmp_path):
    (tmp_path / "objects").mkdir()
    assert analyse(tmp_path) is None
    assert "not enough" in report(tmp_path)


def test_the_row_is_serialisable():
    s = Split(pair=("A", "B"), tv=0.5, ci=(0.4, 0.6), sides={"A": ["x"], "B": ["y"]},
              n={"A": 5, "B": 5}, separable=True)
    assert s.row()["tv"] == 0.5 and s.row()["separable"] is True


def test_it_runs_against_whatever_is_actually_on_disk():
    """Not an assertion about the answer — only that the real ledger does not crash it."""
    out = report(Path(__file__).resolve().parents[1] / "state")
    assert isinstance(out, str) and out
