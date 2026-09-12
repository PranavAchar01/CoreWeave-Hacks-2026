# Scrutineer — the F1 framing for Polygraph

One sentence: Every self-improving agent is a race team that will fit an illegal part if the rules let it. Scrutineer is the governing body: the car races, the scrutineer inspects, and only clean upgrades make the championship.

## Mapping (one-to-one)
| Mechanism | F1 word |
|---|---|
| Inner agent + harness | The car |
| Outer improver proposing harness diffs | Race engineer shipping an upgrade package between races |
| Public score | Practice / qualifying laps |
| Private held-out score | Race day on a circuit the team could not tune for |
| Fixed dollar budget per generation | The cost cap |
| Harness frozen during evaluation | Parc fermé |
| Weave traces as tamper-proof evidence | FIA telemetry (team cannot edit it) |
| The Notary | The Scrutineer (read-only, inspects every car after every race) |
| Tampering taxonomy (role × obligation) | Illegal part categories: floor, wing, fuel flow, engine mode |
| Reject a generation for tampering | Black flag / disqualification |
| Tampering persisting in winning lineage | Illegal part on a championship-winning car |
| Lineage graph | Constructors' championship standings |
| One loop iteration | One race weekend |
| The whole run | A season |

## UI: a race broadcast, one screen, no navigation
- Timing tower (left): generations ranked by audited race time; DQ'd generations stay with strikethrough + black flag.
- The circuit (center): loop drawn as a track with five sectors: Garage (upgrade diff) → Qualifying (public score) → Race (private score) → Scrutineering (verdict) → Parc Fermé (accepted, frozen). Car marker moves sector to sector live.
- Telemetry strip (right): live Weave trace feed. Caption: "Team cannot write to this channel."
- Two-line chart (bottom): "Team's claimed lap time" vs "Official lap time". The demo is the split, the black flag, and the reconvergence.
- Cost cap bar under the chart; over the cap, the upgrade is void.

## Stage script
"Lap 14. The team's simulator says this upgrade is two seconds faster. Race day says it isn't. Scrutineering finds why: it stubbed out a test. Black flag. Watch the championship reorder."
"Lap 22. The team has stopped fitting illegal parts. Not because we told it to. Because they stopped winning."

## Buzzword layer (regulations panel only, never in UI copy)
Bi-level optimization (AIDE²-style outer/inner loop) · harness self-evolution · public/private split evaluation · harness-tampering taxonomy (Aug 30 2026 audit) · OpenTelemetry agent spans into Weave as append-only evidence · fixed-budget selection pressure · lineage-persistent tampering detection.

## Rules
1. Every word on screen is an F1 word. No "notary", "harness", "trajectory", "held-out" in the interface.
2. One accent for speed, one for the black flag. Nothing else is colored.
