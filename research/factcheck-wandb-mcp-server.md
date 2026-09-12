# Fact-check: W&B MCP server tool surface, read-only mode, and wandb/skills

Checked live on 2026-09-03/04 (UTC). Adversarial pass against the design claim used in §3 (RACE ENGINEER / HISTORIAN / SIMULATOR / SCRUTINEER rows), §4 MCP column, §6 write-set gate, §7 H0 check, §10 risk, Appendix correction (12).

## Verdict

**Not refuted in substance; imprecise in four places.** The core claims (read-only env var removes `create_wandb_report_tool`; weave-agent tools behind `WANDB_MCP_ENABLE_WEAVE_AGENT_TOOLS=true`; no Registry alias/link write tool; `wandb/skills` with `wandb-primary` installs via `npx skills add wandb/skills`) are all supported by primary sources. The corrections:

1. **`compare_runs_tool` and `summarize_evaluation_tool` are the README-vs-docs discrepancy, not `count_weave_traces_tool`.** `count_weave_traces_tool` is in the 0.3.7 README. `compare_runs_tool` and `summarize_evaluation_tool` are absent from the 0.3.7 README but ARE registered in `main`'s `server.py` and shipped as `mcp_tools/compare_runs.py` / `mcp_tools/summarize_evaluation.py`, and ARE listed on docs.wandb.ai. So §10's risk "summarize_evaluation_tool / compare_runs_tool absent" should read: "present in source and docs; absent from the README only".
2. **`WANDB_MCP_READ_ONLY` is a 0.3.7 (`main`) name.** The `staging/0.4.0` branch (pyproject `version = "0.4.0"`, updated 2026-08-26) renames it to `WANDB_MCP_ACCESS_MODE=read-only` and introduces `WANDB_MCP_TOOL_PROFILE` (profiles `models-only` 17 tools, `models-weave` 22, `models-weave-agents` 30, `models-weave-agents-aria` 33 local-only). The design's kickoff check should probe both names.
3. **"README 0.3.7" is slightly wrong provenance:** the README has no version string; `0.3.7` comes from `pyproject.toml` on `main` (bump commit 80252b3, 2026-07-10). There are no GitHub Releases at all.
4. **Which version the hosted server (`https://mcp.withwandb.com/mcp`) runs is UNVERIFIED.** An unauthenticated `tools/list` returns HTTP 401 (`"Please provide your W&B API key as a Bearer token"`), so the tool list cannot be confirmed without a key. The 0.4.0 staging README says the hosted MT SaaS runs the `models-weave-agents` profile (30 tools read-write / 28 read-only) — which, if already deployed, means weave-agent tools are on by default hosted and ARIA tools are local-only. Keep the design's "verify at kickoff" instruction.

## Evidence, claim by claim

### A. Package name and version
- Package `wandb_mcp_server`, `version = "0.3.7"`, console scripts `wandb_mcp_server` and `add_to_client`.
  Source: https://raw.githubusercontent.com/wandb/wandb-mcp-server/main/pyproject.toml (fetched 2026-09-03).
- `main` last updated 2026-07-10 ("Merge pull request #109 from wandb/staging/0.3.7"; "chore(release): bump version to 0.3.7"; "security: add opt-in read-only server mode").
  Source: https://github.com/wandb/wandb-mcp-server/commits/main (fetched 2026-09-03).
- Branch `staging/0.4.0` updated 2026-08-26; `pyproject.toml` there says `version = "0.4.0"`.
  Sources: https://github.com/wandb/wandb-mcp-server/branches ; https://raw.githubusercontent.com/wandb/wandb-mcp-server/staging/0.4.0/pyproject.toml (fetched 2026-09-03).
- "There aren't any releases here" — https://github.com/wandb/wandb-mcp-server/releases (fetched 2026-09-03).
- PyPI page could not be fetched (client-side load error) — UNVERIFIED whether 0.3.7 is on PyPI.

### B. `WANDB_MCP_READ_ONLY=true` removes write tools including `create_wandb_report_tool` — SUPPORTED (0.3.7)
- README (`main`): "Read-only deployment mode: Set `WANDB_MCP_READ_ONLY=true` to omit the two write tools, `create_wandb_report_tool` and `log_analysis_to_wandb`, while keeping every existing read tool. `query_wandb_tool` is query-only in every mode..."
  Source: https://github.com/wandb/wandb-mcp-server (README rendered; fetched 2026-09-03).
- README env table: `WANDB_MCP_READ_ONLY` — "Omit report creation and analysis logging write tools (default: false)".
  Source: https://raw.githubusercontent.com/wandb/wandb-mcp-server/main/README.md (fetched 2026-09-03).
- `server.py` on `main` gates registration with `if not WANDB_MCP_READ_ONLY:` around `create_wandb_report_tool` and `log_analysis_to_wandb`.
  Source: https://raw.githubusercontent.com/wandb/wandb-mcp-server/main/src/wandb_mcp_server/server.py (fetched 2026-09-03).
- **0.4.0 change:** staging README: "`WANDB_MCP_READ_ONLY` is now `WANDB_MCP_ACCESS_MODE`. Set `WANDB_MCP_ACCESS_MODE=read-only` to omit write tools" — write set becomes `create_wandb_report_tool`, `log_analysis_to_wandb`, and `aria_send_message` (ARIA profile only). `config.py` on `staging/0.4.0` contains neither `WANDB_MCP_READ_ONLY` nor `WANDB_MCP_ACCESS_MODE` (gating lives elsewhere) — whether the old name is still honored in 0.4.0 is UNVERIFIED.
  Sources: https://raw.githubusercontent.com/wandb/wandb-mcp-server/staging/0.4.0/README.md ; https://raw.githubusercontent.com/wandb/wandb-mcp-server/staging/0.4.0/src/wandb_mcp_server/config.py (fetched 2026-09-03).
- Note: the docs page https://docs.wandb.ai/platform/mcp-server does NOT mention `WANDB_MCP_READ_ONLY` at all (its env table lists only `WANDB_API_KEY`, `WANDB_BASE_URL`, `WANDB_MCP_PROXY_DOCS`, `WANDBOT_BASE_URL`, `MAX_RESPONSE_TOKENS`, `MCP_SERVER_LOG_LEVEL`). The read-only flag is README/source-only.

### C. `WANDB_MCP_ENABLE_WEAVE_AGENT_TOOLS=true` — SUPPORTED (0.3.7)
- README: "Weave Agents (OTel) tools — these read the OpenTelemetry/GenAI agent-spans data plane (the Agents tab)... These tools are disabled by default. Enable them with `WANDB_MCP_ENABLE_WEAVE_AGENT_TOOLS=true`." Env table: "Enable Weave Agents (OTel/GenAI) tools (default: false)".
- `server.py` gates all eight agent tools on this var: `list_weave_agents_tool`, `list_weave_agent_versions_tool`, `query_weave_agent_spans_tool`, `get_weave_agent_span_stats_tool`, `list_weave_agent_custom_attributes_tool`, `search_weave_agents_tool`, `get_weave_agent_trace_tool`, `get_weave_agent_conversation_tool`.
- Also exists: `WANDB_MCP_ENABLE_WEAVE_TOOLS` (default true) gating `query_weave_traces_tool`, `count_weave_traces_tool`, `resolve_trace_roots_tool`, `infer_trace_schema_tool`, `summarize_evaluation_tool`.
- **0.4.0 change:** agent tools are selected by `WANDB_MCP_TOOL_PROFILE=models-weave-agents` (hosted default per staging README); the env-var name is not mentioned in the 0.4.0 README fetch — UNVERIFIED whether it survives.
  Sources as in B.

### D. Tool names the design cites — status on `main` (0.3.7)

| Tool | In README (main) | Registered in server.py (main) | On docs.wandb.ai/platform/mcp-server |
|---|---|---|---|
| `query_weave_traces_tool` | yes | yes | yes |
| `count_weave_traces_tool` | **yes** | yes | yes |
| `get_weave_agent_trace_tool` | yes (agent group, off by default) | yes (gated) | no |
| `compare_runs_tool` | **no** | **yes** | yes |
| `summarize_evaluation_tool` | **no** | **yes** | yes |
| `compare_artifact_versions_tool` | yes | yes | yes |
| `list_artifact_versions_tool` | yes | yes | yes |
| `get_artifact_details_tool` | yes | yes | yes |
| `list_wandb_automations_tool` | yes | yes | no |
| `log_analysis_to_wandb` | yes | yes (write) | yes |
| `create_wandb_report_tool` | yes | yes (write) | yes |

Also registered on `main` but not in its README: `diagnose_run_tool`, `probe_project_tool`, `list_entities_tool`, `resolve_trace_roots_tool` (all on the docs page). Source files present in `src/wandb_mcp_server/mcp_tools/` on `main`: `compare_runs.py`, `summarize_evaluation.py`, `diagnose_run.py`, `probe_project.py`, `list_entities.py`, `resolve_trace_roots.py`, `automations.py`, `agents.py`, `query_registry.py`, `query_artifacts.py`, etc. `staging/0.4.0` adds `aria.py` and `query_wandb.py`.
Sources: https://github.com/wandb/wandb-mcp-server/tree/main/src/wandb_mcp_server/mcp_tools ; https://github.com/wandb/wandb-mcp-server/tree/staging/0.4.0/src/wandb_mcp_server/mcp_tools ; https://docs.wandb.ai/platform/mcp-server (all fetched 2026-09-03).

- `compare_runs_tool` signature (main): `compare_runs(entity_name, project_name, run_id_a, run_id_b, include_history_overlap=False, history_keys=None, history_samples=DEFAULT_HISTORY_SAMPLES) -> str` — "Compare two W&B runs side-by-side. Returns config differences, summary metric deltas, and metadata comparison."
  Source: https://raw.githubusercontent.com/wandb/wandb-mcp-server/main/src/wandb_mcp_server/mcp_tools/compare_runs.py
- `summarize_evaluation_tool` signature (main): `summarize_evaluation(entity_name, project_name, eval_name=None, max_evals=5, include_per_task=False) -> str` — "Summarize Weave evaluation results with aggregated pass rates and metrics. Finds Evaluation.evaluate traces in a project and returns aggregated results including per-scorer pass rates, error counts, and token usage."
  Source: https://raw.githubusercontent.com/wandb/wandb-mcp-server/main/src/wandb_mcp_server/mcp_tools/summarize_evaluation.py

**Consequence for the design:** the "docs list them, GitHub README differs" caveat is correct but should name `compare_runs_tool` + `summarize_evaluation_tool` (and `diagnose_run_tool`), not `count_weave_traces_tool`. The §10 risk should be downgraded: the tools exist in shipped source; only the README is stale.

### E. No Registry alias/link write tool — SUPPORTED
- Registry tools on `main` are read-only: `list_registries_tool`, `list_registry_collections_tool` (plus artifact readers `list_artifact_versions_tool`, `get_artifact_details_tool`, `compare_artifact_versions_tool`). No `link_artifact`, `add_alias`, or promote tool exists in `server.py`, `mcp_tools/`, the README, or the docs page. The only write tools are `create_wandb_report_tool` and `log_analysis_to_wandb` (0.3.7), plus `aria_send_message` in 0.4.0 (local-only). So "promote" must go through the wandb SDK/API with the Scrutineer's own key, as the design says.
  Sources: server.py and README on `main`; docs page; staging/0.4.0 README (fetched 2026-09-03).

### F. Hosted server
- Hosted URL `https://mcp.withwandb.com/mcp` (README main; docs page). Live probe on 2026-09-04 03:39 UTC: `POST /mcp tools/list` without auth → HTTP 401 `{"error":"Authorization required","message":"Please provide your W&B API key as a Bearer token"}`. Tool list on hosted therefore UNVERIFIED; the design's kickoff check is the right mitigation.
- staging/0.4.0 README: hosted MT SaaS runs the `models-weave-agents` profile (30 tools read-write, 28 read-only); "Shared and Dedicated managed profiles reject ARIA"; ARIA tools are local-only.
- Local install (README main): `uvx --from git+https://github.com/wandb/wandb-mcp-server wandb_mcp_server`; HTTP: `uvx wandb_mcp_server --transport http --host 0.0.0.0 --port 8080`.

### G. `wandb/skills` — SUPPORTED
- Repo https://github.com/wandb/skills: "Skills to guide Claude Code, Codex, and other coding agents on using the Weights & Biases AI developer platform to train models and build agents." Skills: `wandb-primary`, `wandb-eval-tables`, `wandb-autoresearch`. Install: `npx skills add wandb/skills`; "`npx skills` is a utility for installing skills into major coding agent CLIs. Use `--global` to install for all projects, or `--agent <name>` to target a specific agent." Requirements: Python ≥3.13, wandb ≥0.28.1, wandb-workspaces ≥0.4.4, weave ≥0.52.41. Benchmark badge: Claude Code 31/34 (91%).
  Sources: https://raw.githubusercontent.com/wandb/skills/main/README.md ; https://github.com/wandb/skills (fetched 2026-09-03). Latest commits 2026-08-06 ("add wandb-eval-tables and wandb-autoresearch (#45)", "wandb-primary: add Artifacts, Registry, run ops, and Workspaces coverage (#44)") — https://github.com/wandb/skills/commits/main.
- Official docs https://docs.wandb.ai/platform/wb-skills: supported agents "Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI"; global install `npx skills add wandb/skills --skill '*' --yes --global`; needs `WANDB_API_KEY`, optional `WANDB_PROJECT`.
- Secondary (search snippet, not primary): `npx -y skills add wandb/skills --skill wandb-primary --agent claude-code` — plausible from the `--skill`/`--agent` flags documented above, but that exact line is UNVERIFIED on an official page.

## Recommended text edits to the design
- §3 HISTORIAN: keep "needs `create_wandb_report_tool`, which read-only mode removes" but write it as "`WANDB_MCP_READ_ONLY=true` (0.3.7) / `WANDB_MCP_ACCESS_MODE=read-only` (0.4.0)".
- §4 'evaluate': replace "(docs list but README differs) `summarize_evaluation_tool` / `count_weave_traces_tool`" with "`summarize_evaluation_tool` and `compare_runs_tool` are registered in `main` source and listed on docs.wandb.ai but missing from the 0.3.7 README; `count_weave_traces_tool` is in all three".
- §7 H0 check: probe `tools/list` with the team key at kickoff; expect 22 (models-weave) or 30 (models-weave-agents) tools if hosted is on 0.4.0, or the 0.3.7 set if not.
- §10 risk: rename to "hosted server version drift (0.3.7 vs 0.4.0 profiles/env-var rename)"; the two tools are not absent from source.
- Appendix (12): cite `pyproject.toml` for "0.3.7", not the README.
