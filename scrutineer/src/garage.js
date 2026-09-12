// ============================================================================
// SCR.garage — the hub. A STATIC three-quarter view of the whole garage: nothing orbits, so the
// player can read the room like a board. Ten stations around the walls, one per agent in the loop,
// each with its own crew member, its own props and four visual tiers. Stations are selectable (the
// UI anchors a card to each) and upgradeable in place.
// Facility eras: LOCK-UP 1994 (brick, wood) → WORKSHOP → FACTORY → TECHNOLOGY CENTRE → ORBITAL → SINGULARITY.
// ============================================================================
(function (SCR) {
'use strict';
const E = SCR.engine, M = E.M, G = SCR.garage = {};
const { box, sphere, Q } = E;
const RW = 46, RD = 34, RH = 9;
const ROLES = () => (SCR.team && SCR.team.ROLES) || [];
// Station anchors. Local +z faces into the room. Five along the back, two per side, one at the front.
const ANCH = {
  AERO:       { x: -16, z: -14.5, yaw: 0, label: 'WIND TUNNEL' },
  POWER:      { x: -8, z: -14.5, yaw: 0, label: 'DYNO' },
  DATA:       { x: 0, z: -14.5, yaw: 0, label: 'THE ARCHIVE' },
  TYRES:      { x: 8, z: -14.5, yaw: 0, label: 'TYRE BAY' },
  SIM:        { x: 16, z: -14.5, yaw: 0, label: 'SIMULATOR' },
  ENGINEER:   { x: -20.5, z: -5, yaw: Math.PI / 2, label: 'PIT WALL' },
  STRATEGY:   { x: -20.5, z: 5, yaw: Math.PI / 2, label: 'STRATEGY' },
  COMPLIANCE: { x: 20.5, z: -5, yaw: -Math.PI / 2, label: 'SCRUTINEERING' },
  HIST:       { x: 20.5, z: 5, yaw: -Math.PI / 2, label: 'THE WIKI' },
  TOOLS:      { x: -11, z: 13.5, yaw: Math.PI, label: 'TOOL BENCH' },
};
const CAR_POS = { x: 2.5, z: 2.5, yaw: -0.5 };
G.ANCH = ANCH; G.CAR_POS = CAR_POS;
// ---------- animated screens ----------
E.hooks[M.SCREEN] = function (mx, my, mz, a) {
  const sg = E.signs[a]; if (!sg) return M.CYAN; const [u, v] = E.signUV(sg, mx, my, mz);
  const w = sg.w || 1, h = sg.h || 1; if (u < 0.04 || u > w - 0.04 || v < 0.04 || v > h - 0.04) return M.CARBON;
  const t = E.time, k = sg.kind || 0, fx = u / w, fy = v / h;
  if (k === 0) { const row = Math.floor(fy * 7), col = Math.floor(fx * 18 + t * 4 + row * 3); return (col % 3) < 2 && E.hash2(col, row) > 0.35 ? M.CYAN : M.NAVY; }
  if (k === 1) { const y1 = 0.5 + 0.34 * Math.sin(fx * 11 + t * 1.6), y2 = 0.5 + 0.26 * Math.sin(fx * 7 - t * 1.1 + 2); return Math.abs(fy - y1) < 0.05 ? M.GOLD : Math.abs(fy - y2) < 0.05 ? M.CYAN : M.NAVY; }
  if (k === 2) { const r = Math.hypot(fx - 0.5, fy - 0.5); return Math.abs(r - ((t * 0.24) % 0.46)) < 0.03 ? M.HOLO : r < 0.05 ? M.NEON_R : M.NAVY; }
  if (k === 3) { const row = Math.floor(fy * 9), on = E.hash2(row, Math.floor(t * 1.5)) > 0.45, len = 0.2 + E.hash2(row, 3) * 0.7; return on && fx < len ? (row % 3 === 0 ? M.GREEN : M.CYAN) : M.NAVY; }
  const cx = Math.floor(fx * 14), cy = Math.floor(fy * 9); return E.hash2(cx + Math.floor(t * 2), cy) > 0.72 ? M.CYAN : M.NAVY;
};
function screen(x, y, z, w, h, kind) {
  E.setAux(E.signs.length); E.signs.push({ screen: true, o: [x, y, z], r: [1, 0, 0], u: [0, 1, 0], w, h, kind });
  Q([x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z], M.SCREEN); E.setAux(0);
  box(x + w / 2, y + h / 2, z - 0.06, w + 0.12, h + 0.12, 0.1, M.CARBON);
}
function label(text, x, y, z, width, fg, bg) {
  const cell = width / (text.length * 4 + 1); E.setAux(E.signs.length); E.signs.push({ text, o: [x, y, z], r: [1, 0, 0], u: [0, 1, 0], cell, fg, bg });
  const h = cell * 6.2; Q([x, y, z], [x + width, y, z], [x + width, y + h, z], [x, y + h, z], M.SIGN); E.setAux(0); return h;
}
// ---------- crew: one distinct figure per role ----------
// Each role gets its own overall colour, headgear, silhouette and prop, so nobody looks like anybody
// else at a glance. Groups: 0 body · 1 left arm · 2 right arm · 3 head.
const CREW = {
  ENGINEER:   { suit: M.NAVY, trim: M.GOLD, head: 'cans', prop: 'clipboard', build: 1.0 },
  STRATEGY:   { suit: M.PURPLE, trim: M.BODY, head: 'cap', prop: 'tablet', build: 0.94 },
  AERO:       { suit: M.BODY, trim: M.CYAN, head: 'bare', prop: 'wing', build: 1.02 },
  POWER:      { suit: M.STRIPE, trim: M.CARBON, head: 'visor', prop: 'wrench', build: 1.1 },
  TYRES:      { suit: M.AMBER, trim: M.CARBON, head: 'cap', prop: 'gun', build: 1.06 },
  DATA:       { suit: M.GREEN, trim: M.CARBON, head: 'cans', prop: 'tablet', build: 0.92 },
  SIM:        { suit: M.CYAN, trim: M.NAVY, head: 'vr', prop: 'none', build: 0.96 },
  TOOLS:      { suit: M.OVERALL, trim: M.STRIPE, head: 'cap', prop: 'gun', build: 1.12 },
  COMPLIANCE: { suit: M.CARBON, trim: M.BODY, head: 'peaked', prop: 'seal', build: 1.0 },
  HIST:       { suit: M.GOLD, trim: M.NAVY, head: 'bare', prop: 'book', build: 0.9 },
};
function crewFigure(role, tier) {
  const c = CREW[role] || CREW.ENGINEER, chrome = tier >= 3, b = c.build;
  const suit = chrome ? M.CHROME : c.suit, skin = chrome ? M.CHROME : M.SKIN, trim = chrome ? M.NEON_R : c.trim;
  E.setGroup(0);
  box(-0.11, 0.42 * b, 0, 0.17, 0.84 * b, 0.21, suit); box(0.11, 0.42 * b, 0, 0.17, 0.84 * b, 0.21, suit);
  box(-0.11, 0.04, 0.05, 0.19, 0.09, 0.34, M.CARBON); box(0.11, 0.04, 0.05, 0.19, 0.09, 0.34, M.CARBON);
  const ty = 1.14 * b;
  box(0, ty, 0, 0.5, 0.64 * b, 0.31, suit);
  box(0, ty + 0.06, 0.16, 0.14, 0.46 * b, 0.02, trim);
  box(0, ty - 0.3 * b, 0, 0.52, 0.09, 0.33, trim);
  if (tier >= 2 && !chrome) { box(0, ty + 0.04, 0, 0.58, 0.34, 0.38, M.CARBON); box(-0.2, ty + 0.16, 0.19, 0.1, 0.06, 0.03, M.NEON_C); }
  E.setGroup(1); box(-0.35, ty - 0.02, 0, 0.17, 0.62 * b, 0.19, suit); box(-0.35, ty - 0.36 * b, 0, 0.15, 0.13, 0.17, skin);
  E.setGroup(2); box(0.35, ty - 0.02, 0, 0.17, 0.62 * b, 0.19, suit); box(0.35, ty - 0.36 * b, 0, 0.15, 0.13, 0.17, skin);
  const hx = 0.35, hy = ty - 0.42 * b;
  if (c.prop === 'clipboard') { box(hx, hy, 0.16, 0.26, 0.32, 0.03, M.BODY); box(hx, hy + 0.14, 0.175, 0.2, 0.04, 0.02, M.CARBON); }
  else if (c.prop === 'tablet') { box(hx, hy, 0.16, 0.3, 0.2, 0.03, M.CARBON); box(hx, hy, 0.175, 0.26, 0.16, 0.01, M.CYAN); }
  else if (c.prop === 'wrench') { box(hx, hy - 0.06, 0.1, 0.06, 0.34, 0.06, M.STEEL); box(hx, hy - 0.24, 0.1, 0.14, 0.1, 0.08, M.STEEL); }
  else if (c.prop === 'gun') { box(hx, hy, 0.2, 0.14, 0.14, 0.32, M.STRIPE); box(hx, hy, 0.4, 0.08, 0.08, 0.14, M.STEEL); }
  else if (c.prop === 'book') { box(hx, hy, 0.15, 0.24, 0.3, 0.06, M.STRIPE); box(hx, hy, 0.185, 0.2, 0.26, 0.01, M.BODY); }
  else if (c.prop === 'seal') { box(hx, hy - 0.02, 0.14, 0.18, 0.18, 0.18, M.STEEL); box(hx, hy + 0.12, 0.14, 0.07, 0.14, 0.07, M.GOLD); }
  else if (c.prop === 'wing') { box(hx + 0.06, hy + 0.02, 0.2, 0.44, 0.04, 0.16, M.BODY); box(hx + 0.06, hy - 0.04, 0.2, 0.4, 0.03, 0.1, M.STRIPE); }
  E.setGroup(3);
  const hy2 = ty + 0.56 * b;
  sphere(0, hy2, 0, 0.19, 5, 8, skin);
  if (chrome) { box(-0.075, hy2 + 0.02, 0.17, 0.05, 0.04, 0.04, M.NEON_R); box(0.075, hy2 + 0.02, 0.17, 0.05, 0.04, 0.04, M.NEON_R); }
  else if (c.head === 'cans') { box(0, hy2 + 0.17, 0.02, 0.4, 0.06, 0.36, trim); box(-0.21, hy2 + 0.01, 0, 0.06, 0.17, 0.17, M.CARBON); box(0.21, hy2 + 0.01, 0, 0.06, 0.17, 0.17, M.CARBON); box(0.1, hy2 - 0.04, 0.19, 0.16, 0.04, 0.08, M.CARBON); }
  else if (c.head === 'cap') { box(0, hy2 + 0.16, 0, 0.38, 0.09, 0.37, trim); box(0, hy2 + 0.12, 0.24, 0.32, 0.04, 0.16, trim); }
  else if (c.head === 'visor') { box(0, hy2 + 0.17, 0, 0.4, 0.1, 0.38, M.STEEL); box(0, hy2 + 0.03, 0.17, 0.38, 0.13, 0.05, M.CARBON); }
  else if (c.head === 'peaked') { box(0, hy2 + 0.17, 0, 0.4, 0.1, 0.38, M.CARBON); box(0, hy2 + 0.13, 0.25, 0.36, 0.04, 0.18, M.CARBON); box(0, hy2 + 0.19, 0.02, 0.14, 0.06, 0.02, M.GOLD); }
  else if (c.head === 'vr') { box(0, hy2 + 0.03, 0.13, 0.42, 0.17, 0.12, M.CARBON); box(0, hy2 + 0.03, 0.2, 0.36, 0.11, 0.02, M.HOLO); box(0, hy2 + 0.14, 0, 0.42, 0.06, 0.34, M.CARBON); }
  else if (tier >= 2) box(0, hy2 + 0.02, 0.17, 0.36, 0.09, 0.06, M.HOLO);
  E.setGroup(0);
}
const figCache = {};
function crewMesh(role, tier) { const k = role + tier; if (!figCache[k]) { E.begin(); crewFigure(role, tier); figCache[k] = E.end(); } return figCache[k]; }
function crewXform(x0, z0, yaw, phase, mode) {
  const t = E.time + phase, c = Math.cos(yaw), s = Math.sin(yaw), bob = Math.sin(t * 1.5) * 0.014;
  const la = mode === 'type' ? -1.15 + Math.sin(t * 8) * 0.13 : mode === 'point' ? -0.45 : mode === 'work' ? -0.9 + Math.sin(t * 3) * 0.35 : Math.sin(t * 1.2) * 0.09;
  const ra = mode === 'type' ? -1.15 + Math.cos(t * 8) * 0.13 : mode === 'point' ? -1.95 + Math.sin(t * 2) * 0.14 : mode === 'work' ? -1.1 + Math.cos(t * 3) * 0.4 : -Math.sin(t * 1.2) * 0.09;
  const hy = mode === 'idle' ? Math.sin(t * 0.6) * 0.3 : mode === 'point' ? 0.2 : 0;
  return function (px, py, pz, g, o) {
    let x = px, y = py, z = pz;
    if (g === 1 || g === 2) { const a = g === 1 ? la : ra, cy = 1.42, ry = y - cy, ca = Math.cos(a), sa = Math.sin(a); y = ry * ca - z * sa + cy; z = ry * sa + z * ca; }
    else if (g === 3) { const ch = Math.cos(hy), sh = Math.sin(hy), nx = x * ch + z * sh; z = -x * sh + z * ch; x = nx; }
    y += bob; o[0] = x * c + z * s + x0; o[1] = y; o[2] = -x * s + z * c + z0;
  };
}
// ---------- stations: local space, facing +z, floor at y=0, wall behind at z=-1 ----------
const ST = {};
ST.ENGINEER = tier => {
  box(0, 0.74, 0.45, 3.4, 0.1, 1.2, tier >= 3 ? M.CHROME : tier >= 1 ? M.STEEL : M.WOOD);
  for (const s of [-1, 1]) box(s * 1.55, 0.37, 0.45, 0.12, 0.74, 1.1, tier >= 3 ? M.CHROME : M.STEEL);
  if (tier === 0) { box(-0.7, 0.81, 0.45, 0.6, 0.03, 0.8, M.BODY); box(0.8, 0.88, 0.35, 0.24, 0.2, 0.12, M.CARBON); box(0.2, 0.84, 0.05, 1.1, 0.07, 0.34, M.CARBON); box(-1.2, 0.9, 0.2, 0.2, 0.24, 0.2, M.STRIPE); }
  if (tier >= 1) { screen(-1.5, 0.8, 0.02, 1.0, 0.66, 0); screen(-0.4, 0.8, 0.02, 1.0, 0.66, 1); screen(0.7, 0.8, 0.02, 1.0, 0.66, 3); box(-1.0, 0.94, 0.8, 0.34, 0.24, 0.22, M.CARBON); }
  if (tier >= 2) { screen(-1.9, 1.62, -0.75, 1.8, 1.0, 1); screen(0.1, 1.62, -0.75, 1.8, 1.0, 3); box(0, 2.78, -0.85, 4.0, 0.12, 0.22, M.NEON_C); }
  if (tier >= 3) { box(0, 2.1, 1.3, 2.6, 1.3, 0.05, M.HOLO); for (const s of [-1, 1]) box(s * 1.6, 1.6, 1.3, 0.06, 1.5, 0.06, M.NEON_R); }
};
ST.STRATEGY = tier => {
  box(0, 0.76, 0.55, 2.8, 0.1, 1.1, tier >= 3 ? M.CHROME : tier >= 1 ? M.PANEL : M.WOOD);
  for (const s of [-1, 1]) box(s * 1.3, 0.38, 0.55, 0.12, 0.76, 1.0, M.STEEL);
  if (tier === 0) { box(0, 1.8, -0.92, 2.6, 1.5, 0.08, M.BODY); for (let k = 0; k < 7; k++) box(-1.0 + k * 0.32, 1.4 + (k % 3) * 0.28, -0.86, 0.24, 0.05, 0.02, M.NAVY); box(0.5, 0.84, 0.55, 0.4, 0.04, 0.55, M.BODY); }
  if (tier >= 1) { screen(-1.6, 1.25, -0.9, 3.2, 1.7, 1); box(-0.7, 0.9, 0.55, 0.55, 0.2, 0.44, M.CARBON); }
  if (tier >= 2) { screen(-2.5, 1.05, -0.9, 0.75, 2.1, 3); screen(1.75, 1.05, -0.9, 0.75, 2.1, 3); box(0, 3.25, -0.9, 3.6, 0.1, 0.18, M.NEON_P); }
  if (tier >= 3) { sphere(0, 2.0, 0.5, 0.55, 6, 10, M.HOLO); box(0, 1.32, 0.5, 0.55, 0.12, 0.55, M.CHROME); }
};
ST.AERO = tier => {
  if (tier === 0) { box(0, 0.72, 0.45, 2.6, 0.1, 1.1, M.WOOD); for (const s of [-1, 1]) box(s * 1.2, 0.36, 0.45, 0.12, 0.72, 1.0, M.WOOD);
    box(-0.35, 0.9, 0.45, 1.1, 0.24, 0.45, M.BODY); box(0.45, 0.94, 0.45, 0.34, 0.34, 0.34, M.CARBON); E.cylinder(1.0, 1.05, 0.45, 0.32, 0.12, 10, 'x', M.STEEL, M.CARBON); }
  else {
    const L = 3.4 + tier * 0.6, r = 0.6 + tier * 0.12;
    E.cylinder(0, 1.35, 0.25, r, L, 14, 'x', tier >= 3 ? M.CHROME : M.HOLO);
    for (const s of [-1, 1]) { E.cylinder(s * (L / 2 + 0.22), 1.35, 0.25, r + 0.12, 0.34, 14, 'x', M.STEEL, M.CARBON); box(s * (L / 2 - 0.45), 0.58, 0.25, 0.34, 1.16, 0.55, M.STEEL); }
    box(0, 1.18, 0.25, 1.2, 0.18, 0.55, M.BODY); box(0, 1.32, 0.25, 0.55, 0.14, 0.28, M.NAVY);
    box(-0.66, 1.12, 0.25, 0.34, 0.06, 0.85, M.STRIPE); box(0.68, 1.36, 0.25, 0.28, 0.32, 0.6, M.STRIPE);
    if (tier >= 2) for (let k = 0; k < 7; k++) box(-1.4 + k * 0.5, 1.35 + Math.sin(k * 1.1) * 0.28, 0.25 + Math.cos(k * 1.3) * 0.32, 0.44, 0.03, 0.03, M.NEON_C);
    if (tier >= 2) screen(-1.3, 2.3, -0.9, 2.6, 1.0, 1);
    if (tier >= 3) { box(0, 3.0, 0.25, L + 0.7, 0.1, 0.1, M.NEON_R); box(0, 0.07, 0.25, L + 0.7, 0.05, 1.8, M.NEON_C); }
  }
};
ST.POWER = tier => {
  box(0, 0.37, 0.35, 1.8, 0.74, 1.3, M.STEEL); box(0, 1.16, 0.35, 1.2, 0.86, 1.0, M.CARBON);
  for (let k = 0; k < 6; k++) box(-0.45 + k * 0.18, 1.72, 0.35, 0.11, 0.26, 0.55, M.STEEL);
  for (const s of [-1, 1]) E.cylinder(s * 0.76, 1.26, 0.35, 0.17, 0.55, 8, 'x', M.STEEL, M.CARBON);
  if (tier === 0) { box(1.05, 0.55, 1.0, 0.55, 1.1, 0.45, M.STRIPE); box(-1.1, 0.3, 0.9, 0.5, 0.6, 0.5, M.WOOD); }
  if (tier >= 1) { screen(-1.75, 1.05, -0.9, 1.5, 1.1, 1); box(1.2, 0.65, 0.35, 0.55, 1.3, 0.65, M.NAVY); for (let k = 0; k < 4; k++) box(1.2, 0.28 + k * 0.3, 0.68, 0.34, 0.07, 0.03, M.CYAN); }
  if (tier >= 2) { box(-1.3, 1.4, 0.35, 0.18, 2.8, 0.18, M.STEEL); box(-1.3, 2.7, -0.2, 0.18, 0.18, 1.3, M.STEEL); box(0, 2.5, 0.35, 0.14, 0.14, 2.8, M.STEEL); screen(0.35, 1.05, -0.9, 1.5, 1.1, 0); }
  if (tier >= 3) { sphere(0, 2.35, 0.35, 0.46, 6, 10, M.HOLO); sphere(0, 2.35, 0.35, 0.2, 4, 8, M.NEON_R); box(0, 3.1, 0.35, 1.3, 0.07, 0.07, M.NEON_C); }
};
ST.TYRES = tier => {
  const tyre = (x, y, z, band) => { E.cylinder(x, y, z, 0.38, 0.42, 12, 'x', M.TYRE, M.RIM); if (band) E.cylinder(x, y, z, 0.41, 0.36, 12, 'x', band); };
  const bands = [M.STRIPE, M.GOLD, M.BODY];
  for (let k = 0; k < (tier >= 1 ? 6 : 3); k++) tyre(-1.25 + (k % 3) * 0.64, 0.38 + Math.floor(k / 3) * 0.76, 0.45, bands[k % 3]);
  box(0, 0.06, 0.45, 2.4, 0.12, 1.1, M.STEEL);
  if (tier === 0) { box(1.3, 1.55, -0.9, 1.3, 1.0, 0.08, M.BODY); box(1.3, 1.55, -0.85, 1.0, 0.05, 0.02, M.NAVY); }
  if (tier >= 1) { screen(0.55, 1.25, -0.9, 1.7, 1.05, 1); box(1.5, 0.45, 0.55, 0.34, 0.9, 0.34, M.NAVY); }
  if (tier >= 2) { for (let k = 0; k < 5; k++) box(-1.25 + k * 0.62, 1.6, 0.95, 0.08, 0.08, 0.08, M.LAMP); box(0, 1.95, 0.95, 2.6, 0.05, 0.05, M.STEEL); screen(-1.85, 1.25, -0.9, 1.25, 1.05, 0); }
  if (tier >= 3) { box(1.7, 1.15, 0.65, 0.03, 2.1, 0.65, M.HOLO); box(1.7, 0.12, 0.65, 0.45, 0.12, 0.85, M.CHROME); }
};
ST.DATA = tier => {
  if (tier === 0) { box(0, 1.05, -0.85, 2.2, 2.1, 0.45, M.WOOD); for (let k = 0; k < 4; k++) box(0, 0.35 + k * 0.55, -0.85, 2.1, 0.05, 0.42, M.WOOD);
    box(-0.45, 0.6, -0.85, 0.34, 0.24, 0.34, M.NAVY); box(0.35, 1.2, -0.85, 0.44, 0.24, 0.34, M.STRIPE); box(0.6, 1.72, -0.85, 0.3, 0.22, 0.3, M.GOLD); }
  if (tier >= 1) { screen(-1.6, 0.95, -0.9, 1.5, 1.05, 0); screen(0.15, 0.95, -0.9, 1.5, 1.05, 3); box(0, 0.45, 0.25, 2.4, 0.08, 0.9, M.STEEL); box(-0.55, 0.56, 0.25, 0.55, 0.14, 0.45, M.CARBON); }
  if (tier >= 2) { screen(-1.6, 2.1, -0.9, 1.5, 1.05, 1); screen(0.15, 2.1, -0.9, 1.5, 1.05, 2); screen(-2.6, 0.95, -0.9, 0.85, 2.2, 0); screen(1.75, 0.95, -0.9, 0.85, 2.2, 0); }
  if (tier >= 3) { E.cylinder(0, 1.7, 1.0, 0.38, 3.2, 10, 'y', M.HOLO); E.cylinder(0, 0.1, 1.0, 0.6, 0.2, 12, 'y', M.CHROME, M.CHROME); for (let k = 0; k < 5; k++) box(0, 0.55 + k * 0.6, 1.0, 0.95, 0.04, 0.95, M.NEON_C); }
};
ST.SIM = tier => {
  box(0, 0.3, 0.5, 1.3, 0.16, 1.6, tier >= 2 ? M.CHROME : M.STEEL);
  box(0, 0.62, 0.15, 0.7, 0.5, 0.7, tier >= 3 ? M.CHROME : M.CARBON); box(0, 1.05, -0.05, 0.62, 0.7, 0.22, tier >= 3 ? M.CHROME : M.CARBON);
  box(0, 0.92, 0.62, 0.5, 0.09, 0.4, M.STEEL); E.cylinder(0, 0.98, 0.85, 0.22, 0.08, 10, 'z', M.CARBON, M.STRIPE);
  if (tier === 0) { box(0, 1.5, -0.92, 1.4, 1.0, 0.08, M.BODY); box(-1.3, 0.5, 0.4, 0.7, 1.0, 0.7, M.WOOD); }
  if (tier >= 1) screen(-1.1, 1.05, -0.9, 2.2, 1.35, 2);
  if (tier >= 2) { screen(-2.4, 1.0, -0.6, 1.2, 1.5, 1); screen(1.2, 1.0, -0.6, 1.2, 1.5, 1); box(0, 2.6, -0.7, 4.4, 0.12, 0.16, M.NEON_C); }
  if (tier >= 3) { for (let k = 0; k <= 8; k++) { const a = Math.PI * (0.1 + 0.8 * k / 8); box(Math.cos(a) * 2.3, 1.4 + Math.sin(a) * 1.5, 0.4, 0.12, 0.12, 0.5, M.CHROME); } box(0, 3.05, 0.4, 4.6, 0.08, 0.08, M.NEON_R); }
};
ST.TOOLS = tier => {
  box(0, 0.82, 0.45, 3.2, 0.12, 1.1, tier >= 3 ? M.CHROME : tier >= 1 ? M.STEEL : M.WOOD);
  for (const s of [-1, 1]) box(s * 1.45, 0.41, 0.45, 0.16, 0.82, 1.0, M.STEEL);
  box(-0.85, 1.02, 0.45, 0.8, 0.28, 0.55, M.STRIPE); for (let k = 0; k < 4; k++) box(-1.0 + k * 0.2, 1.19, 0.45, 0.09, 0.05, 0.45, M.CARBON);
  box(0.95, 0.94, 0.45, 0.34, 0.12, 0.34, M.STEEL); box(0.95, 1.12, 0.45, 0.07, 0.34, 0.07, M.STEEL);
  if (tier >= 1) { for (let k = 0; k < 2; k++) { box(0.25 + k * 0.4, 1.0, 0.32, 0.14, 0.22, 0.34, M.CARBON); box(0.25 + k * 0.4, 1.16, 0.2, 0.07, 0.14, 0.14, M.STRIPE); }
    box(-1.85, 0.65, -0.6, 0.7, 1.3, 0.55, M.STRIPE); for (let k = 0; k < 4; k++) box(-1.85, 0.22 + k * 0.3, -0.32, 0.55, 0.05, 0.03, M.STEEL); }
  if (tier >= 2) { for (const s of [-1, 1]) box(s * 1.7, 1.7, 1.5, 0.14, 3.4, 0.14, M.STEEL); box(0, 3.35, 1.5, 3.6, 0.14, 0.14, M.STEEL);
    for (let k = -1; k <= 1; k++) box(k * 1.1, 3.18, 1.5, 0.45, 0.16, 0.22, M.LAMP); screen(-0.7, 1.5, -0.9, 1.3, 0.85, 0); }
  if (tier >= 3) { box(1.3, 0.55, -0.5, 1.1, 1.1, 0.9, M.CHROME); box(1.3, 1.2, -0.5, 0.65, 0.22, 0.65, M.NEON_R); box(0, 3.6, 1.5, 3.6, 0.07, 0.07, M.NEON_C); }
};
ST.COMPLIANCE = tier => {
  box(0, 0.76, 0.55, 2.6, 0.1, 1.1, tier >= 3 ? M.CHROME : tier >= 1 ? M.PANEL : M.WOOD);
  for (const s of [-1, 1]) box(s * 1.2, 0.38, 0.55, 0.12, 0.76, 1.0, tier >= 1 ? M.STEEL : M.WOOD);
  for (let k = 0; k < 3; k++) box(-0.75 + k * 0.06, 0.85 + k * 0.09, 0.55, 0.55, 0.09, 0.75, k === 1 ? M.STRIPE : M.NAVY);
  box(1.6, 0.75, -0.65, 0.65, 1.5, 0.55, M.STEEL); for (let k = 0; k < 4; k++) box(1.6, 0.22 + k * 0.34, -0.36, 0.55, 0.05, 0.03, M.CARBON);
  box(0.55, 1.05, 0.55, 0.55, 0.55, 0.55, M.STEEL); box(0.55, 1.42, 0.55, 0.22, 0.22, 0.22, M.GOLD); box(0.55, 1.62, 0.55, 0.07, 0.34, 0.07, M.STEEL);
  if (tier === 0) box(-1.3, 1.75, -0.92, 0.85, 1.05, 0.08, M.BODY);
  if (tier >= 2) { for (let k = 0; k < 5; k++) label(k % 2 ? 'TD 0' + (k + 3) : 'ARTICLE', -2.3 + k * 0.95, 1.55 + (k % 2) * 0.58, -0.9, 0.85, M.NAVY, M.BODY); screen(-0.45, 2.4, -0.9, 1.5, 0.75, 3); }
  if (tier >= 3) { E.cylinder(-1.7, 1.45, 0.65, 0.32, 2.7, 10, 'y', M.HOLO); box(0.55, 1.05, 0.55, 0.6, 0.6, 0.6, M.CHROME); box(0.55, 1.45, 0.55, 0.26, 0.26, 0.26, M.NEON_R); }
};
ST.HIST = tier => {
  box(0, 1.1, -0.85, 3.0, 2.2, 0.5, tier >= 2 ? M.PANEL : M.WOOD);
  for (let k = 0; k < 5; k++) box(0, 0.28 + k * 0.5, -0.85, 2.9, 0.06, 0.46, tier >= 2 ? M.STEEL : M.WOOD);
  for (let k = 0; k < 16; k++) { const sh = Math.floor(k / 4), x = -1.2 + (k % 4) * 0.34 + (sh % 2) * 0.12;
    box(x, 0.48 + sh * 0.5, -0.85, 0.13, 0.34, 0.4, [M.STRIPE, M.NAVY, M.GOLD, M.GREEN][(k + sh) % 4]); }
  box(0, 0.78, 0.5, 1.9, 0.1, 0.95, tier >= 3 ? M.CHROME : M.WOOD); for (const s of [-1, 1]) box(s * 0.85, 0.39, 0.5, 0.1, 0.78, 0.85, M.STEEL);
  box(-0.3, 0.86, 0.5, 0.6, 0.06, 0.7, M.BODY);
  if (tier >= 1) screen(0.15, 0.86, 0.48, 0.7, 0.5, 3);
  if (tier >= 2) { screen(-1.55, 2.45, -0.9, 3.1, 1.0, 3); box(0, 3.6, -0.9, 3.4, 0.1, 0.16, M.NEON_C); }
  if (tier >= 3) for (let k = 0; k < 3; k++) E.cylinder(-1.0 + k * 1.0, 2.1, 0.7, 0.26, 1.5, 10, 'y', M.HOLO);
};
// ---------- room ----------
function buildRoom(ei, teamName) {
  E.begin(); E.setGroup(0); E.setAux(0);
  const hx = RW / 2, hz = RD / 2;
  Q([-hx, 0, hz], [hx, 0, hz], [hx, 0, -hz], [-hx, 0, -hz], M.CONCRETE);
  if (ei <= 1) for (let k = 0; k < 8; k++) { const x = -14 + E.hash2(k, 3) * 28, z = -8 + E.hash2(k, 4) * 18;
    Q([x - 1.3, 0.01, z + 0.9], [x + 1.3, 0.01, z + 0.9], [x + 1.1, 0.01, z - 1.0], [x - 1.1, 0.01, z - 1.0], M.RUBBER); }
  const bx = CAR_POS.x, bz = CAR_POS.z, bw = 4.2, bd = 6.4, bm = ei >= 4 ? M.NEON_C : ei >= 2 ? M.GOLD : M.KERB_W;
  for (const [x0, z0, w, d] of [[bx - bw, bz - bd, 0.18, bd * 2], [bx + bw, bz - bd, 0.18, bd * 2], [bx - bw, bz - bd, bw * 2, 0.18], [bx - bw, bz + bd, bw * 2, 0.18]])
    Q([x0, 0.014, z0 + d], [x0 + w, 0.014, z0 + d], [x0 + w, 0.014, z0], [x0, 0.014, z0], bm);
  if (ei >= 3) for (let k = -6; k <= 6; k++) Q([-hx + 2, 0.012, k * 3 + 0.06], [hx - 2, 0.012, k * 3 + 0.06], [hx - 2, 0.012, k * 3 - 0.06], [-hx + 2, 0.012, k * 3 - 0.06], ei >= 5 ? M.NEON_R : M.NAVY);
  const wallMat = ei === 0 ? M.BRICK : ei === 1 ? M.CONCRETE : ei <= 3 ? M.PANEL : ei === 4 ? M.NAVY : M.CARBON;
  Q([-hx, 0, -hz], [hx, 0, -hz], [hx, RH, -hz], [-hx, RH, -hz], wallMat);
  Q([-hx, 0, hz], [-hx, 0, -hz], [-hx, RH, -hz], [-hx, RH, hz], wallMat);
  Q([hx, 0, -hz], [hx, 0, hz], [hx, RH, hz], [hx, RH, -hz], wallMat);
  if (ei === 0) for (let y = 0.5; y < RH; y += 0.5) { box(0, y, -hz + 0.03, RW, 0.05, 0.05, M.MORTAR); box(-hx + 0.03, y, 0, 0.05, 0.05, RD, M.MORTAR); box(hx - 0.03, y, 0, 0.05, 0.05, RD, M.MORTAR); }
  const colMat = ei >= 4 ? M.CHROME : M.STEEL;
  for (let k = 0; k < (ei === 0 ? 0 : 6); k++) { const x = -hx + (k + 0.5) * RW / 6; box(x, RH / 2, -hz + 0.3, 0.55, RH, 0.55, colMat); }
  for (let k = 0; k < (ei === 0 ? 0 : 3); k++) { const z = -hz + (k + 0.5) * RD / 3; box(-hx + 0.3, RH / 2, z, 0.55, RH, 0.55, colMat); box(hx - 0.3, RH / 2, z, 0.55, RH, 0.55, colMat); }
  if (ei >= 3) { const strip = ei >= 5 ? M.NEON_R : ei >= 4 ? M.HOLO : M.CYAN;
    box(0, RH - 1.3, -hz + 0.07, RW - 2, 0.14, 0.09, strip); box(-hx + 0.07, RH - 1.3, 0, 0.09, 0.14, RD - 2, strip); box(hx - 0.07, RH - 1.3, 0, 0.09, 0.14, RD - 2, strip); }
  const pools = [], lamps = ei === 0 ? [[-10, -5], [10, -5], [-10, 6], [10, 6], [CAR_POS.x, CAR_POS.z]] : [[-14, -7], [0, -7], [14, -7], [-14, 1], [14, 1], [-10, 8], [8, 8], [CAR_POS.x, CAR_POS.z]];
  for (const [x, z] of lamps) { box(x, RH - 1.15, z, ei === 0 ? 1.1 : 2.4, 0.18, ei === 0 ? 1.1 : 0.65, ei >= 5 ? M.NEON_R : M.LAMP); box(x, RH - 0.98, z, 2.6, 0.15, 0.85, ei >= 5 ? M.CHROME : M.CARBON); pools.push([x, z, ei === 0 ? 8 : 10]); }
  label(`${teamName} · ${['LOCK-UP 1994', 'WORKSHOP', 'FACTORY', 'TECHNOLOGY CENTRE', 'ORBITAL', 'SINGULARITY'][ei]}`, -13, RH - 3.4, -hz + 0.14, 26, ei >= 5 ? M.NEON_R : M.GOLD, M.NAVY);
  for (let k = 0; k < (ei <= 2 ? 3 : 2); k++) { const x = hx - 3.5 - k * 1.3, z = hz - 4; for (let j = 0; j < 3; j++) E.cylinder(x, 0.22 + j * 0.42, z, 0.38, 0.4, 10, 'y', M.TYRE, M.RIM); }
  box(-hx + 3.5, 0.65, hz - 4, 1.3, 1.3, 0.9, M.STRIPE); box(-hx + 5.2, 0.55, hz - 4, 1.0, 1.1, 0.9, M.NAVY);
  if (ei === 0) { for (let k = 0; k < 4; k++) box(-hx + 7 + k * 2.4, 0.55, -hz + 1.8, 2.0, 1.1, 1.0, M.WOOD); E.cylinder(-hx + 2.2, 0.6, -hz + 3.5, 0.42, 1.2, 8, 'y', M.STRIPE, M.CARBON); }
  if (ei >= 2) for (const s of [-1, 1]) { box(s * (hx - 5.5), 0.44, hz - 7, 3.4, 0.88, 1.7, M.PANEL); box(s * (hx - 5.5), 0.95, hz - 7, 3.2, 0.09, 1.5, M.CYAN); }
  if (ei >= 4) { for (let k = 0; k < 3; k++) E.cylinder(CAR_POS.x, 3.6 + k * 1.2, CAR_POS.z, 4.6 + k * 0.6, 0.07, 20, 'y', ei >= 5 ? M.NEON_R : M.HOLO);
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; box(Math.cos(a) * 11, 0.4, Math.sin(a) * 8, 1.7, 0.18, 1.7, M.NAVY); box(Math.cos(a) * 11, 0.55, Math.sin(a) * 8, 1.5, 0.07, 1.5, M.HOLO); } }
  if (ei >= 5) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; box(Math.cos(a) * 17, 4.3, Math.sin(a) * 13, 0.18, 8.6, 0.18, M.NEON_R); }
  const mesh = E.end();
  // Front wall, ceiling and the near columns live in their own mesh: the OVERVIEW camera looks in
  // through the missing fourth wall, every other camera gets the room closed.
  E.begin(); E.setGroup(0); E.setAux(0);
  Q([hx, 0, hz], [-hx, 0, hz], [-hx, RH, hz], [hx, RH, hz], wallMat);
  Q([-hx, RH, hz], [hx, RH, hz], [hx, RH, -hz], [-hx, RH, -hz], ei >= 5 ? M.CARBON : M.NAVY);
  if (ei !== 0) for (let k = 0; k < 6; k++) box(-hx + (k + 0.5) * RW / 6, RH / 2, hz - 0.3, 0.55, RH, 0.55, colMat);
  const truss = ei >= 4 ? M.CHROME : ei === 0 ? M.WOOD : M.STEEL;
  for (let k = -2; k <= 2; k++) { box(k * 9, RH - 0.5, -4, 0.34, 0.65, RD - 8, truss); for (let j = -4; j <= 1; j++) box(k * 9, RH - 0.9, j * 3, 0.18, 0.75, 0.18, truss); }
  return { mesh, front: E.end(), pools };
}
// ---------- selection ring, robot arms, drones ----------
function ringMesh(mat) { E.begin(); const n = 28, r0 = 2.3, r1 = 2.75;
  for (let i = 0; i < n; i++) { if (i % 4 === 3) continue; const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
    Q([Math.cos(a0) * r0, 0, Math.sin(a0) * r0], [Math.cos(a0) * r1, 0, Math.sin(a0) * r1], [Math.cos(a1) * r1, 0, Math.sin(a1) * r1], [Math.cos(a1) * r0, 0, Math.sin(a1) * r0], mat); }
  return E.end(); }
function armMesh() { E.begin(); E.setGroup(0); E.cylinder(0, 0.16, 0, 0.45, 0.32, 10, 'y', M.STEEL, M.CARBON); box(0, 0.48, 0, 0.42, 0.32, 0.42, M.CARBON);
  E.setGroup(1); box(0, 1.25, 0, 0.24, 1.4, 0.24, M.STRIPE); E.setGroup(2); box(0, 1.95, 0.62, 0.2, 0.2, 1.35, M.STRIPE);
  E.setGroup(3); box(0, 1.95, 1.4, 0.32, 0.13, 0.26, M.CARBON); box(0, 1.95, 1.55, 0.06, 0.32, 0.17, M.LAMP); E.setGroup(0); return E.end(); }
function armXform(x0, z0, yaw, phase) {
  const t = E.time * 0.8 + phase, a1 = Math.sin(t) * 0.32, a2 = -0.55 + Math.sin(t * 1.3 + 1) * 0.45, c = Math.cos(yaw), s = Math.sin(yaw);
  return function (px, py, pz, g, o) { let x = px, y = py, z = pz;
    if (g >= 2) { const ry = y - 1.95, ca = Math.cos(a2), sa = Math.sin(a2), nz = ry * sa + z * ca; y = ry * ca - z * sa + 1.95; z = nz; }
    if (g >= 1) { const ry = y - 0.64, ca = Math.cos(a1), sa = Math.sin(a1), nz = -ry * sa + z * ca; y = ry * ca + z * sa + 0.64; z = nz; }
    o[0] = x * c + z * s + x0; o[1] = y; o[2] = -x * s + z * c + z0; };
}
function droneMesh() { E.begin(); box(0, 0, 0, 0.55, 0.15, 0.55, M.CHROME);
  for (const s of [-1, 1]) for (const q of [-1, 1]) E.cylinder(s * 0.35, 0.07, q * 0.35, 0.18, 0.04, 6, 'y', M.CARBON);
  box(0, -0.11, 0, 0.18, 0.07, 0.18, M.LAMP); box(0, 0.11, 0.22, 0.11, 0.07, 0.09, M.NEON_R); return E.end(); }
// ---------- scene ----------
const stationCache = {};
function stationMesh(key, tier, ei) {
  const k = `${key}:${tier}:${ei >= 4 ? 'h' : 's'}`; if (stationCache[k]) return stationCache[k];
  E.begin(); E.setGroup(0); E.setAux(0); const from = E.current().length;
  (ST[key] || ST.ENGINEER)(tier);
  const a = ANCH[key]; label(a.label, -1.35, 3.7, -0.97, 2.7, M.GOLD, M.NAVY);
  E.rotateRange(from, a.yaw, a.x, a.z);
  stationCache[k] = E.end(); return stationCache[k];
}
const worldOf = (x, z, yaw, lx, lz) => [x + lx * Math.cos(yaw) + lz * Math.sin(yaw), -lx * Math.sin(yaw) + lz * Math.cos(yaw) + z];
const tierFor = lv => lv <= 3 ? 0 : lv <= 6 ? 1 : lv <= 9 ? 2 : 3;
const scenes = SCR.scenes = SCR.scenes || {};
const scene = G.scene = scenes.garage = { name: 'garage', done: false, selected: null, cam: 'OVERVIEW' };
G.UPGRADE_DUR = 3.8;
function rebuild(full) {
  scene.room = buildRoom(scene.eraIndex, scene.teamName);
  scene.carMesh = SCR.car.build(scene.spec, scene.era, { jacks: scene.eraIndex >= 1, drones: false }); SCR.car.era = scene.era;
  scene.holo = scene.eraIndex >= 4 ? SCR.car.buildGhostHolo(scene.spec, scene.era, { wheels: false }) : null;
  scene.carState = SCR.car.displayState ? SCR.car.displayState(CAR_POS.x, CAR_POS.z, CAR_POS.yaw) : Object.assign(SCR.car.newState(), { x: CAR_POS.x, z: CAR_POS.z, yaw: CAR_POS.yaw });
  scene.lift = scene.eraIndex >= 1 ? 0.45 : 0;
  scene.tiers = scene.tiers || {}; scene.stations = scene.stations || {};
  const MODES = ['type', 'work', 'idle', 'point'];
  for (const r of ROLES()) { const lv = scene.team ? scene.team.roles[r.key].level : 1; scene.tiers[r.key] = tierFor(lv); scene.stations[r.key] = stationMesh(r.key, scene.tiers[r.key], scene.eraIndex); }
  if (full || !scene.crew) scene.crew = ROLES().map((r, i) => { const a = ANCH[r.key] || ANCH.ENGINEER, [wx, wz] = worldOf(a.x, a.z, a.yaw, -2.35, 1.35);
    return { key: r.key, x: wx, z: wz, yaw: a.yaw + Math.PI + 0.55, phase: i * 1.37, mode: MODES[i % MODES.length] }; });
  scene.arms = scene.eraIndex >= 2 ? [{ x: CAR_POS.x - 5.4, z: CAR_POS.z - 1.2, yaw: 1.5, phase: 0 }, { x: CAR_POS.x + 5.4, z: CAR_POS.z + 1.2, yaw: -1.6, phase: 1.5 }] : [];
  scene.drones = scene.eraIndex >= 3 ? [0, 1, 2].map(k => ({ phase: k * 2.09 })) : [];
  scene.armM = scene.arms.length ? armMesh() : null; scene.droneM = scene.drones.length ? droneMesh() : null;
  scene.ringSel = scene.ringSel || ringMesh(M.GOLD); scene.ringUp = scene.ringUp || ringMesh(M.NEON_C);
}
scene.enter = function (app, payload) {
  const P = payload || {}, prm = app.params || {};
  scene.app = app; scene.R = app.R; scene.t = 0; scene.up = null; scene.camT = 0; scene.screenAnchors = {};
  scene.cam = prm.cam && (prm.cam.indexOf('STATION') === 0 || prm.cam === 'CAR') ? prm.cam : (P.cam || 'OVERVIEW');
  scene.team = P.team || (SCR.team ? SCR.team.distribute(prm.teamlevel ? parseInt(prm.teamlevel, 10) : SCR.team.ROLES.length) : null);
  scene.spec = P.spec || SCR.car.GEN01; scene.teamName = P.teamName || 'SCRUTINEER';
  scene.era = P.era !== undefined ? P.era : (prm.era ? parseFloat(prm.era) : (scene.team && scene.team.era ? scene.team.era.f : 0));
  scene.eraIndex = prm.eraindex ? parseInt(prm.eraindex, 10) : (scene.team && scene.team.era ? scene.team.era.index : Math.min(5, Math.floor(scene.era * 6)));
  if (prm.select) scene.selected = prm.select.toUpperCase();
  rebuild(true);
  scene.prevAmbient = app.R.ambient; app.R.ambient = 0.34;
  const prevDiag = app.diagExtra; scene.prevDiag = prevDiag;
  app.diagExtra = () => Object.assign(prevDiag ? prevDiag() : {}, { garage: { era: scene.eraIndex, eraF: +scene.era.toFixed(2), cam: scene.cam, selected: scene.selected, tiers: scene.tiers, anchors: Object.keys(scene.screenAnchors).filter(k => scene.screenAnchors[k]).length, upgrade: scene.up ? scene.up.role : null } });
  if (prm.upgrade && SCR.team) scene.pending = { role: prm.upgrade.toUpperCase(), at: 1.0 };
};
scene.exit = function () { if (scene.app) { scene.app.R.ambient = scene.prevAmbient; scene.app.diagExtra = scene.prevDiag; } };
scene.setCamera = n => { scene.cam = n; scene.camT = 0; };
scene.select = function (role) { scene.selected = role; if (scene.cam.indexOf('STATION_') === 0) scene.cam = role ? 'STATION_' + role : 'OVERVIEW'; };
scene.setTeam = function (team, spec) {
  scene.team = team; if (spec) scene.spec = spec;
  const ei = team.era ? team.era.index : scene.eraIndex, changed = ei !== scene.eraIndex;
  scene.eraIndex = ei; scene.era = team.era ? team.era.f : scene.era;
  if (changed || spec) rebuild(false);
  else for (const r of ROLES()) { const t = tierFor(team.roles[r.key].level); if (t !== scene.tiers[r.key]) { scene.tiers[r.key] = t; scene.stations[r.key] = stationMesh(r.key, t, ei); } }
};
scene.playUpgrade = function (role, def) { scene.up = { role, def, t: 0, rebuilt: false }; scene.selected = role; scene.cam = 'STATION_' + role; scene.camT = 0; return G.UPGRADE_DUR; };
scene.update = function (dt) {
  scene.t += dt; scene.camT += dt;
  if (scene.pending && scene.t >= scene.pending.at) { const r = scene.pending.role, lv = scene.team.roles[r] ? scene.team.roles[r].level : 1; scene.playUpgrade(r, SCR.team.levelDef(r, Math.min(12, lv + 3))); scene.pending = null; }
  if (scene.up) { const u = scene.up; u.t += dt;
    if (!u.rebuilt && u.t >= 0.6) { u.rebuilt = true; const tier = u.def ? (u.def.tier ?? 3) : Math.min(3, scene.tiers[u.role] + 1); scene.tiers[u.role] = tier; scene.stations[u.role] = stationMesh(u.role, tier, scene.eraIndex); }
    if (u.t >= G.UPGRADE_DUR) { scene.up = null; scene.cam = 'OVERVIEW'; scene.camT = 0; } }
  // Static cameras. OVERVIEW never moves: the garage is a board you read, not a ride.
  const cam = scene.R.cam;
  if (scene.cam.indexOf('STATION_') === 0) {
    const key = scene.cam.slice(8), a = ANCH[key] || ANCH.ENGINEER, pull = scene.up ? Math.min(1, scene.up.t / 0.7) : 1;
    // A three-quarter view: straight on, the camera stares at the back wall behind the station,
    // so it steps to the side and looks slightly down on the bench and the crew working it.
    const [px_, pz_] = worldOf(a.x, a.z, a.yaw, 1.2, 8.6 - pull * 1.4);
    const [tx, tz] = worldOf(a.x, a.z, a.yaw, -0.3, 0.6);
    cam.pos = [px_, 3.9 - pull * 0.5, pz_]; cam.target = [tx, 1.15, tz]; cam.fov = 40 - pull * 2;
  } else if (scene.cam === 'CAR') { cam.pos = [CAR_POS.x + 6.4, 2.6, CAR_POS.z + 8.2]; cam.target = [CAR_POS.x, 0.8 + scene.lift, CAR_POS.z]; cam.fov = 38; }
  else { cam.pos = [0, 20, 31]; cam.target = [0, 2.0, -3.5]; cam.fov = 50; }
};
const identity = (x, y, z, g, o) => { o[0] = x; o[1] = y; o[2] = z; };
scene.render = function () {
  const R = scene.R; R.begin(); R.gradient('#06081A', '#0B1030');
  R.seamCutoff = 36;
  R.drawStatic(scene.room.mesh);
  if (scene.cam !== 'OVERVIEW') R.drawStatic(scene.room.front);
  for (const k in scene.stations) { if (scene.up && scene.up.role === k && scene.up.rebuilt && scene.up.t < 1.2) continue; R.drawStatic(scene.stations[k]); }
  if (scene.up && scene.up.rebuilt && scene.up.t < 1.2) R.drawDynamic(scene.stations[scene.up.role], identity, 'ghost', 0, M.GOLD);
  const pools = scene.room.pools.slice();
  if (scene.selected && ANCH[scene.selected]) { const a = ANCH[scene.selected], [lx, lz] = worldOf(a.x, a.z, a.yaw, 0, 2.2); pools.push([lx, lz, 6]); }
  R.drawLightPools(pools);
  if (scene.selected && ANCH[scene.selected]) { const a = ANCH[scene.selected], [rx, rz] = worldOf(a.x, a.z, a.yaw, 0, 1.9);
    R.drawDynamic(scene.up ? scene.ringUp : scene.ringSel, (x, y, z, g, o) => { const s = Math.sin(E.time * 2) * 0.06 + 1; o[0] = x * s + rx; o[1] = 0.02; o[2] = z * s + rz; }, 'solid', 0); }
  const xf = SCR.car.makeXform(scene.carState, { lift: scene.lift, pose: 'display' });
  R.drawDynamic(scene.carMesh, xf, 'shadow', 0); R.drawDynamic(scene.carMesh, xf, 'solid', 0);
  if (scene.holo) { const hs = Object.assign({}, scene.carState, { yaw: scene.t * 0.4, y: 3.0 + Math.sin(scene.t * 0.8) * 0.15 });
    R.drawDynamic(scene.holo, SCR.car.makeXform(hs, { pose: 'display' }), 'ghost', 0, M.CYAN); }
  for (const c of scene.crew) { const tier = scene.tiers[c.key] || 0, mode = scene.up && scene.up.role === c.key ? 'point' : c.mode;
    R.drawDynamic(crewMesh(c.key, tier), crewXform(c.x, c.z, c.yaw, c.phase, mode), 'solid', 0); }
  for (const a of scene.arms) R.drawDynamic(scene.armM, armXform(a.x, a.z, a.yaw, a.phase), 'solid', 0);
  for (const d of scene.drones) { const a = scene.t * 0.5 + d.phase, r = 9, x = CAR_POS.x + Math.sin(a) * r, z = CAR_POS.z + Math.cos(a) * r, y = 3.4 + Math.sin(scene.t * 1.7 + d.phase) * 0.3;
    R.drawDynamic(scene.droneM, (px, py, pz, g, o) => { const c = Math.cos(a + Math.PI / 2), s = Math.sin(a + Math.PI / 2); o[0] = px * c + pz * s + x; o[1] = py + y; o[2] = -px * s + pz * c + z; }, 'solid', 0); }
  if (scene.up && !scene.app.reducedMotion) { const f = 1 - Math.min(1, Math.abs(scene.up.t - 0.6) / 0.32); if (f > 0) R.flash(f * 0.85); }
  R.outline(); R.seamCutoff = undefined;
  // screen-space anchors, normalised, so the UI can pin a card over every station
  const an = scene.screenAnchors;
  for (const r of ROLES()) { const a = ANCH[r.key]; if (!a) { an[r.key] = null; continue; }
    const [wx, wz] = worldOf(a.x, a.z, a.yaw, 0, 0.6), p = R.project(wx, 3.0, wz);
    an[r.key] = p ? { x: p[0] / R.W, y: p[1] / R.H, z: p[2] } : null; }
  const cp = R.project(CAR_POS.x, 1.6, CAR_POS.z); an.__car = cp ? { x: cp[0] / R.W, y: cp[1] / R.H, z: cp[2] } : null;
};
G.stationMesh = stationMesh; G.crewMesh = crewMesh; G.tierFor = tierFor;
})(window.SCR = window.SCR || {});
