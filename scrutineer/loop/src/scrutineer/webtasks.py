"""The task: build web interfaces that real people can actually use.

Every run, the agent is handed interface specs — a checkout form, a modal dialog, a sortable
table — and has to produce a working HTML document. Two things decide whether it succeeded, and
neither of them is a model:

  * **axe-core, in real Chromium.** The industry-standard accessibility engine, run against the
    page as a browser renders it. Violations come back with a WCAG rule id and an impact, and are
    weighted critical 10 / serious 5 / moderate 2 / minor 1.
  * **functional assertions.** Selectors that have to exist and counts that have to match, so an
    empty page cannot score zero violations and call itself finished.

The point of scoring this way is that anyone can check it. Every page the agent builds is a real
document at a real URL: open it, run axe yourself, and compare. There is no benchmark to take on
trust.
"""

from __future__ import annotations

import hashlib
import json
import threading
from dataclasses import dataclass, field
from typing import Any

AXE_CDN = "https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js"
IMPACT_WEIGHT = {"critical": 10, "serious": 5, "moderate": 2, "minor": 1, None: 1}

# WCAG rule families, used as the retrieval keys for the reference set. A spec declares the ones
# its interface will be judged on, which is what makes the retrieval component load-bearing:
# the agent cannot satisfy a rule nobody put in front of it except by luck.
CONCEPTS = [
    "labels", "names", "contrast", "landmarks", "headings", "tables", "dialogs",
    "keyboard", "images", "language", "lists", "status",
]


@dataclass(frozen=True)
class Task:
    id: str
    family: str
    title: str
    prompt: str
    concepts: frozenset[str]
    difficulty: float
    must: tuple = ()          # (css selector, minimum count) assertions the interface has to meet
    forbid: tuple = ()        # selectors that must not appear
    kind: str = "web"

    @property
    def entry_point(self) -> str:
        return self.family


# Checked on every page regardless of the brief, and between them the majority of what actually
# fails. A spec that does not declare them cannot have its real failures fixed by retrieval.
UNIVERSAL = ["language", "landmarks", "headings", "contrast", "names"]


def _t(idx: int, family: str, title: str, brief: str, concepts: list[str], difficulty: float,
       must: list[tuple[str, int]], forbid: list[str] | None = None) -> Task:
    prompt = (
        f"{brief}\n\n"
        "Return one complete, self-contained HTML document. Inline any CSS in a <style> tag. "
        "No external requests. It will be opened in a browser and checked against WCAG 2.2 AA by "
        "axe-core, and against the functional requirements above."
    )
    return Task(id=f"w{idx:02d}", family=family, title=title, prompt=prompt,
                concepts=frozenset(list(concepts) + UNIVERSAL), difficulty=difficulty,
                must=tuple(must), forbid=tuple(forbid or []))


# ------------------------------------------------------------------------------------------------
# The specs. Real interface patterns, each with the WCAG families it will be judged on.
# ------------------------------------------------------------------------------------------------
SPECS: list[dict[str, Any]] = [
    dict(family="checkout", title="Checkout form",
         brief="Build a checkout form: email, card number, expiry, CVC, a country select, and a "
               "Pay button. Show the order total.",
         concepts=["labels", "names", "landmarks", "headings", "language"], difficulty=0.45,
         must=[("form", 1), ("input", 4), ("select", 1), ("button", 1), ("h1", 1)]),
    dict(family="invoices", title="Sortable invoice table",
         brief="Build a table of five invoices with columns Date, Client, Amount and Status. The "
               "column headers must be sortable controls.",
         concepts=["tables", "names", "headings", "landmarks", "language"], difficulty=0.60,
         must=[("table", 1), ("th", 4), ("tbody tr", 5), ("h1", 1)]),
    dict(family="dialog", title="Destructive confirm dialog",
         brief="Build a modal dialog that asks the user to confirm deleting their account, with "
               "Cancel and Delete buttons, over a dimmed page behind it.",
         concepts=["dialogs", "names", "keyboard", "headings", "language"], difficulty=0.70,
         must=[("[role=dialog], dialog", 1), ("button", 2), ("h1", 1)]),
    dict(family="header", title="Site header",
         brief="Build a site header with a wordmark, four navigation links, a search field, and a "
               "user menu button.",
         concepts=["landmarks", "names", "labels", "headings", "language"], difficulty=0.40,
         must=[("header", 1), ("nav a", 4), ("input", 1), ("button", 1), ("h1", 1)]),
    dict(family="pricing", title="Pricing plans",
         brief="Build a pricing section with three plan cards. Each has a plan name, a price, a "
               "list of features, and a button to choose it.",
         concepts=["headings", "lists", "contrast", "landmarks", "language"], difficulty=0.45,
         must=[("h1", 1), ("ul li", 6), ("button, a[role=button]", 3)]),
    dict(family="signup", title="Sign-up with validation",
         brief="Build a sign-up form with name, email and password, where the password field "
               "explains its requirements and an error message is shown for an invalid email.",
         concepts=["labels", "status", "names", "landmarks", "language"], difficulty=0.65,
         must=[("form", 1), ("input", 3), ("button", 1), ("h1", 1)]),
    dict(family="gallery", title="Image gallery",
         brief="Build a gallery of six product images in a grid, each with a caption and a price.",
         concepts=["images", "headings", "lists", "landmarks", "language"], difficulty=0.40,
         must=[("img", 6), ("h1", 1)]),
    dict(family="settings", title="Settings toggles",
         brief="Build a settings panel with four labelled on/off switches and a Save button.",
         concepts=["labels", "names", "keyboard", "headings", "language"], difficulty=0.55,
         must=[("input[type=checkbox], [role=switch]", 4), ("button", 1), ("h1", 1)]),
    dict(family="tabs", title="Tabbed panel",
         brief="Build a three-tab interface where each tab reveals a different panel of text.",
         concepts=["keyboard", "names", "headings", "landmarks", "language"], difficulty=0.75,
         must=[("[role=tab]", 3), ("[role=tabpanel]", 3), ("h1", 1)]),
    dict(family="search", title="Search results",
         brief="Build a search results page: a search field with the current query, a count of "
               "results, and a list of eight results each with a title link and a snippet.",
         concepts=["status", "landmarks", "lists", "labels", "language"], difficulty=0.55,
         must=[("input", 1), ("li a, article a", 8), ("h1", 1)]),
    dict(family="stepper", title="Multi-step form",
         brief="Build step two of a three-step booking form, showing progress, with two fields "
               "and Back and Continue buttons.",
         concepts=["labels", "status", "names", "headings", "language"], difficulty=0.65,
         must=[("input", 2), ("button", 2), ("h1", 1)]),
    dict(family="dashboard", title="Metrics dashboard",
         brief="Build a dashboard with four metric cards, each with a label, a big number, and a "
               "change against last week.",
         concepts=["headings", "landmarks", "contrast", "status", "language"], difficulty=0.50,
         must=[("h1", 1), ("h2, h3", 4)]),
]


def build_pool() -> list[Task]:
    """Each spec is instantiated at three sizes, so a run has enough tasks to earn evidence."""
    out: list[Task] = []
    sizes = [
        ("", 0.0, ""),
        (" Use a dark colour scheme.", 0.05,
         " Use a dark colour scheme; text still has to meet contrast requirements."),
        (" Make it work on a narrow phone screen.", 0.08,
         " Make it work on a narrow phone screen without hiding content from assistive technology."),
    ]
    i = 0
    for spec in SPECS:
        for si, (_tag, bump, extra) in enumerate(sizes):
            i += 1
            out.append(_t(i, spec["family"], spec["title"] + (f" ({si + 1})" if si else ""),
                          spec["brief"] + extra, spec["concepts"],
                          min(0.95, spec["difficulty"] + bump), spec["must"]))
    return out


# ------------------------------------------------------------------------------------------------
# The browser. One per thread, kept alive: launching Chromium per page would dominate the run.
# ------------------------------------------------------------------------------------------------
_local = threading.local()
_axe_source: str | None = None
_axe_lock = threading.Lock()


def _axe() -> str:
    """axe-core, fetched once and injected as source so an audit needs no network."""
    global _axe_source
    with _axe_lock:
        if _axe_source is None:
            import urllib.request

            with urllib.request.urlopen(AXE_CDN, timeout=60) as r:
                _axe_source = r.read().decode()
    return _axe_source


def _page_ctx():
    if getattr(_local, "browser", None) is None:
        from playwright.sync_api import sync_playwright

        _local.pw = sync_playwright().start()
        # An ephemeral browser that renders model-written HTML has no business touching the
        # system keychain. Without --use-mock-keychain, Chromium asks macOS for the "Chrome Safe
        # Storage" entry — the one Chrome encrypts cookies and passwords with — and re-prompts on
        # every launch. It is also left sandboxed on purpose: this renders untrusted output.
        _local.browser = _local.pw.chromium.launch(args=[
            "--use-mock-keychain",
            "--password-store=basic",
            "--disable-extensions",
            "--no-first-run",
            "--no-default-browser-check",
        ])
    return _local.browser


def shutdown() -> None:
    if getattr(_local, "browser", None) is not None:
        with __import__("contextlib").suppress(Exception):
            _local.browser.close()
            _local.pw.stop()
        _local.browser = None


@dataclass
class Audit:
    ok: bool                                  # functional requirements met and no violations
    weighted: int = 0                         # violations, weighted by impact
    violations: list[dict[str, Any]] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    error: str | None = None
    rendered: bool = False
    nodes: int = 0

    @property
    def critical(self) -> int:
        return sum(v["n"] for v in self.violations if v.get("impact") in ("critical", "serious"))

    def row(self) -> dict[str, Any]:
        return {"ok": self.ok, "weighted": self.weighted, "critical": self.critical,
                "rules": [v["id"] for v in self.violations][:8], "missing": self.missing,
                "error": self.error}


_AUDIT_JS = """async () => {
  const r = await axe.run(document, { resultTypes: ['violations'] });
  return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length,
                                  help: v.help }));
}"""

_CACHE: dict[str, Audit] = {}
_CACHE_LOCK = threading.Lock()


def audit(task: Task, html: str, *, cache: bool = True) -> Audit:
    """Render the document and judge it: axe-core for accessibility, selectors for function."""
    if not html or "<" not in html:
        return Audit(ok=False, error="nothing that looks like a document")
    key = hashlib.sha256((task.id + "\x00" + html).encode()).hexdigest()
    if cache:
        with _CACHE_LOCK:
            hit = _CACHE.get(key)
        if hit is not None:
            return hit

    browser = _page_ctx()
    page = browser.new_page(viewport={"width": 1100, "height": 900})
    out: Audit
    try:
        page.set_content(html, wait_until="load", timeout=20000)
        page.add_script_tag(content=_axe())
        vio = page.evaluate(_AUDIT_JS)
        missing = []
        for sel, want in task.must:
            try:
                got = page.eval_on_selector_all(sel, "els => els.length")
            except Exception:
                got = 0
            if got < want:
                missing.append(f"{sel} ({got}/{want})")
        for sel in task.forbid:
            with __import__("contextlib").suppress(Exception):
                if page.eval_on_selector_all(sel, "els => els.length"):
                    missing.append(f"must not contain {sel}")
        nodes = page.evaluate("() => document.querySelectorAll('*').length")
        weighted = sum(IMPACT_WEIGHT.get(v.get("impact"), 1) * v["n"] for v in vio)
        out = Audit(ok=(not vio and not missing), weighted=weighted, violations=vio,
                    missing=missing, rendered=True, nodes=nodes)
    except Exception as e:
        out = Audit(ok=False, error=f"{type(e).__name__}: {str(e)[:160]}")
    finally:
        with __import__("contextlib").suppress(Exception):
            page.close()
    if cache:
        with _CACHE_LOCK:
            _CACHE[key] = out
    return out


def score(a: Audit) -> float:
    """0 to 1. Function is a gate, not a slider: an interface missing its requirements scores 0
    however few accessibility violations an empty page happens to have."""
    if not a.rendered or a.missing:
        return 0.0
    return 1.0 / (1.0 + a.weighted / 8.0)


def extract(text: str) -> str:
    import re

    m = re.search(r"```(?:html)?\s*\n(.*?)```", text or "", re.S)
    body = (m.group(1) if m else (text or "")).strip()
    if "<" in body and "doctype" not in body[:200].lower() and "<html" not in body[:200].lower():
        i = body.find("<")
        body = body[i:]
    return body


def summary(pool: list[Task]) -> str:
    return json.dumps({"tasks": len(pool), "families": sorted({t.family for t in pool}),
                       "concepts": CONCEPTS})
