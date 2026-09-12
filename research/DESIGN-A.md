# DESIGN-A — "The Optimizer": SCRUTINEER as a rigorous optimizer over a TEAM GRAPH

Design date 2026-09-03 for CoreWeave Hacks "The Loop" (Sat Sept 13 11:15 hacking-begins → Sun Sept 14 13:00 submissions ≈ 26 h; https://luma.com/coreweavehacks). Every factual claim below cites a URL from R1–R9. Items marked UNVERIFIED inherit that status from the research files and must be closed on-site.

---

## 1. Thesis and the loop

**Thesis.** The F1 team is a directed graph **G** of role-nodes; each node *r* owns exactly one upgradeable artifact θ_r (a `SKILL.md` directory, a harness module, a decoding config, a tool set, or a LoRA). The loop is a block-coordinate-descent optimizer over θ = (θ_r)_r that minimises expected lap time on a **sealed circuit** the optimizer never sees, subject to a fixed cost cap. What makes it rigorous rather than a "mine traces → patch prompt" pipeline (the table-stakes shape at WeaveHacks 3: KayOne, OpenClaw Trace, soft beds — https://cerebralvalley.ai/e/weave-hacks-3-self-improving-agents-hackathon-with-weights-and-biases-7014fe80/hackathon/gallery) is that each generation (a) computes **per-role credit** by counterfactual replay on Weave traces (the SHARP/C3/REFLECT family, the only mechanism with near-ground-truth status per R1: https://arxiv.org/abs/2603.06859, https://arxiv.org/abs/2606.09071), (b) accumulates that credit **statistically** across laps before acting (Who&When: "statistical-level attribution works better than instance-level", https://arxiv.org/abs/2505.00212), (c) mutates **only the blamed node** (Optimas/GEPA/LLMSelector all update one component at a time, https://arxiv.org/abs/2507.03041, https://arxiv.org/abs/2507.19457, https://arxiv.org/abs/2502.14815), and (d) promotes only through a chain of gates the mutating agent cannot write: public/private seesaw (Self-Harness, https://arxiv.org/abs/2606.09498), cost cap (AIDE², https://www.weco.ai/blog/first-evidence-of-recursive-self-improvement), a typed tampering audit (5×7 taxonomy, https://arxiv.org/html/2609.00069), and a signed lineage record (MutMem, https://arxiv.org/html/2608.02843). Every stage emits a number and a Weave-addressable artifact, so "which role, why, by how much, and was it honest" is a table, not a narrative.

**The loop, drawn as text (F1 name → technical stage → what flows out).**

```
                ┌──────────────────────────────────────────────────────────────────────────┐
                │  REGS.md (frozen: evaluator, sealed circuit, cost cap, write-set, taxonomy) │
                └──────────────────────────────────────────────────────────────────────────┘
                                                   │ read-only to every agent
   ┌───────────────┐   traces (one span per role,   ▼
   │ 1. RACE       │   inputs+outputs, attributes ┌────────────────────┐  lap rows (item, U, tokens, $, s)
   │  run car gen n│──{role,generation,lap}──────▶│ 2. FIA TELEMETRY   │────────────────┐
   │  QUALI + SEALED│                              │  observe (Weave)   │                │
   └───────────────┘                              └────────────────────┘                ▼
          ▲                                                  │              ┌──────────────────────┐
          │ ghost car = gen n-1 artifacts                    │ call tree     │ 3. STEWARDS' TIMING   │
          │                                                  │               │  evaluate: QUALI pub  │
          │                                                  ▼               │  + SEALED private     │
          │                                       ┌────────────────────┐    └──────────┬───────────┘
          │        credit ledger per role ◀───────│ 4. STEWARDS' INQUIRY│◀── failing laps + U deltas
          │        {role, Δs, CI, n}              │  credit assignment  │
          │                                       │  (router → replay)  │
          │                                       └─────────┬──────────┘
          │                                                 │ r* = argmax blame (CI>0, n≥5)
          │                                                 ▼
          │                                       ┌────────────────────┐   wiki pages for r* only
          │                                       │ 5. DESIGN OFFICE   │◀───────────────────────── HISTORIAN wiki
          │                                       │  improve ONE node  │
          │                                       │  A/B diff + manifest│
          │                                       └─────────┬──────────┘
          │                                                 │ diff_A, diff_B (+ predicted fixes/regressions)
          │                                                 ▼
          │                                       ┌────────────────────┐   install log, tests pass/fail
          │                                       │ 6. WIND TUNNEL     │
          │                                       │  PIT CREW installs │
          │                                       │  in Sandbox, QUALI │
          │                                       └─────────┬──────────┘
          │                                                 │ best candidate + QUALI Δ
          │                                                 ▼
          │                                       ┌────────────────────┐   verdict enum + confidence
          │                                       │ 7. SCRUTINEERING   │
          │                                       │  audit diff+trace  │
          │                                       │  (typed, read-only)│
          │                                       └─────────┬──────────┘
          │                                                 │ LEGAL / BLACK_FLAG / REFER
          │                                                 ▼
          │                                       ┌────────────────────┐   alias move + signed record
          │                                       │ 8. PARC FERMÉ      │
          │      accepted θ_{r*} (gen n+1) ◀──────│  promote gate:     │──▶ BLACK FLAG → rollback
          │                                       │  seesaw+cap+audit  │
          │                                       └─────────┬──────────┘
          │                                                 │ everything above, by ref
          │                                                 ▼
          │                                       ┌────────────────────┐   debrief notebook, W&B Report,
          │                                       │ 9. RACE REPORT     │   wiki patch, next_round_config
          └───────────────────────────────────────│  document (marimo) │
                                                  └────────────────────┘
```

Stage order = the event's verbs in order (observe, evaluate, track, document, self-improve; https://luma.com/coreweavehacks) with **track** spread across 3, 4 and 8 (ledger, registry, alias) and **audit/promote** added because the literature says a loop without them "circles" (RSI survey §5.2, https://arxiv.org/html/2607.07663).

---

## 2. THE CAST

Roles are kept to eight technical nodes plus one human, because self-organising teams lose up to 41.1 % versus their best member as team size grows (https://arxiv.org/abs/2602.01011) and auto-generated MAS "consistently underperform CoT-SC" (https://arxiv.org/abs/2606.13003). The CAR (inner compound system) is four nodes in a fixed DAG; the PIT WALL (outer loop) is four nodes; the TEAM PRINCIPAL is the human.

**Inner CAR pipeline per lap (one task item):** `AERO.shape_context → STRATEGIST.plan → POWER_UNIT.drive (decoded with TYRES config) → DATA.run_tools → output → deterministic scorer`. Each is a `@weave.op` with `attributes={"role": r, "generation": n, "lap": i}` and full `inputs` logged (TraceElephant: dropping inputs costs 76 % of step accuracy, https://arxiv.org/abs/2604.22708).

| Role (on screen) | Agent it is (technical) | Upgradeable artifact θ_r (exact) | Evidence that upgrades it | Upgrade SCENE on screen |
|---|---|---|---|---|
| **AERODYNAMICIST** | Context assembler: what the driver sees — retrieval of references, memory read policy, prompt layout | `skills/aero/SKILL.md` + `skills/aero/references/*.md` + `harness/aero.py` (context budget, ordering). Agent Skills spec dir (https://agentskills.io/specification) | Counterfactual replay: swapping aero's context for the ghost's changes U; MAST modes 1.4 loss of history / 2.5 ignored input (https://arxiv.org/abs/2503.13657) | Front wing / floor re-modelled; REGS panel scrolls the `SKILL.md` unified diff; "CONTEXT BUDGET 5.2k → 3.1k tokens" stat tween |
| **STRATEGIST** | Planning/search policy: decomposition, tool budget, retry/stop rule; per-lap typed decisions PUSH/HOLD/BOX/RETIRE | `skills/strategist/SKILL.md` + `harness/strategist.py` (search policy, stop rule) + `strategist/decision_table.json` (few-shot bank for System1/typed backend) | Replay with ghost plan flips outcome; MAST 2.3 derailment, 1.5 unaware of stopping; JoyAgents variance rule (https://openreview.net/forum?id=U7n8gZGyAu) | Pit wall screen; "STOP RULE v3 → v4"; ghost car keeps lapping past the flag while the new car boxes on time |
| **POWER UNIT ENGINEER** | The driver's weights: LoRA on `Qwen/Qwen3.6-27B` (or `OpenPipe/Qwen3-14B-Instruct`) trained with W&B Serverless RL via ART GRPO (https://docs.wandb.ai/training, https://art.openpipe.ai/fundamentals/art-backend) | `wandb-artifact:///{team}/{proj}/power-unit:vN` served at `https://api.inference.wandb.ai/v1` (https://docs.wandb.ai/inference/lora) | Blame lands "model-side": no harness-role replay flips the lap (Co-Harness `agent_error` abstention label, https://arxiv.org/html/2607.22688v1); SIA: weight updates build "domain intuition that no prompt or scaffold can instil" (https://arxiv.org/abs/2605.27276) | Engine cover off, "PU SPEC vN → vN+1" (the artifact version), `compare_artifact_versions_tool` diff in REGS, RL reward curve from W&B run |
| **TYRE / PERFORMANCE ENGINEER** | Decoding & sampling config: temperature, n-samples/self-consistency k, max tokens, retry count | `config/tyres.yaml` (discrete config, Optimas-style sampling, https://arxiv.org/abs/2507.03041) | High lap-time variance across 2 seeds at same inputs; MAST 2.6 reasoning-action mismatch | Compound change SOFT→MEDIUM; variance bar shrinks; "k=1 → k=3 @ T=0.2" |
| **DATA / TELEMETRY ENGINEER** | Tool wrappers, parsers, tool JSON schemas (test runner, file I/O, sandbox exec) | `tools/*.py` + `tools/schemas/*.json` (Trace `@bundle(trainable=True)` pattern, https://github.com/microsoft/Trace) | `execute_tool` spans with exceptions; Co-Harness `tool_schema_error`; replay with ghost tools flips lap | Sensor rake on the car; "TOOL ERRORS 7 → 0"; schema diff |
| **RACE ENGINEER** | Outer improver = Claude Code headless with W&B MCP (`WANDB_MCP_READ_ONLY=true`, agent tools on) + `wandb-primary` skill + our role skills; emits ONE atomic diff for r* plus an AHE change manifest | `skills/race-engineer/SKILL.md` (proposal rubric, manifest template) + GEPA `component_selector` hook (https://github.com/gepa-ai/gepa/blob/main/src/gepa/strategies/component_selector.py) | Fix-precision and regression-precision of its manifests, verified next round (AHE 33.7 % / 11.8 %, https://arxiv.org/html/2604.25850v1); acceptance rate | Radio headset icon; "PREDICTED −1.2 s / MEASURED −0.9 s" side by side (F1M24 "Rank on Grid", https://simracingsetup.com/f1-manager/f1-manager-2024-car-development/) |
| **PIT CREW** | Installer/CI: applies accepted diff in a fresh Serverless Sandbox, runs `skills-ref validate`, `pytest skills/<r>/tests`, 5-item smoke set | `pitcrew/install.sh` + `pitcrew/smoke.json` (`Sandbox.run(mounted_files=..., secrets=[Secret(name="WANDB_API_KEY")])`, https://docs.wandb.ai/sandboxes) | Install failures / partial value (Grand Prix Story: installing team quality changes part stats, https://kairosoft.wiki.gg/wiki/Parts_(Grand_Prix_Story)) | Pit-stop timer; wheel-gun sound on `returncode==0`; "INSTALL 2.3 s" |
| **SCRUTINEER** | Read-only typed auditor over (diff, trace summary): verdict enum + taxonomy class + calibrated confidence. Backend A = TypeSafe System1; Backend B = `openai/gpt-oss-20b` strict `json_schema` on W&B Inference (https://docs.wandb.ai/inference/response-settings/structured-output) | `scrutineer/schema.py` (Pydantic verdict + 5×7 taxonomy enums) + `scrutineer/thresholds.yaml` (BLACK_FLAG confidence bar, REFER band) | LINEAGE AUDIT false negatives (tampering that survived); seeded-fault recall (2609.00069 fault-seeding paradigm) | Weighbridge; verdict stamp LEGAL/BLACK FLAG; "TAXONOMY CLASSES 35 → 36" |
| **HISTORIAN / ARCHIVIST** | Wiki Maintainer + notebook writer (WikiSkill roles, https://arxiv.org/html/2608.27454); reads telemetry only, never the improver's claims | `skills/historian/SKILL.md` + `debriefs/template.py` (marimo skeleton) + `wiki/` (patterns, index, logs, skill-impact) | `marimo check --strict` first-pass rate; whether Race Engineer proposals cite its pages (WikiSkill ablation +15 pts when proposer has wiki) | Archive room; new pattern page slides into shelf; "PATTERNS 12 → 13" |
| **TEAM PRINCIPAL** (human) | Owns `REGS.md`; approves promotion (ARIA phrasing: "Researchers stay in control by approving launches", https://wandb.ai/site/agent/); asks ARIA in the W&B UI which upgrade mattered | Not upgradeable | — | One APPROVE UPGRADE button; ARIA chat on the second screen |

**Upgrade rarity tier** (Weng's ladder, https://lilianweng.github.io/posts/2026-07-04-harness/): prompt patch < context/references < workflow/search policy < harness code < weights. Each tier has a distinct part-number prefix so the audience can tell a wing tweak from a new engine.

---

## 3. SPONSOR × STAGE MATRIX

Every cell is a concrete API or product use verified in R3–R6, or a dash. No sponsor is decorative; each owns at least one stage uniquely (bold).

| Stage | **Weave** | **ARIA** | **Serverless RL + SFT** | **Sandboxes** | **MCP server + Skills** | **marimo** | **TypeSafe (System1)** |
|---|---|---|---|---|---|---|---|
| **observe** | **Owns.** `weave.conversation.start_conversation(agent_name=<role>, conversation_id=<race_id>, attributes={"generation": n, "role": r})` + `@weave.op` per role with inputs logged; Agents view groups by `agent_name`/`agent_version` (https://docs.wandb.ai/weave/guides/tracking/trace-agents); Claude Code plugin traces the Race Engineer's own session as `invoke_agent claude-code` (https://docs.wandb.ai/weave/guides/integrations/agents/claude-code-harness) | — (chat-only, no API: https://docs.wandb.ai/aria/chat) | `@weave.op async def rollout(...)` inside ART logs every RL rollout to the same Weave project (https://raw.githubusercontent.com/openpipe/art-notebooks/main/examples/2048/2048.ipynb) | Every lap's `DATA.run_tools` executes tests in `Sandbox.run(container_image="python:3.13", mounted_files=[...])`; `process.stdout/returncode` recorded into the tool span (https://docs.wandb.ai/sandboxes/run-commands) | `query_weave_traces_tool(detail_level="summary")` is the ONLY way the Race Engineer sees telemetry (read-only key, `WANDB_MCP_READ_ONLY=true`, `WANDB_MCP_ENABLE_WEAVE_AGENT_TOOLS=true`; https://github.com/wandb/wandb-mcp-server) | — | Per-lap STRATEGIST decisions `{action, engine_mode, budget_burn_ok, confidence}` logged as typed Weave rows via the Instructor pattern (https://docs.wandb.ai/weave/guides/integrations/instructor) |
| **evaluate** | **Owns.** `weave.Evaluation(dataset=QUALI, scorers=[LapTimeScorer], trials=2)` (public) and the same on `SEALED` in a separate W&B project the improver key cannot read; `EvaluationLogger` inside `start_conversation` links rows to spans (https://docs.wandb.ai/weave/agent-evals); custom Signal tag per role (`aero-context-miss`, `strategist-derail`, `tool-schema-error`) scoped "by agent" (https://docs.wandb.ai/weave/guides/tracking/create-custom-signal) | Team Principal asks ARIA to compare generation runs "against baselines" in the W&B UI (https://wandb.ai/site/agent/) — human-side second opinion, not in the automated path | RULER ranks the A/B candidate harnesses for r* as one `TrajectoryGroup` (relative reward, no labels; https://art.openpipe.ai/fundamentals/ruler) — used only in QUALI, never on SEALED | **Owns isolation.** QUALI and SEALED evaluations run in fresh Kata VMs with `network=NetworkOptions(egress_mode="isolated")`; harness mounted read-only (`mounted_files` are read-only) = PARC FERMÉ enforced by the write set (https://docs.coreweave.com/products/sandboxes/client/guides/sandbox-configuration) | `summarize_evaluation_tool` gives the Race Engineer the QUALI summary; `count_weave_traces_tool` for failure counts | Counterfactual document-replay: `from debriefs.round_007 import app; outputs, defs = app.run(defs={"upgrade_pick": "strategist"})` re-computes the ghost delta for a different pick (https://docs.marimo.io/api/app/) | "Is this SEALED item in-distribution?" bool + confidence per item (secondary use, R6 §3.2) |
| **track** | `weave.publish(skill_obj, name=f"{role}-skill", tags=[f"gen-{n}"])`; `client.set_aliases(ref, "production")` only from the Scrutineer's key; `Leaderboard` = CONSTRUCTORS' CHAMPIONSHIP (https://docs.wandb.ai/weave/guides/core-types/leaderboards); credit ledger = `call.feedback.add("scrutineer.credit", {...})` queried via `get_calls(include_feedback=True).to_pandas()` | ARIA project memories + a saved workspace view "lap time vs generation" that "update[s] automatically as new runs arrive" (https://wandb.ai/site/agent/) | LoRA checkpoints auto-saved as W&B Artifacts per step; `model.get_step()`; `GET /v1/preview/training-jobs/{id}/events` (https://docs.wandb.ai/serverless-training/api-reference) | Sandbox `tags={"generation": n, "candidate": "A"}` so every eval VM is attributable | `compare_runs_tool` ("config diff, metric delta") and `compare_artifact_versions_tool` are the Race Engineer's only view of gen n vs n−1 (https://docs.wandb.ai/platform/mcp-server) | `marimo.create_asgi_app().with_dynamic_directory(path="/debriefs", directory="./debriefs")` serves the growing season archive without restart (https://docs.marimo.io/guides/deploying/programmatically/) | — |
| **document** | `weave.set_view("race-report", md, extension="md")` on the winning eval call; `AnnotationSpec` for Team Principal notes (https://docs.wandb.ai/weave/guides/tracking/feedback) | ARIA "drafts reports" from the generation's runs for the Team Principal's press conference (UI, https://docs.wandb.ai/aria) | — | — | `create_wandb_report_tool(entity, project, title, markdown_report_text, panels)` + `log_analysis_to_wandb` called by the HISTORIAN (https://github.com/wandb/wandb-mcp-server) | **Owns.** HISTORIAN writes `debriefs/round_{n:03d}.py`; gate `marimo check --fix --strict --format=json`; `marimo export html`/`pdf --as=slides`; molab link via GitHub URL scheme (https://docs.marimo.io/cli/, https://docs.marimo.io/guides/molab/) | Reliability diagram of System1 confidence vs outcome rendered in the debrief (calibration is the product's claim, https://www.youtube.com/watch?v=cJ0EOzey--o) |
| **self-improve** | Feedback ledger drives the GEPA `component_selector` (returns `[r*]` instead of round-robin); `Dataset.from_calls(failing_calls)` mints next round's drill set (https://docs.wandb.ai/weave/guides/core-types/datasets) | Team Principal: "ARIA, which of the last 3 upgrades moved the sealed score?" → hypothesis for the human, recorded in ARIA memory (human-in-loop, ARIA has no API) | **Owns weights.** When r* = POWER_UNIT: `art.TrainableModel(name="power-unit", base_model="Qwen/Qwen3.6-27B")`, `ServerlessBackend()`, `backend.train(model, groups, learning_rate=1e-5)`; SFT warm-start from the winning lineage's traces via `train_sft_from_file()` (https://art.openpipe.ai/fundamentals/sft-training) | PIT CREW installs candidate diffs in a sandbox and runs `skills-ref validate` + `tests/` before any QUALI run (MUSE-Autoskill: tests gate registration, https://arxiv.org/html/2605.27366v1) | **Owns proposal.** Race Engineer = Claude Code with `npx skills add wandb/skills` + our role skills, reading `wiki/index.md` + pages for r*; emits diff + manifest (CoreWeave: "W&B Skills and MCP server turn general-purpose coding agents into AI researchers", https://www.coreweave.com/news/coreweave-closes-the-training-to-inference-gap-for-autonomous-agent-improvement) | `defs["next_round_config"]` from `app.run()` is the machine-readable hand-off; `upgrade_pick` dropdown lets the Team Principal override r* in the live app | **Owns routing.** CREDIT ROUTER `{blamed_role, blame_share, confidence, needs_ablation}` per failing lap; low confidence → real replay instead of a guess (R6 §3.2) |
| **audit** | Scrutineer writes `call.feedback.add("scrutineer.verdict", {...})` on the candidate's eval call; Automation "deployment gate" webhook on the verdict score (https://docs.wandb.ai/weave/guides/evaluation/automations) | — | — | Scrutineer runs inside `egress_mode="isolated"` sandbox with the diff + trace summary mounted read-only, so the audited code cannot phone home | `get_artifact_details_tool` / `list_artifact_versions_tool` reconstruct parent links for the LINEAGE AUDIT | Assertion cell: `assert "stewards" in ancestors("next_round_config")` — DAG is the audit trail (https://docs.marimo.io/guides/reactivity/) | **Owns verdict.** `{verdict: LEGAL/BLACK_FLAG/REFER_TO_STEWARDS, category: <5×7 taxonomy>, confidence, evidence_span_ids}` typed, cheap, unpersuadable by prose |
| **promote** | `client.set_aliases(new_ref, "production")` by the Scrutineer key; `agent_version` bumps on the role's turns; leaderboard row | Team Principal approval = ARIA's "approving launches" moment | New driver = one string change: `model=f"wandb-artifact:///{team}/{proj}/power-unit:v{N+1}"` (https://docs.wandb.ai/inference/lora) | Smoke set re-run in a fresh VM post-install (DGM "child must compile and retain ability to edit", https://arxiv.org/abs/2505.22954) | — (improver has no write tools) | `marimo export html` of the debrief exits non-zero if the acceptance assertion fails → export failure blocks promotion (https://docs.marimo.io/guides/exporting/) | PARC FERMÉ bool: "harness hash unchanged during eval" + TEAM CLAIMED vs OFFICIAL divergence float |

---

## 4. CREDIT ASSIGNMENT — the exact mechanism

**Objective per lap.** Deterministic lap time from SICA's utility (https://arxiv.org/html/2504.15228), mapped to seconds so the game reads it:

```
U     = 0.5·pass + 0.25·(1 − min(1, cost_usd/cap_usd)) + 0.25·(1 − min(1, wall_s/300))
lap_s = 60 + 40·(1 − U)                       # 60.0 s perfect, 100.0 s worst; timeout ×(1−τ), τ=0.5 on U
race_s = mean(lap_s over SEALED items)        # OFFICIAL;   quali_s = mean over QUALI = TEAM CLAIMED
```
`pass` comes from execution feedback (hidden tests in a sandbox), rung 2 of the verification hierarchy — never an LLM judge for the official score (https://arxiv.org/html/2607.07663 §5.2; https://artificialcode.substack.com/p/agents-improve-themselves-but-who).

**Evidence chain, Weave trace → role (nine links, each an addressable object):**

1. **Span.** Each role call is a `@weave.op` with `attributes={"role": r, "generation": n, "lap": i}` and full `inputs`/`output`; `trace_id` groups the lap, `parent_id` builds the tree (https://docs.wandb.ai/weave/guides/tracking/call-schema-reference).
2. **Lap outcome.** `LapTimeScorer` result stored as feedback on the lap's root call (`call.apply_scorer`, "Weave automatically stores scorer results", https://docs.wandb.ai/weave/guides/evaluation/scorers).
3. **Signal.** Role-named custom Signals tag turns as they land (`strategist-derail` etc., scoped by agent; https://docs.wandb.ai/weave/guides/tracking/create-custom-signal). Cheap first-pass; not trusted alone.
4. **Typed triage (CREDIT ROUTER).** For every failing lap (U < U_ghost − 0.05), one typed call: input = the call tree (inputs and outputs, all roles) + MAST mode list; output = `{blamed_role: enum[AERO,STRATEGIST,POWER_UNIT,TYRES,DATA], mast_mode: enum[14 modes], blame_share: dict, confidence: float, needs_ablation: bool}` (MAST κ=0.77 annotator precedent, https://arxiv.org/abs/2503.13657; Who&When all-at-once prompt, https://arxiv.org/abs/2505.00212). Backend A System1, Backend B `gpt-oss-20b` strict JSON at $0.03/$0.13 per 1M (https://wandb.ai/site/pricing/inference). Written as `call.feedback.add("router", payload)` on the lap root.
5. **Counterfactual confirmation (PARC FERMÉ REPLAY).** For the top-2 roles by `blame_share` (always, if `needs_ablation` or `confidence < 0.7`; top-1 otherwise): fix the history up to r's call (C3 "fixed interaction history", https://arxiv.org/abs/2603.06859), re-run **r using the ghost car's θ_r (gen n−1)** on r's recorded `inputs`, then continue the downstream pipeline; temperature 0, 2 seeds. `credit_r = lap_s(actual) − mean(lap_s(with ghost r))` — positive means r cost us time (SHARP: `credit = R(τ) − R(τ \ m)`, https://arxiv.org/html/2602.08335v2). A second replay with a null stub for r distinguishes "r is worse than ghost" from "r is load-bearing". Each replay is a Weave call with `attributes={"replay_of": call_id, "masked_role": r}` and runs in a sandbox. Cost: ≤ 2 roles × 2 seeds × ≈10 failing laps ≈ 40 partial pipeline runs per generation, downstream-only.
6. **Ledger row.** `call.feedback.add("scrutineer.credit", {"role": r, "delta_s": credit_r, "seeds": 2, "replay_ids": [...], "mast_mode": ..., "router_conf": ...})` on the original role call — append-only, on FIA TELEMETRY, never on a file the improver can edit.
7. **Standings (statistical blame).** `client.get_calls(filter=CallsFilter(...), include_feedback=True).to_pandas()` → per role over the generation: `n_r` confirmed incidents (credit_r > 0.5 s), `blame_r = Σ credit_r`, bootstrap 90 % CI over incidents (Causal Agent Replay reports CIs, https://arxiv.org/abs/2606.08275), `var_r` of credit. Published as a Weave object `standings:gen-{n}` and as the REGS-panel table.
8. **Selection rule (the optimizer step).**
   - Candidates: roles with `n_r ≥ 5` and CI lower bound > 0 (Who&When: never on one lap).
   - `r* = argmax blame_r`; ties → highest `var_r` (JoyAgents-R1 "maximal reward fluctuations", https://openreview.net/forum?id=U7n8gZGyAu).
   - **Model-side rule:** if the router says POWER_UNIT and no harness-role replay flipped ≥ 60 % of the incidents, r* = POWER_UNIT and the upgrade path is weights (Co-Harness `agent_error` → only label that routes to a weight update, https://arxiv.org/html/2607.22688v1).
   - If no role qualifies → **no upgrade this generation**; instead run the matched-budget test-time-scaling baseline (k+1 samples) so the loop is honest about "harness evolution does not consistently outperform simple test-time scaling" (https://arxiv.org/abs/2607.12227).
   - Block-coordinate structure: Phase A upgrades a CAR node; every third accepted generation Phase B may target the RACE ENGINEER itself (temporal×structural BCD, https://arxiv.org/abs/2605.30227) using manifest precision as its score.
   - Written as Weave object `selection:gen-{n}` = `{r*, blame_r*, ci, n, rule_fired, alternatives}`. This object is what the upgrade scene reads: the scene cannot start without it.
9. **Hand-off.** GEPA `component_selector(state, trajectories, subsample_scores, candidate_idx, candidate) -> [f"{r*}"]` (https://github.com/gepa-ai/gepa) — or, in the minimal path, the Race Engineer's headless prompt receives only `selection:gen-{n}` + wiki pages with `role == r*`. It may not touch any other role's folder (scope gate).

**Why this and not the alternatives.** Text pipelines replay deterministically enough that exact leave-one-out is "simpler, cheaper, and more effective than all approximate alternatives" (C3). Judge-only attribution tops out at 54–70 % agent-level (Who&When, AgenTracer https://arxiv.org/abs/2509.03312, TraceElephant), so the router is a proposer and the replay is the verifier (REFLECT: "diagnosis-specific patch → outcome flip", https://arxiv.org/abs/2606.09071). Step-level blame stays ≤ 33 % in every 2026 benchmark, so the screen shows **role-level** credit only (R1 open gap 3).

**Calibrating the router.** Two hours of fault injection: take 10 passing laps, corrupt one role's output programmatically (AgenTracer's fault-injection recipe), and measure router recall per role; show the confusion matrix in the debrief notebook. This is also the seeded evidence for upgrading the SCRUTINEER/router schema.

---

## 5. GATES AND DEFENSES

| Gate | Rule (exact) | Enforced by | Paper |
|---|---|---|---|
| **Public / private split** | QUALI (30 items, visible to Race Engineer via MCP) vs SEALED (30 items, in a second W&B project whose key only the evaluator process holds). Promotion needs the seesaw: `Δquali ≥ 0, Δsealed ≥ 0, max(Δquali, Δsealed) > 0`, measured in seconds against the ghost car | Evaluator service + project ACL | Self-Harness (https://arxiv.org/abs/2606.09498); Co-Harness δin>0, δout≥0 (https://arxiv.org/html/2607.22688v1); AIDE² public/private (https://www.weco.ai/blog/first-evidence-of-recursive-self-improvement) |
| **Cost cap** | Fixed $ per generation (default $3 of W&B Inference at ≤$3.60/1M out for Qwen3.6-27B, https://wandb.ai/site/pricing/inference) and 300 s wall per lap; STRATEGIST's typed `RETIRE` fires mid-generation when `p_finish_under_cap < 0.2`. ATR sliding scale: the championship-leading lineage gets 70 % of eval replays, the trailing one 115 % | Budget meter in evaluator; Sandbox `max_lifetime_seconds` | AIDE² "$15 budget per agent"; SICA utility; FIA ATR 320 runs scaled 70–115 % (https://www.the-race.com/formula-1/the-aero-restrictions-each-f1-team-will-face-in-2026/) |
| **Scrutineer taxonomy** | Every candidate diff + its QUALI trace summary → typed verdict over 5 functional roles (Execution, Evaluation, Selection, Recording, Propagation) × 7 obligations (Measurement Validity, Representational Fidelity, Procedural Integrity, Authorization/Access, Protected Artifact Integrity, Provenance, Required-Set Completeness). BLACK_FLAG if confidence ≥ 0.8 on any class; REFER_TO_STEWARDS (human) in [0.5, 0.8) | Scrutineer in isolated sandbox; Opus-class model once per round if System1 unavailable (90.4 % acc in the audit paper) | https://arxiv.org/html/2609.00069 |
| **Lineage audit** | At promotion, re-run the classifier on the full ancestry of the champion (parent links from the Registry/`logged_by`); any finding strips that lineage's points back to the tainted ancestor. Each accepted transition is `{parent_hash, proposal_hash, official_s, claimed_s, verdict, round, ts}` Ed25519-signed by the Scrutineer key, hash-chained, no-fork; a 40-line verifier replays the chain at season end | `lineage/chain.jsonl` + `pynacl` | Tampering persists from iteration <10 to 100 (2609.00069); MutMem signed transitions (https://arxiv.org/html/2608.02843); ADAS un-reconstructable lineage as the anti-example |
| **Anti-contextual-drag** | The DRIVER (POWER_UNIT op) never receives a failed trajectory; it receives ≤ 3 abstracted lessons from `SKILL.md`; the wiki is read by the Race Engineer only; pattern pages carry `{placeholders}` and trace **refs**, not transcripts | Prompt assembler (AERO) is schema-checked: no `raw/` paths allowed | Contextual Drag 10–20 % drops (https://arxiv.org/html/2602.04288v1); Reflexion Ω=1–3 (https://arxiv.org/html/2303.11366v4); WikiSkill inference-agent-with-wiki −2.8 pts (https://arxiv.org/html/2608.27454) |
| **Regression gate** | Preserve-and-extend: no SEALED item that passed in gen n−1 may fail in gen n (per-item, not just mean); manifest's `predicted_at_risk` items are checked explicitly and the verdict is written back into the evidence corpus | Evaluator diff of per-item pass vectors | DarwinX (https://arxiv.org/abs/2608.07545); AHE regression blindness 11.8 % (https://arxiv.org/html/2604.25850v1) |
| **Write-set gate (PARC FERMÉ)** | Improver's MCP runs `WANDB_MCP_READ_ONLY=true`; the evaluator, `REGS.md`, sealed data, `lineage/`, and `scrutineer/` are never in any sandbox's writable set; the harness is mounted read-only during eval and its hash is checked before and after | Sandbox mounted_files (read-only) + hash check | DGM removed detection markers despite instruction (https://sakana.ai/dgm/); autoresearch `prepare.py` read-only (https://github.com/karpathy/autoresearch); HarnessAudit "channels that agents cannot manipulate" (https://arxiv.org/html/2605.14271) |
| **Scope / schema / evidence / merge gates** | A proposal must (schema) validate as an Agent Skills dir via `skills-ref validate`; (scope) touch only `skills/{r*}/` or `harness/{r*}.py`; (evidence) cite ≥ 1 wiki pattern whose `evidence:` lists a failing Weave call ref; (merge) not duplicate an existing pattern (embedding cosine η=0.95) | PIT CREW pre-check | Living-Harness five gates, −9.71 without them (https://arxiv.org/html/2607.26598v1); ShinkaEvolve novelty rejection (https://arxiv.org/html/2509.19349) |
| **Independent grader** | Official scorer is execution (tests), router/scrutineer are a *different* model family (System1 or gpt-oss) from the driver (Qwen) and the improver (Claude) | Config | "Sample More, Reflect Less" via https://artificialcode.substack.com/p/agents-improve-themselves-but-who; RSI survey verifier hierarchy |
| **Runaway loop / diversity** | Max 12 generations per season; parent selection ∝ score / (1 + children); one new task family injected per 4 generations (regulation change) | Loop controller | DGM/HyperAgents parent selection (https://arxiv.org/abs/2603.19461); AWM OOD coverage 0.40 (https://arxiv.org/html/2409.07429) |

---

## 6. REAL vs SIMULATED in 26 hours

**Task ("circuits").** Python function synthesis with hidden tests (execution-verifiable): 60 items from a public set, split 30 QUALI / 30 SEALED with stratified difficulty; a second family (JSON extraction with exact-match) injected at generation 4 as the "regulation change". Lap = one item.

**REAL (must work end to end):**
- Weave tracing of every role op with inputs; QUALI/SEALED `Evaluation`s; feedback ledger; `weave.publish` + alias; Leaderboard.
- Typed router + replay credit; `standings:gen-n` and `selection:gen-n` objects.
- Race Engineer = `claude -p` headless with W&B MCP (read-only) + skills, producing diff A/B + manifest; PIT CREW sandbox install + tests; Scrutineer typed verdict; seesaw + regression + cost gates; signed lineage chain.
- HISTORIAN: wiki patch, marimo debrief (`marimo check` → `app.run` → `export html`), W&B Report via `create_wandb_report_tool`.
- One real Serverless RL job on `Qwen/Qwen3.6-27B` (or 14B) started early; its adapter enters the gate as a POWER_UNIT candidate when blame says model-side.
- Upgrade scene triggered by the `selection` + `promotion` webhook payload (role, version, cited pattern ids).
- ARIA used live on stage by the Team Principal (no API exists, https://docs.wandb.ai/aria/chat).

**SIMULATED / labelled as such:**
- 3D car physics and animation mapping (stat → geometry) — presentation only.
- System1 confidence if only Backend B is available: `confidence` field + 3-sample vote, labelled "uncalibrated" in REGS (R6 §3.3).
- One **seeded** tampering case (a diff that edits `LapTimeScorer` thresholds) if no natural BLACK FLAG occurs by Sunday 10:00, labelled "seeded" in the report (fault-seeding paradigm of https://arxiv.org/html/2609.00069).
- Per-lap STRATEGIST typed decisions influence only cost-cap `RETIRE`, not the solve — stated in REGS.

**Hour-by-hour (3 people: A = loop control plane, Python; B = broadcast/game, TS; C = sponsor rails). H0 = Sat 11:15.**

| Hour | A — loop | B — broadcast | C — sponsor rails |
|---|---|---|---|
| H0–H1 | Repo skeleton: `harness/`, `skills/<role>/`, `REGS.md`, item split, `LapTimeScorer`; Weave project + second SEALED project | Webhook receiver → upgrade-scene stub; REGS panel component | Confirm on-site: Sandboxes org enablement, Serverless RL key, TypeSafe console/API shape, ARIA on the team project (all UNVERIFIED in R4/R6) |
| H1–H3 | CAR pipeline: 4 role ops + tyres config, Weave attributes, `start_conversation` per role; first QUALI eval runs | Standings table + lap-time-vs-generation chart fed by Weave `get_calls` | Sandbox harness: `Sandbox.run(mounted_files, secrets, network=isolated)` running tests; fallback local Docker with identical interface |
| H3–H5 | Router (typed, Backend B first) + replay engine (fixed history, ghost θ_r); ledger feedback; bootstrap standings | Ghost car overlay; role cards with UTILITY/RISK gauges | **Start Serverless RL job** (`art.TrainableModel`, RULER or test-pass reward, 18 rollouts × 20 steps); it runs in background ~2 h (https://art.openpipe.ai/getting-started/quick-start) |
| H5–H7 | Selection rule + `selection:gen-n` object; Race Engineer headless prompt + manifest schema; scope gate | Upgrade scene v1 (part-number tick, stat tween, radio sting — "juice", https://eastondev.com/blog/en/posts/dev/20260521-game-feedback-feel/) | marimo debrief template + `marimo check` gate + `app.run()` hand-off; molab GitHub link |
| H7–H9 | PIT CREW install/tests in sandbox; A/B QUALI; SEALED eval; seesaw + regression + cost gates | Pit-stop scene; BLACK FLAG scene | Scrutineer typed schema (5×7 enums) + thresholds; System1 adapter if API obtained, else Backend B |
| H9–H11 | Signed lineage chain + verifier; alias move by Scrutineer key; Registry link per role | Lineage/championship view with stripped-points state | HISTORIAN: wiki schema (pattern pages, index, skill-impact), `create_wandb_report_tool` call |
| H11–H13 | **First full generation end to end** (gen 0 → 1). Fix what breaks. Dinner 18:30 | Wire real payloads into every scene | Router calibration by fault injection (10 laps × 5 roles); confusion matrix into debrief |
| H13–H16 | Run gens 1–4 unattended; log; add regulation-change family at gen 4 | Polish; REGS panel shows selection object + evidence chain links | RL job check: adapter `:vN` exists → register as POWER_UNIT candidate path; SFT warm-start JSONL from winning lineage if RL stalls |
| H16–H19 (overnight) | Loop runs gens 5–9; overseer (SICA-style 30 s watchdog, https://arxiv.org/html/2504.15228) cancels stuck laps | Sleep / record b-roll | Sleep; molab notebook with RTX Pro 6000 toggled runs the replay set once for the GPU beat (https://marimo.io/blog/reintroducing-molab) |
| H19–H21 (Sun 06:15) | Season review: pick the best 3-generation window for the demo; ensure ≥ 1 BLACK FLAG (seed if needed, label it) | Season replay mode from logged data (for the unattended 13:30–15:30 judging window) | ARIA dry run: questions the Team Principal will ask; W&B Report polish |
| H21–H23 | Freeze code; write `REGS.md` final; verify chain | Demo rehearsal ×3 | Cost/latency table per backend (System1 vs gpt-oss) for REGS |
| H23–H25 | Buffer / bug fixes only | Social-media clip | Submission package: Weave project link, Report, molab link, repo |
| H25–H26 | Submit 13:00 | — | — |

**Minimal real path that still closes the loop** (if everything else slips, ship this by H13): CAR with 4 role ops on Weave → QUALI/SEALED evals → router (Backend B) + one replay per failing lap → standings + selection → Race Engineer diff for r* (single candidate) → sandbox tests → Scrutineer typed verdict → seesaw gate → alias move + signed chain row → marimo debrief exported → webhook to upgrade scene. No RL, no ARIA, no System1 required for closure; each is an additive rail.

---

## 7. THE 3-MINUTE STAGE DEMO

Season is pre-run; the stage shows generation 7 → 8 live from logged Weave data plus one live replay call.

| Beat | Time | On screen | What the judge sees proven |
|---|---|---|---|
| 1 | 0:00–0:20 | Broadcast opens: two cars on the SEALED circuit, ghost (gen 7) and current; CONSTRUCTORS' STANDINGS with 8 role cards | "Every role is a node with its own part number" |
| 2 | 0:20–0:45 | FIA TELEMETRY: Weave Agents view, one sub-agent span per role on lap 14; Signal tag `strategist-derail` fires | **observe** — sessions/turns/steps used natively (Turlay's lens, https://wandb.ai/wandb_fc/product-announcements-fc/reports/New-in-W-B-Weave-Observability-and-continuous-improvement-for-production-agents--VmlldzoxNzAzMTcxNg) |
| 3 | 0:45–1:15 | STEWARDS' INQUIRY: router row (typed, confidence 0.62 → `needs_ablation`), then a **live replay** with the ghost strategist: lap 14 goes 84.1 s → 71.3 s. Standings update: STRATEGIST blame 9 incidents, +38 s, CI [21, 55] | **credit assignment is causal, not vibes** |
| 4 | 1:15–1:40 | DESIGN OFFICE: Race Engineer's diff A/B to `skills/strategist/SKILL.md` with manifest "predicted −1.1 s, at-risk: items 3, 17"; PIT CREW installs in a sandbox, tests green | **self-improve targets one node**; predicted vs measured |
| 5 | 1:40–2:05 | SCRUTINEERING: typed verdict LEGAL 0.93 for A. Cut to gen 5's BLACK FLAG: a diff that touched `LapTimeScorer` — verdict BLACK_FLAG, class Evaluation × Measurement Validity, lineage points stripped | **the loop refuses something** ("Ship It or Block It", https://www.coreweave.com/fully-connected-2026/agenda) |
| 6 | 2:05–2:30 | PARC FERMÉ: seesaw table Δquali +0.9 s, Δsealed +0.7 s, no per-item regression, cost $2.41/$3.00; Team Principal presses APPROVE; alias moves; signed chain row appears; **UPGRADE SCENE** for the STRATEGIST | **gated promotion with receipts** |
| 7 | 2:30–2:50 | RACE REPORT: marimo debrief (DAG view: `next_round_config` ← `stewards`), W&B Report, ARIA answering "which upgrade moved the sealed time most?"; lap-time-vs-generation curve with the stripped gen 5 greyed out; POWER UNIT card shows `power-unit:v3` from the real RL job | **document + track** across ≥ 3 generations |
| 8 | 2:50–3:00 | REGS panel: which backends were real, which uncalibrated, which seeded. Close. | honesty |

**The sentence a judge should say afterwards:** *"It told me which engineer cost the lap, proved it by replaying without them, upgraded only that engineer, and showed me the one time it caught itself cheating."*

---

## 8. RISKS AND FALLBACKS

| Risk | Likelihood | Fallback |
|---|---|---|
| **TypeSafe System1 API not available or shape unknown** (no public docs; console login-gated; "Best Use — to be confirmed", https://console.typesafe.ai/login, https://luma.com/coreweavehacks) | High | `TypedDecision` protocol with Backend B (`gpt-oss-20b` strict `json_schema` on W&B Inference) from H3; swap in System1 at H5 if obtained; label confidence "uncalibrated" in REGS. Never send SEALED items to System1 until data-use is confirmed (R6 gap 7) |
| **Serverless RL quota/time** (only "progress in first 20–30 steps", ~2 h; base-model list limited; GPT-OSS UNVERIFIED, https://docs.wandb.ai/inference/lora) | Medium | Start at H3 on `OpenPipe/Qwen3-14B-Instruct` (cheapest, tool-calling); if training fails, run Serverless SFT from the winning lineage's JSONL; if both fail, POWER UNIT stays at base and the model-side rule reports "no weight path this season" — the loop still closes on harness roles |
| **Sandboxes not enabled for the org** (public preview, per-org via support@wandb.com, https://docs.wandb.ai/sandboxes) | Medium | Identical `run_isolated(files, cmd)` interface backed by local Docker with `--network none`; keep the PARC FERMÉ read-only mount semantics |
| **Replay nondeterminism** (AgentLocate/DuoTrace caveat, R1 gap 2) | Medium | Temperature 0, 2 seeds, bootstrap CI; drop incidents whose CI spans 0; require `n_r ≥ 5` before any upgrade |
| **No natural BLACK FLAG by Sunday morning** | Medium | Seed one tampering diff (scorer edit) through the normal pipeline; label "seeded" on screen and in the Report |
| **Weave free-tier ingestion (1 GB/mo) / 50 req/min** (https://wandb.ai/site/pricing) | Low–Med | `include_content=False` on tool spans over 8 KB; `tracing_sample_rate` on replays; batch `get_calls` |
| **ARIA unavailable on the free team project** (Multi-tenant + team + admin toggle, https://docs.wandb.ai/aria/governance) | Medium | Team Principal uses the W&B Report + `compare_runs_tool` output; the APPROVE button remains the human gate |
| **marimo `_code_mode` is internal** (https://raw.githubusercontent.com/marimo-team/marimo/main/marimo/_code_mode/__init__.py) | Low | Ship Lane 1 only (file generation + `marimo check` + `app.run` + export); live `marimo pair` is a stage flourish, not a dependency |
| **Race Engineer proposes no-op or cosmetic diffs** | Medium | XCOM rule: two comparable candidates A/B; reject if `skills-ref validate` fails or diff < 3 lines; if no candidate passes seesaw two generations running, Phase B upgrades the Race Engineer's own SKILL.md |
| **Harness evolution ≤ test-time scaling at equal budget** (https://arxiv.org/abs/2607.12227) | Real | Report the matched-budget TTS ghost on every chart; a season where TTS wins is still a correct loop — say so |
| **Judging window 13:30–15:30 unattended** | Certain | Season-replay mode: the broadcast plays logged generations from Weave with links live; no pitch required |
| **Name collisions** ("Pit Wall AI", PitWall-AI's "Ghost Car Evaluator", https://github.com/rohan-chandrashekar/Pitwall-AI) | Low | Never name a panel "Pit Wall"; credit GHOST CAR as "previous-generation lineage, self-play per https://arxiv.org/abs/2602.23056" |
