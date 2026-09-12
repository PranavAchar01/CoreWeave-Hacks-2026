// ============================================================================
// SCR.ui — the broadcast frame: header, timing tower, lineage strip, FIA telemetry, constructors'
// championship + team level, claimed-vs-official chart with cost cap, controls, garage panel (roles,
// XP, findings, development focus), HUD, debrief / package / level-up cards, REGS overlay, ticker, keys.
// All motion runs on SCR.engine.time; no wall-clock.
// ============================================================================
(function (SCR) {
'use strict';
const E = SCR.engine, U = SCR.ui = {};
let A = null;
const TRACK = new Set(['PRACTICE', 'QUALIFYING', 'RACE']);
const BADGE = { GARAGE: ['GARAGE', 'gold'], PRACTICE: ['PRACTICE', 'blue'], QUALIFYING: ['QUALIFYING', 'purple'], RACE: ['RACE', 'red'], SCRUTINEERING: ['SCRUTINEERING', 'amber'], VERDICT: ['VERDICT', 'black'], STANDINGS: ['STANDINGS', 'green'], FINALE: ['SEASON FINALE', 'gold'] };
const CAMS = [['AUTO', 'AUTO'], ['CHASE', 'CHASE'], ['ONBOARD', 'T-CAM'], ['TV', 'TV'], ['HELI', 'HELI']];
const PART_REGION = { frontWing: 'fw', rearWing: 'rw', floor: 'fl', sidepods: 'sp', fin: 'fin', engine: 'eng', brakes: 'wh', tyres: 'wh', drs: 'rw', ballast: 'fl', gearbox: 'eng' };
const COL = { night: '#06081A', studio: '#121A4A', tarmac: '#2C2E3A', ink: '#000000', white: '#FFFFFF', caption: '#C8CBD8', mid: '#6A6F8A', gold: '#F4C542', red: '#E31E2D', purple: '#B04BFF', cyan: '#3DD2FF', green: '#2FD968', amber: '#FFA318' };
const F35 = { A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101111011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110', '4': '101101111001001', '5': '111100110001110', '6': '011100110101010', '7': '111001010010010', '8': '010101010101010', '9': '010101011001110', '.': '000000000000010', ':': '000010000010000', '+': '000010111010000', '-': '000000111000000', '/': '001001010100100', '·': '000000010000000', '%': '101001010100101', ' ': '000000000000000' };
function txt(ctx, s, x, y, color, sc = 1) { ctx.fillStyle = color; s = String(s).toUpperCase(); for (let i = 0; i < s.length; i++) { const g = F35[s[i]]; if (g) for (let k = 0; k < 15; k++) if (g[k] === '1') ctx.fillRect(x + (k % 3) * sc, y + ((k / 3) | 0) * sc, sc, sc); x += 4 * sc; } return x; }
const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const setText = (n, s) => { if (n && n.textContent !== s) n.textContent = s; };
const setCls = (n, s) => { if (n && n.className !== s) n.className = s; };
const fmt3 = t => (t === null || t === undefined || !isFinite(t)) ? '--:--.---' : SCR.sim.fmt3(t);
const fmt1 = t => (t === null || t === undefined || !isFinite(t)) ? '-:--.-' : SCR.sim.fmt(t);
const pad2 = n => (n < 10 ? '0' : '') + n;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const roles = () => (SCR.team && SCR.team.ROLES) || [];
const S = () => SCR.season && SCR.season.state;
// ---------- header ----------
function drawHeader(s) {
  const phase = s ? s.phase : 'PRACTICE', round = s ? s.round : 1;
  const circ = s && s.world ? s.world.circuit.name : (SCR.world ? SCR.world.circuitName(A.seed) : '');
  setText($('hdrMid'), `SEASON 1 · ROUND ${pad2(round)}/22 · ${circ}${phase === 'RACE' ? ' · SEALED' : ''}`);
  const b = BADGE[phase] || [phase, 'red']; const badge = $('sessionBadge'); setText(badge, b[0]); setCls(badge, 'badge ' + b[1]);
  const t = Math.max(0, s ? s.phaseT : E.time); setText($('sessionClock'), `SESSION ${pad2(Math.floor(t / 60))}:${pad2(Math.floor(t % 60))}.${Math.floor((t * 10) % 10)}`);
}
// ---------- timing tower ----------
const tower = { sig: '', rows: new Map(), body: null };
function rankGens(gens) { const ok = gens.filter(g => g.verdict === 'SEALED' || g.verdict === 'RUNNING').sort((a, b) => (a.official ?? a.claimed ?? 9e9) - (b.official ?? b.claimed ?? 9e9)); const bad = gens.filter(g => g.verdict !== 'SEALED' && g.verdict !== 'RUNNING'); return ok.concat(bad); }
function drawTower(s) {
  const t = $('tower'); const gens = s ? s.gens : [];
  if (!tower.body) { t.textContent = ''; const head = el('div', 'tower-head'); head.append(el('span', '', 'TIMING · OFFICIAL'), el('span', 'tower-sub', 'SEALED CIRCUIT')); t.append(head); tower.body = el('div', 'tower-body'); t.append(tower.body); const key = el('div', 'tower-key'); key.innerHTML = '<i class="bf"></i> BLACK FLAG &nbsp; <i class="st"></i> STRIPPED &nbsp; <i class="fl"></i> FASTEST'; t.append(key); }
  const cur = s ? s.gen : null;
  const sig = gens.map(g => `${g.id}|${g.official}|${g.claimed}|${g.verdict}|${g.points}|${g.fastestLap ? 1 : 0}`).join(';') + '#' + (cur ? cur.id : 0);
  if (sig === tower.sig) { stepTower(); return; } tower.sig = sig;
  const ranked = rankGens(gens), RH = 20, leader = ranked.find(g => g.official != null && g.verdict === 'SEALED'), lt = leader ? leader.official : null, seen = new Set(); let pos = 0;
  ranked.forEach((g, i) => {
    seen.add(g.id); let r = tower.rows.get(g.id);
    if (!r) { r = { node: el('div', 'trow'), y: i * RH, target: i * RH }; r.node.style.top = r.y + 'px'; tower.body.append(r.node); tower.rows.set(g.id, r); }
    r.target = i * RH; const isCur = cur && g.id === cur.id, dq = g.verdict === 'BLACK FLAG', strip = g.verdict === 'STRIPPED', vd = g.verdict === 'VOID', run = g.verdict === 'RUNNING';
    const p = (dq || strip || vd) ? '--' : 'P' + (++pos), tm = g.official;
    const gap = dq ? 'FLAGGED' : strip ? 'STRIPPED' : vd ? 'VOID' : run ? (g.claimed != null ? 'CLAIMED' : 'ON TRACK') : (lt === null || tm === null) ? '--' : (g === leader ? 'LEADER' : '+' + (tm - lt).toFixed(3));
    r.node.className = 'trow' + (isCur ? ' cur' : '') + (dq ? ' dq' : '') + (strip ? ' strip' : '') + (vd ? ' void' : '') + (g.fastestLap ? ' fast' : '');
    r.node.innerHTML = `<span class="pos">${p}</span><span class="gen">GEN ${pad2(g.id)}</span><span class="tm">${tm == null ? (run && g.claimed != null ? fmt3(g.claimed) : '--:--.---') : fmt3(tm)}</span><span class="gap">${gap}</span><span class="pts">${(dq || vd || strip) ? '0' : g.points}</span>`;
  });
  for (const [id, r] of tower.rows) if (!seen.has(id)) { r.node.remove(); tower.rows.delete(id); }
  tower.body.style.height = Math.max(ranked.length * RH, 60) + 'px'; stepTower();
}
function stepTower() { for (const r of tower.rows.values()) if (r.y !== r.target) { const d = r.target - r.y; r.y += Math.sign(d) * Math.min(Math.abs(d), 5); r.node.style.top = r.y + 'px'; } }
// ---------- lineage strip ----------
const strip = { sig: '', slots: [], built: false };
function silhouette(cv, g, isCur, changed) {
  const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.clearRect(0, 0, 18, 9);
  const hi = k => changed.has(k) ? COL.gold : null, px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  if (!g) { px(0, 8, 18, 1, COL.studio); px(2, 3, 14, 3, COL.studio); return; }
  const body = g.verdict === 'BLACK FLAG' ? COL.mid : g.verdict === 'STRIPPED' ? COL.amber : g.verdict === 'VOID' ? COL.mid : COL.white;
  px(4, 3, 10, 3, body); px(1, 5, 3, 1, body); px(8, 2, 3, 1, COL.caption); px(6, 4, 5, 1, hi('sp') || COL.caption); px(8, 1, 1, 2, hi('eng') || COL.red);
  px(0, 6, 4, 1, hi('fw') || COL.red); px(15, 2, 3, 1, hi('rw') || COL.red); px(16, 3, 1, 1, hi('rw') || COL.red); px(4, 6, 10, 1, hi('fl') || COL.tarmac); if (changed.has('fin')) px(11, 1, 3, 1, COL.gold);
  px(3, 6, 2, 3, hi('wh') || COL.ink); px(13, 6, 2, 3, hi('wh') || COL.ink); px(4, 7, 1, 1, COL.mid); px(14, 7, 1, 1, COL.mid);
  if (g.verdict === 'BLACK FLAG') { px(0, 4, 18, 1, COL.red); px(13, 0, 5, 4, COL.white); px(14, 1, 3, 2, COL.ink); } else if (g.verdict === 'STRIPPED') { for (let x = 0; x < 18; x += 3) px(x, 4, 2, 1, COL.amber); } else if (g.verdict === 'VOID') { for (let x = 0; x < 18; x += 2) px(x, 4, 1, 1, COL.purple); }
  if (isCur) { px(0, 0, 18, 1, COL.cyan); px(0, 8, 18, 1, COL.cyan); }
}
function drawStrip(s) {
  const node = $('strip'); const gens = s ? s.gens : [], cur = s ? s.gen : null;
  if (!strip.built) { strip.built = true; node.textContent = ''; const head = el('div', 'strip-head'); head.append(el('span', '', 'SEASON LINEAGE'), el('span', 'strip-key', 'GOLD · PART CHANGED  RED · BLACK FLAG  AMBER · STRIPPED')); const row = el('div', 'strip-row'); for (let r = 1; r <= 22; r++) { const slot = el('div', 'slot'); const cv = el('canvas'); cv.width = 18; cv.height = 9; slot.append(cv, el('span', 'slot-n', pad2(r))); row.append(slot); strip.slots.push({ slot, cv }); } node.append(head, row); }
  const byRound = new Map(); for (const g of gens) byRound.set(g.round, g);
  const sig = gens.map(g => `${g.round}${g.verdict[0]}${g.parts.length}`).join('') + (cur ? cur.round : 0); if (sig === strip.sig) return; strip.sig = sig;
  strip.slots.forEach((o, i) => { const g = byRound.get(i + 1) || null, changed = new Set(); if (g) for (const k of g.parts) if (PART_REGION[k]) changed.add(PART_REGION[k]); silhouette(o.cv, g, !!(g && cur && g.id === cur.id), changed); o.slot.className = 'slot' + (g ? '' : ' empty') + (g && cur && g.id === cur.id ? ' cur' : ''); });
}
// ---------- telemetry ----------
const tele = { built: false, lines: null, n: 0 };
function drawTelemetry(s) {
  const node = $('telemetry');
  if (!tele.built) { tele.built = true; node.textContent = ''; const h = el('div', 'tele-head'); h.append(el('span', 'px', 'FIA TELEMETRY'), el('span', 'tele-cap', 'READ ONLY')); node.append(h); tele.lines = el('div', 'tele-lines'); node.append(tele.lines); }
  const lines = s ? s.telemetry : []; if (lines.length === tele.n && tele.lastFirst === lines[0]) return; tele.n = lines.length; tele.lastFirst = lines[0];
  let h = '';
  for (const ln of lines.slice(-9)) {
    const role = typeof ln === 'string' ? null : ln.role, text = typeof ln === 'string' ? ln : ln.text;
    const cls = text.indexOf('SEAL VERIFIED') >= 0 ? ' seal' : text.indexOf('TIMEOUT') >= 0 ? ' warn' : '';
    const tag = role && SCR.team && SCR.team.ROLE[role] ? `<i class="tl-role hue-${SCR.team.ROLE[role].hue}">${esc(SCR.team.ROLE[role].short)}</i>` : '';
    h += `<div class="tline${cls}">${tag}${esc(text)}</div>`;
  }
  tele.lines.innerHTML = h;
}
// ---------- championship ----------
function drawChamp(s) {
  const node = $('champ'); const team = s ? s.team : (SCR.team ? SCR.team.newTeam() : null), pts = s ? s.standings.points : 0, era = team && team.era ? team.era : { name: 'LOCK-UP 1994' };
  const sealed = s ? s.gens.filter(g => g.verdict === 'SEALED').length : 0, flags = s ? s.blackflags : 0, stripped = s ? s.stripped : 0;
  const html = `<div class="champ-head">CONSTRUCTORS' CHAMPIONSHIP</div><div class="champ-pts">${pts} <small>PTS</small></div><div class="champ-sub">${sealed} SEALED · ${flags} BLACK FLAG${flags === 1 ? '' : 'S'} · ${stripped} STRIPPED</div><div class="champ-team"><span>TEAM LEVEL</span><b>${team ? team.level : 8}</b></div><div class="champ-era">${esc(era.name)}</div>`;
  if (node.dataset.sig !== html) { node.dataset.sig = html; node.innerHTML = html; }
}
// ---------- chart ----------
const chart = { sig: '' };
function drawChart(s) {
  const cv = $('chart'), c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  const claimed = s ? s.chart.claimed : [], official = s ? s.chart.official : [], flags = s ? s.chart.flags : [], round = s ? s.round : 1, spend = s ? s.cost.spend : 0, cap = s ? s.cost.cap : 12, curClaimed = s && s.gen ? s.gen.claimed : null;
  const sig = JSON.stringify([claimed, official, flags, round, spend, cap, curClaimed, cv.width]); if (sig === chart.sig) return; chart.sig = sig;
  const W = cv.width, H = cv.height; c.fillStyle = COL.night; c.fillRect(0, 0, W, H);
  const x0 = 44, x1 = W - 150, y0 = 14, y1 = H - 24, all = claimed.concat(official).filter(v => v != null).concat(curClaimed != null ? [curClaimed] : []);
  let lo = all.length ? Math.min(...all) - 0.5 : 18, hi = all.length ? Math.max(...all) + 0.5 : 26; if (hi - lo < 3) { hi = lo + 3; }
  const X = r => Math.round(x0 + (r - 1) * (x1 - x0) / 21), Y = v => Math.round(y1 - (v - lo) * (y1 - y0) / (hi - lo));
  c.fillStyle = COL.studio; for (let r = 1; r <= 22; r++) for (let y = y0; y < y1; y += 4) c.fillRect(X(r), y, 1, 1);
  for (let k = 0; k <= 3; k++) { const v = lo + (hi - lo) * k / 3, y = Y(v); c.fillStyle = COL.studio; c.fillRect(x0, y, x1 - x0, 1); txt(c, fmt1(v), 4, y - 2, COL.mid); }
  for (let r = 1; r <= 22; r++) txt(c, pad2(r), X(r) - 3, y1 + 6, r === round ? COL.gold : COL.mid);
  // divergence band (dithered)
  for (let r = 1; r < 22; r++) { const a = claimed[r - 1], b = official[r - 1], a2 = claimed[r], b2 = official[r]; if (a == null || b == null || a2 == null || b2 == null) continue;
    for (let x = X(r); x < X(r + 1); x++) { const t = (x - X(r)) / (X(r + 1) - X(r)), ya = Y(a + (a2 - a) * t), yb = Y(b + (b2 - b) * t); for (let y = Math.min(ya, yb); y < Math.max(ya, yb); y++) if (((x + y) & 1) === 0) { c.fillStyle = COL.red; c.fillRect(x, y, 1, 1); } } }
  const line = (arr, col) => { let prev = null; for (let r = 1; r <= 22; r++) { const v = arr[r - 1]; if (v == null) { prev = null; continue; } const x = X(r), y = Y(v); if (prev) { const dx = x - prev[0], steps = Math.abs(dx); for (let k = 0; k <= steps; k++) { const t = k / Math.max(1, steps); c.fillStyle = col; c.fillRect(prev[0] + k, Math.round(prev[1] + (y - prev[1]) * t), 1, 1); } } c.fillStyle = col; c.fillRect(x - 1, y - 1, 3, 3); prev = [x, y]; } };
  line(claimed, COL.gold); line(official, COL.white);
  if (curClaimed != null && claimed[round - 1] == null) { c.fillStyle = COL.gold; const x = X(round), y = Y(curClaimed); c.fillRect(x - 2, y - 2, 5, 5); c.fillStyle = COL.night; c.fillRect(x - 1, y - 1, 3, 3); }
  for (const r of flags) { const x = X(r); c.fillStyle = COL.white; c.fillRect(x - 3, y0, 7, 7); c.fillStyle = COL.ink; c.fillRect(x - 3, y0, 3, 3); c.fillRect(x + 1, y0 + 4, 3, 3); }
  c.fillStyle = COL.gold; for (let y = y0; y < y1; y += 2) c.fillRect(X(round), y, 1, 1);
  txt(c, 'TEAM CLAIMED VS OFFICIAL · LAP TIME BY ROUND', x0, 2, COL.caption); c.fillStyle = COL.gold; c.fillRect(x1 - 210, 3, 5, 5); txt(c, 'CLAIMED', x1 - 202, 2, COL.mid); c.fillStyle = COL.white; c.fillRect(x1 - 150, 3, 5, 5); txt(c, 'OFFICIAL', x1 - 142, 2, COL.mid);
  // cost cap panel
  const px0 = x1 + 16; txt(c, 'COST CAP · ROUND ' + pad2(round), px0, 14, COL.caption);
  const bw = W - px0 - 12, frac = Math.min(1.25, spend / cap); c.fillStyle = COL.studio; c.fillRect(px0, 30, bw, 12); c.fillStyle = frac > 1 ? COL.red : frac > 0.85 ? COL.amber : COL.green; c.fillRect(px0, 30, Math.round(bw * Math.min(1, frac) / 1.25 * 1.25 / 1.25), 12);
  const capX = px0 + Math.round(bw / 1.25); c.fillStyle = COL.white; c.fillRect(capX, 26, 1, 20); txt(c, 'CAP', capX - 5, 48, COL.white);
  txt(c, `$${spend.toFixed(1)}M / $${cap.toFixed(1)}M`, px0, 62, COL.white, 2); txt(c, frac > 1 ? 'OVER THE CAP · VOID' : frac > 0.85 ? 'AT THE LIMIT' : 'UNDER CAP', px0, 82, frac > 1 ? COL.red : frac > 0.85 ? COL.amber : COL.green);
  txt(c, 'GOLD ABOVE WHITE = A CLAIM THE CLOCK DID NOT HONOUR', px0, 104, COL.mid);
}
// ---------- controls ----------
const ctl = { built: false, btns: {} };
function drawControls(s) {
  const node = $('controls');
  if (!ctl.built) { ctl.built = true; node.textContent = '';
    const mk = (id, label, fn, cls) => { const b = el('button', cls, label); b.id = id; b.addEventListener('click', fn); node.append(b); ctl.btns[id] = b; return b; };
    mk('bPlay', 'PAUSE', () => { A.paused = !A.paused; }); mk('bS1', 'X1', () => { A.speed = 1; }); mk('bS2', 'X2', () => { A.speed = 2; }); mk('bS4', 'X4', () => { A.speed = 4; });
    mk('bSkip', 'SKIP PHASE', () => SCR.season && SCR.season.skipPhase()); mk('bGarage', 'GARAGE', () => SCR.season && SCR.season.jump('garage'));
    mk('bBlack', 'JUMP: THE BLACK FLAG', () => SCR.season && SCR.season.jump('blackflag')); mk('bConv', 'JUMP: CONVERGENCE', () => SCR.season && SCR.season.jump('convergence'));
    mk('bRestart', 'RESTART SEASON', () => { const v = parseInt(ctl.seed.value, 10); if (SCR.season) SCR.season.restart(isFinite(v) ? v : A.seed); });
    const seedWrap = el('label', 'seed-wrap', 'SEED '); ctl.seed = el('input'); ctl.seed.type = 'text'; ctl.seed.value = String(A.seed); ctl.seed.size = 6; seedWrap.append(ctl.seed); node.append(seedWrap);
    mk('bRegs', 'REGS', () => toggleRegs());
    mk('bAi', 'AI LEVELS: OFF', async () => { const T = SCR.team; if (!T) return; if (T.aiLevels) { T.aiLevels = false; setText(ctl.btns.bAi, 'AI LEVELS: OFF'); return; } setText(ctl.btns.bAi, 'AI LEVELS: ASKING'); const ok = await T.enableAI(); setText(ctl.btns.bAi, ok ? 'AI LEVELS: ON' : 'AI LEVELS: UNAVAILABLE'); });
    node.append(el('div', 'keys', 'SPACE PLAY · [ ] SPEED · 1-5 CAMERA · C CYCLE · → SKIP · G GARAGE · R REGS'));
    const dock = el('div', 'camdock'); ctl.dock = dock;
    ctl.camHead = el('div', 'cam-head', 'CAMERA'); ctl.camRow = el('div', 'cam-row');
    dock.append(ctl.camHead, ctl.camRow); $('cards').append(dock);
  }
  setText(ctl.btns.bPlay, A.paused ? 'PLAY' : 'PAUSE');
  for (const [id, v] of [['bS1', 1], ['bS2', 2], ['bS4', 4]]) ctl.btns[id].setAttribute('aria-pressed', String(A.speed === v));
  drawCamRail(s);
}
const GARAGE_CAMS = [['OVERVIEW', 'GARAGE'], ['CAR', 'THE CAR']];
function camList(s) {
  if (s && TRACK.has(s.phase)) return CAMS;
  if (A.sceneName === 'garage') { const g = SCR.scenes.garage, sel = g && g.selected; return GARAGE_CAMS.concat(sel && SCR.team.ROLE[sel] ? [['STATION_' + sel, SCR.team.ROLE[sel].short]] : []); }
  return null;
}
function drawCamRail(s) {
  const list = camList(s), row = ctl.camRow;
  if (!list) { ctl.dock.hidden = true; return; }
  ctl.dock.hidden = false;
  const sig = list.map(c => c[0]).join(',');
  if (row.dataset.sig !== sig) { row.dataset.sig = sig; row.textContent = '';
    for (const [k, lbl] of list) { const b = el('button', 'cam', lbl); b.dataset.cam = k; b.addEventListener('click', () => U.setCamera(k)); row.append(b); } }
  const cur = U.currentCamera(s);
  for (const b of row.children) b.setAttribute('aria-pressed', String(cur === b.dataset.cam));
  ctl.camHead.textContent = 'CAMERA' + (s && TRACK.has(s.phase) && cur !== 'AUTO' ? ' · LOCKED' : '');
}
U.currentCamera = function (s) { if (s && TRACK.has(s.phase)) { const tr = SCR.season && SCR.season.track(); return tr ? tr.mode : 'AUTO'; } const g = SCR.scenes.garage; return g ? g.cam : ''; };
U.setCamera = function (k) {
  const s = S();
  if (s && TRACK.has(s.phase)) { if (SCR.season) SCR.season.setCamera(k); return; }
  if (A.sceneName === 'garage' && SCR.scenes.garage) SCR.scenes.garage.setCamera(k);
};
U.cycleCamera = function () { const s = S(), list = camList(s); if (!list) return; const cur = U.currentCamera(s); const i = list.findIndex(c => c[0] === cur); U.setCamera(list[(i + 1) % list.length][0]); };
// ---------- garage panel ----------
const gp = { built: false, sig: '' };
const HUE = { gold: 'gold', purple: 'purple', cyan: 'cyan', red: 'red', amber: 'amber', green: 'green', white: 'white' };
function drawGaragePanel(s) {
  const node = $('garagePanel'); const team = s ? s.team : (SCR.team ? SCR.team.newTeam() : null); if (!team) return;
  const g = SCR.scenes.garage, sel = (s && s.selected) || (g && g.selected) || null;
  const focus = s ? s.focus : null, tokens = s ? s.tokens : 0, findings = s ? s.allFindings.slice(-5).reverse() : [];
  const sig = JSON.stringify([Object.values(team.roles).map(r => [r.level, r.xp]), sel, focus, tokens, findings.map(f => f.title), s ? s.round : 0]);
  if (sig === gp.sig) return; gp.sig = sig;
  let h = `<div class="gp-head"><span>THE TEAM · TEN AGENTS</span><span>LEVEL ${team.level}</span></div>`;
  h += `<div class="gp-tokens"><span>DEVELOPMENT TOKENS</span><b>${tokens}</b><span class="gp-hint">ONE PER ROUND · SPEND ON ANY AGENT</span></div>`;
  if (sel && SCR.team.ROLE[sel]) {
    const r = SCR.team.ROLE[sel], st = team.roles[sel], def = SCR.team.levelDef(sel, st.level), next = SCR.team.levelDef(sel, st.level + 1);
    const need = SCR.team.xpFor(st.level), pct = Math.min(100, Math.round(100 * st.xp / need)), pn = SCR.team.partNo(sel, st.level);
    h += `<div class="gp-sel hue-${r.hue}"><div class="gs-top"><span>${esc(r.label)}</span><span class="gs-part">${esc(pn)}</span></div>` +
      `<div class="gs-def">${esc(def.name)}${def.generated ? ' <i class="gen-chip">GENERATED</i>' : ''}</div>` +
      `<div class="gs-blurb">${esc(def.blurb)}</div>` +
      `<div class="xp"><i style="width:${pct}%"></i></div><div class="gs-xp">${st.xp} / ${need} XP · LEVEL ${st.level}</div>` +
      `<div class="gs-next">NEXT · ${esc(next ? next.name : '—')} · ${esc(SCR.team.partNo(sel, st.level + 1))}</div>` +
      `<div class="gs-btns"><button id="btnUp" ${tokens < 1 ? 'disabled' : ''}>UPGRADE · 1 TOKEN</button>` +
      `<button id="btnFocus" ${focus === sel ? 'aria-pressed="true"' : ''}>FOCUS</button>` +
      `<button id="btnCam">VIEW STATION</button></div>` +
      `<div class="gs-agent"><b>AGENT</b> ${esc(r.harness)}</div>` +
      `<div class="gs-agent"><b>OWNS</b> ${esc(r.artifact)}</div>` +
      `<div class="gs-agent"><b>EMITS</b> ${esc(r.emits)}</div>` +
      `<div class="gs-agent"><b>PART</b> ${esc(pn[0])} · ${esc(SCR.team.PREFIX_MEANING[pn[0]] || '')}</div></div>`;
  } else h += `<div class="gp-empty">SELECT A STATION IN THE GARAGE TO INSPECT THE AGENT BEHIND IT</div>`;
  for (const r of roles()) { const st = team.roles[r.key], def = SCR.team.levelDef(r.key, st.level), need = SCR.team.xpFor(st.level), pct = Math.min(100, Math.round(100 * st.xp / need));
    h += `<div class="role hue-${r.hue}${sel === r.key ? ' sel' : ''}${focus === r.key ? ' focus' : ''}" data-role="${r.key}"><div class="role-top"><span class="role-name">${esc(r.short)}</span><span class="role-lvl">${esc(SCR.team.partNo(r.key, st.level))}</span></div><div class="role-def">${esc(def.name)}</div><div class="xp"><i style="width:${pct}%"></i></div></div>`; }
  h += `<div class="gp-head"><span>DEBRIEF FINDINGS</span><span>${s ? 'ROUND ' + pad2(s.round) : ''}</span></div>`;
  if (!findings.length) h += `<div class="finding"><div class="f-title">NO FINDINGS YET · THE FIRST DEBRIEF FOLLOWS ROUND 01</div></div>`;
  for (const f of findings) h += `<div class="finding ${f.tone}"><div class="f-title">${esc(SCR.team.ROLE[f.role].short)} · ${esc(f.title)} <b>${f.xp >= 0 ? '+' : ''}${f.xp} XP</b></div><div class="f-ev">${esc(f.evidence)}</div><div class="f-foot">${esc(f.footnote)}</div></div>`;
  node.innerHTML = h;
  // Handlers resolve the selection at click time, never from the render that drew them: the garage
  // re-selects itself during an automatic upgrade scene, and a stale capture would upgrade the wrong agent.
  for (const rn of node.querySelectorAll('.role')) rn.addEventListener('click', () => U.selectRole(rn.dataset.role === U.currentRole() ? null : rn.dataset.role));
  const up = $('btnUp'); if (up) up.addEventListener('click', () => { const k = U.currentRole(); if (k && SCR.season && SCR.season.spendToken(k)) gp.sig = ''; });
  const fo = $('btnFocus'); if (fo) fo.addEventListener('click', () => { const k = U.currentRole(); if (k && SCR.season) SCR.season.setFocus(SCR.season.state.focus === k ? null : k); gp.sig = ''; });
  const cm = $('btnCam'); if (cm) cm.addEventListener('click', () => { const k = U.currentRole(); if (k) U.setCamera('STATION_' + k); });
}
void HUE;
// ---------- garage overlay: a card pinned over every station on the floor ----------
const gov = { built: false, cards: {}, node: null, sig: '' };
function drawGarageOverlay(s) {
  const g = SCR.scenes.garage, on = A.sceneName === 'garage' && g && g.screenAnchors;
  if (!gov.node) { gov.node = el('div', 'gar-overlay'); $('cards').append(gov.node); }
  gov.node.hidden = !on; if (!on) return;
  const team = (s && s.team) || g.team; if (!team) return;
  if (!gov.built) { gov.built = true; gov.node.textContent = '';
    for (const r of roles()) { const c = el('button', 'gcard hue-' + r.hue); c.dataset.role = r.key;
      c.innerHTML = `<span class="gc-name">${esc(r.short)}</span><span class="gc-part"></span><span class="gc-lvl"></span><i class="gc-xp"><b></b></i>`;
      c.addEventListener('click', ev => { ev.stopPropagation(); U.selectRole(r.key === U.currentRole() ? null : r.key); });
      gov.node.append(c); gov.cards[r.key] = c; }
    const legend = el('div', 'gar-legend'); legend.innerHTML = 'CLICK A STATION TO INSPECT AND UPGRADE THAT AGENT'; gov.node.append(legend); gov.legend = legend;
  }
  for (const r of roles()) {
    const card = gov.cards[r.key], a = g.screenAnchors[r.key], st = team.roles[r.key];
    if (!a || a.z > 90) { card.hidden = true; continue; } card.hidden = false;
    card.style.left = (Math.max(7, Math.min(93, a.x * 100))).toFixed(2) + '%'; card.style.top = (Math.max(8, Math.min(96, a.y * 100))).toFixed(2) + '%';
    const def = SCR.team.levelDef(r.key, st.level), need = SCR.team.xpFor(st.level);
    card.querySelector('.gc-part').textContent = SCR.team.partNo(r.key, st.level);
    card.querySelector('.gc-lvl').textContent = 'L' + st.level;
    card.querySelector('.gc-xp b').style.width = Math.min(100, Math.round(100 * st.xp / need)) + '%';
    card.className = 'gcard hue-' + r.hue + (g.selected === r.key ? ' sel' : '') + (g.up && g.up.role === r.key ? ' up' : '');
    card.title = def.name;
  }
  decollide();
  gov.legend.hidden = !!g.selected;
}
// station cards must never sit on top of each other: nudge overlapping pairs apart vertically
function decollide() {
  const ov = gov.node.getBoundingClientRect(); if (ov.height < 40) return;
  const live = [];
  for (const r of roles()) { const c = gov.cards[r.key]; if (c.hidden) continue;
    const b = c.getBoundingClientRect(); live.push({ c, t: parseFloat(c.style.top), l: b.left, r: b.right, u: b.top, d: b.bottom }); }
  const k = 100 / ov.height;
  for (let pass = 0; pass < 6; pass++) {
    let moved = false;
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l), oy = Math.min(a.d, b.d) - Math.max(a.u, b.u);
      if (ox <= 2 || oy <= 2) continue;
      const hi = a.u <= b.u ? a : b, lo = hi === a ? b : a, push = (oy + 5) / 2;
      hi.u -= push; hi.d -= push; hi.t -= push * k;
      lo.u += push; lo.d += push; lo.t += push * k;
      moved = true;
    }
    if (!moved) break;
  }
  for (const o of live) o.c.style.top = Math.max(6, Math.min(97, o.t)).toFixed(2) + '%';
}
U.currentRole = function () { const s = S(), g = SCR.scenes.garage; return (s && s.selected) || (g && g.selected) || null; };
U.selectRole = function (role) {
  const g = SCR.scenes.garage; if (!g) return;
  if (SCR.season && SCR.season.select) SCR.season.select(role); else g.select(role);
  gp.sig = '';
};
// ---------- HUD ----------
const hud = { built: false, map: null, mapBase: null, mapFit: null, mapSeed: null };
function buildMap(circ) {
  hud.mapBase = document.createElement('canvas'); hud.mapBase.width = 96; hud.mapBase.height = 64; const cp = circ.pts; let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
  for (const p of cp) { minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); minz = Math.min(minz, p.z); maxz = Math.max(maxz, p.z); }
  const sc = Math.min(80 / (maxx - minx), 50 / (maxz - minz)); hud.mapFit = { sc, ox: 48 - (minx + maxx) / 2 * sc, oz: 32 + (minz + maxz) / 2 * sc };
  const c = hud.mapBase.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0, 0, 96, 64); c.fillStyle = COL.mid; for (const p of cp) c.fillRect(Math.round(p.x * sc + hud.mapFit.ox), Math.round(-p.z * sc + hud.mapFit.oz), 1, 1); c.fillStyle = COL.white; c.fillRect(Math.round(cp[0].x * sc + hud.mapFit.ox) - 1, Math.round(-cp[0].z * sc + hud.mapFit.oz) - 1, 3, 3); hud.mapSeed = circ.seed;
}
function drawHud(s) {
  const node = $('hud'); const onTrack = s && TRACK.has(s.phase);
  if (!onTrack) { if (node.innerHTML !== '') node.innerHTML = ''; hud.built = false; return; }
  if (!hud.built) { hud.built = true; node.innerHTML = `<div class="tl"><span class="tag red" id="hGen"></span><span class="tag" id="hLap"></span><span class="tag cyan" id="hCam"></span><span class="tag navy" id="hGhost"></span></div><div class="tr"><span class="tag" id="hLabel"></span><span class="big" id="hTime"></span><span class="tag gold" id="hBest"></span></div><div class="bl"><span class="drs" id="hDrs">DRS</span><div class="speed"><span class="n" id="hSpeed">0</span><span>KM/H</span><span class="bar"><i id="hBar"></i></span><span id="hGear">G1</span></div></div><div class="br"><canvas id="hMap" width="96" height="64"></canvas></div>`; hud.map = $('hMap'); }
  const car = s.car, tr = SCR.season.track(), circ = s.world.circuit, dd = s.derived;
  if (!hud.mapBase || hud.mapSeed !== circ.seed) buildMap(circ);
  setText($('hGen'), `GEN ${pad2(s.gen.id)} · ${s.phase}`); setText($('hLap'), `LAP ${car.lap} · S${car.sector + 1}`); setText($('hCam'), tr ? tr.label : '');
  const gh = $('hGhost'); if (tr && tr.ghostActive) { let ds = car.s - s.ghost.s; if (ds > circ.len / 2) ds -= circ.len; if (ds < -circ.len / 2) ds += circ.len; const dt = ds / Math.max(10, car.speed); setText(gh, `GHOST GEN ${pad2(Math.max(1, s.gen.id - 1))} · ${dt >= 0 ? '−' : '+'}${Math.abs(dt).toFixed(2)}s`); setCls(gh, 'tag ' + (dt >= 0 ? 'green' : 'red')); gh.hidden = false; } else gh.hidden = true;
  setText($('hLabel'), s.phase === 'RACE' ? 'OFFICIAL LAP' : 'PRACTICE LAP'); setText($('hTime'), fmt1(s.time - car.lapStart)); setText($('hBest'), car.best === null ? 'BEST —' : `BEST ${fmt3(car.best)}`);
  const kmh = Math.round(car.speed * 3.6 * 1.32); setText($('hSpeed'), String(kmh)); $('hBar').style.width = `${Math.round(100 * car.speed / (dd.topSpeed + dd.drsBoost))}%`; setText($('hGear'), `G${Math.max(1, Math.min(dd.gears, Math.ceil(car.speed / dd.topSpeed * dd.gears)))}`);
  const drs = $('hDrs'); setCls(drs, 'drs' + (car.drsOn ? ' on' : '')); setText(drs, s.spec.drs ? (car.drsOn ? 'DRS OPEN' : 'DRS') : 'NO DRS');
  const mc = hud.map.getContext('2d'); mc.imageSmoothingEnabled = false; mc.drawImage(hud.mapBase, 0, 0); const f = hud.mapFit;
  if (tr && tr.ghostActive) { mc.fillStyle = COL.cyan; mc.fillRect(Math.round(s.ghost.x * f.sc + f.ox) - 1, Math.round(-s.ghost.z * f.sc + f.oz) - 1, 3, 3); }
  mc.fillStyle = COL.gold; mc.fillRect(Math.round(car.x * f.sc + f.ox) - 1, Math.round(-car.z * f.sc + f.oz) - 1, 3, 3);
}
// ---------- cards (package, debrief, level-up) ----------
const cards = { queue: [], cur: null, dom: null };
function pushCard(html, dur) { cards.queue.push({ html, dur, at: E.time }); if (cards.queue.length > 6) cards.queue.shift(); }
function drawCards() {
  if (!cards.dom) { cards.dom = el('div', 'ui-cards'); $('cards').append(cards.dom); }
  if (cards.cur && E.time - cards.cur.shown >= cards.cur.dur) { cards.cur = null; cards.dom.innerHTML = ''; }
  while (!cards.cur && cards.queue.length) { const c = cards.queue.shift(); if (E.time - c.at > c.dur + 2) continue; cards.cur = { ...c, shown: E.time }; cards.dom.innerHTML = c.html; }
}
function wireEvents() {
  const Se = SCR.season; if (!Se || !Se.on || U.wired) return; U.wired = true;
  Se.on('packageCard', g => { const parts = g.pkg.parts.map(p => `<span class="pc-part">${esc(p.label)} <b>${esc(SCR.car.fmtVal(p.from))} → ${esc(SCR.car.fmtVal(p.to))}</b></span>`).join('') || '<span class="pc-part">NO PARTS CHANGED</span>';
    pushCard(`<div class="card pkg"><div class="card-eyebrow">UPGRADE PACKAGE #${pad2(g.id)} · RACE ENGINEER</div><div class="card-title">${g.pkg.void ? 'PACKAGE VOID · OVER THE COST CAP' : 'FITTED FOR ROUND ' + pad2(g.round)}</div><div class="pc-parts">${parts}</div><div class="card-foot">SPEND $${g.spend.toFixed(1)}M OF $${g.cap.toFixed(1)}M${g.pkg.removed && g.pkg.removed.length ? ' · ' + esc(g.pkg.removed[0].label) + ' REMOVED BY PRE-RACE INSPECTION' : ''}</div></div>`, 4.5); });
  Se.on('upgradeScene', lu => { const d = lu.def || {}; pushCard(`<div class="card levelup"><div class="card-eyebrow">UPGRADE · ${esc(SCR.team.ROLE[lu.role].label)}</div><div class="card-title">LEVEL ${lu.level} · ${esc(d.name || '')}${d.generated ? ' <i class="gen-chip">GENERATED</i>' : ''}</div><div class="card-body">${esc(d.blurb || '')}</div><div class="card-foot">${esc(d.footnote || '')}</div></div>`, (SCR.garage && SCR.garage.UPGRADE_DUR) || 3.8); });
  Se.on('phase', p => { if (p.phase === 'GARAGE' && p.round > 1) { const s = S(); const f = s.findings.slice(0, 4).map(x => `<div class="db-row ${x.tone}"><span>${esc(SCR.team.ROLE[x.role].short)}</span><span>${esc(x.title)}</span><b>${x.xp >= 0 ? '+' : ''}${x.xp}</b></div>`).join(''); pushCard(`<div class="card debrief"><div class="card-eyebrow">DEBRIEF · ROUND ${pad2(p.round - 1)}</div><div class="card-title">${s.findings.length} FINDING${s.findings.length === 1 ? '' : 'S'} · ${s.levelups.length} UPGRADE${s.levelups.length === 1 ? '' : 'S'}</div>${f}</div>`, 3.0); } });
  Se.on('strip', g => pushCard(`<div class="card black"><div class="card-eyebrow">LINEAGE AUDIT</div><div class="card-title">GEN ${pad2(g.id)} STRIPPED</div><div class="card-body">${esc(g.illegalParts[0] ? g.illegalParts[0].label : 'ILLEGAL PART')} FOUND IN THE WINNING LINEAGE · POINTS REMOVED</div></div>`, 4));
}
// ---------- REGS ----------
U.toggleRegs = toggleRegs;
function wireRegsOnly() {
  document.addEventListener('keydown', ev => { if (ev.key === 'r' || ev.key === 'R') toggleRegs(); });
  const r = document.getElementById('regs');
  if (r) r.addEventListener('click', ev => { if (ev.target && ev.target.id === 'regsClose') toggleRegs(); });
}
function toggleRegs() { const r = $('regs'); if (r.hidden) { r.innerHTML = regsHtml(); r.hidden = false; } else r.hidden = true; }

// ---------- REGS articles built from the loop's own exported bundle ----------
function loopArticles() {
  const L = window.SCRUTINEER_LOOP;
  if (!L) {
    return `<div class="regs-head" style="margin-top:18px"><span>ARTICLE 3 · THE SEASON THE LOOP RAN</span></div>`
      + `<p>No loop bundle is embedded in this build. The broadcast above is the game; the control `
      + `plane that produces these numbers lives in loop/ and writes state/broadcast.json with `
      + `<code>scrutineer season --export</code>.</p>`;
  }
  const g = L.rounds || [];
  let h = `<div class="regs-head" style="margin-top:18px"><span>ARTICLE 3 · THE SEASON THE LOOP ACTUALLY RAN</span></div>`;
  h += `<p>Seed ${esc(L.seed)} · REGS.md sha256 <code>${esc(String(L.regs_sha256).slice(0, 16))}</code> · `
    + `${g.length} generations · ${esc(L.accepted)} homologated. Every number in this table came out of `
    + `the control plane; the page computes none of it. Seconds are gains: positive is faster.</p>`;
  h += `<table class="regs-table"><tr><th>GEN</th><th>RULE</th><th>ROLE</th><th>CLAIMED</th><th>OFFICIAL</th>`
    + `<th>&Delta;QUALI</th><th>&Delta;SEALED</th><th>VERDICT</th><th>OUTCOME</th></tr>`;
  for (const r of g) {
    const out = r.promoted ? `HOMOLOGATED ${esc(r.part || '')}`
      : (r.rule_fired === 'no_upgrade' ? 'NO UPGRADE · EXTRA-LAP GHOST' : 'BLOCKED');
    const bf = (r.black_flags && r.black_flags.length) ? ` · BLACK FLAG ${esc(r.black_flags[0].cell)}` : '';
    h += `<tr><td>${r.generation}</td><td>${esc(r.rule_fired)}</td><td>${esc(r.role || '—')}</td>`
      + `<td>${r.claimed_s.toFixed(3)}</td><td>${r.official_s.toFixed(3)}</td>`
      + `<td>${r.d_quali >= 0 ? '+' : ''}${r.d_quali.toFixed(2)}</td>`
      + `<td>${r.d_sealed >= 0 ? '+' : ''}${r.d_sealed.toFixed(2)}</td>`
      + `<td>${esc(r.verdict || '—')}</td><td>${out}${bf}</td></tr>`;
  }
  h += `</table>`;
  const blocked = g.filter(r => !r.promoted && r.gates && r.gates.some(x => !x.ok));
  if (blocked.length) {
    h += `<div class="regs-head" style="margin-top:18px"><span>ARTICLE 4 · WHERE THE LOOP REFUSED</span></div>`;
    h += `<p>A loop that cannot refuse is not a loop. These are the generations that produced a candidate `
      + `and did not promote it, with the gate that stopped them.</p><table class="regs-table">`
      + `<tr><th>GEN</th><th>ROLE</th><th>GATE</th><th>WHAT IT SAW</th></tr>`;
    for (const r of blocked) {
      for (const x of r.gates.filter(y => !y.ok)) {
        h += `<tr><td>${r.generation}</td><td>${esc(r.role || '—')}</td><td>${esc(x.gate)}</td>`
          + `<td>${esc(x.detail)}</td></tr>`;
      }
    }
    h += `</table>`;
  }
  const chain = L.chain || {};
  h += `<div class="regs-head" style="margin-top:18px"><span>ARTICLE 5 · FIA RECEIPTS</span></div>`;
  h += `<p>Every accepted transition is Ed25519-signed and hash-chained to the one before it, so the season `
    + `is a single chain a forty-line verifier replays. This build's chain: `
    + `<b>${chain.ok ? 'INTACT' : 'BROKEN'}</b> — ${esc(chain.message || '')}</p>`;
  h += `<table class="regs-table"><tr><th>ROUND</th><th>ROLE</th><th>PART</th><th>VERSION</th>`
    + `<th>MODE</th><th>APPROVAL</th><th>OFFICIAL</th></tr>`;
  for (const r of (chain.rows || [])) {
    h += `<tr><td>${r.round}</td><td>${esc(r.role || '')}</td><td>${esc(r.prefix || '')}</td>`
      + `<td>${esc(r.new_version || '')}</td><td>${esc(r.mode || '')}</td>`
      + `<td>${esc(r.rule_fired || '')}</td><td>${Number(r.official).toFixed(3)}</td></tr>`;
  }
  h += `</table>`;
  h += `<div class="regs-head" style="margin-top:18px"><span>ARTICLE 6 · HONESTY PANEL</span></div>`;
  h += `<p>Which rails served this season, and what each one actually did. A rail marked `
    + `<b>stand-in</b> ran a labelled local substitute; it is never a claim that the vendor's `
    + `product was used. The counts are the rails' own meters, so "live" is a number rather than `
    + `an assertion.</p>`;
  h += `<table class="regs-table"><tr><th>RAIL</th><th>BACKEND</th><th>WHAT IT DID</th></tr>`;
  const meters = L.meters || {};
  const did = (k) => {
    const m = meters[k];
    if (!m) return '—';
    if (k === 'driver') return `${m.calls} completions · ${m.cache_hits} cache hits · `
      + `${((m.tokens_in + m.tokens_out) / 1000).toFixed(0)}k tokens · $${m.spend_usd}`;
    if (k === 'typed_decision') return `${m.answered} decisions answered · ${m.fell_back} fell back `
      + `to the local policy · $${m.spend_usd}`;
    if (k === 'weave') return `${m.calls_logged} spans · ${m.feedback_rows} feedback rows`;
    if (k === 'sandbox') return `${m.executions} executions · ${m.cache_hits} cache hits`;
    return '—';
  };
  for (const k of Object.keys(L.backends || {})) {
    h += `<tr><td>${esc(k)}</td><td>${esc(L.backends[k])}</td><td>${esc(did(k))}</td></tr>`;
  }
  h += `</table>`;
  return h;
}

function regsHtml() {
  let h = `<div class="regs-head"><span>HOW THIS WORKS</span><button id="regsClose">CLOSE</button></div>`;
  h += `<p><b>Scrutineer is an agent that builds web interfaces, and rebuilds its own harness.</b>
    The harness is everything around the model: which reference material reaches it, how many
    attempts it gets, how hard its work is checked before it is submitted, which briefs it
    practises on. The model never changes. Every improvement you see came from the agent rewriting
    the machinery it runs inside.</p>`;
  h += `<p>Each run it is given interface briefs — a checkout form, a modal dialog, a sortable
    invoice table — and has to return a complete HTML document. Then the part that makes this
    checkable rather than claimed: <b>every page is opened in Chromium and audited by axe-core</b>,
    the same accessibility engine used across the industry, plus selector assertions for the
    functional requirements in the brief. Violations are weighted critical 10, serious 5,
    moderate 2, minor 1. A pass is zero violations with every requirement met. No model is
    anywhere in the judging path.</p>`;
  h += `<p><b>You can check any of it.</b> Every interface the agent built is a real document at a
    real URL on this site. Open one from a run, open the same brief from a later run, and run axe
    on both yourself. An unlabelled button is either there or it is not.</p>`;
  h += `<p>The improvement loop works like this. The agent reads its own failures and asks which
    of its components caused them. It does not guess: for every failure it <b>rebuilds the
    interface with one component corrected at a time</b> and watches whether the failure goes away.
    A component is blamed only when correcting it actually flips the result, across enough
    failures that a bootstrap confidence interval clears zero. Then it writes a real diff against
    that component's own files, and the change has to survive ten checks before it sticks.</p>`;

  h += `<div class="regs-head" style="margin-top:18px"><span>THE COMPONENTS</span></div>`;
  h += `<table class="regs-table"><tr><th>COMPONENT</th><th>WHAT IT DECIDES</th><th>WHAT AN UPGRADE CHANGES</th></tr>`;
  for (const r of [
    ['RETRIEVAL', 'which reference material reaches the model', 'the retrieval strategy, and which WCAG references exist at all'],
    ['MODEL', 'inference', 'a fine-tuned checkpoint in place of the base model'],
    ['SAMPLING', 'decode policy', 'temperature, and how many candidate interfaces are drawn'],
    ['VERIFICATION', 'pre-submit audit', 'from "does it look like HTML" to rendering the page and running axe on it'],
    ['CURRICULUM', 'task selection', 'a practice set mined from what it keeps failing'],
    ['PROPOSER', 'patch synthesis', 'its own instructions for writing changes'],
    ['BUDGET', 'stop policy', 'when to keep refining and when to submit'],
    ['AUDIT', 'tamper check', 'what counts as an illegal change'],
    ['MEMORY', 'trace compaction', 'how findings are recorded for next time'],
    ['DEPLOY', 'install and smoke', 'how a change is applied and tested before it races'],
  ]) h += `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`;
  h += `</table>`;

  h += `<div class="regs-head" style="margin-top:18px"><span>WHY IT CANNOT SIMPLY CHEAT</span></div>`;
  h += `<p>An agent that can edit its own harness can also edit its own scoreboard, so the score it
    is judged on is not one it can reach. Every run is scored twice: on briefs it practises with,
    and on a held-out set it never sees. A change is kept only if it is at least as good on
    <b>both</b> and strictly better on one. A read-only auditor reads the actual diff and blocks
    anything touching the scorer, the held-out briefs, or the record. Every accepted change is
    signed and hash-chained to the one before it. Several runs below end with the agent refusing to
    change anything, because the evidence was not strong enough — the behaviour you want, and the
    hardest to fake.</p>`;
  h += loopArticles();
  return h;
}
// ---------- init / frame ----------
U.init = function (app) {
  A = app;
  // The simple shell has no broadcast panels. Wire the explainer overlay and nothing else;
  // SCR.story owns the rest of the page.
  if (!document.getElementById('bcast')) { U.simple = true; wireRegsOnly(); return; } A = app; wireEvents(); document.addEventListener('keydown', e => { if (e.target && (e.target.tagName === 'INPUT')) return; const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); A.paused = !A.paused; }
  else if (k === '[') A.speed = A.speed === 4 ? 2 : 1;
  else if (k === ']') A.speed = A.speed === 1 ? 2 : 4;
  else if (k >= '1' && k <= '5') { const list = camList(S()); if (list && list[+k - 1]) U.setCamera(list[+k - 1][0]); }
  else if (k === 'arrowright') { SCR.season && SCR.season.skipPhase(); }
  else if (k === 'g') { SCR.season && SCR.season.jump('garage'); }
  else if (k === 'r') toggleRegs();
  else if (k === 'c') U.cycleCamera(); });
  document.addEventListener('click', e => { if (e.target && e.target.id === 'regsClose') toggleRegs(); });
};
U.frame = function (dt) {
  if (U.simple) return;
  wireEvents(); const s = S();
  drawHeader(s); drawTower(s); drawStrip(s); drawTelemetry(s); drawChamp(s); drawChart(s); drawControls(s); drawGaragePanel(s); drawGarageOverlay(s); drawHud(s); drawCards(); void dt;
  const tk = $('ticker'); const msgs = s ? s.ticker.slice(-6) : ['STEWARDS: SESSION OPEN']; const text = msgs.join('  ··  ') + '  ··  '; if (tk.dataset.text !== text) { tk.dataset.text = text; tk.textContent = text; }
  const shift = Math.round((E.time * 40) % Math.max(400, tk.scrollWidth || 400)); tk.style.transform = `translateX(${-shift}px)`;
};
})(window.SCR = window.SCR || {});
