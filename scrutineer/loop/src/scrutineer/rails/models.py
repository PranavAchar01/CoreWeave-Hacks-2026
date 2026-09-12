"""W&B Models — one run per component per round, which is what ARIA reads.

The ledger already knows, for every round, how much each component was blamed for and whether the
change to it moved the held-out score. Writing that as a run per component per round turns the
ledger into something a person — or ARIA — can pivot, chart and question inside the workspace,
instead of a JSON file only this program can read.

Backfills from a finished season bundle so a run does not have to be repeated to get the runs.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

from . import Backend


@dataclass
class RunRef:
    name: str
    url: str


class ModelsRail:
    def __init__(self, project: str | None = None) -> None:
        from .inference import entity_project

        ep = project or entity_project()
        self.entity, _, self.project = ep.partition("/")
        self.project = self.project or "scrutineer"
        self.backend = (Backend("wandb-models", real=True, detail=f"{self.entity}/{self.project}")
                        if os.environ.get("WANDB_API_KEY") and os.environ.get("SCRUTINEER_MODELS") != "off"
                        else Backend("wandb-models", real=False, detail="no WANDB_API_KEY"))
        self.written = 0
        self.report_note = ""

    def write_round(self, *, generation: int, role: str, config: dict[str, Any],
                    metrics: dict[str, Any], group: str = "season") -> RunRef | None:
        if not self.backend.real:  # pragma: no cover - needs a key
            return None
        try:
            import wandb

            run = wandb.init(entity=self.entity, project=self.project,
                             name=f"round-{generation:02d}-{role.lower()}",
                             group=group, job_type="round", reinit=True,
                             config={"generation": generation, "role": role, **config},
                             settings=wandb.Settings(silent=True, console="off"))
            run.log({**metrics, "generation": generation})
            url = run.url
            run.finish()
            self.written += 1
            return RunRef(name=run.name, url=url)
        except Exception:
            return None

    def backfill(self, bundle: dict[str, Any], group: str = "season") -> list[RunRef]:
        """Every component, every round: what it was blamed for and what the round bought."""
        out: list[RunRef] = []
        for r in bundle.get("rounds", []):
            gen = r["generation"]
            picked = r.get("role")
            for role, s in (r.get("standings") or {}).items():
                ref = self.write_round(
                    generation=gen, role=role, group=group,
                    config={"mode": r.get("mode"), "rule_fired": r.get("rule_fired"),
                            "picked": role == picked, "part": r.get("part") if role == picked else None},
                    metrics={
                        "blame_s": s.get("blame_s", 0.0),
                        "incidents": s.get("n", 0),
                        "ci_lo": (s.get("ci") or [0, 0])[0],
                        "ci_hi": (s.get("ci") or [0, 0])[1],
                        "variance": s.get("var", 0.0),
                        "picked": 1 if role == picked else 0,
                        "promoted": 1 if (role == picked and r.get("promoted")) else 0,
                        "official_delta": r.get("d_sealed", 0.0) if role == picked else 0.0,
                        "claimed_s": r.get("claimed_s"),
                        "official_s": r.get("official_s"),
                        "cost_usd": r.get("cost_usd", 0.0),
                    })
                if ref:
                    out.append(ref)
        return out

    def season_report(self, bundle: dict[str, Any], title: str = "Scrutineer — the season") -> str | None:
        """A W&B Report so the season has a URL a person can open, and ARIA a document to cite."""
        if not self.backend.real:  # pragma: no cover
            return None
        try:
            import wandb_workspaces.reports.v2 as wr
        except ImportError:
            self.report_note = "wandb-workspaces is not installed"
            return None
        rounds = bundle.get("rounds", [])
        kept = [r for r in rounds if r.get("promoted")]
        first = rounds[0]["official_s"] if rounds else 0
        last = rounds[-1]["official_s"] if rounds else 0
        desc = (f"{len(rounds)} runs, {len(kept)} changes kept, held-out score "
                f"{first:.2f} to {last:.2f}. Every number produced by the loop in loop/.")
        blocks: list[Any] = [wr.MarkdownBlock(text=_report_markdown(bundle))]
        # The panel grid is the part most likely to be rejected by a schema change, and a report
        # with the numbers in it is worth more than no report at all, so it is added separately.
        try:
            blocks.append(wr.PanelGrid(
                runsets=[wr.Runset(entity=self.entity, project=self.project, name="rounds")],
                panels=[wr.LinePlot(x="generation", y=["official_s"], title="Held-out score by run"),
                        wr.LinePlot(x="generation", y=["blame_s"], title="Blame by component"),
                        wr.BarPlot(metrics=["official_delta"], title="Seconds gained")]))
        except Exception as e:  # pragma: no cover - schema drift in the reports SDK
            self.report_note = f"panels omitted: {type(e).__name__}: {e}"
        try:
            report = wr.Report(project=self.project, entity=self.entity, title=title,
                               description=desc, blocks=blocks)
            report.save()
            return report.url
        except Exception as e:
            if len(blocks) > 1:                      # retry without the panels rather than give up
                self.report_note = f"panels rejected: {type(e).__name__}"
                try:
                    report = wr.Report(project=self.project, entity=self.entity, title=title,
                                       description=desc, blocks=blocks[:1])
                    report.save()
                    return report.url
                except Exception as e2:
                    self.report_note = f"{type(e2).__name__}: {e2}"
                    return None
            self.report_note = f"{type(e).__name__}: {e}"
            return None


def _report_markdown(bundle: dict[str, Any]) -> str:
    rows = ["| run | picked | kept | held-out | change |", "|---|---|---|---|---|"]
    for r in bundle.get("rounds", []):
        rows.append(f"| {r['generation']} | {r.get('role') or '—'} | "
                    f"{'yes' if r.get('promoted') else 'no'} | {r['official_s']:.2f} | "
                    f"{(r.get('diff_summary') or r.get('rule_fired') or '')[:60]} |")
    return ("## What the loop did\n\n"
            "Each run: the agent attempts coding tasks it has never seen, replays every failure "
            "with one component corrected to find which one caused it, writes a change to that "
            "component, and keeps it only if it survives ten checks including one on a held-out "
            "set.\n\n" + "\n".join(rows))


_RAIL: ModelsRail | None = None


def models() -> ModelsRail:
    global _RAIL
    if _RAIL is None:
        _RAIL = ModelsRail()
    return _RAIL
