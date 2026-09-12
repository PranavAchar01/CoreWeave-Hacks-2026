"""The five in-lap roles. Each is a pure function of (θ, state) so replay is exact."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Any

from ..circuits import Item
from ..rails.inference import SimOutcome, inference, sim_drive
from ..rails.typed import typed
from ..theta import Theta

# ------------------------------------------------------------------------------------------------
# STRATEGIST — one typed PitWallCall per driver step
# ------------------------------------------------------------------------------------------------

# Backend B is "a strict-schema chat model". granite-4.1-8b serves it because it returns the same
# decision as gpt-oss-20b in 0.4 s against 6.9 s, and a season makes thousands of these calls;
# SCRUTINEER_TYPED_MODEL selects any other model on the endpoint.
STRATEGIST_MODEL = os.environ.get("SCRUTINEER_TYPED_MODEL", "ibm-granite/granite-4.1-8b")

PIT_WALL_SCHEMA: dict[str, Any] = {
    "title": "PitWallCall",
    "type": "object",
    "additionalProperties": False,
    "required": ["action", "engine_mode", "p_finish_under_cap", "confidence"],
    "properties": {
        "action": {"type": "string", "enum": ["PUSH", "HOLD", "BOX", "RETIRE"]},
        "engine_mode": {"type": "integer", "minimum": 1, "maximum": 5},
        "p_finish_under_cap": {"type": "number", "minimum": 0.0, "maximum": 1.0},
        "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
    },
}


@dataclass
class PitWallCall:
    action: str
    engine_mode: int
    p_finish_under_cap: float
    confidence: float
    backend: str = "local-policy"
    cost_usd: float = 0.0

    def as_row(self) -> dict[str, Any]:
        return {
            "action": self.action,
            "engine_mode": self.engine_mode,
            "p_finish_under_cap": round(self.p_finish_under_cap, 4),
            "confidence": round(self.confidence, 4),
        }


def strategist_call(theta: Theta, *, step: int, spent_usd: float, cap_usd: float,
                    max_steps: int, best_probe: float, difficulty: float) -> PitWallCall:
    th = theta.strategist
    budget_left = max(0.0, 1.0 - (spent_usd / cap_usd if cap_usd else 0.0))
    steps_left = max(0, max_steps - step) / max(1, max_steps)
    # p that this lap finishes inside the cost cap if we keep going
    p_finish = max(0.0, min(1.0, 0.5 * budget_left + 0.3 * steps_left + 0.2 * (1.0 - difficulty)))

    def local() -> dict[str, Any]:
        ladder = th.get("ladder", [0.85, 0.70, 0.55, 0.40, 0.25])
        # Budget headroom picks the engine mode: plenty of cap left means push (SOFT, more
        # samples); a tight cap means conserve (HARD, one sample).
        mode = max(1, min(5, sum(1 for c in ladder if p_finish >= c)))
        if p_finish < th.get("retire_when", 0.10):
            action = "RETIRE"
        elif best_probe >= 1.0 and step >= th.get("min_steps_before_box", 1):
            action = "BOX"                       # the tools say this one stands up; submit it
        elif p_finish < th.get("box_when_p_finish_under_cap", 0.35):
            action = "BOX"                       # cut losses: submit the best we have
        else:
            action = "PUSH"
        # confidence is a real quantity here: distance from the nearest threshold, which is what
        # makes the reliability diagram meaningful rather than decorative
        edges = [abs(p_finish - th.get("box_when_p_finish_under_cap", 0.35)),
                 abs(p_finish - th.get("retire_when", 0.10))]
        conf = max(0.05, min(0.99, 0.55 + 1.6 * min(edges)))
        return {"action": action, "engine_mode": mode, "p_finish_under_cap": p_finish, "confidence": conf}

    th_box = th.get("box_when_p_finish_under_cap", 0.35)
    th_ret = th.get("retire_when", 0.10)
    ladder = th.get("ladder", [0.85, 0.70, 0.55, 0.40, 0.25])
    res = typed().decide(
        schema=PIT_WALL_SCHEMA,
        system=(
            "You are the pit wall of a Formula 1 team, deciding the next step of one lap under a "
            "hard cost cap. Return only the decision.\n"
            "ACTIONS — PUSH: generate another candidate solution. HOLD: keep the current context "
            "and spend nothing. BOX: submit the best candidate now and end the lap. RETIRE: "
            "abandon the lap because it cannot finish inside the cap.\n"
            "THE TEAM'S OWN THRESHOLDS, which you must apply:\n"
            f"  retire when p_finish_under_cap < {th_ret}\n"
            f"  box when the tools already accept a candidate (probe_score = 1.0) and at least "
            f"{th.get('min_steps_before_box', 1)} step(s) have run\n"
            f"  otherwise box when p_finish_under_cap < {th_box}\n"
            f"  engine_mode is how many of the ladder values {ladder} are less than or equal to "
            "p_finish_under_cap, clamped to 1-5: plenty of headroom means a high mode, which "
            "spends more per step for a better chance\n"
            "RETIRE is expensive — it scores the lap as a timeout — so use it only when the "
            "threshold above is genuinely met.\n"
            "confidence is your calibrated probability that this action is the right one."
        ),
        user=(
            f"step {step} of {max_steps}\n"
            f"spent ${spent_usd:.4f} of ${cap_usd:.4f} allowed for this lap\n"
            f"p_finish_under_cap {p_finish:.3f}\n"
            f"probe_score {best_probe:.2f} (1.0 means the tools accept a candidate already)\n"
            f"item difficulty {difficulty:.2f}"
        ),
        fallback=local,
        model=STRATEGIST_MODEL,
    )
    v = res.value
    return PitWallCall(
        action=str(v["action"]),
        engine_mode=int(v["engine_mode"]),
        p_finish_under_cap=float(v["p_finish_under_cap"]),
        confidence=float(v["confidence"]),
        backend=res.backend,
        cost_usd=res.cost_usd,
    )


# ------------------------------------------------------------------------------------------------
# TYRES — what one step may spend
# ------------------------------------------------------------------------------------------------

@dataclass
class TyreProfile:
    temperature: float
    samples: int
    max_tokens: int
    compound: str


def tyre_profile(theta: Theta, engine_mode: int) -> TyreProfile:
    modes = theta.tyres.get("modes", {})
    m = modes.get(engine_mode) or modes.get(str(engine_mode)) or {}
    return TyreProfile(
        temperature=float(m.get("temperature", 0.25)),
        samples=int(m.get("samples", 1)),
        max_tokens=int(m.get("max_tokens", 900)),
        compound=str(m.get("compound", "MEDIUM")),
    )


# ------------------------------------------------------------------------------------------------
# AERO — context assembly
# ------------------------------------------------------------------------------------------------

@dataclass
class Context:
    text: str
    tokens: int
    ref_ids: list[str]
    covered: frozenset[str]
    missing: frozenset[str]

    @property
    def concepts_covered(self) -> bool:
        return not self.missing


def shape_context(theta: Theta, item: Item) -> Context:
    a = theta.aero
    mode = a.get("retrieval", "keyword")
    n = int(a.get("n_refs", 2))
    budget = int(a.get("budget_tokens", 900))
    refs = theta.references

    prompt_words = {w for w in re.findall(r"[a-z]{4,}", item.prompt.lower())}

    def score(r) -> float:
        if mode == "concept-match":
            return float(len(r.concepts & item.concepts))
        if mode == "family-match":
            # the family's own concept set is the key, so a reference is found whenever it was
            # written for this kind of problem, whether or not the words line up
            return float(len(r.concepts & item.concepts)) if r.concepts & item.concepts else 0.0
        # keyword retrieval matches the reference's own text against the words of the spec. It
        # finds the reference whose vocabulary the prompt happens to share, and misses the one
        # whose concept is never named out loud - the classic context miss.
        ref_words = {w for w in re.findall(r"[a-z]{4,}", (r.id + " " + r.body).lower())}
        return float(len(ref_words & prompt_words))

    ranked = sorted(refs, key=lambda r: (-score(r), r.id))
    chosen = [r for r in ranked[:n] if score(r) > 0] if mode != "concept-match" else ranked[:n]
    covered: set[str] = set()
    for r in chosen:
        covered |= set(r.concepts)
    body = "\n\n".join(f"[{r.id}] {r.body}" for r in chosen)
    if a.get("layout") == "spec-first":
        text = f"# Task\n{item.prompt}\n\n# References\n{body}"
    else:
        text = f"# References\n{body}\n\n# Task\n{item.prompt}"
    tokens = min(budget, max(60, len(text) // 4))
    return Context(
        text=text,
        tokens=tokens,
        ref_ids=[r.id for r in chosen],
        covered=frozenset(covered),
        missing=frozenset(item.concepts - covered),
    )


# ------------------------------------------------------------------------------------------------
# POWER UNIT — the driver
# ------------------------------------------------------------------------------------------------

@dataclass
class Attempt:
    source: str
    tokens_in: int
    tokens_out: int
    cost_usd: float
    correct_hint: bool | None = None      # only the sim knows; never read by the loop
    corruption: str | None = None


class ModelUnreachable(RuntimeError):
    """The model could not be called at all — quota, auth, or the network. Distinct from the
    model answering badly, and the loop must stop rather than record empty runs as failures."""


SYSTEM_WEB = (
    "You are building a web interface that real people will use, including people using a screen "
    "reader or a keyboard alone. Return one complete, self-contained HTML document and nothing "
    "else. Inline all CSS. Make no external requests."
)

SYSTEM_CODE = (
    "Complete the Python function. Return the whole function, including its signature, and "
    "nothing else — no prose, no tests, no example calls. Use only the standard library."
)


def _system_for(item: Item) -> str:
    """The workload decides the instruction. The harness around it does not change."""
    return SYSTEM_WEB if getattr(item, "kind", "py") == "web" else SYSTEM_CODE


def drive(theta: Theta, *, item: Item, ctx: Context, profile: TyreProfile, seed: int,
          step: int) -> list[Attempt]:
    """Produce `profile.samples` candidate interfaces. SAMPLING decides how many and how hot."""
    pu = theta.power_unit
    inf = inference()
    out: list[Attempt] = []
    if inf.backend.real:  # pragma: no cover - network path
        want = pu.get("checkpoint") if pu.get("checkpoint", "base") != "base" else pu.get("base_model")
        model = inf.resolve_model(want)
        for i in range(profile.samples):
            # every sample is an independent draw: its own nonce and model seed, or the cache
            # would serve one answer k times and an extra sample would buy nothing
            try:
                c = inf.complete(
                    system=_system_for(item), user=ctx.text, model=model,
                    temperature=profile.temperature + 0.05 * i,
                    max_tokens=max(2400, profile.max_tokens * 2),
                    nonce=f"{seed}|{step}|{i}",
                    seed=(seed * 131 + step * 17 + i) % (2 ** 31),
                )
            except Exception as e:
                # A model that cannot be reached is not an agent that wrote a bad page. Swallowing
                # this turned an exhausted quota into ten runs of "the agent produced nothing",
                # with frozen scores that looked like convergence.
                raise ModelUnreachable(
                    f"{type(e).__name__}: {str(e)[:200]}") from e
            out.append(Attempt(_extract_code(c.text, getattr(item, 'kind', 'py')),
                               c.prompt_tokens, c.completion_tokens,
                               c.cost_usd))
        return out
    for i in range(profile.samples):
        o: SimOutcome = sim_drive(
            item_id=item.id, reference_solution=getattr(item, "reference_solution", ""),
            broken_variants=getattr(item, "broken_variants", ()),
            concepts_covered=ctx.concepts_covered,
            competence=float(pu.get("competence", 0.62)), samples=1,
            temperature=profile.temperature, schema_ok=True, context_tokens=ctx.tokens,
            seed=seed, attempt=step * 8 + i)
        out.append(Attempt(o.source, o.prompt_tokens, o.completion_tokens,
                           o.prompt_tokens / 1e6 * 0.05 + o.completion_tokens / 1e6 * 0.22,
                           correct_hint=o.correct, corruption=o.corruption))
    return out


def _extract_code(text: str, kind: str = "web") -> str:  # pragma: no cover - live model only
    """Pull the artefact out of the reply, by workload.

    The HTML extractor cannot be reused for source: it only matches an ```html fence, and when it
    misses it truncates from the first `<` — which in Python is a comparison operator, so it cut
    every candidate in half and the benchmark read as unsolvable.
    """
    if kind == "web":
        from ..webtasks import extract

        return extract(text)
    import re as _re

    m = _re.search(r"```[a-zA-Z0-9_+-]*\s*\n(.*?)```", text or "", _re.S)
    return (m.group(1) if m else (text or "")).strip()


# ------------------------------------------------------------------------------------------------
# DATA — tools, probes and schemas
# ------------------------------------------------------------------------------------------------

@dataclass
class ProbeResult:
    score: float                 # 0.0 broken, 0.5 runs, 1.0 runs and produces a plausible answer
    error: str | None
    schema_ok: bool
    tool_calls: int = 0
    exceptions: int = 0


PROBE_TEMPLATE = """{src}

import json
_probe = []
for _args in {probes!r}:
    try:
        _probe.append(repr({entry}(*_args)))
    except Exception as _e:
        _probe.append("EXC:" + type(_e).__name__)
print("PROBE " + json.dumps(_probe))
print('SCRUTINEER_PASS')
"""


def _probe_args(item: Item) -> list[tuple]:
    """Trivial inputs derived from the visible spec. These are NOT the hidden tests: the driver
    may never see those, or the official score would be meaningless."""
    return list(item.check_args[1:])


def _probe_code(item: Item, source: str, mode: str) -> ProbeResult:
    """The pre-submit check for a source-code workload.

    The rungs mirror the web ladder: does it parse, does it load, does it satisfy what the brief
    actually showed you. The top rung runs the examples in the docstring — which the agent was
    given — and never `item.tests`, which it was not. That boundary is the whole reason a gain on
    a public benchmark means anything: a harness that checked against the held-out tests would
    score perfectly and measure nothing.
    """
    import ast
    import re

    from ..rails.sandbox import sandbox

    if mode == "syntax":
        try:
            tree = ast.parse(source or "")
        except SyntaxError as e:
            return ProbeResult(0.0, f"does not parse: {e.msg}", True, tool_calls=1, exceptions=1)
        named = any(isinstance(n, ast.FunctionDef) and n.name == item.entry_point
                    for n in ast.walk(tree))
        return ProbeResult(1.0 if named else 0.0,
                           None if named else f"does not define {item.entry_point}",
                           True, tool_calls=1, exceptions=0 if named else 1)

    if mode == "render":
        script = f"{source}\n\nassert callable({item.entry_point})\nprint('SCRUTINEER_PASS')\n"
        r = sandbox().run(script)
        return ProbeResult(1.0 if r.ok else 0.0, None if r.ok else "does not import cleanly",
                           True, tool_calls=1, exceptions=0 if r.ok else 1)

    # audit: run the worked examples the docstring itself carries, before submitting.
    # Parse the docstring out rather than handing doctest the whole prompt: the raw text ends
    # with the closing triple quote, which doctest swallows into the last example's expected
    # output, so the final example could never pass and correct code looked wrong.
    m = (re.search(r'"""(.*?)"""', item.prompt, re.S)
         or re.search(r"'''(.*?)'''", item.prompt, re.S))
    doc = m.group(1) if m else item.prompt
    script = (
        f"{source}\n\n"
        "import doctest\n"
        f"_PROMPT = {doc!r}\n"
        # A docstring doctest cannot parse is not a candidate that failed. Some briefs indent
        # inconsistently and the parser raises; treating that as a failure would reject every
        # candidate on that task identically, which is a dead check wearing a verdict.
        "try:\n"
        "    _t = doctest.DocTestParser().get_doctest(_PROMPT, globals(), 'probe', None, 0)\n"
        "    _r = doctest.DocTestRunner(verbose=False)\n"
        "    _r.run(_t, out=lambda _s: None)\n"
        "    print('EXAMPLES', _r.tries, _r.failures)\n"
        "except Exception:\n"
        "    print('EXAMPLES 0 0')\n"
        "print('SCRUTINEER_PASS')\n"
    )
    r = sandbox().run(script)
    if not r.ok:
        return ProbeResult(0.0, "raised on its own examples", True, tool_calls=1, exceptions=1)
    tries, failures = 0, 0
    for line in (getattr(r, "stdout", "") or getattr(r, "output", "") or "").splitlines():
        if line.startswith("EXAMPLES"):
            _, a, b = line.split()
            tries, failures = int(a), int(b)
    if tries == 0:
        # no worked example in the brief: nothing to check against, and saying so beats pretending
        return ProbeResult(0.6, None, True, tool_calls=1, exceptions=0)
    ok = failures == 0
    return ProbeResult(1.0 if ok else 0.0,
                       None if ok else f"fails {failures} of {tries} of its own examples",
                       True, tool_calls=1, exceptions=0 if ok else 1)


def run_tools(theta: Theta, *, item: Item, source: str) -> ProbeResult:
    """How hard the agent checks its own work before submitting it.

    This is the component that decides whether the agent can tell a good interface from a bad one.
    At `none` it submits the first thing it wrote. At `audit` it opens the page in a browser and
    runs the same accessibility engine it will be judged by — which is the difference between
    guessing and knowing.
    """
    from ..webtasks import audit as web_audit

    cfg = theta.data.get("probe", {})
    mode = cfg.get("mode", "syntax") if cfg.get("enabled", True) else "none"
    schema_ok = int(theta.data.get("schema_version", 1)) >= 1 and mode != "none"
    if not schema_ok:
        # no check at all: every candidate scores the same, so extra samples are coin flips
        return ProbeResult(score=0.5, error=None, schema_ok=False, tool_calls=1)

    if getattr(item, "kind", "py") != "web":
        return _probe_code(item, source, mode)

    if mode == "syntax":
        # cheapest possible: does it even look like a document?
        low = (source or "").lower()
        ok = "<html" in low and "</html>" in low and "<body" in low
        return ProbeResult(1.0 if ok else 0.0, None if ok else "not a complete document", True,
                           tool_calls=1, exceptions=0 if ok else 1)

    a = web_audit(item, source)
    if mode == "render":
        # it loads and meets its functional requirements, but nothing is checked for the people
        # who cannot see it
        ok = a.rendered and not a.missing
        return ProbeResult(1.0 if ok else 0.0,
                           None if ok else (a.error or f"missing {a.missing[:2]}"), True,
                           tool_calls=1, exceptions=0 if ok else 1)

    # audit: the agent runs the real engine against its own page before submitting
    if not a.rendered:
        return ProbeResult(0.0, a.error or "did not render", True, tool_calls=1, exceptions=1)
    if a.missing:
        return ProbeResult(0.0, f"missing {a.missing[:2]}", True, tool_calls=1, exceptions=1)
    if a.critical:
        return ProbeResult(0.15, f"{a.critical} blocking violation(s): "
                                 f"{', '.join(v['id'] for v in a.violations[:3])}", True,
                           tool_calls=1, exceptions=1)
    if a.weighted:
        return ProbeResult(0.7, f"{a.weighted} weighted violation(s)", True, tool_calls=1)
    return ProbeResult(1.0, None, True, tool_calls=1)
