"""SCRUTINEER — the optimizer.

A bi-level self-improving agent team, scored like a Formula 1 constructor. The control plane in
this package is real: telemetry, credit assignment by counterfactual replay, the selection rule,
the gates, the signed lineage chain and the executable debrief all run without any sponsor key.
Each sponsor rail (Weave, W&B Inference, Serverless RL, Sandboxes, ARIA, marimo, TypeSafe) sits
behind an adapter in `scrutineer.rails` that reports which backend actually served it, so the
REGS panel can never claim a rail that did not run.
"""

__version__ = "0.1.0"
