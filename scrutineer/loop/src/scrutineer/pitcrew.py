"""PIT CREW — install the candidate in a fresh sandbox, validate it, run the smoke set.

Nothing reaches QUALI that has not been installed and smoke-tested first: tests gate registration,
not the other way round.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from .circuits import Item
from .engineer import Candidate
from .evaluator import run_race
from .patchtool import PatchError, apply_diff, touched_paths
from .regs import Regs
from .telemetry import Tracer
from .theta import ARTIFACTS, Theta

REQUIRED_KEYS: dict[str, list[str]] = {
    "skills/aero/policy.yaml": ["retrieval", "n_refs", "budget_tokens"],
    "skills/strategist/thresholds.yaml": ["box_when_p_finish_under_cap", "retire_when", "ladder"],
    "skills/tyres/tyres.yaml": ["modes"],
    "skills/data/tools.yaml": ["probe", "schema_version"],
    "skills/power_unit/recipe.yaml": ["base_model", "competence"],
    "skills/simulator/circuit.yaml": ["version", "band"],
}


@dataclass
class InstallResult:
    ok: bool
    reason: str
    theta: Theta | None = None
    smoke_race_s: float = 0.0
    wall_s: float = 0.0
    paths: list[str] = None  # type: ignore[assignment]

    def row(self) -> dict[str, Any]:
        return {"ok": self.ok, "reason": self.reason, "smoke_race_s": round(self.smoke_race_s, 3),
                "wall_s": round(self.wall_s, 2), "paths": self.paths or []}


def validate_schema(files: dict[str, str]) -> str | None:
    for path, keys in REQUIRED_KEYS.items():
        if path not in files:
            continue
        try:
            doc = yaml.safe_load(files[path]) or {}
        except yaml.YAMLError as e:
            return f"{path} is not valid YAML: {e}"
        missing = [k for k in keys if k not in doc]
        if missing:
            return f"{path} lost required key(s) {missing}"
    pol = yaml.safe_load(files.get("skills/aero/policy.yaml", "") or "{}") or {}
    if pol.get("retrieval") not in {"none", "keyword", "family-match", "concept-match"}:
        return f"unknown retrieval mode {pol.get('retrieval')!r}"
    da = yaml.safe_load(files.get("skills/data/tools.yaml", "") or "{}") or {}
    if (da.get("probe") or {}).get("mode") not in {"none", "syntax", "render", "audit"}:
        return f"unknown probe mode {(da.get('probe') or {}).get('mode')!r}"
    return None


def install(
    *,
    theta: Theta,
    candidate: Candidate,
    role: str,
    smoke_items: list[Item],
    regs: Regs,
    generation: int,
    seed: int,
    workdir: Path | None = None,
) -> InstallResult:
    t0 = time.time()
    try:
        paths = touched_paths(candidate.diff)
    except PatchError as e:
        return InstallResult(False, f"unreadable diff: {e}", wall_s=time.time() - t0, paths=[])

    allowed = set(ARTIFACTS.get(role, []))
    outside = [p for p in paths if p not in allowed]
    if outside:
        return InstallResult(False, f"scope gate: diff touches {outside} outside {role}'s artifact",
                             wall_s=time.time() - t0, paths=paths)
    try:
        files = apply_diff(theta.files, candidate.diff)
    except PatchError as e:
        return InstallResult(False, f"patch did not apply: {e}", wall_s=time.time() - t0, paths=paths)

    problem = validate_schema(files)
    if problem:
        return InstallResult(False, f"schema validation failed: {problem}", wall_s=time.time() - t0,
                             paths=paths)

    new = Theta.from_files(theta.root, files)
    if workdir:                       # a fresh sandbox tree, so the champion is never edited in place
        new.write(workdir)

    smoke = run_race(theta=new, items=smoke_items, regs=regs, generation=generation, name="smoke",
                     seed=seed, trials=1, tracer=Tracer(generation=generation))
    return InstallResult(True, "installed", theta=new, smoke_race_s=smoke.race_s,
                         wall_s=time.time() - t0, paths=paths)
