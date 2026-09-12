"""BigCodeBench-Hard: a benchmark with room to move.

HumanEval could not answer the question. Its baseline failed 6 of 114 here, so the most a harness
could ever show was five points and no difference on it could reach significance. BigCodeBench-Hard
is the opposite: 148 tasks calling across 83 libraries, with published scores for strong models in
the low thirties. There is room for a harness to be worth something.

Same discipline as before. The agent is handed the prompt — imports, signature and docstring — and
the unittest module that grades it is held out. Splits are disjoint and the loop never sees the
final set.

One honest exclusion. A handful of tasks need system binaries or half-gigabyte frameworks
(tesseract, GDAL, tensorflow, audio codecs). Those are dropped on dependency grounds, decided
before any run and applied identically to both harnesses, so the exclusion cannot favour either.
`SKIPPED_LIBS` is the whole list and `build_pool` reports what it dropped.
"""

from __future__ import annotations

import ast
import io
import json
import re
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

URL = ("https://huggingface.co/api/datasets/bigcode/bigcodebench-hard/parquet/"
       "default/v0.1.0_hf/0.parquet")
CACHE = Path("state/bigcodebench-hard.jsonl")

# needs a system binary, a build toolchain, or a framework too large to justify here
SKIPPED_LIBS = {"tensorflow", "keras", "librosa", "soundfile", "geopandas", "shapely",
                "pytesseract", "wordcloud", "gensim", "xlwt"}

# Tasks whose own reference implementation fails inside the sandbox, every one of them because it
# needs live network and the sandbox runs --network none. A candidate here would be graded against
# a broken oracle, so the task cannot score anything and is dropped.
#
# This list is not a judgement call. It is the output of running all 140 canonical solutions
# through the scorer (`state/bcb_validation.json`), decided before any candidate existed, so it
# cannot favour one harness over another. Re-derive it by rerunning that validation.
NETWORK_BOUND = {"bcb0101", "bcb0590", "bcb1006", "bcb1012", "bcb1020", "bcb1040"}

TOPICS = {
    "data": r"\bpandas|dataframe|\bcsv\b|numpy|array",
    "plotting": r"matplotlib|seaborn|\bplot|\baxes\b|chart",
    "learning": r"sklearn|regress|cluster|classif|train",
    "files": r"\bos\.|pathlib|directory|\bfile\b|zip|shutil",
    "network": r"requests|urllib|socket|ftp|http|server",
    "text": r"\bre\.|regex|string|json|xml|html|parse",
    "crypto": r"hashlib|crypto|rsa|encrypt|base64",
    "stats": r"scipy|statistic|\bmean\b|distribution|random",
}


@dataclass(frozen=True)
class BcbItem:
    id: str
    family: str
    prompt: str
    entry_point: str
    concepts: frozenset[str]
    difficulty: float
    tests: str                       # held out: the unittest module, scoring only
    title: str = ""
    kind: str = "bcb"
    reference: str = ""
    libs: tuple = ()
    reference_solution: str = ""
    example_args: tuple = ()
    example_repr: str = ""
    check_args: tuple = ()
    broken_variants: tuple = field(default_factory=tuple)

    @property
    def visible_example(self) -> str:
        m = re.search(r">>>[^\n]*\n\s*([^\n]+)", self.prompt)
        return m.group(0).replace("\n", " ").strip() if m else ""

    def harness(self, candidate_src: str) -> str:
        """Candidate, then the benchmark's own unittest module, run headlessly.

        matplotlib must be forced to a non-interactive backend before anything imports pyplot or
        roughly a third of these tasks hang waiting for a window that will never open.
        """
        return (
            "import matplotlib\nmatplotlib.use('Agg')\n"
            "import warnings\nwarnings.filterwarnings('ignore')\n"
            f"{candidate_src}\n\n{self.tests}\n\n"
            "import unittest\n"
            "_r = unittest.TextTestRunner(verbosity=0).run("
            "unittest.defaultTestLoader.loadTestsFromTestCase(TestCases))\n"
            "assert _r.wasSuccessful(), _r.errors + _r.failures\n"
            "print('SCRUTINEER_PASS')\n"
        )


def _rows(root: Path | None = None) -> list[dict]:
    cache = (root or Path(".")) / CACHE
    if not cache.exists():
        import pyarrow.parquet as pq

        raw = urllib.request.urlopen(URL, timeout=120).read()
        rows = pq.read_table(io.BytesIO(raw)).to_pylist()
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text("\n".join(json.dumps(r, default=str) for r in rows))
    return [json.loads(x) for x in cache.read_text().splitlines() if x.strip()]


def _libs(row: dict) -> tuple:
    v = row.get("libs")
    if isinstance(v, list):
        return tuple(v)
    try:
        return tuple(ast.literal_eval(v))
    except Exception:
        return ()


def _topics(text: str) -> frozenset[str]:
    low = text.lower()
    hit = {n for n, pat in TOPICS.items() if re.search(pat, low)}
    return frozenset(hit or {"text"})


def build_pool(root: Path | None = None) -> list[BcbItem]:
    out, dropped = [], []
    for r in _rows(root):
        libs = _libs(r)
        if set(libs) & SKIPPED_LIBS:
            dropped.append(r["task_id"])
            continue
        num = r["task_id"].split("/")[1]
        if f"bcb{int(num):04d}" in NETWORK_BOUND:
            dropped.append(r["task_id"])
            continue
        out.append(BcbItem(
            id=f"bcb{int(num):04d}",
            family=sorted(_topics(r["complete_prompt"]))[0],
            title=", ".join(libs[:3]),
            prompt=r["complete_prompt"],
            entry_point=r["entry_point"],
            concepts=_topics(r["complete_prompt"]),
            difficulty=min(1.0, len(r.get("canonical_solution", "")) / 1200),
            tests=r["test"],
            reference=r.get("canonical_solution", ""),
            libs=libs,
        ))
    build_pool.dropped = dropped  # type: ignore[attr-defined]
    return out


def three_way(pool: list[BcbItem], seed: int = 1994
              ) -> tuple[list[BcbItem], list[BcbItem], list[BcbItem]]:
    """practice / season-sealed / final held-out. The loop never sees the third set."""
    import random

    rng = random.Random(seed)
    idx = list(range(len(pool)))
    rng.shuffle(idx)
    n = len(pool)
    a, b = 34, 24
    return ([pool[i] for i in idx[:a]],
            [pool[i] for i in idx[a:a + b]],
            [pool[i] for i in idx[a + b:n]])
