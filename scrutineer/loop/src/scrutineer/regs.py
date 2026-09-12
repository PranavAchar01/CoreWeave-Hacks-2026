"""REGS.md — the frozen contract, parsed once into a typed object.

The file is owned by the human Team Principal. Nothing in the loop may write it; `Regs.load`
records the file's hash so every chain row can prove which contract it ran under.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

REPO = Path(__file__).resolve().parents[2]
DEFAULT_REGS = REPO / "REGS.md"

_YAML_BLOCK = re.compile(r"```yaml\n(.*?)\n```", re.S)


@dataclass(frozen=True)
class RoleCost:
    prefix: str
    cost_usd: float
    hours: float


@dataclass(frozen=True)
class Regs:
    raw: dict[str, Any]
    path: Path
    sha256: str
    roles: dict[str, RoleCost] = field(default_factory=dict)

    @classmethod
    def load(cls, path: Path | str | None = None) -> Regs:
        p = Path(path) if path else DEFAULT_REGS
        text = p.read_text()
        m = _YAML_BLOCK.search(text)
        if not m:
            raise ValueError(f"{p} contains no ```yaml contract block")
        raw = yaml.safe_load(m.group(1))
        roles = {k: RoleCost(**v) for k, v in raw["roles"].items()}
        return cls(raw=raw, path=p, sha256=hashlib.sha256(text.encode()).hexdigest(), roles=roles)

    # -- typed accessors used all over the loop; keeping them here means one place to change --
    @property
    def max_generations(self) -> int:
        return int(self.raw["season"]["max_generations"])

    @property
    def unattended(self) -> bool:
        return self.raw["season"]["mode"] == "unattended"

    @property
    def seed(self) -> int:
        return int(self.raw["season"]["seed"])

    @property
    def max_steps(self) -> int:
        return int(self.raw["lap"]["max_steps"])

    @property
    def wall_cap_s(self) -> float:
        return float(self.raw["lap"]["wall_cap_s"])

    @property
    def race_cap_usd(self) -> float:
        return float(self.raw["cost"]["race_and_replay_cap_usd"])

    @property
    def lam(self) -> float:
        return float(self.raw["cost"]["lambda_usd_per_hour"])

    def g(self, *keys: str) -> Any:
        node: Any = self.raw
        for k in keys:
            node = node[k]
        return node

    def with_mode(self, mode: str) -> Regs:
        """Return a copy running in `attended` or `unattended`. The hash is unchanged: the mode is
        a runtime switch the controller stamps on every chain row, not an edit to the contract."""
        raw = {**self.raw, "season": {**self.raw["season"], "mode": mode}}
        return Regs(raw=raw, path=self.path, sha256=self.sha256, roles=self.roles)


_CACHE: Regs | None = None


def regs() -> Regs:
    global _CACHE
    if _CACHE is None:
        _CACHE = Regs.load()
    return _CACHE
