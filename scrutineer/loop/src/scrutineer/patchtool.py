"""A real unified-diff parser and applier.

The improver's output is a plain unified diff, not a patch object, so the diff has to be
load-bearing: a malformed hunk or a context line that does not match is a rejected proposal,
not a silently-applied edit.
"""

from __future__ import annotations

import difflib
import re
from dataclasses import dataclass

_HUNK = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")


class PatchError(Exception):
    pass


@dataclass
class Hunk:
    old_start: int
    lines: list[str]


@dataclass
class FileDiff:
    path: str
    hunks: list[Hunk]

    @property
    def changed_lines(self) -> int:
        return sum(1 for h in self.hunks for ln in h.lines if ln[:1] in "+-")


def make_diff(path: str, old: str, new: str, context: int = 3) -> str:
    d = difflib.unified_diff(old.splitlines(keepends=True), new.splitlines(keepends=True),
                             fromfile=f"a/{path}", tofile=f"b/{path}", n=context)
    return "".join(d)


def parse_diff(text: str) -> list[FileDiff]:
    files: list[FileDiff] = []
    cur: FileDiff | None = None
    hunk: Hunk | None = None
    for raw in text.splitlines():
        if raw.startswith("--- "):
            continue
        if raw.startswith("+++ "):
            path = raw[4:].strip()
            path = path[2:] if path.startswith(("a/", "b/")) else path
            cur = FileDiff(path=path, hunks=[])
            files.append(cur)
            hunk = None
            continue
        m = _HUNK.match(raw)
        if m:
            if cur is None:
                raise PatchError("hunk before any +++ header")
            hunk = Hunk(old_start=int(m.group(1)), lines=[])
            cur.hunks.append(hunk)
            continue
        if hunk is not None and raw[:1] in (" ", "+", "-", "\\"):
            hunk.lines.append(raw)
    if not files:
        raise PatchError("no file header in diff")
    return files


def _hunk_body(h: Hunk) -> tuple[list[str], list[str]]:
    """(lines the hunk expects to find, lines it leaves behind)."""
    before, after = [], []
    for ln in h.lines:
        tag, body = ln[0], ln[1:]
        if tag == "\\":
            continue
        if tag in (" ", "-"):
            before.append(body)
        if tag in (" ", "+"):
            after.append(body)
    return before, after


def _find(lines: list[str], before: list[str], hint: int, lo: int) -> int:
    """Locate a hunk by its context, searching outward from the line it claims.

    A model writing a unified diff by hand gets the arithmetic in `@@ -a,b +c,d @@` wrong often,
    and refusing those would reject correct changes for a clerical error. The content still has to
    match exactly — only the offset is allowed to drift, which is what patch(1) has always done.
    """
    if not before:
        return max(lo, min(hint, len(lines)))
    n = len(before)
    stripped = [b.rstrip("\n") for b in before]

    def matches(at: int) -> bool:
        if at < lo or at + n > len(lines):
            return False
        return all(lines[at + k].rstrip("\n") == stripped[k] for k in range(n))

    for delta in range(0, len(lines) + 1):
        for at in {hint + delta, hint - delta}:
            if matches(at):
                return at
    raise PatchError(
        f"hunk context not found anywhere in the file; it expected {stripped[0]!r}"
        if stripped else "empty hunk")


def apply_diff(files: dict[str, str], diff_text: str) -> dict[str, str]:
    """Apply a unified diff to an in-memory file map. Context must match exactly; the line number
    a hunk claims is a hint."""
    out = dict(files)
    for fd in parse_diff(diff_text):
        if fd.path not in out:
            raise PatchError(f"diff targets unknown file {fd.path}")
        lines = out[fd.path].splitlines(keepends=True)
        result: list[str] = []
        cursor = 0
        for h in fd.hunks:
            before, after = _hunk_body(h)
            start = _find(lines, before, h.old_start - 1, cursor)
            result.extend(lines[cursor:start])
            result.extend(x if x.endswith("\n") else x + "\n" for x in after)
            cursor = start + len(before)
        result.extend(lines[cursor:])
        if result and not out[fd.path].endswith("\n") and result[-1].endswith("\n"):
            result[-1] = result[-1].rstrip("\n")
        out[fd.path] = "".join(result)
    return out


def touched_paths(diff_text: str) -> list[str]:
    return [fd.path for fd in parse_diff(diff_text)]
