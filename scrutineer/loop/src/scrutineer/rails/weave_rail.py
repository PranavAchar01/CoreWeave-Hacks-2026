"""Weave mirror.

The loop's source of truth is the local append-only store in `telemetry.py`; this rail mirrors
every call, feedback row and published object into Weave when a key is present. Mirroring rather
than depending means credit assignment runs identically with or without the network, and the
REGS panel can say which of the two planes the judge is looking at.
"""

from __future__ import annotations

import os
from typing import Any

from . import Backend


class WeaveRail:
    def __init__(self, project: str | None = None) -> None:
        from .inference import entity_project

        self.project = project or os.environ.get("WANDB_WEAVE_PROJECT") or entity_project()
        self._client: Any = None
        self._weave: Any = None
        self.url = ""
        self.logged = 0
        self.feedback_rows = 0
        self.backend = self._connect()

    def _connect(self) -> Backend:
        # A season logs tens of thousands of calls; printing a URL per call makes the console
        # unreadable and slows the run. The project link is printed once at init.
        os.environ.setdefault("WEAVE_PRINT_CALL_LINK", "false")
        if not os.environ.get("WANDB_API_KEY"):
            return Backend("weave", real=False, detail="no WANDB_API_KEY; local trace store only")
        try:
            import weave

            self._weave = weave
            self._client = weave.init(self.project)
            self.url = f"https://wandb.ai/{self.project}/weave"
            return Backend("weave", real=True, detail=f"project {self.project}")
        except Exception as e:  # pragma: no cover - network path
            return Backend("weave", real=False, detail=f"init failed: {type(e).__name__}")

    @property
    def live(self) -> bool:
        return self.backend.real and self._client is not None

    def log_call(self, record: dict[str, Any]) -> str | None:  # pragma: no cover - network path
        if not self.live:
            return None
        try:
            call = self._client.create_call(
                op=record["op"],
                inputs=record.get("inputs", {}),
                attributes=record.get("attributes", {}),
                display_name=record.get("op"),
            )
            self._client.finish_call(call, output=record.get("output"))
            self.logged += 1
            return str(call.id)
        except Exception:
            return None

    def add_feedback(self, weave_call_id: str, key: str, payload: dict) -> bool:  # pragma: no cover
        if not self.live or not weave_call_id:
            return False
        try:
            self._client.get_call(weave_call_id).feedback.add(key, payload)
            self.feedback_rows += 1
            return True
        except Exception:
            return False

    def meter(self) -> dict[str, Any]:
        return {"backend": str(self.backend), "url": self.url, "calls_logged": self.logged,
                "feedback_rows": self.feedback_rows}

    def publish(self, name: str, obj: Any, tags: list[str] | None = None) -> str | None:  # pragma: no cover
        if not self.live:
            return None
        try:
            ref = self._weave.publish(obj, name=name)
            return str(ref)
        except Exception:
            return None

    def set_alias(self, ref: str, alias: str) -> bool:  # pragma: no cover
        if not self.live:
            return False
        try:
            self._client.set_aliases(ref, alias)
            return True
        except Exception:
            return False


_RAIL: WeaveRail | None = None


def weave_rail() -> WeaveRail:
    global _RAIL
    if _RAIL is None:
        _RAIL = WeaveRail()
    return _RAIL
