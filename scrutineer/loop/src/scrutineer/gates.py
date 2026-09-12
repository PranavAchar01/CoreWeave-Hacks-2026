"""The gates. A promotion has to pass every one of them, and each says why in its own words."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Any

from .regs import Regs

# What a gate is evidence *about*. This is not decoration: a refusal only tells you something
# about the component if the gate was judging the component. A budget veto says the run was
# expensive; a comparability veto says the experiment was invalid. Neither is a fact about whether
# this component can be fixed, and feeding them to the credit model as though they were is how a
# loop talks itself out of its own best components. Compare invalid-action *penalty* against
# invalid-action *masking* in policy gradients (Huang & Ontanon, arXiv:2006.14171): penalising an
# agent for refusals it did not cause stops scaling as the refused space grows.
CHANGE = "change"  # judges the diff itself — informative about the component
RUN = "run"  # judges this run's resources — says nothing about the diff
COMPARISON = "comparison"  # judges whether the A/B was a valid experiment at all


@dataclass
class Gate:
    name: str
    ok: bool
    detail: str
    value: Any = None
    about: str = CHANGE

    def row(self) -> dict[str, Any]:
        return {
            "gate": self.name,
            "ok": self.ok,
            "detail": self.detail,
            "value": self.value,
            "about": self.about,
        }


def seesaw(regs: Regs, d_quali: float, d_sealed: float) -> Gate:
    """Seconds gained on both circuits, strictly better on at least one."""
    ok = d_quali >= 0 and d_sealed >= 0 and max(d_quali, d_sealed) > 0
    return Gate(
        "seesaw",
        ok,
        f"TEAM CLAIMED {d_quali:+.3f}s, OFFICIAL {d_sealed:+.3f}s"
        + ("" if ok else " — a gain on one circuit only counts if the other did not go backwards"),
        {"d_quali": round(d_quali, 3), "d_sealed": round(d_sealed, 3)},
    )


def ladder(regs: Regs, d_sealed: float, standing_best: float, n_sealed: int, queries_used: int) -> Gate:
    """The sealed split is not a held-out set after the first time you ask it a question.

    Dwork, Feldman, Hardt, Pitassi, Reingold & Roth (arXiv:1411.2664) proved the general case: any
    feedback from a holdout to the analyst creates dependence, and with naive empirical estimates
    the sample size needed grows *linearly* in the number of adaptive queries. A 24-item split
    asked once per generation for five generations carried no validity guarantee after the first,
    which is exactly how a candidate cleared every gate on +0.33 sealed seconds and then lost 6.6
    points on items it had never touched.

    Blum & Hardt's Ladder is the cheap, published remedy, and this is it: a candidate's sealed
    score is only *revealed* when it beats the standing best by a margin larger than the split's
    own noise. Otherwise the loop is told the standing best and learns nothing — which is the
    point. Noise cannot be climbed if it is never reported.

    The margin is the split's binomial standard error scaled to seconds, so it shrinks as the
    sealed set grows: a bigger split earns a finer ruler rather than being handed one.
    """
    budget = int(regs.g("gates", "sealed_query_budget"))
    z = float(regs.g("gates", "ladder_margin_z"))
    span = float(regs.g("objective", "lap_span_s"))
    # SE of a pass-rate on n items at its widest (p=0.5), expressed in the same seconds the
    # seesaw is denominated in. This is a ruler, not a significance test: it says "smaller than
    # this is indistinguishable from redrawing the split", which is all the Ladder needs.
    tau = z * span * (0.25 / max(1, n_sealed)) ** 0.5
    # `queries_used` already includes the answer being judged — the evaluator counts on the way
    # in — so the budget-th query is still inside the budget and the next one is not.
    if queries_used > budget:
        return Gate(
            "ladder",
            False,
            f"sealed split exhausted: {queries_used} of {budget} queries used — further "
            "answers from it carry no guarantee and are not reported",
            {"queries_used": queries_used, "budget": budget, "tau_s": round(tau, 3)},
            about=COMPARISON,
        )
    ok = d_sealed > standing_best + tau
    return Gate(
        "ladder",
        ok,
        f"OFFICIAL {d_sealed:+.3f}s vs standing best {standing_best:+.3f}s, margin "
        f"{tau:.3f}s on {n_sealed} sealed items"
        + (
            ""
            if ok
            else " — inside the split's own noise, so the standing best is "
            "reported and nothing is learned from this answer"
        ),
        {
            "d_sealed": round(d_sealed, 3),
            "standing_best": round(standing_best, 3),
            "tau_s": round(tau, 3),
            "n_sealed": n_sealed,
            "queries_used": queries_used,
            "budget": budget,
        },
    )


def correlation(regs: Regs, d_smoke: float, d_quali: float, d_sealed: float) -> Gate:
    band = float(regs.g("gates", "correlation_dead_band_s"))
    signs = {int(math.copysign(1, d)) for d in (d_smoke, d_quali, d_sealed) if abs(d) > band}
    ok = not (1 in signs and -1 in signs)
    return Gate(
        "correlation",
        ok,
        f"smoke {d_smoke:+.3f}s, quali {d_quali:+.3f}s, sealed {d_sealed:+.3f}s "
        f"(dead band {band}s)" + ("" if ok else " — correlation problem, credited to DATA"),
        {"d_smoke": round(d_smoke, 3), "d_quali": round(d_quali, 3), "d_sealed": round(d_sealed, 3)},
        about=COMPARISON,
    )


def regression(prev: dict[str, bool], new: dict[str, bool], new_any: dict[str, bool] | None = None) -> Gate:
    """Preserve-and-extend. An item counts as lost when it passed every trial before and now
    fails every trial; one flapping trial is noise, not a regression."""
    survives = new_any if new_any is not None else new
    lost = sorted(k for k, v in prev.items() if v and not survives.get(k, False))
    return Gate(
        "regression",
        not lost,
        "no item that passed last generation now fails"
        if not lost
        else f"{len(lost)} item(s) regressed: {lost[:5]}",
        {"lost": lost},
    )


def cost(regs: Regs, spent_usd: float) -> Gate:
    cap = regs.race_cap_usd
    return Gate(
        "cost_cap",
        spent_usd <= cap,
        f"${spent_usd:.3f} of ${cap:.2f} race + replay budget",
        {"spent": round(spent_usd, 4), "cap": cap},
        about=RUN,
    )


def verdict_gate(regs: Regs, verdict: str, confidence: float, unattended: bool) -> Gate:
    if verdict == "LEGAL":
        return Gate("scrutineering", True, f"LEGAL at {confidence:.2f}", {"verdict": verdict})
    if verdict == "BLACK_FLAG":
        return Gate("scrutineering", False, f"BLACK FLAG at {confidence:.2f}", {"verdict": verdict})
    return Gate(
        "scrutineering",
        False,
        "REFERRED TO THE STEWARDS"
        + (" — parked until an attended generation" if unattended else " — needs the Team Principal"),
        {"verdict": verdict},
    )


def diff_size(regs: Regs, lines: int) -> Gate:
    n = int(regs.g("gates", "min_diff_lines"))
    return Gate("diff_size", lines >= n, f"{lines} changed line(s), minimum {n}", {"lines": lines})


def comparable_ab(a_diff: str, b_diff: str) -> Gate:
    ok = a_diff.strip() != b_diff.strip()
    return Gate(
        "comparable_ab",
        ok,
        "two comparable candidates" if ok else "A and B are the same change",
        None,
        about=COMPARISON,
    )


def _tokens(s: str) -> set[str]:
    return set(re.findall(r"[a-z0-9_]{3,}", s.lower()))


def novelty(regs: Regs, diff_text: str, history: list[str]) -> Gate:
    eta = float(regs.g("gates", "novelty_cosine"))
    a = _tokens(diff_text)
    worst = 0.0
    for h in history:
        b = _tokens(h)
        if not a or not b:
            continue
        cos = len(a & b) / math.sqrt(len(a) * len(b))
        worst = max(worst, cos)
    return Gate(
        "novelty",
        worst < eta,
        f"closest previous proposal cosine {worst:.3f} (reject at {eta})",
        {"cosine": round(worst, 3)},
    )


def evidence(pages_cited: list[str]) -> Gate:
    return Gate(
        "evidence",
        bool(pages_cited),
        f"cites {len(pages_cited)} pattern page(s)" if pages_cited else "no pattern page cited",
        {"pages": pages_cited},
    )


def entropy(regs: Regs, entropy_series: list[float]) -> Gate:
    """A POWER UNIT candidate whose entropy has collapsed cannot enter the seesaw."""
    if len(entropy_series) < 6:
        return Gate("rl_entropy", True, "no RL job this generation", None)
    ratio = float(regs.g("gates", "entropy_collapse_ratio"))
    first = entropy_series[0] or 1e-9
    last5 = sum(entropy_series[-5:]) / 5
    ok = last5 >= ratio * first
    return Gate(
        "rl_entropy",
        ok,
        f"entropy {last5:.4f} vs {ratio:.0%} of step-0 {first:.4f}"
        + ("" if ok else " — the engine failed the dyno"),
        {"ratio": round(last5 / first, 3)},
        about=RUN,
    )


def summarise(gates: list[Gate]) -> tuple[bool, list[str]]:
    failed = [g.name for g in gates if not g.ok]
    return (not failed, failed)


def measured(gates: list[Gate]) -> bool:
    """Whether this generation produced an observation about the component at all.

    A generation whose A/B was invalid measured nothing, so there is no outcome to record. A
    generation refused only on resources measured everything — the score moved or it did not —
    and that measurement stands whether or not the change was kept. Recording a refusal as a
    failed fix when the failure was about the run is the invalid-action-penalty mistake, and it
    compounds: three of them retire the component, and the loop reports the retirement as a fact
    about the component rather than about its own budget."""
    return not any(g.about == COMPARISON and not g.ok for g in gates)


def stuck(history: list[list[dict[str, Any]]], runs: int = 3) -> list[str]:
    """Gates that have failed every one of the last `runs` generations without ever judging a
    change. A gate that can never pass is a misconfigured harness, not a run of bad luck, and the
    loop should say so out loud rather than absorb it."""
    if len(history) < runs:
        return []
    recent = history[-runs:]
    names = {g["gate"] for g in recent[0] if not g["ok"] and g.get("about", CHANGE) in (RUN, COMPARISON)}
    for row in recent[1:]:
        names &= {g["gate"] for g in row if not g["ok"]}
    return sorted(names)
