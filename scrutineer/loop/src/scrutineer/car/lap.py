"""One lap: one item driven to a submission.

The lap never sees the hidden tests. It produces a submission; the evaluator scores it. That
split is the public/private boundary in miniature and it is why `pass` can be trusted.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from ..circuits import Item
from ..regs import Regs
from ..telemetry import Tracer
from ..theta import Theta
from .roles import (
    Attempt,
    Context,
    PitWallCall,
    ProbeResult,
    drive,
    run_tools,
    shape_context,
    strategist_call,
    tyre_profile,
)


@dataclass
class LapRecord:
    item_id: str
    trace_id: str
    submitted: str
    steps: int
    cost_usd: float
    wall_s: float
    retired: bool
    boxed: bool
    decisions: list[dict[str, Any]] = field(default_factory=list)
    probe_scores: list[float] = field(default_factory=list)
    missing_concepts: list[str] = field(default_factory=list)
    ref_ids: list[str] = field(default_factory=list)
    tool_errors: int = 0
    schema_ok: bool = True
    strategist_backend: str = "local-policy"
    attempts: int = 0

    def summary(self) -> dict[str, Any]:
        return {
            "item": self.item_id,
            "steps": self.steps,
            "cost": round(self.cost_usd, 5),
            "retired": self.retired,
            "boxed": self.boxed,
            "missing": self.missing_concepts,
            "tool_errors": self.tool_errors,
            "probe": max(self.probe_scores) if self.probe_scores else 0.0,
        }


def run_lap(
    *,
    theta: Theta,
    item: Item,
    tracer: Tracer,
    regs: Regs,
    seed: int,
    lap_index: int,
    race_id: str,
    cap_usd: float,
) -> LapRecord:
    t0 = time.time()
    max_steps = regs.max_steps
    spent = 0.0
    best_src = ""
    best_score = -1.0
    decisions: list[dict[str, Any]] = []
    probes: list[float] = []
    tool_errors = 0
    attempts_made = 0
    ctx: Context | None = None
    retired = boxed = False
    schema_ok = True
    strategist_backend = "local-policy"
    step = 0

    with tracer.lap(lap_index, item.id, race_id):
        while step < max_steps:
            with tracer.op("strategist.call", "STRATEGIST",
                           {"step": step, "spent_usd": round(spent, 5), "best_probe": max(probes, default=0.0),
                            "item": item.id},
                           theta.hash_for("STRATEGIST"), lap_index) as call:
                pw: PitWallCall = strategist_call(
                    theta, step=step, spent_usd=spent, cap_usd=cap_usd, max_steps=max_steps,
                    best_probe=max(probes, default=0.0), difficulty=item.difficulty,
                )
                call.output = pw.as_row()
                spent += pw.cost_usd
                strategist_backend = pw.backend
            decisions.append({"step": step, **pw.as_row()})

            if pw.action == "RETIRE":
                retired = True
                break
            if pw.action == "BOX" and step >= int(theta.strategist.get("min_steps_before_box", 1)):
                boxed = True
                break

            with tracer.op("tyres.profile", "TYRES", {"step": step, "engine_mode": pw.engine_mode},
                           theta.hash_for("TYRES"), lap_index) as call:
                profile = tyre_profile(theta, pw.engine_mode)
                call.output = {"temperature": profile.temperature, "samples": profile.samples,
                               "compound": profile.compound}

            with tracer.op("aero.shape_context", "AERO", {"step": step, "item": item.id},
                           theta.hash_for("AERO"), lap_index) as call:
                ctx = shape_context(theta, item)
                call.output = {"ref_ids": ctx.ref_ids, "tokens": ctx.tokens,
                               "missing": sorted(ctx.missing)}

            if pw.action == "HOLD" and best_src:
                step += 1
                continue

            with tracer.op("power_unit.drive", "POWER_UNIT",
                           {"step": step, "temperature": profile.temperature, "samples": profile.samples,
                            "context_tokens": ctx.tokens},
                           theta.hash_for("POWER_UNIT"), lap_index) as call:
                attempts: list[Attempt] = drive(theta, item=item, ctx=ctx, profile=profile,
                                                seed=seed, step=step)
                attempts_made += len(attempts)
                spent += sum(a.cost_usd for a in attempts)
                call.output = {"n": len(attempts), "chars": [len(a.source) for a in attempts]}

            for a in attempts:
                with tracer.op("data.run_tools", "DATA", {"step": step, "item": item.id},
                               theta.hash_for("DATA"), lap_index) as call:
                    pr: ProbeResult = run_tools(theta, item=item, source=a.source)
                    call.output = {"score": pr.score, "error": pr.error, "schema_ok": pr.schema_ok}
                    if pr.error:
                        call.exception = pr.error
                schema_ok = schema_ok and pr.schema_ok
                tool_errors += pr.exceptions
                probes.append(pr.score)
                # DATA's probe is the only thing standing between the driver's k samples and a
                # coin flip; when its schema is broken every sample scores the same and the car
                # submits whatever came out first.
                if pr.score > best_score:
                    best_score, best_src = pr.score, a.source
                elif not best_src:
                    best_src = a.source
            step += 1

    return LapRecord(
        item_id=item.id,
        trace_id=f"{race_id}:{lap_index:03d}",
        submitted=best_src,
        steps=step,
        cost_usd=spent,
        wall_s=time.time() - t0,
        retired=retired,
        boxed=boxed,
        decisions=decisions,
        probe_scores=probes,
        missing_concepts=sorted(ctx.missing) if ctx else sorted(item.concepts),
        ref_ids=ctx.ref_ids if ctx else [],
        tool_errors=tool_errors,
        schema_ok=schema_ok,
        strategist_backend=strategist_backend,
        attempts=attempts_made,
    )
