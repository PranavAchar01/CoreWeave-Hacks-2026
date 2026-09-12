# Fact-check: "Weave custom Signals are UI-only and cannot be created from the SDK"

Checked 2026-09-03 against live docs.wandb.ai pages, the `wandb/weave` and `wandb/wandb` GitHub sources, and PyPI.

## Claim under test

> Weave supports user-created, role-named custom Signals (e.g. `aero-context-miss`, `strategist-derail`) that tag turns as they land, scoped by agent — but Signals (and Automations) are UI-only and cannot be created from the SDK.

Cited in the design at: §2 verb table 'observe' row; §4 matrix 'evaluate' Weave cell; §5 chain link 3 'Signal'; §7 H0–H1 C-column; §10 risk "Signals and Automations are UI-only (Certain)"; Appendix correction (3).

## Verdict: REFUTED in part (the "cannot be created from the SDK" clause is false; the rest holds)

| Sub-claim | Status | Evidence |
|---|---|---|
| Custom Signals exist, are user-named, tag agent turns as they arrive | SUPPORTED | docs.wandb.ai/weave/guides/tracking/create-custom-signal (fetched 2026-09-03) |
| Signals can be scoped by agent | SUPPORTED | Same page: filters "by agent, operation, tool, or model" |
| Signals are UI-only / cannot be created from the SDK | **REFUTED** | `weave.Monitor` / `weave.ClassifierMonitor` with `op_names=["weave.genai.turn_ended"]`, published via `activate()`/`weave.publish()`, is the object that backs agent signals. Documented in the SDK reference and present in weave 0.53.x. |
| Weave Automations are UI-only | SUPPORTED (Weave scope) | docs.wandb.ai/weave/guides/evaluation/automations: "You manage automations in the Weave UI, with no code changes required." No automation endpoints in `trace_server_interface.py`. |
| Automations in general cannot be created from an SDK | IMPRECISE | W&B *Models* automations have a full Python API (`wandb.automations`, `Api.create_automation`), but only for run/artifact events, not Weave monitor metrics. |

## Evidence

### 1. What the Signals docs say (UI path — the docs do describe only the UI)

**Create a custom signal** — https://docs.wandb.ai/weave/guides/tracking/create-custom-signal (fetched 2026-09-03)

- Intro: "Create a custom W&B Weave signal to tag agent turns for a behavior you define."
- UI path: wandb.ai → project → Weave sidebar **Agents** → **Signals** tab → **+ New signal** → **Custom Signal** drawer.
- Fields: **Tag name** ("The label that appears in the Agents view"), **Definition** (LLM prompt), **Scorer name** ("The name for the underlying scorer object"), **Inference model or custom runtime** (Serverless Inference default, consumes credits), optional **Include tool calls**, optional **Only score turns matching** — "add one or more filters to restrict which turns the signal scores, for example by agent, operation, tool, or model", optional **Sample rate**.
- "After you create the signal, Weave scores matching turns. The tag appears in the Agents view, including on the Signals tab."
- No SDK/REST path is mentioned on this page. The design's "UI-only" reading came from this page's silence, not from any explicit statement.

**Monitor your agents with signals** — https://docs.wandb.ai/weave/guides/tracking/view-agent-signals (fetched 2026-09-03)

- "Each row represents the output of one of your signal monitors." (Signals are monitors.)
- Two kinds: **Tags** (labels such as `user-frustration`, `nsfw`) and **Ratings** (0.0–1.0).
- Preset tag templates: User Frustration, Malicious Intent (Jailbreaking), NSFW, Low Quality Response. Preset ratings: User Satisfaction, User Good Intent, Safe-for-Work, Response Quality.
- Filter bar narrows by "scorer, agent, score range, or time period". Type column: "Only `turn` is supported."

**Legacy pages** — https://docs.wandb.ai/weave/guides/evaluation/monitors and https://docs.wandb.ai/weave/guides/evaluation/custom-monitors (fetched 2026-09-03) both carry the note: "This page covers a previous approach to monitoring production traffic. For new implementations, use **Signals** under Weave for Agents." Custom monitors page: "Monitors require no code changes to your application. Set them up using the Weave UI." — again describes the UI path only, but does not say the SDK cannot.

### 2. The SDK path that refutes "cannot be created from the SDK"

**Weave Python SDK reference** — https://docs.wandb.ai/weave/reference/python-sdk (fetched 2026-09-03; page also served as `.md`)

- `class Monitor` (line ~1991 of the .md): docstring "Sets up a monitor to score incoming calls automatically." with the example:

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

- Fields: `sampling_rate: float` (0–1, default 1), `scorers: list[Scorer]`, `op_names: list[Literal['genai.turn_ended'] | str]`, `query: Query | None`, `is_traced: bool`, `active: bool`, `scorer_debounce_config`. Methods: `activate() → ObjectRef`, `deactivate() → ObjectRef`, `from_obj`.
- `class ClassifierMonitor(Monitor)` (line ~217): "A monitor that merges multiple scorers into a single classifier. Classifier monitors combine prompts from multiple LLMAsAJudgeScorers targeting the same model into a single scoring call." Same `op_names` type including the `genai.turn_ended` literal.

**Source** — https://raw.githubusercontent.com/wandb/weave/master/weave/flow/monitor.py (fetched 2026-09-03)

- `AgentSpanOpName: TypeAlias = Literal["weave.genai.turn_ended"]` with the comment: "Monitors can be configured to score agent spans by including an AgentSpanOpName in their `op_names` list."
- `ClassifierMonitor.get_prompt_header()` switches to `_AGENT_SPAN_CLASSIFIER_PROMPT_HEADER` (fields `agent_name`, `agent_version`, `system_instructions`, `input_messages`, `output_messages`) when `op_name in AGENT_SPAN_OP_NAMES`; the footer asks the judge for `{"classifiers": {"ExactName": {"is_match", "confidence", "reason"}}}` — i.e. the tag-style output the Signals UI renders.
- `weave/__init__.py` exports both: `from weave.flow.monitor import ClassifierMonitor, Monitor`.
- Test `tests/flow/test_monitor.py::test_preserves_full_refs_and_agent_spans` publishes a Monitor with `op_names=[full_ref, "weave.genai.turn_ended"]` via `monitor.activate()` and reads it back.

**Trace-server side** — https://raw.githubusercontent.com/wandb/weave/master/weave/trace_server/calls_query_builder/monitor_query_validation.py (fetched 2026-09-03)

- `MONITOR_OBJECT_CLASSES = frozenset({"Monitor", "ClassifierMonitor"})`; docstring: "agent monitors (op_names include an agent-span op) [validate] against the agent-spans schema, so logical fields like `operation_name` aren't wrongly rejected (the agent-signal 422)." This is server-side validation at `obj_create` time — the generic object-create path the SDK's `publish()` uses.
- `weave/trace_server/agents/kafka_events.py`: topic `weave.score_agent_spans`, event type `weave.genai.turn_ended` — the scoring trigger for turns.
- `weave/trace_server/query_builder/agent_query_compiler.py`: Monitor `query` on agent spans can filter on `agent_name` (docstring: "a filter like `agent_name = 'X'` transparently matches the attributed value"), plus `span_name`, `status_code`, `started_at`, custom attrs, etc. So **scoping by agent is also possible from the SDK** via `query`.

**Dates / versions**

- Commit `a5dcc77` 2026-05-01 "feat(weave): emit `weave.score_agent_spans` event for genai `turn_ended` spans (#6751)"; `a09a089` 2026-06-05 "Allow creation of monitors using op names (#7045)" (https://api.github.com/repos/wandb/weave/commits?path=weave/flow/monitor.py).
- Weave SDK release notes https://docs.wandb.ai/release-notes/weave-sdk-releases: 0.52.37 (April 17, 2026) "`ClassifierMonitor` is exported from the top-level `weave` package."; earlier entry "Monitors can use merged scorers."
- Latest PyPI `weave` = 0.53.8, uploaded 2026-09-03 (https://pypi.org/pypi/weave/json); latest GitHub release v0.53.7, 2026-08-27.

### 3. Automations

**Weave-scope automations** — https://docs.wandb.ai/weave/guides/evaluation/automations (fetched 2026-09-03): "You manage automations in the Weave UI, with no code changes required." Event = Weave metric threshold on an **Operation** or **Monitor** source, window/aggregation; action = Slack notification or webhook (integrations set up in Team Settings). `weave/trace_server/trace_server_interface.py` has zero occurrences of "automation" → no SDK/REST path for Weave-scope automations. **This half of the claim stands.**

**W&B Models automations** — https://docs.wandb.ai/ref/python/automations and https://docs.wandb.ai/models/ref/python/public-api/api (fetched 2026-09-03): "The W&B Automations API enables programmatic creation and management of automated workflows." `Api.create_automation(obj: NewAutomation, *, fetch_existing=False)`; events `OnRunMetric`, `OnRunState`, `OnCreateArtifact`, `OnLinkArtifact`, `OnAddArtifactAlias`, tag events; actions `SendNotification`, `SendWebhook`, `DoNothing`; filters `MetricThresholdFilter`, `MetricChangeFilter`, `MetricZScoreFilter`. `wandb/automations/events.py` has no Weave/monitor event class. So a blanket "Automations are UI-only" is imprecise: run-metric and artifact automations are fully scriptable; only Weave-monitor-metric automations are UI-only.

## Exact correction for the design

Replace:

> "Signals (and Automations) are UI-only and cannot be created from the SDK."

with:

> "Custom Signals are backed by `Monitor`/`ClassifierMonitor` objects and **can be created from the Python SDK**: `weave.ClassifierMonitor(name=..., op_names=["weave.genai.turn_ended"], scorers=[LLMAsAJudgeScorer(...)], query={...agent_name filter...}, sampling_rate=...).activate()` publishes an active agent-turn monitor whose scorer output tags turns (weave ≥0.52.37, April 2026; SDK reference https://docs.wandb.ai/weave/reference/python-sdk). The docs' create-custom-signal page documents only the UI path, and the UI "Custom Signal" drawer is the supported/tested way to get a *tag* rendered in the Agents view — treat SDK-created agent monitors appearing on the Signals tab as UNVERIFIED end-to-end until tried (H12 spike). Weave-scope **Automations** (Slack/webhook on a monitor-metric threshold) are genuinely UI-only; W&B Models automations (run-metric/artifact events) have a Python API (`wandb.automations`, `Api.create_automation`)."

Practical consequence for the loop: role-named signals (`aero-context-miss`, `strategist-derail`) can be created by the improver's *setup* code, not only pre-created in the UI, which changes §10 risk "Signals and Automations are UI-only (Certain)" to "Weave Automations UI-only (Certain); Signals SDK-creatable (Likely, spike to confirm UI rendering)". Also: pre-creating in the UI remains the zero-risk fallback.

## Caveats / UNVERIFIED

- I did not run the SDK against a live W&B project to confirm that an SDK-published `ClassifierMonitor` with `op_names=["weave.genai.turn_ended"]` shows up as a row on the Agents → Signals tab; the inference rests on (a) the Signals docs calling rows "the output of one of your signal monitors", (b) `create-custom-signal` naming an "underlying scorer object", (c) server validation code explicitly handling "agent monitors" created via `obj_create` and referring to "the agent-signal 422". Treat UI rendering as UNVERIFIED until the H12 spike.
- The custom-signal docs page has no visible "last updated" date; commit history places the underlying feature between 2026-03 and 2026-06.

## Sources

- https://docs.wandb.ai/weave/guides/tracking/create-custom-signal (2026-09-03)
- https://docs.wandb.ai/weave/guides/tracking/view-agent-signals (2026-09-03)
- https://docs.wandb.ai/weave/guides/evaluation/monitors (2026-09-03)
- https://docs.wandb.ai/weave/guides/evaluation/custom-monitors (2026-09-03)
- https://docs.wandb.ai/weave/guides/evaluation/automations (2026-09-03)
- https://docs.wandb.ai/weave/reference/python-sdk (2026-09-03)
- https://docs.wandb.ai/release-notes/weave-sdk-releases (2026-09-03)
- https://github.com/wandb/weave/blob/master/weave/flow/monitor.py (2026-09-03)
- https://github.com/wandb/weave/blob/master/weave/trace_server/calls_query_builder/monitor_query_validation.py (2026-09-03)
- https://github.com/wandb/weave/blob/master/weave/trace_server/query_builder/agent_query_compiler.py (2026-09-03)
- https://github.com/wandb/weave/blob/master/tests/flow/test_monitor.py (2026-09-03)
- https://docs.wandb.ai/ref/python/automations (2026-09-03)
- https://docs.wandb.ai/models/ref/python/public-api/api (2026-09-03)
- https://github.com/wandb/wandb/blob/main/wandb/automations/__init__.py (2026-09-03)
- https://pypi.org/pypi/weave/json (2026-09-03)
