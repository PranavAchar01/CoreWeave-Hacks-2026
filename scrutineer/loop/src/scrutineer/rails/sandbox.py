"""Isolated execution of hidden tests.

Four backends, tried in order; whichever answers is named on the REGS panel:
  1. `cwsandbox` directly (CoreWeave Sandboxes client)
  2. `wandb.sandbox` (W&B's subclass, which forwards `network=` and `tags=`)
  3. local Docker with `--network none` and a read-only mount
  4. a local subprocess with CPU/memory/time limits — labelled, never called isolation
"""

from __future__ import annotations

import hashlib
import os
import resource
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

from . import Backend

# A pure-python puzzle finishes in under a second; a benchmark task that fits a model
# or renders a figure does not, so this is configurable rather than tuned for one workload.
_SANDBOX_TIMEOUT_S = int(os.environ.get("SCRUTINEER_SANDBOX_TIMEOUT_S", "20"))
_MEM_LIMIT_BYTES = 512 * 1024 * 1024


@dataclass(frozen=True)
class RunResult:
    returncode: int
    stdout: str
    stderr: str
    backend: str
    timed_out: bool = False

    @property
    def ok(self) -> bool:
        return self.returncode == 0 and "SCRUTINEER_PASS" in self.stdout


def _limits() -> None:  # pragma: no cover - runs in the child process
    # Not every limit is settable on every platform (RLIMIT_NPROC and RLIMIT_AS are refused on
    # macOS for a normal user). Apply what the kernel accepts and let the wall-clock timeout be
    # the backstop for the rest; the local backend is labelled as not being isolation anyway.
    for res_name, value in (
        ("RLIMIT_CPU", (_SANDBOX_TIMEOUT_S, _SANDBOX_TIMEOUT_S)),
        ("RLIMIT_AS", (_MEM_LIMIT_BYTES, _MEM_LIMIT_BYTES)),
        ("RLIMIT_NPROC", (64, 64)),
        ("RLIMIT_FSIZE", (16 * 1024 * 1024, 16 * 1024 * 1024)),
    ):
        limit = getattr(resource, res_name, None)
        if limit is None:
            continue
        try:
            resource.setrlimit(limit, value)
        except (ValueError, OSError):
            continue


class SandboxRail:
    def __init__(self, prefer: str | None = None) -> None:
        self._prefer = prefer or os.environ.get("SCRUTINEER_SANDBOX", "auto")
        self.managed_reason: str | None = None
        self._backend = self._detect()
        self._cache: dict[str, RunResult] = {}
        self.cache_hits = 0
        self.executions = 0

    def _probe_managed(self) -> str | None:
        """None when a managed sandbox can be created; otherwise the reason it cannot."""
        try:
            from wandb.sandbox import NetworkOptions, Sandbox
        except Exception as e:
            return f"wandb.sandbox unavailable: {type(e).__name__}"
        try:
            sb = Sandbox.run(container_image="python:3.13",
                             mounted_files=[{"mount_path": "/w/p.py", "file_content": b"print(1)\n"}],
                             network=NetworkOptions(deny_egress=True, deny_ingress=True),
                             tags=["scrutineer-probe"])
            with __import__("contextlib").suppress(Exception):
                sb.terminate()
            return None
        except Exception as e:
            msg = str(e)
            if "not enabled" in msg:
                return ("sandboxes are not enabled for this organisation — W&B enables the preview "
                        "per org on request to support@wandb.com")
            return f"{type(e).__name__}: {msg[:160]}"

    def _detect(self) -> Backend:
        if self._prefer == "local":
            return Backend("local-subprocess", real=False, detail="rlimits only, no network isolation")
        if self._prefer in ("auto", "cwsandbox") and os.environ.get("WANDB_API_KEY"):
            # A managed sandbox is worth a live probe rather than a guess: the service is in
            # public preview and is enabled per organisation, so a valid key is not enough.
            reason = self._probe_managed()
            if reason is None:
                return Backend("wandb-sandbox", real=True,
                               detail="wandb.sandbox -> cwsandbox, Kata guest per sandbox")
            self.managed_reason = reason
        if self._prefer in ("auto", "docker") and shutil.which("docker"):
            probe = subprocess.run(["docker", "info"], capture_output=True, timeout=10)
            if probe.returncode == 0:
                return Backend("docker", real=True, detail="--network none, read-only mount")
        return Backend("local-subprocess", real=False, detail="rlimits only, no network isolation")

    @property
    def backend(self) -> Backend:
        return self._backend

    def run(self, program: str, *, tags: tuple[str, ...] = (), cache: bool = True) -> RunResult:
        # Programs are deterministic (fixed hash seed, no randomness in the hidden tests), and
        # replay re-runs the same program many times, so a content-addressed cache is safe.
        # Hits are counted separately so the cost meter never charges for work that did not run.
        key = hashlib.sha256(program.encode()).hexdigest() if cache else ""
        if key and key in self._cache:
            self.cache_hits += 1
            return self._cache[key]
        r = self._dispatch(program, tags)
        if key:
            self._cache[key] = r
        self.executions += 1
        return r

    def _dispatch(self, program: str, tags: tuple[str, ...]) -> RunResult:
        name = self._backend.name
        if name == "cwsandbox":
            return self._cwsandbox(program, tags)
        if name == "wandb-sandbox":
            return self._wandb_sandbox(program, tags)
        if name == "docker":
            return self._docker(program)
        return self._local(program)

    # -- backends -----------------------------------------------------------------------------
    def _cwsandbox(self, program: str, tags: tuple[str, ...]) -> RunResult:  # pragma: no cover
        import cwsandbox
        from cwsandbox import NetworkOptions

        sb = cwsandbox.Sandbox.run(
            container_image="python:3.13",
            mounted_files=[{"mount_path": "/w/prog.py", "file_content": program.encode()}],
            network=NetworkOptions(deny_egress=True, deny_ingress=True),
            tags=tags or ("parc-ferme",),
        )
        try:
            r = sb.exec(["python", "/w/prog.py"]).result()
            return RunResult(r.returncode, r.stdout or "", r.stderr or "", "cwsandbox")
        finally:
            with __import__("contextlib").suppress(Exception):
                sb.terminate()

    def _wandb_sandbox(self, program: str, tags: tuple[str, ...]) -> RunResult:  # pragma: no cover
        from wandb.sandbox import NetworkOptions, Sandbox

        sb = Sandbox.run(
            container_image="python:3.13",
            mounted_files=[{"mount_path": "/w/prog.py", "file_content": program.encode()}],
            network=NetworkOptions(deny_egress=True, deny_ingress=True),
            tags=tags or ("parc-ferme",),
        )
        try:
            r = sb.exec(["python", "/w/prog.py"]).result()
            return RunResult(r.returncode, r.stdout or "", r.stderr or "", "wandb-sandbox")
        finally:
            with __import__("contextlib").suppress(Exception):
                sb.terminate()

    def _docker(self, program: str) -> RunResult:  # pragma: no cover - needs a daemon
        with tempfile.TemporaryDirectory() as d:
            Path(d, "prog.py").write_text(program)
            try:
                # The image is configurable because a benchmark that calls across 83 libraries
                # needs them present inside the sandbox, not in the host venv. Isolation is not
                # what gets relaxed to achieve that: no network, read-only mount, capped memory
                # and CPU all still hold.
                image = os.environ.get("SCRUTINEER_SANDBOX_IMAGE", "python:3.13-slim")
                mem = os.environ.get("SCRUTINEER_SANDBOX_MEMORY", "512m")
                p = subprocess.run(
                    ["docker", "run", "--rm", "--network", "none", "--memory", mem,
                     "--cpus", "2", "-v", f"{d}:/w:ro", image,
                     "python", "/w/prog.py"],
                    capture_output=True, text=True, timeout=_SANDBOX_TIMEOUT_S + 10,
                )
                return RunResult(p.returncode, p.stdout, p.stderr, "docker")
            except subprocess.TimeoutExpired:
                return RunResult(124, "", "timeout", "docker", timed_out=True)

    def _local(self, program: str) -> RunResult:
        with tempfile.TemporaryDirectory() as d:
            f = Path(d, "prog.py")
            f.write_text(program)
            env = {"PATH": "/usr/bin:/bin", "HOME": d, "PYTHONHASHSEED": "0"}
            try:
                p = subprocess.run(
                    [sys.executable, "-I", str(f)],
                    capture_output=True, text=True, timeout=_SANDBOX_TIMEOUT_S,
                    cwd=d, env=env, preexec_fn=_limits,
                )
                return RunResult(p.returncode, p.stdout, p.stderr, "local-subprocess")
            except subprocess.TimeoutExpired:
                return RunResult(124, "", "timeout", "local-subprocess", timed_out=True)


_RAIL: SandboxRail | None = None


def sandbox() -> SandboxRail:
    global _RAIL
    if _RAIL is None:
        _RAIL = SandboxRail()
    return _RAIL
