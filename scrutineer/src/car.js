// ============================================================================
// SCR.car — the car: parts spec -> geometry + physics constants, per-pixel livery, transforms
// era: 0 (1994 classic) .. 1 (Ultron). Body work evolves with the team:
//   0.00-0.30 classic (halo, open cockpit, gold seams)      0.30-0.50 modern (neon seams, sharper nose)
//   0.50-0.70 closed HOLO canopy, sculpted engine cover, LED rain light bar
//   0.70-0.85 enclosed wheel fairings that steer, fan-car rear disk, stretched nose
//   0.85-1.00 Ultron: chrome body, red neon seams + eyes, drone escort, pulsing underglow
// groups: 0 body, 1-4 wheels (FL FR RL RR), 5 DRS flap, 6 rear fan, 7 drone escort,
//         8-11 wheel fairings (FL FR RL RR, steer with the front wheels), 12 jack stands (grow with lift)
// ============================================================================
(function (SCR) {
'use strict';
const E = SCR.engine, M = E.M, C = SCR.car = {};
const WB_F = 1.72, WB_R = -1.88, TRACK = 0.86, R_F = 0.355, R_R = 0.365;
C.R_R = R_R;
C.WHEELS = [
  { g: 1, cx: -TRACK, cz: WB_F, r: R_F, w: 0.33, front: true }, { g: 2, cx: TRACK, cz: WB_F, r: R_F, w: 0.33, front: true },
  { g: 3, cx: -TRACK, cz: WB_R, r: R_R, w: 0.42, front: false }, { g: 4, cx: TRACK, cz: WB_R, r: R_R, w: 0.42, front: false }];
C.DRS_HINGE = { y: 0.93, z: -2.42 };
C.GROUPS = { BODY: 0, FL: 1, FR: 2, RL: 3, RR: 4, DRS: 5, FAN: 6, DRONES: 7, FAIRING: 8, JACKS: 12 };
C.ERA = { NEON: 0.3, CANOPY: 0.5, FAIRINGS: 0.7, CHROME: 0.85 };
C.JACK_H = 0.5;                     // nominal jack-stand height; the stands are scaled to the lift in makeXform
const AUX = { PANEL: 5, SEAM: 6, UNDERGLOW: 7, RAINLIGHT: 8, EYE: 9 };   // livery aux codes (resolved per pixel by the hook)
const DRONE = { x: 1.0, y: 1.25, r: 1.65, h: 1.15 };
C.PART_DEFS = [
  { key: 'frontWing', label: 'FRONT WING', type: 'level', min: 1, max: 5, role: 'AERO' },
  { key: 'rearWing', label: 'REAR WING', type: 'level', min: 1, max: 5, role: 'AERO' },
  { key: 'floor', label: 'FLOOR + DIFFUSER', type: 'level', min: 1, max: 5, role: 'AERO' },
  { key: 'sidepods', label: 'SIDEPODS', type: 'enum', values: ['SLIM', 'STD', 'WIDE'], role: 'AERO' },
  { key: 'fin', label: 'SHARK FIN', type: 'bool', role: 'AERO' },
  { key: 'engine', label: 'ENGINE MODE', type: 'level', min: 1, max: 5, role: 'POWER' },
  { key: 'brakes', label: 'BRAKES', type: 'level', min: 1, max: 5, role: 'TOOLS' },
  { key: 'tyres', label: 'TYRES', type: 'enum', values: ['HARD', 'MEDIUM', 'SOFT'], role: 'TYRES' },
  { key: 'drs', label: 'DRS', type: 'bool', role: 'POWER' },
  { key: 'ballast', label: 'BALLAST', type: 'level', min: 0, max: 3, role: 'TOOLS' },
  { key: 'gearbox', label: 'GEARBOX', type: 'level', min: 5, max: 8, role: 'POWER' },
];
C.GEN01 = { frontWing: 2, rearWing: 2, floor: 1, sidepods: 'STD', fin: false, engine: 2, brakes: 2, tyres: 'MEDIUM', drs: false, ballast: 2, gearbox: 6 };
C.fmtVal = v => typeof v === 'boolean' ? (v ? 'ON' : 'OFF') : typeof v === 'number' ? `L${v}` : v;
// physics constants from the spec (+ optional team multipliers: {grip, wear, power, drag, braking, consistency})
C.derive = function (sp, tm = {}) {
  const df = sp.frontWing * 1.2 + sp.rearWing * 1.3 + sp.floor * 1.5;
  const drag = (1.0 + sp.frontWing * 0.14 + sp.rearWing * 0.2 + (sp.sidepods === 'WIDE' ? 0.22 : sp.sidepods === 'SLIM' ? -0.12 : 0) + (sp.fin ? -0.04 : 0)) * (tm.drag ?? 1);
  const power = (1 + sp.engine * 0.38) * (tm.power ?? 1);
  const mass = 1 + sp.ballast * 0.06 + (sp.sidepods === 'WIDE' ? 0.03 : 0);
  const grip = (sp.tyres === 'SOFT' ? 1.62 : sp.tyres === 'MEDIUM' ? 1.42 : 1.26) * (tm.grip ?? 1);
  const wear = (sp.tyres === 'SOFT' ? 0.03 : sp.tyres === 'MEDIUM' ? 0.014 : 0.005) * (tm.wear ?? 1);
  const topSpeed = 42 + power * 20 / Math.sqrt(drag);
  const accel = (6 + power * 6 / mass) * (1 + (sp.gearbox - 6) * 0.03);
  const braking = (15 + sp.brakes * 4.5) * Math.sqrt(grip / 1.42) * (tm.braking ?? 1);
  const cornerG = 9.81 * (grip + df * 0.16) / mass;
  return { df, drag, power, mass, grip, wear, topSpeed, accel, braking, cornerG, drsBoost: sp.drs ? 7.5 : 0, gears: sp.gearbox, consistency: tm.consistency ?? 1, learn: tm.learn ?? 0 };
};
// ---------- geometry ----------
const { box, prism, loft, sphere, Q, T } = E;
function wingElement(o) {
  const segs = o.segs || 6, spoon = o.spoon || (() => 0), c = o.chord, a = o.aoa, th = o.thick;
  const prof = y => [[o.zLE, y], [o.zLE - c * 0.45, y + c * 0.45 * Math.tan(a * 0.55)], [o.zLE - c, y + c * Math.tan(a)]];
  for (let i = 0; i < segs; i++) {
    const xa = o.x0 + (o.x1 - o.x0) * i / segs, xb = o.x0 + (o.x1 - o.x0) * (i + 1) / segs;
    const PA = prof(o.yLE + spoon(i / segs)), PB = prof(o.yLE + spoon((i + 1) / segs));
    for (let k = 0; k < 2; k++) {
      const [z0, y0] = PA[k], [z1, y1] = PA[k + 1], [z0b, y0b] = PB[k], [z1b, y1b] = PB[k + 1];
      Q([xa, y0, z0], [xb, y0b, z0b], [xb, y1b, z1b], [xa, y1, z1], o.matTop ?? o.mat);
      Q([xa, y0 - th, z0], [xa, y1 - th, z1], [xb, y1b - th, z1b], [xb, y0b - th, z0b], o.matBottom ?? o.mat);
    }
    Q([xa, PA[0][1] - th, o.zLE], [xb, PB[0][1] - th, o.zLE], [xb, PB[0][1], o.zLE], [xa, PA[0][1], o.zLE], o.mat);
    Q([xb, PB[2][1] - th, o.zLE - c], [xa, PA[2][1] - th, o.zLE - c], [xa, PA[2][1], o.zLE - c], [xb, PB[2][1], o.zLE - c], o.mat);
  }
}
C.wingElement = wingElement;
function wheel(cx, cy, cz, r, w, n, band, rimMat) {
  const x0 = cx - w / 2, x1 = cx + w / 2, sh = 0.05, prof = [[x0, r * 0.9], [x0 + sh, r], [x1 - sh, r], [x1, r * 0.9]];
  const P = (x, rr, a) => [x, cy + Math.cos(a) * rr, cz + Math.sin(a) * rr];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    for (let j = 0; j < 3; j++) { const [xa, ra] = prof[j], [xb, rb] = prof[j + 1]; Q(P(xa, ra, a0), P(xa, ra, a1), P(xb, rb, a1), P(xb, rb, a0), M.TYRE); }
    for (const s of [1, -1]) {
      const x = s > 0 ? x1 : x0, e = s * 0.004, F = (a, b, c, m) => s > 0 ? T(a, b, c, m) : T(a, c, b, m);
      F(P(x, 0, a0), P(x, r * 0.9, a0), P(x, r * 0.9, a1), M.TYRE);
      F(P(x + e, r * 0.74, a0), P(x + e, r * 0.86, a0), P(x + e, r * 0.86, a1), band); F(P(x + e, r * 0.74, a0), P(x + e, r * 0.86, a1), P(x + e, r * 0.74, a1), band);
      F(P(x + 2 * e, r * 0.56, a0), P(x + 2 * e, r * 0.64, a0), P(x + 2 * e, r * 0.64, a1), rimMat); F(P(x + 2 * e, r * 0.56, a0), P(x + 2 * e, r * 0.64, a1), P(x + 2 * e, r * 0.56, a1), rimMat);
      F(P(x + 3 * e, 0, a0), P(x + 3 * e, r * 0.15, a0), P(x + 3 * e, r * 0.15, a1), M.GOLD);
    }
  }
  for (const s of [1, -1]) { const x = (s > 0 ? x1 : x0) + s * 0.008, F = (a, b, c, m) => s > 0 ? T(a, b, c, m) : T(a, c, b, m);
    for (let k = 0; k < 5; k++) { const ak = k * Math.PI * 2 / 5 + 0.3, di = 0.09 / (r * 0.15), doo = 0.05 / (r * 0.58);
      F(P(x, r * 0.15, ak - di), P(x, r * 0.58, ak - doo), P(x, r * 0.58, ak + doo), rimMat); F(P(x, r * 0.15, ak - di), P(x, r * 0.58, ak + doo), P(x, r * 0.15, ak + di), rimMat); } }
}
// enclosed wheel fairing: an arch over the wheel (open at the bottom) with full side discs. s = side sign of the wheel.
function fairing(wd, s, topMat, wallMat) {
  const R2 = wd.r + 0.1, hw = wd.w / 2 + 0.05, N = 8, a0 = -0.35, a1 = Math.PI + 0.35;
  const ang = k => a0 + (a1 - a0) * k / N, half = a => hw * (0.72 + 0.28 * Math.max(0, Math.sin(a)));   // pod tapers toward its open ends
  const P = (k, side) => { const a = ang(k); return [wd.cx + side * s * half(a), wd.r + Math.sin(a) * R2, wd.cz + Math.cos(a) * R2]; };
  const co = [wd.cx + s * hw * 0.72, wd.r, wd.cz], ci = [wd.cx - s * hw * 0.72, wd.r, wd.cz];
  for (let k = 0; k < N; k++) {
    const A = P(k, -1), B = P(k, 1), Cq = P(k + 1, 1), D = P(k + 1, -1);
    if (s > 0) Q(A, B, Cq, D, topMat); else Q(A, D, Cq, B, topMat);
    if (s > 0) { T(co, Cq, B, wallMat); T(ci, A, D, wallMat); } else { T(co, B, Cq, wallMat); T(ci, D, A, wallMat); }
  }
  for (const side of [-1, 1]) { const pa = P(0, side), pb = P(N, side); box(pa[0], pa[1] - 0.03, pa[2], 0.03, 0.06, 0.03, wallMat); box(pb[0], pb[1] - 0.03, pb[2], 0.03, 0.06, 0.03, wallMat); }
}
// build(spec, era, opts) -> mesh. era 0..1. opts: {wheels:false} car on stands (no wheels, no fairings), {noDriver:true},
// {jacks:true} two steel jack stands under the floor (group 12, grow with makeXform lift), {drones:false} no escort,
// {keepEra:true} do not retarget the livery hook, {pose:'display'} accepted for symmetry with makeXform.
C.build = function (sp, era = 0, opts = {}) {
  E.begin(); E.setGroup(0); E.setAux(0);
  const f = Math.max(0, Math.min(1, era)), neon = f >= C.ERA.NEON, canopy = f >= C.ERA.CANOPY, fairings = f >= C.ERA.FAIRINGS, fan = f >= C.ERA.FAIRINGS, chrome = f >= C.ERA.CHROME;
  if (!opts.keepEra) C.era = f;
  const BODY = M.LIVERY, DARK = chrome ? M.CHROME : M.CARBON, PLAIN = chrome ? M.CHROME : M.BODY;
  // accent seams: metallic cyan on the classic car; from the modern era on they are neon, resolved by the livery hook so they light red for Ultron
  const ACC = neon ? BODY : M.CYAN, accent = fn => { E.setAux(neon ? AUX.SEAM : 0); fn(); E.setAux(0); };
  const wide = sp.sidepods === 'WIDE' ? 1.18 : sp.sidepods === 'SLIM' ? 0.8 : 1, stretch = 1 + f * 0.12 + (fairings ? 0.08 : 0);
  // floor
  prism(1.6 * stretch, { cx: 0, cy: 0.045, w: 0.8, h: 0.05 }, -2.05, { cx: 0, cy: 0.045, w: 1.5, h: 0.05 }, DARK);
  box(0, 0.02, -0.5, 1.62, 0.03, 2.4, DARK);
  // monocoque + nose (sharper, lower tip from the modern era on)
  const nose = neon
    ? [{ z: 3.0 * stretch, cy: 0.22, w: 0.06, h: 0.05, ch: 0.5 }, { z: 2.55 * stretch, cy: 0.27, w: 0.16, h: 0.12 }, { z: 2.1 * stretch, cy: 0.33, w: 0.3, h: 0.22 }]
    : [{ z: 2.9 * stretch, cy: 0.27, w: 0.1, h: 0.09, ch: 0.5 }, { z: 2.55 * stretch, cy: 0.29, w: 0.2, h: 0.15 }, { z: 2.1 * stretch, cy: 0.34, w: 0.32, h: 0.24 }];
  loft([...nose, { z: 1.55, cy: 0.42, w: 0.48, h: 0.36 },
    { z: 1.05, cy: 0.47, w: 0.66, h: 0.48 }, { z: 0.35, cy: 0.5, w: 0.72, h: 0.54 }, { z: -0.5, cy: 0.5, w: 0.68, h: 0.52 }, { z: -1.2, cy: 0.45, w: 0.5, h: 0.42 },
    { z: -1.85, cy: 0.4, w: 0.32, h: 0.32 }, { z: -2.2, cy: 0.42, w: 0.2, h: 0.2 }], BODY);
  if (neon) accent(() => prism(2.45 * stretch, { cx: 0, cy: 0.37, w: 0.03, h: 0.02 }, 1.2, { cx: 0, cy: 0.7, w: 0.03, h: 0.02 }, ACC));      // nose seam
  // engine cover: airbox + cover (classic) or sculpted spine behind the canopy
  if (canopy) {
    loft([{ z: -0.45, cy: 0.85, w: 0.42, h: 0.48, ch: 0.5 }, { z: -1.05, cy: 0.7, w: 0.34, h: 0.44 }, { z: -1.6, cy: 0.56, w: 0.2, h: 0.26 }, { z: -1.95, cy: 0.5, w: 0.1, h: 0.12 }], BODY, { front: DARK });
    prism(-0.4, { cx: 0, cy: 1.06, w: 0.06, h: 0.1 }, -1.85, { cx: 0, cy: 0.64, w: 0.04, h: 0.06 }, DARK);                    // spine ridge
    for (const s of [-1, 1]) {
      accent(() => prism(-0.55, { cx: s * 0.2, cy: 0.99, w: 0.02, h: 0.02 }, -1.5, { cx: s * 0.1, cy: 0.67, w: 0.02, h: 0.02 }, ACC));   // shoulder seams
      for (let k = 0; k < 3; k++) box(s * 0.18, 0.92 - k * 0.1, -0.7 - k * 0.22, 0.1, 0.015, 0.06, DARK);                    // cooling louvres
    }
  } else {
    const ab = 0.22 + sp.engine * 0.03;
    loft([{ z: 0.42, cy: 0.9, w: ab, h: ab }, { z: 0.05, cy: 0.9, w: 0.36, h: 0.4 }, { z: -0.45, cy: 0.82, w: 0.4, h: 0.52 }, { z: -1.05, cy: 0.68, w: 0.32, h: 0.42 },
      { z: -1.6, cy: 0.56, w: 0.2, h: 0.26 }, { z: -1.95, cy: 0.5, w: 0.1, h: 0.12 }], BODY, { front: DARK });
  }
  if (sp.fin) prism(-0.55, { cx: 0, cy: 0.98, w: 0.03, h: 0.3 }, -1.9, { cx: 0, cy: 0.72, w: 0.03, h: 0.44 }, BODY);
  if (chrome) accent(() => box(0, 0.6, -1.55, 0.26, 0.1, 0.05, ACC)); else box(0, 0.6, -1.55, 0.26, 0.1, 0.05, M.GOLD);
  // sidepods, floor edges, suspension
  for (const s of [-1, 1]) {
    loft([{ z: 0.78, cx: s * 0.64 * wide, cy: 0.33, w: 0.5 * wide, h: 0.46, ch: 0.3 }, { z: 0.25, cx: s * 0.66 * wide, cy: 0.34, w: 0.56 * wide, h: 0.5, ch: 0.3 },
      { z: -0.55, cx: s * 0.62 * wide, cy: 0.32, w: 0.5 * wide, h: 0.44 }, { z: -1.25, cx: s * 0.48, cy: 0.27, w: 0.3, h: 0.3 }, { z: -1.8, cx: s * 0.38, cy: 0.23, w: 0.14, h: 0.16 }], BODY, { front: DARK });
    box(s * 0.64 * wide, 0.36, 0.8, 0.44 * wide, 0.34, 0.05, DARK);
    if (sp.floor >= 2) box(s * 0.55, 0.22, 1.2, 0.03, 0.36, 0.5, DARK);
    if (sp.floor >= 3) box(s * 0.7, 0.1, 1.0, 0.3, 0.02, 0.7, DARK);
    if (sp.floor >= 4) box(s * 0.82, 0.14, 0.2, 0.03, 0.12, 1.4, M.NAVY);
    if (neon) accent(() => { box(s * 0.9 * wide, 0.3, 0.1, 0.02, 0.03, 1.2, ACC);                                             // glowing flank strip
      prism(0.7, { cx: s * 0.66 * wide, cy: 0.565, w: 0.3 * wide, h: 0.015 }, -1.2, { cx: s * 0.48, cy: 0.43, w: 0.14, h: 0.015 }, ACC); });   // shoulder seam
    if (chrome) { E.setAux(AUX.UNDERGLOW); box(s * (0.92 * wide + 0.05), 0.085, 0.05, 0.08, 0.025, 1.7, BODY); E.setAux(0); }   // pulsing underglow strip
    box(s * 0.48, 0.74, 0.78, 0.08, 0.06, 0.1, DARK); box(s * 0.5, 0.8, 0.82, 0.18, 0.1, 0.05, M.CHROME);
    const bd = 0.12 + sp.brakes * 0.02;
    box(s * 0.62, 0.36, WB_F, bd, 0.2, 0.2, DARK); box(s * 0.6, 0.36, WB_R, bd, 0.22, 0.24, DARK);
    box(s * 0.55, 0.38, 1.86, 0.5, 0.03, 0.06, DARK); box(s * 0.55, 0.38, 1.56, 0.5, 0.03, 0.06, DARK); box(s * 0.55, 0.2, WB_F, 0.5, 0.03, 0.05, DARK);
    box(s * 0.5, 0.42, -1.76, 0.5, 0.03, 0.06, DARK); box(s * 0.5, 0.42, -2.0, 0.5, 0.03, 0.06, DARK); box(s * 0.5, 0.22, WB_R, 0.5, 0.03, 0.05, DARK);
  }
  box(0, 0.76, 0.3, 0.44, 0.05, 0.62, DARK); box(0, 0.66, 0.92, 0.5, 0.2, 0.28, BODY);
  if (!opts.noDriver && !canopy) { box(0, 0.7, 0.05, 0.3, 0.12, 0.3, M.STRIPE); sphere(0, 0.88, 0.24, 0.155, 6, 10, M.GOLD, M.CYAN); }
  if (canopy) {   // closed canopy: top stays below y = 1.18 so the T-cam keeps a clear view
    loft([{ z: 1.05, cy: 0.74, w: 0.36, h: 0.14, ch: 0.5 }, { z: 0.6, cy: 0.86, w: 0.5, h: 0.4, ch: 0.5 }, { z: -0.2, cy: 0.9, w: 0.5, h: 0.5, ch: 0.5 }, { z: -0.75, cy: 0.82, w: 0.4, h: 0.36, ch: 0.5 }], M.HOLO, { front: DARK, back: DARK });
    box(0, 1.155, 0.05, 0.05, 0.02, 0.9, DARK);
  } else { for (let i = 0; i <= 40; i++) { const ang = (i / 40) * Math.PI; box(Math.cos(ang) * 0.42, 0.8 + Math.sin(ang) * 0.22, -0.28 + Math.sin(ang) * 1.05, 0.062, 0.062, 0.085, DARK); } box(0, 0.88, 0.73, 0.05, 0.3, 0.05, DARK); }
  if (chrome) { E.setAux(AUX.EYE); for (const s of [-1, 1]) box(s * 0.045, 0.315, 2.64 * stretch, 0.045, 0.03, 0.09, BODY); E.setAux(0); }   // Ultron eyes
  // front wing
  const spoon = u => { const d = Math.abs(u - 0.5) * 2; return d > 0.55 ? (d - 0.55) * 0.16 : 0; }, fa = 0.08 + sp.frontWing * 0.035, zfw = 2.86 * stretch;
  wingElement({ x0: -1.05, x1: 1.05, zLE: zfw, yLE: 0.06, chord: 0.4 + sp.frontWing * 0.02, aoa: fa, thick: 0.03, mat: DARK, matTop: PLAIN, segs: 10, spoon });
  if (sp.frontWing >= 2) { wingElement({ x0: -0.92, x1: -0.16, zLE: zfw - 0.36, yLE: 0.13, chord: 0.24, aoa: fa * 3, thick: 0.028, mat: M.STRIPE, segs: 4, spoon: u => spoon(0.5 - u * 0.45) }); wingElement({ x0: 0.16, x1: 0.92, zLE: zfw - 0.36, yLE: 0.13, chord: 0.24, aoa: fa * 3, thick: 0.028, mat: M.STRIPE, segs: 4, spoon: u => spoon(0.5 + u * 0.45) }); }
  if (sp.frontWing >= 3) { wingElement({ x0: -0.86, x1: -0.2, zLE: zfw - 0.53, yLE: 0.21, chord: 0.16, aoa: fa * 4.2, thick: 0.025, mat: DARK, matTop: PLAIN, segs: 3 }); wingElement({ x0: 0.2, x1: 0.86, zLE: zfw - 0.53, yLE: 0.21, chord: 0.16, aoa: fa * 4.2, thick: 0.025, mat: DARK, matTop: PLAIN, segs: 3 }); }
  for (const s of [-1, 1]) { box(s * 1.07, 0.2, zfw - 0.26, 0.03, 0.3, 0.66, DARK, { side: M.NAVY }); box(s * 1.14, 0.06, zfw - 0.24, 0.16, 0.025, 0.5, DARK);
    if (sp.frontWing >= 4) box(s * 0.98, 0.34, zfw - 0.5, 0.03, 0.1, 0.22, M.CYAN); if (sp.frontWing >= 5) box(s * 0.75, 0.3, zfw - 0.44, 0.03, 0.08, 0.18, M.CYAN); box(s * 0.13, 0.17, zfw - 0.2, 0.05, 0.18, 0.26, DARK);
    if (neon) accent(() => box(s * 1.075, 0.33, zfw - 0.26, 0.036, 0.02, 0.5, ACC)); }                                       // endplate seam
  // rear wing + DRS flap (group 5)
  const rc = 0.24 + sp.rearWing * 0.04, ra = 0.1 + sp.rearWing * 0.05;
  wingElement({ x0: -0.49, x1: 0.49, zLE: -2.18, yLE: 0.8, chord: rc, aoa: ra, thick: 0.035, mat: DARK, matTop: PLAIN, segs: 5 });
  E.setGroup(5); wingElement({ x0: -0.49, x1: 0.49, zLE: C.DRS_HINGE.z, yLE: C.DRS_HINGE.y, chord: 0.16 + sp.rearWing * 0.02, aoa: ra * 2, thick: 0.03, mat: M.STRIPE, segs: 5 });
  if (sp.rearWing >= 5) box(0, C.DRS_HINGE.y + 0.12, C.DRS_HINGE.z - 0.24, 0.98, 0.04, 0.02, M.GOLD); E.setGroup(0);
  for (const s of [-1, 1]) { box(s * 0.51, 0.8, -2.38, 0.03, 0.56, 0.6, DARK, { side: M.NAVY }); accent(() => box(s * 0.515, 0.62, -2.3, 0.032, 0.03, 0.34, ACC)); box(s * 0.2, 0.68, -2.1, 0.03, 0.3, 0.12, DARK); }
  if (sp.drs) box(0, 1.08, -2.5, 0.12, 0.06, 0.12, M.GOLD);
  wingElement({ x0: -0.45, x1: 0.45, zLE: -2.22, yLE: 0.42, chord: 0.14, aoa: 0.2, thick: 0.025, mat: DARK, segs: 3 });
  // diffuser, fan (group 6), rear lights
  const dh = 0.3 + sp.floor * 0.06, dw = 1.0 + sp.floor * 0.05;
  prism(-1.6, { cx: 0, cy: 0.14, w: 0.9, h: 0.16 }, -2.28, { cx: 0, cy: dh / 2 + 0.1, w: dw, h: dh }, DARK);
  if (fan) {
    E.cylinder(0, 0.34, -2.3, 0.34, 0.1, 12, 'z', DARK);                                                                  // shroud
    E.setGroup(6); E.cylinder(0, 0.34, -2.35, 0.09, 0.08, 8, 'z', M.CHROME, DARK);                                            // hub
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3, cs = Math.cos(a), sn = Math.sin(a), r0 = 0.09, r1 = 0.3, hw = 0.035;   // blades
      const p = (r, w) => [cs * r - sn * w, 0.34 + sn * r + cs * w, -2.37];
      Q(p(r0, -hw), p(r0, hw), p(r1, hw), p(r1, -hw), k & 1 ? M.CHROME : M.RIM); Q(p(r0, -hw), p(r1, -hw), p(r1, hw), p(r0, hw), k & 1 ? M.CHROME : M.RIM); }
    E.setGroup(0); E.setAux(AUX.UNDERGLOW); if (chrome) { E.cylinder(0, 0.34, -2.31, 0.36, 0.02, 12, 'z', BODY); } E.setAux(0);   // glowing fan ring
  }
  if (canopy) { E.setAux(AUX.RAINLIGHT); box(0, 0.54, -2.36, 0.5, 0.06, 0.03, BODY); E.setAux(0); }                          // LED rain light bar
  else box(0, 0.58, -2.3, 0.1, 0.12, 0.05, M.STRIPE);
  box(0, 0.5, -2.08, 0.09, 0.09, 0.2, DARK);
  if (neon) accent(() => box(0, 0.24, -2.31, 0.9, 0.03, 0.02, ACC));
  box(-0.16, 1.02, 0.34, 0.02, 0.16, 0.02, M.GOLD); box(0, 1.19, 0.1, 0.12, 0.1, 0.16, DARK, { front: M.CYAN });
  // wheels (groups 1-4) and their fairings (groups 8-11)
  if (opts.wheels !== false) {
    const band = sp.tyres === 'SOFT' ? M.STRIPE : sp.tyres === 'MEDIUM' ? M.GOLD : M.BODY;
    for (const wd of C.WHEELS) { E.setGroup(wd.g); wheel(wd.cx, wd.r, wd.cz, wd.r, wd.w, 16, band, chrome ? M.CHROME : M.RIM); }
    if (fairings) for (const wd of C.WHEELS) { E.setGroup(C.GROUPS.FAIRING + wd.g - 1); E.setAux(AUX.PANEL); fairing(wd, wd.cx > 0 ? 1 : -1, BODY, chrome ? BODY : DARK); E.setAux(0); }
    E.setGroup(0);
  }
  // drone escort (group 7): built beside the car, orbited by makeXform
  if (chrome && opts.drones !== false) {
    E.setGroup(7);
    for (const s of [-1, 1]) { const dx = s * DRONE.x, dy = DRONE.y;
      box(dx, dy, 0, 0.16, 0.05, 0.16, M.CHROME); box(dx, dy + 0.035, 0, 0.32, 0.012, 0.04, DARK); box(dx, dy + 0.035, 0, 0.04, 0.012, 0.32, DARK);
      E.setAux(AUX.EYE); box(dx, dy - 0.03, 0.05, 0.05, 0.02, 0.04, BODY); E.setAux(0); }
    E.setGroup(0);
  }
  // jack stands (group 12): nominal height JACK_H, scaled to the lift in makeXform
  if (opts.jacks) {
    E.setGroup(12);
    for (const z of [1.4, -1.6]) { box(0, 0.03, z, 0.56, 0.06, 0.34, M.STEEL); box(0, C.JACK_H / 2, z, 0.1, C.JACK_H - 0.02, 0.1, M.STEEL);
      for (const s of [-1, 1]) prism(z + 0.15, { cx: s * 0.2, cy: 0.07, w: 0.04, h: 0.02 }, z - 0.15, { cx: s * 0.06, cy: C.JACK_H * 0.6, w: 0.04, h: 0.02 }, M.STEEL);
      box(0, C.JACK_H - 0.03, z, 0.5, 0.06, 0.18, M.STEEL); }
    E.setGroup(0);
  }
  return E.end();
};
// holographic display copy: the same geometry (draw it with R.drawDynamic(..., 'ghost', 0, M.HOLO)); never retargets the livery
C.buildGhostHolo = (sp, era = 0, opts = {}) => C.build(sp, era, { ...opts, keepEra: true, noDriver: true });
// ---------- livery (per-pixel, model space) ----------
C.raceNo = '22'; C.era = 0;   // C.era is read by the livery hook so the paint evolves with the team (build() sets it too)
function numberAt(u, v, cell) { const col = Math.floor(u / cell), row = Math.floor(v / cell); if (row < 0 || row > 6 || col < 0) return false; const d = Math.floor(col / 6), c = col % 6; if (c === 5 || d >= C.raceNo.length) return false; const rows = E.DIGITS[C.raceNo[d]]; return rows ? rows[row][c] === '1' : false; }
E.hooks[M.LIVERY] = function (mx, my, mz, aux) {
  const ax = Math.abs(mx), f = C.era, chrome = f >= C.ERA.CHROME;
  if (aux) {   // animated panels, driven by the simulation clock
    const t = E.time;
    if (aux === AUX.UNDERGLOW) { const p = 0.55 + 0.45 * Math.sin(t * 5); return p > E.bayer(Math.floor(mz / 0.02), Math.floor((mx + my) / 0.02)) ? M.NEON_C : M.CYAN; }
    if (aux === AUX.RAINLIGHT) return (t % 0.5) < 0.25 ? M.NEON_R : M.STRIPE;
    if (aux === AUX.EYE) return (t % 4) < 0.12 ? M.CARBON : M.NEON_R;
    if (aux === AUX.SEAM) return chrome ? M.NEON_R : M.NEON_C;
    if (aux === AUX.PANEL) { if (my > 0.6 && my < 0.635) return chrome ? M.NEON_R : M.NEON_C; return chrome ? M.CHROME : M.BODY; }
  }
  // Flat graphic shapes with hard edges; only the split itself dithers, over a narrow band, so the
  // car reads as paint rather than noise. Light body forward, dark body aft, one swept division.
  const light = chrome ? M.CHROME : M.BODY, dark = M.NAVY, accent = chrome ? M.NEON_R : f >= C.ERA.NEON ? M.NEON_C : M.GOLD;
  if (mz > 2.45) return chrome ? M.NEON_R : M.STRIPE;                                  // nose tip
  if (ax > 0.78 && mz > -0.12 && mz < 0.7 && my > 0.18 && my < 0.58) {                   // race number on the flank
    const u = mx > 0 ? (0.62 - mz) : (mz + 0.04), v = 0.54 - my; if (numberAt(u, v, 0.044)) return chrome ? M.NEON_R : dark;
  }
  if (ax < 0.17 && mz < -0.48 && mz > -1.18 && my > 0.54) {                              // number on the engine cover
    const u = -0.53 - mz, v = mx + 0.13; if (numberAt(u, v, 0.031)) return light;
  }
  if (mz < -1.5 && mz > -1.86) {                                                         // chequered tail band
    const cx = Math.floor((mx + mz * 0.5) / 0.075), cy = Math.floor(my / 0.075); return ((cx + cy) & 1) ? light : dark;
  }
  if (my > 0.502 && my < 0.556 && ax > 0.42 && mz < 0.78 && mz > -1.34) return accent;   // shoulder line
  if (ax > 0.56 && my < 0.33 && mz < 1.25 && mz > -1.45) return dark;                     // dark lower flank
  const split = 0.62 - ax * 0.55 - Math.max(0, my - 0.5) * 0.9, t = (split - mz) / 0.34;  // swept division
  if (t <= 0) return light; if (t >= 1) return dark;
  return t > E.bayer(Math.floor(mz / 0.028) * 3, Math.floor((mx * 0.8 + my) / 0.028) * 3) ? dark : light;
};
// ---------- state + transform ----------
C.newState = () => ({ x: 0, y: 0, z: 0, yaw: 0, roll: 0, pitch: 0, spin: 0, steer: 0, speed: 0, s: 0, lap: 1, lapStart: 0, best: null, last: null, sector: 0, drsAngle: 0, drsOn: false, lapsDone: 0, off: 0, offPrev: 0, braking: false, fanSpin: 0, sectorTimes: [], lapTimes: [] });
// a parked car for the garage / parc fermé / finale: static pose at a position and heading
C.displayState = (x = 0, z = 0, yaw = 0) => ({ ...C.newState(), x, z, yaw });
// returns xform(x,y,z,group,out) for a car state. opts: lift (raise the body on jacks), wheelDrop (wheels rest on the floor
// while the body is lifted), pose:'display' (no spin, steer, roll, pitch, DRS or fan motion; the escort still hovers)
C.makeXform = function (c, opts = {}) {
  const lift = opts.lift || 0, drop = opts.wheelDrop || 0, display = opts.pose === 'display', jackScale = (lift + 0.02) / (C.JACK_H + 0.02);
  return function (x, y, z, g, o) {
    if (g >= 1 && g <= 4) {
      const wd = C.WHEELS[g - 1];
      if (!display) { let ry = y - wd.r, rz = z - wd.cz; const cs = Math.cos(c.spin), sn = Math.sin(c.spin), ny = ry * cs - rz * sn, nz = ry * sn + rz * cs; y = ny + wd.r; z = nz + wd.cz;
        if (wd.front) { const rx = x - wd.cx; rz = z - wd.cz; const c2 = Math.cos(c.steer), s2 = Math.sin(c.steer); x = rx * c2 + rz * s2 + wd.cx; z = -rx * s2 + rz * c2 + wd.cz; } }
      y -= drop;   // wheels resting on the floor while the body is on jacks
    } else if (g >= 8 && g <= 11) {   // wheel fairings follow the steering, never the spin
      const wd = C.WHEELS[g - 8];
      if (wd.front && !display) { const rx = x - wd.cx, rz = z - wd.cz, c2 = Math.cos(c.steer), s2 = Math.sin(c.steer); x = rx * c2 + rz * s2 + wd.cx; z = -rx * s2 + rz * c2 + wd.cz; }
      y -= drop;
    } else if (g === 5 && c.drsAngle > 0 && !display) { const ry = y - C.DRS_HINGE.y, rz = z - C.DRS_HINGE.z, cs = Math.cos(-c.drsAngle), sn = Math.sin(-c.drsAngle); y = ry * cs - rz * sn + C.DRS_HINGE.y; z = ry * sn + rz * cs + C.DRS_HINGE.z; }
    else if (g === 6 && !display) { const rx = x, ry = y - 0.34, cs = Math.cos(c.fanSpin), sn = Math.sin(c.fanSpin); x = rx * cs - ry * sn; y = rx * sn + ry * cs + 0.34; }
    else if (g === 7) {   // drone escort: two units orbiting the car on the simulation clock
      const side = x < 0 ? -1 : 1, a = E.time * 1.1 + (side > 0 ? 0 : Math.PI), lx = x - side * DRONE.x, ly = y - DRONE.y, ca = Math.cos(a), sa = Math.sin(a);
      x = lx * ca + z * sa + Math.sin(a) * DRONE.r; z = -lx * sa + z * ca + Math.cos(a) * DRONE.r - 0.2; y = ly + DRONE.h + Math.sin(E.time * 2.7 + side) * 0.08;
    }
    else if (g === 12) y *= jackScale;
    if (g === 0 || g === 5 || g === 6 || g === 7) y += lift;
    const roll = display ? 0 : c.roll, pitch = display ? 0 : c.pitch;
    const cr = Math.cos(roll), sr = Math.sin(roll), x2 = x * cr - (y - 0.3) * sr, y2 = (y - 0.3) * cr + x * sr + 0.3;
    const cp2 = Math.cos(pitch), sp = Math.sin(pitch), z2 = z * cp2 - (y2 - 0.3) * sp, y3 = (y2 - 0.3) * cp2 + z * sp + 0.3;
    const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw); o[0] = x2 * cy + z2 * sy + c.x; o[1] = y3 + c.y; o[2] = -x2 * sy + z2 * cy + c.z;
  };
};
})(window.SCR = window.SCR || {});
