# R9 — What the organizers and judges mean by "a good loop"

Research thread for the SCRUTINEER / F1-team loop. Live-web only; every claim carries a URL and a date. Researched 2026-09-04. Anything I could not open is marked UNVERIFIED.

## Summary

1. **The event page is the rubric.** The official CoreWeave Hacks page (luma.com/coreweavehacks) says, verbatim: "This time we **observe, evaluate, track, document, and self-improve** agent iterations while we play with a robot dog and humanoid!" It then lists six archetypes of a loop it wants to see: a dojo where agents train themselves, a hall of mirrors where agents grade their own reflections, a memory palace agents keep rewriting, a forge where agents hammer out their own tools, "a loop that learns from its own scars", and "a colony of agents keeping each other honest". Best Loop Design = robot dog + $2k + a stage slot at Fully Connected (Sept 29–Oct 1). No numeric judging criteria are published; the previous W&B hackathon (WeaveHacks 2) used five criteria — Creativity, Self-improving-ness, Utility, Technical Execution, Sponsor Usage — and that is the best available proxy.

2. **W&B/CoreWeave have a house vocabulary for the loop and repeat it everywhere.** Across the May 28 press release, the CoreWeave "closes the loop" blog, the Weave rebuild report (Turlay, Jul 28), the Weave product page and the Fully Connected agenda, the same phrases recur: *"learn and improve continuously from real-world experience"*, *"out-of-the-box signals to surface failure modes"*, *"a flexible evaluation framework to prevent regressions"*, *"turning production traces into benchmarks"*, *"quality gates that determine which behaviors get promoted to production"*, *"exponentially compounding improvement"*, *"the superintelligence loop"* (= "a closed feedback loop between training and inference so agents don't just become more reliable — they compound in capability over time"), and *"autoresearch"* (Karpathy's project, explicitly cited by W&B). CoreWeave's "AI Loop" blog names five stages — **Run → Observe → Curate → Evaluate → Improve** — and uses the words *"lineage"*, *"receipts"*, *"proof"* and *"beats the version it replaces"*.

3. **ARIA's own loop is the judge-side template for "self-improve".** ARIA (public preview June 29, 2026; Julia Rose is Staff PM) "forms hypotheses, designs experiments, launches runs through W&B Launch, evaluates results, and recommends the next iteration", with "Researchers stay in control by approving launches". It documents itself: "automatically creates W&B workspaces, panels, and reports that make its reasoning transparent and actionable." Hypothesis → experiment → evaluate → recommend → human approval → persistent report is the shape the ARIA team recognises.

4. **The judges' own hard problem is verification of self-modifying systems.** Turlay's Weave rebuild says "Offline evals only score the failure modes you already know about" and that online signals should be "extracted into offline eval datasets … creating a quality flywheel." Fully Connected runs a lab literally titled "Your Agent Learned to Cheat: Catching and Fixing Shortcuts" (an agent "earns a perfect score without solving the task"). The W&B NYC Tech Week talk on multi-agent systems names the failure modes judges expect a team-of-agents to guard against: "cascading assumptions, runaway loops, and higher token costs". Diogo Almeida's TypeSafe builds System1 for "autonomous agents operating without a human constantly supervising" where "correctness and latency are non-negotiable". A loop that shows its own cheating being caught speaks directly to this panel.

5. **What prior W&B hackathon winners had in common:** a *measurable* improvement curve (e.g. cache hit "climbs from 14% to 83%"), a *concrete mechanism* (rules extracted from reviews, skills auto-written from failure patterns, tactics stored and re-ranked), Weave traces as the evidence, and a self-improvement story that could be told in one sentence. Meta-agents that "build other AIs — generating, testing, and refining agents" and an agency that "hires and fires its own agents" were both WeaveHacks 2 winners — the closest precedents to a role-upgrading team.

**Bottom line for Best Loop Design:** on stage the team must show, in order, (a) a failure observed in a Weave trace/signal, (b) an evaluation that turns it into a number, (c) tracking of that number across versions with lineage, (d) an auto-generated document (report / marimo notebook) explaining the hypothesis, (e) a self-improvement that is *attributable* to one component and *verified* on a held-out gate before promotion, and (f) at least one case where the loop *refused* an upgrade (regression or cheating caught). That sequence is literally the five verbs on the event page plus the "keeping each other honest" archetype.

---

## Findings with citations

### A. The event itself

**F1. The five verbs and the six archetypes are the organizers' own words.**
Event: "CoreWeave Hacks: Agent Loops Hackathon with Weights & Biases, AGI House, and TypeSafe AI", Sat–Sun Sept 13–14, 400 Alabama St Suite 202, SF. Verbatim theme line: "This time we **observe, evaluate, track, document, and self-improve** agent iterations while we play with a robot dog and humanoid!" Verbatim prompt list: "Will you build a dojo where agents train themselves? A hall of mirrors where agents grade their own reflections? A memory palace agents keep rewriting? A forge where agents hammer out their own tools? A loop that learns from its own scars? A colony of agents keeping each other honest?" Broader framing: agents that "cycle through reasoning and action, catching their own mistakes, and pushing towards more powerful results."
Source: https://luma.com/coreweavehacks (fetched 2026-09-04).
Relevance: "a loop that learns from its own scars" and "a colony of agents keeping each other honest" map one-to-one onto the F1 team-of-roles + Scrutineer design.

**F2. Prizes and schedule.**
Best Loop Design: "Robot Dog ($4k value) and $2k cash (all cash prizes distributed evenly between team members), presentation at Fully Connected conference." Most Production-Ready: "F1 tickets (~$1-2k/ticket) + $1k cash". Best Use of Weave $1,000; Best Use of ARIA $1,000; Best Use of marimo $500; Best Social Media demo $1,000; Best Use of TypeSafe AI: TBD; "$20k+ in prizes". Schedule: Sat 10:30 kickoff, 11:15 hacking begins, 21:00 office closes; Sun 13:00 submissions due, 13:30 judging begins, 15:30 project presentations, 16:30 awards. Sponsor one-liners: Weave = "developer-first toolkit for tracing, debugging and evaluating your AI apps"; W&B "the full agent stack" (ARIA, Models, Sandboxes); marimo = "modern Python notebooks with free cloud GPUs in molab"; TypeSafe = "new AI lab that has built a new class of models designed for machine-native intelligence".
Source: https://luma.com/coreweavehacks (2026-09-04).
Relevance: the Most Production-Ready prize is *F1 tickets* — the theme is already in the room. Judging is 13:30–15:30 before presentations, so the artifact must be self-explanatory without a pitch.

**F3. Judge list (verbatim titles from the page).**
Emmanuel Turlay — Weave team, W&B, Director of Engineering; Julia Rose — ARIA team, W&B, Staff Product Manager; Konstantin Taletskiy — marimo, Developer Relations Engineer; Ryan Biddy — W&B; Diogo Almeida — TypeSafe AI, "Co-inventor of RLHF and InstructGPT"; Mo Tiwari — Google DeepMind, AI Researcher; Nirav Patel — Okta; Athena Leong — Outernet; Mehul Arora — Rox, Applied AI; Megha Anand — Salesforce, Sr. Security Engineer; Shivank Joshi — Mindis.ai; Kshitij Dixit — Perit.ai; Xiangyi Li — BenchFlow; Jinjing Liang — Stably AI; Venkatarao Rebba — Meta MLE; Soham Patel — YC founder; Jen Hoskins — NVIDIA; Yasmina Benkhoui — NVIDIA; AGI House representative.
Source: https://luma.com/coreweavehacks (2026-09-04).
Relevance: three of the sponsor judges own the exact products (Weave, ARIA, marimo); two are security engineers (Okta, Salesforce) — an auditor/tamper story lands with them; a BenchFlow founder will care about held-out benchmarks.

**F4. No numeric rubric is published for CoreWeave Hacks; WeaveHacks 2 published one.**
WeaveHacks 2 (Devpost) judging criteria, verbatim: "Creativity — How unique is the project? Is either the problem or the approach new?"; "Self-improving-ness — Does the agent improve its operation over time? Is the growth meaningful?"; "Utility/Usefulness — How useful is this project? Does it solve a real problem?"; "Technical Implementation/Execution — Does it run? Did they make reasonable architecture decisions?"; "Sponsor Usage — Did they meaningfully use one or more sponsor tools?" No weights given.
Source: https://weavehacks2.devpost.com/ (fetched 2026-09-04; event was 2025). Older source — flagged.
Relevance: "Is the growth meaningful?" and "Does it run?" are the two questions to answer visibly. Same organizer lineage (W&B hackathons 1–4 → CoreWeave Hacks), same office.

**F5. WeaveHacks 3 (Jan 31–Feb 1, 2026) defined "self-improving" as** "better memory systems, new forms of RL and fine-tuning, new ways of dynamic tool creation, self improving loops". 200+ builders. WeaveHacks 4 (June 6–7, 2026) was "Multi-Agent Orchestration": "self-improving, collaborative multi-agent systems", "agent training arenas".
Sources: https://luma.com/weavehacks3 ; https://luma.com/weavehacks ; https://x.com/wandb/status/2019207262221529596 (all fetched 2026-09-04).
Relevance: CoreWeave Hacks is the fifth in this series; the organizers have already run "multi-agent" and "self-improving" themes — the new event fuses them ("colony of agents keeping each other honest"). A team-of-roles loop is on-theme, not off.

### B. The house vocabulary (W&B / CoreWeave)

**F6. The May 28, 2026 launch press release is the canonical statement.**
Dateline "LIVINGSTON, N.J. — May 28, 2026". Headline: "CoreWeave Launches Unified Agentic AI Platform for Continuous Agent Improvement". Subhead: "…enterprises can ship agents that improve using real-world data, paving the way for the superintelligence loop". Chen Goldberg (EVP Product & Engineering): "Today's tradeoff: dev cycles that can't keep up, or shipping agents and discovering failure modes in production." and "Enterprises that put agents in production first and let them continuously improve from real-world experience aren't just building more reliable AI, they're accelerating the path to superintelligence." Products named: Serverless RL, CoreWeave Inference, W&B Weave, W&B Skills, MCP server. Vocabulary: "failure modes", "regressions", "built-in and custom signals", "compounding in capability over time", "superintelligence loop (closed feedback loop between training and inference)".
Source: https://www.coreweave.com/news/coreweave-closes-the-training-to-inference-gap-for-autonomous-agent-improvement (2026-05-28).
Relevance: use these exact nouns in the REGS panel: *signals, failure modes, regressions, real-world experience, compounding*.

**F7. The CoreWeave "closes the loop" blog defines the four-part loop and what Skills are for.**
"a closed feedback loop between training and inference so agents don't just become more reliable — they compound in capability over time." Stages/products: Serverless RL (training for "multi-turn agentic tasks"), CoreWeave Inference ("production execution layer"), W&B Weave ("end-to-end observability to monitor production agents … out-of-the-box signals to surface failure modes … catch regressions before they reach users"), W&B Skills + MCP ("turn general-purpose coding agents into AI researchers and agent builders that work around the clock … let your agent run thousands of experiments around the clock"). Closing: "The gap between development and production has always been where agent projects stall. CoreWeave closes it. Improve automatically, and build systems that compound."
Source: https://www.coreweave.com/blog/coreweave-closes-the-loop-between-training-and-inference (page dated Aug 25, 2026; the launch it describes is May 28, 2026).
Relevance: the outer improver in the F1 loop should literally be "a coding agent with W&B Skills + MCP" — that is the sponsor's definition of autonomous improvement.

**F8. CoreWeave's "AI Loop" blog gives a five-stage loop and the words "lineage", "receipts", "proof".**
"Launch is now closer to the beginning than the end. The moment a model or agent meets production, it starts generating the most valuable dataset you will ever own: evidence of how it actually behaves with real users, real edge cases, and real failures." Stages: **Run** (CoreWeave Inference / CKS) → **Observe** ("Weave traces", "live scoring", Mission Control) → **Curate** ("Cluster failures into datasets, versioned in Registry") → **Evaluate** ("Weave Evaluations as quality gates") → **Improve** (Serverless RL/SFT, tracked in W&B Models, "Automations" to redeploy). Vocabulary: "regression", "proof", "beats the version it replaces", "versioned record", "lineage", "receipts", "self-improve".
Source: https://www.coreweave.com/blog/the-ai-loop-launch-day-is-day-one (Aug 25, 2026).
Relevance: "Curate" is a stage the event's five verbs omit; a *failure dataset versioned in Registry* is the sponsor-native artifact for "track". "Beats the version it replaces" = ghost car.

**F9. Turlay's Weave rebuild (Jul 28, 2026) — the Weave judge's own framing.**
Opening: "We've rebuilt W&B Weave from the ground up to help production agents learn and improve continuously from real-world experience, so they can achieve and maintain reliable quality." Four pillars: end-to-end observability with "sessions, turns, and steps as first-class concepts"; "Weave continuously analyzes your production traffic and surfaces behavioral issues: frustrated users, unsafe content, code failures, etc."; "a complete improvement loop from inference to training"; an evaluation framework to "prevent regressions". Key sentences: "Offline evals only score the failure modes you already know about"; "Online evals cast a wider net"; "Online signals help developers detect new failure modes, that can then be extracted into offline eval datasets, accelerating your iterative development cycle and creating a quality flywheel." Turlay on X: "regular application tracing doesn't cut it. We need tools that understand the specific semantics of agents (multi-turn sessions, tool calls, long context, etc.)".
Sources: https://wandb.ai/wandb_fc/product-announcements-fc/reports/New-in-W-B-Weave-Observability-and-continuous-improvement-for-production-agents--VmlldzoxNzAzMTcxNg (Jul 28, 2026); https://x.com/neutralino1/status/2061949197851742525 (text via search snippet; page itself returned HTTP 402 — quote UNVERIFIED beyond the snippet).
Relevance: Turlay will look for (i) sessions/turns/steps used natively (each F1 role = a sub-agent span), (ii) a *signal* → *offline eval dataset* handoff ("quality flywheel"), (iii) a regression gate.

**F10. Weave Signals are the sponsor's word for "observe → failure mode".**
Docs: "Signals surface quality and safety issues to flag problems, find patterns, and highlight the traces that need your attention." Key terms: Turn, Rating (0.0–1.0), Tags (e.g. "user-frustration", "nsfw"). Built-in tag templates include User Frustration, Malicious Intent (Jailbreaking), NSFW; ratings presets: User Satisfaction, User Good Intent, Safe-for-Work, Response Quality; custom signals supported. Older monitors page: "Every incoming production trace is automatically processed and scored"; "Processing is powered by CoreWeave compute and CoreWeave GPUs"; "Accelerate the research loop. Use the scores and failure analyses generated by signals to identify weaknesses…"
Sources: https://docs.wandb.ai/weave/guides/tracking/view-agent-signals ; https://docs.wandb.ai/weave/guides/evaluation/monitors (both fetched 2026-09-04).
Relevance: a **custom signal per F1 role** (e.g. "strategy-miscall", "tyre-misread", "aero-regression") is the native credit-assignment hook — the tag *names the role*.

**F11. Weave product page names the exact "why": offline perfection fails.**
"Teams have tried to perfect agents offline, only to watch reliability collapse in production against failure modes no offline eval could catch." And: "Automatic self-improvement inspired by Andrej Karpathy's autoresearch is becoming essential… Using W&B skills and the MCP server, coding agents like Claude Code connect to Weave. They can read live production data, run evaluations, and execute automatic iteration loops on their own, driving exponentially compounding improvement in reliability." Also: "Weave organizes traces into sessions and turns … pinpoint root cases for failure modes that would otherwise stay buried in raw logs."
Source: https://wandb.ai/site/weave/ (fetched 2026-09-04; images dated 2026/05).
Relevance: the words "autoresearch", "iteration loops", "compounding" are the judges' words for "self-improve".

**F12. W&B MCP server (GA May 20, 2026) — 20 named tools and the "overnight research loop" framing.**
Endpoint https://mcp.withwandb.com/mcp. Tools: probe_project_tool, query_wandb_tool, query_weave_traces_tool, resolve_trace_roots_tool, list_entities, query_wandb_entity_projects, get_run_history_tool, compare_runs, diagnose_run, list_registries, list_registry_collections, list_artifact_versions, get_artifact_details, compare_artifact_versions, create_wandb_report_tool, log_analysis_to_wandb, search_wandb_docs_tool, count_traces_tool, infer_trace_schema_tool, summarize_evaluation. Framing: teams running "overnight agentic research loops" where agents "propose experiments, monitor results, and stage iterations with minimal supervision"; example workflow: "Agent clusters failure modes across 100 rollout traces and ranks examples"; "The experiment backend the agent reads from has to be the durable layer the team's research compounds on."
Source: https://wandb.ai/wandb_fc/product-announcements-fc/reports/Introducing-the-W-B-MCP-Server-An-agent-native-interface-for-your-experiments-and-traces--VmlldzoxNjk0MDE5OQ (May 20, 2026; authors Nicolas Remerscheid, Anish Shah).
Relevance: "document" has a native tool: `create_wandb_report_tool` + `log_analysis_to_wandb`. "Track" = `compare_runs`, `compare_artifact_versions`. The improver reading `query_weave_traces_tool` but never writing traces is the FIA-telemetry asymmetry.

**F13. W&B Skills (github wandb/skills) — three skills, one is literally "autoresearch".**
`wandb-primary` ("Broad W&B project analysis and operations across runs, Artifacts, Registry, Weave, Reports, Workspaces, and Launch"), `wandb-eval-tables`, and `wandb-autoresearch` ("Bounded training research through W&B Launch, including readiness checks, serial trials, comparison, and resumable state"). Install: `npx skills add wandb/skills --skill '*' --yes --global`; supported agents listed: Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI.
Sources: https://github.com/wandb/skills/blob/main/README.md ; https://docs.wandb.ai/platform/wb-skills ; https://wandb.ai/site/skills/ (all fetched 2026-09-04).
Relevance: "readiness checks, serial trials, comparison, resumable state" is W&B's own checklist for a bounded improvement loop — mirror it (cost cap = bounded; parc fermé = serial; ghost car = comparison; lineage = resumable state).

**F14. ARIA (public preview June 29, 2026) is the judges' reference self-improving research loop.**
"forms hypotheses, designs experiments, launches runs through W&B Launch, evaluates results, and recommends the next iteration." "Researchers stay in control by approving launches, while ARIA handles the repetitive work between iterations." "automatically creates W&B workspaces, panels, and reports that make its reasoning transparent and actionable." Press: "analyzing thousands of runs and tens of thousands of metrics in minutes"; Chen Goldberg: "an always-on research collaborator that turns the experiment data teams are already generating into continuous, compounding improvement." "Built using W&B Weave"; Weave agent capabilities GA same day. Access: open any W&B project, click the agent icon in the sidebar.
Sources: https://wandb.ai/site/agent/ ; https://www.coreweave.com/news/coreweave-aria-launches-as-an-ai-research-and-iteration-agent-with-autonomous-research-and-collaborative-intelligence (Jun 29, 2026); https://siliconangle.com/2026/06/29/coreweave-debuts-aria-agent-automate-ai-research-weights-biases/ (Jun 29, 2026).
Relevance: Julia Rose (ARIA PM) will recognise hypothesis → experiment → evaluate → recommend → **human approves launch** → report. The Team Principal (human) approving an upgrade package is ARIA's "approving launches".

**F15. Fully Connected 2026 (Sept 29–Oct 1) — where the Best Loop Design winner presents — describes the loop track verbatim.**
"Accelerate the agent loop": "The fastest-improving agent systems aren't just running tasks—they're learning from their own outputs… how evaluation-driven development makes these systems trustworthy in practice, from turning production traces into benchmarks to building quality gates that determine which behaviors get promoted to production… agents that automate research tasks and get measurably better overtime." "Agent evaluation and reliability": "Demos don't predict production performance—rigorous evaluation does… detect regressions… construct high-quality evaluation datasets from real-world traces, and which metrics actually correlate with user outcomes." Labs: "Autoresearch: Building the Tireless Scientist" ("proposes changes, runs experiments, and iterates toward measurable progress on a real benchmark. Every step is traced with W&B Weave"); "Your Agent Learned to Cheat: Catching and Fixing Shortcuts" ("discover how it earns a perfect score without solving the task. Then fix the test, try again, and compare versions from a real RL run"); "Ship It or Block It: Red-Team and Govern a Production AI Agent" ("governance review gate on a live agent… governance board deciding whether to approve or block").
Source: https://www.coreweave.com/fully-connected-2026/agenda (fetched 2026-09-04).
Relevance: "quality gates that determine which behaviors get promoted", "ship it or block it", "your agent learned to cheat" — the Scrutineer/black-flag mechanic is the same story CoreWeave is telling on its own stage three weeks later.

**F16. Multi-agent failure modes the W&B team names.**
NYC Tech Week 2026 W&B session "Autonomously improving agent swarms" (Uma Krishnaswamy, Nicolas Remerscheid): coordinated agents "introduce new failure modes like cascading assumptions, runaway loops, and higher token costs"; the loop is "trace agent interactions across prompts, tools, API calls, and sessions… score outputs with evaluators, compare runs, and turn debugging data into a repeatable optimization loop."
Source: https://www.brighttalk.com/webcast/20648/672150 (2026; fetched 2026-09-04).
Relevance: a team-of-roles loop must visibly guard against cascading assumptions (one role's wrong output poisoning others), runaway loops (cost cap) and token cost (budget per generation). Show all three in the REGS panel.

**F17. The Weave rebuild's press coverage adds the "ship first" framing and the W&B VP Product line.**
Ken Yeung, "Ship First, Fix Later: CoreWeave's Bet on the Autonomous Agent Loop" (May 28, 2026): loop = deploy → Weave "captures production interactions and identifies failures" → "signals feed into CoreWeave's Serverless RL for post-training" → improved agent returns; Phil Gurbacki (W&B VP Product): "The gap between development and production has always been where agent projects stall".
Source: https://theaieconomy.substack.com/p/ship-first-fix-later-coreweave-autonomous-agent-loop (May 28, 2026).
Relevance: the sponsor story is "production signals → training" — so the RACE (production) must produce the signal that drives the upgrade, not a synthetic benchmark alone.

### C. Judges' individual lenses

**F18. Diogo Almeida / TypeSafe — reliability without a supervising human.**
TypeSafe (founded mid-2024 by Almeida, Erik Gafni, Sasha Sheng) builds System1, "designed for machine-to-machine execution rather than human conversation… environments where correctness and latency are non-negotiable: real-time decision systems, compliance pipelines, large-scale automation, or autonomous agents operating without a human constantly supervising." "Rather than bolting guardrails onto probabilistic models after the fact, TypeSafe is embedding reliability directly into the model itself." Site tagline: "Intelligence per dollar: The most important metric for the next century."
Sources: https://newsletter.foundersysk.com/p/your-showcase-primer-typesafe-ai (Mar 12, 2026); https://typesafe.ai/ (fetched 2026-09-04). System1 API/docs: not on the public site — UNVERIFIED (see R6).
Relevance: Almeida co-invented RLHF; he will probe whether the reward/eval can be gamed and whether "intelligence per dollar" improves. Show cost-per-lap-time and a tamper-resistant scorer.

**F19. Konstantin Taletskiy / marimo — notebooks as the document stage.**
marimo pair "transforms your notebook into a collaborative thinking canvas for you and your AI agents" and lets agents run code against the live kernel; molab "launched on CoreWeave, providing GPU compute, substantial CPU and RAM, and longer sessions, all for free." marimo's founding claim: "over a third of the 10 million Jupyter notebooks on GitHub fail to reproduce"; marimo stores notebooks as pure Python. Taletskiy is listed as marimo Developer Relations Engineer on the event page; he rebuilt marimo's reactive engine "as tinymo … inside a live marimo notebook".
Sources: https://marimo.io/blog/newsletter-26 (Jul 27, 2026); https://marimo.io/blog/joining-coreweave (Oct 30, 2025); https://luma.com/coreweavehacks (2026-09-04).
Relevance: "document" = a reproducible marimo notebook per generation (the Historian role's artifact), executed on molab GPUs; an agent editing it live via marimo pair is the sponsor-native demo.

**F20. Mo Tiwari — UNVERIFIED lens.** Listed on the event page as "Google DeepMind, AI Researcher" (previously OpenAI per the page). I could not fetch a talk or post of his on loops; search budget exhausted before locating one. Treat as a research-rigor judge (held-out evaluation, ablations, no leakage).
Source: https://luma.com/coreweavehacks (2026-09-04).

**F21. Independent verification lens the panel shares.**
Stefano Maestri (Aug 10, 2026): "you can only delegate the autonomy you can verify cheaply and at high frequency"; "That verification must above all be cheap, so it can run at high frequency, and it must not be easily gamed." He splits self-improvement into weights (weeks) vs harness (turns), and quotes "Sample More, Reflect Less" (arXiv 2607.28576): same-model self-reflection loses to repeated sampling at equal token budget — reflection "done with different models… does give good results."
Source: https://artificialcode.substack.com/p/agents-improve-themselves-but-who (Aug 10, 2026).
Relevance: the grader/scrutineer must be a *different* model (or a deterministic sim) from the improver; a same-model "hall of mirrors" is the archetype the event lists but the literature warns against — make the mirror a different model and say so.

### D. What won before

**F22. WeaveHacks 2 winners (Devpost gallery, tagged "Winner").**
Daydreamer ("pretrain on the world (video), imagine the solution"); ReviveAgent ("self-improving" dependency-hell fixer); the convergence ("agents that improve…"); Silicon Valhalla (knowledge-cutoff fixer); Popstar ("Automating RL reward design and training methods for video game environments using LLMs"); SynErgi ("Self-evolving grid optimizer combining multi-agent planning and GRPO reinforcement learning"); ContentEngine; AVAX ("A self-improving AI social-media team that hires and fires its own agents"); CO-DREAMER; ERA ("Self-improving AI that builds other AIs — generating, testing, and refining agents"); Product Mate.
Source: https://weavehacks2.devpost.com/project-gallery (fetched 2026-09-04; event 2025 — older source).
Relevance: two winners were *teams that manage their own members* (AVAX hires/fires agents; ERA generates/tests/refines agents). A team of F1 roles that get upgraded, benched, or black-flagged is a recognised winning shape — the novelty must come from attribution + audit + the upgrade scene, not from "multi-agent" alone.

**F23. WeaveHacks 3 gallery (Jan–Feb 2026) — 61 projects, 4 finalists (names not labeled on the page).**
Patterns among the strongest write-ups: measurable curves ("WebScout … cache climbs from 14% to 83%"); Weave as the evidence layer ("Fractal: Weave traces; LLM Judge scores outputs; system updates weights to favor high-performing prompts"; "Weave Got This: W&B Weave traces research runs; automated scorers evaluate quality; improvement reports suggest updates"); skills written from failure patterns ("soft beds: gives agents REM sleep—looks at past interactions, finds patterns of failure, and fixes them"; "mothBot: agent can save tool chains as skills"); event-sourced memory for counterfactuals ("DML: Every memory operation recorded as immutable event; enables counterfactual analysis"); evidence-backed experiment loops ("OpenClaw Trace: Mine session traces for errors, friction, missed opportunities; cluster and run experiments"); Darwin ("Reviewers' comments extracted as style rules ranked by usage").
Source: https://cerebralvalley.ai/e/weave-hacks-3-self-improving-agents-hackathon-with-weights-and-biases-7014fe80/hackathon/gallery (fetched 2026-09-04). Finalist identities: UNVERIFIED (page shows "Finalists 4" but no labels).
Relevance: several prior entries already did "mine traces → cluster → write skill". To be new, the F1 loop must add what none did: *per-role* attribution, an *auditor that can reject*, a *public/private split*, and a visible upgrade scene.

**F24. NVIDIA's autoresearch write-up (Jul 14, 2026) — the six-step loop the ecosystem now expects, including a Documentation step.**
Baseline profiling → hypothesis generation → experiment execution "with defined budgets" → metrics analysis → iteration → **documentation** ("Summarizing findings for human review"). "The goal of autoresearch is not to remove the researcher from the loop, but instead to hand off the repetitive setup and iteration work to the agent." Skills used: brev-etiquette, session-memory ("durable session diary for long-running work"), autoresearch ("managing baselines, branches, and ledgers").
Source: https://developer.nvidia.com/blog/how-to-run-an-autoresearch-workflow-with-rl-agent-skills-and-nvidia-nemo/ (Jul 14, 2026).
Relevance: "budgets", "baselines, branches, and ledgers" and a "session diary" are the sponsor-adjacent words for cost cap, lineage, and the Historian's log.

---

## Design implications for the F1 loop

1. **Speak the five verbs literally, in order, on one screen.** Put OBSERVE / EVALUATE / TRACK / DOCUMENT / SELF-IMPROVE as the five stages of every race weekend, each with a named W&B/marimo artifact: Observe = Weave session with one span per role + role-named custom Signals; Evaluate = `weave.Evaluation` on a held-out circuit ("OFFICIAL") vs practice ("TEAM CLAIMED"); Track = W&B run per generation + Registry-versioned failure dataset ("Curate", F8) + `compare_runs`; Document = auto-generated W&B Report (`create_wandb_report_tool`) and a marimo notebook per generation; Self-improve = a W&B-Skills-equipped coding agent proposing the upgrade package (F7, F13). (F1, F8, F12, F13, F19)

2. **Make the loop refuse something on stage.** The single most judge-aligned moment is a BLACK FLAG: the Scrutineer catching a shortcut ("earns a perfect score without solving the task", F15) or a regression on the sealed circuit, and the upgrade being blocked ("Ship It or Block It", F15). Show it once per demo run, deterministically. (F9, F15, F21)

3. **Credit assignment = role-named Signals + per-role evals.** A custom Weave signal per role turns "observe" into "which role failed"; the tag is the attribution. Then the upgrade scene targets that role. This uses Weave's own vocabulary (tags/ratings on turns) rather than a home-grown attribution scheme. (F10, F9)

4. **Guard the three multi-agent failure modes by name in REGS:** cascading assumptions (roles consume each other's outputs only through telemetry, never through shared mutable state), runaway loops (cost cap per generation), token cost (show intelligence-per-dollar, F18's metric). (F16, F18)

5. **The grader must not be the improver's model.** Use a different model or the deterministic lap simulator as the OFFICIAL scorer; state this in REGS ("stewards use independent timing"). This pre-empts the "hall of mirrors" critique (F21) while still matching the event's archetype list (F1).

6. **Human-in-the-loop as Team Principal approving launches**, exactly as ARIA phrases it ("Researchers stay in control by approving launches", F14). One click "APPROVE UPGRADE" before Serverless RL/SFT or a harness commit is the ARIA-shaped moment for Julia Rose.

7. **Show the growth curve, not just the mechanism.** WeaveHacks 2's "Is the growth meaningful?" and prior winners' "14% → 83%" imply a visible lap-time-vs-generation chart with the ghost car as the "beats the version it replaces" proof (F4, F8, F23). Include lineage: which upgrades survived, which were stripped (LINEAGE AUDIT).

8. **Document = reproducible notebook + report, not a log.** marimo's pitch is reproducibility ("pure Python", F19); NVIDIA's loop ends in "documentation… for human review" (F24); ARIA "creates… reports that make its reasoning transparent" (F14). The Historian role should emit a marimo notebook that re-runs the generation's evaluation on molab and a W&B Report with the hypothesis, the evidence trace links, and the verdict.

9. **Positioning line for the pitch (in their words):** "A colony of agents keeping each other honest, that learns from its own scars: production signals become benchmarks, quality gates decide what gets promoted, and every upgrade has receipts." Every noun there is quoted from the organizers (F1, F8, F15).

## Stage checklist — what a Best Loop Design winner must visibly demonstrate

- [ ] A live Weave session with sessions/turns/steps and one span per F1 role (F9, F11)
- [ ] A Signal (built-in or custom, role-named) firing on a real failure in the trace (F10)
- [ ] An `Evaluation` run on a held-out set, compared against the previous version (F8, F9)
- [ ] A W&B run/Registry entry per generation with lineage ("receipts") (F8, F12)
- [ ] An auto-generated W&B Report and/or marimo notebook explaining hypothesis → evidence → verdict (F12, F14, F19, F24)
- [ ] A self-proposed upgrade package produced by a Skills/MCP-equipped agent (F7, F13)
- [ ] Human approval before promotion (F14)
- [ ] At least one blocked upgrade: regression or cheating caught, with the trace as proof (F15, F21)
- [ ] A growth curve across ≥3 generations plus a ghost-car comparison (F4, F8, F23)
- [ ] Cost cap and token cost visible; no runaway loop (F16, F18)
- [ ] Every sponsor doing a distinct job (Weave observe/evaluate, ARIA/Models track+hypothesise, marimo document, TypeSafe machine-native role or scorer) — "Did they meaningfully use one or more sponsor tools?" (F4)
- [ ] Runs unattended for the 13:30–15:30 judging window without a pitch (F2)

## Open gaps

- **Numeric judging rubric for CoreWeave Hacks**: not published on the event page; WeaveHacks 2's five criteria are the best proxy (F4). Ask organizers at kickoff (Sat 10:30).
- **WeaveHacks 3 and 4 winners**: the gallery shows "Finalists 4" without labels; no winner recap was found (WeaveHacks 4 write-up not located). UNVERIFIED.
- **Mo Tiwari**: no talk/post located; lens inferred from title only (F20).
- **Julia Rose**: no first-person talk located; her framing is taken from the ARIA product page and launch press (F14). LinkedIn blocked (HTTP 403).
- **Emmanuel Turlay's X thread**: page returned HTTP 402; quote relies on search snippet (F9).
- **Diogo Almeida "What's Next After RLHF?" talk**: YouTube page did not expose a description; not quoted.
- **TypeSafe System1 API surface**: not on typesafe.ai; see R6 for whatever the event provides.
- **Date discrepancy**: the CoreWeave blog "closes the loop" page renders Aug 25, 2026 while the press release it summarises is May 28, 2026; I cite both dates.
- **Web search budget** was exhausted during this thread (200/200); remaining items were fetched directly by URL.
