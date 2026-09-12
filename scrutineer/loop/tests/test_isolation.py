"""The public/private split, the write set, and the feedback cap."""

import pytest

from scrutineer.circuits import split_pool
from scrutineer.engineer import propose
from scrutineer.evaluator import SealedEvaluator
from scrutineer.pitcrew import install
from scrutineer.regs import regs
from scrutineer.selection import Selection
from scrutineer.telemetry import Tracer
from scrutineer.theta import ARTIFACTS, Theta


def test_official_object_carries_no_item_content():
    r = regs()
    split = split_pool(1994)
    ev = SealedEvaluator(split.sealed, r)
    obj = ev.official(Theta.load(), 0, 1994, publish=False, trials=1)
    blob = str(obj)
    for item in split.sealed:
        assert item.prompt[:40] not in blob
        assert item.id not in blob, "a sealed item id crossed the boundary"
    assert set(obj) >= {"race_s", "pass_rate", "per_item_pass", "cost_usd"}


def test_scope_gate_blocks_a_diff_outside_the_selected_role():
    r = regs()
    t = Theta.load()
    split = split_pool(1994)
    sel = Selection(generation=0, role="DATA", path="harness", rule_fired="gain_per_usd")
    pr = propose(theta=t, sel=sel, pages=[], hypothesis="", skill_impact="")
    res = install(theta=t, candidate=pr.candidates[0], role="AERO", smoke_items=split.quali[:2],
                  regs=r, generation=0, seed=1994)
    assert not res.ok and "scope gate" in res.reason


def test_feedback_rows_stay_under_the_documented_cap():
    tr = Tracer(generation=0)
    with tr.lap(0, "c00-0", "race"), tr.op("x", "AERO", {}, "h", 0) as call:
        call.output = 1
    tr.add_feedback(call.id, "scrutineer.credit", {"role": "AERO", "delta_s": 1.0})
    with pytest.raises(ValueError, match="publish the full record"):
        tr.add_feedback(call.id, "big", {"blob": "y" * 2000})


def test_every_role_owns_exactly_one_artifact_path_set():
    t = Theta.load()
    seen: set[str] = set()
    for role, paths in ARTIFACTS.items():
        assert paths, f"{role} owns no artifact"
        for p in paths:
            assert p not in seen, f"{p} is owned by two roles"
            seen.add(p)
            assert p in t.files, f"{p} is missing from the repo"


def test_theta_swap_touches_only_one_role():
    t = Theta.load()
    files = dict(t.files)
    files["skills/aero/policy.yaml"] = files["skills/aero/policy.yaml"].replace(
        "retrieval: keyword", "retrieval: concept-match")
    other = Theta.from_files(t.root, files)
    swapped = t.swap("AERO", other)
    assert swapped.hash_for("AERO") == other.hash_for("AERO")
    for role in ARTIFACTS:
        if role != "AERO":
            assert swapped.hash_for(role) == t.hash_for(role)
