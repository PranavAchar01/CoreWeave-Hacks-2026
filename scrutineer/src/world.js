// ============================================================================
// SCR.world — procedural circuits and the trackside world (static mesh, signs, crowd, TV cams, light pools)
// ============================================================================
(function (SCR) {
'use strict';
const E = SCR.engine, M = E.M, Wd = SCR.world = {};
const { box, Q, T } = E;
const ROAD_W = Wd.ROAD_W = 6;
// How full the grandstands are drawn, 0..1. build() sets it from opts.detail, so a circuit
// early in the season is a half-empty Thursday and a late one is a full house.
Wd.crowdFill = 0.8;
Wd.makeCircuit = function (seed) {
  const rng = E.mulberry32(seed);
  // Layout character, drawn from the seed: how many corners it is built from, how stretched the
  // loop is, and how far a corner may wander off the ring. A circuit is its seed.
  const N = 9 + Math.floor(rng() * 6);              // 9..14 control points
  const aspect = 1.08 + rng() * 0.62;               // 1.08..1.70, long-and-thin through to square
  const wander = 0.24 + rng() * 0.34;               // how irregular the spacing gets
  const spread = 60 + rng() * 70;                   // radius variation, so straights and hairpins
  const base = 138 + rng() * 46;
  const phase = rng() * Math.PI * 2;
  const ctrl = [];
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2 + phase + (rng() - 0.5) * wander;
    const rad = base + (rng() - 0.5) * spread;
    ctrl.push([Math.cos(ang) * rad * aspect, Math.sin(ang) * rad]);
  }
  const pts = [], cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
  for (let i = 0; i < N; i++) { const p0 = ctrl[(i - 1 + N) % N], p1 = ctrl[i], p2 = ctrl[(i + 1) % N], p3 = ctrl[(i + 2) % N]; const steps = Math.max(8, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 3.5));
    for (let k = 0; k < steps; k++) { const t = k / steps; pts.push([cr(p0[0], p1[0], p2[0], p3[0], t), cr(p0[1], p1[1], p2[1], p3[1], t)]); } }
  const STEP = 4, S = []; let acc = 0, prev = pts[0]; const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  S.push({ x: prev[0], z: prev[1] });
  for (let i = 1; i <= pts.length; i++) { const p = pts[i % pts.length]; let d = dist(prev, p);
    while (acc + d >= STEP) { const t = (STEP - acc) / d, q = [prev[0] + (p[0] - prev[0]) * t, prev[1] + (p[1] - prev[1]) * t]; S.push({ x: q[0], z: q[1] }); d -= (STEP - acc); acc = 0; prev = q; }
    acc += d; prev = p; }
  if (dist([S[S.length - 1].x, S[S.length - 1].z], [S[0].x, S[0].z]) < STEP * 0.5) S.pop();
  const n = S.length;
  for (let i = 0; i < n; i++) { const a = S[(i - 1 + n) % n], b = S[(i + 1) % n], p = S[i]; let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    p.tx = tx; p.tz = tz; p.nx = -tz; p.nz = tx; const ta = S[(i - 2 + n) % n], tb = S[(i + 2) % n];
    const h1 = Math.atan2(p.x - ta.x, p.z - ta.z), h2 = Math.atan2(tb.x - p.x, tb.z - p.z); let dh = h2 - h1; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI; p.curv = dh / (4 * STEP); }
  const KER = [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1], KR = 5, KSUM = KER.reduce((a, b) => a + b, 0);
  const sm = S.map((p, i) => { let s = 0; for (let k = -KR; k <= KR; k++) s += S[(i + k + n) % n].curv * KER[k + KR]; return s / KSUM; });
  S.forEach((p, i) => p.curv = sm[i]);
  let best = 0, bestLen = 0;
  for (let i = 0; i < n; i++) { let len = 0; while (len < n && Math.abs(S[(i + len) % n].curv) < 0.004) len++; if (len > bestLen) { bestLen = len; best = i; } }
  const R = []; for (let i = 0; i < n; i++) R.push(S[(best + i) % n]); R.forEach((p, i) => p.s = i * STEP);
  const cx = R.reduce((s, p) => s + p.x, 0) / n, cz = R.reduce((s, p) => s + p.z, 0) / n;
  const c = { seed, pts: R, n, step: STEP, len: n * STEP, cx, cz };
  c.at = i => R[((i % n) + n) % n];
  c.pos = (i, off, y) => { const p = c.at(i); return [p.x + p.nx * off, y || 0, p.z + p.nz * off]; };
  c.outside = i => { const p = c.at(i); const dl = Math.hypot(p.x + p.nx - cx, p.z + p.nz - cz), dr = Math.hypot(p.x - p.nx - cx, p.z - p.nz - cz); return dl > dr ? 1 : -1; };
  c.geomInside = i => c.at(i).curv > 0 ? 1 : -1;
  c.clearOfTrack = (x, z, margin) => { const m2 = margin * margin; for (const p of R) { const dx = p.x - x, dz = p.z - z; if (dx * dx + dz * dz < m2) return false; } return true; };
  c.name = Wd.circuitName(seed);
  return c;
};
const NAMES = ['SILVERSTONE-LIKE', 'MONZA-LIKE', 'SUZUKA-LIKE', 'SPA-LIKE', 'INTERLAGOS-LIKE', 'MONACO-LIKE', 'IMOLA-LIKE', 'ZANDVOORT-LIKE', 'ESTORIL-LIKE', 'HOCKENHEIM-LIKE', 'KYALAMI-LIKE', 'JEREZ-LIKE', 'FUJI-LIKE', 'ADELAIDE-LIKE', 'MAGNY-COURS-LIKE', 'MONTREAL-LIKE', 'SEPANG-LIKE', 'ISTANBUL-LIKE', 'BAHRAIN-LIKE', 'SOCHI-LIKE', 'AUSTIN-LIKE', 'LAS VEGAS-LIKE'];
Wd.circuitName = seed => `${NAMES[Math.abs(seed) % NAMES.length]} LAYOUT ${String.fromCharCode(65 + (Math.abs(seed >> 3) % 6))}`;
// crowd hook (aux -> sign with crowd:true)
E.hooks[M.CROWD] = function (mx, my, mz, a) {
  const sg = E.signs[a]; if (!sg) return M.STAND; const [u, v] = E.signUV(sg, mx, my, mz);
  const cx = Math.floor(u / 0.48), cy = Math.floor(v / 0.42), h = E.hash2(cx, cy);
  if (v > 0.1 && h > (1 - Wd.crowdFill)) { const wave = Math.sin(E.time * 2.2 + cx * 0.35) > 0.85 ? 0.35 : 0, hh = E.hash2(cx + 7, cy + 3) + wave;
    return hh < 0.2 ? M.BODY : hh < 0.34 ? M.STRIPE : hh < 0.44 ? M.GOLD : hh < 0.56 ? M.CYAN : hh < 0.86 ? M.NAVY : M.PURPLE; }
  return M.STAND;
};
// build(circuit, opts) -> { mesh, lightpools, tvcams, circuit }
Wd.build = function (c, opts = {}) {
  const cp = c.pts, cn = c.n, at = c.at, pos = c.pos, outside = c.outside, geomInside = c.geomInside, clearOfTrack = c.clearOfTrack;
  // 0 is a bare circuit on a quiet evening; 1 is a full house under lights. The broadcast
  // raises it as the harness levels up, so the season visibly grows around the car.
  const detail = Math.max(0, Math.min(1, opts.detail === undefined ? 1 : opts.detail));
  const STAND_ROWS = 4 + Math.round(detail * 5);          // 4..9 rows of seats
  const STAND_CAP = 1 + Math.round(detail * 3);           // 1..4 grandstands
  const LIGHTS = 5 + Math.round(detail * 9);              // 5..14 floodlight towers
  Wd.crowdFill = 0.32 + detail * 0.52;
  const maxInside = i => 0.85 / Math.max(Math.abs(at(i).curv), 1e-4), safeOff = (i, side, w) => (side === geomInside(i)) ? Math.min(w, maxInside(i)) : w;
  const LIGHTPOOLS = [], TVCAMS = [], signs = E.signs, tris = () => E.current();
  E.begin(); E.setGroup(0); E.setAux(0);
  let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
  for (const p of cp) { minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); minz = Math.min(minz, p.z); maxz = Math.max(maxz, p.z); }
  const PAD = 120, TILE = 24;
  for (let x = minx - PAD; x < maxx + PAD; x += TILE) for (let z = minz - PAD; z < maxz + PAD; z += TILE) { const m = Math.floor(z / TILE) & 1 ? M.GRASS : M.GRASS2; Q([x, -0.06, z + TILE], [x + TILE, -0.06, z + TILE], [x + TILE, -0.06, z], [x, -0.06, z], m); }
  for (let i = 0; i < cn; i++) {
    const a = at(i), b = at(i + 1), k = Math.abs(a.curv), left = a.curv > 0;
    Q(pos(i, ROAD_W), pos(i + 1, ROAD_W), pos(i + 1, -ROAD_W), pos(i, -ROAD_W), M.ASPHALT);
    const rl0 = pos(i, Math.max(-3.5, Math.min(3.5, -a.curv * 180)), 0.01), rl1 = pos(i + 1, Math.max(-3.5, Math.min(3.5, -b.curv * 180)), 0.01);
    Q([rl0[0] + a.nx * 1.1, 0.012, rl0[2] + a.nz * 1.1], [rl1[0] + b.nx * 1.1, 0.012, rl1[2] + b.nz * 1.1], [rl1[0] - b.nx * 1.1, 0.012, rl1[2] - b.nz * 1.1], [rl0[0] - a.nx * 1.1, 0.012, rl0[2] - a.nz * 1.1], M.RUBBER);
    if (k > 0.006) {
      const km = ((i >> 1) & 1) ? M.KERB_R : M.KERB_W, side = left ? 1 : -1;
      const ki0 = pos(i, side * ROAD_W, 0.02), ki1 = pos(i + 1, side * ROAD_W, 0.02), ko0 = pos(i, side * (ROAD_W + 1.3), 0.06), ko1 = pos(i + 1, side * (ROAD_W + 1.3), 0.06);
      if (side > 0) Q(ki0, ko0, ko1, ki1, km); else Q(ki0, ki1, ko1, ko0, km);
      const kx0 = pos(i, -side * ROAD_W, 0.02), kx1 = pos(i + 1, -side * ROAD_W, 0.02), ky0 = pos(i, -side * (ROAD_W + 1.6), 0.05), ky1 = pos(i + 1, -side * (ROAD_W + 1.6), 0.05);
      if (side > 0) Q(kx0, kx1, ky1, ky0, km); else Q(kx0, ky0, ky1, kx1, km);
    }
    for (const side of [1, -1]) {
      const isOut = side !== geomInside(i), gravel = isOut && k > 0.008;
      let w0 = ROAD_W + 1.7, w1 = gravel ? ROAD_W + 22 : ROAD_W + 9; w1 = safeOff(i, side, w1); if (w1 <= w0 + 0.5) continue;
      const g0 = pos(i, side * w0), g1 = pos(i + 1, side * w0), h0 = pos(i, side * w1), h1 = pos(i + 1, side * w1), gm = gravel ? M.GRAVEL : (((i >> 2) & 1) ? M.GRASS : M.GRASS2);
      if (side > 0) Q(g0, h0, h1, g1, gm); else Q(g0, g1, h1, h0, gm);
      const bw = safeOff(i, side, gravel ? w1 : ROAD_W + 12); if (bw < ROAD_W + 4) continue;
      const b0 = pos(i, side * bw), b1 = pos(i + 1, side * bw), bh = gravel ? 1.2 : 0.8, bm = gravel ? M.TYRE : M.STEEL, t0 = [b0[0], bh, b0[2]], t1 = [b1[0], bh, b1[2]];
      if (side > 0) { Q(b0, b1, t1, t0, bm); Q(t0, t1, [t1[0] + a.nx * 0.5, bh, t1[2] + a.nz * 0.5], [t0[0] + a.nx * 0.5, bh, t0[2] + a.nz * 0.5], M.BODY); }
      else { Q(b0, t0, t1, b1, bm); Q(t0, [t0[0] - a.nx * 0.5, bh, t0[2] - a.nz * 0.5], [t1[0] - b.nx * 0.5, bh, t1[2] - b.nz * 0.5], t1, M.BODY); }
    }
  }
  const straights = []; let i = 0;
  while (i < cn) { if (Math.abs(at(i).curv) < 0.004) { let j = i; while (j < cn && Math.abs(at(j).curv) < 0.004) j++; straights.push([i, j - i]); i = j; } else i++; }
  straights.sort((a, b) => b[1] - a[1]);
  const clearRun = (i0, len, side, wmax) => { for (let q = i0; q <= i0 + len; q += 2) { const p = pos(q, side * wmax); if (!clearOfTrack(p[0], p[2], ROAD_W + 3)) return false; } return true; };
  const segQuad = (k, side, w0, w1, y0, y1, m) => { const A = pos(k, side * w0, y0), B = pos(k + 1, side * w0, y0), Cq = pos(k + 1, side * w1, y1), Dq = pos(k, side * w1, y1); if (side > 0) Q(A, Dq, Cq, B, m); else Q(A, B, Cq, Dq, m); };
  const segWall = (k, side, w, y0, y1, m) => { const A = pos(k, side * w, y0), B = pos(k + 1, side * w, y0), Cq = pos(k + 1, side * w, y1), Dq = pos(k, side * w, y1); if (side > 0) Q(A, B, Cq, Dq, m); else Q(A, Dq, Cq, B, m); };
  const segSign = (k, side, w, y0, y1, text, u0, cell, fg, bg) => { const t = at(k), A = pos(k, side * w, y0); E.setAux(signs.length); signs.push({ text, o: A, r: [t.tx, 0, t.tz], u: [0, 1, 0], cell, fg, bg, u0 }); segWall(k, side, w, y0, y1, M.SIGN); E.setAux(0); };
  const teamName = opts.teamName || 'SCRUTINEER';
  const placeStand = (i0, len, side) => {
    const rows = STAND_ROWS;
    for (let k = i0; k < i0 + len; k++) {
      const t = at(k);
      for (let r = 0; r < rows; r++) { const w0 = ROAD_W + 15 + r * 1.6, y0 = 0.3 + r * 1.15;
        E.setAux(signs.length); signs.push({ crowd: true, o: pos(k, side * w0, y0 - 1.15), r: [t.tx, 0, t.tz], u: [0, 1, 0], u0: (k - i0) * 4 }); segWall(k, side, w0, y0 - 1.15, y0, M.CROWD); E.setAux(0);
        segQuad(k, side, w0, w0 + 1.6, y0, y0, M.STAND); }
      const wr = ROAD_W + 14, yr = 0.3 + rows * 1.15 + 3.2;
      segQuad(k, side, wr, wr + rows * 1.6 + 3, yr, yr + 1.2, M.STEEL);
      const A = pos(k, side * wr, yr), B = pos(k + 1, side * wr, yr), Cq = pos(k + 1, side * (wr + rows * 1.6 + 3), yr + 1.2), Dq = pos(k, side * (wr + rows * 1.6 + 3), yr + 1.2);
      if (side > 0) Q(A, B, Cq, Dq, M.CARBON); else Q(A, Dq, Cq, B, M.CARBON);
      if (k > i0 + 1 && k < i0 + len - 2) segSign(k, side, wr - 0.4, yr - 1.6, yr - 0.2, `${teamName} · GRANDSTAND · ${teamName} · GRANDSTAND`, (k - i0 - 2) * 4, 0.34, M.GOLD, M.NAVY);
      if ((k - i0) % 3 === 0) { const p = pos(k, side * (wr + 1)); box(p[0], yr / 2, p[2], 0.5, yr, 0.5, M.STEEL); }
      if ((k - i0) % 6 === 3) { const p = pos(k, side * (wr + rows * 1.6 + 2)); box(p[0], yr / 2 + 0.6, p[2], 0.6, yr + 1.2, 0.6, M.STEEL); }
    }
  };
  let standsPlaced = 0;
  for (const [s0, sl] of straights) { if (standsPlaced >= STAND_CAP || sl < 10) continue; const i0 = s0 + 2, len = sl - 4, side = outside(s0 + Math.floor(sl / 2)); if (clearRun(i0, len, side, ROAD_W + 36)) { placeStand(i0, len, side); standsPlaced++; } }
  if (straights.length) {
    const [s0, sl] = straights[0]; const i0 = s0 + 3, len = sl - 6; let side = -outside(s0 + Math.floor(sl / 2));
    if (!clearRun(i0, len, side, ROAD_W + 15)) side = -side;
    if (clearRun(i0, len, side, ROAD_W + 15)) {
      const wf = ROAD_W + 4.6, wb = ROAD_W + 13.6, hgt = 5.2;
      for (let k = i0; k < i0 + len; k++) {
        segWall(k, side, wf, 0, hgt, M.BODY); segQuad(k, side, wf, wb, hgt, hgt, M.STEEL);
        const A = pos(k, side * wb, 0), B = pos(k + 1, side * wb, 0), Cq = pos(k + 1, side * wb, hgt), Dq = pos(k, side * wb, hgt); if (side > 0) Q(A, Dq, Cq, B, M.BODY); else Q(A, B, Cq, Dq, M.BODY);
        segWall(k, side, wf - 0.05, hgt - 0.5, hgt, M.NAVY); segWall(k, side, wf - 0.06, 3.1, 4.0, M.CYAN);
        if ((k - i0) % 2 === 0) { segWall(k, side, wf - 0.08, 0.1, 2.9, M.STEEL); segWall(k, side, wf - 0.1, 2.95, 3.05, M.GOLD); }
        if ((k - i0) % 2 === 1) { const p = pos(k, side * (wf - 0.12)); box(p[0], 1.5, p[2], 0.16, 2.9, 0.16, M.CARBON); }
        if (k > i0 + 1 && k < i0 + len - 2) segSign(k, side, wf - 0.14, 4.1, 4.9, 'PIT LANE · PARC FERME · SCRUTINEERING BAY · PIT LANE · PARC FERME', (k - i0 - 2) * 4, 0.3, M.CYAN, M.NAVY);
        segWall(k, side, ROAD_W + 2.4, 0, 1.0, M.ARMCO);
      }
      const mid = pos(i0 + Math.floor(len / 2), side * (wf + 4.5)); box(mid[0], hgt + 0.8, mid[2], 3, 1.6, 8, M.STEEL); box(mid[0], hgt + 2.2, mid[2], 0.3, 2.6, 0.3, M.STEEL);
    }
  }
  { const p = at(0), l = pos(0, ROAD_W + 2.5), r = pos(0, -(ROAD_W + 2.5));
    box(l[0], 4, l[2], 0.8, 8, 0.8, M.STEEL); box(r[0], 4, r[2], 0.8, 8, 0.8, M.STEEL);
    const cx = (l[0] + r[0]) / 2, cz = (l[2] + r[2]) / 2, yaw = Math.atan2(p.tx, p.tz), save = tris().length;
    box(0, 8.4, 0, 2 * (ROAD_W + 2.9), 1.6, 1.0, M.NAVY); for (let k = -2; k <= 2; k++) box(k * 1.6, 7.3, 0.55, 0.8, 0.5, 0.2, M.STRIPE);
    E.rotateRange(save, yaw, cx, cz);
    E.setAux(signs.length); const so = [cx + p.nx * (ROAD_W + 2.4) - p.tx * 0.51, 7.7, cz + p.nz * (ROAD_W + 2.4) - p.tz * 0.51];
    signs.push({ text: `${teamName} · SEALED CIRCUIT`, o: so, r: [-p.nx, 0, -p.nz], u: [0, 1, 0], cell: 0.36, fg: M.GOLD, bg: M.NAVY });
    const se = [so[0] - p.nx * 2 * (ROAD_W + 2.4), 7.7, so[2] - p.nz * 2 * (ROAD_W + 2.4)]; Q(so, se, [se[0], 9.1, se[2]], [so[0], 9.1, so[2]], M.SIGN); E.setAux(0);
    const s0 = pos(0, ROAD_W, 0.015), s1 = pos(0, -ROAD_W, 0.015), s2 = pos(-1, -ROAD_W, 0.015), s3 = pos(-1, ROAD_W, 0.015);
    for (let k = 0; k < 6; k++) { const f = k / 6, g = (k + 1) / 6, A = [s0[0] + (s1[0] - s0[0]) * f, 0.015, s0[2] + (s1[2] - s0[2]) * f], B = [s0[0] + (s1[0] - s0[0]) * g, 0.015, s0[2] + (s1[2] - s0[2]) * g], Cc = [s3[0] + (s2[0] - s3[0]) * g, 0.015, s3[2] + (s2[2] - s3[2]) * g], D = [s3[0] + (s2[0] - s3[0]) * f, 0.015, s3[2] + (s2[2] - s3[2]) * f]; Q(A, D, Cc, B, (k & 1) ? M.KERB_W : M.CARBON); }
  }
  for (let k = 0; k < cn; k += Math.max(4, Math.round(cn / LIGHTS))) { const side = outside(k), p = pos(k, side * (ROAD_W + 26)); if (!clearOfTrack(p[0], p[2], ROAD_W + 6)) continue;
    box(p[0], 14, p[2], 0.9, 28, 0.9, M.STEEL); box(p[0], 28.6, p[2], 4.5, 1.4, 1.2, M.STEEL); for (let j = -1; j <= 1; j++) box(p[0] + j * 1.4, 28.0, p[2] - side * 0.8, 1.0, 0.8, 0.3, M.LAMP);
    const q = pos(k, side * (ROAD_W + 2)); LIGHTPOOLS.push([q[0], q[2], 26]); }
  for (let k = 0; k < cn; k++) { const nxt = at(k + 25);
    if (Math.abs(at(k).curv) < 0.003 && Math.abs(nxt.curv) > 0.012 && Math.abs(at(k + 24).curv) < 0.012) { const side = outside(k + 25);
      for (const [d, txt] of [[0, '100'], [12, '50']]) { const p = pos(k + d, side * (ROAD_W + 3.5)); if (!clearOfTrack(p[0], p[2], ROAD_W + 1)) continue; box(p[0], 1.1, p[2], 0.15, 2.2, 0.15, M.STEEL);
        E.setAux(signs.length); const t = at(k + d), o = [p[0] + t.tx * 0.8, 1.6, p[2] + t.tz * 0.8]; signs.push({ text: txt, o, r: [-t.tx, 0, -t.tz], u: [0, 1, 0], cell: 1.6 / (txt.length * 4 + 1), fg: M.BODY, bg: M.STRIPE });
        Q(o, [o[0] - t.tx * 1.6, 1.6, o[2] - t.tz * 1.6], [o[0] - t.tx * 1.6, 2.6, o[2] - t.tz * 1.6], [o[0], 2.6, o[2]], M.SIGN); E.setAux(0); }
      k += 40; } }
  for (const [f, txt] of [[1 / 3, 'S1'], [2 / 3, 'S2'], [0, 'S3']]) { const k = Math.round(cn * f), side = outside(k), p = pos(k, side * (ROAD_W + 3.2)); box(p[0], 1.2, p[2], 0.15, 2.4, 0.15, M.STEEL);
    E.setAux(signs.length); const t = at(k), o = [p[0] - t.tx * 0.6, 1.9, p[2] - t.tz * 0.6]; signs.push({ text: txt, o, r: [t.tx, 0, t.tz], u: [0, 1, 0], cell: 1.2 / (txt.length * 4 + 1), fg: M.NAVY, bg: M.CYAN });
    Q(o, [o[0] + t.tx * 1.2, 1.9, o[2] + t.tz * 1.2], [o[0] + t.tx * 1.2, 2.7, o[2] + t.tz * 1.2], [o[0], 2.7, o[2]], M.SIGN); E.setAux(0); }
  const clearOfStructs = (x, y, z, r) => { for (const t of tris()) { if (E.GROUND_MATS.has(t.m)) continue; for (const v of t.v) if (Math.hypot(v[0] - x, v[1] - y, v[2] - z) < r) return false; } return true; };
  // A camera that is clear of structures where it stands can still have a grandstand column
  // squarely between it and the car. Grid the tall geometry once, then march each camera's
  // sightline through it and record which stretch of track it can actually see.
  const BLOCK = new Set(), CELL = 2.2, key = (x, z) => `${Math.round(x / CELL)},${Math.round(z / CELL)}`;
  for (const t of tris()) { if (E.GROUND_MATS.has(t.m)) continue;
    for (const v of t.v) if (v[1] > 2.0 && v[1] < 26) BLOCK.add(key(v[0], v[2])); }
  const sees = (cx, cz, px, pz) => {
    const dx = px - cx, dz = pz - cz, len = Math.hypot(dx, dz); if (len < 1) return true;
    const n = Math.ceil(len / (CELL * 0.7));
    for (let q = 1; q < n; q++) { const f = q / n;
      if (f < 0.12 || f > 0.9) continue;              // its own stand behind it, and the barrier in front
      if (BLOCK.has(key(cx + dx * f, cz + dz * f))) return false; }
    return true;
  };
  for (let k = 0; k < 8; k++) {
    const a0 = Math.round(cn * k / 8), a1 = Math.round(cn * (k + 1) / 8); let bi = a0, bk = -1;
    for (let q = a0; q < a1; q++) { const kk = Math.abs(at(q).curv); if (kk > bk) { bk = kk; bi = q; } }
    const side = outside(bi); let placed = false;
    for (const w of [ROAD_W + 14, ROAD_W + 10, ROAD_W + 7]) { const p = pos(bi, side * w, 6.5); if ((clearOfTrack(p[0], p[2], w - 1) && clearOfStructs(p[0], p[1], p[2], 4)) || w === ROAD_W + 7) { TVCAMS.push({ i: bi, x: p[0], y: p[1], z: p[2], s: bi * c.step }); placed = true; break; } }
    if (!placed) { const p = pos(bi, side * (ROAD_W + 7), 6.5); TVCAMS.push({ i: bi, x: p[0], y: p[1], z: p[2], s: bi * c.step }); }
  }
  // how much of its approach each camera has a clean view of; a camera that mostly sees a wall
  // is never cut to
  for (const tc of TVCAMS) {
    let ok = 0, n = 0;
    for (let d = -40; d <= 90; d += 10) { const q = pos(tc.i + Math.round(d / c.step), 0, 0.6);
      n++; if (sees(tc.x, tc.z, q[0], q[2])) ok++; }
    tc.clear = ok / n;
  }
  return { mesh: E.end(), lightpools: LIGHTPOOLS, tvcams: TVCAMS, circuit: c };
};
})(window.SCR = window.SCR || {});
