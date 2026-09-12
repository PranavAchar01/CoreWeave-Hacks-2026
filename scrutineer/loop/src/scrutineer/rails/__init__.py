"""Sponsor rails, each behind an adapter that reports which backend actually served it.

Nothing in the loop imports a vendor SDK directly. Every rail exposes the same shape: a
`backend()` string the REGS panel prints verbatim, and a callable that works offline. That is
what makes the honesty panel possible — the broadcast can only claim a rail that reported itself.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Backend:
    name: str          # e.g. "wandb-inference", "local-sim"
    real: bool         # False when the offline stand-in served the call
    detail: str = ""

    def __str__(self) -> str:
        return self.name if self.real else f"{self.name} (stand-in)"
