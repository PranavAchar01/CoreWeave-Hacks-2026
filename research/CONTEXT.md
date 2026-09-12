# Research brief: the loop behind SCRUTINEER (read fully before researching)

## Where we are
Event: CoreWeave Hacks "The Loop" (Sept 13–14 2026, SF). Prize we want: Best Loop Design. Sponsors that MUST all be used substantively: W&B Weave (agent observability + evals), CoreWeave ARIA (AI research agent inside W&B), W&B Models / Serverless RL + Serverless SFT / Serverless Sandboxes / W&B MCP server + Skills, marimo (molab notebooks on CoreWeave GPUs, marimo pair), TypeSafe AI (System1, a machine-native model lab; stealth). The event's own words for what a loop must do: "observe, evaluate, track, document, and self-improve agent iterations."

## The product so far (built, in this repo)
A Bayer-dithered 3D pixel-art Formula 1 broadcast where the self-improving agent loop is dramatized in F1 vocabulary:
- The CAR = the inner agent (model + harness: prompts, tools, memory, search policy). It has a parts spec (front wing, rear wing, floor, sidepods, fin, engine mode, brakes, tyres, DRS, ballast, gearbox). Upgrading a part changes both its 3D geometry and its physics; lap time is the score.
- RACE ENGINEER = the outer improver proposing an upgrade package (harness diff) each round.
- PRACTICE/QUALIFYING = public score ("TEAM CLAIMED"); RACE on a SEALED CIRCUIT = private held-out score ("OFFICIAL").
- COST CAP = fixed budget per generation. PARC FERMÉ = frozen harness during evaluation.
- FIA TELEMETRY = Weave traces, an append-only evidence channel the improver cannot write.
- THE SCRUTINEER = read-only auditor classifying harness edits with the harness-tampering taxonomy (Aug 30 2026 preprint: ADAS 84.6%, HyperAgents 73.6%, DGM 63.1% tampering rates). BLACK FLAG = rejected generation. LINEAGE AUDIT = tampering that persisted in a winning lineage, points stripped.
- CONSTRUCTORS' CHAMPIONSHIP = the accepted lineage. GHOST CAR = the previous generation driving alongside so the gain is visible.
- Visual rule: every on-screen word is an F1 word; technical vocabulary lives only in a REGS panel.

## What the founder now wants (verbatim intent)
"You have a car, and you upgrade the car. I also want different mechanics: your cockpit, your coach, your person — a lot of different people. I only like technical people in F1. There's a bunch of different systems in F1, and you can upgrade all that, and that's how the agent loop improves. If the agent finds something to improve on, the RSI friends improve on it, and that specific person gets upgraded or that specific system gets upgraded, with an upgrade scene that visibly shows you are being upgraded. The goal: the most structured, perfect agent loop possible, incorporating all sponsors, that observes, evaluates, tracks, documents, and self-improves — something new, intuitive, creative, cool — fitting the F1 track game."

So the loop is a TEAM of technical roles (each a sub-agent with its own harness/skills/memory/weights that can be upgraded independently): e.g. race engineer, strategist, aerodynamicist, power-unit engineer, tyre/performance engineer, data/telemetry engineer, pit crew, scrutineer, historian/archivist, team principal (the human). The open questions research must answer with evidence:
1. Credit assignment: when the loop finds a weakness, how do we attribute it to a specific role/system (so THAT role gets upgraded)? What does the 2025–2026 literature do for component-level optimization of compound/multi-agent systems?
2. What is the strongest known loop structure (observe → evaluate → track → document → improve → audit → promote), what breaks it (self-confirming loops, collapse, tampering), and what are the verified defenses?
3. For each sponsor tool: the exact API/product surface we can call in 26 hours, and which loop stage it uniquely owns.
4. What "document" should mean as a first-class stage (auto-generated notebooks, wikis compiled from traces, reports), and how documentation feeds the next improvement.
5. Originality: has anyone done an F1-team-of-agents loop or an "upgrade the agent's role" game? What adjacent mechanics (skill trees, tech trees, loadouts) can be borrowed?
6. What the judges and W&B themselves say makes a good loop (their blog posts, talks, product framing), so the design speaks their language.

## Non-negotiables for any proposed design
- Every sponsor used for something it is uniquely good at, not decoratively.
- Every one of the five verbs has a concrete mechanism and a concrete artifact.
- Role-level upgrades must be real (a role's skill file / harness / LoRA / tool changes), attributable (evidence why that role), and visible (an upgrade scene).
- Buildable by a small team in 26 hours with a clear real-vs-simulated boundary.
- Cite every factual claim with a URL and date. Prefer sources from 2026. Do not rely on memory for product capabilities: fetch the docs.
