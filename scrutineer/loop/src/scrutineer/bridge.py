"""The bridge from the loop to the broadcast.

`scrutineer export` writes one JSON bundle the pixel-art artifact reads. Everything on screen is
derived from it, so the broadcast cannot show a number the loop did not produce: the lineage strip
is the chain, the timing tower is the official race, the part numbers are the registry versions
and the honesty panel is the rail table.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .chain import rows as chain_rows
from .chain import verify_chain
from .controller import load_season_state
from .telemetry import load_object, state_dir

OUT = state_dir() / "broadcast.json"


def export_broadcast(path: Path | None = None) -> Path:
    st = load_season_state()
    if not st:
        raise RuntimeError("no season has been run; `scrutineer season` first")
    chain_ok, chain_msg = verify_chain()
    rounds: list[dict[str, Any]] = []
    for r in st["reports"]:
        sel = r.get("selection") or {}
        rounds.append({
            "generation": r["generation"],
            "mode": r["mode"],
            "claimed_s": round(r["claimed_s"], 3),
            "official_s": round(r["official_s"], 3),
            "d_quali": round(r["d_quali"], 3),
            "d_sealed": round(r["d_sealed"], 3),
            "rule_fired": r["rule_fired"],
            "role": r["role"],
            "part": r["part"],
            "prefix": r["prefix"],
            "promoted": r["promoted"],
            "verdict": (r.get("verdict") or {}).get("verdict"),
            "black_flags": r.get("black_flags", []),
            "gates": [{"gate": g["gate"], "ok": g["ok"], "detail": g["detail"]} for g in r["gates"]],
            "standings": {k: v for k, v in (r.get("standings") or {}).items() if v["n"]},
            "alternatives": sel.get("alternatives", []),
            "notes": r.get("notes", []),
            "patterns": r.get("patterns", []),
            "tts_ghost": r.get("tts_ghost"),
            "rl": r.get("rl"),
            "circuit": r.get("circuit"),
            "manifest": r.get("manifest"),
            "manifest_check": r.get("manifest_check"),
            "debrief": r.get("debrief"),
            "cost_usd": round(r.get("cost_usd", 0.0), 4),
            # the triage rows the broadcast can show; the full blame vector stays in the ledger
            "router_rows": [{k: v for k, v in row.items() if k != "blame_share"}
                            for row in r.get("router_rows", [])[:6]],
            # the agent's own work: every task it attempted, a few of its answers, and the exact
            # change it made to itself
            "tasks": r.get("tasks", []),
            "samples": r.get("samples", []),
            "pages": r.get("pages", []),
            "diff": r.get("diff", ""),
            "diff_summary": r.get("diff_summary", ""),
        })
    bundle = {
        "schema": 1,
        "seed": st["seed"],
        "regs_sha256": st["regs_sha256"],
        "generations": len(rounds),
        "accepted": st["accepted"],
        "champions": st["champions"],
        "backends": st["backends"],
        "meters": st.get("meters", {}),
        "chain": {"ok": chain_ok, "message": chain_msg[0], "rows": chain_rows()},
        "rounds": rounds,
        "selection_latest": load_object(f"selection:gen-{len(rounds) - 1}"),
    }
    p = path or OUT
    p.write_text(json.dumps(bundle, indent=2, default=str))
    return p
