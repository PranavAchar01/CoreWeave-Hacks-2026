# pattern-0399 — DATA — 3.3-incorrect-verification

role: DATA
mast_mode: 3.3-incorrect-verification
generation: 3
evidence:
  - scrutineer:///replay-data-bcb0100-patch-replay@32fc5f8174eddca2
  - scrutineer:///replay-data-bcb0120-patch-replay@a6222b9a9688f088
  - scrutineer:///replay-data-bcb0177-patch-replay@ba11ad8078906189
  - scrutineer:///replay-data-bcb0273-patch-replay@01e863f0178b959b
  - scrutineer:///replay-data-bcb0310-patch-replay@56740f73e6830a49
  - scrutineer:///replay-data-bcb0443-patch-replay@93e137918e04ed97

## Lesson

17 failure(s) this run were confirmed against DATA by rebuilding the interface with it corrected: 17.2s recovered. The cause is the component, not the model.

## Shape

When `{item}` needs `{concept}` and DATA produced `{observed}`, the lap lost `{delta_s}`s. Correcting DATA alone flipped it.
