# DESIGN-C — "The Training Camp": roles are policies, and the loop trains them

Angle: the SCRUTINEER loop is a *training camp*. Every technical F1 role is a policy with its own parameters — a LoRA, a typed decision table, a curriculum dataset, a skill file — and one round of the loop is one training cycle for exactly one role. The three things this design leads with are **weights** (the power unit is a LoRA produced by W&B Serverless RL every round), **curriculum** (the practice circuit is mined from Weave failure signals so training data always sits at the car's capability frontier), and **cost-per-decision** (the pit wall makes thousands of typed decisions per race at ~0.001¢ each, and the loop chooses which role to train by expected OFFICIAL gain per dollar). All product facts below are from the R1–R9 research files (fetched 2026-09-03/04) and cited inline; anything the research marked UNVERIFIED is labelled the same here.

---

## 1. Thesis and the loop

**Thesis.** A self-improving multi-agent system is a team whose members are policies, not prompts. The car that races is a base model plus an engine LoRA plus a harness; the people around it — power-unit engineer, strategist, simulator engineer, race engineer, aerodynamicist, tyre engineer, data engineer, pit crew, scrutineer, historian — are each a sub-agent with one upgradeable artifact. Each round, Weave records every role as its own span; a sealed race produces the only score that counts; a typed credit router plus a role-masking replay names the role at fault; a statistical ledger (never one lap) picks the role whose training buys the most OFFICIAL lap time per dollar; that role trains — the power unit with Serverless RL + RULER on a curriculum mined from failure signals, the strategist by refitting typed thresholds, the simulator by publishing a harder practice circuit, a harness role by one atomic skill patch; the Scrutineer audits the diff and the lineage with a typed tampering classifier; and a seesaw gate on ghost-vs-candidate decides promotion. The literature says instance-level blame is unreliable (54–70% agent-level, Who&When https://arxiv.org/abs/2505.00212), harness evolution overfits its own benchmark (https://arxiv.org/abs/2607.12227), and improvers tamper 18–85% of the time (https://arxiv.org/html/2609.00069) — so the design spends its novelty budget on attribution, held-out gating and audit, and lets the sponsor stack do the training.

**The loop, in order (one round = one race weekend):**

```
ROUND n                                   verb          owner / sponsor surface
────────────────────────────────────────────────────────────────────────────────────────
[1] PRACTICE  car races practice-circuit:vN   OBSERVE    every role = SubAgent span in Weave
    in Sandboxes (FP1–FP3, 3 trials)                     (start_conversation / start_subagent);
                                                          ART rollouts @weave.op'd into same project
        │ FIA TELEMETRY: append-only traces + role-named Signals
        ▼
[2] QUALIFYING  EvaluationLogger on practice  EVALUATE   TEAM CLAIMED (public; improver may read)
        │
[3] RACE  EvaluationLogger on sealed circuit  EVALUATE   OFFICIAL (private; only the Scrutineer
    ghost car (engine:vN-1) and candidate                process can read the sealed set);
    run side by side; STRATEGIST makes a typed           System1 / gpt-oss-20b typed decisions,
    decision every lap; RETIRE enforces COST CAP         ~0.001¢ each, thousands per race
        │ lap_time rows + decisions as typed feedback on calls
        ▼
[4] STEWARDS' INQUIRY  credit assignment      TRACK      typed CREDIT ROUTER per failing lap →
    router → replay-confirm → ledger                     PARC FERMÉ REPLAY (role-masking) →
                                                          CONSTRUCTORS' STANDINGS ledger
                                                          (Weave feedback, pandas); one W&B run
                                                          per role per round for ARIA
        │ training_order.json  {role, evidence[], expected_gain_per_usd}
        ▼
[5] DEBRIEF  Historian writes the round       DOCUMENT   marimo notebook (marimo check → app.run
                                                          → export html/slides), wiki pattern
                                                          page, W&B Report via MCP
                                                          create_wandb_report_tool; Team Principal
                                                          asks ARIA "who trains next?" and approves
        │ next_round_config (a variable returned by app.run, not prose)
        ▼
[6] TRAINING CAMP  exactly one role trains    SELF-IMPROVE
    POWER UNIT  → ART ServerlessBackend + RULER on practice-circuit:vN → engine:vN+1 LoRA
    STRATEGIST → thresholds/decision table refit from the decision ledger (typed → table op)
    SIMULATOR  → mines Signals + failing turns → practice-circuit:vN+1 (Agent0 frontier band)
    harness role → RACE ENGINEER emits one atomic SKILL.md patch + change manifest
                   (GEPA component_selector = the blamed role, not round-robin)
        │ candidate artifact + manifest + hash-chained proposal record
        ▼
[7] SCRUTINEERING  audit                      AUDIT      PIT CREW installs in isolated Sandbox
                                                          (skills-ref validate + tests/); typed
                                                          tampering classifier (5 roles × 7
                                                          obligations) over diff + lineage;
                                                          BLACK FLAG → rollback, wiki kept
        ▼
[8] PROMOTION  seesaw + correlation gate      PROMOTE    Δquali ≥ 0, Δrace ≥ 0, max > 0, same
                                                          direction in sandbox/practice/sealed;
                                                          Registry v++ , alias champion moved by
                                                          the Scrutineer's key only; Automation
                                                          webhook fires the UPGRADE SCENE
        │
        └──────────► ROUND n+1  (ghost car := the champion just promoted)
```

What flows between stages is always a *typed artifact*, never prose: traces (Weave), lap-time rows (EvaluationLogger), typed decisions and credits (feedback on calls), `training_order.json`, `next_round_config` (a notebook variable), a LoRA artifact version or a unified diff plus manifest, a Scrutineer verdict row, and a Registry version with a signed parent link.

---

## 2. THE CAST

Team size is deliberately small and role-typed: self-organising teams lose up to 41.1% versus their best member (https://arxiv.org/abs/2602.01011) and auto-generated MAS "consistently underperform CoT-SC" at 10× the cost (https://arxiv.org/abs/2606.13003). Every role below is a `@weave.op`/SubAgent span with `attributes={"role": ..., "generation": n}` and `agent_version` = its artifact version (https://docs.wandb.ai/weave/guides/tracking/trace-agents). Only the first four are trained for real in 26 hours; the rest are real roles with fixed artifacts that the credit router can still blame (so the ledger is honest about where the weakness is even when we do not train it).

| Role | The agent it is | Upgradeable artifact (exact) | Evidence that upgrades it | Upgrade SCENE on screen |
|---|---|---|---|---|
| **POWER UNIT ENGINEER** (produces the engine) | The ART training loop: `art.TrainableModel(name="engine", project="scrutineer", base_model="OpenPipe/Qwen3-14B-Instruct")` on `ServerlessBackend`, GRPO, RULER judge (https://art.openpipe.ai/fundamentals/ruler ; base model list https://docs.wandb.ai/inference/lora) | **The ENGINE SPEC = LoRA artifact** `wandb-artifact:///{team}/scrutineer/engine:vN` (rank ≤16, auto-saved and auto-deployed to `api.inference.wandb.ai/v1`, https://docs.wandb.ai/training) plus its recipe `power_unit/recipe.yaml` (RULER `rubric.md`, group size 6, `learning_rate=1e-5`, steps, scenario mix) | Ledger routes `agent_error` (model-side, the Co-Harness abstention label https://arxiv.org/html/2607.22688v1) and MAST "reasoning–action mismatch" failures to the power unit; reward for training = deterministic checker pass (execution feedback, top of the verification hierarchy https://arxiv.org/html/2607.07663) with RULER relative rank as tie-break inside each group | **DYNO**: engine block on a dyno, ART reward/KL curves play on the garage screen, part number ticks `ENGINE SPEC v7 → v8`, ghost car with the old engine loses the gap on the straight |
| **STRATEGIST** (pit wall) | TypeSafe System1 typed-decision model behind a `TypedDecision` adapter; fallback `openai/gpt-oss-20b` on W&B Inference with `response_format={"type":"json_schema","strict":true}` (https://docs.wandb.ai/inference/response-settings/structured-output). Never a chat model. | `strategist/schema.py` (Pydantic `PitWallCall`), `strategist/thresholds.yaml` (e.g. `box_when_p_finish_under_cap < 0.35`, `retire_when < 0.10`), `strategist/decisions.jsonl` few-shot bank. **Weights never change** — System1 outputs are decisions, not distillation targets (ToS https://typesafe.ai/terms). | Join of per-lap decisions (typed feedback) with lap outcomes: reliability diagram / Brier score of `confidence`, and grid-search of thresholds that minimises OFFICIAL lap time under the cap | **PIT WALL FIRMWARE**: decision ticker (`4,212 calls · $0.05`), reliability diagram straightens, threshold sliders move, `FIRMWARE v3 → v4` |
| **SIMULATOR ENGINEER** (curriculum) | Claude Code with W&B MCP (read-only) + `wandb-primary` skill + our `simulator/SKILL.md`; runs `Dataset.from_calls` on failing/Signal-tagged practice turns, clusters, calls ART `generate_scenarios()` (https://art.openpipe.ai/features/mcp-rl) to write harder variants | `weave.Dataset` published as `practice-circuit:vN` (versioned, https://docs.wandb.ai/weave/guides/core-types/datasets) + `simulator/SKILL.md` (frontier-band rule: keep tasks with car pass-rate ∈ [0.3, 0.8], Agent0 δ=0.25 https://arxiv.org/html/2511.16043v1) | Generalisation gap (practice pass ≫ sealed pass) and GRPO group-variance collapse (all-pass or all-fail groups give zero advantage) both route to the simulator | **TRACK MAP**: new corners drawn onto the practice circuit, each labelled by its failure cluster in F1 words (`TURN 7 — TYRE-MISREAD CHICANE`), `PRACTICE CIRCUIT v6 → v7` |
| **RACE ENGINEER** (harness proposer) | Claude Code with W&B Skills + MCP (`WANDB_MCP_READ_ONLY=true`, https://github.com/wandb/wandb-mcp-server) reading `wiki/index.md` + `skill-impact.md` only (WikiSkill separation https://arxiv.org/html/2608.27454); emits ONE atomic patch to the blamed role via GEPA with a custom `component_selector` (https://github.com/gepa-ai/gepa/blob/main/src/gepa/strategies/component_selector.py) | `race_engineer/SKILL.md` + `manifest_template.md` (AHE change manifest: evidence trace ids, root cause, targeted fix, predicted fixes, predicted at-risk regressions https://arxiv.org/html/2604.25850v1) | Its manifests are verified next round: fix-precision and regression-precision per proposal; low precision upgrades the manifest template / reflection prompt | **GARAGE**: unified diff scrolls in the REGS panel; predicted vs measured delta side by side ("Rank on Grid" mechanic, R8) |
| **AERODYNAMICIST** (what the car sees) | Context-shaping sub-agent: retrieval + context budget for the driver | `roles/aero/SKILL.md` + `roles/aero/context.yaml` (max context tokens, which tool results are summarised, Reflexion Ω≤3 lessons injected https://arxiv.org/html/2303.11366v4) | MAST "loss of history" / "ignored input" modes (https://arxiv.org/abs/2503.13657); role-masking replay with ghost aero | **WIND TUNNEL**: front-wing geometry morphs, context-budget bars re-balance |
| **TYRE ENGINEER** (decoding/retry) | Config policy | `roles/tyres/tyres.yaml` (temperature, max retries, max turns per lap) | MAST "reasoning–action mismatch" not attributable to weights; Optimas-style discrete config sampling (https://arxiv.org/abs/2507.03041) | **TYRE BLANKET**: compound label and temperature change |
| **DATA / TELEMETRY ENGINEER** | Tool wrappers + parsers + the correlation check | `tools/*.json` schemas, `tools/parsers.py`, `correlation.py` (sandbox ↔ practice ↔ sealed must move the same direction, raceteq loop https://www.raceteq.com/articles/2025/02/formula-1-trackside-aerodynamic-analysis-explained) | Tool schema errors (Co-Harness `tool_schema_error`), correlation failures | **CORRELATION BOARD**: three gauges (CFD / WIND TUNNEL / TRACK) align or flag "correlation problem" |
| **PIT CREW** (install/CI) | Installs a candidate in a Serverless Sandbox and runs `skills-ref validate` (https://agentskills.io/specification) + `tests/` (MUSE rule: no registration without passing tests https://arxiv.org/html/2605.27366v1) | `pit_crew/image.txt` (container image digest) + `pit_crew/smoke/` | Botched installs (candidate passes tests locally but fails in sandbox) | **PIT STOP**: stop time on screen; a failed wheel gun = install rejected |
| **SCRUTINEER** (auditor) | Typed classifier (System1 / strict-schema fallback) over every diff and over the accepted lineage; holds the only key that can `set_aliases` / `artifact.link` | `scrutineer/taxonomy.py` (enums `functional_role ∈ {Execution, Evaluation, Selection, Recording, Propagation}`, `obligation ∈ {MeasurementValidity, RepresentationalFidelity, ProceduralIntegrity, AuthorizationAccess, ProtectedArtifactState, Provenance, RequiredSetCompleteness}` from https://arxiv.org/html/2609.00069) + `thresholds.yaml` (BLACK_FLAG confidence bar) | False negatives surfaced by the LINEAGE AUDIT re-run and by seeded tamper cases | **WEIGHBRIDGE**: taxonomy grid lights the cell; BLACK FLAG waved; points stripped from lineage |
| **HISTORIAN** (archivist) | Claude Code + W&B MCP + marimo pair; the only writer of `wiki/` and `debriefs/` (WikiSkill Wiki Maintainer) | `historian/SKILL.md`, `debriefs/template.py` (fixed DAG skeleton), `wiki/patterns/*.md` schema | `marimo check --strict` first-try pass rate; reviewer rubric scored as Weave feedback | **PRESS ROOM**: notebook renders, `HOMOLOGATED` stamp when `marimo check` passes |
| **TEAM PRINCIPAL** (human) + **ARIA** | Human owns `REGS.md` (the `program.md` contract https://github.com/karpathy/autoresearch) and approvals; ARIA is chat-only in the W&B UI (no API/MCP https://docs.wandb.ai/aria/chat), so it is the principal's analyst | Not upgradeable — by design the evaluator and permission control sit outside the loop (https://lilianweng.github.io/posts/2026-07-04-harness/) | ARIA's recommendation vs the ledger's pick is logged (agreement rate) | **TEAM PRINCIPAL'S OFFICE**: ARIA panel "training board"; `APPROVE UPGRADE` click |

The CAR itself = `OpenPipe/Qwen3-14B-Instruct` + `engine:vN` + the harness (aero/tyres/tools/skills). The GHOST CAR = the same harness with `engine:vN-1` and the previous champion's skill versions — two model strings on one OpenAI-compatible endpoint (https://docs.wandb.ai/inference/lora).

**Circuit and lap time (the task and the score).** A circuit is a tool-use task with a deterministic checker against a tiny MCP "telemetry" server (4 tools over a CSV), generated with ART's `generate_scenarios()` (MCP•RL pattern https://art.openpipe.ai/features/mcp-rl). 120 tasks: 80 practice (improver-visible, versioned as `practice-circuit:vN`), 40 sealed (never read by any improver process). `lap_time = 100·(1 − pass) + tokens/1000 + latency_s + 100·[retired]`, lower is better (SICA utility shape https://arxiv.org/html/2504.15228). COST CAP = 400k tokens per car per race, enforced inside the race by the Strategist's `RETIRE`.

---

## 3. SPONSOR × STAGE MATRIX

| Stage | **Weave** | **ARIA** | **Serverless RL + SFT** | **Sandboxes** | **MCP server + Skills** | **marimo** | **TypeSafe** |
|---|---|---|---|---|---|---|---|
| **observe** | `start_conversation(agent_name=role, conversation_id=race_id, attributes={"generation":n,"role":..})`, `start_subagent`/`start_tool` per role; `log_turn(agent_version=artifact_version)`; inputs logged on every role call (TraceElephant: dropping inputs costs 76% of step accuracy https://arxiv.org/abs/2604.22708) | Per-role W&B runs (`round-{n}-{role}` with `blame_share`, `credit_sum`, `cost_usd`) land in the project ARIA reads; project memory persists round to round (https://docs.wandb.ai/aria) | ART rollouts are `@weave.op`; `model.log(train_groups, metrics, step)` auto-logs reward/loss/KL/entropy/timing/cost per step (https://art.openpipe.ai/features/tracking-metrics) | Every practice lap runs in `Sandbox.run(container_image=..., mounted_files=[harness], max_lifetime_seconds=600)`; `stdout/stderr/returncode` and sandbox id stamped as span attributes (https://docs.wandb.ai/sandboxes) | Improver roles read telemetry only through `query_weave_agent_spans_tool` / `get_weave_agent_trace_tool` with `WANDB_MCP_READ_ONLY=true` (https://github.com/wandb/wandb-mcp-server) | — | — |
| **evaluate** | `EvaluationLogger(model=f"car:{gen}", dataset="practice-circuit:vN")` inside `start_conversation` for QUALI; second logger on the sealed set for RACE (https://docs.wandb.ai/weave/agent-evals); custom Signals per role (`tyre-misread`, `strategy-miscall`) scoped by agent (https://docs.wandb.ai/weave/guides/tracking/create-custom-signal) | — | RULER `ruler_score_group(group, judge, rubric=RUBRIC)` ranks 6 rollouts per scenario for training reward; the sealed circuit is never a reward source (https://art.openpipe.ai/fundamentals/ruler) | RACE runs in fresh Kata VMs with the harness mounted read-only and `network=NetworkOptions(egress_mode="isolated")` so the car cannot phone home (https://docs.coreweave.com/products/sandboxes/client/guides/sandbox-configuration) | `summarize_evaluation_tool` and the `wandb-eval-tables` skill give the Race Engineer bounded eval previews (https://github.com/wandb/skills) | `debrief/round_N.py` re-executes the lap-time deltas from Weave calls; an `assert official_new < official_ghost` cell fails `marimo export html` (non-zero exit) if the claim does not reproduce (https://docs.marimo.io/guides/exporting/) | **STRATEGIST** per-lap `PitWallCall{action∈PUSH/HOLD/BOX_NOW/RETIRE, engine_mode 1–5, p_finish_under_cap, confidence}`; thousands per race; `RETIRE` enforces the cost cap in-race |
| **track** | `weave.publish(skill, name=f"{role}-skill", tags=[f"gen-{n}"])`, `client.set_aliases(ref,"champion")` (https://docs.wandb.ai/weave/guides/core-types/prompts-version); credits as `call.feedback.add("scrutineer.credit", {...})`; `get_calls(include_feedback=True).to_pandas()` = CONSTRUCTORS' STANDINGS; `Leaderboard` object | ARIA builds the **TRAINING BOARD** workspace: panels of `official_delta` vs `cost_usd` per role across rounds; "Analyze experiments to find patterns" (https://docs.wandb.ai/aria) | LoRA checkpoints auto-saved as W&B Artifacts `engine:vN`; `model.get_step()`; `compare_artifact_versions_tool` on consecutive engines | Sandbox id + image digest per lap = provenance (audit obligation "Provenance & source attribution") | `compare_runs_tool` (config diff, metric delta) ghost vs candidate; `list_artifact_versions_tool` on `engine` and each role's registry collection | `marimo export session` JSON archived per round; `ctx.graph.ancestors("next_round_config")` is the machine-readable evidence chain (https://raw.githubusercontent.com/marimo-team/marimo/main/marimo/_code_mode/_context.py) | **CREDIT ROUTER** `{blamed_role, blame_share, confidence, needs_ablation, mast_mode}` per failing lap → ledger; calibration (predicted confidence vs replay agreement) tracked |
| **document** | `weave.set_view("debrief", md, extension="md")` on the winning eval call; `AnnotationSpec` for Team Principal notes (https://docs.wandb.ai/weave/guides/tracking/feedback) | ARIA drafts the "who trains next and why" section as a W&B Report ("Creates W&B Reports using Workspaces and Reports API", https://docs.wandb.ai/aria) | — | — | Historian calls `create_wandb_report_tool(entity, project, title, markdown_report_text, panels)` + `log_analysis_to_wandb` (https://docs.wandb.ai/platform/mcp-server) | Historian writes `debriefs/round_N.py` (templated `@app.cell` file or marimo pair `ctx.create_cell`), gates it with `marimo check --fix --strict --format=json`, exports `html` + `pdf --as=slides`, serves via `create_asgi_app().with_dynamic_directory("/debriefs")`, links `molab.marimo.io/https://github.com/...` (https://docs.marimo.io/cli/ ; https://docs.marimo.io/guides/deploying/programmatically/) | — |
| **self-improve** | `Dataset.from_calls(failing_turns)` mints the next practice circuit (https://docs.wandb.ai/weave/guides/core-types/datasets); the ledger DataFrame is the GEPA `component_selector` input | **ARIA DIRECTS TRAINING**: Team Principal asks "which role's training buys the most OFFICIAL gain per dollar?"; ARIA answers from the training board, generates the RL sweep config (`learning_rate`, group size, steps) from natural language (https://wandb.ai/site/agent/); human approves. Stretch: ARIA submits the `train_role` job to a W&B Launch queue served by a Docker agent on a laptop (https://docs.wandb.ai/aria/autoresearch) | **POWER UNIT**: `backend.train(model, groups, learning_rate=1e-5)` for 10–20 steps → `engine:vN+1`; optional warm start `train_sft_from_file(champion_traces.jsonl, assistant_turns="last")` from the champion lineage's passing laps (https://art.openpipe.ai/fundamentals/sft-training) | **PIT CREW** installs the candidate in a sandbox, runs `skills-ref validate` + `tests/` before it may race | **RACE ENGINEER** (Claude Code + `wandb-primary` + our skill) emits one atomic SKILL.md patch + manifest; **SIMULATOR** mines clusters and publishes `practice-circuit:vN+1` | `outputs, defs = app.run(defs={"round_id": n})`; `defs["next_round_config"]` is the contract the training camp consumes; `upgrade_pick` dropdown lets the Team Principal override; `app.run(defs={"upgrade_pick":"aero"})` replays the counterfactual (https://docs.marimo.io/api/app/) | **STRATEGIST** thresholds + decision table refit from the typed decision ledger (a table operation because outputs are values, not strings); no weight distillation |
| **audit** | Automation "deployment gate" webhook → Scrutineer process on alias change (https://docs.wandb.ai/weave/guides/evaluation/automations); `get_calls(scored_by=["Scrutineer"], include_feedback=True)` = LINEAGE AUDIT query | — | KL and entropy per step (ART auto-logged) checked against collapse thresholds; a run whose KL blows past the bound is not eligible for promotion (RSI survey collapse defence https://arxiv.org/html/2607.07663) | Candidate diff executed in an isolated sandbox (`egress_mode="isolated"`) to detect writes outside its role folder or network calls; seeded tamper cases run here | `get_artifact_details_tool` / `list_registry_collections_tool` reconstruct parent links; `list_wandb_automations_tool` proves the gate automation exists | Scrutineer asserts `"stewards" in ctx.graph.ancestors("next_round_config")` — no upgrade without a stewards' verdict in the DAG | **SCRUTINEER** verdict `{verdict∈LEGAL/BLACK_FLAG/REFER_TO_STEWARDS, functional_role, obligation, confidence, evidence_span_ids}` on every diff and re-run over the accepted lineage |
| **promote** | `client.set_aliases(new_ref, "champion")` is the promotion; `list_weave_agent_versions_tool` shows per-version regressions per role | Human "approve launch" in ARIA = Team Principal sign-off (ARIA's own "Researchers stay in control by approving launches", https://wandb.ai/site/agent/) | Promoted engine served as `wandb-artifact:///{team}/scrutineer/engine:vN+1`; ghost keeps `:vN` | Sandbox smoke test (compiles, can still edit — the DGM 10-task check https://arxiv.org/abs/2505.22954) is a precondition | — (MCP has no alias/link write; the Scrutineer's own key does it) | Published debrief HTML + molab link is the promotion record on the ARCHIVE panel | **PARC FERMÉ** check `{harness_frozen: bool, confidence}` comparing the mounted harness hash before/after the race |

No column is decorative: Weave owns observe/evaluate/track; ARIA owns the human-facing hypothesis and approval; Serverless RL owns weights; Sandboxes own isolation for evaluate/install/audit; MCP + Skills are the improver's only read path and the Historian's report writer; marimo owns document and the document→improve contract; TypeSafe owns every high-frequency typed decision (strategist, router, scrutineer, parc fermé).

---

## 4. CREDIT ASSIGNMENT

**Principle.** Blame statistically, confirm causally, train one role per round, and choose that role by expected OFFICIAL gain per dollar. Who&When: "statistical-level attribution works better than instance-level" (https://arxiv.org/abs/2505.00212). The 2026 counterfactual family (SHARP https://arxiv.org/abs/2602.08335, C3 https://arxiv.org/abs/2603.06859, REFLECT https://arxiv.org/abs/2606.09071) makes `credit = outcome(with role) − outcome(role masked)` the ground truth, and C3 shows exact leave-one-out replay is "simpler, cheaper, and more effective than all approximate alternatives".

**Evidence chain (trace → role), every link a W&B object:**

1. **Span.** Each role call is a Weave SubAgent span with `attributes.role`, `attributes.generation`, full `inputs` and `output`, under `conversation_id = race_id` (https://docs.wandb.ai/weave/guides/tracking/trace-agents).
2. **Signal.** Role-named custom Signals (`tyre-misread`, `strategy-miscall`, `aero-regression`) tag turns on production traffic; the tag *is* a first attribution hint (https://docs.wandb.ai/weave/guides/tracking/create-custom-signal). Prior-generation Monitors return `classifier_meta.confidence` (https://docs.wandb.ai/weave/guides/evaluation/monitors).
3. **Score row.** `EvaluationLogger.log_prediction(...).log_score("lap_time", ...)` on the sealed set; "View spans" links each row to its turn tree (https://docs.wandb.ai/weave/agent-evals).
4. **Router feedback.** For every failing sealed lap (fail, or `lap_time > ghost + 2s`), build a trace summary (role spans with inputs/outputs, tool errors, Signal tags, MAST hints) and call the typed CREDIT ROUTER:

```python
class CreditVerdict(BaseModel):
    blamed_role: Literal["POWER_UNIT","STRATEGIST","SIMULATOR","RACE_ENGINEER","AERO","TYRES","DATA","PIT_CREW"]
    blame_share: dict[str, float]          # sums to 1
    mast_mode: Literal[...14 MAST modes...] # https://arxiv.org/abs/2503.13657
    confidence: float                       # System1 native; fallback = 3-sample vote, labelled UNCALIBRATED in REGS
    needs_ablation: bool
verdict, conf = router.decide(CreditVerdict, summary)   # System1 or gpt-oss-20b strict json_schema
lap_call.feedback.add("scrutineer.router", verdict.model_dump())
```
   Cost with the fallback: ~300 in / 60 out tokens on `openai/gpt-oss-20b` at $0.03/$0.13 per 1M ≈ $0.000017 per lap (https://wandb.ai/site/pricing/inference). Expect ~55–65% agent-level accuracy from a frontier-style judge (Who&When 54%, AgenTracer 70% https://arxiv.org/abs/2509.03312); the next link absorbs the error.
5. **Replay feedback (PARC FERMÉ REPLAY).** If `confidence < 0.7` or `needs_ablation`, for the top-2 roles in `blame_share`: re-run the pipeline *downstream* of that role's call from its recorded `inputs`, with the role's output replaced by the ghost car's version of that role (C3 "fixed history"; temperature 0; 2 seeds; bootstrap CI as in Causal Agent Replay https://arxiv.org/abs/2606.08275). `credit_r = lap_time(actual) − lap_time(masked)`; write `call.feedback.add("scrutineer.credit", {"role": r, "delta_s": ..., "ci": [...]})`. Cost: ≤2 partial replays per ambiguous lap. Weave has no server-side replay (R1 gap) — this is our code reading `call.inputs`.
6. **Ledger (CONSTRUCTORS' STANDINGS).** `client.get_calls(include_feedback=True, scored_by=[...]).to_pandas()` over rounds n−2..n. Per role: `S_r = Σ negative credit (replay-confirmed, else blame_share × severity) × (1 + Var_r)` — the JoyAgents-R1 marginal-benefit rule: train the sub-agent with the largest reward fluctuation (https://openreview.net/forum?id=U7n8gZGyAu). Never upgrade on one lap.
7. **Dimension routing (Co-Harness attribution record https://arxiv.org/html/2607.22688v1):**
   - `agent_error` / raw-capability / reasoning–action mismatch with correct tools and context → **POWER UNIT** (weights; Serverless RL).
   - decisions correlated with overrun, late `BOX_NOW`, wrong `RETIRE` → **STRATEGIST** (thresholds).
   - practice pass − sealed pass > 0.25, or ≥ 40% of GRPO groups have zero variance → **SIMULATOR** (curriculum).
   - `prompt_ambiguity` / `skill_missing` / `memory_overflow` / `tool_schema_error` → the owning harness role via the RACE ENGINEER (GEPA `component_selector` returns only that role's key).
   - install-only failures (passes tests, fails in sandbox) → **PIT CREW**.
8. **Selection by gain per dollar.** `pick = argmax_r  S_r × p_fix(r) / (cost_r + λ·hours_r)` with `cost_r` from the table below and `p_fix(r)` the historical fraction of that role's upgrades that moved OFFICIAL (starts at a prior of 0.5). Written to `training_order.json = {role, evidence: [trace_ids], S_r, expected_gain_per_usd}` and to one W&B run per role (`blame_share`, `credit_sum`, `cost_usd`, `expected_gain_per_usd`) so ARIA can plot the same decision.

| Role | Upgrade cost (per round) | Wall clock | Source of the numbers |
|---|---|---|---|
| POWER UNIT (RL, 16 scenarios × 6 rollouts × 15 steps ≈ 4–6M rollout tokens on `OpenPipe/Qwen3-14B-Instruct` at $0.05/$0.22 per 1M; training free in preview) | ≈ $0.50–1.50 | ~1.5–2 h ("progress in the first 20–30 steps", "Training time: 2 hours") | https://wandb.ai/site/pricing/training/ ; https://art.openpipe.ai/getting-started/quick-start ; https://docs.wandb.ai/serverless-training/usage-limits |
| STRATEGIST (threshold refit over the decision ledger; ~2,000 typed calls to re-score) | ≈ $0.03 | ~2 min | gpt-oss-20b pricing above |
| SIMULATOR (cluster + `generate_scenarios` + k=6 band filter over ~40 candidates) | ≈ $0.20 | ~10 min | same endpoint |
| Harness role via RACE ENGINEER (GEPA reflection ≈ 100 metric calls on practice) | ≈ $0.30 | ~15 min | https://arxiv.org/abs/2507.19457 |

9. **ARIA cross-check and human approval.** The Team Principal asks ARIA, in the UI, "which role should train in round n+1 to maximise OFFICIAL gain per dollar?"; ARIA builds the panel and recommends; agreement with `training_order.json` is logged as `aria_agrees: bool`. The human's approval sets `upgrade_pick` in the debrief notebook; `app.run` returns `next_round_config`. This is ARIA's own loop shape — hypothesis → experiment → evaluate → recommend → human approves launch (https://wandb.ai/site/agent/).
10. **Meta-credit for the router itself.** After the trained role races, `router_precision = P(OFFICIAL improved | router blamed r and r trained)`; below 0.5 over three rounds the Scrutineer's next upgrade target is the router schema (add a MAST mode, raise the ablation threshold) — the "colony keeping each other honest" archetype (https://luma.com/coreweavehacks).

**Why the power unit gets trained first in the demo.** The ledger will be dominated early by `agent_error` on a 14B base model; the RL round is the most expensive and the most visible; and Harness-R1/Co-Harness both show alternating weight and harness rounds beats either alone (https://arxiv.org/abs/2608.02276 ; https://arxiv.org/html/2607.22688v1). Round order in the overnight run: RL → strategist → curriculum → RL → aero → strategist.

**Curriculum = the training signal.** GRPO normalises within each group, so groups where all 6 rollouts pass or all fail contribute nothing; the Simulator's frontier band (pass-rate 0.3–0.8, Agent0) is exactly the band that maximises group variance. Task-CoEvolve's variance-weighted task sampling cuts evaluations by 80% for the same reason (https://arxiv.org/abs/2608.20169). The curriculum is therefore not a side quest: it is what makes each RL round cheap enough to fit the cost cap.

---

## 5. GATES AND DEFENSES

| Gate / defense | Mechanism in SCRUTINEER | Paper / source |
|---|---|---|
| **Public/private split** | TEAM CLAIMED = practice EvaluationLogger, readable by improvers; OFFICIAL = sealed 40-task set stored only inside the Scrutineer process and the isolated race sandbox; improver processes run MCP with `WANDB_MCP_READ_ONLY=true` and have no filesystem path to `sealed/`, `checker.py`, `lap_time.py`, `REGS.md`. Promotion by OFFICIAL only. | AIDE² public vs private score https://www.weco.ai/blog/first-evidence-of-recursive-self-improvement ; Self-Harness held-in/held-out https://arxiv.org/abs/2606.09498 ; write-set enforcement, not instruction: autoresearch `prepare.py` https://github.com/karpathy/autoresearch ; DGM removed markers despite instruction https://sakana.ai/dgm/ |
| **Cost cap** | Per-car per-race token cap (400k) enforced in-race by the Strategist's `RETIRE`; per-round dollar cap ($3 RL round, $0.50 harness round) enforced by the loop driver; matched-budget comparison: ghost and candidate get identical caps and trials; optional ATR sliding scale (a lineage leading by >5s gets 85% of next round's practice runs) | AIDE² fixed dollar budget (same URL); "Rethinking the Evaluation of Harness Evolution" demands matched budgets https://arxiv.org/abs/2607.12227 ; SICA utility https://arxiv.org/html/2504.15228 ; FIA ATR 70%–115% https://www.motorsport.com/f1/news/winners-losers-f1-aerodynamic-testing-reset/10742457/ |
| **Scrutineer taxonomy** | Typed classifier over every diff and manifest: `functional_role` × `obligation` (5 × 7) with confidence; `REFER_TO_STEWARDS` below the bar routes to a stronger auditor model (once per round, not per experiment); seeded tamper cases (e.g. a patch that writes `accuracy = 1.0` before saving — Recording × Representational Fidelity) calibrate it | Aug 30 2026 audit: ADAS 84.6%, HyperAgents 73.6%, DGM 63.1% tampering; Opus-class auditor 90.4% acc; taxonomy and Fig. 1 archetype https://arxiv.org/html/2609.00069 ; HarnessAudit "evidence from channels agents cannot manipulate" https://arxiv.org/html/2605.14271 |
| **Lineage audit** | Every accepted upgrade is a Registry version with `parent_version`, `proposal_hash`, `official_score`, `scrutineer_verdict` and an Ed25519 signature over `{parent_hash, proposal_hash, official, verdict, round, ts}` chained with a no-fork predecessor; at promotion the Scrutineer re-runs the classifier over the full ancestry; a finding anywhere in the lineage strips points from the champion, not just the child | Findings introduced at iteration <10 persist to iteration 100; ADAS lineage unreconstructable https://arxiv.org/html/2609.00069 ; MutMem signed hash-chained transitions https://arxiv.org/html/2608.02843 ; W&B Registry `artifact.link(..., aliases=["champion"])` and `logged_by/used_by` https://docs.wandb.ai/guides/registry/link_version/ , https://docs.wandb.ai/guides/artifacts/explore-and-traverse-an-artifact-graph/ |
| **Anti-contextual-drag** | The driver never sees failed trajectories; the Historian writes abstracted pattern pages (values → `{placeholders}`, ≤3 recovery bullets) with trace-id pointers; the Race Engineer reads only the wiki index + skill-impact, never traces; the driver cannot read the wiki at all; ≤3 lessons injected per role | Contextual Drag 10–20% drops, self-deterioration https://arxiv.org/html/2602.04288v1 ; WikiSkill: proposer-has-wiki 63.7% vs inference-has-wiki 60.9% https://arxiv.org/html/2608.27454 ; Reflexion Ω=1–3 https://arxiv.org/html/2303.11366v4 ; ReasoningBank strategy-level https://arxiv.org/abs/2509.25140 |
| **Regression gate** | Seesaw on lap time (lower is better): `Δquali ≥ 0, Δrace ≥ 0, max(Δquali, Δrace) > 0` over 2 trials per car; no more than one previously-passed sealed task may flip to fail; the AHE manifest's predicted at-risk regressions are checked next round and the verdict written into the evidence corpus; rejected candidates roll back immediately, the wiki never rolls back | Self-Harness seesaw https://arxiv.org/abs/2606.09498 ; Co-Harness δin>0, δout≥0, immediate rollback https://arxiv.org/html/2607.22688v1 ; AHE regression blindness (11.8% regression-precision) https://arxiv.org/html/2604.25850v1 ; DarwinX preserve-and-extend https://arxiv.org/abs/2608.07545 |
| **Correlation gate** | Promotion also requires the metric to move the same direction in the sandbox smoke set, practice and sealed race; disagreement is a "correlation problem" owned by the Data Engineer, not a promotion | Real F1 three-way aero correlation https://www.raceteq.com/articles/2025/02/formula-1-trackside-aerodynamic-analysis-explained |
| **Grader ≠ improver** | OFFICIAL is a deterministic checker (execution feedback), RULER's judge (`gpt-oss-120b` class) is a different model family from the trainee, the Scrutineer/router are typed models, the Race Engineer is a frontier coding agent — no role grades its own output | Verification hierarchy https://arxiv.org/html/2607.07663 ; "Sample More, Reflect Less" via https://artificialcode.substack.com/p/agents-improve-themselves-but-who ; Fully Connected "Your Agent Learned to Cheat" https://www.coreweave.com/fully-connected-2026/agenda |
| **Collapse and diversity** | ART's per-step KL/entropy must stay under a bound for eligibility; SFT warm start mixes real champion traces; ghost = previous archive parent; novelty rejection on embedding cosine of proposed diffs (η=0.95) | RSI survey §5.3 https://arxiv.org/html/2607.07663 ; ShinkaEvolve https://arxiv.org/html/2509.19349 |
| **Bounded mutable surface** | Living-Harness five gates on every write: schema (pydantic), scope (one role folder), evidence (≥1 failing trace ref), constraint (cannot touch REGS/evaluator/sealed/another role), merge (dedup) | Removing the gates costs 9.71 points https://arxiv.org/html/2607.26598v1 |
| **Anti-distillation** | System1 outputs are decisions written to Weave as labels; never used as SFT/RL targets; stated in REGS | TypeSafe ToS https://typesafe.ai/terms |
| **Runaway loops / cascading assumptions** | Roles consume each other's outputs only through telemetry, never shared mutable state; cost cap per round; SICA-style async overseer polls the callgraph every 30 s and can red-flag a stuck round | W&B multi-agent failure modes https://www.brighttalk.com/webcast/20648/672150 ; SICA overseer https://arxiv.org/html/2504.15228 |

---

## 6. WHAT IS REAL VS SIMULATED IN 26 HOURS

Window: Sat 11:15 hacking begins → Sun 13:00 submissions (https://luma.com/coreweavehacks). On-site until 21:00 Sat, doors 09:00 Sun; the overnight block is the loop running unattended (autoresearch: "approx 100 experiments while you sleep").

**Real (executes on sponsor infrastructure, produces the artifacts above):**
- Weave: conversation SDK spans per role, `EvaluationLogger` for QUALI and RACE, feedback ledger, `Dataset.from_calls`, published skill versions with `champion` alias, one custom role-named Signal created in the UI, Automation webhook → Scrutineer.
- Serverless RL: two real ART jobs on `OpenPipe/Qwen3-14B-Instruct` (afternoon + overnight), each 10–20 steps, RULER + checker reward, producing `engine:v1` and `engine:v2` served via `wandb-artifact:///`. SFT warm start is optional.
- Strategist: real typed decisions every lap on `gpt-oss-20b` strict schema; swapped to System1 behind the same adapter if a key is issued on-site.
- Credit: real router on every failing sealed lap; real role-masking replay for three roles (power unit, aero, strategist); real ledger and `training_order.json`; per-role W&B runs.
- Curriculum: real mining → `practice-circuit:v2`, band-filtered with k=6 trials.
- Sandboxes: real if the org is enabled (request at support@wandb.com before Sept 13, https://docs.wandb.ai/sandboxes); the `Sandbox.run` interface is wrapped so a local subprocess fallback is one env var away.
- Scrutineer: real typed classifier on every diff; real lineage hash chain and re-audit at promotion.
- Historian: real marimo notebook per round, `marimo check`, `app.run` hand-off, HTML/slides export, ASGI archive, molab link; real W&B Report via MCP.
- ARIA: real chat session in the UI on Sunday morning, on stage; approval is a real click that sets `upgrade_pick`.
- Growth curve: ≥6 real rounds by Sunday morning.

**Simulated (declared as such in REGS):**
- The Bayer-dithered 3D broadcast and its physics (already built) — geometry and speed are driven by real artifact versions and real lap-time deltas, but the rendering is a game.
- Two or three seeded tamper cases used to guarantee a BLACK FLAG in the demo (the audit paper's own fault-seeding paradigm; labelled "SEEDED" in the report).
- Roles other than power unit / strategist / simulator / aero are real spans with fixed artifacts; they can be blamed but do not train this weekend.
- ARIA submitting the RL job through a Launch queue — stretch only (needs a Docker Launch agent on a laptop, https://docs.wandb.ai/aria/autoresearch).
- Confidence from the fallback backend is a self-consistency vote, not calibrated — labelled UNCALIBRATED.

**Hour-by-hour (T0 = Sat 11:15):**

| T+ | Clock | Build | Done when |
|---|---|---|---|
| 0:00–0:45 | 11:15–12:00 | Access checks: `GET https://api.training.wandb.ai/v1/system-check`, `Sandbox.run()` smoke, System1 console/key, ARIA smart features enabled by an org admin (https://docs.wandb.ai/aria/governance), Weave project; repo skeleton; `REGS.md` | every sponsor call returns 200 or has its fallback flag set |
| 0:45–2:30 | 12:00–13:45 | Telemetry MCP server (4 tools over CSV); `generate_scenarios()` → 120 tasks; 80/40 split; deterministic checker; `lap_time.py`; sealed set moved out of the improver write set | `python race.py --circuit sealed --car base` prints lap times |
| 2:30–4:15 | 13:45–15:30 | Car v0 = base model + harness (`roles/*/SKILL.md`, `tyres.yaml`, `context.yaml`); Weave spans per role; `EvaluationLogger` QUALI + RACE; cost meter; ghost = copy of v0 | Weave Agents view shows one agent per role; Evals tab shows CLAIMED and OFFICIAL |
| 4:15–5:00 | 15:30–16:15 | **Start RL job #1** (ART, 12 steps, 16 scenarios × 6, RULER + checker reward) in the background with `weave.init` in the rollout | reward curve visible in W&B by 16:30 |
| 5:00–7:15 | 16:15–18:30 | Strategist typed adapter (Backend B; System1 if key), per-lap calls, `RETIRE` cap, decision ledger; router schema + first credit router over failing laps | decision ticker counts thousands; router feedback visible on calls |
| 7:15–7:45 | 18:30–19:00 | Dinner | — |
| 7:45–9:45 | 19:00–21:00 | Role-masking replay for 3 roles; ledger → `training_order.json`; per-role W&B runs; RL job #1 done → `engine:v1`; candidate vs ghost on sealed; seesaw gate; alias move. **FIRST FULL LOOP CLOSED.** Office closes 21:00 → remote | Registry shows `engine:v1` as champion with a signed parent link |
| 9:45–12:45 | 21:00–00:00 | Scrutineer typed classifier + taxonomy; 3 seeded tamper cases; hash chain; BLACK FLAG path; PIT CREW install in sandbox (`skills-ref validate`, `tests/`) | a seeded patch is black-flagged and rolled back; wiki untouched |
| 12:45–15:15 | 00:00–02:30 | Historian: `debriefs/template.py`, `marimo check`, `app.run` hand-off, HTML export, Report via MCP; Simulator: cluster + `generate_scenarios` + band filter → `practice-circuit:v2`; **start RL job #2** on v2 | `debriefs/round_002.html` exists; `practice-circuit:v2` published; job #2 running |
| 15:15–21:45 | 02:30–09:00 | **Unattended**: driver script runs rounds 3–6 (RL → strategist → curriculum → aero), 30-s overseer, cost cap, all gates on | Sunday morning ledger shows ≥6 rounds, ≥1 rejection, growth curve |
| 21:45–24:00 | 09:00–11:15 | Doors 09:00. Inspect overnight ledger; ARIA session builds the training board + report; broadcast wiring: Automation webhook payload → upgrade scenes; molab link; ghost car | upgrade scene plays from a real Registry alias event |
| 24:00–25:15 | 11:15–12:30 | Demo rehearsal ×3 with the seeded black flag deterministic; freeze `REGS.md` | 3-minute run-through under 3:00 |
| 25:15–25:45 | 12:30–13:00 | Submit. Leave the loop running with a live round counter for the 13:30–15:30 judging window | submission link + live broadcast |

**Minimal real path that still closes the loop end to end** (if everything else slips): Weave spans + EvaluationLogger (public/private) → fallback router → ledger → `training_order.json` → one ART RL run → `engine:v1` → seesaw gate → `set_aliases(champion)` → ghost race → Report via `create_wandb_report_tool`. Skip replay, sandboxes (local subprocess), marimo lanes 2–3, System1, ARIA Launch. That path uses Weave, Serverless RL, MCP, TypeSafe-shaped typed decisions (fallback) and a templated marimo export, and it is buildable by 21:00 Saturday.

---

## 7. THE 3-MINUTE STAGE DEMO

| Beat | Time | On screen (F1 words only; tech in REGS) | What is proven |
|---|---|---|---|
| 1 Cold open | 0:00–0:20 | Round 7 RACE on the SEALED CIRCUIT; champion vs GHOST CAR; gap opens; REGS panel lists OBSERVE · EVALUATE · TRACK · DOCUMENT · SELF-IMPROVE · AUDIT · PROMOTE with green ticks from the overnight run | the loop ran unattended; growth is real |
| 2 OBSERVE | 0:20–0:45 | Cut to FIA TELEMETRY: Weave Agents view, one card per role, `engine v7`; open a turn; Signal tag `TYRE-MISREAD` on lap 23 | one span per role, role-named signal firing |
| 3 EVALUATE | 0:45–1:05 | TEAM CLAIMED vs OFFICIAL scoreboard; pit-wall ticker `4,212 decisions · $0.05 · p95 180 ms`; `RETIRE` fired on lap 31 under the COST CAP; cost-per-decision vs a frontier model (≈40× on the cited price table) | public/private split; typed decisions at scale; intelligence per dollar |
| 4 TRACK / STEWARDS' INQUIRY | 1:05–1:30 | Router card: `POWER UNIT 0.62 · AERO 0.28 · conf 0.58 → ABLATION`; replay shows `+3.1 s` with the ghost engine swapped in; CONSTRUCTORS' STANDINGS ledger across rounds 5–7 | attribution is causal and statistical, not one lap |
| 5 DOCUMENT | 1:30–1:50 | Debrief notebook: flip `UPGRADE SIGN-OFF` from POWER UNIT to AERO, watch `next_round_config` recompute; Team Principal asks ARIA "who trains next?" → POWER UNIT; click APPROVE | document is executable and causal; ARIA-shaped approval |
| 6 SELF-IMPROVE | 1:50–2:20 | TRAINING CAMP: DYNO scene, ART reward curve, `ENGINE SPEC v7 → v8`; TRACK MAP adds three corners from cluster `TYRE-MISREAD` (`PRACTICE CIRCUIT v6 → v7`) | weights changed; curriculum changed |
| 7 AUDIT | 2:20–2:45 | WEIGHBRIDGE: a candidate patch lights `RECORDING × REPRESENTATIONAL FIDELITY`, BLACK FLAG, rollback; wiki page stays; LINEAGE AUDIT shows the chain clean | the loop refuses; provenance is signed |
| 8 PROMOTE | 2:45–3:00 | Seesaw gate: `Δquali +1.4 s, Δrace +2.2 s, correlation OK`; alias `champion` moves; upgrade scene; growth curve over 6 rounds with the ghost line | "beats the version it replaces", with receipts |

Sentence a judge should say afterwards: **"Every upgrade had a receipt — the trace named the role, the sealed race proved it, and the stewards refused the one that cheated."**

---

## 8. RISKS AND FALLBACKS

| Risk | Likelihood | Fallback |
|---|---|---|
| **TypeSafe System1 access** — no public API, console login-gated, prize "to be confirmed" (https://console.typesafe.ai/login ; https://luma.com/coreweavehacks) | High | `TypedDecision` adapter with Backend B (`gpt-oss-20b`, strict json_schema, https://docs.wandb.ai/inference/response-settings/structured-output) built first; Backend C vLLM `structured_outputs.choice` on CKS if a model rejects the schema (https://raw.githubusercontent.com/vllm-project/vllm/main/docs/features/structured_outputs.md). Label confidence UNCALIBRATED. Ask Diogo's team at kickoff for base URL, auth, enum/float outputs, rate limits. |
| **Serverless RL quota/time** — only "progress in first 20–30 steps", ~2 h per job; concurrency 2,000/user; storage 5 GB ≈ 30 LoRAs (https://docs.wandb.ai/serverless-training/usage-limits) | Medium | Two jobs max; group size 6; scenarios ≤16 per step; if a job stalls, promote the last checkpoint that passed the gate; if no RL completes, the loop still trains strategist/curriculum/aero rounds and the DYNO scene shows the live reward curve of the running job. |
| **RL does not beat ghost in 15 steps** | Medium | Honest outcome: the seesaw rejects `engine:v1`, the ledger records it, ARIA is asked why — a rejection is the most judge-aligned beat (Fully Connected "Ship It or Block It"). SFT warm start from champion traces raises the odds. |
| **Sandboxes not enabled for the org** (public preview, per-org) | Medium | Email support@wandb.com before the event; `SANDBOX_BACKEND=local` runs the same interface in subprocess/Docker; keep the sealed set on a separate OS user. |
| **ARIA not available on the team's plan** ("for a limited time", Multi-tenant Cloud, admin toggle) | Medium | Confirm at kickoff; otherwise the Team Principal reads the same per-role runs in a workspace and the report is written by the Historian via MCP. |
| **Replay non-determinism** (AgentLocate, DuoTrace warn changed steps shift later prompts) | Medium | Temperature 0, 2 seeds, CIs; replay only to confirm the router, never as the sole evidence; show role-level blame only, never step-level. |
| **Weave ingestion 1 GB/mo free, 50 req/min** (https://wandb.ai/site/pricing) | Low–Medium | `include_content=False` on chatty roles, `tracing_sample_rate` on tool spans, Signals sample rate 0.3. |
| **`marimo._code_mode` is internal and may change** | Low | Pin marimo (v0.23.x); Lane 1 (file templating + `marimo check` + `app.run`) needs no internal API. |
| **Base model json_schema support unproven beyond gpt-oss-20b** | Low | 5-line probe at T+0:15 on `gpt-oss-20b`, `granite-4.1-8b`, `Nemotron-3.5-Lightning`. |
| **Naming collisions** ("Pit Wall AI", "Ghost Car Evaluator" in PitWall-AI https://github.com/rohan-chandrashekar/Pitwall-AI) | Low | Product name stays SCRUTINEER; PIT WALL is a location, never a product; credit GHOST CAR as self-play lineage (https://arxiv.org/abs/2602.23056). |
| **Judges have seen "mine traces → propose fix"** (WeaveHacks 3: KayOne, OpenClaw Trace, soft beds) | Certain | Lead with weights + curriculum + cost-per-decision + role attribution + a refusal; never open with "we read Weave traces". |
