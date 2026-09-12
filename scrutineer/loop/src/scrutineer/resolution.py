"""What a paired comparison is able to see, stated beside what it saw.

A p-value on its own answers "is this difference surprising"; it does not answer "could this
experiment have detected a difference of the size we care about". On 76 paired items the second
question has an uncomfortable answer, and a result reported without it reads as evidence of absence
when it is only absence of evidence. Card et al. (arXiv:2010.06595) found most NLP comparisons
underpowered in exactly this way, and that underpowered significant results exaggerate their own
magnitude (Type-M error) — so this module refuses to use the words "better" or "worse" for a
comparison that could not have resolved them.

Three quantities, each labelled with the method that produced it:

  mde_pp   the smallest true effect the exact McNemar test detects with 80 % power at this n and
           the observed discordance rate. Exact: summed over the binomial, not simulated.
  n_star   items needed for the *observed* effect to be detectable at 80 % power. Connor's (1987)
           normal approximation for paired proportions — the formula arXiv:2605.30315 uses.
  q        n / n_star. Below 1, the comparison is unresolved by design rather than by outcome.
"""

from __future__ import annotations

from math import comb, sqrt
from statistics import NormalDist
from typing import Any

ALPHA = 0.05
POWER = 0.80


def mcnemar_exact(b: int, c: int) -> float:
    """Two-sided exact McNemar: under no effect the discordant pairs split as a fair coin."""
    n = b + c
    if n == 0:
        return 1.0
    k = min(b, c)
    return min(1.0, 2 * sum(comb(n, i) for i in range(k + 1)) / 2**n)


def _critical(d: int, alpha: float) -> int:
    """Largest k such that a discordant split with min(b, c) <= k rejects at `alpha`, or -1."""
    tail, k_ok = 0, -1
    for k in range(d // 2 + 1):
        tail += comb(d, k)
        if 2 * tail / 2**d < alpha:
            k_ok = k
        else:
            break
    return k_ok


def power(n: int, p10: float, p01: float, alpha: float = ALPHA) -> float:
    """Exact power of the two-sided McNemar test on `n` pairs.

    p10 is the probability an item flips to pass under the new harness, p01 that it flips to fail.
    Conditioned on d discordant pairs, the number that flipped to pass is Binomial(d, p10/pd); the
    test rejects when the smaller side is at or below that d's critical value.
    """
    pd = p10 + p01
    if pd <= 0:
        return 0.0
    q = p10 / pd
    total = 0.0
    for d in range(n + 1):
        w = comb(n, d) * pd**d * (1 - pd) ** (n - d)
        if w < 1e-15:
            continue
        k = _critical(d, alpha)
        if k < 0:
            continue
        hit = sum(comb(d, b) * q**b * (1 - q) ** (d - b) for b in range(d + 1) if min(b, d - b) <= k)
        total += w * hit
    return total


def mde(
    n: int, discordance: float, target: float = POWER, alpha: float = ALPHA, step: float = 0.005
) -> float | None:
    """Smallest |effect| (as a proportion) with `target` power, holding discordance fixed.

    An effect cannot exceed the discordance — every item that changes outcome is discordant — so
    the scan stops there, and None means no effect this comparison could produce is detectable.
    """
    delta = step
    while delta <= discordance + 1e-12:
        if power(n, (discordance + delta) / 2, (discordance - delta) / 2, alpha) >= target:
            return delta
        delta += step
    return None


def n_star(delta: float, discordance: float, target: float = POWER, alpha: float = ALPHA) -> float | None:
    """Connor (1987): pairs needed to detect `delta` at this discordance. None for a zero effect,
    which no finite sample distinguishes from nothing."""
    if delta == 0 or discordance <= 0 or delta**2 > discordance:
        return None
    za, zb = NormalDist().inv_cdf(1 - alpha / 2), NormalDist().inv_cdf(target)
    return (za * sqrt(discordance) + zb * sqrt(discordance - delta**2)) ** 2 / delta**2


def resolve(fixed: int, broken: int, n: int) -> dict[str, Any]:
    """Everything a reader needs to know how far to trust one paired comparison."""
    d = fixed + broken
    disc = d / n if n else 0.0
    delta = (fixed - broken) / n if n else 0.0
    p = mcnemar_exact(fixed, broken)
    m = mde(n, disc) if d else None
    ns = n_star(abs(delta), disc)
    resolved = p < ALPHA
    if d == 0:
        claim = "identical on every item"
    elif resolved:
        claim = f"{'better' if delta > 0 else 'worse'}: {100 * delta:+.1f} pp, exact McNemar p={p:.3g}, n={n}"
    elif m is None:
        claim = (
            f"unresolved: {100 * delta:+.1f} pp, p={p:.3g}, n={n}; at this discordance no effect "
            "the comparison could produce is detectable at 80 % power"
        )
    else:
        claim = (
            f"unresolved: {100 * delta:+.1f} pp, p={p:.3g}, n={n}; the smallest effect this "
            f"comparison detects at 80 % power is {100 * m:.1f} pp"
        )
    return {
        "n": n,
        "fixed": fixed,
        "broken": broken,
        "discordance": round(disc, 4),
        "delta_pp": round(100 * delta, 2),
        "p_two_sided": round(p, 5),
        "resolved": resolved,
        "mde_pp": None if m is None else round(100 * m, 1),
        "mde_method": "exact McNemar power at the observed discordance, alpha=0.05, power=0.80",
        "n_star": None if ns is None else round(ns),
        "n_star_method": "Connor (1987) normal approximation for paired proportions",
        "q": None if ns is None else round(n / ns, 3),
        "claim": claim,
    }


def paired(a: dict[str, bool], b: dict[str, bool]) -> dict[str, Any]:
    """Resolve harness `b` against harness `a` on the items both were run on."""
    keys = sorted(set(a) & set(b))
    fixed = sum(1 for k in keys if not a[k] and b[k])
    broken = sum(1 for k in keys if a[k] and not b[k])
    return resolve(fixed, broken, len(keys))


def verdict(baseline: dict[str, Any], loop: dict[str, Any], scaling: dict[str, Any] | None) -> dict[str, Any]:
    """The headline, and the only place allowed to write one.

    A harness gain has to beat two things: the harness the loop started from, and the same starting
    harness spending its budget on more draws instead. arXiv:2607.12227 measured the second arm
    beating harness evolution by +13.1 to +2.9 at matched budget, so a loop that beats the first
    and not the second has found an expensive way to resample, not a better harness.
    """
    vs_base = paired(baseline["per_item"], loop["per_item"])
    out: dict[str, Any] = {
        "benchmark": baseline.get("benchmark"),
        "loop_vs_baseline": vs_base,
        "cost_usd": {"baseline": baseline.get("cost_usd"), "loop": loop.get("cost_usd")},
    }
    if scaling is None:
        out["loop_vs_scaling"] = None
        out["scaling_vs_baseline"] = None
        headline = (
            "regression"
            if vs_base["resolved"] and vs_base["delta_pp"] < 0
            else "unresolved"
            if not vs_base["resolved"]
            else "gain over the starting harness, not yet tested against matched-budget resampling"
        )
    else:
        vs_scale = paired(scaling["per_item"], loop["per_item"])
        scale_base = paired(baseline["per_item"], scaling["per_item"])
        out["loop_vs_scaling"] = vs_scale
        out["scaling_vs_baseline"] = scale_base
        out["cost_usd"]["scaling"] = scaling.get("cost_usd")
        lc, sc = loop.get("cost_usd") or 0.0, scaling.get("cost_usd") or 0.0
        ratio = lc / sc if sc else None
        out["budget_ratio_loop_to_scaling"] = None if ratio is None else round(ratio, 3)
        # within a quarter either way; outside it the comparison is labelled, not silently trusted
        out["budget_matched"] = ratio is not None and 0.75 <= ratio <= 1.25
        up = vs_base["resolved"] and vs_base["delta_pp"] > 0
        down = vs_base["resolved"] and vs_base["delta_pp"] < 0
        if down:
            headline = "regression"
        elif up and vs_scale["resolved"] and vs_scale["delta_pp"] > 0:
            headline = "harness gain: beats the starting harness and matched-budget resampling"
        elif up:
            headline = (
                "gain over the starting harness, not distinguishable from spending the budget on more samples"
            )
        elif scale_base["resolved"] and scale_base["delta_pp"] > 0:
            headline = "resampling beats the starting harness; the loop's harness does not separate from it"
        else:
            headline = "unresolved"
    out["headline"] = headline
    return out
