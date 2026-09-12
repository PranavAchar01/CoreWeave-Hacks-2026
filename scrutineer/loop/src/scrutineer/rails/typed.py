"""TypedDecision — the pit wall's decision endpoint.

Three backends behind one call, and the panel names whichever ran:
  A  TypeSafe System1                     (needs TYPESAFE_API_KEY; response shape captured at kickoff)
  B  strict `json_schema` on a chat model (gpt-oss-20b on W&B Inference, or any keyed backend)
  C  a deterministic local policy         (labelled UNCALIBRATED, and it is)

The loop never claims a backend is calibrated. It measures calibration — Brier score and a
reliability diagram over whatever backend served — and prints the backend's name beside the curve.
"""

from __future__ import annotations

import json
import os
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from . import Backend
from .inference import inference


@dataclass
class TypedResult:
    value: dict[str, Any]
    backend: str
    calibrated_claim: bool          # whether the vendor claims calibration, never whether we do
    cost_usd: float = 0.0
    tokens: int = 0


class TypedRail:
    def __init__(self) -> None:
        self.backend = self._detect()
        self.answered = 0        # decisions the typed backend actually returned
        self.fell_back = 0       # decisions that came from the local policy instead
        self.spend_usd = 0.0

    def meter(self) -> dict[str, Any]:
        total = self.answered + self.fell_back
        return {"backend": str(self.backend), "answered": self.answered, "fell_back": self.fell_back,
                "answered_share": round(self.answered / total, 3) if total else 0.0,
                "spend_usd": round(self.spend_usd, 4)}

    def _detect(self) -> Backend:
        if os.environ.get("SCRUTINEER_TYPED") == "local":
            return Backend("local-policy", real=False, detail="deterministic, UNCALIBRATED")
        if os.environ.get("TYPESAFE_API_KEY"):
            return Backend("typesafe-system1", real=True, detail="typed decision endpoint")
        inf = inference()
        if inf.backend.real:
            return Backend("strict-json-schema", real=True,
                           detail=f"{inf.backend.name}/"
                                  f"{os.environ.get('SCRUTINEER_TYPED_MODEL', 'granite-4.1-8b')}")
        return Backend("local-policy", real=False, detail="deterministic, UNCALIBRATED")

    def decide(
        self,
        *,
        schema: dict,
        system: str,
        user: str,
        fallback: Callable[[], dict[str, Any]],
        model: str = "ibm-granite/granite-4.1-8b",
        max_tokens: int = 1200,
        nonce: str = "",
    ) -> TypedResult:
        name = self.backend.name
        if name == "typesafe-system1":  # pragma: no cover - needs a key and a captured shape
            try:
                r = self._system1(schema, system, user)
                self.answered += 1
                self.spend_usd += r.cost_usd
                return r
            except Exception:
                pass
        if name == "strict-json-schema":  # pragma: no cover - network path
            try:
                # gpt-oss emits reasoning tokens before the schema-constrained answer, so a tight
                # max_tokens truncates the response to nothing at all. Budget for both.
                c = inference().complete(
                    system=system, user=user, model=model, temperature=0.0, max_tokens=max_tokens,
                    json_schema={"name": schema.get("title", "decision"), "strict": True,
                                 "schema": schema},
                    nonce=nonce,
                )
                value = json.loads(c.text)
                self.answered += 1
                self.spend_usd += c.cost_usd
                return TypedResult(value, "strict-json-schema", False, c.cost_usd,
                                   c.prompt_tokens + c.completion_tokens)
            except Exception:
                pass
        self.fell_back += 1
        return TypedResult(fallback(), "local-policy", False, 0.0, 0)

    def _system1(self, schema: dict, system: str, user: str) -> TypedResult:  # pragma: no cover
        import urllib.request

        req = urllib.request.Request(
            os.environ.get("TYPESAFE_BASE_URL", "https://api.typesafe.ai/v1/decide"),
            data=json.dumps({"schema": schema, "system": system, "input": user}).encode(),
            headers={
                "Authorization": f"Bearer {os.environ['TYPESAFE_API_KEY']}",
                "Content-Type": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=20) as r:
            body = json.loads(r.read())
        # The response envelope is not publicly documented; accept the two shapes seen in the wild
        # and record which one answered so the kickoff capture can pin it.
        value = body.get("decision") or body.get("output") or body
        return TypedResult(value, "typesafe-system1", True, float(body.get("cost_usd", 0.0)), 0)


_RAIL: TypedRail | None = None


def typed() -> TypedRail:
    global _RAIL
    if _RAIL is None:
        _RAIL = TypedRail()
    return _RAIL
