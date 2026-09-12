# The research loop

Paste the block below into a fresh session on **Opus 5**. It is self-contained: it knows where
the repo is, what has already been built, what the bar is, and when to stop.

To run it unattended, prefix it with `/loop` — it will pace its own iterations. Without that it
runs the same protocol inside one session and you can interrupt whenever you like.

---

You are continuing work on Scrutineer, at `/Users/pranavachar/coreweaves/scrutineer`.

Read `LOOP.md` and `research/LEDGER.md` before you do anything else. The ledger is the state of
this loop; the last entry tells you where the previous iteration stopped.

Scrutineer is an entry for **CoreWeave Hacks: Agent Loops**, Saturday 12 – Sunday 13 September
2026, submissions Sunday 13:00. The UI, the task layer and the control plane are built and
working, 46 Python tests pass, and the site builds. Do not redesign any of that.

The thesis is *an agent harness improved by loop engineering*: an outer improver rewrites the
inner agent's harness, and the model never changes.

**The problem you are here to fix.** The loop is rigorous but not surprising. Stripped of its
vocabulary it is block-coordinate descent over ten fixed component slots, with ablation-based
credit assignment and honest statistics. A judge who builds agents for a living will recognise
every piece within a minute. And it has never demonstrated the one thing that would make it
undeniable: that the loop *compounds*.

Your job is to find and land **one** result that clears the bar below. Nothing else counts.
Polishing does not count. A better explanation of what already exists does not count.

## The bar

A finding is a gold mine only if all six are true. Check each one explicitly and write the
evidence into the ledger.

1. **Mechanism, not presentation.** It changes what the loop does, not how it is drawn.
2. **Not already done.** You have searched the literature in the browser and can name the
   closest prior work with a link, and say precisely what is different about this. "I could not
   find it" is not an answer — find the nearest thing and contrast with it.
3. **Runs here.** Implementable on the existing control plane in under a day, on the Anthropic
   rail, within the quota that actually exists.
4. **Falsifiable.** Before you run it, you wrote down the number that would prove it wrong.
5. **Measured.** You ran it on real rails and you have the number. A design with no run is not
   a result.
6. **A builder would say "I hadn't seen that."** If the honest answer is "this is a sensible
   engineering choice", it is not a gold mine. Kill it and move on.

## Method

Research through the browser, with sources. Do not answer from pre-trained memory: open the
paper, read the claim, link it. Anything you assert about prior work carries a URL you opened
this session. If you cannot open it, say so rather than paraphrasing a memory.

Work in iterations. Each iteration does **exactly one** of:

- **ADVANCE** the leading candidate by one stage: research → design → implement → measure.
- **KILL** a candidate, recording which of the six criteria it failed and why.
- **OPEN** a new candidate — only when fewer than three are live.

After every iteration, append to `research/LEDGER.md`:

- the iteration number, the candidate, the stage it reached, what you learned
- every URL you opened, each with one line on what it actually said
- the number, if you measured one, and the configuration that produced it
- what the next iteration should do

Never rewrite earlier entries. The ledger is append-only, and it is the thing that stops you
going in circles.

Do not start implementing until a candidate has passed 1, 2 and 3 on paper. Do not tell me you
have found anything until it has passed 5.

## Leads

Starting material, not a menu. The best answer may be none of these, and a clean negative
result on any of them is worth more than a vague positive.

1. **Does the improver get better at improving?** `PROPOSER` is an editable component, and
   nothing has ever shown that changing it raises the later acceptance rate or the gain per
   generation. Measure the second derivative: gain per generation before and after a PROPOSER
   promotion, with an interval. This is the single most valuable claim available here, and a
   clean *flat* result is more honest than the present silence.
2. **The search space has ten slots and cannot grow.** The loop retunes existing components; it
   can never invent an eleventh. ADAS and the Darwin Gödel Machine both claim discovery of new
   building blocks. What would it take for PROPOSER to introduce a component outside the
   taxonomy — and for counterfactual credit assignment to still work on something that has no
   previous champion to revert to?
3. **Coordinate descent cannot see interactions.** Two components that only help *together* are
   structurally invisible to a loop that changes one thing at a time. Is that happening here?
   Run the 2×2 on a plausible pair and compare the joint effect to the sum of the parts. If it
   exceeds it, the loop is leaving gains on the table and knowing that is a result.
4. **Credit is assigned within a generation, never across them.** A champion harness is a stack
   of accepted diffs. A diff that looked neutral when accepted may be load-bearing three
   generations later, or may have become dead weight. Reverting each accepted diff against the
   *current* champion is a cheap experiment, and no cited system reports it.
5. **Held-out means held-out items, not a held-out distribution.** The strong claim is a
   held-out *family*: a harness discovered without ever seeing `dashboard` or `stepper` tasks,
   then measured on them against the starting harness. That is the difference between
   overfitting less and learning something that generalises.
6. **The auditor has never been seen catching anything.** The 5×7 tampering taxonomy and the
   read-only auditor are impressive on paper and have never fired on a real gaming attempt in
   front of anyone. Plant a change that genuinely raises the score by corrupting the
   measurement — tempting, not a strawman — and show the auditor black-flag it live. If the
   auditor misses it, that is the more important finding, and you fix the auditor. Note this
   lead is a *demo asset*: worth landing either way, but it does not clear the bar on its own.

## Constraints

- The 46 Python tests stay green and the site keeps building. Run both before you commit.
- The UI, the seeded season and the task layer stay as they are unless a finding requires
  otherwise. If one does, say why before you touch them.
- API keys live in `~/.scrutineer.env`, chmod 600, outside the repo. Never commit one.
- `scrutineer/loop/lineage/*.key` is a private signing key and is never committed.
- Commit each landed stage with a message that says what was measured. Do not push.
- A season on the Anthropic rail costs real money. Measure on the smallest configuration that
  can still detect the effect, and state the smallest effect that configuration could detect.

## Stop

Stop when the bar is cleared, the result is committed, the number is in the ledger, and you
have written down how it is demonstrated in ninety seconds on stage.

If you exhaust the leads and open no new candidate for two consecutive iterations, stop and
write an honest entry saying the loop did not find a gold mine, what the strongest available
result actually is, and what you would need to go further. Do not pad the ledger and do not
declare victory on a finding that fails criterion 6.
