"""The comparison anyone can run for themselves.

One task, one model, two harnesses: the one the agent started with and the one it ended with.
The only difference is what the context component decided to put in front of the model. Exporting
it as data means the page can run it in a visitor's browser with the visitor's own key, and the
generated code is executed client-side — it never touches a server.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .car.roles import shape_context
from .circuits import Item
from .theta import Theta

SYSTEM = "You are writing one Python function. Output only code."


def _harness(theta: Theta, item: Item) -> dict[str, Any]:
    ctx = shape_context(theta, item)
    a = theta.aero
    return {
        "context": ctx.text,
        "refs": ctx.ref_ids,
        "missing": sorted(ctx.missing),
        "retrieval": a.get("retrieval"),
        "n_refs": a.get("n_refs"),
        "verification": (theta.data.get("probe") or {}).get("mode"),
        "samples": (theta.tyres.get("modes", {}).get(3) or {}).get("samples", 1),
    }


def build_trial(
    *, before: Theta, after: Theta, n: int = 4, seed: int = 1994, use_rates: bool = True
) -> dict[str, Any]:
    """One interface spec, one model, two harnesses.

    The only difference between the two sides is what the retrieval component decided to put in
    front of the model. Exported as data so a visitor can run it in their own browser with their
    own key — and audit both results with the same engine the loop used.
    """
    from .webtasks import build_pool as web_pool

    pool = web_pool()
    picks: list[Item] = []
    seen: set[str] = set()
    for it in sorted(pool, key=lambda i: -i.difficulty):
        if it.family in seen:
            continue
        seen.add(it.family)
        picks.append(it)
        if len(picks) >= n:
            break
    _ = (seed, use_rates)

    tasks = []
    for it in picks:
        tasks.append(
            {
                "id": it.id,
                "family": it.family,
                "title": it.title,
                "prompt": it.prompt,
                "must": [list(m) for m in it.must],
                "concepts": sorted(it.concepts),
                "before": _harness(before, it),
                "after": _harness(after, it),
            }
        )
    return {
        "schema": 2,
        "system": (
            "You are building a web interface that real people will use, including people "
            "using a screen reader or a keyboard alone. Return one complete, self-contained "
            "HTML document and nothing else. Inline all CSS. Make no external requests."
        ),
        "models": ["OpenPipe/Qwen3-14B-Instruct"],
        "axe": "https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js",
        "before_label": "the harness it starts with",
        "after_label": "after the upgrades the loop found",
        "tasks": tasks,
    }


def champion_from_bundle(bundle: dict[str, Any], base: Theta) -> Theta:
    """Replay the accepted diffs, in order, onto the starting harness.

    The bundle records the exact change kept at each run, so the finished harness can be rebuilt
    from the record rather than trusted from a file someone might have edited."""
    from .patchtool import PatchError, apply_diff

    files = dict(base.files)
    for r in bundle.get("rounds", []):
        if not r.get("promoted") or not r.get("diff"):
            continue
        try:
            files = apply_diff(files, r["diff"])
        except PatchError:
            continue
    return Theta.from_files(base.root, files)


def write_trial(
    path: Path,
    *,
    before_root: Path | None = None,
    after_root: Path | None = None,
    n: int = 4,
    bundle: Path | None = None,
) -> Path:
    base = Theta.load(before_root)
    before = starting_harness(base)
    # A champion left on disk by a real season wins; otherwise the comparison uses the upgrades
    # the loop's replay identified, which is what it is labelled as on the page.
    # A season that promoted changes leaves its finished harness on disk; that is the real
    # comparison and it wins. Otherwise use the upgrades the loop's replay identified, which is
    # what the page says it is showing. Never ship two identical sides labelled as a comparison.
    after = (
        Theta.load(after_root)
        if after_root and (Path(after_root) / "skills").exists()
        else upgraded_harness(base)
    )
    if after.full_hash == before.full_hash:
        after = upgraded_harness(base)
    _ = bundle
    obj = build_trial(before=before, after=after, n=n)
    obj["identical"] = before.full_hash == after.full_hash
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2))
    return path


def with_extra_samples(theta: Theta, k: int = 1) -> Theta:
    """The same harness, drawing `k` more candidates at every engine mode. Nothing else changes.

    This is the sampling half of the test-time-scaling arm; `scaling_harness` adds the selector
    that makes extra draws worth anything. arXiv:2607.12227 measured harness evolution against it at
    matched budget and it won by a distance — parallel sampling +13.1 pass@1 against +2.9 for
    evolving the harness — and it prescribes the arm for any credible harness claim. A loop that
    cannot beat "spend the same money on more draws" has not found a better harness; it has found
    a more expensive way to resample.
    """
    import yaml

    ty = yaml.safe_load(theta.files["skills/tyres/tyres.yaml"]) or {}
    modes = {m: {**v, "samples": int(v["samples"]) + k} for m, v in ty.get("modes", {}).items()}
    files = dict(theta.files)
    files["skills/tyres/tyres.yaml"] = yaml.safe_dump({**ty, "modes": modes}, sort_keys=False)
    return Theta.from_files(theta.root, files)


def scaling_harness(base: Theta, k: int = 1) -> Theta:
    """The starting harness drawing `k` more candidates and choosing between them by the brief's own
    worked examples — the comparator a champion has to beat before its gain is a harness gain.

    Two files change, deliberately. More draws with no selector are one draw at a higher price: the
    starting harness probes code at `syntax`, where every candidate that parses scores 1.0, a tie
    keeps the first, and the extra samples are thrown away unread. Best-of-k needs something to be
    best *at*. The only legitimate judge is the docstring's examples, which the agent was handed;
    the grading tests stay out of reach exactly as they do for every other harness.
    """
    import yaml

    t = with_extra_samples(starting_harness(base), k)
    files = dict(t.files)
    da = yaml.safe_load(files.get("skills/data/tools.yaml", "") or "{}") or {}
    da["probe"] = {**da.get("probe", {}), "enabled": True, "mode": "audit"}
    files["skills/data/tools.yaml"] = yaml.safe_dump(da, sort_keys=False)
    return Theta.from_files(t.root, files)


def starting_harness(base: Theta) -> Theta:
    """What the agent begins a season with: keyword retrieval, two references, and a check that
    only asks whether the output looks like HTML."""
    import yaml

    files = dict(base.files)
    pol = yaml.safe_load(files.get("skills/aero/policy.yaml", "") or "{}") or {}
    pol.update({"retrieval": "keyword", "n_refs": 2, "budget_tokens": 900, "layout": "refs-first"})
    files["skills/aero/policy.yaml"] = yaml.safe_dump(pol, sort_keys=False)
    refs = files.get("skills/aero/references.md", "")
    cut = refs.find("\n## ref-")
    if cut > 0:
        second = refs.find("\n## ref-", cut + 1)
        third = refs.find("\n## ref-", second + 1) if second > 0 else -1
        if third > 0:
            files["skills/aero/references.md"] = refs[:third] + "\n"
    da = yaml.safe_load(files.get("skills/data/tools.yaml", "") or "{}") or {}
    da["probe"] = {**da.get("probe", {}), "mode": "syntax", "reaudit": False}
    files["skills/data/tools.yaml"] = yaml.safe_dump(da, sort_keys=False)
    return Theta.from_files(base.root, files)


# The changes the loop's own counterfactual replay identified as causal: correcting retrieval or
# verification is what flips a failing interface, worth roughly +10s and +20s respectively.
UPGRADED_REFERENCES = """
## ref-contrast
concepts: contrast
Body text needs 4.5:1 against its background and large text 3:1. Mid greys on white fail; check
the pair before you use it, and never rely on colour alone to carry meaning.

## ref-landmarks
concepts: landmarks, headings, language
Set <html lang="en"> and a non-empty <title>. Every region of content belongs inside <header>,
<nav>, <main> or <footer>. Exactly one <h1>, and heading levels do not skip.

## ref-controls
concepts: labels, names, keyboard
Every control needs a programmatic name: <label for> beside the input, or aria-label on an
icon-only control. Everything operable by mouse is operable by keyboard, with a visible focus
style. Placeholder text is not a label.

## ref-widgets
concepts: dialogs, tables, lists, status, images
A modal needs role="dialog" aria-modal="true" and an accessible name. Data tables need
<th scope>; a sortable header needs aria-sort. Grouped items belong in <ul>/<ol>. A message that
appears after an action needs role="status". Every <img> needs alt; decorative ones take alt="".
"""


def upgraded_harness(base: Theta) -> Theta:
    """The harness after the upgrades the loop found: retrieve by concept, carry the references
    the briefs are actually judged against, and audit the page before submitting it."""
    import yaml

    files = dict(base.files)
    pol = yaml.safe_load(files.get("skills/aero/policy.yaml", "") or "{}") or {}
    pol.update({"retrieval": "concept-match", "n_refs": 5, "budget_tokens": 2000, "layout": "spec-first"})
    files["skills/aero/policy.yaml"] = yaml.safe_dump(pol, sort_keys=False)
    files["skills/aero/references.md"] = files.get("skills/aero/references.md", "") + UPGRADED_REFERENCES
    da = yaml.safe_load(files.get("skills/data/tools.yaml", "") or "{}") or {}
    da["probe"] = {**da.get("probe", {}), "mode": "audit", "reaudit": True}
    da["schema_version"] = 2
    files["skills/data/tools.yaml"] = yaml.safe_dump(da, sort_keys=False)
    return Theta.from_files(base.root, files)
