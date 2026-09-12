"""FIA TELEMETRY — the append-only call store the improver cannot write.

Every role call is a span with the attributes LOOP.md requires (`role`, `generation`, `lap`,
`theta_hash`) and its full inputs and outputs, because dropping inputs is what costs step
accuracy. Credit lives on these calls as feedback rows; the rows are hash-chained so a later
edit is detectable, which is the local stand-in for "the improver holds no key to this plane".
"""

from __future__ import annotations

import hashlib
import json
import os
import threading
import time
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from .rails.weave_rail import weave_rail

STATE = Path(os.environ.get("SCRUTINEER_STATE_DIR")
             or (Path(__file__).resolve().parents[2] / "state"))
FEEDBACK_MAX_BYTES = 1024  # documented Weave feedback cap; full records go in published objects


@dataclass
class Call:
    id: str
    trace_id: str
    parent_id: str | None
    op: str
    role: str
    attributes: dict[str, Any]
    inputs: dict[str, Any]
    output: Any = None
    exception: str | None = None
    started: float = 0.0
    ended: float = 0.0
    feedback: list[dict[str, Any]] = field(default_factory=list)
    weave_id: str | None = None

    @property
    def wall_s(self) -> float:
        return max(0.0, self.ended - self.started)


class Tracer:
    """One tracer per process. `race_id` groups a race; `trace_id` groups one lap."""

    def __init__(self, generation: int = 0, run_dir: Path | None = None) -> None:
        self.generation = generation
        self.calls: list[Call] = []
        self._by_id: dict[str, Call] = {}
        # Laps run concurrently, so the span stack and the current trace id belong to the thread
        # driving that lap; the shared structures are guarded by one lock.
        self._tl = threading.local()
        self._lock = threading.Lock()
        self.dir = run_dir or STATE / "traces"
        self.dir.mkdir(parents=True, exist_ok=True)
        self._chain = "0" * 64
        self.weave = weave_rail()
        self.conversations: list[dict[str, Any]] = []

    # -- spans --------------------------------------------------------------------------------
    @property
    def _stack(self) -> list[str]:
        if not hasattr(self._tl, "stack"):
            self._tl.stack = []
        return self._tl.stack

    @contextmanager
    def lap(self, lap_index: int, item_id: str, race_id: str) -> Iterator[str]:
        trace_id = f"{race_id}:{lap_index:03d}"
        self._tl.trace_id = trace_id
        # one conversation per lap for the Agents view; roles are the agents inside it
        with self._lock:
            self.conversations.append(
                {"conversation_id": trace_id, "race_id": race_id, "lap": lap_index, "item": item_id}
            )
        try:
            yield trace_id
        finally:
            self._tl.trace_id = None
            self._stack.clear()

    @contextmanager
    def op(self, op: str, role: str, inputs: dict[str, Any], theta_hash: str, lap: int) -> Iterator[Call]:
        call = Call(
            id=uuid.uuid4().hex,
            trace_id=getattr(self._tl, "trace_id", None) or "detached",
            parent_id=self._stack[-1] if self._stack else None,
            op=op,
            role=role,
            attributes={"role": role, "generation": self.generation, "lap": lap, "theta_hash": theta_hash},
            inputs=_trim(inputs),
            started=time.time(),
        )
        with self._lock:
            self.calls.append(call)
            self._by_id[call.id] = call
        self._stack.append(call.id)
        try:
            yield call
        except Exception as e:
            call.exception = f"{type(e).__name__}: {e}"
            raise
        finally:
            call.ended = time.time()
            self._stack.pop()
            call.weave_id = self.weave.log_call(
                {"op": op, "inputs": call.inputs, "output": call.output, "attributes": call.attributes}
            )

    # -- feedback (the credit ledger) ---------------------------------------------------------
    def add_feedback(self, call_id: str, key: str, payload: dict[str, Any]) -> dict[str, Any]:
        blob = json.dumps(payload, default=str)
        if len(blob.encode()) > FEEDBACK_MAX_BYTES:
            raise ValueError(
                f"feedback row {key} is {len(blob)} bytes; publish the full record as an object "
                "and reference it by ref instead"
            )
        row = {"key": key, "payload": payload, "ts": time.time()}
        with self._lock:
            call = self._by_id[call_id]
            call.feedback.append(row)
            self._chain = hashlib.sha256((self._chain + blob).encode()).hexdigest()
        if call.weave_id:
            self.weave.add_feedback(call.weave_id, key, payload)
        return row

    def feedback_rows(self, key: str) -> list[tuple[Call, dict[str, Any]]]:
        return [(c, f["payload"]) for c in self.calls for f in c.feedback if f["key"] == key]

    def calls_for(self, trace_id: str) -> list[Call]:
        return [c for c in self.calls if c.trace_id == trace_id]

    def role_call(self, trace_id: str, role: str, step: int | None = None) -> Call | None:
        cs = [c for c in self.calls_for(trace_id) if c.role == role]
        if step is not None:
            cs = [c for c in cs if c.inputs.get("step") == step]
        return cs[0] if cs else None

    # -- persistence --------------------------------------------------------------------------
    def flush(self, name: str) -> Path:
        p = self.dir / f"{name}.jsonl"
        with p.open("a") as fh:
            for c in self.calls:
                fh.write(json.dumps(asdict(c), default=str) + "\n")
        return p

    @property
    def ledger_hash(self) -> str:
        return self._chain

    def stats(self) -> dict[str, Any]:
        errs = sum(1 for c in self.calls if c.exception)
        return {
            "calls": len(self.calls),
            "laps": len(self.conversations),
            "tool_errors": errs,
            "weave": str(self.weave.backend),
            "ledger_hash": self._chain[:12],
        }


def _trim(d: dict[str, Any], limit: int = 4000) -> dict[str, Any]:
    """Keep inputs, but bound the very large ones. Never drop a key: TraceElephant's finding is
    that missing inputs, not long ones, are what break attribution."""
    out = {}
    for k, v in d.items():
        s = v if isinstance(v, (int, float, bool, type(None))) else str(v)
        if isinstance(s, str) and len(s) > limit:
            s = s[:limit] + f"...<{len(s) - limit} more chars>"
        out[k] = s
    return out


def publish_object(name: str, obj: dict[str, Any], tags: list[str] | None = None) -> str:
    """Publish a Weave object (standings, selection, official, replay records). Locally this is a
    content-addressed file; the returned string is the ref the ledger stores."""
    d = STATE / "objects"
    d.mkdir(parents=True, exist_ok=True)
    blob = json.dumps(obj, indent=2, default=str, sort_keys=True)
    digest = hashlib.sha256(blob.encode()).hexdigest()[:16]
    (d / f"{name}.json").write_text(blob)
    weave_rail().publish(name, obj, tags)
    return f"scrutineer:///{name}@{digest}"


def load_object(name: str) -> dict[str, Any] | None:
    p = STATE / "objects" / f"{name}.json"
    return json.loads(p.read_text()) if p.exists() else None


def state_dir() -> Path:
    STATE.mkdir(parents=True, exist_ok=True)
    return STATE


def env_flag(name: str, default: bool = False) -> bool:
    v = os.environ.get(name)
    return default if v is None else v.lower() in ("1", "true", "yes", "on")
