"""The loop controller: one generation, end to end.

observe -> evaluate -> track -> self-improve -> audit -> document -> promote -> observe.

Every stage writes an artifact and every promotion needs all of them. The only object that can
start an upgrade is `selection:gen-n`; the only thing that can open the gate is `gate_ok` coming
back from the debrief's own `app.run()`.
"""

from __future__ import annotations

import contextlib
import hashlib
import json
import os
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from . import audit as audit_mod
from . import events
from . import gates as G
from . import historian as H
from .car.lap import LapRecord
from .chain import ChainRow
from .chain import append as chain_append
from .circuits import Item, Split, split_pool, task_pool
from .engineer import Proposal, propose
from .evaluator import RaceResult, SealedEvaluator, run_race
from .evaluator import pool as race_pool
from .ledger import publish_standings, record_credit, standings
from .objective import LapScore
from .pitcrew import install
from .rails.aria import aria
from .rails.inference import inference
from .rails.registry import registry
from .rails.rl import rl
from .rails.sandbox import sandbox
from .rails.typed import typed
from .rails.weave_rail import weave_rail
from .regs import Regs
from .regs import regs as load_regs
from .replay import replay, resample_null
from .router import route
from .selection import Selection, phase_b_checks, select
from .simulator import new_circuit, opening_circuit
from .telemetry import Tracer, publish_object, state_dir
from .theta import ARTIFACTS, CAR_ROLES, Theta

STATE = state_dir()
SEASON_FILE = STATE / "season.json"


@dataclass
class GenerationReport:
    generation: int
    mode: str
    claimed_s: float = 0.0
    official_s: float = 0.0
    d_quali: float = 0.0
    d_sealed: float = 0.0
    d_smoke: float = 0.0
    selection: dict[str, Any] = field(default_factory=dict)
    verdict: dict[str, Any] = field(default_factory=dict)
    gates: list[dict[str, Any]] = field(default_factory=list)
    promoted: bool = False
    rule_fired: str = ""
    role: str | None = None
    prefix: str | None = None
    part: str | None = None
    patterns: list[str] = field(default_factory=list)
    debrief: dict[str, Any] = field(default_factory=dict)
    cost_usd: float = 0.0
    tts_ghost: dict[str, Any] | None = None
    rl: dict[str, Any] | None = None
    circuit: dict[str, Any] | None = None
    manifest: dict[str, Any] = field(default_factory=dict)
    manifest_check: dict[str, Any] = field(default_factory=dict)
    candidate_verdicts: list[dict[str, Any]] = field(default_factory=list)
    black_flags: list[dict[str, Any]] = field(default_factory=list)
    router_rows: list[dict[str, Any]] = field(default_factory=list)
    # what the agent actually produced this generation, so the page can show the work rather
    # than only the score
    tasks: list[dict[str, Any]] = field(default_factory=list)
    pages: list[dict[str, Any]] = field(default_factory=list)
    diff: str = ""
    diff_summary: str = ""
    samples: list[dict[str, Any]] = field(default_factory=list)
    standings: dict[str, Any] = field(default_factory=dict)
    wall_s: float = 0.0
    backends: dict[str, str] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)


class Season:
    def __init__(
        self,
        *,
        regs: Regs | None = None,
        seed: int | None = None,
        root: Path | None = None,
        band_open: bool | None = None,
    ) -> None:
        self.regs = regs or load_regs()
        self.seed = seed if seed is not None else self.regs.seed
        self.theta = Theta.load(root)
        nq = int(self.regs.g("circuit", "quali_items"))
        ns = int(self.regs.g("circuit", "sealed_items"))
        self.split: Split = split_pool(self.seed, n_quali=nq, n_sealed=ns)
        self.opening_rates: dict[str, float] = {}
        # Against a capable driver most of the pool is already solved, so a random opening circuit
        # leaves the loop nothing to improve. Measure the car and keep what it does not already
        # own — the same frontier-band rule the SIMULATOR applies to every later circuit.
        if band_open is None:
            band_open = inference().backend.real
        if band_open:
            q, sd, rest, rates = opening_circuit(
                theta=self.theta, pool=task_pool(), regs=self.regs, seed=self.seed, n_quali=nq, n_sealed=ns
            )
            if len(q) >= 6 and len(sd) >= 6:
                self.split = Split(quali=q, sealed=sd, reserve=rest)
                self.opening_rates = rates
        self.ghost: Theta | None = None
        self.sealed = SealedEvaluator(self.split.sealed, self.regs)
        self.circuit_items: list[Item] = list(self.split.quali)
        self.circuit_version = 0
        self.generation = 0
        self.reports: list[GenerationReport] = []
        self.accepted = 0
        self.prev_official: float | None = None
        self.prev_claimed: float | None = None
        self.prev_per_item: dict[str, bool] = {}
        self.prev_quali_per_item: dict[str, bool] = {}
        self.p_fix: dict[str, float] = {}
        self.p_fix_counts: dict[str, int] = {}
        # generation a component was last put forward, so retirement can expire
        self.last_attempt: dict[str, int] = {}
        self.p_fix_hits: dict[str, int] = {}
        self.tried_moves: set[str] = set()
        self.diff_history: list[str] = []
        # every generation's gate rows, so a gate that can never pass is visible as
        # a pattern rather than absorbed one generation at a time
        self.gate_history: list[list[dict[str, Any]]] = []
        # The Ladder's state. `sealed_best` is the highest sealed delta this season has been
        # allowed to *learn*, and it only moves when a candidate clears it by more than the
        # split's own noise. `sealed_queries` counts every question put to the sealed split,
        # because adaptive reuse is what costs the split its validity.
        self.sealed_best = 0.0
        self.router_calls: list[tuple[str, str]] = []  # (blamed, upgraded-and-improved?)
        self.pending_manifest: dict[str, Any] | None = None
        self.per_role_runs: list[dict[str, Any]] = []
        self.override_pick: str | None = None
        self.cost_spent = 0.0
        self.season_cost = 0.0
        self.exhausted: set[str] = set()
        self.seed_tamper_at: int | None = None
        self._tamper_done = False
        self.last_phase_b_at: int | None = None
        self.halted: str | None = None

    # -- helpers ---------------------------------------------------------------------------------
    @property
    def backends(self) -> dict[str, str]:
        sb = sandbox()
        return {
            "driver": str(inference().backend),
            "typed_decision": str(typed().backend),
            "sandbox": str(sb.backend)
            + (f" — managed sandbox unavailable: {sb.managed_reason}" if sb.managed_reason else ""),
            "weave": str(weave_rail().backend),
            "rl": str(rl().backend),
            "registry": str(registry().backend),
            "aria": str(aria().backend),
        }

    @property
    def meters(self) -> dict[str, Any]:
        """What each rail actually did. The honesty panel prints these, so a claim that a rail
        ran is a count, not an assertion."""
        sb = sandbox()
        return {
            "driver": inference().meter(),
            "typed_decision": typed().meter(),
            "weave": weave_rail().meter(),
            "sandbox": {"backend": str(sb.backend), "executions": sb.executions, "cache_hits": sb.cache_hits},
        }

    def _levels(self, upto: int | None = None) -> dict[str, int]:
        """Component levels implied by which runs promoted — what the page shows on the right."""
        from .theta import ALL_ROLES

        lv = dict.fromkeys(ALL_ROLES, 1)
        for r in self.reports[: upto if upto is not None else len(self.reports)]:
            if r.promoted and r.role in lv:
                lv[r.role] += 1
        return lv

    def part_no(self, role: str, version: int) -> str:
        return f"{self.regs.roles[role].prefix}-v{version}"

    # -- one generation --------------------------------------------------------------------------
    def run_generation(self, unattended: bool | None = None) -> GenerationReport:
        t0 = time.time()
        n = self.generation
        # the cap is per generation; the season total is tracked separately
        self.season_cost += self.cost_spent
        self.cost_spent = 0.0
        rg = (
            self.regs.with_mode("unattended" if unattended else "attended")
            if unattended is not None
            else self.regs
        )
        rep = GenerationReport(
            generation=n, mode="unattended" if rg.unattended else "attended", backends=self.backends
        )
        tracer = Tracer(generation=n)
        events.emit(
            "phase", phase="RUN", generation=n, total=len(self.circuit_items) * 2, levels=self._levels()
        )

        # 1 RACE + 2 TIMING ------------------------------------------------------------------
        quali = run_race(
            theta=self.theta,
            items=self.circuit_items,
            regs=rg,
            generation=n,
            name="quali",
            seed=self.seed,
            trials=2,
            tracer=tracer,
        )
        official = self.sealed.official(self.theta, n, self.seed)
        rep.claimed_s, rep.official_s = quali.race_s, official["race_s"]
        rep.tasks = _task_rows(quali, self.split)
        rep.samples = _samples(quali, self.split)
        # Every interface the agent built, kept as a real document. This is the part a judge can
        # check without taking anything on trust: open the page, run axe yourself, compare.
        rep.pages = _save_pages(quali, self.split, n)
        events.emit(
            "score",
            generation=n,
            claimed=round(quali.race_s, 3),
            official=round(official["race_s"], 3),
            clean=sum(1 for x in quali.scores if x.passed),
            total=len(quali.scores),
            pages=rep.pages,
        )
        self.cost_spent += quali.cost_usd + official["cost_usd"]

        # 3 INQUIRY: route, replay, ledger ---------------------------------------------------
        failing = [(lap, sc) for lap, sc in zip(quali.laps, quali.scores, strict=True) if not sc.passed]
        replay_budget = rg.race_cap_usd * float(rg.g("cost", "race_shares")["replay"])
        # Floored, not merely divided. Dividing a fixed pot by the number of failures means the
        # more a generation has to learn from, the less it can afford to look at any of it — and
        # below the cost of a single replay nothing confirms at all, so the loop reads a starved
        # budget as an absence of evidence and refuses.
        floor = float(rg.g("cost", "replay_floor_usd"))
        # Arms per failing lap: one do_resample null, shared, plus one per role the router names.
        # The null is what makes the other arms mean anything, so it is budgeted for rather than
        # squeezed out of the same pot the roles were already dividing.
        arms = 1 + int(rg.g("credit", "ablate_top_k"))
        per_lap_cap = max(floor, replay_budget / max(1, len(failing) * arms))

        def inquire(pair):
            """Route one failing lap, then confirm by counterfactual replay. One thread per lap:
            the router is the slow model and there are dozens of these a generation."""
            lap, sc = pair
            r = route(lap)
            item = self.split.by_id(lap.item_id)
            if item is None:
                return r, lap, [], 0.0
            k = (
                int(rg.g("credit", "ablate_top_k"))
                if (r.needs_ablation or r.confidence < float(rg.g("credit", "router_confidence_floor")))
                else 1
            )
            # do_resample first, once, and shared by every role named on this lap. Without it each
            # role is credited for whatever a second draw would have bought anyway, and the role
            # whose counterfactual perturbs the prompt hardest collects the most of it.
            null = resample_null(
                theta=self.theta,
                item=item,
                lap_index=0,
                regs=rg,
                seed=self.seed,
                tracer=tracer,
                cap_usd=per_lap_cap,
            )
            recs = []
            for role in r.top(k):
                rec = replay(
                    theta=self.theta,
                    ghost=self.ghost,
                    role=role,
                    item=item,
                    lap_index=0,
                    actual_s=sc.lap_s,
                    regs=rg,
                    seed=self.seed,
                    tracer=tracer,
                    cap_usd=per_lap_cap,
                    null=null,
                )
                recs.append(rec)
                # the most interesting thing the loop does, and it used to happen in silence
                events.emit(
                    "replay",
                    generation=n,
                    role=role,
                    item=item.id,
                    title=getattr(item, "title", item.family),
                    mode=rec.mode,
                    credit=round(rec.credit_s, 2),
                    flipped=bool(rec.flipped),
                )
            return r, lap, recs, r.cost_usd

        workers = int(os.environ.get("SCRUTINEER_WORKERS", "1"))
        if workers > 1 and len(failing) > 1:
            inquiries = list(race_pool(workers).map(inquire, failing))
        else:
            inquiries = [inquire(f) for f in failing]

        rows: list[dict[str, Any]] = []
        agent_error = harness_flip = confirmed = 0
        for r, lap, recs, cost in inquiries:
            rep.router_rows.append({"item": lap.item_id, **r.row()})
            self.cost_spent += cost
            flipped_by_harness = False
            for rec in recs:
                call = tracer.role_call(lap.trace_id, rec.role) or tracer.calls[-1]
                rows.append(record_credit(tracer, call.id, rec))
                if rec.credit_s > float(rg.g("credit", "incident_threshold_s")):
                    confirmed += 1
                    if rec.role != "POWER_UNIT":
                        flipped_by_harness = True
            if flipped_by_harness:
                harness_flip += 1
            elif r.blamed_role == "POWER_UNIT":
                agent_error += 1

        table = standings(tracer, rg)
        events.emit("phase", phase="DIAGNOSE", generation=n)
        events.emit(
            "blame",
            generation=n,
            standings={k: {"n": v.n, "blame_s": round(v.blame_s, 2)} for k, v in table.items() if v.n},
        )
        rep.standings = {r: s.row() for r, s in table.items()}
        publish_standings(n, table, {"claimed_s": quali.race_s, "official_s": official["race_s"]})
        publish_object(f"ledger:gen-{n}", {"generation": n, "rows": rows})
        tracer.flush(f"gen-{n}")

        # 4 DESIGN OFFICE: the selection object ----------------------------------------------
        n_fail = max(1, sum(1 for s in quali.scores if not s.passed))
        gap = quali.pass_rate - float(official["pass_rate"])
        last_rl = self.reports[-1].rl if self.reports and self.reports[-1].rl else None
        zv = float(last_rl["zero_variance_groups"]) if last_rl else 0.0
        phase_b = phase_b_checks(
            rg,
            self._service_metrics(),
            self.accepted,
            exhausted=self.exhausted,
            last_fired_at=self.last_phase_b_at,
        )
        if any(phase_b.values()):
            self.last_phase_b_at = self.accepted
        sel = select(
            regs=rg,
            generation=n,
            table=table,
            generalisation_gap=gap,
            zero_variance_groups=zv,
            agent_error_share=agent_error / n_fail,
            harness_flip_share=harness_flip / n_fail,
            p_fix=self.p_fix,
            p_fix_counts=self.p_fix_counts,
            override_pick=self.override_pick,
            last_attempt=self.last_attempt,
            phase_b=phase_b,
            exhausted=self.exhausted,
        )
        self.override_pick = None
        sel.publish()
        rep.selection, rep.rule_fired, rep.role = sel.obj(), sel.rule_fired, sel.role
        events.emit(
            "selection",
            generation=n,
            role=sel.role,
            rule=sel.rule_fired,
            notes=sel.notes[:1],
            gain_per_usd=round(sel.expected_gain_per_usd, 1),
        )

        # deltas that every gate is measured against
        rep.d_quali = (self.prev_claimed - quali.race_s) if self.prev_claimed is not None else 0.0
        rep.d_sealed = (self.prev_official - official["race_s"]) if self.prev_official is not None else 0.0

        # 10 manifest_check for the previous generation's forecast ---------------------------
        if self.pending_manifest:
            rep.manifest_check = self._manifest_check(self.pending_manifest, quali, rep.d_sealed)
            self.pending_manifest = None

        # branches that end the generation without a harness mutation ------------------------
        # A generation that mutates nothing still ends, and a listener has to hear that it did:
        # without this the pit board waits on a run that has already been decided.
        if sel.rule_fired == "no_upgrade":
            rep.tts_ghost = self._tts_ghost(rg, n)
            rep.notes += sel.notes
            events.emit(
                "result",
                generation=n,
                promoted=False,
                role=sel.role,
                rule=sel.rule_fired,
                levels=self._levels(),
            )
            return self._finish(rep, quali, official, tracer, t0, promoted=False)
        if sel.rule_fired == "circuit":
            rep.circuit = self._circuit_generation(rg, quali, n)
            rep.notes += sel.notes
            events.emit(
                "result",
                generation=n,
                promoted=False,
                role=sel.role,
                rule=sel.rule_fired,
                levels=self._levels(),
            )
            return self._finish(rep, quali, official, tracer, t0, promoted=False)

        # 4/5 propose, install, A/B ----------------------------------------------------------
        assert sel.role
        rep.prefix = rg.roles[sel.role].prefix
        if sel.path == "weights":
            rep.rl = self._rl_job(rg, quali, n)

        failures = [lap.item_id for lap, sc in zip(quali.laps, quali.scores, strict=True) if not sc.passed]
        proposal: Proposal = propose(
            theta=self.theta,
            sel=sel,
            pages=H.pages_for(sel.role),
            hypothesis=H.read_hypothesis(n),
            skill_impact=H.skill_impact_text(),
            tried=self.tried_moves,
            quali_failures=failures,
        )
        rep.manifest = proposal.manifest.obj()
        self.cost_spent += rg.roles[sel.role].cost_usd
        if not proposal.candidates:
            self.exhausted.add(sel.role)
            rep.notes.append(
                f"{sel.role} has no move left on its ladder that the gates have not "
                "already refused; it is out of the running until new evidence arrives"
            )
            return self._finish(rep, quali, official, tracer, t0, promoted=False)
        if self.seed_tamper_at is not None and n >= self.seed_tamper_at and not self._tamper_done:
            proposal = self._seeded_tamper(proposal, sel)
            rep.notes.append(
                "SEEDED: an illegal proposal was injected and run through the normal "
                "pipeline to exercise the scrutineer"
            )
            self._tamper_done = True

        # SCRUTINEERING happens on every candidate, before the pit crew touches it: the auditor
        # reads diff hunks, so a proposal that never installs still gets a verdict on the record.
        cleared = []
        for cand in proposal.candidates:
            cv = audit_mod.audit(
                diff_text=cand.diff,
                role=sel.role,
                before=self.theta.files,
                regs=rg,
                seeded=(cand.backend == "seeded"),
            )
            rep.candidate_verdicts.append({"candidate": cand.label, "summary": cand.summary, **cv.row()})
            if cv.verdict == "BLACK_FLAG":
                rep.black_flags.append({"candidate": cand.label, "summary": cand.summary, **cv.row()})
                rep.notes.append(
                    f"BLACK FLAG on candidate {cand.label}: {cv.cell} "
                    f"({cv.evidence[0] if cv.evidence else 'no evidence'})"
                )
                self.tried_moves.add(cand.summary)
                continue
            cleared.append(cand)
        if not cleared:
            rep.notes.append("every candidate was black-flagged; nothing reaches the wind tunnel")
            return self._finish(rep, quali, official, tracer, t0, promoted=False)

        smoke_items = self.circuit_items[: int(self.regs.g("phase_b", "every")) + 2]
        # the smoke delta has to be measured on the same set for both cars; comparing a five-item
        # smoke run against a thirty-item race is not a correlation, it is a category error
        champ_smoke = run_race(
            theta=self.theta,
            items=smoke_items,
            regs=rg,
            generation=n,
            name="smoke",
            seed=self.seed,
            trials=1,
            tracer=Tracer(generation=n),
        )
        best = None
        for cand in cleared:
            res = install(
                theta=self.theta,
                candidate=cand,
                role=sel.role,
                smoke_items=smoke_items,
                regs=rg,
                generation=n,
                seed=self.seed,
            )
            if not res.ok:
                rep.notes.append(f"candidate {cand.label}: {res.reason}")
                self.tried_moves.add(cand.summary)
                continue
            ab = run_race(
                theta=res.theta,
                items=self.circuit_items,
                regs=rg,
                generation=n,
                name="quali",
                seed=self.seed,
                trials=2,
                tracer=Tracer(generation=n),
            )
            self.cost_spent += ab.cost_usd
            score = quali.race_s - ab.race_s
            if best is None or score > best[0]:
                best = (score, cand, res, ab)
        if best is None:
            rep.notes.append("no candidate installed; nothing to homologate this generation")
            return self._finish(rep, quali, official, tracer, t0, promoted=False)

        d_quali_cand, cand, res, ab = best
        rep.diff, rep.diff_summary = cand.diff, cand.summary
        events.emit("phase", phase="CHANGE", generation=n)
        events.emit("change", generation=n, role=sel.role, summary=cand.summary, diff=cand.diff[:4000])
        cand_official = self.sealed.official(res.theta, n, self.seed, publish=False)
        d_sealed_cand = official["race_s"] - cand_official["race_s"]
        d_smoke_cand = champ_smoke.race_s - res.smoke_race_s
        rep.d_quali, rep.d_sealed, rep.d_smoke = d_quali_cand, d_sealed_cand, d_smoke_cand

        # 6 SCRUTINEERING --------------------------------------------------------------------
        v = audit_mod.audit(
            diff_text=cand.diff,
            role=sel.role,
            before=self.theta.files,
            regs=rg,
            trace_summary={
                "tool_errors": sum(lp.tool_errors for lp in quali.laps),
                "pass_rate": round(quali.pass_rate, 3),
            },
        )
        rep.verdict = v.row()

        # 7 gates ----------------------------------------------------------------------------
        pattern_ids = self._write_patterns(n, rep.router_rows, rows, sel.role)
        rep.patterns = pattern_ids
        gates = [
            G.diff_size(rg, cand.lines_changed),
            G.comparable_ab(cleared[0].diff, cleared[-1].diff),
            G.novelty(rg, cand.diff, self.diff_history),
            G.evidence(pattern_ids),
            G.seesaw(rg, d_quali_cand, d_sealed_cand),
            G.ladder(rg, d_sealed_cand, self.sealed_best, self.sealed.n_items, self.sealed.queries),
            G.correlation(rg, d_smoke_cand, d_quali_cand, d_sealed_cand),
            G.regression(
                self.prev_per_item, cand_official["per_item_pass"], cand_official.get("per_item_any")
            ),
            G.cost(rg, self.cost_spent),
            G.verdict_gate(rg, v.verdict, v.confidence, rg.unattended),
            G.entropy(rg, (rep.rl or {}).get("entropy_series", [])),
        ]
        rep.gates = [g.row() for g in gates]
        by_name = {g.name: g for g in gates}
        self.gate_history.append(rep.gates)
        for name in G.stuck(self.gate_history):
            rep.notes.append(
                f"STUCK GATE: {name} has failed every one of the last three generations and it "
                "does not judge the change. A gate that cannot pass is a misconfigured harness, "
                "not a run of bad luck — check its threshold against the rail actually in use."
            )
        events.emit("phase", phase="GATES", generation=n)
        for _g in gates:
            events.emit("gate", generation=n, gate=_g.name, ok=_g.ok, detail=_g.detail)
        gates_ok, failed = G.summarise(gates)

        # 7 RACE REPORT: the debrief is the gate ---------------------------------------------
        champions = {r: (registry().champion(r) or f"{r.lower()}:v0") for r in ARTIFACTS}
        path = H.write_debrief(
            round_id=n,
            state_dir=STATE,
            verdict=v.verdict,
            # by name, not by index: these were positional, and inserting a gate anywhere above
            # them silently re-pointed the debrief at the wrong four.
            seesaw_ok=by_name["seesaw"].ok,
            correlation_ok=by_name["correlation"].ok,
            regression_ok=by_name["regression"].ok,
            cost_ok=by_name["cost_cap"].ok,
            champions=champions,
            circuit=f"practice-circuit:v{self.circuit_version}",
            cost_cap=rg.race_cap_usd,
            incident_threshold=float(rg.g("credit", "incident_threshold_s")),
        )
        deb = H.run_debrief(path, n)
        rep.debrief = deb.row()

        # 8 PARC FERMÉ ------------------------------------------------------------------------
        approved = deb.gate_ok and gates_ok
        rule = (
            "principal_auto"
            if (approved and rg.unattended)
            else ("principal_approve" if approved else "blocked")
        )
        if approved:
            # The Ladder's rung moves only on a revealed score. Promotion requires the ladder gate,
            # so reaching here means this sealed answer was genuinely new information — and a
            # candidate that merely matched the standing best never gets to raise it.
            self.sealed_best = max(self.sealed_best, d_sealed_cand)
            self._promote(
                rg,
                n,
                sel,
                cand,
                res.theta,
                proposal,
                v,
                quali,
                cand_official,
                d_quali_cand,
                d_sealed_cand,
                pattern_ids,
                rule,
            )
            rep.promoted = True
            rep.part = self.part_no(sel.role, len(registry().ancestry(sel.role)) - 1)
            events.emit(
                "result",
                generation=n,
                promoted=True,
                role=sel.role,
                part=rep.part,
                levels=self._levels(n + 1),
            )
            self.pending_manifest = {
                "manifest": proposal.manifest.obj(),
                "role": sel.role,
                "quali_before": dict(self.prev_quali_per_item),
            }
        else:
            rep.notes.append("not homologated: " + ", ".join(failed or ["debrief gate"]))
            events.emit(
                "result",
                generation=n,
                promoted=False,
                role=sel.role,
                failed=failed or ["debrief gate"],
                verdict=(rep.verdict or {}).get("verdict"),
                levels=self._levels(),
            )
            if v.verdict == "REFER_TO_STEWARDS" and rg.unattended:
                rep.notes.append("candidate parked for the next attended generation")
            # p_fix asks "did this component's upgrade move OFFICIAL", and that question is
            # answered by the measurement, not by the promotion decision. A candidate refused on
            # budget still moved OFFICIAL or it did not. Recording every refusal as a failed fix
            # is the invalid-action-penalty mistake (arXiv:2006.14171) and it compounds: three of
            # them retire the component and the loop reports the retirement as a fact about the
            # component rather than about its own budget.
            if G.measured(gates):
                self._record_p_fix(sel.role, improved=d_sealed_cand > 0)
            else:
                rep.notes.append(
                    "no outcome recorded for "
                    + str(sel.role)
                    + ": the A/B was not a valid comparison, so nothing was measured"
                )
            for c in cleared:
                self.tried_moves.add(c.summary)

        return self._finish(
            rep,
            quali,
            official,
            tracer,
            t0,
            promoted=rep.promoted,
            promoted_theta=res.theta if approved else None,
            cand_official=cand_official if approved else None,
            cand_quali=ab if approved else None,
        )

    # -- stage helpers ---------------------------------------------------------------------------
    def _finish(
        self,
        rep: GenerationReport,
        quali: RaceResult,
        official: dict[str, Any],
        tracer: Tracer,
        t0: float,
        *,
        promoted: bool,
        promoted_theta: Theta | None = None,
        cand_official: dict[str, Any] | None = None,
        cand_quali: RaceResult | None = None,
    ) -> GenerationReport:
        if promoted and promoted_theta is not None:
            self.ghost = self.theta
            self.theta = promoted_theta
            self.accepted += 1
            self.prev_official = (cand_official or official)["race_s"]
            self.prev_claimed = (cand_quali or quali).race_s
            self.prev_per_item = (cand_official or official)["per_item_pass"]
            self.prev_quali_per_item = (cand_quali or quali).per_item
        else:
            self.prev_official = official["race_s"] if self.prev_official is None else self.prev_official
            self.prev_claimed = quali.race_s if self.prev_claimed is None else self.prev_claimed
            self.prev_per_item = self.prev_per_item or official["per_item_pass"]
            self.prev_quali_per_item = self.prev_quali_per_item or quali.per_item

        rep.cost_usd = self.cost_spent
        rep.wall_s = time.time() - t0
        # ARIA's answer becomes next round's hypothesis, with its provenance on the file
        h = aria().ask(
            round_n=self.generation + 1,
            per_role_runs=self.per_role_runs,
            ledger_pick=rep.role,
            unattended=(rep.mode == "unattended"),
        )
        H.write_hypothesis(self.generation + 1, h.markdown(self.generation + 1))
        self.per_role_runs.append(
            {
                "role": rep.role,
                "official_delta": rep.d_sealed,
                "round": self.generation,
                "aria_agrees": h.agrees_with == rep.role,
            }
        )
        H.write_index()
        self.reports.append(rep)
        self.generation += 1
        self.save()
        return rep

    def _promote(
        self,
        rg: Regs,
        n: int,
        sel: Selection,
        cand,
        new_theta: Theta,
        proposal: Proposal,
        v,
        quali: RaceResult,
        cand_official: dict[str, Any],
        d_quali: float,
        d_sealed: float,
        patterns: list[str],
        rule: str,
    ) -> None:
        assert sel.role
        proposal_hash = hashlib.sha256(cand.diff.encode()).hexdigest()
        parent = registry().champion(sel.role) or f"{sel.role.lower()}:v-1"
        version = registry().link(
            sel.role,
            {
                "parent_version": parent,
                "proposal_hash": proposal_hash,
                "wiki_pages_cited": patterns,
                "official": cand_official["race_s"],
                "claimed": quali.race_s,
                "verdict": v.verdict,
            },
        )
        registry().set_champion(sel.role, version)
        chain_append(
            ChainRow(
                round=n,
                role=sel.role,
                prefix=rg.roles[sel.role].prefix,
                parent_version=parent,
                new_version=version,
                proposal_hash=proposal_hash,
                defs_hash=hashlib.sha256(json.dumps(sel.obj(), sort_keys=True).encode()).hexdigest(),
                regs_hash=rg.sha256,
                official=cand_official["race_s"],
                claimed=quali.race_s,
                verdict=v.verdict,
                mode="unattended" if rg.unattended else "attended",
                rule_fired=rule,
            )
        )
        H.append_skill_impact(
            {
                "round": n,
                "role": sel.role,
                "prefix": rg.roles[sel.role].prefix,
                "proposal_hash": proposal_hash,
                "patterns": patterns,
                "claimed": d_quali,
                "official": d_sealed,
                "verdict": v.verdict,
            }
        )
        self.diff_history.append(cand.diff)
        self.tried_moves.add(cand.summary)
        self._record_p_fix(sel.role, improved=d_sealed > 0)

    def _seeded_tamper(self, proposal: Proposal, sel: Selection) -> Proposal:
        """LOOP.md's fallback when no natural black flag has happened: run one deliberately
        illegal proposal through the ordinary pipeline. It is labelled `seeded` on screen, in the
        chain row and in the report, every time it appears."""
        from .engineer import Candidate

        path, diff = audit_mod.seed_tamper({"REGS.md": (self.theta.root / "REGS.md").read_text()})
        tampered = Candidate(label="C", diff=diff, summary=f"SEEDED tamper against {path}", backend="seeded")
        # injected alongside the real candidates, not in place of one: the point is to prove the
        # scrutineer catches it while the ordinary A/B still runs
        return Proposal(
            role=proposal.role,
            candidates=[*proposal.candidates, tampered],
            manifest=proposal.manifest,
            backend="seeded",
            prompt_chars=proposal.prompt_chars,
        )

    def _record_p_fix(self, role: str | None, improved: bool) -> None:
        if not role:
            return
        self.last_attempt[role] = self.generation
        self.p_fix_counts[role] = self.p_fix_counts.get(role, 0) + 1
        self.p_fix_hits[role] = self.p_fix_hits.get(role, 0) + int(improved)
        self.p_fix[role] = self.p_fix_hits[role] / self.p_fix_counts[role]

    def _tts_ghost(self, rg: Regs, n: int) -> dict[str, Any]:
        """The matched-budget test-time-scaling ghost: one more sample everywhere, no upgrade."""
        import yaml

        ty = yaml.safe_load(self.theta.files["skills/tyres/tyres.yaml"]) or {}
        modes = {k: {**v, "samples": int(v["samples"]) + 1} for k, v in ty.get("modes", {}).items()}
        files = dict(self.theta.files)
        files["skills/tyres/tyres.yaml"] = yaml.safe_dump({**ty, "modes": modes}, sort_keys=False)
        ghost = Theta.from_files(self.theta.root, files)
        res = run_race(
            theta=ghost,
            items=self.circuit_items,
            regs=rg,
            generation=n,
            name="quali",
            seed=self.seed,
            trials=1,
            tracer=Tracer(generation=n),
        )
        self.cost_spent += res.cost_usd
        return {
            "race_s": round(res.race_s, 3),
            "pass_rate": round(res.pass_rate, 3),
            "note": "extra-lap ghost: k+1 samples at the same budget, no upgrade",
        }

    def _circuit_generation(self, rg: Regs, quali: RaceResult, n: int) -> dict[str, Any]:
        c = new_circuit(
            theta=self.theta,
            split=self.split,
            current=self.circuit_items,
            laps=quali.laps,
            scores=quali.scores,
            regs=rg,
            version=self.circuit_version + 1,
            seed=self.seed,
        )
        c.publish()
        self.circuit_items = c.items
        self.circuit_version = c.version
        # re-time the ghost on the new circuit: a delta across two datasets is not a delta
        if self.ghost is not None:
            g = run_race(
                theta=self.ghost,
                items=self.circuit_items,
                regs=rg,
                generation=n,
                name="quali",
                seed=self.seed,
                trials=1,
                tracer=Tracer(generation=n),
            )
            self.prev_claimed = g.race_s
            self.cost_spent += g.cost_usd
        return c.obj()

    def _rl_job(self, rg: Regs, quali: RaceResult, n: int) -> dict[str, Any]:
        groups: list[list[dict[str, Any]]] = []
        for i in range(0, len(quali.laps), 6):
            chunk = list(zip(quali.laps, quali.scores, strict=True))[i : i + 6]
            groups.append([{"reward": 1.0 if sc.passed else 0.0, "item": lap.item_id} for lap, sc in chunk])
        r = rl().train(
            groups=groups,
            base_model=self.theta.power_unit.get("base_model", ""),
            run_name="power-unit",
            project="scrutineer",
        )
        out = r.row()
        out["entropy_series"] = r.entropy
        out["checkpoint"] = r.checkpoint
        return out

    def _manifest_check(self, pending: dict[str, Any], quali: RaceResult, d_sealed: float) -> dict[str, Any]:
        """Score the improver on its own forecast: this is the evidence Phase B needs."""
        m = pending["manifest"]
        now = {k.split("#")[0]: v for k, v in quali.per_item.items()}
        before = {k.split("#")[0]: v for k, v in pending["quali_before"].items()}
        fixes = m.get("predicted_fixes", [])
        risks = m.get("at_risk_regressions", [])
        fixed = [i for i in fixes if now.get(i) and not before.get(i, False)]
        regressed = [i for i in risks if before.get(i, False) and not now.get(i, True)]
        fp = len(fixed) / len(fixes) if fixes else 0.0
        rp = len(regressed) / len(risks) if risks else 0.0
        return {
            "role": pending["role"],
            "fix_precision": round(fp, 3),
            "regression_precision": round(rp, 3),
            "predicted_delta_s": m.get("predicted_delta_s", 0.0),
            "measured_delta_s": round(d_sealed, 3),
            "delta_error": round(abs(m.get("predicted_delta_s", 0.0) - d_sealed), 3),
        }

    def _service_metrics(self) -> dict[str, float]:
        checks = [r.manifest_check for r in self.reports if r.manifest_check]
        fp = sum(c["fix_precision"] for c in checks) / len(checks) if checks else 1.0
        rp = sum(c["regression_precision"] for c in checks) / len(checks) if checks else 1.0
        first_pass = [r.debrief.get("marimo_check", True) for r in self.reports if r.debrief] or [True]
        blamed_and_improved = [1 for r in self.reports if r.role and r.d_sealed > 0]
        blamed = [1 for r in self.reports if r.role]
        return {
            "fix_precision": fp,
            "regression_precision": rp,
            "router_precision": (len(blamed_and_improved) / len(blamed)) if blamed else 1.0,
            "marimo_first_pass": sum(first_pass) / len(first_pass),
            "page_utility": 1.0,
            "sandbox_fail_rate": 0.0,
        }

    def _write_patterns(
        self, n: int, router_rows: list[dict[str, Any]], ledger_rows: list[dict[str, Any]], role: str | None
    ) -> list[str]:
        """A page for the component the evidence actually convicted.

        Pages used to be written from the router's primary blame only. But a component earns its
        credit through replay, and the selection rule spends that credit — so a component blamed
        second could clear the evidence bar, be picked, and then have no page to cite. The
        evidence gate then blocked it for the rest of the season.
        """
        confirmed = [row for row in ledger_rows if row["role"] == role and float(row["delta_s"]) > 0.5]
        if not confirmed:
            return []
        modes: dict[str, int] = {}
        for r in router_rows:
            if r["blamed_role"] == role:
                modes[r["mast_mode"]] = modes.get(r["mast_mode"], 0) + 1
        mode = max(modes, key=lambda k: modes[k]) if modes else "confirmed-by-replay"
        digest = hashlib.sha1(f"{role}:{mode}".encode()).hexdigest()
        pid = f"pattern-{n:02d}{int(digest[:4], 16) % 100:02d}"
        gained = sum(float(r["delta_s"]) for r in confirmed)
        page = H.Pattern(
            id=pid,
            role=role or "?",
            mast_mode=mode,
            generation=n,
            title=f"{role} — {mode}",
            evidence=[r["replay_ref"] for r in confirmed][:6],
            lesson=(
                f"{len(confirmed)} failure(s) this run were confirmed against {role} by "
                f"rebuilding the interface with it corrected: {gained:.1f}s recovered. The "
                f"cause is the component, not the model."
            ),
        )
        return H.write_patterns([page])

    # -- season ----------------------------------------------------------------------------------
    def run_season(
        self, generations: int | None = None, unattended_from: int | None = None, on_generation=None
    ) -> list[GenerationReport]:
        from .car.roles import ModelUnreachable

        total = generations or self.regs.max_generations
        while self.generation < total:
            un = unattended_from is not None and self.generation >= unattended_from
            try:
                rep = self.run_generation(unattended=un)
            except ModelUnreachable as e:
                # Better a season that stops with a reason than one that fills up with runs where
                # nothing was ever asked of the model.
                self.halted = f"model unreachable at run {self.generation}: {e}"
                break
            if on_generation:
                on_generation(rep)
        return self.reports

    def write_champion(self, dest: Path | None = None) -> Path:
        """Leave the harness the season ended with on disk.

        Upgrades are applied to a new theta in memory so the champion is never edited in place
        mid-race; without this the repo would still hold the harness the agent started with, and
        there would be no way to run the finished agent."""
        d = dest or (STATE / "champion")
        self.theta.write(d)
        (d / "CHAMPION.md").write_text(
            f"# The harness after {self.generation} run(s)\n\n"
            f"{self.accepted} change(s) were kept. Component levels are implied by which runs "
            f"promoted:\n\n" + "\n".join(f"- {r.role} {r.part}" for r in self.reports if r.promoted) + "\n"
        )
        return d

    def save(self) -> Path:
        with __import__("contextlib").suppress(Exception):
            self.write_champion()
        SEASON_FILE.write_text(
            json.dumps(
                {
                    "seed": self.seed,
                    "generation": self.generation,
                    "accepted": self.accepted,
                    "circuit_version": self.circuit_version,
                    "regs_sha256": self.regs.sha256,
                    "halted": self.halted,
                    "backends": self.backends,
                    "meters": self.meters,
                    "circuit": {
                        "quali": [i.id for i in self.circuit_items],
                        "sealed": [i.id for i in self.split.sealed],
                        "opening_rates": {i.id: self.opening_rates.get(i.id) for i in self.circuit_items}
                        if self.opening_rates
                        else {},
                    },
                    "champions": {r: registry().champion(r) for r in ARTIFACTS},
                    "reports": [asdict(r) for r in self.reports],
                },
                indent=2,
                default=str,
            )
        )
        return SEASON_FILE


def clear_stale_pages(root: Path | None = None) -> None:
    """A season writes one directory of pages per generation. A previous, longer season leaves the
    generations this one will not reach, and the site would then link a fresh run 3 next to a dead
    run 7. Call this when a season is actually about to run — constructing a Season is not that
    moment, and doing it there deletes pages out from under anything that only wanted to inspect
    the object. The seeded season lives elsewhere and is never touched by this."""
    import shutil

    with contextlib.suppress(Exception):
        shutil.rmtree((root or Path("state")) / "pages", ignore_errors=True)


def _save_pages(race: RaceResult, split: Split, generation: int) -> list[dict[str, Any]]:
    """Write each submitted interface to disk with its audit, one directory per run."""
    from .evaluator import audit_of

    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    d = STATE / "pages" / f"run-{generation:02d}"
    d.mkdir(parents=True, exist_ok=True)
    for lap, sc in zip(race.laps, race.scores, strict=True):
        if lap.item_id in seen or not lap.submitted:
            continue
        seen.add(lap.item_id)
        task = split.by_id(lap.item_id)
        if task is None:
            continue
        a = audit_of(task, lap.submitted)
        name = f"{task.family}-{task.id}.html"
        (d / name).write_text(lap.submitted)
        out.append(
            {
                "id": task.id,
                "family": task.family,
                "title": getattr(task, "title", task.family),
                "file": f"run-{generation:02d}/{name}",
                "passed": bool(sc.passed),
                "weighted": a.weighted,
                "critical": a.critical,
                "rules": [{"id": v["id"], "impact": v.get("impact"), "n": v["n"]} for v in a.violations][:6],
                "missing": a.missing[:3],
                "bytes": len(lap.submitted),
            }
        )
    return sorted(out, key=lambda r: (r["passed"], -r["weighted"]))


def _task_rows(race: RaceResult, split: Split) -> list[dict[str, Any]]:
    """One row per task the agent attempted: what it was, whether it solved it, what it cost."""
    rows: dict[str, dict[str, Any]] = {}
    for lap, sc in zip(race.laps, race.scores, strict=True):
        r = rows.setdefault(
            lap.item_id,
            {
                "id": lap.item_id,
                "attempts": 0,
                "solved": 0,
                "steps": 0,
                "cost_usd": 0.0,
                "missing": lap.missing_concepts,
                "tool_errors": 0,
                "retired": 0,
            },
        )
        item = split.by_id(lap.item_id)
        if item is not None:
            r["family"] = item.family
            r["title"] = item.prompt.split("\n")[0][:110]
        r["attempts"] += 1
        r["solved"] += int(sc.passed)
        r["steps"] += lap.steps
        r["cost_usd"] += lap.cost_usd
        r["tool_errors"] += lap.tool_errors
        r["retired"] += int(lap.retired)
    for r in rows.values():
        r["cost_usd"] = round(r["cost_usd"], 5)
    return sorted(rows.values(), key=lambda r: (r["solved"], r["id"]))


def _samples(race: RaceResult, split: Split, n: int = 4) -> list[dict[str, Any]]:
    """A few of the agent's own answers — one it got right, some it got wrong — with the task."""
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    order = sorted(zip(race.laps, race.scores, strict=True), key=lambda p: p[1].passed)
    for lap, sc in order:
        if lap.item_id in seen or not lap.submitted:
            continue
        item = split.by_id(lap.item_id)
        if item is None:
            continue
        seen.add(lap.item_id)
        out.append(
            {
                "id": item.id,
                "family": item.family,
                "solved": sc.passed,
                "task": item.prompt[:400],
                "wrote": lap.submitted[:900],
                "context_refs": lap.ref_ids,
                "missing": lap.missing_concepts,
                "steps": lap.steps,
            }
        )
        if len(out) >= n:
            break
    return out


def load_season_state() -> dict[str, Any] | None:
    return json.loads(SEASON_FILE.read_text()) if SEASON_FILE.exists() else None


CAR = CAR_ROLES
_ = (LapRecord, LapScore)
