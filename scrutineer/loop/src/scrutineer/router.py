"""CREDIT ROUTER — typed triage of a failing lap.

The router proposes; replay disposes. Agent-level attribution accuracy in the literature sits at
55-70 %, so nothing downstream trusts this call on its own: a low-confidence verdict, or one
flagged `needs_ablation`, always costs a real counterfactual replay.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

from .car.lap import LapRecord
from .rails.typed import typed
from .theta import CAR_ROLES

# MAST modes actually reachable in this harness, with the role each one implicates.
# The router is called ~40 times a generation and its answer decides where a whole upgrade goes,
# so it can afford a slower, more accurate model than the pit wall's thousands of calls. Measured
# on four seeded faults: gpt-oss-20b 4/4 at 6.7 s, granite-4.1-8b 2/4 at 1.2 s.
ROUTER_MODEL = os.environ.get("SCRUTINEER_ROUTER_MODEL", "openai/gpt-oss-20b")

MAST_MODES: dict[str, str] = {
    "1.4-loss-of-history": "AERO",
    "2.5-ignored-input": "AERO",
    "2.3-derailment": "STRATEGIST",
    "1.5-unaware-of-stopping": "STRATEGIST",
    "2.6-reasoning-action-mismatch": "TYRES",
    "3.3-incorrect-verification": "DATA",
    "1.2-tool-schema-error": "DATA",
    "3.1-premature-termination": "STRATEGIST",
    "2.1-capability-shortfall": "POWER_UNIT",
}

# Strict json_schema will not accept an open-ended object, so blame_share is a fixed record with
# one required key per role. An open `additionalProperties` map silently failed every request.
_SHARE = {
    "type": "object",
    "additionalProperties": False,
    "required": list(CAR_ROLES),
    "properties": {r: {"type": "number", "minimum": 0.0, "maximum": 1.0} for r in CAR_ROLES},
}

ROUTER_SCHEMA: dict[str, Any] = {
    "title": "CreditRoute",
    "type": "object",
    "additionalProperties": False,
    "required": ["blamed_role", "mast_mode", "blame_share", "confidence", "needs_ablation"],
    "properties": {
        "blamed_role": {"type": "string", "enum": CAR_ROLES},
        "mast_mode": {"type": "string", "enum": sorted(MAST_MODES)},
        "blame_share": _SHARE,
        "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
        "needs_ablation": {"type": "boolean"},
    },
}


@dataclass
class Route:
    blamed_role: str
    mast_mode: str
    blame_share: dict[str, float]
    confidence: float
    needs_ablation: bool
    backend: str = "local-policy"
    cost_usd: float = 0.0

    def top(self, k: int) -> list[str]:
        return [r for r, _ in sorted(self.blame_share.items(), key=lambda kv: -kv[1])][:k]

    def row(self) -> dict[str, Any]:
        return {
            "blamed_role": self.blamed_role,
            "mast_mode": self.mast_mode,
            "blame_share": {k: round(v, 3) for k, v in self.blame_share.items()},
            "confidence": round(self.confidence, 3),
            "needs_ablation": self.needs_ablation,
            "backend": self.backend,
        }


def _evidence(lap: LapRecord) -> dict[str, Any]:
    modes = [d["engine_mode"] for d in lap.decisions]
    return {
        "missing_concepts": lap.missing_concepts,
        "refs_retrieved": lap.ref_ids,
        "tool_errors": lap.tool_errors,
        "schema_ok": lap.schema_ok,
        "steps": lap.steps,
        "retired": lap.retired,
        "boxed": lap.boxed,
        "engine_modes": modes,
        "best_probe": max(lap.probe_scores) if lap.probe_scores else 0.0,
        "actions": [d["action"] for d in lap.decisions],
    }


def _local_route(lap: LapRecord) -> dict[str, Any]:
    """A real heuristic over the lap's own telemetry, not an oracle. It is wrong often enough that
    the confusion matrix in the debrief is worth printing."""
    ev = _evidence(lap)
    share = dict.fromkeys(CAR_ROLES, 0.0)

    if ev["missing_concepts"]:
        share["AERO"] += 0.35 + 0.10 * min(3, len(ev["missing_concepts"]))
    if not ev["refs_retrieved"]:
        share["AERO"] += 0.15
    if ev["tool_errors"]:
        share["DATA"] += 0.25 + 0.05 * min(4, ev["tool_errors"])
    if not ev["schema_ok"]:
        share["DATA"] += 0.40
    if ev["best_probe"] >= 1.0:
        # the tools said this candidate stood up and it did not: the verification was too weak,
        # and nobody downstream of DATA could have known
        share["DATA"] += 0.45
    if ev["retired"]:
        share["STRATEGIST"] += 0.45
    if ev["boxed"] and ev["steps"] <= 1 and ev["best_probe"] < 1.0:
        # boxing on a probe of 1.0 is the strategist obeying the tools, not overruling them
        share["STRATEGIST"] += 0.25
    hot = [m for m in ev["engine_modes"] if m >= 5]
    if hot:
        share["TYRES"] += 0.20 + 0.05 * min(3, len(hot))
    if ev["steps"] >= 8:
        share["POWER_UNIT"] += 0.30
    share["POWER_UNIT"] += 0.20                      # the driver is always partly on the hook

    total = sum(share.values()) or 1.0
    share = {k: v / total for k, v in share.items()}
    blamed = max(share, key=lambda k: share[k])
    ordered = sorted(share.values(), reverse=True)
    margin = ordered[0] - (ordered[1] if len(ordered) > 1 else 0.0)
    confidence = max(0.20, min(0.95, 0.45 + 1.4 * margin))
    mode = next((m for m, r in MAST_MODES.items() if r == blamed), "2.1-capability-shortfall")
    return {
        "blamed_role": blamed,
        "mast_mode": mode,
        "blame_share": share,
        "confidence": confidence,
        "needs_ablation": confidence < 0.70,
    }


def route(lap: LapRecord) -> Route:
    ev = _evidence(lap)
    res = typed().decide(
        schema=ROUTER_SCHEMA,
        nonce=lap.trace_id,
        model=ROUTER_MODEL,
        system=(
            "You are a Formula 1 steward. One lap failed. Name the engineer whose artifact caused "
            "it, the failure mode, and how confident you are.\n"
            "THE ENGINEERS, IN THE ORDER YOU SHOULD CONSIDER THEM:\n"
            "  DATA — the tools and their schemas, and how strongly a candidate is checked before "
            "the car submits it. Blame it first when best_probe was 1.0 and the lap still failed: "
            "that means the verification accepted a wrong answer, and no other engineer could have "
            "known. Also blame it when tool_errors is non-zero or schema_ok is false.\n"
            "  AERO — which references land in the driver's context. Blame it when "
            "missing_concepts is non-empty, because the driver was asked for a technique nobody "
            "gave it.\n"
            "  TYRES — temperature, and how many samples each step may draw. Blame it when the lap "
            "ran hot (engine_modes at 5) on a single sample, so one bad draw ended the lap.\n"
            "  STRATEGIST — when to push, box or retire. Blame it when the lap RETIRED, or when it "
            "boxed while best_probe was below 1.0, which means it submitted something the tools "
            "had not accepted. Boxing on a probe of 1.0 is the strategist obeying the tools; that "
            "is DATA's failure, not its own.\n"
            "  POWER_UNIT — the driver's own weights. Blame it when nothing above explains it.\n\n"
            "blame_share must cover all five roles and sum to about 1. Spread it: a lap usually "
            "has more than one contributing cause.\n"
            "confidence is the probability that a counterfactual replay would confirm your top "
            "pick. If a second engineer is also plausible, confidence must stay below 0.7 and "
            "needs_ablation must be true — a replay is cheap and being wrong is not."
        ),
        user="\n".join(f"{k}: {v}" for k, v in ev.items()),
        fallback=lambda: _local_route(lap),
    )
    v = res.value
    share = {k: float(x) for k, x in v["blame_share"].items() if k in CAR_ROLES}
    total = sum(share.values()) or 1.0
    return Route(
        blamed_role=str(v["blamed_role"]),
        mast_mode=str(v["mast_mode"]),
        blame_share={k: x / total for k, x in share.items()},
        confidence=float(v["confidence"]),
        needs_ablation=bool(v["needs_ablation"]),
        backend=res.backend,
        cost_usd=res.cost_usd,
    )
