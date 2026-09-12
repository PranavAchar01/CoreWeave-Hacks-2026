# Fact-check: W&B Serverless Sandboxes claim (design §2/§4/§6/§7/§10)

Checked 2026-09-03/04 against live official sources. Verdict: **REFUTED in part** — the core API shape is right, but two load-bearing details are wrong (Free-plan availability; `egress_mode="isolated"` no longer exists) and the "UNVERIFIED pass-through" hedge is now resolved (it passes through).

## The claim under test

> W&B Sandboxes (`wandb.sandbox.Sandbox.run(container_image=..., mounted_files=[...], secrets=[Secret(...)])`) execute commands in fresh Kata VMs with read-only mounted files and return `returncode`/`stdout`; but network isolation (`NetworkOptions(egress_mode="isolated")`) and `tags=` are cwsandbox-level parameters whose pass-through via the W&B wrapper is UNVERIFIED, and Sandboxes are in public preview, per-org enabled, not on the Free plan.

## Sub-claim scorecard

| # | Sub-claim | Verdict | Primary source |
|---|-----------|---------|----------------|
| 1 | `wandb.sandbox.Sandbox.run(container_image=, mounted_files=, secrets=[Secret(...)])` | VERIFIED | docs.wandb.ai/sandboxes/create-sandbox, /file-access, /secrets (fetched 2026-09-03) |
| 2 | Mounted files are read-only | VERIFIED | docs.wandb.ai/sandboxes/file-access; cwsandbox CHANGELOG v0.23.0 (2026-05-08) |
| 3 | "return `returncode`/`stdout`" | IMPRECISE | `Sandbox.run()` returns a `Sandbox`; `returncode`/`stdout` come from `sandbox.exec([...]).result()` → `ProcessResult` |
| 4 | "fresh Kata VMs" | PARTLY VERIFIED | W&B docs say only "own container"; Kata is stated by CoreWeave docs/blog and is profile-configurable |
| 5 | `NetworkOptions(egress_mode="isolated")` | **REFUTED** | cwsandbox `_types.py` @ v1.12.3: no `egress_mode` field (removed v0.27.0, 2026-08-14). Use `NetworkOptions(deny_egress=True)` |
| 6 | `network=`/`tags=` pass-through "UNVERIFIED" | **RESOLVED → VERIFIED** | wandb `wandb/sandbox/_sandbox.py`: subclass forwards `**kwargs`; W&B docs use both |
| 7 | Public preview, per-org enabled | VERIFIED | docs.wandb.ai/sandboxes |
| 8 | "not on the Free plan" | **REFUTED** | wandb.ai/site/pricing: Free = "$10/mo Credit for a limited time" |

## Evidence, verbatim

### 1. API surface (W&B docs)

- Overview (https://docs.wandb.ai/sandboxes, fetched 2026-09-03): "Serverless Sandboxes is in **public preview**. Access is enabled per organization. To request access for your organization, contact support@wandb.com." Install: `pip install wandb[sandbox]`. "Each sandbox runs in its own container with its own filesystem, network, and process space." "Serverless Sandboxes is built using the CoreWeave Sandbox library."
- Create (https://docs.wandb.ai/sandboxes/create-sandbox): "By default, sandboxes use `python:3.11` as the base image." "W&B supports public container images only." Example uses `SandboxDefaults(container_image="python:3.11", max_lifetime_seconds=300, tags=("batch-job",))`. Page links the full parameter reference to https://docs.coreweave.com/products/coreweave-sandbox/client/ref/core/sandbox#run.
- File access (https://docs.wandb.ai/sandboxes/file-access): "Mounted files are read-only in the sandbox. If you need to modify files in the sandbox, use `Sandbox.write_file()` instead." Entry shape: `{"mount_path": ..., "file_content": <bytes>}`.
- Secrets (https://docs.wandb.ai/sandboxes/secrets): `Secret(name="HF_TOKEN")`, optional `env_var=`; "W&B injects each requested secret into the sandbox as an environment variable."
- Run commands (https://docs.wandb.ai/sandboxes/run-commands): `exec()` "runs a command in the sandbox and returns a `Process` object"; `.result()` gives `stdout`, `stderr`, `returncode`; `check=True` raises `SandboxExecutionError` on non-zero exit.
- ML-training tutorial (https://docs.wandb.ai/sandboxes/mltrain-in-sandbox-tutorial): `from wandb.sandbox import Sandbox, NetworkOptions` and

  ```python
  with Sandbox.run(
      mounted_files=mounted_files,
      container_image="python:3.13",
      network=NetworkOptions(egress_mode="internet"),
      max_lifetime_seconds=3600
  ) as sandbox:
  ```
  then `result = sandbox.exec([...]).result(); print(result.stdout); print(f"Exit code: {result.returncode}")`.
  NOTE: this snippet is stale against the SDK `pip install wandb[sandbox]` installs today (see §5).

### 2. cwsandbox `Sandbox.run()` signature (CoreWeave reference, fetched 2026-09-03)

https://docs.coreweave.com/products/coreweave-sandbox/client/ref/core/sandbox

```python
run(*args: str = (), container_image: str | None = None,
    defaults: SandboxDefaults | None = None,
    request_timeout_seconds: float | None = None,
    poll_retry_budget_seconds: float | None = None,
    poll_rpc_timeout_seconds: float | None = None,
    max_lifetime_seconds: float | None = None, tags: list[str] | None = None,
    profile_ids: list[str] | None = None, profile_names: list[str] | None = None,
    runner_ids: list[str] | None = None,
    resources: ResourceOptions | dict[str, Any] | None = None,
    mounted_files: list[dict[str, Any]] | None = None,
    s3_mount: dict[str, Any] | None = None,
    ports: list[dict[str, Any]] | None = None,
    network: NetworkOptions | dict[str, Any] | None = None,
    max_timeout_seconds: int | None = None,
    environment_variables: dict[str, str] | None = None,
    annotations: dict[str, str] | None = None,
    secrets: Sequence[Secret | dict[str, Any]] | None = None) -> Sandbox
```
Docstrings: `tags` "Optional tags for the sandbox"; `network` "Network configuration (NetworkOptions dataclass)"; `mounted_files` "Files to mount into the sandbox"; returns "A Sandbox instance (start request sent, but may still be starting)". `exec(command, *, cwd=None, check=False, timeout_seconds=None, stdin=False) -> Process`.

cwsandbox source `_sandbox.py` (main, https://raw.githubusercontent.com/coreweave/cwsandbox-client/main/src/cwsandbox/_sandbox.py): `mounted_files` docstring "Each dict should have mount_path (str) and file_content (bytes). Note: Mounted files are read-only at runtime."; `network` dict is coerced via `NetworkOptions(**network)`; `self._tags = self._defaults.merge_tags(tags)`.

### 3. The W&B wrapper forwards `network=` and `tags=` (resolves the UNVERIFIED)

https://raw.githubusercontent.com/wandb/wandb/main/wandb/sandbox/_sandbox.py (fetched 2026-09-03):

```python
class Sandbox(_BaseSandbox):          # _BaseSandbox = cwsandbox.Sandbox
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        _reject_invalid_kwargs(kwargs)                 # blocks only profile_ids/profile_names/runner_ids
        _reject_invalid_defaults(kwargs.get("defaults"))
        _apply_serverless_defaults_kwargs(kwargs)      # default max_lifetime_seconds = 12*60*60
        super().__init__(*args, **kwargs)
```
`_PLACEMENT_OVERRIDE_FIELDS = ("profile_ids", "profile_names", "runner_ids")`; error text: "W&B Serverless automatically selects the runner and profile." No other kwarg is touched, so `network=`, `tags=`, `mounted_files=`, `secrets=`, `resources=` reach cwsandbox unchanged. `wandb/sandbox/_secret.py`: `class Secret(_BaseSecret): store: str = "wandb-team-secrets"`.

`wandb/sandbox/__init__.py` on `main` does `from cwsandbox import *` and emits `termwarn("wandb.sandbox is deprecated ... Use the cwsandbox package directly instead.")`; the v0.29.0 tag (released 2026-08-26, https://api.github.com/repos/wandb/wandb/releases/latest) does NOT yet carry that warning. wandb 0.29.0 `requires_dist`: `cwsandbox[cli]>=1.0.0; python_version >= "3.11" and extra == "sandbox"` (https://pypi.org/pypi/wandb/json) → installs cwsandbox 1.12.3 (uploaded 2026-09-03, https://pypi.org/pypi/cwsandbox/json).

### 4. `egress_mode` no longer exists — REFUTED

`NetworkOptions` across tags (https://raw.githubusercontent.com/coreweave/cwsandbox-client/<tag>/src/cwsandbox/_types.py):

- v0.20.0, v0.23.0, v0.26.0: `ingress_mode: str | None`, `exposed_ports: tuple[int, ...] | None`, `egress_mode: str | None` — docstring "Outbound traffic mode. Available modes depend on the profile configurations of runners you have access to." No client-side enumeration of "isolated"/"internet".
- v0.27.0 (CHANGELOG date 2026-08-14) onward, incl. v1.0.0 and current main/1.12.3:

  ```python
  @dataclass(frozen=True, kw_only=True)
  class NetworkOptions:
      deny_egress: bool | None = None    # "When True, deny all declared egress (policy default unused)."
      deny_ingress: bool | None = None   # "When True, deny CUSTOM ingress (policy default unused)."
      egress: Sequence[EgressRule | Mapping[str, Any]] | None = None   # added v1.6.0 (2026-08-21)
      ingress: Sequence[IngressRule | Mapping[str, Any]] | None = None
  ```
  `EgressRule`: "Exactly one destination must be set: dns_name, cidr, tenant, any, or selector. DNS names are HTTPS (TCP 443) grants."

Consequence: with the cwsandbox that `pip install wandb[sandbox]` resolves to today, `NetworkOptions(egress_mode="isolated")` raises `TypeError: NetworkOptions.__init__() got an unexpected keyword argument 'egress_mode'` (frozen kw_only dataclass; no `from_dict`/alias shim was found in `_types.py`, and the CHANGELOG has zero hits for "egress_mode"). The W&B tutorial's `egress_mode="internet"` is stale. The correct isolation call is `NetworkOptions(deny_egress=True, deny_ingress=True)`; the correct allow-list is `NetworkOptions(egress=[EgressRule(dns_name="pypi.org")])`.

### 5. Kata

- W&B docs: container wording only, no Kata/VM mention (https://docs.wandb.ai/sandboxes).
- CoreWeave docs (https://docs.coreweave.com/products/coreweave-sandbox, fetched 2026-09-03): "Each sandbox runs inside its own hardware-virtualized guest using Kata Containers, so the isolation boundary is a virtual machine rather than a shared kernel."
- CoreWeave blog 2026-08-25 (https://www.coreweave.com/blog/run-agentic-workloads-safely-at-scale-with-coreweave-sandboxes): "every CPU sandbox inside a Kata Container by default"; also names `pip install wandb[sandbox]` as the serverless path.
- Profile reference (https://docs.coreweave.com/products/sandboxes/reference/profile): runtime class is policy-set (`allowedRuntimeClasses`, `defaultCpuRuntimeClass`, Kata as example). W&B Serverless picks the profile for you, so "Kata" for serverless is default-by-inference, not a W&B-documented guarantee. Keep as stated-by-CoreWeave, not stated-by-W&B.

### 6. Pricing / plan — REFUTED

https://wandb.ai/site/pricing/ (raw HTML fetched fresh 2026-09-04 UTC, comparison table row group "CoreWeave Sandboxes"): row "Sandboxes — Public preview": **Free: "$10/mo — Credit for a limited time"**; Pro: "$25/mo — Credit for a limited time"; Enterprise: "Customizable". Pro "Starts at $60/month, billed monthly". (Column order confirmed by the Inference row: Free "Free credits for a limited time", Pro "$5/mo", Enterprise checkmark.) So Sandboxes ARE on the Free plan, with a $10/mo credit — but org-level enablement via support@wandb.com still applies per the docs.

## Corrected claim (drop-in replacement)

> W&B Serverless Sandboxes (`pip install wandb[sandbox]`; `from wandb.sandbox import Sandbox, Secret, NetworkOptions`) run each `Sandbox.run(container_image="python:3.13", mounted_files=[{"mount_path": ..., "file_content": bytes}], secrets=[Secret(name=...)], network=NetworkOptions(deny_egress=True, deny_ingress=True), tags=[...])` in a fresh per-sandbox container that CoreWeave documents as a Kata hardware-virtualized guest (W&B docs say only "own filesystem, network, and process space"). `Sandbox.run()` returns a `Sandbox`; `sandbox.exec([...]).result()` returns a `ProcessResult(stdout, stderr, returncode)`. Mounted files are read-only (write_file() for mutable). `network=` and `tags=` are cwsandbox parameters and the W&B wrapper (a `cwsandbox.Sandbox` subclass forwarding `**kwargs`) passes them through unchanged, blocking only `profile_ids/profile_names/runner_ids` and defaulting `max_lifetime_seconds` to 12 h. `egress_mode` was removed from `NetworkOptions` in cwsandbox v0.27.0 (2026-08-14); the W&B tutorial's `egress_mode="internet"` is stale and will `TypeError` on 1.12.3. Sandboxes are in public preview, enabled per organization on request to support@wandb.com, and appear on all plans: Free $10/mo credit, Pro $25/mo credit ("for a limited time"), Enterprise customizable.

## Impact on the design

- §4 'observe'/'evaluate': replace `network=isolated` with `network=NetworkOptions(deny_egress=True, deny_ingress=True)`; PARC FERMÉ-by-construction (read-only mounts) stands.
- §4 'track': `tags=` passthrough is verified — remove UNVERIFIED.
- §7 H0 on-site check: still needed for org enablement (support@wandb.com), but the Free-plan blocker is gone; budget is a $10/mo credit on Free / $25 on Pro.
- §10 risks: "Sandbox.run does not pass network=/tags= through" can be retired; add "W&B docs snippet uses removed `egress_mode` — pin against cwsandbox 1.12.x semantics".
- Guard: `wandb.sandbox` is deprecated on wandb `main` in favour of `cwsandbox` directly (with `auth=AuthStrategy.WANDB` per the cwsandbox README) — fine for 0.29.0 in September, but expect a warning on the next release.

## Sources (all fetched live 2026-09-03/04)

- https://docs.wandb.ai/sandboxes
- https://docs.wandb.ai/sandboxes/create-sandbox
- https://docs.wandb.ai/sandboxes/file-access
- https://docs.wandb.ai/sandboxes/secrets
- https://docs.wandb.ai/sandboxes/run-commands
- https://docs.wandb.ai/sandboxes/mltrain-in-sandbox-tutorial
- https://docs.coreweave.com/products/coreweave-sandbox/client/ref/core/sandbox
- https://docs.coreweave.com/products/coreweave-sandbox
- https://docs.coreweave.com/products/sandboxes/reference/profile
- https://docs.coreweave.com/products/sandboxes/client/tutorial/configuration
- https://raw.githubusercontent.com/wandb/wandb/main/wandb/sandbox/__init__.py
- https://raw.githubusercontent.com/wandb/wandb/main/wandb/sandbox/_sandbox.py
- https://raw.githubusercontent.com/wandb/wandb/main/wandb/sandbox/_secret.py
- https://raw.githubusercontent.com/wandb/wandb/v0.29.0/wandb/sandbox/__init__.py
- https://raw.githubusercontent.com/coreweave/cwsandbox-client/main/src/cwsandbox/_types.py (and tags v0.20.0, v0.23.0, v0.26.0, v0.27.0, v0.28.0, v1.0.0)
- https://raw.githubusercontent.com/coreweave/cwsandbox-client/main/src/cwsandbox/_sandbox.py
- https://raw.githubusercontent.com/coreweave/cwsandbox-client/main/CHANGELOG.md
- https://pypi.org/pypi/cwsandbox/json ; https://pypi.org/pypi/wandb/json ; https://api.github.com/repos/wandb/wandb/releases/latest
- https://www.coreweave.com/blog/run-agentic-workloads-safely-at-scale-with-coreweave-sandboxes (2026-08-25)
- https://wandb.ai/site/pricing/
