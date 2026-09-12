"""A pub/sub for watching the loop work.

The loop does not know a browser exists. It emits small facts as they happen — an interface was
audited, a component was blamed, a gate passed — and anything that cares can subscribe. When
nobody is listening this costs a dictionary and a queue append.
"""

from __future__ import annotations

import contextlib
import queue
import threading
import time
from typing import Any

_subs: list[queue.Queue] = []
_lock = threading.Lock()
_seq = 0
_history: list[dict[str, Any]] = []
HISTORY_MAX = 4000


def subscribe() -> queue.Queue:
    q: queue.Queue = queue.Queue(maxsize=2000)
    with _lock:
        _subs.append(q)
    return q


def unsubscribe(q: queue.Queue) -> None:
    with _lock:
        if q in _subs:
            _subs.remove(q)


def emit(kind: str, **payload: Any) -> None:
    global _seq
    with _lock:
        _seq += 1
        ev = {"seq": _seq, "t": round(time.time(), 3), "kind": kind, **payload}
        _history.append(ev)
        if len(_history) > HISTORY_MAX:
            del _history[: len(_history) - HISTORY_MAX]
        subs = list(_subs)
    for q in subs:
        # a listener that cannot keep up misses frames; the loop is never blocked by a slow tab
        with contextlib.suppress(queue.Full):
            q.put_nowait(ev)


def history(after: int = 0) -> list[dict[str, Any]]:
    with _lock:
        return [e for e in _history if e["seq"] > after]


def reset() -> None:
    global _seq
    with _lock:
        _history.clear()
        _seq = 0
