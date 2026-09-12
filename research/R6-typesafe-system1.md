# R6 — TypeSafe AI "System1": everything public as of 3 Sep 2026

Research method: live web only (WebSearch/WebFetch + yt-dlp captions). Every claim carries a URL and the date the source was published or, where the source shows only a relative date, the fetch date (3 Sep 2026). Anything not verified is marked **UNVERIFIED**.

---

## 1. Summary

**What System1 is.** TypeSafe AI (San Francisco, founded mid-2024 by Diogo Almeida (CEO, ex-OpenAI/Google Brain, RLHF/InstructGPT co-author), Erik Gafni (CTO), Sasha Sheng (COO, ex-Meta/FAIR)) is a still-stealth model lab whose model, **System1**, is "designed for machine-to-machine execution rather than human conversation" for "real-time decision systems, compliance pipelines, large-scale automation, or autonomous agents operating without a human constantly supervising." The founders' own framing (LinkedIn launch post ~2–3 Sep 2026): the models "output values instead of strings, can't hallucinate by design, and run up to 100x faster and cheaper than LLMs," returning "exact values like numbers, probabilities, classifications, enums, booleans and calibrated confidence scores." Diogo's AI Engineer World's Fair talk (3 Jul 2026) names the training recipe: a **third post-training objective** — not RLHF (human preference), not RLVR (verifiable correctness) — "optimized for calibrated decision-making," with "the shape of the API" differing from both.

**API/SDK state.** No public docs, SDK, pricing, or benchmarks exist anywhere on the open web. What does exist: a login-gated console at `console.typesafe.ai` (Google or email sign-in), and Terms of Service (last updated 19 Nov 2025) that define the product as "web-based interface(s) (the 'Playground') and (b) one or more application programming interfaces ('APIs')", describe access as "a preview version ... may not be suitable for use in a production environment," and forbid distillation/imitation. No PyPI or npm package was found. The GitHub org (`typesafe-ai`) holds only infra tooling (Overwatch, daggerverse, forks of vLLM and LLaDA) — the vLLM fork is a hint about the serving stack, and the LLaDA (diffusion LM) fork is an interesting but **UNVERIFIED** hint about architecture.

**Hackathon access.** TypeSafe is a named co-host/sponsor of "CoreWeave Hacks: Agent Loops Hackathon with Weights & Biases, AGI House, and TypeSafe AI" (Sept 13–14, 400 Alabama St, SF). The Luma page says "TypeSafe is a new AI lab that has built a new class of models designed for machine-native intelligence," lists **"Best Use of TypeSafe AI — to be confirmed"** as a prize, and names **Diogo Almeida as a judge**. Sasha Sheng (2 Sep 2026): "TypeSafe is sponsoring the CoreWeave hackathon and we will be giving some unhinged prizes." Access at the event is therefore *likely* (console + preview API + on-site team) but the API shape is unpublished, so the design must isolate System1 behind a typed adapter with a drop-in fallback (W&B/CoreWeave Serverless Inference with `response_format: json_schema, strict: true`, verified below).

**What "Best Use of TypeSafe AI" plausibly rewards.** Using System1 for what the founders say chat models are bad at: unattended, high-frequency, typed decisions with calibrated confidence — *not* as another chat/reasoning model. In SCRUTINEER terms: the decisions a race team makes thousands of times per lap, where a wrong-but-confident answer costs the business and a calibrated "I don't know" must route to a human or a slower model.

---

## 2. Findings with citations

### A. Company, people, positioning

**F1. TypeSafe AI is a stealth lab whose headline metric is "intelligence per dollar."**
typesafe.ai (fetched 3 Sep 2026; page footer dated "Sep 2, 2026") reads: "A new AI lab operating in stealth", tagline "Intelligence beyond chat", and "Intelligence per dollar: The most important metric for the next century". Culture page: "Intelligence is the most valuable resource in the world and it is absurdly expensive." No product name, docs, waitlist form, or pricing appear on the site as of 3 Sep 2026.
Sources: https://typesafe.ai/ ; https://typesafe.ai/culture (fetched 2026-09-03).

**F2. Founders and team.**
CEO Diogo Almeida "co-invented RLHF and InstructGPT, the methods that lead to ChatGPT and GPT4"; CTO Erik Gafni "repeat founder (Ravel) … early employee at two unicorns (Invitae and Freenome)"; COO Sasha Sheng "ex-research engineer from Meta/FAIR … organized many hackathons … published at NeurIPS and ECCV." Team page lists ~20 people incl. a "Founding DevRel" (Allie Laabs), "Developer Platform & Tooling" (Ted Kalaw, ex-Meta/Ripple), "MLOps, Open Source" (Daniel Gafni, Dagster), "DevOps, Observability" (Nathan LeClaire, Docker/Honeycomb). The existence of DevRel + developer-platform roles signals an external API is the product.
Sources: https://typesafe.ai/team (fetched 2026-09-03); founded mid-2024 per https://www.linkedin.com/in/erik-gafni-906b0125/ (via search 2026-09-03).

**F3. Original positioning (GitHub Pages site, 2024–25): "AI-to-computer interactions rather than human-in-the-loop."**
"Built on RLHF and Instruction-Following models … re-imagined the entire stack from the ground up … optimizing for AI-to-computer interactions rather than human-in-the-loop scenarios." Aim: "automate the boring stuff", against "copilots and marginal productivity gains." Contact joinus@typesafe.ai.
Source: https://typesafe-ai.github.io (repo last updated 4 Jun 2026 per https://github.com/typesafe-ai, fetched 2026-09-03).

**F4. System1 named and described (SF Startup Showcase primer, 12 Mar 2026).**
"Their model, System1, is designed for machine-to-machine execution rather than human conversation. The focus is reliability in environments where correctness and latency are non-negotiable: real-time decision systems, compliance pipelines, large-scale automation, or autonomous agents operating without a human constantly supervising." "Rather than bolting guardrails onto probabilistic models after the fact, TypeSafe is embedding reliability directly into the model itself." No benchmarks, pricing, or API details.
Source: https://newsletter.foundersysk.com/p/your-showcase-primer-typesafe-ai (2026-03-12).

**F5. Launch-style post (LinkedIn, ~2–3 Sep 2026): typed values, no hallucination by design, 100x faster/cheaper, waitlist.**
Diogo Almeida (post shown as "7 hours ago" on 3 Sep 2026): "At OpenAI, I co-invented ChatGPT and RLHF. Unfortunately, I think they've taken AI down the wrong path." … "Software needs the intelligence of AI with the speed and reliability of code. It requires exact values like numbers, probabilities, classifications, enums, booleans and calibrated confidence scores." … "They output values instead of strings, can't hallucinate by design, and run up to 100x faster and cheaper than LLMs." … "Join the waitlist today: https://typesafe.ai". Sasha Sheng reposted a "caveman" version: "Model want human happy. Model make shit up… At TypeSafe AI, we want different thing. We build AI for automation." Note: typesafe.ai itself showed no waitlist form when fetched the same day — the waitlist may be the console sign-in (F8) or a not-yet-deployed page. The "100x" and "can't hallucinate" claims are marketing claims with no published benchmark — **UNVERIFIED as measurements**.
Sources: https://www.linkedin.com/in/diogomda/ and https://www.linkedin.com/in/sashasheng/recent-activity/all/ (fetched 2026-09-03). Company page tagline "Intelligence beyond chat"; earlier post: "a model that doesn't hallucinate and is 100x faster and cheaper than LLMs"; "SOC 2 Type II compliant" (~Aug 2026): https://www.linkedin.com/company/typesafe-ai (fetched 2026-09-03).

### B. The technical thesis (primary source: Diogo's AIE World's Fair talk)

**F6. "A third post-training objective … optimized for calibrated decision-making."**
Talk "What's next after RLHF?", AI Engineer World's Fair, Track 9 (Posttraining & Midtraining), 3 Jul 2026 12:05 PM; video on the AI Engineer channel, uploaded 31 Jul 2026 (1,901 views on 3 Sep 2026). Auto-caption transcript (yt-dlp): "RLHF is optimizing for human preference. RLVR is optimizing for like log error rates of pure correctness, but we are doing a third thing that is optimized for calibrated decision-making and like basically mainlining the intelligence of pre-trained models into like being actually useful for software." "Even the shape of the API is different because the shape of the API for RLHF is different from RLVR, which is different from what we are doing." "Our core question is what if the AI stack was redesigned for reliability and automation?" "We are still kind of stealthy." Also: "hallucination to me is intrinsic to optimizing for human preference. … there's an asymmetry in the reward model kind of like GANs have … that encourage the models to drop modes and be confident." And the business lesson: "do not use AI for decisions with stakes to your business."
Sources: https://ai.engineer/worldsfair/schedule (fetched 2026-09-03); https://www.youtube.com/watch?v=cJ0EOzey--o (uploaded 2026-07-31; oEmbed author "AI Engineer"); transcript saved locally at scratchpad `rlhf_talk_transcript.txt`.

**F7. Secondary coverage confirms "release imminent" and the "weird detour" framing.**
BigGo Finance (1 Aug 2026): "TypeSafe is building a third post-training objective — calibrated decision-making — designed for unattended, decision-grade AI systems rather than chat assistants"; Almeida's target: systems that "run unattended, make defensible decisions" and "know when uncertain rather than performing confidence"; "definitely not RLVR"; "With TypeSafe's release imminent"; "Claude Code… remains RLHF-optimized software."
Source: https://finance.biggo.com/news/58ea28526de2d7e9 (2026-08-01).

**F8. There is a live, login-gated console — but no public docs.**
`https://console.typesafe.ai/login` renders "Welcome to TypeSafe" with "Continue with Google" / "Continue" and links to typesafe.ai/terms and /privacy. `console.typesafe.ai/docs` is login-gated; `docs.typesafe.ai` does not resolve (ENOTFOUND); `api.typesafe.ai/` returns 404; `typesafe.ai/waitlist`, `/blog`, `/privacy` return 404. No `typesafe-ai` package on PyPI (`pypi.org/pypi/typesafe-ai/json` → 404); the PyPI `typesafe` package (v0.9.1, 2010) is unrelated; `@typesafe-ai/sdk` on npm → 403/none.
Sources: https://console.typesafe.ai/login ; https://console.typesafe.ai/docs ; https://pypi.org/pypi/typesafe-ai/json ; https://pypi.org/pypi/typesafe/json (all fetched 2026-09-03).

**F9. Terms of Service reveal the product surface: "Playground" + "APIs", preview status, anti-distillation.**
typesafe.ai/terms ("Last updated: Nov 19, 2025"): services are "web-based interface(s) (the 'Playground') and (b) one or more application programming interfaces ('APIs')"; "User is receiving access to a preview version of the Interfaces and that the Interfaces may not be suitable for use in a production environment"; "User may not share its access credentials … (including any API keys) with any third party"; users may not "use the Interfaces or any Output to perform model distillation, train a model to imitate the output" or build "a similar or competing product"; "Typesafe does not guarantee that User's access to the Interfaces will be uninterrupted." No pricing, rate limits, or SLA.
Source: https://typesafe.ai/terms (last updated 2025-11-19; fetched 2026-09-03).
Design consequence: **do not** use System1 outputs as SFT/RL training targets for the CAR (that is distillation and violates the ToS); use them as decisions/labels that drive the loop.

**F10. GitHub org: infra only; vLLM and LLaDA forks.**
Public repos (fetched 3 Sep 2026): `Overwatch` (Python, updated 3 Sep 2026 — "local browser service for managing cloud resources and training workloads … integrates SkyPilot inventory with training telemetry from Weights & Biases, CloudWatch"), `daggerverse` (Dagger modules), `pulumi-clickhouse` fork, `typesafe-ai.github.io`, forks of `vllm` (May 2025) and `LLaDA` ("Large Language Diffusion Models", Jun 2025). The W&B integration in Overwatch shows the team already uses W&B for training telemetry. Whether System1 is diffusion-based is **UNVERIFIED** (a fork is not evidence).
Source: https://github.com/typesafe-ai ; https://github.com/typesafe-ai/Overwatch (fetched 2026-09-03).

**F11. Substack "Complete Skeptic" (Diogo): two posts, both about training economics, neither names System1.**
"Scaling Laws, Honestly" (4 Jul 2026): TL;DR "The original scaling laws were wrong due to a bug"; Kaplan et al. used "a fixed number of training tokens and learning rate schedule for all models," the cosine decay "artificially constrained results, making it appear that more data would not help"; "For a few years, people trained models that were much too large on too little data"; Chinchilla "less than half the size of GPT-3, trained on over 4x more tokens." "Is it even possible for the Chinese Labs to distill US models?" (24 Jul 2026): three mechanisms — logit distillation, behavior cloning, and "behavior parroting" (mimicking final outputs without hidden reasoning), because "most of instruction following is style" and reasoning models perform "almost as well when trained on reasoning traces that lead to incorrect answers." Relevance: the lab's worldview is small-model, data-first, intelligence-per-dollar — consistent with a cheap high-frequency decision model.
Sources: https://www.completeskeptic.com/p/scaling-laws-honestly (2026-07-04); https://www.completeskeptic.com/p/is-it-even-possible-for-the-chinese (2026-07-24); https://www.completeskeptic.com/archive.

**F12. Other public talks (no product detail).**
Data Council / AI Council SF (12–14 May 2026): "AI: too good to be true, too bad to be useful." Databricks Data+AI Summit listing (June 2027): "What's Next After RLHF?"; bio: "building a new class of large language models for true no-human-in-the-loop automation … rethinking foundational LLM assumptions to prioritize reliability, latency, and cost, to build AI that can be embedded deep inside real systems." AIE World's Fair also listed "Build with TypeSafe: Private Hack Night", 1 Jul 2026, 5–8 PM — evidence they run hands-on builder sessions with the model.
Sources: https://www.talkmezzo.com/speakers/diogo-almeida-mqm2ks6rg5m ; https://www.databricks.com/dataaisummit/speaker/diogo-almeida ; https://ai.engineer/worldsfair/schedule (all fetched 2026-09-03).

**F13. Funding: no announced round.**
Tracxn (updated 25 Aug 2026) lists TypeSafe as "Unfunded" (and mis-dates founding to 2011); gritt.io says "raised from 1 investor" in 2025 with "AWS Startups" as investor (likely a credits program, **UNVERIFIED**); PitchBook/Crunchbase pages returned 403. Site says "Backed by top-tier investors" (unnamed).
Sources: https://tracxn.com/d/companies/typesafe/__fPC7t2VtGOz6qF_aK5y6KzoPEZ3dCBjkFq6qQcw51_c (2026-08-25); https://www.gritt.io/company/typesafe-ai/ (via search 2026-09-03); https://typesafe.ai/.

### C. The hackathon

**F14. CoreWeave Hacks: Agent Loops — TypeSafe is a named co-host, judge, and prize sponsor.**
Luma page (fetched 3 Sep 2026): "CoreWeave Hacks: Agent Loops Hackathon with Weights & Biases, AGI House, and TypeSafe AI"; Sept 13–14 (Sat–Sun), 400 Alabama St ste 202, SF; hosts Anna Shive, Weights & Biases, Alexa Orent, Lorenzo Balderrama Porras. Theme text: "This time we observe, evaluate, track, document, and self-improve agent iterations while we play with a robot dog and humanoid!" Sponsor line: "TypeSafe is a new AI lab that has built a new class of models designed for machine-native intelligence." Prizes: **Best Loop Design — robot dog (~$4k) + $2k cash + Fully Connected stage**; Most Production-Ready — F1 tickets (~$1–2k each) + $1k; Best Use of Weave $1,000; Best Use of ARIA $1,000; Best Use of marimo $500; Best Social Media demo $1,000; **"Best Use of TypeSafe AI — to be confirmed."** Judges include "Diogo Almeida | TypeSafe AI". Access: "The full CoreWeave SaaS stack for agents". Schedule: Day 1 doors 9 AM, kickoff 10:30, hacking 11:15, dinner 6:30 PM, close 9 PM; Day 2 doors 9 AM, submissions 1 PM, judging 1:30, presentations 3:30, awards 4:30.
Source: https://luma.com/coreweavehacks (fetched 2026-09-03). Sasha Sheng, 2 Sep 2026: "TypeSafe is sponsoring the CoreWeave hackathon and we will be giving some unhinged prizes - come thru." https://www.linkedin.com/in/sashasheng/recent-activity/all/. (A CoreWeave LinkedIn snippet says "September 12-13" and "$20K+ in prizes" — treat Luma's Sept 13–14 as authoritative.)

### D. Fallback surface (verified docs)

**F15. W&B/CoreWeave Serverless Inference: OpenAI-compatible, strict JSON-schema structured output, tool calling.**
Endpoint `https://api.inference.wandb.ai/v1` (OpenAI client with custom base URL); "Using Weave, you can trace, evaluate, monitor, and improve your Serverless Inference-powered applications." Structured output: `response_format = {"type":"json_schema","json_schema":{"name":..., "strict": true, "schema":{... "additionalProperties": false}}}` — "constrains Serverless Inference responses to a specific JSON schema… Use structured output instead of JSON mode when possible." JSON mode: `{"type":"json_object"}` but "the response's schema isn't guaranteed." Tool calling: `tools=[{"type":"function", ...}]`, `tool_choice="auto"`; "Serverless Inference only supports calling functions." Examples use `openai/gpt-oss-20b`. Concurrency limits per project/user (429 "Concurrency limit reached"); default spend caps Free $100/mo, Pro $6,000/mo. CoreWeave docs: "Serverless Inference: pay-per-token billing for catalog models" with rates at W&B Inference pricing.
Sources: https://docs.wandb.ai/guides/inference/ ; https://docs.wandb.ai/inference/response-settings/structured-output ; https://docs.wandb.ai/inference/response-settings/json-mode ; https://docs.wandb.ai/inference/response-settings/tool-calling ; https://docs.wandb.ai/guides/inference/usage-limits/ ; https://docs.coreweave.com/products/inference (all fetched 2026-09-03).

**F16. Cheap typed-decision models on Serverless Inference (prices per 1M tokens, in/out).**
`openai/gpt-oss-20b` $0.03/$0.13; `openai/gpt-oss-120b` $0.03/$0.17; `ibm-granite/granite-4.1-8b` $0.05/$0.10; `JetBrains/Mellum2-12B-A2.5B-Instruct` $0.05/$0.10; `nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B` $0.10/$0.25; `Qwen/Qwen3-30B-A3B-Instruct-2507` $0.10/$0.30; `google/gemma-4-31B-it` $0.10/$0.34; `deepseek-ai/DeepSeek-V4-Flash` $0.14/$0.28. Model IDs from the models page; prices from the pricing page. Free plan: "Free credits for a limited time. Additional inference billed monthly" (amount unstated). Which models honor strict json_schema beyond gpt-oss-20b is not enumerated in docs — **verify at the event with a 5-line probe**.
Sources: https://docs.wandb.ai/guides/inference/models/ ; https://wandb.ai/site/pricing/inference ; https://wandb.ai/site/pricing/ (fetched 2026-09-03).

**F17. Self-hosted fallback: vLLM structured outputs (`choice`, `regex`, `json`, `grammar`).**
vLLM's OpenAI-compatible server accepts `response_format={"type":"json_schema", ...}` and `extra_body={"structured_outputs": {"choice": ["positive","negative"]}}` (also `regex`, `json`, `grammar`); the old `guided_*` fields are deprecated since v0.12.0; "The default backend is `auto`". This is how to get an enum-typed classifier from any small open model on a CoreWeave CKS GPU (marimo on CKS is documented at https://docs.coreweave.com/products/cks/tutorials/marimo-notebooks).
Source: https://raw.githubusercontent.com/vllm-project/vllm/main/docs/features/structured_outputs.md (fetched 2026-09-03).

**F18. Weave traces typed extraction natively (Instructor/Pydantic).**
Weave's Instructor integration: `weave.init(project_name=...)`, `@weave.op()` on a function that calls `instructor.from_openai(OpenAI()).chat.completions.create(..., response_model=Person)` — the typed response is captured in the trace. The same pattern works against the W&B Inference base URL, so every System1 (or fallback) decision lands in FIA TELEMETRY as a typed object, not a string.
Source: https://docs.wandb.ai/weave/guides/integrations/instructor (fetched 2026-09-03).

---

## 3. Design implications for the F1 loop

### 3.1 The rule for where System1 belongs
System1's founders define its niche by negation of chat: unattended, high-frequency, decision-grade calls that return **values** (enum / bool / number / probability / calibrated confidence), where a confident wrong answer has real cost and "I don't know" must be a first-class output (F5, F6, F7). Chat/reasoning models (the CAR's driver, the RACE ENGINEER's proposals) remain frontier models. So: **System1 = the decision layer that runs between every lap, not the driver.** Anything that is a classification, a threshold, a routing decision, or a go/no-go with a confidence number is a System1 call; anything that generates prose/code/diffs is not.

### 3.2 Three concrete roles (each a sub-agent with an upgradeable typed schema)

**Role 1 — THE SCRUTINEER (tampering classifier, typed).**
Input: a harness diff (role skill file / prompt / tool list / memory policy) + the evidence channel (Weave trace summary for the generation). Output type: `{verdict: enum[LEGAL, BLACK_FLAG, REFER_TO_STEWARDS], category: enum[<harness-tampering taxonomy classes from the Aug 30 2026 preprint>], confidence: float in [0,1], evidence_span_ids: list[str]}`. Why System1 beats a frontier chat model: the scrutineer must be *read-only, cheap, fast, and calibrated* — it runs on every candidate generation and every role's diff (hundreds of calls per round), it must never be persuadable by the improver's prose (System1 is trained against "pleasing the human," F6), and REFER_TO_STEWARDS at low confidence is exactly the "know when uncertain" behavior TypeSafe claims (F7). The LINEAGE AUDIT re-runs the same typed classifier over the accepted lineage; because outputs are enums + confidence, the audit is a table, not a transcript.
Upgrade mechanic: the Scrutineer's *schema and thresholds* are the upgradable part (add a taxonomy class, tighten the BLACK_FLAG confidence bar). Evidence for upgrading it: false-negative tampering found by LINEAGE AUDIT.

**Role 2 — THE PIT-WALL STRATEGIST (thousands of typed decisions per race).**
During the RACE on the sealed circuit, the CAR emits telemetry per lap (tool errors, latency, token spend vs COST CAP, eval-item pass/fail). The strategist makes per-lap decisions: `{action: enum[PUSH, HOLD, BOX_NOW, RETIRE], engine_mode: enum[1..5], drs_allowed: bool, budget_burn_ok: bool, p_finish_under_cap: float, confidence: float}`. It is called once per lap per car (with GHOST CAR that is 2× calls), so cost and latency dominate; a frontier chat model at 2–10 s/call would make the race unwatchable and burn the COST CAP on meta-decisions. RETIRE on high-confidence overrun is the mechanism that enforces the COST CAP inside a generation instead of after it.
Upgrade mechanic: strategist decisions are logged as typed rows in Weave; the outer loop learns which decisions correlated with OFFICIAL score and edits the strategist's decision table / few-shot bank (not its weights — see ToS, F9).

**Role 3 — THE CREDIT-ASSIGNMENT ROUTER (which role gets the upgrade).**
After evaluation, the loop has a weakness (a failing eval cluster). The router answers *whose fault* with a typed output: `{blamed_role: enum[RACE_ENGINEER, STRATEGIST, AERO, POWER_UNIT, TYRES, DATA_ENGINEER, PIT_CREW, HISTORIAN], blame_share: dict[role -> float summing to 1], confidence: float, needs_ablation: bool}`. Each failing trace becomes one call; over an eval set that is hundreds to thousands of calls per generation — the volume argument again — and the `needs_ablation` flag at low confidence triggers a real ablation (re-run with one role's harness reverted) instead of guessing. The role with the highest attributed blame is the one that receives the RACE ENGINEER's upgrade package and the on-screen upgrade scene. This is the piece that makes "that specific person gets upgraded" *attributable*, per the non-negotiables.
Upgrade mechanic: the router's own accuracy is measured by whether upgrading the blamed role actually moved the OFFICIAL score; that number is what the HISTORIAN documents and what justifies upgrading the router's schema next round.

Secondary System1 uses if time permits: PARC FERMÉ gate (bool: is the harness frozen/unchanged during eval), DRS-style "is this eval item in-distribution" bool for the sealed circuit, and a "TEAM CLAIMED vs OFFICIAL" divergence detector (float).

### 3.3 The adapter and the fallback plan
Because the API shape is unpublished (F8) and access at the event is likely but not guaranteed (F14 "to be confirmed"), implement one interface and two backends:

```python
class TypedDecision(Protocol):
    def decide(self, schema: type[BaseModel], context: dict) -> tuple[BaseModel, float]:  # (value, confidence)
        ...
```

- **Backend A: System1** — filled in on-site from console.typesafe.ai / TypeSafe engineers (Diogo is judging; the team ran a "Build with TypeSafe" hack night in July, F12). Expect a values-not-strings API with calibrated confidence per F5/F6; map enums/bools/floats directly.
- **Backend B: W&B Serverless Inference** — `openai/gpt-oss-20b` (or `granite-4.1-8b`) with `response_format={"type":"json_schema","json_schema":{"name":"Verdict","strict":True,"schema":Verdict.model_json_schema()}}` at `https://api.inference.wandb.ai/v1` (F15, F16). Confidence is *not* calibrated here; approximate it by asking for a `confidence` field plus a 3-sample self-consistency vote, and label it "uncalibrated" in the REGS panel so the real-vs-simulated boundary stays honest.
- **Backend C (only if B's schema support fails for a model):** vLLM on CoreWeave CKS with `extra_body={"structured_outputs":{"choice":[...]}}` (F17).

All three log through Weave (`@weave.op()` + Instructor pattern, F18), so FIA TELEMETRY sees identical typed rows regardless of backend, and the Scrutineer's evidence channel stays append-only.

### 3.4 What "Best Use of TypeSafe AI" plausibly rewards, and how to speak to it
- Use it where chat fails (unattended decision, calibrated abstention), not as a drop-in chat replacement — this mirrors Diogo's talk thesis (F6) and the launch post (F5).
- Show **volume**: a counter of System1 decisions per generation on the pit-wall HUD (thousands), with cost in cents next to the frontier model's cost in dollars — "intelligence per dollar" is literally their tagline (F1).
- Show **calibration** as a game mechanic: REFER_TO_STEWARDS / needs_ablation paths that fire only at low confidence, and a reliability diagram in the HISTORIAN's notebook (marimo) built from Weave rows.
- Respect the ToS: decisions, not distillation targets (F9). Say so in the REGS panel.
- Keep the technical name out of the broadcast (visual rule): on screen it is "FIA STEWARDS' COMPUTER" or "PIT WALL"; "System1 / TypeSafe" appears in REGS.

---

## 4. Open gaps (to close on-site, Sept 13)

1. **API shape.** No public docs; console is login-gated (F8). Ask TypeSafe staff at kickoff for: base URL, auth, request/response format for enum/bool/float/probability outputs, whether confidence is returned natively, rate limits, and whether the hackathon key is allowed for "production-like" high-frequency use (ToS says preview, F9).
2. **Prize criteria.** "Best Use of TypeSafe AI — to be confirmed" (F14). Ask what they want to see; have the three roles above ready as a menu.
3. **Benchmarks/latency.** "Up to 100x faster and cheaper" is unmeasured publicly (F5). Measure p50/p95 latency and cost per decision on-site for both backends and put the numbers in the HISTORIAN's report.
4. **Structured-output model coverage on W&B Inference.** Docs only show `gpt-oss-20b` with strict json_schema (F15). Probe granite-4.1-8b and Nemotron-3.5-Lightning before committing.
5. **Architecture.** Diffusion-LM (LLaDA fork) vs autoregressive is UNVERIFIED (F10); irrelevant to the design but worth one question for the REGS panel.
6. **Waitlist vs console.** The launch post says "Join the waitlist" but the site has no form (F5/F1); the console may be the waitlist. Sign up before the event with the team email.
7. **Data use.** typesafe.ai/privacy returned 404 (F8); confirm whether hackathon inputs are retained/trained on before sending eval items from the sealed circuit — otherwise send only hashed/summarized traces to System1 to keep "OFFICIAL" private.
