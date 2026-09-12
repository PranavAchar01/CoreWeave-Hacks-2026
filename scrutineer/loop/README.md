# SCRUTINEER — the loop

The control plane behind the broadcast. `research/LOOP.md` is the frozen design; this is that
design as running code.

A generation is one block-coordinate-descent step over a team of ten agents: race, score, work out
which agent cost the lap by replaying the race without it, upgrade only that agent, and let the
upgrade through only if a chain of gates the improver cannot write says so.

```
observe → evaluate → track → self-improve → audit → document → promote → observe
```

## Run it

```bash
uv venv --python 3.12 && uv pip install -e ".[dev]"
.venv/bin/scrutineer doctor                 # which rails are live, what each missing key unlocks
.venv/bin/scrutineer season --generations 12 --unattended-from 6 --export
.venv/bin/scrutineer verify                 # replay the signed lineage chain
.venv/bin/pytest -q
```

Nothing above needs an API key. Every sponsor rail sits behind an adapter that reports which
backend actually served it, and the honesty panel in the broadcast prints that table, so the page
can never claim a rail that did not run.

## What is real without a key

The whole control plane. Telemetry and the append-only ledger, the typed credit router, the
three-mode counterfactual replay, bootstrap standings, the selection rule with all six branches,
the improver's unified diffs and change manifest, the pit crew's install and smoke set, the
scrutineer's 5×7 taxonomy, all ten gates, the marimo debrief that has to reproduce the standings
before it will open the gate, the Ed25519 hash chain, the wiki, the curriculum generator. The
hidden tests execute in a real sandbox — Docker with `--network none` when a daemon is up.

The one thing stubbed is the *cognition*: with no inference key the driver is `local-sim`, a
deterministic stand-in whose correctness depends causally on the same things a real driver's
would — whether AERO retrieved the reference the item needs, how many samples TYRES allowed,
whether DATA's probe can tell a wrong answer from a right one, whether STRATEGIST boxed too
early, and how good the driver itself is. That is what makes counterfactual replay meaningful
offline: correcting one agent flips exactly the laps that agent caused.

## What the live rails changed

Running against real keys found five things the offline stand-ins could not.

1. **The completion cache was defeating sampling.** Every one of TYRES' k samples issued an
   identical request, so the cache served one answer k times and an extra stint bought nothing.
   Each attempt now carries its own nonce and model seed; replays still hit the cache, which is
   what makes a counterfactual exact.
2. **The circuit was too easy.** The real 14B driver already solved 85 % of the pool, so a random
   opening circuit left the loop nothing to improve. Eight harder families were added, and the
   opening QUALI and SEALED circuits are now band-filtered against the car itself — the same
   frontier-band rule the SIMULATOR applies to every later circuit. Gen 0 now passes ~32 %.
3. **Backend B is `granite-4.1-8b`, not `gpt-oss-20b`.** Both satisfy the strict schema, but
   gpt-oss emits ~400 reasoning tokens before the answer: 6.9 s against 0.4 s for the same
   decision, and a season makes thousands of them. `SCRUTINEER_TYPED_MODEL` selects either.
   A tight `max_tokens` truncated gpt-oss before it emitted any content at all, which is why the
   rail now budgets for reasoning and reports an empty completion instead of an empty answer.
4. **Hunks are located by their context, not their line number.** A model writing a unified diff
   by hand gets `@@ -a,b +c,d @@` wrong often; refusing those rejects correct changes for a
   clerical error. The content must still match exactly, exactly as `patch(1)` has always worked.
5. **Managed sandboxes are not enabled for this organisation.** W&B turns the preview on per org
   on request to support@wandb.com. Until then the sandbox rail runs Docker with `--network none`
   and a read-only mount, and `doctor` prints the reason.

One claim is not exercised: the sealed circuit is supposed to live in a **second W&B team** under
a service-account key the improver's process does not hold. This account has one team, so the
split is enforced by `SealedEvaluator` — which returns only the aggregate `official:gen-n` object
and never an item — rather than by team membership. The honesty panel says so.

## The one rail that does not work

`scrutineer train` runs the real Serverless RL path: it registers an `art.TrainableModel` against
W&B Serverless Training, picks tasks inside the frontier band, and collects rollouts through ART's
own inference client so each trajectory carries the model's choice and logprobs. Two things came
out of running it.

The first attempt collected rollouts by hand-building the messages, and every training step
processed **zero batches** — without the model's own choices there is nothing to compute an
importance ratio against. That is now fixed. The second attempt collected 72 rollouts over 12
groups and correctly **refused to train**, because every group had the same reward and
group-relative advantage would be zero for every member. That refusal is the design working: it is
why the curriculum component exists, and band-filtering the tasks cut zero-variance groups from
100 % to 25 %.

The third attempt fails at `model.openai_client()` with `APIConnectionError`: serving a LoRA
checkpoint for this base model is not available on this account, so the rollouts never reach a
model. **The weights path therefore stays a labelled stand-in.** Nine of the ten components are
improved by editing a file and that path is fully exercised; the tenth needs a serving endpoint we
do not have. The honesty panel says so rather than showing a curve.

## Layout

| Path | What it is |
|---|---|
| `REGS.md` | the frozen contract; hashed into every chain row, writable by nobody in the loop |
| `skills/<role>/` | the ten artifacts, one per agent — the improver's diffs target these files |
| `src/scrutineer/car/` | the five in-lap roles and the lap pipeline |
| `src/scrutineer/{router,replay,ledger,selection}.py` | credit assignment and the optimizer step |
| `src/scrutineer/{engineer,pitcrew,audit,gates,chain}.py` | propose, install, audit, gate, sign |
| `src/scrutineer/historian.py` | the wiki and the marimo debrief that gates promotion |
| `src/scrutineer/rails/` | one adapter per sponsor, each with a labelled offline stand-in |
| `debriefs/round_NNN.py` | executable debriefs; `app.run()` returns `gate_ok` |
| `lineage/chain.jsonl` | the signed receipts |
| `wiki/` | pattern pages, skill-impact, hypotheses — never rolled back |

## The part numbers

Each agent owns one artifact and emits one prefix: **P** prompt, **R** references and context,
**S** search policy and thresholds, **H** harness code and tool schemas, **W** weights,
**C** circuit and curriculum. `AERO R-v4` is the fourth revision of the aerodynamicist's
reference set.

## Sign convention

`predicted_delta_s`, `credit_r`, `d_quali`, `d_sealed` are all **seconds gained, positive =
faster**, everywhere, including on screen.
