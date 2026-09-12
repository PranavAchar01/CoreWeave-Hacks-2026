"""STEWARDS' TIMING — the only thing that decides `pass`.

QUALI is public: the improver may read it through the telemetry rail. SEALED is private: it lives
behind `SealedEvaluator`, which never returns an item, a prompt or a candidate — only the
aggregate `official:gen-n` object (race time, opaque per-item booleans, cost). That object is the
one thing that crosses the boundary, and it is what the debrief, the seesaw and `manifest_check`
read. No agent in the loop ever holds a sealed item.
"""

from __future__ import annotations

import atexit
import hashlib
import os
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any

from . import events
from .car.lap import LapRecord, run_lap
from .circuits import Item
from .objective import LapScore, pass_rate, race_time, score_lap
from .rails.evals import evals
from .rails.sandbox import sandbox
from .regs import Regs
from .telemetry import Tracer, publish_object
from .theta import Theta

# One pool for the whole process, not one per race.
#
# Each audit needs a browser, and Playwright's sync API binds a browser to the thread that
# created it — so a fresh ThreadPoolExecutor per race meant a fresh Chromium per race, and none
# of them were ever reclaimed. Sixty-six of them were alive before this was found. Reusing the
# threads bounds the browser count to the worker count.
_POOL: ThreadPoolExecutor | None = None
_POOL_N = 0
_POOL_LOCK = threading.Lock()


def pool(workers: int) -> ThreadPoolExecutor:
    global _POOL, _POOL_N
    with _POOL_LOCK:
        if _POOL is None or workers > _POOL_N:
            if _POOL is not None:
                _POOL.shutdown(wait=True)
            _POOL = ThreadPoolExecutor(max_workers=workers, thread_name_prefix="lap")
            _POOL_N = workers
        return _POOL


@atexit.register
def _close_pool() -> None:
    global _POOL
    if _POOL is not None:
        _POOL.shutdown(wait=False)
        _POOL = None


@dataclass
class RaceResult:
    name: str  # "quali" | "sealed" | "smoke"
    generation: int
    laps: list[LapRecord] = field(default_factory=list)
    scores: list[LapScore] = field(default_factory=list)
    per_item: dict[str, bool] = field(default_factory=dict)
    cost_usd: float = 0.0
    budget_usd: float = 0.0
    tracer: Tracer | None = None

    @property
    def race_s(self) -> float:
        return race_time(self.scores)

    @property
    def pass_rate(self) -> float:
        return pass_rate(self.scores)

    def row(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "generation": self.generation,
            "race_s": round(self.race_s, 3),
            "pass_rate": round(self.pass_rate, 3),
            "cost_usd": round(self.cost_usd, 4),
            "budget_usd": round(self.budget_usd, 4),
            "retired": sum(1 for lp in self.laps if lp.retired),
            "laps": len(self.laps),
        }


def verify(item: Item, source: str) -> bool:
    """Pass means the interface does what was asked and axe-core finds nothing.

    Judged by a browser, not a model: the page is rendered, its functional requirements are
    checked as selectors, and axe-core is run against the live DOM. Anyone can open the same page
    and get the same answer.
    """
    if not source or not source.strip():
        return False
    # An Item (python puzzle) has no `kind`; a Task declares "web". Defaulting the
    # unknown case to "web" meant python source was audited as HTML and every lap failed.
    if getattr(item, "kind", "py") == "web":
        from .webtasks import audit as web_audit

        return web_audit(item, source).ok
    return sandbox().run(item.harness(source)).ok


def audit_of(item: Item, source: str):
    """The full audit behind `verify`, for the record the page carries."""
    from .webtasks import audit as web_audit

    return web_audit(item, source)


_emit_lock = threading.Lock()
_emit_state = {"done": 0}


def run_race(
    *,
    theta: Theta,
    items: list[Item],
    regs: Regs,
    generation: int,
    name: str,
    seed: int,
    trials: int = 1,
    tracer: Tracer | None = None,
    cap_usd: float | None = None,
    workers: int | None = None,
) -> RaceResult:
    tr = tracer or Tracer(generation=generation)
    # The cost cap is a race budget, not a per-lap allowance. A strategist that pushes on a
    # hopeless lap starves the laps that come after it, which is what makes RETIRE a real
    # decision rather than a label.
    workers = workers if workers is not None else int(os.environ.get("SCRUTINEER_WORKERS", "1"))
    share = float(regs.g("cost", "race_shares").get(name, 0.30))
    budget = cap_usd if cap_usd is not None else regs.race_cap_usd * share
    with _emit_lock:
        _emit_state["done"] = 0
    res = RaceResult(name=name, generation=generation, tracer=tr)
    res.budget_usd = budget
    race_id = f"{name}-gen{generation}"
    total = max(1, len(items) * trials)
    # Each lap gets an equal slice of the race budget. Serial spending would let an early lap
    # starve the rest, which is the point of RETIRE — but it also serialises the whole race, and
    # a season is thousands of laps. The budget is therefore allocated up front and the laps run
    # concurrently; RETIRE still binds inside each lap.
    lap_cap = budget / total * 2.0
    jobs = [
        (trial, idx, item)
        for trial, item, idx in (
            (t, it, t * len(items) + i) for t in range(trials) for i, it in enumerate(items)
        )
    ]

    def one(job):
        trial, idx, item = job
        lap = run_lap(
            theta=theta,
            item=item,
            tracer=tr,
            regs=regs,
            seed=seed + trial * 1000,
            lap_index=idx,
            race_id=race_id,
            cap_usd=lap_cap,
        )
        passed = verify(item, lap.submitted)
        # reported here rather than after the pool drains, so a watcher sees each interface land
        # as it lands instead of twenty at once
        if name in ("quali", "sealed"):
            a = audit_of(item, lap.submitted) if getattr(item, "kind", "py") == "web" else None
            with _emit_lock:
                _emit_state["done"] += 1
                seen = _emit_state["done"]
            events.emit(
                "lap",
                race=name,
                generation=generation,
                index=seen,
                total=total,
                item=item.id,
                family=item.family,
                title=getattr(item, "title", item.family),
                passed=bool(passed),
                weighted=(a.weighted if a else 0),
                rules=[v["id"] for v in (a.violations if a else [])][:3],
                missing=(a.missing[:2] if a else []),
                steps=lap.steps,
            )
        return trial, idx, item, lap, passed

    if workers and workers > 1 and total > 1:
        done = list(pool(workers).map(one, jobs))
    else:
        done = [one(j) for j in jobs]

    eval_rows: list[dict[str, Any]] = []
    for trial, _idx, item, lap, passed in sorted(done, key=lambda d: d[1]):
        sc = score_lap(
            regs,
            passed=passed,
            cost_usd=lap.cost_usd,
            wall_s=lap.wall_s,
            cap_usd=max(lap_cap, 1e-9),
            timed_out=lap.retired,
        )
        res.laps.append(lap)
        res.scores.append(sc)
        res.per_item[f"{item.id}#{trial}"] = passed
        res.cost_usd += lap.cost_usd
        eval_rows.append(
            {
                "item": item.id,
                "passed": passed,
                "lap_s": sc.lap_s,
                "cost_usd": lap.cost_usd,
                "steps": lap.steps,
            }
        )
    # the same pass/fail the gates used, on the Evals tab where a reviewer can page through it
    if name in ("quali", "sealed"):
        evals().log_race(
            name=name,
            generation=generation,
            theta_hash=theta.full_hash[:16],
            rows=eval_rows,
            summary={
                "race_s": round(res.race_s, 4),
                "pass_rate": round(res.pass_rate, 4),
                "cost_usd": round(res.cost_usd, 5),
                "laps": len(res.laps),
            },
        )
    return res


class SealedEvaluator:
    """Holds the sealed circuit. Only `official` leaves this object."""

    def __init__(self, items: list[Item], regs: Regs, salt: str = "sealed") -> None:
        self._items = items
        self._regs = regs
        self._salt = salt
        # Every question ever put to this split. The counter lives here rather than on the
        # caller because the caller is the thing being kept honest: a holdout loses its validity
        # by being asked, and only the object holding it can see every ask.
        self.queries = 0

    @property
    def n_items(self) -> int:
        """The size of the split. A count is not the split, so this does not breach the rule that
        only `official` leaves the object — and the Ladder's margin is derived from it."""
        return len(self._items)

    def opaque(self, item_id: str) -> str:
        return hashlib.sha256(f"{self._salt}:{item_id}".encode()).hexdigest()[:10]

    def official(
        self, theta: Theta, generation: int, seed: int, publish: bool = True, trials: int = 2
    ) -> dict[str, Any]:
        self.queries += 1
        # two trials, as the evaluation contract specifies: at one trial a single flipped item
        # moves the race time by more than the seesaw's whole decision margin
        res = run_race(
            theta=theta,
            items=self._items,
            regs=self._regs,
            generation=generation,
            name="sealed",
            seed=seed,
            trials=trials,
            tracer=Tracer(generation=generation),
        )
        obj = {
            "generation": generation,
            "race_s": round(res.race_s, 4),
            "pass_rate": round(res.pass_rate, 4),
            "cost_usd": round(res.cost_usd, 5),
            # opaque ids. `pass` is every trial; `any` is at least one, so the regression gate can
            # tell a real loss from an item that merely flapped between trials.
            "per_item_pass": {
                self.opaque(k.split("#")[0]): all(
                    v2 for k2, v2 in res.per_item.items() if k2.split("#")[0] == k.split("#")[0]
                )
                for k in res.per_item
            },
            "per_item_any": {
                self.opaque(k.split("#")[0]): any(
                    v2 for k2, v2 in res.per_item.items() if k2.split("#")[0] == k.split("#")[0]
                )
                for k in res.per_item
            },
            "n_items": len(self._items),
        }
        if publish:
            obj["ref"] = publish_object(f"official:gen-{generation}", obj, tags=[f"gen-{generation}"])
        return obj
