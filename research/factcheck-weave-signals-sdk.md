# Fact-check: "Weave custom Signals are role-named, agent-scoped, tag turns as they land — but Signals and Automations are UI-only and cannot be created from the SDK"

Checked 2026-09-03 against live docs.wandb.ai, wandb/docs (GitHub main), wandb/weave (GitHub master + tag v0.53.1), wandb/wandb (GitHub main), PyPI.

## Verdict

**Partially refuted.** The first half of the claim (user-named custom Signals that tag agent turns automatically, filterable by agent) is **supported**. The second half is **wrong for Signals and imprecise for Automations**:

- Signals are **UI-first, not UI-only**. A Signal is persisted as a `ClassifierMonitor` Weave object whose `op_names` contains the agent-span literal `"weave.genai.turn_ended"`. The Python SDK publicly exports `weave.Monitor` and `weave.ClassifierMonitor` with `.activate()`, and the public SDK reference documents them. Tests in the repo create a monitor on `weave.genai.turn_ended` from the SDK.
- Signal *results* are ordinary feedback rows (`feedback_type="wandb.agent_monitor"`, `scorer_tags=[...]`) and the public REST `POST /feedback/create` accepts `scorer_tags` / `scorer_tag_reasons` / `scorer_tag_confidences`, so tags can also be written programmatically by your own scorer.
- Weave **Automations** are UI-only per the docs ("You manage automations in the Weave UI, with no code changes required"). The `wandb` SDK's generated enum contains `WEAVE_METRIC_THRESHOLD` but exposes **no public `On…` event class** for it, so "Automations cannot be created from the SDK" holds for the public SDK today.
- The **TypeScript SDK has no Monitor class** (only vendored server-SDK resources for feedback and agent conversations), so SDK creation is Python-only.

## Evidence

### A. What the docs say about custom Signals (supports the first half)

Source: https://docs.wandb.ai/weave/guides/tracking/create-custom-signal (fetched 2026-09-03; raw at https://github.com/wandb/docs/blob/main/weave/guides/tracking/create-custom-signal.mdx)

- A custom signal "scores agent turns against a behavior you define, then shows that result as a tag in the Agents view."
- Created via UI: wandb.ai → project → **Agents** → **Signals** tab → **+ New signal** → **Custom Signal**.
- Form fields: **Tag name** (label shown in Agents view), **Definition** ("A prompt that describes the behavior you want the signal to detect"), **Scorer name**, **Inference model** (defaults to Serverless Inference, consumes W&B credits). Optional: additional tags in one signal, include tool calls in scoring context, **filters "by agent, operation, tool, or model"**, **sample rate**.
- After creation: "Weave scores matching turns" and "The tag appears in the Agents view."

Source: https://docs.wandb.ai/weave/guides/tracking/view-agent-signals (raw: wandb/docs `weave/guides/tracking/view-agent-signals.mdx`, fetched 2026-09-03)

- "Type | The part of the conversation that gets scored. Only `turn` is supported."
- Two signal categories: **Tags** ("Apply a label automatically to matching spans, such as `user-frustration` or `nsfw`") and **Ratings** (0–1 score).
- Preset tag templates: User Frustration, Malicious Intent (Jailbreaking), NSFW, Low Quality Response. Preset rating templates: User Satisfaction, User Good Intent, Safe-for-Work, Response Quality.
- "Each row represents the output of one of your signal monitors." (docs' own wording: signals are monitors)
- Troubleshooting: "Signal activity appears under **Traces** … check the scorer name and the **Status** column".

Source: https://docs.wandb.ai/weave/guides/evaluation/monitors (fetched 2026-09-03)

- "If you trace individual functions as Ops with the `@weave.op` decorator, Weave stores signal results as feedback on the Call object."
- "To get notified when a signal is triggered, set up an [automation](/weave/guides/evaluation/automations)."
- 13 built-in trace-level signals (Quality: Hallucination, Low quality, User frustration, Jailbreaking, NSFW, Lazy, Forgetful; Error: Network Error, Ratelimited, Request Too Large, Bad Request, Bad Response, Bug), scored by Serverless Inference, returned as "comma-delimited string tags".

Source: W&B Server release notes https://docs.wandb.ai/release-notes/server-releases (fetched 2026-09-03)
- 0.81.0 (June 2, 2026): "You can now create custom signals from the Weave UI. In the **Monitors** page, click **Add Signal**".
- 0.84.0 (Aug 25, 2026): "Weave monitors now support scoring all operations"; signal-tag management improvements.

### B. Signals are `ClassifierMonitor` objects, creatable from the Python SDK (refutes "UI-only")

1. Public SDK reference documents both classes. https://docs.wandb.ai/weave/reference/python-sdk (fetched 2026-09-03; SourceLink → weave v0.53.1):
   - `class Monitor` — "Sets up a monitor to score incoming calls automatically." Example verbatim:
     ```python
     import weave
     from weave.scorers import ValidJSONScorer
     json_scorer = ValidJSONScorer()
     my_monitor = weave.Monitor(
          name="my-monitor",
          description="This is a test monitor",
          sampling_rate=0.5,
          op_names=["my_op"],
          query={"$expr": {"$gt": [{"$getField": "started_at"}, {"$literal": 1742540400}]}},
          scorers=[json_scorer],
     )
     my_monitor.activate()
     ```
   - `class ClassifierMonitor` — "A monitor that merges multiple scorers into a single classifier. Classifier monitors combine prompts from multiple LLMAsAJudgeScorers targeting the same model into a single scoring call." Fields: `name, description, sampling_rate, scorers: list[Scorer], op_names: list[Literal['genai.turn_ended'] | str], query, is_traced, active, scorer_debounce_config, prompt_header (deprecated), prompt_footer (deprecated)`; methods `activate() -> ObjectRef`, `deactivate() -> ObjectRef`, `get_prompt_header(op_name)`, `get_prompt_footer()`.
   - NOTE the docs render the literal as `'genai.turn_ended'`; the source at both v0.53.1 and master is `AgentSpanOpName = Literal["weave.genai.turn_ended"]` (https://raw.githubusercontent.com/wandb/weave/v0.53.1/weave/flow/monitor.py line 22; master line 22). Use `"weave.genai.turn_ended"`.

2. Source, https://github.com/wandb/weave/blob/master/weave/flow/monitor.py (fetched 2026-09-03):
   - Comment: "Monitors can be configured to score agent spans by including an AgentSpanOpName in their `op_names` list."
   - `_normalized_op_names` docstring: "Both the UI and the scoring worker require full refs … Entries that are already `weave:///` refs, or agent-span literals like `"weave.genai.turn_ended"`, are returned unchanged."
   - `ClassifierMonitor.get_prompt_header()` picks `_AGENT_SPAN_CLASSIFIER_PROMPT_HEADER` (agent name/version/description, system instructions, input/output messages) when `op_name in AGENT_SPAN_OP_NAMES`.
   - `_CLASSIFIER_PROMPT_FOOTER`: JSON `{"classifiers": {"ExactName1": {"is_match", "confidence", "reason"}}}` — "Use the exact classifier name from each <classifier> tag." (tag name == classifier/scorer name)
   - `weave/__init__.py` exports `Monitor`, `ClassifierMonitor`, `start_conversation`, `start_turn`, `Scorer`, `publish` in `__all__`.

3. Server-side treats SDK and UI monitors identically. https://github.com/wandb/weave/blob/master/weave/trace_server/calls_query_builder/monitor_query_validation.py:
   - `MONITOR_OBJECT_CLASSES = frozenset({"Monitor", "ClassifierMonitor"})`
   - "agent monitors (op_names include an agent-span op) [validate] against the agent-spans schema … (the agent-signal 422)"; `_is_agent_monitor` = any op in `AGENT_SPAN_OP_NAMES`.

4. Tests create an agent-turn monitor from the SDK. https://github.com/wandb/weave/blob/master/tests/flow/test_monitor.py `test_preserves_full_refs_and_agent_spans`: `op_names=[full_ref, "weave.genai.turn_ended"]` → `monitor.activate().get().op_names == [full_ref, "weave.genai.turn_ended"]`. Serialization case in `tests/trace/data_serialization/test_cases/config_cases.py`: `ClassifierMonitor(name="test_classifier_monitor", sampling_rate=0.75, scorers=[], op_names=["weave.genai.turn_ended"], is_traced=False)`.

5. Judge scorer shape. https://github.com/wandb/weave/blob/master/weave/scorers/llm_as_a_judge_scorer.py: `LLMAsAJudgeScorer(Scorer)` with `model: LLMStructuredCompletionModel`, `scoring_prompt: str | MessagesPrompt`, media flags. `LLMStructuredCompletionModel` (`weave/trace_server/interface/builtin_object_classes/llm_structured_model.py`) has `llm_model_id: str | RefStr` and `default_params` (messages_template, temperature, max_tokens, …). Comment in scorer: "This matches the op-free shape the Weave UI already persists."

6. Signal results are feedback rows writable via REST. `weave/trace_server/interface/feedback_types.py`: `AGENT_MONITOR_FEEDBACK_TYPE = "wandb.agent_monitor"` ("scorer-applied"), `AGENT_USER_FEEDBACK_TYPE = "wandb.agent_user_feedback"` (human tags). `FeedbackCreateReq` (`weave/trace_server/trace_server_interface.py` ~L1199) has `scorer_tags: list[str]` ("Tags applied to the ref by a scorer", example `["nsfw","high-quality"]`), `scorer_tag_reasons`, `scorer_tag_confidences`, `runnable_ref`, `trigger_ref`, `call_ref`. REST endpoint `POST /feedback/create` is listed at https://docs.wandb.ai/weave/reference/service-api. Agents-view signal filters query `scorer_tags`/`scorer_ratings` (`weave/trace_server/query_builder/agent_signal_filters.py`). Client SDK `weave/trace/feedback.py` already writes `wandb.agent_user_feedback` with `scorer_tags=[emoji]` for reactions.

7. Docs position Signals as the successor of Monitors: https://docs.wandb.ai/weave/guides/evaluation/custom-monitors — "Custom monitors are the previous approach to monitoring production traffic. For new implementations, use **Signals** under Weave for Agents." The custom-monitor UI form (Scorer name, Judge model, Scoring prompt, Operations, Filter, Sampling rate) is the same object the SDK `Monitor` example creates.

### C. Automations (the clause holds, with one nuance)

- https://docs.wandb.ai/weave/guides/evaluation/automations ("Set up automations", fetched 2026-09-03): event type **Weave metric threshold** with source **Operation or Monitor**, comparator + threshold, time/count window, aggregation (mean/median/min); actions Slack or webhook; "You manage automations in the Weave UI, with no code changes required." No SDK/API path documented.
- `wandb` Python SDK automations (https://docs.wandb.ai/ref/python/automations/, `api.create_automation(event >> action, name=..., description=...)`) expose only `OnRunMetric`, `OnRunState`, `OnCreateArtifact`, `OnLinkArtifact`, `OnUnlinkArtifact`, `OnAddArtifactAlias`, `OnAddArtifactTag`, `OnRemoveArtifactTag`, `OnAddCollectionTag`, `OnRemoveCollectionTag` (https://github.com/wandb/wandb/blob/main/wandb/automations/events.py). The generated enum `wandb/automations/_generated/enums.py` contains `WEAVE_METRIC_THRESHOLD = "WEAVE_METRIC_THRESHOLD"` but no public event class wraps it → Weave automations are UI-only from the public SDK today (a GraphQL path exists but is UNVERIFIED/unsupported).
- https://docs.wandb.ai/models/automations/automation-events lists no Weave events.

### D. Other checks

- Weave Python SDK latest on PyPI: 0.53.8, uploaded 2026-09-03 (https://pypi.org/pypi/weave/json).
- W&B MCP server repo (wandb/mcp-server) has zero code hits for "monitor" — the MCP server cannot create Signals/Monitors (GitHub code search, 2026-09-03).
- TS SDK: GitHub code search for `Monitor` under `sdks/node` returns only vendored server-SDK files (`feedback.ts`, `agents/conversations.ts`) — no Monitor class.
- UNVERIFIED: the exact mapping of the Signals drawer fields to object fields (Tag name → `LLMAsAJudgeScorer.name`, Definition → `scoring_prompt`, Scorer name → `ClassifierMonitor.name`, agent filter → `query` over agent-span fields) is inferred from source; the scoring worker that merges `<classifier>` prompts is not in the public repo. Smoke-test one SDK-created `ClassifierMonitor` before H12 and confirm it appears in Agents → Signals.

## Exact correction for the design

Replace "Signals (and Automations) are UI-only and cannot be created from the SDK" with:

> Custom Signals are documented only through the Agents → Signals UI, but on the wire a Signal is a `ClassifierMonitor` object (`op_names=["weave.genai.turn_ended"]`, `scorers=[LLMAsAJudgeScorer(...)]`, optional `query` filter, `sampling_rate`) and the Python SDK publicly exports `weave.ClassifierMonitor`/`weave.Monitor` with `.activate()` (docs.wandb.ai/weave/reference/python-sdk). Role-named signals (`aero-context-miss`, `strategist-derail`) can therefore be created from Python in code, filtered per agent via `query`, and tags can additionally be written directly as `wandb.agent_monitor` feedback with `scorer_tags` via `POST /feedback/create`. Caveats: Python only (no TS Monitor class; MCP server has no monitor tool); the UI-field→object mapping is undocumented (verify with one smoke test; docs' type literal says `genai.turn_ended` but source says `weave.genai.turn_ended`). Weave **Automations** remain UI-only ("You manage automations in the Weave UI, with no code changes required"); the `wandb` SDK has no public Weave event class, only a generated `WEAVE_METRIC_THRESHOLD` enum.

Affected design spots: §2 'observe' row (drop "UI-only"; keep "created beforehand" as a choice, not a constraint); §4 'evaluate' Weave cell; §5 chain link 3; §7 H0–H1 C-column (Signals can be scripted in the setup step); §10 risk 'Signals and Automations are UI-only (Certain)' → split: Signals SDK-creatable (Likely, verify), Automations UI-only (Certain); Appendix correction (3).
