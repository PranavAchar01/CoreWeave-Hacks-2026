// ============================================================================
// SCR.dash — live telemetry.
//
// The other surface. Not a description of the agent: an instrument panel
// pointed at it while it runs. Everything here is fed by the same event stream
// that drives the broadcast, so on localhost it is a real season arriving lap
// by lap, and on the hosted build it is the recorded one replaying.
//
// Nine readings, one screen: the held-out score and where it is going, the laps
// as they land, the violation landscape eroding generation by generation in
// three dimensions, where the loop is in its cycle, the ten gates resolving,
// what each component has cost, and what the loop changed.
// ============================================================================
(function (SCR) {
'use strict';
const D = SCR.dash = {};
const NS = 'http://www.w3.org/2000/svg';
const $ = id => document.getElementById(id);
const esc = s => String(s === undefined || s === null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const el = (t, c, txt) => { const n = document.createElement(t); if (c) n.className = c;
  if (txt !== undefined) n.textContent = txt; return n; };
const svg = (tag, a, txt) => { const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(a || {})) n.setAttribute(k, String(v));
  if (txt !== undefined) n.textContent = txt; return n; };
const fx = v => (v === null || v === undefined || Number.isNaN(v)) ? '—' : v.toFixed(2);

const PHASES = ['RUN', 'SCORE', 'DIAGNOSE', 'SELECT', 'CHANGE', 'GATES', 'RESULT'];
const PHASE_NAME = { RUN: 'BUILD', SCORE: 'SCORE', DIAGNOSE: 'BLAME', SELECT: 'SELECT',
                     CHANGE: 'PROPOSE', GATES: 'CHECK', RESULT: 'PROMOTE' };
const COMPONENTS = [
  ['AERO', 'RETRIEVAL'], ['TYRES', 'SAMPLING'], ['POWER_UNIT', 'MODEL'],
  ['DATA', 'VERIFICATION'], ['SIMULATOR', 'CURRICULUM'], ['ENGINEER', 'PROPOSER'],
  ['STRATEGIST', 'BUDGET'], ['SCRUTINEER', 'AUDIT'], ['HISTORIAN', 'MEMORY'],
  ['PIT_CREW', 'DEPLOY'],
];
const WEIGHT = { critical: 10, serious: 5, moderate: 2, minor: 1 };

const st = {
  rounds: [], i: 0, live: { laps: [], gates: [], phase: null, gen: 0, score: null, clean: 0,
                            total: 20, credit: {}, change: null, result: null },
  on: false, raf: 0, spin: 0,
};

// ---------------------------------------------------------------------------------------
// derived series — all of it from the rounds the loop actually recorded
// ---------------------------------------------------------------------------------------
function ruleMatrix() {
  const rules = new Map(), totals = [];
  st.rounds.forEach((r, i) => {
    let tot = 0;
    for (const pg of r.pages || []) {
      for (const v of pg.rules || []) {
        const w = (WEIGHT[v.impact] || 1) * (v.n || 1);
        const row = rules.get(v.id) || new Array(st.rounds.length).fill(0);
        row[i] = (row[i] || 0) + w;
        rules.set(v.id, row);
        tot += w;
      }
    }
    totals.push(tot);
  });
  const ordered = [...rules.entries()]
    .sort((a, b) => b[1].reduce((x, y) => x + y, 0) - a[1].reduce((x, y) => x + y, 0))
    .slice(0, 9);
  return { rules: ordered, totals };
}

function creditByComponent() {
  const out = {};
  st.rounds.slice(0, st.i + 1).forEach(r => {
    for (const [role, s] of Object.entries(r.standings || {})) {
      out[role] = (out[role] || 0) + (s.blame_s || 0);
    }
  });
  for (const [role, s] of Object.entries(st.live.credit)) out[role] = (out[role] || 0) + s;
  return out;
}

function levelsAt(i) {
  const lv = {};
  for (const [role] of COMPONENTS) lv[role] = 1;
  st.rounds.slice(0, i + 1).forEach(r => { if (r.promoted && r.role) lv[r.role] = (lv[r.role] || 1) + 1; });
  return lv;
}

// ---------------------------------------------------------------------------------------
// [1] the violation landscape, in three dimensions, eroding as the season runs
// ---------------------------------------------------------------------------------------
const ISO = { cos: Math.cos(Math.PI / 6), sin: Math.sin(Math.PI / 6) };

function landscape(cv) {
  const ctx = cv.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.clientWidth, H = cv.clientHeight;
  if (!W || !H) return;
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const css = getComputedStyle(document.documentElement);
  const g = (n, d) => (css.getPropertyValue(n).trim() || d);
  const rule = g('--d-hair', '#DFE3E8'), mute = g('--d-mute', '#6E7580');
  const accent = g('--d-accent', '#0F62FE'), ink = g('--d-ink', '#0E1116');

  const { rules } = ruleMatrix();
  const gens = st.rounds.length;
  if (!rules.length || !gens) {
    ctx.fillStyle = mute; ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.fillText('waiting for the first audited run', 16, H / 2);
    return;
  }
  const peak = Math.max(1, ...rules.flatMap(([, row]) => row));
  const nx = gens, ny = rules.length;
  const sway = Math.sin(st.spin * 0.0007) * 0.16;          // a slow breath, not a spin

  // The footprint hangs down and to both sides from the origin, and the columns rise out of it.
  // Fit the footprint to the width first, then give whatever vertical room is left to the bars,
  // so a tall peak never climbs off the top of the card.
  const padX = 112, padTop = 30, padBot = 34;              // padX leaves the rule names room
  const cell = Math.max(6, Math.min((W - padX * 2) / ((nx + ny) * ISO.cos),
                                    (H - padTop - padBot) * 0.52 / ((nx + ny) * ISO.sin)));
  const footH = (nx + ny) * ISO.sin * cell;
  const zUnit = Math.max(0.5, Math.min(96, H - padTop - padBot - footH)) / peak;

  const P = (x, y, z) => {
    const c = Math.cos(sway), s = Math.sin(sway);
    const rx = x * c - y * s, ry = x * s + y * c;
    return [(rx - ry) * ISO.cos * cell, (rx + ry) * ISO.sin * cell - z * zUnit];
  };

  ctx.save();
  // origin sits high enough that the deepest corner lands just above the caption
  ctx.translate(W / 2 + 26, H - padBot - footH);

  // ground lattice
  ctx.strokeStyle = rule; ctx.lineWidth = 1;
  for (let x = 0; x <= nx; x++) {
    const a = P(x, 0, 0), b = P(x, ny, 0);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  for (let y = 0; y <= ny; y++) {
    const a = P(0, y, 0), b = P(nx, y, 0);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }

  // columns, painted back to front so the near ones occlude
  const cols = [];
  rules.forEach(([id, row], y) => {
    row.forEach((v, x) => { if (v > 0 && x < gens) cols.push({ x, y, v, id }); });
  });
  cols.sort((a, b) => (a.x + a.y) - (b.x + b.y));
  for (const c of cols) {
    const now = c.x === st.i, past = c.x < st.i;
    const h = c.v;
    const p = (dx, dy, z) => P(c.x + dx, c.y + dy, z);
    const top = [p(0.08, 0.08, h), p(0.92, 0.08, h), p(0.92, 0.92, h), p(0.08, 0.92, h)];
    const lf = [p(0.08, 0.92, h), p(0.92, 0.92, h), p(0.92, 0.92, 0), p(0.08, 0.92, 0)];
    const rt = [p(0.92, 0.08, h), p(0.92, 0.92, h), p(0.92, 0.92, 0), p(0.92, 0.08, 0)];
    const a = now ? 1 : past ? 0.34 : 0.62;
    const paint = (pts, fill) => {
      ctx.beginPath(); pts.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
      ctx.strokeStyle = now ? accent : rule; ctx.lineWidth = now ? 1.1 : 0.6; ctx.stroke();
    };
    paint(lf, now ? `rgba(11,77,193,${a})` : `rgba(150,164,180,${a * 0.55})`);
    paint(rt, now ? `rgba(8,60,155,${a})` : `rgba(128,142,158,${a * 0.55})`);
    paint(top, now ? `rgba(64,140,255,${a})` : `rgba(186,198,212,${a * 0.6})`);
  }

  // axis labels
  ctx.font = '9px "IBM Plex Mono", monospace';
  ctx.fillStyle = mute; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  rules.forEach(([id], y) => {
    const q = P(-1.15, y + 0.5, 0);              // one cell clear of the grid, not inside it
    ctx.fillText(id.length > 17 ? id.slice(0, 16) + '…' : id, q[0], q[1]);
  });
  ctx.textAlign = 'center';
  for (let x = 0; x < nx; x += Math.ceil(nx / 8)) {
    const q = P(x + 0.5, ny, 0);
    ctx.fillText(String(x + 1), q[0] + 11, q[1] + 12);
  }
  ctx.restore();

  ctx.textAlign = 'left'; ctx.fillStyle = mute; ctx.font = '9.5px "IBM Plex Mono", monospace';
  ctx.fillText('WEIGHTED VIOLATIONS · RULE × GENERATION · peak ' + peak, 14, 18);
  ctx.fillStyle = ink;
  ctx.fillText('the landscape erodes as the harness learns', 14, H - 12);
}

// ---------------------------------------------------------------------------------------
// [2] score trace
// ---------------------------------------------------------------------------------------
function trace() {
  const pts = st.rounds.filter(r => typeof r.official_s === 'number');
  const host = $('dTrace'); if (!host) return;
  host.textContent = '';
  if (pts.length < 2) { host.append(el('p', 'd-empty', 'two runs needed before there is a trend')); return; }
  const W = 560, H = 132, L = 34, R = 10, T = 12, B = 18;
  const vals = pts.flatMap(r => [r.official_s, r.claimed_s]).filter(v => typeof v === 'number');
  const lo = Math.min(...vals) - 1, hi = Math.max(...vals) + 1;
  const x = i => L + (i / (pts.length - 1)) * (W - L - R);
  const y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo || 1));
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'd-svg', role: 'img',
                         'aria-label': 'held-out score per generation' });
  for (let k = 0; k <= 3; k++) {
    const v = lo + (hi - lo) * k / 3;
    s.append(svg('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'd-grid' }));
    s.append(svg('text', { x: L - 5, y: y(v) + 3, class: 'd-ax', 'text-anchor': 'end' }, v.toFixed(0)));
  }
  const path = k => pts.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r[k]).toFixed(1)}`).join('');
  const area = `${path('official_s')}L${x(pts.length - 1).toFixed(1)},${H - B}L${L},${H - B}Z`;
  s.append(svg('path', { d: area, class: 'd-area' }));
  s.append(svg('path', { d: path('claimed_s'), class: 'd-l2' }));
  s.append(svg('path', { d: path('official_s'), class: 'd-l1' }));
  pts.forEach((r, i) => {
    if (r.promoted) s.append(svg('line', { x1: x(i), x2: x(i), y1: T, y2: H - B, class: 'd-keep' }));
    s.append(svg('circle', { cx: x(i), cy: y(r.official_s), r: i === st.i ? 4 : 2.2,
                             class: 'd-dot' + (r.promoted ? ' keep' : '') + (i === st.i ? ' now' : '') }));
  });
  host.append(s);
}

// ---------------------------------------------------------------------------------------
// [3] laps, [4] gates, [5] phase ring, [6] components, [7] header
// ---------------------------------------------------------------------------------------
function laps() {
  const host = $('dLaps'); if (!host) return;
  const r = st.rounds[st.i] || {};
  const done = st.live.laps.length ? st.live.laps
    : (r.pages || []).map(p => ({ passed: p.passed, title: p.title, family: p.family,
                                  weighted: p.weighted }));
  const total = Math.max(st.live.total || 0, done.length, 20);
  host.textContent = '';
  for (let k = 0; k < total; k++) {
    const d = done[k];
    const n = el('i', 'd-cell' + (d ? (d.passed ? ' ok' : ' no') : ''));
    if (d) n.title = `${d.title || d.family || ''} · ${d.passed ? 'clean' : (d.weighted || 0) + ' pts'}`;
    host.append(n);
  }
  const clean = done.filter(d => d.passed).length;
  const meta = $('dLapMeta');
  if (meta) meta.textContent = `${clean} clean · ${done.length} of ${total}`;
}

function gates() {
  const host = $('dGates'); if (!host) return;
  const r = st.rounds[st.i] || {};
  const rows = st.live.gates.length ? st.live.gates : (r.gates || []);
  host.textContent = '';
  // A season recorded before the ladder existed has no row for it, and the chip stays unlit rather
  // than claiming a pass that was never judged.
  const NAMES = ['diff_size', 'comparable_ab', 'novelty', 'evidence', 'seesaw', 'ladder', 'correlation',
                 'regression', 'cost_cap', 'scrutineering', 'rl_entropy'];
  for (const name of NAMES) {
    const g = rows.find(x => x.gate === name);
    const n = el('div', 'd-gate' + (g ? (g.ok ? ' ok' : ' no') : ''));
    n.innerHTML = `<i></i><span>${esc(name)}</span>`;
    host.append(n);
  }
}

function ring() {
  const host = $('dRing'); if (!host) return;
  host.textContent = '';
  const S = 118, c = S / 2, rad = 44;
  const s = svg('svg', { viewBox: `0 0 ${S} ${S}`, class: 'd-ring', role: 'img',
                         'aria-label': 'where the loop is in its cycle' });
  const idx = PHASES.indexOf(st.live.phase);
  s.append(svg('circle', { cx: c, cy: c, r: rad, class: 'd-ring-track', fill: 'none' }));
  const circ = 2 * Math.PI * rad;
  const f = idx < 0 ? 0 : (idx + 1) / PHASES.length;
  s.append(svg('circle', { cx: c, cy: c, r: rad, fill: 'none', class: 'd-ring-live',
                           transform: `rotate(-90 ${c} ${c})`,
                           'stroke-dasharray': `${(circ * f).toFixed(1)} ${circ.toFixed(1)}` }));
  PHASES.forEach((p, k) => {
    const a = -Math.PI / 2 + (k / PHASES.length) * Math.PI * 2;
    s.append(svg('circle', { cx: c + Math.cos(a) * rad, cy: c + Math.sin(a) * rad, r: k === idx ? 4.2 : 2.4,
                             class: 'd-node' + (k === idx ? ' on' : k < idx ? ' done' : '') }));
  });
  s.append(svg('text', { x: c, y: c - 2, class: 'd-ring-t', 'text-anchor': 'middle' },
               PHASE_NAME[st.live.phase] || 'IDLE'));
  s.append(svg('text', { x: c, y: c + 12, class: 'd-ring-s', 'text-anchor': 'middle' },
               idx < 0 ? '' : `${idx + 1} of ${PHASES.length}`));
  host.append(s);
}

function components() {
  const host = $('dComp'); if (!host) return;
  const credit = creditByComponent();
  const lv = levelsAt(st.i);
  const peak = Math.max(1, ...Object.values(credit));
  const active = (st.rounds[st.i] || {}).role || st.live.change;
  host.textContent = '';
  for (const [role, name] of COMPONENTS) {
    const v = credit[role] || 0;
    const row = el('div', 'd-comp' + (role === active ? ' on' : ''));
    row.innerHTML = `<span class="d-cn">${esc(name)}</span>`
      + `<span class="d-bar"><i style="width:${(100 * v / peak).toFixed(1)}%"></i></span>`
      + `<span class="d-cv">${v ? v.toFixed(0) + 's' : '·'}</span>`
      + `<span class="d-lv">L${lv[role] || 1}</span>`;
    host.append(row);
  }
}

function header() {
  const r = st.rounds[st.i] || {};
  const prev = st.i > 0 ? st.rounds[st.i - 1] : null;
  const score = st.live.score !== null && st.live.score !== undefined ? st.live.score : r.official_s;
  const first = st.rounds.length ? st.rounds[0].official_s : null;
  const set = (id, v) => { const n = $(id); if (n) n.textContent = v; };
  set('dGen', String(st.live.gen || st.i + 1));
  set('dOf', st.rounds.length ? `of ${st.rounds.length}` : '');
  set('dScore', fx(score));
  set('dPhase', PHASE_NAME[st.live.phase] || 'IDLE');
  const d = prev && typeof score === 'number' ? prev.official_s - score : 0;
  const dn = $('dDelta');
  if (dn) {
    dn.textContent = Math.abs(d) < 0.005 ? 'unchanged' : `${d > 0 ? '−' : '+'}${Math.abs(d).toFixed(2)}s`;
    dn.className = 'd-delta ' + (d > 0.005 ? 'good' : d < -0.005 ? 'bad' : '');
  }
  set('dTotal', first !== null && typeof score === 'number'
    ? `${(first - score) >= 0 ? '−' : '+'}${Math.abs(first - score).toFixed(2)}s since gen 1` : '');
  set('dKept', `${st.rounds.filter(x => x.promoted).length} kept`);
  const badge = $('dMode');
  if (badge) {
    badge.textContent = st.liveRails ? 'LIVE RAILS' : 'REPLAY';
    badge.className = 'd-mode' + (st.liveRails ? ' on' : '');
  }
}

function change() {
  const host = $('dChange'); if (!host) return;
  const r = st.rounds[st.i] || {};
  const res = st.live.result;
  const promoted = res ? res.promoted : r.promoted;
  const role = (res && res.role) || r.role;
  const part = (res && res.part) || r.part;
  const name = (COMPONENTS.find(c => c[0] === role) || [null, role || '—'])[1];
  host.className = 'd-change' + (promoted ? ' kept' : res || r.gates ? ' dropped' : '');
  host.innerHTML = `<span class="d-ck">${promoted ? 'KEPT' : (res || (r.gates || []).length) ? 'DISCARDED' : 'PENDING'}</span>`
    + `<b>${esc(name)}</b>${part ? `<code>${esc(part)}</code>` : ''}`
    + `<span class="d-cs">${esc(r.diff_summary || (st.live.change || ''))}</span>`;
}

function paint() { header(); trace(); laps(); gates(); ring(); components(); change(); }

/** The outside check: the same harness measured on a benchmark this project did not write,
 *  graded by tests it did not write. Rendered from state/bcb_compare.json, sign included. */
function benchCard() {
  const B = window.SCRUTINEER_BCB;
  if (!B || !B.baseline || !B.loop) return '';
  const a = B.baseline, b = B.loop;
  const S = window.SCRUTINEER_BCB_SCALING, V = window.SCRUTINEER_VERDICT;
  const R = B.resolution || null;
  // Colour is a claim. A difference the comparison could not resolve is drawn neutral, whichever
  // way the point estimate leans — red for an unresolved dip reads as a measured regression.
  const tone = (r, delta) => (!r || !r.resolved) ? 'even' : delta < 0 ? 'worse' : 'better';
  const pct = v => (v * 100).toFixed(1) + '%';
  const row = (label, d, cls) =>
    `<div class="bq-row ${cls}"><span class="bq-l">${esc(label)}</span>`
    + `<span class="bq-bar"><i style="width:${(d.pass_at_1 * 100).toFixed(1)}%"></i></span>`
    + `<b>${pct(d.pass_at_1)}</b><span class="bq-n">${d.solved}/${d.n || B.n}</span></div>`;
  const vsScale = V && V.loop_vs_scaling;
  const t = tone(R, B.delta_pp);
  return `
    <section class="d-card">
      <h3>OUTSIDE CHECK<em>${esc(B.benchmark)} · held-out, never raced</em></h3>
      <div class="bq">
        ${row('harness it starts with', a, 'base')}
        ${S ? row('same harness, one more draw', S, tone(V && V.scaling_vs_baseline, (V && V.scaling_vs_baseline || {}).delta_pp)) : ''}
        ${row('harness the loop kept', b, t)}
        <div class="bq-foot">
          <span class="bq-delta ${t}">${B.delta_pp >= 0 ? '+' : ''}${B.delta_pp.toFixed(1)} pts</span>
          <span>n = ${B.n}</span>
          <span>McNemar p = ${B.p_two_sided}</span>
          <span>+${B.fixed.length} / −${B.broken.length}</span>
          ${R && R.mde_pp != null ? `<span>detects ≥ ${R.mde_pp} pts</span>` : ''}
          ${R && R.n_star != null ? `<span>needs n = ${R.n_star}</span>` : ''}
        </div>
        <p class="bq-read">${esc(V ? V.headline : (R ? R.claim : ''))}${
          vsScale ? ' · against one more draw: ' + esc(vsScale.claim) : ''}</p>
        ${R && !R.resolved ? `<p class="bq-read">This comparison cannot resolve a difference smaller than
          ${R.mde_pp} points, and it observed ${Math.abs(B.delta_pp).toFixed(1)}. The honest reading is
          <b>unresolved</b> — not a regression, not a null.</p>` : ''}
      </div>
    </section>`;
}

// ---------------------------------------------------------------------------------------
D.build = function () {
  const host = $('dash'); if (!host) return;
  const L = window.SCRUTINEER_LOOP || {};
  st.rounds = (L.rounds || []).slice();
  st.i = 0;
  host.innerHTML = `
<div class="d-wrap">
  <header class="d-top">
    <span class="d-mark">SCRUTINEER</span><span class="d-sub">TELEMETRY</span>
    <span class="d-stat"><em>GENERATION</em><b id="dGen">1</b><i id="dOf"></i></span>
    <span class="d-stat"><em>PHASE</em><b id="dPhase">IDLE</b></span>
    <span class="d-stat wide"><em>HELD-OUT SCORE</em><b id="dScore">—</b>
      <i class="d-delta" id="dDelta"></i></span>
    <span class="d-stat"><em>SEASON</em><b id="dTotal"></b><i id="dKept"></i></span>
    <span class="d-mode" id="dMode">REPLAY</span>
    <button class="d-back" id="dBack">← TRACK</button>
  </header>

  <div class="d-grid">
    <section class="d-card span2 tall">
      <h3>VIOLATION LANDSCAPE<em>every audited page, by rule, over the season</em></h3>
      <canvas id="dLand" class="d-land"></canvas>
    </section>

    <section class="d-card">
      <h3>SCORE TRACE<em>solid held-out · dashed practice · rule = kept</em></h3>
      <div id="dTrace"></div>
    </section>

    <section class="d-card">
      <h3>LAPS<em id="dLapMeta"></em></h3>
      <div class="d-cells" id="dLaps"></div>
    </section>

    <section class="d-card narrow">
      <h3>CYCLE</h3>
      <div id="dRing"></div>
    </section>

    <section class="d-card span2">
      <h3>GATES<em>all eleven, in order, first failure stops it</em></h3>
      <div class="d-gates" id="dGates"></div>
    </section>

    ${benchCard()}

    <section class="d-card span2">
      <h3>COMPONENTS<em>seconds of confirmed credit · level = times changed</em></h3>
      <div class="d-comps" id="dComp"></div>
      <div class="d-change" id="dChange"></div>
    </section>
  </div>
</div>`;
  const back = $('dBack');
  if (back) back.addEventListener('click', () => { const t = $('tabTrack'); if (t) t.click(); });
  paint();
};

D.show = function () {
  st.on = true;
  const cv = $('dLand');
  const loop = () => {
    if (!st.on) return;
    st.spin += 16;
    if (cv) landscape(cv);
    st.raf = requestAnimationFrame(loop);
  };
  cancelAnimationFrame(st.raf);
  paint();
  loop();
  window.addEventListener('resize', paint);
};

D.hide = function () { st.on = false; cancelAnimationFrame(st.raf); };

/** The one door in. Everything the broadcast learns, the panel learns. */
D.on = function (kind, d) {
  const L = st.live;
  if (kind === 'boot') { st.liveRails = true; return; }
  if (kind === 'run') {
    L.laps = []; L.gates = []; L.credit = {}; L.score = null; L.change = null; L.result = null;
    L.gen = d.gen; st.i = Math.max(0, Math.min(st.rounds.length - 1, d.gen - 1));
  } else if (kind === 'phase') {
    L.phase = d.phase;
    // a seek can land mid-generation without a fresh run event, so trust the phase's own number
    if (d.gen) { L.gen = d.gen; st.i = Math.max(0, Math.min(st.rounds.length - 1, d.gen - 1)); }
  } else if (kind === 'lap') {
    L.laps.push(d); L.total = d.total || L.total;
  } else if (kind === 'score') {
    L.score = d.official; L.clean = d.clean; L.total = d.total || L.total;
  } else if (kind === 'replay') {
    if (d.role) L.credit[d.role] = (L.credit[d.role] || 0) + (d.credit || 0);
  } else if (kind === 'gate') {
    L.gates.push(d);
  } else if (kind === 'change') {
    L.change = d.summary || `diff to ${d.role}`;
  } else if (kind === 'result') {
    L.result = d;
    if (st.liveRails) {
      st.rounds = st.rounds.concat([{
        generation: st.rounds.length, official_s: L.score, claimed_s: L.score,
        promoted: !!d.promoted, role: d.role || null, part: d.part || null,
        pages: L.laps.map(x => ({ passed: x.passed, title: x.title, family: x.family,
                                  weighted: x.weighted, rules: (x.rules || []).map(r =>
                                    (typeof r === 'string' ? { id: r, impact: 'serious', n: 1 } : r)) })),
        gates: L.gates.slice(), standings: L.credit && Object.keys(L.credit).length
          ? Object.fromEntries(Object.entries(L.credit).map(([k, v]) => [k, { n: 1, blame_s: v }])) : {},
        diff_series: null,
      }]);
      st.i = st.rounds.length - 1;
    }
  }
  if (st.on) paint();
};

D.COMPONENTS = COMPONENTS;
})(window.SCR = window.SCR || {});
