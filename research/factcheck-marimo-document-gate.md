# Fact-check: marimo "document gate" claim (design §2/§4/§6/§10, Appendix (4),(7))

Checked 2026-09-03 against live docs, the `main` branch source, and an empirical run of the
released package (`marimo==0.24.0`, PyPI release 2026-08-17, https://pypi.org/project/marimo/).

## The claim under test

> marimo notebooks can be run programmatically as scripts and as apps:
> `python debriefs/round_n.py --round n` exits non-zero on an AssertionError,
> `marimo check --strict --format=json` validates the DAG statically, and
> `outputs, defs = app.run(defs={"upgrade_pick": "aero"})` returns cell-defined variables
> (`gate_ok`, `next_round_config`) so a caller can inject an override and read results.
> Live agent-driven cell execution via marimo pair / `ctx.graph.ancestors` is an internal API
> and is only a flourish.

## Verdict: REFUTED AS WRITTEN (substance survives; two of the three concrete code lines fail)

| Sub-claim | Status | Evidence |
|---|---|---|
| `python nb.py --round n` exits non-zero on `AssertionError` | CONFIRMED | Empirical: exit 1, traceback re-raised through `script_runner.py:242 raise e.__cause__ from None`. Source: https://raw.githubusercontent.com/marimo-team/marimo/main/marimo/_runtime/app/script_runner.py ("Other exceptions ... re-raised via `raise exc`"). Docs: https://docs.marimo.io/guides/scripts/ ("You can run marimo notebooks as scripts at the command line, just like any other Python script"). |
| `marimo check` validates the DAG statically | CONFIRMED | Breaking rules MB001 unparsable-cells, MB002 multiple-definitions, MB003 cycle-dependencies, MB004 setup-cell-dependencies, MB005 invalid-syntax — "These errors prevent notebook execution." https://docs.marimo.io/guides/lint_rules/ . Empirical: a two-cell `x=1 / x=2` notebook yields `{"severity":"breaking","code":"MB002",...,"summary":{"errored":true}}` and exit 1 with NO `--strict`. |
| `marimo check --strict --format=json` as the gate command | **REFUTED (crashes)** | On marimo 0.24.0 and on `main` today, combining `--strict` with `--format=json` raises `UnboundLocalError: cannot access local variable 'fixed'` on any file with no breaking errors, exiting 1. Root cause in `marimo/_cli/cli.py` `check()`: `fixed`/`total_issues` are assigned only in the non-JSON `else:` branch, but the final line is `if linter.errored or (strict and (fixed > 0 or total_issues > 0)): sys.exit(1)`. Source: https://raw.githubusercontent.com/marimo-team/marimo/main/marimo/_cli/cli.py . So the gate can never pass with that exact flag pair. No existing issue found (GitHub search API total_count 0, 2026-09-03). |
| `app.run(defs={"upgrade_pick": "aero"})` returns `(outputs, defs)` with `gate_ok`, `next_round_config` | CONFIRMED with a hard constraint | Signature `run(defs: dict[str, Any] \| None = None, **kwargs) -> tuple[Sequence[Any], Mapping[str, Any]]` https://docs.marimo.io/api/app/ . Empirical: `defs['gate_ok'] -> True`, `defs['next_round_config'] -> {'round_id': 8, 'part': 'aero'}`; and a failing gate raises `AssertionError` out of `app.run()` so a caller can `try/except`. BUT the docs warn "You must provide **all** the definitions that a cell would normally produce", and empirically `app.run(defs={"round_id": 7})` raised `marimo._ast.errors.IncompleteRefsError: ... Missing: ['argparse', 'args', 'parser', 'sys']` when `round_id` shared a cell with the argparse imports. |
| `app.run(round_id=n)` keyword form (docstring says "as keyword arguments") | **REFUTED** | `main` source: first statement in the body is `del kwargs`; only `defs` is merged (`glbls.update(defs)`). Empirical: `app.run(upgrade_pick='aero', round_id=2)` silently ran with defaults (round 1, engine) and hit the assertion. Use `defs={...}` only. |
| marimo pair / `ctx.graph.ancestors` is internal | CONFIRMED | `marimo._code_mode.__doc__`: "**Internal, agent-only API.** Not part of marimo's public API. No versioning guarantees. May change or be removed without notice." https://raw.githubusercontent.com/marimo-team/marimo/main/marimo/_code_mode/__init__.py . `AsyncCodeModeContext.graph -> DirectedGraph` ("The notebook's dependency graph") https://raw.githubusercontent.com/marimo-team/marimo/main/marimo/_code_mode/_context.py ; `DirectedGraph.ancestors(self, cell_id: CellId_t) -> set[CellId_t]` https://raw.githubusercontent.com/marimo-team/marimo/main/marimo/_runtime/dataflow/graph.py . Skill text: "`marimo._code_mode` is a PRIVATE, UNSTABLE agent API ... DO NOT import it from notebook cells" https://raw.githubusercontent.com/marimo-team/marimo-pair/main/skills/marimo-pair/SKILL.md . |
| "marimo pair" is the mechanism for live execution | IMPRECISE | In 0.24.0 `marimo pair --help` lists only one subcommand, `prompt` ("Generate a prompt for pair programming"). Live execution goes through the marimo-pair skill's `execute-code.sh`, which POSTs to `${base}/api/kernel/execute` on a running `marimo edit` server (https://raw.githubusercontent.com/marimo-team/marimo-pair/main/skills/marimo-pair/scripts/execute-code.sh). Blog 2026-07-20: https://marimo.io/blog/notebooks-as-a-tool-for-agents . So the flourish needs a live server; it cannot run inside the batch `python nb.py` path. |

## Exact corrections for the design

1. **§6 / Appendix (7) gate command.** Replace `marimo check --strict --format=json debriefs/round_n.py` with
   `marimo check --format=json debriefs/round_n.py` and gate on exit code (1 when `summary.errored` is true, i.e. any
   `severity == "breaking"` issue) or parse `.summary.errored`. If warnings should also fail, use `marimo check --strict`
   (default `full` format). Do not combine `--strict` with `--format=json` until upstream fixes `cli.py` (the blog's own
   examples never combine them: https://marimo.io/blog/marimo-check , 2025-09-26).
2. **§4 self-improve cell / Appendix (4).** `app.run(defs={"round_id": n})` works only if `round_id` is the *sole* public
   definition of its cell. Put every injectable knob (`round_id`, `upgrade_pick`) in its own cell, and prefix helper names
   with `_` (e.g. `_parser`, `import argparse as _argparse`) so they are not counted as cell definitions. Otherwise
   `IncompleteRefsError` is raised. Never use the keyword form `app.run(round_id=n)`; kwargs are deleted.
3. **Return shape.** `defs` is a `Mapping` (empirically a `_Namespace`), keyed by variable name; `outputs` is a sequence
   of per-cell outputs (2 for a 4-cell notebook where two cells produced no output). Reading `defs["gate_ok"]` and
   `defs["next_round_config"]` is correct. A failing `assert` propagates out of `app.run()` as `AssertionError`.
4. **CLI args.** For `python nb.py --round n`, parse `sys.argv` with argparse (docs recommend this for script mode);
   `mo.cli_args()` is for `marimo edit/run nb.py -- --round n` (https://docs.marimo.io/api/cli_args/).
5. **§10 risk wording.** Keep "internal API" but state the concrete dependency: the pair flourish requires a running
   `marimo edit --no-token` server and the marimo-pair skill; `ctx.graph.ancestors(cid)` returns `set[CellId_t]`.

## Reproduction (scratch, marimo 0.24.0)

Files in `/private/tmp/claude-501/-Users-pranavachar-coreweaves/61b804c4-71ee-4e60-8a7d-ea8307191c49/scratchpad/mtest/`:
`nb.py` (round_id shares a cell with argparse -> IncompleteRefsError on override), `nb2.py` (underscore-private helpers ->
override works), `driver2.py`, `bad.py` (MB002). Commands and observed exit codes:

```
python nb2.py --round 3                      # AssertionError, EXIT=1
python driver2.py                            # gate_ok True, next_round_config {'round_id': 8, 'part': 'aero'}, EXIT=0
marimo check --format=json nb2.py            # {"issues": [], "summary": {..., "errored": false}}  EXIT=0
marimo check --strict nb2.py                 # EXIT=0
marimo check --strict --format=json nb2.py   # UnboundLocalError ... 'fixed'  EXIT=1   <-- bug
marimo check --format=json bad.py            # MB002 breaking, "errored": true, EXIT=1 (no --strict needed)
```

## Sources (all fetched 2026-09-03)

- https://docs.marimo.io/api/app/ — App.run signature, "completely overriding", "must provide all the definitions"
- https://docs.marimo.io/guides/scripts/ — run as script, argparse, `marimo check` before running
- https://docs.marimo.io/api/cli_args/ — `mo.cli_args()` vs `sys.argv`
- https://docs.marimo.io/cli/ — `--strict`: "Whether warnings return a non-zero exit code"; `--format` full|json
- https://docs.marimo.io/guides/lint_rules/ — MB001–MB005 breaking rules
- https://marimo.io/blog/marimo-check (2025-09-26) — `--strict`, `--format=json | jq`, static validation
- https://raw.githubusercontent.com/marimo-team/marimo/main/marimo/_cli/cli.py — `check()` exit logic (bug)
- https://raw.githubusercontent.com/marimo-team/marimo/main/marimo/_ast/app.py — `del kwargs`, `glbls.update(defs)`
- https://raw.githubusercontent.com/marimo-team/marimo/main/marimo/_runtime/app/script_runner.py — exception re-raise, `prune_cells_for_overrides`
- https://raw.githubusercontent.com/marimo-team/marimo/main/marimo/_code_mode/__init__.py — internal-API warning
- https://raw.githubusercontent.com/marimo-team/marimo/main/marimo/_code_mode/_context.py — `graph -> DirectedGraph`
- https://raw.githubusercontent.com/marimo-team/marimo/main/marimo/_runtime/dataflow/graph.py — `ancestors`/`descendants`
- https://marimo.io/blog/notebooks-as-a-tool-for-agents (2026-07-20) — marimo pair internals
- https://raw.githubusercontent.com/marimo-team/marimo-pair/main/skills/marimo-pair/SKILL.md — "PRIVATE, UNSTABLE agent API"
- https://raw.githubusercontent.com/marimo-team/marimo-pair/main/skills/marimo-pair/scripts/execute-code.sh — POST /api/kernel/execute
- https://pypi.org/project/marimo/ — 0.24.0, 2026-08-17

UNVERIFIED: whether the `--strict --format=json` crash has been reported upstream (API search returned 0 results).
