# R3 — W&B Weave exact surface as of 3 September 2026

Research thread for SCRUTINEER / "The Loop" (CoreWeave Hacks, Sept 13–14 2026). All claims below were pulled from live pages on 2026-09-03 (docs.wandb.ai, wandb.ai, github.com/wandb/*, npm) unless a different date is given. Python signatures marked **(source)** were read directly from `wandb/weave@master` via the GitHub API on 2026-09-03 because the rendered Python reference page 404s/403s. Anything I could not confirm is marked **UNVERIFIED**.

---

## 1. Summary

Weave in September 2026 is two products sharing one project:

1. **Weave for Agents** (the new, OTel-native data plane, marketing launch 28 Jul 2026): an **Agents view** with Agents → Conversations → Turns → LLM/Tool/SubAgent spans, a **Signals tab** (LLM-judge tags + 0–1 ratings on every turn, run on CoreWeave Serverless Inference, custom signals from a prompt), harness plugins (Claude Code, Codex, OpenClaw, Pi) and SDK autopatch (Claude Agent SDK, OpenAI Agents SDK, Google ADK), plus a direct OTLP endpoint. The MCP server exposes this plane through 8 extra tools gated by `WANDB_MCP_ENABLE_WEAVE_AGENT_TOOLS=true`.
2. **Classic Weave** (Ops/Calls/Traces): `weave.init` + `@weave.op`, `weave.Model`, `weave.Dataset`, `weave.Evaluation` + `weave.Scorer`, `EvaluationLogger`, built-in LLM-as-judge scorers, local (GPU) scorers, feedback/annotation API, leaderboards, versioned objects with tags + aliases (`weave.ref("name:production").get()`), Monitors (older path) and Automations (Slack/webhook on score thresholds).

Versions live today: Python `weave` **v0.53.7** (27 Aug 2026), TypeScript `weave` **0.16.7** (3 Sep 2026), MCP server **0.3.7** (10 Jul 2026), `wandb/skills` last commit 6 Aug 2026 (three skills: `wandb-primary`, `wandb-eval-tables`, `wandb-autoresearch`; Skill Bench runs on "W&B Agent Factory", which has no public docs).

For the F1 loop, Weave uniquely owns **observe** (Agents view + OTLP), **evaluate** (Evaluation/Scorer/EvaluationLogger + Signals on production turns), and **track** (versioned prompts/models/datasets with aliases like `production`, leaderboards, agent versions). It only partially serves **document** (Reports via MCP `create_wandb_report_tool`, `weave.set_view`, annotations) and does not itself execute **improve** (the docs route that to Serverless RL/SFT and to coding agents driven by W&B Skills + MCP).

---

## 2. Findings with citations

### F1. Tracing primitives: `weave.init` and `@weave.op` — exact signatures (source)

`weave/trace/api.py` (master, read 2026-09-03):

```python
def init(
    project_name: str,
    *,
    settings: UserSettings | dict[str, Any] | None = None,
    autopatch_settings: AutopatchSettings | None = None,
    postprocess_inputs: PostprocessInputsFunc | None = None,
    postprocess_output: PostprocessOutputFunc | None = None,
    attributes: dict[str, Any] | None = None,
    # Deprecated aliases — remove in a future release.
    global_postprocess_inputs: ..., global_postprocess_output: ..., global_attributes: ...,
) -> weave_client.WeaveClient:
```

`weave/trace/op.py`:

```python
def op(
    func=None, *,
    name: str | None = None,
    call_display_name: str | CallDisplayNameFunc | None = None,
    postprocess_inputs=None, postprocess_output=None,
    tracing_sample_rate: float = 1.0,
    enable_code_capture: bool = True,
    accumulator=None,
    kind: OpKind | None = None,
    color: OpColor | None = None,
    attributes: dict[str, Any] | None = None,
    eager_call_start: bool = False,
)
```

Other top-level functions in `api.py`: `publish(obj, name=None, tags=None, aliases=None) -> ObjectRef`, `ref(location)`, `get(uri)`, `attributes(dict)` (context manager), `set_view(name, content, extension=..., mimetype=...)` ("Attach a custom view to the current call summary at `_weave.views.<name>`"), `thread(thread_id)`, `finish()`, `add_tags/remove_tags/get_tags`, `set_aliases/remove_aliases/get_aliases`, `link_prompt_to_registry`.

Docs concept page: "Ops … A versioned, tracked function", "Calls … A logged execution of an Op", "Traces … Full trees of Calls that share the same execution context", "Threads … Collections of Traces for single sessions/conversations". Source: https://docs.wandb.ai/weave/guides/tracking/tracing (accessed 2026-09-03); signatures from https://github.com/wandb/weave/blob/master/weave/trace/api.py and `weave/trace/op.py` (2026-09-03).

### F2. Threads / turns for classic Ops

`with weave.thread(thread_id: Optional[str]) as thread_ctx:` returns a `ThreadContext` with `.thread_id` (auto UUID v7 if omitted). "Operations directly within a thread context become turns; nested decorated functions are tracked as lower-level calls." Query endpoint `POST /threads/query` with `project_id`, `limit`, `offset`, `sort_by` (thread_id, turn_count, start_time, last_updated). Source: https://docs.wandb.ai/weave/guides/tracking/threads (accessed 2026-09-03).

### F3. Weave for Agents — the conversation SDK (Agents view) and its OTel data model

Docs data-model table (verbatim structure): Agent → *(no span, grouped by `agent_name`)*; Conversation → `Conversation` *(grouped by `conversation_id`)*; Turn → `Turn` = OTel span `invoke_agent`; LLM call → `LLM` = `chat`; Tool call → `Tool` = `execute_tool`; Sub-agent call → `SubAgent` = `invoke_agent`. "A conversation groups turns by a shared `conversation_id` attribute rather than a parent span, so each turn starts its own OTel trace." "Each span is tagged with GenAI semantic-convention attributes like `gen_ai.agent.name` and `gen_ai.conversation.id`." "Weave accepts any OTel span, stores all attributes, and makes them queryable." Traces land at `https://wandb.ai/[TEAM]/[PROJECT]/weave/agents`. Source: https://docs.wandb.ai/weave/guides/tracking/trace-agents (accessed 2026-09-03).

Exact Python signatures **(source, `weave/conversation/conversation.py`, 2026-09-03)**:

```python
def start_conversation(*, agent_name: str = "", model: str = "", conversation_id: str = "",
                       conversation_name: str = "", include_content: bool = True,
                       continue_parent_trace: bool = False, attributes: Attributes = None) -> Conversation
def start_turn(*, user_message: str = "", model: str = "", agent_name: str = "",
               system_instructions: list[str] | None = None) -> Turn
def start_tool(*, name: str, arguments: str = "", tool_call_id: str = "") -> Tool
def start_llm(...); def start_subagent(...); def end_conversation(); def end_turn(); def end_llm()
def get_current_conversation(); get_current_turn(); get_current_llm()
def log_turn(*, conversation_id: str, agent_name="", conversation_name="", model="", agent_id="",
             agent_description="", agent_version="", messages=None, output_messages=None,
             system_instructions=None, spans: list[LLM|Tool|SubAgent]|None=None,
             started_at=None, ended_at=None, include_content=True, continue_parent_trace=False,
             attributes=None) -> LogResult      # "Imperatively emit one turn and its child spans to OTel."
def log_conversation(...)
```

`Turn` fields include `agent_name, model, agent_id, agent_description, agent_version, system_instructions, messages, output_messages, spans`. `start_conversation(attributes=...)` docstring: "``attributes`` are stamped on every span this conversation emits". Public exports (`weave/conversation/__init__.py`): `LLM, Conversation, Turn, Tool, SubAgent, Message, Usage, Reasoning, TextPart, ToolCallPart, ToolCallResponsePart, BlobPart, FilePart, UriPart, ReasoningPart, MediaAttachment, LogResult, agent_name_override, ...`.

Docs snippet (agent-evals page):

```python
from weave.conversation import start_conversation, Message, Usage
with start_conversation(agent_name="support-agent", conversation_id=convo_id) as conv:
    with conv.start_turn(user_message=user_message) as turn:
        with turn.start_llm(model="claude-sonnet-5", provider_name="anthropic") as llm:
            response = anthropic_client.messages.create(...)
            llm.record(input_messages=[...], output_messages=[...], usage=Usage(input_tokens=..., output_tokens=...))
        for call in response_tool_calls:
            with turn.start_tool(name=call.name, arguments=call.arguments) as tool:
                tool.result = run_tool(call)
```

Source: https://docs.wandb.ai/weave/agent-evals (accessed 2026-09-03). TypeScript mirrors: `weave.startTurn`, `weave.startLLM({model, providerName})`, `weave.startTool({name, args, toolCallId})`, `.end()` idempotent (trace-agents page).

Relevance: `agent_name` = the F1 role (aerodynamicist, strategist…), `agent_version` = the upgrade generation, `conversation_id` = the race weekend. That is the exact key set the Scrutineer needs for role-level credit assignment.

### F4. Agents view contents

"The Agents tab presents a high-level view of all agents that have logged traces to this project" as a card grid showing "how many distinct versions of that agent have been deployed"; Conversations tab "one row per conversation"; turn detail shows "each turn in chronological order, numbered from 1" and "the number of intermediate responses and tool calls"; Spans tab shows "a hierarchical trace tree"; metrics: "input and output token counts and cost", "average end-to-end duration per invocation", "percentage of invocations that returned an error"; filters by "agent, model, error status" and "custom attributes" stamped on spans. Source: https://docs.wandb.ai/weave/guides/tracking/view-agent-activity (accessed 2026-09-03). Marketing: "Weave now brings sessions, turns, steps, tools, and sub-agents as first-class concepts" — https://wandb.ai/site/weave/ (accessed 2026-09-03). Launch post dated 28 Jul 2026: "Sessions, turns, and steps as first-class concepts rolling up into agents"; "Offline evals are dead. Long live online evals." — https://wandb.ai/wandb_fc/product-announcements-fc/reports/New-in-W-B-Weave-Observability-and-continuous-improvement-for-production-agents--VmlldzoxNzAzMTcxNg

### F5. Which agent SDKs / harnesses are integrated (Agents view)

Quickstart page: **Agent harnesses** (plugin/extension): Claude Code plugin, Codex plugin, OpenClaw plugin, Pi extension. **Agent SDKs** (autopatched by `weave.init("[TEAM]/[PROJECT]")`): OpenAI Agents SDK, Claude Agent SDK, Google ADK (the list continues; the page was truncated after OpenAI Agents SDK but the integrations overview names all three under "Trace agents"). Source: https://docs.wandb.ai/weave/agent-integration-quickstart and https://docs.wandb.ai/weave/guides/integrations (accessed 2026-09-03). The integrations overview's full framework list: OpenAI Agents SDK, Claude Agent SDK, Claude Code, LangChain, LlamaIndex, Haystack, DSPy, Instructor, CrewAI, Smolagents, PydanticAI, Google ADK, AutoGen, Verdict, TypeScript SDK, Vercel AI SDK, Agno, Koog; RL framework: **Verifiers**; protocols: MCP (and A2A "coming soon" per https://wandb.ai/site/agents/).

Claude Agent SDK: "The Weave SDK autopatches the Claude Agent SDK for Python"; TS: "Weave automatically instruments `query()` via module loader hooks" — CommonJS "Require `weave` before `@anthropic-ai/claude-agent-sdk`", ESM "Start Node with the `--import=weave/instrument` flag"; multi-turn sessions group by passing `resume` with the first turn's `session_id`. Source: https://docs.wandb.ai/weave/guides/integrations/agents/claude-agents-sdk (accessed 2026-09-03). Release v0.53.6 (13 Aug 2026): "trace Claude Agent SDK subagents" — https://github.com/wandb/weave/releases.

Claude Code plugin: `npm install -g weave-claude-code && weave-claude-code install`; config via `weave-claude-code config set weave_project [TEAM]/[PROJECT]`, `agent_name`; env `WEAVE_PROJECT`, `WANDB_API_KEY`, `WEAVE_AGENT_NAME`. Span tree: `invoke_agent claude-code` root per user prompt, `chat <model>`, `execute_tool <tool_name>`, `invoke_agent <subagent_type>`; "multi-turn conversations are stitched together server-side via `gen_ai.conversation.id`"; ships to `/agents/otel/v1/traces`. Warning on the docs page: "PII scrubbing and sensitive-data redaction aren't implemented." Sources: https://docs.wandb.ai/weave/guides/integrations/agents/claude-code-harness and https://github.com/wandb/weave-claude-code (last commit 17 Aug 2026).

OpenAI Agents SDK: Python needs only `weave.init(...)`; TS: `import { createOpenAIAgentsTracingProcessor } from "weave"; addTraceProcessor(createOpenAIAgentsTracingProcessor())`. "Each turn rendered as an `invoke_agent` span with nested `chat` and `execute_tool` children." Source: https://docs.wandb.ai/weave/guides/integrations/agents/openai_agents (accessed 2026-09-03).

### F6. Raw OTel / OTLP endpoint

Multi-tenant endpoint: **`https://trace.wandb.ai/otel/v1/traces`** (dedicated: `https://<subdomain>.wandb.io/traces/otel/v1/traces`); headers `wandb-api-key` and `Content-Type: application/x-protobuf`; resource attributes `wandb.entity`, `wandb.project`; recognised attribute families: `gen_ai.*`, `openinference.*`, `llm.*`, `ai.*` (Vercel AI SDK), `mlflow.*`, `traceloop.*`, `gcp.vertex.agent.*`, `pydantic_ai.*`, `langfuse.*`. Limitation: "The Weave UI does not support rendering OTel trace tool calls in the Chat view. They appear as raw JSON instead." Thread grouping needs `wandb.thread_id` and `wandb.is_turn` span attributes. Source: https://docs.wandb.ai/weave/guides/tracking/otel (accessed 2026-09-03). The Claude Code plugin README shows the Agents-plane path is `/agents/otel/v1/traces` (https://github.com/wandb/weave-claude-code, 2026-09-03).

### F7. Signals — built-in failure-mode signals (two generations)

**New (Agents view → Signals tab)**: "Rating: A numeric score between 0.0 and 1.0 assigned to a matching span. Tags: Labels assigned to matching spans, such as 'user-frustration' or 'nsfw'." Tag presets: **User Frustration**, **Malicious Intent (Jailbreaking)**, **NSFW**, **Low Quality Response**. Rating presets: **User Satisfaction**, **User Good Intent**, **Safe-for-Work**, **Response Quality**. Manage drawer ("1 active signals") lets you toggle/edit/delete. "Signal activity appears under **Traces** in the project sidebar… check the scorer name and the **Status** column for error conditions." Source: https://docs.wandb.ai/weave/guides/tracking/view-agent-signals (accessed 2026-09-03).

**Custom signal** fields: "Tag name", "Definition: A prompt that describes the behavior you want the signal to detect", "Scorer name", "Inference model: The model used to score matching turns. Serverless Inference is the default", optional "Include tool calls", "Scope filters … by agent, operation, tool, or model", "Sample rate … the fraction of matching agent turns the signal scores". "The tag appears in the Agents view, including on the Signals tab." UI only; no code/API documented. Source: https://docs.wandb.ai/weave/guides/tracking/create-custom-signal (accessed 2026-09-03).

**Previous generation (Monitors page, still live, marked "previous approach")**: 13 preset signals — Quality (7): Hallucination, Low quality, User frustration, Jailbreaking, NSFW, Lazy, Forgetful; Error (6): Network Error, Ratelimited, Request Too Large, Bad Request, Bad Response, Bug. Mechanics: "Quality signals evaluate successful root-level traces. Error signals evaluate failed traces. Weave doesn't score child spans and intermediate Calls." "Weave constructs a prompt that includes the trace metadata, inputs, outputs, exception details (if any), and the operation's source code." "a Serverless Inference model performs a binary classification… Detected issues are returned as comma-delimited string tags (for example, `"Low-quality, User-frustration, Forgetful"`)." "When multiple signals from the same group… Weave batches the signals into a single LLM call." "Processing is powered by CoreWeave compute and CoreWeave GPUs." Results are "feedback on the Call object"; the classifier call's Output has `classifier_meta` with confidence (e.g. 0.9) and reason. Source: https://docs.wandb.ai/weave/guides/evaluation/monitors (accessed 2026-09-03).

### F8. Online evaluation on production traffic: custom Monitors, guardrails, Automations

Custom monitor (UI): Operations (one or more `@weave.op`s), Filter, "Sampling rate: The percentage of calls to score (0% to 100%)", LLM-as-a-judge config (Scorer name, model incl. audio/image scoring with "Media Scoring JSON Paths"). "Monitors automatically store all scoring results in Weave's database." Source: https://docs.wandb.ai/weave/guides/evaluation/custom-monitors (accessed 2026-09-03).

Guardrail path in code: `result, call = generate_text.call("prompt"); score = await call.apply_scorer(MyScorer())`; "Scorer results are automatically stored as feedback"; retrieval `client.get_calls(scored_by=["ScorerName"], include_feedback=True)`. Source: https://docs.wandb.ai/weave/guides/evaluation/scorers (accessed 2026-09-03).

Automations (UI, no code): "Threshold alert: Send a Slack notification when a monitor's average score crosses a threshold", "Regression detection", "Deployment gate: Trigger a webhook when a quality metric exceeds a confidence threshold over a rolling window", "Operational monitoring". Actions: Slack channel or Webhook (name + payload). Source: https://docs.wandb.ai/weave/guides/evaluation/automations (accessed 2026-09-03). MCP tools `list_wandb_automations_tool` and `list_wandb_integrations_tool` can read them (README, 2026-09-03).

### F9. Evaluation, Model, Scorer, EvaluationLogger

`weave.Evaluation(dataset=..., scorers=[...], evaluation_name=None, preprocess_model_input=None, trials=N)`; run with `asyncio.run(evaluation.evaluate(model))`. `weave.Model` subclasses declare typed attributes and a `@weave.op() def predict(self, ...)`; "New model versions are automatically created when you change the parameters or the code that defines your model." `weave serve [MODEL-REF]`. Scorer contract: `class MyScorer(weave.Scorer): @weave.op def score(self, output, **kwargs) -> dict`; optional `summarize(self, score_rows) -> dict`; `column_map={"text": "news_article"}`. Sources: https://docs.wandb.ai/weave/guides/core-types/evaluations, https://docs.wandb.ai/weave/guides/core-types/models, https://docs.wandb.ai/weave/guides/evaluation/scorers (accessed 2026-09-03).

Imperative API: `EvaluationLogger(model="my_model", dataset="my_dataset")` (also `name`, `description`, `scorers`, `attributes`); `pred = ev.log_prediction(inputs=..., output=...)`; `pred.log_score(scorer="correctness", score=...)`; `pred.finish()`; `ev.log_summary({...})`; `log_example(inputs, output, scores)` Python-only. The agent-evals page uses it as a context manager and attaches an LLM judge over the full transcript: `with ev.log_prediction(inputs=task) as pred: … pred.log_score("task_completion", judge_task_completion(task, transcript))`; results show in the **Evals** tab with a "View spans" button into the Agents page. Sources: https://docs.wandb.ai/weave/guides/evaluation/evaluation_logger and https://docs.wandb.ai/weave/agent-evals (accessed 2026-09-03). Release v0.53.3 (31 Jul 2026): "link stamped agent spans to eval results"; v0.53.7 (27 Aug 2026): "allow score tracing to be disabled in imperative evals" — https://github.com/wandb/weave/releases.

### F10. LLM-as-judge and local scorers shipped in `weave.scorers`

LLM (litellm `model_id`, e.g. `"openai/gpt-4o"`, `"anthropic/claude-3-5-sonnet-20240620"`): `HallucinationFreeScorer`, `SummarizationScorer`, `OpenAIModerationScorer`, `EmbeddingSimilarityScorer(model_id, threshold=0.5)`, `ValidJSONScorer`, `ValidXMLScorer`, `PydanticScorer(model=...)`, RAGAS `ContextEntityRecallScorer`, `ContextRelevancyScorer`. "The built-in scorers are calibrated using OpenAI models." Source: https://docs.wandb.ai/weave/guides/evaluation/builtin_scorers (accessed 2026-09-03). Local (`pip install weave[scorers]`, GPU recommended, Python only): `WeaveToxicityScorerV1`, `WeaveBiasScorerV1`, `WeaveHallucinationScorerV1`, `WeaveContextRelevanceScorerV1`, `WeaveCoherenceScorerV1`, `WeaveFluencyScorerV1`, `WeaveTrustScorerV1`, `PresidioScorer`. Source: https://docs.wandb.ai/weave/guides/evaluation/weave_local_scorers (accessed 2026-09-03).

### F11. Datasets

`weave.Dataset(name='grammar', rows=[{...}])`; `weave.publish(dataset)`; `weave.ref('dataset_name').get()`; `Dataset.from_calls([call1, call2])`; `Dataset.from_pandas(df)` / `to_pandas()`; `Dataset.from_hf` / `to_hf` (`pip install weave[huggingface]`); `dataset.select([0, 2])`. "Editing produces new versioned datasets while preserving previous versions." Source: https://docs.wandb.ai/weave/guides/core-types/datasets (accessed 2026-09-03). `Dataset.from_calls` is the direct bridge from flagged production turns to a held-out set.

### F12. Prompt / object registry, versioning, aliases, tags

`weave.StringPrompt("Solve {equation}")`, `weave.MessagesPrompt([...])`, `.format(...)`, `weave.publish(prompt, name="my-prompt")`. Ref URI: `weave:///[TEAM]/[PROJECT]/object/[OBJECT-NAME]:[VERSION]` where version is a hash, `v0`/`v1`, or alias (`:latest`). Aliases are unique pointers; tags are many-per-version:

```python
client = weave.init('team/project')
v0_ref = weave.publish(weave.StringPrompt("Answer the user's question: {question}"), name="my-prompt")
client.set_aliases(v1_ref, "production")
client.add_tags(v0_ref, ["reviewed", "passed-eval"])
prompt = weave.ref("my-prompt:production").get()
```

Recommended promotion workflow: "1. Develop and test a new prompt version. 2. Evaluate… 3. Move the `production` alias to the new version with `client.set_aliases(new_ref, 'production')`." Side-by-side prompt diffs live under Assets → Prompts → Versions. Prompts can be linked into the W&B Registry (`weave.link_prompt_to_registry`, source). Sources: https://docs.wandb.ai/weave/guides/core-types/prompts, https://docs.wandb.ai/weave/guides/core-types/prompts-version, https://docs.wandb.ai/weave/guides/tracking/objects (accessed 2026-09-03).

### F13. Feedback and human annotations

`call.feedback.add_reaction("👍")`, `call.feedback.add_note("...")` (≤1024 chars), `call.feedback.add("[LABEL]", {...})` (JSON ≤1 KB), `call.feedback.purge(uuid)`; `client.get_feedback(reaction=...)`. Annotation templates: `AnnotationSpec(name, description, field_schema)` published via `weave.publish(spec, "scorer-id")`, applied with `call.feedback.add(feedback_type="wandb.annotation."+spec.name, payload={"value": 1}, annotation_ref=spec.uri())`. "TypeScript SDK lacks feedback support." Source: https://docs.wandb.ai/weave/guides/tracking/feedback (accessed 2026-09-03). Agents plane: release v0.53.2 (16 Jul 2026) "first-class sdk feedback for agent spans + turns" — https://github.com/wandb/weave/releases; the Conversation detail view "shows all turns, its LLM calls, tool executions, token counts, and any attached feedback" (trace-agents page).

### F14. Leaderboards and comparison

```python
from weave.flow import leaderboard
spec = leaderboard.Leaderboard(name="My Leaderboard", description="...", columns=[
    leaderboard.LeaderboardColumn(evaluation_object_ref=get_ref(evaluation).uri(),
                                  scorer_name="jaccard_similarity", summary_metric_path="mean")])
weave.publish(spec)
results = leaderboard.get_leaderboard_results(spec, client)
```

Source: https://docs.wandb.ai/weave/guides/core-types/leaderboards (accessed 2026-09-03). Object comparison UI: baseline = "all objects are compared to the leftmost object", max six objects, "Diff only" toggle, UI-only. Source: https://docs.wandb.ai/weave/guides/tools/comparison (accessed 2026-09-03). Agents view also counts "how many distinct versions of that agent have been deployed" (F4) and the MCP tool `list_weave_agent_versions_tool` answers "Did v2 of my agent regress on latency?" (F15).

### F15. MCP server — full tool list, install, and the agent-tools flag

Hosted: `claude mcp add --transport http wandb https://mcp.withwandb.com/mcp --scope user --header "Authorization: Bearer <api-key>"`; local: `uvx --from git+https://github.com/wandb/wandb-mcp-server wandb_mcp_server`; HTTP mode `uvx wandb_mcp_server --transport http --host 0.0.0.0 --port 8080`.

Core tools (16): `infer_trace_schema_tool`, `query_weave_traces_tool` (`detail_level` = `"schema"|"summary"|"full"`, plus `columns`, `filters`, `limit`, `truncate_length`), `count_weave_traces_tool`, `query_wandb_tool`, `get_run_history_tool`, `create_wandb_report_tool` (accepts `panels`, `panel_grid`, `heading`, `markdown`), `log_analysis_to_wandb`, `search_wandb_docs_tool`, `query_wandb_entity_projects`, `list_registries_tool`, `list_registry_collections_tool`, `list_artifact_versions_tool`, `get_artifact_details_tool`, `compare_artifact_versions_tool`, `list_wandb_automations_tool`, `list_wandb_integrations_tool`.

Weave Agents (OTel) tools (8, off by default, `WANDB_MCP_ENABLE_WEAVE_AGENT_TOOLS=true`): `list_weave_agents_tool` ("aggregated stats (invocations, tokens, duration, errors)"), `list_weave_agent_versions_tool`, `query_weave_agent_spans_tool`, `get_weave_agent_span_stats_tool` ("tokens, cost, latency, error rate"), `list_weave_agent_custom_attributes_tool`, `search_weave_agents_tool`, `get_weave_agent_trace_tool` ("Structured chat/trajectory view for one trace (a turn)"), `get_weave_agent_conversation_tool`. Other env: `WANDB_MCP_READ_ONLY=true` (drops the two write tools), `WANDB_MCP_ENABLE_WEAVE_TOOLS`, `WANDB_MCP_PROXY_DOCS`, `MAX_RESPONSE_TOKENS`, `WANDB_BASE_URL`. No sandbox/code-execution tool exists in this README. Source: https://github.com/wandb/wandb-mcp-server README (last commit 10 Jul 2026, "staging/0.3.7"), read 2026-09-03.

### F16. W&B Skills, Skill Bench, Agent Factory

Repo `wandb/skills` (last commit 6 Aug 2026: "feat(skills): add wandb-eval-tables and wandb-autoresearch"). Install `npx skills add wandb/skills` (docs variant: `npx skills add wandb/skills --agent claude-code --skill '*' --yes --global`), needs `WANDB_API_KEY`; floors `Python>=3.13`, `wandb>=0.28.1`, `weave>=0.52.41`. Skills: **wandb-primary** "Broad W&B project analysis and operations across runs, Artifacts, Registry, Weave, Reports, Workspaces, and Launch"; **wandb-eval-tables** "Non-destructive conversion of W&B Table artifacts into bounded, verified EvalTable previews"; **wandb-autoresearch** "Bounded training research through W&B Launch, including readiness checks, serial trials, comparison, and resumable state" — all "experimental". Autoresearch SKILL.md rules: readiness gate "launchable code + queue with usable capacity"; "Run trials serially unless the user explicitly authorizes parallel compute"; "Never fabricate a run, metric, queue result, or completion state"; state file synced via `uv run --with wandb python skills/wandb-autoresearch/scripts/autoresearch_state.py save ENTITY PROJECT --path AUTORESEARCH_STATE.md`. wandb-primary: "A W&B project has two complementary surfaces — runs (`wandb.Api()`) and Weave traces (`weave.init()` → `client.get_calls()`)".

Skill Bench: "Skill Bench uses W&B Agent Factory as the eval runtime for task definitions, agent profiles, sandbox execution, and structured bench rows." CLI `python3 -m skillbench.cli plan --wbaf-root ../WandBAgentFactory --candidate-ref HEAD --skill wandb-primary`; `skillbench/` has `gates.py` (pass/warn/fail on "must-pass regressions"), `compare.py`, `wbaf_eval` adapter (`--profile smoke`). Benchmarks table: Weave analysis 26 tasks — Claude Code (sonnet4.6) 97%, Codex (gpt-5.3-codex) 63%; Failure & outlier detection 8 tasks — 86% / 63%. Badges: Claude Code 31/34 (91%), Codex 25/34 (74%). Source: https://github.com/wandb/skills (read 2026-09-03); docs https://docs.wandb.ai/platform/wb-skills (supported agents "Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI"); announcement https://wandb.ai/wandb_fc/product-announcements-fc/reports/Introducing-W-B-Skills-for-Claude-Code-Codex-and-other-coding-agents--VmlldzoxNjE1NDk4MA ("Last updated: March 12, 2026"). **W&B Agent Factory has no public repo or docs page** (search 2026-09-03) — UNVERIFIED beyond the skills README.

### F17. TypeScript SDK

npm `weave` **0.16.7**, modified 2026-09-03T20:46Z (`npm view weave`). `npm install weave`; `weave.init('project')`; `weave.op(fn)`; auto-instrumentation "Weave automatically patches supported libraries such as OpenAI when it loads"; manual `wrapOpenAI(new OpenAI())`; ESM needs `node --import=weave/instrument`. Agent SDK helpers `startTurn/startLLM/startTool`, `createOpenAIAgentsTracingProcessor`, `EvaluationLogger({name, model, dataset})`, `Evaluation` with `nTrials`. Gaps: no feedback API, `weave.Model` "not yet available", local scorers Python-only, object aliases/tags "TypeScript support for most operations remains limited". Sources: https://docs.wandb.ai/weave/guides/integrations/js, https://docs.wandb.ai/weave/guides/tracking/feedback, https://docs.wandb.ai/weave/guides/core-types/models, https://github.com/wandb/weave/tree/master/sdks/node (accessed 2026-09-03). Release v0.53.7 changelog: "feat(weave_ts): record the agent span that invoked a call", "add GenAI span error helpers".

### F18. Pricing / quotas relevant to a 26-hour hackathon

Free tier: "Weave data ingestion 1 GB/mo", storage "5 GB/mo", "Up to 5" seats; overage "Additional data ingestion $0.10/MB"; academic: "up to 25GB/mo of Weave data ingestion". Source: https://wandb.ai/site/pricing (accessed 2026-09-03). Ingested bytes "includes trace metadata and LLM inputs/outputs" (search snippet of same page). API rate limits: free "50 requests per minute", paid "200 requests per minute" (https://docs.wandb.ai/guides/track/limits/, older page, date not shown). Weave behaviour: "Weave retries requests starting at 1 second… up to 5 minutes", "Requests time out after 36 hours", "Weave sometimes truncates large trace data objects" (https://docs.wandb.ai/weave/details/limits, accessed 2026-09-03). Signals: "each scoring call has an associated cost" (custom-monitors page); no per-signal price published. No hackathon-specific quota found — UNVERIFIED whether CoreWeave Hacks grants credits.

### F19. How W&B/CoreWeave frame the loop (their words)

CoreWeave press release 28 May 2026: "W&B Weave serves as the observability layer for the continuous loop between production behavior and agent improvement"; "W&B Skills and MCP server turn general-purpose coding agents into AI researchers and agent builders that work around the clock." https://www.coreweave.com/news/coreweave-closes-the-training-to-inference-gap-for-autonomous-agent-improvement. CoreWeave blog 25 Aug 2026: "The imperative evaluation API enables measuring every harness and model improvement with confidence"; loop = launch → observe → evaluate → "autonomously improving via serverless RL training" → redeploy, "a closed feedback loop between training and inference". https://www.coreweave.com/blog/coreweave-closes-the-loop-between-training-and-inference. Weave docs (monitors page): "Accelerate the research loop. Use the scores and failure analyses generated by signals to identify weaknesses." Companion tool `wandb/weave-error-analysis` (last commit 26 Mar 2026): "bottom-up failure mode discovery for AI agents" — Synthetic queries → run agent → "Review in Weave" (deep links filtered by `batch_id`) → "Taxonomy Tab — Categorize Failures into named modes with severity". https://github.com/wandb/weave-error-analysis. Release notes hint at unreleased server-side clustering ("signature cluster tables", "intent judge", "failure judge", "insights events") in v0.53.7 — UNVERIFIED as a user-facing feature.

---

## 3. Design implications for the F1 loop (which verb each Weave feature uniquely serves)

| Loop verb | Weave feature that uniquely owns it | Concrete artifact |
|---|---|---|
| **Observe** | Agents view via `weave.conversation` (`start_conversation(agent_name=<role>, conversation_id=<race_id>, attributes={"generation": n, "car_part": ...})`, `log_turn(agent_version=...)`) and/or OTLP to `trace.wandb.ai/otel/v1/traces` with `gen_ai.agent.name` per role. The Claude Code plugin gives the outer improver's own session as `invoke_agent claude-code` for free. | FIA TELEMETRY = the Agents tab URL `wandb.ai/<team>/<proj>/weave/agents`, read-only to the improver (MCP server in `WANDB_MCP_READ_ONLY=true` + agent tools on). |
| **Evaluate (offline / QUALIFYING & RACE)** | `weave.Evaluation` / `EvaluationLogger` with `trials`, `preprocess_model_input`, judge scorers; `Dataset.from_calls` to mint the SEALED CIRCUIT from flagged production turns. | Evals tab rows per generation; "View spans" links each score to the turn tree. |
| **Evaluate (online / RACE CONTROL)** | Signals on production turns: presets (User Frustration, Jailbreaking, NSFW, Low Quality; ratings User Satisfaction/Response Quality) + custom tag signals with scope filter **by agent** and sample rate. Automations → webhook = BLACK FLAG trigger. | Signals tab tags per role; automation webhook payload to the Scrutineer. |
| **Track** | Versioned objects with aliases/tags: `weave.publish(prompt, name="aero-skill", tags=["gen-7"])`, `client.set_aliases(ref, "production")`; `weave.Model` auto-versions on attribute/code change; `agent_version` on turns; leaderboards. | CONSTRUCTORS' CHAMPIONSHIP = `Leaderboard` object; PARC FERMÉ = the `production` alias frozen during RACE. |
| **Document** | Partial: `weave.set_view("readme", md, extension="md")` attaches Markdown to a call; annotations (`AnnotationSpec`) and notes on turns; MCP `create_wandb_report_tool` writes a W&B Report with panels. Weave has no notebook/wiki product → this is where marimo/molab should own the artifact and Weave supplies the evidence. | Per-generation Report + `readme` view on the winning eval call. |
| **Improve** | Not a Weave primitive. Docs route it to (a) a coding agent running W&B Skills over the MCP server (`query_weave_traces_tool` → propose harness diff), and (b) Serverless RL/SFT for weights. Weave's role is to prove the improvement (`Evaluation` + leaderboard + `set_aliases`). | Upgrade package = new object version + alias move, gated by an Automation "deployment gate". |

Practical constraints to design around:

1. **Credit assignment key**: use one `agent_name` per role and stamp `attributes={"role": ..., "part": ..., "generation": ...}` at `start_conversation`; custom signals can be scoped "by agent, operation, tool, or model", so a role-specific failure signal (e.g. "Strategist called pit tool with stale tyre data") fires only on that role's turns. `list_weave_agent_versions_tool` gives per-version regressions per role.
2. **Two data planes**: Agents-view spans are not classic Calls. Classic `Evaluation`, `Dataset.from_calls`, `call.feedback`, `apply_scorer` operate on Calls; Signals/agent tools operate on OTel spans. Bridge = `EvaluationLogger` inside a `start_conversation` (docs agent-evals pattern), which links eval rows to spans.
3. **Budget**: 1 GB/mo free ingestion; set `include_content=False` or `postprocess_output` on bulky roles, and use `tracing_sample_rate` on chatty ops. Signals/custom monitors each cost an inference call; use sample rate.
4. **Immutability for the Scrutineer**: the improver's MCP connection should run with `WANDB_MCP_READ_ONLY=true` (write tools removed); only the Scrutineer process holds the API key that can `set_aliases`.
5. **TypeScript is fine for the broadcast front end only**: no feedback API, no `weave.Model`, limited alias/tag support — keep the loop control plane in Python.

---

## 4. Open gaps

- **No programmatic API for Signals or Automations** is documented (UI only). If the Scrutineer must create a role-specific signal at runtime, it will need the UI beforehand or an undocumented endpoint — UNVERIFIED.
- **W&B Agent Factory** exists only as a name in `wandb/skills` (`--wbaf-root ../WandBAgentFactory`); no public repo/docs found on 2026-09-03.
- **Serverless Inference model behind Signals** is unnamed; per-signal cost undisclosed.
- **Server-side failure clustering / "insights"** appears in v0.53.7 changelog but not in docs — do not promise it on stage.
- **Hackathon credits/quotas** for Weave ingestion were not published anywhere I could find.
- **OTel chat rendering**: raw OTLP tool calls "appear as raw JSON" in the Chat view; prefer the `weave.conversation` SDK or an integrated SDK for the demo.
- The Python reference page (`/weave/reference/python-sdk/weave/`) returned 404/403 on both docs domains; signatures above are from source at master and may drift before Sept 13.
