# pattern-0231 — AERO — 1.4-loss-of-history

role: AERO
mast_mode: 1.4-loss-of-history
generation: 2
evidence:
  - scrutineer:///replay-aero-w01-patch-replay@555842478f156113
  - scrutineer:///replay-aero-w10-patch-replay@da9331aa8727ee51
  - scrutineer:///replay-aero-w12-patch-replay@b09469ff88242d34
  - scrutineer:///replay-aero-w15-patch-replay@73a7d881037fade9
  - scrutineer:///replay-aero-w27-patch-replay@72af8219bcfca2a4
  - scrutineer:///replay-aero-w31-patch-replay@0b812e378345a984

## Lesson

19 lap(s) this generation failed with 1.4-loss-of-history. Correcting AERO alone flipped them, so the cause is the artifact, not the driver.

## Shape

When `{item}` needs `{concept}` and AERO produced `{observed}`, the lap lost `{delta_s}`s. Correcting AERO alone flipped it.
