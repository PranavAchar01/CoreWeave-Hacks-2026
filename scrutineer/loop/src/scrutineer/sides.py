"""Does the harness the loop found help one side of the partition more than the other?

`partition.py` shows the blame matrix separates: the two components carrying the most credit fail
on disjoint sets of task families. That is a claim about where failures *are*. It is not yet a
claim that a single harness is a compromise.

This is that claim, and it is cheap to test with harnesses the loop already produced. Take the
harness it starts with and the harness it ended up with, and race both over each side of the
partition separately. If the upgrades deliver a much larger gain on one side than the other, then
the gate — which scored those upgrades on the average of the two — was pricing a specialist as
though it were a generalist.

A flat result kills the idea. Both sides gaining equally means the population is homogeneous with
respect to what the loop actually changed, and one harness is the right answer.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .circuits import task_pool
from .evaluator import run_race
from .regs import Regs
from .theta import Theta
from .trial import starting_harness, upgraded_harness


@dataclass
class SideResult:
    name: str
    families: list[str]
    n: int
    before_s: float
    after_s: float

    @property
    def gain(self) -> float:
        """Seconds gained. Positive is faster, matching the sign convention everywhere else."""
        return self.before_s - self.after_s

    def row(self) -> dict[str, Any]:
        return {"side": self.name, "families": self.families, "n": self.n,
                "before_s": round(self.before_s, 3), "after_s": round(self.after_s, 3),
                "gain_s": round(self.gain, 3),
                # the sides do not start level, so the absolute gain is partly headroom; the
                # share of its own starting time each side got back is the fairer comparison
                "gain_pct": round(100 * self.gain / self.before_s, 2) if self.before_s else 0.0}


def sides_from(state: Path) -> dict[str, list[str]]:
    p = state / "partition.json"
    if not p.exists():
        raise SystemExit("run `scrutineer partition` first — there is no split to test.")
    split = json.loads(p.read_text()).get("split")
    if not split:
        raise SystemExit("the blame matrix did not separate, so there is nothing to test.")
    return split["sides"]


def run(state: Path, *, per_family: int = 2, seed: int = 1994) -> dict[str, Any]:
    regs = Regs.load()
    base = Theta.load(None)
    before, after = starting_harness(base), upgraded_harness(base)
    sides = sides_from(state)

    pool = task_pool()
    by_family: dict[str, list] = {}
    for t in pool:
        by_family.setdefault(t.family, []).append(t)

    out: list[SideResult] = []
    for name, fams in sides.items():
        items = [t for f in fams for t in by_family.get(f, [])[:per_family]]
        if not items:
            continue
        # Same items, same seed, same budget — everything but the harness under test. The cap
        # matters twice over: it is what makes the stop policy a real decision, and it is a term
        # in U, so removing it would both stretch every lap and flatten the objective.
        cap = regs.race_cap_usd * float(regs.g("cost", "race_shares")["quali"]) * (len(items) / 10)
        b = run_race(theta=before, items=items, regs=regs, generation=0,
                     name=f"sides-before-{name}", seed=seed, cap_usd=cap)
        a = run_race(theta=after, items=items, regs=regs, generation=0,
                     name=f"sides-after-{name}", seed=seed, cap_usd=cap)
        out.append(SideResult(name=name, families=sorted(fams), n=len(items),
                              before_s=b.race_s, after_s=a.race_s))

    gains = {r.name: r.gain for r in out}
    spread = (max(gains.values()) - min(gains.values())) if len(gains) > 1 else 0.0
    return {
        "per_family": per_family,
        "sides": [r.row() for r in out],
        "spread_s": round(spread, 3),
        # The upgrades are worth this many more seconds on one side than the other. A single
        # champion had to be priced on the mean of the two.
        "lopsided": bool(spread > 1.0),
    }


def report(res: dict[str, Any]) -> str:
    lines = ["the harness it starts with vs the harness the loop found, raced on each side:"]
    for r in res["sides"]:
        lines.append(f"  {r['side']:<12} n={r['n']:<3} {', '.join(r['families'])}")
        lines.append(f"  {'':12} before {r['before_s']:7.3f}s   after {r['after_s']:7.3f}s   "
                     f"gain {r['gain_s']:+7.3f}s")
    lines.append(f"  spread between sides: {res['spread_s']:.3f}s")
    lines.append(
        "  LOPSIDED — the upgrades are worth far more on one side. A single champion was priced\n"
        "  on the average of two different populations."
        if res["lopsided"] else
        "  EVEN — both sides gain about the same. One harness is the right answer for this pool,\n"
        "  and splitting it would buy nothing.")
    return "\n".join(lines)
