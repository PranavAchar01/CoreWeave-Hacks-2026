"""The circuits: 120 execution-verifiable Python synthesis items, split 30 QUALI / 30 SEALED / 60 reserve.

A lap is one item. `pass` is decided by running hidden tests in a sandbox, never by a judge model,
so the official score sits on rung 2 of the verification hierarchy. Every item declares the
`concepts` its solution needs; that is what makes AERO's context assembly causally load-bearing
and therefore what makes per-role credit assignment mean something.
"""

from __future__ import annotations

import json
import random
import re
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

Variant = tuple[str, str, str]  # (prompt, reference_solution, tests)


@dataclass(frozen=True)
class Item:
    id: str
    family: str
    prompt: str
    entry_point: str
    concepts: frozenset[str]
    difficulty: float
    reference_solution: str
    tests: str
    example_args: tuple = ()
    example_repr: str = ""
    check_args: tuple = ()
    # corruptions verified at build time to actually change this item's behaviour, so a lap the
    # driver failed is never secretly a lap it passed
    broken_variants: tuple = ()

    @property
    def visible_example(self) -> str:
        """One worked example, the way a HumanEval-style docstring carries one. It is visible to
        the driver and to DATA's probe; the hidden tests are neither."""
        if not self.example_repr:
            return ""
        args = ", ".join(repr(a) for a in self.example_args)
        return f"{self.entry_point}({args}) == {self.example_repr}"

    def harness(self, candidate_src: str) -> str:
        """Full program the sandbox executes: candidate source + hidden tests."""
        return f"{candidate_src}\n\n{self.tests}\nprint('SCRUTINEER_PASS')\n"


def _f(name: str, concepts: list[str], difficulty: float, fn: Callable[[int], Variant]) -> dict:
    return {"name": name, "concepts": concepts, "difficulty": difficulty, "fn": fn}


# --------------------------------------------------------------------------------------------
# Twenty-four families, five variants each. Variants change a rule, not just a constant, so the
# reference solutions differ and a model cannot pattern-match one family from another's answer.
# --------------------------------------------------------------------------------------------


def _derive(solution: str, entry: str, calls: list[tuple]) -> str:
    """Generate assertions by running the reference solution on fixed inputs.

    Hand-computed expectations are exactly the kind of thing that rots when a variant's rule
    changes, so for the families whose variants change semantics the ground truth is the
    reference itself, evaluated once at build time.
    """
    ns: dict = {}
    exec(solution, ns)  # noqa: S102 - our own source, generated above
    fn = ns[entry]
    lines = []
    for args in calls:
        rendered = ", ".join(repr(a) for a in args)
        try:
            value = fn(*args)
        except Exception as e:
            # raising is part of some variants' contract, so assert the exception rather than
            # dropping the case
            lines.append(f"try:\n    {entry}({rendered})\n    raise AssertionError('expected "
                         f"{type(e).__name__}')\nexcept {type(e).__name__}:\n    pass")
            continue
        lines.append(f"assert {entry}({rendered}) == {value!r}")
    return "\n".join(lines) + "\n"


def _count_chars(v: int) -> Variant:
    sets = ["aeiou", "aeiouy", "bcdfghjklmnpqrstvwxyz", "aeiou0123456789", "xyz"]
    s = sets[v]
    return (
        f"Write `count_chars(text)` returning how many characters of `text` are in the set {s!r}. "
        "Comparison is case-insensitive.",
        f"def count_chars(text):\n    s = set({s!r})\n    return sum(1 for c in text.lower() if c in s)\n",
        "assert count_chars('') == 0\n"
        f"assert count_chars('AbC') == sum(1 for c in 'abc' if c in {s!r})\n"
        f"assert count_chars('Zz9 Qq') == sum(1 for c in 'zz9 qq' if c in {s!r})\n",
    )


def _two_sum(v: int) -> Variant:
    modes = ["indices", "values", "count", "first_pair", "exists"]
    m = modes[v]
    body = {
        "indices": "    seen = {}\n    for i, x in enumerate(nums):\n        if target - x in seen:\n            return [seen[target - x], i]\n        seen[x] = i\n    return []\n",
        "values": "    seen = set()\n    for x in nums:\n        if target - x in seen:\n            return sorted([target - x, x])\n        seen.add(x)\n    return []\n",
        "count": "    from collections import Counter\n    c = Counter(nums)\n    total = 0\n    for x in list(c):\n        y = target - x\n        if y in c:\n            total += c[x] * c[y] if x != y else c[x] * (c[x] - 1)\n    return total // 2\n",
        "first_pair": "    seen = set()\n    for x in nums:\n        if target - x in seen:\n            return (target - x, x)\n        seen.add(x)\n    return None\n",
        "exists": "    seen = set()\n    for x in nums:\n        if target - x in seen:\n            return True\n        seen.add(x)\n    return False\n",
    }[m]
    expect = {
        "indices": "assert two_sum([2, 7, 11, 15], 9) == [0, 1]\nassert two_sum([1], 2) == []\n",
        "values": "assert two_sum([2, 7, 11, 15], 9) == [2, 7]\nassert two_sum([1], 2) == []\n",
        "count": "assert two_sum([1, 1, 2, 2], 3) == 4\nassert two_sum([1], 2) == 0\n",
        "first_pair": "assert two_sum([2, 7, 11], 9) == (2, 7)\nassert two_sum([1], 2) is None\n",
        "exists": "assert two_sum([2, 7, 11], 9) is True\nassert two_sum([1], 2) is False\n",
    }[m]
    return (
        f"Write `two_sum(nums, target)` that returns the {m.replace('_', ' ')} for the pair of "
        "distinct positions whose values sum to `target`.",
        f"def two_sum(nums, target):\n{body}",
        expect,
    )


def _palindrome(v: int) -> Variant:
    rules = [
        ("alphanumeric characters only, case-insensitive", "''.join(c for c in text.lower() if c.isalnum())"),
        ("letters only, case-insensitive", "''.join(c for c in text.lower() if c.isalpha())"),
        ("the whole string as given", "text"),
        ("digits only", "''.join(c for c in text if c.isdigit())"),
        ("words rather than characters", "text.lower().split()"),
    ]
    desc, expr = rules[v]
    sol = f"def is_palindrome(text):\n    s = {expr}\n    return list(s) == list(s)[::-1]\n"
    tests = _derive(sol, "is_palindrome", [("",), ("A man, a plan, a canal: Panama",), ("ab",), ("aba",)])
    return (
        f"Write `is_palindrome(text)` deciding whether `text` reads the same backwards, considering {desc}.",
        sol,
        tests,
    )


def _rle(v: int) -> Variant:
    seps = ["", "-", ":", "|", ","]
    s = seps[v]
    return (
        f"Write `encode(text)` returning the run-length encoding of `text` as "
        f"`char + count` groups joined by {s!r}.",
        "def encode(text):\n"
        "    out = []\n"
        "    i = 0\n"
        "    while i < len(text):\n"
        "        j = i\n"
        "        while j < len(text) and text[j] == text[i]:\n"
        "            j += 1\n"
        "        out.append(text[i] + str(j - i))\n"
        "        i = j\n"
        f"    return {s!r}.join(out)\n",
        "assert encode('') == ''\n"
        f"assert encode('aaabb') == {s!r}.join(['a3', 'b2'])\n"
        f"assert encode('abc') == {s!r}.join(['a1', 'b1', 'c1'])\n",
    )


def _flatten(v: int) -> Variant:
    depths = [None, 1, 2, 3, 0]
    d = depths[v]
    if d is None:
        body = ("def flatten(xs):\n    out = []\n    for x in xs:\n        if isinstance(x, list):\n"
                "            out.extend(flatten(x))\n        else:\n            out.append(x)\n    return out\n")
        desc = "completely"
        t = "assert flatten([1, [2, [3, [4]]]]) == [1, 2, 3, 4]\n"
    else:
        body = (f"def flatten(xs, _d={d}):\n    out = []\n    for x in xs:\n"
                "        if isinstance(x, list) and _d > 0:\n            out.extend(flatten(x, _d - 1))\n"
                "        else:\n            out.append(x)\n    return out\n")
        desc = f"to a maximum depth of {d}"
        t = f"assert flatten([1, [2, [3, [4]]]]) == {_flat_expect(d)!r}\n"
    return (f"Write `flatten(xs)` flattening a nested list {desc}.", body, t + "assert flatten([]) == []\n")


def _flat_expect(d: int) -> list:
    src: list = [1, [2, [3, [4]]]]
    for _ in range(d):
        out: list = []
        for x in src:
            out.extend(x) if isinstance(x, list) else out.append(x)
        src = out
    return src


def _gcd_list(v: int) -> Variant:
    ops = ["gcd", "lcm", "gcd of absolute values", "gcd ignoring zeros", "lcm modulo 1000000007"]
    o = ops[v]
    bodies = [
        "    from math import gcd\n    from functools import reduce\n    return reduce(gcd, nums, 0)\n",
        "    from math import lcm\n    from functools import reduce\n    return reduce(lcm, nums, 1)\n",
        "    from math import gcd\n    from functools import reduce\n    return reduce(gcd, (abs(n) for n in nums), 0)\n",
        "    from math import gcd\n    from functools import reduce\n    vals = [n for n in nums if n]\n    return reduce(gcd, vals, 0)\n",
        "    from math import lcm\n    from functools import reduce\n    return reduce(lcm, nums, 1) % 1000000007\n",
    ]
    checks = [
        "assert combine([12, 18]) == 6\nassert combine([]) == 0\n",
        "assert combine([4, 6]) == 12\nassert combine([]) == 1\n",
        "assert combine([-12, 18]) == 6\nassert combine([]) == 0\n",
        "assert combine([0, 12, 18]) == 6\nassert combine([0]) == 0\n",
        "assert combine([4, 6]) == 12\nassert combine([]) == 1\n",
    ]
    return (f"Write `combine(nums)` returning the {o} of the integers in `nums`.",
            f"def combine(nums):\n{bodies[v]}", checks[v])


def _matrix(v: int) -> Variant:
    ops = ["transpose", "rotate 90 degrees clockwise", "rotate 90 degrees anticlockwise",
           "reflect horizontally", "flatten in row-major order"]
    bodies = [
        "    return [list(r) for r in zip(*m)]\n",
        "    return [list(r) for r in zip(*m[::-1])]\n",
        "    return [list(r) for r in zip(*m)][::-1]\n",
        "    return [r[::-1] for r in m]\n",
        "    return [x for r in m for x in r]\n",
    ]
    checks = [
        "assert transform([[1, 2], [3, 4]]) == [[1, 3], [2, 4]]\n",
        "assert transform([[1, 2], [3, 4]]) == [[3, 1], [4, 2]]\n",
        "assert transform([[1, 2], [3, 4]]) == [[2, 4], [1, 3]]\n",
        "assert transform([[1, 2], [3, 4]]) == [[2, 1], [4, 3]]\n",
        "assert transform([[1, 2], [3, 4]]) == [1, 2, 3, 4]\n",
    ]
    return (f"Write `transform(m)` returning the {ops[v]} of the rectangular matrix `m`.",
            f"def transform(m):\n{bodies[v]}", checks[v] + "assert transform([]) == []\n")


def _top_k(v: int) -> Variant:
    k = [1, 2, 3, 2, 1][v]
    tie = ["smallest value first", "largest value first", "smallest value first",
           "insertion order", "largest value first"][v]
    key = {
        "smallest value first": "sorted(c, key=lambda x: (-c[x], x))",
        "largest value first": "sorted(c, key=lambda x: (-c[x], -x))",
        "insertion order": "sorted(c, key=lambda x: (-c[x], list(c).index(x)))",
    }[tie]
    return (
        f"Write `top_k(nums)` returning the {k} most frequent values in `nums`, "
        f"breaking ties by {tie}.",
        f"def top_k(nums):\n    from collections import Counter\n    c = Counter(nums)\n"
        f"    return {key}[:{k}]\n",
        f"assert len(top_k([1, 1, 2, 2, 3])) == min({k}, 3)\nassert top_k([]) == []\n"
        f"assert top_k([5, 5, 5, 1])[0] == 5\n",
    )


def _brackets(v: int) -> Variant:
    pairs = ["()", "()[]", "()[]{}", "()<>", "[]{}"]
    p = pairs[v]
    mapping = {p[i + 1]: p[i] for i in range(0, len(p), 2)}
    return (
        f"Write `balanced(text)` deciding whether the brackets {p!r} in `text` are balanced and "
        "correctly nested. Other characters are ignored.",
        f"def balanced(text):\n    m = {mapping!r}\n    stack = []\n    for c in text:\n"
        "        if c in m.values():\n            stack.append(c)\n"
        "        elif c in m:\n            if not stack or stack.pop() != m[c]:\n                return False\n"
        "    return not stack\n",
        "assert balanced('') is True\n"
        f"assert balanced({p[0] + p[1]!r}) is True\n"
        f"assert balanced({p[1] + p[0]!r}) is False\n",
    )


def _binary_search(v: int) -> Variant:
    modes = ["leftmost index", "rightmost index", "insertion point", "-1 when absent", "count of occurrences"]
    bodies = [
        "    import bisect\n    i = bisect.bisect_left(xs, t)\n    return i\n",
        "    import bisect\n    return bisect.bisect_right(xs, t) - 1\n",
        "    import bisect\n    return bisect.bisect_left(xs, t)\n",
        "    import bisect\n    i = bisect.bisect_left(xs, t)\n    return i if i < len(xs) and xs[i] == t else -1\n",
        "    import bisect\n    return bisect.bisect_right(xs, t) - bisect.bisect_left(xs, t)\n",
    ]
    checks = [
        "assert search([1, 2, 2, 3], 2) == 1\n", "assert search([1, 2, 2, 3], 2) == 2\n",
        "assert search([1, 3], 2) == 1\n", "assert search([1, 3], 2) == -1\n",
        "assert search([1, 2, 2, 3], 2) == 2\n",
    ]
    return (f"Write `search(xs, t)` returning the {modes[v]} for `t` in the sorted list `xs`.",
            f"def search(xs, t):\n{bodies[v]}", checks[v])


def _intervals(v: int) -> Variant:
    modes = ["merge overlapping intervals", "merge intervals that touch or overlap",
             "return the total covered length", "return the number of merged groups",
             "return the largest gap between groups"]
    core = ("    if not iv:\n        return %s\n    iv = sorted(iv)\n    out = [list(iv[0])]\n"
            "    for a, b in iv[1:]:\n        if a %s out[-1][1]:\n            out[-1][1] = max(out[-1][1], b)\n"
            "        else:\n            out.append([a, b])\n")
    tails = [
        (core % ("[]", "<") + "    return [tuple(x) for x in out]\n",
         "assert merge([(1, 3), (2, 4)]) == [(1, 4)]\nassert merge([]) == []\n"),
        (core % ("[]", "<=") + "    return [tuple(x) for x in out]\n",
         "assert merge([(1, 2), (2, 3)]) == [(1, 3)]\nassert merge([]) == []\n"),
        (core % ("0", "<") + "    return sum(b - a for a, b in out)\n",
         "assert merge([(1, 3), (2, 4)]) == 3\nassert merge([]) == 0\n"),
        (core % ("0", "<") + "    return len(out)\n",
         "assert merge([(1, 3), (2, 4)]) == 1\nassert merge([]) == 0\n"),
        (core % ("0", "<") + "    gaps = [out[i + 1][0] - out[i][1] for i in range(len(out) - 1)]\n"
                              "    return max(gaps) if gaps else 0\n",
         "assert merge([(1, 2), (5, 6)]) == 3\nassert merge([]) == 0\n"),
    ]
    body, check = tails[v]
    return (f"Write `merge(iv)` over a list of `(start, end)` integer intervals that will {modes[v]}.",
            f"def merge(iv):\n{body}", check)


def _word_freq(v: int) -> Variant:
    modes = ["a dict of word to count", "the most common word", "the number of distinct words",
             "words appearing more than once, sorted", "the total word count"]
    bodies = [
        "    from collections import Counter\n    return dict(Counter(text.lower().split()))\n",
        "    from collections import Counter\n    c = Counter(text.lower().split())\n"
        "    return c.most_common(1)[0][0] if c else None\n",
        "    return len(set(text.lower().split()))\n",
        "    from collections import Counter\n    c = Counter(text.lower().split())\n"
        "    return sorted(w for w, n in c.items() if n > 1)\n",
        "    return len(text.split())\n",
    ]
    checks = [
        "assert words('a A b') == {'a': 2, 'b': 1}\n", "assert words('a A b') == 'a'\n",
        "assert words('a A b') == 2\n", "assert words('a A b') == ['a']\n", "assert words('a A b') == 3\n",
    ]
    return (f"Write `words(text)` returning {modes[v]}. Words are whitespace-separated and compared "
            "case-insensitively.", f"def words(text):\n{bodies[v]}", checks[v])


def _fib(v: int) -> Variant:
    starts = [(0, 1), (1, 1), (2, 1), (0, 2), (1, 3)]
    a0, a1 = starts[v]
    return (
        f"Write `seq(n)` returning term `n` (0-indexed) of the sequence starting {a0}, {a1} where "
        "each later term is the sum of the previous two. It must handle n up to 500.",
        f"def seq(n):\n    a, b = {a0}, {a1}\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n",
        f"assert seq(0) == {a0}\nassert seq(1) == {a1}\nassert seq(2) == {a0 + a1}\n"
        "assert isinstance(seq(200), int)\n",
    )


def _digit_root(v: int) -> Variant:
    bases = [10, 10, 9, 16, 2]
    modes = ["repeatedly sum the digits until one digit remains", "sum the digits once",
             "repeatedly sum the base-9 digits until one remains", "sum the hexadecimal digits once",
             "count the one bits"]
    bodies = [
        "    n = abs(n)\n    while n > 9:\n        n = sum(int(c) for c in str(n))\n    return n\n",
        "    return sum(int(c) for c in str(abs(n)))\n",
        "    n = abs(n)\n    while n > 8:\n        s = 0\n        while n:\n            s += n % 9\n            n //= 9\n        n = s\n    return n\n",
        "    return sum(int(c, 16) for c in format(abs(n), 'x'))\n",
        "    return bin(abs(n)).count('1')\n",
    ]
    checks = [
        "assert root(0) == 0\nassert root(38) == 2\n", "assert root(38) == 11\nassert root(0) == 0\n",
        "assert root(0) == 0\nassert root(80) == 8\n", "assert root(255) == 30\nassert root(0) == 0\n",
        "assert root(7) == 3\nassert root(0) == 0\n",
    ]
    _ = bases[v]
    return (f"Write `root(n)` that will {modes[v]} for a non-negative integer `n`.",
            f"def root(n):\n{bodies[v]}", checks[v])


def _longest_unique(v: int) -> Variant:
    modes = ["length of the longest substring without repeating characters",
             "the substring itself", "length allowing one repeat",
             "length of the longest run of a single character", "number of distinct characters"]
    bodies = [
        "    seen = {}\n    best = start = 0\n    for i, c in enumerate(s):\n"
        "        if c in seen and seen[c] >= start:\n            start = seen[c] + 1\n"
        "        seen[c] = i\n        best = max(best, i - start + 1)\n    return best\n",
        "    seen = {}\n    best = (0, 0)\n    start = 0\n    for i, c in enumerate(s):\n"
        "        if c in seen and seen[c] >= start:\n            start = seen[c] + 1\n"
        "        seen[c] = i\n"
        "        if i - start + 1 > best[1] - best[0]:\n            best = (start, i + 1)\n"
        "    return s[best[0]:best[1]]\n",
        "    from collections import Counter\n    c = Counter()\n    best = start = 0\n"
        "    for i, ch in enumerate(s):\n        c[ch] += 1\n"
        "        while sum(v - 1 for v in c.values() if v > 1) > 1:\n"
        "            c[s[start]] -= 1\n            start += 1\n"
        "        best = max(best, i - start + 1)\n    return best\n",
        "    best = run = 0\n    prev = None\n    for c in s:\n"
        "        run = run + 1 if c == prev else 1\n        prev = c\n        best = max(best, run)\n    return best\n",
        "    return len(set(s))\n",
    ]
    checks = [
        "assert window('abcabcbb') == 3\nassert window('') == 0\n",
        "assert window('abcabcbb') == 'abc'\nassert window('') == ''\n",
        "assert window('') == 0\nassert window('aab') == 3\n",
        "assert window('aab') == 2\nassert window('') == 0\n",
        "assert window('aab') == 2\nassert window('') == 0\n",
    ]
    return (f"Write `window(s)` returning the {modes[v]}.", f"def window(s):\n{bodies[v]}", checks[v])


def _chunk(v: int) -> Variant:
    n = [2, 3, 4, 2, 5][v]
    pad = v in (3, 4)
    body = (f"    out = [xs[i:i + {n}] for i in range(0, len(xs), {n})]\n"
            + (f"    if out and len(out[-1]) < {n}:\n        out[-1] = out[-1] + [None] * ({n} - len(out[-1]))\n"
               if pad else "")
            + "    return out\n")
    tail = "" if not pad else f", padded with None to length {n}"
    return (f"Write `chunk(xs)` splitting `xs` into consecutive lists of at most {n} elements{tail}.",
            f"def chunk(xs):\n{body}",
            f"assert chunk([]) == []\nassert chunk(list(range({n}))) == [list(range({n}))]\n"
            f"assert len(chunk(list(range({n} + 1)))) == 2\n")


def _anagram(v: int) -> Variant:
    modes = ["exact", "ignoring case", "ignoring case and spaces", "ignoring non-letters",
             "ignoring case, and returning the sorted differing letters instead of a bool"]
    norm = [
        "{x}",
        "{x}.lower()",
        "{x}.lower().replace(' ', '')",
        "''.join(c for c in {x}.lower() if c.isalpha())",
        "{x}.lower()",
    ][v]
    if v == 4:
        sol = ("def anagram(a, b):\n    from collections import Counter\n"
               "    ca, cb = Counter(a.lower()), Counter(b.lower())\n"
               "    return sorted((ca - cb) + (cb - ca))\n")
    else:
        sol = ("def anagram(a, b):\n    from collections import Counter\n"
               f"    na = {norm.format(x='a')}\n    nb = {norm.format(x='b')}\n"
               "    return Counter(na) == Counter(nb)\n")
    tests = _derive(sol, "anagram", [("ab", "ba"), ("ab", "bc"), ("A b", "B a"), ("", "")])
    return (f"Write `anagram(a, b)` deciding whether `a` and `b` are anagrams, {modes[v]}.", sol, tests)


def _spiral(v: int) -> Variant:
    modes = ["clockwise from the top-left", "anticlockwise from the top-left",
             "clockwise, returning only the border", "the first row then the last column",
             "clockwise, returning the sum"]
    spiral = ("    out = []\n    m = [row[:] for row in m]\n    while m:\n        out += m.pop(0)\n"
              "        m = [list(r) for r in zip(*m)][::-1]\n")
    bodies = [
        spiral + "    return out\n",
        "    out = []\n    m = [row[:] for row in m]\n    while m:\n        out += m.pop(0)\n"
        "        m = [list(r) for r in zip(*m[::-1])]\n    return out\n",
        "    if not m:\n        return []\n    out = list(m[0])\n    out += [r[-1] for r in m[1:-1]]\n"
        "    if len(m) > 1:\n        out += list(m[-1])[::-1]\n"
        "    out += [r[0] for r in m[1:-1]][::-1]\n    return out\n",
        "    if not m:\n        return []\n    return list(m[0]) + [r[-1] for r in m[1:]]\n",
        spiral + "    return sum(out)\n",
    ]
    checks = [
        "assert order([[1, 2], [3, 4]]) == [1, 2, 4, 3]\n", "assert order([[1, 2], [3, 4]]) == [1, 2, 3, 4]\n",
        "assert order([[1, 2], [3, 4]]) == [1, 2, 4, 3]\n", "assert order([[1, 2], [3, 4]]) == [1, 2, 4]\n",
        "assert order([[1, 2], [3, 4]]) == 10\n",
    ]
    sol = f"def order(m):\n{bodies[v]}"
    return (f"Write `order(m)` returning the elements of matrix `m` in spiral order, {modes[v]}.",
            sol, checks[v] + _derive(sol, "order", [([],), ([[7]],)]))


def _base_convert(v: int) -> Variant:
    b = [2, 8, 16, 3, 36][v]
    return (
        f"Write `convert(n)` returning the base-{b} representation of a non-negative integer `n` as a "
        "lowercase string, with '0' for zero.",
        "def convert(n):\n    digits = '0123456789abcdefghijklmnopqrstuvwxyz'\n"
        "    if n == 0:\n        return '0'\n    out = []\n    while n:\n"
        f"        n, r = divmod(n, {b})\n        out.append(digits[r])\n    return ''.join(reversed(out))\n",
        "assert convert(0) == '0'\n"
        f"assert convert({b}) == '10'\n"
        f"assert convert({b} * {b}) == '100'\n",
    )


def _group_parity(v: int) -> Variant:
    modes = ["evens then odds, each keeping input order", "odds then evens",
             "a dict with keys 'even' and 'odd'", "evens only", "a tuple (evens, odds)"]
    bodies = [
        "    return [x for x in xs if x % 2 == 0] + [x for x in xs if x % 2]\n",
        "    return [x for x in xs if x % 2] + [x for x in xs if x % 2 == 0]\n",
        "    return {'even': [x for x in xs if x % 2 == 0], 'odd': [x for x in xs if x % 2]}\n",
        "    return [x for x in xs if x % 2 == 0]\n",
        "    return ([x for x in xs if x % 2 == 0], [x for x in xs if x % 2])\n",
    ]
    checks = [
        "assert group([1, 2, 3, 4]) == [2, 4, 1, 3]\n", "assert group([1, 2, 3, 4]) == [1, 3, 2, 4]\n",
        "assert group([1, 2]) == {'even': [2], 'odd': [1]}\n", "assert group([1, 2]) == [2]\n",
        "assert group([1, 2]) == ([2], [1])\n",
    ]
    return (f"Write `group(xs)` returning {modes[v]}.", f"def group(xs):\n{bodies[v]}", checks[v])


def _whitespace(v: int) -> Variant:
    modes = ["collapse every run of whitespace to a single space and strip the ends",
             "remove all whitespace", "collapse runs of spaces only, keeping newlines",
             "strip the ends only", "replace every whitespace run with an underscore"]
    bodies = [
        "    import re\n    return re.sub(r'\\s+', ' ', text).strip()\n",
        "    import re\n    return re.sub(r'\\s+', '', text)\n",
        "    import re\n    return re.sub(r'[ \\t]+', ' ', text)\n",
        "    return text.strip()\n",
        "    import re\n    return re.sub(r'\\s+', '_', text)\n",
    ]
    checks = [
        "assert squeeze('  a   b ') == 'a b'\n", "assert squeeze(' a b ') == 'ab'\n",
        "assert squeeze('a  b') == 'a b'\n", "assert squeeze('  a  ') == 'a'\n",
        "assert squeeze('a  b') == 'a_b'\n",
    ]
    return (f"Write `squeeze(text)` that will {modes[v]}.", f"def squeeze(text):\n{bodies[v]}",
            checks[v] + "assert squeeze('') == ''\n")


def _days_between(v: int) -> Variant:
    modes = ["the number of days between two ISO dates", "the absolute number of days",
             "the number of whole weeks between them", "the weekday name of the first date",
             "whether the two dates fall in the same month"]
    bodies = [
        "    from datetime import date\n    a, b = date.fromisoformat(x), date.fromisoformat(y)\n    return (b - a).days\n",
        "    from datetime import date\n    a, b = date.fromisoformat(x), date.fromisoformat(y)\n    return abs((b - a).days)\n",
        "    from datetime import date\n    a, b = date.fromisoformat(x), date.fromisoformat(y)\n    return abs((b - a).days) // 7\n",
        "    from datetime import date\n    return date.fromisoformat(x).strftime('%A')\n",
        "    from datetime import date\n    a, b = date.fromisoformat(x), date.fromisoformat(y)\n    return (a.year, a.month) == (b.year, b.month)\n",
    ]
    checks = [
        "assert span('2026-01-01', '2026-01-03') == 2\n", "assert span('2026-01-03', '2026-01-01') == 2\n",
        "assert span('2026-01-01', '2026-01-15') == 2\n", "assert span('2026-01-01', '2026-01-02') == 'Thursday'\n",
        "assert span('2026-01-01', '2026-01-31') is True\n",
    ]
    return (f"Write `span(x, y)` over two ISO-8601 date strings returning {modes[v]}.",
            f"def span(x, y):\n{bodies[v]}", checks[v])


def _roman(v: int) -> Variant:
    modes = ["convert a Roman numeral to an integer", "convert an integer to a Roman numeral",
             "validate a Roman numeral", "count the numeral's characters",
             "convert a Roman numeral to an integer, additive rules only"]
    bodies = [
        "    m = {'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000}\n"
        "    total = 0\n    for i, c in enumerate(s):\n"
        "        v = m[c]\n        if i + 1 < len(s) and v < m[s[i + 1]]:\n            total -= v\n"
        "        else:\n            total += v\n    return total\n",
        "    pairs = [(1000, 'M'), (900, 'CM'), (500, 'D'), (400, 'CD'), (100, 'C'), (90, 'XC'),\n"
        "             (50, 'L'), (40, 'XL'), (10, 'X'), (9, 'IX'), (5, 'V'), (4, 'IV'), (1, 'I')]\n"
        "    out = []\n    n = s\n    for v, sym in pairs:\n        while n >= v:\n"
        "            out.append(sym)\n            n -= v\n    return ''.join(out)\n",
        "    import re\n    return bool(re.fullmatch(r'M*(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})', s)) and bool(s)\n",
        "    return len(s)\n",
        "    m = {'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000}\n"
        "    return sum(m[c] for c in s)\n",
    ]
    checks = [
        "assert roman('MCMXCIV') == 1994\nassert roman('III') == 3\n",
        "assert roman(1994) == 'MCMXCIV'\nassert roman(3) == 'III'\n",
        "assert roman('MCMXCIV') is True\nassert roman('IIII') is False\n",
        "assert roman('III') == 3\n",
        "assert roman('III') == 3\nassert roman('IV') == 6\n",
    ]
    return (f"Write `roman(s)` to {modes[v]}.", f"def roman(s):\n{bodies[v]}", checks[v])


def _dedupe(v: int) -> Variant:
    modes = ["keeping first occurrences in order", "keeping last occurrences in order",
             "returning the duplicated values only", "returning the count of duplicates removed",
             "case-insensitively for strings, keeping first occurrences"]
    bodies = [
        "    seen = set()\n    out = []\n    for x in xs:\n"
        "        if x not in seen:\n            seen.add(x)\n            out.append(x)\n    return out\n",
        "    out = []\n    for i, x in enumerate(xs):\n"
        "        if x not in xs[i + 1:]:\n            out.append(x)\n    return out\n",
        "    from collections import Counter\n    c = Counter(xs)\n"
        "    return [x for x in dict.fromkeys(xs) if c[x] > 1]\n",
        "    return len(xs) - len(set(xs))\n",
        "    seen = set()\n    out = []\n    for x in xs:\n        k = x.lower() if isinstance(x, str) else x\n"
        "        if k not in seen:\n            seen.add(k)\n            out.append(x)\n    return out\n",
    ]
    sol = f"def dedupe(xs):\n{bodies[v]}"
    probes = [([],), ([1, 2, 1],), ([1, 1, 1],)] if v != 4 else [([],), (["A", "a", "b"],), (["x"],)]
    tests = _derive(sol, "dedupe", probes)
    return (f"Write `dedupe(xs)` removing duplicates, {modes[v]}.", sol, tests)


def _caesar(v: int) -> Variant:
    k = [1, 3, 13, 5, 25][v]
    return (
        f"Write `shift(text)` applying a Caesar shift of {k} to ASCII letters, preserving case and "
        "leaving other characters untouched.",
        "def shift(text):\n    out = []\n    for c in text:\n"
        "        if c.isalpha() and c.isascii():\n            base = ord('A') if c.isupper() else ord('a')\n"
        f"            out.append(chr((ord(c) - base + {k}) % 26 + base))\n"
        "        else:\n            out.append(c)\n    return ''.join(out)\n",
        f"assert shift('') == ''\nassert shift('a') == {chr((0 + [1, 3, 13, 5, 25][v]) % 26 + 97)!r}\n"
        "assert shift('!') == '!'\n",
    )


def _stats(v: int) -> Variant:
    modes = ["mean", "median", "mode", "range", "population standard deviation"]
    bodies = [
        "    return sum(xs) / len(xs) if xs else 0.0\n",
        "    import statistics\n    return statistics.median(xs) if xs else 0.0\n",
        "    from collections import Counter\n    return Counter(xs).most_common(1)[0][0] if xs else None\n",
        "    return (max(xs) - min(xs)) if xs else 0\n",
        "    import statistics\n    return statistics.pstdev(xs) if len(xs) > 1 else 0.0\n",
    ]
    checks = [
        "assert stat([1, 2, 3]) == 2\nassert stat([]) == 0.0\n",
        "assert stat([1, 3, 2]) == 2\nassert stat([]) == 0.0\n",
        "assert stat([1, 1, 2]) == 1\nassert stat([]) is None\n",
        "assert stat([1, 5]) == 4\nassert stat([]) == 0\n",
        "assert round(stat([1, 1]), 6) == 0.0\nassert stat([]) == 0.0\n",
    ]
    return (f"Write `stat(xs)` returning the {modes[v]} of the numbers in `xs`, with a safe value for "
            "the empty list.", f"def stat(xs):\n{bodies[v]}", checks[v])



# ------------------------------------------------------------------------------------------------
# Harder families. The pool has to reach the frontier band for a capable driver: an item the car
# always passes teaches the loop nothing, and one it never passes gives every rollout group the
# same reward. These are the families a 14B model gets wrong often enough to be worth racing on.
# ------------------------------------------------------------------------------------------------

def _edit_distance(v: int) -> Variant:
    modes = ["Levenshtein distance", "distance where a substitution costs 2",
             "length of the longest common subsequence", "distance allowing transposition of adjacent characters",
             "number of positions that differ, or -1 when the lengths differ"]
    bodies = [
        "    m, n = len(a), len(b)\n    d = list(range(n + 1))\n"
        "    for i in range(1, m + 1):\n        prev, d[0] = d[0], i\n"
        "        for j in range(1, n + 1):\n            cur = d[j]\n"
        "            d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] != b[j - 1]))\n"
        "            prev = cur\n    return d[n]\n",
        "    m, n = len(a), len(b)\n    d = list(range(n + 1))\n"
        "    for i in range(1, m + 1):\n        prev, d[0] = d[0], i\n"
        "        for j in range(1, n + 1):\n            cur = d[j]\n"
        "            d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (2 if a[i - 1] != b[j - 1] else 0))\n"
        "            prev = cur\n    return d[n]\n",
        "    m, n = len(a), len(b)\n    d = [0] * (n + 1)\n"
        "    for i in range(1, m + 1):\n        prev = 0\n"
        "        for j in range(1, n + 1):\n            cur = d[j]\n"
        "            d[j] = prev + 1 if a[i - 1] == b[j - 1] else max(d[j], d[j - 1])\n"
        "            prev = cur\n    return d[n]\n",
        "    m, n = len(a), len(b)\n"
        "    d = [[0] * (n + 1) for _ in range(m + 1)]\n"
        "    for i in range(m + 1):\n        d[i][0] = i\n"
        "    for j in range(n + 1):\n        d[0][j] = j\n"
        "    for i in range(1, m + 1):\n        for j in range(1, n + 1):\n"
        "            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1,\n"
        "                          d[i - 1][j - 1] + (a[i - 1] != b[j - 1]))\n"
        "            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:\n"
        "                d[i][j] = min(d[i][j], d[i - 2][j - 2] + 1)\n    return d[m][n]\n",
        "    if len(a) != len(b):\n        return -1\n"
        "    return sum(1 for x, y in zip(a, b) if x != y)\n",
    ]
    sol = f"def distance(a, b):\n{bodies[v]}"
    tests = _derive(sol, "distance", [("", ""), ("kitten", "sitting"), ("abc", "abc"),
                                      ("ab", "ba"), ("flaw", "lawn"), ("a", "")])
    return (f"Write `distance(a, b)` over two strings returning the {modes[v]}.", sol, tests)


def _topo(v: int) -> Variant:
    modes = ["a topological order, breaking ties by the smaller node first",
             "a topological order, breaking ties by the larger node first",
             "the empty list when the graph has a cycle, else any topological order",
             "the number of nodes with no incoming edge",
             "the length of the longest path in edges"]
    bodies = [
        "    import heapq\n    from collections import defaultdict\n"
        "    g = defaultdict(list)\n    indeg = dict.fromkeys(nodes, 0)\n"
        "    for a, b in edges:\n        g[a].append(b)\n        indeg[b] = indeg.get(b, 0) + 1\n"
        "    q = [n for n in nodes if indeg.get(n, 0) == 0]\n    heapq.heapify(q)\n    out = []\n"
        "    while q:\n        n = heapq.heappop(q)\n        out.append(n)\n"
        "        for m in g[n]:\n            indeg[m] -= 1\n"
        "            if indeg[m] == 0:\n                heapq.heappush(q, m)\n"
        "    return out if len(out) == len(nodes) else []\n",
        "    import heapq\n    from collections import defaultdict\n"
        "    g = defaultdict(list)\n    indeg = dict.fromkeys(nodes, 0)\n"
        "    for a, b in edges:\n        g[a].append(b)\n        indeg[b] = indeg.get(b, 0) + 1\n"
        "    q = [-n for n in nodes if indeg.get(n, 0) == 0]\n    heapq.heapify(q)\n    out = []\n"
        "    while q:\n        n = -heapq.heappop(q)\n        out.append(n)\n"
        "        for m in g[n]:\n            indeg[m] -= 1\n"
        "            if indeg[m] == 0:\n                heapq.heappush(q, -m)\n"
        "    return out if len(out) == len(nodes) else []\n",
        "    from collections import defaultdict\n    g = defaultdict(list)\n"
        "    indeg = dict.fromkeys(nodes, 0)\n"
        "    for a, b in edges:\n        g[a].append(b)\n        indeg[b] = indeg.get(b, 0) + 1\n"
        "    q = [n for n in nodes if indeg.get(n, 0) == 0]\n    out = []\n"
        "    while q:\n        n = q.pop(0)\n        out.append(n)\n"
        "        for m in g[n]:\n            indeg[m] -= 1\n"
        "            if indeg[m] == 0:\n                q.append(m)\n"
        "    return out if len(out) == len(nodes) else []\n",
        "    targets = {b for _, b in edges}\n    return sum(1 for n in nodes if n not in targets)\n",
        "    from collections import defaultdict\n    g = defaultdict(list)\n"
        "    indeg = dict.fromkeys(nodes, 0)\n"
        "    for a, b in edges:\n        g[a].append(b)\n        indeg[b] = indeg.get(b, 0) + 1\n"
        "    q = [n for n in nodes if indeg.get(n, 0) == 0]\n    dist = dict.fromkeys(nodes, 0)\n"
        "    seen = 0\n"
        "    while q:\n        n = q.pop(0)\n        seen += 1\n"
        "        for m in g[n]:\n            dist[m] = max(dist[m], dist[n] + 1)\n"
        "            indeg[m] -= 1\n            if indeg[m] == 0:\n                q.append(m)\n"
        "    return max(dist.values()) if seen == len(nodes) and dist else 0\n",
    ]
    sol = f"def toposort(nodes, edges):\n{bodies[v]}"
    tests = _derive(sol, "toposort", [([1, 2, 3], [(1, 2), (1, 3)]), ([3, 1, 2], [(3, 1), (3, 2), (1, 2)]),
                                   ([1, 2], [(1, 2), (2, 1)]), ([1], []), ([], [])])
    return (f"Write `toposort(nodes, edges)` over a directed graph given as a node list and a list of "
            f"`(from, to)` edges, returning {modes[v]}.", sol, tests)


def _expr(v: int) -> Variant:
    modes = ["+ - * / with the usual precedence and integer division truncating toward zero",
             "+ - * / with left-to-right evaluation and no precedence",
             "+ - * / and parentheses, with the usual precedence",
             "+ and * only, with the usual precedence",
             "+ - * / with the usual precedence, returning a float"]
    common = ("    import re\n    toks = re.findall(r'\\d+|[-+*/()]', s.replace(' ', ''))\n"
              "    pos = 0\n\n")
    bodies = [
        common + "    def factor():\n        nonlocal pos\n        t = toks[pos]\n        pos += 1\n"
        "        return int(t)\n"
        "    def term():\n        nonlocal pos\n        v = factor()\n"
        "        while pos < len(toks) and toks[pos] in '*/':\n            op = toks[pos]\n            pos += 1\n"
        "            r = factor()\n            v = v * r if op == '*' else int(v / r)\n        return v\n"
        "    v = term()\n    while pos < len(toks) and toks[pos] in '+-':\n        op = toks[pos]\n        pos += 1\n"
        "        r = term()\n        v = v + r if op == '+' else v - r\n    return v\n",
        common + "    v = int(toks[0])\n    i = 1\n"
        "    while i < len(toks):\n        op, r = toks[i], int(toks[i + 1])\n        i += 2\n"
        "        v = v + r if op == '+' else v - r if op == '-' else v * r if op == '*' else int(v / r)\n"
        "    return v\n",
        common + "    def factor():\n        nonlocal pos\n"
        "        if toks[pos] == '(':\n            pos += 1\n            v = expr()\n            pos += 1\n            return v\n"
        "        t = toks[pos]\n        pos += 1\n        return int(t)\n"
        "    def term():\n        nonlocal pos\n        v = factor()\n"
        "        while pos < len(toks) and toks[pos] in '*/':\n            op = toks[pos]\n            pos += 1\n"
        "            r = factor()\n            v = v * r if op == '*' else int(v / r)\n        return v\n"
        "    def expr():\n        nonlocal pos\n        v = term()\n"
        "        while pos < len(toks) and toks[pos] in '+-':\n            op = toks[pos]\n            pos += 1\n"
        "            r = term()\n            v = v + r if op == '+' else v - r\n        return v\n"
        "    return expr()\n",
        common + "    parts = []\n    cur = [int(toks[0])]\n    i = 1\n"
        "    while i < len(toks):\n        op, r = toks[i], int(toks[i + 1])\n        i += 2\n"
        "        if op == '*':\n            cur.append(r)\n        else:\n"
        "            parts.append(cur)\n            cur = [r]\n    parts.append(cur)\n"
        "    total = 0\n    for p in parts:\n        prod = 1\n"
        "        for x in p:\n            prod *= x\n        total += prod\n    return total\n",
        common + "    def factor():\n        nonlocal pos\n        t = toks[pos]\n        pos += 1\n"
        "        return float(t)\n"
        "    def term():\n        nonlocal pos\n        v = factor()\n"
        "        while pos < len(toks) and toks[pos] in '*/':\n            op = toks[pos]\n            pos += 1\n"
        "            r = factor()\n            v = v * r if op == '*' else v / r\n        return v\n"
        "    v = term()\n    while pos < len(toks) and toks[pos] in '+-':\n        op = toks[pos]\n        pos += 1\n"
        "        r = term()\n        v = v + r if op == '+' else v - r\n    return v\n",
    ]
    sol = f"def evaluate(s):\n{bodies[v]}"
    probes = ["2+3*4", "10-2-3", "7/2", "1+2", "6*3-4"] if v != 2 else ["2+3*4", "(2+3)*4", "10-2-3", "7/2", "1+2"]
    tests = _derive(sol, "evaluate", [(p,) for p in probes])
    return (f"Write `evaluate(s)` for an arithmetic expression string supporting {modes[v]}.", sol, tests)


def _path_lookup(v: int) -> Variant:
    modes = ["the value at a dotted path, or None when any step is missing",
             "the value at a dotted path, raising KeyError when a step is missing",
             "the value at a dotted path where numeric steps index into lists",
             "every value whose dotted path matches, with '*' matching one level",
             "the set of all leaf paths as dotted strings, sorted"]
    bodies = [
        "    cur = data\n    for part in path.split('.'):\n"
        "        if isinstance(cur, dict) and part in cur:\n            cur = cur[part]\n"
        "        else:\n            return None\n    return cur\n",
        "    cur = data\n    for part in path.split('.'):\n        cur = cur[part]\n    return cur\n",
        "    cur = data\n    for part in path.split('.'):\n"
        "        if part.isdigit() and isinstance(cur, list):\n            i = int(part)\n"
        "            if i >= len(cur):\n                return None\n            cur = cur[i]\n"
        "        elif isinstance(cur, dict) and part in cur:\n            cur = cur[part]\n"
        "        else:\n            return None\n    return cur\n",
        "    out = []\n\n    def walk(node, parts):\n"
        "        if not parts:\n            out.append(node)\n            return\n"
        "        head, rest = parts[0], parts[1:]\n"
        "        if not isinstance(node, dict):\n            return\n"
        "        keys = list(node) if head == '*' else ([head] if head in node else [])\n"
        "        for k in keys:\n            walk(node[k], rest)\n\n"
        "    walk(data, path.split('.'))\n    return out\n",
        "    out = []\n\n    def walk(node, prefix):\n"
        "        if isinstance(node, dict) and node:\n"
        "            for k in node:\n                walk(node[k], prefix + [k])\n"
        "        else:\n            out.append('.'.join(prefix))\n\n"
        "    walk(data, [])\n    return sorted(out)\n",
    ]
    sol = f"def lookup(data, path):\n{bodies[v]}"
    d1 = {"a": {"b": {"c": 1}}, "d": 2}
    d2 = {"a": {"b": 1, "c": 2}}
    d3 = {"a": [{"b": 5}, {"b": 6}]}
    probes = [(d1, "a.b.c"), (d1, "d"), (d2, "a.*"), (d3, "a.0.b"), (d1, "a.x.c")]
    tests = _derive(sol, "lookup", probes)
    return (f"Write `lookup(data, path)` over nested dictionaries returning {modes[v]}.", sol, tests)


def _schedule(v: int) -> Variant:
    modes = ["the largest number of non-overlapping jobs",
             "the largest total weight of non-overlapping jobs",
             "the jobs chosen for the largest count, as a sorted list of indices",
             "the smallest number of machines needed to run every job",
             "the total time no machine is busy between the first start and the last end"]
    bodies = [
        "    jobs = sorted(jobs, key=lambda j: j[1])\n    end = None\n    n = 0\n"
        "    for s, e in [(j[0], j[1]) for j in jobs]:\n"
        "        if end is None or s >= end:\n            end = e\n            n += 1\n    return n\n",
        "    import bisect\n    js = sorted(jobs, key=lambda j: j[1])\n"
        "    ends = [j[1] for j in js]\n    best = [0] * (len(js) + 1)\n"
        "    for i, (s, e, w) in enumerate(js, 1):\n        k = bisect.bisect_right(ends, s, 0, i - 1)\n"
        "        best[i] = max(best[i - 1], best[k] + w)\n    return best[len(js)]\n",
        "    order = sorted(range(len(jobs)), key=lambda i: jobs[i][1])\n    end = None\n    out = []\n"
        "    for i in order:\n        s, e = jobs[i][0], jobs[i][1]\n"
        "        if end is None or s >= end:\n            end = e\n            out.append(i)\n    return sorted(out)\n",
        "    import heapq\n    free = []\n    n = 0\n"
        "    for s, e in sorted((j[0], j[1]) for j in jobs):\n"
        "        if free and free[0] <= s:\n            heapq.heapreplace(free, e)\n"
        "        else:\n            heapq.heappush(free, e)\n            n = max(n, len(free))\n    return n\n",
        "    if not jobs:\n        return 0\n    iv = sorted((j[0], j[1]) for j in jobs)\n"
        "    merged = [list(iv[0])]\n"
        "    for s, e in iv[1:]:\n"
        "        if s <= merged[-1][1]:\n            merged[-1][1] = max(merged[-1][1], e)\n"
        "        else:\n            merged.append([s, e])\n"
        "    span = merged[-1][1] - merged[0][0]\n"
        "    busy = sum(e - s for s, e in merged)\n    return span - busy\n",
    ]
    sol = f"def schedule(jobs):\n{bodies[v]}"
    a = [(1, 3, 5), (2, 5, 6), (4, 7, 5), (6, 9, 4)]
    tests = _derive(sol, "schedule", [(a,), ([],), ([(1, 2, 1)],), ([(1, 10, 9), (2, 3, 5), (4, 5, 5)],)])
    return (f"Write `schedule(jobs)` over jobs given as `(start, end, weight)` returning {modes[v]}.",
            sol, tests)


def _grid_path(v: int) -> Variant:
    modes = ["the number of paths from the top-left to the bottom-right moving only right or down, "
             "where a 1 is an obstacle",
             "the smallest sum along such a path, treating the values as costs",
             "the largest sum along such a path",
             "the number of such paths modulo 1000000007",
             "the length in cells of the shortest path, or -1 when none exists"]
    bodies = [
        "    if not g or g[0][0] == 1:\n        return 0\n    m, n = len(g), len(g[0])\n"
        "    d = [[0] * n for _ in range(m)]\n    d[0][0] = 1\n"
        "    for i in range(m):\n        for j in range(n):\n"
        "            if g[i][j] == 1:\n                d[i][j] = 0\n                continue\n"
        "            if i:\n                d[i][j] += d[i - 1][j]\n"
        "            if j:\n                d[i][j] += d[i][j - 1]\n    return d[m - 1][n - 1]\n",
        "    if not g:\n        return 0\n    m, n = len(g), len(g[0])\n"
        "    d = [[0] * n for _ in range(m)]\n"
        "    for i in range(m):\n        for j in range(n):\n"
        "            best = 0 if i == 0 and j == 0 else min(\n"
        "                d[i - 1][j] if i else 10 ** 9, d[i][j - 1] if j else 10 ** 9)\n"
        "            d[i][j] = g[i][j] + best\n    return d[m - 1][n - 1]\n",
        "    if not g:\n        return 0\n    m, n = len(g), len(g[0])\n"
        "    d = [[0] * n for _ in range(m)]\n"
        "    for i in range(m):\n        for j in range(n):\n"
        "            best = 0 if i == 0 and j == 0 else max(\n"
        "                d[i - 1][j] if i else -(10 ** 9), d[i][j - 1] if j else -(10 ** 9))\n"
        "            d[i][j] = g[i][j] + best\n    return d[m - 1][n - 1]\n",
        "    if not g or g[0][0] == 1:\n        return 0\n    M = 1000000007\n"
        "    m, n = len(g), len(g[0])\n    d = [[0] * n for _ in range(m)]\n    d[0][0] = 1\n"
        "    for i in range(m):\n        for j in range(n):\n"
        "            if g[i][j] == 1:\n                d[i][j] = 0\n                continue\n"
        "            if i:\n                d[i][j] = (d[i][j] + d[i - 1][j]) % M\n"
        "            if j:\n                d[i][j] = (d[i][j] + d[i][j - 1]) % M\n    return d[m - 1][n - 1]\n",
        "    if not g or g[0][0] == 1:\n        return -1\n    m, n = len(g), len(g[0])\n"
        "    if g[m - 1][n - 1] == 1:\n        return -1\n"
        "    from collections import deque\n    q = deque([(0, 0, 1)])\n    seen = {(0, 0)}\n"
        "    while q:\n        i, j, d = q.popleft()\n"
        "        if (i, j) == (m - 1, n - 1):\n            return d\n"
        "        for a, b in ((i + 1, j), (i, j + 1)):\n"
        "            if a < m and b < n and g[a][b] == 0 and (a, b) not in seen:\n"
        "                seen.add((a, b))\n                q.append((a, b, d + 1))\n    return -1\n",
    ]
    sol = f"def paths(g):\n{bodies[v]}"
    tests = _derive(sol, "paths", [([[0, 0], [0, 0]],), ([[0, 1], [0, 0]],), ([[0, 0, 0], [1, 1, 0], [0, 0, 0]],),
                                   ([[0]],), ([],)])
    return (f"Write `paths(g)` over a rectangular grid of integers returning {modes[v]}.", sol, tests)


def _tokenise(v: int) -> Variant:
    modes = ["split on commas, honouring double-quoted fields and doubled quotes as an escape",
             "split on commas outside quotes and strip surrounding whitespace from each field",
             "the number of fields",
             "split on the first colon only, returning a (key, value) pair with both stripped",
             "split on semicolons, dropping empty fields"]
    bodies = [
        "    out, cur, q, i = [], [], False, 0\n"
        "    while i < len(s):\n        c = s[i]\n"
        "        if q:\n"
        "            if c == '\"' and i + 1 < len(s) and s[i + 1] == '\"':\n"
        "                cur.append('\"')\n                i += 1\n"
        "            elif c == '\"':\n                q = False\n"
        "            else:\n                cur.append(c)\n"
        "        elif c == '\"':\n            q = True\n"
        "        elif c == ',':\n            out.append(''.join(cur))\n            cur = []\n"
        "        else:\n            cur.append(c)\n        i += 1\n"
        "    out.append(''.join(cur))\n    return out\n",
        "    out, cur, q = [], [], False\n"
        "    for c in s:\n"
        "        if c == '\"':\n            q = not q\n"
        "        elif c == ',' and not q:\n            out.append(''.join(cur).strip())\n            cur = []\n"
        "        else:\n            cur.append(c)\n"
        "    out.append(''.join(cur).strip())\n    return out\n",
        "    n, q = 1, False\n"
        "    for c in s:\n"
        "        if c == '\"':\n            q = not q\n"
        "        elif c == ',' and not q:\n            n += 1\n    return n\n",
        "    k, _, v = s.partition(':')\n    return (k.strip(), v.strip())\n",
        "    return [p for p in s.split(';') if p]\n",
    ]
    sol = f"def fields(s):\n{bodies[v]}"
    probes = ['a,b,c', '"a,b",c', 'a, b , c', 'x:1', 'a;;b']
    tests = _derive(sol, "fields", [(p,) for p in probes] + [("",)])
    return (f"Write `fields(s)` over one delimited record returning {modes[v]}.", sol, tests)


def _versions(v: int) -> Variant:
    modes = ["-1, 0 or 1 comparing two dotted version strings numerically, ignoring missing trailing parts",
             "the larger of the two version strings",
             "True when the first version satisfies a caret range on the second",
             "the two versions sorted as a list",
             "the number of leading components the two versions share"]
    bodies = [
        "    pa = [int(x) for x in a.split('.')]\n    pb = [int(x) for x in b.split('.')]\n"
        "    n = max(len(pa), len(pb))\n    pa += [0] * (n - len(pa))\n    pb += [0] * (n - len(pb))\n"
        "    return (pa > pb) - (pa < pb)\n",
        "    def key(x):\n        return [int(p) for p in x.split('.')]\n"
        "    return a if key(a) >= key(b) else b\n",
        "    pa = [int(x) for x in a.split('.')] + [0, 0]\n    pb = [int(x) for x in b.split('.')] + [0, 0]\n"
        "    if pa[0] != pb[0]:\n        return False\n    return pa[:3] >= pb[:3]\n",
        "    def key(x):\n        return [int(p) for p in x.split('.')]\n"
        "    return sorted([a, b], key=key)\n",
        "    pa, pb = a.split('.'), b.split('.')\n    n = 0\n"
        "    for x, y in zip(pa, pb):\n"
        "        if x != y:\n            break\n        n += 1\n    return n\n",
    ]
    sol = f"def compare(a, b):\n{bodies[v]}"
    tests = _derive(sol, "compare", [("1.2.0", "1.2"), ("1.10", "1.9"), ("2.0", "1.9.9"),
                                     ("1.2.3", "1.2.3"), ("1.0.0", "1.0")])
    return (f"Write `compare(a, b)` over two version strings returning {modes[v]}.", sol, tests)


FAMILIES: list[dict] = [
    _f("count_chars", ["string-parsing", "sets"], 0.15, _count_chars),
    _f("two_sum", ["dict-counter", "hashing"], 0.35, _two_sum),
    _f("is_palindrome", ["string-parsing", "two-pointer"], 0.25, _palindrome),
    _f("encode", ["string-parsing", "grouping"], 0.40, _rle),
    _f("flatten", ["recursion"], 0.45, _flatten),
    _f("combine", ["modular-arith", "reduce"], 0.35, _gcd_list),
    _f("transform", ["matrix"], 0.40, _matrix),
    _f("top_k", ["dict-counter", "sorting-key"], 0.50, _top_k),
    _f("balanced", ["stack"], 0.40, _brackets),
    _f("search", ["binary-search"], 0.50, _binary_search),
    _f("merge", ["sorting-key", "intervals"], 0.60, _intervals),
    _f("words", ["string-parsing", "dict-counter"], 0.25, _word_freq),
    _f("seq", ["recursion", "memoisation"], 0.30, _fib),
    _f("root", ["modular-arith", "bit-ops"], 0.35, _digit_root),
    _f("window", ["two-pointer", "sliding-window"], 0.65, _longest_unique),
    _f("chunk", ["slicing"], 0.20, _chunk),
    _f("anagram", ["dict-counter", "string-parsing"], 0.30, _anagram),
    _f("order", ["matrix", "simulation"], 0.70, _spiral),
    _f("convert", ["bit-ops", "modular-arith"], 0.40, _base_convert),
    _f("group", ["grouping"], 0.20, _group_parity),
    _f("squeeze", ["regex", "string-parsing"], 0.30, _whitespace),
    _f("span", ["date-math"], 0.35, _days_between),
    _f("roman", ["mapping", "string-parsing"], 0.55, _roman),
    _f("dedupe", ["sets", "grouping"], 0.30, _dedupe),
    _f("shift", ["string-parsing", "modular-arith"], 0.30, _caesar),
    _f("stat", ["statistics"], 0.25, _stats),
    _f("distance", ["dynamic-programming", "string-parsing"], 0.80, _edit_distance),
    _f("toposort", ["graph", "sorting-key"], 0.82, _topo),
    _f("evaluate", ["parsing", "recursion"], 0.88, _expr),
    _f("lookup", ["recursion", "mapping"], 0.72, _path_lookup),
    _f("schedule", ["dynamic-programming", "intervals"], 0.85, _schedule),
    _f("paths", ["dynamic-programming", "matrix"], 0.78, _grid_path),
    _f("fields", ["parsing", "string-parsing"], 0.80, _tokenise),
    _f("compare", ["parsing", "sorting-key"], 0.68, _versions),
]

ALL_CONCEPTS: list[str] = sorted({c for fam in FAMILIES for c in fam["concepts"]})


def _example_for(entry: str, prompt: str) -> tuple:
    """A trivial, non-degenerate input for the family. Deliberately not an edge case: the example
    is a sanity check the driver may see, not a substitute for the hidden tests."""
    two = {
        "two_sum": ([2, 7, 11], 9), "search": ([1, 2, 3], 2), "anagram": ("ab", "ba"),
        "span": ("2026-01-01", "2026-01-03"),
        "distance": ("kitten", "sitting"), "compare": ("1.2.0", "1.2"),
        "toposort": ([1, 2, 3], [(1, 2), (1, 3)]), "lookup": ({"a": {"b": {"c": 1}}, "d": 2}, "a.b.c"),
    }
    if entry == "evaluate":
        return ("2+3*4",)
    if entry == "fields":
        return ("a,b,c",)
    if entry == "schedule":
        return ([(1, 3, 5), (2, 5, 6), (4, 7, 5)],)
    if entry == "paths":
        return ([[0, 0], [0, 0]],)
    if entry in two:
        return two[entry]
    if entry in {"transform", "order"}:
        return ([[1, 2], [3, 4]],)
    if entry in {"seq", "root", "convert"}:
        return (7,)
    if entry == "roman":
        return (7,) if "integer to a Roman" in prompt else ("VII",)
    if entry in {"count_chars", "is_palindrome", "encode", "words", "window", "squeeze", "shift"}:
        return ("abc",)
    if entry == "merge":
        return ([(1, 3), (2, 4)],)
    return ([1, 2, 1],)


CORRUPTIONS: list[tuple[str, Any]] = [
    ("off-by-one", lambda s: re.sub(r"\brange\((\w+)\)", r"range(\1 - 1)", s, count=1)),
    ("wrong-comparison", lambda s: s.replace("<=", "<", 1) if "<=" in s else s.replace("==", "!=", 1)),
    ("dropped-edge-case", lambda s: re.sub(r"\n\s*if not .*?:\n\s*return .*?\n", "\n", s, count=1)),
    ("inverted-result", lambda s: re.sub(r"(\n\s+)return (?!None)", r"\1return not ", s, count=1)),
    ("sign-flip", lambda s: s.replace("-", "+", 1) if "-" in s else s.replace("+", "-", 1)),
    ("empty-body", lambda s: re.sub(r"(def [^\n]+\n)(.|\n)*", r"\1    return None\n", s, count=1)),
    ("dropped-loop", lambda s: re.sub(r"\n(\s+)for [^\n]+:\n", r"\n\1if False:\n", s, count=1)),
]


_VARIANT_PROBE = """
import json
import signal
SRCS = {srcs!r}
TESTS = {tests!r}


class _Timeout(Exception):
    pass


def _fire(signum, frame):
    raise _Timeout()


signal.signal(signal.SIGALRM, _fire)

failed = []
for name, src in SRCS.items():
    if name == "__reference__":
        continue
    ns = {{}}
    signal.alarm(3)          # a corrupted loop that never terminates is a failure, not a hang
    try:
        exec(src, ns)
        exec(TESTS, ns)
    except Exception:
        failed.append(name)
    except _Timeout:
        failed.append(name)
    finally:
        signal.alarm(0)
print("VARIANTS " + json.dumps(failed))
print('SCRUTINEER_PASS')
"""


def _broken_variants(solution: str, tests: str) -> tuple:
    """Keep only the corruptions that actually fail this item's hidden tests.

    A corruption can be a semantic no-op — `return None or x` is `x` — and then a lap the
    simulation calls a failure would quietly pass, making every credit number downstream a lie.
    The check runs the real hidden tests, in the sandbox, because a corrupted loop can fail to
    terminate and a build step must not be able to hang the season.
    """
    from .rails.sandbox import sandbox

    candidates: dict[str, str] = {"__reference__": solution}
    for name, fn in CORRUPTIONS:
        src = fn(solution)
        if src != solution:
            candidates[name] = src
    # A stub that answers None to everything is wrong for every item in the pool and needs no
    # regex to apply, so it guarantees the set is never empty.
    stub = re.sub(r"(def [^\n]+\n)(.|\n)*", r"\1    return None\n", solution, count=1)
    if stub != solution:
        candidates.setdefault("stub", stub)
    program = _VARIANT_PROBE.format(srcs=candidates, tests=tests)
    r = sandbox().run(program)
    line = next((ln for ln in r.stdout.splitlines() if ln.startswith("VARIANTS ")), "")
    if not line:
        return ()
    return tuple((n, candidates[n]) for n in json.loads(line[len("VARIANTS "):]) if n in candidates)


def _check_args(entry: str, example: tuple, prompt: str) -> tuple:
    extra = {
        "two_sum": [([1, 2], 3)], "search": [([1, 2, 2, 3], 2)], "anagram": [("ab", "bc")],
        "span": [("2026-01-01", "2026-02-01")], "merge": [([(1, 2), (5, 6)],)],
        "distance": [("abc", "abc"), ("a", "")], "compare": [("1.2.3", "1.2.3")],
        "toposort": [([1], []), ([1, 2], [(1, 2), (2, 1)])],
        "lookup": [({"a": {"b": 1, "c": 2}}, "a.*"), ({"a": {"b": {"c": 1}}}, "a.x.c")],
        "evaluate": [("1+2",), ("7/2",)],
        "fields": [("",), ("a;;b",)],
        "schedule": [([],), ([(1, 2, 1)],)],
        "paths": [([[0]],), ([],)],
    }
    if entry in extra:
        return (example, *extra[entry])
    if entry in {"transform", "order"}:
        return (example, ([[1, 2, 3], [4, 5, 6]],))
    if entry in {"seq", "root", "convert"}:
        return (example, (0,), (12,))
    if entry == "roman":
        return (example, (14,)) if "integer to a Roman" in prompt else (example, ("XIV",))
    if entry in {"count_chars", "is_palindrome", "encode", "words", "window", "squeeze", "shift"}:
        return (example, ("aab Zz",), ("",))
    return (example, ([3, 1, 2, 1],), ([],))


_POOL: list[Item] | None = None


def _cache_path():
    from pathlib import Path

    # deterministic build output, not season state, so it stays with the repo
    p = Path(__file__).resolve().parents[2] / "state" / "variants.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def _example_candidates(entry: str, prompt: str) -> list[tuple]:
    """Several usable worked examples, tried in order, so one clashing with a hidden test case
    does not force the example to leak it."""
    first = _example_for(entry, prompt)
    extra = {
        "distance": [("abc", "abd"), ("horse", "ros"), ("flaw", "lawn")],
        "compare": [("3.1", "3.0.9"), ("4.0.1", "4.0"), ("2.0", "1.9.9")],
        "toposort": [([3, 1, 2], [(3, 1), (1, 2)]), ([1, 2], [(1, 2)]), ([4, 5], [(5, 4)])],
        "lookup": [({"a": {"b": 1}}, "a.b"), ({"x": {"y": 2}}, "x.y"), ({"p": {"q": 3}}, "p.q")],
        # deliberately different from the test probes, so the visible example never leaks one
        "evaluate": [("8+2*5",), ("9-4+1",), ("12/3+1",)],
        "fields": [("p,q",), ("m; n",), ('"u,v",w',)],
        "schedule": [([(0, 2, 3), (1, 4, 7), (3, 6, 2)],), ([(1, 10, 9), (2, 3, 5), (4, 5, 5)],)],
        "paths": [([[0, 0, 0], [0, 0, 0]],), ([[0, 0], [1, 0]],), ([[0, 0, 0], [1, 1, 0], [0, 0, 0]],)],
        "two_sum": [([3, 5, 8], 8), ([4, 6, 1], 10)],
        "search": [([2, 4, 6], 4), ([5, 7, 9], 7)],
        "anagram": [("cat", "act"), ("dog", "god")],
        "span": [("2026-03-01", "2026-03-05"), ("2026-05-02", "2026-05-09")],
        "merge": [([(2, 4), (3, 6)],), ([(0, 1), (4, 5)],)],
        "seq": [(6,), (9,)], "root": [(9,), (12,)], "convert": [(9,), (11,)],
        "transform": [([[2, 3], [4, 5]],)], "order": [([[2, 3], [4, 5]],)],
    }
    generic = [("abc",), ("abcd",), ([1, 2, 1],), ([2, 3, 2],)]
    return [first, *extra.get(entry, []), *[g for g in generic if len(g) == len(first)]]


def build_pool() -> list[Item]:
    """Deterministic; the sandbox sweep that verifies corruptions is cached on disk."""
    global _POOL
    if _POOL is not None:
        return _POOL
    cache_file = _cache_path()
    cache: dict = json.loads(cache_file.read_text()) if cache_file.exists() else {}
    dirty = False
    items: list[Item] = []
    for fi, fam in enumerate(FAMILIES):
        for v in range(5):
            prompt, solution, tests = fam["fn"](v)
            ns: dict = {}
            exec(solution, ns)  # noqa: S102 - our own generated source
            # The worked example is visible to the driver, so it must not be one of the hidden
            # test cases: take the first candidate input that the reference actually accepts and
            # whose call does not appear in the tests.
            args, example_repr = None, None
            for cand in _example_candidates(fam["name"], prompt):
                call = f"{fam['name']}({', '.join(repr(x) for x in cand)})"
                if call in tests:
                    continue
                try:
                    example_repr = repr(ns[fam["name"]](*cand))
                except Exception:
                    continue
                args = cand
                break
            if args is None:
                raise ValueError(f"no usable worked example for {fam['name']} variant {v}")
            checks = _check_args(fam["name"], args, prompt)
            key = f"{fi:02d}-{v}"
            if key in cache:
                broken = tuple(tuple(x) for x in cache[key])
            else:
                broken = _broken_variants(solution, tests)
                cache[key] = [list(x) for x in broken]
                dirty = True
            prompt = f"{prompt}\n\nExample: {fam['name']}({', '.join(repr(a) for a in args)}) == {example_repr}"
            items.append(
                Item(
                    id=f"c{fi:02d}-{v}",
                    family=fam["name"],
                    prompt=prompt,
                    entry_point=fam["name"],
                    concepts=frozenset(fam["concepts"]),
                    # variants get slightly harder as the rule departs from the obvious one
                    difficulty=min(0.95, fam["difficulty"] + 0.05 * v),
                    reference_solution=solution,
                    tests=tests,
                    example_args=args,
                    example_repr=example_repr,
                    check_args=checks,
                    broken_variants=broken,
                )
            )
    if dirty:
        cache_file.write_text(json.dumps(cache, indent=0))
    _POOL = items
    return items


@dataclass(frozen=True)
class Split:
    quali: list[Item] = field(default_factory=list)
    sealed: list[Item] = field(default_factory=list)
    reserve: list[Item] = field(default_factory=list)

    def by_id(self, item_id: str) -> Item | None:
        for group in (self.quali, self.sealed, self.reserve):
            for it in group:
                if it.id == item_id:
                    return it
        return None


def task_pool() -> list:
    """The pool the loop is actually racing on. One place decides, so a caller cannot pick up the
    wrong task family by importing the wrong builder — which is exactly what happened when the
    opening band filter called `build_pool` directly and quietly reverted a whole season to the
    old task."""
    import os

    mode = os.environ.get("SCRUTINEER_TASKS", "web")
    if mode == "bcb":
        from .bcb import build_pool as bcb_pool

        return bcb_pool()
    if mode == "bench":
        from .bench import build_pool as bench_pool

        return bench_pool()
    if mode == "web":
        from .webtasks import build_pool as web_pool

        return web_pool()
    return build_pool()


def web_split(seed: int, n_quali: int, n_sealed: int) -> Split:
    """The web-interface pool, split into the specs the agent practises on and the ones it is
    judged on and never sees."""
    from .webtasks import build_pool as web_pool

    pool = web_pool()
    rng = random.Random(seed)
    order = pool[:]
    rng.shuffle(order)
    # deal alternately so both halves get the same spread of families and difficulty
    return Split(quali=order[0::2][:n_quali], sealed=order[1::2][:n_sealed],
                 reserve=order[n_quali + n_sealed:])


def split_pool(seed: int, n_quali: int = 30, n_sealed: int = 30) -> Split:
    """Deterministic 30/30/60 split. SEALED is fixed for the whole season and never leaves the
    evaluator process; QUALI is `practice-circuit:v0`."""
    import os

    mode = os.environ.get("SCRUTINEER_TASKS", "web")
    if mode == "bcb":
        from .bcb import build_pool as bcb_pool
        from .bcb import three_way as bcb_three

        practice, season_sealed, _final = bcb_three(bcb_pool(), seed)
        # the final held-out set is not reachable from here at all, by construction
        return Split(quali=practice[:n_quali], sealed=season_sealed[:n_sealed],
                     reserve=practice[n_quali:])
    if mode == "bench":
        from .bench import build_pool as bench_pool
        from .bench import three_way

        practice, season_sealed, final_held = three_way(bench_pool(), seed)
        # final_held is withheld from the season entirely, so it stays a clean measurement
        return Split(quali=practice[:n_quali], sealed=season_sealed[:n_sealed],
                     reserve=practice[n_quali:])
    if mode == "web":
        return web_split(seed, n_quali, n_sealed)
    pool = build_pool()
    rng = random.Random(seed)
    order = pool[:]
    rng.shuffle(order)
    return Split(quali=order[:n_quali], sealed=order[n_quali : n_quali + n_sealed],
                 reserve=order[n_quali + n_sealed :])
