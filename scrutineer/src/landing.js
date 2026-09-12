// ============================================================================
// SCR.landing — the hero car on the front page.
//
// It is the same car the broadcast races, built from the same spec mapping, walking the season
// one run at a time on a turntable. Nothing here is decorative: the parts that move are the
// components the loop actually promoted, read from the recorded season.
// ============================================================================
(function (SCR) {
'use strict';
const E = SCR.engine, C = SCR.car, L = SCR.landing = {};
const $ = id => document.getElementById(id);
const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// what the viewer is looking at, in the harness's own words
const SAYS = {
  AERO: 'wider wings — it retrieves more context',
  DATA: 'a sealed floor — it renders and audits before it submits',
  TYRES: 'a softer compound — it decodes more boldly',
  POWER_UNIT: 'a new power unit — a tuned checkpoint',
  SIMULATOR: 'DRS — a practice set it mined for itself',
  STRATEGIST: 'a longer gearbox — it knows when to stop',
  PIT_CREW: 'better brakes — changes install and smoke-test cleanly',
  ENGINEER: 'a sharper engineer — it writes better patches',
  SCRUTINEER: 'a stricter scrutineer',
  HISTORIAN: 'a longer memory',
};
const HUE = { AERO: 'cyan', POWER_UNIT: 'red', TYRES: 'amber', DATA: 'green', SIMULATOR: 'cyan',
  ENGINEER: 'gold', STRATEGIST: 'purple', SCRUTINEER: 'white', HISTORIAN: 'gold', PIT_CREW: 'white' };

const st = { R: null, car: null, mesh: null, ground: null, orbit: 0.7, whip: 0, i: 0, t: 0,
             rounds: [], levels: {}, bars: {} };

function makeGround() {
  E.begin(); E.setGroup(0); E.setAux(0);
  E.Q([-8, 0, -8], [8, 0, -8], [8, 0, 8], [-8, 0, 8], E.M.CONCRETE);
  // a chequered strip under the nose, so the floor reads as a pit box rather than a void
  for (let k = -4; k < 4; k++) E.Q([k, 0.01, 3.1], [k + 1, 0.01, 3.1], [k + 1, 0.01, 3.9], [k, 0.01, 3.9],
    (k & 1) ? E.M.KERB_W : E.M.CARBON);
  return E.end();
}

function levelsAt(n) { return C.levelsAfter(st.rounds, n); }

function rebuild(bump) {
  st.levels = levelsAt(st.i);
  st.mesh = C.build(C.specForLevels(st.levels), C.eraForLevels(st.levels));
  if (bump && !reduced()) st.whip = 4.4;
  paintRail(bump);
}

function paintRail(bumped) {
  const host = $('ldRail'); if (!host) return;
  if (!host.children.length) {
    for (const k of C.ROLE_KEYS) {
      const b = document.createElement('i');
      b.dataset.k = k; b.title = k;
      b.style.setProperty('--hue', `var(--${HUE[k] || 'cyan'})`);
      host.append(b);
    }
  }
  // against the season's ceiling, so promoting one does not shrink the rest
  const ceiling = Math.max(2, 1 + st.rounds.filter(r => r.promoted).length);
  for (const b of host.children) {
    const lv = st.levels[b.dataset.k] || 1;
    b.style.height = (24 + 76 * (lv - 1) / (ceiling - 1)).toFixed(0) + '%';
    b.classList.toggle('up', b.dataset.k === bumped);
  }
}

function say() {
  // st.i is how many runs have been decided, so st.i - 1 is the one that just landed.
  const r = st.rounds[st.i - 1];
  const b = $('ldRun'), i = $('ldWhat');
  if (b) b.textContent = st.i === 0 ? 'START' : `RUN ${st.i}`;
  if (i) i.textContent = (st.i === 0 || !r || !r.promoted || !r.role)
    ? 'the harness it started with'
    : (SAYS[r.role] || 'a component it rewrote');
}

function frame(dt) {
  E.time += dt;
  st.whip = Math.max(0, st.whip - dt * 3.6);
  st.orbit += dt * (0.34 + st.whip);
  const R = st.R, cam = R.cam, rad = 5.5;
  cam.pos = [Math.sin(st.orbit) * rad, 1.55, Math.cos(st.orbit) * rad];
  cam.target = [0, 0.42, 0]; cam.fov = 30;
  R.begin(); R.gradient('#0C1236', '#06081A'); R.drawStatic(st.ground);
  const xf = C.makeXform(st.car, { pose: 'display' });
  R.drawDynamic(st.mesh, xf, 'shadow', 0); R.drawDynamic(st.mesh, xf, 'solid', 0);
  R.outline(); R.present();

  // step through the season on a slow beat, holding longer on a run that changed something
  st.t += dt;
  const r = st.rounds[st.i - 1];
  if (st.t > ((r && r.promoted) ? 3.4 : 2.1)) {
    st.t = 0;
    st.i = (st.i + 1) % (st.rounds.length + 1);
    const now = st.rounds[st.i - 1];
    rebuild(now && now.promoted ? now.role : null);
    say();
  }
}

L.state = () => st;          // same hook the pit board exposes, so this is testable from outside
L.boot = function () {
  const cv = $('ldCar'); if (!cv || !E || !C) return;
  const bundle = window.SCRUTINEER_LOOP || window.SCRUTINEER_PIT || {};
  st.rounds = (bundle.rounds || []).slice();
  st.R = E.createRenderer(cv, 384, 216, 1);
  st.R.ambient = 0.24; st.R.seamCutoff = 40;
  st.ground = makeGround();
  st.car = C.displayState(0, 0, 0);
  rebuild(null); say();
  let last = null;
  const tick = ts => {
    if (last === null) last = ts;
    const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    frame(dt); requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
})(window.SCR = window.SCR || {});
