"""`scrutineer watch` — the loop, running on your machine, in your browser.

A small stdlib server: it hands over the same page the hosted build uses, streams the loop's own
events over SSE while a run is in progress, and serves every interface the agent builds straight
off disk so you can open one the moment it exists.

The key never leaves the machine. There is no relay here and nothing is uploaded.

The two read-only endpoints, `/api/state` and `/api/events`, answer any origin: that is how a pit
board on another page finds a loop running on this machine and turns live. Starting a run is
same-origin only, and enforced rather than assumed: a cross-origin POST needs no preflight, so
without the Origin check below any page you happened to have open could spend your key.
"""

from __future__ import annotations

import json
import mimetypes
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from . import events

REPO = Path(__file__).resolve().parents[2]
SITE = REPO.parent / "site" / "public"
STATE = REPO / "state"


class Runner:
    """Owns the season. One run at a time; the button is disabled while one is going."""

    def __init__(self) -> None:
        self.season: Any = None
        self.thread: threading.Thread | None = None
        self.error: str | None = None
        self.lock = threading.Lock()

    @property
    def busy(self) -> bool:
        return self.thread is not None and self.thread.is_alive()

    def status(self) -> dict[str, Any]:
        s = self.season
        return {
            "live": True,
            "busy": self.busy,
            "error": self.error,
            "run": (s.generation if s else 0),
            "accepted": (s.accepted if s else 0),
            "levels": self._levels(),
            "backends": (s.backends if s else {}),
        }

    def _levels(self) -> dict[str, int]:
        s = self.season
        if s is None:
            return {}
        from .theta import ALL_ROLES

        lv = dict.fromkeys(ALL_ROLES, 1)
        for r in s.reports:
            if r.promoted and r.role in lv:
                lv[r.role] += 1
        return lv

    def start(self) -> dict[str, Any]:
        with self.lock:
            if self.busy:
                return {"ok": False, "error": "a run is already going"}
            self.error = None

            def go() -> None:
                try:
                    if self.season is None:
                        from .controller import Season, clear_stale_pages

                        events.emit("boot", message="setting up")
                        # No opening band filter here. It costs ~144 model calls before the first
                        # interface appears, which is minutes of a blank screen — fine for a
                        # batch season, wrong for something you sit and watch.
                        clear_stale_pages()
                        self.season = Season(band_open=False)
                        events.emit("boot", message="ready")
                    self.season.run_generation()
                except Exception as e:  # surfaced in the page, not swallowed
                    self.error = f"{type(e).__name__}: {e}"
                    events.emit("error", message=self.error)

            self.thread = threading.Thread(target=go, daemon=True, name="season")
            self.thread.start()
            return {"ok": True}


RUNNER = Runner()
# what a page from another origin may read; never what it may start
READ_ONLY = {"/api/state", "/api/events"}
CORS = {"Access-Control-Allow-Origin": "*"}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args: Any) -> None:  # quiet
        pass

    # -- helpers ---------------------------------------------------------------------------
    def _send(self, code: int, body: bytes, ctype: str, extra: dict[str, str] | None = None) -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _json(self, obj: Any, code: int = 200, extra: dict[str, str] | None = None) -> None:
        self._send(code, json.dumps(obj).encode(), "application/json", extra)

    # -- routes ----------------------------------------------------------------------------
    def do_GET(self) -> None:
        path = self.path.split("?")[0]
        if path == "/api/state":
            return self._json(RUNNER.status(), extra=CORS)
        if path == "/api/events":
            return self._sse()
        if path.startswith("/pages/"):
            return self._file(STATE / "pages" / path[len("/pages/"):])
        if path in ("/", "/index.html"):
            return self._file(SITE / "index.html")
        if path in ("/watch", "/pit", "/telemetry"):        # the hosted site rewrites these; so do we
            return self._file(SITE / (path.lstrip("/") + ".html"))
        return self._file(SITE / path.lstrip("/"))

    def do_OPTIONS(self) -> None:
        # a browser asks before reading a local server from a public page (private network access)
        if self.path.split("?")[0] not in READ_ONLY:
            return self._json({"error": "not found"}, 404)
        self.send_response(204)
        for k, v in {**CORS, "Access-Control-Allow-Methods": "GET", "Access-Control-Allow-Headers": "*",
                     "Access-Control-Allow-Private-Network": "true", "Access-Control-Max-Age": "600"}.items():
            self.send_header(k, v)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self) -> None:
        origin = self.headers.get("Origin")
        if origin and origin not in self._own_origins():
            return self._json({"error": "a run may only be started from this server's own page"}, 403)
        if self.path.split("?")[0] == "/api/run":
            return self._json(RUNNER.start())
        self._json({"error": "not found"}, 404)

    def _own_origins(self) -> set[str]:
        host = self.headers.get("Host") or ""
        port = host.rpartition(":")[2] if ":" in host else "80"
        return {f"http://{h}:{port}" for h in ("127.0.0.1", "localhost", "[::1]")} | {f"http://{host}"}

    def _file(self, p: Path) -> None:
        try:
            p = p.resolve()
            roots = [SITE.resolve(), (STATE / "pages").resolve()]
            if not any(str(p).startswith(str(r)) for r in roots) or not p.is_file():
                return self._json({"error": "not found"}, 404)
            ctype = mimetypes.guess_type(str(p))[0] or "application/octet-stream"
            self._send(200, p.read_bytes(), ctype)
        except Exception:
            self._json({"error": "not found"}, 404)

    def _sse(self) -> None:
        q = events.subscribe()
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "keep-alive")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        try:
            for ev in events.history():                     # catch a late tab up
                self._frame(ev)
            while True:
                try:
                    self._frame(q.get(timeout=15))
                except Exception as exc:
                    if isinstance(exc, (BrokenPipeError, ConnectionResetError)):
                        raise
                    self.wfile.write(b": keep-alive\n\n")   # nothing happened; hold the line open
                    self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            events.unsubscribe(q)

    def _frame(self, ev: dict[str, Any]) -> None:
        self.wfile.write(f"data: {json.dumps(ev)}\n\n".encode())
        self.wfile.flush()


def serve(port: int = 7777, open_browser: bool = True) -> None:
    if not (SITE / "index.html").exists():
        raise SystemExit(f"the page has not been built yet — run `node build.js` first ({SITE})")
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = f"http://127.0.0.1:{port}/"
    print(f"\n  Scrutineer is running at {url}")
    print(f"  The pit board — the car on a card that stays on top — is at {url}pit")
    print(f"  The telemetry — the season as 3D charts — is at {url}telemetry")
    print(f"  The broadcast, where you press RUN THE AGENT, is at {url}watch. Your key stays on this machine.\n")
    if open_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n  stopped\n")
    finally:
        srv.server_close()
