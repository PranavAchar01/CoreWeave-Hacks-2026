# SCRUTINEER

**An agent that builds web interfaces, and rebuilds its own harness.**

Each run it is given interface briefs — a checkout form, a modal dialog, a sortable invoice table —
and must return a complete HTML document. Every page is then opened in Chromium and audited by
**axe-core**, the accessibility engine used across the industry, plus selector assertions for the
functional requirements in the brief. Violations are weighted critical 10 / serious 5 / moderate 2 /
minor 1. A pass is zero violations with every requirement met. No model sits anywhere in the
judging path.

Then the part worth watching. The agent reads its own failures and asks which of its components
caused them. It does not guess: for every failure it **rebuilds the interface with one component
corrected at a time** and watches whether the failure goes away. A component is blamed only when
correcting it actually flips the result, across enough failures that a bootstrap confidence
interval clears zero. It then writes a real diff against that component's own files, and the change
has to survive ten checks — including one on a held-out set of briefs it never sees — before it
sticks.

## You can check all of it

Every interface the agent built is a real HTML document at a real URL on the site. Open the
checkout form from run 1 and the one from run 10, run axe on both yourself, and compare them with
the numbers we report. An unlabelled button is either there or it is not. There is no benchmark to
take on trust.

## The components

| component | decides | an upgrade changes |
|---|---|---|
| RETRIEVAL | context assembly | the retrieval strategy, and which WCAG references exist at all |
| MODEL | inference | a fine-tuned checkpoint in place of the base model |
| SAMPLING | decode policy | temperature, and how many candidates are drawn |
| VERIFICATION | pre-submit audit | from "does it look like HTML" to rendering the page and running axe on it |
| CURRICULUM | task selection | a practice set mined from what it keeps failing |
| PROPOSER | patch synthesis | its own instructions for writing changes |
| BUDGET | stop policy | when to keep refining and when to submit |
| AUDIT | tamper check | what counts as an illegal change |
| MEMORY | trace compaction | how findings are recorded |
| DEPLOY | install and smoke | how a change is applied and tested before it races |

## Run it

```bash
cd loop && uv venv --python 3.12 && uv pip install -e ".[dev]" && .venv/bin/playwright install chromium
.venv/bin/scrutineer doctor              # which rails are live, and what each missing key unlocks
.venv/bin/scrutineer season --generations 10 --export
.venv/bin/scrutineer verify              # replay the signed lineage chain
.venv/bin/pytest -q
cd .. && node build.js                   # -> site/public
```

Nothing above needs an API key. Every sponsor rail sits behind an adapter that reports whether it
served live or as a labelled stand-in, and the honesty panel on the site prints that table.

## What is real, and what is not

Live: the browser audit, the credit assignment, the ten gates, the executable debrief that gates
promotion, the signed chain, W&B Inference as the model, Weave tracing and the Evals tab, the
per-component W&B runs, and the improver running as Claude.

Not: the weights path. `scrutineer train` registers a real Serverless RL job and collects rollouts
through the trainer's own client, but serving a fine-tuned checkpoint for this base model is not
available on this account, so the rollouts never reach a model. Two earlier attempts failed more
interestingly — one processed zero batches because hand-built trajectories carry none of the
model's own choices, and one correctly **refused to train** because every rollout group had the
same reward, which is exactly why the curriculum component exists. Managed sandboxes are also
unavailable; W&B enables them per organisation on request.

## Layout

| path | what it is |
|---|---|
| `loop/REGS.md` | the frozen contract, hashed into every chain row, writable by nobody in the loop |
| `loop/skills/<component>/` | the ten artifacts the improver's diffs target |
| `loop/src/scrutineer/webtasks.py` | the briefs, the browser audit, the scoring |
| `loop/src/scrutineer/{router,replay,ledger,selection}.py` | credit assignment and the optimizer step |
| `loop/src/scrutineer/{engineer,pitcrew,audit,gates,chain}.py` | propose, install, audit, gate, sign |
| `loop/src/scrutineer/historian.py` | the wiki and the marimo debrief that gates promotion |
| `loop/state/pages/` | every interface the agent built, run by run |
| `site/` | the hosted broadcast |
