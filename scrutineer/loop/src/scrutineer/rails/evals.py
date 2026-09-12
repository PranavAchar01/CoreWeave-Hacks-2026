"""The scoreboard, logged where a reviewer expects to find it.

The loop already decides pass or fail by executing hidden tests. Logging those results through
Weave's evaluation logger puts them on the Evals tab as a real evaluation — one row per task, per
run, with the per-item pass vector — instead of leaving them in a JSON file only this program
reads. The score is not computed here; it is the same number the gates used.
"""

from __future__ import annotations

from typing import Any

from . import Backend
from .weave_rail import weave_rail


class EvalsRail:
    def __init__(self) -> None:
        w = weave_rail()
        self.backend = (Backend("weave-evals", real=True, detail="logged to the Evals tab")
                        if w.live else Backend("weave-evals", real=False, detail="Weave not live"))
        self.logged = 0
        self.last_url = ""

    def log_race(self, *, name: str, generation: int, theta_hash: str, rows: list[dict[str, Any]],
                 summary: dict[str, Any]) -> str | None:
        """rows: [{item, passed, lap_s, cost_usd, steps, missing}]"""
        if not self.backend.real:  # pragma: no cover - needs a key
            return None
        try:
            import weave

            ev = weave.EvaluationLogger(
                name=f"{name}-gen-{generation}",
                model={"name": f"car:gen-{generation}", "theta_hash": theta_hash},
                dataset=f"{name}-circuit",
                eval_attributes={"generation": generation, "circuit": name},
            )
            for r in rows:
                pred = ev.log_prediction(inputs={"task": r["item"]},
                                         output={"passed": bool(r["passed"])})
                # execution is the only scorer that decides anything; the rest are for reading
                pred.log_score("tests_pass", bool(r["passed"]))
                pred.log_score("lap_s", float(r.get("lap_s", 0.0)))
                pred.log_score("cost_usd", float(r.get("cost_usd", 0.0)))
                pred.finish()
            ev.log_summary(summary)
            self.logged += 1
            with __import__("contextlib").suppress(Exception):
                self.last_url = ev.ui_url or ""
            return self.last_url
        except Exception:
            return None

    def meter(self) -> dict[str, Any]:
        return {"backend": str(self.backend), "evaluations": self.logged, "url": self.last_url}


_RAIL: EvalsRail | None = None


def evals() -> EvalsRail:
    global _RAIL
    if _RAIL is None:
        _RAIL = EvalsRail()
    return _RAIL
