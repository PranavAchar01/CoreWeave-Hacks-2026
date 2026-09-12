// ============================================================================
// SCR.pit — the pit board: the car on your desk while the loop runs behind it.
//
// A small card that stays on top, with a toy car lapping the season's circuit. Where the car is on
// the lap is how far the current run has got, and it crosses the line when the loop decides the run;
// a kept change rebuilds the car right there. Click or hover the card for the board: how far the
// agent has run, what it kept, what it is running on. Three ways to keep it in view:
//   · pop it out — Document Picture-in-Picture gives it a window of its own, above every app
//   · drag it anywhere on the page it lives in; it remembers where you left it
//   · embed it: one script tag, src="https://scrutineer-one.vercel.app/pit.js"
// Two sources, and the strip says which. LIVE when a `scrutineer watch` server answers: this
// origin first, then 127.0.0.1:7777. That second probe only ever succeeds from a page served over
// plain http — a browser will not let an https page reach a plain-http server, loopback included
// — so the hosted copy always replays and the live board is the one the loop serves itself.
// REPLAY is the recorded season shipped in the bundle, one generation every `every` seconds,
// around again when it ends. Nothing on the board is invented by the board: the numbers are the
// season's, live or recorded.
// ============================================================================
(function (SCR) {
'use strict';
const E = SCR.engine, C = SCR.car, S = SCR.sim, Wd = SCR.world, M = E.M, P = SCR.pit = {};
const W = 128, H = 80;                        // the board's own pixels; CSS doubles them, nearest neighbour
const LOCAL = 'http://127.0.0.1:7777';
const FONTS = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap';
const NAME = { AERO: 'RETRIEVAL', DATA: 'VERIFICATION', TYRES: 'SAMPLING', POWER_UNIT: 'MODEL',
  STRATEGIST: 'BUDGET', SIMULATOR: 'CURRICULUM', PIT_CREW: 'DEPLOY', ENGINEER: 'PROPOSER',
  SCRUTINEER: 'AUDIT', HISTORIAN: 'MEMORY' };
const WHY = { seesaw: 'the two splits disagreed', regression: 'it made the car slower', cost_cap: 'over the cost cap',
  scrutineering: 'black-flagged', diff_size: 'too big a change', comparable_ab: 'the A/B was not comparable',
  novelty: 'nothing new in it', evidence: 'not enough evidence', correlation: 'the splits did not track',
  ladder: "inside the sealed split's own noise",
  rl_entropy: 'the model collapsed', 'debrief gate': 'the debrief did not clear' };
const unchanged = r => r.rule_fired === 'no_upgrade' || r.rule_fired === 'circuit';
const esc = s => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const el = (t, c, txt) => { const n = document.createElement(t); if (c) n.className = c; if (txt !== undefined) n.textContent = txt; return n; };
const ease = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const canPip = () => 'documentPictureInPicture' in window;

const st = {
  source: 'probing', origin: '', demo: false, linkDown: false,
  rounds: [],                          // decided generations, oldest first
  levels: {}, run: 0, laps: 0, lap: 0, lapsRun: 0, race: '', busy: false, phase: '', error: null,
  claimed: null, official: null, since: 0, seenSeq: 0,
  replay: { all: [], i: 0, every: 24, at: 0, elapsed: 0, beat: 0, laps: 40 },
  orbit: 0, camYaw: 0, along: 0, whip: 0, fx: [], anim: null, card: null, cardTimer: 0,
  R: null, track: null, spec: null, mesh: null, car: null,
  root: null, host: null, win: window, raf: 0, last: 0, pip: null, vpip: null, placard: null, open: false, drag: null, boardAt: 0, stripTxt: '',
};
P.state = () => st;

// ---------- the circuit: the season's own, the same one the front page drives ----------
// Where the car is on the lap is how far the current run has got; crossing the line is the run
// being decided. So the lap is a progress bar you can read from across the room, and the speed
// on it is a real car's: brake for the corners, flat out on the straights, and the lap still ends
// exactly when the run does.
const ROAD = 6, KERB = 1.4, RUN_SHARE = 0.8;
const PHASE_AT = { RUN: 0, SCORE: 0.82, DIAGNOSE: 0.86, SELECT: 0.9, CHANGE: 0.93, GATES: 0.96, RESULT: 0.98 };
const wrap = (i, n) => ((i % n) + n) % n;
function makeTrack(seed) {
  const circ = Wd.makeCircuit(seed), pts = circ.pts, n = circ.n, step = circ.step;
  // how hard each stretch can be taken, then accelerate out of and brake into it
  const curvS = pts.map((_, i) => { let a = 0; for (let k = -12; k <= 12; k++) a += pts[wrap(i + k, n)].curv; return a / 25; });
  const v = pts.map(q => Math.min(78, Math.sqrt(34 / Math.max(1e-5, Math.abs(q.curv)))));
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; v[j] = Math.min(v[j], Math.sqrt(v[i] * v[i] + 2 * 11 * step)); }
    for (let i = n - 1; i >= 0; i--) { const j = (i + 1) % n; v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + 2 * 28 * step)); }
  }
  const tcum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) tcum[i + 1] = tcum[i] + step * 2 / (v[i] + v[(i + 1) % n]);
  const off = curvS.map(c => Math.max(-1, Math.min(1, c * 260)) * 3.1);   // the racing line: tuck in at the apex
  // the static world: striped grass, the road, kerbs where it turns, armco where there is room
  E.begin(); E.setGroup(0); E.setAux(0);
  const quad = (a, b, c, d, m) => {   // ground quads wind the one way the renderer expects
    const ux = b[0] - a[0], uz = b[2] - a[2], vx = c[0] - a[0], vz = c[2] - a[2];
    if (uz * vx - ux * vz < 0) E.Q(a, b, c, d, m); else E.Q(d, c, b, a, m);
  };
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const q of pts) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z); }
  const G = 18, gx0 = Math.floor((x0 - 90) / G) * G, gz0 = Math.floor((z0 - 90) / G) * G;
  for (let gx = gx0; gx < x1 + 90; gx += G) for (let gz = gz0; gz < z1 + 90; gz += G)
    quad([gx, 0, gz], [gx + G, 0, gz], [gx + G, 0, gz + G], [gx, 0, gz + G], ((gx - gx0) / G + (gz - gz0) / G) % 2 ? M.GRASS : M.GRASS2);
  const edge = (i, o) => { const q = pts[wrap(i, n)]; return [q.x + q.nx * o, 0, q.z + q.nz * o]; };
  for (let i = 0; i < n; i++) {
    const j = i + 1;
    quad(edge(i, -ROAD), edge(i, ROAD), edge(j, ROAD), edge(j, -ROAD), i === 0 ? M.KERB_W : M.ASPHALT);
    for (const sd of [-1, 1]) quad(edge(i, sd * (ROAD - 0.55)), edge(i, sd * (ROAD - 0.2)), edge(j, sd * (ROAD - 0.2)), edge(j, sd * (ROAD - 0.55)), M.KERB_W);
    if (Math.abs(curvS[i]) > 0.0045) for (const sd of [-1, 1])
      quad(edge(i, sd * ROAD), edge(i, sd * (ROAD + KERB)), edge(j, sd * (ROAD + KERB)), edge(j, sd * ROAD), (i >> 1) % 2 ? M.KERB_R : M.KERB_W);
    for (const sd of [-1, 1]) {
      const room = Math.min(circ.room(i, sd), circ.room(j, sd));
      if (room < 10) continue;
      const w = Math.min(room - 1, 13) * sd, a = edge(i, w), b = edge(j, w), h = 0.9;
      E.Q(a, b, [b[0], h, b[2]], [a[0], h, a[2]], M.ARMCO); E.Q(b, a, [a[0], h, a[2]], [b[0], h, b[2]], M.ARMCO);
    }
  }
  // the gantry over the line: where every run is decided
  const q0 = pts[0], yaw0 = Math.atan2(q0.tx, q0.tz), from = E.current().length;
  E.box(-ROAD - 1.2, 3, 0, 0.5, 6, 0.5, M.STEEL); E.box(ROAD + 1.2, 3, 0, 0.5, 6, 0.5, M.STEEL);
  E.box(0, 5.9, 0, ROAD * 2 + 2.9, 0.9, 0.6, M.NAVY);
  for (let k = -3; k <= 3; k++) E.box(k * 1.4, 5.9, 0.32, 0.8, 0.5, 0.05, k % 2 ? M.GOLD : M.LAMP);
  E.rotateRange(from, yaw0, q0.x, q0.z);
  const mesh = E.end();
  // the minimap: the same lap, a few pixels wide, in the corner of the card
  const MW = 30, MH = 19, sc = Math.min((MW - 2) / (x1 - x0), (MH - 2) / (z1 - z0));
  const padX = ((MW - 2) - (x1 - x0) * sc) / 2, padY = ((MH - 2) - (z1 - z0) * sc) / 2;
  const mini = pts.map(q => [Math.round(1 + padX + (q.x - x0) * sc), Math.round(1 + padY + (q.z - z0) * sc)]);
  return { circ, pts, n, step, v, tcum, T: tcum[n], off, curvS, mesh, mini, MW, MH };
}
// lap fraction (0..1 of lap time) -> distance along the lap, through the speed profile
function sAt(tr, frac) {
  const tt = (((frac % 1) + 1) % 1) * tr.T, a = tr.tcum;
  let lo = 0, hi = tr.n;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (a[mid] <= tt) lo = mid; else hi = mid; }
  const u = (tt - a[lo]) / Math.max(1e-9, a[lo + 1] - a[lo]);
  return (lo + u) * tr.step;
}
function poseAt(tr, s) {
  const f = s / tr.step, i = Math.floor(f), u = f - i, n = tr.n, A = tr.pts[wrap(i, n)], B = tr.pts[wrap(i + 1, n)];
  const o = tr.off[wrap(i, n)] + (tr.off[wrap(i + 1, n)] - tr.off[wrap(i, n)]) * u;
  return { x: A.x + (B.x - A.x) * u + (A.nx + (B.nx - A.nx) * u) * o, z: A.z + (B.z - A.z) * u + (A.nz + (B.nz - A.nz) * u) * o, curv: tr.curvS[wrap(i, n)] };
}
// where the run is, as a fraction of the lap: the laps fill the first 80 %, the loop's own phases
// the rest, and the line itself only when the result is in
function runFraction() {
  if (st.source === 'replay') return st.busy ? Math.min(0.995, st.replay.elapsed / st.replay.every) : 0;
  if (!st.busy) return 0;
  if (st.phase === 'RUN' || !st.phase) return st.laps ? RUN_SHARE * st.lap / st.laps : 0;
  return PHASE_AT[st.phase] !== undefined ? PHASE_AT[st.phase] : RUN_SHARE;
}
function drive(dt) {
  const tr = st.track, c = st.car;
  const target = st.rounds.length + runFraction();
  if (target < st.along - 0.5 || target - st.along > 1.5) st.along = target - 0.001;   // a new season, or back from a hidden tab
  const gap = target - st.along, rate = gap > 0.25 ? 1 / 4 : 1 / 12;
  st.along += Math.max(0, Math.min(gap, rate * dt * (1 + gap * 4)));
  const s = sAt(tr, st.along), p = poseAt(tr, s), ahead = poseAt(tr, s + 3), behind = poseAt(tr, s - 3);
  const speed = dt > 0 ? Math.hypot(p.x - c.x, p.z - c.z) / dt : 0;
  c.x = p.x; c.z = p.z; c.y = 0;
  c.yaw = Math.atan2(ahead.x - behind.x, ahead.z - behind.z);
  c.speed = speed;
  const k = 1 - Math.exp(-8 * dt), moving = speed > 1.5;
  c.steer += ((moving ? Math.max(-0.34, Math.min(0.34, p.curv * 24)) : 0) - c.steer) * k;
  c.roll += ((moving ? Math.max(-0.07, Math.min(0.07, -p.curv * speed * 0.9)) : 0) - c.roll) * k;
  c.pitch = 0; c.spin += speed * dt / 0.33; c.fanSpin += dt * (1.5 + speed * 0.2);
  c.drsAngle += ((moving && speed > 55 && Math.abs(p.curv) < 0.002 ? 0.75 : 0) - c.drsAngle) * k;
  if (!moving) {   // parked on the line between runs: a wink of DRS, a steering check
    const t = E.time % 9;
    if (t > 6 && t < 6.9) c.drsAngle = 0.75 * Math.sin((t - 6) / 0.9 * Math.PI);
    if (t > 2.5 && t < 4) c.steer = 0.3 * Math.sin((t - 2.5) / 1.5 * Math.PI * 2);
  }
}
function camera(dt) {
  const c = st.car, cam = st.R.cam, k = 1 - Math.exp(-3.2 * dt), calm = reduced();
  st.whip = Math.max(0, st.whip - dt * 4.5);
  let d = c.yaw - st.camYaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  st.camYaw += d * k;
  st.orbit += st.whip * dt * 1.87;                                   // a kept run: the camera goes once round the car
  if (!st.whip) { const home = Math.round(st.orbit / (2 * Math.PI)) * 2 * Math.PI; st.orbit += (home - st.orbit) * (1 - Math.exp(-1.5 * dt)); }
  const a = st.camYaw + st.orbit + (calm ? 0.35 : 0.35 + Math.sin(E.time * 0.21) * 0.4), dist = 9.5, h = 3.6;
  cam.pos = [c.x - Math.sin(a) * dist, h, c.z - Math.cos(a) * dist];
  cam.target = [c.x + Math.sin(c.yaw) * 2.5, 0.3, c.z + Math.cos(c.yaw) * 2.5]; cam.fov = 42;
}
function minimap(R) {
  const tr = st.track, px = R.px, w = R.W, ox = w - tr.MW - 2, oy = 2;
  for (let y = 0; y < tr.MH; y++) for (let x = 0; x < tr.MW; x++) { const o = ((oy + y) * w + ox + x) * 4; px[o] >>= 2; px[o + 1] >>= 2; px[o + 2] >>= 1; }
  const done = ((st.along % 1) + 1) % 1, iNow = Math.min(tr.n - 1, Math.floor(sAt(tr, done) / tr.step));
  const put = (x, y, r, g, b) => { const o = ((oy + y) * w + ox + x) * 4; px[o] = r; px[o + 1] = g; px[o + 2] = b; };
  tr.mini.forEach(([x, y], i) => i <= iNow && st.busy ? put(x, y, 244, 197, 66) : put(x, y, 82, 88, 114));
  put(tr.mini[0][0], tr.mini[0][1], 255, 255, 255);
  const [cx, cy] = tr.mini[iNow]; if ((E.time * 3 | 0) % 2 || !st.busy) put(cx, cy, 255, 255, 255); else put(cx, cy, 227, 30, 45);
}
function rebuild(animate) {
  st.spec = C.specForLevels(st.levels);
  const mesh = C.build(st.spec, C.eraForLevels(st.levels));
  if (animate && st.mesh) st.anim = { kind: 'kept', t: 0, len: reduced() ? 1.3 : 3.2, from: st.mesh, to: mesh, flash: 0, tint: 0, sparked: false };
  st.mesh = mesh;
  if (animate && !reduced()) st.whip = 5.5;
}
const lifted = (xf, dy) => (x, y, z, g, o) => { xf(x, y, z, g, o); o[1] += dy; };
function burst(n) {
  for (let k = 0; k < n; k++) {
    const h = E.hash2(k, st.fx.length + 1), h2 = E.hash2(k * 7 + 3, 11), wd = C.WHEELS[k & 3], o = [0, 0, 0];
    C.makeXform(st.car, { pose: 'display' })(wd.cx * 1.1, 0.15, wd.cz, 0, o);
    st.fx.push({ x: o[0], y: o[1], z: o[2], vx: (h - 0.5) * 9, vy: 2 + h2 * 4, vz: (h2 - 0.5) * 9, life: 0.45 + h * 0.5 });
  }
}
function tint(R, col, amount) {
  if (amount <= 0) return;
  const px = R.px, w = R.W, n = w * R.H;
  for (let i = 0; i < n; i++) { if (amount <= E.bayer(i % w, (i / w) | 0)) continue; const o = i * 4; px[o] = (px[o] + col[0]) >> 1; px[o + 1] = (px[o + 1] + col[1]) >> 1; px[o + 2] = (px[o + 2] + col[2]) >> 1; }
}
function renderAnim(a) {
  const R = st.R, t = a.t, xf = C.makeXform(st.car);
  if (a.kind === 'kept') {
    // the old car lifts away as a hologram; the new one rises into its place; then it stands
    // solid, the sparks fly and the flash pops. `fast` is the reduced-motion cut.
    const fast = a.len < 2, up = ease(t / (fast ? 0.25 : 0.5)), dn = ease((t - (fast ? 0.15 : 0.35)) / (fast ? 0.4 : 0.75)), solid = fast ? 0.6 : 1.1;
    if (t < solid * 0.5) R.drawDynamic(a.from, lifted(xf, up * 1.4), 'ghost', 0, M.HOLO);
    if (t >= (fast ? 0.15 : 0.35) && t < solid) R.drawDynamic(a.to, lifted(xf, -(1 - dn) * 0.9), 'ghost', 0, M.CYAN);
    if (t >= solid) { R.drawDynamic(a.to, xf, 'shadow', 0); R.drawDynamic(a.to, xf, 'solid', 0); if (!a.sparked) { a.sparked = true; burst(36); } }
    a.flash = fast ? 0 : t < 0.18 ? (0.18 - t) / 0.18 * 0.85 : t >= solid && t < solid + 0.25 ? (solid + 0.25 - t) / 0.25 * 0.6 : 0;
  } else {   // refused, or no change: the car stays; a red pulse, and a nudge of the camera
    R.drawDynamic(st.mesh, xf, 'shadow', 0); R.drawDynamic(st.mesh, xf, 'solid', 0);
    a.tint = t < 0.35 && !reduced() ? (0.35 - t) / 0.35 * 0.55 : 0;
  }
}
function frame(dt) {
  E.time += dt; drive(dt); camera(dt); S.stepSparks(st.fx, dt);
  const R = st.R; R.begin(); R.sky(); R.drawStatic(st.track.mesh);
  const a = st.anim;
  if (a) { a.t += dt; renderAnim(a); if (a.t > a.len) st.anim = null; }
  else { const xf = C.makeXform(st.car); R.drawDynamic(st.mesh, xf, 'shadow', 0); R.drawDynamic(st.mesh, xf, 'solid', 0); }
  S.drawSparks(R, st.fx); R.outline();
  if (a) { if (a.flash > 0) R.flash(a.flash); if (a.tint > 0) tint(R, [227, 30, 45], a.tint); }
  minimap(R);
  R.present();
}

// ---------- a generation landed ----------
function landed(r, animate) {
  st.rounds.push(r);
  const own = C.levelsAfter(st.rounds, st.rounds.length), given = r.levels || {};
  st.levels = Object.fromEntries(C.ROLE_KEYS.map(k => [k, Math.max(Number(given[k]) || 1, own[k] || 1)]));
  st.run = st.rounds.length; st.busy = false; st.lap = 0;
  if (r.promoted) rebuild(animate);
  else { rebuild(false); if (animate) { st.anim = { kind: 'refused', t: 0, len: 1.4, flash: 0, tint: 0 }; if (!reduced()) st.whip = 1.6; } }
  if (animate) card(r.promoted ? 'kept' : unchanged(r) ? 'none' : 'refused',
    r.promoted ? `<b>KEPT</b> ${esc(NAME[r.role] || r.role)} <i>L${level(r.role)}</i>`
      : r.rule_fired === 'circuit' ? '<b>NO CHANGE</b> it changed the practice set instead'
      : r.rule_fired === 'no_upgrade' ? '<b>NO CHANGE</b> not enough evidence'
      : `<b>REFUSED</b> ${esc(NAME[r.role] || r.role || '')} <i>${esc(WHY[(r.failed || [])[0]] || (r.failed || [])[0] || 'thrown out')}</i>`);
  paint(true);
}
function card(kind, html) {
  const c = st.card; if (!c) return;
  clearTimeout(st.cardTimer);
  c.className = 'pit-card ' + kind; c.innerHTML = html;
  st.placard = { kind, text: c.textContent.replace(/\s+/g, ' ').trim(), until: Date.now() + 3400 };
  void c.offsetWidth; c.classList.add('show');
  st.cardTimer = setTimeout(() => c.classList.remove('show'), 3400);
}

// ---------- replay: the recorded season, on a clock ----------
function goReplay() {
  const L = window.SCRUTINEER_PIT || {};
  st.source = 'replay'; st.demo = !!L.demo; st.replay.all = (L.rounds || []).slice();
  const q = new URLSearchParams(location.search).get('every');
  if (q && +q >= 2) st.replay.every = +q;
  st.laps = st.replay.laps; st.busy = st.replay.all.length > 0; st.phase = 'RUN';
  paint(true);
}
// The replay keeps wall-clock time, not frame time: a tab in the background draws no frames, but
// its rounds still fall due, and when it comes back every round that fell due lands at once —
// silently but for the last, so the board catches up without a burst of placards.
function replayTick() {
  const now = Date.now(), rp = st.replay; if (!rp.all.length) return;
  if (!rp.at) rp.at = now;
  const elapsed = (now - rp.at) / 1000;
  if (rp.beat) {                                          // the beat between seasons
    if (elapsed < rp.beat) return;
    rp.beat = 0; rp.at = now; rp.i = 0;
    st.rounds = []; st.levels = C.levelsAfter([], 0); st.run = 0; st.lapsRun = 0; st.lap = 0; rebuild(true);
    card('none', '<b>NEW SEASON</b> back to level one'); paint(true);
    return;
  }
  const due = Math.floor(elapsed / rp.every);
  for (let k = 0; k < due && rp.i < rp.all.length; k++) {
    const r = rp.all[rp.i], last = k === due - 1 || rp.i === rp.all.length - 1;
    st.lapsRun += (r.laps || rp.laps) - st.lap;
    landed(r, last); rp.i++; rp.at += rp.every * 1000;
    if (rp.i >= rp.all.length) { rp.beat = 6; rp.at = now; st.busy = false; st.phase = 'END'; rp.elapsed = 0; return; }
  }
  const r = rp.all[rp.i], t = (now - rp.at) / 1000;
  rp.elapsed = t; st.busy = true; st.laps = r.laps || rp.laps;
  const lap = Math.min(st.laps, Math.floor(t / rp.every * st.laps));
  if (lap !== st.lap) { st.lapsRun += Math.max(0, lap - st.lap); st.lap = lap; }
  st.phase = t / rp.every < 0.7 ? 'RUN' : t / rp.every < 0.86 ? 'DIAGNOSE' : 'GATES';
}

// ---------- live: a `scrutineer watch` server, here or on this machine ----------
async function probe(origin) {
  try {
    const r = await fetch(origin + '/api/state', { cache: 'no-store', signal: AbortSignal.timeout(1500) });
    if (!r.ok) return null; const j = await r.json(); return j && j.live ? j : null;
  } catch (e) { return null; }
}
const loopback = o => { try { const u = new URL(o); return u.hostname === '127.0.0.1' || u.hostname === 'localhost' || u.hostname === '[::1]'; } catch (e) { return false; } };
async function detect(pref) {
  const here = /^https?:/.test(location.origin) ? location.origin : '';
  if (pref && pref !== 'replay' && pref !== here && !loopback(pref)) pref = 'replay';
  const cands = pref === 'replay' ? [] : pref ? [pref] : [here, location.protocol === 'http:' ? LOCAL : ''].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
  for (const o of cands) { const s = await probe(o); if (s) { goLive(o, s); return; } }
  goReplay();
  if (pref || location.protocol !== 'http:' || !cands.length) return;
  const again = setInterval(async () => {
    for (const o of cands) { const s = await probe(o); if (!s) continue;
      clearInterval(again); st.replay.all = []; st.rounds = []; st.lapsRun = 0; st.levels = C.levelsAfter([], 0);
      goLive(o, s); rebuild(false); paint(true); paintActions(); return; }
  }, 20000);
}
function goLive(origin, s) {
  st.source = 'live'; st.origin = origin; st.busy = !!s.busy; st.error = s.error || null;
  if (st.root) paintActions();
  if (s.levels && Object.keys(s.levels).length) { st.levels = s.levels; rebuild(false); }
  st.run = s.run || 0;
  const es = new EventSource(origin + '/api/events'); st.es = es;
  // the server replays its whole history on every connect; those are facts, not news
  let warm = true, timer = 0;
  const settle = () => { clearTimeout(timer); timer = setTimeout(() => { warm = false; paint(true); }, 900); };
  es.onmessage = ev => { let d; try { d = JSON.parse(ev.data); } catch (e) { return; }
    if (d.seq !== undefined) { if (d.seq <= st.seenSeq) return; st.seenSeq = d.seq; }
    if (warm) settle(); st.linkDown = false; onLive(d, !warm); };
  es.onopen = () => {
    if (!st.linkDown) return;
    st.linkDown = false; st.seenSeq = 0; st.rounds = []; st.lapsRun = 0; st.error = null;
    warm = true; settle(); paint(true);
  };
  es.onerror = () => { st.linkDown = true; paint(true); };
  settle(); paint(true);
}
function onLive(d, fresh) {
  if (d.kind === 'phase') { st.phase = d.phase; if (d.phase === 'RUN') { st.run = d.generation + 1; st.lap = 0; st.laps = d.total || 0; st.busy = true; st.error = null; }
    if (d.levels && !fresh) { st.levels = d.levels; rebuild(false); } }
  else if (d.kind === 'lap') { if (d.race !== st.race) { st.race = d.race; st.lap = 0; } st.lap = d.index; st.laps = d.total; st.lapsRun++; }
  else if (d.kind === 'score') { st.claimed = d.claimed; st.official = d.official; }
  else if (d.kind === 'result') { landed({ generation: d.generation, promoted: !!d.promoted, role: d.role || null, part: d.part || null,
    rule_fired: d.rule || null, failed: d.failed || [], official_s: st.official, claimed_s: st.claimed, levels: d.levels }, fresh); return; }
  else if (d.kind === 'error') { st.error = d.message; st.busy = false; }
  else if (d.kind === 'boot') { st.phase = 'BOOT'; st.busy = true; st.error = null; }
  paint(d.kind !== 'lap');
}

// ---------- the board ----------
function fmtT(s) { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), q = s % 60; return `${h ? h + ':' : ''}${h && m < 10 ? '0' : ''}${m}:${q < 10 ? '0' : ''}${q}`; }
const kept = () => st.rounds.filter(r => r.promoted).length;
// a level is a small counting number or it is nothing; the board renders no server's value verbatim
const level = k => { const n = Math.floor(Number((st.levels || {})[k])); return n >= 1 && n <= 99 ? n : 1; };
// paint(now): the strip every time; the board when it is open and something changed, or once a
// second for the clocks. The actions row is built once so a button is never replaced under a click.
function paint(now) {
  const root = st.root; if (!root) return;
  const src = st.source === 'live' ? 'LIVE' : st.source === 'replay' ? 'REPLAY' : '';
  const runNo = st.busy ? (st.source === 'live' && st.run ? st.run : st.rounds.length + 1) : st.rounds.length;
  const txt = st.source === 'probing' ? 'LOOKING FOR THE LOOP'
    : st.error ? `${src} · RUN STOPPED` : st.busy && st.laps && (st.phase === 'RUN' || !st.phase) ? `${src} RUN ${runNo} · LAP ${st.lap}/${st.laps}`
    : st.busy ? `${src} RUN ${runNo} · ${st.phase || 'STARTING'}` : `${src} · RUN ${runNo} · KEPT ${kept()}`;
  if (txt !== st.stripTxt) { st.stripTxt = txt; root.querySelector('.pit-txt').textContent = txt; }
  const dot = root.querySelector('.pit-dot'), dc = 'pit-dot ' + (st.source === 'live' ? (st.linkDown ? 'down' : st.busy ? 'busy' : 'live') : st.source === 'replay' ? 'replay' : 'probe');
  if (dot.className !== dc) { dot.className = dc; dot.title = st.source === 'live' ? `live · ${st.origin}` : st.source === 'replay' ? 'replaying the recorded season' : 'looking for a running loop'; }
  if (!st.open) return;
  const t = Date.now(); if (!now && t - st.boardAt < 1000) return; st.boardAt = t;
  paintBoard();
}
function paintBoard() {
  const b = st.root.querySelector('.pb-body'); b.innerHTML = '';
  const total = st.source === 'replay' ? st.replay.all.length : 0, last = st.rounds[st.rounds.length - 1], first = st.rounds[0];
  const score = last && typeof last.official_s === 'number' ? last.official_s : null;
  const gain = score !== null && first && typeof first.official_s === 'number' ? first.official_s - score : 0;
  const head = el('div', 'pb-head'); head.append(el('b', '', 'PIT BOARD'));
  head.append(el('span', 'pb-src ' + st.source, st.source === 'live' ? `LIVE · ${st.origin.replace(/^https?:\/\//, '')}`
    : st.source === 'replay' ? (st.demo ? 'REPLAY · DEMO SEASON' : 'REPLAY · RECORDED') : 'PROBING'));
  b.append(head);
  const big = el('div', 'pb-big');
  const cell = (k, v, u) => { const c = el('span'); c.innerHTML = `<em>${k}</em><b>${esc(v)}</b>${u ? `<i>${esc(u)}</i>` : ''}`; return c; };
  big.append(cell('RUNS', st.rounds.length, total ? `of ${total}` : ''), cell('KEPT', kept(), ''), cell('LAPS', st.lapsRun, ''),
             cell('SCORE', score === null ? '—' : score.toFixed(2), score === null ? '' : 's'));
  b.append(big);
  b.append(el('div', 'pb-gain', score === null ? (st.source === 'live' ? 'no run scored yet' : '') : gain > 0.005 ? `−${gain.toFixed(2)} s since the start · held-out score` : 'the harness it started with · held-out score'));
  if (st.rounds.length || total) {
    const ticks = el('div', 'pb-ticks'), n = Math.max(st.rounds.length, total);
    for (let k = 0; k < n; k++) { const r = st.rounds[k]; ticks.append(el('i', r ? (r.promoted ? 'keep' : unchanged(r) ? 'none' : 'drop') : 'todo')); }
    if (st.busy && st.laps) { const p = el('i', 'now'); p.style.setProperty('--p', (st.lap / st.laps).toFixed(3)); ticks.append(p); }
    b.append(ticks);
  }
  const rig = el('div', 'pb-rig');
  for (const k of C.ROLE_KEYS) { const lv = level(k), row = el('div', 'pb-comp' + (lv > 1 ? ' up' : '') + (last && last.promoted && last.role === k ? ' now' : ''));
    row.innerHTML = `<span>${esc(NAME[k])}</span><b>${'▮'.repeat(Math.min(6, lv))}</b><em>L${esc(lv)}</em>`; rig.append(row); }
  b.append(rig);
  if (last) { const l = el('div', 'pb-last');
    l.innerHTML = last.promoted ? `<b class="k">KEPT</b> ${esc(NAME[last.role] || last.role)} → L${level(last.role)}${last.part ? ` <code>${esc(last.part)}</code>` : ''}${last.summary ? `<span>${esc(last.summary)}</span>` : ''}`
      : last.rule_fired === 'circuit' ? '<b class="n">NO CHANGE</b> it changed the practice set instead of a component'
      : last.rule_fired === 'no_upgrade' ? '<b class="n">NO CHANGE</b> nothing had enough evidence behind it'
      : `<b class="d">REFUSED</b> ${esc(NAME[last.role] || last.role || '')} <span>${esc(WHY[(last.failed || [])[0]] || (last.failed || [])[0] || 'its own gates threw it out')}</span>`;
    b.append(l); }
  const up = fmtT((Date.now() - st.since) / 1000);
  b.append(el('div', 'pb-foot', st.error ? `stopped: ${st.error}`
    : st.source === 'live' ? (st.linkDown ? 'link down · reconnecting' : st.busy ? `running · ${st.phase || 'RUN'} · watching for ${up}` : `idle · waiting for a run · watching for ${up}`)
    : st.source === 'replay' ? (st.phase === 'END' ? 'season over · starting again' : `next run in ${Math.max(0, Math.ceil(st.replay.every - st.replay.elapsed))} s · on the board ${up}`)
    : 'looking for a loop on this origin and on 127.0.0.1:7777'));
}
function paintActions() {
  const a = st.root.querySelector('.pb-actions'); a.innerHTML = '';
  if (canPip() || canVideoPip()) { const pb = el('button', 'pb-btn', st.pip || st.vpip ? 'BRING IT BACK' : 'POP OUT ↗'); pb.type = 'button';
    pb.addEventListener('click', ev => { ev.stopPropagation(); togglePop(); }); a.append(pb); }
  const link = el('a', 'pb-link', 'TELEMETRY ↗');
  link.href = (st.source === 'live' && (st.origin === location.origin || loopback(st.origin)) ? st.origin : 'https://scrutineer-one.vercel.app') + '/telemetry'; link.target = '_blank'; link.rel = 'noopener'; a.append(link);
}

// ---------- the card on the page: drag, hover, pop out ----------
function place(x, y) {
  const r = st.root, w = r.offsetWidth, h = r.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
  x = Math.max(4, Math.min(vw - w - 4, x)); y = Math.max(4, Math.min(vh - h - 4, y));
  r.style.left = x + 'px'; r.style.top = y + 'px'; r.style.right = 'auto'; r.style.bottom = 'auto';
  try { localStorage.setItem('scrutineer.pit.pos', JSON.stringify([x, y])); } catch (e) { /* private mode */ }
}
function restore() {
  try { const p = JSON.parse(localStorage.getItem('scrutineer.pit.pos') || 'null'); if (p && p.length === 2) place(p[0], p[1]); } catch (e) { /* stay in the corner */ }
}
function setOpen(on) {
  const r = st.root; st.open = on;
  if (on) { const b = r.getBoundingClientRect(); r.classList.toggle('up', !st.pip && b.top + b.height / 2 > window.innerHeight / 2); paint(true); }
  r.classList.toggle('open', on);
}
function wire() {
  const r = st.root, strip = r.querySelector('.pit-strip');
  strip.addEventListener('pointerdown', ev => {
    if (st.pip || ev.button !== 0) return;
    const b = r.getBoundingClientRect(); st.drag = { dx: ev.clientX - b.left, dy: ev.clientY - b.top };
    strip.setPointerCapture(ev.pointerId); r.classList.add('dragging');
  });
  strip.addEventListener('pointermove', ev => { if (st.drag) place(ev.clientX - st.drag.dx, ev.clientY - st.drag.dy); });
  const drop = () => { if (!st.drag) return; st.drag = null; r.classList.remove('dragging'); if (st.open) setOpen(true); };
  strip.addEventListener('pointerup', drop); strip.addEventListener('pointercancel', drop);
  // hover opens the board; a tap on the car does the same on a screen with no hover
  r.addEventListener('mouseenter', () => { if (!st.open) st.openedAt = Date.now(); setOpen(true); }); r.addEventListener('mouseleave', () => setOpen(false));
  r.addEventListener('focusin', () => setOpen(true)); r.addEventListener('focusout', ev => { if (!r.contains(ev.relatedTarget)) setOpen(false); });
  r.querySelector('canvas').addEventListener('click', () => { if (st.open && Date.now() - (st.openedAt || 0) < 400) return; setOpen(!st.open); });
  r.addEventListener('keydown', ev => { if (ev.key === 'Escape') setOpen(false); });
  window.addEventListener('resize', () => { if (!st.pip && r.style.left) place(parseFloat(r.style.left), parseFloat(r.style.top)); });
  const pop = r.querySelector('.pit-pop');
  if (!canPip() && !canVideoPip()) pop.hidden = true;
  pop.addEventListener('pointerdown', ev => ev.stopPropagation());
  pop.addEventListener('click', ev => { ev.stopPropagation(); togglePop(); });
}
// ---------- the pop-out ----------
// Chrome gives a document picture-in-picture window a title bar with the site's address and the
// system's window buttons, and no page can take them off. A video picture-in-picture window has
// neither: it is only the picture, with its controls on hover. So the pop-out is a live video of
// the card, drawn frame by frame, and its play/pause button flips between the car and the board.
// Where a browser has no video pop-out, the document window is still there.
const VW = 512, VH = 360, SH = 40;
const canVideoPip = () => !!(document.pictureInPictureEnabled && HTMLCanvasElement.prototype.captureStream);
function togglePop() { if (st.vpip) stopVideoPip(); else if (st.pip) st.pip.close(); else P.popOut(); }
P.popOut = async function () {
  if (st.pip || st.vpip) return true;
  if (canVideoPip() && await videoPip()) return true;
  return docPip();
};
async function videoPip() {
  const cv = el('canvas'); cv.width = VW; cv.height = VH;
  const manual = !!(window.CanvasCaptureMediaStreamTrack && 'requestFrame' in CanvasCaptureMediaStreamTrack.prototype);
  const stream = cv.captureStream(manual ? 0 : 30), track = stream.getVideoTracks()[0];
  const video = el('video'); video.muted = true; video.playsInline = true; video.setAttribute('aria-hidden', 'true');
  video.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
  document.body.append(video); video.srcObject = stream;
  const v = st.vpip = { cv, ctx: cv.getContext('2d'), track, manual, video, board: false, last: 0, worker: null, timer: 0 };
  composeFrame();
  try {
    await Promise.race([video.play(), new Promise((_, no) => setTimeout(() => no(new Error('no frame')), 1500))]);
    await video.requestPictureInPicture();
  } catch (e) { stopVideoPip(); return false; }
  video.addEventListener('leavepictureinpicture', () => stopVideoPip(), { once: true });
  // a hidden tab draws no animation frames, but a worker's clock keeps running, so the car keeps lapping
  try { st.win.cancelAnimationFrame(st.raf); } catch (e) { /* nothing was scheduled */ }
  const step = () => {
    if (st.vpip !== v) return;
    const now = performance.now(), dt = v.last ? Math.min(0.05, (now - v.last) / 1000) : 0; v.last = now;
    frame(dt); if (st.source === 'replay') replayTick(); paint(false); composeFrame();
  };
  const interval = () => { if (!v.timer) v.timer = setInterval(step, 33); };
  try {
    v.worker = new Worker(URL.createObjectURL(new Blob(['setInterval(function(){postMessage(0)},33)'], { type: 'text/javascript' })));
    v.worker.onmessage = step; v.worker.onerror = () => { v.worker.terminate(); v.worker = null; interval(); };
  } catch (e) { interval(); }   // a page whose policy refuses workers still gets a clock, a slower one when hidden
  if ('mediaSession' in navigator) {
    const flip = () => { v.board = !v.board; composeFrame(); video.play().catch(() => {}); };
    for (const a of ['play', 'pause', 'nexttrack', 'previoustrack']) { try { navigator.mediaSession.setActionHandler(a, flip); } catch (e) { /* not offered here */ } }
  }
  paintActions();
  return true;
}
function stopVideoPip() {
  const v = st.vpip; if (!v) return; st.vpip = null;
  if (v.worker) v.worker.terminate(); if (v.timer) clearInterval(v.timer);
  try { if (document.pictureInPictureElement === v.video) document.exitPictureInPicture(); } catch (e) { /* already closed */ }
  v.track.stop(); v.video.remove();
  if ('mediaSession' in navigator) for (const a of ['play', 'pause', 'nexttrack', 'previoustrack']) { try { navigator.mediaSession.setActionHandler(a, null); } catch (e) { /* not offered here */ } }
  swapLoop(window); paintActions(); paint(true);
}
// one frame of the pop-out: the car (or the board), the strip under it, and any placard
function composeFrame() {
  const v = st.vpip; if (!v) return;
  const g = v.ctx, px = '"Press Start 2P","Courier New",monospace', big = '"VT323","Courier New",monospace';
  g.imageSmoothingEnabled = false;
  if (v.board) drawPipBoard(g, px, big);
  else {
    g.drawImage(st.root.querySelector('canvas'), 0, 0, VW, VH - SH);
    const pc = st.placard;
    if (pc && Date.now() < pc.until) {
      const bg = pc.kind === 'refused' ? '#E31E2D' : pc.kind === 'none' ? '#C8CBD8' : '#F4C542';
      g.fillStyle = '#000'; g.fillRect(16, VH - SH - 66, VW - 32, 46); g.fillStyle = bg; g.fillRect(16, VH - SH - 70, VW - 32, 46);
      g.fillStyle = pc.kind === 'refused' ? '#FFF' : '#000'; g.font = `14px ${px}`; g.textBaseline = 'middle';
      g.fillText(pc.text.toUpperCase().slice(0, 30), 30, VH - SH - 47);
    }
  }
  g.fillStyle = '#000'; g.fillRect(0, VH - SH, VW, SH);
  g.fillStyle = st.source === 'live' ? (st.linkDown ? '#E31E2D' : '#2FD968') : st.source === 'replay' ? '#3DD2FF' : '#6A6F8A';
  g.fillRect(14, VH - SH / 2 - 6, 12, 12);
  g.fillStyle = '#FFF'; g.font = `12px ${px}`; g.textBaseline = 'middle';
  g.fillText((st.stripTxt || '').slice(0, 28), 38, VH - SH / 2 + 1);
  // the pop-out's own pause button is what flips the view, so the hint draws that button
  g.fillStyle = '#6A6F8A'; g.font = `9px ${px}`; g.textAlign = 'right';
  const hint = v.board ? 'CAR' : 'BOARD', hw = g.measureText(hint).width;
  g.fillText(hint, VW - 12, VH - SH / 2 + 1); g.textAlign = 'left';
  g.fillRect(VW - 12 - hw - 16, VH - SH / 2 - 5, 3, 10); g.fillRect(VW - 12 - hw - 10, VH - SH / 2 - 5, 3, 10);
  g.fillStyle = '#121A4A'; g.fillRect(0, VH - 3, VW, 3);
  g.fillStyle = '#F4C542'; g.fillRect(0, VH - 3, Math.round(VW * runFraction()), 3);
  if (v.manual) v.track.requestFrame();
}
function drawPipBoard(g, px, big) {
  const H = VH - SH, total = st.source === 'replay' ? st.replay.all.length : 0, last = st.rounds[st.rounds.length - 1];
  g.fillStyle = '#06081A'; g.fillRect(0, 0, VW, H);
  g.textBaseline = 'alphabetic'; g.font = `14px ${px}`; g.fillStyle = '#F4C542'; g.fillText('PIT BOARD', 20, 36);
  g.fillRect(20, 42, 126, 2);
  g.font = `9px ${px}`; g.textAlign = 'right'; g.fillStyle = st.source === 'live' ? '#2FD968' : '#3DD2FF';
  g.fillText(st.source === 'live' ? 'LIVE' : st.demo ? 'REPLAY · DEMO SEASON' : 'REPLAY', VW - 20, 36); g.textAlign = 'left';
  const score = last && typeof last.official_s === 'number' ? last.official_s.toFixed(2) : '—';
  [['RUNS', `${st.rounds.length}`, total ? `of ${total}` : ''], ['KEPT', `${kept()}`, ''], ['LAPS', `${st.lapsRun}`, ''], ['SCORE', score, score === '—' ? '' : 's']]
    .forEach(([k, val, unit], i) => {
      const x = 20 + i * 122;
      g.font = `8px ${px}`; g.fillStyle = '#6A6F8A'; g.fillText(k, x, 74);
      g.font = `46px ${big}`; g.fillStyle = '#F4C542'; g.fillText(val, x, 116);
      if (unit) { const w = g.measureText(val).width; g.font = `20px ${big}`; g.fillStyle = '#6A6F8A'; g.fillText(unit, x + w + 6, 116); }
    });
  const n = Math.max(st.rounds.length, total), tw = Math.min(40, (VW - 40) / Math.max(1, n) - 4);
  for (let k = 0; k < n; k++) {
    const r = st.rounds[k], x = 20 + k * (tw + 4);
    g.fillStyle = !r ? '#121A4A' : r.promoted ? '#F4C542' : unchanged(r) ? '#6A6F8A' : '#E31E2D';
    g.fillRect(x, 134, tw, 12);
  }
  C.ROLE_KEYS.forEach((key, i) => {
    const col = i % 2, row = Math.floor(i / 2), x = 20 + col * 246, y = 178 + row * 26, lv = level(key), hot = last && last.promoted && last.role === key;
    g.font = `9px ${px}`; g.fillStyle = hot ? '#F4C542' : lv > 1 ? '#FFFFFF' : '#6A6F8A'; g.fillText(NAME[key], x, y);
    for (let b = 0; b < Math.min(6, lv); b++) { g.fillStyle = hot && b === lv - 1 ? '#2FD968' : '#F4C542'; g.fillRect(x + 128 + b * 12, y - 9, 9, 10); }
    g.font = `20px ${big}`; g.fillStyle = '#6A6F8A'; g.fillText(`L${lv}`, x + 206, y + 1);
  });
}
async function docPip() {
  if (!canPip()) return false;
  let w; try { w = await window.documentPictureInPicture.requestWindow({ width: 288, height: 230 }); } catch (e) { return false; }
  for (const n of document.querySelectorAll('link[data-pit],style[data-pit]')) w.document.head.append(n.cloneNode(true));
  w.document.title = 'Scrutineer · pit board'; w.document.body.className = 'pit-pipbody';
  w.document.body.append(st.root); st.root.classList.add('inpip'); st.root.classList.remove('open', 'up'); st.open = false;
  st.pip = w; swapLoop(w); paintActions();
  w.addEventListener('pagehide', () => {
    if (st.pip !== w) return;
    st.pip = null; st.host.append(st.root); st.root.classList.remove('inpip'); restore(); swapLoop(window); paintActions(); paint(true);
  });
  return true;
}
// the animation loop runs on whichever window holds the card: a background tab stops its own
// frames, but the popped-out window keeps drawing
function swapLoop(win) {
  try { st.win.cancelAnimationFrame(st.raf); } catch (e) { /* the old window is gone */ }
  st.win = win; st.last = 0;
  const tick = now => {
    if (!st.last) st.last = now; const dt = Math.min(0.05, (now - st.last) / 1000); st.last = now;
    frame(dt); if (st.source === 'replay') replayTick(); paint(false);
    st.raf = win.requestAnimationFrame(tick);
  };
  st.raf = win.requestAnimationFrame(tick);
}
function ensureStyles() {
  if (!document.querySelector('link[data-pit]')) { const l = el('link'); l.rel = 'stylesheet'; l.href = FONTS; l.dataset.pit = '1'; document.head.append(l); }
  if (!document.querySelector('style[data-pit]') && window.SCRUTINEER_PIT_CSS) { const s = el('style'); s.dataset.pit = '1'; s.textContent = window.SCRUTINEER_PIT_CSS; document.head.append(s); }
}

// mount({host, source}) — source: 'auto' (default) | 'replay' | an origin such as http://127.0.0.1:7777
P.mount = function (opts = {}) {
  if (document.fonts && document.fonts.load) { document.fonts.load('12px "Press Start 2P"').catch(() => {}); document.fonts.load('20px "VT323"').catch(() => {}); }
  if (st.root) { if (opts.dock === false) { st.dock = false; st.root.classList.add('pit-away'); } return P; }
  st.dock = opts.dock !== false;
  ensureStyles();
  st.host = opts.host || document.body; st.since = Date.now();
  const root = st.root = el('div', 'pit'); root.tabIndex = 0; root.setAttribute('role', 'group'); root.setAttribute('aria-label', 'Scrutineer pit board');
  root.innerHTML = '<canvas width="128" height="80" aria-label="the car, as the harness stands now"></canvas>'
    + '<div class="pit-card" aria-live="polite"></div>'
    + '<div class="pit-strip"><i class="pit-dot probe"></i><span class="pit-txt">LOOKING FOR THE LOOP</span>'
    + '<button class="pit-pop" type="button" title="pop out — a window of its own, above every app" aria-label="pop out">↗</button></div>'
    + '<div class="pit-board"><div class="pb-body"></div><div class="pb-actions"></div></div>';
  if (!st.dock) root.classList.add('pit-away');
  st.host.append(root); st.card = root.querySelector('.pit-card');
  st.R = E.createRenderer(root.querySelector('canvas'), W, H, 1); st.R.ambient = 0.22; st.R.seamCutoff = 40;
  const L = window.SCRUTINEER_PIT || {};
  st.track = makeTrack(L.seed === undefined ? 1994 : L.seed); Wd.applyVenue(st.R, st.track.circ.venue);
  st.car = C.newState(); drive(0); st.camYaw = st.car.yaw;
  st.levels = C.levelsAfter([], 0); rebuild(false);
  restore(); wire(); paintActions(); paint(true); swapLoop(window);
  const q = new URLSearchParams(location.search).get('source');
  detect(opts.source && opts.source !== 'auto' ? opts.source : q || undefined);
  return P;
};
P.land = (r, animate = true) => landed(r, animate);   // for a page that drives the board itself
{
  const me = document.currentScript;
  if (me && me.dataset.pit !== 'manual') {
    const go = () => P.mount({ source: me.dataset.source });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  }
}
})(window.SCR = window.SCR || {});
