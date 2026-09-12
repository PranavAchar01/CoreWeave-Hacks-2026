# Scrutineer

An **agent loop that builds and improves web interfaces**. One agent generates interfaces. A second loop watches it fail, identifies which harness component caused each failure, changes exactly one component, and promotes the change only if it survives validation gates and a held-out benchmark.

**Built for CoreWeave Hacks: Agent Loops, September 2026.**

---

## How it works

```
┌─────────────────────────────────────────────────────────────┐
│ 1. AGENT BUILDS                                             │
│    Generates 20 web interfaces from specs                   │
│    (checkout forms, data tables, modals, dialogs...)        │
└────────────┬────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────────┐
│ 2. HARNESS VALIDATES                                        │
│    → RETRIEVAL: fetch specs                                 │
│    → INFERENCE: call the agent                              │
│    → SAMPLING: select which interface to try                │
│    → VERIFICATION: audit output in a real browser           │
│    → ... 6 more quality gates                               │
└────────────┬────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────────┐
│ 3. CREDIT ASSIGNMENT                                        │
│    Each failure re-run 3 ways:                              │
│    - revert suspected component                             │
│    - hand it corrected output                               │
│    - remove it entirely                                     │
│    Credit recorded only when revert/correct flips pass      │
└────────────┬────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────────┐
│ 4. OPTIMIZATION                                             │
│    Highest-credit component gets rewritten                  │
│    Change tested on 10 gates + held-out split               │
│    Kept only if it survives everything                      │
└────────────┬────────────────────────────────────────────────┘
             │
             └──→ REPEAT (measured, honest record in LEDGER)
```

---

## Watch it happen

| | |
|---|---|
| **Homepage** | [scrutineer-one.vercel.app](https://scrutineer-one.vercel.app) — car rebuilds itself, one metric per loop |
| **TRACK** | [/watch](https://scrutineer-one.vercel.app/watch) — live race: watch laps land, car gets faster as harness improves |
| **TELEMETRY** | Instrument panel: gates, component credit, violation landscape |
| **Timeline** | Scrub through any generation; car rebuilds to show that harness state |
| **Pit Board** | Floating card with current progress (embed anywhere with one line of JS) |

---

## The measured record

Every number is measured. The failures are documented too.

| Result | Finding |
|--------|---------|
| ✓ Credit works | Each failure re-run proves causal: correction flips outcome → credit assigned |
| ✓ Population found | Task families separate cleanly (forms/tables vs. components), discovered by the loop itself |
| ✗ Harness is compromise | Optimal for forms costs 21% on components. Single config serves both. |
| ✓ Gate typing matters | Typed gates distinguish refusals: 0→2 promotions when typed by evidence type |
| ✗ Overfit on split | **−6.6 points on BigCodeBench-Hard** — cleared gates, lost ground out-of-sample |

---

## Architecture

```
scrutineer/loop/           Control plane (Python 3.12)
  ├─ races/                Run a season, log every decision
  ├─ credit/               Blame re-runs, isolation
  ├─ gates/                 10 validators, rejection causes
  └─ lineage/              Hash chain of promotions (Ed25519)

scrutineer/src/            Visualizations (no framework)
  ├─ broadcast.html        TRACK + TELEMETRY (canvas rasterizer)
  ├─ timeline.html         Scrubber for any generation
  └─ pit.html              Floating card + replay server

scrutineer/site/           Deployed broadcast
scrutineer/site-timeline/  Deployed timeline
research/LEDGER.md         Every iteration: tried, measured, failed, fixed
```

---

## Run it

```bash
cd scrutineer/loop && uv sync

# Check which tools are live vs. stand-in
uv run scrutineer doctor

# See a demo season (recorded, no API needed)
uv run scrutineer demo

# Run a real season
uv run scrutineer season -g 5    # needs ANTHROPIC_API_KEY

# Tests
uv run pytest                     # 84 tests

# Build all surfaces
cd .. && node build.js

# …or build, serve on :4173 and rebuild on save, in one command
cd .. && ./run.sh
```

**To watch live while running:** Start `scrutineer watch` server and open `http://127.0.0.1:7777/pit`

**To embed the pit board:** One line in any HTML:
```html
<script src="https://scrutineer-one.vercel.app/pit.js" async></script>
```

---

## Who does what

| Tool | Role |
|------|------|
| **W&B Inference** | Model the agent runs on (OpenAI-compatible via `api.inference.wandb.ai`) |
| **W&B Weave** | Every generation traced — build, audit, blame, gate, replay |
| **W&B Runs** | One run per component; credit curves are clickable, not buried in logs |
| **W&B Registry** | Harness versions registered with alias; promoted thing = versioned thing |
| **TypeSafe System1** | Typed decisions: pit wall, credit router, gate outcomes (not local policy) |
| **W&B Sandboxes** | The agent's own code runs isolated rather than in-process |
| **W&B Serverless RL** | `scrutineer train` registers a real LoRA job and collects rollouts through the trainer's client |
| **ARIA** | The board each generation is reported to |
| **marimo** | Debrief: every promotion writes executable notebook that proves the decision |

**Honest reporting:** Every tool reports live or stand-in status. `uv run scrutineer doctor` prints the table; site shows it too.

---

## Key findings

1. **Credit assignment is causal.** Failures re-run in isolation; blame is only recorded when fixing flips the pass.

2. **Task population structure is real.** 165 confirmed incidents separate by component type (forms vs. components), with total variation 0.520, CI₉₀ [0.431, 0.633].

3. **Typed gates matter.** Distinguishing gate failures by what they're evidence of (budget cap vs. output error) improved promotion rate from 0/7 to 2/3.

4. **Honesty is the product.** Losses on BigCodeBench-Hard are published. Overfit split, stood still on HumanEval. This is the record.

---

## Next steps

See `research/LEDGER.md` for every iteration—what was tried, what was measured, which predictions failed, and the bugs that each would have masked.
