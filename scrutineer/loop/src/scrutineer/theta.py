"""θ — the ten artifacts, loaded from disk.

Every role owns exactly one upgradeable artifact and it is a real file, so the improver's output
is a real unified diff, the scope gate is a path check, and `theta_hash` is the hash of the bytes
that actually raced. PARC FERMÉ is a hash compare on this object before and after a race.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

REPO = Path(__file__).resolve().parents[2]
SKILLS = REPO / "skills"

# role -> the files that make up its artifact, relative to the repo root
ARTIFACTS: dict[str, list[str]] = {
    "AERO": ["skills/aero/policy.yaml", "skills/aero/references.md"],
    "STRATEGIST": ["skills/strategist/thresholds.yaml"],
    "POWER_UNIT": ["skills/power_unit/recipe.yaml"],
    "TYRES": ["skills/tyres/tyres.yaml"],
    "DATA": ["skills/data/tools.yaml"],
    "SIMULATOR": ["skills/simulator/circuit.yaml"],
    "ENGINEER": ["skills/race_engineer/SKILL.md"],
    "SCRUTINEER": ["skills/scrutineer/thresholds.yaml"],
    "HISTORIAN": ["skills/historian/SKILL.md"],
    "PIT_CREW": ["skills/pit_crew/install.yaml"],
}

CAR_ROLES = ["AERO", "STRATEGIST", "POWER_UNIT", "TYRES", "DATA"]
PIT_WALL_ROLES = ["SIMULATOR", "ENGINEER", "SCRUTINEER", "HISTORIAN", "PIT_CREW"]
ALL_ROLES = CAR_ROLES + PIT_WALL_ROLES


@dataclass
class Reference:
    id: str
    concepts: frozenset[str]
    body: str


@dataclass
class Theta:
    """A snapshot of every role's artifact. Immutable once loaded; upgrades produce a new root."""

    root: Path
    files: dict[str, str] = field(default_factory=dict)      # path -> text
    aero: dict[str, Any] = field(default_factory=dict)
    strategist: dict[str, Any] = field(default_factory=dict)
    tyres: dict[str, Any] = field(default_factory=dict)
    data: dict[str, Any] = field(default_factory=dict)
    power_unit: dict[str, Any] = field(default_factory=dict)
    simulator: dict[str, Any] = field(default_factory=dict)
    references: list[Reference] = field(default_factory=list)

    @classmethod
    def load(cls, root: Path | str | None = None) -> Theta:
        r = Path(root) if root else REPO
        files: dict[str, str] = {}
        for paths in ARTIFACTS.values():
            for rel in paths:
                p = r / rel
                if p.exists():
                    files[rel] = p.read_text()
        t = cls(root=r, files=files)
        t.aero = yaml.safe_load(files.get("skills/aero/policy.yaml", "") or "{}") or {}
        t.strategist = yaml.safe_load(files.get("skills/strategist/thresholds.yaml", "") or "{}") or {}
        t.tyres = yaml.safe_load(files.get("skills/tyres/tyres.yaml", "") or "{}") or {}
        t.data = yaml.safe_load(files.get("skills/data/tools.yaml", "") or "{}") or {}
        t.power_unit = yaml.safe_load(files.get("skills/power_unit/recipe.yaml", "") or "{}") or {}
        t.simulator = yaml.safe_load(files.get("skills/simulator/circuit.yaml", "") or "{}") or {}
        t.references = parse_references(files.get("skills/aero/references.md", ""))
        return t

    def hash_for(self, role: str) -> str:
        h = hashlib.sha256()
        for rel in ARTIFACTS.get(role, []):
            h.update(rel.encode())
            h.update(self.files.get(rel, "").encode())
        return h.hexdigest()[:16]

    @property
    def full_hash(self) -> str:
        h = hashlib.sha256()
        for rel in sorted(self.files):
            h.update(rel.encode())
            h.update(self.files[rel].encode())
        return h.hexdigest()

    def swap(self, role: str, other: Theta) -> Theta:
        """Return a θ identical to this one except that `role`'s files come from `other`.

        This is the ghost car: the mechanism behind a ghost-swap replay is one dictionary update,
        so the counterfactual is exact rather than approximate."""
        files = dict(self.files)
        for rel in ARTIFACTS.get(role, []):
            if rel in other.files:
                files[rel] = other.files[rel]
        return Theta.from_files(self.root, files)

    @classmethod
    def from_files(cls, root: Path, files: dict[str, str]) -> Theta:
        t = cls(root=root, files=dict(files))
        t.aero = yaml.safe_load(files.get("skills/aero/policy.yaml", "") or "{}") or {}
        t.strategist = yaml.safe_load(files.get("skills/strategist/thresholds.yaml", "") or "{}") or {}
        t.tyres = yaml.safe_load(files.get("skills/tyres/tyres.yaml", "") or "{}") or {}
        t.data = yaml.safe_load(files.get("skills/data/tools.yaml", "") or "{}") or {}
        t.power_unit = yaml.safe_load(files.get("skills/power_unit/recipe.yaml", "") or "{}") or {}
        t.simulator = yaml.safe_load(files.get("skills/simulator/circuit.yaml", "") or "{}") or {}
        t.references = parse_references(files.get("skills/aero/references.md", ""))
        return t

    def write(self, dest: Path) -> None:
        for rel, text in self.files.items():
            p = dest / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(text)


_REF_BLOCK = re.compile(r"^## (\S+)\nconcepts:\s*(.+)$", re.M)


def parse_references(md: str) -> list[Reference]:
    out: list[Reference] = []
    matches = list(_REF_BLOCK.finditer(md))
    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(md)
        out.append(
            Reference(
                id=m.group(1),
                concepts=frozenset(c.strip() for c in m.group(2).split(",") if c.strip()),
                body=md[start:end].strip(),
            )
        )
    return out
