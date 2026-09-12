"""A sandbox that times out must stop, not just stop being waited for.

subprocess.run's timeout kills the `docker run` client and leaves the container running; --rm only
removes a container after it exits. On a BigCodeBench-Hard run that leaked 24 containers, some an
hour old against a 180 s limit, each holding its CPUs and memory, until every later sandbox starved
and timed out as well — and the grades taken under that starvation were not grades of the harness.
"""

import shutil
import subprocess
import time

import pytest

import scrutineer.rails.sandbox as sb


def test_a_timed_out_container_is_killed_by_the_name_it_was_started_with(monkeypatch):
    calls = []

    def fake_run(argv, **kw):
        calls.append(argv)
        if argv[:2] == ["docker", "run"]:
            raise subprocess.TimeoutExpired(argv, kw.get("timeout"))
        return subprocess.CompletedProcess(argv, 0, "", "")

    monkeypatch.setattr(sb.subprocess, "run", fake_run)
    r = sb.SandboxRail.__new__(sb.SandboxRail)._docker("import time; time.sleep(999)")
    assert r.timed_out
    started = calls[0]
    name = started[started.index("--name") + 1]
    assert ["docker", "kill", name] in calls, "the client gave up and nothing stopped the container"


def test_the_program_is_also_killed_inside_the_container(monkeypatch):
    """The host-side kill is the backstop; the limit itself is enforced where the program runs."""
    seen = {}

    def fake_run(argv, **kw):
        seen["argv"] = argv
        return subprocess.CompletedProcess(argv, 0, "SCRUTINEER_PASS\n", "")

    monkeypatch.setattr(sb.subprocess, "run", fake_run)
    sb.SandboxRail.__new__(sb.SandboxRail)._docker("print('SCRUTINEER_PASS')")
    argv = seen["argv"]
    i = argv.index("timeout")
    assert argv[i:i + 4] == ["timeout", "-s", "KILL", str(int(sb._SANDBOX_TIMEOUT_S))]
    assert argv[i + 4:] == ["python", "/w/prog.py"]
    # isolation is untouched by the change
    assert argv[argv.index("--network"):argv.index("--network") + 2] == ["--network", "none"]
    assert any(a.endswith(":/w:ro") for a in argv)


def _docker_ready() -> bool:
    if not shutil.which("docker"):
        return False
    try:
        return subprocess.run(["docker", "info"], capture_output=True, timeout=10).returncode == 0
    except (subprocess.TimeoutExpired, OSError):
        return False


@pytest.mark.skipif(not _docker_ready(), reason="needs a running Docker daemon")
def test_no_container_outlives_its_timeout_against_a_real_daemon(monkeypatch):
    monkeypatch.setattr(sb, "_SANDBOX_TIMEOUT_S", 3)
    monkeypatch.setenv("SCRUTINEER_SANDBOX_IMAGE", "python:3.13-slim")
    t0 = time.monotonic()
    r = sb.SandboxRail.__new__(sb.SandboxRail)._docker("import time\ntime.sleep(60)\n")
    assert r.timed_out and not r.ok
    assert time.monotonic() - t0 < 20, "the lap waited far past the limit"
    time.sleep(1)
    left = subprocess.run(["docker", "ps", "-q", "--filter", "ancestor=python:3.13-slim",
                           "--filter", "name=scrutineer-"], capture_output=True, text=True).stdout
    assert not left.strip(), f"containers still running after timeout: {left.split()}"
