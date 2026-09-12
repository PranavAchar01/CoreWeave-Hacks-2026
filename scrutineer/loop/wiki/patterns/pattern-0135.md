# pattern-0135 — AERO — 1.4-loss-of-history

role: AERO
mast_mode: 1.4-loss-of-history
generation: 1
evidence:
  - scrutineer:///replay-aero-bcb0082-ghost-swap@b1324ddcc040801c
  - scrutineer:///replay-aero-bcb0100-ghost-swap@79f3db9a922b9cd3
  - scrutineer:///replay-aero-bcb0120-ghost-swap@410dea502e188b8d
  - scrutineer:///replay-aero-bcb0129-ghost-swap@d8cd19478ef4444d
  - scrutineer:///replay-aero-bcb0177-ghost-swap@250e4aa959985653
  - scrutineer:///replay-aero-bcb0241-ghost-swap@a65d54c1eb9ef2e1

## Lesson

33 failure(s) this run were confirmed against AERO by rebuilding the interface with it corrected: 21.8s recovered. The cause is the component, not the model.

## Shape

When `{item}` needs `{concept}` and AERO produced `{observed}`, the lap lost `{delta_s}`s. Correcting AERO alone flipped it.
