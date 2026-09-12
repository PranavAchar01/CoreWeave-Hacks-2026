# R8 — Originality check and borrowable game mechanics

Research thread for SCRUTINEER / CoreWeave Hacks "The Loop" (Sept 13–14 2026). All claims below were fetched from the live web on 2026-09-03; each carries a URL and the source's own date. Items marked UNVERIFIED could not be confirmed by fetching the primary page (usually a 403) and rely on search-result snippets.

---

## 1. Summary

**Originality verdict: the specific combination — an F1 *team of technical roles*, each role a sub-agent with its own upgradeable skill file / harness / weights, driven by a self-improving loop with evidence-based credit assignment and a visible upgrade scene — does not exist in any project we could find.** What exists nearby:

| Neighbour | What it has | What it lacks (our gap) |
|---|---|---|
| **PitWall-AI** (GitHub, MIT) | Five named F1 agents: Scout, Spy, Strategist, **Ghost Car Evaluator**, **Principal**; LangGraph + PyTorch + DEAP; Grafana dashboard | No self-improvement loop at runtime, no Weave, no role upgrades, no game. Note: it already uses the words "Ghost Car" and "Principal". |
| **F1 StratLab** (2026 BSc thesis, Apache-2.0) | Six LangGraph sub-agents (Pace, Tire, Race Situation, Pit Strategy, Radio, RAG) + orchestrator; "PITWALL AGENTS" view with reasoning traces and confidence | Retraining is a roadmap item ("pitlab"); no loop, no upgrades, no scrutineer |
| **RaceWall-AI**, **FormulaGPT**, **ai-race-engineering** | Strategy copilots / LLM team managers racing each other | Deterministic or per-race only; "No persistent learning occurs" |
| **Airia × Atlassian Williams hackathon** (Feb 24–Mar 1 2026) | F1-branded agent hackathon; an entry literally named "Pit Wall AI"; winner "Race Radio Control" with four fan-facing personas | Fan experience only; "No dedicated pit-wall or engineering-specific agents" |
| **CoreWeave × Aston Martin F1** (blog, Aug 25 2026) | Production F1 radio-intelligence agents on CoreWeave; Weave used for evaluation; "75 model iterations" | Industry product, not a loop game — but it proves the judges' own company thinks in F1 |
| **WeaveHacks 3 gallery** (Jan 31–Feb 1 2026, 61 projects) | Closest cousins: KayOne (meta-agent profiler), OpenClaw Trace (mines traces for evidence-backed fixes), soft beds ("REM sleep" review of failure patterns), Darwin, mothBot (skills saved as marimo tool chains) | Zero F1/motorsport projects; only three game-themed (Mafia Ace, Stake Chess, Catan Bias); none upgrades a *role* |
| **WeaveHacks 2** (Oct 12 2025, 67 projects, 11 winners) | ERA (agents that build agents), Popstar (RL reward design for games) | No sports-team, no role-upgrade projects |

**What to avoid duplicating:** the product name "Pitwall"/"Pit Wall AI"/"RaceWall" (three collisions), and presenting a plain "Ghost Car" delta as novel (PitWall-AI has a Ghost Car Evaluator). "SCRUTINEER", "PARC FERMÉ", "LINEAGE AUDIT", "BLACK FLAG" and "COST CAP" as loop concepts turned up nowhere in the agent space (negative result — UNVERIFIED in the sense that absence of evidence is all we have).

**What is genuinely new and defensible:** (a) role-level credit assignment → role-level upgrade; (b) the three-way *correlation loop* (sandbox ↔ practice ↔ sealed race) borrowed from real F1 aero validation; (c) the FIA sliding-scale ATR as an anti-overfitting budget; (d) a Scrutineer with a tampering taxonomy; (e) a real upgrade artifact per role (an Agent Skills `SKILL.md` directory + optional LoRA) — the 2026 skills literature (Graph-of-Skills, SkillsVote, SkillOps, SIA) gives us citable machinery for exactly this.

Twelve mechanics worth borrowing, each mapped to a loop concept, are in §3.

---

## 2. Findings with citations

### 2.1 Existing F1 / motorsport agent projects (originality check)

**F1. PitWall-AI has an F1 five-agent cast including a "Ghost Car Evaluator" and a "Principal", but no self-improving loop.**
Agents: Scout ("Async ingestion of laps, stints, positions, and race-control messages from OpenF1"), Spy ("Predicts when rivals ahead / behind will pit, using a logistic hazard model fitted per compound"), Strategist (genetic algorithm evolving pit/compound plans under FIA rules), Ghost Car Evaluator ("Compares AI strategy to actual using pure strategic-delta accounting"), Principal ("LLM agent that turns state + strategy + ghost delta into a conversational team-radio briefing"). Stack: PyTorch, DEAP, LangGraph, Groq LLaMA 3.3 70B, InfluxDB 3, 32-panel Grafana dashboard. Retraining only via `--train` flags; "no documented runtime auto-improvement mechanism"; "No mention of Weave". MIT, 7 commits.
Source: https://github.com/rohan-chandrashekar/Pitwall-AI (fetched 2026-09-03; repo undated).
Relevance: nearest F1-role neighbour; shares "Ghost Car" and "Principal" vocabulary; we must go beyond it with the loop.

**F2. F1 StratLab is a six-sub-agent + orchestrator F1 strategy system with an agents-reasoning view, but self-improvement is only on the roadmap.**
"seven ML models, six LangGraph sub-agents, and one orchestrator"; orchestrator does "MoE-style dynamic routing, a Monte Carlo that scores each candidate in projected track position, and LLM synthesis with Pydantic v2 structured output". UI has "PITWALL AGENTS: Agent decisions with reasoning traces, confidence scores, and Monte Carlo simulation results". Planned "pitlab (v0.1.0) ... button-driven retraining: download, merge, inspect, retrain". Bachelor's thesis, V. Vega, 2026, v2.5.1, Apache-2.0.
Source: https://f1stratlab.com/ (fetched 2026-09-03; project dated 2026).
Relevance: proves the "pit wall as team of specialist agents" framing is already out there; our differentiator must be the *loop that upgrades the specialists*, not the specialists themselves.

**F3. Smaller F1 copilots (RaceWall-AI, FormulaGPT) have role-named agents but no learning.**
RaceWall-AI: Observer / Forecast / Strategy / Explainer agents, LangGraph + Groq; "The README provides no indication that agents learn or upgrade dynamically." FormulaGPT: LLM-controlled rival teams (GPT, Claude, DeepSeek); "No persistent learning occurs."
Sources: https://github.com/SrajitRastogi/RaceWall-AI-Agentic-F1-Strategy-Simulator/blob/main/README.md ; https://github.com/dawid-maj/FormulaGPT/ (both fetched 2026-09-03; undated repos).
Relevance: the field's default is "F1 agents that *act*"; nobody ships "F1 agents that *get upgraded*".

**F4. Airia's Williams-partnered F1 agent hackathon (Feb 24–Mar 1 2026) was fan-experience only; an entry was literally named "Pit Wall AI".**
Williams: "participants given a week to design autonomous AI agents that elevate the fan experience"; awards at the Melbourne Fan Zone on March 4 2026. Winner (Team JoPoCo, "Race Radio Control"): four personas (Sainz, Albon, Vowles, a trivia host) plus a router agent; "No dedicated pit-wall or engineering-specific agents mentioned." A separate entry, "Pit Wall AI", is a Williams chat companion that "figures out how much you know about F1 and adjusts every answer" (from search snippet — UNVERIFIED beyond title).
Sources: https://www.williamsf1.com/articles/9d57b255-fd2a-445d-99b7-eeea94bd4a67/race-beyond-the-track-airia-virtual-ai-agent-hackathon (Feb 2026); https://sjramblings.io/race-radio-control-airia-hackathon/ (Mar 4 2026); https://www.youtube.com/watch?v=I8A1BzvLJbs (UNVERIFIED).
Relevance: naming collision on "Pit Wall AI"; F1 + agents has been done as *fan* product, not as *engineering loop*.

**F5. CoreWeave itself runs a production F1 agent system with Aston Martin and used Weave to evaluate it (Aug 25 2026).**
"Every transmission is transcribed, categorized by topic—tires, strategy, grip, energy management—and surfaced in a searchable interface that updates as the race runs." Stack: W&B Serverless Inference, CoreWeave Kubernetes Service, TensorRT-LLM, W&B experiment tracking + dataset versioning; "Weights & Biases Weave" for evaluation; "75 model iterations before the transcription model reached production accuracy"; >3,000 labeled samples.
Source: https://www.coreweave.com/blog/how-ai-agents-on-coreweave-help-process-f1-radio-in-near-real-time (published Aug 25 2026).
Relevance: the sponsor already speaks F1; a "75 iterations to production" story is exactly a loop story — we can reference it in the pitch, and a RADIO role (team-radio transcription/intel) is a legitimate technical role to include.

**F6. Academic F1 multi-agent work in 2026 is self-play RL for race strategy, not agent-team improvement.**
"a reinforcement learning approach for multi-agent race strategy optimization"; builds on "a pre-trained single-agent policy" plus "an interaction module that accounts for the behavior of competitors"; agents trained via self-play; "can support race strategists' decisions before and during races".
Source: https://arxiv.org/abs/2602.23056 (submitted Feb 26 2026, revised Jul 2 2026).
Relevance: citable precedent for "STRATEGIST role trained with RL" (Serverless RL slot) — and a reminder that self-play among lineages (our GHOST CAR) has literature behind it.

### 2.2 Hackathon galleries (WeaveHacks 2/3/4)

**F7. WeaveHacks 3 (Jan 31–Feb 1 2026, W&B SF, 200+ builders): 61 gallery projects, zero motorsport, three game-themed, two using marimo.**
Game-themed: Mafia Ace (self-improving Mafia player), Stake Chess, Catan Bias (uses marimo). marimo also in mothBot ("Self-evolving spaceship maintenance agent building reusable tool chains"). Closest loop cousins: KayOne ("Meta-agent profiler monitoring and optimizing other AI agents"), OpenClaw Trace ("Self-improvement pipeline mining session traces for evidence-backed fixes"), soft beds ("Agent system giving 'REM sleep' to review and fix failure patterns"), Darwin ("Autonomous feedback-to-fix pipeline learning from code reviews"), ExtraRecursiveReflection, Modaic/Microcode. All 61 list Weave.
Sources: https://cerebralvalley.ai/e/weave-hacks-3-self-improving-agents-hackathon-with-weights-and-biases-7014fe80/hackathon/gallery (fetched 2026-09-03); https://luma.com/weavehacks3 ; https://x.com/wandb/status/2019207262221529596.
Relevance: the "mine traces → propose fix" loop is table stakes at these events (KayOne, OpenClaw Trace, soft beds). Our edge must be *role attribution + visible upgrade + audit*, not "we read traces".

**F8. WeaveHacks 2 (Oct 12 2025, with Google Cloud): 67 projects, 11 winners; no sports-team or role-upgrade entries.**
Winners included ERA ("Self-improving AI that builds, tests, and refines other AI agents"), Popstar ("Automates reinforcement learning reward design for video game environments"), SynErgi (multi-agent planning + GRPO), Daydreamer, ReviveAgent, the convergence, Silicon Valhalla, ContentEngine, AVAX, CO-DREAMER, Product Mate. Prizes included "$5,000 in RL or CoreWeave compute credits" for the RL track.
Sources: https://weavehacks2.devpost.com/project-gallery (fetched 2026-09-03); https://luma.com/weavehacks2.
Relevance: the RL track is a recurring judge interest; "agents that build agents" (ERA) already won — our loop should make the *improver* itself a role that can be upgraded and audited.

**F9. WeaveHacks 4 (Jun 6–7 2026) shifted the theme to multi-agent orchestration; gallery not located.**
"orchestrating pipelines and wrangling swarms"; sponsors W&B, OpenAI, Cursor, Redis, CopilotKit; Grand Prize Unitree G2 Pro + $2,000; "Best Use of Weave: $1,000"; 20+ judges incl. previous winners. No ARIA/marimo/Serverless RL mentions on the page.
Source: https://luma.com/weavehacks (fetched 2026-09-03).
Relevance: the organizers' arc is self-improving (WH2, WH3) → multi-agent orchestration (WH4) → "The Loop" (CoreWeave Hacks). A team-of-roles loop sits exactly on that trajectory. GAP: WH4 project gallery not found (see §4).

### 2.3 How W&B / the literature frames "upgrade a role"

**F10. W&B's own Weave copy already promises harness-level improvement loops driven by coding agents.**
"W&B Weave helps production agents learn and improve from real-world experience"; "Coding agents like Claude Code can connect to Weave and iterate on your agent continuously for exponentially compounding improvement"; "Measure every improvement to your harnesses and models with confidence with a flexible imperative evaluation API"; "Using W&B skills and the MCP server, coding agents like Claude Code connect to Weave. They can read live production data, run evaluations, and execute automatic iteration loops on their own".
Source: https://wandb.ai/site/weave/ (fetched 2026-09-03).
Relevance: the sponsor's language is "harnesses and models" — so a role = (harness, model) pair is on-message; the W&B MCP server + Skills is the obvious channel for the RACE ENGINEER role.

**F11. Lilian Weng's "Harness Engineering for Self-Improvement" (Jul 4 2026) gives a citable ladder of upgrade surfaces and the defenses we need.**
Harness = "the system surrounding a base model that orchestrates execution and decides how the model thinks and plans, calls tools and acts, perceives and manages context, stores artifacts, and evaluates results." Ladder: "instruction prompts → structured context → workflow → harness code → optimizer code." Defenses: "Held-in and held-out data splits", "Editable surfaces" kept explicit, "Component observability" mapping failures to specific harness parts, "Read-only" verification. Risks: reward hacking, self-confirmation ("declare success despite noisy or failed experiments"), tampering ("break abstraction boundaries"). "Humans should move up the stack, not be removed from the loop."
Source: https://lilianweng.github.io/posts/2026-07-04-harness/ (Jul 4 2026).
Relevance: "component observability mapping failures to specific harness parts" *is* role-level credit assignment; the upgrade ladder is a ready-made tier list for upgrade rarity (prompt patch < context < workflow < harness code < optimizer).

**F12. SIA (May 2026) shows a Feedback-Agent that updates both harness and weights, and names which lever does what.**
Meta-agent modifies "tools, prompts, retry logic, and search procedure" (harness) and also does weight updates "on task feedback". Combined SIA-W+H: +25.1% on Chinese legal classification, 12.4% faster GPU kernels, +20.4% RNA denoising vs prior best. "harness updates make the model agentic, shaping how it searches and acts, while weight updates build the domain intuition that no prompt or scaffold can instil."
Source: https://arxiv.org/abs/2605.27276 (submitted May 26 2026).
Relevance: justifies two upgrade classes per role — HARNESS UPGRADE (skill file / tools / search) vs POWER UNIT UPGRADE (Serverless SFT/RL weights) — with a citable reason to pick one over the other.

**F13. The Agent Skills spec makes a role's "upgradeable part" a concrete file tree.**
A skill is a directory with `SKILL.md` (YAML frontmatter `name` ≤64 chars lowercase-hyphen, `description` ≤1024 chars, optional `license`, `compatibility`, `metadata`, experimental `allowed-tools`) plus optional `scripts/`, `references/`, `assets/`. Progressive disclosure: "Metadata (~100 tokens)... Instructions (< 5000 tokens recommended)... Resources (as needed)"; "Keep your main SKILL.md under 500 lines." Validate with `skills-ref validate ./my-skill`.
Source: https://agentskills.io/specification (fetched 2026-09-03).
Relevance: each F1 role = one skill directory; an "upgrade" is a diff to SKILL.md / scripts / references; the Scrutineer can run `skills-ref validate` as its first check; `metadata.version` is the part number shown in the upgrade scene.

**F14. Graph-of-Skills (Apr 2026) is literally a dependency graph over skills — a tech tree — with retrieval that respects prerequisites.**
Problems: "loading the full skill set saturates the context window" and "semantic retrieval surfaces topically relevant skills but misses their prerequisite chain of upstream and downstream skills." Method: offline skill dependency graph + hybrid seeding + "Reverse-aware Personalized PageRank" + "Context-budgeted hydration". Result: "peak reward increase of 25.55% while reducing total tokens by 56.72%" on SkillsBench/ALFWorld with libraries of 200–2,000 skills.
Source: https://arxiv.org/abs/2604.05333 (submitted Apr 2026).
Relevance: gives the skill tree a real algorithmic meaning: a role's LOADOUT is the context-budgeted bundle pulled from its skill DAG.

**F15. SkillsVote (May–Jun 2026) has an explicit "Attribution" stage and "evidence-gated updates" — the literature's version of our Scrutineer + credit assignment.**
Lifecycle: Collection → Recommendation → **Attribution** ("Decomposes execution traces into skill-linked subtasks and attributes outcomes to specific skill guidance, agent exploration, environment factors, and result signals") → Evolution ("evidence-gated updates that admit only successful discoveries to prevent skill repository degradation"). Validated on Terminal-Bench 2.0 and SWE-Bench Pro; warns "indiscriminate updates can pollute future context".
Source: https://arxiv.org/abs/2605.18401 (submitted May 2026, revised Jun 2026).
Relevance: cite this for the credit-assignment step: outcome → which role's skill guidance vs. exploration vs. environment. "Pollute future context" = our LINEAGE AUDIT rationale.

**F16. SkillOps (May 13 2026) names "skill technical debt" and diagnoses library health on four axes.**
"skill technical debt: library-level defects that may not break a single skill locally but can harm future retrieval, composition, and execution"; typed "Skill Contracts"; "Hierarchical Skill Ecosystem Graph"; health diagnosed across "utility, compatibility, risk, and validation"; 79.5% ALFWorld success as plug-in; "nearly zero library-time" LLM calls.
Source: https://arxiv.org/abs/2605.13716 (submitted May 13 2026).
Relevance: four health axes → four gauges on each role's garage card (UTILITY / COMPATIBILITY / RISK / VALIDATION); "risk" is the Scrutineer's axis.

**F17. Bilevel skill optimization via MCTS (Apr 17 2026): outer loop chooses skill *structure*, inner loop refines *content*.**
"Outer Loop: Monte Carlo Tree Search determines the skill structure—how instructions, tools, and supporting resources are organized together. Inner Loop: Refines the actual content within the structure." Demonstrated on an OR-QA dataset.
Source: https://arxiv.org/abs/2604.15709 (submitted Apr 17 2026).
Relevance: maps onto F1 Manager's "Research (structure, next season)" vs "Design (content, this season)" split — see F19.

**F18. A June 2026 survey enumerates four skill-evolution paradigms.**
"Execution feedback mechanisms, Trajectory distillation techniques, Compression methods, Reinforcement learning approaches"; six skill-centric benchmark categories; calls for "automated, evaluation-driven skill evolution".
Source: https://arxiv.org/abs/2606.11435 (June 2026).
Relevance: four upgrade *kinds* per role: FEEDBACK PATCH, DISTILLED PLAYBOOK, COMPRESSION (shorter SKILL.md), RL — each can be a distinct part in the garage.

**F19. BerriAI's `self-improving-agent` is the minimal "propose diff → human approves → draft PR" loop (27 stars).**
Tools `writeImprovementProposal` (agent drafts a minimal diff) and `applyProposal` (opens a draft PR after explicit human approval, schema-gated by `userConfirmedInThisMessage: true`). Targets "system prompts, tool routing logic, and workflow steps".
Source: https://github.com/BerriAI/self-improving-agent (fetched 2026-09-03; undated).
Relevance: the TEAM PRINCIPAL (human) sign-off pattern already exists as a two-tool API; our version adds the Scrutineer between proposal and apply.

### 2.4 Motorsport-manager game mechanics (the borrowing pool)

**F20. F1 Manager 2024's part stats are 80% accumulated expertise, with staff and facilities as small multipliers; design vs research are separate loops.**
"The values that you have for every stat on every part of your car are 80% derived from your expertise rating, staff and facilities make up the remaining 20%." Staff: "Technical Chief and Head of Aero ratings × 5% (maximum 10% combined)"; facilities up to 5% per stat. Expertise is tracked *per stat per part* and grows daily with diminishing returns. "Design: This is the method by which you improve your car for the current season... Research: This is the method by which you improve your car for the next season. Your primary usage of this should be to offset regulation impacts." Sliders: "sliders ONLY relate to the part you are designing, these + and - values do not translate to future part designs." ATR spend on expertise: "Every unit you spend is like doing 1 extra day of normal work on a part." Intensity: "Intense" = "1.5x the rate for 3x the cost." Costs: Front Wing 44 days / $1.8M design, 3 days / $225K production; Chassis 33 days / $1M design. Rear Wing DRS Delta "is roughly 2.3 times more value" than Chassis. Year-end "regulation expertise" loss = regulation impact % × current expertise.
Source: https://steamcommunity.com/sharedfiles/filedetails/?id=3295235386 (Steam guide "Design and Research Mechanics", fetched 2026-09-03; game released Jul 2024).
Relevance: the single richest template for "upgrade a role": per-role-per-stat expertise, tiny multipliers from shared facilities, and a seasonal *regulation change* that erodes expertise (= held-out set rotation).

**F21. F1 Manager 2024 shows an upgrade's projected impact before you commit ("Rank on Grid"), and rates staff on role-specific attributes.**
Official guide (search snippet; page returned 403 on fetch — UNVERIFIED verbatim): "Using car analysis to compare against any other car on the grid and switching to the Rank on Grid view when setting up a design project will enable you to more easily identify where best to invest your money and time"; "When changing your attributes you can directly see the impact they have on performance stats." Guide: "The bars on the right of the screen indicate which parts of your car are competitive and which aren't"; the design screen shows "the exact effect that will be had on your performance, along with the weight changes and expected lifespan for the part". Technical Chiefs have six stats (Chassis, Front Wing, Rear Wing, Sidepods, Underfloor, Suspension); "Technical Chiefs give you bonuses on top of the parts you design"; overall ratings 70–92. Head of Aero affects Cooling, Airflow Management, Airflow Sensitivity; Race Engineer stats are communication, feedback, composure.
Sources: https://www.f1manager.com/en-US/2024/news/car-development-research-guide (UNVERIFIED, 403); https://simracingsetup.com/f1-manager/f1-manager-2024-car-development/ (updated Jul 23 2024); https://racinggames.gg/article/f1-manager-2024-best-technical-chiefs (Jul 23 2024); https://gamefaqs.gamespot.com/ps5/454145-f1-manager-2024/faqs/81355/technical-chief (UNVERIFIED, 403).
Relevance: (a) "projected impact before commit" = show the RACE ENGINEER's predicted delta and Weave eval delta side by side; (b) staff attributes are *per part they influence* — the credit-assignment table already exists as a game UI.

**F22. Real FIA Aerodynamic Testing Restrictions: 320 wind-tunnel runs + 2,000 CFD items per two-month period, scaled 70% (leader) to 115% (last).**
"320 wind tunnel runs and 2,000 CFD tests over a two-month period"; "the ATR cutting the championship leading team's testing time by 25%, while the team at the bottom of the standings gets a 15% increase"; 115% = "368 wind tunnel runs and 2,300 CFD items". Reset twice a year from standings: a two-place drop gave Haas "32 more windtunnel runs and 200 more CFD items"; gaining a place costs "16 fewer windtunnel runs and 100 fewer CFD items".
Sources: https://www.motorsport.com/f1/news/winners-losers-f1-aerodynamic-testing-reset/10742457/ (Jul 15 2025); https://www.the-race.com/formula-1/the-aero-restrictions-each-f1-team-will-face-in-2026/ (Dec 19 2025).
Relevance: a *real* handicap budget: the leading lineage gets fewer eval runs / sandbox minutes per generation — anti-overfitting and drama in one rule.

**F23. Real F1 validates an upgrade by closing a three-way correlation loop: wind tunnel ↔ CFD ↔ track.**
"Pressure data is usually gathered at the same positions across the car as on the windtunnel model to allow for a direct comparison across the two environments"; "CFD data is also extracted using the same tapping coordinates to close the correlation loop between all three data sets." Aero rakes and flow-vis paint reveal "regions of laminar and turbulent flow, and (more worryingly) where any flow separation has occurred."
Source: https://www.raceteq.com/articles/2025/02/formula-1-trackside-aerodynamic-analysis-explained (Feb 26 2025).
Relevance: the strongest borrowable *loop-integrity* mechanic: an upgrade counts only if the same metric moves in the same direction in sandbox eval (CFD), practice (wind tunnel) and sealed race (track). Flow-vis = a Weave trace diff painted on the car.

**F24. Motorsport Manager: staff have role-specific stats, perks unlocked by relationship, tiered/risky components, and a Staff Centre that buffs everyone by +1.**
Mechanic stats: Concentration ("less mistake chance on pit stop"), Part Fixes, Pit Stops, Reliability ("Daily bonus to reliability work"), Chemistry ("Time to unlock mechanic perks with driver"), Performance. Designers: "If you designer have engine stat 15 once per season he/she adds 15 to engine performance." Perks e.g. "Nurse: Car condition drops slightly slower", "Risk Level -3" (Legendary designer perk). Component tiers Good / Great / Epic / Legendary; "risky parts" with a risk level. "Each level of staff centre give +1 to all pit crew stats."
Sources: https://gameplay.tips/guides/3580-motorsport-manager.html ; https://steamcommunity.com/sharedfiles/filedetails/?id=1589265002 (both fetched 2026-09-03; game 2016, guides c. 2019).
Relevance: component *tier + risk level* maps directly onto the Scrutineer's tampering classes; "Chemistry" (time to unlock perks between two roles) is a cute model for cross-role tool sharing.

**F25. Grand Prix Story: parts upgrade five times at escalating cost, and the *installing team's* quality changes the part's final stats.**
"Each part can be upgraded 5 times, with each upgrade costing more Research Points each time." "Higher ranked parts can be difficult to put on quickly and correctly for a team with low combined tech"; "A very high tech can make quick work and even make parts perform better than normal." Mechanics level up with Research Data to max Level 5.
Sources: https://kairosoft.wiki.gg/wiki/Parts_(Grand_Prix_Story) ; https://kairosoft.wiki.gg/wiki/Staff_(Grand_Prix_Story) (fetched 2026-09-03; game 2011).
Relevance: the PIT CREW (deploy/CI role) should determine whether an accepted upgrade lands at full value — separates "the patch is good" from "the patch was applied correctly", which is a real failure mode in harness edits.

### 2.5 Skill/tech-tree and upgrade-scene design

**F26. Tech-tree design: three structures, and readability collapses past ~80–120 nodes.**
Structures: fixed branching (Civilization), dual trees (Civ VI tech + civics), randomized cards (Stellaris: "random selection of three research options at a time, weighted by their existing technologies"). Trees work because they make "dependencies, trade-offs, and opportunity costs visible". Civ VI "Eureka" rewards actions that align with research. Readability: "the most expressive layout for forty techs becomes unreadable at eighty and unusable at one twenty."
Source: https://metavert.io/tech-trees-in-games (fetched 2026-09-03; undated, cites 2016 games).
Relevance: keep each role's tree ≤ ~12 nodes; offer upgrades as *three drawn cards* (Stellaris) weighted by evidence; "Eureka" = evidence discount when traces show the role already did the thing.

**F27. Skill-tree choice design (XCOM analysis): never pit a must-have against a nice-to-have; don't make synergies mutually exclusive; show the full tree upfront.**
"Avoid giving the player a choice between a must-have skill and a nice-to-have skill"; "If two skills have interesting synergy, do not make them mutually exclusive"; "Some skills are class-defining—you have to pick them, or other skills dependent on them won't work." XCOM 2 WotC: soldiers get promotions per kills and spend Ability Points in the Training Center.
Sources: http://t-a-w.blogspot.com/2013/12/xcom-optimal-character-build-or-how-to.html (Dec 7 2013 — old); https://xcom.fandom.com/wiki/Ability_Points (fetched 2026-09-03).
Relevance: the RACE ENGINEER should present *two comparable* candidate patches per weakness (A/B), never "fix vs cosmetic"; evidence points ("Ability Points") accrue to the role that caused the incident.

**F28. "Juice it or lose it" (GDC 2012): an upgrade must be *felt* — flash, shake, floating text, particles, sound.**
"Juice" is "the layer of feedback and exaggeration that makes an action feel satisfying rather than merely correct"; techniques: tweening, squash/stretch, screen shake, particles, floating text, sound.
Sources: https://www.gamedeveloper.com/design/squeezing-more-juice-out-of-your-game-design- ; https://eastondev.com/blog/en/posts/dev/20260521-game-feedback-feel/ (May 21 2026).
Relevance: the upgrade scene is a *juice* problem: part number tick-up, stat bar tween, ghost-car gap opening, radio sting.

**F29. Voyager (2023) is the citable origin of "an ever-growing skill library" that "unlocks the tech tree".**
"an ever-growing skill library of executable code for storing and retrieving complex behaviors"; skills are "temporally extended, interpretable, and compositional"; the library "acts as a plug-and-play asset to enhance performance."
Source: https://arxiv.org/abs/2305.16291 (May 2023 — older).
Relevance: one line in REGS: "skill library per role (Voyager 2023) with dependency retrieval (Graph-of-Skills 2026)".

**F30. Agent reputation systems for agents exist (Moltbook karma, Jan 2026) and are "easily gamed".**
Moltbook: Reddit-style network for agents, ">2.8 million registered agents in three weeks", karma via up/downvotes; "High-karma agents theoretically have more credibility, though the system is easily gamed."
Source: https://aimultiple.com/moltbook (fetched 2026-09-03; Moltbook launched late Jan 2026); https://arxiv.org/html/2602.18832v1 (Feb 2026).
Relevance: cautionary — championship POINTS must come from the sealed circuit only, never from self-reported or peer-voted signals.

**F31. Sports-team staff games (Football Manager) rate each staff role on the attributes that matter for *that* role and show a star rating per training category that declines when a coach is spread thin.**
"Attacking affects Attacking Training, Defending affects Defensive Training, and Mental affects Possession Training"; "General Coaches can lead one or more training areas, though being part of several training areas will decline the star rating." (Search snippets; both guide pages returned 403 — UNVERIFIED verbatim.)
Sources: https://www.passion4fm.com/football-manager-staff-attributes/ ; https://www.neoseeker.com/football-manager-2022/guides/Staff_Roles_and_Attributes (UNVERIFIED).
Relevance: a role that owns too many skills loses stars — a natural penalty against one mega-role, nudging the loop toward genuine specialization.

**F32. Emergent role specialization among LLM agents is documented (Project Sid; Emergence World, Jun 2026) but as sociology, not as a designed upgrade loop.**
Emergence World: "120+ specialized tools and three persistent memory systems", 15-day study across five model populations "ranging from stable deliberative governance to total population collapse."
Source: https://arxiv.org/abs/2606.08367 (Jun 2026).
Relevance: nobody has framed specialization as a *designed, audited* upgrade path; also a cautionary "collapse" data point for the loop-defense section.

---

## 3. Design implications for the F1 loop — 12 mechanics to borrow

Each row: the mechanic, where it comes from, and its one-line mapping to an agent-loop concept. Roles assumed: RACE ENGINEER (improver), STRATEGIST, AERODYNAMICIST, POWER UNIT, TYRE/PERFORMANCE, DATA/TELEMETRY, RADIO, PIT CREW, SCRUTINEER, HISTORIAN, TEAM PRINCIPAL (human).

| # | Mechanic (source) | Agent-loop mapping |
|---|---|---|
| 1 | **Per-stat-per-part expertise, 80/20 with staff & facilities** (F1M24, F20) | Each role's stat = 80% accumulated evidence from Weave traces on that skill + 20% shared "facility" multipliers (base model, sandbox image, scorer set); upgrading a role edits *its* SKILL.md, not the shared floor. |
| 2 | **Design (this season) vs Research (next season / regulation change)** (F1M24 F20; bilevel MCTS F17) | DESIGN = harness/skill-content patch that ships this generation; RESEARCH = Serverless SFT/RL weight update or skill-structure change that only lands at the next "regulation change" (held-out set rotation). |
| 3 | **Design-focus sliders with explicit trade-offs and "Rank on Grid" projected impact** (F1M24 F21) | Every upgrade package declares what it trades (tokens/latency/reliability vs. score) and shows the RACE ENGINEER's *predicted* delta next to the Weave eval's *measured* delta before PARC FERMÉ. |
| 4 | **FIA ATR sliding scale: leader gets 70%, last gets 115% of 320 runs / 2,000 CFD items** (F22) | COST CAP is dynamic: the leading lineage gets fewer sandbox runs / ARIA queries / eval items per generation; laggards get more — anti-overfitting and catch-up in one rule. |
| 5 | **Three-way correlation loop: CFD ↔ wind tunnel ↔ track, same pressure taps** (F23) | An upgrade is PROMOTED only if the same metric moves the same direction in sandbox eval (CFD), practice/qualifying (wind tunnel) and sealed race (track); disagreement = "correlation problem", flagged by DATA/TELEMETRY. |
| 6 | **Staff attributes are per-part they influence (Technical Chief ×5% on six parts)** (F1M24 F21; FM F31) | Credit assignment table: each role owns a set of parts/metrics; a failing metric routes to the owning role; a role spread over too many parts loses stars (specialization pressure). |
| 7 | **Component tiers Good/Great/Epic/Legendary with a Risk Level; "Risk Level −3" perk** (Motorsport Manager F24) | Upgrade rarity = Weng's ladder (prompt < context < workflow < harness code < optimizer, F11); Risk Level = SCRUTINEER tampering class; only sub-threshold risk passes; a LINEAGE AUDIT strips points if a risky part is found later. |
| 8 | **Installing-team quality changes a part's final stats** (Grand Prix Story F25) | PIT CREW (deploy/CI role) applies the accepted diff in a Serverless Sandbox and re-runs `skills-ref validate` + smoke tests; a botched install lands at partial value and is itself an upgradeable weakness. |
| 9 | **Skill tree with prerequisites and budgeted retrieval** (Graph-of-Skills F14; Voyager F29) | Each role has a ≤12-node skill DAG; its LOADOUT per race is the context-budgeted bundle pulled by dependency; unlocking a node requires its prerequisites to be validated in traces. |
| 10 | **Promotion = choose one of two comparable abilities; Ability Points accrue to the unit that earned them** (XCOM F27) | Each attributed weakness grants the *owning role* evidence points; the RACE ENGINEER must offer two comparable candidate patches (A/B), evaluated back-to-back in FP1 (practice), never a fix-vs-cosmetic choice. |
| 11 | **Regulation change erodes expertise; research offsets it; Eureka discounts research you've already demonstrated** (F1M24 F20; Civ VI F26) | Rotating the sealed circuit each "season" wipes a % of every role's expertise unless RESEARCH (weights) was invested; an upgrade is cheaper when traces already show the role doing the thing correctly (evidence discount). |
| 12 | **Staff Centre +1 to all pit crew; facilities give ≤5% per stat** (Motorsport Manager F24; F1M24 F20) | Shared FACILITIES (Weave scorers, sandbox images, MCP tools) are small global multipliers upgraded by the HISTORIAN/DATA roles — visibly distinct from role upgrades so the game never confuses "better tooling" with "better role". |

Two more, optional:

| 13 | **Three random research cards weighted by what you already have** (Stellaris, F26) | ARIA proposes exactly three candidate weaknesses/upgrades per generation, weighted by trace evidence — bounded search, readable UI. |
| 14 | **Juice** (F28) | The upgrade scene: part-number tick (`metadata.version`), stat-bar tween, ghost-car gap opening on track, radio sting; the *artifact diff* scrolls in the REGS panel for judges. |

**Vocabulary hygiene from the originality check**
- Do not name the product or any panel "Pit Wall" / "Pitwall" (three collisions, F1, F3, F4). "PIT WALL" as an in-fiction location is fine.
- GHOST CAR exists in PitWall-AI as an evaluator; keep the visual but credit the loop step as "GHOST CAR (previous generation lineage, self-play per arXiv 2602.23056)" rather than claiming novelty.
- "SCRUTINEER", "PARC FERMÉ", "LINEAGE AUDIT", "BLACK FLAG", "COST CAP as ATR" are unclaimed in agent-space (negative search result).
- Judges have seen "mine traces → propose fix" many times (F7: KayOne, OpenClaw Trace, soft beds). Lead with *attribution → role upgrade → correlation → audit*, not with "we read Weave traces".

---

## 4. Open gaps

1. **WeaveHacks 4 gallery not located.** Luma page has no project list; a cerebralvalley gallery URL for WH4 did not surface in search. Someone should check https://cerebralvalley.ai/ events list and W&B's X account for June 2026 winners to confirm no multi-agent "team of roles with upgrades" project won there.
2. **WeaveHacks 3 winners not confirmed.** The gallery lists 61 projects but no winner labels; W&B's tweet promised a winners announcement. If a trace-mining meta-agent (KayOne / OpenClaw Trace) won, we should explicitly position against it.
3. **Official F1 Manager 2024 guide pages returned 403** (f1manager.com, GameFAQs). The "Rank on Grid" and staff-attribute quotes are from search snippets and third-party guides; verbatim wording is UNVERIFIED.
4. **Football Manager staff-attribute pages returned 403**; mechanic #6's "star rating declines when spread thin" rests on a search snippet.
5. **CoreWeave Hacks "The Loop" official page** (judging rubric, "Best Loop Design" criteria) was not fetched in this thread — covered by R6, but the originality argument should be checked against the rubric's own wording.
6. **No direct evidence on how F1 Manager 2024 animates an upgrade** (only that bars, weight and lifespan are shown). If a video reference is wanted for the upgrade scene, that needs a video-watch pass.
7. **"Pit Wall AI" (Airia entry) details are from a YouTube title only** — UNVERIFIED beyond the name collision.
8. **The harness-tampering taxonomy preprint (Aug 30 2026)** referenced in CONTEXT.md was not re-fetched here; the Risk Level mapping (#7) assumes its classes are usable as an ordinal scale.
