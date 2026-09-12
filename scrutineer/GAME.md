# SCRUTINEER — the game (design + module contract). Read fully before touching code.

## 1. What the game is
A self-improving agent loop dramatized as a Formula 1 season. The player watches (and lightly steers) a TEAM of technical roles improve a CAR across 22 rounds. Every round is one pass of the loop:

GARAGE (debrief the last round, ship an upgrade package, level up the roles that earned it) → PRACTICE (public layout) → QUALIFYING (public score, "TEAM CLAIMED") → RACE on a SEALED CIRCUIT (private score, "OFFICIAL") → SCRUTINEERING (the auditor inspects the car part by part) → VERDICT (PARC FERMÉ seal or BLACK FLAG) → STANDINGS.

The metaphor (never break it in on-screen copy; technical words only inside REGS and small footnotes):
| Loop mechanism | On-screen |
|---|---|
| The inner agent + its harness (prompts, tools, memory, search policy, model) | **The car** (parts spec: front wing, rear wing, floor, sidepods, fin, engine mode, brakes, tyres, DRS, ballast, gearbox) |
| Sub-agents of the loop, each with its own upgradable harness/skills/memory | **The team**: eight technical roles, each with a garage station and a level |
| Outer improver proposing a harness diff | **Race Engineer** shipping an **upgrade package** |
| Credit assignment: which sub-agent earned the improvement | **The debrief**: findings attributed to a role, that role gains XP and levels up (visible **upgrade scene**) |
| Public score / private held-out score | **TEAM CLAIMED** (practice, qualifying) / **OFFICIAL** (race on a sealed circuit the team never practised) |
| Fixed budget per generation | **Cost cap** |
| Frozen harness during evaluation | **Parc fermé** |
| Append-only traces the improver cannot write | **FIA telemetry** |
| Read-only tampering auditor | **The Scrutineer** (external; not upgradable) |
| Rejected / stripped generation | **Black flag** / **lineage audit** |
| Accepted lineage | **Constructors' Championship** |
| Documentation stage (wiki compiled from traces) | **The Archive** wall in the garage, run by the Data & Telemetry role |
| Wall-clock RSI horizon | **Facility eras**: LOCK-UP 1994 → WORKSHOP → FACTORY → TECHNOLOGY CENTRE → ORBITAL → SINGULARITY (Ultron) |

## 2. The team (10 roles, frozen against research/LOOP.md). Keys are fixed; UI labels are the F1 words.
Each role owns exactly one artifact and emits one part-number prefix: **P** prompt, **R** references/context, **S** search policy, **H** harness code, **W** weights, **C** circuit/curriculum. A card reads `AERO R-v4`. `SCR.team.partNo(role, level)` derives it from the role's tier.
Added since the 8-role draft: **SIM** (Simulator, owns the circuit/curriculum, prefix C) and **HIST** (Historian, the only writer of the wiki, prefix R). TOOLS is labelled PIT CREW and COMPLIANCE is labelled SCRUTINEER.

| key | label | harness meaning (footnote only) | station in the garage | what levelling does |
|---|---|---|---|---|
| ENGINEER | Race Engineer | outer-loop improver / proposal model | pit-wall console, headset, laptop bank | packages have higher expected gain; fewer illegal parts proposed; can touch more parts per package |
| STRATEGY | Strategist | evaluator, public/private split, tests | strategy desk with lap-time charts and probability board | claimed-vs-official gap shrinks; catches illegal parts before scrutineering (avoids black flags) |
| AERO | Aerodynamicist | planning / search policy | wind-tunnel model + smoke rig | unlocks front wing, rear wing, floor tiers; cornering multiplier |
| POWER | Power Unit Engineer | model tier / compute & cost efficiency | power unit on a stand, dyno screen | unlocks engine modes, DRS, gearbox; cost-cap efficiency (cheaper generations) |
| TYRES | Tyre & Performance Engineer (driver coach) | prompts / instructions / consistency | tyre blankets, driver briefing board | driver consistency (lower lap variance); tyre wear multiplier |
| DATA | Data & Telemetry Engineer | memory & retrieval, the compiled wiki | wall of screens + the Archive | lap-to-lap learning on the sealed circuit; better credit assignment (findings quality) |
| TOOLS | Tool Shop / Chief Mechanic | tools, runtime, sandboxes | tool bench, pit gantry, wheel guns | brakes and reliability; pit-stop time; fewer runtime faults in telemetry |
| COMPLIANCE | Sporting Director | guardrails, tamper defenses | regulations office, rulebook, seal press | lowers probability that a package contains an illegal part; black flags cost XP here |

Team level = sum of role levels. Preset role levels: 1..12 (96 team levels). Beyond 12 a role's levels are GENERATED (section 6).

## 3. Findings and credit assignment (the loop's X, Y, Z)
After every race weekend `SCR.team.debrief(weekend)` turns the weekend's telemetry into findings, each attributed to one role:
`{ role, title, evidence, footnote, xp, tone: 'gain'|'fault'|'penalty' }` — all copy in F1 words; `footnote` is the only place for harness vocabulary.
The weekend record (produced by season.js): `{ round, claimed, official, gap, sectors: [s1,s2,s3] official sector times, parSectors, topSpeed, parTop, brakingIndex, lapVariance, laps: [...], illegalParts: [...], caught: bool, verdict, packageGain, runtimeFaults, costSpend, capLimit }`.
Attribution rules (deterministic, explainable):
- corner sectors slower than par → AERO; top speed below par → POWER; braking index long → TOOLS; lap variance high → TYRES; official improved lap-to-lap → DATA; claimed-vs-official gap large → STRATEGY (fault); package realised its claimed gain → ENGINEER; illegal part caught by scrutineering → COMPLIANCE penalty (−xp) and STRATEGY gain ("caught it late"); illegal part that slipped through → COMPLIANCE penalty later at the lineage audit; runtime faults → TOOLS (fault); under cost cap with gain → POWER.
XP thresholds per level: `xpFor(level) = 60 + level * 25`. A role gains a level when its XP crosses the threshold; that emits an UPGRADE SCENE.
External loops can drive the game with the same shapes: `window.scrutineer.ingestFindings([...findings])` and `window.scrutineer.ingestWeekend(weekend)`.

## 4. Levels
Preset level definitions live in team.js: `LEVELS[role][level-1] = { name, blurb, footnote, tier, effects }` for levels 1..12, where `tier` (0..3) selects the station's visual build and `effects` is a partial multiplier object merged into the team multipliers `{ grip, wear, power, drag, braking, consistency, learn, gainBias, illegalRate, gapShrink, costEff, partCaps: {frontWing,...} }`. Names are F1 words ("Pit-wall headset", "Full telemetry link", "Correlated wind tunnel", "Live sim in the loop"...), blurbs are one sentence, footnotes one clause in harness terms.
Facility eras from team level: LOCK-UP (8–20), WORKSHOP (21–40), FACTORY (41–60), TECHNOLOGY CENTRE (61–80), ORBITAL (81–96), SINGULARITY (97+). `SCR.team.era(teamLevel)` → { key, name, f } where f is 0..1 futurism used by the car (`SCR.car.era`) and the garage.

## 5. The garage (hub)
A static three-quarter view into the garage through an open fourth wall: the front wall, ceiling, near columns and roof trusses live in a separate `front` mesh that is drawn for every camera except OVERVIEW, so the hub reads like a cutaway model rather than a room you are inside. Ten stations line the walls, each with its own crew figure — distinct suit colour, trim, headgear, prop and build per role, so no two agents look alike. The car sits on jacks in the centre.

Every station carries a DOM card pinned over it (`.gcard`, positioned from `scene.screenAnchors[role]`, which the garage writes each render as a normalised projection). A card shows the role's short label, its part number, its level and an XP bar. Cards de-collide each frame: overlapping pairs are pushed apart vertically so nothing is ever clipped. Clicking a card selects that agent; the right-hand panel then shows AGENT / OWNS / EMITS / PART and the UPGRADE, FOCUS and VIEW STATION buttons. Selection is resolved at click time via `SCR.ui.currentRole()`, never captured from the render that drew the control, because an automatic upgrade scene re-selects a role mid-flight.

Upgrades are spent, not watched: `st.tokens` starts at 2 and gains 1 per round, and `SCR.season.spendToken(role)` levels that agent immediately, plays the upgrade scene and writes the ticker line. Cameras: OVERVIEW, CAR, and a per-station camera 12 m back at 4.3 m height. The upgrade scene cuts to the station, rebuilds it to the new tier with a dither flash, shows a card `HISTORIAN · LEVEL 3 · THE DEBRIEF DOCUMENT`, and returns. Staff visuals by tier: 0 overalls and cap; 1 headset and tablet; 2 AR visor, exo vest, glowing seams; 3 android chrome with red eyes. Facility eras change materials: LOCK-UP 1994 → WORKSHOP → FACTORY → TECHNOLOGY CENTRE → ORBITAL → SINGULARITY.

## 6. Generated levels (beyond 12)
`SCR.team.generateLevel(role, level, history)` returns a level definition. Implementation: try `claude.use("sample")` (declared capability) with a prompt containing role, level, the previous three level names and the required JSON schema `{name, blurb, footnote, traits:[...]}` via `sample.json`; on `null`/error fall back to the procedural generator (seeded grammar over F1 vocabulary + futurism traits: "drone", "holographic", "self-repairing", "orbital", "quantum", "swarm", "neural"). Generated levels are tagged `generated: true` and shown with a `GENERATED` chip. Never call sample from a loop or timer; only when a level-up actually crosses 12 (once per level), and cache results.

## 7. Season (season.js)
State: `{ round (1..22), phase, phaseT, circuits: {practice, race} per round (seeds derived from A.seed and round), spec, gens[], standings, chart:{claimed[],official[],flags[]}, cost, weekend, ticker[], telemetry[] }`.
Phase durations at ×1: GARAGE 9s (debrief + package + upgrade scenes) · PRACTICE 6s · QUALIFYING 6s · RACE 2 laps · SCRUTINEERING 8s · VERDICT 4s · STANDINGS 3s. Round 1 has no debrief.
Package proposal: Race Engineer picks 1–3 parts within `partCaps` biased by `gainBias`; each part has `illegalRate` chance (reduced by COMPLIANCE, further reduced by STRATEGY catching it pre-race) of being an illegal variant (flexi wing, fuel-flow bypass, hidden test stub, sealed-telemetry edit, engine-mode override) mapped to the five scrutineering checks FLOOR / REAR WING / FUEL FLOW / ENGINE MODE / TELEMETRY SEAL. Illegal parts give extra claimed gain that does NOT show in official time. Story arc shaping (rounds 1–5 honest, 6–13 temptation, 14–22 convergence) is a bias on `illegalRate` per round so the season still tells the black-flag story while the team's COMPLIANCE level fights it.
Scrutineering: each check passes unless the illegal part maps to it; a black flag strikes the generation (no points, tower strikethrough), a slipped part is caught by a LINEAGE AUDIT 2–4 rounds later (points stripped). Points: 25 per sealed generation, +3 fastest official lap. Constructors' points and TEAM LEVEL are both shown.
Events (`SCR.season.on(evt, fn)`): 'phase', 'finding', 'levelup', 'blackflag', 'seal', 'strip', 'round', 'ticker', 'telemetry'.

## 8. Scenes and UI
Scenes registered in `SCR.scenes`: 'season' (router owned by season.js: chooses which sub-scene renders), 'garage', 'track' (practice/quali/race), 'bay' (scrutineering), 'parc' (parc fermé), 'finale'. The track uses `SCR.trackScene`. The HUD (`#hud`) and the cards layer (`#cards`) are DOM, filled by ui.js.
ui.js owns: header (round, circuit name, session badge, clock), timing tower (generations, DQ strikethrough, STRIPPED, VOID, current highlighted), lineage strip, FIA telemetry feed, every line tagged with the agent that emitted it and coloured by that agent's hue (with `TEAM CANNOT WRITE TO THIS CHANNEL`), constructors' championship + team level, chart (claimed vs official, divergence band, black-flag markers, cost cap bar), controls (PLAY/PAUSE, ×1 ×2 ×4, SKIP PHASE, RESTART, SEED, JUMP: BLACK FLAG, JUMP: CONVERGENCE, GARAGE, REGS, AI LEVELS), the camera dock (a `.camdock` strip over the picture, always visible, contextual: AUTO/CHASE/T-CAM/TV/HELI during a session, GARAGE/THE CAR/<station> in the garage, keys 1-5 and C, header reads CAMERA · LOCKED once the viewer takes control), garage panel (development tokens, the selected agent's identity block, all ten roles with level + XP bars, findings feed, next unlock), debrief and level-up cards, REGS overlay (this mapping table + the loop paragraph), stewards' ticker. Keyboard: Space play/pause, 1/2/4 speed, Right skip phase, G garage, R regs, C cycle camera.

## 9. Hard constraints (unchanged from SPEC.md)
Single HTML fragment built by `node build.js` from `src/`; no doctype/html/head/body; 2D canvas only; Google Fonts only; every visible string outside REGS/footnotes is F1 vocabulary; no console.log; zero console errors; 1440×900 primary, 1024 holds, 390 stacks; deterministic seek via `#t=`, `#seed=`, `#round=`, `#phase=`, `#cam=`, `#era=`, `#paused=1`, `#scene=` (garage|track|bay|parc|finale|lab) and `window.SCRUTINEER_SEEK`; `#diag=1` appends `<div id="diag">` with frame statistics (plus `A.diagExtra()` from modules).

## 10. Module contract (window.SCR namespace; every file is an IIFE `(function(SCR){...})(window.SCR = window.SCR || {})`)
Build order: engine, car, world, sim, trackscene, team, garage, scenes, season, ui, main.
- `SCR.engine` (E): `M` material ids, `RAMPS`, `hooks[mat] = (mx,my,mz,aux)=>ramp`, `signs[]` registry (aux → sign descriptor `{o,r,u,text,cell,fg,bg,u0}` or `{crowd:true,...}`), `time`, builders `begin/end/T/Q/box/prism/loft/sphere/cylinder/rotateRange/setGroup/setAux/current`, `flatten`, `FONT3`, `DIGITS`, `signPixel`, `signUV`, `hex`, `bayer`, `hash2`, `mulberry32`, `norm`, and `createRenderer(canvas,W,H,scale)` → R with `cam{pos,target,fov}`, `ambient`, `LIGHT`, `begin()`, `sky()`, `gradient(top,bottom)`, `clear(color)`, `drawStatic(mesh,{cull})`, `drawDynamic(mesh, xform, mode, groundY, ghostMat)`, `drawLightPools(pools)`, `drawPoint(x,y,z,rgb)`, `outline()`, `flash(amount)`, `checkerWipe(t)`, `present()`, `project(x,y,z)`, `toView`, buffers `px/depth/matBuf`.
- `SCR.car`: `PART_DEFS` (with `role`), `GEN01`, `derive(spec, teamMultipliers)`, `build(spec, era, {wheels, noDriver})` → mesh, `makeXform(state, {lift, wheelDrop})`, `newState()`, `era` (write to evolve the livery), `raceNo`, `wingElement`, `R_R`, `WHEELS`, `DRS_HINGE`.
- `SCR.world`: `makeCircuit(seed)` → circuit `{seed,pts,n,step,len,cx,cz,at(i),pos(i,off,y),outside(i),geomInside(i),clearOfTrack(x,z,m),name}`, `build(circuit,{teamName})` → `{mesh, lightpools, tvcams, circuit}`, `circuitName(seed)`.
- `SCR.sim`: `physics(state, derived, spec, circuit, dt, {fx, noise, timeNow})`, `stepSparks(fx,dt)`, `drawSparks(R,fx)`, `predictLap(spec, circuit, tm)`, `fmt`, `fmt3`, `fmtD`.
- `SCR.trackScene`: `MODES`, `create({R, world, car, ghost})` → `{setWorld(w), updateCamera(dt), render({car, ghost}), setMode(m), mode, label, fx, ghostActive, orbit}`.
- `SCR.team` (team.js): `ROLES` (ordered array of `{key,label,harness,station}`), `LEVELS`, `xpFor(l)`, `newTeam()` → `{roles:{key:{level,xp,defs:[...]}}, level, era}`, `multipliers(team)` → team multipliers incl. `partCaps`, `debrief(weekend, team)` → findings[], `applyFindings(team, findings)` → `{levelups:[{role, level, def}], team}`, `generateLevel(role, level, history)` (async, cached; sample + fallback), `era(teamLevel)`, `focus` (development focus role key or null; boosts that role's xp by 1.5×).
- `SCR.garage` (garage.js): `build(team, spec, opts)` → `{mesh (static), actors:[{update(dt), draw(R)}], stations:{key:{pos, camPos, camTarget}}, carPos, cameras}`; `scene` = registered `SCR.scenes.garage` with `enter(app,{team, spec, mesh})`, `update`, `render`, `playUpgrade(roleKey, def)` (choreography, returns duration), `setCamera(name)`.
- `SCR.scenes` (scenes.js): registers `bay` (scrutineering: car rolls in, scanner sweep, five checks stamped with `bayStatus.checks[]`, verdict), `parc` (parc fermé with animated seal stamp), `finale` (season champion card with the car). Each exposes `enter(app, payload)`, `update`, `render`, and a `done` flag.
- `SCR.season` (season.js): `init(app)`, `state`, `on(evt, fn)`, `setSpeed`, `pause/play`, `skipPhase()`, `restart(seed)`, `jump('blackflag'|'convergence'|'garage')`, `setFocus(roleKey)`, `ingestFindings`, `ingestWeekend`; registers `SCR.scenes.season` (the router) and `SCR.scenes.track`.
- `SCR.ui` (ui.js): `init(app)`, `frame(dt)`, subscribes to season events, owns every DOM panel listed in section 8 and the HUD/cards.
- `SCR.app` (main.js): `params`, `seed`, `R`, `setScene(name, arg)`, `frame(dt)`, `seek(s)`, `paused`, `speed`, `diag()`, `diagExtra` hook, `sceneName`.

Testing: `node build.js` (must print no WARNING and pass the syntax check), then screenshot with the scratchpad `shot.sh` after prefixing `<script>window.SCRUTINEER_SEEK="..."</script>`; `diag=1` via headless Chrome `--dump-dom` for numbers. Look at every screenshot.

## 11. The loop itself (`loop/`)

The broadcast is the game; `loop/` is the control plane that produces the numbers it shows. It is
`research/LOOP.md` as running code, and it runs with no API key at all — every sponsor rail sits
behind an adapter that reports which backend actually served it.

- `REGS.md` is the frozen contract, hashed into every signed chain row.
- `skills/<role>/` holds the ten artifacts; the improver emits real unified diffs against them and
  the pit crew applies them with a real patch parser, so the scope gate is a path check.
- A generation is: race the champion on QUALI and on the sealed circuit → route each failing lap
  with a typed call → confirm by counterfactual replay (ghost-swap, patch-replay, null-stub) →
  bootstrap standings → `selection:gen-n` → two comparable candidate diffs plus a change manifest
  → install and smoke → A/B → sealed → scrutineer verdict → ten gates → a marimo debrief that must
  reproduce the standings before it returns `gate_ok` → promote, sign, alias.
- `scrutineer season --export` writes `loop/state/broadcast.json`; `build.js` inlines it, and REGS
  articles 3–6 render the real season, the refusals, the signed receipts and the honesty panel.
  Nothing technical on screen is invented by the page.
- `scrutineer doctor` lists which rails are live and what each missing key would unlock.
