// ============================================================================
// SCR.scenes — the scrutineering bay, parc fermé and the season finale (3D sets on the engine)
// Each scene: enter(app, payload) · update(dt) · render() · exit() · done · duration · t
// All motion runs on scene time accumulated from the simulation clock (never wall-clock), so seeks replay exactly.
// Cards (stamps, verdicts, champion card) live in the DOM layer #cards and are rebuilt from scene time each frame.
// ============================================================================
(function (SCR) {
'use strict';
const E = SCR.engine, M = E.M, S = SCR.scenes = SCR.scenes || {};
const { box, Q, T } = E;
const COL = { white: E.hex('#FFFFFF'), gold: E.hex('#F4C542'), red: E.hex('#E31E2D'), cyan: E.hex('#3DD2FF'), green: E.hex('#2FD968'), purple: E.hex('#B04BFF'), caption: E.hex('#C8CBD8'), lamp: E.hex('#FFE08A') };
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v, easeOut = u => 1 - (1 - u) * (1 - u) * (1 - u), easeIn = u => u * u * u, smooth = u => u * u * (3 - 2 * u), lerp = (a, b, u) => a + (b - a) * u;
const pad2 = n => (n < 10 ? '0' : '') + n;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PX = 'font-family:"Press Start 2P","Courier New",monospace;text-transform:uppercase;';
const VT = 'font-family:"VT323","Courier New",monospace;';

// ---------- shared builders ----------
const carCache = new Map();
function carMesh(spec, era) { const k = JSON.stringify(spec) + '|' + era.toFixed(2); let m = carCache.get(k); if (!m) { if (carCache.size > 6) carCache.clear(); m = SCR.car.build(spec, era); carCache.set(k, m); } return m; }
// pixel-font sign quad: o = bottom-left, r/u unit vectors, width in world units. Returns the sign height.
function sign(text, o, r, u, width, fg, bg) {
  const cell = width / (text.length * 4 + 1), h = cell * 5.6;
  E.setAux(E.signs.length); E.signs.push({ text, o, r, u, cell, fg, bg });
  const b = [o[0] + r[0] * width, o[1] + r[1] * width, o[2] + r[2] * width], c = [b[0] + u[0] * h, b[1] + u[1] * h, b[2] + u[2] * h], d = [o[0] + u[0] * h, o[1] + u[1] * h, o[2] + u[2] * h];
  Q(o, b, c, d, M.SIGN); E.setAux(0); return h;
}
// double-sided quad (dynamic meshes are back-face culled; light sheets and discs must read from any side)
function quad2(a, b, c, d, m) { Q(a, b, c, d, m); Q(d, c, b, a, m); }
function disc(r, y, n, m) { for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, p = [Math.cos(a0) * r, y, Math.sin(a0) * r], q = [Math.cos(a1) * r, y, Math.sin(a1) * r]; T([0, y, 0], p, q, m); T([0, y, 0], q, p, m); } }
// marshal figure. groups: 0 body · 1 head (idle bob) · 2 right arm (tablet, or a flag pole that can be raised)
const figCache = new Map();
function figure(kind, flagMat) {
  const k = kind + '|' + flagMat; if (figCache.has(k)) return figCache.get(k);
  E.begin(); E.setGroup(0); E.setAux(0);
  for (const s of [-1, 1]) box(s * 0.11, 0.44, 0, 0.17, 0.84, 0.2, M.OVERALL);
  box(0, 0.05, 0.03, 0.46, 0.1, 0.3, M.CARBON);
  box(0, 1.12, 0, 0.46, 0.6, 0.26, M.OVERALL); box(0, 1.1, 0, 0.5, 0.42, 0.3, M.AMBER); box(0, 1.16, 0, 0.52, 0.05, 0.32, M.PANEL);
  box(-0.31, 1.12, 0, 0.14, 0.56, 0.16, M.OVERALL);
  E.setGroup(1); E.sphere(0, 1.6, 0, 0.14, 5, 8, M.SKIN); box(0, 1.71, 0.01, 0.3, 0.08, 0.3, M.NAVY); box(0, 1.68, 0.2, 0.28, 0.04, 0.12, M.NAVY);
  if (kind === 'flag') { E.setGroup(2); box(0.31, 1.1, 0, 0.14, 0.56, 0.16, M.OVERALL); E.setGroup(3); box(0.31, 1.5, 0.12, 0.05, 1.6, 0.05, M.STEEL); box(0.31 + 0.34, 2.05, 0.12, 0.66, 0.44, 0.03, flagMat); }
  else { box(0.31, 1.12, 0, 0.14, 0.56, 0.16, M.OVERALL); box(0.31, 0.9, 0.2, 0.14, 0.14, 0.4, M.OVERALL); box(0.1, 0.98, 0.38, 0.44, 0.3, 0.03, M.HOLO); box(0.1, 0.98, 0.36, 0.5, 0.36, 0.02, M.CARBON); }
  E.setGroup(0); const m = E.end(); figCache.set(k, m); return m;
}
// figure transform: yaw, position, idle bob phase, right-arm swing (0 = hanging, ~2.8 = raised overhead); the flag pole rides with the hand
function figXform(x, z, yaw, phase, arm) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), ca = Math.cos(arm), sa = Math.sin(arm), bob = Math.sin(E.time * 1.7 + phase) * 0.02, hx = 0.56 * sa, hy = 0.56 - 0.56 * ca;
  return function (mx, my, mz, g, o) {
    let px = mx, py = my, pz = mz;
    if (g === 1) py += bob;
    else if (g === 2) { const rx = mx - 0.31, ry = my - 1.38; px = rx * ca - ry * sa + 0.31; py = rx * sa + ry * ca + 1.38; }
    else if (g === 3) { px += hx; py += hy; }
    o[0] = px * cy + pz * sy + x; o[1] = py; o[2] = -px * sy + pz * cy + z;
  };
}
const ident = (x, y, z, g, o) => { o[0] = x; o[1] = y; o[2] = z; };
const translate = (tx, ty, tz, yaw = 0) => { const c = Math.cos(yaw), s = Math.sin(yaw); return (x, y, z, g, o) => { o[0] = x * c + z * s + tx; o[1] = y + ty; o[2] = -x * s + z * c + tz; }; };
// confetti: deterministic from time, no state (drawn with R.drawPoint)
const CONF = [COL.gold, COL.red, COL.cyan, COL.green, COL.purple, COL.white];
function confetti(R, t, n, x0, z0, spread, top) {
  for (let i = 0; i < n; i++) {
    const h1 = E.hash2(i, 11), h2 = E.hash2(i, 23), h3 = E.hash2(i, 37), h4 = E.hash2(i, 41), v = 1.2 + h3 * 1.6;
    const y = top - ((t * v + h4 * top * 2) % (top * 1.15)); if (y < 0.05) continue;
    const x = x0 + (h1 - 0.5) * spread + Math.sin(t * 2.1 + h2 * 9) * 0.5, z = z0 + (h2 - 0.5) * spread * 0.6 + Math.cos(t * 1.7 + h1 * 7) * 0.3;
    R.drawPoint(x, y, z, CONF[i % CONF.length]);
  }
}
// DOM card layer: one wrapper inside #cards per scene, rebuilt only when the markup changes
function cardLayer(sc) {
  const host = document.getElementById('cards'); if (!host) return null;
  const dv = document.createElement('div'); dv.style.cssText = 'position:absolute;inset:0;pointer-events:none;'; dv.setAttribute('data-scene', sc.name); host.appendChild(dv); sc.lastHtml = ''; return dv;
}
function setCards(sc, html) { if (!sc.dom) return; if (html !== sc.lastHtml) { sc.dom.innerHTML = html; sc.lastHtml = html; } }
function killCards(sc) { if (sc.dom && sc.dom.parentNode) sc.dom.parentNode.removeChild(sc.dom); sc.dom = null; sc.lastHtml = ''; }
const chip = (text, color, border) => `<span style="${PX}font-size:8px;line-height:8px;padding:6px 8px;background:var(--ink);color:${color};border:2px solid ${border}">${esc(text)}</span>`;
const checker = n => { let s = '<div style="display:flex;height:8px;overflow:hidden">'; for (let i = 0; i < n; i++) s += `<span style="flex:none;width:8px;height:8px;background:${i & 1 ? 'var(--ink)' : 'var(--white)'}"></span>`; return s + '</div>'; };
const slam = (age, from = 2) => age < 0.1 ? `transform:scale(${from});` : '';
function baseEnter(sc, app, payload) {
  sc.app = app; sc.R = app.R; sc.payload = payload || {}; sc.params = app.params || {}; sc.t = 0; sc.done = false;
  const p = sc.payload, prm = sc.params;
  sc.era = p.era !== undefined ? p.era : (prm.era ? parseFloat(prm.era) : 0); sc.era = Math.max(0, Math.min(1, sc.era || 0));
  sc.spec = p.spec || SCR.car.GEN01; sc.gen = p.gen || (prm.gen ? parseInt(prm.gen, 10) : (prm.round ? parseInt(prm.round, 10) : 7));
  sc.reduced = !!app.reducedMotion; sc.car = carMesh(sc.spec, sc.era); SCR.car.era = sc.era;
  sc.state = SCR.car.newState(); sc.prevAmbient = sc.R.ambient; sc.prevDiag = app.diagExtra;
  killCards(sc); sc.dom = cardLayer(sc);
}
function baseExit(sc) { killCards(sc); if (sc.R) sc.R.ambient = sc.prevAmbient; if (sc.app) sc.app.diagExtra = sc.prevDiag; }

// ============================================================================
// BAY — scrutineering: the car rolls in, the scanner sweeps, five checks are stamped, then the verdict
// ============================================================================
const CHECKS = [
  { key: 'floor', label: 'FLOOR', footnote: 'ILLEGAL · EVALUATION HARNESS EDITED: TEST STUB', part: { x: 0, y: 0.14, z: 0.2, w: 1.8, h: 0.26, d: 2.6 } },
  { key: 'rearWing', label: 'REAR WING', footnote: 'ILLEGAL · FLEXI WING: SCORE FUNCTION PATCHED AT LOAD', part: { x: 0, y: 0.84, z: -2.35, w: 1.2, h: 0.56, d: 0.7 } },
  { key: 'fuelFlow', label: 'FUEL FLOW', footnote: 'ILLEGAL · FUEL-FLOW BYPASS: COST-CAP METER RESET MID-RUN', part: { x: 0, y: 0.48, z: -0.45, w: 1.6, h: 0.6, d: 1.0 } },
  { key: 'engineMode', label: 'ENGINE MODE', footnote: 'ILLEGAL · ENGINE-MODE OVERRIDE: MODEL TIER SWAPPED ON THE PRIVATE SET', part: { x: 0, y: 0.72, z: -1.25, w: 0.8, h: 0.5, d: 1.0 } },
  { key: 'telemetrySeal', label: 'TELEMETRY SEAL', footnote: 'ILLEGAL · SEALED TELEMETRY EDITED: TRACE LINES REWRITTEN', part: { x: 0, y: 1.1, z: 0.2, w: 0.5, h: 0.42, d: 0.5 } },
];
const BT = { IN: 2.0, SWEEP: 2.0, SWEEP_END: 3.1, C0: 3.3, CD: 1.0, VER: 8.3, WIPE: 8.9, CARD: 9.2, DUR: 12 };
const markerCache = new Map();
function marker(pt, mat) {   // wireframe box around a part, in car model space (drawn with the car's own transform)
  const k = [pt.x, pt.y, pt.z, pt.w, pt.h, pt.d, mat].join('|'); if (markerCache.has(k)) return markerCache.get(k);
  E.begin(); E.setGroup(0); E.setAux(0); const th = 0.045, hw = pt.w / 2, hh = pt.h / 2, hd = pt.d / 2;
  for (const sy of [-1, 1]) for (const sz of [-1, 1]) box(pt.x, pt.y + sy * hh, pt.z + sz * hd, pt.w + th, th, th, mat);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(pt.x + sx * hw, pt.y, pt.z + sz * hd, th, pt.h + th, th, mat);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) box(pt.x + sx * hw, pt.y + sy * hh, pt.z, th, th, pt.d + th, mat);
  const m = E.end(); markerCache.set(k, m); return m;
}
let bayMesh = null, bayEra = -1, scannerMesh = null, sheetMesh = null;
function buildBay(f) {
  const hi = f > 0.4, FRAME = hi ? M.CHROME : M.STEEL;
  E.begin(); E.setGroup(0); E.setAux(0); const pools = [];
  Q([-18, 0, 10], [18, 0, 10], [18, 0, -10], [-18, 0, -10], M.CONCRETE);
  for (let x = -16; x <= 16; x += 4) Q([x - 0.04, 0.004, 10], [x + 0.04, 0.004, 10], [x + 0.04, 0.004, -10], [x - 0.04, 0.004, -10], M.RUBBER);
  for (let z = -8; z <= 8; z += 4) Q([-18, 0.004, z + 0.04], [18, 0.004, z + 0.04], [18, 0.004, z - 0.04], [-18, 0.004, z - 0.04], M.RUBBER);
  for (let k = 0; k < 14; k++) { const x0 = -4.2 + k * 0.6; Q([x0, 0.006, 2.9], [x0 + 0.6, 0.006, 2.9], [x0 + 0.6, 0.006, 2.4], [x0, 0.006, 2.4], k & 1 ? M.KERB_W : M.KERB_R); }
  box(0, 0.012, -2.25, 8.5, 0.024, 0.08, M.GOLD); box(0, 0.012, 2.35, 8.5, 0.024, 0.08, M.GOLD); box(-4.25, 0.012, 0.05, 0.08, 0.024, 4.6, M.GOLD); box(4.25, 0.012, 0.05, 0.08, 0.024, 4.6, M.GOLD);
  box(0, 2.6, -7.3, 36, 5.2, 0.6, M.CONCRETE); box(0, 1.15, -6.98, 36, 0.12, 0.06, M.STRIPE); box(0, 0.5, -6.99, 36, 1.0, 0.04, M.CARBON);
  for (let x = -15; x <= 15; x += 6) box(x, 3.9, -6.97, 0.3, 2.4, 0.06, hi ? M.CHROME : M.STEEL);
  sign('FIA SCRUTINEERING · BAY 1', [-5.2, 3.0, -6.96], [1, 0, 0], [0, 1, 0], 10.4, M.BODY, M.NAVY);
  sign('CAR CONFORMITY CHECK', [-11.2, 1.55, -6.96], [1, 0, 0], [0, 1, 0], 5.0, M.GOLD, M.NAVY); sign('NO TEAM PERSONNEL', [6.4, 1.55, -6.96], [1, 0, 0], [0, 1, 0], 4.4, M.BODY, M.STRIPE);
  for (const s of [-1, 1]) box(s * 18.2, 2.6, 0, 0.6, 5.2, 20, M.CONCRETE);
  for (const z of [-4.5, 0, 4.5]) { box(0, 5.0, z, 36, 0.3, 0.3, M.STEEL); for (let x = -12; x <= 12; x += 6) { box(x, 4.78, z, 1.0, 0.14, 0.5, M.LAMP); pools.push([x, z, 4.2]); } }
  for (const s of [-1, 1]) { box(s * 5, 1.7, 0, 0.3, 3.4, 0.3, FRAME); box(s * 5, 0.05, 0, 0.7, 0.1, 0.7, M.CARBON); box(s * 5.02, 1.2, 0.2, 0.3, 0.5, 0.1, M.NAVY); box(s * 5.02, 1.3, 0.26, 0.12, 0.06, 0.02, hi ? M.NEON_C : M.HOLO); }
  box(0, 3.5, 0, 10.6, 0.3, 0.4, FRAME); box(0, 3.3, 0, 10.0, 0.05, 0.06, M.CHROME); if (hi) box(0, 3.66, 0, 10.6, 0.03, 0.44, M.HOLO);
  box(-9.5, 0.55, -4.5, 1.4, 1.1, 0.8, M.STEEL); for (let k = 0; k < 3; k++) box(-9.5, 0.25 + k * 0.32, -4.08, 1.2, 0.2, 0.05, M.STRIPE);
  for (let k = 0; k < 4; k++) E.cylinder(-12.5, 0.17 + k * 0.34, -4.2, 0.37, 0.32, 10, 'y', M.TYRE, M.RIM);
  box(9.6, 0.06, -3.2, 2.6, 0.12, 2.2, M.PANEL); box(9.6, 0.15, -3.2, 0.5, 0.06, 0.4, M.NAVY);
  box(12.5, 0.8, -4.6, 0.12, 1.6, 0.12, M.STEEL); box(12.5, 1.85, -4.6, 1.2, 0.8, 0.08, M.CARBON); box(12.5, 1.85, -4.55, 1.1, 0.7, 0.02, M.HOLO);
  box(-6.6, 0.42, 5.2, 0.6, 0.84, 0.6, M.STEEL); box(-6.6, 0.9, 5.2, 0.7, 0.12, 0.7, M.PANEL);
  const mesh = E.end(); return { mesh, pools };
}
function bayStatic(f) { const b = f > 0.4 ? 1 : 0; if (!bayMesh || bayEra !== b) { bayMesh = buildBay(f); bayEra = b; } return bayMesh; }
function scannerMeshes() {
  if (scannerMesh) return;
  E.begin(); E.setGroup(0); E.setAux(0); box(0, 3.15, 0, 0.5, 0.3, 0.5, M.STEEL); box(0, 2.96, 0, 0.14, 0.1, 3.6, M.HOLO); box(0, 2.9, 0, 0.1, 0.06, 3.8, M.NEON_C); scannerMesh = E.end();
  E.begin(); quad2([0, 0.02, -1.75], [0, 0.02, 1.75], [0, 2.9, 1.75], [0, 2.9, -1.75], M.CYAN); sheetMesh = E.end();
}
const bay = S.bay = { name: 'bay', done: false, duration: BT.DUR, t: 0, bayStatus: { checks: [], verdict: 'SEALED', stage: 'ROLL-IN', t: 0 } };
bay.enter = function (app, payload) {
  baseEnter(bay, app, payload); const p = bay.payload, prm = bay.params;
  bay.static = bayStatic(bay.era); scannerMeshes();
  const failLabel = (prm.fail || '').toUpperCase(), stdVerdict = p.verdict || (prm.verdict === 'black' ? 'BLACK FLAG' : 'SEALED');
  const src = Array.isArray(p.checks) && p.checks.length ? p.checks : CHECKS.map(c => ({ key: c.key, label: c.label, pass: !(stdVerdict === 'BLACK FLAG' && c.label === (failLabel || 'REAR WING')) }));
  bay.checks = src.map((c, i) => { const def = CHECKS.find(d => d.key === c.key) || CHECKS.find(d => d.label === c.label) || CHECKS[Math.min(i, 4)]; return { key: c.key || def.key, label: c.label || def.label, pass: c.pass !== false, footnote: c.footnote || def.footnote, part: def.part, state: 'PENDING' }; });
  bay.verdict = p.verdict || (bay.checks.every(c => c.pass) ? 'SEALED' : 'BLACK FLAG');
  bay.failIdx = bay.checks.findIndex(c => !c.pass); bay.points = p.points !== undefined ? p.points : 25;
  bay.figA = figure('tablet', 0); bay.figB = figure('flag', bay.verdict === 'SEALED' ? M.GREEN : M.TYRE);
  bay.state.yaw = -Math.PI / 2; bay.R.ambient = 0.3;
  bay.bayStatus = { checks: bay.checks, verdict: bay.verdict, stage: 'ROLL-IN', t: 0 };
  app.diagExtra = () => ({ bay: { t: +bay.t.toFixed(2), stage: bay.bayStatus.stage, done: bay.done, checks: bay.checks.map(c => c.state[0]).join(''), verdict: bay.verdict, cards: bay.dom ? bay.dom.querySelectorAll('[data-card]').length : 0 } });
};
bay.exit = () => baseExit(bay);
bay.update = function (dt) { bay.t += dt; bay.done = bay.t >= BT.DUR; };
// world position of a part (car faces -x: world = (-mz, my, mx) + car position)
const partWorld = (st, pt) => [st.x - pt.z, pt.y, st.z + pt.x];
bay.render = function () {
  const R = bay.R, t = bay.t, st = bay.state, checks = bay.checks, red = bay.reduced;
  // --- car roll-in ---
  const cx = lerp(10, 0, easeOut(clamp01(t / BT.IN))); st.x = cx; st.spin = (10 - cx) / SCR.car.R_R; st.pitch = t < BT.IN + 0.4 ? -0.02 * Math.sin(clamp01((t - BT.IN + 0.1) / 0.5) * Math.PI) : 0;
  // --- checks ---
  let stage = t < BT.IN ? 'ROLL-IN' : t < BT.SWEEP_END ? 'SCANNER SWEEP' : 'CHECKS', active = -1, stampAge = -1;
  for (let i = 0; i < checks.length; i++) { const c = checks[i], ci = BT.C0 + i * BT.CD, a = t - ci; c.state = a < 0.3 ? 'PENDING' : a < 0.65 ? 'SCANNING' : c.pass ? 'PASS' : 'FAIL'; if (a >= 0 && a < BT.CD) { active = i; if (a >= 0.65) stampAge = a - 0.65; } if (a >= 0.3 && a < BT.CD) stage = 'CHECKING · ' + c.label; }
  const verdictPhase = t >= BT.VER; if (verdictPhase) stage = t < BT.CARD ? 'VERDICT' : bay.verdict === 'SEALED' ? 'SEALED · PARC FERME' : 'BLACK FLAG';
  bay.bayStatus.stage = stage; bay.bayStatus.t = t;
  // --- scanner position along the car (world x) ---
  let sx;
  if (t < BT.SWEEP) sx = 3.6; else if (t < BT.SWEEP_END) sx = lerp(3.6, -3.6, smooth((t - BT.SWEEP) / (BT.SWEEP_END - BT.SWEEP)));
  else { let prev = -3.6; sx = prev; for (let i = 0; i < checks.length; i++) { const ci = BT.C0 + i * BT.CD; if (t < ci) break; const px = partWorld(st, checks[i].part)[0]; sx = lerp(prev, px, easeOut(clamp01((t - ci) / 0.3))); prev = px; }
    if (verdictPhase) { const tx = bay.failIdx >= 0 ? partWorld(st, checks[bay.failIdx].part)[0] : 0; sx = lerp(prev, tx, easeOut(clamp01((t - BT.VER) / 0.3))); } }
  // --- camera ---
  const cam = R.cam, focusIdx = verdictPhase && bay.failIdx >= 0 ? bay.failIdx : -1, punch = stampAge >= 0 && stampAge < 0.25 && !checks[active].pass ? 1 - stampAge / 0.25 : 0;
  if (focusIdx >= 0 && t < BT.CARD) { const P = partWorld(st, checks[focusIdx].part); cam.pos = [P[0] + 1.9, P[1] + 1.15, P[2] + 3.1]; cam.target = [P[0], P[1] - 0.05, P[2]]; cam.fov = 30; }
  else { const push = clamp01((t - BT.SWEEP_END) / (BT.VER - BT.SWEEP_END)); cam.pos = [3.1 - push * 0.5, 2.1 - push * 0.25, 7.6 - push * 0.9]; cam.target = [-0.2 + cx * 0.25, 0.5, 0]; cam.fov = 36 - punch * 4; }
  // --- draw ---
  R.begin(); R.clear('#06081A'); R.drawStatic(bay.static.mesh);
  const pools = bay.static.pools.slice(); pools.push([sx, 0, 1.6]); R.drawLightPools(pools);
  const xf = SCR.car.makeXform(st);
  const wave = verdictPhase ? lerp(0, 2.8, easeOut(clamp01((t - BT.VER) / 0.5))) + (t > BT.VER + 0.5 ? Math.sin(t * 9) * 0.2 : 0) : 0;
  const fA = figXform(-2.6, -3.6, 0.25, 0, 0), fB = figXform(3.4, -3.9, -0.2, 2, wave);
  R.drawDynamic(bay.car, xf, 'shadow', 0); R.drawDynamic(bay.figA, fA, 'shadow', 0); R.drawDynamic(bay.figB, fB, 'shadow', 0);
  if (t >= BT.SWEEP) R.drawDynamic(sheetMesh, translate(sx, 0, 0), 'ghost', 0, M.CYAN);
  R.drawDynamic(bay.car, xf, 'solid', 0); R.drawDynamic(bay.figA, fA, 'solid', 0); R.drawDynamic(bay.figB, fB, 'solid', 0);
  R.drawDynamic(scannerMesh, translate(sx, 0, 0), 'solid', 0);
  for (let i = 0; i < checks.length; i++) { const c = checks[i]; if (c.state === 'PENDING') continue;
    let mat = c.state === 'SCANNING' ? M.CYAN : c.state === 'PASS' ? M.GREEN : M.STRIPE;
    if (c.state === 'FAIL' && !red && t < BT.WIPE && Math.floor(t * 8) & 1) mat = M.NEON_R;
    if (verdictPhase && bay.verdict === 'SEALED' && !red && Math.floor(t * 6) % 3 === 0) mat = M.GREEN;
    R.drawDynamic(marker(c.part, mat), xf, 'solid', 0); }
  R.outline();
  if (!red) { if (t >= BT.WIPE && t < BT.CARD) R.checkerWipe(clamp01((t - BT.WIPE) / 0.3)); if (t >= BT.CARD) R.flash(0.8 * (1 - clamp01((t - BT.CARD) / 0.4))); if (t >= BT.VER && t < BT.VER + 0.3 && bay.verdict === 'SEALED') R.flash(0.4 * (1 - (t - BT.VER) / 0.3)); }
  // --- DOM cards ---
  let h = `<div style="position:absolute;left:12px;top:12px;display:flex;flex-direction:column;gap:6px;align-items:flex-start">${chip('FIA SCRUTINEERING · BAY 1', 'var(--gold)', 'var(--gold)')}<span style="${VT}font-size:20px;line-height:20px;color:var(--caption);background:var(--ink);padding:2px 6px">${esc(stage)}</span></div>`;
  h += '<div style="position:absolute;right:12px;top:12px;display:flex;flex-direction:column;gap:6px;align-items:flex-end;max-width:440px">';
  for (let i = 0; i < checks.length; i++) { const c = checks[i]; if (c.state === 'PENDING') continue; const age = t - (BT.C0 + i * BT.CD + 0.65);
    const stamp = c.state === 'SCANNING' ? `<span style="${PX}font-size:8px;line-height:8px;padding:6px 8px;background:var(--cyan);color:var(--ink)">SCANNING</span>`
      : `<span data-card="stamp" style="${PX}font-size:8px;line-height:8px;padding:6px 8px;min-width:32px;text-align:center;background:${c.pass ? 'var(--green)' : 'var(--red)'};color:${c.pass ? 'var(--ink)' : 'var(--white)'};transform-origin:right center;${slam(age)}">${c.pass ? 'PASS' : 'FAIL'}</span>`;
    h += `<div style="display:flex;align-items:center;gap:6px">${chip(c.label, 'var(--white)', c.state === 'FAIL' ? 'var(--red)' : c.state === 'PASS' ? 'var(--green)' : 'var(--cyan)')}${stamp}</div>`;
    if (c.state === 'FAIL') h += `<div style="${VT}font-size:18px;line-height:18px;color:var(--red);background:var(--ink);padding:2px 6px;text-align:right">${esc(c.footnote)}</div>`; }
  h += '</div>';
  if (t >= BT.CARD - 0.1) { const age = t - (BT.CARD - 0.1), gen = `GEN ${pad2(bay.gen)}`;
    const inner = bay.verdict === 'SEALED'
      ? `<div style="${PX}font-size:8px;color:var(--gold)">PARC FERMÉ</div><div style="${PX}font-size:32px;line-height:32px;color:var(--green);margin:14px 0">SEALED</div><div style="${PX}font-size:8px;color:var(--caption)">${gen} · CAR CONFORMS · +${bay.points} PTS</div>`
      : `<div style="${PX}font-size:32px;line-height:32px;color:var(--white)">BLACK FLAG</div><div style="${PX}font-size:8px;color:var(--red);margin-top:14px">DISQUALIFIED · ${gen} · NO POINTS</div>`;
    h += `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><div data-card="verdict" style="background:var(--ink);border:4px solid ${bay.verdict === 'SEALED' ? 'var(--gold)' : 'var(--white)'};text-align:center;${slam(age)}">${bay.verdict === 'SEALED' ? '' : checker(40)}<div style="padding:18px 28px">${inner}</div>${bay.verdict === 'SEALED' ? '' : checker(40)}</div></div>`; }
  setCards(bay, h);
};

// ============================================================================
// PARC — parc fermé: the sealed car in a fenced enclosure, the FIA seal ring descends and stamps
// ============================================================================
const PT = { DROP: 0.5, IMPACT: 1.4, CARD: 1.75, DUR: 4 };
let parcMesh = null, parcPools = null, ringMesh = null, discMesh = null, dustN = 56;
function buildParc() {
  E.begin(); E.setGroup(0); E.setAux(0); const pools = [];
  Q([-40, 0, 30], [40, 0, 30], [40, 0, -30], [-40, 0, -30], M.ASPHALT);
  Q([-14, 0.004, 4], [14, 0.004, 4], [14, 0.004, -6], [-14, 0.004, -6], M.CONCRETE);
  for (let k = 0; k < 20; k++) { const x0 = -7 + k * 0.7; Q([x0, 0.008, 3.2], [x0 + 0.7, 0.008, 3.2], [x0 + 0.7, 0.008, 2.7], [x0, 0.008, 2.7], k & 1 ? M.KERB_W : M.KERB_R); }
  Q([-7, 0.008, -5.2], [7, 0.008, -5.2], [7, 0.008, -5.3], [-7, 0.008, -5.3], M.KERB_W); Q([-7.1, 0.008, 2.7], [-7, 0.008, 2.7], [-7, 0.008, -5.3], [-7.1, 0.008, -5.3], M.KERB_W); Q([7, 0.008, 2.7], [7.1, 0.008, 2.7], [7.1, 0.008, -5.3], [7, 0.008, -5.3], M.KERB_W);
  box(0, 2.6, -8.2, 44, 5.2, 4.4, M.CONCRETE); box(0, 5.35, -8.2, 44.4, 0.3, 4.8, M.STEEL);
  for (let x = -16; x <= 16; x += 8) { box(x, 1.8, -5.96, 5.2, 3.6, 0.1, M.CARBON); for (let k = 1; k < 4; k++) box(x, k * 0.9, -5.9, 5.0, 0.05, 0.03, M.STEEL); }
  for (let x = -20; x <= 20; x += 8) box(x, 2.6, -5.95, 0.6, 5.2, 0.14, M.PANEL);
  box(0, 4.35, -5.94, 44, 0.16, 0.06, M.STRIPE);
  sign('PARC FERME · FIA', [-4.4, 4.5, -5.93], [1, 0, 0], [0, 1, 0], 8.8, M.GOLD, M.NAVY);
  sign('IMPOUND · NO WORK PERMITTED', [8.6, 3.85, -5.93], [1, 0, 0], [0, 1, 0], 7.0, M.BODY, M.NAVY);
  const post = (x, z) => { box(x, 0.65, z, 0.16, 1.3, 0.16, M.STEEL); box(x, 1.32, z, 0.22, 0.06, 0.22, M.GOLD); };
  for (let x = -7; x <= 7; x += 2) post(x, 3.5); for (let z = 1.5; z >= -4.5; z -= 2) { post(-7, z); post(7, z); }
  box(0, 0.4, 3.5, 14, 0.8, 0.18, M.ARMCO); box(0, 1.1, 3.5, 14, 0.06, 0.06, M.GOLD);
  box(-7, 0.4, -0.5, 0.18, 0.8, 8, M.ARMCO); box(7, 0.4, -0.5, 0.18, 0.8, 8, M.ARMCO); box(-7, 1.1, -0.5, 0.06, 0.06, 8, M.GOLD); box(7, 1.1, -0.5, 0.06, 0.06, 8, M.GOLD);
  sign('SEALED · NO ENTRY', [-6.9, 0.85, 3.62], [1, 0, 0], [0, 1, 0], 3.2, M.BODY, M.STRIPE);
  sign('FIA', [4.2, 0.85, 3.62], [1, 0, 0], [0, 1, 0], 1.3, M.NAVY, M.GOLD);
  for (const s of [-1, 1]) { box(s * 9.5, 3.2, 5.5, 0.22, 6.4, 0.22, M.STEEL); box(s * 9.5, 6.5, 4.8, 0.2, 0.2, 1.6, M.STEEL); box(s * 9.5, 6.35, 4.0, 1.0, 0.3, 0.5, M.LAMP); pools.push([s * 8, 1.2, 7]); }
  box(0, 5.1, -3.4, 22, 0.24, 0.24, M.STEEL); for (const x of [-6, 0, 6]) { box(x, 4.95, -3.4, 1.0, 0.16, 0.5, M.LAMP); pools.push([x, -1.5, 5]); }
  box(-11, 0.42, 1.0, 1.4, 0.84, 0.7, M.STEEL); for (let k = 0; k < 2; k++) box(-11, 0.25 + k * 0.32, 1.37, 1.2, 0.2, 0.05, M.STRIPE);
  for (let k = 0; k < 3; k++) E.cylinder(11.2, 0.17 + k * 0.34, 0.6, 0.37, 0.32, 10, 'y', M.TYRE, M.RIM);
  parcMesh = E.end(); parcPools = pools;
  E.begin(); E.setGroup(0); E.setAux(0);
  for (let k = 0; k < 28; k++) { const from = E.current().length; box(3.55, 0, 0, 0.5, 0.26, 0.82, M.GOLD); E.rotateRange(from, k / 28 * Math.PI * 2, 0, 0); }
  for (let k = 0; k < 4; k++) { const from = E.current().length; box(3.55, 0.05, 0, 0.7, 0.4, 0.5, M.GOLD); box(3.55, 0.35, 0, 0.3, 0.2, 0.3, M.STRIPE); E.rotateRange(from, k / 4 * Math.PI * 2 + Math.PI / 4, 0, 0); }
  ringMesh = E.end();
  E.begin(); disc(3.3, 0, 24, M.LAMP); discMesh = E.end();
}
const parc = S.parc = { name: 'parc', done: false, duration: PT.DUR, t: 0 };
parc.enter = function (app, payload) {
  baseEnter(parc, app, payload); if (!parcMesh) buildParc();
  parc.state.yaw = -Math.PI / 2 + 0.42; parc.state.x = 0.2; parc.state.z = -1.0; parc.R.ambient = 0.16;
  parc.figA = figure('tablet', 0); parc.figB = figure('flag', M.GREEN);
  app.diagExtra = () => ({ parc: { t: +parc.t.toFixed(2), done: parc.done, stamped: parc.t >= PT.IMPACT, cards: parc.dom ? parc.dom.querySelectorAll('[data-card]').length : 0 } });
};
parc.exit = () => baseExit(parc);
parc.update = function (dt) { parc.t += dt; parc.done = parc.t >= PT.DUR; };
parc.render = function () {
  const R = parc.R, t = parc.t, st = parc.state, red = parc.reduced, cam = R.cam;
  const dolly = clamp01(t / 6); cam.pos = [4.8 - dolly * 2.2, 2.4 - dolly * 0.3, 9.2 - dolly * 0.8]; cam.target = [0.2, 0.55, -0.8]; cam.fov = 36;
  // seal ring: drops under gravity, bounces once, settles
  let ry; const u = t - PT.DROP, fall = PT.IMPACT - PT.DROP;
  if (u < 0) ry = 5.6; else if (u < fall) ry = lerp(5.6, 0.13, easeIn(u / fall)); else { const b = u - fall; ry = b < 0.3 ? 0.13 + Math.sin(b / 0.3 * Math.PI) * 0.35 : 0.13; }
  if (red && u >= 0) ry = u < fall ? lerp(5.6, 0.13, u / fall) : 0.13;
  const ringYaw = Math.min(t, PT.IMPACT) * 0.8, stamped = t >= PT.IMPACT;
  R.begin(); R.sky(); R.drawStatic(parcMesh); R.drawLightPools(parcPools);
  const xf = SCR.car.makeXform(st), fA = figXform(-4.6, 1.6, 0.6, 1, 0), fB = figXform(5.2, -3.2, -0.5, 3, 0), rx = translate(st.x, ry, st.z, ringYaw);
  R.drawDynamic(parc.car, xf, 'shadow', 0); R.drawDynamic(parc.figA, fA, 'shadow', 0); R.drawDynamic(parc.figB, fB, 'shadow', 0); R.drawDynamic(ringMesh, rx, 'shadow', 0);
  if (stamped) R.drawDynamic(discMesh, translate(st.x, 0.02, st.z), 'ghost', 0, M.GOLD);
  R.drawDynamic(parc.car, xf, 'solid', 0); R.drawDynamic(parc.figA, fA, 'solid', 0); R.drawDynamic(parc.figB, fB, 'solid', 0); R.drawDynamic(ringMesh, rx, 'solid', 0);
  if (stamped && t < PT.IMPACT + 0.7) { const a = t - PT.IMPACT; for (let k = 0; k < dustN; k++) { const h1 = E.hash2(k, 3), h2 = E.hash2(k, 5), ang = k / dustN * Math.PI * 2 + h1 * 0.2, r = 3.6 + a * (3 + h2 * 5), y = a * (2 + h1 * 3) - 5 * a * a; if (y < 0) continue; R.drawPoint(st.x + Math.cos(ang) * r, y, st.z + Math.sin(ang) * r, h2 > 0.5 ? COL.gold : COL.white); } }
  R.outline();
  if (!red && stamped && t < PT.IMPACT + 0.35) R.flash(0.6 * (1 - (t - PT.IMPACT) / 0.35));
  let h = `<div style="position:absolute;left:12px;top:12px;display:flex;flex-direction:column;gap:6px;align-items:flex-start">${chip('PARC FERMÉ · IMPOUND', 'var(--gold)', 'var(--gold)')}<span style="${VT}font-size:20px;line-height:20px;color:var(--caption);background:var(--ink);padding:2px 6px">${esc(stamped ? 'FIA SEAL APPLIED · CAR IMPOUNDED' : 'SEAL PRESS DESCENDING')}</span></div>`;
  if (t >= PT.CARD) { const age = t - PT.CARD;
    h += `<div style="position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;padding-bottom:28px"><div data-card="seal" style="background:var(--ink);border:4px solid var(--gold);padding:14px 24px;text-align:center;${slam(age)}"><div style="${PX}font-size:8px;color:var(--gold)">PARC FERMÉ</div><div style="${PX}font-size:24px;line-height:24px;color:var(--white);margin:10px 0">GEN ${pad2(parc.gen)} · SEALED</div><div style="${VT}font-size:18px;line-height:18px;color:var(--caption)">${esc(parc.payload.caption || 'CAR IMPOUNDED · NO FURTHER WORK PERMITTED · POINTS STAND')}</div></div></div>`; }
  setCards(parc, h);
};

// ============================================================================
// FINALE — season champion: the car on the podium under sweeping spotlights, confetti, champion card
// ============================================================================
const FT = { CARD: 1.2, DUR: 12 };
let podiumMesh = null, coneMesh = null, spotMesh = null;
function buildFinale() {
  E.begin(); E.setGroup(0); E.setAux(0);
  Q([-40, 0, 30], [40, 0, 30], [40, 0, -30], [-40, 0, -30], M.CONCRETE);
  for (let k = 0; k < 40; k++) { const x0 = -14 + k * 0.7; Q([x0, 0.006, 6.0], [x0 + 0.7, 0.006, 6.0], [x0 + 0.7, 0.006, 5.5], [x0, 0.006, 5.5], k & 1 ? M.KERB_W : M.KERB_R); }
  box(0, 0.5, 0, 8.4, 1.0, 4.4, M.PANEL, { top: M.CONCRETE }); box(0, 1.02, 0, 8.6, 0.06, 4.6, M.CONCRETE); box(0, 0.36, 2.24, 8.4, 0.16, 0.06, M.GOLD);
  box(-8.2, 0.35, 0.6, 5.6, 0.7, 4.0, M.PANEL, { top: M.CONCRETE }); box(8.2, 0.2, 0.6, 5.6, 0.4, 4.0, M.PANEL, { top: M.CONCRETE });
  sign('1', [-0.5, 0.42, 2.22], [1, 0, 0], [0, 1, 0], 1.0, M.NAVY, M.GOLD); sign('2', [-8.6, 0.2, 2.62], [1, 0, 0], [0, 1, 0], 0.8, M.BODY, M.NAVY); sign('3', [7.8, 0.05, 2.62], [1, 0, 0], [0, 1, 0], 0.7, M.BODY, M.NAVY);
  box(0, 4.2, -9, 44, 8.4, 1.2, M.NAVY); box(0, 0.6, -8.38, 44, 1.2, 0.06, M.CARBON); box(0, 7.6, -8.38, 44, 0.2, 0.06, M.GOLD);
  sign('SEASON 1 · CONSTRUCTORS CHAMPION', [-9.0, 5.4, -8.36], [1, 0, 0], [0, 1, 0], 18, M.GOLD, M.NAVY);
  sign('CLEAN LINEAGE · 22 ROUNDS · PARC FERME', [-7.6, 4.0, -8.36], [1, 0, 0], [0, 1, 0], 15.2, M.BODY, M.NAVY);
  for (const s of [-1, 1]) box(s * 15, 3.7, 3.0, 0.3, 7.4, 0.3, M.STEEL); box(0, 7.3, 3.0, 30.3, 0.35, 0.35, M.STEEL);
  for (const x of [-7, 0, 7]) { box(x, 6.95, 3.0, 0.9, 0.4, 0.6, M.CARBON); box(x, 6.72, 3.0, 0.7, 0.08, 0.5, M.LAMP); }
  for (const s of [-1, 1]) { box(s * 13, 0.42, 4.5, 0.6, 0.84, 0.6, M.STEEL); box(s * 13, 1.5, 4.5, 0.12, 1.4, 0.12, M.STEEL); box(s * 13, 2.5, 4.5, 1.6, 0.9, 0.08, M.CARBON); box(s * 13, 2.5, 4.55, 1.5, 0.8, 0.02, M.HOLO); }
  podiumMesh = E.end();
  E.begin(); { const n = 10; for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, p = [Math.cos(a0) * 1.5, 0, Math.sin(a0) * 1.5], q = [Math.cos(a1) * 1.5, 0, Math.sin(a1) * 1.5]; T([0, 1, 0], p, q, M.LAMP); T([0, 1, 0], q, p, M.LAMP); } } coneMesh = E.end();
  E.begin(); disc(1.5, 0, 16, M.LAMP); spotMesh = E.end();
}
const finale = S.finale = { name: 'finale', done: false, duration: FT.DUR, t: 0 };
finale.enter = function (app, payload) {
  baseEnter(finale, app, payload); if (!podiumMesh) buildFinale(); const p = finale.payload, prm = finale.params;
  finale.stats = Object.assign({ season: 1, points: 412, sealed: 19, flags: 2, stripped: 1, bestOfficial: '1:21.904', teamLevel: 88, era: 'ORBITAL', gen: prm.gen ? parseInt(prm.gen, 10) : 22 }, p.stats || {});
  finale.R.ambient = 0.22; finale.figA = figure('tablet', 0); finale.figB = figure('flag', M.STRIPE);
  app.diagExtra = () => ({ finale: { t: +finale.t.toFixed(2), done: finale.done, cards: finale.dom ? finale.dom.querySelectorAll('[data-card]').length : 0 } });
};
finale.exit = () => baseExit(finale);
finale.update = function (dt) { finale.t += dt; finale.done = finale.t >= FT.DUR; };
finale.render = function () {
  const R = finale.R, t = finale.t, st = finale.state, cam = R.cam, s = finale.stats;
  const ang = 0.55 + t * 0.11; cam.pos = [Math.sin(ang) * 12.5, 3.4, Math.cos(ang) * 12.5]; cam.target = [0, 1.4, -0.2]; cam.fov = 34;
  st.x = 0; st.z = 0; st.y = 1.04; st.yaw = -Math.PI / 2 + 0.5 + t * 0.3;
  R.begin(); R.gradient('#121A4A', '#06081A'); R.drawStatic(podiumMesh); R.drawLightPools([[-8.2, 0.6, 3.5], [8.2, 0.6, 3.5], [0, 7.5, 5]]);
  const xf = SCR.car.makeXform(st), fA = figXform(-8.4, 0.9, 0.5, 1, 0), fB = figXform(8.0, 0.8, -0.4, 4, 2.7 + Math.sin(t * 5) * 0.3);
  const fAy = (x, y, z, g, o) => { fA(x, y, z, g, o); o[1] += 0.7; }, fBy = (x, y, z, g, o) => { fB(x, y, z, g, o); o[1] += 0.4; };
  R.drawDynamic(finale.car, xf, 'shadow', 1.04); R.drawDynamic(finale.figA, fAy, 'shadow', 0.7); R.drawDynamic(finale.figB, fBy, 'shadow', 0.4);
  const spots = [];
  for (let k = 0; k < 3; k++) { const tx = Math.sin(t * 0.7 + k * 2.1) * 2.4, tz = Math.cos(t * 0.5 + k * 1.3) * 1.2 - 0.2, hx = (k - 1) * 7; spots.push([tx, tz]);
    R.drawDynamic(spotMesh, translate(tx, 1.06, tz), 'ghost', 0, M.GOLD);
    const cone = (x, y, z, g, o) => { o[0] = hx + (tx + x - hx) * (1 - y) + 0; o[1] = 6.7 - (6.7 - 1.06) * (1 - y); o[2] = 3.0 + (tz + z - 3.0) * (1 - y); };
    R.drawDynamic(coneMesh, cone, 'ghost', 0, M.GOLD); }
  R.drawDynamic(finale.car, xf, 'solid', 0); R.drawDynamic(finale.figA, fAy, 'solid', 0); R.drawDynamic(finale.figB, fBy, 'solid', 0);
  confetti(R, t, 320, 0, 0, 22, 8);
  R.outline();
  if (!finale.reduced && t < 0.5) R.flash(0.5 * (1 - t / 0.5));
  let h = `<div style="position:absolute;left:12px;top:12px;display:flex;flex-direction:column;gap:6px;align-items:flex-start">${chip(`SEASON ${s.season} · FINAL CLASSIFICATION`, 'var(--gold)', 'var(--gold)')}</div>`;
  if (t >= FT.CARD) { const age = t - FT.CARD;
    h += `<div style="position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;padding-bottom:22px"><div data-card="champion" style="background:var(--ink);border:4px solid var(--gold);text-align:center;${slam(age)}">${checker(40)}<div style="padding:14px 24px"><div style="${PX}font-size:8px;color:var(--gold)">SEASON ${s.season} · CHAMPION · CLEAN LINEAGE</div><div style="${PX}font-size:24px;line-height:24px;color:var(--white);margin:12px 0">GEN ${pad2(s.gen)} · ${s.points} PTS</div><div style="${PX}font-size:8px;color:var(--caption);line-height:14px">${s.sealed} SEALED · ${s.flags} BLACK FLAGS · ${s.stripped} STRIPPED<br>BEST OFFICIAL ${esc(s.bestOfficial)} · TEAM LEVEL ${s.teamLevel} · ${esc(s.era)}</div></div>${checker(40)}</div></div>`; }
  setCards(finale, h);
};
})(window.SCR = window.SCR || {});
