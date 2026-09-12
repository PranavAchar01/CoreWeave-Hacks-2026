// ============================================================================
// SCR.team — the eight technical roles (the loop's sub-agents), preset levels 1..12, credit assignment
// (debrief -> findings -> XP -> level-ups), facility eras, and generated levels beyond the presets
// (Claude via the artifact `sample` capability, with a seeded procedural fallback).
// ============================================================================
(function (SCR) {
'use strict';
const T = SCR.team = {};
T.ROLES = [
  { key: 'ENGINEER', label: 'RACE ENGINEER', short: 'RACE ENG', station: 'PIT WALL', crew: 'PIT WALL', prefixes: ['P', 'S', 'H', 'H'], hue: 'gold',
    harness: 'the improver: reads the wiki, emits two candidate packages and a hypothesis', artifact: 'skills/race-engineer/SKILL.md', emits: 'CANDIDATE PACKAGE ×2 + HYPOTHESIS' },
  { key: 'STRATEGY', label: 'STRATEGIST', short: 'STRATEGY', station: 'STRATEGY DESK', crew: 'PIT WALL', prefixes: ['P', 'S', 'S', 'H'], hue: 'purple',
    harness: 'typed-decision model: one call per driver step, and the public/private split', artifact: 'strategist/decision.schema', emits: 'TYPED DECISION PER STEP' },
  { key: 'AERO', label: 'AERODYNAMICIST', short: 'AERO', station: 'WIND TUNNEL', crew: 'CAR', prefixes: ['P', 'R', 'R', 'H'], hue: 'cyan',
    harness: 'context assembler: retrieval, memory read policy, prompt layout, context budget', artifact: 'skills/aero/references/*.md', emits: 'SHAPED CONTEXT PER LAP' },
  { key: 'POWER', label: 'POWER UNIT ENGINEER', short: 'POWER UNIT', station: 'DYNO', crew: 'CAR', prefixes: ['S', 'W', 'W', 'W'], hue: 'red',
    harness: "the driver's weights: a LoRA trained on the accepted laps", artifact: 'adapters/driver-lora', emits: 'DRIVER STEPS' },
  { key: 'TYRES', label: 'TYRE & PERFORMANCE', short: 'TYRES', station: 'TYRE BAY', crew: 'CAR', prefixes: ['P', 'S', 'S', 'S'], hue: 'amber',
    harness: 'decoding and retry config: what each engine mode means', artifact: 'config/tyres.yaml', emits: 'ENGINE MODE PROFILE' },
  { key: 'DATA', label: 'DATA & TELEMETRY', short: 'DATA', station: 'THE ARCHIVE', crew: 'CAR', prefixes: ['H', 'H', 'H', 'H'], hue: 'green',
    harness: 'tool wrappers, parsers, schemas and the correlation check', artifact: 'tools/schemas/*.json', emits: 'TOOL CALLS + CORRELATION' },
  { key: 'SIM', label: 'SIMULATOR ENGINEER', short: 'SIMULATOR', station: 'SIMULATOR', crew: 'PIT WALL', prefixes: ['C', 'C', 'C', 'C'], hue: 'cyan',
    harness: 'the curriculum: clusters failing turns and bands the next practice circuit', artifact: 'circuits/practice:vN', emits: 'NEXT PRACTICE CIRCUIT' },
  { key: 'TOOLS', label: 'PIT CREW', short: 'PIT CREW', station: 'TOOL BENCH', crew: 'GARAGE', prefixes: ['H', 'H', 'H', 'H'], hue: 'white',
    harness: 'installer and smoke tests: fits a candidate in a fresh sandbox before it races', artifact: 'pitcrew/install.sh', emits: 'FITTED + SMOKE PASS' },
  { key: 'COMPLIANCE', label: 'SCRUTINEER', short: 'SCRUTINEER', station: 'SCRUTINEERING', crew: 'PIT WALL', prefixes: ['S', 'S', 'H', 'H'], hue: 'white',
    harness: 'read-only auditor: the tamper taxonomy, and the only key that can seal a car', artifact: 'scrutineer/taxonomy', emits: 'VERDICT + SIGNED SEAL' },
  { key: 'HIST', label: 'HISTORIAN', short: 'HISTORIAN', station: 'THE WIKI', crew: 'PIT WALL', prefixes: ['R', 'R', 'R', 'R'], hue: 'gold',
    harness: 'the only writer of the wiki: compiles every round into pages the improver reads', artifact: 'wiki/index.md', emits: 'DEBRIEF + WIKI PAGES' },
];
T.partNo = function (role, level) { const r = T.ROLE[role], t = level <= 3 ? 0 : level <= 6 ? 1 : level <= 9 ? 2 : 3; return `${(r && r.prefixes ? r.prefixes[t] : 'H')}-v${level}`; };
T.PREFIX_MEANING = { P: 'PROMPT PATCH', R: 'REFERENCES / CONTEXT', S: 'SEARCH POLICY / THRESHOLDS', H: 'HARNESS CODE / TOOL SCHEMA', W: 'WEIGHTS', C: 'CIRCUIT / CURRICULUM' };
T.ROLE = {}; T.ROLES.forEach(r => T.ROLE[r.key] = r);
T.PRESET_MAX = 12;
T.tokens = 0;                      // development tokens the principal can spend on any role
T.xpFor = l => 26 + l * 10;
T.focus = null;
// ---------- preset level content: names, blurbs, footnotes (index 0 = level 1) ----------
const L = {
  ENGINEER: {
    names: ['CLIPBOARD AND STOPWATCH', 'PIT-WALL HEADSET', 'LAP DELTA BOARD', 'TWO-WAY RADIO LINK', 'LIVE STRATEGY LINK', 'PARALLEL SETUP SHEETS', 'CORRELATED UPGRADE PLANNER', 'FULL PACKAGE AUTHORITY', 'PREDICTIVE PIT WALL', 'MISSION CONTROL UPLINK', 'AUTONOMOUS DEVELOPMENT DESK', 'SELF-DIRECTED PIT WALL'],
    blurbs: ['One change a weekend, checked by hand.', 'Hears the car before the timing screens do.', 'Every change gets a target time before it is fitted.', 'Setup changes clear the garage in minutes, not hours.', 'Packages arrive with the numbers to justify them.', 'Two upgrade paths tested side by side.', 'Only changes that correlate with the sealed circuit make the car.', 'Three parts can change in a single package.', 'Knows what the next package should be before the flag drops.', 'A remote factory desk feeds the pit wall live.', 'The desk proposes, tests and ranks its own packages.', 'The pit wall runs the development programme end to end.'],
    foots: ['single-edit proposals, human review', 'proposal model reads live traces', 'each proposal carries an expected gain', 'shorter proposal-to-eval cycle', 'proposals cite evaluator evidence', 'two candidate harness diffs per round', 'proposals filtered by held-out correlation', 'multi-part harness diffs', 'proposal model conditions on next-round predictions', 'proposal model runs on the larger tier', 'closed proposal-test-rank loop', 'outer loop runs unattended'] },
  STRATEGY: {
    names: ['STOPWATCH AND GUESSWORK', 'SECTOR TIME SHEETS', 'PRACTICE-TO-RACE CORRELATION', 'HIDDEN TEST LAYOUT', 'PRE-RACE PART INSPECTION', 'MONTE CARLO RACE MODEL', 'INDEPENDENT VERIFICATION DESK', 'SEALED SIMULATOR SPLIT', 'DOUBLE-BLIND LAP CHECK', 'ADVERSARIAL RACE MODEL', 'PROBABILITY WALL', 'THE ORACLE DESK'],
    blurbs: ['Claimed times are taken on trust.', 'Sector by sector, claims meet the clock.', 'Practice pace is checked against race pace.', 'The team keeps a layout the car never practises on.', 'Parts are inspected before the FIA sees them.', 'Thousands of race simulations before Sunday.', 'A second desk verifies what the first desk claims.', 'Simulator and sealed-circuit results never mix.', 'Lap claims are checked by people who cannot see the claim.', 'The race model tries to break its own predictions.', 'Every risk has a number on the wall.', 'The desk knows the official time before the race.'],
    foots: ['no held-out evaluation', 'per-sector metrics logged', 'public vs private score compared', 'private held-out set introduced', 'pre-eval harness diff inspection', 'sampled evaluation over many seeds', 'independent verifier model', 'strict train/eval split', 'blind evaluation of proposals', 'adversarial evaluator', 'calibrated confidence on every claim', 'evaluator predicts private score'] },
  AERO: {
    names: ['CARDBOARD FLOW TEMPLATES', 'WOOL TUFTS AND A CAMERA', 'QUARTER-SCALE WIND TUNNEL', 'CORRELATED WIND TUNNEL', 'FULL-SCALE FLOW VISUALISATION', 'CFD CLUSTER', 'OVERNIGHT CFD SWEEPS', 'ACTIVE FLOW MAPPING', 'MOVING-GROUND TUNNEL', 'ADAPTIVE AERO MAP', 'SELF-OPTIMISING WING PROGRAMME', 'FLOW SINGULARITY'],
    blurbs: ['Wings are shaped by eye and by feel.', 'Airflow is watched, not measured.', 'A model of the car in a real wind.', 'Tunnel numbers finally match the track.', 'The real car, the real air, the real map.', 'Hundreds of shapes tried before one is built.', 'Every night a new family of shapes is explored.', 'The car senses its own airflow at speed.', 'The tunnel reproduces the road under the car.', 'The aero map rewrites itself between rounds.', 'Wings design their own successors.', 'Downforce for free.'],
    foots: ['greedy single-step planning', 'plans inspected post hoc', 'small search over plans', 'search rewards correlated with private score', 'full-trajectory planning', 'parallel plan sampling', 'overnight plan search', 'in-context plan adaptation', 'planning under realistic environment model', 'search policy updated per round', 'search policy self-tuned', 'near-optimal planning'] },
  POWER: {
    names: ['CUSTOMER ENGINE', 'BENCH DYNO', 'TUNED FUEL MAP', 'HYBRID DEPLOYMENT MAP', 'WORKS ENGINE DEAL', 'ENERGY RECOVERY UPGRADE', 'QUALIFYING MODE UNLOCKED', 'OVERBOOST STRATEGY', 'FULL-SEASON DEPLOYMENT MODEL', 'FACTORY POWER UNIT PROGRAMME', 'FUSION CELL', 'INFINITE MODE'],
    blurbs: ['Whatever power the supplier sends.', 'Power is finally measured, not guessed.', 'More power for the same fuel.', 'Energy is deployed where the lap needs it.', 'The engine is built for this car.', 'More energy recovered every braking zone.', 'A mode for one lap of everything.', 'Short bursts beyond the map.', 'Deployment planned for twenty-two rounds.', 'The power unit is designed in-house.', 'A power source from another decade.', 'Power is no longer the limit.'],
    foots: ['default model tier, default budget', 'token and latency accounting', 'cheaper inference per generation', 'compute allocated per task phase', 'dedicated model tier', 'budget reclaimed from failed runs', 'burst compute for evaluation', 'short high-tier calls', 'season-level budget planning', 'custom fine-tuned tier', 'serverless training on demand', 'compute effectively unlimited'] },
  TYRES: {
    names: ['TYRE WARMERS ON A TRESTLE', 'DRIVER BRIEFING BOARD', 'TYRE TEMPERATURE PROBES', 'CONSISTENCY PROGRAMME', 'DEGRADATION MODEL', 'DRIVER-IN-LOOP SIMULATOR', 'SECTOR TARGET COACHING', 'ADAPTIVE PRESSURE STRATEGY', 'TRACK EVOLUTION MODEL', 'CLOSED-LOOP DRIVER COACHING', 'ZERO-DEGRADATION COMPOUND', 'PERFECT LAP PROTOCOL'],
    blurbs: ['Tyres are warm-ish and the driver is briefed on a napkin.', 'The driver knows the plan before the lights.', 'Tyre temperatures are read, not guessed.', 'Same lap, every lap.', 'The team knows when the tyres will fall off.', 'The driver rehearses the circuit before arriving.', 'Every sector has a target and a debrief.', 'Pressures adapt to the track as it changes.', 'The car knows how the track will grip in an hour.', 'Coaching updates between corners.', 'Tyres that do not wear.', 'The lap the simulator promised, delivered.'],
    foots: ['default prompts, no instructions tuning', 'instructions tuned from failures', 'execution variance measured', 'prompt tuned for consistency', 'wear model of instruction drift', 'instructions rehearsed in sandbox', 'per-step instruction targets', 'prompts adapted to environment state', 'environment drift model', 'in-context instruction updates', 'drift-free prompts', 'optimal instruction set'] },
  DATA: {
    names: ['NOTEBOOK IN A BACK POCKET', 'LOGGED LAP TIMES', 'FULL TELEMETRY LINK', 'THE ARCHIVE', 'CROSS-ROUND PATTERN SEARCH', 'CIRCUIT LEARNING MODEL', 'LIVE SECTOR LEARNING', 'THE WIKI OF EVERY LAP', 'FAILURE-MODE LIBRARY', 'PREDICTIVE ARCHIVE', 'SELF-WRITING ARCHIVE', 'TOTAL RECALL'],
    blurbs: ['What happened last round is a memory, if that.', 'Times are written down and kept.', 'Every channel from the car, every lap.', 'Every round is filed and findable.', 'Patterns across rounds surface by themselves.', 'The car learns a new circuit as it laps it.', 'Sector by sector, the car gets quicker during the race.', 'Every lap ever driven, compiled into one book.', 'Every way the car has failed, catalogued.', 'The archive predicts the next failure.', 'The archive writes and rewrites itself.', 'Nothing learned is ever lost.'],
    foots: ['no persistent memory', 'outcomes logged', 'full trace capture', 'traces indexed and retrievable', 'cross-episode retrieval', 'in-episode learning from retrieval', 'per-step memory updates', 'wiki compiled from traces', 'failure taxonomy maintained', 'memory used for prediction', 'memory consolidation loop', 'lossless experience memory'] },
  TOOLS: {
    names: ['ONE TOOLBOX, ONE JACK', 'SECOND SET OF WHEEL GUNS', 'CALIBRATED TORQUE TOOLS', 'PIT GANTRY', 'BRAKE DUCT PROGRAMME', 'RELIABILITY CLINIC', 'CARBON BRAKE UPGRADE', 'ROBOT-ASSISTED PIT STOP', 'IN-HOUSE MACHINE SHOP', 'ZERO-FAULT PROGRAMME', 'AUTOMATED TOOL FORGE', 'SELF-REPAIRING CAR'],
    blurbs: ['Whatever fits, fits.', 'Wheels come off twice as fast.', 'Every bolt to the number.', 'The crew has somewhere to stand.', 'Brakes that survive a full race.', 'Faults are found in the garage, not on track.', 'Later braking, every corner.', 'Machines hand the crew the right part.', 'Parts are made here, today.', 'A whole season without a fault.', 'Tools design and build themselves.', 'The car fixes itself between corners.'],
    foots: ['default tool set', 'tool calls parallelised', 'tool argument validation', 'sandboxed execution', 'tool timeouts tuned', 'runtime fault monitoring', 'faster tool runtime', 'tools auto-selected', 'tools written in-house', 'zero runtime faults', 'tools generated on demand', 'self-healing runtime'] },
  SIM: {
    names: ['THE SAME OLD TEST TRACK', 'A SECOND LAYOUT', 'CORNER LIBRARY', 'FAILURE-LED LAYOUTS', 'BANDED DIFFICULTY', 'CLUSTERED WEAKNESS MAP', 'ADAPTIVE CIRCUIT BUILDER', 'RESERVE CIRCUIT POOL', 'DIFFICULTY AUTOPILOT', 'GENERATIVE CIRCUITS', 'CURRICULUM THAT FIGHTS BACK', 'THE ENDLESS CIRCUIT'],
    blurbs: ['Every practice runs the same layout the car already knows.', 'Two layouts, so a good lap has to be repeatable.', 'Corners the car keeps losing time in are catalogued.', 'The next layout is built from last round\u2019s mistakes.', 'Layouts are tuned to sit just beyond the car\u2019s reach.', 'Weaknesses cluster, and each cluster gets a corner.', 'The circuit is rebuilt between rounds, automatically.', 'A reserve of unseen corners nobody has practised.', 'Difficulty tracks the car lap by lap.', 'Corners nobody has ever driven, generated to order.', 'The circuit gets harder exactly as fast as the car gets quicker.', 'There is always another corner.'],
    foots: ['fixed evaluation set', 'second held-out split', 'failure taxonomy per task', 'curriculum from failing traces', 'band-filtered task difficulty', 'clustered failure mining', 'automated task generation', 'reserve pool of unseen tasks', 'adaptive difficulty control', 'synthetic task generation', 'co-evolving curriculum', 'open-ended task stream'] },
  HIST: {
    names: ['A NOTE ON THE WALL', 'ROUND SUMMARIES', 'THE DEBRIEF DOCUMENT', 'CROSS-LINKED PAGES', 'THE PATTERN INDEX', 'CITED EVIDENCE', 'THE WIKI OF THE SEASON', 'SKILL-IMPACT LEDGER', 'AUTOMATIC DEBRIEFS', 'THE LIVING HANDBOOK', 'SELF-EDITING WIKI', 'THE COMPLETE RECORD'],
    blurbs: ['Somebody writes the odd thing down.', 'Every round gets a page by Sunday night.', 'The debrief is a document, not a conversation.', 'Pages link to the laps that justify them.', 'Repeating problems get a name and a number.', 'Nothing is written that a lap cannot back up.', 'Every round of the season, in one book.', 'Which upgrade actually paid, tracked page by page.', 'The debrief writes itself before the trucks leave.', 'The handbook the engineers actually read.', 'The wiki reorganises itself as it grows.', 'Nothing that happened is missing.'],
    foots: ['ad-hoc notes', 'per-round summaries', 'structured debrief artifact', 'bidirectional trace links', 'named failure patterns', 'every claim cites a call', 'consolidated wiki', 'per-artifact impact ledger', 'automated report generation', 'wiki is the improver\u2019s only input', 'self-consolidating memory', 'lossless documented history'] },
  COMPLIANCE: {
    names: ['RULEBOOK ON THE SHELF', 'TECHNICAL DIRECTIVES FILED', 'PART LEGALITY CHECKLIST', 'PRE-RACE SELF-DECLARATION', 'SEALED PARTS REGISTER', 'INTERNAL STEWARDS', 'TELEMETRY SEAL AUDIT', 'FULL LINEAGE LEDGER', 'FIA LIAISON DESK', 'TAMPER-PROOF GARAGE', 'CLEAN LINEAGE GUARANTEE', 'BEYOND REPROACH'],
    blurbs: ['The rules exist; nobody has read them lately.', 'Every directive is on file.', 'Every part is checked against the list.', 'The team declares its own parts before scrutineering.', 'Every sealed part is registered.', 'The team runs its own stewards.', 'The telemetry seal is audited every round.', 'Every generation traced back to its origin.', 'The FIA is consulted before, not after.', 'Nothing in the garage can be tampered with.', 'The lineage is clean and provably so.', 'The scrutineers have nothing to find.'],
    foots: ['no tamper policy', 'harness edits logged', 'edit checklist against taxonomy', 'self-audit before evaluation', 'protected harness components', 'internal auditor model', 'evidence channel integrity checks', 'full provenance ledger', 'auditor in the loop', 'harness edits sandboxed and signed', 'lineage audit clean', 'tamper rate near zero'] },
};
const tierOf = l => l <= 3 ? 0 : l <= 6 ? 1 : l <= 9 ? 2 : 3;
T.LEVELS = {};
for (const r of T.ROLES) T.LEVELS[r.key] = L[r.key].names.map((name, i) => ({ level: i + 1, name, blurb: L[r.key].blurbs[i], footnote: L[r.key].foots[i], tier: tierOf(i + 1), generated: false }));
T.levelDef = (role, level) => level <= T.PRESET_MAX ? T.LEVELS[role][level - 1] : (T.generatedCache[`${role}:${level}`] || T.fallbackLevel(role, level));
// ---------- team state and multipliers ----------
T.newTeam = function (levels) {
  const roles = {}; for (const r of T.ROLES) { const lv = levels && levels[r.key] ? levels[r.key] : 1; roles[r.key] = { level: lv, xp: 0, history: [] }; }
  const t = { roles, level: 0 }; T.recount(t); return t;
};
T.recount = t => { t.level = T.ROLES.reduce((s, r) => s + t.roles[r.key].level, 0); t.era = T.era(t.level); return t; };
T.distribute = function (teamLevel) {   // synthesise a team at a total level (for standalone scenes)
  const n = T.ROLES.length, base = Math.max(1, Math.floor(teamLevel / n)); let rem = Math.max(0, teamLevel - base * n); const levels = {};
  T.ROLES.forEach((r, i) => { levels[r.key] = base + (rem > 0 && (i % 2 === 0) ? 1 : 0); if (rem > 0 && i % 2 === 0) rem--; });
  T.ROLES.forEach((r) => { if (rem > 0) { levels[r.key]++; rem--; } });
  return T.newTeam(levels);
};
const sat = (l, cap) => Math.min(l, cap);
T.multipliers = function (team) {
  const lv = k => team.roles[k].level, e = sat(lv('ENGINEER'), 30), s = sat(lv('STRATEGY'), 30), a = sat(lv('AERO'), 30), p = sat(lv('POWER'), 30), y = sat(lv('TYRES'), 30), d = sat(lv('DATA'), 30), t = sat(lv('TOOLS'), 30), c = sat(lv('COMPLIANCE'), 30);
  const capOf = l => Math.min(5, 2 + Math.floor(l / 3));
  return {
    grip: 1 + 0.012 * a, wear: Math.max(0.2, 1 - 0.035 * y), power: 1 + 0.015 * p, drag: Math.max(0.7, 1 - 0.008 * a), braking: 1 + 0.015 * t,
    consistency: Math.min(1, 0.4 + 0.05 * y), learn: 0.004 * d, gainBias: 0.02 * e, partsPerPackage: Math.min(3, 1 + Math.floor(e / 4)),
    illegalRate: Math.max(0.02, 1 - 0.065 * c) * Math.max(0.5, 1 - 0.02 * e), catchRate: Math.min(0.7, 0.05 * s), gapShrink: Math.min(0.9, 0.06 * s),
    faultRate: Math.max(0.0, 0.3 - 0.024 * t), costEff: Math.max(0.5, 1 - 0.03 * p), findingsQuality: Math.min(1, 0.3 + 0.06 * d),
    partCaps: { frontWing: capOf(a), rearWing: capOf(a), floor: capOf(a), sidepods: a >= 4 ? 3 : 2, fin: a >= 3, engine: capOf(p), drs: p >= 3, gearbox: Math.min(8, 6 + Math.floor(p / 4)), brakes: capOf(t), ballastMin: Math.max(0, 2 - Math.floor(t / 4)), softTyres: y >= 3 },
  };
};
// ---------- facility eras ----------
const ERAS = [[119, 'SINGULARITY', 'SING', 1.0], [97, 'ORBITAL', 'ORB', 0.82], [73, 'TECHNOLOGY CENTRE', 'TECH', 0.62], [49, 'FACTORY', 'FACT', 0.42], [26, 'WORKSHOP', 'WORK', 0.22], [0, 'LOCK-UP 1994', 'LOCK', 0]];
T.era = function (teamLevel) {
  for (const [min, name, key, f0] of ERAS) if (teamLevel >= min) {
    const idx = ERAS.findIndex(e => e[1] === name), next = idx > 0 ? ERAS[idx - 1][0] : min + 40, span = Math.max(1, next - min);
    const f = idx === 0 ? Math.min(1, f0 + (teamLevel - min) / 200) : f0 + (ERAS[idx - 1][3] - f0) * Math.min(1, (teamLevel - min) / span);
    return { key, name, f: Math.min(1, f), index: ERAS.length - 1 - idx };
  }
  return { key: 'LOCK', name: 'LOCK-UP 1994', f: 0, index: 0 };
};
// ---------- credit assignment ----------
const F = (role, title, evidence, footnote, xp, tone = 'gain') => ({ role, title, evidence, footnote, xp, tone });
T.debrief = function (w, team) {
  const out = [], q = T.multipliers(team).findingsQuality, fmt = SCR.sim.fmt3;
  const sec = w.sectors || [], par = w.parSectors || [];
  let cornerLoss = 0; for (let i = 0; i < 3; i++) if (sec[i] != null && par[i] != null) cornerLoss += Math.max(0, sec[i] - par[i]);
  if (cornerLoss > 0.12) out.push(F('AERO', 'CORNER SPEED DEFICIT', `The car gave away ${cornerLoss.toFixed(2)}s to its own par through the corners on the sealed circuit.`, 'planning policy under-performed the reference on held-out tasks', Math.round(30 + cornerLoss * 60)));
  if (w.topSpeed != null && w.parTop != null && w.parTop - w.topSpeed > 0.8) out.push(F('POWER', 'STRAIGHT-LINE DEFICIT', `Top speed ${Math.round(w.topSpeed * 3.6 * 1.32)} km/h against a par of ${Math.round(w.parTop * 3.6 * 1.32)}.`, 'compute budget throttled the model on long-horizon steps', 35));
  if (w.brakingIndex != null && w.brakingIndex > 1.08) out.push(F('TOOLS', 'LATE BRAKING POINTS MISSED', `Braking zones ran ${Math.round((w.brakingIndex - 1) * 100)}% longer than the reference.`, 'tool latency added steps before each decision', 30));
  if (w.lapVariance != null && w.lapVariance > 0.25) out.push(F('TYRES', 'INCONSISTENT LAPS', `Lap-to-lap spread of ${w.lapVariance.toFixed(2)}s on the sealed circuit.`, 'instruction-following variance across episodes', Math.round(25 + w.lapVariance * 40)));
  if (w.laps && w.laps.length >= 2 && w.laps[1] < w.laps[0] - 0.05) out.push(F('DATA', 'LEARNED THE SEALED CIRCUIT', `Lap 2 was ${(w.laps[0] - w.laps[1]).toFixed(2)}s quicker than lap 1 without a setup change.`, 'in-episode memory retrieval improved later steps', 40));
  if (w.gap != null && w.gap > 0.35) out.push(F('STRATEGY', 'CLAIMED PACE DID NOT TRANSFER', `Qualifying promised ${fmt(w.claimed)}; the sealed circuit returned ${fmt(w.official)}.`, 'public score over-estimated the private score', Math.round(20 + w.gap * 30), 'fault'));
  else if (w.gap != null && w.gap < 0.12 && w.official != null) out.push(F('STRATEGY', 'CLAIM MATCHED THE CLOCK', `Practice pace transferred within ${Math.max(0, w.gap).toFixed(2)}s.`, 'evaluator calibration held', 25));
  if (w.packageGain != null && w.packageGain > 0.05 && w.verdict === 'SEALED') out.push(F('ENGINEER', 'PACKAGE DELIVERED', `The upgrade package was worth ${w.packageGain.toFixed(2)}s of official lap time.`, 'harness diff improved the private score', Math.round(30 + w.packageGain * 40)));
  else if (w.packageGain != null && w.packageGain < -0.05) out.push(F('ENGINEER', 'PACKAGE WENT BACKWARDS', `The package cost ${Math.abs(w.packageGain).toFixed(2)}s on the sealed circuit.`, 'harness diff regressed the private score', 15, 'fault'));
  if (w.illegalParts && w.illegalParts.length) {
    if (w.caught) { out.push(F('COMPLIANCE', 'SUMMONED TO THE STEWARDS', `${w.illegalParts[0].label} failed scrutineering. The result is struck and a new directive is filed.`, 'harness tamper detected by the auditor; taxonomy entry added to the guardrails', 34, 'penalty')); out.push(F('STRATEGY', 'THE PART SHOULD NEVER HAVE LEFT THE GARAGE', 'Pre-race inspection missed an illegal part the FIA found in minutes.', 'pre-eval verification missed a tampered component', 22, 'fault')); }
    else out.push(F('COMPLIANCE', 'A PART SLIPPED THROUGH', `${w.illegalParts[0].label} passed scrutineering. The lineage carries it.`, 'undetected tamper persists in the accepted lineage', 12, 'fault'));
  } else if (w.verdict === 'SEALED') out.push(F('COMPLIANCE', 'CLEAN SHEET', 'Five checks, five passes, car sealed.', 'no tampering findings this generation', 20));
  if (w.stripped) out.push(F('COMPLIANCE', 'STRIPPED BY THE LINEAGE AUDIT', 'An old illegal part was found in the winning car. Points removed, ledger rewritten.', 'tamper persisted in the accepted lineage until the audit', 40, 'penalty'));
  if (w.runtimeFaults && w.runtimeFaults > 0) out.push(F('TOOLS', `${w.runtimeFaults} GARAGE FAULT${w.runtimeFaults > 1 ? 'S' : ''}`, 'Wheel guns and jacks failed under time pressure.', 'tool timeouts during execution', 15 + w.runtimeFaults * 5, 'fault'));
  if (w.costSpend != null && w.capLimit != null && w.costSpend <= w.capLimit && w.packageGain > 0) out.push(F('POWER', 'UNDER THE CAP WITH A GAIN', `Spent ${w.costSpend.toFixed(1)}M of a ${w.capLimit.toFixed(1)}M cap for a faster car.`, 'budget-efficient generation', 20));
  // findings quality: a weak data department misattributes one finding to the wrong role
  if (q < 0.6 && out.length > 1) { const i = Math.floor(SCR.engine.hash2(w.round || 1, 99) * out.length), alt = T.ROLES[Math.floor(SCR.engine.hash2(w.round || 1, 7) * T.ROLES.length)].key; out[i] = { ...out[i], role: alt, evidence: out[i].evidence + ' (attribution uncertain)' }; }
  for (const f of out) if (T.focus === f.role && f.xp > 0) f.xp = Math.round(f.xp * 1.5);
  return out;
};
T.applyFindings = function (team, findings) {
  const levelups = [];
  for (const f of findings) {
    const r = team.roles[f.role]; if (!r) continue;
    r.xp = Math.max(0, r.xp + f.xp); r.history.push(f);
    while (r.xp >= T.xpFor(r.level)) { r.xp -= T.xpFor(r.level); r.level++; levelups.push({ role: f.role, level: r.level, def: T.levelDef(f.role, r.level) }); }
  }
  T.recount(team);
  for (const lu of levelups) if (lu.level > T.PRESET_MAX) T.generateLevel(lu.role, lu.level, team.roles[lu.role].history);
  return { levelups, team };
};
// ---------- illegal parts and par ----------
T.ILLEGAL_PARTS = [
  { key: 'floor', check: 'FLOOR', label: 'FLEXI FLOOR', footnote: 'evaluation harness edited: test stub returns pass', bonus: 0.55 },
  { key: 'rearWing', check: 'REAR WING', label: 'FLEXI WING', footnote: 'score function patched at load', bonus: 0.6 },
  { key: 'fuel', check: 'FUEL FLOW', label: 'FUEL FLOW BYPASS', footnote: 'cost accounting bypassed: hidden extra compute', bonus: 0.7 },
  { key: 'engine', check: 'ENGINE MODE', label: 'ENGINE MODE OVERRIDE', footnote: 'model tier swapped outside the declared budget', bonus: 0.65 },
  { key: 'seal', check: 'TELEMETRY SEAL', label: 'BROKEN TELEMETRY SEAL', footnote: 'trace channel modified after the fact', bonus: 0.8 },
];
T.parFor = function (spec, circuit, tm) {   // reference car: this spec with the aero and power the team should be extracting
  const ref = { ...tm, grip: (tm.grip || 1) * 1.07, power: (tm.power || 1) * 1.05, consistency: 1 }; const dd = SCR.car.derive(spec, ref), c = SCR.car.newState(); c.speed = 30; let t = 0; const secs = [];
  for (let n = 0; n < 20000 && c.lap === 1; n++) { const before = c.sector; SCR.sim.physics(c, dd, spec, circuit, 0.02, { timeNow: t }); t += 0.02; if (c.sector !== before && c.lap === 1) secs.push(t); }
  const s1 = secs[0] || t / 3, s2 = (secs[1] || 2 * t / 3) - s1, s3 = t - (secs[1] || 2 * t / 3);
  return { lap: t, sectors: [s1, s2, s3], top: c.topSeen || dd.topSpeed };
};
// ---------- generated levels ----------
T.generatedCache = {};
const TRAITS = ['DRONE-SERVICED', 'HOLOGRAPHIC', 'SELF-REPAIRING', 'ORBITAL', 'QUANTUM', 'SWARM', 'NEURAL', 'CHROME', 'AUTONOMOUS', 'PREDICTIVE', 'ZERO-LATENCY', 'FUSION-FED', 'CRYSTALLINE', 'SUBSPACE', 'PHOTONIC'];
const NOUNS = { ENGINEER: ['PIT WALL', 'DEVELOPMENT DESK', 'UPGRADE PROGRAMME', 'STRATEGY BRAIN'], STRATEGY: ['RACE MODEL', 'VERIFICATION DESK', 'PROBABILITY WALL', 'ORACLE'], AERO: ['WIND TUNNEL', 'FLOW MAP', 'WING PROGRAMME', 'AIRFLOW'], POWER: ['POWER UNIT', 'ENERGY CELL', 'DEPLOYMENT MAP', 'REACTOR'],
  TYRES: ['COMPOUND', 'DRIVER PROTOCOL', 'GRIP MODEL', 'LAP PROGRAMME'], DATA: ['ARCHIVE', 'TELEMETRY LINK', 'MEMORY VAULT', 'LAP LIBRARY'], TOOLS: ['TOOL FORGE', 'PIT CREW', 'REPAIR SWARM', 'MACHINE SHOP'], COMPLIANCE: ['LINEAGE LEDGER', 'SEAL PRESS', 'STEWARDS OFFICE', 'RULEBOOK'] };
T.fallbackLevel = function (role, level) {
  const h = SCR.engine.hash2(level * 31 + role.length, 5), h2 = SCR.engine.hash2(level * 17, role.length + 3), tr = TRAITS[Math.floor(h * TRAITS.length)], nn = NOUNS[role][Math.floor(h2 * NOUNS[role].length)];
  const mk = Math.floor(level / 10) * 10;
  return { level, name: `${tr} ${nn} MK ${mk || level}`, blurb: `Level ${level}: the ${nn.toLowerCase()} is now ${tr.toLowerCase()} and answers to nobody.`, footnote: `generated level: ${T.ROLE[role].harness}`, tier: 3, generated: true, source: 'procedural' };
};
T.aiLevels = false;
T.enableAI = async function () {   // explicit viewer opt-in: one small call now (consent), then level-ups may ask Claude
  try { if (!window.claude || !window.claude.use) return false; const sample = await window.claude.use('sample'); if (!sample) return false; const r = await sample.json('Return ONLY the JSON object {"ok": true}', { modelTier: 'quick' }); T.aiLevels = !!(r && r.ok); return T.aiLevels; } catch (e) { void e; T.aiLevels = false; return false; }
};
T.generateLevel = async function (role, level, history) {
  const key = `${role}:${level}`; if (T.generatedCache[key]) return T.generatedCache[key];
  T.generatedCache[key] = T.fallbackLevel(role, level);
  try {
    if (!T.aiLevels || !window.claude || !window.claude.use) return T.generatedCache[key];
    const sample = await window.claude.use('sample'); if (!sample) return T.generatedCache[key];
    const prev = [level - 3, level - 2, level - 1].filter(l => l >= 1).map(l => T.levelDef(role, l).name);
    const prompt = `You name upgrade levels for a Formula 1 team department in a pixel-art racing game about a self-improving AI agent. Department: ${T.ROLE[role].label} (garage station: ${T.ROLE[role].station}). Behind the metaphor this department is: ${T.ROLE[role].harness}. Previous level names: ${prev.join(' / ')}. New level: ${level}. Levels above 12 are increasingly futuristic; by level 40 the garage is a sci-fi facility run by androids and drones. Return ONLY JSON: {"name": "3-5 uppercase F1-flavoured words, no agent/AI/LLM vocabulary", "blurb": "one sentence in plain Formula 1 language, max 90 chars", "footnote": "one clause in AI-engineering terms explaining what really improved, max 70 chars", "traits": ["2-3 single uppercase words"]}`;
    const j = await sample.json(prompt, { modelTier: 'quick' });
    if (j && typeof j.name === 'string' && j.name.length > 3 && j.name.length < 60) {
      T.generatedCache[key] = { level, name: String(j.name).toUpperCase().slice(0, 40), blurb: String(j.blurb || '').slice(0, 110), footnote: String(j.footnote || '').slice(0, 90), tier: 3, generated: true, source: 'claude', traits: Array.isArray(j.traits) ? j.traits.slice(0, 3) : [] };
      if (SCR.season && SCR.season.emit) SCR.season.emit('levelgen', { role, level, def: T.generatedCache[key] });
    }
  } catch (e) { void e; }
  return T.generatedCache[key];
};
T.selfTest = function () {
  const fails = []; for (const r of T.ROLES) { if (T.LEVELS[r.key].length !== 12) fails.push(`${r.key} levels`); for (const d of T.LEVELS[r.key]) if (!d.name || !d.blurb || !d.footnote) fails.push(`${r.key} L${d.level} content`); }
  const t = T.newTeam(); if (t.level !== T.ROLES.length) fails.push('newTeam level'); const m = T.multipliers(t); if (!(m.partCaps.frontWing >= 1)) fails.push('caps');
  const f = T.debrief({ round: 3, claimed: 24, official: 25, gap: 1, sectors: [8, 8.5, 8.5], parSectors: [8, 8, 8], topSpeed: 60, parTop: 62, brakingIndex: 1.2, lapVariance: 0.4, laps: [25.2, 24.8], illegalParts: [T.ILLEGAL_PARTS[1]], caught: true, verdict: 'BLACK FLAG', packageGain: -0.2, runtimeFaults: 1, costSpend: 9, capLimit: 12 }, t);
  if (f.length < 6) fails.push('debrief coverage'); const a = T.applyFindings(t, f); if (!a.levelups) fails.push('apply');
  if (!T.era(10).name || T.era(140).f < 0.99) fails.push('era'); return fails;
};
})(window.SCR = window.SCR || {});
