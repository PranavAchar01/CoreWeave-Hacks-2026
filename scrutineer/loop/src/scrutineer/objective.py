"""The SICA utility and its mapping to a lap time.

Every number the broadcast shows is derived here, so `U`, `lap_s` and the sign convention
(seconds gained, positive = faster) have exactly one definition.
"""

from __future__ import annotations

from dataclasses import dataclass

from .regs import Regs


@dataclass(frozen=True)
class LapScore:
    U: float
    lap_s: float
    passed: bool
    cost_usd: float
    wall_s: float
    timed_out: bool


def score_lap(
    regs: Regs, *, passed: bool, cost_usd: float, wall_s: float, cap_usd: float, timed_out: bool = False
) -> LapScore:
    o = regs.g("objective")
    wall_cap = regs.wall_cap_s
    u = (
        o["w_pass"] * (1.0 if passed else 0.0)
        + o["w_cost"] * (1.0 - min(1.0, cost_usd / cap_usd if cap_usd else 1.0))
        + o["w_wall"] * (1.0 - min(1.0, wall_s / wall_cap))
    )
    if timed_out:
        u *= 1.0 - float(regs.g("lap", "timeout_penalty"))
    lap_s = float(o["lap_base_s"]) + float(o["lap_span_s"]) * (1.0 - u)
    return LapScore(U=u, lap_s=lap_s, passed=passed, cost_usd=cost_usd, wall_s=wall_s, timed_out=timed_out)


def race_time(laps: list[LapScore]) -> float:
    """Mean lap time over a race. Lower is faster; a *gain* is a positive drop in this number."""
    return sum(x.lap_s for x in laps) / len(laps) if laps else 0.0


def pass_rate(laps: list[LapScore]) -> float:
    return sum(1 for x in laps if x.passed) / len(laps) if laps else 0.0
