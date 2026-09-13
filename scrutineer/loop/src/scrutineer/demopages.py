"""Real documents for the demonstration season.

The point of this project is that you can open what the agent built and check it yourself, so a
seeded season cannot link to files that do not exist. These are real pages: each one satisfies its
brief's structural requirements, and the ones that fail carry specific, deliberate defects. The
numbers in the seeded bundle are then measured off these files by the same axe-core run that
scores a live season — nothing in the demo is asserted where it could be measured.
"""

from __future__ import annotations

from .webtasks import Task

# The defects the loop learns to stop making, in the order it learns them. Every class in
# ASSIGN appears here, so the season finishes with nothing left on the table.
DEFECTS = ["contrast", "landmarks", "lang", "labels", "names", "aria"]
FIX_ORDER = ["contrast", "landmarks", "lang", "labels", "names"]

# Which page carries which defect. A page is clean once everything on its own line is fixed.
#
# Five defective pages out of twenty, one per defect class, spread across five different task
# families so both sides of the component x family partition still have something in them. The
# loop clears one class every two runs, so the season reads 15 of 20 clean on run one and 20 of
# 20 by run ten. These are real documents either way: the counts in the bundle are measured off
# them by the same axe-core run that scores a live season, so changing what the pages contain
# changes what is true about them, rather than changing what is claimed about them.
ASSIGN: list[list[str]] = [
    [], ["contrast"], [],          # checkout
    [], ["landmarks"], [],         # invoices
    [], [], [],                    # dialog
    ["lang"], [], [],              # header
    [], ["labels"], [],            # pricing
    [], ["names"], [],             # signup
    [], [],                        # gallery
]

CSS_OK = """body{margin:0;font:16px/1.5 system-ui,sans-serif;color:#16181d;background:#fff}
main,header{max-width:780px;margin:0 auto;padding:24px}
h1{font-size:28px;margin:0 0 4px}h2{font-size:19px;margin:22px 0 6px}
a{color:#0b4fa8}label{display:block;font-weight:600;margin:12px 0 4px}
input,select{font:inherit;padding:8px;border:1px solid #6c727f;border-radius:4px;width:100%;
  box-sizing:border-box;background:#fff;color:#16181d}
button{font:inherit;padding:9px 16px;border:0;border-radius:4px;background:#0b4fa8;color:#fff;
  cursor:pointer}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #b9bec9;padding:7px;
  text-align:left}th{background:#eef1f6}
ul{padding-left:20px}nav ul{display:flex;gap:16px;list-style:none;padding:0}
img{width:112px;height:78px;object-fit:cover;border-radius:4px}
.grid{display:flex;flex-wrap:wrap;gap:10px}
[role=tab]{background:#eef1f6;color:#16181d;border:1px solid #b9bec9}
"""
CSS_BAD_CONTRAST = "body{color:#9aa0a6;background:#c9ccd1}a{color:#8fa8c8}h1,h2{color:#a9aeb4}\n"

# A one-pixel grey PNG, so the gallery has real images rather than broken ones.
PIXEL = ("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4"
         "2mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")


def _btn(label: str, defective: bool) -> str:
    """A button with no accessible name is the single most common real failure on these pages."""
    return '<button><span aria-hidden="true">▸</span></button>' if defective \
        else f"<button>{label}</button>"


def _field(label: str, name: str, typ: str, defective: bool) -> str:
    if defective:
        # No label, no aria-label, and no placeholder either: a placeholder counts as an
        # accessible name under accname, so it would quietly pass the check it is here to fail.
        return f'<input type="{typ}" name="{name}">'
    return (f'<label for="{name}">{label}</label>'
            f'<input id="{name}" type="{typ}" name="{name}">')


def _link(text: str, defective: bool) -> str:
    return '<a href="#"><span aria-hidden="true">●</span></a>' if defective \
        else f'<a href="#">{text}</a>'


def _body(family: str, title: str, d: set[str]) -> str:
    lab, nam = "labels" in d, "names" in d
    if family == "checkout":
        return (f"<h1>{title}</h1><form>"
                + _field("Full name", "name", "text", lab)
                + _field("Email", "email", "email", lab)
                + _field("Card number", "card", "text", lab)
                + _field("Postcode", "post", "text", lab)
                + ('<label for="ctry">Country</label>' if not lab else "")
                + '<select id="ctry" name="ctry"><option>United Kingdom</option>'
                  "<option>Ireland</option></select>"
                + _btn("Pay £48.00", nam) + "</form>")
    if family == "invoices":
        rows = "".join(f"<tr><td>INV-10{i}</td><td>2026-0{i}-14</td><td>£{i * 120}.00</td>"
                       f"<td>{'Paid' if i % 2 else 'Due'}</td></tr>" for i in range(1, 7))
        return (f"<h1>{title}</h1><table><caption>Recent invoices</caption><thead><tr>"
                "<th scope=col>Number</th><th scope=col>Date</th><th scope=col>Amount</th>"
                f"<th scope=col>Status</th></tr></thead><tbody>{rows}</tbody></table>")
    if family == "dialog":
        return (f"<h1>{title}</h1>"
                '<div role="dialog" aria-modal="true" aria-labelledby="dt">'
                '<h2 id="dt">Delete this project?</h2>'
                "<p>Everything in it is removed. This cannot be undone.</p>"
                + _btn("Delete project", nam) + _btn("Cancel", nam) + "</div>")
    if family == "header":
        nav = "".join(f"<li>{_link(t, nam)}</li>" for t in ("Products", "Pricing", "Docs", "Blog"))
        return (f"<header><h1>{title}</h1><nav aria-label='Main'><ul>{nav}</ul></nav>"
                "<form role='search'>" + _field("Search", "q", "search", lab)
                + _btn("Search", nam) + "</form></header>"
                "<h2>Latest</h2><p>Everything below the header lives in the main landmark.</p>")
    if family == "pricing":
        items = "".join(f"<li>{t}</li>" for t in
                        ("10 seats", "Unlimited projects", "Audit log", "SSO", "Priority support",
                         "99.9% uptime"))
        return (f"<h1>{title}</h1><ul>{items}</ul>"
                + "".join(_btn(f"Choose {p}", nam) for p in ("Starter", "Team", "Scale"))
                + "<h2>Product updates</h2><form>"
                + _field("Email address", "sub", "email", lab) + "</form>")
    if family == "signup":
        return (f"<h1>{title}</h1><form>"
                + _field("Work email", "email", "email", lab)
                + _field("Password", "pw", "password", lab)
                + _field("Organisation", "org", "text", lab)
                + _btn("Create account", nam) + "</form>")
    if family == "gallery":
        cells = "".join(f'<figure><img src="{PIXEL}" alt="Sample {i}: a grey test swatch">'
                        f"<figcaption>Sample {i}</figcaption></figure>" for i in range(1, 7))
        return f'<h1>{title}</h1><div class="grid">{cells}</div>'
    return f"<h1>{title}</h1><p>{title} interface.</p>"


def render(task: Task, defects: set[str]) -> str:
    """A complete, standalone document for one brief, carrying exactly `defects`."""
    lang = "" if "lang" in defects else ' lang="en"'
    css = CSS_OK + (CSS_BAD_CONTRAST if "contrast" in defects else "")
    body = _body(task.family, task.title, defects)
    if "aria" in defects:
        body += '<div aria-hidden="true"><button>Report a problem</button></div>'
    wrap = f"<div>{body}</div>" if "landmarks" in defects else f"<main>{body}</main>"
    return (f"<!doctype html>\n<html{lang}>\n<head><meta charset=\"utf-8\">"
            f'<meta name="viewport" content="width=device-width,initial-scale=1">'
            f"<title>{task.title}</title>\n<style>{css}</style></head>\n<body>{wrap}</body>\n"
            "</html>\n")


def defects_at(run: int, page: int) -> set[str]:
    """What page `page` still gets wrong on run `run`, given the loop fixes one class per keep."""
    # a change kept on run N is what run N+1 runs with, so run 1 already has the first fix
    fixed = set(FIX_ORDER[: max(0, (run + 1) // 2)])
    return set(ASSIGN[page % len(ASSIGN)]) - fixed
