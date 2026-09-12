# pattern-0299 — DATA — 3.3-incorrect-verification

role: DATA
mast_mode: 3.3-incorrect-verification
generation: 2
evidence:
  - scrutineer:///replay-data-w13-patch-replay@73e2e5ec9bff7e37
  - scrutineer:///replay-data-w36-patch-replay@599dfd81976a1356
  - scrutineer:///replay-data-w05-patch-replay@94538d4d7f6375c8
  - scrutineer:///replay-data-w03-patch-replay@f4a0b36d2c83b524
  - scrutineer:///replay-data-w36-patch-replay@b87c1ae2a514da5a
  - scrutineer:///replay-data-w05-patch-replay@9d71918f840b35f4

## Lesson

6 failure(s) this run were confirmed against DATA by rebuilding the interface with it corrected: 69.3s recovered. The cause is the component, not the model.

## Shape

When `{item}` needs `{concept}` and DATA produced `{observed}`, the lap lost `{delta_s}`s. Correcting DATA alone flipped it.
