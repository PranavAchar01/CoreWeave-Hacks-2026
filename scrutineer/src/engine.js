// ============================================================================
// SCR.engine — software rasterizer on 2D canvas, Bayer-dithered, pixel-art 3D
// Shared by every scene. No DOM except the target canvas. No allocation in hot loops.
// ============================================================================
(function (SCR) {
'use strict';
const E = SCR.engine = {};

// ---------- constants ----------
const BAYER = [
  0,32,8,40,2,34,10,42, 48,16,56,24,50,18,58,26, 12,44,4,36,14,46,6,38, 60,28,52,20,62,30,54,22,
  3,35,11,43,1,33,9,41, 51,19,59,27,49,17,57,25, 15,47,7,39,13,45,5,37, 63,31,55,23,61,29,53,21];
const bayer = E.bayer = (x, y) => (BAYER[((y & 7) << 3) | (x & 7)] + 0.5) / 64;
const hex = E.hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
E.mulberry32 = function (a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
E.hash2 = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
E.norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// ---------- palette: 4-step ramps (dark, mid, base, light). Add ramps here; never invent colours elsewhere. ----------
const RAMP = {
  BODY:    ['#5A6076', '#A8AECB', '#E8EBF5', '#FFFFFF'], NAVY: ['#05060F', '#0C1236', '#1A245C', '#3A4CA8'],
  STRIPE:  ['#4A0810', '#9E1220', '#E31E2D', '#FF6B72'], CARBON: ['#08090E', '#1C1F2B', '#343849', '#525872'],
  TYRE:    ['#000000', '#08080C', '#141419', '#242430'], RIM: ['#3A3E52', '#7E8499', '#D2D6E4', '#FFFFFF'],
  GOLD:    ['#6B4E0A', '#B8922C', '#F4C542', '#FFEDAE'], CYAN: ['#0A3A50', '#1F8FB0', '#3DD2FF', '#CDF4FF'],
  GREEN:   ['#0F4A24', '#1C8A42', '#2FD968', '#8CF0AE'], AMBER: ['#5E3A08', '#A86E10', '#FFA318', '#FFD27A'],
  PURPLE:  ['#3E1A5E', '#7A32B0', '#B04BFF', '#D9A0FF'], ASPHALT: ['#171922', '#252834', '#323544', '#434757'],
  RUBBER:  ['#0B0C12', '#14161E', '#1E2028', '#2C2E3A'], GRASS: ['#0B2A17', '#123F24', '#1F6B3C', '#2E8A4E'],
  GRASS2:  ['#0B2A17', '#123F24', '#1A5C33', '#27784A'], GRAVEL: ['#4A4030', '#6E5F44', '#8C7B58', '#B09C72'],
  KERB_R:  ['#5E0C13', '#A5161F', '#E31E2D', '#FF5A63'], KERB_W: ['#6A6F8A', '#C8CBD8', '#FFFFFF', '#FFFFFF'],
  ARMCO:   ['#2C2E3A', '#6A6F8A', '#C8CBD8', '#FFFFFF'], STAND: ['#0B1030', '#121A4A', '#1E2A6A', '#2A3A8A'],
  STEEL:   ['#191C26', '#333849', '#525872', '#7E8499'], LAMP: ['#CDF4FF', '#FFFFFF', '#FFFFFF', '#FFFFFF'],
  // garage / facility materials
  BRICK:   ['#3A1E14', '#6B3A26', '#8C4E34', '#B06A48'], MORTAR: ['#2C2E3A', '#474A5A', '#6A6F8A', '#8A8FA6'],
  CONCRETE:['#262A36', '#3E4354', '#5C6176', '#828799'], PANEL: ['#7E8499', '#BDC2D4', '#E4E8F2', '#FFFFFF'],
  WOOD:    ['#33200E', '#6B4420', '#96612F', '#BE8248'], CHROME: ['#40445A', '#8F96AE', '#DFE4F2', '#FFFFFF'],
  HOLO:    ['#0E4A5E', '#1F8FB0', '#3DD2FF', '#B8F0FF'], NEON_R: ['#5E0C13', '#E31E2D', '#FF5A63', '#FFFFFF'],
  NEON_C:  ['#1F8FB0', '#3DD2FF', '#B8F0FF', '#FFFFFF'], NEON_P: ['#7A32B0', '#B04BFF', '#D9A0FF', '#FFFFFF'],
  SKIN:    ['#5E3020', '#9C6342', '#D69A72', '#F5CDAA'], OVERALL: ['#0A0F2C', '#16205A', '#2E3F97', '#4F63C8'],
  // per-pixel resolved materials (a hook decides the ramp per pixel)
  LIVERY:  ['#6A6F8A', '#C8CBD8', '#FFFFFF', '#FFFFFF'], SIGN: ['#000000', '#000000', '#000000', '#000000'],
  CROWD:   ['#2C2E3A', '#6A6F8A', '#C8CBD8', '#FFFFFF'], SCREEN: ['#0E4A5E', '#1F8FB0', '#3DD2FF', '#B8F0FF'],
};
const MAT_NAMES = E.MAT_NAMES = Object.keys(RAMP), RAMPS = E.RAMPS = MAT_NAMES.map(k => RAMP[k].map(hex));
const M = E.M = {}; MAT_NAMES.forEach((k, i) => M[k] = i);
// The world stores material indices, not colours, so repainting a ramp repaints everything drawn
// in it. That is how one circuit is a desert and the next is a night race. Always applied from a
// pristine copy, so calling it twice is the same as calling it once.
const BASE_RAMPS = RAMPS.map(r => r.map(c2 => c2));
E.setPalette = function (over) {
  for (let i = 0; i < RAMPS.length; i++) RAMPS[i] = BASE_RAMPS[i];
  if (!over) return;
  for (const k in over) { const i = M[k]; if (i !== undefined) RAMPS[i] = over[k].map(hex); }
};
E.SHADOW_MAT = 250; E.LIGHT_MAT = 251;
const GROUND_MATS = E.GROUND_MATS = new Set([M.ASPHALT, M.RUBBER, M.GRASS, M.GRASS2, M.GRAVEL, M.KERB_R, M.KERB_W, M.CONCRETE]);
// emissive materials ignore lighting; metallic ones get extra ambient
const EMISSIVE = new Set([M.LAMP, M.NEON_R, M.NEON_C, M.NEON_P, M.SCREEN, M.HOLO]);
const METAL = new Set([M.RIM, M.GOLD, M.CYAN, M.CHROME]);
// per-pixel hooks: hooks[mat] = (mx, my, mz, aux) => ramp index. Registered by scene modules.
const hooks = E.hooks = {};
E.signs = [];          // shared registry of sign/screen/crowd descriptors, addressed by tri aux
E.time = 0;            // simulation time for animated hooks

// ---------- mesh construction ----------
// Every builder pushes into the current list. Use E.begin() / E.end() to collect a mesh.
let tris = [], group = 0, aux = 0;
E.begin = () => { tris = []; group = 0; aux = 0; };
E.setGroup = g => { group = g; };
E.setAux = a => { aux = a; };
E.current = () => tris;
const T = E.T = (a, b, c, m) => tris.push({ v: [a, b, c], m, g: group, aux });
const Q = E.Q = (a, b, c, d, m) => { T(a, b, c, m); T(a, c, d, m); };
E.prism = function (zF, f, zB, b, m, opts = {}) {
  const F = [[f.cx - f.w / 2, f.cy - f.h / 2, zF], [f.cx + f.w / 2, f.cy - f.h / 2, zF], [f.cx + f.w / 2, f.cy + f.h / 2, zF], [f.cx - f.w / 2, f.cy + f.h / 2, zF]];
  const B = [[b.cx - b.w / 2, b.cy - b.h / 2, zB], [b.cx + b.w / 2, b.cy - b.h / 2, zB], [b.cx + b.w / 2, b.cy + b.h / 2, zB], [b.cx - b.w / 2, b.cy + b.h / 2, zB]];
  Q(F[0], F[1], F[2], F[3], opts.front ?? m); Q(B[1], B[0], B[3], B[2], opts.back ?? m);
  Q(F[3], F[2], B[2], B[3], opts.top ?? m); Q(F[1], F[0], B[0], B[1], opts.bottom ?? m);
  Q(F[1], B[1], B[2], F[2], opts.side ?? m); Q(B[0], F[0], F[3], B[3], opts.side ?? m);
};
E.box = (cx, cy, cz, w, h, d, m, opts) => E.prism(cz + d / 2, { cx, cy, w, h }, cz - d / 2, { cx, cy, w, h }, m, opts);
E.ring = function (z, s) {
  const hw = s.w / 2, hh = s.h / 2, ch = s.ch ?? 0.38, cw = hw * ch, chh = hh * ch, cx = s.cx ?? 0, cy = s.cy;
  return [[cx - hw + cw, cy - hh, z], [cx + hw - cw, cy - hh, z], [cx + hw, cy - hh + chh, z], [cx + hw, cy + hh - chh, z],
          [cx + hw - cw, cy + hh, z], [cx - hw + cw, cy + hh, z], [cx - hw, cy + hh - chh, z], [cx - hw, cy - hh + chh, z]];
};
E.loft = function (sections, m, opts = {}) {
  const rings = sections.map(s => E.ring(s.z, s));
  for (let i = 0; i < rings.length - 1; i++) { const A = rings[i], B = rings[i + 1]; for (let k = 0; k < 8; k++) { const k2 = (k + 1) % 8; Q(A[k], B[k], B[k2], A[k2], m); } }
  const F = rings[0], Bk = rings[rings.length - 1];
  for (let k = 1; k < 7; k++) { T(F[0], F[k], F[k + 1], opts.front ?? m); T(Bk[0], Bk[k + 1], Bk[k], opts.back ?? m); }
};
E.sphere = function (cx, cy, cz, r, lat, lon, m, capMat) {
  for (let i = 0; i < lat; i++) { const p0 = (i / lat) * Math.PI, p1 = ((i + 1) / lat) * Math.PI;
    for (let j = 0; j < lon; j++) { const t0 = (j / lon) * Math.PI * 2, t1 = ((j + 1) / lon) * Math.PI * 2;
      const v = (p, t) => [cx + r * Math.sin(p) * Math.sin(t), cy + r * Math.cos(p), cz + r * Math.sin(p) * Math.cos(t)];
      const isCap = typeof capMat === 'function' ? capMat(i, j, (t0 + t1) / 2) : (capMat !== undefined && i >= 2 && i <= 3 && Math.cos((t0 + t1) / 2) > 0.35);
      Q(v(p0, t0), v(p1, t0), v(p1, t1), v(p0, t1), isCap ? (typeof capMat === 'function' ? isCap : capMat) : m); } }
};
// cylinder along an axis: axis 'x' | 'y' | 'z'; caps optional
E.cylinder = function (cx, cy, cz, r, len, n, axis, m, capMat) {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    const P = (t, a) => { const u = Math.cos(a) * r, v = Math.sin(a) * r; return axis === 'y' ? [cx + u, cy + t, cz + v] : axis === 'x' ? [cx + t, cy + u, cz + v] : [cx + u, cy + v, cz + t]; };
    const h = len / 2;
    if (axis === 'y') Q(P(-h, a0), P(h, a0), P(h, a1), P(-h, a1), m); else Q(P(-h, a0), P(-h, a1), P(h, a1), P(h, a0), m);
    if (capMat !== undefined) { const C0 = axis === 'y' ? [cx, cy + h, cz] : axis === 'x' ? [cx + h, cy, cz] : [cx, cy, cz + h], C1 = axis === 'y' ? [cx, cy - h, cz] : axis === 'x' ? [cx - h, cy, cz] : [cx, cy, cz - h];
      if (axis === 'y') { T(C0, P(h, a1), P(h, a0), capMat); T(C1, P(-h, a0), P(-h, a1), capMat); } else { T(C0, P(h, a0), P(h, a1), capMat); T(C1, P(-h, a1), P(-h, a0), capMat); } }
  }
};
// rotate every vertex object exactly once about Y (yaw) and translate, for tris from index `from`
E.rotateRange = function (from, yaw, cx, cz, cy = 0) { const seen = new Set(), c = Math.cos(yaw), sn = Math.sin(yaw); for (let q = from; q < tris.length; q++) for (const v of tris[q].v) { if (seen.has(v)) continue; seen.add(v); const x = v[0], z = v[2]; v[0] = x * c + z * sn + cx; v[1] += cy; v[2] = -x * sn + z * c + cz; } };
E.flatten = function (list) {
  const n = list.length, pos = new Float32Array(n * 9), mat = new Uint8Array(n), grp = new Uint8Array(n), ax = new Uint16Array(n), cen = new Float32Array(n * 3), rad = new Float32Array(n);
  list.forEach((t, i) => {
    for (let k = 0; k < 3; k++) { pos[i * 9 + k * 3] = t.v[k][0]; pos[i * 9 + k * 3 + 1] = t.v[k][1]; pos[i * 9 + k * 3 + 2] = t.v[k][2]; }
    mat[i] = t.m; grp[i] = t.g; ax[i] = t.aux;
    const cx = (t.v[0][0] + t.v[1][0] + t.v[2][0]) / 3, cy = (t.v[0][1] + t.v[1][1] + t.v[2][1]) / 3, cz = (t.v[0][2] + t.v[1][2] + t.v[2][2]) / 3;
    cen[i * 3] = cx; cen[i * 3 + 1] = cy; cen[i * 3 + 2] = cz; rad[i] = Math.max(...t.v.map(v => Math.hypot(v[0] - cx, v[1] - cy, v[2] - cz)));
  });
  return { pos, mat, grp, aux: ax, cen, rad, n };
};
E.end = () => { const m = E.flatten(tris); tris = []; return m; };
// 3x5 bitmap font for signage (per-pixel SIGN hook) and 5x7 digits for decals
E.FONT3 = { S: ['011', '100', '010', '001', '110'], C: ['011', '100', '100', '100', '011'], R: ['110', '101', '110', '101', '101'], U: ['101', '101', '101', '101', '111'], T: ['111', '010', '010', '010', '010'], I: ['111', '010', '010', '010', '111'],
  N: ['101', '111', '111', '101', '101'], E: ['111', '100', '110', '100', '111'], P: ['110', '101', '110', '100', '100'], A: ['010', '101', '111', '101', '101'], L: ['100', '100', '100', '100', '111'], F: ['111', '100', '110', '100', '100'],
  O: ['111', '101', '101', '101', '111'], D: ['110', '101', '101', '101', '110'], G: ['011', '100', '101', '101', '011'], M: ['101', '111', '101', '101', '101'], B: ['110', '101', '110', '101', '110'], K: ['101', '110', '100', '110', '101'],
  H: ['101', '101', '111', '101', '101'], V: ['101', '101', '101', '101', '010'], W: ['101', '101', '101', '111', '101'], X: ['101', '101', '010', '101', '101'], Y: ['101', '101', '010', '010', '010'], Z: ['111', '001', '010', '100', '111'], J: ['001', '001', '001', '101', '010'], Q: ['111', '101', '101', '111', '001'],
  '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '011', '001', '111'], '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'], '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '001', '001', '001'], '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'], '0': ['111', '101', '101', '101', '111'],
  ' ': ['000', '000', '000', '000', '000'], '·': ['000', '000', '010', '000', '000'], '-': ['000', '000', '111', '000', '000'], '.': ['000', '000', '000', '000', '010'], '/': ['001', '001', '010', '100', '100'], ':': ['000', '010', '000', '010', '000'], '%': ['101', '001', '010', '100', '101'], '+': ['000', '010', '111', '010', '000'] };
E.DIGITS = { '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'], '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'], '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'], '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'], '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'], '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'], '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'] };
// generic sign hook: sign = {o, r, u, text, cell, fg, bg, u0}; returns ramp index
E.signPixel = function (sg, wx, wy, wz) {
  const dx = wx - sg.o[0], dy = wy - sg.o[1], dz = wz - sg.o[2], rl = Math.hypot(sg.r[0], sg.r[1], sg.r[2]);
  const u = (sg.u0 || 0) + (dx * sg.r[0] + dy * sg.r[1] + dz * sg.r[2]) / (rl * rl), v = dx * sg.u[0] + dy * sg.u[1] + dz * sg.u[2];
  const cell = sg.cell, col = Math.floor((u - cell) / cell), row = Math.floor((v - cell * 0.6) / cell);
  if (row < 0 || row > 4) return sg.bg;
  const ch = Math.floor(col / 4), c = col % 4; if (c === 3 || ch < 0 || ch >= sg.text.length) return sg.bg;
  const g = E.FONT3[sg.text[ch]]; return g && g[4 - row] && g[4 - row][c] === '1' ? sg.fg : sg.bg;
};
E.signUV = function (sg, wx, wy, wz) { const dx = wx - sg.o[0], dy = wy - sg.o[1], dz = wz - sg.o[2], rl = Math.hypot(sg.r[0], sg.r[1], sg.r[2]); return [(sg.u0 || 0) + (dx * sg.r[0] + dy * sg.r[1] + dz * sg.r[2]) / (rl * rl), dx * sg.u[0] + dy * sg.u[1] + dz * sg.u[2]]; };
hooks[M.SIGN] = (mx, my, mz, a) => { const sg = E.signs[a]; return sg ? E.signPixel(sg, mx, my, mz) : M.NAVY; };

// ---------- renderer ----------
E.createRenderer = function (canvas, W, H, SCALE) {
  const R = { W, H, SCALE, NEAR: 0.35, FAR: 420, drawn: 0 };
  canvas.width = W; canvas.height = H;
  const vctx = canvas.getContext('2d', { alpha: false }); vctx.imageSmoothingEnabled = false;
  const img = vctx.createImageData(W, H), px = img.data;
  const depth = new Float32Array(W * H), matBuf = new Int16Array(W * H);
  void SCALE;
  R.px = px; R.depth = depth; R.matBuf = matBuf;
  const cam = R.cam = { pos: [0, 2, -8], target: [0, 0.5, 0], fov: 40 };
  let VM = { r: [1, 0, 0], u: [0, 1, 0], f: [0, 0, 1] }, FOCAL = 1, TANW = 1, TANH = 1;
  R.LIGHT = E.norm([-0.45, 0.9, 0.35]);
  R.ambient = 0.1;                    // scenes may raise for interiors
  R.lookAt = function () {
    const f = E.norm([cam.target[0] - cam.pos[0], cam.target[1] - cam.pos[1], cam.target[2] - cam.pos[2]]);
    let r = E.norm([-f[2], 0, f[0]]); if (Math.abs(f[1]) > 0.999) r = [1, 0, 0];
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    VM = { r, u, f }; FOCAL = (H / 2) / Math.tan((cam.fov * Math.PI / 180) / 2); TANH = (H / 2) / FOCAL; TANW = (W / 2) / FOCAL;
    R.VM = VM; R.FOCAL = FOCAL;
  };
  const toView = R.toView = (x, y, z, o) => { const dx = x - cam.pos[0], dy = y - cam.pos[1], dz = z - cam.pos[2]; o[0] = dx * VM.r[0] + dy * VM.r[1] + dz * VM.r[2]; o[1] = dx * VM.u[0] + dy * VM.u[1] + dz * VM.u[2]; o[2] = dx * VM.f[0] + dy * VM.f[1] + dz * VM.f[2]; };
  R.project = (x, y, z) => { toView(x, y, z, cv); if (cv[2] < R.NEAR) return null; return [W / 2 + cv[0] * FOCAL / cv[2], H / 2 - cv[1] * FOCAL / cv[2], cv[2]]; };
  const va = [0, 0, 0, 0, 0, 0], vb = [0, 0, 0, 0, 0, 0], vc = [0, 0, 0, 0, 0, 0], cv = [0, 0, 0];
  let G_aux = 0, G_zbias = 0, G_ma = null, G_mb = null, G_mc = null, G_light = [0, 0, 1], G_ghost = false, G_ghostMat = M.CYAN;
  const clipBuf = [[0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]];
  const Lv = [0, 0, 0, 0, 0, 0], Rv = [0, 0, 0, 0, 0, 0];
  function drawTri(ax, ay, az, bx, by, bz, cx, cy, cz, m, cull) {
    toView(ax, ay, az, va); toView(bx, by, bz, vb); toView(cx, cy, cz, vc);
    if (va[2] < R.NEAR && vb[2] < R.NEAR && vc[2] < R.NEAR) return;
    if (va[2] > R.FAR && vb[2] > R.FAR && vc[2] > R.FAR) return;
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az, e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    if (cull) { const f1x = vb[0] - va[0], f1y = vb[1] - va[1], f1z = vb[2] - va[2], f2x = vc[0] - va[0], f2y = vc[1] - va[1], f2z = vc[2] - va[2];
      const vnx = f1y * f2z - f1z * f2y, vny = f1z * f2x - f1x * f2z, vnz = f1x * f2y - f1y * f2x; if (vnx * va[0] + vny * va[1] + vnz * va[2] < 0) return; }
    let shade;
    if (m === E.SHADOW_MAT || m === E.LIGHT_MAT) shade = 0;
    else if (EMISSIVE.has(m)) shade = 1;
    else {
      const L = R.LIGHT, ndl = nx * L[0] + ny * L[1] + nz * L[2], key = 0.5 + 0.5 * ndl, sky = 0.5 + 0.5 * ny, fill = Math.max(0, -(nx * VM.f[0] + ny * VM.f[1] + nz * VM.f[2]));
      shade = R.ambient + (METAL.has(m) ? 0.12 : 0) + 0.14 * sky + 0.56 * key * key + 0.2 * fill;
      if (ndl > 0.97 && !GROUND_MATS.has(m)) shade += 0.3; shade = Math.min(1, shade);
    }
    const perPixel = hooks[m] !== undefined || m === E.LIGHT_MAT;
    if (perPixel) { const ma = G_ma || [ax, ay, az], mb = G_mb || [bx, by, bz], mc = G_mc || [cx, cy, cz]; va[3] = ma[0]; va[4] = ma[1]; va[5] = ma[2]; vb[3] = mb[0]; vb[4] = mb[1]; vb[5] = mb[2]; vc[3] = mc[0]; vc[4] = mc[1]; vc[5] = mc[2]; }
    if (va[2] >= R.NEAR && vb[2] >= R.NEAR && vc[2] >= R.NEAR) { raster(va, vb, vc, m, shade, perPixel); return; }
    const inp = [va, vb, vc]; let cnt = 0;
    for (let i = 0; i < 3; i++) { const A = inp[i], B = inp[(i + 1) % 3], ain = A[2] >= R.NEAR, bin = B[2] >= R.NEAR;
      if (ain) { const o = clipBuf[cnt++]; for (let k = 0; k < 6; k++) o[k] = A[k]; }
      if (ain !== bin) { const t = (R.NEAR - A[2]) / (B[2] - A[2]), o = clipBuf[cnt++]; for (let k = 0; k < 6; k++) o[k] = A[k] + (B[k] - A[k]) * t; o[2] = R.NEAR; } }
    for (let i = 1; i + 1 < cnt; i++) raster(clipBuf[0], clipBuf[i], clipBuf[i + 1], m, shade, perPixel);
  }
  function raster(A, B, Cv, m, shade, perPixel) {
    const iz0 = 1 / A[2], iz1 = 1 / B[2], iz2 = 1 / Cv[2];
    let v0 = [W / 2 + A[0] * FOCAL * iz0, H / 2 - A[1] * FOCAL * iz0, iz0, A[3] * iz0, A[4] * iz0, A[5] * iz0];
    let v1 = [W / 2 + B[0] * FOCAL * iz1, H / 2 - B[1] * FOCAL * iz1, iz1, B[3] * iz1, B[4] * iz1, B[5] * iz1];
    let v2 = [W / 2 + Cv[0] * FOCAL * iz2, H / 2 - Cv[1] * FOCAL * iz2, iz2, Cv[3] * iz2, Cv[4] * iz2, Cv[5] * iz2];
    if (v1[1] < v0[1]) { const t = v0; v0 = v1; v1 = t; } if (v2[1] < v0[1]) { const t = v0; v0 = v2; v2 = t; } if (v2[1] < v1[1]) { const t = v1; v1 = v2; v2 = t; }
    const yTop = v0[1], yMid = v1[1], yBot = v2[1];
    if (yBot < 0 || yTop > H || yBot - yTop < 1e-6) return;
    if (Math.max(v0[0], v1[0], v2[0]) < 0 || Math.min(v0[0], v1[0], v2[0]) > W) return;
    R.drawn++;
    const ramp = (m === E.SHADOW_MAT || m === E.LIGHT_MAT) ? null : RAMPS[m], s3 = shade * 3, s0 = Math.floor(s3), fr = s3 - s0, zb = G_zbias, hook = hooks[m], auxv = G_aux, ghost = G_ghost;
    const yStart = Math.max(0, Math.ceil(yTop - 0.5)), yEnd = Math.min(H - 1, Math.floor(yBot - 0.5));
    for (let y = yStart; y <= yEnd; y++) {
      const yc = y + 0.5; { const t = (yc - yTop) / (yBot - yTop); for (let k = 0; k < 6; k++) Lv[k] = v0[k] + (v2[k] - v0[k]) * t; }
      if (yc < yMid) { if (yMid - yTop < 1e-9) continue; const t = (yc - yTop) / (yMid - yTop); for (let k = 0; k < 6; k++) Rv[k] = v0[k] + (v1[k] - v0[k]) * t; }
      else { if (yBot - yMid < 1e-9) continue; const t = (yc - yMid) / (yBot - yMid); for (let k = 0; k < 6; k++) Rv[k] = v1[k] + (v2[k] - v1[k]) * t; }
      let a = Lv, b = Rv; if (a[0] > b[0]) { a = Rv; b = Lv; }
      const span = b[0] - a[0]; if (span < 1e-9) continue;
      const xStart = Math.max(0, Math.ceil(a[0] - 0.5)), xEnd = Math.min(W - 1, Math.floor(b[0] - 0.5)); if (xStart > xEnd) continue;
      const dz = (b[2] - a[2]) / span, d3 = (b[3] - a[3]) / span, d4 = (b[4] - a[4]) / span, d5 = (b[5] - a[5]) / span, t0 = xStart + 0.5 - a[0];
      let iz = a[2] + dz * t0, q3 = a[3] + d3 * t0, q4 = a[4] + d4 * t0, q5 = a[5] + d5 * t0, i = y * W + xStart;
      for (let x = xStart; x <= xEnd; x++, i++, iz += dz, q3 += d3, q4 += d4, q5 += d5) {
        const z = 1 / iz - zb; if (z >= depth[i]) continue;
        const o = i * 4;
        if (m === E.SHADOW_MAT) { if (!GROUND_MATS.has(matBuf[i]) || bayer(x, y) > 0.6) continue; const cr = RAMPS[matBuf[i]][0]; px[o] = cr[0]; px[o + 1] = cr[1]; px[o + 2] = cr[2]; continue; }
        if (m === E.LIGHT_MAT) { if (!GROUND_MATS.has(matBuf[i])) continue; const wz = 1 / iz, dx = q3 * wz - G_light[0], dzz = q5 * wz - G_light[1], rr = (dx * dx + dzz * dzz) / (G_light[2] * G_light[2]);
          if (rr > 1 || (1 - rr) * 0.75 < bayer(x, y)) continue; const cr = RAMPS[matBuf[i]][3]; px[o] = cr[0]; px[o + 1] = cr[1]; px[o + 2] = cr[2]; continue; }
        if (ghost) { if (bayer(x, y) < 0.62) continue; depth[i] = z; matBuf[i] = G_ghostMat; const cg = RAMPS[G_ghostMat][Math.min(3, s0 + 1)]; px[o] = cg[0]; px[o + 1] = cg[1]; px[o + 2] = cg[2]; continue; }
        depth[i] = z; matBuf[i] = m;
        let rp = ramp;
        if (perPixel) { const wz = 1 / iz; rp = RAMPS[hook(q3 * wz, q4 * wz, q5 * wz, auxv)]; }
        const idx = Math.min(3, fr > bayer(x, y) ? s0 + 1 : s0), c = rp[idx]; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2];
      }
    }
  }
  // ----- public drawing API -----
  R.clear = function (color) {   // flat fill (interiors); color = ramp colour array or hex string
    const c = typeof color === 'string' ? hex(color) : color;
    for (let i = 0; i < W * H; i++) { const o = i * 4; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255; depth[i] = Infinity; matBuf[i] = -1; }
  };
  const INK = hex('#000000');
  // The sky is a palette rather than a set of constants, so a circuit can be at dusk in the
  // desert, under snow, or at night under floodlights without a second sky routine.
  const SKY_DEFAULT = { night: '#06081A', studio: '#121A4A', dusk: '#2A3A8A', mount: '#121A4A',
    mount2: '#0B1030', glow: '#7A32B0', cityA: '#F4C542', cityB: '#3DD2FF', star: '#FFFFFF',
    starDim: '#C8CBD8', ground: '#0B2A17', stars: true, moon: true };
  let SKY = null;
  R.setSky = function (o) {
    const s2 = Object.assign({}, SKY_DEFAULT, o || {});
    SKY = { NIGHT: hex(s2.night), STUDIO: hex(s2.studio), DUSK: hex(s2.dusk), MOUNT: hex(s2.mount),
      MOUNT2: hex(s2.mount2), GLOW: hex(s2.glow), GOLDc: hex(s2.cityA), CYANc: hex(s2.cityB),
      WHITEc: hex(s2.star), CAPc: hex(s2.starDim), GROUNDc: hex(s2.ground),
      stars: s2.stars !== false, moon: s2.moon !== false };
  };
  R.setSky();
  const colDir = new Float32Array(W), colM1 = new Float32Array(W), colM2 = new Float32Array(W), colCity = new Uint8Array(W);
  R.sky = function () {   // sky with glow band, mountains, lights, optional moon and stars
    const { NIGHT, STUDIO, DUSK, MOUNT, MOUNT2, GLOW, GOLDc, CYANc, WHITEc, CAPc, GROUNDc } = SKY;
    const hf = E.norm([VM.f[0], 0, VM.f[2]]); toView(cam.pos[0] + hf[0] * 5000, cam.pos[1], cam.pos[2] + hf[2] * 5000, cv);
    const horizon = H / 2 - cv[1] * FOCAL / cv[2], baseAz = Math.atan2(VM.f[0], VM.f[2]);
    for (let x = 0; x < W; x++) { const az = baseAz + Math.atan((x - W / 2) / FOCAL); colDir[x] = az;
      colM1[x] = 14 + 11 * Math.sin(az * 2.3 + 0.4) + 6 * Math.sin(az * 5.1 + 2.0) + 3 * Math.sin(az * 11 + 1); colM2[x] = 7 + 6 * Math.sin(az * 3.7 + 1.9) + 3 * Math.sin(az * 8.3);
      const hc = E.hash2(Math.floor(az * 300), 1); colCity[x] = hc > 0.55 ? (E.hash2(Math.floor(az * 300), 2) > 0.5 ? 1 : 2) : 0; }
    const moonAz = 0.9, moonEl = 26 + (FOCAL - 160) * 0.1;
    for (let y = 0; y < H; y++) {
      const dyh = horizon - y, t = Math.min(1, Math.max(0, (dyh - 8) / 70)), tt = dyh < 26 ? (26 - dyh) / 26 : 0;
      for (let x = 0; x < W; x++) {
        const i = y * W + x, o = i * 4; depth[i] = Infinity; matBuf[i] = -1; let c;
        if (dyh < 0) c = GROUNDc; else if (dyh < colM2[x]) c = MOUNT2; else if (dyh < colM1[x]) c = MOUNT; else if (dyh < colM1[x] + 2 && colCity[x]) c = colCity[x] === 1 ? GOLDc : CYANc;
        else { c = t < bayer(x, y) ? STUDIO : NIGHT; if (tt > 0 && tt * 0.85 > bayer(x + 3, y)) c = DUSK; if (tt > 0.55 && (tt - 0.55) * 0.9 > bayer(x + 5, y + 2)) c = GLOW;
          let dAz = colDir[x] - moonAz; while (dAz > Math.PI) dAz -= 2 * Math.PI; while (dAz < -Math.PI) dAz += 2 * Math.PI;
          const mx = dAz * FOCAL, my = dyh - moonEl, rr = mx * mx + my * my;
          if (SKY.moon && rr < 121) c = (rr < 100 || bayer(x, y) < 0.5) ? (E.hash2(Math.floor(mx / 3), Math.floor(my / 3)) < 0.18 ? CAPc : WHITEc) : STUDIO;
          else if (SKY.stars && dyh > 44 && E.hash2(Math.floor(colDir[x] * 400), y) > 0.995) c = E.hash2(x, y) > 0.5 ? WHITEc : CAPc; }
        px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
      }
    }
  };
  R.gradient = function (top, bottom) {   // dithered vertical gradient backdrop (interiors)
    const a = hex(top), b = hex(bottom);
    for (let y = 0; y < H; y++) { const t = y / H; for (let x = 0; x < W; x++) { const i = y * W + x, o = i * 4, c = t > bayer(x, y) ? b : a; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255; depth[i] = Infinity; matBuf[i] = -1; } }
  };
  R.drawStatic = function (mesh, opts = {}) {   // frustum-culled static world mesh; ground materials get z-bias layering
    const { pos, mat, aux: ax, cen, rad, n } = mesh, cullAll = opts.cull !== false;
    for (let i = 0; i < n; i++) {
      const c3 = i * 3; toView(cen[c3], cen[c3 + 1], cen[c3 + 2], cv); const r = rad[i], z = cv[2];
      if (z + r < R.NEAR || z - r > R.FAR) continue; if (Math.abs(cv[0]) - r > (z + r) * TANW * 1.05) continue; if (Math.abs(cv[1]) - r > (z + r) * TANH * 1.05) continue;
      const o = i * 9, m = mat[i];
      G_aux = ax[i]; G_zbias = GROUND_MATS.has(m) ? (m === M.ASPHALT ? 0.02 : m === M.RUBBER ? 0.04 : m === M.KERB_R || m === M.KERB_W ? 0.06 : 0) : 0;
      drawTri(pos[o], pos[o + 1], pos[o + 2], pos[o + 3], pos[o + 4], pos[o + 5], pos[o + 6], pos[o + 7], pos[o + 8], m, cullAll && !GROUND_MATS.has(m) && m !== M.CROWD && m !== M.SIGN && m !== M.SCREEN);
    }
    G_aux = 0; G_zbias = 0;
  };
  const p0 = [0, 0, 0], p1 = [0, 0, 0], p2 = [0, 0, 0], m0 = [0, 0, 0], m1 = [0, 0, 0], m2 = [0, 0, 0];
  // dynamic mesh: xform(x,y,z,group,out) maps model -> world. mode: 'solid' | 'shadow' | 'ghost'. groundY for shadows.
  R.drawDynamic = function (mesh, xform, mode = 'solid', groundY = 0, ghostMat = M.CYAN, cullDist = 260) {
    const { pos, mat, grp, aux: ax, n } = mesh;
    G_ghost = mode === 'ghost'; G_ghostMat = ghostMat;
    for (let i = 0; i < n; i++) {
      const o = i * 9;
      m0[0] = pos[o]; m0[1] = pos[o + 1]; m0[2] = pos[o + 2]; m1[0] = pos[o + 3]; m1[1] = pos[o + 4]; m1[2] = pos[o + 5]; m2[0] = pos[o + 6]; m2[1] = pos[o + 7]; m2[2] = pos[o + 8];
      xform(m0[0], m0[1], m0[2], grp[i], p0); xform(m1[0], m1[1], m1[2], grp[i], p1); xform(m2[0], m2[1], m2[2], grp[i], p2);
      if (mode === 'shadow') { const L = R.LIGHT; for (const p of [p0, p1, p2]) { const k = (p[1] - groundY) / L[1]; p[0] -= L[0] * k; p[2] -= L[2] * k; p[1] = groundY; }
        G_zbias = 0.05; drawTri(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], E.SHADOW_MAT, false); G_zbias = 0; }
      else { G_aux = ax[i]; G_ma = m0; G_mb = m1; G_mc = m2; drawTri(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], mat[i], true); G_ma = G_mb = G_mc = null; G_aux = 0; }
    }
    G_ghost = false;
  };
  R.drawLightPools = function (pools) { for (const lp of pools) { const [x, z, r] = lp; toView(x, 0, z, cv); if (cv[2] - r > R.FAR || cv[2] + r < R.NEAR) continue; G_light = lp; G_zbias = 0.08;
    drawTri(x - r, 0, z - r, x - r, 0, z + r, x + r, 0, z + r, E.LIGHT_MAT, false); drawTri(x - r, 0, z - r, x + r, 0, z + r, x + r, 0, z - r, E.LIGHT_MAT, false); G_zbias = 0; } };
  R.drawPoint = function (x, y, z, color) { toView(x, y, z, cv); if (cv[2] < R.NEAR) return; const sx = Math.floor(W / 2 + cv[0] * FOCAL / cv[2]), sy = Math.floor(H / 2 - cv[1] * FOCAL / cv[2]);
    if (sx < 0 || sx >= W || sy < 0 || sy >= H) return; const i = sy * W + sx; if (cv[2] >= depth[i]) return; const o = i * 4; px[o] = color[0]; px[o + 1] = color[1]; px[o + 2] = color[2]; };
  // Edge pass. Two kinds of edge, both needed for definition at this resolution:
  //   silhouette — an object against ground or sky: hard INK
  //   seam       — two different materials meeting on the same object: the darkest step of the
  //                FARTHER material, so a wing reads against a sidepod without a heavy black line
  const seamBuf = new Int32Array(W * H);
  R.outline = function () {
    const cutoff = R.seamCutoff === undefined ? 999 : R.seamCutoff;
    seamBuf.fill(-1);
    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W - 1; x++) {
        const i = y * W + x, m = matBuf[i], d = depth[i];
        for (let k = 0; k < 2; k++) {
          const j = k === 0 ? i + 1 : i + W, m2 = matBuf[j], d2 = depth[j];
          if (m === m2 && Math.abs(d - d2) < 0.12) continue;
          const gi = m < 0 || GROUND_MATS.has(m), gj = m2 < 0 || GROUND_MATS.has(m2);
          if (gi && gj) continue;
          const far = d > d2 ? i : j, dd = Math.abs(d - d2);
          if (gi !== gj) { if (dd > 0.1) seamBuf[far] = -2; continue; }
          if (dd > 0.55) { seamBuf[far] = -2; continue; }
          if (matBuf[far] === matBuf[far === i ? j : i]) continue;
          if (depth[far] > cutoff) continue;
          if (seamBuf[far] === -1) seamBuf[far] = matBuf[far];
        }
      }
    }
    for (let i = 0; i < W * H; i++) {
      const v = seamBuf[i]; if (v === -1) continue;
      const o = i * 4, c = v === -2 ? INK : RAMPS[v][0];
      px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2];
    }
  };
  // post effects
  R.flash = function (amount) { if (amount <= 0) return; for (let i = 0; i < W * H; i++) { const x = i % W, y = (i / W) | 0; if (amount > bayer(x, y)) { const o = i * 4; px[o] = 255; px[o + 1] = 255; px[o + 2] = 255; } } };
  R.checkerWipe = function (t) {   // 0..1: growing black/white checker from the left
    const cells = 8, lim = Math.floor(t * (W / cells + 4));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const cx = (x / cells) | 0, cy = (y / cells) | 0; if (cx > lim) continue; const on = ((cx + cy) & 1) === 0; const o = (y * W + x) * 4; const v = on ? 255 : 0; px[o] = v; px[o + 1] = v; px[o + 2] = v; }
  };
  R.present = function () { vctx.putImageData(img, 0, 0); };
  R.begin = function () { R.drawn = 0; R.lookAt(); };
  return R;
};
})(window.SCR = window.SCR || {});
