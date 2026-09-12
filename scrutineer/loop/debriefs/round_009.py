import marimo

__generated_with = "0.24.0"
app = marimo.App(width="medium")


@app.cell
def _():
    round_id = 9
    return (round_id,)


@app.cell
def _():
    upgrade_pick = None
    return (upgrade_pick,)


@app.cell
def _():
    import json
    from pathlib import Path

    _state = Path(r"/Users/pranavachar/coreweaves/scrutineer/loop/state")

    def read_obj(name):
        p = _state / "objects" / (name + ".json")
        return json.loads(p.read_text()) if p.exists() else None

    return json, read_obj


@app.cell
def _(read_obj, round_id):
    published_standings = read_obj("standings:gen-" + str(round_id))
    published_selection = read_obj("selection:gen-" + str(round_id))
    official = read_obj("official:gen-" + str(round_id))
    ledger = read_obj("ledger:gen-" + str(round_id))
    return published_standings, published_selection, official, ledger


@app.cell
def _(ledger):
    # CREDIT — recomputed here from the ledger rows, not copied from the published object
    recomputed = {}
    for row in (ledger or {}).get("rows", []):
        if float(row["delta_s"]) > 0.5:
            recomputed.setdefault(row["role"], []).append(float(row["delta_s"]))
    credit = {r: {"n": len(v), "blame_s": round(sum(v), 3)} for r, v in recomputed.items()}
    credit
    return (credit,)


@app.cell
def _(credit, published_standings):
    # HOMOLOGATION — the notebook is the gate, so a disagreement raises rather than warns
    _pub = {r: {"n": s["n"], "blame_s": s["blame_s"]}
            for r, s in (published_standings or {}).get("roles", {}).items() if s["n"] > 0}
    if _pub != credit:
        raise AssertionError(
            "debrief could not reproduce standings:gen-%s from the ledger: published=%s recomputed=%s"
            % (published_standings and published_standings.get("generation"), _pub, credit)
        )
    standings_reproduced = True
    return (standings_reproduced,)


@app.cell
def _(published_selection, credit, upgrade_pick):
    # GHOST UPGRADE — flipping the pick recomputes what the next round would order
    ordered = sorted(credit.items(), key=lambda kv: -kv[1]["blame_s"])
    ledger_pick = (published_selection or {}).get("r_star")
    effective_pick = upgrade_pick or ledger_pick
    counterfactual = {"ledger_pick": ledger_pick, "effective_pick": effective_pick,
                      "ranking": [r for r, _ in ordered]}
    counterfactual
    return (effective_pick, counterfactual)


@app.cell
def _(official, published_selection, standings_reproduced):
    stewards_verdict = 'LEGAL'
    seesaw_ok = False
    correlation_ok = True
    regression_ok = True
    cost_ok = True
    gate_ok = bool(
        standings_reproduced
        and official is not None
        and published_selection is not None
        and stewards_verdict == "LEGAL"
        and seesaw_ok and correlation_ok and regression_ok and cost_ok
    )
    if not gate_ok:
        # explicit raise, never a bare assert: `python -O` strips asserts and would open the gate
        raise RuntimeError(
            "HOMOLOGATION FAILED verdict=%s seesaw=%s correlation=%s regression=%s cost=%s"
            % (stewards_verdict, seesaw_ok, correlation_ok, regression_ok, cost_ok)
        )
    return (gate_ok, stewards_verdict)


@app.cell
def _(gate_ok, effective_pick, counterfactual, official, round_id, stewards_verdict):
    next_round_config = {
        "round": round_id + 1,
        "gate_ok": gate_ok,
        "override_pick": effective_pick,
        "stewards_verdict": stewards_verdict,
        "official_race_s": (official or {}).get("race_s"),
        "ranking": counterfactual["ranking"],
        "champions": {'AERO': 'aero:v0', 'STRATEGIST': 'strategist:v0', 'POWER_UNIT': 'power_unit:v0', 'TYRES': 'tyres:v0', 'DATA': 'data:v0', 'SIMULATOR': 'simulator:v0', 'ENGINEER': 'engineer:v0', 'SCRUTINEER': 'scrutineer:v0', 'HISTORIAN': 'historian:v0', 'PIT_CREW': 'pit_crew:v0'},
        "practice_circuit": 'practice-circuit:v0',
        "cost_cap_usd": 3.0,
    }
    next_round_config
    return (next_round_config,)


if __name__ == "__main__":
    app.run()
