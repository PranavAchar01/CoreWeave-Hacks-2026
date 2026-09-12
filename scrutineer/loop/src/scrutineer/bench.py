"""A benchmark this project did not write, scored by tests it did not write.

Every number in the loop so far came from a task pool built here, which is the obvious objection:
an optimiser that invents its own exam. HumanEval is public, third-party, and graded by execution
against hidden unit tests, so the objection does not survive it.

The methodological trap is worth stating because it is easy to fall into. HumanEval has exactly
one test set. A harness whose pre-submit check runs those tests solves the benchmark by
construction and measures nothing. So the split discipline used everywhere else applies here: the
agent is handed `prompt` and nothing more — the signature and the docstring, examples included,
which is what a human would get — and `test` is held out and used only to score. The agent cannot
reach the scoreboard, by construction rather than by promise.
"""

from __future__ import annotations

import gzip
import json
import re
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

URL = "https://raw.githubusercontent.com/openai/human-eval/master/data/HumanEval.jsonl.gz"
CACHE = Path("state/humaneval.jsonl")
PLUS_URL = ("https://github.com/evalplus/humanevalplus_release/releases/download/"
            "v0.1.10/HumanEvalPlus.jsonl.gz")
PLUS_CACHE = Path("state/humanevalplus.jsonl")
# EvalPlus ships ~1000 extra inputs per problem. Running all of them on every candidate is the
# dominant cost of a lap, so it is capped — which means this is NOT official HumanEval+ pass@1
# and is never reported as such. It is differential testing against the reference on the base
# inputs plus this many of the extended ones.
PLUS_CAP = 200

# Coarse topics, so RETRIEVAL has something real to match a brief against. Derived from the
# prompt text rather than hand-labelled, because a hand label is one more thing to get wrong.
TOPICS = {
    "strings": r"\bstring|\bchar|substr|palindrom|prefix|suffix|upper|lower",
    "lists": r"\blist\b|array|element|\bindex\b|append",
    "math": r"\bprime|integer|divis|modul|factor|fibonacci|\bsum\b|round|decimal",
    "sorting": r"\bsort|order|ascend|descend|median|largest|smallest",
    "dicts": r"\bdict|\bkey\b|mapping|count of|frequency",
    "logic": r"\btrue\b|\bfalse\b|boolean|condition|\bif\b",
    "parsing": r"parse|split|delimit|bracket|paren|nested",
}


@dataclass(frozen=True)
class BenchItem:
    """Shaped like the local pool's Item so the evaluator, sandbox and driver need no special
    case beyond the kind flag."""

    id: str
    family: str
    prompt: str
    entry_point: str
    concepts: frozenset[str]
    difficulty: float
    tests: str                       # held out: scoring only, never shown to the agent
    reference: str = ""              # the canonical solution, used as the differential oracle
    inputs: tuple = ()               # base + capped extended inputs, held out with the tests
    atol: float = 0.0
    title: str = ""
    kind: str = "bench"
    reference_solution: str = ""
    example_args: tuple = ()
    example_repr: str = ""
    check_args: tuple = ()
    broken_variants: tuple = field(default_factory=tuple)

    @property
    def visible_example(self) -> str:
        """The doctest line the docstring already carries. Visible because the benchmark shows it
        to everybody; it is part of the prompt, not part of the answer key."""
        m = re.search(r">>>[^\n]*\n\s*([^\n]+)", self.prompt)
        return m.group(0).replace("\n", " ").strip() if m else ""

    def harness(self, candidate_src: str) -> str:
        """The scorer. Base HumanEval runs its own `check`; the extended variant differential-tests
        against the reference on many more inputs. Either way the agent never sees this."""
        if self.kind == "bench+":
            return differential(self, candidate_src)
        return (f"{candidate_src}\n\n{self.tests}\n\n"
                f"check({self.entry_point})\nprint('SCRUTINEER_PASS')\n")


def _topics(text: str) -> frozenset[str]:
    low = text.lower()
    hit = {name for name, pat in TOPICS.items() if re.search(pat, low)}
    return frozenset(hit or {"logic"})


def load(root: Path | None = None) -> list[dict]:
    cache = (root or Path(".")) / CACHE
    if cache.exists():
        return [json.loads(x) for x in cache.read_text().splitlines() if x.strip()]
    raw = gzip.decompress(urllib.request.urlopen(URL, timeout=60).read()).decode()
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(raw)
    return [json.loads(x) for x in raw.splitlines() if x.strip()]


def build_pool(root: Path | None = None) -> list[BenchItem]:
    out = []
    for r in load(root):
        num = int(r["task_id"].split("/")[1])
        body = r["prompt"]
        out.append(BenchItem(
            id=f"he{num:03d}",
            family=sorted(_topics(body))[0],
            title=r["entry_point"],
            prompt=body,
            entry_point=r["entry_point"],
            concepts=_topics(body),
            # length of the reference solution is a weak but honest proxy, and it is never shown
            difficulty=min(1.0, len(r.get("canonical_solution", "")) / 900),
            tests=r["test"],
        ))
    return out


def split(pool: list[BenchItem], *, n_practice: int = 30, n_held: int = 30,
          seed: int = 1994) -> tuple[list[BenchItem], list[BenchItem]]:
    """Disjoint halves, drawn deterministically. The agent practises on one and is scored on the
    other, which is the same discipline the local pool uses and the reason a gain means anything."""
    import random

    rng = random.Random(seed)
    idx = list(range(len(pool)))
    rng.shuffle(idx)
    take = idx[: n_practice + n_held]
    return ([pool[i] for i in take[:n_practice]], [pool[i] for i in take[n_practice:]])


def three_way(pool: list[BenchItem], seed: int = 1994
              ) -> tuple[list[BenchItem], list[BenchItem], list[BenchItem]]:
    """practice / season-sealed / final-held, disjoint.

    The season optimises against practice and gates itself on season-sealed. `final_held` is the
    30 problems the loop never sees at any point — not in a race, not in a replay, not in a gate —
    and it is the only set the headline number is measured on. It is deliberately the same slice
    `split()` returns, so a transfer run and a season run are quoted on identical problems.
    """
    import random

    rng = random.Random(seed)
    idx = list(range(len(pool)))
    rng.shuffle(idx)
    return ([pool[i] for i in idx[:30]],        # practice
            [pool[i] for i in idx[30:50]],      # season-sealed
            [pool[i] for i in idx[50:]])        # final held-out: everything else, never seen


def _plus(root: Path | None = None) -> dict[str, dict]:
    cache = (root or Path(".")) / PLUS_CACHE
    if not cache.exists():
        raw = gzip.decompress(urllib.request.urlopen(PLUS_URL, timeout=90).read()).decode()
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(raw)
    rows = [json.loads(x) for x in cache.read_text().splitlines() if x.strip()]
    return {r["task_id"]: r for r in rows}


def differential(item: BenchItem, candidate_src: str) -> str:
    """A program the sandbox runs: the candidate against the reference, input by input.

    EvalPlus's own method. The reference is defined first and captured, then the candidate
    shadows it, and every input is deep-copied per call because several of these functions mutate
    what they are given. Floats compare with the problem's tolerance.
    """
    return (
        f"{item.prompt}{item.reference}\n"
        f"_ref = {item.entry_point}\n\n"
        f"{candidate_src}\n"
        f"_cand = {item.entry_point}\n\n"
        "import copy, math\n"
        f"_ATOL = {item.atol!r}\n"
        f"_INPUTS = {list(item.inputs)!r}\n"
        "def _eq(a, b):\n"
        "    if isinstance(a, float) or isinstance(b, float):\n"
        "        try:\n"
        "            return math.isclose(a, b, rel_tol=1e-6, abs_tol=max(_ATOL, 1e-6))\n"
        "        except TypeError:\n"
        "            return a == b\n"
        "    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):\n"
        "        return len(a) == len(b) and all(_eq(x, y) for x, y in zip(a, b))\n"
        "    return a == b\n"
        "for _i in _INPUTS:\n"
        "    _want = _ref(*copy.deepcopy(_i))\n"
        "    _got = _cand(*copy.deepcopy(_i))\n"
        "    assert _eq(_got, _want), (_i, _got, _want)\n"
        "print('SCRUTINEER_PASS')\n"
    )


def build_pool_plus(root: Path | None = None) -> list[BenchItem]:
    """The same 164 prompts, scored by differential testing on many more inputs.

    Base HumanEval is saturated for a capable model — the baseline harness already solved 26 of
    30, leaving almost no room for a harness to show anything. The extended inputs are what make
    the measurement able to move.
    """
    plus = _plus(root)
    out = []
    for it in build_pool(root):
        num = int(it.id[2:])
        row = plus.get(f"HumanEval/{num}")
        if not row:
            continue
        ins = [tuple(x) for x in (row.get("base_input") or [])]
        ins += [tuple(x) for x in (row.get("plus_input") or [])][:PLUS_CAP]
        out.append(BenchItem(
            id=it.id, family=it.family, title=it.title, prompt=it.prompt,
            entry_point=it.entry_point, concepts=it.concepts, difficulty=it.difficulty,
            tests=it.tests, reference=row.get("canonical_solution", ""),
            inputs=tuple(ins), atol=float(row.get("atol") or 0.0), kind="bench+",
        ))
    return out
