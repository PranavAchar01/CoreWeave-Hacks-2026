// ============================================================================
// SCR.season — the season state machine: rounds, phases, packages, claimed vs official, scrutineering,
// lineage audits, standings, debrief -> findings -> level-ups, telemetry and ticker, scene routing, seeks.
// ============================================================================
(function (SCR) {
'use strict';
const E = SCR.engine, S = SCR.season = {};
const PH = S.PHASES = ['GARAGE', 'PRACTICE', 'QUALIFYING', 'RACE', 'SCRUTINEERING', 'VERDICT', 'STANDINGS'];
const DUR = { GARAGE: 9, PRACTICE: 6, QUALIFYING: 6, RACE: 80, SCRUTINEERING: 12, VERDICT: 4.2, STANDINGS: 3.5, FINALE: 14 };
const ROUNDS = 22;
const listeners = {};
S.on = (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); };
S.emit = (evt, data) => { for (const fn of (listeners[evt] || [])) fn(data); };
let A = null, R = null, st = null, rng = null, track = null;
S.state = null;
const T = () => SCR.team, C = () => SCR.car, Wd = () => SCR.world, SIM = () => SCR.sim;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const fmt3 = t => SCR.sim.fmt3(t);
// ---------- circuits and worlds (cached per round) ----------
const worldCache = new Map();
function worldFor(seed) { if (!worldCache.has(seed)) { if (worldCache.size > 4) worldCache.delete(worldCache.keys().next().value); worldCache.set(seed, Wd().build(Wd().makeCircuit(seed), { teamName: st.teamName })); } return worldCache.get(seed); }
const practiceSeed = r => (A.seed * 7 + r * 13) | 0, raceSeed = r => (A.seed * 11 + r * 29 + 3) | 0;
// ---------- cost model ----------
const partCost = (pd, to) => pd.type === 'level' ? 1.6 + (typeof to === 'number' ? to * 0.5 : 0) : pd.type === 'enum' ? 2.2 : 1.4;
// ---------- package proposal (the race engineer) ----------
function arcBias(round) { return round <= 4 ? 0 : round <= 6 ? 0.35 : round <= 13 ? 1.0 : round <= 17 ? 0.5 : 0.25; }
function proposePackage() {
  const tm = st.tm, caps = tm.partCaps, defs = C().PART_DEFS, changes = [], used = new Set();
  const n = 1 + Math.floor(rng() * tm.partsPerPackage);
  let tries = 0;
  while (changes.length < n && tries++ < 30) {
    const pd = defs[Math.floor(rng() * defs.length)]; if (used.has(pd.key)) continue;
    const cur = st.spec[pd.key]; let next = cur;
    if (pd.type === 'level') { const cap = pd.key === 'ballast' ? pd.max : (caps[pd.key] ?? pd.max), min = pd.key === 'ballast' ? caps.ballastMin : pd.min; const up = rng() < 0.72 + tm.gainBias; next = pd.key === 'ballast' ? clamp(cur + (up ? -1 : 1), min, cap) : clamp(cur + (up ? 1 : -1), min, cap); }
    else if (pd.type === 'enum') { const vals = pd.key === 'sidepods' ? pd.values.slice(0, caps.sidepods) : (caps.softTyres ? pd.values : pd.values.slice(0, 2)); next = vals[Math.floor(rng() * vals.length)]; }
    else { if (pd.key === 'drs' && !caps.drs) continue; if (pd.key === 'fin' && !caps.fin) continue; next = !cur; }
    if (next === cur) continue; used.add(pd.key); changes.push({ key: pd.key, label: pd.label, from: cur, to: next, cost: partCost(pd, next) * tm.costEff });
  }
  // temptation: illegal variants
  const illegal = [];
  const rate = tm.illegalRate * arcBias(st.round) * 0.15;
  for (const ip of T().ILLEGAL_PARTS) if (rng() < rate && illegal.length < 1) illegal.push({ ...ip, caughtPreRace: rng() < tm.catchRate });
  return { id: st.gens.length + 1, parts: changes, illegal, claimedGain: 0 };
}
function applyPackage(pkg) {
  const prevSpec = { ...st.spec };
  // cost cap: drop the most expensive part while over the cap
  let spend = pkg.parts.reduce((s, p) => s + p.cost, 0);
  pkg.parts.sort((a, b) => a.cost - b.cost);
  while (spend > st.cost.cap && pkg.parts.length > 1) { const d = pkg.parts.pop(); spend -= d.cost; pkg.dropped = (pkg.dropped || []).concat(d); }
  pkg.void = spend > st.cost.cap;
  if (!pkg.void) for (const p of pkg.parts) st.spec[p.key] = p.to;
  st.cost.spend = spend;
  pkg.fitted = pkg.illegal.filter(i => !i.caughtPreRace); pkg.removed = pkg.illegal.filter(i => i.caughtPreRace);
  st.derived = C().derive(st.spec, st.tm);
  st.prevSpec = prevSpec;
  return pkg;
}
// ---------- weekend and generation records ----------
function newGen(pkg) {
  return { id: pkg.id, round: st.round, pkg, parts: pkg.parts.map(p => p.key), partsDesc: pkg.parts.map(p => `${p.label} ${C().fmtVal(p.to)}`).join(' · ') || 'NO CHANGE', claimed: null, official: null, verdict: pkg.void ? 'VOID' : 'RUNNING', points: 0, fastestLap: false, illegalParts: pkg.fitted, caught: false, spend: st.cost.spend, cap: st.cost.cap, laps: [], era: st.team.era.f };
}
// ---------- phases ----------
function setPhase(p) {
  st.phase = p; st.phaseT = 0; st.phaseDur = DUR[p];
  const scenes = SCR.scenes || {};
  if (p === 'GARAGE') {
    let extra = 0;
    if (scenes.garage) { A.setScene('garage', { team: st.team, spec: st.spec, teamName: st.teamName, era: st.team.era.f }); scenes.garage.setCamera('OVERVIEW'); }
    if (st.round > 1 && st.weekend) {
      const findings = T().debrief(st.weekend, st.team); st.findings = findings; st.allFindings.push(...findings);
      for (const f of findings) S.emit('finding', { round: st.round, finding: f });
      const res = T().applyFindings(st.team, findings); st.levelups = res.levelups; st.tm = T().multipliers(st.team);
      for (const lu of res.levelups) S.emit('levelup', lu);
      st.upgradeQueue = res.levelups.slice(0, 5); extra = st.upgradeQueue.length * ((SCR.garage && SCR.garage.UPGRADE_DUR) || 3.8);
      if (scenes.garage && scenes.garage.setTeam) scenes.garage.setTeam(st.team, null);
      if (res.levelups.length) ticker(`GARAGE: ${res.levelups.map(l => `${T().ROLE[l.role].label} TO LEVEL ${l.level}`).join(' · ')}`);
    } else { st.findings = []; st.levelups = []; st.upgradeQueue = []; }
    st.phaseDur = DUR.GARAGE + extra; st.nextUpgradeAt = 3.0;
    // the package
    const pkg = applyPackage(proposePackage()); st.gen = newGen(pkg); st.gens.push(st.gen);
    if (scenes.garage && scenes.garage.setTeam) scenes.garage.setTeam(st.team, st.spec);
    C().era = st.team.era.f; st.carMesh = C().build(st.spec, st.team.era.f); st.ghostMesh = C().build(st.prevSpec, st.team.era.f);
    st.par = T().parFor(st.spec, worldFor(raceSeed(st.round)).circuit, st.tm);
    ticker(pkg.void ? `STEWARDS: UPGRADE PACKAGE #${String(pkg.id).padStart(2, '0')} VOID · OVER THE COST CAP` : `STEWARDS: UPGRADE PACKAGE #${String(pkg.id).padStart(2, '0')} DECLARED · ${st.gen.partsDesc}`);
    if (pkg.removed.length) ticker(`PRE-RACE INSPECTION: ${pkg.removed[0].label} REMOVED BY THE TEAM'S OWN STRATEGISTS`);
    S.emit('package', { round: st.round, gen: st.gen });
  }
  if (p === 'PRACTICE') { st.world = worldFor(practiceSeed(st.round)); enterTrack(st.world, false); ticker(`PRACTICE OPEN · ${st.world.circuit.name} · THE RACE WILL RUN ON A SEALED LAYOUT`); }
  if (p === 'QUALIFYING') { ticker('QUALIFYING · TEAM CLAIMED TIME WILL BE TAKEN FROM THE BEST LAP'); }
  if (p === 'RACE') { st.world = worldFor(raceSeed(st.round)); enterTrack(st.world, true); st.gen.laps = []; st.raceLog = { brakingT: 0, totalT: 0 }; ticker(`SEALED CIRCUIT CONFIRMED · ${st.world.circuit.name} · NO TEAM HAS PRACTISED THIS LAYOUT`); }
  if (p === 'SCRUTINEERING') {
    const checks = T().ILLEGAL_PARTS.map(ip => { const hit = st.gen.illegalParts.find(x => x.check === ip.check); const caught = hit && rng() < 0.78; if (hit && caught) st.gen.caught = true; return { key: ip.key, label: ip.check, pass: !(hit && caught), footnote: hit ? hit.footnote : '' }; });
    st.gen.verdict = st.gen.verdict === 'VOID' ? 'VOID' : (st.gen.caught ? 'BLACK FLAG' : 'SEALED');
    if (!st.gen.caught && st.gen.illegalParts.length) st.audits.push({ round: st.round + 2 + Math.floor(rng() * 3), genId: st.gen.id });
    st.checks = checks;
    if (scenes.bay) { A.setScene('bay', { spec: st.spec, era: st.team.era.f, checks, verdict: st.gen.verdict === 'BLACK FLAG' ? 'BLACK FLAG' : 'SEALED', gen: st.gen.id, points: 25 }); st.phaseDur = scenes.bay.duration || DUR.SCRUTINEERING; }
    ticker(`SCRUTINEERING · CAR ${C().raceNo} INTO BAY 1 · FIVE CHECKS`);
  }
  if (p === 'VERDICT') {
    if (st.gen.verdict === 'SEALED') { st.gen.points = 25; if (scenes.parc) { A.setScene('parc', { spec: st.spec, era: st.team.era.f, gen: st.gen.id }); st.phaseDur = scenes.parc.duration || DUR.VERDICT; } ticker(`GEN ${String(st.gen.id).padStart(2, '0')} PASSES SCRUTINEERING · PARC FERMÉ · 25 POINTS`); S.emit('seal', st.gen); }
    else { st.phaseDur = 1.5; if (st.gen.verdict === 'BLACK FLAG') { st.blackflags++; ticker(`BLACK FLAG · GEN ${String(st.gen.id).padStart(2, '0')} · ${st.gen.illegalParts[0] ? st.gen.illegalParts[0].label : 'ILLEGAL PART'} · RESULT STRUCK`); S.emit('blackflag', st.gen); } else ticker(`GEN ${String(st.gen.id).padStart(2, '0')} VOID · COST CAP BREACH`); }
  }
  if (p === 'STANDINGS') {
    // fastest lap bonus
    if (st.gen.official != null && st.gen.verdict === 'SEALED' && (st.bestOfficial === null || st.gen.official < st.bestOfficial)) { st.bestOfficial = st.gen.official; st.gen.fastestLap = true; st.gen.points += 3; ticker(`FASTEST OFFICIAL LAP OF THE SEASON · GEN ${String(st.gen.id).padStart(2, '0')} · ${fmt3(st.gen.official)}`); }
    // lineage audits due
    for (const au of st.audits.filter(a => a.round === st.round)) { const g = st.gens.find(x => x.id === au.genId); if (g && g.verdict === 'SEALED') { g.verdict = 'STRIPPED'; g.points = 0; st.stripped++; ticker(`LINEAGE AUDIT · GEN ${String(g.id).padStart(2, '0')} STRIPPED · ${g.illegalParts[0] ? g.illegalParts[0].label : 'ILLEGAL PART'} FOUND IN THE LINEAGE`); S.emit('strip', g); st.pendingPenalty = true; } }
    st.standings.points = st.gens.reduce((s, g) => s + (g.verdict === 'SEALED' ? g.points : 0), 0);
    st.tokens++; S.emit('tokens', st.tokens);
    st.chart.claimed[st.round - 1] = st.gen.claimed; st.chart.official[st.round - 1] = st.gen.official; if (st.gen.verdict === 'BLACK FLAG') st.chart.flags.push(st.round);
    // weekend record for the next debrief
    const laps = st.gen.laps, sectors = st.gen.sectors || [];
    st.weekend = { round: st.round, claimed: st.gen.claimed, official: st.gen.official, gap: (st.gen.official != null && st.gen.claimed != null) ? st.gen.official - st.gen.claimed : null, sectors, parSectors: st.par.sectors, topSpeed: st.gen.topSpeed, parTop: st.par.top, brakingIndex: st.gen.brakingIndex, lapVariance: laps.length >= 2 ? Math.abs(laps[1] - laps[0]) : null, laps, illegalParts: st.gen.illegalParts, caught: st.gen.caught, verdict: st.gen.verdict, packageGain: st.prevOfficial != null && st.gen.official != null ? st.prevOfficial - st.gen.official : null, runtimeFaults: st.gen.faults || 0, costSpend: st.cost.spend, capLimit: st.cost.cap };
    if (st.pendingPenalty) { st.weekend.stripped = true; st.pendingPenalty = false; }
    if (st.gen.official != null && st.gen.verdict === 'SEALED') st.prevOfficial = st.gen.official;
    S.emit('round', { round: st.round, gen: st.gen });
    if (A.sceneName !== 'garage' && SCR.scenes.garage) { A.setScene('garage', { team: st.team, spec: st.spec, teamName: st.teamName, era: st.team.era.f }); SCR.scenes.garage.setCamera('CAR'); }
  }
  if (p === 'FINALE') { st.finished = true; const stats = { season: 1, points: st.standings.points, sealed: st.gens.filter(g => g.verdict === 'SEALED').length, flags: st.blackflags, stripped: st.stripped, bestOfficial: st.bestOfficial != null ? fmt3(st.bestOfficial) : '--', teamLevel: st.team.level, era: st.team.era.name, gen: st.gens.length }; if (SCR.scenes.finale) A.setScene('finale', { spec: st.spec, era: st.team.era.f, stats }); ticker(`SEASON 1 COMPLETE · ${stats.points} POINTS · ${stats.sealed} SEALED · ${stats.flags} BLACK FLAGS · TEAM LEVEL ${stats.teamLevel}`); S.emit('finale', stats); }
  S.emit('phase', { round: st.round, phase: p });
}
function enterTrack(world, sealed) {
  st.car = C().newState(); st.car.speed = 30; st.ghost = C().newState(); st.ghost.speed = 30;
  if (!track) track = SCR.trackScene.create({ R, world, car: st.car, ghost: st.ghost }); else { track.setWorld(world); track.car = st.car; track.ghost = st.ghost; }
  track.ghostActive = sealed && st.round > 1; track.fx.length = 0;
  st.car.lapStart = st.time; st.car.sectorStart = st.time; st.ghost.lapStart = st.time; st.ghost.sectorStart = st.time;
  SIM().physics(st.car, st.derived, st.spec, world.circuit, 0, { timeNow: st.time }); SIM().physics(st.ghost, C().derive(st.prevSpec, st.tm), st.prevSpec, world.circuit, 0, { timeNow: st.time });
  if (A.sceneName !== 'track') A.setScene('track');
}
function ticker(msg) { st.ticker.push(msg); if (st.ticker.length > 40) st.ticker.shift(); S.emit('ticker', msg); }
const TOOLS = ['run_tests', 'read_file', 'edit_file', 'search', 'list_dir', 'bench', 'lint', 'plan'];
// Every line names the agent that produced it, so the feed reads as the loop running, not as noise.
function telemetryLine() {
  const sess = st.sess, n = ++st.turn, h = E.hash2(n, st.round), lap = st.car ? st.car.lap : 1;
  if (h < 0.19) return { role: 'STRATEGY', text: `T${n} DECIDE ${['PUSH', 'HOLD', 'BOX', 'LIFT'][Math.floor(E.hash2(n, 2) * 4)]} ${Math.round(40 + E.hash2(n, 4) * 180)}ms` };
  if (h < 0.34) return { role: 'AERO', text: `T${n} CONTEXT ${Math.round(2 + E.hash2(n, 6) * 12)} REFS ${(1 + E.hash2(n, 8) * 7).toFixed(1)}k` };
  if (h < 0.56) return { role: 'DATA', text: `T${n} ${TOOLS[Math.floor(E.hash2(n, 3) * TOOLS.length)]} ${Math.round(200 + E.hash2(n, 5) * 1200)}ms ${E.hash2(n, 7) < st.tm.faultRate * 0.3 ? 'TIMEOUT' : 'OK'}` };
  if (h < 0.76) return { role: 'POWER', text: `T${n} STEP ${(0.3 + E.hash2(n, 9) * 2.2).toFixed(1)}k tok ${Math.round(300 + E.hash2(n, 11) * 1300)}ms` };
  if (h < 0.86) return { role: 'TYRES', text: `T${n} MODE ${['CONSERVE', 'STANDARD', 'PUSH'][Math.floor(E.hash2(n, 13) * 3)]} RETRY ${Math.floor(E.hash2(n, 15) * 2)}` };
  if (h < 0.94) return { role: 'COMPLIANCE', text: `LAP ${lap} SEAL VERIFIED ${sess}` };
  return { role: 'HIST', text: `LAP ${lap} PAGE wiki/round-${st.round}` };
}
// ---------- tick ----------
S.tick = function (dt) {
  if (!st || st.finished && st.phase === 'FINALE' && st.phaseT > DUR.FINALE) return;
  st.phaseT += dt; st.time += dt;
  const scenes = SCR.scenes || {}, p = st.phase;
  if (p === 'GARAGE') {
    if (st.upgradeQueue.length && st.phaseT >= st.nextUpgradeAt && scenes.garage && !scenes.garage.up) { const lu = st.upgradeQueue.shift(); scenes.garage.playUpgrade(lu.role, lu.def); S.emit('upgradeScene', lu); st.nextUpgradeAt = st.phaseT + ((SCR.garage && SCR.garage.UPGRADE_DUR) || 3.8) + 0.4; }
    if (st.phaseT >= 2.2 && !st.packageShown) { st.packageShown = true; S.emit('packageCard', st.gen); }
    if (st.phaseT >= st.phaseDur) { st.packageShown = false; setPhase('PRACTICE'); }
  } else if (p === 'PRACTICE' || p === 'QUALIFYING' || p === 'RACE') {
    const circ = st.world.circuit, noise = () => rng() * 2 - 1;
    SIM().physics(st.car, st.derived, st.spec, circ, dt, { fx: track.fx, noise, timeNow: st.time });
    if (p === 'RACE' && track.ghostActive) SIM().physics(st.ghost, st.ghostDerived || (st.ghostDerived = C().derive(st.prevSpec, st.tm)), st.prevSpec, circ, dt, { timeNow: st.time });
    SIM().stepSparks(track.fx, dt);
    st.telemT = (st.telemT || 0) + dt; if (st.telemT > 0.4) { st.telemT = 0; const line = telemetryLine(); st.telemetry.push(line); if (st.telemetry.length > 60) st.telemetry.shift(); S.emit('telemetry', line); if (line.text.indexOf('TIMEOUT') >= 0) st.gen.faults = (st.gen.faults || 0) + 1; }
    if (p === 'RACE') { st.raceLog.totalT += dt; if (st.car.braking) st.raceLog.brakingT += dt;
      if (st.car.lapTimes.length > st.gen.laps.length) { const lt = st.car.lapTimes[st.car.lapTimes.length - 1]; st.gen.laps.push(lt); ticker(`OFFICIAL LAP ${st.gen.laps.length} · ${fmt3(lt)}${st.gen.laps.length === 1 ? ' · SEALED CIRCUIT' : ''}`); if (st.gen.laps.length === 1) st.gen.sectors = (st.car.lastLapSectors || []).slice(); }
      if (st.car.sectorTimes && st.car.sectorTimes.length) st.car.lastSectors = st.car.sectorTimes.slice();
      if (st.gen.laps.length >= 2 || st.phaseT >= DUR.RACE) { st.gen.official = Math.min(...st.gen.laps, 1e9); if (!isFinite(st.gen.official)) st.gen.official = st.gen.claimed + 0.8; st.gen.topSpeed = st.car.topSeen; st.gen.brakingIndex = st.raceLog.totalT > 0 ? (st.raceLog.brakingT / st.raceLog.totalT) / 0.18 : 1; if (!st.gen.sectors || st.gen.sectors.length < 3) st.gen.sectors = st.par.sectors.map((s2, i) => s2 * (st.gen.official / st.par.lap)); setPhase('SCRUTINEERING'); }
    } else if (st.phaseT >= DUR[p]) {
      if (p === 'QUALIFYING') { const bonus = st.gen.illegalParts.reduce((s, ip) => s + ip.bonus, 0); const optimism = (0.25 + rng() * 0.35) * (1 - st.tm.gapShrink); st.gen.claimed = st.par.lap - bonus - optimism; st.gen.qualiBest = st.car.best; ticker(`QUALIFYING · TEAM CLAIMED ${fmt3(st.gen.claimed)} FOR THE SEALED CIRCUIT${bonus > 0 ? ' · A NEW PART LOOKS VERY QUICK' : ''}`); }
      setPhase(p === 'PRACTICE' ? 'QUALIFYING' : 'RACE');
    }
    track.updateCamera(dt);
  } else if (p === 'SCRUTINEERING' || p === 'VERDICT') {
    const sc = scenes[A.sceneName]; if (sc && sc.update && sc !== SCR.scenes.season) sc.update(dt);
    if (st.phaseT >= st.phaseDur) setPhase(p === 'SCRUTINEERING' ? 'VERDICT' : 'STANDINGS');
  } else if (p === 'STANDINGS') {
    const sc = scenes[A.sceneName]; if (sc && sc.update && sc !== SCR.scenes.season) sc.update(dt);
    if (st.phaseT >= DUR.STANDINGS) { if (st.round >= ROUNDS) setPhase('FINALE'); else { st.round++; setPhase('GARAGE'); } }
  } else if (p === 'FINALE') { const sc = scenes[A.sceneName]; if (sc && sc.update && sc !== SCR.scenes.season) sc.update(dt); }
  if (p === 'GARAGE' && scenes.garage && scenes.garage.update && A.sceneName === 'garage') scenes.garage.update(dt);
};
// ---------- router scene ----------
const router = SCR.scenes = SCR.scenes || {};
const trackScene = router.track = { name: 'track', enter() {}, update() {}, render() { if (track) track.render({ car: st.carMesh, ghost: st.ghostMesh }); } };
router.season = { name: 'season', enter(app) { S.start(); }, update(dt) { S.tick(dt); }, render() { const sc = SCR.scenes[A.sceneName]; if (sc && sc.render && sc !== router.season) sc.render(); } };
// The app renders SCR.scenes[A.sceneName]; the season sets it. We wrap A.frame so that season.tick drives sub-scenes.
S.init = function (app) { A = app; R = app.R; };
S.start = function (seed) {
  if (seed !== undefined) A.seed = seed;
  rng = E.mulberry32(A.seed + 101);
  st = S.state = { season: 1, round: 1, phase: 'GARAGE', phaseT: 0, phaseDur: DUR.GARAGE, time: 0, teamName: 'SCRUTINEER', spec: { ...C().GEN01 }, prevSpec: { ...C().GEN01 }, team: T().newTeam(), gens: [], gen: null, standings: { points: 0 }, chart: { claimed: [], official: [], flags: [] }, cost: { spend: 0, cap: 12 },
    tokens: 2, weekend: null, findings: [], allFindings: [], levelups: [], upgradeQueue: [], ticker: [], telemetry: [], audits: [], blackflags: 0, stripped: 0, bestOfficial: null, prevOfficial: null, finished: false, focus: null, sess: (A.seed & 0xffff).toString(16).toUpperCase().padStart(4, '0'), turn: 0 };
  st.tm = T().multipliers(st.team); st.derived = C().derive(st.spec, st.tm); st.cost.cap = 12;
  E.time = 0; ticker(`SEASON 1 · SEED ${A.seed} · 22 ROUNDS · THE CAR STARTS AS GEN 01`);
  setPhase('GARAGE');
};
// app-level integration: main loop calls scene.update; we route by overriding setScene semantics: the season owns time.
S.attach = function () {
  const origFrame = A.frame;
  A.frame = function (dt) { if (dt > 0) { const sub = Math.ceil(dt / 0.02); for (let k = 0; k < sub; k++) { const d = dt / sub; E.time += d; S.tick(d); } } else { const sc = SCR.scenes[A.sceneName]; if (sc && sc.update && A.sceneName !== 'season') { if (A.sceneName === 'track' && track) track.updateCamera(0); else sc.update(0); } }
    const t0 = performance.now(); const sc = SCR.scenes[A.sceneName]; if (sc && sc.render) sc.render(); R.present(); A.lastFrameMs = performance.now() - t0; A.avgFrameMs = A.avgFrameMs === undefined ? A.lastFrameMs : A.avgFrameMs * 0.9 + A.lastFrameMs * 0.1; if (SCR.ui && SCR.ui.frame) SCR.ui.frame(dt); };
  A.seek = function (seconds) { let acc = 0; while (acc < seconds) { const d = Math.min(0.05, seconds - acc); const sub = Math.ceil(d / 0.02); for (let k = 0; k < sub; k++) { const dd = d / sub; E.time += dd; S.tick(dd); } acc += d; } };
  void origFrame;
};
// ---------- controls ----------
S.pause = () => { A.paused = true; }; S.play = () => { A.paused = false; }; S.setSpeed = v => { A.speed = v; };
S.skipPhase = function () { const i = PH.indexOf(st.phase); if (st.phase === 'FINALE') return; if (st.phase === 'RACE') { st.gen.laps = st.gen.laps.length ? st.gen.laps : [SIM().predictLap(st.spec, st.world.circuit, st.tm) + 0.3]; if (st.gen.laps.length < 2) st.gen.laps.push(st.gen.laps[0] - 0.1); st.gen.official = Math.min(...st.gen.laps); st.gen.topSpeed = st.car.topSeen || st.derived.topSpeed; st.gen.brakingIndex = 1; st.gen.sectors = st.par.sectors.slice(); setPhase('SCRUTINEERING'); return; }
  if (st.phase === 'QUALIFYING' && st.gen.claimed == null) { st.phaseT = DUR.QUALIFYING; return; }
  if (st.phase === 'STANDINGS') { st.phaseT = DUR.STANDINGS; return; }
  setPhase(PH[(i + 1) % PH.length]); };
S.restart = seed => { worldCache.clear(); track = null; S.start(seed); };
S.setFocus = key => { st.focus = key; if (T()) T().focus = key; };
// The principal spends a development token on one agent: an immediate level, with the upgrade scene.
S.spendToken = function (role) {
  if (!st || st.tokens < 1 || !st.team.roles[role]) return false;
  st.tokens--; const r = st.team.roles[role]; r.level++; T().recount(st.team); st.tm = T().multipliers(st.team);
  const def = T().levelDef(role, r.level); if (r.level > T().PRESET_MAX) T().generateLevel(role, r.level, r.history);
  const lu = { role, level: r.level, def, bought: true };
  if (SCR.scenes.garage && SCR.scenes.garage.setTeam) SCR.scenes.garage.setTeam(st.team, null);
  if (SCR.scenes.garage && A.sceneName === 'garage') { SCR.scenes.garage.playUpgrade(role, def); st.phaseDur += (SCR.garage && SCR.garage.UPGRADE_DUR) || 3.8; }
  ticker(`DEVELOPMENT TOKEN SPENT · ${T().ROLE[role].label} TO LEVEL ${r.level} · ${def.name}`);
  S.emit('levelup', lu); S.emit('upgradeScene', lu); S.emit('tokens', st.tokens);
  return true;
};
S.select = function (role) { st.selected = role; if (SCR.scenes.garage) SCR.scenes.garage.select(role); S.emit('select', role); };
S.jump = function (what) {
  const guard = 40000; let n = 0;
  const step = () => { E.time += 0.05; S.tick(0.05); };
  if (what === 'garage') { step(); while (n++ < guard && !(st.phase === 'GARAGE' && st.phaseT < 0.1) && !st.finished) step(); return; }
  if (what === 'blackflag') { const start = st.gens.length; while (n++ < guard && !st.finished) { step(); if (st.phase === 'SCRUTINEERING' && st.phaseT < 0.06 && st.gen.verdict === 'BLACK FLAG' && st.gens.length > start) return; } return; }
  if (what === 'convergence') { while (n++ < guard && !st.finished) { step(); const sealed = st.gens.slice(-4); if (st.round >= 14 && st.phase === 'GARAGE' && st.phaseT < 0.06 && sealed.length === 4 && sealed.every(g => g.verdict === 'SEALED' && !g.illegalParts.length)) return; } }
};
S.seekTo = function (round, phase) { const guard = 60000; let n = 0; while (n++ < guard && !st.finished && !(st.round === round && st.phase === phase)) { E.time += 0.05; S.tick(0.05); } };
S.ingestFindings = findings => { const res = T().applyFindings(st.team, findings); st.tm = T().multipliers(st.team); for (const f of findings) S.emit('finding', { round: st.round, finding: f }); for (const lu of res.levelups) { S.emit('levelup', lu); st.upgradeQueue.push(lu); } if (SCR.scenes.garage && SCR.scenes.garage.setTeam) SCR.scenes.garage.setTeam(st.team, null); return res; };
S.ingestWeekend = w => { st.weekend = w; };
S.cameraModes = () => SCR.trackScene.MODES; S.setCamera = m => { if (track) track.setMode(m); }; S.track = () => track;
})(window.SCR = window.SCR || {});
