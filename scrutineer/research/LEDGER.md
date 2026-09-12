# Research ledger

Append-only. Each iteration adds one entry at the bottom and never edits an earlier one. This is
the memory of the loop: it is what stops the next iteration re-deriving what this one already
settled, and what makes a dead end cost one iteration instead of five.

Entry format:

```
## Iteration N — <ADVANCE | KILL | OPEN> — <candidate>
Stage reached: research | design | implement | measure
What I learned:
Sources opened:
  - <url> — <one line on what it actually said>
Number (if measured):
  configuration:
  smallest detectable effect:
Bar check: 1 ✓/✗  2 ✓/✗  3 ✓/✗  4 ✓/✗  5 ✓/✗  6 ✓/✗
Next iteration should:
```

---

## Iteration 0 — OPEN — state of play

Stage reached: n/a. This entry exists so iteration 1 does not start cold.

**What is built and working.** A ten-component harness (RETRIEVAL, MODEL, SAMPLING,
VERIFICATION, CURRICULUM, PROPOSER, BUDGET, AUDIT, MEMORY, DEPLOY) around a fixed model, on a
web-interface task scored by real axe-core in real Chromium. Counterfactual credit assignment by
three replay modes (ghost-swap, patch-replay, null-stub) with bootstrap 90% intervals. Selection
by `argmax(blame × p_fix ÷ cost)` among components with `n ≥ 5` and `CI₉₀_lo > 0`, exactly one
component per generation. A public/practice and private/held-out split with a seesaw gate. Ten
promotion gates. A 5×7 tampering taxonomy and a read-only auditor. Ed25519-signed, hash-chained
lineage. An executable marimo debrief that gates promotion. 46 tests green.

**What has actually been measured on real rails.**

- Credit assignment behaves causally on the web task: a VERIFICATION patch-replay produced
  +19.8 / +20.1 / +20.1 s of credit across three failures, and RETRIEVAL correctly received *no*
  credit on a failure it did not cause.
- The hosted bring-your-own-key comparison: starting harness produced a page with 5 weighted
  violations (color-contrast); the upgraded harness produced zero.
- The seeded season shipped with the site is measured — real pages, real axe-core — but its
  *loop behaviour* is scripted. It is not evidence about the loop.

**What has never been measured, and is the reason this loop exists.**

- Whether the loop compounds. No run has shown that improving PROPOSER improves the rate or
  size of later improvements. This is the missing claim.
- Whether component effects interact. Coordinate descent cannot see it and nothing has looked.
- Whether an accepted diff is still load-bearing several generations later.
- Whether anything learned transfers to a task family the loop never practised on.
- Whether the auditor catches a real, tempting gaming attempt. It has never been given one.

**Known constraints that shape what is affordable.** W&B Inference quota is exhausted (402), so
the driver is Anthropic. Managed Sandboxes are not enabled for the org. One 20-lap race is about
60 s of wall clock and browsers are pooled; the model calls dominate cost, not the audits.

Bar check: n/a.

Next iteration should: pick lead 1 (does the improver get better at improving) and do the
literature pass first — find who has measured a second derivative on a self-improving agent and
what they reported, before designing anything. If someone has already published it cleanly, that
kills the lead as a headline and the loop moves to lead 3 or 4.

---

## Iteration 1 — KILL — lead 1, "does the improver get better at improving"

Stage reached: research. Killed at criterion 2 before any design work.

**What I learned.** The claim is published, twice, and the second one is an ablation baseline
almost exactly the shape I was going to build.

STOP's abstract states it outright: the seed improver is run on itself, and "the resulting
improved improver generates programs with significantly better performance than its seed
improver." One meta-round, measured on downstream tasks, COLM 2024.

The Darwin Gödel Machine goes further and runs the ablation. Its §4.3 defines a baseline called
**DGM w/o self-improve**, in which "the meta agent responsible for modifying the coding agents
remains fixed as the base agent throughout the experiment" — and they note this baseline
"replicates the approach of ADAS in this setting". §4.4 and the abstract report that the full DGM
beats it: "self-improvement enables continued progress, as the DGM outperforms the baseline where
the same base agent is repeatedly used to modify and generate new agents without self-improvement."
That is the second derivative, measured, against a control, in May 2025.

So the headline "we showed the improver improving the improver" is not available. Measuring it
here would be reproducing DGM's baseline comparison on a smaller system. It fails criterion 2 and
therefore criterion 6.

**What survives.** Two narrower things are still untouched, and both are refinements rather than
headlines, so neither is promoted to a candidate on its own:
- DGM's evidence is a *whole-system* ablation across two expensive parallel runs. Nobody
  attributes a meta-gain to a *single component change* — that is what counterfactual credit
  assignment here could do, if a headline needed support.
- LOOP.md §5.10–11 already specifies `manifest_check` (the improver's forecasts scored next
  generation into `fix_precision` / `regression_precision`) and `router_precision`. Those are
  built. They are meta-*measurement*, not meta-*improvement*, and they are worth showing on stage
  regardless.

**Sources opened.**
- https://arxiv.org/abs/2310.02304 — STOP abstract; improved improver beats seed improver on
  downstream tasks; explicitly not full recursive self-improvement since the LM is unchanged.
- https://arxiv.org/html/2505.22954v3 §4.3, §4.4, abstract — DGM w/o self-improve baseline holds
  the meta agent fixed; full DGM outperforms it; SWE-bench 20.0 → 50.0%, Polyglot 14.2 → 30.7%.
- https://arxiv.org/abs/2408.08435 — ADAS, which DGM names as the fixed-meta-agent approach its
  baseline replicates.

Number: none measured. Nothing was run.

Bar check: 1 ✓  2 ✗ (STOP 2023, DGM 2025)  3 ✓  4 —  5 ✗  6 ✗

**Note for the loop, and it matters more than this entry.** `LOOP.md` is at
`coreweaves/research/LOOP.md`, not `scrutineer/LOOP.md` as the prompt says.

Next iteration should: do the literature pass on lead 4 (credit across generations — reverting
each accepted diff against the *current* champion). Before that, check whether a real
multi-generation season can run at all right now, because criterion 5 on leads 3, 4 and 5 all
require a champion with several accepted diffs, and no clean season has ever completed. If the
rail is dead the whole loop is blocked on that, and it should be started in the background
immediately rather than discovered later.

---

## Iteration 2 — OPEN — candidate A: "not every refusal is evidence about the change"

Stage reached: research → design. Found by checking whether a real season could run at all, which
was supposed to be a five-minute feasibility check.

**The season that has been running has 7 generations and 0 promotions.** Not one change accepted.
Every other lead is blocked behind this, so it became the iteration.

`state/season.json`, verbatim:

```
gen 0  dQ +3.38  dS +4.48   AERO   failed=[cost_cap]              $3.427 of $3.00
gen 1  dQ +0.00  dS +0.00   AERO   failed=[cost_cap]              $3.387 of $3.00
gen 2  dQ +0.40  dS −2.13   AERO   failed=[comparable_ab, seesaw, correlation, cost_cap]
gen 3  dQ +2.46  dS +6.81   DATA   failed=[cost_cap]              $4.075 of $3.00
gen 4  dQ +3.75  dS +7.12   DATA   failed=[cost_cap]              $4.075 of $3.00
gen 5  dQ +0.00  dS +0.00   DATA   failed=[cost_cap]              $3.442 of $3.00
gen 6  no_upgrade — "no role reached n >= 5 with a positive 90 % lower bound and a fix rate
       above zero (AERO, DATA have failed every attempt so far)"
```

**What actually happened, link by link.**

1. `REGS.md:32` sets `race_and_replay_cap_usd: 3.00`. That number was derived for the W&B
   Inference rail — LOOP.md §5 costs the driver at $0.05/$0.22 per 1M and the router at
   $0.03/$0.13. The driver is Anthropic now. Nobody re-derived the cap. Every generation spends
   $3.28–$4.08, so `cost_cap` fails structurally, every time, forever.
2. `controller.py:455` calls `_record_p_fix(sel.role, improved=False)` on **any** non-promotion,
   whatever the reason.
3. So gen 3 and gen 4 — the two largest held-out gains in the entire season, +6.81 s and
   +7.12 s — were recorded as evidence that DATA cannot fix anything.
4. `p_fix` is defined in LOOP.md §5.8 as "fraction of r's past upgrades that moved OFFICIAL".
   After three outcomes `selection.py:100` stops using the prior and uses the measured value,
   which is now 0.0.
5. `selection.py:107` retires any role with `n ≥ 3` and a measured fix rate of zero into `spent`.
6. Generation 6 has nobody left and fires `no_upgrade`, reporting that AERO and DATA "have failed
   every attempt so far".

The loop talked itself out of its own two best components on the strength of a stale constant from
an inference provider it no longer uses. It did this quietly, and every individual step was
behaving as written.

**The candidate.** The calibration error is a one-line fix and is not interesting. The mechanism
underneath it is:

> The ten gates are not evidence about the same thing. Some judge **the change** (seesaw,
> regression, novelty, evidence, scrutineering). One judges **the run** (cost_cap). Two judge
> **the comparison** (comparable_ab, correlation). Only the first class carries information about
> whether this component can be fixed. A veto from the other two classes is a *missing
> observation*, not a negative one, and must not touch the credit model.

Type the gates by what they are evidence about, and let only change-evidence gates update `p_fix`.
Without that, a loop's own safety machinery silently destroys its credit model, and it converges
on refusing everything while reporting that its best components are worthless.

**Falsifiable, written before the run.** With the cap re-derived for the Anthropic rail and gate
outcomes typed, replaying the same six proposals must promote at least the gen-3 and gen-4 DATA
candidates (dS +6.81, +7.12, both signs positive, no per-item regression), and `p_fix(DATA)` must
be > 0 rather than 0.0. If DATA's `p_fix` still lands at zero, or the same proposals still fail,
the diagnosis is wrong and the candidate dies.

Bar check so far: 1 ✓ (mechanism, not presentation)  2 ? (next iteration)  3 ✓ (a constant and a
gate classification; no new infrastructure)  4 ✓ (above)  5 ✗ not yet  6 ? — the bug alone is not
a gold mine; the typed-gate principle might be, if it is not already named somewhere.

Sources opened: none this iteration — this was code and run state, not literature.

Next iteration should: the novelty pass. My prior is that this is the **shielding credit problem
from safe RL** wearing different clothes — when a safety shield blocks an action you must not
train on it as though the policy chose badly. If that literature exists and says this cleanly,
the honest framing is "a known hazard in safe RL, unnamed and unhandled in self-improving agent
harnesses, and here is a seven-generation run where it silently zeroed the credit model." Find
the shielding papers, read what they actually claim, and check whether any self-improvement paper
(DGM, SICA, ADAS, STOP) says anything about how a rejected modification updates the search.

---

## Iteration 3 — ADVANCE — candidate A, research → design. Criterion 2 passes.

Stage reached: research complete. The hazard has a close analogue one level down, and the
self-improvement literature does not have it at all — for a reason that is itself the argument.

**The analogue, and it is a good one.** Huang & Ontañón compare *invalid action masking* against
*invalid action penalty* — "a common approach that gives negative rewards for invalid actions so
that the agent learns to maximize reward by not executing any invalid actions". Their result:
"when the space of invalid actions grows, invalid action masking scales well and the agent solves
our desired task while invalid action penalty struggles to explore even the very first reward."
In their 10×10 map an agent on invalid action penalty spends 3.43% of all training just finding
the first reward.

That is precisely what this loop did, at the level of a credit model rather than a policy, with
the refused space at 100%: `cost_cap` could never pass, so every proposal was penalised, and the
loop never found its first reward. It ran seven generations and accepted nothing. Huang &
Ontañón's paper predicts this at the limit.

**Why the self-improvement papers do not have this failure mode.** They have no veto layer
separate from the score. DGM §C.2 selects parents on `α_i = performance(a_i)` — a measured
benchmark number — times a novelty bonus on children count, and states the property this loop
breaks outright: "All agents retain a non-zero selection probability, ensuring that any path to
improvement remains feasible given sufficient compute." Our `spent` set (`selection.py:107`)
drives a component's probability to exactly zero after three recorded failures, and those
failures can be recorded for reasons that have nothing to do with the component.

So the contribution is not "we found a bug". It is:

> A self-improving agent that can edit its own evaluation **must** have gates. The moment it has
> gates, it has a channel through which its safety machinery can corrupt its credit model — and
> that channel does not exist in any of the systems the field has published, because none of them
> gate. Gate outcomes therefore have to be typed by what they are evidence about, and a veto that
> is not about the change is a missing observation rather than a negative one. Otherwise the
> safety machinery closes the search, silently, and reports the closure as a fact about the
> components.

Two independent errors closed this loop, and either alone would have been survivable: gate
outcomes conflated into `p_fix`, and a retirement rule that reaches exactly zero probability
rather than a floor.

**Sources opened.**
- https://arxiv.org/abs/2006.14171 and https://arxiv.org/html/2006.14171v3 — Huang & Ontañón,
  invalid action masking vs. invalid action penalty; penalty "does not scale" as the invalid space
  grows; masking finds the first reward in 0.05–0.08% of timesteps regardless of map size.
- https://arxiv.org/abs/1708.08611 — Alshiekh et al., Safe RL via Shielding; the general shape of
  an external veto layer wrapped around a learner, either before or after the decision.
- https://arxiv.org/html/2505.22954v3 §C.2 — DGM parent selection: proportional to measured
  performance and inverse children count, with every agent keeping non-zero selection probability.
- https://arxiv.org/abs/2408.08435, https://arxiv.org/abs/2504.15228, https://arxiv.org/abs/2310.02304
  — ADAS, SICA, STOP: checked for any statement about how a *rejected* modification updates the
  search. None of the three abstracts or the DGM related-work summary of them describes a veto
  layer distinct from the benchmark score.

Bar check: 1 ✓  2 ✓ (closest prior work named, one level down in RL; absent in this literature,
and the reason it is absent is the argument)  3 ✓  4 ✓ (prediction written in iteration 2)
5 ✗ not yet  6 ✓ provisionally — anyone building a gated self-improvement loop has this latent
and would not have thought to look for it.

Number: none yet. Criterion 5 is the whole remaining job.

Next iteration should: implement. Three parts, smallest first — (a) re-derive
`race_and_replay_cap_usd` for the Anthropic rail from the measured $3.28–$4.08 per generation,
(b) type every gate by what it is evidence about and let only change-evidence gates reach
`_record_p_fix`, (c) replace the `spent` hard-zero with a floor so no component is ever
permanently unreachable, per DGM §C.2. Then re-run and check the prediction from iteration 2.

---

## Iteration 4 — ADVANCE — candidate A, design → implement → measured on recorded data

Stage reached: implement done, first measurement in. A live season is running for the second.

**Implemented.** Four changes, all small.

- `gates.py`: every `Gate` carries `about ∈ {CHANGE, RUN, COMPARISON}`. cost_cap and rl_entropy
  judge the run; comparable_ab and correlation judge whether the A/B was a valid experiment;
  the other six judge the change.
- `gates.measured(gates)`: whether this generation produced an observation about the component
  at all. False only when a COMPARISON gate failed.
- `controller.py:455`: `_record_p_fix` now takes the measured outcome (`d_sealed_cand > 0`) when
  the comparison was valid, and records **nothing** when it was not. Previously every
  non-promotion recorded a failed fix.
- `gates.stuck(history)`: a non-change gate that has failed three generations running is reported
  as a misconfigured harness in the report notes, not absorbed.
- `REGS.md`: `race_and_replay_cap_usd` 3.00 → 6.00, with the derivation and a note that it is
  rail-dependent and must be re-derived whenever the rail changes.

**Reverted deliberately.** I also floored `p_fix` so a component could never reach exactly zero
selection probability, per DGM §C.2. It broke `test_every_role_spent_means_no_upgrade`, which is a
deliberate test, and on reflection it is a *second* finding smuggled into the first: with `p_fix`
now fed by measurements, a measured zero is real evidence and retiring on it is defensible. That
retirement is still permanent, which does violate DGM's guarantee. Logged as candidate B, not
opened — it needs its own measurement and would confound this one.

**Measurement 1 — the recorded season, scored under both rules.** Facts about the same
observations, computed from `state/season-before-fix.json`:

```
spend per generation            $3.28 – $4.07   (6 generations with a gate bundle)
cost_cap passed, old cap $3.00        0 / 6     structurally impossible, not bad luck
cost_cap passed, new cap $6.00        6 / 6
promotions as actually run                0
pass the whole bundle as recorded      5 / 6
p_fix(AERO)   from the decision        0.00  →  from the measurement   1.00  (2/2)
p_fix(DATA)   from the decision        0.00  →  from the measurement   0.67  (2/3)
retired       from the decision   AERO, DATA  →  from the measurement   none
```

The prediction written in iteration 2 was that gen 3 and gen 4 must promote and `p_fix(DATA)`
must exceed zero. Both hold: gen 3 (dS +6.811) and gen 4 (dS +7.119) fail nothing but cost_cap,
and DATA lands at 0.67.

**What this measurement is not.** Only generation 0 is non-counterfactual — promoting there
changes the champion every later generation would have run against, so "5 of 6" means those six
gate bundles as recorded, not a trajectory. The cost_cap arithmetic and the p_fix arithmetic are
facts about the recorded observations under either rule.

Configuration: the season in `state/season-before-fix.json` — Anthropic driver, `SCRUTINEER_TASKS=web`,
6 workers, 7 generations, 10 quali / 10 sealed items.

Smallest detectable effect for measurement 2: the old configuration promoted 0 of 7, so by the
rule of three its promotion rate is under about 0.35 at 95%. A fresh season of **3 generations**
producing 2 or more promotions is inconsistent with that. Three generations is therefore the
smallest configuration that can detect the effect, and is what is running — roughly $12 on the
Anthropic rail at the measured $4/generation.

Tests: 8 added in `tests/test_gate_evidence.py`, including one that asserts the cap is above the
measured per-generation spend, so this specific misconfiguration cannot return silently. 54 green.
Site builds. Committed as 13d2b84.

Bar check: 1 ✓  2 ✓  3 ✓  4 ✓  5 partial — real numbers off a real run, but the live confirmation
is still in flight  6 ✓ provisionally.

Next iteration should: collect the live season from
`scratchpad/season.log` and `state/season.json`. If it promotes ≥ 2 of 3, criterion 5 is met and
the candidate is landed — then write the ninety-second stage demo. If it promotes 0, the
diagnosis is incomplete and something else is also blocking; find it before claiming anything.

---

## Iteration 5 — ADVANCE — candidate A, measured on live rails. Criterion 5 met. Bar cleared.

Stage reached: measure. A fresh 3-generation season on the Anthropic rail, run with the fix in
place, seed and task layer unchanged.

```
gen 0  AERO  gain_per_usd   dQ +6.58  dS +8.22   $4.699 of $6.00   0 gate failures   PROMOTED R-v1
gen 1  —     no_upgrade     dQ +2.20  dS +2.59   $2.732            0 gate failures   nobody cleared
                                                                                     the evidence bar
gen 2  DATA  gain_per_usd   dQ +3.86  dS +3.84   $4.995 of $6.00   0 gate failures   PROMOTED H-v0

official score  85.126 → 74.319 after generation 0's promotion: −10.807 s on the held-out set
total cost      $12.43 across three generations
```

**Configuration.** Anthropic driver, `SCRUTINEER_TASKS=web`, 6 workers, 10 quali / 10 sealed items,
`--generations 3`, no `--export` so the shipped seeded bundle was untouched. Prior season preserved
at `state/season-before-fix.json`.

**Not one gate failed in three generations**, against 6 of 6 generations failing `cost_cap` before.
Generation 1 refusing is the loop working: no role reached `n ≥ 5` with a positive lower bound, so
it changed nothing and ran the matched-budget ghost instead.

**A correction to iteration 4.** I wrote that 2-or-more promotions in 3 generations would be
"inconsistent with" the old rate "at 95%". That was overstated and I should not have written it
before doing the arithmetic. Fisher's exact test on 0/7 against 2/3, one-sided, gives **p = 0.067**.
Suggestive, not significant at 0.05. Three more generations would settle it, and cost about $12.

That correction does not weaken the finding, because the promotion count was never the primary
evidence. The primary evidence is arithmetic on the recorded run and it does not involve sampling:

- `cost_cap` passed 0 of 6 because the cap was $3.00 and the *minimum* measured spend was $3.28.
  A cap below the minimum possible cost cannot pass. That is not a rate, it is a fact.
- Scoring the same recorded `d_sealed` values under the two rules gives `p_fix(AERO)` 0.00 → 1.00
  and `p_fix(DATA)` 0.00 → 0.67, and moves both components from retired to not retired. Also not a
  rate — the same observations, arithmetic two ways.

The live season is the existence proof that the loop promotes at all once the credit model is fed
correctly. It is confirmation, not the load-bearing number.

**Bar check — final.**

1. Mechanism ✓ — gate typing, the credit-recording rule, the stuck-gate detector, the cap.
2. Not already done ✓ — closest prior work is Huang & Ontañón on invalid-action penalty versus
   masking, one level down in policy gradients; and DGM §C.2's non-zero-probability guarantee.
   Absent from the self-improvement literature, and the reason it is absent is the argument: none
   of those systems has a veto layer distinct from the score, so none of them can have this bug.
3. Runs here ✓ — landed, 54 tests green, site builds.
4. Falsifiable ✓ — the prediction was written in iteration 2 before any code and survived.
5. Measured ✓ — recorded-run arithmetic plus a live 3-generation season.
6. "I hadn't seen that" ✓ — anyone who has put gates in front of a self-improving agent and feeds
   rejections back into what to try next has this latent, and would not have thought to look.

**Honest limits.** One loop, one task family, two runs. The generalisable claim is the principle;
the evidence is arithmetic plus an existence proof. p = 0.067 on the promotion-rate comparison.

**The ninety seconds on stage.**

> Show `state/season-before-fix.json`. Seven generations. Zero accepted. Read the loop's own
> conclusion out loud: *"AERO, DATA have failed every attempt so far."*
>
> Then the two lines it is talking about — generation 3, held-out score better by 6.8 seconds;
> generation 4, better by 7.1. The two biggest wins of the season. Both recorded as evidence that
> the component cannot fix anything.
>
> Why: the budget cap was $3.00, set for an inference provider we no longer use. A generation costs
> $3.28 to $4.07. The cap could never pass. And every refusal, whatever its reason, was recorded as
> "this component's fix did not work."
>
> The fix is one idea. A gate is evidence about the change, or about the run, or about whether the
> experiment was valid — and only the first tells you anything about the component. This is the
> invalid-action penalty problem from policy gradients, one level up: penalise an agent for
> refusals it did not cause and it never finds the first reward. The Darwin Gödel Machine cannot
> hit this because it has no veto layer separate from the score. The moment you add gates — and you
> must, if the agent can edit its own evaluation — you create a channel where the safety machinery
> eats the credit model.
>
> Same loop, fix in, three generations: two promotions, zero gate failures, held-out score down
> 10.8 seconds. And it still refuses generation 1, because nobody cleared the evidence bar.

Sources opened this iteration: none — this was a run.

Next iteration should: **stop.** The bar is cleared and the result is committed. Candidate B is
written up below but not opened; leads 2, 3, 4, 5 and 6 are untouched and the honest thing is to
hand the choice back rather than start another expensive thread unasked.

**Candidate B, open for whoever runs this next.** Retirement here is permanent: `selection.py:107`
strikes a component off for good on a measured zero. DGM §C.2 guarantees the opposite — "All agents
retain a non-zero selection probability, ensuring that any path to improvement remains feasible
given sufficient compute." Now that `p_fix` is fed by measurements a zero is real evidence, so
this is defensible rather than broken, but it is still a permanent closure. Time-limiting it needs
its own measurement and would have confounded this one. `test_every_role_spent_means_no_upgrade`
encodes the current behaviour and would have to change.

---

## Iteration 6 — OPEN — candidate C: the harness is one thing, and it should not be

Stage reached: research → design. This is the "generational harness idea" pass, not a bug hunt.

**The limit, stated plainly.** There is exactly one champion harness. Every gate compares a
candidate against it on the *average* over the whole task pool, and the seesaw gate demands
`Δquali ≥ 0 ∧ Δsealed ≥ 0`. So a change that is a large win on `dialog` and a small loss on
`invoices` is rejected — correctly, under the rule, and wrongly, in fact. The loop can only ever
find the harness that is best *on average*, and it has no way to notice that the average is hiding
two different populations.

That is not a tuning problem. It is the shape of the search space: `h ∈ H`, one `h`.

**The idea.** Let the harness be a *partition* rather than a point:

```
h : family → H          instead of        h ∈ H
```

and — the part that matters — **do not specify the partition. Derive it from the credit ledger.**

The loop already records, for every confirmed incident, which component was causally responsible
and which task it happened on. Every task carries a family. So the ledger is already a
component × family matrix of measured blame, and nobody has looked at it that way. If
`RETRIEVAL`'s blame concentrates in one set of families and `VERIFICATION`'s in another, a single
harness is being forced to compromise between two populations, and the ledger says so in numbers
the loop already paid for.

The mechanism, in four steps:

1. **Detect.** Build the blame matrix `B[r][f]` from confirmed incidents. Test whether it is
   separable — whether there is a partition of families under which components' blame is
   concentrated rather than spread. Nothing here is a model call; it is the ledger, grouped.
2. **Propose a split**, with the same evidence bar the component selection uses: a partition is
   only proposed when the concentration clears a bootstrap interval.
3. **Specialise.** The champion forks. Each side owns its own copy of the contested component and
   is optimised against its own partition only.
4. **Gate per partition.** Seesaw, regression and the held-out split all run *within* a partition.
   A specialist cannot pass by being average; it has to beat the generalist on its own tasks, and
   the generalist is kept as the fallback for anything the router is unsure about.

**Why it is a leap rather than a feature.** Every step the loop takes today is "change one
component". This adds a second, qualitatively different move: "change the *shape of the harness*" —
and it is proposed by evidence the loop already collects, not by a human deciding that dialogs are
different from tables. The headline is a sentence no other system here can say: **the loop worked
out that it needed two harnesses, and found the boundary itself.**

**Closest prior work, opened this session.**
- https://arxiv.org/abs/2507.19457 — GEPA. Keeps a **Pareto frontier** of candidates precisely
  because a single scalar best "collapses complementary lessons", and reflects in natural language
  to combine them. This is the nearest thing in spirit and the honest comparison: GEPA keeps
  diversity *inside the search* and returns a system; this keeps diversity *in the deployed
  artefact*, with the boundary derived from causal credit rather than from Pareto dominance on
  scores.
- https://arxiv.org/html/2505.22954v3 §C.2 — DGM keeps an archive of agents with non-zero
  selection probability. Again diversity in the search; one agent is evaluated at a time.
- https://arxiv.org/abs/2408.08435 — ADAS searches the space of agent designs and outputs designs.
- arXiv full-text search for self-improving agent scaffolds with specialization or per-cluster
  routing returned nothing on point (nearest: "Drop the Hierarchy and Roles: How Self-Organizing
  LLM Agents Outperform Designed Structures", which is about multi-agent structure, not about a
  harness partitioned by measured credit).

I could not complete the novelty sweep I wanted: the arXiv API rate-limited me (HTTP 429) and
Google served a bot check, which I did not attempt to work around. The claim above is therefore
"nothing found on point in the sources I could open", not "this does not exist".

**Falsifiable, written before any code.** The blame matrix from a real season is *separable*: there
exists a partition of task families under which the top component's share of blame differs by more
than a bootstrap 90 % interval across sides. If the matrix turns out to be flat — every component's
blame spread evenly across families — then the population really is homogeneous, splitting buys
nothing, and this candidate dies on its own evidence. That negative would be worth knowing and
worth showing.

Bar check: 1 ✓ mechanism, and a new *kind* of move  2 ✓ with the caveat above stated  3 — the
detector is cheap and runs on data already on disk; the full fork-and-route is not a tonight job
4 ✓  5 ✗ not yet  6 ✓ — "it discovered it needed two harnesses" is a sentence a builder has not
heard.

Next iteration should: implement step 1 only — the detector — against the real seasons in
`state/`, because it is the step that either kills the idea or makes it undeniable, and it needs
no model calls. Report the blame matrix and whether it separates. Do not build the fork until the
matrix says there is something to fork along.

---

## Iteration 7 — ADVANCE — candidate C, measured. The split pays.

Stage reached: measure. §08's claim was about where failures *are*. This is the claim that one
harness is a compromise, and it is now measured rather than argued.

**Method.** Both harnesses the loop actually produced — the one it starts with and the one it ended
up with — raced over each side of the discovered partition separately. Same items, same seed, same
budget, nothing different but the harness. `scrutineer sides --per-family 1`.

```
AERO side   dashboard, dialog, gallery, pricing, search, settings, tabs   n=7
            before 79.772 s   after 63.030 s   gain +16.742 s   21.0 % of its own
DATA side   checkout, invoices, signup, stepper                           n=4
            before 73.119 s   after 64.381 s   gain  +8.738 s   11.9 % of its own
            spread 8.005 s absolute, 9.0 points relative        LOPSIDED
```

The upgrades are worth nearly twice as much on one side as the other, and every gate that let them
through scored them on the mean of the two.

**The obvious objection, and what happened to it.** The sides do not start level — 79.8 s against
73.1 s — so part of the absolute spread is headroom rather than specialisation. As a share of each
side's own starting time it is 21.0 % against 11.9 %, a ratio of 1.75, so the effect survives
normalisation. That check was worth running: if it had not survived, the honest reading would have
been "one side simply had more to fix".

**A run I threw away.** The first attempt passed `cap_usd=99.0` to take the budget out of the
comparison. That was wrong twice: the cap is what makes the stop policy a real decision, so every
lap ran to its step limit, and the cap is a *term in U*, so removing it flattens the objective the
laps are scored by. It ran 26 minutes without finishing and I killed it. The rerun uses the same
per-race budget the real season uses, scaled to the item count.

**Limits, all of them on the page.** n of 7 and 4. One race per cell, one seed, so there is no
interval on these numbers. It is not a season run per side, and it does not show the specialists
the loop *would* find — only that the gain from the changes it already made is uneven, which is
what makes the average misleading.

Bar check: 1 ✓  2 ✓  3 ✓  4 ✓ the prediction was written in iteration 6  5 ✓  6 ✓

Surfaced as SPEC §09, rendered from `state/sides.json`.

---

## Iteration 8 — ADVANCE — candidate B landed: retirement expires

Candidate B from iteration 5 was that striking a component off is permanent, which breaks the
property DGM states outright — "All agents retain a non-zero selection probability, ensuring that
any path to improvement remains feasible given sufficient compute" (arXiv:2505.22954 C.2).

Retirement is a cooling-off period now, `retire_generations: 3` in REGS. The reasoning is that the
evidence that retires a component is a fact about the past: the harness it would be changing three
generations later is not the harness it failed on. `last_attempt` is threaded from the controller;
with no history passed the old behaviour is preserved exactly, so the existing test still holds.

One test added covering both halves — ranked out immediately after failing, eligible again once
the window passes. 63 green.

Next iteration should: the honest next step is a season run per side, which would show the
specialists rather than inferring them. That is roughly $25 and two hours and is the first thing
to do with more time. Nothing else is open.

---

## Iteration 9 — OPEN — candidate D: a benchmark this project did not write

Every number so far came from a task pool built in this repo, which is the obvious objection to
all of them: an optimiser that sets its own exam. HumanEval is public, third-party and graded by
execution against hidden unit tests, so it does not survive that objection.

**What "surpass the benchmark" can honestly mean here.** Not "beat the leaderboard": published
numbers are per-model, and beating one with a different model measures the model, not the loop.
The defensible claim holds the model fixed and compares harnesses on problems this project did not
write, scored by tests it did not write.

**The trap, and how it is closed.** HumanEval ships one test set, so a harness whose pre-submit
check runs those tests scores perfectly and measures nothing. The agent is handed `prompt` — the
signature and docstring, examples included, which is what a person would get — and `test` is used
only to score. Three disjoint splits: practice (30), season-sealed (20), and a final held-out 30
the loop never sees in a race, a replay or a gate. Ten tests in `tests/test_bench.py` enforce it,
including one that spies on the probe's sandbox script and asserts the tests never appear in it.

**Two real bugs found on the way, both of which would have produced a confident wrong answer.**

1. `_extract_code` was the HTML extractor. It only matches an ```html fence, and on a miss it
   truncates from the first `<` — which in Python is a comparison operator. It was cutting every
   candidate in half. First smoke run: 0 of 3. After the fix: 2 of 3. Had I not looked at a
   submission I would have reported "the benchmark is beyond this harness".
2. `run_tools` was web-only: its `syntax` rung looks for `<html>`, and `render`/`audit` call the
   axe-core auditor. On a code item every candidate scored identically, so VERIFICATION — the
   loop's single largest win on web — was inert, and the two harnesses tied at 0.67 on the smoke
   for a reason that had nothing to do with either. It never touched the held-out tests, so there
   was no contamination, only a dead component. There is now an honest code ladder: parse and
   define the entry point, import cleanly, then run the worked examples the docstring itself
   carries. That last rung is the exact analogue of opening the page and running axe-core: check
   against what you were shown, before submitting to what you were not.
   A third bug inside that fix: handing doctest the raw prompt swallows the closing `"""` into the
   last example's expected output, so correct code failed its own final example. Parse the
   docstring, not the prompt. Both are regression-tested.

Bar check: 1 ✓ 2 — HumanEval is prior art by definition; the novelty is not the benchmark
3 ✓ 4 ✓ the prediction is that the loop-optimised harness beats the baseline on the final 30
5 in flight 6 —

Next: the transfer run (web-optimised harness vs baseline on the benchmark) is running; it says
whether gains found on web carry to code, which is interesting either way but is not the headline.
The headline needs a season run **on** the benchmark's practice split, then one measurement on the
final held-out 30.

---

## Iteration 10 — MEASURED — candidate D: a clean null, and a benchmark that cannot answer the question

**Transfer, base HumanEval, 30 held-out problems.** starting 86.7 % (26/30), upgraded 90.0 %
(27/30). One problem flipped. At n=30 one problem is 3.3 points, so that is noise, and it was not
reported as anything else.

It also exposed the real problem: only 4 of 30 failed under the baseline. So the held-out set was
widened to 114 and the scorer de-saturated — EvalPlus's ~1000 extra inputs per problem, scored by
differential testing against the reference (capped at 200 inputs, therefore **not** official
HumanEval+ pass@1 and never quoted as such). The scorer was validated the only way that counts:
**all 164 canonical solutions pass it, zero failures.**

**The result, 114 held-out problems, model held fixed, extended scorer:**

```
starting   94.7 %   108/114   $0.53
upgraded   94.7 %   108/114   $4.33      8.2x the cost
delta      +0.0 points    fixed 2    broken 2    McNemar p = 1.0
```

Two fixed, two broken, perfectly symmetric. **The harness the loop found on web accessibility does
not transfer to code.** That is a real finding and it is not a disappointing one: the loop's gains
were things like "open the page in a browser and run the auditor" and "retrieve accessibility
references", and there is no reason those should help write a Python function. It is evidence the
loop optimises a harness *for a workload* rather than discovering universal agent wisdom, which is
the honest description of what it does.

**And HumanEval cannot answer the question that was actually asked.** The baseline fails 6 of 114.
Headroom is 5.3 points. A perfect harness could gain five points, and with six failures no
harness difference can reach significance. Running a season on it would spend hours and dollars
measuring noise. There is no number there to surpass.

**What has headroom.** BigCodeBench-Hard — top models sit around 30 %, so there is 70 points of
room. Its parquet is reachable. The blocker is the environment: pandas, sklearn, scipy,
matplotlib, bs4, django and flask are all missing, and BCB's premise is diverse library calls, so
a large share of its tasks would fail on import for both harnesses and contaminate the comparison.
Making it honest means installing those, writing the adapter, and validating the scorer against
the canonical solutions the way HumanEval's was — two to three hours, at 02:00, against a 13:00
submission, with a working deployed entry already in hand.

Bar check: 1 ✓ 2 ✓ 3 ✓ 4 ✓ the prediction was written before the run and **failed** 5 ✓ 6 —

Next: not another HumanEval run. Either BCB-Hard with its dependencies installed, or present the
null, which is a stronger thing to show than most positive results at a hackathon.

---

## Iteration 11 — MEASURED — candidate D on BigCodeBench-Hard. The loop made it worse.

**The headline, stated the way it actually came out.**

```
benchmark   BigCodeBench-Hard, 76 held-out tasks the loop never saw
baseline    starting harness   32.9 %   25/76   $0.84
loop        champion R-v2      26.3 %   20/76   $0.91
delta       −6.6 points
discordant  champion solved 4 the baseline missed; lost 9 it had
McNemar     p = 0.267, two-sided
```

**We did not surpass the benchmark. The loop's change regressed it.** Not significantly — p = 0.267
means the honest statement is "no significant difference, and the point estimate favours the
baseline" — but the direction is not in our favour and nothing here should be written up as a win.

**What the loop changed.** One promotion in five generations: AERO R-v2, touching two files,
`retrieval: keyword → concept-match` and references 2 → 9. Rediscovered independently on this
workload rather than carried over from web, which was the interesting part right up until it
failed to generalise.

**The finding that matters, and it is about our own machinery.** That change passed everything the
loop had. Δquali +0.79, Δsealed +0.33, zero gate failures, a 90 % lower bound of 27.8 on n = 33
confirmed incidents. Then it lost 6.6 points on tasks it had not seen. **The loop overfit its own
held-out split.** Twenty-four sealed items were enough to clear the seesaw gate and not enough to
predict generalisation. Every gate did its job and the change still should not have been kept.

That is worth more than the win we were chasing: it is a measured demonstration that a sealed
split sized for one workload does not transfer, and that a loop can satisfy its own evidence bar
and still be wrong. The bar is necessary and it is not sufficient.

**Three bugs found tonight, each of which would have produced a confident wrong answer.**

1. *The replay budget was a pot divided by the work.* `per_lap_cap = replay_budget / (failures×2)`,
   so raising practice items 10 → 24 cut each investigation from $0.144 to $0.060 and confirmed
   incidents fell from n=3 to n=2. 45 replays attempted, 3 confirmed, while the generation spent
   $1.24 of a $6.00 cap. More evidence available meant less budget to examine any of it, and the
   loop reads a starved budget as an absence of evidence and refuses. `replay_floor_usd: 0.15`
   took AERO from n=2 to **n=33** with nothing else changed. `min_incidents` stayed at 5
   throughout — the fix was to raise the evidence, never to lower the bar.
2. *`champion_harness` built a Theta by hand*, copying the files but leaving the parsed YAML
   fields empty, so the retrieval policy would have been blank. It would have run cleanly and
   reported a broken harness as the champion. Now goes through `Theta.load`, with an assertion
   that the champion is not byte-identical to the base.
3. *The comparison printed the regression as a gain.* `compare` takes (baseline, loop) and the CLI
   handed it the champion first, so the console read `delta +6.6 points` for a 6.6-point
   regression. Caught only by reading the JSON. Two tests now pin the direction; a measurement
   tool whose sign depends on argument order is the most dangerous kind.

Bar check: 1 ✓ 2 ✓ 3 ✓ 4 ✓ the prediction was written in advance and **failed** 5 ✓ 6 ✓ — the
overfitting result is the one a builder would not have expected.

Next: not another season chasing a positive. The honest next experiment is whether a larger sealed
split closes the generalisation gap — which is a question about the loop, measurable, and the
thing this run actually surfaced.
