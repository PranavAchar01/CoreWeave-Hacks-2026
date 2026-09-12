# R10 — What the literature says about a loop like ours

Written 2026-09-12, hackathon day 1. Sources are primary and were opened; every claim that could not
be verified from an opened URL is marked UNVERIFIED. Effect sizes are quoted with the n and the
setting the source reports them in.

The research run that produced this was killed mid-flight after the search, fetch and verification
phases completed (5 search agents, 26 primary fetches, 24 adversarial verification votes). The
synthesis below is written from those results plus two gaps closed by hand: the JS-rendered
BigCodeBench-Hard leaderboard, and a computed power analysis for n=76.

---

## 1. The comp, objectively

The official BigCodeBench-Hard leaderboard is JS-rendered and cannot be fetched. Its backing dataset
can: `bigcode/bigcodebench-hard-results`, 202 entries, last entry dated 2025-04-14.

| | BCB-Hard Instruct | BCB-Hard Complete |
|---|---|---|
| best entry | **33.1%** o3-mini (reasoning=medium) | **40.5%** Gemini-Exp-1206 / DeepSeek-V3 / DeepSeek-R1 |
| top band | 30–33% (o1, o3-mini, Claude 3.7 Sonnet, GPT-4.1, Quasar-Alpha) | 37–40% |
| best *agent* entry | 29.7% Athene-V2-Agent | 33.1% Athene-V2-Agent |

Independent corroboration, single-sample pass@1 on all 148 instruct tasks, no harness
(arXiv 2511.04355, TU Darmstadt, 6 Nov 2025 — verified verbatim from the HTML, Table I):
Llama-3.3-70B 31.8%, Qwen3-Coder 31.1%, DeepSeek-V3 27.7%, GPT-4o 27.7%, Claude Sonnet-4 26.4%,
Mistral-3.2-24B 23.0%. Every model fails 68–77% of the set.

**Scrutineer's baseline is 32.9% (25/76).** That sits at the top of the published band, one tenth of
a point under the best leaderboard entry ever recorded on Hard-Instruct.

Two caveats that must be stated whenever this is said aloud:

1. Ours is a **76-task subset**, not the 148. The splits are disjoint and declared, but a subset
   score is band-comparable, not leaderboard-comparable.
2. Ours is a **multi-step harness with tool probing**; the leaderboard is greedy calibrated pass@1.
   More compute per task. Not the same measurement.

The consequence is the important part. **There is roughly zero headroom above the baseline.** The
best number anyone has published on this benchmark is 33.1%, and we start at 32.9%.

---

## 2. Our null is the modal published outcome, not an embarrassment

**arXiv 2607.12227, "Rethinking the Evaluation of Harness Evolution for Agents" (2026).** Evaluates
outer loops that rewrite agent harnesses with the model held fixed (GPT-5.4, Claude Opus 4.6 on
Terminal-Bench 2.1). Two findings that describe our season exactly:

- On a **disjoint held-out split** (45 train / 10 validation / 34 test), the evolved harness gains
  **+0.6 pass@1 on average** (+1.2 Opus 4.6, 0.0 GPT-5.4) — against the much larger gains reported
  when search and evaluation share a task set. The paper's own words: because "the search and the
  final evaluation share the same benchmark", gains often reflect adaptation to the task set.
- Under **matched feedback and inference budget** (K=5 iterations, m=1 rollout/task): harness
  evolution **+2.9**, parallel sampling **+13.1**, sequential refinement **+11.4**. Without unit
  tests, harness evolution **degrades by −0.8** while parallel sampling still gains +4.1.

It prescribes the evaluation bar: separate the optimization feedback set from the final measurement
set, and include test-time-scaling baselines at matched budget. We do the first. We do not yet do
the second, and that is the single biggest hole in the experiment.

**arXiv 2604.14585, "Prompt Optimization Is a Coin Flip" (AWS GenAI Innovation Center / HSBC).**
72 optimization runs on Claude Haiku 4.5 across 6 methods × 4 tasks × 3 repeats: **49% scored below
the zero-shot baseline** (binomial p=0.91). With **20 training items**, per-candidate scores were too
noisy for reliable selection, and iterative optimizers showed **train–test gaps up to +5.6 points**.
ANOVA over 18,000 grid evaluations found no significant inter-component interaction (p>0.52).

Our sealed split is 24 items. Our sealed delta was +0.33. Our held-out delta was −6.6. That is the
same failure, at the same scale, with the same cause.

---

## 3. The failure has a published name

**Winner's curse under adaptive data analysis.**

- **Dwork, Feldman, Hardt, Pitassi, Reingold, Roth (arXiv 1411.2664).** Any feedback from a holdout
  set to the analyst creates dependence that invalidates the holdout. Non-adaptively, n = O(log m / τ²)
  samples answer m queries; adaptively, the naive approach needs sample complexity **linear in m**.
  Our 24-item sealed split was queried once per generation for 5 generations. It had no validity
  guarantee after the first. The published remedies are the **reusable holdout** (differentially
  private noise + thresholding) and **Blum & Hardt's Ladder** (only reveal a new score when it beats
  the previous best by a margin).
- **arXiv 2605.05973, SIREN (2026).** Names it directly: "Once benchmark items are reused inside
  tuning, the observed winner's score need not estimate the fresh-data performance of the full
  tune-then-deploy procedure." Prescribes freezing the post-search shortlist, R=10 repeated disjoint
  splits with selection and evaluation on separate folds, and an item-level Gaussian multiplier
  bootstrap.

**And the AERO regression has a published mechanism.**

**arXiv 2406.14497, CodeRAG-Bench.** For strong models on common libraries, even **gold** documentation
is neutral-to-negative: GPT-4o DS-1000 52.7 → 51.2 with gold docs; ODEX 44.2 → 44.2. Gains appear only
on rare libraries — **+20.3% to +40.1% on ODEX-hard** (the 20 least-used libraries). The paper states
models "can be easily distracted or disturbed by additional contexts" and sometimes copy context
functions over the queried one, failing all tests.

Nine blocks of WCAG accessibility guidance in the context of an agent writing pandas and subprocess
code is the textbook case. The loop did not find a bad reference by accident; it found the one
intervention that reliably perturbs output without improving it.

---

## 4. Ranked plan — hours-scale, highest expected value first

**R1 · Replace the seesaw gate with a reusable-holdout / Ladder rule.** (2–3h)
Selection is where the loop lies to itself. Ladder: reveal a new sealed score only when it beats the
standing best by a margin τ that exceeds the split's own noise; otherwise report the old score. Adds
a per-season query budget on the sealed 24. Cite Dwork et al. 1411.2664 + SIREN 2605.05973.
This is a *loop* improvement, which is the judged object.

**R2 · Add the test-time-scaling baseline arm.** (1–2h)
arXiv 2607.12227 makes this mandatory for a credible claim, and TYRES already controls samples per
step, so parallel sampling at matched cost is nearly free to run. Two outcomes, both good: the loop
beats matched-budget resampling (headline), or it does not (an honest, publishable comparison that
no other team will have run).

**R3 · Subtract the resampling null from every counterfactual.** (2h)
**arXiv 2606.08275, Causal Agent Replay (CAR)** defines a five-operation intervention algebra —
`do_resample`, `do_action`, `do_observation`, `do_context`, `do_policy` — and treats **plain
resampling as the null intervention**. Our patch-replay flips laps partly by perturbing the prompt
and resampling; CAR's contrastive estimator is built to separate exactly that confound. Implementing
`do_resample` as the baseline arm of every replay is the direct fix for why AERO absorbed all blame
(n=33) and then regressed.

**R4 · Workload-scope the reference library, and gate it against a no-references control.** (2h)
BCB-Hard requires >2 libraries per task *by construction*. Retrieve docs only for libraries outside
the model's frequent set; never ship a blanket references file. Every AERO change must beat a
no-references control, not just the incumbent. Cite CodeRAG-Bench 2406.14497.

**R5 · In-execution self-debug, not self-generated tests.** (2–3h)
**arXiv 2501.12793** shows post-execution self-debugging with *self-generated* tests **degrades**
strong models: Claude-3.5-Sonnet HumanEval 94.5 → 87.2 (−7.3pp), LLaMA-3-70B 79.9 → 74.4 (−5.5pp).
Self-generated suites are unreliable — GPT-4o achieves 97.6% input accuracy but only **59.2%
whole-suite accuracy**, so ~4 in 10 suites contain a wrong test. In-execution debugging (reasoning
over intermediate runtime state, no test oracle) gives small consistent gains. DATA should verify by
tracing runtime state, not by inventing tests.

**R6 · Reduce variance by resampling, not by adding items.** (1h)
Miller (Anthropic, arXiv 2411.00640) gives the closed-form MDE and shows per-task resampling is the
cheap variance reduction. k=3 runs per task on the same 76 shrinks the interval without touching the
split.

### One finding worth stealing outright

**PyCapsule (arXiv 2502.02928)** reports 65.4 ±0.8 on *full* BigCodeBench with Qwen2.5-Coder-7B, and
is widely cited as a fixed-model scaffold win. Adversarial verification killed the comparison: the
paper never calls it pass@1 (it reports "success rate"), and its self-debug loop runs **the
benchmark's own dataset test cases** in the container as the debug oracle — "the processed code with
associated test cases from the dataset is saved in a Python entry file main.py for code execution".
A loop that debugs against the grading tests is not measuring the same thing as a leaderboard pass@1.

**Scrutineer's boundary is stricter than a published paper's.** The agent may run only the docstring's
own examples; the grading tests are never in the container it can see. There is a test that asserts it.

---

## 5. Vocabulary map — say the words judges already know

| Ours | Published term | Source |
|---|---|---|
| ghost-swap | `do_policy` intervention | CAR, arXiv 2606.08275 |
| patch-replay | `do_context` intervention | CAR |
| null-stub | `do_observation`; leave-one-out marginal contribution | CAR; SHARP, arXiv 2602.08335 |
| the resampling confound | `do_resample` — the null intervention | CAR |
| blame router | **failure attribution**; agent-level vs step-level accuracy | Who&When, arXiv 2505.00212 (ICML 2025 Spotlight) |
| failure modes | **MAST** — 14 modes, 3 categories, κ=0.88 over 150 traces | arXiv 2503.13657 |
| "CI lower bound > 0" eligibility | **point-of-commitment** rule | CAR |
| why we mirror every call | full traces improve attribution accuracy by up to 76.5% over partial | TraceElephant, arXiv 2604.22708 (ACL 2026) |
| sealed-split failure | **winner's curse** under adaptive data analysis | arXiv 1411.2664; SIREN 2605.05973 |
| one component per generation | block-coordinate descent (ours) — nearest published: instance-level Pareto selection | GEPA, arXiv 2507.19457 (ICLR 2026 Oral) |

Two corrections to how we have been describing prior work:

- **MAST is a taxonomy, not an attribution method.** Cite it for failure-mode vocabulary and cite
  Who&When or CAR for the mechanism. The paper explicitly says locating a failure's origin requires
  more than error detection.
- **AgentDebug** (arXiv 2509.25370) does step-by-step counterfactual testing and reports 45.0% step /
  31.3% step+module / 24.3% all-correct on AgentErrorBench vs 28.0 / 10.0 / 0.3 for direct prompting.
  Describing it as "counterfactual repair" is UNVERIFIED; use its own words.
- **TraceElephant is real** — verified, ACL 2026. Previous sessions used it without checking.

Also worth knowing: **automated failure attribution is hard**. The best method in Who&When reaches
**53.5% agent-level and 14.2% step-level** accuracy; o1 and DeepSeek-R1 "fail to achieve practical
usability". That 14.2% is the number that justifies proving blame by replay instead of asking a model.

---

## 6. What n=76 can and cannot support

Computed, not asserted. Our comparison has **13 discordant pairs of 76** (4 fixed, 9 broken;
agreement 82.9%). Exact McNemar, α=0.05, 20,000 simulations, discordance held at the observed rate:

| true effect | power at n=76 |
|---|---|
| 5 pp | 0.11 |
| 8 pp | 0.30 |
| 10 pp | 0.47 |
| 12 pp | 0.67 |
| **13 pp** | **0.77** |
| 15 pp | 0.92 |

**The minimum detectable effect at 80% power is ~13–14 points.** And it gets *worse* when a change
perturbs more items: at discordance 0.40, a 20-point effect still only reaches 0.75 power.

Put that next to §1 and the experiment's shape becomes clear:

> The effect we would need to prove a win (≈13 points) is larger than the entire headroom that exists
> above our baseline on this benchmark (≈0.2 points to the published maximum).

**This experiment cannot produce a significant win as configured.** That is not a failure of the loop;
it is a property of the benchmark and the sample size, and the honest move is to say so before
burning the night on another season. The observed −6.6 with p=0.267 is *unresolved*, not "worse" —
Card et al. (arXiv 2010.06595) also warn of a **Type-M exaggeration factor ~1.9** at underpowered n,
meaning any significant-looking result at this size would likely overstate its own magnitude.

Supporting rules for anything we do claim:
- Inference on **question-level paired differences**, not two population means (Miller 2411.00640).
- McNemar exact, mid-p, and paired bootstrap are all calibrated to within 1.1pp of nominal α on
  paired LLM eval data — interchangeable and valid (arXiv 2605.30315).
- **Repeated seasons inflate the requirement**: an anytime-valid e-process rule needs 2.15× the
  sample; Bonferroni over 40 comparisons needs ≈2.11×. Every extra season we run against the same
  split raises the bar we have to clear.
- Report **q = N/N\*** (items available over items required) so the comparison reads as *unresolved
  by design* rather than hidden.

---

## 7. Judging criteria → what to show

Criteria as given: Best Loop, Creativity, Utility, Technical execution, Sponsor usage, and a
Most Production-Ready award judged two weeks later.

The previous edition's rubric (weavehacks2.devpost.com, verified) defined self-improvement as
"Does the agent improve its operation over time? **Is the growth meaningful?**" — the word
*meaningful* is doing work, and it is the word that lets an honest null beat a cherry-picked delta.
WeaveHacks 1 (verified) graded Presentation as "github is open, weave dashboards and traces
included", and stated: **"Usage of W&B Weave is REQUIRED to win, submissions must open the W&B Weave
project and share traces with Judges."**

**Best Loop.** The loop corrects the agent *and its own claims*. Show a generation where a change
cleared every gate and was still refused — and the Ladder gate that now prevents it.

**Creativity.** Ten named roles, five in the car and five on the pit wall, and the counterfactual
replay is agents *disagreeing about each other* with a statistical referee.

**Utility.** 49% of published prompt optimizations score below zero-shot (2604.14585); harness
evolution gains +0.6 held-out (2607.12227). The industry is shipping loops that cannot tell whether
they work. Scrutineer is the instrument that tells you.

**Technical execution.** Network-isolated Docker, read-only mount, declared exclusions, disjoint
splits with a test that asserts the season cannot reach the final 76, 82 tests, Ed25519 hash-chained
lineage.

**Sponsor usage.** See §8.

**Most Production-Ready.** The `champion` alias should be a **protected alias** in a W&B Registry
collection — verified from docs.wandb.ai/guides/registry/configure_registry: only Admins can move a
protected alias, Members cannot. That phrasing plus the Ed25519 chain is the production story.

### The 3-minute script

| time | beat |
|---|---|
| 0:00–0:25 | The bet: an agent harness improved by loop engineering. The model never changes; ten components do. |
| 0:25–1:05 | One generation, live: race → blame → **prove the blame by counterfactual replay** → gates. Name the replay `do_context` / `do_policy` and say "failure attribution". |
| 1:05–1:45 | The catch. A change cleared all ten gates on the sealed split and lost 6.6 points on the untouched 76. McNemar p=0.267, n=76. Winner's curse. Here is the trace in Weave where the blame was written back onto the call. |
| 1:45–2:25 | What we did about it: Ladder gate, `do_resample` null baseline, workload-scoped retrieval, matched-budget test-time-scaling arm. Published fixes for a published failure. |
| 2:25–3:00 | The MDE slide. 13 points needed, 0.2 points of headroom exist. We built the instrument that can tell you your experiment is unwinnable before you run it overnight — and it told us. |

The last beat is the one that wins the room. Every other team will claim a number. Ours is the only
one that can say what its number means.

---

## 8. Sponsor checklist

| rail | status | action |
|---|---|---|
| **Weave traces** | live — 29,890 calls, project `achar-pranav-optivia/scrutineer` | **HARD REQUIREMENT: make the project shareable and open a live trace in the pitch.** Not a slide. |
| **Weave feedback** | live — 454 proven-blame rows written back onto the original calls | Vendor docs name "build evaluation datasets" as the purpose; say that. |
| **Weave Evals** | wired — one row per task, per race | Confirm the Evals tab renders before judging. |
| **W&B Registry** | live | Make `champion` a **protected** alias. One setting; it is the Most Production-Ready story. |
| **ARIA** | live when `WANDB_API_KEY` is set; logs `aria_agrees` | Has its own $1k prize. Confirm it answered this season. |
| **marimo** | 9 generated debriefs in `loop/debriefs/` | Own $500 prize. Open one during Q&A. |
| **W&B Inference** | wired, **not live** — driver ran on Anthropic | Either switch the driver for one race or say plainly it is wired and dark. |
| **Serverless RL** | real backend; **declined to train** — every rollout group had identical reward, so the gradient was zero | This is a correct refusal and reads well if explained. Do not dress it up. |
| **TypeSafe AI** | **not live** — all 6,756 decisions served by the local deterministic policy | One key in `~/.scrutineer.env` turns a dark box into a live $1k rail. Highest ratio of prize to effort on the board. |

Luma verifies the prize list: Best Loop Design, Most Production-Ready, Best Use of Weave ($1k), Best
Use of ARIA ($1k), Best Use of marimo ($500), Best Use of TypeSafe AI, Best Social Media demo.
Note the wording is **"Best Loop *Design*"** — the loop's structure is the judged object, which is
where a typed-gate, counterfactual-blame, block-coordinate design competes best.

---

## Sources

Primary, opened in the session that produced this file.

- arXiv 2607.12227 — Rethinking the Evaluation of Harness Evolution for Agents
- arXiv 2604.14585 — Prompt Optimization Is a Coin Flip
- arXiv 2605.05973 — SIREN, winner's curse in adaptive benchmarking
- arXiv 1411.2664 — Preserving Statistical Validity in Adaptive Data Analysis (reusable holdout)
- arXiv 2411.00640 — Adding Error Bars to Evals (Miller, Anthropic)
- arXiv 2010.06595 — With Little Power Comes Great Responsibility (Card et al., EMNLP 2020)
- arXiv 2605.30315 — Resolution Diagnostics for Paired LLM Evaluation
- arXiv 2606.08275 — Causal Agent Replay (CAR)
- arXiv 2505.00212 — Who&When, automated failure attribution (ICML 2025 Spotlight)
- arXiv 2503.13657 — MAST, Why Do Multi-Agent LLM Systems Fail?
- arXiv 2604.22708 — TraceElephant (ACL 2026)
- arXiv 2509.25370 — AgentDebug / AgentErrorTaxonomy
- arXiv 2507.19457 — GEPA (ICLR 2026 Oral)
- arXiv 2406.11695 — MIPROv2 / DSPy
- arXiv 2408.08435 — ADAS / Meta Agent Search
- arXiv 2505.22954 — Darwin Gödel Machine
- arXiv 2406.14497 — CodeRAG-Bench
- arXiv 2501.12793 — Revisit Self-Debugging with Self-Generated Tests
- arXiv 2502.02928 — PyCapsule
- arXiv 2511.04355 — Where Do LLMs Still Struggle?
- huggingface.co/blog/terryyz/bigcodebench-hard — Hard subset construction
- huggingface.co/datasets/bigcode/bigcodebench-hard-results — the leaderboard's backing data
- docs.wandb.ai/weave/guides/tracking/feedback — call-level feedback API
- docs.wandb.ai/guides/registry/configure_registry — protected aliases
- weavehacks2.devpost.com, weavehacks-1.devpost.com — previous rubrics
- luma.com/coreweavehacks — this event's prize list

UNVERIFIED and not to be claimed: AlphaEvolve's "overfitting to leaky scorer code" limitation
(secondary source only); TypeSafe AI's System1 API specifics (public site shows only positioning);
the DGM objective-hacking episode was verified in a later fetch but the safety-section detail should
be re-read before citing; the 3-minute / 8-finalist format does not appear on the Luma page.
