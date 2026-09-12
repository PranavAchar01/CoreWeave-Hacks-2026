# Fact-check: W&B Inference prices/structured output, TypeSafe System1 API + ToS, W&B Registry linking + alias-added Automation

Checked live on 2026-09-03/04 (all fetches dated today unless noted). Verdict per sub-claim below; overall verdict at the end.

## Claim under test

> "W&B Inference serves `openai/gpt-oss-20b` at $0.03/$0.13 per 1M tokens with strict `json_schema` structured output, and `OpenPipe/Qwen3-14B-Instruct` at $0.05/$0.22 per 1M with tool calling; TypeSafe System1 has no public API docs (console login-gated), and its ToS forbids using outputs as distillation targets. W&B Models Registry supports linking versions with parent metadata and an alias-added Automation (webhook, UI-created)."

## 1. `openai/gpt-oss-20b` price = $0.03 in / $0.13 out per 1M — VERIFIED

- Source: https://wandb.ai/site/pricing/inference/ (fetched 2026-09-03). Pricing table row: "OpenAI GPT OSS 20B" — Input $0.03, Output $0.13. Same page: "OpenAI GPT OSS 120B" $0.03/$0.17; "IBM Granite 4.1 8B" $0.05/$0.10; "OpenPipe Qwen3 14B Instruct" $0.05/$0.22.
- Cross-check: https://wandb.ai/inference (hosted models page, fetched 2026-09-03) lists "OpenAI GPT OSS 20B" "$0.03" / "$0.13", 131k context. (Note: that page shows GPT OSS 120B as $0.04/$0.14 vs $0.03/$0.17 on the pricing page — the two W&B pages disagree on 120B, so treat 120B as unstable; 20B agrees on both.)
- Stale-source warning: a Google snippet of an older W&B model page says $0.05/$0.20 for GPT OSS 20B (https://wandb.ai/site/inference/openai-gpt-oss-20b/) — this is outdated; the live pricing table says $0.03/$0.13.
- Model ID confirmed: `openai/gpt-oss-20b`, 131k context, "Lower latency Mixture-of-Experts model trained on OpenAI's Harmony response format with reasoning capabilities." — https://docs.wandb.ai/guides/inference/models/ (fetched 2026-09-03).
- Note (from the pricing page FAQ): Playground usage is billed at the same per-token rates; a monthly W&B Inference budget can be set in billing settings (https://wandb.ai/site/pricing/inference/).

## 2. `openai/gpt-oss-20b` supports strict `json_schema` structured output — VERIFIED (by docs example), no per-model support matrix exists

- Source: https://docs.wandb.ai/inference/response-settings/structured-output (fetched 2026-09-03). "Structured output constrains Serverless Inference responses to a specific JSON schema, ensuring that the model's response adheres to the fields and types you define." "Use structured output instead of JSON mode when possible." Request shape shown on that page:
  ```json
  "response_format": {"type": "json_schema", "json_schema": {"name": "CalendarEventResponse", "strict": true, "schema": {...}}}
  ```
  The page's example model is `"openai/gpt-oss-20b"`.
- JSON mode page (https://docs.wandb.ai/inference/response-settings/json-mode, fetched 2026-09-03): `response_format={"type": "json_object"}`; "the response's schema isn't guaranteed to be consistent or to follow a particular structure. For consistent, structured JSON responses, we recommend structured output when possible." Example model is also `openai/gpt-oss-20b`.
- Caveat: neither page publishes a list of which models honor `strict: true`. The design's H0 "strict-schema probe" is therefore the right step; for granite-4.1-8b there is no doc evidence either way (W&B's model page only says "enhanced tool calling, instruction following, and chat capabilities" — https://wandb.ai/site/inference-model/cw_ibm-granite_granite-4.1-8b/, fetched 2026-09-04).

## 3. `OpenPipe/Qwen3-14B-Instruct` = $0.05/$0.22 per 1M — VERIFIED; "with tool calling" — UNVERIFIED on W&B's own pages

- Price: https://wandb.ai/site/inference/cw_openpipe_qwen3-14b-instruct/ (fetched 2026-09-04): "Price per 1M tokens — $0.05 (input) $0.22 (output)". Same on https://wandb.ai/site/pricing/inference/ and https://wandb.ai/inference (33k context, "Apr 2025").
- Model ID + context: `OpenPipe/Qwen3-14B-Instruct`, 32.8k context — https://docs.wandb.ai/guides/inference/models/.
- Tool calling: W&B's model detail page text says only: "OpenPipe/Qwen3-14B-Instruct is a finetune friendly instruct variant of Qwen3-14B ... updated chat template that makes Qwen3-14B non-thinking by default ... The model retains the strong general capabilities of Qwen3-14B" — no mention of tool calling. The HF model card (https://huggingface.co/OpenPipe/Qwen3-14B-Instruct, fetched 2026-09-03) also does not mention tool/function calling. W&B's tool-calling doc (https://docs.wandb.ai/inference/response-settings/tool-calling, fetched 2026-09-03) uses `tools` + `tool_choice: "auto"`, states "Serverless Inference only supports calling functions", and its example model is `openai/gpt-oss-20b`; it publishes no per-model support list. A search-engine snippet attributes "tool calling, structured output, and temperature control" to the W&B OpenPipe page, but that text was not present in the fetched page body. Treat tool calling on this model as PLAUSIBLE (Qwen3 family supports it) but UNVERIFIED for W&B Inference — probe it, or use `ibm-granite/granite-4.1-8b` ($0.05/$0.10) whose W&B page explicitly advertises "enhanced tool calling".
- Also note: the 32.8k context is the smallest in the catalog — relevant if the driver ingests long traces.

## 4. TypeSafe System1: no public API docs; console login-gated — VERIFIED

- https://typesafe.ai/ (fetched 2026-09-03): stealth AI lab page; links only to jobs board (Ashby), two YouTube videos, two Substack posts, ./manifesto, ./terms, ./privacy-policy. No docs, pricing, sign-up, or API links. The word "System1" does not appear on the public site.
- https://console.typesafe.ai/login (fetched 2026-09-03): login page ("Continue with Google" / "Continue"), footer links to https://typesafe.ai/terms and https://typesafe.ai/privacy; no docs/pricing/API-reference links.
- https://docs.typesafe.ai/ — DNS does not resolve (ENOTFOUND, 2026-09-03).
- https://github.com/typesafe-ai (fetched 2026-09-03): public repos are Overwatch, daggerverse, pulumi-clickhouse (fork), typesafe-ai.github.io, LLaDA (fork), vllm (fork) — no SDK or API docs.
- The ToS itself implies private API documentation exists for authorized users ("Must follow API documentation" restriction), so the API shape is knowable only after console access. Risk rating "High" in §10 stands.

## 5. TypeSafe ToS forbids using outputs for distillation — VERIFIED (and stricter than the claim)

- https://typesafe.ai/terms (fetched 2026-09-03), "Last updated November 19, 2025". Verbatim restriction: "use the Interfaces or any Output to perform model distillation, train a model to imitate the output of the Interfaces, or develop (or to facilitate the development of) a similar or competing product".
- Additional clauses the design must respect (same page):
  - License is evaluation-only: access "solely for the purpose of evaluating the Playground and APIs".
  - "the Interfaces may not be suitable for use in a production environment."
  - "No automated/programmatic interaction with Playground" (API is the sanctioned programmatic path).
  - "No publishing benchmarks or performance data" — a leaderboard/score panel that names System1 numbers publicly may violate this; keep System1 scores internal or get written OK.
  - Typesafe "will not train or fine tune any artificial intelligence or machine learning models on Input"; User "retains all right, title, and interest ... in and to the Input".
  - Termination "immediately at any time for any reason".
- "Weights never change" (design's STRATEGIST row): not a ToS statement; UNVERIFIED as a product fact. It is a design invariant the team imposes (System1 is consumed as a frozen external scorer/strategist), which is consistent with the ToS's no-distillation rule.

## 6. W&B Registry: link versions with parent metadata — VERIFIED (metadata is per-artifact, editable, and propagates to links)

- Linking: https://docs.wandb.ai/guides/registry/link_version/ (fetched 2026-09-03). Three ways: `run.link_artifact(artifact=..., target_path=f"wandb-registry-{REGISTRY_NAME}/{COLLECTION_NAME}")`; `artifact.link(target_path=...)`; or `wandb.Api().artifact("<entity>/<project>/<name>:<version>").link(target_path="wandb-registry-<registry>/<collection>", aliases=["latest"])`.
- Metadata: `Artifact.metadata` setter docstring in SDK source (https://raw.githubusercontent.com/wandb/wandb/main/wandb/sdk/artifacts/artifact.py, fetched 2026-09-04): "User-defined artifact metadata ... Note: There is currently a limit of 100 total keys. Editing the metadata will apply the changes to the source artifact and all linked artifacts associated with it." So a `parent`/`lineage` dict on the artifact is supported (<=100 keys) and is visible on the Registry-linked version.
- Lineage API (for logged_by/used_by in the design's Registry audit): https://docs.wandb.ai/models/artifacts/explore-and-traverse-an-artifact-graph (fetched 2026-09-03): `producer_run = artifact.logged_by()`, `consumer_runs = artifact.used_by()`; inputs are declared with `run.use_artifact(...)`, outputs with `run.log_artifact(...)`. SDK source: `logged_by()` "Get the W&B run that originally logged the artifact"; `used_by()` "Get a list of the runs that have used this artifact and its linked artifacts."
- Registry lineage/audit UI: https://docs.wandb.ai/guides/registry/lineage/ (fetched 2026-09-03): lineage graph shows "Artifacts used as inputs to a run" and "Artifacts created as outputs from a run"; audit shows "If an alias was added or removed from an artifact version" and "If an artifact version was added or removed from a collection" with user and date. This is native evidence for a "Lineage audit"; the "signed chain" (hash/signature) is not a Registry feature — it must be implemented by the team (e.g., store the signature in `metadata`).

## 7. Alias-added Automation (webhook, UI-created) — VERIFIED, with a precision fix: the automation can also be created via the Python SDK; only the webhook *integration* (endpoint + secret) is UI/team-admin

- Events: https://docs.wandb.ai/models/automations/automation-events (fetched 2026-09-03). Registry automations: "A new version is linked to a collection" and "An artifact alias is added". Project automations additionally: "A new version is added to an artifact", "An artifact tag is added", run status/metric events.
- Actions: "Slack notification" and "Webhook" — https://docs.wandb.ai/guides/core/automations/ (fetched 2026-09-03).
- Webhook integration is UI/admin: "A team admin can add a webhook for the team. The webhook defines the endpoint W&B sends requests to and any credentials required." Registry-scope automations require "A Registry admin" — https://docs.wandb.ai/guides/core/automations/create-automations/webhook/ (fetched 2026-09-03).
- SDK path (the claim says "UI-created"; the docs show the automation itself can be created in code):
  - `wandb.Api().create_automation(obj: NewAutomation, *, fetch_existing: bool = False, **kwargs)`; also `api.automations(...)`, `api.update_automation(...)`, `api.delete_automation(...)`, `api.webhook_integrations(entity=...)`, `api.registry(name, organization=None)` — https://docs.wandb.ai/models/ref/python/public-api/api (fetched 2026-09-04).
  - `wandb.automations.OnAddArtifactAlias(*, scope: ArtifactSequenceScope|ArtifactPortfolioScope|RegistryScope|ProjectScope|TeamScope|OrgScope, filter=...)`; example `OnAddArtifactAlias(scope=collection, filter=ArtifactEvent.alias.eq("prod"))` — https://docs.wandb.ai/models/ref/python/automations/onaddartifactalias (fetched 2026-09-03).
  - `wandb.automations.OnLinkArtifact` (same scope types) — https://docs.wandb.ai/models/ref/python/automations/onlinkartifact.
  - `wandb.automations.SendWebhook(integration_id=..., requestPayload=...)` and `SendWebhook.from_integration(integration: WebhookIntegration, *, payload=None)` — https://docs.wandb.ai/models/ref/python/automations/sendwebhook.
  - Composition: `api.create_automation(event >> action, name="...", description="...")` — https://docs.wandb.ai/ref/python/automations/.
  - Minimal recipe for the design: create the webhook integration once in Team Settings (UI), then in code: `hook = next(api.webhook_integrations(entity=TEAM)); reg = api.registry("scrutineer"); api.create_automation(OnAddArtifactAlias(scope=reg, filter=ArtifactEvent.alias.eq("official")) >> SendWebhook.from_integration(hook, payload={...}), name="promote-on-official")`.

## Corrections to apply to the design text

1. §3/§5/CAR paragraph prices: keep `$0.03/$0.13` (gpt-oss-20b) and `$0.05/$0.22` (OpenPipe Qwen3-14B-Instruct) — both match the live pricing page. If gpt-oss-120b is cited anywhere, mark it "$0.03/$0.17 (pricing page) or $0.04/$0.14 (models page) — W&B pages disagree".
2. Replace "OpenPipe/Qwen3-14B-Instruct ... with tool calling" with "... (tool calling not stated on W&B's model page or the HF card; probe at H0, or use ibm-granite/granite-4.1-8b, which W&B explicitly lists as tool-calling, $0.05/$0.10)". Also note its 32.8k context.
3. "strict json_schema on gpt-oss-20b": say "documented via W&B's structured-output example (`strict: true`), no per-model matrix — probe".
4. §3 STRATEGIST "Weights never change": mark as a team-imposed invariant, not a TypeSafe product/ToS fact. Add ToS constraints: evaluation-only license, "may not be suitable for ... production", and no publishing of benchmarks/performance data (keep System1 scores off any public leaderboard slide unless cleared).
5. §7 H0 / §6: "Registry alias-added Automation in the UI" → "webhook integration created in Team Settings (UI, team admin); the alias-added automation may be created in the UI or via `wandb.Api().create_automation(OnAddArtifactAlias(scope=api.registry(...)) >> SendWebhook.from_integration(...))`". Registry-scope automations need a Registry admin.
6. §6 "Lineage audit + signed chain": Registry gives lineage (`logged_by()/used_by()`, lineage graph, alias/collection audit log); the signature must be stored by us in `artifact.metadata` (<=100 keys; edits propagate to source + all linked versions).

## Overall verdict

Not refuted on substance: prices, structured-output support on gpt-oss-20b (docs example), TypeSafe's lack of public API docs / login-gated console, the ToS anti-distillation clause, Registry linking with metadata, and alias-added webhook automations are all confirmed live. Two imprecisions: (a) tool calling for OpenPipe/Qwen3-14B-Instruct is not stated by W&B or the HF card (UNVERIFIED); (b) the alias-added automation is not UI-only — the SDK (`create_automation`, `OnAddArtifactAlias`, `SendWebhook`) creates it; only the webhook integration is UI/team-admin.
