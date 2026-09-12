"""The driver's engine: chat completion behind one interface.

Backends in preference order — W&B Inference (OpenAI-compatible, and the only one that can serve
a LoRA checkpoint by `wandb-artifact:///` string), Anthropic, OpenAI, then `local-sim`.

`local-sim` is not a mock of the *loop*; it is a stand-in for the *cognition*. It writes a real
Python solution whose correctness depends causally on the same things a real driver's would:
whether AERO put the needed reference in the context, how many samples TYRES allowed, whether
DATA's tool schema parsed, whether STRATEGIST boxed too early, and how good the driver itself is.
That is what makes counterfactual replay meaningful offline — flipping one role's artifact flips
exactly the laps that role caused. Every lap it serves is stamped `driver_backend: local-sim`.
"""

from __future__ import annotations

import hashlib
import inspect
import json
import os
import random
from dataclasses import dataclass
from typing import Any

from . import Backend

WANDB_BASE = "https://api.inference.wandb.ai/v1"
DEFAULT_DRIVER = "OpenPipe/Qwen3-14B-Instruct"

# $/1M tokens, from the published W&B Inference price list; used for the cost meter.
PRICES: dict[str, tuple[float, float]] = {
    "OpenPipe/Qwen3-14B-Instruct": (0.05, 0.22),
    "openai/gpt-oss-20b": (0.03, 0.13),
    "openai/gpt-oss-120b": (0.15, 0.60),
    "claude-haiku-4-5-20251001": (1.00, 5.00),
    "claude-sonnet-5": (3.00, 15.00),
    "local-sim": (0.0, 0.0),
}


class EmptyCompletion(RuntimeError):
    """The model answered with no content — usually a reasoning model out of token budget."""


def entity_project() -> str:
    """`entity/project` for the W&B Inference client. Derived from the key when not set."""
    ep = os.environ.get("WANDB_ENTITY_PROJECT")
    if ep:
        return ep
    ent = os.environ.get("WANDB_ENTITY")
    proj = os.environ.get("WANDB_PROJECT", "scrutineer")
    if not ent:
        try:
            import wandb

            ent = wandb.Api().default_entity
        except Exception:
            ent = None
    return f"{ent}/{proj}" if ent else proj


@dataclass
class Completion:
    text: str
    prompt_tokens: int
    completion_tokens: int
    model: str
    backend: str

    @property
    def cost_usd(self) -> float:
        pin, pout = PRICES.get(self.model, PRICES["OpenPipe/Qwen3-14B-Instruct"])
        return self.prompt_tokens / 1e6 * pin + self.completion_tokens / 1e6 * pout


class InferenceRail:
    def __init__(self) -> None:
        self.backend = self._detect()
        self._client: Any = None
        # Replays re-issue the identical request many times; the cache key is the whole request,
        # so a replay with a *corrected* context is a miss and genuinely re-queries the model.
        self._cache: dict[str, Completion] = {}
        self.cache_hits = 0
        self.calls = 0
        self.tokens_in = 0
        self.tokens_out = 0
        self.spend_usd = 0.0

    def _detect(self) -> Backend:
        forced = os.environ.get("SCRUTINEER_INFERENCE")
        if forced == "local":
            return Backend("local-sim", real=False, detail="deterministic stand-in driver")
        # The inference quota and the rest of the W&B account are separate things: when serving
        # runs out, Weave, the Registry and the Models runs all still work, so the driver has to
        # be selectable without giving up the key.
        if forced == "anthropic" and os.environ.get("ANTHROPIC_API_KEY"):
            try:
                import anthropic  # noqa: F401

                return Backend("anthropic", real=True, detail="messages API")
            except ImportError:
                pass
        if forced != "anthropic" and os.environ.get("WANDB_API_KEY"):
            try:
                import openai  # noqa: F401

                return Backend("wandb-inference", real=True, detail=WANDB_BASE)
            except ImportError:
                pass
        if os.environ.get("ANTHROPIC_API_KEY"):
            try:
                import anthropic  # noqa: F401

                return Backend("anthropic", real=True, detail="messages API")
            except ImportError:
                pass
        if os.environ.get("OPENAI_API_KEY"):
            try:
                import openai  # noqa: F401

                return Backend("openai", real=True, detail="chat completions")
            except ImportError:
                pass
        return Backend("local-sim", real=False, detail="no inference key present")

    # -- real backends ------------------------------------------------------------------------
    def _openai_client(self, base_url: str | None = None) -> Any:  # pragma: no cover - network
        import openai

        if self._client is None:
            if base_url:
                self._client = openai.OpenAI(
                    base_url=base_url,
                    api_key=os.environ["WANDB_API_KEY"],
                    project=entity_project(),
                    max_retries=4,
                    timeout=120.0,
                )
            else:
                self._client = openai.OpenAI()
        return self._client

    def complete(
        self,
        *,
        system: str,
        user: str,
        model: str | None = None,
        temperature: float = 0.2,
        max_tokens: int = 900,
        json_schema: dict | None = None,
        nonce: str = "",
        seed: int | None = None,
        cache: bool = True,
    ) -> Completion:  # pragma: no cover - network paths exercised only with keys
        key = ""
        if cache:
            key = hashlib.sha256(
                "|".join([self.backend.name, str(model), system, user, f"{temperature:.3f}",
                          str(max_tokens), json.dumps(json_schema, sort_keys=True), nonce,
                          str(seed)]).encode()
            ).hexdigest()
            hit = self._cache.get(key)
            if hit is not None:
                self.cache_hits += 1
                return hit
        c = self._complete(system=system, user=user, model=model, temperature=temperature,
                           max_tokens=max_tokens, json_schema=json_schema, seed=seed)
        self.calls += 1
        self.tokens_in += c.prompt_tokens
        self.tokens_out += c.completion_tokens
        self.spend_usd += c.cost_usd
        if key:
            self._cache[key] = c
        return c

    def resolve_model(self, requested: str | None) -> str | None:
        """A model name the current backend can actually serve.

        The MODEL component records a base model and, once trained, a checkpoint — both W&B
        artifacts. Handing either to a different provider is a 404, so a name this backend cannot
        serve falls back to its own default rather than failing the run.
        """
        if not requested:
            return None
        name = self.backend.name
        if name == "wandb-inference":
            return requested
        if name == "anthropic":
            return requested if requested.startswith("claude") else None
        if name == "openai":
            return requested if requested.startswith(("gpt", "o1", "o3")) else None
        return requested

    def meter(self) -> dict[str, Any]:
        return {"calls": self.calls, "cache_hits": self.cache_hits, "tokens_in": self.tokens_in,
                "tokens_out": self.tokens_out, "spend_usd": round(self.spend_usd, 4)}

    def _complete(self, *, system, user, model, temperature, max_tokens, json_schema,
                  seed: int | None = None) -> Completion:
        name = self.backend.name
        model = model or (DEFAULT_DRIVER if name == "wandb-inference"
                          else os.environ.get("SCRUTINEER_DRIVER_MODEL", "claude-haiku-4-5-20251001"))
        if name == "wandb-inference":
            c = self._openai_client(WANDB_BASE)
            kw: dict[str, Any] = {}
            if json_schema:
                kw["response_format"] = {"type": "json_schema", "json_schema": json_schema}
            if seed is not None:
                kw["seed"] = seed
            r = c.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                temperature=temperature,
                max_tokens=max_tokens,
                **kw,
            )
            u = r.usage
            text = r.choices[0].message.content
            if not text:
                # a reasoning model that ran out of budget before it emitted content; say so
                # rather than returning an empty completion that reads as a refusal
                raise EmptyCompletion(
                    f"{model} returned no content (finish_reason="
                    f"{r.choices[0].finish_reason!r}, completion_tokens={u.completion_tokens})")
            return Completion(text, u.prompt_tokens, u.completion_tokens, model, name)
        if name == "anthropic":
            import anthropic

            c = anthropic.Anthropic()
            kw: dict[str, Any] = {}
            # Not every version of this SDK exposes temperature on messages.create; passing it
            # blindly raised TypeError on every call. Sampling variety comes from the API's own
            # non-determinism when it is unavailable.
            if "temperature" in inspect.signature(c.messages.create).parameters:
                kw["temperature"] = temperature
            r = c.messages.create(
                model=model, system=system, max_tokens=max_tokens,
                messages=[{"role": "user", "content": user}], **kw,
            )
            text = "".join(b.text for b in r.content if getattr(b, "type", "") == "text")
            return Completion(text, r.usage.input_tokens, r.usage.output_tokens, model, name)
        if name == "openai":
            c = self._openai_client()
            r = c.chat.completions.create(
                model=model, temperature=temperature, max_tokens=max_tokens,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            )
            u = r.usage
            return Completion(r.choices[0].message.content or "", u.prompt_tokens, u.completion_tokens,
                              model, name)
        raise RuntimeError("complete() called on the local-sim backend; use SimDriver instead")


_RAIL: InferenceRail | None = None


def inference() -> InferenceRail:
    global _RAIL
    if _RAIL is None:
        _RAIL = InferenceRail()
    return _RAIL


# ------------------------------------------------------------------------------------------------
# local-sim: a driver whose competence is causally wired to the team's artifacts
# ------------------------------------------------------------------------------------------------

@dataclass
class SimOutcome:
    source: str
    correct: bool
    corruption: str | None
    prompt_tokens: int
    completion_tokens: int


def _rng(*parts: Any) -> random.Random:
    return random.Random(int(hashlib.sha256("|".join(str(p) for p in parts).encode()).hexdigest()[:12], 16))


def sim_drive(
    *,
    item_id: str,
    reference_solution: str,
    broken_variants: tuple,
    concepts_covered: bool,
    competence: float,
    samples: int,
    temperature: float,
    schema_ok: bool,
    context_tokens: int,
    seed: int,
    attempt: int = 0,
) -> SimOutcome:
    """Deterministic given its inputs — which is exactly the property replay needs."""
    # A driver that has misread a problem tends to keep misreading it. Attempts inside one lap
    # therefore share a latent "understanding" draw; without it, retrying k times would be a free
    # win and neither TYRES nor STRATEGIST would have anything to decide.
    lat = _rng("understanding", item_id, seed, round(competence, 4)).random()
    grasp = 0.30 + 0.62 * competence
    understood = lat < grasp

    # A lap the driver has not grasped is not rescued by retrying. That is the whole reason the
    # POWER UNIT is a separate node from the roles that shape one attempt: weights move the
    # ceiling, everything else moves how close to it the car gets.
    p = competence if understood else 0.0
    if not concepts_covered:
        p *= 0.30                       # the reference AERO failed to retrieve was load-bearing
    if not schema_ok:
        p *= 0.45                       # DATA's tool schema did not parse; the driver flew blind
    p *= max(0.55, 1.0 - 0.55 * abs(temperature - 0.25))  # TYRES: heat costs precision
    p = min(0.985, max(0.01, p))
    p_eff = 1.0 - (1.0 - p) ** max(1, samples)

    rng = _rng(item_id, seed, attempt, round(competence, 4), concepts_covered, schema_ok, samples,
               round(temperature, 3))
    correct = rng.random() < p_eff
    if correct or not broken_variants:
        src, corruption = reference_solution, None
        correct = True if not broken_variants else correct
    else:
        corruption, src = broken_variants[rng.randrange(len(broken_variants))]
    return SimOutcome(
        source=src,
        correct=correct,
        corruption=corruption,
        # a real prompt carries the spec, the references and the tool schemas; a real completion
        # carries reasoning as well as code, so neither is the length of the source alone
        prompt_tokens=context_tokens + 640,
        completion_tokens=max(180, len(src) // 3 + 160),
    )
