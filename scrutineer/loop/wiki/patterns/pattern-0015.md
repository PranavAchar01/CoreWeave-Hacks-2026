# pattern-0015 — AERO — 1.5-unaware-of-stopping

role: AERO
mast_mode: 1.5-unaware-of-stopping
generation: 0
evidence:
  - scrutineer:///replay-aero-w01-patch-replay@71233cfc70e21e82
  - scrutineer:///replay-aero-w10-patch-replay@020dcc2037e72a8a
  - scrutineer:///replay-aero-w12-patch-replay@bb2b1957a8ebd721
  - scrutineer:///replay-aero-w15-patch-replay@019070389c89c27c
  - scrutineer:///replay-aero-w27-patch-replay@5e3609604891852d
  - scrutineer:///replay-aero-w31-patch-replay@fdf0e2cff264b178

## Lesson

13 lap(s) this generation failed with 1.5-unaware-of-stopping. Correcting AERO alone flipped them, so the cause is the artifact, not the driver.

## Shape

When `{item}` needs `{concept}` and AERO produced `{observed}`, the lap lost `{delta_s}`s. Correcting AERO alone flipped it.
