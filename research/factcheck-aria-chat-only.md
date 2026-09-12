# Fact-check: "ARIA is chat-only and never launches experiments"

Checked 2026-09-03 against live official sources (docs.wandb.ai, coreweave.com). Claim under test, from the SCRUTINEER design (§3 Team Principal row, §4 matrix ARIA column, §9 "Best Use of ARIA", §10 risk):

> "ARIA is chat-only: it can analyze W&B runs to find patterns, compare against baselines, draft Reports, and recommend a next experiment, but it does not launch experiments (the Launch-queue/autoresearch path is stretch); 'researchers stay in control by approving launches'. It requires Multi-tenant + team project + admin toggle to be available."

## Verdict: REFUTED on the core "chat-only / never launches" point; prerequisites CONFIRMED; "approving launches" UNVERIFIED

| Sub-claim | Status | Evidence |
|---|---|---|
| ARIA analyzes runs, finds patterns, compares, drafts Reports, recommends next steps | CONFIRMED | Overview: "Analyze experiments to find patterns and insights", "Propose next steps, such as recommending hyperparameters to try", "Build saved views and reports to share insights with your team" (https://docs.wandb.ai/aria/overview, fetched 2026-09-03). Chat page example prompts: "Compare the last 10 runs and tell me which hyperparameters mattered most", "Write up the comparison as a report I can share with my team" (https://docs.wandb.ai/aria/chat, fetched 2026-09-03). |
| ARIA is "chat-only" and "never launches anything" | **REFUTED** | Overview capability list includes "Run experiments and sweeps to test new ideas" and the intro says ARIA "helps you analyze and run experiments" (https://docs.wandb.ai/aria/overview). Autoresearch page: "Based on your previous runs, ARIA can recommend and run new experiments"; "ARIA uses W&B Launch to run experiments in a sandbox environment"; "After a queue has an active agent, ARIA can submit jobs, relaunch runs with config overrides, monitor results, debug failures, and compare metrics" (https://docs.wandb.ai/aria/autoresearch, fetched 2026-09-03). Press release 2026-06-29: "ARIA powers the full research cycle, forming hypotheses, launching experiments, evaluating results, and recommending next steps" and it can create "sweep configurations from natural language" (https://www.coreweave.com/news/coreweave-aria-launches-as-an-ai-research-and-iteration-agent-with-autonomous-research-and-collaborative-intelligence). |
| "Launch-queue/autoresearch path is stretch" (i.e., not a documented product path) | **REFUTED as a product-capability statement** (it is documented, GA-in-preview); it may still be a reasonable *scope* call for 26 hours because it needs your own Launch agent (see below) | https://docs.wandb.ai/aria/autoresearch |
| "researchers stay in control by approving launches" | **UNVERIFIED** — no docs sentence describes an approval/confirmation gate before ARIA submits a job. Neither the autoresearch page nor the press release mentions human-in-the-loop approval. Do not attribute this phrase to W&B docs. | https://docs.wandb.ai/aria/autoresearch; press release above |
| Requires Multi-tenant Cloud | CONFIRMED | Every ARIA page carries "Available only in W&B Multi-tenant Cloud" (https://docs.wandb.ai/aria/overview, /aria/chat, /aria/autoresearch, /aria/governance). |
| Requires a team project (not personal entity) | CONFIRMED | "ARIA works in team projects, not in your personal entity." (https://docs.wandb.ai/aria/overview) |
| Requires admin toggle | CONFIRMED, with a precision fix: the toggle is called **Smart features**, under User menu > Settings > Privacy > Smart features; "W&B Admins can manage access to LLM-powered features"; "Smart features control options are available for Enterprise and Pro accounts." | https://docs.wandb.ai/aria/overview ("Your organization admin must also enable Smart features"); https://docs.wandb.ai/aria/governance |

## The precise correction

Replace the design text with:

> ARIA (W&B's "AI Research and Iteration Agent", public preview since 2026-06-29) is a chat agent inside W&B that analyzes runs, proposes next steps, builds panels/saved views/Reports, **and can run experiments and sweeps**: "Based on your previous runs, ARIA can recommend and run new experiments" via W&B Launch. The gating fact is that ARIA "can manage the W&B-side Launch workflow after a queue and active Launch agent are available" and "usually cannot start a durable Launch agent on your local machine, Kubernetes cluster, SageMaker environment, or Vertex AI environment" — so the *team* must run a Launch agent (e.g., on a CoreWeave/molab box) for ARIA to submit jobs, relaunch runs with config overrides, monitor results and debug failures. No documented approval gate exists; if the design wants a human "Team Principal" approving launches, that gate must be built by us (e.g., ARIA drafts the job/override, a human clicks to enqueue), and stated as our design choice, not as an ARIA property. Availability: Multi-tenant Cloud only, team projects only, org admin must enable **Smart features** (Settings > Privacy; controls exist for Enterprise and Pro accounts).

Specific edits:
- §3 Team Principal: "ARIA (chat-only ...)" -> "ARIA (chat + Launch-backed autoresearch ...)"; keep "approving launches" only as our own gate.
- §4 matrix, ARIA/self-improve: "ARIA never launches anything (Launch-queue path is stretch)" -> "ARIA can submit/relaunch jobs and sweeps through a W&B Launch queue with an active agent we run; we choose whether to enable that or keep ARIA in recommend-only mode."
- §9 "Chat-only is stated honestly" -> would be *inaccurate*; say "recommend-only by our choice" or use the run path.
- §10 risk: keep, but name the toggle: "Smart features off / Free plan lacks Smart-features controls / personal-entity project."

## Notes / caveats
- docs.wandb.ai pages show no last-updated dates; fetched 2026-09-03.
- Press release calls ARIA "public preview" (2026-06-29); docs do not label it preview. Treat launch/run features as preview-quality for planning.
- The docs do not document a human-approval step; absence in docs is not proof it doesn't exist in the UI, but the design must not cite it as documented.

## Sources
- https://docs.wandb.ai/aria/overview (fetched 2026-09-03)
- https://docs.wandb.ai/aria/chat (fetched 2026-09-03)
- https://docs.wandb.ai/aria/autoresearch (fetched 2026-09-03)
- https://docs.wandb.ai/aria/governance (fetched 2026-09-03)
- https://www.coreweave.com/news/coreweave-aria-launches-as-an-ai-research-and-iteration-agent-with-autonomous-research-and-collaborative-intelligence (dated 2026-06-29)
