"""RACE ENGINEER — the improver.

It sees `selection:gen-n`, the wiki pages for the selected role, `skill-impact.md` and the round's
hypothesis. Nothing else: no sealed items, no evaluator, no raw ledger. It emits two comparable
candidates as plain unified diffs plus a change manifest carrying a forecast it will be scored on
next generation.

Backends: `claude -p` headless when the CLI is on PATH, otherwise a deterministic design office
that walks each role's own upgrade ladder. Both go through the same gates.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from typing import Any

import yaml

from .patchtool import make_diff
from .selection import Selection
from .theta import ARTIFACTS, Theta


@dataclass
class Manifest:
    evidence: list[str] = field(default_factory=list)
    root_cause: str = ""
    predicted_fixes: list[str] = field(default_factory=list)
    at_risk_regressions: list[str] = field(default_factory=list)
    predicted_delta_s: float = 0.0

    def obj(self) -> dict[str, Any]:
        return {
            "evidence": self.evidence, "root_cause": self.root_cause,
            "predicted_fixes": self.predicted_fixes,
            "at_risk_regressions": self.at_risk_regressions,
            "predicted_delta_s": round(self.predicted_delta_s, 3),
        }


@dataclass
class Candidate:
    label: str                 # "A" or "B"
    diff: str
    summary: str
    backend: str = "design-office"

    @property
    def lines_changed(self) -> int:
        return sum(1 for ln in self.diff.splitlines() if ln[:1] in "+-" and not ln.startswith(("+++", "---")))


@dataclass
class Proposal:
    role: str
    candidates: list[Candidate]
    manifest: Manifest
    backend: str
    prompt_chars: int = 0


# ------------------------------------------------------------------------------------------------
# The design office: each role's own ladder, in rarity order. These are the moves a competent
# engineer would reach for, and several of them are wrong for the current car — that is the point.
# ------------------------------------------------------------------------------------------------

def _y(theta: Theta, path: str) -> dict:
    return yaml.safe_load(theta.files.get(path, "") or "{}") or {}


def _dump(doc: dict) -> str:
    return yaml.safe_dump(doc, sort_keys=False)


def _aero_moves(theta: Theta, sel: Selection) -> list[tuple[str, dict[str, str]]]:
    pol = _y(theta, "skills/aero/policy.yaml")
    refs = theta.files.get("skills/aero/references.md", "")
    moves: list[tuple[str, dict[str, str]]] = []
    ladder = ["keyword", "family-match", "concept-match"]
    cur = pol.get("retrieval", "keyword")
    if cur in ladder and ladder.index(cur) < len(ladder) - 1:
        nxt = ladder[ladder.index(cur) + 1]
        d = {**pol, "retrieval": nxt}
        moves.append((f"retrieve by {nxt} instead of {cur}", {"skills/aero/policy.yaml": _dump(d)}))
    missing = sel.alternatives and sel.notes
    block = (
        "\n## ref-structures\nconcepts: stack, binary-search, intervals, matrix, recursion\n"
        "A stack matches brackets; `bisect` finds an insertion point in a sorted list; sort\n"
        "intervals before merging; `zip(*m)` transposes; recursion needs an explicit base case.\n"
        "\n## ref-numeric\nconcepts: modular-arith, bit-ops, statistics, date-math, memoisation\n"
        "`divmod` builds a base representation; `math.gcd`/`math.lcm` fold with `reduce`;\n"
        "`statistics` has median and pstdev; `date.fromisoformat` parses ISO dates.\n"
        "\n## ref-iteration\nconcepts: two-pointer, sliding-window, slicing, grouping, sets, hashing, mapping, simulation, reduce\n"
        "Keep a window with a start index and a `seen` map; slice with a step to chunk;\n"
        "`dict.fromkeys` preserves order; a dict literal maps symbols to values.\n"
    )
    moves.append(("add three reference blocks covering the uncovered concepts",
                  {"skills/aero/references.md": refs + block}))
    if pol.get("n_refs", 2) < 6:
        moves.append((f"raise the reference budget to {min(6, pol.get('n_refs', 2) + 2)}",
                      {"skills/aero/policy.yaml": _dump({**pol, "n_refs": min(6, pol.get("n_refs", 2) + 2),
                                                         "budget_tokens": pol.get("budget_tokens", 900) + 600})}))
    if pol.get("layout") != "spec-first":
        moves.append(("put the task ahead of the references so the spec is read first",
                      {"skills/aero/policy.yaml": _dump({**pol, "layout": "spec-first"})}))
    moves.append(("second reference sweep for the concepts still uncovered",
                  {"skills/aero/references.md": refs + (
                      f"\n## ref-sweep-{sel.generation}\nconcepts: "
                      + ", ".join(sorted({"statistics", "reduce", "memoisation", "simulation", "mapping"}))
                      + "\nFold with `functools.reduce`; cache with a dict; a mapping table beats a chain\n"
                      "of conditionals; simulate the process the spec describes, step by step.\n")}))
    _ = missing
    return moves


def _strategist_moves(theta: Theta, sel: Selection) -> list[tuple[str, dict[str, str]]]:
    th = _y(theta, "skills/strategist/thresholds.yaml")
    p = "skills/strategist/thresholds.yaml"
    return [
        ("cool the engine-mode ladder so headroom no longer means party mode",
         {p: _dump({**th, "ladder": [0.99, 0.92, 0.55, 0.35, 0.18]})}),
        ("require more evidence before boxing, and retire later",
         {p: _dump({**th, "min_steps_before_box": min(4, int(th.get("min_steps_before_box", 1)) + 2),
                    "retire_when": round(max(0.02, float(th.get("retire_when", 0.10)) - 0.05), 3)})}),
        ("box earlier to protect the cost cap",
         {p: _dump({**th, "box_when_p_finish_under_cap": round(min(0.6, float(
             th.get("box_when_p_finish_under_cap", 0.35)) + 0.10), 3)})}),
        ("flatten the ladder so every stint runs in the same mode",
         {p: _dump({**th, "ladder": [0.60, 0.55, 0.50, 0.45, 0.40]})}),
        ("hold the car out one more step before boxing",
         {p: _dump({**th, "min_steps_before_box": min(6, int(th.get("min_steps_before_box", 1)) + 1)})}),
    ]


def _tyres_moves(theta: Theta, sel: Selection) -> list[tuple[str, dict[str, str]]]:
    ty = _y(theta, "skills/tyres/tyres.yaml")
    p = "skills/tyres/tyres.yaml"
    cooler = {k: {**v, "temperature": round(max(0.05, v["temperature"] - 0.12), 3)}
              for k, v in ty.get("modes", {}).items()}
    more = {k: {**v, "samples": min(5, v["samples"] + 1)} for k, v in ty.get("modes", {}).items()}
    both = {k: {**v, "temperature": round(max(0.05, v["temperature"] - 0.08), 3),
                "samples": min(5, v["samples"] + 1), "compound": "MEDIUM"}
            for k, v in ty.get("modes", {}).items()}
    return [
        ("drop compound temperature across every mode", {p: _dump({**ty, "modes": cooler})}),
        ("run an extra stint in every mode", {p: _dump({**ty, "modes": more})}),
        ("cooler compound and an extra stint", {p: _dump({**ty, "modes": both})}),
        ("give the top modes a longer run to the flag",
         {p: _dump({**ty, "modes": {k: {**v, "max_tokens": int(v["max_tokens"]) + 400}
                                    for k, v in ty.get("modes", {}).items()}})}),
    ]


def _data_moves(theta: Theta, sel: Selection) -> list[tuple[str, dict[str, str]]]:
    da = _y(theta, "skills/data/tools.yaml")
    p = "skills/data/tools.yaml"
    ladder = ["none", "syntax", "render", "audit"]
    cur = (da.get("probe") or {}).get("mode", "syntax")
    out: list[tuple[str, dict[str, str]]] = []
    if cur in ladder and ladder.index(cur) < len(ladder) - 1:
        nxt = ladder[ladder.index(cur) + 1]
        out.append((f"raise the sensor rake from {cur} to {nxt}",
                    {p: _dump({**da, "probe": {**da.get("probe", {}), "mode": nxt}})}))
    out.append(("open the page in a browser and audit it before submitting",
                {p: _dump({**da, "probe": {**da.get("probe", {}), "mode": "audit", "reaudit": True},
                           "schema_version": int(da.get("schema_version", 1)) + 1})}))
    out.append(("reject a malformed tool reply instead of accepting it",
                {p: _dump({**da, "strict_parse": True})}))
    out.append(("re-check the page after a fix instead of trusting the fix",
                {p: _dump({**da, "probe": {**da.get("probe", {}), "reaudit": True}})}))
    return out


def _power_moves(theta: Theta, sel: Selection) -> list[tuple[str, dict[str, str]]]:
    pu = _y(theta, "skills/power_unit/recipe.yaml")
    p = "skills/power_unit/recipe.yaml"
    c = float(pu.get("competence", 0.62))
    return [
        (f"engine specification from an RL job on car {theta.full_hash[:6]}",
         {p: _dump({**pu, "competence": round(min(0.95, c + 0.06), 3),
                    "checkpoint": f"wandb-artifact:///scrutineer/power-unit:step{sel.generation * 15}"})}),
        (f"conservative rebuild on car {theta.full_hash[:6]}: smaller gain, lower risk",
         {p: _dump({**pu, "competence": round(min(0.95, c + 0.03), 3)})}),
    ]


def _simulator_moves(theta: Theta, sel: Selection) -> list[tuple[str, dict[str, str]]]:
    ci = _y(theta, "skills/simulator/circuit.yaml")
    p = "skills/simulator/circuit.yaml"
    return [
        (f"lay out practice circuit v{int(ci.get('version', 0)) + 1} from the failure clusters",
         {p: _dump({**ci, "version": int(ci.get("version", 0)) + 1, "source": "mined-failures"})}),
        (f"widen the frontier band for circuit v{int(ci.get('version', 0)) + 1}",
         {p: _dump({**ci, "version": int(ci.get("version", 0)) + 1, "band": [0.25, 0.85],
                    "source": "band-widened"})}),
    ]


def _service_moves(theta: Theta, sel: Selection) -> list[tuple[str, dict[str, str]]]:
    rel = ARTIFACTS[sel.role][0]
    body = theta.files.get(rel, "")
    note = f"\n<!-- gen {sel.generation}: {sel.rule_fired} -->\n"
    if rel.endswith(".yaml"):
        doc = _y(theta, rel)
        doc["revision"] = int(doc.get("revision", 0)) + 1
        return [("tighten this service role's own thresholds", {rel: _dump(doc)})]
    return [("rewrite this role's instructions after its own record",
             {rel: body + note + "Cite the pattern page id in every proposal.\n"})]


MOVES = {
    "AERO": _aero_moves, "STRATEGIST": _strategist_moves, "TYRES": _tyres_moves,
    "DATA": _data_moves, "POWER_UNIT": _power_moves, "SIMULATOR": _simulator_moves,
}


def design_office(theta: Theta, sel: Selection, tried: set[str]) -> list[tuple[str, dict[str, str]]]:
    """Only moves this role has not already had rejected. An empty list means the ladder is
    exhausted; repeating a move the gates have already refused is not a proposal, it is a loop."""
    fn = MOVES.get(sel.role or "", _service_moves)
    return [m for m in fn(theta, sel) if m[0] not in tried]


def propose(
    *,
    theta: Theta,
    sel: Selection,
    pages: list[str],
    hypothesis: str,
    skill_impact: str,
    tried: set[str] | None = None,
    quali_failures: list[str] | None = None,
) -> Proposal:
    """Two comparable candidates plus one manifest, from whichever backend is available."""
    assert sel.role, "propose() called with no selected role"
    prompt = _prompt(sel, pages, hypothesis, skill_impact, theta)
    if os.environ.get("SCRUTINEER_ENGINEER") != "local":
        if os.environ.get("ANTHROPIC_API_KEY"):
            got = _claude_sdk(prompt, theta, sel)  # pragma: no cover - needs a key
            if got:
                return got
        if shutil.which("claude"):
            got = _claude_headless(prompt, theta, sel)  # pragma: no cover - needs the CLI
            if got:
                return got
    moves = design_office(theta, sel, tried or set())
    if not moves:
        return Proposal(role=sel.role, candidates=[], manifest=Manifest(), backend="design-office",
                        prompt_chars=len(prompt))
    cands: list[Candidate] = []
    for label, (summary, newfiles) in zip("AB", moves[:2], strict=False):
        diff = "".join(make_diff(p, theta.files.get(p, ""), text) for p, text in newfiles.items())
        cands.append(Candidate(label=label, diff=diff, summary=summary))
    if len(cands) == 1:
        cands.append(Candidate(label="B", diff=cands[0].diff,
                               summary=cands[0].summary + " (only move left on the ladder)"))
    fails = quali_failures or []
    manifest = Manifest(
        evidence=[a["role"] for a in sel.alternatives[:3]],
        root_cause=f"{sel.role} is the largest confirmed source of lost time this generation "
                   f"({sel.blame_s:.1f}s over {sel.n} incidents, 90% CI lower bound {sel.ci[0]:.1f}s)",
        predicted_fixes=fails[: max(1, len(fails) // 3)],
        at_risk_regressions=fails[-2:] if len(fails) > 4 else [],
        predicted_delta_s=round(max(0.2, sel.blame_s * sel.p_fix / max(1, sel.n) * 0.8), 3),
    )
    return Proposal(role=sel.role, candidates=cands, manifest=manifest, backend="design-office",
                    prompt_chars=len(prompt))


def _prompt(sel: Selection, pages: list[str], hypothesis: str, skill_impact: str, theta: Theta) -> str:
    allowed = "\n".join(f"  {p}" for p in ARTIFACTS[sel.role or "AERO"])
    current = "\n\n".join(f"--- {p} ---\n{theta.files.get(p, '')}" for p in ARTIFACTS[sel.role or "AERO"])
    return (
        f"# selection:gen-{sel.generation}\n{json.dumps(sel.obj(), indent=2)}\n\n"
        f"# hypothesis for this round\n{hypothesis}\n\n"
        f"# pattern pages for {sel.role}\n" + "\n\n".join(pages) + "\n\n"
        f"# skill-impact.md\n{skill_impact}\n\n"
        f"# you may touch only these paths\n{allowed}\n\n"
        f"# current contents\n{current}\n"
    )


ENGINEER_MODEL = os.environ.get("SCRUTINEER_ENGINEER_MODEL", "claude-sonnet-5")


def _blocks(text: str) -> tuple[list[str], list[str]]:
    """Pull ```diff and ```json fences out of a model answer."""
    diffs = re.findall(r"```diff\n(.*?)```", text, re.S)
    jsons = re.findall(r"```json\n(.*?)```", text, re.S)
    return diffs, jsons


def _claude_sdk(prompt: str, theta: Theta, sel: Selection) -> Proposal | None:  # pragma: no cover
    """The improver, run directly against the Messages API.

    It is handed its own SKILL.md, the selection object, the wiki pages for the selected role and
    the round's hypothesis — and nothing else. It never sees the sealed circuit, the evaluator or
    the ledger, because the prompt is the only channel it has.
    """
    try:
        import anthropic
    except ImportError:
        return None
    skill = (theta.root / "skills/race_engineer/SKILL.md").read_text()
    allowed = ARTIFACTS[sel.role or "AERO"]
    instruction = (
        "Emit exactly three fenced blocks and nothing else:\n"
        "1. ```diff ... ``` — candidate A, a plain unified diff\n"
        "2. ```diff ... ``` — candidate B, a different change to the same artifact\n"
        "3. ```json ... ``` — the change manifest\n\n"
        "Diff rules, which are enforced and will reject your work if broken:\n"
        f"- touch only these paths: {', '.join(allowed)}\n"
        "- headers must read `--- a/<path>` then `+++ b/<path>`\n"
        "- hunk headers must be real: `@@ -<start>,<len> +<start>,<len> @@`\n"
        "- every context line must match the current file exactly, including indentation\n"
        "- at least 3 changed lines; A and B must differ from each other\n"
        "Manifest keys: evidence, root_cause, predicted_fixes, at_risk_regressions, "
        "predicted_delta_s (seconds gained, positive = faster)."
    )
    try:
        client = anthropic.Anthropic(max_retries=3, timeout=180.0)
        r = client.messages.create(
            model=ENGINEER_MODEL, max_tokens=4000, temperature=0.3, system=skill,
            messages=[{"role": "user", "content": f"{prompt}\n\n{instruction}"}],
        )
    except Exception:
        return None
    text = "".join(b.text for b in r.content if getattr(b, "type", "") == "text")
    diffs, jsons = _blocks(text)
    if len(diffs) < 2 or not jsons:
        return None
    try:
        raw = json.loads(jsons[0])
        m = Manifest(**{k: v for k, v in raw.items() if k in Manifest.__dataclass_fields__})
    except Exception:
        return None
    return Proposal(
        role=sel.role or "",
        candidates=[Candidate("A", diffs[0], "race engineer proposal A", "claude-sdk"),
                    Candidate("B", diffs[1], "race engineer proposal B", "claude-sdk")],
        manifest=m, backend="claude-sdk", prompt_chars=len(prompt),
    )


def _claude_headless(prompt: str, theta: Theta, sel: Selection) -> Proposal | None:  # pragma: no cover
    skill = (theta.root / "skills/race_engineer/SKILL.md").read_text()
    try:
        p = subprocess.run(
            ["claude", "-p", "--output-format", "text"],
            input=f"{skill}\n\n{prompt}\n\nReturn: ```diff A```, ```diff B```, then ```json manifest```.",
            capture_output=True, text=True, timeout=240,
            env={**os.environ, "WANDB_MCP_READ_ONLY": "true"},
        )
    except (subprocess.TimeoutExpired, OSError):
        return None
    if p.returncode != 0:
        return None
    blocks = [b for b in p.stdout.split("```") if b.strip()]
    diffs = [b.split("\n", 1)[1] for b in blocks if b.startswith("diff")]
    jsons = [b.split("\n", 1)[1] for b in blocks if b.startswith("json")]
    if len(diffs) < 2 or not jsons:
        return None
    try:
        m = Manifest(**json.loads(jsons[0]))
    except Exception:
        return None
    return Proposal(
        role=sel.role or "",
        candidates=[Candidate("A", diffs[0], "claude-code proposal A", "claude-code"),
                    Candidate("B", diffs[1], "claude-code proposal B", "claude-code")],
        manifest=m, backend="claude-code", prompt_chars=len(prompt),
    )
