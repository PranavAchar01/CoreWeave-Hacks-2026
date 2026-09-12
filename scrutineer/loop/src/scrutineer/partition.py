"""Is the task population one population?

Every generation the loop spends real money establishing, causally, which component was
responsible for which failure. That ledger is a component x family matrix of measured blame, and
nothing has ever read it as one. If two components' blame falls on disjoint sets of families, a
single champion harness is being forced to compromise between two populations that want different
machinery — and the loop's own evidence says so, in numbers it already paid for.

This module only measures. It does not fork anything. If the matrix comes back flat, the
population really is homogeneous, splitting the harness buys nothing, and that is the answer.
"""

from __future__ import annotations

import json
import random
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

REF = re.compile(r"replay-[a-z_]+-([a-z0-9]+)-")


@dataclass
class Split:
    """The partition the blame matrix implies, and how strongly it implies it."""

    pair: tuple[str, str]
    tv: float                                   # total variation between the two blame profiles
    ci: tuple[float, float]                     # bootstrap 90 % interval on that distance
    sides: dict[str, list[str]] = field(default_factory=dict)
    n: dict[str, int] = field(default_factory=dict)
    separable: bool = False

    def row(self) -> dict[str, Any]:
        return {"pair": list(self.pair), "tv": round(self.tv, 3),
                "ci": [round(self.ci[0], 3), round(self.ci[1], 3)],
                "sides": self.sides, "n": self.n, "separable": self.separable}


def families() -> dict[str, str]:
    """item id -> family, from the live task pool."""
    from .circuits import task_pool

    return {t.id: getattr(t, "family", "?") for t in task_pool()}


def incidents(state: Path, threshold: float = 0.5) -> list[tuple[str, str, float]]:
    """(component, family, credit) for every confirmed incident on disk.

    The item is parsed out of the replay reference: rows predate carrying it as a field, and
    rewriting history to add one would be worse than reading what is already there.
    """
    fam = families()
    out: list[tuple[str, str, float]] = []
    for f in sorted((state / "objects").glob("ledger:gen-*.json")):
        try:
            rows = json.loads(f.read_text()).get("rows", [])
        except Exception:
            continue
        for r in rows:
            if float(r.get("delta_s", 0)) <= threshold:
                continue
            m = REF.search(str(r.get("replay_ref", "")))
            item = r.get("item") or (m.group(1) if m else None)
            if not item or item not in fam:
                continue
            out.append((r["role"], fam[item], float(r["delta_s"])))
    return out


def matrix(inc: list[tuple[str, str, float]]) -> dict[str, dict[str, float]]:
    B: dict[str, dict[str, float]] = {}
    for role, fam, credit in inc:
        B.setdefault(role, {})[fam] = B.setdefault(role, {}).get(fam, 0.0) + credit
    return B


def _profile(B: dict[str, dict[str, float]], role: str, keys: list[str]) -> list[float]:
    row = B.get(role, {})
    total = sum(row.values()) or 1.0
    return [row.get(k, 0.0) / total for k in keys]


def _tv(a: list[float], b: list[float]) -> float:
    """Total variation distance. 0 = the two components fail on the same tasks, so one harness
    serves both. 1 = disjoint, so one harness is a compromise between two populations."""
    return 0.5 * sum(abs(x - y) for x, y in zip(a, b, strict=True))


def analyse(state: Path, *, min_incidents: int = 5, wall: float = 0.25,
            draws: int = 2000, seed: int = 1994) -> Split | None:
    """The two components carrying the most blame, and whether they fail on the same tasks."""
    inc = incidents(state)
    if not inc:
        return None
    B = matrix(inc)
    per_role: dict[str, list[tuple[str, float]]] = {}
    for role, fam, credit in inc:
        per_role.setdefault(role, []).append((fam, credit))

    ranked = sorted(B, key=lambda r: -sum(B[r].values()))
    ranked = [r for r in ranked if len(per_role[r]) >= min_incidents]
    if len(ranked) < 2:
        return None
    a, b = ranked[0], ranked[1]
    keys = sorted({f for r in (a, b) for f in B[r]})
    tv = _tv(_profile(B, a, keys), _profile(B, b, keys))

    rng = random.Random(seed)
    boots = []
    for _ in range(draws):
        rb: dict[str, dict[str, float]] = {}
        for r in (a, b):
            s = per_role[r]
            for _k in range(len(s)):
                fam, credit = s[rng.randrange(len(s))]
                rb.setdefault(r, {})[fam] = rb.setdefault(r, {}).get(fam, 0.0) + credit
        boots.append(_tv(_profile(rb, a, keys), _profile(rb, b, keys)))
    boots.sort()
    lo, hi = boots[int(0.05 * draws)], boots[int(0.95 * draws) - 1]

    sides: dict[str, list[str]] = {a: [], b: []}
    for f in keys:
        sides[a if B[a].get(f, 0.0) >= B[b].get(f, 0.0) else b].append(f)
    return Split(pair=(a, b), tv=tv, ci=(lo, hi), sides=sides,
                 n={a: len(per_role[a]), b: len(per_role[b])},
                 separable=lo > wall)


def bundle(state: Path) -> dict[str, Any]:
    """Everything the page needs to draw the matrix, measured rather than asserted."""
    inc = incidents(state)
    s = analyse(state)
    B = matrix(inc)
    roles = sorted(B, key=lambda r: -sum(B[r].values()))
    fams = sorted({f for r in B for f in B[r]})
    return {
        "incidents": len(inc),
        "roles": roles,
        "families": fams,
        "cells": {r: {f: round(B[r].get(f, 0.0), 2) for f in fams} for r in roles},
        "split": s.row() if s else None,
    }


def report(state: Path) -> str:
    s = analyse(state)
    if s is None:
        return "not enough confirmed incidents on disk to say anything."
    a, b = s.pair
    out = [
        f"blame profiles over task families, from {sum(s.n.values())} confirmed incidents",
        f"  {a:<12} n={s.n[a]:<3}  families: {', '.join(s.sides[a]) or '—'}",
        f"  {b:<12} n={s.n[b]:<3}  families: {', '.join(s.sides[b]) or '—'}",
        f"  total variation {s.tv:.3f}   CI90 [{s.ci[0]:.3f}, {s.ci[1]:.3f}]",
    ]
    out.append(
        "  SEPARABLE — the two components carrying the most blame fail on different tasks, so a\n"
        "  single champion is a compromise between two populations."
        if s.separable else
        "  NOT SEPARABLE — they fail on the same tasks. One harness serves both, and splitting it\n"
        "  would buy nothing. This is the answer, not a missing result.")
    return "\n".join(out)
