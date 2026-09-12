# pattern-0931 — AERO — 1.4-loss-of-history

role: AERO
mast_mode: 1.4-loss-of-history
generation: 9
evidence:
  - scrutineer:///replay-aero-w01-patch-replay@506b45897f8e2187
  - scrutineer:///replay-aero-w10-patch-replay@fef18e2f46fb939d
  - scrutineer:///replay-aero-w12-patch-replay@5ce2ef41df4f3f95
  - scrutineer:///replay-aero-w15-patch-replay@77059f37a6b09b26
  - scrutineer:///replay-aero-w27-patch-replay@7de49c92a96f8a2c
  - scrutineer:///replay-aero-w31-patch-replay@effd146c6f5e79d1

## Lesson

19 lap(s) this generation failed with 1.4-loss-of-history. Correcting AERO alone flipped them, so the cause is the artifact, not the driver.

## Shape

When `{item}` needs `{concept}` and AERO produced `{observed}`, the lap lost `{delta_s}`s. Correcting AERO alone flipped it.
