"""Measure a harness on BigCodeBench-Hard's final held-out set.

One command, one harness, one number, always on the same 76 problems the loop never sees. Three
harnesses can be measured: the one the loop starts from, the champion a season produced, and the
starting harness spending more on samples instead — the arm a harness claim has to beat before it
is a harness claim at all (arXiv:2607.12227). Every comparison carries its own resolution, and the
headline is written by `resolution.verdict`, nowhere else.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .bcb import build_pool, three_way
from .evaluator import run_race
from .regs import Regs
from .resolution import mcnemar_exact, paired, verdict
from .theta import Theta
from .trial import scaling_harness, starting_harness


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
    builders = {"starting": starting_harness, "champion": champion_harness, "scaling": scaling_harness}
    theta = builders[name](base)
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
    return mcnemar_exact(b, c)


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
            "p_two_sided": round(mcnemar(len(fixed), len(broken)), 5),
            # what this comparison was able to detect, beside what it detected
            "resolution": paired(pa, pb)}


def arms(state: Path) -> dict[str, dict[str, Any]]:
    """Whichever of the three harnesses have been measured, keyed by name."""
    out = {}
    for name in ("starting", "champion", "scaling"):
        f = state / f"bcb_{name}.json"
        if f.exists():
            out[name] = json.loads(f.read_text())
    return out


def write_verdict(state: Path) -> dict[str, Any] | None:
    """The headline needs a baseline and a champion; the resampling arm sharpens it when present."""
    got = arms(state)
    if "starting" not in got or "champion" not in got:
        return None
    v = verdict(got["starting"], got["champion"], got.get("scaling"))
    write(state / "bcb_verdict.json", v)
    return v


def write(path: Path, obj: dict[str, Any]) -> Path:
    path.write_text(json.dumps(obj, indent=2))
    return path
