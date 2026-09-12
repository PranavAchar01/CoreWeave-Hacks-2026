"""`scrutineer` — the team's own command line."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from .chain import rows as chain_rows
from .chain import verify_chain
from .controller import Season, load_season_state
from .rails.aria import aria
from .rails.inference import inference
from .rails.registry import registry
from .rails.rl import rl
from .rails.sandbox import sandbox
from .rails.typed import typed
from .rails.weave_rail import weave_rail
from .regs import regs as load_regs

# what each key turns on, so `doctor` can say exactly what is missing and what it would buy
RAIL_KEYS: list[tuple[str, str, str]] = [
    ("WANDB_API_KEY", "Weave, Sandboxes, Serverless RL, Registry, Inference, ARIA",
     "one key unlocks six rails: trace mirroring, hardware-isolated sandboxes, the LoRA job, "
     "registry versions and aliases, the 14B driver, and the ARIA board"),
    ("WANDB_ENTITY_PROJECT", "W&B Inference project routing",
     "the `entity/project` string the OpenAI-compatible client needs to bill and route"),
    ("WANDB_SEALED_API_KEY", "the sealed circuit's second team",
     "a service-account key for <team>-sealed so the improver's process holds no key at all"),
    ("TYPESAFE_API_KEY", "TypeSafe System1 typed decisions",
     "the pit wall, the credit router and the scrutineer move off the local policy"),
    ("ANTHROPIC_API_KEY", "Race Engineer proposals via Claude Code",
     "the improver writes its own diffs and manifest instead of walking a fixed ladder"),
]


def _p(obj: Any) -> None:
    print(json.dumps(obj, indent=2, default=str))


def cmd_doctor(args: argparse.Namespace) -> int:
    import os

    r = load_regs()
    rails = {
        "driver (inference)": inference().backend,
        "typed decisions": typed().backend,
        "sandbox": sandbox().backend,
        "weave": weave_rail().backend,
        "serverless RL": rl().backend,
        "registry": registry().backend,
        "aria": aria().backend,
    }
    print(f"REGS.md          {r.path} sha256 {r.sha256[:16]}")
    print(f"season           {r.max_generations} generations, seed {r.seed}, mode {r.raw['season']['mode']}")
    print("\nRAILS")
    for name, b in rails.items():
        mark = "live" if b.real else "stand-in"
        print(f"  {name:20s} {b.name:22s} {mark:9s} {b.detail}")
    if sandbox().managed_reason:
        print(f"  {'':20s} {'':22s} {'':9s} managed sandbox: {sandbox().managed_reason}")
    print("\nKEYS")
    for key, unlocks, why in RAIL_KEYS:
        state = "set" if os.environ.get(key) else "MISSING"
        print(f"  {key:24s} {state:8s} {unlocks}")
        if not os.environ.get(key):
            print(f"  {'':24s}          -> {why}")
    live = sum(1 for b in rails.values() if b.real)
    print(f"\n{live}/{len(rails)} rails live. Everything below runs either way; a missing key "
          "downgrades one rail to a labelled stand-in, never the loop.")
    return 0


def cmd_season(args: argparse.Namespace) -> int:
    from .controller import clear_stale_pages

    clear_stale_pages()
    s = Season(seed=args.seed)
    if args.seed_tamper_at is not None:
        s.seed_tamper_at = args.seed_tamper_at

    def show(rep) -> None:
        st = f"PROMOTED {rep.part}" if rep.promoted else "blocked"
        bf = f"  BLACK FLAG {rep.black_flags[0]['cell']}" if rep.black_flags else ""
        print(f"gen {rep.generation:2d} | {rep.rule_fired:15s} {str(rep.role):11s} | "
              f"claimed {rep.claimed_s:7.3f} official {rep.official_s:7.3f} | "
              f"dQ {rep.d_quali:+6.2f} dS {rep.d_sealed:+6.2f} | {st}{bf}", flush=True)

    s.run_season(generations=args.generations, unattended_from=args.unattended_from,
                 on_generation=show)
    print(f"\naccepted {s.accepted}/{args.generations or load_regs().max_generations}")
    ok, msg = verify_chain()
    print(f"chain: {'intact' if ok else 'BROKEN'} — {msg[0]}")
    if args.export:
        from .bridge import export_broadcast

        print(f"broadcast written to {export_broadcast()}")
    return 0


def cmd_gen(args: argparse.Namespace) -> int:
    s = Season(seed=args.seed)
    rep = s.run_generation(unattended=args.unattended)
    _p({"generation": rep.generation, "rule_fired": rep.rule_fired, "role": rep.role,
        "claimed_s": rep.claimed_s, "official_s": rep.official_s, "promoted": rep.promoted,
        "part": rep.part, "gates": rep.gates, "verdict": rep.verdict, "debrief": rep.debrief})
    return 0


def cmd_race(args: argparse.Namespace) -> int:
    from .evaluator import run_race
    from .theta import Theta

    s = Season(seed=args.seed)
    res = run_race(theta=Theta.load(), items=s.circuit_items[: args.items], regs=s.regs,
                   generation=0, name="quali", seed=s.seed, trials=args.trials)
    _p({**res.row(), "backends": s.backends})
    return 0


def cmd_verify(args: argparse.Namespace) -> int:
    ok, msg = verify_chain()
    for m in msg:
        print(("  ok  " if ok else "  BAD ") + m)
    print(f"\n{len(chain_rows())} receipt(s)")
    for r in chain_rows():
        print(f"  round {r['round']:2d}  {r['role']:11s} {r['prefix']}  {r['new_version']:12s} "
              f"{r['mode']:10s} {r['rule_fired']:18s} official {r['official']:.3f}")
    return 0 if ok else 1


def cmd_export(args: argparse.Namespace) -> int:
    from .bridge import export_broadcast

    p = export_broadcast()
    print(p)
    return 0


def cmd_trial(args: argparse.Namespace) -> int:
    from pathlib import Path

    from .telemetry import state_dir
    from .trial import write_trial

    bundle = Path(args.bundle) if args.bundle else (state_dir() / "broadcast.json")
    p = write_trial(Path(args.out), n=args.tasks, bundle=bundle,
                    after_root=state_dir() / "champion")
    print(p)
    return 0


def cmd_runs(args: argparse.Namespace) -> int:
    """Write one W&B run per component per round from a finished season."""
    import json
    from pathlib import Path

    from .rails.models import models
    from .telemetry import state_dir

    bundle = json.loads(Path(args.bundle or (state_dir() / "broadcast.json")).read_text())
    m = models()
    print(f"backend: {m.backend}")
    refs = m.backfill(bundle, group=args.group)
    print(f"wrote {len(refs)} run(s)")
    if refs:
        print(f"first: {refs[0].url}")
    if args.report:
        url = m.season_report(bundle)
        print(f"report: {url or 'not created'}" + (f"  ({m.report_note})" if m.report_note else ""))
    return 0


def cmd_train(args: argparse.Namespace) -> int:
    """Actually train the driver. The one component that cannot be improved by editing a file."""
    import json

    from .circuits import split_pool
    from .rails.inference import entity_project
    from .regs import regs as _regs
    from .rl_job import run_job
    from .telemetry import state_dir
    from .theta import Theta

    r = _regs()
    ep = entity_project()
    entity, _, project = ep.partition("/")
    from .circuits import task_pool
    from .rl_job import band

    theta = Theta.load()
    if args.band:
        print("picking tasks the car solves sometimes but not always...")
        items = band(theta=theta, pool=task_pool(), regs=r, seed=r.seed, k=4, limit=args.items)
        if not items:
            print("no task sits in the band; the curriculum needs widening first")
            return 1
    else:
        items = split_pool(args.seed if args.seed is not None else r.seed).quali[: args.items]
    print(f"collecting {args.k} rollouts on each of {len(items)} tasks...")
    out = run_job(theta=theta, items=items, regs=r, seed=r.seed, steps=args.steps,
                  k=args.k, run_name=args.name, project=project or "scrutineer",
                  entity=entity or None)
    print(json.dumps(out, indent=2)[:1400])
    (state_dir() / "rl_job.json").write_text(json.dumps(out, indent=2))
    return 0 if "error" not in out else 1


def cmd_watch(args: argparse.Namespace) -> int:
    """Run the loop on this machine, in a browser tab, live."""
    import os

    from .serve import serve

    # Your key, your machine. The hosted build relays through Vercel because a browser cannot call
    # these endpoints directly; here there is no relay and nothing leaves the box.
    os.environ.setdefault("SCRUTINEER_INFERENCE", "anthropic")
    os.environ.setdefault("SCRUTINEER_TYPED", "local")
    os.environ.setdefault("SCRUTINEER_WORKERS", "6")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY is not set — the agent has no model to drive.\n"
              "  export ANTHROPIC_API_KEY=sk-ant-…   then run this again.")
        return 1
    serve(port=args.port, open_browser=not args.no_open)
    return 0


def cmd_partition(args: argparse.Namespace) -> int:
    """Read the credit ledger as a component x family matrix and say whether it separates."""
    import json as _json
    from pathlib import Path

    from .partition import bundle, report

    state = Path(args.state)
    print(report(state))
    out = state / "partition.json"
    out.write_text(_json.dumps(bundle(state), indent=2))
    print(f"\nwrote {out}")
    return 0


def cmd_bcb(args: argparse.Namespace) -> int:
    """One harness, BigCodeBench-Hard's final held-out set."""
    from pathlib import Path

    from .bcbrun import compare, measure, write, write_verdict

    state = Path(args.state)
    res = measure(args.harness, n=args.n)
    print(f"{res['benchmark']} · {res['harness']:9s} pass@1 {res['pass_at_1'] * 100:5.1f}%  "
          f"{res['solved']}/{res['n']}  ${res['cost_usd']:.2f}")
    write(state / f"bcb_{args.harness}.json", res)
    starting, champion = state / "bcb_starting.json", state / "bcb_champion.json"
    if args.harness in ("starting", "champion") and starting.exists() and champion.exists():
        import json as _j

        # compare(baseline, loop) — the starting harness is always the baseline, whichever run
        # happened second. Getting this backwards prints the regression as a gain.
        c = compare(_j.loads(starting.read_text()), _j.loads(champion.read_text()))
        print(f"  delta {c['delta_pp']:+.1f} points   fixed {len(c['fixed'])}   "
              f"broken {len(c['broken'])}   McNemar p = {c['p_two_sided']}")
        print(f"  {c['resolution']['claim']}")
        write(state / "bcb_compare.json", c)
    v = write_verdict(state)
    if v:
        print(f"  headline: {v['headline']}")
        if v.get("loop_vs_scaling"):
            print(f"  vs matched-budget resampling: {v['loop_vs_scaling']['claim']}")
            print(f"  budget ratio loop/scaling {v['budget_ratio_loop_to_scaling']}  "
                  f"matched={v['budget_matched']}")
    return 0


def cmd_bench(args: argparse.Namespace) -> int:
    """Both harnesses, one public benchmark, model held fixed."""
    from pathlib import Path

    from .benchrun import report, run, write

    res = run(n_held=args.n, plus=not args.base)
    print(report(res))
    print("\nwrote", write(Path(args.state) / "bench.json", res))
    return 0


def cmd_sides(args: argparse.Namespace) -> int:
    """Race the starting and the found harness on each side of the discovered partition."""
    import json as _json
    from pathlib import Path

    from .sides import report, run

    state = Path(args.state)
    res = run(state, per_family=args.per_family)
    print(report(res))
    (state / "sides.json").write_text(_json.dumps(res, indent=2))
    print(f"\nwrote {state / 'sides.json'}")
    return 0


def cmd_demo(args: argparse.Namespace) -> int:
    """Seed an idealised season so the views are populated. Labelled as a stub everywhere."""
    from pathlib import Path

    from .demo import write

    print(write(Path(args.out), Path(args.pages)))
    return 0


def cmd_state(args: argparse.Namespace) -> int:
    st = load_season_state()
    if not st:
        print("no season has been run yet", file=sys.stderr)
        return 1
    _p({k: v for k, v in st.items() if k != "reports"} | {"generations": len(st["reports"])})
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="scrutineer", description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)

    d = sub.add_parser("doctor", help="which rails are live and what each missing key would unlock")
    d.set_defaults(fn=cmd_doctor)

    s = sub.add_parser("season", help="run a full season")
    s.add_argument("--generations", type=int, default=None)
    s.add_argument("--unattended-from", type=int, default=None)
    s.add_argument("--seed", type=int, default=None)
    s.add_argument("--seed-tamper-at", type=int, default=None)
    s.add_argument("--export", action="store_true", help="write the broadcast bundle when done")
    s.set_defaults(fn=cmd_season)

    g = sub.add_parser("gen", help="run one generation")
    g.add_argument("--seed", type=int, default=None)
    g.add_argument("--unattended", action="store_true")
    g.set_defaults(fn=cmd_gen)

    r = sub.add_parser("race", help="run one QUALI race with the champion car")
    r.add_argument("--items", type=int, default=30)
    r.add_argument("--trials", type=int, default=2)
    r.add_argument("--seed", type=int, default=None)
    r.set_defaults(fn=cmd_race)

    v = sub.add_parser("verify", help="replay and verify the signed lineage chain")
    v.set_defaults(fn=cmd_verify)

    e = sub.add_parser("export", help="write the broadcast bundle for the UI")
    e.set_defaults(fn=cmd_export)

    tr = sub.add_parser("trial", help="export the two-harness comparison a visitor can run")
    tr.add_argument("--out", default="../site/public/trial.json")
    tr.add_argument("--tasks", type=int, default=4)
    tr.add_argument("--bundle", default=None, help="season bundle to rebuild the final harness from")
    tr.set_defaults(fn=cmd_trial)

    ru = sub.add_parser("runs", help="write the per-component W&B runs ARIA reads")
    ru.add_argument("--bundle", default=None)
    ru.add_argument("--group", default="season")
    ru.add_argument("--report", action="store_true", help="also create a W&B Report")
    ru.set_defaults(fn=cmd_runs)

    tj = sub.add_parser("train", help="run a real Serverless RL job for the POWER UNIT")
    tj.add_argument("--items", type=int, default=12)
    tj.add_argument("--k", type=int, default=4)
    tj.add_argument("--steps", type=int, default=3)
    tj.add_argument("--name", default="power-unit")
    tj.add_argument("--seed", type=int, default=None)
    tj.add_argument("--band", action="store_true", default=True,
                    help="train only on tasks the car solves sometimes (the default)")
    tj.add_argument("--no-band", dest="band", action="store_false")
    tj.set_defaults(fn=cmd_train)

    w = sub.add_parser("watch", help="run the loop locally, live, in a browser tab")
    w.add_argument("--port", type=int, default=7777)
    w.add_argument("--no-open", action="store_true", help="do not open a browser")
    w.set_defaults(fn=cmd_watch)

    pt = sub.add_parser("partition", help="does the blame matrix separate by task family?")
    pt.add_argument("--state", default="state")
    pt.set_defaults(fn=cmd_partition)

    bc = sub.add_parser("bcb", help="measure a harness on BigCodeBench-Hard held-out")
    bc.add_argument("--harness", choices=["starting", "champion", "scaling"], default="starting",
                    help="scaling = the starting harness with one more sample per mode, nothing else")
    bc.add_argument("--state", default="state")
    bc.add_argument("-n", type=int, default=0)
    bc.set_defaults(fn=cmd_bcb)

    bn = sub.add_parser("bench", help="HumanEval under both harnesses, model held fixed")
    bn.add_argument("--state", default="state")
    bn.add_argument("-n", type=int, default=0, help="0 = the whole held-out set")
    bn.add_argument("--base", action="store_true", help="base HumanEval tests only")
    bn.set_defaults(fn=cmd_bench)

    sd = sub.add_parser("sides", help="is the found harness lopsided across the partition?")
    sd.add_argument("--state", default="state")
    sd.add_argument("--per-family", type=int, default=2)
    sd.set_defaults(fn=cmd_sides)

    dm = sub.add_parser("demo", help="write an idealised demonstration season")
    dm.add_argument("--out", default="state/broadcast.json")
    dm.add_argument("--pages", default="state/demo-pages")
    dm.set_defaults(fn=cmd_demo)

    st = sub.add_parser("state", help="summarise the saved season")
    st.set_defaults(fn=cmd_state)

    args = ap.parse_args(argv)
    return int(args.fn(args))


if __name__ == "__main__":
    raise SystemExit(main())
