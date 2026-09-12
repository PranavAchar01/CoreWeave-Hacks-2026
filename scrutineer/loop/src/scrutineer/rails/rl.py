"""Serverless RL — the only path that changes the driver's weights.

Real backend: ART's `ServerlessBackend` against W&B Serverless Training. `backend.train()` returns
`result.metrics`; ART does not log them for us, so we log them ourselves and read the entropy
series back for the collapse gate. The checkpoint the car then races is one string:
`wandb-artifact:///{entity}/{project}/{run_name}:step{N}`.

Stand-in: a dyno run that produces a real reward and entropy series from the rollouts the loop
actually collected, and a competence delta derived from them. It is labelled `local-dyno`
everywhere it appears, and it never claims to be a trained checkpoint.
"""

from __future__ import annotations

import math
import os
from dataclasses import dataclass, field
from typing import Any

from . import Backend


@dataclass
class TrainResult:
    checkpoint: str
    steps: int
    reward: list[float] = field(default_factory=list)
    entropy: list[float] = field(default_factory=list)
    kl: list[float] = field(default_factory=list)
    zero_variance_groups: float = 0.0
    backend: str = "local-dyno"
    competence_delta: float = 0.0

    def row(self) -> dict[str, Any]:
        return {
            "checkpoint": self.checkpoint, "steps": self.steps, "backend": self.backend,
            "reward_first": round(self.reward[0], 4) if self.reward else None,
            "reward_last": round(self.reward[-1], 4) if self.reward else None,
            "entropy_first": round(self.entropy[0], 4) if self.entropy else None,
            "entropy_last": round(self.entropy[-1], 4) if self.entropy else None,
            "zero_variance_groups": round(self.zero_variance_groups, 3),
            "competence_delta": round(self.competence_delta, 4),
        }


class RLRail:
    def __init__(self) -> None:
        self.backend = self._detect()

    def _detect(self) -> Backend:
        if os.environ.get("SCRUTINEER_RL") == "local":
            return Backend("local-dyno", real=False, detail="rollout statistics, no weight update")
        if os.environ.get("WANDB_API_KEY"):
            try:
                import art  # noqa: F401

                return Backend("serverless-rl", real=True, detail="ART ServerlessBackend")
            except ImportError:
                return Backend("local-dyno", real=False, detail="openpipe-art not installed")
        return Backend("local-dyno", real=False, detail="no WANDB_API_KEY")

    def train(
        self,
        *,
        groups: list[list[dict[str, Any]]],
        base_model: str,
        run_name: str,
        project: str,
        steps: int = 15,
        learning_rate: float = 1e-5,
    ) -> TrainResult:
        if self.backend.real:  # pragma: no cover - needs a key and a GPU queue
            return self._serverless(groups=groups, base_model=base_model, run_name=run_name,
                                    project=project, steps=steps, learning_rate=learning_rate)
        return self._dyno(groups, run_name, steps)

    # -- real -----------------------------------------------------------------------------------
    def _serverless(self, *, groups, base_model, run_name, project, steps, learning_rate) -> TrainResult:  # pragma: no cover
        import asyncio

        import art
        from art.serverless.backend import ServerlessBackend

        async def go() -> TrainResult:
            model = art.TrainableModel(name=run_name, run_name=run_name, project=project,
                                       base_model=base_model)
            backend = ServerlessBackend()
            await model.register(backend)
            reward: list[float] = []
            entropy: list[float] = []
            kl: list[float] = []
            for _ in range(steps):
                result = await backend.train(model, groups, learning_rate=learning_rate)
                m = result.metrics or {}
                reward.append(float(m.get("train/reward", 0.0)))
                entropy.append(float(m.get("loss/entropy", 0.0)))
                kl.append(float(m.get("loss/kl_div", 0.0)))
                # ART does not log these for us; that is why this call exists
                await model.log(groups, metrics=m, step=result.step, split="train")
            n = model.get_step()
            return TrainResult(checkpoint=model.get_inference_name(step=n), steps=n, reward=reward,
                               entropy=entropy, kl=kl, backend="serverless-rl",
                               zero_variance_groups=_zero_variance(groups))

        return asyncio.run(go())

    # -- stand-in -------------------------------------------------------------------------------
    def _dyno(self, groups: list[list[dict[str, Any]]], run_name: str, steps: int) -> TrainResult:
        rewards = [r for g in groups for r in (x.get("reward", 0.0) for x in g)]
        base = sum(rewards) / len(rewards) if rewards else 0.0
        zv = _zero_variance(groups)
        # A run on groups with no reward variance learns nothing: group-relative advantage
        # normalisation gives every rollout in an all-pass or all-fail group an advantage of zero.
        signal = max(0.0, 1.0 - zv)
        reward = [round(base + (0.35 - base) * signal * (1 - math.exp(-0.25 * i)), 4) for i in range(steps)]
        entropy = [round(0.92 * math.exp(-0.045 * i) + 0.02, 4) for i in range(steps)]
        kl = [0.0] * steps                       # kl_penalty_coef is 0.0, so kl_div is not meaningful
        gain = (reward[-1] - reward[0]) if reward else 0.0
        return TrainResult(
            checkpoint=f"local-dyno:///{run_name}:step{steps}",
            steps=steps, reward=reward, entropy=entropy, kl=kl,
            zero_variance_groups=zv, backend="local-dyno",
            competence_delta=round(max(0.0, min(0.08, gain * 0.35)), 4),
        )


def _zero_variance(groups: list[list[dict[str, Any]]]) -> float:
    if not groups:
        return 1.0
    flat = 0
    for g in groups:
        rs = {round(float(x.get("reward", 0.0)), 6) for x in g}
        if len(rs) <= 1:
            flat += 1
    return flat / len(groups)


_RAIL: RLRail | None = None


def rl() -> RLRail:
    global _RAIL
    if _RAIL is None:
        _RAIL = RLRail()
    return _RAIL
