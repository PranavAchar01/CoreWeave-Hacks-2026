"""HISTORIAN — the only writer of wiki/ and debriefs/.

Two artifacts per round. The wiki is the loop's memory: pattern pages carrying placeholders and
call refs, never transcripts, because pasting a failed trajectory back into the loop is contextual
drag and the driver must never see one. The wiki is never rolled back, even when the change that
produced the lesson is.

The debrief is the promotion gate. `debriefs/round_NNN.py` is a marimo notebook that recomputes
the standings and the selection from the public ledger plus `official:gen-n`, raises unless they
match what was published, and defines `gate_ok` and `next_round_config`. Promotion reads
`defs["gate_ok"]` from `app.run()`. No debrief, no promotion.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[2]
_OUT = Path(os.environ.get("SCRUTINEER_STATE_DIR", "")).parent if os.environ.get("SCRUTINEER_STATE_DIR") else REPO
WIKI = _OUT / "wiki"
DEBRIEFS = _OUT / "debriefs"


@dataclass
class Pattern:
    id: str
    role: str
    mast_mode: str
    title: str
    evidence: list[str] = field(default_factory=list)
    lesson: str = ""
    generation: int = 0

    def markdown(self) -> str:
        ev = "\n".join(f"  - {e}" for e in self.evidence[:8])
        return (
            f"# {self.id} — {self.title}\n\n"
            f"role: {self.role}\nmast_mode: {self.mast_mode}\ngeneration: {self.generation}\n"
            f"evidence:\n{ev}\n\n"
            f"## Lesson\n\n{self.lesson}\n\n"
            "## Shape\n\n"
            f"When `{{item}}` needs `{{concept}}` and {self.role} produced `{{observed}}`, the lap "
            f"lost `{{delta_s}}`s. Correcting {self.role} alone flipped it.\n"
        )


def write_patterns(patterns: list[Pattern]) -> list[str]:
    (WIKI / "patterns").mkdir(parents=True, exist_ok=True)
    ids = []
    for p in patterns:
        (WIKI / "patterns" / f"{p.id}.md").write_text(p.markdown())
        ids.append(p.id)
    return ids


def write_index() -> str:
    (WIKI / "patterns").mkdir(parents=True, exist_ok=True)
    rows = []
    for f in sorted((WIKI / "patterns").glob("*.md")):
        head = f.read_text().splitlines()
        title = head[0].lstrip("# ").strip() if head else f.stem
        role = next((ln.split(":", 1)[1].strip() for ln in head if ln.startswith("role:")), "?")
        rows.append(f"- [{f.stem}](patterns/{f.name}) — {role} — {title}")
    body = "# Wiki index\n\nThe wiki is never rolled back.\n\n" + "\n".join(rows) + "\n"
    (WIKI / "index.md").write_text(body)
    return body


def pages_for(role: str) -> list[str]:
    out = []
    for f in sorted((WIKI / "patterns").glob("*.md")):
        text = f.read_text()
        if re.search(rf"^role:\s*{re.escape(role)}\s*$", text, re.M):
            out.append(text)
    return out


def append_skill_impact(row: dict[str, Any]) -> None:
    p = WIKI / "skill-impact.md"
    header = ("# skill-impact\n\n"
              "| round | role | prefix | proposal | patterns | CLAIMED | OFFICIAL | verdict | "
              "fix_prec | reg_prec |\n"
              "|---|---|---|---|---|---|---|---|---|---|\n")
    if not p.exists():
        p.write_text(header)
    p.write_text(p.read_text() + (
        f"| {row.get('round')} | {row.get('role')} | {row.get('prefix')} | {row.get('proposal_hash', '')[:10]} "
        f"| {','.join(row.get('patterns', []))} | {row.get('claimed', 0):+.3f} | {row.get('official', 0):+.3f} "
        f"| {row.get('verdict')} | {row.get('fix_precision', '')} | {row.get('regression_precision', '')} |\n"))


def skill_impact_text() -> str:
    p = WIKI / "skill-impact.md"
    return p.read_text() if p.exists() else ""


def write_hypothesis(round_n: int, markdown: str) -> Path:
    d = WIKI / "hypotheses"
    d.mkdir(parents=True, exist_ok=True)
    p = d / f"round_{round_n}.md"
    p.write_text(markdown)
    return p


def read_hypothesis(round_n: int) -> str:
    p = WIKI / "hypotheses" / f"round_{round_n}.md"
    return p.read_text() if p.exists() else "provenance: none (no hypothesis written)\n"


# ------------------------------------------------------------------------------------------------
# The debrief notebook
# ------------------------------------------------------------------------------------------------

TEMPLATE = '''import marimo

__generated_with = "0.24.0"
app = marimo.App(width="medium")


@app.cell
def _():
    round_id = {round_id}
    return (round_id,)


@app.cell
def _():
    upgrade_pick = {upgrade_pick!r}
    return (upgrade_pick,)


@app.cell
def _():
    import json
    from pathlib import Path

    _state = Path(r"{state}")

    def read_obj(name):
        p = _state / "objects" / (name + ".json")
        return json.loads(p.read_text()) if p.exists() else None

    return json, read_obj


@app.cell
def _(read_obj, round_id):
    published_standings = read_obj("standings:gen-" + str(round_id))
    published_selection = read_obj("selection:gen-" + str(round_id))
    official = read_obj("official:gen-" + str(round_id))
    ledger = read_obj("ledger:gen-" + str(round_id))
    return published_standings, published_selection, official, ledger


@app.cell
def _(ledger):
    # CREDIT — recomputed here from the ledger rows, not copied from the published object
    recomputed = {{}}
    for row in (ledger or {{}}).get("rows", []):
        if float(row["delta_s"]) > {incident_threshold}:
            recomputed.setdefault(row["role"], []).append(float(row["delta_s"]))
    credit = {{r: {{"n": len(v), "blame_s": round(sum(v), 3)}} for r, v in recomputed.items()}}
    credit
    return (credit,)


@app.cell
def _(credit, published_standings):
    # HOMOLOGATION — the notebook is the gate, so a disagreement raises rather than warns
    _pub = {{r: {{"n": s["n"], "blame_s": s["blame_s"]}}
            for r, s in (published_standings or {{}}).get("roles", {{}}).items() if s["n"] > 0}}
    if _pub != credit:
        raise AssertionError(
            "debrief could not reproduce standings:gen-%s from the ledger: published=%s recomputed=%s"
            % (published_standings and published_standings.get("generation"), _pub, credit)
        )
    standings_reproduced = True
    return (standings_reproduced,)


@app.cell
def _(published_selection, credit, upgrade_pick):
    # GHOST UPGRADE — flipping the pick recomputes what the next round would order
    ordered = sorted(credit.items(), key=lambda kv: -kv[1]["blame_s"])
    ledger_pick = (published_selection or {{}}).get("r_star")
    effective_pick = upgrade_pick or ledger_pick
    counterfactual = {{"ledger_pick": ledger_pick, "effective_pick": effective_pick,
                      "ranking": [r for r, _ in ordered]}}
    counterfactual
    return (effective_pick, counterfactual)


@app.cell
def _(official, published_selection, standings_reproduced):
    stewards_verdict = {verdict!r}
    seesaw_ok = {seesaw_ok!r}
    correlation_ok = {correlation_ok!r}
    regression_ok = {regression_ok!r}
    cost_ok = {cost_ok!r}
    gate_ok = bool(
        standings_reproduced
        and official is not None
        and published_selection is not None
        and stewards_verdict == "LEGAL"
        and seesaw_ok and correlation_ok and regression_ok and cost_ok
    )
    if not gate_ok:
        # explicit raise, never a bare assert: `python -O` strips asserts and would open the gate
        raise RuntimeError(
            "HOMOLOGATION FAILED verdict=%s seesaw=%s correlation=%s regression=%s cost=%s"
            % (stewards_verdict, seesaw_ok, correlation_ok, regression_ok, cost_ok)
        )
    return (gate_ok, stewards_verdict)


@app.cell
def _(gate_ok, effective_pick, counterfactual, official, round_id, stewards_verdict):
    next_round_config = {{
        "round": round_id + 1,
        "gate_ok": gate_ok,
        "override_pick": effective_pick,
        "stewards_verdict": stewards_verdict,
        "official_race_s": (official or {{}}).get("race_s"),
        "ranking": counterfactual["ranking"],
        "champions": {champions!r},
        "practice_circuit": {circuit!r},
        "cost_cap_usd": {cost_cap},
    }}
    next_round_config
    return (next_round_config,)


if __name__ == "__main__":
    app.run()
'''


@dataclass
class DebriefResult:
    path: Path
    check_ok: bool
    check_output: str
    script_ok: bool
    script_output: str
    gate_ok: bool
    defs: dict[str, Any] = field(default_factory=dict)
    marimo_available: bool = True

    def row(self) -> dict[str, Any]:
        return {"path": str(self.path.name), "marimo_check": self.check_ok,
                "script_run": self.script_ok, "gate_ok": self.gate_ok}


def write_debrief(
    *,
    round_id: int,
    state_dir: Path,
    verdict: str,
    seesaw_ok: bool,
    correlation_ok: bool,
    regression_ok: bool,
    cost_ok: bool,
    champions: dict[str, str],
    circuit: str,
    cost_cap: float,
    incident_threshold: float,
    upgrade_pick: str | None = None,
) -> Path:
    DEBRIEFS.mkdir(parents=True, exist_ok=True)
    body = TEMPLATE.format(
        round_id=round_id, upgrade_pick=upgrade_pick, state=str(state_dir), verdict=verdict,
        seesaw_ok=seesaw_ok, correlation_ok=correlation_ok, regression_ok=regression_ok,
        cost_ok=cost_ok, champions=champions, circuit=circuit, cost_cap=cost_cap,
        incident_threshold=incident_threshold,
    )
    p = DEBRIEFS / f"round_{round_id:03d}.py"
    p.write_text(body)
    return p


def run_debrief(path: Path, round_id: int) -> DebriefResult:
    """`marimo check --strict` in the default output format, then a script-mode run, then
    `app.run()` for the defs. `--strict --format=json` together crashes in marimo 0.24.0, so the
    two forms are never combined."""
    marimo_bin = shutil.which("marimo") or str(Path(sys.executable).parent / "marimo")
    check_ok, check_out = True, "marimo not installed; document gate ran the script only"
    if Path(marimo_bin).exists():
        r = subprocess.run([marimo_bin, "check", "--strict", str(path)], capture_output=True,
                           text=True, timeout=120)
        check_ok, check_out = r.returncode == 0, (r.stdout + r.stderr).strip()[:1200]

    r2 = subprocess.run([sys.executable, str(path)], capture_output=True, text=True, timeout=180)
    script_ok, script_out = r2.returncode == 0, (r2.stdout + r2.stderr).strip()[-1500:]

    gate_ok = False
    defs: dict[str, Any] = {}
    if script_ok:
        try:
            import importlib.util

            spec = importlib.util.spec_from_file_location(f"debrief_{round_id}", path)
            mod = importlib.util.module_from_spec(spec)          # type: ignore[arg-type]
            spec.loader.exec_module(mod)                          # type: ignore[union-attr]
            _outputs, d = mod.app.run(defs={"round_id": round_id})
            defs = dict(d)
            gate_ok = bool(defs.get("gate_ok"))
        except Exception as e:                                    # a failing gate raises into us
            script_out += f"\napp.run raised: {type(e).__name__}: {e}"
    return DebriefResult(path=path, check_ok=check_ok, check_output=check_out, script_ok=script_ok,
                         script_output=script_out, gate_ok=gate_ok, defs=defs,
                         marimo_available=Path(marimo_bin).exists())


def ghost_upgrade(path: Path, round_id: int, pick: str) -> dict[str, Any]:
    """The counterfactual the broadcast calls GHOST UPGRADE: override one cell and recompute."""
    import importlib.util

    spec = importlib.util.spec_from_file_location(f"debrief_ghost_{round_id}", path)
    mod = importlib.util.module_from_spec(spec)                   # type: ignore[arg-type]
    spec.loader.exec_module(mod)                                  # type: ignore[union-attr]
    _o, d = mod.app.run(defs={"round_id": round_id, "upgrade_pick": pick})
    return dict(d).get("next_round_config", {})
