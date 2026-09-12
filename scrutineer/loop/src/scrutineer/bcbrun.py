"""Measure a harness on BigCodeBench-Hard's final held-out set.

One command, one harness, one number, always on the same 76 problems the loop never sees. The
comparison is made by running it twice: once with the harness the loop starts from, once with the
champion a season produced.
"""

from __future__ import annotations

import json
from math import comb
from pathlib import Path
from typing import Any

from .bcb import build_pool, three_way
from .evaluator import run_race
from .regs import Regs
from .theta import Theta
from .trial import starting_harness


def champion_harness(base: Theta) -> Theta:
    """Whatever the season promoted, loaded off disk.

    Through Theta.load rather than by hand: it also parses each role's YAML into the typed fields
    the harness actually reads, so a hand-built snapshot would have carried the files but an empty
    retrieval policy and measured something that was not the champion.
    """
    root = Path("state/champion")
    if not root.exists():
        raise SystemExit("no state/champion — run a season first, or this measures nothing.")
    champ = Theta.load(root)
    if not champ.files:
        raise SystemExit(f"{root} has no artifacts in it.")
    if champ.files == base.files:
        raise SystemExit("the champion is byte-identical to the base harness — nothing was "
                         "promoted, so this would measure the same thing twice.")
    return champ


def measure(name: str, *, n: int = 0, seed: int = 1994, cap_usd: float = 60.0) -> dict[str, Any]:
    regs, base = Regs.load(), Theta.load(None)
    theta = starting_harness(base) if name == "starting" else champion_harness(base)
    _, _, held = three_way(build_pool(), seed)
    if n:
        held = held[:n]
    r = run_race(theta=theta, items=held, regs=regs, generation=0, name=f"bcb-{name}",
                 seed=seed, cap_usd=cap_usd)
    per = {k.split("#")[0]: v for k, v in r.per_item.items()}
    return {"benchmark": "BigCodeBench-Hard", "harness": name, "n": len(held),
            "pass_at_1": round(r.pass_rate, 4), "solved": sum(1 for v in per.values() if v),
            "cost_usd": round(r.cost_usd, 4), "per_item": per}


def mcnemar(b: int, c: int) -> float:
    n = b + c
    if n == 0:
        return 1.0
    k = min(b, c)
    return min(1.0, 2 * sum(comb(n, i) for i in range(k + 1)) / (2 ** n))


def compare(a: dict[str, Any], b: dict[str, Any]) -> dict[str, Any]:
    pa, pb = a["per_item"], b["per_item"]
    fixed = sorted(k for k in pa if not pa[k] and pb.get(k))
    broken = sorted(k for k in pa if pa[k] and not pb.get(k))
    return {"benchmark": a["benchmark"], "n": a["n"],
            "baseline": {"harness": a["harness"], "pass_at_1": a["pass_at_1"],
                         "solved": a["solved"], "cost_usd": a["cost_usd"]},
            "loop": {"harness": b["harness"], "pass_at_1": b["pass_at_1"],
                     "solved": b["solved"], "cost_usd": b["cost_usd"]},
            "delta_pp": round(100 * (b["pass_at_1"] - a["pass_at_1"]), 2),
            "fixed": fixed, "broken": broken,
            "p_two_sided": round(mcnemar(len(fixed), len(broken)), 5)}


def write(path: Path, obj: dict[str, Any]) -> Path:
    path.write_text(json.dumps(obj, indent=2))
    return path
