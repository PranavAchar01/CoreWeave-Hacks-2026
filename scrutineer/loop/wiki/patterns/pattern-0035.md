# pattern-0035 — AERO — 1.4-loss-of-history

role: AERO
mast_mode: 1.4-loss-of-history
generation: 0
evidence:
  - scrutineer:///replay-aero-bcb0100-patch-replay@9f4da2456b4b0d39
  - scrutineer:///replay-aero-bcb0120-patch-replay@4f958dc2ce05ca9f
  - scrutineer:///replay-aero-bcb0211-patch-replay@068285ca5d2747c8
  - scrutineer:///replay-aero-bcb0273-patch-replay@1a26392eb1ffe36f
  - scrutineer:///replay-aero-bcb0409-patch-replay@fa1e9dd67c4d7ab7
  - scrutineer:///replay-aero-bcb0443-patch-replay@478b376b415040a1

## Lesson

33 failure(s) this run were confirmed against AERO by rebuilding the interface with it corrected: 47.7s recovered. The cause is the component, not the model.

## Shape

When `{item}` needs `{concept}` and AERO produced `{observed}`, the lap lost `{delta_s}`s. Correcting AERO alone flipped it.
