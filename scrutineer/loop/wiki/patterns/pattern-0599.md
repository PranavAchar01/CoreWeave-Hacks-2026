# pattern-0599 — DATA — 3.3-incorrect-verification

role: DATA
mast_mode: 3.3-incorrect-verification
generation: 5
evidence:
  - scrutineer:///replay-data-w05-patch-replay@15de5a698cb71503
  - scrutineer:///replay-data-w23-patch-replay@d44a787741563ef3
  - scrutineer:///replay-data-w32-patch-replay@0bb82c8b0fea9eed
  - scrutineer:///replay-data-w15-patch-replay@09ef3f597d41dc72
  - scrutineer:///replay-data-w13-patch-replay@b477f7be88548fd2
  - scrutineer:///replay-data-w05-patch-replay@e01db48bd5d92675

## Lesson

11 failure(s) this run were confirmed against DATA by rebuilding the interface with it corrected: 86.0s recovered. The cause is the component, not the model.

## Shape

When `{item}` needs `{concept}` and DATA produced `{observed}`, the lap lost `{delta_s}`s. Correcting DATA alone flipped it.
