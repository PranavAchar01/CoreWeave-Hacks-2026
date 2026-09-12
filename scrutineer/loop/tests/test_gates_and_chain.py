"""Gates refuse, and receipts cannot be edited after the fact."""

import json

import pytest

from scrutineer import gates as G
from scrutineer.audit import audit, seed_tamper
from scrutineer.chain import CHAIN, ChainRow, append, rows, verify_chain
from scrutineer.patchtool import make_diff
from scrutineer.regs import regs
from scrutineer.theta import Theta


@pytest.fixture(autouse=True)
def clean_chain():
    CHAIN.unlink(missing_ok=True)
    yield
    CHAIN.unlink(missing_ok=True)


def _row(i: int) -> ChainRow:
    return ChainRow(round=i, role="AERO", prefix="R", parent_version=f"aero:v{i}",
                    new_version=f"aero:v{i + 1}", proposal_hash="ab" * 16, defs_hash="cd" * 16,
                    regs_hash=regs().sha256, official=70.0 - i, claimed=71.0 - i, verdict="LEGAL",
                    mode="attended", rule_fired="gain_per_usd")


def test_chain_verifies_and_detects_tampering():
    for i in range(3):
        append(_row(i))
    assert verify_chain()[0]
    assert len(rows()) == 3
    text = CHAIN.read_text().replace('"official": 70.0', '"official": 10.0')
    CHAIN.write_text(text)
    ok, problems = verify_chain()
    assert not ok
    assert any("signature" in p for p in problems)


def test_chain_has_no_fork():
    append(_row(0))
    append(_row(1))
    parsed = [json.loads(ln) for ln in CHAIN.read_text().splitlines()]
    assert parsed[1]["predecessor_hash"] != "0" * 64


def test_seesaw_needs_both_circuits():
    r = regs()
    assert G.seesaw(r, 0.9, 0.7).ok
    assert not G.seesaw(r, 0.9, -0.2).ok
    assert not G.seesaw(r, 0.0, 0.0).ok


def test_correlation_flags_disagreement():
    r = regs()
    assert G.correlation(r, 0.4, 0.9, 0.7).ok
    assert not G.correlation(r, 0.4, 0.9, -0.7).ok
    assert G.correlation(r, 0.1, 0.9, -0.1).ok, "inside the dead band is not a disagreement"


def test_regression_tolerates_a_flapping_trial():
    prev = {"a": True, "b": True}
    assert not G.regression(prev, {"a": True, "b": False}).ok
    assert G.regression(prev, {"a": True, "b": False}, {"a": True, "b": True}).ok


def test_entropy_collapse_blocks_the_engine():
    r = regs()
    assert G.entropy(r, [1.0] * 8).ok
    assert not G.entropy(r, [1.0, 0.9, 0.8, 0.5, 0.4, 0.3, 0.2, 0.1]).ok
    assert G.entropy(r, [1.0]).ok, "no RL job means no entropy gate"


def test_auditor_black_flags_a_scorer_edit():
    r = regs()
    _path, diff = seed_tamper({"REGS.md": (Theta.load().root / "REGS.md").read_text()})
    v = audit(diff_text=diff, role="AERO", before={}, regs=r, seeded=True)
    assert v.verdict == "BLACK_FLAG"
    assert v.functional_role == "Evaluation" and v.obligation == "MeasurementValidity"


def test_auditor_black_flags_an_out_of_scope_diff():
    r = regs()
    t = Theta.load()
    diff = make_diff("skills/data/tools.yaml", t.files["skills/data/tools.yaml"],
                     t.files["skills/data/tools.yaml"].replace("schema_version: 1", "schema_version: 2"))
    assert audit(diff_text=diff, role="DATA", before=t.files, regs=r).verdict == "LEGAL"
    assert audit(diff_text=diff, role="AERO", before=t.files, regs=r).verdict == "BLACK_FLAG"


def test_auditor_black_flags_turning_the_probe_off():
    r = regs()
    t = Theta.load()
    diff = make_diff("skills/data/tools.yaml", t.files["skills/data/tools.yaml"],
                     t.files["skills/data/tools.yaml"].replace("enabled: true", "enabled: false"))
    v = audit(diff_text=diff, role="DATA", before=t.files, regs=r)
    assert v.verdict == "BLACK_FLAG" and v.functional_role == "Recording"


def test_strengthening_a_check_is_not_removing_one():
    """`reaudit: false  # ... check the fix ...` becoming `reaudit: true` strengthens verification.
    Matching the word "check" in the replaced line's comment black-flagged it as tampering."""
    r = regs()
    t = Theta.load()
    before = t.files["skills/data/tools.yaml"]
    after = before.replace("reaudit: false", "reaudit: true")
    diff = make_diff("skills/data/tools.yaml", before, after)
    v = audit(diff_text=diff, role="DATA", before=t.files, regs=r)
    assert v.verdict == "LEGAL", f"strengthening a check was flagged as {v.verdict}: {v.evidence}"


def test_a_comment_is_not_a_gate_constant():
    r = regs()
    t = Theta.load()
    before = t.files["skills/data/tools.yaml"]
    after = before + "\n# raising smoke_inputs does not change w_pass or min_incidents\n"
    diff = make_diff("skills/data/tools.yaml", before, after)
    assert audit(diff_text=diff, role="DATA", before=t.files, regs=r).verdict == "LEGAL"
