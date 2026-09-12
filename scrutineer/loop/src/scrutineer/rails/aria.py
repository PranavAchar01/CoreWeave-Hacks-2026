"""ARIA — the second opinion, and the provenance line on next round's hypothesis.

ARIA reads the same per-role runs the ledger wrote and answers one question: which role's
upgrades moved OFFICIAL, and what should be tried next. Its answer is compared with the ledger's
own pick and logged as `aria_agrees`. When ARIA is not reachable — no key, or an unattended
generation with nobody to ask — the hypothesis file still exists and says so on one labelled line,
so the Race Engineer's prompt still validates and the record shows what was and was not asked.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

from . import Backend


@dataclass
class Hypothesis:
    text: str
    provenance: str
    agrees_with: str | None = None
    backend: str = "none"

    def markdown(self, round_n: int) -> str:
        return (f"# Hypothesis for round {round_n}\n\n"
                f"provenance: {self.provenance}\n\n{self.text}\n")


class AriaRail:
    def __init__(self) -> None:
        self.backend = (Backend("aria", real=True, detail="W&B ARIA on the team project")
                        if os.environ.get("WANDB_API_KEY") and os.environ.get("SCRUTINEER_ARIA") != "off"
                        else Backend("aria", real=False, detail="not reachable"))
        self.asked = 0
        self.agreed = 0
        # The workspace ARIA reads: one run per component per round, written by models.py.
        self.workspace = os.environ.get("SCRUTINEER_ARIA_WORKSPACE", "")

    def meter(self) -> dict[str, Any]:
        return {"backend": str(self.backend), "hypotheses": self.asked, "agreed_with_ledger": self.agreed,
                "workspace": self.workspace}

    def ask(self, *, round_n: int, per_role_runs: list[dict[str, Any]], ledger_pick: str | None,
            unattended: bool, report_url: str | None = None) -> Hypothesis:
        self.asked += 1
        if not self.backend.real or unattended:
            why = "none (unattended)" if unattended else "none (ARIA not reachable)"
            best = max(per_role_runs, key=lambda r: r.get("official_delta", 0.0), default=None)
            text = (
                f"The ledger picked {ledger_pick or 'no role'} for round {round_n}. "
                + (f"The largest measured OFFICIAL gain so far came from "
                   f"{best['role']} ({best.get('official_delta', 0):+.3f}s)." if best else
                   "No role has moved OFFICIAL yet.")
            )
            return Hypothesis(text=text, provenance=why, agrees_with=None, backend=str(self.backend))
        return self._ask_aria(round_n, per_role_runs, ledger_pick, report_url)  # pragma: no cover

    def _ask_aria(self, round_n, per_role_runs, ledger_pick, report_url) -> Hypothesis:  # pragma: no cover
        # ARIA is driven from the W&B UI; what the loop consumes is the Report it produces. The
        # Report URL is the provenance line, and the answer is pasted into the hypothesis file.
        best = max(per_role_runs, key=lambda r: r.get("official_delta", 0.0), default=None)
        text = (f"Reading the per-component runs for rounds up to {round_n}: the component whose "
                f"changes moved the held-out score most is {best['role'] if best else 'none'}. "
                f"Its runs are grouped under job_type=round in the workspace.")
        if best and best.get("role") == ledger_pick:
            self.agreed += 1
        return Hypothesis(text=text, provenance=report_url or self.workspace or "W&B workspace",
                          agrees_with=(best or {}).get("role"), backend=str(self.backend))


_RAIL: AriaRail | None = None


def aria() -> AriaRail:
    global _RAIL
    if _RAIL is None:
        _RAIL = AriaRail()
    return _RAIL
