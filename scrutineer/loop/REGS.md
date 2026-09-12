# REGS.md — the frozen contract

Owned by the TEAM PRINCIPAL (human). Read-only to every agent in the loop. The loop may not
propose a change to this file; a change here is a regulation change and is made between seasons.

```yaml
season:
  max_generations: 12
  mode: attended                 # attended | unattended
  seed: 1994

circuit:
  quali_items: 24                # the specs the agent practises on. WORKLOAD-DEPENDENT.
                                 # 10 was enough on the web task, where a 20-lap race produced
                                 # plenty of confirmed incidents. On BigCodeBench-Hard a 10-lap
                                 # race convicted AERO with n=3 and a positive CI lower bound —
                                 # real credit, one short of the bar — and the loop correctly
                                 # refused five generations running. The fix is to raise the
                                 # evidence, never to lower `min_incidents`: moving the bar to
                                 # meet the data is how an optimiser starts agreeing with itself.
  sealed_items: 20               # held-out specs, never shown to the improver
  reserve_items: 70              # the SIMULATOR's pool for later circuits
  band: [0.30, 0.80]             # Agent0 frontier band for generated circuits
  band_samples: 6

lap:
  max_steps: 12                  # REGS step cap per lap
  wall_cap_s: 300
  timeout_penalty: 0.5           # tau applied to U on timeout

objective:                       # U = w_pass*pass + w_cost*(1-cost/cap) + w_wall*(1-wall/cap)
  w_pass: 0.5
  w_cost: 0.25
  w_wall: 0.25
  lap_base_s: 60.0               # lap_s = lap_base_s + lap_span_s * (1 - U)
  lap_span_s: 40.0

cost:
  race_and_replay_cap_usd: 6.00  # per generation; upgrade cost is charged to the role.
                                 # RAIL-DEPENDENT. 3.00 was derived for the W&B Inference rail
                                 # (driver $0.05/$0.22 per 1M). The driver is Anthropic now and a
                                 # generation measurably costs $3.28-$4.08, so the old cap could
                                 # never pass: it vetoed seven generations in a row, including
                                 # the two largest held-out gains of the season. Re-derived from
                                 # that measured range with headroom for a heavier replay load,
                                 # while still refusing a generation that is genuinely out of
                                 # control. Re-derive this whenever the rail changes.
  lambda_usd_per_hour: 0.50      # lambda in gain-per-dollar
  atr_most_blamed: 0.70          # ATR sliding scale on the replay budget
  replay_floor_usd: 0.15         # the least a single counterfactual replay may be given.
                                 # The replay budget is a pot divided by the failures being
                                 # investigated, so a generation with more failures gave each one
                                 # less: at 10 practice items each replay had $0.144 and AERO
                                 # reached n=3; at 24 items each had $0.060 and it reached n=2.
                                 # Raising the sample starved the evidence it was raised to
                                 # collect. An allowance per investigation is not the same thing
                                 # as a pot split between them, and this is the floor that makes
                                 # it one.
  atr_others: 1.15
  race_shares: {quali: 0.34, sealed: 0.16, smoke: 0.02, replay: 0.48}

credit:
  incident_threshold_s: 0.5      # credit_r > 0.5 s counts as a confirmed incident
  min_incidents: 5               # n_r >= 5 before any upgrade
  retire_generations: 3          # how long a component whose every measured attempt failed is
                                 # ranked out before it is eligible again. Not permanent: the
                                 # harness it would be changing is no longer the harness it
                                 # failed on, and a permanent strike-off closed the search for
                                 # good (see arXiv:2505.22954 C.2).
  ci: 0.90                       # bootstrap CI level; CI90_lo(blame_r) > 0 required
  replay_seeds: 2
  ablate_top_k: 2                # top-2 roles when confidence is low or ablation is requested
  router_confidence_floor: 0.90  # below this, always ablate. High, deliberately: with a
                                 # low floor only the top-blamed role is ever replayed, so
                                 # only it accumulates incidents, so only it ever clears the
                                 # evidence bar. The second name on the list has to be able
                                 # to earn or fail to earn its own credit.
  p_fix_prior: 0.5               # labelled "prior" until 3 outcomes exist

gates:
  seesaw: "d_quali >= 0 and d_sealed >= 0 and max(d_quali, d_sealed) > 0"
  correlation_dead_band_s: 0.30
  black_flag_confidence: 0.80
  refer_band: [0.50, 0.80]
  min_diff_lines: 3
  novelty_cosine: 0.95
  generalisation_gap: 0.25       # quali_pass - sealed_pass above this triggers a circuit generation
  zero_variance_groups: 0.40
  entropy_collapse_ratio: 0.50   # RL candidate ineligible below 50 % of step-0 entropy
  kl_ratio: 3.0                  # only meaningful when kl_penalty_coef > 0
  ladder_margin_z: 1.0           # Ladder margin in units of the sealed split's own standard
                                 # error. A candidate has to beat the standing best by more than
                                 # one SE before its sealed score is reported at all, so a
                                 # generation cannot climb the split's noise. At z=1 and 20 sealed
                                 # items the margin is ~4.5 s, which is about what one item is
                                 # worth: the loop must win an item, not a rounding difference.
                                 # Blum & Hardt's Ladder; Dwork et al. arXiv:1411.2664.
  sealed_query_budget: 12        # how many times a season may query the sealed split before its
                                 # answers stop being reported. Adaptive reuse costs sample
                                 # complexity linear in the number of queries, so this is the
                                 # budget that keeps the split honest rather than nominal.

# Per-role cost table. Upgrade cost is charged to cost_r and sits outside the race cap.
roles:
  AERO:       {prefix: R, cost_usd: 0.30, hours: 0.25}
  STRATEGIST: {prefix: S, cost_usd: 0.03, hours: 0.03}
  POWER_UNIT: {prefix: W, cost_usd: 1.00, hours: 2.00}
  TYRES:      {prefix: S, cost_usd: 0.05, hours: 0.08}
  DATA:       {prefix: H, cost_usd: 0.30, hours: 0.25}
  SIMULATOR:  {prefix: C, cost_usd: 0.35, hours: 0.17}
  ENGINEER:   {prefix: P, cost_usd: 0.40, hours: 0.33}
  SCRUTINEER: {prefix: S, cost_usd: 0.10, hours: 0.17}
  HISTORIAN:  {prefix: P, cost_usd: 0.20, hours: 0.25}
  PIT_CREW:   {prefix: H, cost_usd: 0.05, hours: 0.17}

phase_b:                          # every third accepted generation
  every: 3
  engineer_fix_precision: 0.40
  engineer_regression_precision: 0.20
  router_precision: 0.50
  historian_first_pass: 0.60
  historian_page_utility: 0.30
  pitcrew_sandbox_fail: 0.20

anti_distillation: true           # typed-decision outputs are labels, never SFT/RL targets
independent_grader: true          # official scorer is execution; auditors are a different family
```

## Write set

The improver may write only `skills/{r*}/` and `harness/{r*}.py` for the selected role. Never in any
writable set: `REGS.md`, the evaluator, sealed data, `lineage/`, `scrutineer/`, `router/`.

## Isolation actually in force

The sealed circuit is held by `SealedEvaluator`, which returns only the aggregate `official:gen-n`
object — race time, opaque per-item booleans, cost — and never an item, a prompt or a candidate.
The design calls for that evaluator to hold a service-account key for a second W&B team; where
only one team exists, this file records that the split is enforced in process rather than by
membership, and the honesty panel prints it.

## Sign convention

`predicted_delta_s`, `credit_r`, `d_quali`, `d_sealed` are **seconds gained, positive = faster**.
