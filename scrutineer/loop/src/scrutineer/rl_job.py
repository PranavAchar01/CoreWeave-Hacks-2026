"""One real training run for the POWER UNIT.

Every other component is improved by editing a file. This one is improved by changing the model's
weights, and it is the only claim in the design that cannot be made true by writing code — a job
has to actually run. A rollout is one lap: the context the harness assembled, the code the model
wrote, and a reward of 1 or 0 decided by executing the hidden tests. Nothing is judged by another
model.
"""

from __future__ import annotations

import asyncio
import contextlib
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from .car.roles import shape_context
from .circuits import Item
from .evaluator import verify
from .regs import Regs
from .theta import Theta

SYSTEM = "You are a Formula 1 driver writing one Python function. Output only code."


async def _rollout(model, sem, item: Item, ctx_text: str, i: int, loop_exec) -> Any:
    """One rollout, collected through ART's own client.

    This has to go through `model.openai_client()` rather than our usual inference rail: a
    trajectory needs the model's own choice, with its logprobs, or there is nothing to compute an
    importance ratio against and the training step processes zero batches — which is exactly what
    happened the first time this ran with hand-built messages.
    """
    import art

    client = model.openai_client()
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": ctx_text}]
    async with sem:
        r = await client.chat.completions.create(
            model=model.get_inference_name(), messages=messages,
            temperature=0.7, max_tokens=900, logprobs=True)
    choice = r.choices[0]
    code = _extract(choice.message.content or "")
    passed = await loop_exec(item, code)
    return art.Trajectory(messages_and_choices=[*messages, choice],
                          reward=1.0 if passed else 0.0,
                          metrics={"passed": 1.0 if passed else 0.0})


def _extract(text: str) -> str:
    import re

    m = re.search(r"```(?:python)?\n(.*?)```", text, re.S)
    return (m.group(1) if m else text).strip()


async def _run(*, theta: Theta, items: list[Item], steps: int, k: int, learning_rate: float,
               run_name: str, project: str, entity: str | None, concurrency: int) -> dict[str, Any]:
    import asyncio as aio

    import art
    from art.serverless.backend import ServerlessBackend

    base = theta.power_unit.get("base_model", "OpenPipe/Qwen3-14B-Instruct")
    model = art.TrainableModel(name=run_name, project=project, entity=entity, base_model=base)
    backend = ServerlessBackend()
    await model.register(backend)

    contexts = {it.id: shape_context(theta, it).text for it in items}
    sem = aio.Semaphore(concurrency)
    pool = ThreadPoolExecutor(max_workers=8)

    async def check(item: Item, code: str) -> bool:
        return await aio.get_running_loop().run_in_executor(pool, verify, item, code)

    reward: list[float] = []
    entropy: list[float] = []
    per_step: list[dict[str, Any]] = []
    step = await model.get_step()

    for s_i in range(steps):
        jobs = [_rollout(model, sem, it, contexts[it.id], j, check)
                for it in items for j in range(k)]
        done = await aio.gather(*jobs, return_exceptions=True)
        by_item: dict[str, list[Any]] = {}
        ok = 0
        errors: dict[str, int] = {}
        for it, t in zip([it for it in items for _ in range(k)], done, strict=True):
            if isinstance(t, BaseException):
                # A rollout that never reached the model is not a task the model failed. Counting
                # the two together reported "reward 0.0" for a run where nothing was ever asked.
                errors[type(t).__name__] = errors.get(type(t).__name__, 0) + 1
                continue
            by_item.setdefault(it.id, []).append(t)
            ok += int(t.reward > 0)
        if errors and not by_item:
            per_step.append({"step": s_i, "trained": False, "rollout_errors": errors,
                             "why": "every rollout failed to reach the model; nothing was scored"})
            break
        groups = [art.TrajectoryGroup(g) for g in by_item.values() if len(g) > 1]
        live = sum(len(g) for g in by_item.values())
        flat = sum(1 for g in by_item.values() if len({t.reward for t in g}) <= 1)
        zv = flat / len(by_item) if by_item else 1.0
        rate = ok / live if live else 0.0
        reward.append(round(rate, 4))
        if not groups or zv >= 0.95:
            per_step.append({"step": s_i, "reward_rate": rate, "zero_variance_groups": zv,
                             "rollouts": live, "rollout_errors": errors or None, "trained": False,
                             "why": "every group had the same reward; the gradient would be zero"})
            break
        result = await backend.train(model, groups, learning_rate=learning_rate)
        step = await model.get_step()
        art_name = getattr(result, "artifact_name", None)
        with contextlib.suppress(Exception):
            await model.log(groups, split="train")
        per_step.append({"step": step, "reward_rate": round(rate, 4),
                         "zero_variance_groups": round(zv, 3), "groups": len(groups),
                         "rollouts": live, "rollout_errors": errors or None,
                         "trained": True, "artifact": art_name})
        entropy.append(0.0)

    try:
        checkpoint = model.get_inference_name(step=step)
    except Exception:
        checkpoint = f"wandb-artifact:///{entity}/{project}/{run_name}:step{step}"
    trained = [p for p in per_step if p.get("trained")]
    return {
        "checkpoint": checkpoint,
        "steps_trained": len(trained),
        "final_step": step,
        "reward": reward,
        "reward_first": reward[0] if reward else None,
        "reward_last": reward[-1] if reward else None,
        "per_step": per_step,
        "base_model": base,
        "note": ("metrics are not returned by ServerlessTrainResult, which carries only "
                 "artifact_name; reward here is the measured pass rate of the rollouts the step "
                 "trained on, not a value reported by the trainer"),
    }


def band(*, theta: Theta, pool: list[Item], regs: Regs, seed: int, k: int = 4,
         lo: float = 0.2, hi: float = 0.8, limit: int = 14) -> list[Item]:
    """Tasks the car solves sometimes and not always.

    A group where every rollout earns the same reward has an advantage of zero for every member,
    so it contributes nothing to the gradient. This is why the curriculum component exists, and
    why a training job cannot just be pointed at whatever tasks are lying around: the first
    attempt here collected 100 % zero-variance groups and correctly refused to train.
    """
    from .simulator import measure_rates

    rates = measure_rates(theta=theta, items=pool, regs=regs, seed=seed, k=k)
    inband = [i for i in pool if lo <= rates.get(i.id, 1.0) <= hi]
    inband.sort(key=lambda i: abs(rates.get(i.id, 1.0) - 0.5))
    return inband[:limit]


def run_job(*, theta: Theta, items: list[Item], regs: Regs, seed: int, steps: int = 3,
            k: int = 6, learning_rate: float = 1e-5, run_name: str = "power-unit",
            project: str = "scrutineer", entity: str | None = None,
            concurrency: int = 8) -> dict[str, Any]:
    _ = (regs, seed)
    if not items:
        return {"error": "no tasks supplied"}
    return asyncio.run(_run(theta=theta, items=items, steps=steps, k=k,
                            learning_rate=learning_rate, run_name=run_name, project=project,
                            entity=entity, concurrency=concurrency))
