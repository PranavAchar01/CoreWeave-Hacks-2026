# pattern-0115 — AERO — 1.5-unaware-of-stopping

role: AERO
mast_mode: 1.5-unaware-of-stopping
generation: 1
evidence:
  - scrutineer:///replay-aero-w01-patch-replay@55bfe3245fdf2647
  - scrutineer:///replay-aero-w10-patch-replay@1ff0b57387898421
  - scrutineer:///replay-aero-w12-patch-replay@492e5adbe9e6ca13
  - scrutineer:///replay-aero-w15-patch-replay@507ead0fc78715ee
  - scrutineer:///replay-aero-w27-patch-replay@80a8d8afb14d9fbf
  - scrutineer:///replay-aero-w31-patch-replay@1ee66ed916c46535

## Lesson

13 lap(s) this generation failed with 1.5-unaware-of-stopping. Correcting AERO alone flipped them, so the cause is the artifact, not the driver.

## Shape

When `{item}` needs `{concept}` and AERO produced `{observed}`, the lap lost `{delta_s}`s. Correcting AERO alone flipped it.
