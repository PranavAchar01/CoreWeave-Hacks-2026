"""Run the public benchmark under both harnesses and report pass@1.

The model is held fixed. The only thing that differs between the two numbers is the machinery
around it, which is the whole claim: this is a harness optimiser, and here is what the harness was
worth on an exam it did not write.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .bench import build_pool, build_pool_plus, three_way
from .evaluator import run_race
from .regs import Regs
from .theta import Theta
from .trial import starting_harness, upgraded_harness


def run(*, n_held: int = 0, seed: int = 1994, cap_usd: float = 40.0,
        plus: bool = True) -> dict[str, Any]:
    regs, base = Regs.load(), Theta.load(None)
    pool = build_pool_plus() if plus else build_pool()
    _, _, held = three_way(pool, seed)
    if n_held:
        held = held[:n_held]
    name = ("HumanEval, differential vs reference on base + extended inputs (EvalPlus inputs, "
            "capped) — not official HumanEval+ pass@1") if plus else "HumanEval"
    out: dict[str, Any] = {"benchmark": name, "n": len(held), "seed": seed,
                           "items": [i.id for i in held], "harnesses": {}}
    for name, theta in (("starting", starting_harness(base)), ("upgraded", upgraded_harness(base))):
        r = run_race(theta=theta, items=held, regs=regs, generation=0, name=f"bench-{name}",
                     seed=seed, cap_usd=cap_usd)
        passed = {k.split("#")[0]: v for k, v in r.per_item.items()}
        out["harnesses"][name] = {
            "pass_at_1": round(r.pass_rate, 4),
            "solved": sum(1 for v in passed.values() if v),
            "cost_usd": round(r.cost_usd, 4),
            "per_item": passed,
        }
    a = out["harnesses"]["starting"]["pass_at_1"]
    b = out["harnesses"]["upgraded"]["pass_at_1"]
    out["delta_pp"] = round(100 * (b - a), 2)
    # which items the harness turned around, and which it broke
    pa = out["harnesses"]["starting"]["per_item"]
    pb = out["harnesses"]["upgraded"]["per_item"]
    out["fixed"] = sorted(k for k in pa if not pa[k] and pb.get(k))
    out["broken"] = sorted(k for k in pa if pa[k] and not pb.get(k))
    # McNemar on the discordant pairs. Paired data, so this is the right test and it is the one
    # that says whether a gap is a result or a coin.
    b, c = len(out["fixed"]), len(out["broken"])
    out["discordant"] = {"fixed": b, "broken": c}
    out["p_two_sided"] = round(_mcnemar(b, c), 4)
    return out


def _mcnemar(b: int, c: int) -> float:
    """Exact two-sided binomial test on the discordant pairs."""
    from math import comb

    n = b + c
    if n == 0:
        return 1.0
    k = min(b, c)
    tail = sum(comb(n, i) for i in range(k + 1)) / (2 ** n)
    return min(1.0, 2 * tail)


def report(res: dict[str, Any]) -> str:
    h = res["harnesses"]
    lines = [f"{res['benchmark']} · {res['n']} held-out problems · model held fixed",
             f"  {'harness':10s} {'pass@1':>8s} {'solved':>8s} {'cost':>8s}"]
    for k in ("starting", "upgraded"):
        d = h[k]
        lines.append(f"  {k:10s} {d['pass_at_1'] * 100:7.1f}% {d['solved']:>4d}/{res['n']:<3d} "
                     f"${d['cost_usd']:7.3f}")
    lines.append(f"  delta {res['delta_pp']:+.1f} points   fixed {len(res['fixed'])}   "
                 f"broken {len(res['broken'])}   McNemar p = {res['p_two_sided']}")
    return "\n".join(lines)


def write(path: Path, res: dict[str, Any]) -> Path:
    path.write_text(json.dumps(res, indent=2))
    return path
