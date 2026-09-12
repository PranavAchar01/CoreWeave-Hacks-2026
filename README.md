# Scrutineer

An agent that builds web interfaces, and a second loop that rewrites the machinery the first one
runs inside. The model never changes. Every generation the outer loop measures which component of
the harness caused the failures it saw, changes exactly one of them, and keeps the change only if
it survives ten gates and a held-out split the agent cannot reach.

Built for **CoreWeave Hacks: Agent Loops**, September 2026.

## Live

| | |
|---|---|
| **The broadcast** | https://scrutineer-one.vercel.app |
| **The timeline** | https://scrutineer-timeline.vercel.app |
| **The pit board** | https://scrutineer-one.vercel.app/pit |

The broadcast has two surfaces: `TRACK`, where a season plays out as a race, and `TELEMETRY`, a
live instrument panel — held-out score, laps as they land, the ten gates resolving, credit per
component, and a three-dimensional violation landscape that erodes as the harness learns.

The timeline is one scrubber across the whole season. Drag it and the car rebuilds at that
generation, because the car *is* the harness: wings move with RETRIEVAL, the floor with
VERIFICATION, compound with SAMPLING. Switch to `GARAGE` for the same state from the other side.

The pit board is the car on a card that stays on top. Pop it out and it floats above every other
app while the loop runs behind it; each time a generation lands the car rebuilds and a placard says
what was kept. Hover it for how far the agent has run — runs, laps, score, the ten components. It
turns live when a `scrutineer watch` server is running on the machine, and replays the recorded
season otherwise. One line embeds it anywhere:

```html
<script src="https://scrutineer-one.vercel.app/pit.js" async></script>
```

## What it measures, including where it failed

Every number below is measured, and the ones that went against us are here too.

**Credit assignment works, and it is causal.** Each failure is re-run three ways — the suspected
component reverted, handed a corrected output, and removed — and credit is recorded only when the
correction flips the failure. Blame whose 90% bootstrap interval crosses zero is not acted on.

**The task population is not one population.** Read as a component × family matrix, 165 confirmed
incidents separate cleanly: total variation **0.520**, CI₉₀ **[0.431, 0.633]**. One side is the
families made of forms and tables, the other the families made of components. The loop found that
line in its own ledger.

**A single harness is a compromise.** Racing both harnesses over each side: **+16.74 s** on one,
**+8.74 s** on the other — 21.0% against 11.9% of each side's own starting time, so the effect
survives normalising for headroom.

**Gate outcomes have to be typed by what they are evidence about.** A budget cap left from a
previous inference provider vetoed seven generations, and because every refusal was recorded as a
failed fix, the two largest held-out gains of that season were filed as proof the component could
not fix anything. Typed gates took it from 0 promotions in 7 to 2 in 3.

**On a public benchmark it did not win.** On BigCodeBench-Hard, 76 held-out tasks graded by
executing held-out unittest modules: baseline **32.9%** (25/76), the harness the loop kept
**26.3%** (20/76) — **−6.6 points**, McNemar *p* = 0.267. Not significant, and the point estimate
favours the baseline. The change had n=33 confirmed incidents and cleared every gate, then lost
ground out of sample: **the loop overfit its own sealed split**. On HumanEval the result was a
flat null (94.7% both ways, *p* = 1.0, n=114) on a benchmark too saturated to measure a harness at
all — its baseline fails 6 of 114.

## Running it

```bash
cd scrutineer/loop && uv sync
uv run scrutineer doctor            # which rails are live, which are stand-ins
uv run scrutineer demo              # seed a labelled demonstration season
uv run scrutineer season -g 5       # a real season (needs ANTHROPIC_API_KEY)
uv run pytest                       # 84 tests
cd .. && node build.js              # both sites
```

Keys are read from the environment and never written to the repo. The Ed25519 signing key in
`scrutineer/loop/lineage/` is gitignored; only the public key and the hash chain are committed.

## Layout

```
scrutineer/loop/      the control plane — races, credit assignment, gates, lineage (Python 3.12)
scrutineer/src/       the broadcast and the timeline (no framework, software rasterizer on canvas)
scrutineer/site/      the deployed broadcast
scrutineer/site-timeline/   the deployed timeline
scrutineer/research/  LEDGER.md — every iteration, including the ones that failed
```

`research/LEDGER.md` is append-only and is the honest record: what was tried, what was measured,
which predictions failed, and the bugs that would each have produced a confident wrong answer.
