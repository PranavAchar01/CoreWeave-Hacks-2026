# Fact-check: W&B Inference prices/structured output, TypeSafe API/ToS, W&B Registry lineage + Automations

Checked 2026-09-03 against live official pages only. Verdict: **claim substantially holds; two corrections** (one sub-claim UNVERIFIED, one wording too narrow).

## 1. W&B Inference pricing (VERIFIED)
Source: https://wandb.ai/site/pricing/inference (fetched 2026-09-03; "Prices shown are per 1 million tokens." Columns: Model | Input Tokens | Output Tokens | Cache Hit)
- `OpenAI GPT OSS 20B` — **$0.03 in / $0.13 out**, Cache Hit "-". Matches §5 Backend B.
- `OpenPipe Qwen3 14B Instruct` — **$0.05 in / $0.22 out**, Cache Hit "-". Matches the driver-model note.
- `IBM Granite 4.1 8B` — $0.05 / $0.10 (Cache "-"); `IBM Granite 4.2 8B` — $0.10 / $0.15 / cache $0.05. (Claim doesn't price granite; noted for the H0 probe.)
- Caution: third-party aggregators surfaced by search quote gpt-oss-20b on W&B at $0.05/$0.20 — stale/wrong; the official page is $0.03/$0.13.
- Model IDs and context (https://docs.wandb.ai/guides/inference/models/, 2026-09-03): `openai/gpt-oss-20b` 131k ctx, 3.6B-20B active/total; `OpenPipe/Qwen3-14B-Instruct` 32.8k ctx, 14.8B; `ibm-granite/granite-4.1-8b` 131k; `ibm-granite/granite-4.2-8b` 131k.
- Spend caps (https://docs.wandb.ai/guides/inference/usage-limits/): Free "$100/month", Pro "$6,000/month"; concurrency 429 "Concurrency limit reached for requests" — relevant to §6 Cost cap.

## 2. Strict `json_schema` structured output on gpt-oss-20b (VERIFIED)
Source: https://docs.wandb.ai/inference/response-settings/structured-output (2026-09-03). Page "Enable structured output": "To enable structured output, specify json_schema as the response_format type in the request." The official example is exactly `model="openai/gpt-oss-20b"` with `response_format={"type":"json_schema","json_schema":{"name":..., "strict": True, "schema":{..., "additionalProperties": False}}}` against `https://api.inference.wandb.ai/v1`. Docs also say "Use structured output instead of JSON mode when possible." JSON mode page: https://docs.wandb.ai/inference/response-settings/json-mode (`{"type":"json_object"}`).
- No per-model support matrix exists in the docs; gpt-oss-20b is the only documented example. granite-4.1-8b strict-schema support is not documented anywhere -> the §7 H0 probe is justified.

## 3. Tool calling on `OpenPipe/Qwen3-14B-Instruct` via W&B Inference (UNVERIFIED — correction needed)
- W&B tool-calling docs (https://docs.wandb.ai/inference/response-settings/tool-calling, 2026-09-03, page "Call tools"): "Serverless Inference only supports calling functions." Example uses `tools=[{"type":"function",...}]`, `tool_choice="auto"` with `model="openai/gpt-oss-20b"` only. **No list of tool-capable models.**
- The W&B models table mentions "tool calling" only in the Granite 4.1/4.2 descriptions; the Qwen3-14B-Instruct description is "optimized by OpenPipe for building agents with finetuning" — no tool-calling statement.
- HF card https://huggingface.co/OpenPipe/Qwen3-14B-Instruct: "a finetune friendly instruct variant of Qwen3-14B", non-thinking chat template; silent on tool calling. Upstream https://huggingface.co/Qwen/Qwen3-14B: "Qwen3 excels in tool calling capabilities" (via Qwen-Agent templates/parsers). So the base model can tool-call, but whether W&B's serving stack exposes a tool parser for this model is **not documented** — must be probed live (same H0 style probe as strict schema).

## 4. TypeSafe System1: no public API docs; console login-gated (VERIFIED)
- https://typesafe.ai/ (2026-09-03): "a new AI lab operating in stealth"; links only to manifesto, team, thoughts, jobs, terms, privacy. No docs link, no product/System1 mention, no pricing.
- Host probes 2026-09-03 (curl): `docs.typesafe.ai` -> no response; `typesafe.ai/docs` -> 404; `console.typesafe.ai/` -> 307 to `/login` (200; body: "Welcome to TypeSafe — Continue with Google ... By continuing, you agree to the terms and conditions"); `api.typesafe.ai/` -> 404; `api.typesafe.ai/v1/models` -> **405 Method Not Allowed** (an API host exists; shape unknown). GitHub org https://github.com/typesafe-ai has no SDK/docs (Overwatch, daggerverse, vllm/LLaDA forks).
- "System1" description only in third-party press: https://newsletter.foundersysk.com/p/your-showcase-primer-typesafe-ai (2026-03-12): "machine-to-machine execution rather than human conversation". §10 risk "shape unknown (High)" is correct.

## 5. TypeSafe ToS forbids distillation (VERIFIED, plus two extra clauses the design must respect)
Source: https://typesafe.ai/terms (Last updated: Nov 19, 2025; fetched 2026-09-03). Verbatim prohibitions, "User will not ... (ii) use any automated or programmatic means of interacting with the Playground; (iii) interact with the APIs other than in accordance with the applicable documentation provided by Typesafe; (iv) use the Interfaces or any Output (defined below) to perform model distillation, train a model to imitate the output of the Interfaces, or develop (or to facilitate the development of) a similar or competing product or service; (v) publish benchmarks or performance information about the Interfaces". Access is granted "solely for the purpose of evaluating the Playground and APIs".
- Implications: (a) §6 Anti-distillation is required by ToS, not just design hygiene; (b) automated harness must hit the API, never script the Playground; (c) **publishing System1 benchmark/perf numbers (e.g. on-screen lap times attributed to System1) is prohibited by clause (v)** — the design should keep System1 scores private or get written permission.
- The ToS does **not** name System1 and says nothing about "weights never change"; that sentence is a product claim, UNVERIFIED from the ToS (the alternate URL typesafe.ai/terms-and-conditions is 404).

## 6. W&B Registry: link versions, metadata, lineage (VERIFIED with precision note)
- https://docs.wandb.ai/guides/registry/link_version/ (2026-09-03): `wandb.Run.link_artifact()` / `wandb.Artifact.link()`; target `"wandb-registry-{REGISTRY_NAME}/{COLLECTION_NAME}"`; linked versions numbered from `v0`; personal-entity artifacts cannot be linked (use a team entity).
- https://docs.wandb.ai/models/ref/python/experiments/artifact (2026-09-03): `wandb.Artifact(name, type, description=None, metadata: dict[str, Any] | None = None, ...)` — "You can specify no more than 100 total keys."; `Artifact.link(target_path, aliases=None)`; `Artifact.logged_by()` "Get the W&B run that originally logged the artifact."; `Artifact.used_by()` "Get a list of the runs that have used this artifact and its linked artifacts."
- Precision: "parent metadata" is a user convention (put `parent_version`/hash in `metadata`); W&B's own lineage is the DAG from `run.use_artifact()` / `run.log_artifact()` (https://docs.wandb.ai/guides/core/artifacts/explore-and-traverse-an-artifact-graph/). For the signed chain, store the signature in metadata and derive lineage from `logged_by()`/`used_by()`.

## 7. Alias-added Automation with webhook (VERIFIED; "UI-created" is too narrow)
- https://docs.wandb.ai/models/automations/automation-events (2026-09-03): Registry events are "A new version is linked to a collection" and "An artifact alias is added". Actions (https://docs.wandb.ai/guides/core/automations/): Slack notification or "Calls a webhook URL with a JSON payload". Created "In a registry: Select the Automations tab".
- Correction: automations are also creatable in the Python SDK — https://docs.wandb.ai/ref/python/automations/ and https://docs.wandb.ai/models/ref/python/automations/onaddartifactalias/ (2026-09-03): `wandb.automations.OnAddArtifactAlias` ("A new alias is assigned to an artifact"; scopes include `RegistryScope`, `ProjectScope`, ArtifactCollection), `OnLinkArtifact`, `SendWebhook(integration_id=..., request_payload=...)`, `NewAutomation`, `api.create_automation()`. The webhook *integration* (URL + secret) still has to exist (team settings), but the automation itself can be scripted.

## Corrections to apply to the design
1. §3/§7: keep "strict json_schema on gpt-oss-20b" (documented). Mark granite-4.1-8b strict-schema and **Qwen3-14B-Instruct tool calling on W&B Inference as UNVERIFIED/probe-required**; W&B publishes no per-model capability matrix.
2. §7 H0 / §6: "Registry alias-added Automation (UI-created)" -> "alias-added Automation (UI or `wandb.automations` SDK: `OnAddArtifactAlias` + `SendWebhook` via `api.create_automation()`)".
3. §3/§6: cite ToS clauses (ii), (iii), (iv), (v); add "no publishing System1 benchmark/perf numbers" and "API only, never automate the Playground". Drop the implication that the ToS says weights never change.
4. §10: `api.typesafe.ai` exists (405 on /v1/models) but is undocumented; console is Google-login gated. Keep risk High.
