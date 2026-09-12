"""What the watch server hands to a page that is not its own.

The pit board reads this server from other pages — that is the whole point of it — so `/api/state`
and `/api/events` answer any origin. Starting a run must not, and a cross-origin POST needs no
preflight to arrive, so the refusal has to be in the handler rather than in CORS. This was a real
hole: before the Origin check, a page on another port started a generation on this machine, and on
a real `scrutineer watch` that generation spends the operator's key.
"""

from __future__ import annotations

import json
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import pytest

from scrutineer import serve


@pytest.fixture
def server(monkeypatch):
    started: list[bool] = []
    monkeypatch.setattr(serve.RUNNER, "start", lambda: started.append(True) or {"ok": True})
    srv = ThreadingHTTPServer(("127.0.0.1", 0), serve.Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        yield f"http://127.0.0.1:{srv.server_address[1]}", started
    finally:
        srv.shutdown()
        srv.server_close()


def _post(url: str, origin: str | None) -> tuple[int, dict]:
    req = urllib.request.Request(url + "/api/run", data=b"", method="POST")
    if origin:
        req.add_header("Origin", origin)
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def test_a_page_on_another_origin_cannot_start_a_run(server):
    url, started = server
    code, body = _post(url, "http://evil.example")
    assert code == 403, body
    assert not started, "the run was started by a cross-origin POST"


def test_the_servers_own_page_still_starts_a_run(server):
    url, started = server
    code, body = _post(url, url)
    assert code == 200 and body["ok"] is True
    assert started == [True]


def test_a_request_with_no_origin_still_works(server):
    """curl, a shell script, the CLI. Only a browser sends Origin, and only a browser is the threat
    here: anything that can reach this port without one can already run the loop directly."""
    url, started = server
    code, _ = _post(url, None)
    assert code == 200 and started == [True]


def test_reading_the_state_is_open_to_any_origin(server):
    url, _ = server
    req = urllib.request.Request(url + "/api/state")
    req.add_header("Origin", "https://scrutineer-one.vercel.app")
    with urllib.request.urlopen(req, timeout=5) as r:
        assert r.headers["Access-Control-Allow-Origin"] == "*"
        assert json.loads(r.read())["live"] is True


def test_the_preflight_only_answers_for_what_may_be_read(server):
    url, _ = server
    for path, expect in (("/api/events", 204), ("/api/state", 204), ("/api/run", 404)):
        req = urllib.request.Request(url + path, method="OPTIONS")
        req.add_header("Origin", "https://scrutineer-one.vercel.app")
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                assert r.status == expect, path
        except urllib.error.HTTPError as e:
            assert e.code == expect, path


def test_every_surface_has_a_route(server):
    """The hosted site rewrites these paths; the watch server has to answer the same ones, or a link
    that works on the web is a 404 on the machine running the loop."""
    url, _ = server
    for path, marker in (("/", b'id="app"'), ("/telemetry", b'id="chart"'), ("/pit", b'class="desk"')):
        with urllib.request.urlopen(url + path, timeout=5) as r:
            assert r.status == 200, path
            assert marker in r.read(), path
