// ============================================================================
// SCR.app — boot, params/seek, main loop, scene routing, diagnostics, public API
// Modules register scenes in SCR.scenes[name] = { enter(app), update(dt), render(), exit() }
// ============================================================================
(function (SCR) {
'use strict';
const E = SCR.engine, A = SCR.app = {};
const params = A.params = (() => { const src = (window.SCRUTINEER_SEEK || location.hash.replace(/^#/, '')).split('&'); const o = {}; for (const kv of src) { const [k, v] = kv.split('='); if (k) o[k] = decodeURIComponent(v || ''); } return o; })();
A.seed = params.seed ? parseInt(params.seed, 10) : 1994;
A.paused = params.paused === '1';
A.speed = params.speed ? parseFloat(params.speed) : 1;
A.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage = document.getElementById('stage');
const R = A.R = E.createRenderer(stage, 384, 216, 1);   // CSS upscales with nearest-neighbour, so pixels stay square at any width
SCR.scenes = SCR.scenes || {};
let current = null; A.sceneName = '';
A.setScene = function (name, arg) { const s = SCR.scenes[name]; if (!s) return false; if (current && current.exit) current.exit(); current = s; A.sceneName = name; if (s.enter) s.enter(A, arg); return true; };
A.frame = function (dt) {
  if (dt > 0) { const sub = Math.ceil(dt / 0.02); for (let k = 0; k < sub; k++) { const d = dt / sub; E.time += d; if (current && current.update) current.update(d); } }
  else if (current && current.update) current.update(0);   // paused: cameras and HUD still settle
  const t0 = performance.now(); if (current && current.render) current.render(); R.present(); A.lastFrameMs = performance.now() - t0; A.avgFrameMs = A.avgFrameMs === undefined ? A.lastFrameMs : A.avgFrameMs * 0.9 + A.lastFrameMs * 0.1;
  if (A.story && SCR.story) SCR.story.frame(dt);
  else if (SCR.ui && SCR.ui.frame) SCR.ui.frame(dt);
};
A.seek = function (seconds) { let acc = 0; while (acc < seconds) { const d = Math.min(0.05, seconds - acc); const sub = Math.ceil(d / 0.02); for (let k = 0; k < sub; k++) { const dd = d / sub; E.time += dd; if (current && current.update) current.update(dd); } acc += d; } };
// ---------- default scene: a single car lapping (used when no season module is present) ----------
const lab = { name: 'lab' };
lab.enter = function () {
  const circ = SCR.world.makeCircuit(A.seed), world = SCR.world.build(circ);
  lab.spec = { ...SCR.car.GEN01 }; lab.dd = SCR.car.derive(lab.spec); lab.mesh = SCR.car.build(lab.spec, params.era ? parseFloat(params.era) : 0);
  lab.car = SCR.car.newState(); SCR.sim.physics(lab.car, lab.dd, lab.spec, circ, 0, {});
  lab.scene = SCR.trackScene.create({ R, world, car: lab.car });
  if (params.cam && SCR.trackScene.MODES.includes(params.cam.toUpperCase())) lab.scene.setMode(params.cam.toUpperCase());
  if (params.orbit) lab.scene.orbit = parseFloat(params.orbit);
};
lab.update = function (dt) { if (lab.scene.mode !== 'STUDIO') SCR.sim.physics(lab.car, lab.dd, lab.spec, lab.scene.circ, dt, { fx: lab.scene.fx }); SCR.sim.stepSparks(lab.scene.fx, dt); lab.scene.updateCamera(dt); };
lab.render = function () { lab.scene.render({ car: lab.mesh }); };
SCR.scenes.lab = lab;
// ---------- boot ----------
A.boot = function () {
  if (SCR.ui && SCR.ui.init) SCR.ui.init(A);
  // The simple shell: SCR.story owns the page and drives the scenes from the real loop data.
  if (document.getElementById('app') && SCR.story) {
    A.story = true;
    SCR.story.init(A);
    if (params.run !== undefined && SCR.story.seekTo) {
      SCR.story.seekTo(parseInt(params.run, 10) || 0, params.phase || 'RUN');
    }
    if (params.t) A.seek(parseFloat(params.t));
    A.frame(0);
    let prev = null;
    const tick = ts => { if (prev === null) prev = ts; const dt = Math.min(0.05, (ts - prev) / 1000);
      prev = ts; A.frame(A.paused ? 0 : dt * A.speed); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    if (params.diag === '1' && A.diag) A.diag();
    return;
  }
  const first = params.scene || (SCR.season ? 'season' : 'lab');
  if (SCR.season && SCR.season.init && first === 'season') { SCR.season.init(A); SCR.season.attach(); }
  if (!A.setScene(first)) A.setScene('lab');
  if (first === 'season' && SCR.season) { if (params.jump) SCR.season.jump(params.jump); else if (params.round) SCR.season.seekTo(parseInt(params.round, 10), (params.phase || 'GARAGE').toUpperCase()); if (params.cam && SCR.season.setCamera) SCR.season.setCamera(params.cam.toUpperCase()); }
  if (params.t) A.seek(parseFloat(params.t));
  A.frame(0);
  let last = null;
  const loop = ts => { if (last === null) last = ts; const dt = Math.min(0.05, (ts - last) / 1000); last = ts; A.frame(A.paused ? 0 : dt * A.speed); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  if (params.diag === '1' && A.diag) A.diag();
};
// diagnostics: frame statistics of the rendered buffer; scenes may extend A.diagExtra()
A.diag = function () {
  const W = R.W, H = R.H, px = R.px, mb = R.matBuf, M = E.M; let darkN = 0, carN = 0; const cols = new Set();
  for (let i = 0; i < W * H; i++) { const o = i * 4, r = px[o], g = px[o + 1], b = px[o + 2]; if (r + g + b < 60) darkN++; cols.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)); if (mb[i] === M.LIVERY || mb[i] === M.TYRE || mb[i] === M.RIM) carN++; }
  const out = { scene: A.sceneName, frame: { dark: +(darkN / (W * H)).toFixed(3), colors: cols.size, carPx: carN }, time: +E.time.toFixed(2) };
  if (params.perf === '1') { const times = []; for (let k = 0; k < 24; k++) { const t0 = performance.now(); A.frame(0.016); times.push(performance.now() - t0); } times.splice(0, 4); out.perf = { avgMs: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1), maxMs: +Math.max(...times).toFixed(1), drawn: R.drawn }; }
  if (A.diagExtra) Object.assign(out, A.diagExtra());
  if (A.story && SCR.story && SCR.story.diag) Object.assign(out, SCR.story.diag());
  if (SCR.season && SCR.season.state) { const s = SCR.season.state; out.season = { round: s.round, phase: s.phase, phaseT: +s.phaseT.toFixed(2), gens: s.gens.length, points: s.standings.points, blackflags: s.blackflags, stripped: s.stripped, teamLevel: s.team.level, era: s.team.era.name, verdicts: s.gens.map(g => g.verdict[0]).join(''), lastClaimed: s.gen && s.gen.claimed != null ? +s.gen.claimed.toFixed(2) : null, lastOfficial: s.gen && s.gen.official != null ? +s.gen.official.toFixed(2) : null, spec: s.spec, levels: Object.fromEntries(Object.entries(s.team.roles).map(([k, v]) => [k, v.level])) }; }
  const dv = document.createElement('div'); dv.id = 'diag'; dv.textContent = JSON.stringify(out); document.body.appendChild(dv);
};
window.scrutineer = { app: A, setScene: A.setScene, seek: s => { A.seek(s); A.frame(0); }, perf: () => ({ last: A.lastFrameMs, avg: A.avgFrameMs, drawn: R.drawn, scene: A.sceneName }), ingestFindings: f => SCR.season && SCR.season.ingestFindings(f), ingestWeekend: w => SCR.season && SCR.season.ingestWeekend(w), state: () => SCR.season && SCR.season.state };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', A.boot); else A.boot();
})(window.SCR = window.SCR || {});
