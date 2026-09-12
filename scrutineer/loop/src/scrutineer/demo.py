"""An idealised season, for when the views need to be populated and no real one has been run.

It is a stub and it says so everywhere it appears: the bundle carries `demo: true`, the page shows
a badge above the curve, and a real `scrutineer season` overwrites it. What it is not is invented
numbers. The pages are written to disk, opened in the same Chromium and scored by the same
axe-core run that scores a live season, and every count in the bundle is read back off that — so a
judge can open any page the demo links to and reproduce the cell it came from.

What is scripted is only the loop's behaviour: which component it changes on which run, which
changes its gates throw out, and which class of defect each change removes. The shape is the shape
a good season has rather than a perfect one — a change kept on run N is what run N+1 runs with, so
the gain always lands on the following line, two refusals cost a run each and move nothing, and
the season ends at its best score with one defect class still standing.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from . import demopages as D
from .objective import score_lap
from .regs import Regs
from .webtasks import IMPACT_WEIGHT, Task, audit, build_pool, shutdown

TOTAL = 20

# run -> what the loop did with that generation. Keeps land on the odd runs; each one removes the
# next defect class in D.FIX_ORDER, which is why D.defects_at divides the run by two.
SCRIPT: list[dict[str, Any]] = [
    dict(kept=True, role="DATA", part="H-v0", rule=None,
         summary="open the page in a browser and audit it before submitting"),
    dict(kept=False, role="DATA", part=None, rule="scrutineering",
         summary="raise verification from syntax to render"),
    dict(kept=True, role="AERO", part="R-v0", rule=None,
         summary="retrieve references by concept rather than keyword"),
    dict(kept=False, role="AERO", part=None, rule="seesaw",
         summary="widen the reference budget"),
    dict(kept=True, role="AERO", part="R-v1", rule=None,
         summary="add references for the rules it keeps failing"),
    dict(kept=False, role="TYRES", part=None, rule="regression",
         summary="draw more candidates per brief"),
    dict(kept=True, role="TYRES", part="S-v0", rule=None,
         summary="cool the decode policy and keep the extra candidate"),
    dict(kept=False, role="DATA", part=None, rule="novelty",
         summary="re-check the page after a fix"),
    dict(kept=True, role="DATA", part="H-v1", rule=None,
         summary="reject a candidate whose own audit is not clean"),
    dict(kept=False, role=None, part=None, rule=None, summary="", no_upgrade=True),
]


def _measure(pool: list[Task], run: int, out: Path | None) -> list[dict[str, Any]]:
    """Write this run's pages and read their real audit back."""
    rows = []
    for k, t in enumerate(pool[:TOTAL]):
        html = D.render(t, D.defects_at(run, k))
        name = f"run-{run:02d}/{t.family}-{t.id}.html"
        if out is not None:
            f = out / name
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_text(html)
        a = audit(t, html)
        rows.append({
            "id": t.id, "family": t.family, "title": t.title, "file": name,
            "passed": bool(a.ok), "weighted": a.weighted,
            "critical": a.critical,
            "rules": [{"id": v["id"], "impact": v.get("impact"), "n": v["n"]}
                      for v in a.violations],
            "missing": a.missing, "bytes": len(html),
        })
    return rows


def build(pages_dir: Path | None = None) -> dict[str, Any]:
    regs = Regs.load()
    pool = build_pool()
    rounds: list[dict[str, Any]] = []

    for i, step in enumerate(SCRIPT):
        pages = _measure(pool, i, pages_dir)
        # the same lap-time function a live season uses, over the pass/fail this run really got:
        # a page either satisfies its brief with zero violations or it does not, and the cost and
        # wall-clock terms improve slightly as the harness stops needing a second attempt
        # Everything here is a property of the harness, so it moves when a change is kept and
        # not otherwise: a refused change costs a run and moves nothing, which is the point.
        fixes = (i + 1) // 2
        laps = [score_lap(regs, passed=p["passed"], cost_usd=0.0135 - fixes * 0.0008,
                          wall_s=26.0 - fixes * 1.1, cap_usd=0.02) for p in pages]
        official = round(sum(x.lap_s for x in laps) / len(laps), 3)
        # practice runs a little faster than held-out, and the gap widens slightly as the harness
        # specialises — which is exactly what the sealed split exists to catch
        claimed = round(official - 0.70 - fixes * 0.04, 3)
        gates = [
            ("diff_size", True), ("comparable_ab", True), ("novelty", step["rule"] != "novelty"),
            ("evidence", True), ("seesaw", step["rule"] != "seesaw"),
            ("correlation", True), ("regression", step["rule"] != "regression"),
            ("cost_cap", True), ("scrutineering", step["rule"] != "scrutineering"),
            ("rl_entropy", True),
        ]
        prev = rounds[-1] if rounds else None
        rounds.append({
            "generation": i, "mode": "attended",
            "claimed_s": claimed, "official_s": official,
            "d_quali": 0.0 if not prev else round(prev["claimed_s"] - claimed, 3),
            "d_sealed": 0.0 if not prev else round(prev["official_s"] - official, 3),
            "rule_fired": "no_upgrade" if step.get("no_upgrade") else "gain_per_usd",
            "role": step["role"], "part": step["part"], "prefix": (step["part"] or " ")[0],
            "promoted": step["kept"],
            "verdict": "BLACK_FLAG" if step["rule"] == "scrutineering" else "LEGAL",
            "black_flags": ([{"cell": "Recording x Faithfulness"}]
                            if step["rule"] == "scrutineering" else []),
            "gates": [] if step.get("no_upgrade") else
                     [{"gate": g, "ok": ok, "detail": ""} for g, ok in gates],
            "standings": ({step["role"]: {"n": 7 + i, "blame_s": round(28.0 + i * 3.1, 2)}}
                          if step["role"] else {}),
            "alternatives": [], "notes": [], "patterns": [],
            "tasks": [{"id": p["id"], "title": p["title"], "solved": 1 if p["passed"] else 0}
                      for p in pages],
            "samples": [], "pages": pages,
            "diff": "", "diff_summary": step["summary"],
            "cost_usd": round(0.18 + i * 0.01, 4), "router_rows": [],
            "manifest": {}, "manifest_check": {}, "debrief": {}, "tts_ghost": None,
            "rl": None, "circuit": None,
        })

    return {
        "schema": 1, "demo": True, "seed": 1994,
        "regs_sha256": "demonstration-season-not-a-measured-run",
        "generations": len(rounds),
        "accepted": sum(1 for r in rounds if r["promoted"]),
        "champions": {},
        "backends": {"note": "seeded season: the pages are real and really audited, "
                             "but no model wrote them"},
        "chain": {"ok": True, "message": "demonstration season, not a signed chain", "rows": []},
        "rounds": rounds, "selection_latest": None,
    }


def write(path: Path, pages_dir: Path | None = None) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        path.write_text(json.dumps(build(pages_dir), indent=2))
    finally:
        shutdown()
    return path


_ = IMPACT_WEIGHT
