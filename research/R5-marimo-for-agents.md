# R5 — marimo for agent loops (as of 2026-09-03)

Scope: what an agent can actually do inside a running marimo notebook (marimo pair / code mode / ACP), molab specifics on CoreWeave, how a loop can create / update / publish notebooks without a human, the reactive DAG, marimo + W&B touchpoints, and a concrete proposal for marimo as the DOCUMENT stage of the SCRUTINEER loop. Every claim carries a URL and a date; items I could not verify are marked UNVERIFIED. All sources were fetched live on 2026-09-03.

---

## Summary

1. **marimo pair is the sanctioned "agent inside a live kernel" surface.** It is an Agent Skill (two bash scripts: `discover-servers.sh`, `execute-code.sh`) rather than an MCP server. The agent runs Python in a scratchpad namespace of the live kernel and mutates the notebook through the internal `marimo._code_mode` API: `create_cell`, `edit_cell`, `run_cell`, `delete_cell`, `move_cell`, `ctx.cells`, `ctx.graph.ancestors/descendants`, `ctx.globals`, `ctx.packages.add()`, `ctx.set_ui_value()`, `ctx.screenshot()`. All queued ops are applied atomically with syntax / multiply-defined-name / cycle / staleness validation. marimo itself labels this API "Internal, agent-only API. Not part of marimo's public API."
2. **ACP is the second, chat-panel surface.** marimo's editor sidebar speaks the Agent Client Protocol; Claude Code / Gemini / Codex / OpenCode are bridged via `npx stdio-to-ws "npx @zed-industries/claude-code-acp"` on port 3017 etc. This is the human-steered variant; marimo pair is the headless/terminal variant.
3. **molab (public preview since 2026-06-01) runs in CoreWeave sandboxes:** 4 CPU / 32 GB default, opt-in NVIDIA RTX Pro 6000 Blackwell (96 GB VRAM, 125 TFLOPS), 12 h max session, 90 min idle shutdown, free "as long as usage is reasonable", public-but-undiscoverable share links, fork, GitHub-synced notebooks, Google Drive / HF / S3 remote storage, built-in AI via Kimi-K2.6 on W&B Inference, and a "Pair with an agent" action that emits a marimo-pair connection prompt. There is **no public REST API** to create molab notebooks programmatically; the workaround is GitHub-as-source-of-truth plus the `molab.marimo.io/https://github.com/...` URL scheme.
4. **A loop can create, gate, run, and publish notebooks entirely from code:** notebooks are plain `.py` (`@app.cell`) or `.md` (```` ```python {.marimo} ````) files, so a script can write them; `marimo check --fix --strict --format=json` is a machine-readable gate; `from debrief import app; outputs, defs = app.run(defs={...})` executes a notebook headlessly and returns its variables (the hand-off to the next round); `marimo export html|html-wasm|ipynb|md|pdf --as=slides` renders it; `marimo.create_asgi_app().with_dynamic_directory(...)` serves a growing directory of round notebooks without restart; `marimo edit --watch` / `marimo run --watch` pick up file changes an agent writes.
5. **The reactive DAG is a first-class, inspectable dependency graph** (one owning cell per public name, no cycles, `_`-prefixed names private) — which is exactly the structure a credit-assignment/"which role owns this variable" audit needs. The agent can read it via `ctx.graph`.
6. **marimo + W&B:** marimohub (marimo's enterprise hub) injects `WANDB_API_KEY/BASE_URL/ENTITY/PROJECT/MODE` so `wandb.init()` needs no login; W&B's own `weave-mods` repo ships a *marimo* mod flavor that builds a W&B runs/artifacts dashboard with `wandb.Api()` + `mo.ui.table` + `mo.ui.plot.line`. I found **no official marimo-plus-Weave-traces example** — that is an opening for us.
7. **What marimo people reward:** their competition rubric is "intuitive understanding of the research result, through code, UI elements, and text" plus "custom extensions that ... provide insight"; their marketing line is "Ground understanding in code, not guesses"; their case-study language is "reproducibility and auditability ... for a regulated, high-stakes environment". WeaveHacks 3 (Self-Improving Agents, Jan 31–Feb 1 2026) had a "Best Use of Marimo" sponsor prize. Design the debrief notebook to hit those three words: understanding, auditability, reactivity.
8. **Correction to the brief:** marimo's launch week was **July 20–24, 2026**, not August. The August 2026 posts are "Seamless storage in molab" (Aug 26) and the IU Indianapolis case study.

---

## Findings with citations

### A. marimo pair — what an agent can do inside a running notebook

**F1. marimo pair is a skill, not an MCP server; agents get a REPL over the live kernel.**
"Introducing marimo pair" (2026-04-07) describes it as "implemented as an agent skill" using "two bash scripts and supporting documentation" and a "Code mode: an API for models" that "lets models treat marimo as a REPL that extends their context windows." Capabilities listed: execute arbitrary code in an ephemeral scratchpad, read/inspect intermediate variables in memory, run cells and receive feedback, add cells to persist state, delete cells, install packages, manipulate visualizations, read program memory "to avoid schema descriptions". Install: `npx skills add marimo-team/marimo-pair`; usage: `/marimo-pair pair with me on my_notebook.py`.
Source: https://marimo.io/blog/marimo-pair (2026-04-07).

**F2. Why skills beat MCP for notebooks (marimo's own reasoning).**
"Implementing marimo pair" (2026-07-20): the earlier MCP approach failed because "Each tool exposed a fixed view, while what the agent needed to inspect depended on the notebook and the task." Three components: (1) `execute-code` CLI (`scripts/execute-code.sh`) that runs Python in the live kernel and returns results/errors; (2) the internal code-mode module `marimo._code_mode` exposed as `cm`; (3) Agent Skills. Inside `async with cm.get_context() as ctx:` the agent calls `ctx.create_cell(code)`, `ctx.edit_cell(cid, code=...)`, `ctx.run_cell(cid)`, `ctx.delete_cell(id)`; "All operations queue and execute as a single transaction with validation" — "Before applying the queued operations, marimo runs the checks it uses for any notebook edit" (syntax errors, multiply-defined names, dependency cycles, broken references).
Source: https://marimo.io/blog/notebooks-as-a-tool-for-agents (2026-07-20).

**F3. The exact `cm` API surface (from source, `marimo/_code_mode/_context.py`, fetched 2026-09-03).**
Class `AsyncCodeModeContext`, entry `get_context(*, skip_validation=False, skip_staleness_check=False)`.
- Mutations: `create_cell(code, *, before=None, after=None, hide_code=True, disabled=False, column=None, name=None) -> CellId_t`; `edit_cell(target, code=None, *, hide_code=None, disabled=None, column=None, name=None)`; `delete_cell(target)`; `move_cell(target, *, before=None, after=None)`; `run_cell(target)`.
- Read-only: `cells` (ordered view; `ctx.cells[0]`, `ctx.cells["id"]`, `ctx.cells["name"]`, `.find(substring)`, `.grep(regex)`, `.keys()/.values()/.items()`), `graph: DirectedGraph`, `globals: dict[str, Any]` ("The kernel's global namespace (all variables defined by cells)"), `packages` (`add()`/`remove()` "flushed before cells run").
- UI/control: `set_ui_value(element, value)` (batched on context exit → reactive re-execution); `screenshot(target=None, *, timeout_ms=30_000, as_data_url=False, save_to=None) -> bytes | str` ("Captures cell output as PNG; requires Playwright; does not require `async with`"); `find_cell_defining_object(obj) -> CellId_t | None`.
- Low level: `execute_command`, `enqueue_command`, `broadcast_raw_notification`.
- `NotebookCell` exposes `id, code, name, config, status` (idle/exception/stale/cancelled/interrupted/marimo-error/disabled/queued/running), `errors: list[CellError]` (structured kind/msg/exception), `output`, `console_outputs` — "frozen at context entry; re-enter to see fresh outputs."
- Semantics: "All queued operations apply atomically on `__aexit__()`"; validation = `compile_cell()` syntax, multiply-defined names, cycle detection, and a **staleness check: agents must read cells before overwriting**.
- `__init__.py` docstring: "Internal, agent-only API. Not part of marimo's public API." Exports `AsyncCodeModeContext, CellStatusType, NotebookCell, StaleCellError, capabilities(), get_context()`. `capabilities()` "Return installed capability names mapped to importable modules" via entry-point group `marimo.agent.capability`.
Sources: https://raw.githubusercontent.com/marimo-team/marimo/main/marimo/_code_mode/_context.py ; https://raw.githubusercontent.com/marimo-team/marimo/main/marimo/_code_mode/__init__.py ; https://raw.githubusercontent.com/marimo-team/marimo/main/marimo/_code_mode/_capabilities.py ; https://raw.githubusercontent.com/marimo-team/marimo/main/marimo/_code_mode/screenshot.py (all main branch, 2026-09-03). Screenshot targets `#output-{cell_id}` and needs `pip install playwright && python -m playwright install chromium`.

**F4. The SKILL.md workflow and rules an agent must obey.**
"Start every code-mode session with this dedicated command": `bash /path/to/marimo-pair/scripts/execute-code.sh --url http://localhost:2718 -c "import marimo._code_mode as cm; help(cm)"`. Scratchpad = "temporary namespace with a shallow copy of kernel globals"; top-level assignments are discarded after each call, mutations to notebook-owned objects persist. Structure queries: `ctx.cells[id_or_index]`, `ctx.graph.descendants(cid)` / `ctx.graph.ancestors(cid)`, `ctx.cells.keys()`. Rules: "No cycles, no public name redefinition across cells, no wildcard imports"; public names define dataflow, `_`-prefixed names are private; "DO NOT modify the associated `.py` file directly" during a session. UI: `ctx.set_ui_value(element, value)`; anywidget traitlets set as Python attributes. Prereqs (README): a running notebook started with `--no-token` or `MARIMO_TOKEN` set; `bash, curl, jq` on PATH; Apache-2.0. Install also as Claude Code plugin: `/plugin marketplace add marimo-team/marimo-pair` then `/plugin install marimo-pair@marimo-pair`.
Sources: https://raw.githubusercontent.com/marimo-team/marimo-pair/main/skills/marimo-pair/SKILL.md ; https://github.com/marimo-team/marimo-pair (2026-09-03). Reference docs in the skill: `execution-context.md` (session targeting `--url/--file/--session`, auth `MARIMO_TOKEN`/`--token`, code via `-c`/stdin/file), `finding-marimo.md`, `gotchas.md` ("Variables with a `_` prefix are private to the cell that defines them", "Each public name has one owning cell", mid-session `ctx.packages.add()` won't refresh import-time caches), `notebook-improvements.md` (a cell named `"setup"` "is guaranteed to run before all other cells", use `@mo.persistent_cache` for expensive loads), `rich-representations.md` ("marimo clips output at ~610px horizontally"; `_display_()` protocol; anywidget).
Source: https://api.github.com/repos/marimo-team/marimo-pair/contents/skills/marimo-pair/reference (2026-09-03).

**F5. Practical session recipe and gotchas (third-party, 2026-05-28, updated 2026-09-04 per page, marimo v0.23.8).**
Terminal 1: `marimo edit my_analysis.py --no-token`; Terminal 2: `codex --skill marimo-pair "pair with me on my_analysis.py"`. "You cannot connect multiple Codex CLI instances to the same notebook simultaneously." Default after agent edits is stale-not-run; add `[tool.marimo.runtime] watcher_on_save = "autorun"` for a tight loop. Windows needs Git Bash/WSL.
Source: https://codex.danielvaughan.com/2026/05/28/codex-cli-marimo-reactive-notebooks-agent-pair-programming-data-science-workflows/ (dated as stated on page; the "updated 2026-09-04" stamp is one day after fetch — treat the update date as UNVERIFIED).

**F6. CLI hooks for pair: `marimo pair prompt`.**
`marimo pair prompt [OPTIONS]` with `--url`, `--file`, `--claude`, `--codex`, `--opencode`, `--with-token` generates the connection prompt (this is what molab's "Pair with an agent" hands you).
Source: https://docs.marimo.io/cli/ (2026-09-03).

### B. ACP (Agent Client Protocol) in the editor

**F7. marimo's Agent panel speaks ACP; four agents are wired today.**
"marimo supports external AI agents that can interact with your codebase through the Agent Client Protocol (ACP)"; agents "read and write marimo notebooks, helping you with coding tasks directly from the chat panel." Bridge commands and ports: Claude Code `npx stdio-to-ws "npx @zed-industries/claude-code-acp"` (3017, needs Claude Code CLI subscription); Gemini `npx stdio-to-ws "npx @google/gemini-cli --experimental-acp"` (3019); Codex `npx stdio-to-ws "npx @zed-industries/codex-acp"` (3021); OpenCode `npx stdio-to-ws "npx opencode-ai acp"` (3023). Enable a feature flag under Lab settings, open the agent sidebar, pick the agent. Agents "may request file access permissions requiring user approval." Without `watcher_on_save = "autorun"`, "cells are marked as stale instead of running automatically."
Sources: https://docs.marimo.io/guides/editor_features/agents/ ; https://raw.githubusercontent.com/marimo-team/marimo/main/docs/guides/editor_features/agents.md (2026-09-03). Docs position: "Most users should start with marimo pair" (search snippet, https://docs.marimo.io/guides/generate_with_ai/marimo_pair/, 2026-09-03).

### C. molab on CoreWeave

**F8. molab public preview on CoreWeave (2026-06-01): specs, limits, price.**
"molab notebooks now run in CoreWeave sandboxes, allowing us to provide more compute, RAM, and stability." Default "4 CPUs and 32 GB of RAM"; opt-in "NVIDIA RTX Pro 6000 Blackwell GPU, with 96GB of VRAM and 125 TFLOPS" toggled via "the notebook specs button in the app header"; "notebooks can run for as long as 12 hours before molab shuts them down"; "Notebooks that are idle for more than 90 minutes are automatically shut down"; "Start coding in just a few seconds"; "providing molab — GPUs and all — for free, as long as usage is reasonable." Built-in AI: "free access to open-source models hosted on Weights and Biases Inference, including the blazingly fast Kimi-K2.6." Agents: "Connect AI agents like Claude Code, Codex, or OpenCode to running molab notebooks using marimo pair."
Sources: https://marimo.io/blog/reintroducing-molab (2026-06-01) ; https://docs.marimo.io/guides/molab/ (2026-09-03). The Chitti guest post (2026-07-28) reports the same card as "RTX PRO 6000 Blackwell Server Edition with 102GB of VRAM" and fine-tuned Qwen2.5-Coder-7B-Instruct end-to-end in molab notebooks: https://marimo.io/blog/guest-blog-chitti.

**F9. molab sharing, GitHub sync, local pull-down, badge, and the "Pair with an agent" action.**
"notebooks are public but undiscoverable by default"; direct links show a static preview with fork. Badge: `[![Open in molab](https://marimo.io/molab-shield.svg)](URL)`. GitHub-synced notebooks: "use the new notebook dropdown button on the molab homepage, and paste the URL of a notebook hosted on GitHub" (GitHub as source of truth). Pull to local: `marimo edit https://molab.marimo.io/notebooks/[notebook-id]`. Preview any GitHub notebook by appending its URL: `molab.marimo.io/https://github.com/...` (badge generator + bookmarklet at molab.marimo.io/github). "Pair with an agent" in the notebook menu: install marimo pair locally, copy the generated prompt, and the agent can "write code, install packages, and manipulate widgets." Also: interactive slides / data apps, iframe embeds.
Sources: https://raw.githubusercontent.com/marimo-team/marimo/main/docs/guides/molab.md ; https://molab.marimo.io/github ; https://docs.marimo.io/guides/molab/ (2026-09-03).

**F10. molab storage policy (2026-08-26) and Google Drive.**
"Only data uploaded via marimo's file browser is retained on shutdown" for notebooks created after 2026-08-26; use `mo.persistent_cache` (keyed "by function body and arguments") and remote storage (fsspec shipped by default): HF paths like `"hf://datasets/scikit-learn/adult-census-income"`, Google Drive via `gdrive_fsspec` with tokens in `.env`. Newsletter 26 (2026-07-27): Google Drive integration lets notebooks "read and write files directly to user accounts." Remote-storage guide lists S3, Azure, GCS, HF Hub, HTTP/FTP via obstore/fsspec, with "Add remote storage" in the Files panel.
Sources: https://marimo.io/blog/seamless-storage-in-molab (2026-08-26) ; https://marimo.io/blog/newsletter-26 (2026-07-27) ; https://docs.marimo.io/guides/working_with_data/remote_storage/ (2026-09-03).

**F11. No programmatic molab API. (Negative finding.)**
Searches for a molab REST/CLI to create notebooks returned only the UI dropdown, GitHub sync, and `marimo edit <molab-url>`. The related marimo issue #4801 "Add public API helpers for programmatically creating notebooks" (opened 2025-05-04) is **closed as not planned** — the private helper is `marimo._ast.codegen.generate_filecontents(codes: list[str], names: list[str], cell_configs: list[CellConfig], config=None, header_comments=None) -> str` ("Translates a sequences of codes (cells) to a Python file").
Sources: https://github.com/marimo-team/marimo/issues/4801 ; https://raw.githubusercontent.com/marimo-team/marimo/main/marimo/_ast/codegen.py (2026-09-03). Any claim of a molab API is UNVERIFIED/none found.

### D. Creating, gating, running, publishing notebooks from a loop

**F12. Notebook files are plain Python or Markdown — trivially generatable.**
`.py` notebooks store cells as functions decorated `@app.cell`; the Markdown format extracts fences "that contain marimo in braces, such as `python {marimo}`, `{marimo}` or `{.marimo .python}`" (editor writes ```` ```python {.marimo} ````), metadata in frontmatter, convert with `marimo convert my_marimo.md > my_marimo.py`. `marimo new "Plot an interactive 3D surface..."` generates a notebook from a prompt.
Sources: https://github.com/marimo-team/marimo/blob/main/marimo/_tutorials/markdown_format.md ; https://docs.marimo.io/cli/ (2026-09-03).

**F13. `marimo check` is the machine-readable gate for agent-written notebooks.**
`uvx marimo check your_notebook.py`, flags `--fix`, `--unsafe-fixes`, `--strict` (warnings→errors, CI), `--format=json` "for agent processing"; example rule "multiple-definitions" ("Variables must be unique across cells. Alternatively, they can be private with an underscore prefix"). CI: `uv run marimo check --strict .`. Recommends sub-agents for linting and `jq` filtering.
Source: https://marimo.io/blog/marimo-check (2025-09-26 — older than 2026, still current per CLI docs listing `check --fix --strict --unsafe-fixes --ignore-scripts`, https://docs.marimo.io/cli/ 2026-09-03).

**F14. `App.run(defs=...)` executes a notebook headlessly and returns its variables — the hand-off primitive.**
`run(defs: dict[str, Any] | None = None, **kwargs) -> tuple[Sequence[Any], Mapping[str, Any]]` returns cell outputs and "a mapping of variable names to their computed values"; with `defs`, "cells producing those variables won't execute, instead using your provided values." `async embed(defs=None) -> AppEmbedResult` (`output`, `defs`) nests one notebook in another. `mo.app_meta().mode` ∈ {"edit","run","script","test",None}. Notebooks also run as scripts: `python notebook.py`, with `sys.argv`/argparse, and `marimo export html notebook.py -o notebook.html` "allows you to save notebook outputs" (args after `--`). Cron/Airflow/Prefect/GitHub Actions integration is documented.
Sources: https://docs.marimo.io/api/app/ ; https://docs.marimo.io/guides/scripts/ (2026-09-03).

**F15. Export matrix (exact flags).**
`marimo export html [--include-code/--no-include-code] [--watch] [-o] [--sandbox] [-f]`; `html-wasm --mode (edit|run) [--show-code] [--execute]`; `ipynb --sort (top-down|topological) [--include-outputs]`; `md --flavor (pymdown|qmd|mystmd|mdx)`; `pdf [--include-outputs] [--include-inputs] --as (document|slides)`; `script`; `session`; `thumbnail --width --height --scale --execute`. Slides: enable via Cmd+K "Slides"; "Only cells with outputs appear as slides"; layout stored in `layouts/` JSON; `marimo export pdf notebook.py --as=slides`; edit code mid-presentation with `C`.
Sources: https://docs.marimo.io/cli/ ; https://marimo.io/blog/slides (2026-07-23).

**F16. Serving a growing archive of notebooks without restarts.**
`marimo.create_asgi_app(include_code=True, quiet=False).with_app(path="", root="./pages/index.py").with_dynamic_directory(path="/dashboard", directory="./notebooks").build()` mounted in FastAPI via `app.mount("/", server.build())`; `with_dynamic_directory` "useful if the contents of the directory change often, such as a directory of notebooks for a dashboard, without restarting the server." Auth: pure ASGI middleware setting `scope["user"]`/`scope["meta"]` for HTTP and WebSocket. `marimo run app.py --base-url /subpath --include-code`; `marimo edit --headless`; health at `/health`, `/healthz`, `/api/status`. Publishing paths: molab, GitHub Pages (html-wasm), iframes/islands, Cloudflare, community gallery.
Sources: https://docs.marimo.io/guides/deploying/programmatically/ ; https://docs.marimo.io/guides/deploying/ ; https://docs.marimo.io/guides/publishing/ (2026-09-03).

**F17. File watching lets an external writer (agent or script) drive a live notebook.**
`marimo edit --watch`: "the marimo server will open your notebook in the browser and watch the underlying notebook file for changes"; synced cells stay stale unless `[tool.marimo.runtime] watcher_on_save = "autorun"` ("all affected cells automatically when you save"). `marimo run --watch`: "Whenever the file watcher detects a change to the notebook file, the application will be refreshed" (full page refresh, fresh state). marimo's Claude Code customization page recommends `npx skills add marimo-team/skills`, `uvx marimo check` in hooks (detecting notebooks by `"import marimo"` + `"@app.cell"`), and `marimo edit --watch notebook.py`.
Sources: https://docs.marimo.io/guides/editor_features/watching/ ; https://docs.marimo.io/guides/generate_with_ai/using_claude_code/ (2026-09-03).

### E. Reactive dataflow as a dependency graph

**F18. The DAG rules.**
marimo derives each cell's "references" and "definitions"; these "form a directed acyclic graph (DAG) on cells, with an edge from one cell to another if the latter references any of the definitions of the former." "When a cell is run, marimo automatically runs all other cells that reference any of the global variables it defines." Execution order "is determined by the relationships between cells and their variables, not by the order of cells on the page." "marimo requires that every global variable be defined by only one cell"; deleting a cell "deletes its global variables from program memory"; "marimo does not track mutations to objects." Runtime can be "lazy". Editor tooling: Dependencies panel (Minimap + Graph tabs), variables explorer (name/type/value/defined-in/used-in), reactive reference highlighting. Expensive-notebook tools: lazy runtime, `mo.stop`, `mo.ui.run_button`, `mo.cache`/`mo.persistent_cache(save_path=..., method="pickle")` stored in `__marimo__/cache/`, cell disabling, `mo.lazy`. Launch-week Thursday (2026-07-23): wigglystuff `WidgetDAG` "turns an entire notebook ... into a live, reactive graph."
Sources: https://docs.marimo.io/guides/reactivity/ ; https://docs.marimo.io/guides/editor_features/dataflow/ ; https://docs.marimo.io/guides/expensive_notebooks/ ; https://docs.marimo.io/api/caching/ ; https://marimo.io/blog/launch-week-1 (2026-09-03).

### F. marimo + Weights & Biases

**F19. Official touchpoints found.**
(a) marimohub integrations doc: the W&B integration "Sets `WANDB_API_KEY`, `WANDB_BASE_URL`, `WANDB_ENTITY`, `WANDB_PROJECT`, and `WANDB_MODE`, so `wandb.init()` needs no `wandb.login()` and no key in the notebook", sets `WANDB_DIR` to `/tmp` so run files aren't versioned into the notebook, tests via the GraphQL API. (b) W&B's `weave-mods` repo lists **Marimo** as a mod flavor (with Streamlit, FastHTML, custom); `mods/marimo/app.py` uses `wandb.Api()`, `fetch_runs(ENTITY, PROJECT)`, `fetch_artifacts(...)`, `mo.ui.table(filtered, page_size=25)`, `mo.ui.plot.line(df, x=x, y=y)`, `mo.ui.dropdown(...)`; env `WANDB_PROJECT`/`WANDB_ENTITY`; `MARIMO_MODE=edit|run|publish`, `PORT=6637`, Docker-served. (c) molab's built-in AI is served by W&B Inference (Kimi-K2.6). (d) marimo joined CoreWeave on 2025-10-30 with Lukas Biewald (W&B) named in the decision; "marimo is, and always will be, free, open-source, and permissively licensed."
Sources: https://raw.githubusercontent.com/marimo-team/marimohub/main/docs/integrations.md ; https://github.com/wandb/weave-mods ; https://raw.githubusercontent.com/wandb/weave-mods/main/mods/marimo/app.py ; https://raw.githubusercontent.com/wandb/weave-mods/main/mods/marimo/utils.py ; https://marimo.io/blog/joining-coreweave (2025-10-30). Note: the weave-mods marimo example reads **runs/artifacts**, not Weave traces; I found no published marimo notebook calling `weave.init()`/`client.get_calls()` (UNVERIFIED that none exists; searches on 2026-09-03 returned none).

### G. What marimo judges reward

**F20. marimo's stated taste.**
molab Notebook Competition #2 (deadline 2026-07-09, run "on GPUs through CoreWeave"): judged on "Notebooks that provide an intuitive understanding of the research result, through code, UI elements, and text" and "Notebooks that implement custom extensions that either improve the performance of the original paper or otherwise provide insight." marimo.io/pair: "Ground understanding in code, not guesses"; work is "extend[able], share[able], modify[able], audit[able]". Voltus case study (Newsletter 26): "We got the reproducibility and auditability we needed for a regulated, high-stakes environment." WeaveHacks 3 "Self-Improving Agents" (Jan 31–Feb 1 2026, W&B SF office; marimo a sponsor) offered "Best Use of Marimo: $200 cash per team member" and framed self-improvement as "improved memory systems, reinforcement learning, fine-tuning, dynamic tool creation, and autonomous improvement loops"; a CoreWeave Sr. Director AI/ML (Shadi Saba) judged.
Sources: https://marimo.io/pages/events/notebook-competition-2 ; https://marimo.io/pair ; https://marimo.io/blog/newsletter-26 (2026-07-27) ; https://luma.com/weavehacks3 (2026-09-03 fetch). CoreWeave Hacks "The Loop" itself: **no public event page found** via search on 2026-09-03 (UNVERIFIED judge list; use CONTEXT.md).

**F21. Launch week dates (correction).**
Mon 2026-07-20 marimo pair (new home, Claude Code/Codex marketplaces, VS Code/Cursor extension); Tue 07-21 marimo anywhere (quarto-marimo, jupyter-book-marimo, mdx-marimo) + marimo Glance (GitHub → WASM notebook in place); Wed 07-22 PyCharm plugin; Thu 07-23 wigglystuff widgets incl. WidgetDAG; Fri 07-24 Notebooks as Slides.
Source: https://marimo.io/blog/launch-week-1 (2026-07-20).

**F22. `marimo-agents` (riyavsinha) is a different thing — agents *as cells*.**
`pip install marimo-agents` (v0.0.4, experimental): `mo.ai.agents.Agent(name=..., run_fn=...)`, `register_agent(agent)`, `await mo.ai.agents.run_agent(prompt)`, `Suggestion`/`SuggestionType.PROMPT_IDEA`, a "New Cell" agent cell type; any callable backend (LangChain/LangGraph). Useful only as a UI flourish (an "ask the historian" cell inside the debrief), not as the loop's agent surface.
Source: https://github.com/riyavsinha/marimo-agents (2026-09-03; no release dates shown).

---

## Design implications for the F1 loop — marimo as the DOCUMENT stage

### The artifact: one executable "Race Weekend Debrief" notebook per round

Every round `n` of the loop produces `debriefs/round_{n:03d}.py` — a marimo notebook that is (a) auto-written by the **Historian/Archivist** role, (b) homologated by `marimo check --strict`, (c) executed headlessly so its *variables* seed round `n+1`, and (d) published (HTML + molab link + slides) as the broadcast's "debrief" scene. On screen it is F1 words only: TELEMETRY REVIEW, STEWARDS' REPORT, UPGRADE SIGN-OFF, HOMOLOGATION, ARCHIVE, GHOST CAR.

### Notebook DAG (fixed skeleton; the Historian fills the cells)

| Cell name | Defines (public) | Reads | F1 label | Source of truth |
|---|---|---|---|---|
| `setup` | `mo, weave, wandb, pl` | — | — | `setup` cell guaranteed first (F4) |
| `round_meta` | `round_id, lineage_id, cost_cap` | — | RACE WEEKEND | written by loop |
| `telemetry` | `calls` (Weave calls for this round, via `weave.init` + calls query, wrapped in `mo.persistent_cache`) | `round_id` | FIA TELEMETRY | Weave (read-only) |
| `per_role` | `role_table` (one row per role: tokens, latency, tool errors, eval deltas) | `calls` | GARAGE BOARDS | derived |
| `scores` | `public_score, sealed_score` | `calls` | QUALI vs RACE | evaluator |
| `stewards` | `scrutineer_verdict, tamper_class` | `calls, role_table` | STEWARDS' REPORT | Scrutineer role |
| `credit` | `blame: dict[role, float]` | `role_table, scores` | ATTRIBUTION | credit-assignment method (R1) |
| `upgrade_pick` | `upgrade_pick = mo.ui.dropdown(...)` | `blame` | UPGRADE SIGN-OFF | Team Principal can override in the app |
| `next_round_config` | `next_round_config` (harness diff for the chosen role) | `upgrade_pick.value, blame` | PARC FERMÉ RELEASE | consumed by round n+1 |
| `narrative` | `mo.md(...)` prose + `ghost_plot` | everything | PRESS CONFERENCE | Historian |

The DAG rules (one owning cell per public name, no cycles, F18) make **ownership explicit**: `ctx.graph.ancestors("next_round_config")` is literally the evidence chain for the upgrade — that is the auditable link between "observe" and "improve" the event asks for, and the Scrutineer can assert that `next_round_config`'s ancestors include `stewards` (no upgrade without a stewards' verdict) before promotion.

### Three implementation lanes (pick by hour budget)

**Lane 1 — File generation + headless run (core, ~3 h, fully real).**
1. Historian (a sub-agent with its own skill file) emits the cell bodies; the loop writes the `.py` with `marimo._ast.codegen.generate_filecontents(codes, names, cell_configs)` (private, F11) or just templates the `@app.cell` text / the Markdown format (F12).
2. Gate: `marimo check --fix --strict --format=json debriefs/round_007.py`; feed JSON errors back to the Historian until clean (F13). This is HOMOLOGATION; a failing check is a black flag on the *document*, logged to Weave.
3. Execute + hand-off: `from debriefs.round_007 import app; outputs, defs = app.run(defs={"round_id": 7})`; `defs["next_round_config"]` seeds round 8 (F14). Because `defs=` overrides, the same notebook replays counterfactuals ("what if we had upgraded the aerodynamicist instead") = GHOST CAR in document form.
4. Render: `marimo export html debriefs/round_007.py -o site/round_007.html` (runs headlessly, includes outputs), `marimo export pdf --as=slides` for the press-conference scene, `--watch` during dev (F15).

**Lane 2 — Live pair session (demo flourish, ~2 h, real).**
Run `marimo edit --headless --no-token --watch debriefs/round_007.py` (or the same notebook in molab), then the Historian agent uses marimo pair: `execute-code.sh --url http://localhost:2718 -c "import marimo._code_mode as cm; help(cm)"`, then `async with cm.get_context() as ctx: cid = ctx.create_cell(...); ctx.run_cell(cid)`; read `ctx.globals["blame"]`, check `ctx.cells["stewards"].errors == []`, and `ctx.screenshot("ghost_plot", save_to="frames/round_007.png")` to drop a PNG straight into the broadcast's upgrade scene (F3). On stage: the human Team Principal flips `upgrade_pick` in the app; reactivity re-computes `next_round_config` live. With `watcher_on_save = "autorun"` the notebook re-runs as files land (F17).

**Lane 3 — Archive server + molab (publish, ~1.5 h, real).**
`marimo.create_asgi_app().with_dynamic_directory(path="/debriefs", directory="./debriefs")` mounted in the broadcast's FastAPI so each new round appears without restart (F16). Push `debriefs/` to GitHub; the broadcast's ARCHIVE panel links `molab.marimo.io/https://github.com/<org>/<repo>/blob/main/debriefs/round_007.py` and the "Open in molab" badge (F9). For the GPU story: run the round's role-upgrade SFT/LoRA smoke-test (or the eval replay) inside a molab notebook with the RTX Pro 6000 toggled on, sharing the link — that is the CoreWeave-on-marimo beat the sponsors want (F8), within the 12 h / 90 min-idle limits.

### How documentation feeds the next round (the "document → improve" edge)
- `next_round_config` is a *variable*, not prose: the outer improver reads it from `app.run()`'s `defs`, so the document is the contract. The prose is generated *from* the same variables (`mo.md(f"...")`), so text and evidence cannot drift.
- Round n+1's `telemetry` cell reads round n's cached `calls` through `mo.persistent_cache` keyed by function body + args (F10/F18): re-runs are cheap and byte-reproducible.
- The Historian's own skill file is upgradeable like any other role: its quality metric = `marimo check` pass rate on first try + reviewer rubric scored by Weave evals; a bad Historian gets the upgrade scene too.

### What the marimo judge will look for (map to F20)
- "understanding through code, UI elements, and text": the debrief has all three, and the UI element (`upgrade_pick`) is *causal*, not decorative.
- "custom extensions ... provide insight": credit-assignment cell + counterfactual replay via `app.run(defs=...)`.
- "auditable": the DAG *is* the audit trail; show `ctx.graph.ancestors("next_round_config")` in the REGS panel.
- Use their flagship (marimo pair) on stage, their GPU (molab on CoreWeave), and their gate (`marimo check`). Avoid MCP wrappers around marimo — they explicitly moved away from that (F2).

### Real-vs-simulated boundary
Real: notebook generation, `marimo check`, `app.run()` hand-off, HTML/slides export, ASGI archive, molab link, one live pair session, one molab GPU cell. Simulated: none required for this stage. Risk: `marimo._code_mode` is internal and may change (pin the marimo version; F3).

---

## Open gaps
1. **CoreWeave Hacks "The Loop" page / judge list** — not findable by web search on 2026-09-03; the marimo judge's identity and any published rubric are UNVERIFIED. Nearest evidence is WeaveHacks 3's "Best Use of Marimo" prize and the molab competition rubric.
2. **No public molab API** for creating/updating notebooks; GitHub-sync + URL scheme is the only programmatic path. Whether molab's GitHub-synced notebook re-pulls on every push (vs. manual refresh) is UNVERIFIED.
3. **`marimo._code_mode` stability** — explicitly internal; pin the version (the third-party article references v0.23.8, 2026-05-22). `ctx.screenshot` needs Playwright + Chromium, which may not be installed in molab sandboxes (UNVERIFIED).
4. **Concurrency**: one agent per notebook session per the third-party article (F5); not confirmed in official docs. If several roles must write the same debrief, serialize through the Historian.
5. **Weave traces inside marimo** — no official example; we would write the first. The Weave calls-query API surface is covered in the R-thread on W&B, not here.
6. **molab "Pair with an agent" exact prompt text / token handling** — docs say a prompt is generated; the precise `marimo pair prompt --url ... --with-token` output format is UNVERIFIED (inferred from the CLI flags).
7. **`marimo export html` on notebooks that need secrets** (WANDB_API_KEY) — export runs the notebook, so secrets must be in env at export time; confirm `--sandbox` interaction with env passing.
8. **The brief's "launch week Aug 2026" reference** is wrong (July 20–24, 2026); the only August molab post is storage (Aug 26). Nothing found suggesting an additional August launch.
