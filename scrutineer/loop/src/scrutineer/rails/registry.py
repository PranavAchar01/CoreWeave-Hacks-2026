"""W&B Registry — versions, parent links and the `champion` alias.

Only the scrutineer's key may link a version or move the alias. Locally that is a JSON file the
improver's process never opens; with a key it is the real registry.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from . import Backend

STATE = (Path(os.environ.get("SCRUTINEER_STATE_DIR")
              or (Path(__file__).resolve().parents[3] / "state")) / "registry.json")


class RegistryRail:
    def __init__(self) -> None:
        self.backend = (Backend("wandb-registry", real=True, detail="wandb-registry-scrutineer")
                        if os.environ.get("WANDB_API_KEY") and os.environ.get("SCRUTINEER_REGISTRY") != "local"
                        else Backend("local-registry", real=False, detail=str(STATE)))
        STATE.parent.mkdir(parents=True, exist_ok=True)
        if not STATE.exists():
            STATE.write_text(json.dumps({"versions": {}, "aliases": {}}, indent=2))

    def _load(self) -> dict[str, Any]:
        return json.loads(STATE.read_text())

    def _save(self, d: dict[str, Any]) -> None:
        STATE.write_text(json.dumps(d, indent=2))

    def link(self, role: str, metadata: dict[str, Any]) -> str:
        d = self._load()
        versions = d["versions"].setdefault(role.lower(), [])
        v = f"{role.lower()}:v{len(versions)}"
        versions.append({"version": v, **metadata})
        self._save(d)
        if self.backend.real:  # pragma: no cover - network path
            try:
                import wandb

                art = wandb.Artifact(name=role.lower(), type="scrutineer-role", metadata=metadata)
                wandb.run.log_artifact(art, aliases=[v.split(":")[1]]) if wandb.run else None
            except Exception:
                pass
        return v

    def set_champion(self, role: str, version: str) -> None:
        d = self._load()
        d["aliases"][role.lower()] = version
        self._save(d)

    def champion(self, role: str) -> str | None:
        return self._load()["aliases"].get(role.lower())

    def ancestry(self, role: str) -> list[dict[str, Any]]:
        return self._load()["versions"].get(role.lower(), [])


_RAIL: RegistryRail | None = None


def registry() -> RegistryRail:
    global _RAIL
    if _RAIL is None:
        _RAIL = RegistryRail()
    return _RAIL
