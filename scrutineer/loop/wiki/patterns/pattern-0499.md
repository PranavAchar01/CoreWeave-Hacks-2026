# pattern-0499 — DATA — 3.3-incorrect-verification

role: DATA
mast_mode: 3.3-incorrect-verification
generation: 4
evidence:
  - scrutineer:///replay-data-bcb0100-patch-replay@35cc52cc03014e6d
  - scrutineer:///replay-data-bcb0120-patch-replay@e849d706c6ecc7ff
  - scrutineer:///replay-data-bcb0177-patch-replay@054316b1ef2e2053
  - scrutineer:///replay-data-bcb0273-patch-replay@8c4e137bf4426b74
  - scrutineer:///replay-data-bcb0310-patch-replay@97a72272c2e2def1
  - scrutineer:///replay-data-bcb0443-patch-replay@581aa3d37014a6aa

## Lesson

17 failure(s) this run were confirmed against DATA by rebuilding the interface with it corrected: 17.2s recovered. The cause is the component, not the model.

## Shape

When `{item}` needs `{concept}` and DATA produced `{observed}`, the lap lost `{delta_s}`s. Correcting DATA alone flipped it.
