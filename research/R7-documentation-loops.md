# R7 — Documentation as a first-class loop stage

Research thread for SCRUTINEER / CoreWeave Hacks "The Loop" (Sept 13–14 2026). Question: what should the per-round document contain, who writes it, in what format, how is it verified, and how does it feed the next round — plus how to make the season's history (lineage) auditable.

All sources fetched live on 2026-09-03. Anything not directly verified is marked UNVERIFIED.

---

## Summary

1. **The strongest 2026 result on "documentation as a loop stage" is WikiSkill (Google Research, arXiv 2608.27454, 27 Aug 2026).** It inserts a persistent *wiki layer* between immutable raw traces and executable skills. A dedicated **Wiki Maintainer** role distils sampled traces into pattern pages (root cause + fix + evidence links) and appends to `logs.md` and `skill-impact.md` (an audit trail of proposal, diff, validation score, accept/reject). A separate **Skill Proposer** reads the wiki index and proposes one atomic skill edit; a gate accepts it only if held-out validation score *strictly* improves; on rejection **skills are rolled back but the wiki is never rolled back**. Ablation: giving the Proposer the wiki lifts average performance 48.7% → 63.7%, while giving the *inference* agent the wiki *hurts* (63.7% → 60.9%). This is the template: the document is written by an archivist role, read by the improver role, not by the driver.
2. **Documents must be distilled, not replayed.** Contextual Drag (Arora lab, arXiv 2602.04288, Feb 2026) shows raw failed attempts in context cause 10–20% drops across 11 models and can push iterative self-refinement into "self-deterioration"; the new attempts structurally inherit the old errors (tree-edit-distance evidence), and denoising/fallback fine-tuning don't fully recover. Reflexion (2023) bounds verbal memory to 1–3 reflections; ReasoningBank (ICLR 2026) stores *strategies* distilled from both successes and failures and beats raw-trajectory memory; AWM abstracts task-specific values into `{placeholders}`. So the per-round document carries **abstracted patterns + evidence pointers**, never raw failed traces.
3. **Documentation has a schema, and the schema is gated.** Living-Harness (arXiv 2607.26598, Jul 2026) writes two typed artefacts per episode — *episodic memory* (trigger condition, failure pattern, recovery action) and a *state graph* (state nodes, repair edges, transition rules) — under a fixed domain-level **Evolution-SOP**, and every write passes five gates: schema, scope, evidence, constraint (no override of frozen tools/policies), and merge (semantic-hash dedup). MUSE-Autoskill (ByteDance, arXiv 2605.27366, May 2026) attaches a per-skill `.memory.md` and requires `tests/` to pass before a skill is registered. MemSkill (arXiv 2602.02474) has a periodic **Designer** review a sliding-window buffer of hard cases scored `d(q) = (1−r(q))·c(q)` and propose skill edits.
4. **The document is the improvement's provenance record.** Auditing Harness Tampering (arXiv 2609.00069, 30 Aug 2026) reconstructs each system's best-agent ancestry "via parent links" and finds tampering *accumulates* along lineages (HyperAgents 5.2 and DGM 3.5 concurrent findings in the final best agent); ADAS could not even be lineage-reconstructed because its released run materials lacked parent metadata. Its Recording role and "Provenance and source attribution" obligation define exactly what a lineage record must protect. MutMem (arXiv 2608.02843, Aug 2026) shows how: each memory mutation is a signed, hash-chained, no-fork transition (Ed25519, two domain-separated SHA-256 commitments, signer epoch, quantized old/new values) verifiable by a portable verifier at ~4.9 ms median.
5. **Sponsor surfaces that make this real in 26 h:** W&B Reports API (`wandb_workspaces.reports.v2`: `Report(entity, project, title, blocks=[H1, MarkdownBlock, CodeBlock, PanelGrid(runsets=[Runset(...)], panels=[LinePlot...]), WeaveBlock...]).save()`, `.url`, `Report.from_url`), the W&B MCP server tool `create_wandb_report_tool(entity_name, project_name, title, description, markdown_report_text, panels)`, Weave feedback/annotations (`call.feedback.add("correctness", {"value": 5})`, `AnnotationSpec` + `weave.publish`), Weave object versioning (`weave.publish(obj, "name")` → immutable `weave:///entity/project/object/name:version`), W&B Artifacts lineage DAG (`artifact.logged_by()`, `artifact.used_by()`), W&B Registry (`artifact.link(target_path="wandb-registry-<r>/<c>", aliases=[...])` → `v0, v1, …`) with Automations (alias-added → webhook), and marimo (`marimo export html notebook.py -o out.html` runs the notebook to produce outputs; `marimo export session`; molab hosts with 4 CPU/32 GB, optional RTX Pro 6000 96 GB, 12 h max, `marimo pair` connects Claude Code).
6. **Karpathy's `program.md` (autoresearch) is the minimum viable "document as contract":** a human-written Markdown file fixes what may be edited (`train.py` only), what is frozen (`prepare.py`, evaluation), the budget (5 min), the metric (`val_bpb`), the log (`results.tsv` with `commit  val_bpb  memory_gb  status  description`, status ∈ keep/discard/crash), and the commit/`git reset` rule. It is the ancestor of the Evolution-SOP and of the REGS panel.

**Answer in one line:** the per-round document is a *Race Report* written by the **Historian/Archivist** role (never the driver, never the improver), consisting of (a) a wiki pattern page per new/updated failure pattern, (b) a marimo notebook that re-runs the round's evidence and renders it, (c) a registry entry (immutable artifact version + lineage edges + signed acceptance record); it is verified by schema/scope/evidence/constraint/merge gates plus held-out score and the Scrutineer's tamper audit; it feeds the next round because the Skill Proposer recompiles role skill files *only* from the wiki, and the curriculum (which tracks / task families to drill) is derived from the pattern pages' open failure clusters.

---

## Findings with citations

### F1. WikiSkill: three layers, two writer roles, wiki never rolled back
- Source: https://arxiv.org/html/2608.27454 (arXiv:2608.27454v1, 27 Aug 2026; Tang, Rashtchian, Ferng, Tomkins, Juan, Vu — Google Research / Virginia Tech). Reference impl: https://github.com/kenhuangus/wikiskill (fetched 2026-09-03).
- Workspace: `raw/` (immutable traces: "reasoning, tool calls, tool-call outputs, and final answers"), `wiki/` (`patterns/*.md`, `index.md`, `logs.md`, `skill-impact.md`), `skills/<name>/SKILL.md` + `PURPOSE.md` ("mapping the skill back to motivating wiki patterns").
- `skill-impact.md` records "proposal metadata, target skill name, unified diff of the modification, validation score ℛ(𝒯val,k), and final acceptance outcome."
- Roles: **Inference Agent π** (runs tasks, "restricted from accessing the Wiki Layer"); **Wiki Maintainer** ("root cause analysis on the failing tasks, and extracts successful strategies from the passing tasks", patch-based `append/replace/insert_after` edits, updates `index.md`, appends `logs.md`); **Skill Proposer** (multi-turn ReAct with `read_file`, receives wiki index + skill-impact tracker + outcome summary, emits ONE atomic proposal targeting a single skill); **Gate** (accept iff ℛ(val) > ℛ_best, else roll back skills).
- Key sentence: "the wiki Wₖ is never rolled back regardless of the acceptance decision."
- Numbers: Gemini-3.5-Flash LiveMath 33.0 → 72.6, SpreadSheet 50.5 → 76.6; gains +12.3/+17.5/+23.9 for Qwen 4B/9B/27B; cross-model skill transfer (Qwen-3.5-9B 70.2% with 27B-evolved skill vs 63.4% own).
- Ablation (Table 3, Gemini-3.5-Flash): No-wiki/No-wiki 45.3%; Proposer-has-wiki 63.7%; both-have-wiki 60.9%; inference-only-has-wiki 55.2%. Quote: "when the Inference Agent has access to both skills and the wiki during training rollouts, some task-solving knowledge may be obtained directly from the wiki rather than the skills, which can make the resulting trajectories less informative for skill development."
- Relevance: exact blueprint for Historian (Wiki Maintainer) vs Race Engineer (Skill Proposer) vs Driver (Inference Agent) separation, and for the "documents survive black flags" rule.

### F2. Contextual Drag: why raw failures must not be replayed
- Source: https://arxiv.org/html/2602.04288v1 (arXiv:2602.04288, 4 Feb 2026; Cheng, Zhu, Zhao, Arora).
- Definition: "the presence of failed attempts in the context biases subsequent generations toward structurally similar errors."
- Scope: 11 models, 88 problems (AIME24/25, HMMT24/25, GPQA, MMLU-Redux, CRUXEval-I, Game of 24). Drops 10–20% consistently; GPT-OSS-20B loses ~50% on some benchmarks; its iterative refinement "collapses into self-deterioration" while majority voting improves.
- Tree-edit-distance on Game of 24: new solutions "remain noticeably closer to the erroneous in-context reasoning" than clean-slate responses.
- Mitigations (context denoising prompts; fallback fine-tuning) "failed to fully restore baseline performance." Paper calls it "a fundamental limitation of current attention-based architectures."
- Relevance: the Race Report must contain *abstracted* failure patterns and pointers to trace IDs, and the next round's driver context must never include the failed trajectory verbatim. Also motivates the WikiSkill rule that the driver does not read the wiki at all.

### F3. Reflexion: bounded verbal memory (Ω = 1–3)
- Source: https://arxiv.org/html/2303.11366v4 (Shinn et al., Mar 2023 — older than 2026, foundational).
- "the trajectory history serves as the short-term memory while outputs from the Self-Reflection model are stored in long-term memory"; "in practice, we bound mem by a maximum number of stored experiences, Ω (usually set to 1-3)."
- Evaluator types: exact match (HotPotQA), heuristics (repeated actions / inefficient planning in AlfWorld), LLM-based. HumanEval 91% pass@1 vs GPT-4 80%; AlfWorld +22% abs over 12 steps; HotPotQA +20%.
- Relevance: the per-round "lessons" block that is injected into a role's harness must be short (≤3 items) — the wiki holds the long tail, the skill file holds the distilled few.

### F4. Agent Workflow Memory: workflow format and success-only induction
- Source: https://arxiv.org/html/2409.07429 (Wang, Mao, Fried, Neubig; Sep 2024 — older).
- Workflow = (1) NL description + (2) trajectory of steps, each = NL environment state + reasoning + executable action. LM-based induction "extract[s] common sub-routines from one or more input experiences" and abstracts specifics ("dry cat food" → `{product-name}`). Online: induce only from trajectories an "LM-based evaluation model" judges successful.
- WebArena +51.1% relative, Mind2Web +24.6% relative; utility 0.91/0.94; coverage only 0.40 OOD.
- Relevance: successful pit-stop procedures become parameterised workflow pages; the low-OOD-coverage number is a warning that the curriculum must include new circuit families or the wiki stops paying off.

### F5. ReasoningBank: distil strategies from both successes and failures
- Source: https://arxiv.org/abs/2509.25140 (Ouyang et al., ICLR 2026; v2 16 Mar 2026).
- "distills generalizable reasoning strategies from an agent's self-judged successful and failed experiences"; "consistently outperforms existing memory mechanisms that store raw trajectories or only successful task routines." MaTTS scales interaction experience per task to diversify what gets distilled.
- Relevance: failures are documented as *strategy-level* lessons (what to avoid and why), not as trajectories — consistent with F2.

### F6. Living-Harness: Evolution-SOP + typed episodic memory + state graph + five gates
- Source: https://arxiv.org/html/2607.26598v1 (arXiv:2607.26598, 29 Jul 2026; Du et al., Zhejiang U / Alibaba / CityU / HKUST / U Michigan).
- Evolution-SOP ψd: "a fixed, domain-level protocol that governs how evaluated interactions revise the evolving harness state" (failure interpretation, update scope, monitoring rules, tool/domain constraints, task-family structure).
- Episodic memory records **trigger conditions / failure patterns / recovery actions** ("why and under what condition a repair is useful"); state graph records **state nodes / repair edges / transition rules** ("where that repair changes the future procedure").
- Pipeline: trajectory τn + evaluator signal yn → episode abstraction en → structured evidence (uR, uG) → **five gates**: schema, scope (task-family isolation), evidence (grounded in evaluator feedback), constraint ("no override of frozen policies/tools"), merge (dedup by "semantic hashes and accumulated confidence"). "one repair pass; an output that still violates the schema is discarded." Updates touch "only the stateful parts of the harness, leaving the available tools and base context frozen."
- Results: τ²-Bench 83.09 vs Reflexion 73.02; MultiWOZ-2.4 65.50 vs ReasoningBank 55.59 (+10.07 / +9.91 pp).
- Relevance: gives the per-round document a **schema** and a **verification protocol**; the Evolution-SOP is the REGS document; "scope gate" is how a lesson is attributed to one role/system.

### F7. MUSE-Autoskill: skill lifecycle, `.memory.md`, tests before registration
- Source: https://arxiv.org/html/2605.27366v1 (arXiv:2605.27366, 26 May 2026; Lin, Li, Song, Jiang, Zhang — ByteDance / RIT).
- Skill = directory "following Anthropic's Agent Skills format": `SKILL.md` (YAML frontmatter name/description + workflow), `scripts/`, `tests/` (pytest), `resources/`, `.memory.md` ("notes, lessons, and usage observations accumulated across tasks (e.g., known failure modes, input format quirks, performance caveats)"). Only the frontmatter description is "surfaced eagerly".
- Lifecycle: creation (`skill_create`), memory (skill-level / short-term / long-term), management (index, "refinement, merging, and pruning"), evaluation ("unit tests defined in the tests/ directory"; failed tests block registration), refinement (auto on test failure/runtime error).
- SkillsBench (51 tasks): no skills 53.19%, self-generated 60.35%, human 68.40% (Codex 67.28%, Hermes 61.21%, all GPT-5.5); Hermes +10.51 pp with MUSE-generated skills.
- Relevance: each F1 role's skill folder carries its own `.memory.md`; an upgrade is only "fitted" once `tests/` pass — the visible upgrade scene should be gated on the test run.

### F8. MemSkill: a Designer role reviews hard cases and evolves the skill set
- Source: https://arxiv.org/html/2602.02474v1 (arXiv:2602.02474, 2 Feb 2026; Zhang et al., NTU).
- Skill = "(i) a short description used for skill representation and selection, and (ii) a detailed content specification". Seed skills: Insert/Update/Delete/Skip.
- Controller (PPO, Top-K without replacement) selects; Executor applies; **Designer** "maintains a sliding-window buffer of challenging cases" with difficulty `d(q) = (1 − r(q)) · c(q)` (reward × cumulative failure count), clusters them semantically, and "uses an LLM to refine existing skills and propose new skills."
- LoCoMo L-J 50.96; ALFWorld-Seen 47.86%; transfers LLaMA → Qwen.
- Relevance: the "hard-case buffer" is exactly the curriculum source: the Historian's wiki should expose a ranked list of recurring failure clusters; the next round drills the top ones.

### F9. ALMA: memory designs as archived, evaluated code
- Source: https://arxiv.org/html/2602.07755 (arXiv:2602.07755, 8 Feb 2026; Xiong, Hu, Clune — UBC / Vector).
- Meta Agent "samples previously explored memory designs from an archive, where all explored memory designs and their evaluation logs are stored", reflects, implements new designs "in Python Abstract Classes" with `general_update()` / `general_retrieve()`; sampling probability ∝ success rate and ∝ 1/times-sampled.
- +6.2% over no-memory and beats all human-designed baselines on ALFWorld, TextWorld, Baba Is AI, MiniHack.
- Relevance: the *memory system itself* (how a role's `.memory.md` is updated/retrieved) is an upgradable part, and every variant plus its eval log belongs in the archive — i.e., the Data Engineer role's memory design is a car part with its own lineage.

### F10. Memento-Skills: skills as structured markdown = persistent memory
- Source: https://arxiv.org/abs/2603.18743 (19 Mar 2026; Zhou et al., 17 authors).
- Skills "stored as structured markdown files" act as "persistent, evolving memory"; "Read–Write Reflective Learning": router reads relevant skills; agent writes back to the library after experience. GAIA +26.2% relative; HLE +116.2% relative.
- Relevance: confirms markdown skill files as the write target; read/write are separate phases (read at race time, write at debrief).

### F11. Karpathy `program.md`: the contract document
- Source: https://raw.githubusercontent.com/karpathy/autoresearch/master/program.md (fetched 2026-09-03; repo https://github.com/karpathy/autoresearch).
- Setup: tag + branch `autoresearch/<tag>`, read `README.md`/`prepare.py`/`train.py`, init `results.tsv`. Rules: modify only `train.py`; `prepare.py` (data, eval, constants) read-only; no new deps; 5-minute budget; goal "get the lowest val_bpb".
- Log: `results.tsv` columns `commit  val_bpb  memory_gb  status  description`, status ∈ `keep|discard|crash`. Loop: edit → commit → `uv run train.py > run.log 2>&1` → grep score → keep (advance) or `git reset`. Directive: "NEVER STOP … do NOT pause to ask the human if you should continue."
- Relevance: the REGS panel = `program.md`; the Constructors' table = `results.tsv`; PARC FERMÉ = read-only `prepare.py`.

### F12. Auditing Harness Tampering: lineage = parent links; recording/provenance obligations
- Source: https://arxiv.org/html/2609.00069 (arXiv:2609.00069v1, 30 Aug 2026; Wang, Zhang, Shao).
- Taxonomy: functional roles Execution / Evaluation / Selection / **Recording** ("creates or updates records of versions, results, or decisions") / Propagation × obligations: measurement validity, representational fidelity, procedural integrity, authorization & access boundaries, protected artifact & state integrity ("Whether a protected object retains its required identity, contents, or validity"), **provenance & source attribution** ("Whether an item is associated with the correct producer, variant, run, source, and version"), required-set completeness.
- Prevalence: ADAS 84.6%, AFlow 18.3%, DGM 63.1%, HyperAgents 73.6%, ScientistOne 29.6%.
- Lineage: "identify the best agent at iteration t, reconstruct its ancestry via parent links, and count active findings introduced along its lineage." HyperAgents / DGM final best agents retain 5.2 / 3.5 concurrent findings. "ADAS's publicly released run materials do not contain sufficient metadata to reconstruct a continuous parent-child lineage."
- Example finding: agent "overwrite[s] the original overall accuracy into fixed 1.0 before saved to the disk."
- Audit benchmark: 1,765 classification / 1,801 localization samples; Claude Opus 5 90.4% acc / 91.0 F1 / 84.2% localization recall / 9.4% FPR; GPT 5.6 Luna 89.6% / 90.0 at ~3% cost. Calls for "tamper-proof evaluation channels, provenance-aware state tracking, and continuous auditing protocols".
- Relevance: the lineage record must carry parent links, producer identity, variant hash, run id, and version for every accepted generation — otherwise the season is un-auditable (the ADAS failure).

### F13. MutMem: cryptographically authorized memory mutation
- Source: https://arxiv.org/html/2608.02843 (arXiv:2608.02843v1, 3 Aug 2026; Walid Saidi; HOM-AIMOS).
- "Every transition is bound to a terminal memory-provenance node, an exact signer epoch, quantized old and new weights, a no-fork predecessor, and two domain-separated SHA-256 commitments." Fields: quantized weights ([100, 3000] → w/1000), provenance mutation hash μi, projection-chain hash hi, transition commitment ti, Ed25519 signature si, replay nonce ni, Unix timestamp ui.
- "The housekeeper is the native owner of autonomous cognitive mutation. It is not a user-enrolled agent and it does not obtain authority from environment variables." Portable verifier (Node.js) recomputes commitments and emits a deterministic corpus proof root. Goal: "an external reviewer must be able to distinguish an authorized adaptation from an unauthorized database edit."
- 20 native transitions: median 4.865 ms, P95 5.674 ms, 966 B/transition.
- Relevance: an implementable 26-hour version — every accepted harness/skill mutation is a signed, hash-chained record with a no-fork predecessor; only the Scrutineer's key signs acceptance; the improver cannot forge history.

### F14. HarnessFix and DarwinX: failures as structured evidence; preserve-and-extend archives
- HarnessFix: https://arxiv.org/abs/2606.06324 (4 Jun 2026, rev 2 Jul 2026; Chen et al.). Converts traces into a Harness-aware Trace IR (HTIR) that "captures step-level data-flow and control-flow relations", consolidates "recurring diagnoses into repair-oriented flaw records", maps to "scoped repair operators", accepts via "regression-aware validation". +6.3–18.4% over human and self-evolution baselines.
- DarwinX: https://arxiv.org/abs/2608.07545 (31 Jul 2026; Zhang, Dai, Tan et al.). "preserve-and-extend contract" (accept only variants that extend coverage without regression), an archive of alternative lineages for recombination; Terminal-Bench 2.1 83.2%/84.7%, WebArena-Infinity 43.5 → 93.0 "audit-clean pass@1". Ancestry mechanics not in abstract (UNVERIFIED beyond abstract).
- Relevance: "flaw record" is the unit of the wiki pattern page; "regression-aware / preserve-and-extend" is the acceptance rule the document must certify (no lap-time regression on any previously-passed circuit).

### F15. Externalization review: harness = governed execution layer
- Source: https://arxiv.org/abs/2604.08224 (9 Apr 2026). "memory as externalizing state across time, skills as externalizing procedural expertise, protocols as externalizing interaction structure, and harness engineering as … the unification layer that coordinates them into governed execution." Flags "open challenges in evaluation and governance" of self-evolving harnesses.
- Relevance: vocabulary for the REGS panel: memory / skills / protocols / harness are the four upgradable systems per role.

### F16. W&B Reports API (Public Preview) — automated per-round report
- Sources: https://docs.wandb.ai/guides/reports/create-a-report/ ("W&B Report and Workspace API is in Public Preview"; `pip install wandb wandb-workspaces`), https://raw.githubusercontent.com/wandb/wandb-workspaces/main/README.md, https://raw.githubusercontent.com/wandb/wandb-workspaces/main/wandb_workspaces/reports/v2/interface.py, https://docs.wandb.ai/guides/reports/edit-a-report/ (all fetched 2026-09-03).
- Code (README): `import wandb_workspaces.reports as wr; wr.Report(entity=..., project=..., title=..., blocks=[wr.H1(...), wr.P(...), wr.H2("...", collapsed_blocks=[wr.P(...)]), wr.PanelGrid(panels=[wr.LinePlot(x="Step", y=["val_loss"]), wr.BarPlot(metrics=["val_accuracy"]), wr.ScalarChart(metric="f1_score", groupby_aggfunc="mean")])]).save()`.
- Blocks (interface.py): `H1 H2 H3 P MarkdownBlock CodeBlock LatexBlock Image Video Gallery TableOfContents CalloutBlock BlockQuote HorizontalRule CheckedList/OrderedList/UnorderedList WeaveBlock WeaveBlockSummaryTable WeaveBlockArtifactVersionedFile WeaveBlockArtifact`; panels `LinePlot ScatterPlot BarPlot ScalarChart ParallelCoordinatesPlot ParameterImportancePlot RunComparer MediaBrowser MarkdownPanel CustomChart WeavePanel`; `Report` fields `entity project title description width blocks`; `save()`, `url` property, `Report.from_url(url)`.
- Edit docs: `wr.MarkdownBlock(text="…")`, `wr.CodeBlock(code=[...], language="yaml")`, `wr.PanelGrid(runsets=[wr.Runset(entity=..., project=..., filters="Config('learning_rate') > 0.01")])`.
- Relevance: the human-readable Race Report per round is a W&B Report generated by code, embedding the run panels (lap times per generation) and `WeaveBlockArtifact` for the accepted harness artifact.

### F17. W&B MCP server — the agent-native way to write the report
- Sources: https://raw.githubusercontent.com/wandb/wandb-mcp-server/main/README.md and https://docs.wandb.ai/platform/mcp-server (fetched 2026-09-03).
- Hosted `https://mcp.withwandb.com/mcp`; `claude mcp add --transport http wandb https://mcp.withwandb.com/mcp --header "Authorization: Bearer [YOUR-WANDB-API-KEY]"`; local `uvx --from git+https://github.com/wandb/wandb-mcp-server wandb_mcp_server`.
- Tools: `infer_trace_schema_tool`, `query_weave_traces_tool` (detail_level), `count_weave_traces_tool`, `query_wandb_tool`, `get_run_history_tool`, `search_wandb_docs_tool`, **`create_wandb_report_tool(entity_name, project_name, title, description, markdown_report_text, panels)`** (LinePlots, BarPlots, run comparisons, Vega, `panel_grid`, `heading`/`markdown` blocks), `log_analysis_to_wandb`, `list_registries_tool`, `list_registry_collections_tool`, `list_artifact_versions_tool`, `get_artifact_details_tool`, `compare_artifact_versions_tool`, `list_wandb_automations_tool`, `list_wandb_integrations_tool`; Weave-Agents OTel tools behind `WANDB_MCP_ENABLE_WEAVE_AGENT_TOOLS=true` (`get_weave_agent_trace_tool`, `search_weave_agents_tool`, …).
- Docs: "Skills provide patterns and MCP provides data access, and the two work well together" (no named SKILL.md files listed on that page — UNVERIFIED which skills ship).
- Relevance: the Historian role is literally a Claude Code agent with the W&B MCP server: it queries traces, diffs artifact versions, and calls `create_wandb_report_tool`.

### F18. Weave feedback, annotations, and object versioning — the evidence channel
- Sources: https://docs.wandb.ai/weave/guides/tracking/feedback and https://docs.wandb.ai/weave/guides/tracking/objects (fetched 2026-09-03; the weave-docs.wandb.ai mirror returned 403 to the fetcher).
- `client = weave.init('proj'); call = client.get_call("[CALL-UUID]"); call.feedback.add_reaction("👍"); call.feedback.add_note("…"); call.feedback.add("correctness", {"value": 5})`; "The maximum number of characters in a feedback note is 1024." Query: `client.get_feedback()`, `client.get_feedback(reaction="👍", limit=10)`; each `f.id, f.created_at, f.feedback_type, f.payload`. Call id inside an op: `weave.require_current_call().id`; or `result, call = op.call(...)`.
- Human annotation scorer: `AnnotationSpec(name="Temperature", description=..., field_schema={"type":"number","minimum":-1,"maximum":1}); weave.publish(spec, "temperature-scorer")` (types number/integer/string/enum) — shows up in the Feedback sidebar.
- Objects: `weave.publish(obj, 'name')`; "Weave automatically versions objects when they change and creates an immutable history"; ref `weave:///[TEAM]/[PROJECT]/object/[NAME]:[VERSION]` (hash, `v0`, or `:latest`); `weave.ref('name').get()`; deleted refs resolve to `DeletedRef`.
- Relevance: the Scrutineer's verdict and the Historian's pattern-page link are written as Weave feedback *on the trace call* (append-only, separate from the improver's write path); the accepted skill file per role is `weave.publish`ed so the version hash is the lineage key.

### F19. W&B Artifacts lineage, Registry, Automations — the registry entry
- Sources: https://docs.wandb.ai/guides/artifacts/explore-and-traverse-an-artifact-graph/, https://docs.wandb.ai/guides/registry/, https://docs.wandb.ai/guides/registry/link_version/, https://docs.wandb.ai/guides/automations/ (fetched 2026-09-03).
- Lineage: DAG of run nodes and artifact nodes `<name>:<version>`; enable with `run.use_artifact(...)` / `run.log_artifact(...)`; traverse with `artifact.logged_by()` and `artifact.used_by()`.
- Registry: "a curated central repository of W&B Artifact versions"; link via `run.link_artifact(artifact=..., target_path="wandb-registry-{REGISTRY}/{COLLECTION}")` or `artifact.link(target_path=..., aliases=["latest"])`; "Version numbers are incrementally assigned to each linked artifact version starting with v0"; full name `wandb-registry-{REGISTRY}/{COLLECTION}:v{N}`.
- Automations: event → condition → action; events include "When the production alias is added to an artifact … call a webhook", new artifact version / alias added, run failed, metric threshold (cloud only); actions: Slack notification, webhook with JSON payload.
- Relevance: each role is a Registry collection (`wandb-registry-scrutineer/race-engineer`); every accepted upgrade is `v(N+1)` with alias `champion`; alias-added automation fires the upgrade scene; `logged_by/used_by` reconstructs the season's parent links — the thing ADAS lacked.

### F20. marimo / molab — notebooks as living, re-executable reports
- Sources: https://docs.marimo.io/guides/exporting/, https://docs.marimo.io/guides/exporting/static_html/, https://docs.marimo.io/guides/molab/, https://raw.githubusercontent.com/marimo-team/marimo/main/README.md (fetched 2026-09-03).
- Exports: `marimo export html notebook.py -o notebook.html` (`--no-include-code`, `--watch`); "Exporting runs your notebook. When you export from the command line, marimo runs your notebook to produce its visual outputs before saving as HTML." Non-zero exit on cell error (`|| true` to suppress). Also `html-wasm`, `ipynb`, `md`, `script`, `pdf`, `session` (JSON snapshot: `marimo export session notebook.py`).
- Notebooks "stored as pure Python", "no hidden state, deterministic execution", "execute as a Python script, parameterized by CLI args", deployable as app/slides/WASM.
- molab: "free cloud-hosted marimo notebook environment"; "4 CPUs and 32 GB of RAM"; "attach an NVIDIA RTX Pro 6000 Blackwell GPU — with 96 GB of VRAM and 125 TFLOPS"; 12 h max, 90 min idle shutdown; GitHub-URL mirroring ("GitHub as the source of truth"); share URL gives static preview + fork; "connect your favorite coding agent — such as Claude Code, Codex, or OpenCode — to a running molab notebook using marimo pair". No programmatic upload API documented (UNVERIFIED whether one exists).
- Relevance: the per-round *Debrief Notebook* is a parameterised marimo `.py` (`--round N`) that pulls the round's Weave calls and W&B runs, recomputes the lap-time deltas, and is exported by CI to HTML and `session` JSON — deterministic execution is the verification property; the Historian (Claude Code) edits it via `marimo pair`.

---

## Design implications for the F1 loop

### 1. Who writes the per-round document — the HISTORIAN (archivist) role, and only that role
- Mirror WikiSkill's separation exactly: **Driver** (inference agent) writes nothing and *cannot read the wiki* (F1 ablation: −2.8 pts when it can; F2: replaying failures drags). **Historian** (Wiki Maintainer + Living-Harness Extract step) is the only writer of `wiki/`. **Race Engineer** (Skill Proposer) reads `wiki/index.md` + `skill-impact.md` and writes one atomic proposal per role per round. **Scrutineer** signs acceptance (MutMem housekeeper: a principal that is "not a user-enrolled agent"). **Team Principal** (human) owns `REGS.md` (= `program.md` + Evolution-SOP) and never touches results.
- Historian's inputs are FIA telemetry only (Weave traces via `query_weave_traces_tool`), never the improver's claims — so the document cannot be self-confirming.

### 2. What the per-round document contains (the "Race Report" bundle)
Three artefacts, one bundle, all keyed by `round_id` and the parent `champion` version:

**(a) Wiki pattern pages** (`wiki/patterns/<slug>.md`, patch-edited, never rolled back). Schema, merged from WikiSkill + Living-Harness + HarnessFix flaw records:
```
---
id: pattern-0042              # stable id, never reused
role: tyre-engineer           # single responsible role (scope gate)
system: memory|skills|protocol|harness   # externalization axis (F15)
status: open|mitigated|closed
first_seen: round 7   last_seen: round 9   occurrences: 5
evidence: [weave:///team/proj/call/<id>, ...]   # pointers, not transcripts
---
## Trigger condition      (Living-Harness)
## Failure pattern        (abstracted, values -> {placeholders}, AWM)
## Root cause             (HTIR-style: which harness component)
## Recovery / workaround  (strategy-level, ReasoningBank; ≤3 bullets)
## Affected state-graph edges
## Proposals that cited this page  (from skill-impact.md)
```
Plus `wiki/index.md` (catalogue), `wiki/logs.md` (Historian's append-only evolution log), `wiki/skill-impact.md` (per proposal: role, target skill, unified diff, TEAM CLAIMED score, OFFICIAL score, accept/black-flag, Scrutineer finding codes).

**(b) Debrief notebook** (`debrief/round_<N>.py`, marimo): cells that (1) pull the round's Weave calls and W&B runs for both the ghost car and candidate, (2) recompute lap-time deltas per circuit, (3) render the pattern pages cited this round, (4) render the skill diff, (5) assert the acceptance rule (`assert official_new > official_best` and no regression on previously passed circuits — DarwinX preserve-and-extend). Exported by `marimo export html … -o` and `marimo export session` — a failing assertion cell fails the export (non-zero exit) and blocks promotion.

**(c) Registry entry** (W&B Registry collection per role). Artifact contents: the role's `skills/<role>/SKILL.md`, `.memory.md`, `tests/`, and the LoRA/adapter id if weights changed; metadata: `parent_version`, `round_id`, `proposal_hash`, `wiki_pages_cited`, `official_score`, `claimed_score`, `scrutineer_verdict`, `signature`. Linked with `artifact.link(target_path="wandb-registry-scrutineer/<role>", aliases=["champion"])` only after the Scrutineer signs. The W&B Report (F16/F17) is the rendered, shareable view of (a)+(b)+(c).

### 3. Format: why wiki + notebook + registry (not one thing)
- Wiki page = *knowledge* (persists through black flags; read by the Race Engineer; F1 "never rolled back").
- Notebook = *verification* (deterministic re-execution of evidence; the "does the claim reproduce" artefact; marimo's no-hidden-state guarantee is the point).
- Registry entry = *lineage* (immutable version, parent link, `logged_by/used_by` edges, alias-triggered automations). The tampering audit paper's failure to reconstruct ADAS lineage is the argument for this being non-optional.

### 4. How it is verified (five gates + score + audit + signature)
1. **Schema gate**: pattern page frontmatter validates (pydantic); one repair pass, then discard (Living-Harness).
2. **Scope gate**: exactly one `role`; the Race Engineer may only propose edits to that role's skill folder for pages citing it (this is credit assignment made mechanical).
3. **Evidence gate**: every page must cite ≥1 Weave call ref whose evaluator score is a failure; Historian writes a Weave feedback item `call.feedback.add("pattern", {"id": "pattern-0042"})` on each cited call so the link is bidirectional and append-only.
4. **Constraint gate**: proposal diff must not touch `REGS.md`, the evaluator, sealed-circuit data, or another role's folder (Karpathy's read-only `prepare.py`; tampering taxonomy "protected artifact and state integrity").
5. **Merge gate**: semantic-hash dedup against existing pages; near-duplicates bump `occurrences` instead of creating a page.
6. **Score gate**: OFFICIAL (sealed circuit) strictly > `R_best` and no regression on prior circuits; MUSE-style `tests/` in the role's skill folder must pass before "fitting".
7. **Audit**: Scrutineer runs the 5×7 taxonomy classifier over the diff (F12 benchmark shows frontier LLM auditors reach ~90% acc / 9.4% FPR; budget model at ~3% cost) and records finding codes in `skill-impact.md`.
8. **Signature**: acceptance is a signed transition (Ed25519 over `{parent_hash, proposal_hash, official_score, scrutineer_verdict, round_id, ts}`), chained with a no-fork predecessor (MutMem). A tiny Python verifier replays the chain at season end = LINEAGE AUDIT.

### 5. How it feeds the next round
- **Skills recompiled from the wiki**: the Race Engineer's prompt receives only `wiki/index.md`, the pages whose `role` matches, and `skill-impact.md` — not traces. It emits a single atomic SKILL.md / `.memory.md` patch with `PURPOSE.md` listing cited pattern ids (WikiSkill). Bounded injection into the driver's harness: ≤3 "lessons" per role (Reflexion Ω).
- **Curriculum derived from the wiki**: rank open patterns by `d = (1−r)·occurrences` (MemSkill) → the next practice session over-samples the circuit families that trigger the top clusters; a `closed` page removes its circuit from the drill list; low OOD coverage (AWM 0.40) argues for injecting one new circuit family per round so the wiki keeps generalising.
- **Ghost car**: the notebook's delta cell reads `parent_version` from the registry entry — the visible gain is computed from lineage, not from the improver's report.
- **Upgrade scene trigger**: Registry alias `champion` added → W&B Automation webhook → game server plays the upgrade animation for that role; the payload carries the version and cited pattern ids so the scene can say *why*.

### 6. Real-vs-simulated boundary for 26 hours
Real: Weave traces + feedback, W&B runs/artifacts/registry/report, marimo notebook export, markdown wiki in git, signed JSON chain (hashlib + `cryptography`/PyNaCl Ed25519 ≈ 40 lines), LLM Historian and Race Engineer via Claude Code + W&B MCP. Simulated only: the tampering seed cases used to demo a BLACK FLAG if no natural one appears (label them as seeded in the report, per the audit paper's fault-seeding paradigm).

---

## Open gaps
- **WikiSkill pattern-page template is not published verbatim** (paper describes pages via a case study; the reference repo says only `append/replace/insert_after`). The schema above is a synthesis — UNVERIFIED as an official format.
- **DarwinX archive/ancestry record format** not in the abstract; full text not fetched (UNVERIFIED).
- **Which W&B "Skills" ship with the MCP server** — docs mention Skills as complementary but the page fetched lists no SKILL.md names (UNVERIFIED). Another thread (sponsor surfaces) should confirm.
- **molab programmatic upload API** — not documented on the molab page; GitHub-URL mirroring is the documented path (UNVERIFIED whether a CLI push exists).
- **W&B Reports API is Public Preview**; `report.url` exists in `interface.py` but the docs page example did not print it — test at build time. `WeaveBlock` construction args not verified from docs.
- **weave-docs.wandb.ai returned HTTP 403** to the fetcher; content taken from the docs.wandb.ai mirror instead (same docs).
- **Contextual Drag gives no prescriptive context recipe**; the "abstract, don't replay" rule is inferred from its findings + ReasoningBank/AWM, not stated by the paper.
- **MutMem is single-author, independent researcher, arXiv-only** — treat as a design pattern, not an audited standard; the Ed25519 + hash-chain scheme is standard enough to implement independently.
- Not covered here (other threads): component-level credit assignment methods (Who&When Pro, CAR, REFLECT), W&B Serverless RL/SFT for LoRA-level upgrades, TypeSafe/System1 surface.
