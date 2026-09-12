// ============================================================================
// Scrutineer telemetry — the season as flat, vector instrument graphics.
//
// Five questions, one chart each: how a run works (the loop as a ring, with what the selected run
// did at every step), whether it is getting faster (the held-out lap), what it built (an audit
// matrix of every page), which part changed (a radial of component levels and blame), and whether
// it holds up on a public benchmark it did not write (pass-rate gauges, every task, and where the
// difference sits against what the test can detect). One scrubber picks the run for all of them.
//
// Plain SVG and CSS, no libraries and nothing fetched: it renders from the bundle inlined in the
// page, or from a live `scrutineer watch` event stream when this page is served by one. There is no
// car and no track here — those belong to the broadcast and the pit board, in their own pixels.
// ============================================================================
(function () {
'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const num = v => typeof v === 'number' && isFinite(v);
const fmt = (v, d = 2) => num(v) ? v.toFixed(d) : '—';
const pct = v => num(v) ? (v * 100).toFixed(1) : '—';
const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const C = { lime: '#D4FF3A', mint: '#34F5B0', coral: '#FF5A6E', slate: '#8A96A0', amber: '#FFB547', violet: '#A796FF', ice: '#CFEFFF',
  text: '#E6EDF1', mute: '#7F8C95', dim: '#4E5A62', line: 'rgba(150,180,190,.13)', line2: 'rgba(150,180,190,.26)', bg: '#07090B' };
const VC = { keep: C.mint, drop: C.coral, none: C.slate };

const ROLE_KEYS = ['AERO', 'DATA', 'TYRES', 'POWER_UNIT', 'STRATEGIST', 'SIMULATOR', 'PIT_CREW', 'ENGINEER', 'SCRUTINEER', 'HISTORIAN'];
const CORE = ['AERO', 'POWER_UNIT', 'TYRES', 'DATA', 'SIMULATOR', 'ENGINEER'], SUPPORT = ['STRATEGIST', 'SCRUTINEER', 'HISTORIAN', 'PIT_CREW'];
const NAME = { AERO: 'RETRIEVAL', DATA: 'VERIFICATION', TYRES: 'SAMPLING', POWER_UNIT: 'MODEL', STRATEGIST: 'BUDGET',
  SIMULATOR: 'CURRICULUM', PIT_CREW: 'DEPLOY', ENGINEER: 'PROPOSER', SCRUTINEER: 'AUDIT', HISTORIAN: 'MEMORY' };
// what each component decides — the broadcast's regulations use the same words
const JOB = { AERO: 'context assembly', POWER_UNIT: 'inference', TYRES: 'decode policy', DATA: 'pre-submit audit',
  SIMULATOR: 'task selection', ENGINEER: 'patch synthesis', STRATEGIST: 'stop policy', SCRUTINEER: 'tamper check',
  HISTORIAN: 'trace compaction', PIT_CREW: 'install and smoke' };
const WHY = { seesaw: 'the two splits disagreed', regression: 'it made the harness slower', cost_cap: 'over the cost cap',
  scrutineering: 'black-flagged by the audit', diff_size: 'too big a change', comparable_ab: 'the A/B was not comparable',
  novelty: 'nothing new in it', evidence: 'not enough evidence', correlation: 'the splits did not track',
  ladder: "inside the sealed split's own noise", rl_entropy: 'the model collapsed', 'debrief gate': 'the debrief did not clear' };
const GATE = { diff_size: 'diff size', comparable_ab: 'comparable A/B', novelty: 'novelty', evidence: 'evidence', seesaw: 'seesaw',
  ladder: 'ladder', correlation: 'correlation', regression: 'regression', cost_cap: 'cost cap', scrutineering: 'scrutineering', rl_entropy: 'RL entropy' };
const RULE = { gain_per_usd: 'by expected gain per dollar', no_upgrade: 'no candidate had enough evidence', circuit: 'it rebuilt the practice set instead' };

// ============================================================================
// The season: recorded, or live from a `scrutineer watch` server on this origin
// ============================================================================
const LOOP = window.SCRUTINEER_LOOP || {};
const BCB = window.SCRUTINEER_BCB || null, VERDICT = window.SCRUTINEER_VERDICT || null;
const normalize = r => ({
  generation: r.generation, promoted: !!r.promoted, role: r.role || null, part: r.part || null,
  rule_fired: r.rule_fired || null, official_s: r.official_s, claimed_s: r.claimed_s,
  gates: r.gates || [], pages: r.pages || [], standings: r.standings || {}, summary: r.diff_summary || '',
  cost: r.cost_usd, failed: [...(r.gates || []).filter(g => !g.ok).map(g => g.gate), ...(r.failed || [])],
});
const verdictOf = r => r.promoted ? 'keep' : (r.rule_fired === 'no_upgrade' || r.rule_fired === 'circuit') ? 'none' : 'drop';
const verdictWord = v => v === 'keep' ? 'Kept' : v === 'drop' ? 'Refused' : 'No change';
const ruleId = x => typeof x === 'string' ? x : x && x.id;
const S = { source: 'replay', demo: !!LOOP.demo, all: (LOOP.rounds || []).map(normalize), phase: null, busy: false, live: null, seenSeq: 0, linkDown: false };
const V = { station: 'loop', sel: Math.max(0, S.all.length - 1), playing: false, playAt: 0, W: 0, H: 0 };
function levelsAfter(n) {
  const lv = Object.fromEntries(ROLE_KEYS.map(k => [k, 1]));
  S.all.slice(0, n).forEach(r => { if (r.promoted && r.role && lv[r.role] !== undefined) lv[r.role]++; });
  return lv;
}

async function detectLive() {
  if (location.protocol !== 'http:' || new URLSearchParams(location.search).get('source') === 'replay') return false;
  try {
    const r = await fetch('/api/state', { cache: 'no-store', signal: AbortSignal.timeout(1500) });
    if (!r.ok) return false; const s = await r.json(); if (!s || !s.live) return false;
    S.source = 'live'; S.all = []; S.busy = !!s.busy;
    const es = new EventSource('/api/events'); let warm = true, t = 0;
    const settle = () => { clearTimeout(t); t = setTimeout(() => { warm = false; select(S.all.length - 1); }, 700); };
    es.onmessage = ev => { let d; try { d = JSON.parse(ev.data); } catch (e) { return; }
      if (d.seq !== undefined) { if (d.seq <= S.seenSeq) return; S.seenSeq = d.seq; }
      if (warm) settle(); onLive(d, !warm); };
    es.onopen = () => { if (!S.linkDown) return; S.linkDown = false; S.seenSeq = 0; S.all = []; S.live = null; warm = true; settle(); };
    es.onerror = () => { S.linkDown = true; paintSource(); };
    settle();
    return true;
  } catch (e) { return false; }
}
// A run's record, assembled from its events and keyed by the generation they name, so a result can
// only ever land on the run it belongs to.
function onLive(d, fresh) {
  const rec = () => {
    if (!S.live || S.live.generation !== d.generation) S.live = { generation: d.generation, gates: [], pages: [], standings: {}, diff_summary: '' };
    return S.live;
  };
  if (d.kind === 'phase') { S.phase = d.phase; S.busy = true; if (d.phase === 'RUN') { S.live = null; rec(); } }
  else if (d.kind === 'score') { const L = rec(); L.claimed_s = d.claimed; L.official_s = d.official; L.pages = d.pages || []; }
  else if (d.kind === 'blame') rec().standings = d.standings || {};
  else if (d.kind === 'gate') rec().gates.push({ gate: d.gate, ok: !!d.ok, detail: d.detail || '' });
  else if (d.kind === 'change') rec().diff_summary = d.summary || '';
  else if (d.kind === 'result') {
    const r = normalize({ ...rec(), promoted: d.promoted, role: d.role, part: d.part, rule_fired: d.rule || null, failed: d.failed || [] });
    const at = S.all.findIndex(x => x.generation === r.generation);
    if (at >= 0) S.all[at] = r; else S.all.push(r);
    S.live = null; S.busy = false; S.phase = null;
    if (fresh) select(S.all.length - 1); else V.sel = S.all.length - 1;
    return;
  } else if (d.kind === 'error' || d.kind === 'boot') S.busy = d.kind === 'boot';
  if (fresh && V.station === 'loop') render(false);
}

// ============================================================================
// SVG vocabulary
// ============================================================================
const attrs = o => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== false).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
const el = (tag, o = {}, inner) => inner === undefined ? `<${tag}${attrs(o)}/>` : `<${tag}${attrs(o)}>${inner}</${tag}>`;
const n1 = v => +(+v).toFixed(1);
// fill and type settings go in the style, where the stylesheet's defaults cannot override them
const text = (x, y, s, o = {}) => {
  const { fill, 'font-size': fs, 'font-weight': fw, 'letter-spacing': ls, style, ...rest } = o;
  const css = [fill && `fill:${fill}`, fs && `font-size:${fs}px`, fw && `font-weight:${fw}`, ls && `letter-spacing:${ls}`, style].filter(Boolean).join(';');
  return el('text', { x: n1(x), y: n1(y), ...rest, style: css || undefined }, esc(s));
};
const polar = (cx, cy, r, deg) => { const a = deg * Math.PI / 180; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
function wedge(cx, cy, r0, r1, a0, a1) {
  const [x0, y0] = polar(cx, cy, r1, a0), [x1, y1] = polar(cx, cy, r1, a1), [x2, y2] = polar(cx, cy, r0, a1), [x3, y3] = polar(cx, cy, r0, a0);
  const big = a1 - a0 > 180 ? 1 : 0;
  return `M${n1(x0)},${n1(y0)}A${n1(r1)},${n1(r1)} 0 ${big} 1 ${n1(x1)},${n1(y1)}L${n1(x2)},${n1(y2)}A${n1(r0)},${n1(r0)} 0 ${big} 0 ${n1(x3)},${n1(y3)}Z`;
}
function arc(cx, cy, r, a0, a1) {
  const [x0, y0] = polar(cx, cy, r, a0), [x1, y1] = polar(cx, cy, r, a1);
  return `M${n1(x0)},${n1(y0)}A${n1(r)},${n1(r)} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${n1(x1)},${n1(y1)}`;
}
const niceStep = raw => { const p = Math.pow(10, Math.floor(Math.log10(raw || 1))), f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; };
const DEFS = `<defs>
  <filter id="g1" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="g2" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.ice}" stop-opacity=".2"/><stop offset=".75" stop-color="${C.ice}" stop-opacity=".03"/><stop offset="1" stop-color="${C.ice}" stop-opacity="0"/></linearGradient>
  <linearGradient id="band" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.lime}" stop-opacity="0"/><stop offset=".5" stop-color="${C.lime}" stop-opacity=".08"/><stop offset="1" stop-color="${C.lime}" stop-opacity=".02"/></linearGradient>
  <radialGradient id="core"><stop offset="0" stop-color="${C.lime}" stop-opacity=".14"/><stop offset="1" stop-color="${C.lime}" stop-opacity="0"/></radialGradient>
  <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.6" height="5" fill="${C.coral}" fill-opacity=".7"/></pattern>
</defs>`;
const head = (kicker, title, kpis) => `<h1><small>${esc(kicker)}</small>${esc(title)}</h1><div class="tx-kpis">${kpis.map(([k, v, cls, unit]) =>
  `<div class="tx-kpi"><span>${esc(k)}</span><b class="${cls || ''}">${esc(v)}${unit ? `<em>${esc(unit)}</em>` : ''}</b></div>`).join('')}</div>`;
const emptyChart = msg => text(V.W / 2, V.H / 2, msg, { 'text-anchor': 'middle', class: 't-ui', fill: C.mute, 'font-size': 14 });

// ============================================================================
// How does a run work? The loop as a ring, with the selected run's own output at every step.
// ============================================================================
const PHASES = [
  { id: 'Build', live: 'RUN', say: 'It builds 20 web interfaces from written briefs. Every one is a real page.' },
  { id: 'Score', live: 'SCORE', say: 'Every page is audited and timed: on its own practice split, and on a split it never sees.' },
  { id: 'Blame', live: 'DIAGNOSE', say: 'Each failing page is traced back to the component that caused it.' },
  { id: 'Select', live: 'SELECT', say: 'The loop picks one component to change, by the gain it expects per dollar.' },
  { id: 'Propose', live: 'CHANGE', say: 'That component writes a change to itself.' },
  { id: 'Check', live: 'GATES', say: 'Gates check the change before it can count: size, novelty, evidence, regression, cost.' },
  { id: 'Decide', live: 'RESULT', say: 'Kept only if every gate clears. Otherwise the harness stays exactly as it was.' },
];
// what the run produced at each step: a line of text, and for some steps a small instrument
function loopCards(r) {
  if (!r) return PHASES.map(() => ({ txt: 'waiting for a run', extra: '' }));
  const passed = r.pages.filter(p => p.passed).length, ok = r.gates.filter(g => g.ok).length, v = verdictOf(r);
  const top = Object.entries(r.standings || {}).filter(([, x]) => x && x.n).sort((a, b) => b[1].n - a[1].n)[0];
  return [
    { txt: `${r.pages.length} pages · ${passed} passed`, extra: r.pages.length ? `<div class="bar"><i style="width:${(passed / r.pages.length * 100).toFixed(0)}%"></i></div>` : '' },
    { txt: `held-out ${fmt(r.official_s)} s · its own ${fmt(r.claimed_s)} s`, extra: '' },
    { txt: top ? `${NAME[top[0]] || top[0]} · ${top[1].n} failing` : 'nothing blamed', extra: '' },
    { txt: r.role ? `${NAME[r.role]} · ${RULE[r.rule_fired] || r.rule_fired || ''}` : RULE[r.rule_fired] || 'no component picked', extra: '' },
    { txt: r.summary ? `“${r.summary}”` : 'nothing proposed', extra: '' },
    { txt: r.gates.length ? `${ok} of ${r.gates.length} cleared` : 'no gates ran', extra: r.gates.length ? `<div class="pips">${r.gates.map(g => `<i class="${g.ok ? '' : 'bad'}"></i>`).join('')}</div>` : '' },
    { txt: v === 'keep' ? `${NAME[r.role]} moved up a level` : v === 'drop' ? WHY[r.failed[0]] || r.failed[0] || 'its gates threw it out' : 'the harness stays as it was', extra: '', cls: v === 'none' ? '' : v, tag: verdictWord(v) },
  ];
}
// a phone: the same seven steps as a vertical rail, which reads where a ring of cards would not
function drawLoopRail(r, liveAt) {
  const W = V.W, H = V.H, cards = loopCards(r), rowH = Math.min(64, (H - 16) / PHASES.length), x = 22, v = r ? verdictOf(r) : 'none';
  let s = el('line', { x1: x, x2: x, y1: 8 + rowH / 2, y2: n1(8 + rowH * (PHASES.length - 0.5)), stroke: C.line2 });
  PHASES.forEach((p, i) => {
    const y = 8 + rowH * (i + 0.5), now = i === liveAt, decide = i === PHASES.length - 1 && r, col = now ? C.lime : decide ? VC[v] : C.ice;
    s += el('circle', { cx: x, cy: n1(y), r: 12, fill: C.bg, stroke: col, 'stroke-width': 1.5, filter: now || decide ? 'url(#g1)' : null, class: 'pop', style: `--i:${i}`, 'data-step': i });
    s += text(x, y + 4, `0${i + 1}`, { 'text-anchor': 'middle', 'font-size': 9, fill: col, style: 'pointer-events:none' });
    s += text(x + 24, y - 5, `${p.id.toUpperCase()}${cards[i].tag ? ` · ${cards[i].tag.toUpperCase()}` : ''}`, { 'font-size': 10, 'letter-spacing': '.12em', fill: now ? C.lime : decide ? col : C.mute });
    const t = cards[i].txt, max = Math.floor((W - x - 30) / 6.6);
    s += text(x + 24, y + 11, t.length > max ? t.slice(0, max - 1) + '…' : t, { class: 't-ui', 'font-size': 12, fill: C.text });
  });
  return s;
}
function drawLoop() {
  const W = V.W, H = V.H, r = S.all[V.sel], title = 'How does a run work?';
  const passed = r ? r.pages.filter(p => p.passed).length : 0;
  const kpis = r ? [['Pages built', `${passed}/${r.pages.length}`, '', 'passed'], ['Held-out lap', fmt(r.official_s), '', 's'],
    ['Gates', r.gates.length ? `${r.gates.filter(g => g.ok).length}/${r.gates.length}` : '—', ''], ['Outcome', verdictWord(verdictOf(r)), verdictOf(r) === 'keep' ? 'mint' : verdictOf(r) === 'drop' ? 'coral' : '']] : [];
  const liveAt = S.source === 'live' && S.busy ? PHASES.findIndex(p => p.live === S.phase) : -1;
  const narrow = W < 620, cx = W / 2, cy = H / 2 + 6, R = Math.max(60, Math.min(W * 0.24, H * 0.34));
  if (narrow) return { title, head: head('One run, seven steps', title, kpis), svg: drawLoopRail(r, liveAt) };
  let s = el('circle', { cx, cy, r: R * 0.82, fill: 'url(#core)' });
  for (let k = 0; k < 120; k++) {
    const a = k * 3 - 90, long = k % 10 === 0, [x0, y0] = polar(cx, cy, R + 12, a), [x1, y1] = polar(cx, cy, R + (long ? 22 : 16), a);
    s += el('line', { x1: n1(x0), y1: n1(y0), x2: n1(x1), y2: n1(y1), stroke: long ? C.line2 : C.line });
  }
  const ringD = `${arc(cx, cy, R, -90, 89.99)}${arc(cx, cy, R, 90, 269.99).replace('M', 'L')}`;
  s += el('path', { d: ringD, fill: 'none', stroke: C.line2, 'stroke-width': 1 });
  const last = liveAt >= 0 ? liveAt : r ? PHASES.length - 1 : -1, v = r ? verdictOf(r) : 'none';
  if (last > 0) s += el('path', { d: arc(cx, cy, R, -90, -90 + last * 360 / PHASES.length), fill: 'none', stroke: liveAt >= 0 ? C.lime : C.ice, 'stroke-width': 2, 'stroke-opacity': .8, filter: 'url(#g1)', class: 'draw' });
  if (!reduced()) for (let k = 0; k < 3; k++) s += `<circle r="2.6" fill="${C.lime}" filter="url(#g1)"><animateMotion dur="9s" repeatCount="indefinite" begin="-${(k * 3).toFixed(1)}s" path="${ringD}"/></circle>`;
  const cards = loopCards(r), over = [];
  const cw = 196, ch = 74;
  PHASES.forEach((p, i) => {
    const a = -90 + i * 360 / PHASES.length, [x, y] = polar(cx, cy, R, a), now = i === liveAt, decide = i === PHASES.length - 1 && r;
    const stroke = now ? C.lime : decide ? VC[v] : C.ice;
    if (now || decide) s += el('circle', { cx: n1(x), cy: n1(y), r: 24, fill: 'none', stroke, 'stroke-opacity': .5, class: now ? 'pulse' : '' });
    s += el('circle', { cx: n1(x), cy: n1(y), r: 17, fill: C.bg, stroke, 'stroke-width': 1.5, 'stroke-opacity': now || decide ? 1 : .55, filter: now || decide ? 'url(#g1)' : null, class: 'pop', style: `--i:${i}`, 'data-step': i });
    s += text(x, y + 4, `0${i + 1}`, { 'text-anchor': 'middle', fill: now ? C.lime : decide ? stroke : C.text, 'font-size': 11, style: 'pointer-events:none' });
    const [ox, oy] = polar(cx, cy, R + 34, a), cos = Math.cos(a * Math.PI / 180), sin = Math.sin(a * Math.PI / 180);
    let left = cos > 0.35 ? ox : cos < -0.35 ? ox - cw : ox - cw / 2, top = Math.abs(cos) > 0.35 ? oy - ch / 2 : sin < 0 ? oy - ch : oy;
    left = clamp(left, 0, W - cw); top = clamp(top, 0, H - ch);
    const c = cards[i];
    over.push(`<div class="tx-card hud ${now ? 'now' : c.cls || ''}" style="left:${left.toFixed(0)}px;top:${top.toFixed(0)}px;--i:${i}" data-step="${i}">
      <b><i>0${i + 1}</i>${esc(p.id)}${c.tag ? ` · ${esc(c.tag)}` : ''}</b><span>${esc(c.txt)}</span>${c.extra}</div>`);
  });
  s += text(cx, cy - 6, r ? `RUN ${V.sel + 1}` : '—', { 'text-anchor': 'middle', class: 't-ui t-strong', 'font-size': narrow ? 22 : 30, 'font-weight': 600 });
  s += text(cx, cy + 16, r ? `of ${S.all.length}${liveAt >= 0 ? ' · next one running' : ''}` : 'no run decided yet', { 'text-anchor': 'middle', 'font-size': 11 });
  if (r) s += text(cx, cy + 36, verdictWord(v).toUpperCase(), { 'text-anchor': 'middle', fill: VC[v], 'font-size': 11, 'letter-spacing': '.16em' });
  return { title, head: head('One run, seven steps', title, kpis), svg: s, over: over.join('') };
}

// ============================================================================
// Is it getting faster? The held-out lap against its own measurement, with every gate.
// ============================================================================
function drawProgress() {
  const W = V.W, H = V.H, R = S.all, N = R.length, title = 'Is it getting faster?';
  if (!N) return { title, head: head('Held-out lap time', title, []), svg: emptyChart('No run has been scored yet') };
  const sel = R[V.sel], first = R.find(r => num(r.official_s));
  const best = R.reduce((b, r, i) => num(r.official_s) && (b < 0 || r.official_s < R[b].official_s) ? i : b, -1);
  const gain = first && num(sel.official_s) ? first.official_s - sel.official_s : null;
  const gAll = R.reduce((a, r) => a + r.gates.length, 0), gOk = R.reduce((a, r) => a + r.gates.filter(g => g.ok).length, 0);
  const kpis = [
    ['Since run 1', gain === null ? '—' : gain > 0.005 ? `−${fmt(gain)}` : '0.00', gain > 0.005 ? 'mint' : '', 's'],
    ['Best lap', best < 0 ? '—' : fmt(R[best].official_s), 'lime', best < 0 ? '' : `s · run ${best + 1}`],
    ['Kept', `${R.filter(r => r.promoted).length}/${N}`, ''],
    ['Gates cleared', gAll ? `${gOk}/${gAll}` : '—', ''],
  ];
  const m = { l: 52, r: 16, t: 34, b: 74 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const vals = R.flatMap(r => [r.official_s, r.claimed_s]).filter(num), mn = Math.min(...vals), mx = Math.max(...vals), span = Math.max(1, mx - mn);
  const step = niceStep(span / 4), lo = Math.floor((mn - span * 0.12) / step) * step, hi = Math.ceil((mx + span * 0.12) / step) * step;
  const bw = iw / N, X = i => m.l + bw * (i + 0.5), Y = v => m.t + ih - (v - lo) / (hi - lo) * ih, base = m.t + ih;
  let s = '';
  for (let v = lo; v <= hi + 1e-9; v += step) { const y = n1(Y(v)); s += el('line', { x1: m.l, x2: W - m.r, y1: y, y2: y, stroke: C.line, 'stroke-dasharray': '2 5' }) + text(m.l - 10, y + 4, `${+v.toFixed(2)}`, { 'text-anchor': 'end' }); }
  s += text(m.l - 10, m.t - 16, 'sec', { 'text-anchor': 'end' });
  const sx = X(V.sel);
  s += el('rect', { x: n1(sx - bw / 2 + 2), y: m.t - 8, width: n1(Math.max(2, bw - 4)), height: n1(ih + 8), fill: 'url(#band)' });
  s += el('line', { x1: n1(sx), x2: n1(sx), y1: m.t - 8, y2: base, stroke: C.lime, 'stroke-opacity': .4, 'stroke-dasharray': '3 3' });
  s += el('line', { x1: m.l, x2: W - m.r, y1: base, y2: base, stroke: C.line2 });
  const pts = R.map((r, i) => num(r.official_s) ? [X(i), Y(r.official_s)] : null).filter(Boolean);
  const own = R.map((r, i) => num(r.claimed_s) ? [X(i), Y(r.claimed_s)] : null).filter(Boolean);
  const line = p => p.map((q, k) => `${k ? 'L' : 'M'}${n1(q[0])},${n1(q[1])}`).join('');
  if (pts.length > 1) {
    s += el('path', { d: `${line(pts)}L${n1(pts[pts.length - 1][0])},${base}L${n1(pts[0][0])},${base}Z`, fill: 'url(#area)', class: 'fade' });
    if (own.length > 1) s += el('path', { d: line(own), fill: 'none', stroke: C.violet, 'stroke-width': 1.4, 'stroke-dasharray': '5 5', 'stroke-opacity': .85, class: 'fade' });
    s += el('path', { d: line(pts), fill: 'none', stroke: C.ice, 'stroke-width': 7, 'stroke-opacity': .1, class: 'draw' });
    s += el('path', { d: line(pts), fill: 'none', stroke: C.ice, 'stroke-width': 2, filter: 'url(#g1)', class: 'draw' });
  }
  for (let i = 1; i < N; i++) {
    const a = R[i - 1], b = R[i]; if (!num(a.official_s) || !num(b.official_s) || bw < 34) continue;
    const d = b.official_s - a.official_s; if (Math.abs(d) < 0.005) continue;
    s += text((X(i - 1) + X(i)) / 2, Math.min(Y(a.official_s), Y(b.official_s)) - 12, `${d < 0 ? '−' : '+'}${fmt(Math.abs(d))}`,
      { 'text-anchor': 'middle', fill: d < 0 ? C.mint : C.coral, 'font-size': 10, class: 'fade', style: `--i:${i}` });
  }
  R.forEach((r, i) => {
    if (!num(r.official_s)) return;
    const x = n1(X(i)), y = n1(Y(r.official_s)), v = verdictOf(r), on = i === V.sel;
    if (on) s += el('circle', { cx: x, cy: y, r: 13, fill: 'none', stroke: C.lime, 'stroke-opacity': .55, class: 'pulse' });
    s += el('circle', { cx: x, cy: y, r: on ? 6.5 : 5, fill: C.bg, stroke: VC[v], 'stroke-width': 2.4, filter: 'url(#g1)', class: 'pop', style: `--i:${i}` });
    if (on) s += el('circle', { cx: x, cy: y, r: 2.6, fill: C.lime });
  });
  if (num(sel.official_s)) {
    const lbl = `${fmt(sel.official_s)} s`, tw = lbl.length * 7.3 + 16, x = X(V.sel), y = Y(sel.official_s);
    const tx = clamp(x - tw / 2, m.l, W - m.r - tw), ty = Math.max(2, y - 40);
    s += el('path', { d: `M${n1(x)},${n1(ty + 22)}L${n1(x)},${n1(y - 14)}`, stroke: C.lime, 'stroke-opacity': .6 });
    s += el('rect', { x: n1(tx), y: n1(ty), width: n1(tw), height: 22, fill: C.bg, stroke: C.lime });
    s += text(tx + tw / 2, ty + 15, lbl, { 'text-anchor': 'middle', fill: C.lime, 'font-size': 12 });
  }
  R.forEach((r, i) => {
    const x = X(i), on = i === V.sel;
    s += text(x, base + 18, `${i + 1}`, { 'text-anchor': 'middle', fill: on ? C.lime : C.mute });
    const g = r.gates, n = g.length;
    if (!n) { s += el('line', { x1: n1(x - 5), x2: n1(x + 5), y1: base + 34, y2: base + 34, stroke: C.dim }); return; }
    const cols = Math.max(2, Math.min(n, Math.floor((bw - 8) / 7))), sz = Math.max(3, Math.min(5, (bw - 8) / cols - 2));
    g.forEach((gt, k) => {
      const gx = x - cols * (sz + 2) / 2 + (k % cols) * (sz + 2), gy = base + 29 + Math.floor(k / cols) * (sz + 2);
      s += el('rect', { x: n1(gx), y: n1(gy), width: n1(sz), height: n1(sz), fill: gt.ok ? C.mint : C.coral, 'fill-opacity': gt.ok ? .7 : 1, class: 'fade', style: `--i:${i}` });
    });
  });
  s += text(m.l - 10, base + 18, 'run', { 'text-anchor': 'end' }) + text(m.l - 10, base + 36, 'gates', { 'text-anchor': 'end' });
  const lx = Math.max(m.l + 40, W - m.r - 290);
  s += el('line', { x1: lx, x2: lx + 22, y1: m.t - 20, y2: m.t - 20, stroke: C.ice, 'stroke-width': 2 }) + text(lx + 28, m.t - 16, 'held-out lap');
  s += el('line', { x1: lx + 118, x2: lx + 140, y1: m.t - 20, y2: m.t - 20, stroke: C.violet, 'stroke-dasharray': '5 4', 'stroke-width': 1.4 }) + text(lx + 146, m.t - 16, 'its own measurement');
  R.forEach((r, i) => { s += el('rect', { class: 'hit', x: n1(X(i) - bw / 2), y: m.t - 8, width: n1(bw), height: n1(ih + 66), 'data-run': i }); });
  return { title, head: head('Held-out lap time · lower is faster', title, kpis), svg: s };
}

// ============================================================================
// What did it build? An audit matrix: every page family, every run.
// ============================================================================
let CELLS = [];
function drawInterfaces() {
  const W = V.W, H = V.H, R = S.all, title = 'What did it build?';
  const part = window.SCRUTINEER_PARTITION;
  const fams = [...new Set([...(part && part.families || []), ...R.flatMap(r => r.pages.map(p => p.family))])].filter(Boolean);
  if (!R.length || !fams.length) return { title, head: head('The audit of every page', title, []), svg: emptyChart('No interfaces audited yet') };
  const r = R[V.sel], passed = r.pages.filter(p => p.passed).length, weighted = r.pages.reduce((a, p) => a + (p.weighted || 0), 0), critical = r.pages.reduce((a, p) => a + (p.critical || 0), 0);
  const allPages = R.reduce((a, x) => a + x.pages.length, 0), allPassed = R.reduce((a, x) => a + x.pages.filter(p => p.passed).length, 0);
  const kpis = [['Passed this run', `${passed}/${r.pages.length}`, passed === r.pages.length ? 'mint' : ''], ['Weighted violations', `${weighted}`, weighted ? 'coral' : 'mint'],
    ['Critical', `${critical}`, critical ? 'coral' : ''], ['Season pass rate', allPages ? pct(allPassed / allPages) : '—', '', '%']];
  CELLS = [];
  R.forEach((run, ri) => fams.forEach((f, fi) => {
    const pages = run.pages.filter(p => p.family === f);
    CELLS.push({ ri, fi, f, pages, passed: pages.filter(p => p.passed).length, weighted: pages.reduce((a, p) => a + (p.weighted || 0), 0),
      critical: pages.reduce((a, p) => a + (p.critical || 0), 0), rules: [...new Set(pages.flatMap(p => (p.rules || []).map(ruleId)))].filter(Boolean) });
  }));
  const N = R.length, F = fams.length, m = { l: 40, r: 108, t: 84, b: 56 };
  const cell = Math.max(10, Math.min((W - m.l - m.r) / F, (H - m.t - m.b) / N)), gw = cell * F, gh = cell * N;
  const ox = m.l + Math.max(0, (W - m.l - m.r - gw) / 2), oy = m.t;
  const maxW = Math.max(1, ...CELLS.map(c => c.weighted));
  let s = '';
  fams.forEach((f, fi) => { const x = ox + (fi + 0.5) * cell; s += `<text transform="translate(${n1(x)},${n1(oy - 10)}) rotate(-40)" style="fill:${C.mute}">${esc(f)}</text>`; });
  CELLS.forEach((c, k) => {
    const x = ox + c.fi * cell, y = oy + c.ri * cell, pad = Math.max(1.5, cell * 0.06), size = cell - pad * 2, on = c.ri === V.sel;
    const col = !c.pages.length ? C.dim : c.passed === c.pages.length ? C.mint : c.passed === 0 ? C.coral : C.amber;
    const dim = on ? 1 : 0.45;
    if (!c.pages.length) { s += el('rect', { x: n1(x + pad), y: n1(y + pad), width: n1(size), height: n1(size), fill: 'none', stroke: C.line, 'stroke-dasharray': '2 3' }); return; }
    s += el('rect', { x: n1(x + pad), y: n1(y + pad), width: n1(size), height: n1(size), fill: col, 'fill-opacity': .07 * dim, stroke: col, 'stroke-opacity': .38 * dim });
    const norm = Math.log1p(c.weighted) / Math.log1p(maxW), core = size * (c.weighted ? 0.26 + 0.64 * Math.sqrt(norm) : 0.2);
    s += el('rect', { x: n1(x + cell / 2 - core / 2), y: n1(y + cell / 2 - core / 2), width: n1(core), height: n1(core), fill: col, 'fill-opacity': .88 * dim,
      filter: on && (c.critical || c.passed === 0) ? 'url(#g1)' : null, class: 'pop', style: `--i:${Math.round((c.ri + c.fi) * 1.5)}` });
    s += el('rect', { class: 'hit', x: n1(x), y: n1(y), width: n1(cell), height: n1(cell), 'data-cell': k });
  });
  R.forEach((run, ri) => {
    const y = oy + (ri + 0.5) * cell, on = ri === V.sel;
    s += text(ox - 10, y + 4, `${ri + 1}`, { 'text-anchor': 'end', fill: on ? C.lime : C.mute });
    const bx = ox + gw + 16, bwid = Math.min(58, m.r - 50), ratio = run.pages.length ? run.pages.filter(p => p.passed).length / run.pages.length : 0;
    s += el('rect', { x: n1(bx), y: n1(y - 2), width: bwid, height: 4, fill: 'rgba(255,255,255,.06)' });
    s += el('rect', { x: n1(bx), y: n1(y - 2), width: n1(bwid * ratio), height: 4, fill: C.mint, 'fill-opacity': on ? 1 : .5, filter: on ? 'url(#g1)' : null, class: 'grow', style: `--i:${ri};transform-origin:0 50%` });
    s += text(bx + bwid + 6, y + 4, `${run.pages.filter(p => p.passed).length}/${run.pages.length}`, { fill: on ? C.text : C.mute, 'font-size': 10 });
  });
  s += text(ox + gw + 16, oy - 10, 'passed', { 'font-size': 10 });
  s += text(ox - 10, oy - 10, 'run', { 'text-anchor': 'end', 'font-size': 10 });
  const sy = oy + (V.sel) * cell;
  s += el('rect', { x: n1(ox - 3), y: n1(sy - 1), width: n1(gw + 6), height: n1(cell + 2), fill: 'none', stroke: C.lime, 'stroke-opacity': .7, filter: 'url(#g1)' });
  const totals = fams.map((f, fi) => CELLS.filter(c => c.fi === fi).reduce((a, c) => a + c.weighted, 0)), maxT = Math.max(1, ...totals), by = oy + gh + 14;
  totals.forEach((t, fi) => {
    const h = t ? 4 + 24 * t / maxT : 1, x = ox + fi * cell + cell * 0.3;
    s += el('rect', { x: n1(x), y: n1(by), width: n1(cell * 0.4), height: n1(h), fill: C.amber, 'fill-opacity': .75, class: 'fade', style: `--i:${fi}` });
  });
  s += text(ox - 10, by + 10, 'season', { 'text-anchor': 'end', 'font-size': 10 });
  return { title, head: head('The audit of every page, run by run', title, kpis), svg: s };
}

// ============================================================================
// Which part changed? A radial of component levels, with the blame each took.
// ============================================================================
function drawComponents() {
  const W = V.W, H = V.H, r = S.all[V.sel], title = 'Which part changed?';
  if (!r) return { title, head: head('Component levels and blame', title, []), svg: emptyChart('No run decided yet') };
  const lv = levelsAfter(V.sel + 1), st = r.standings || {}, v = verdictOf(r);
  const blamed = Object.values(st).reduce((a, x) => a + ((x && x.n) || 0), 0), maxN = Math.max(1, ...Object.values(st).map(x => (x && x.n) || 0));
  const kpis = [['Picked', r.role ? NAME[r.role] : '—', 'lime'], ['Outcome', verdictWord(v), v === 'keep' ? 'mint' : v === 'drop' ? 'coral' : ''],
    ['Total levels', `${Object.values(lv).reduce((a, x) => a + x, 0)}`, '', 'of 10 at start'], ['Pages blamed', `${blamed}`, blamed ? '' : 'mint']];
  const narrow = W < 620, cx = W / 2, cy = H / 2 + 4, Rmax = Math.max(70, Math.min(W * (narrow ? 0.26 : 0.3), H * 0.4));
  const R0 = Rmax * 0.3, R1 = Rmax * 0.8, SEG = 5, segH = (R1 - R0) / SEG, slot = 30, wid = slot * 0.64;
  const angleOf = k => { const c = CORE.indexOf(k); return c >= 0 ? -90 + (c - 2.5) * slot : 90 + (SUPPORT.indexOf(k) - 1.5) * slot; };
  let s = el('circle', { cx, cy, r: Rmax, fill: 'url(#core)' });
  s += el('circle', { cx, cy, r: R0 - 6, fill: 'none', stroke: C.line2 }) + el('circle', { cx, cy, r: R1 + 6, fill: 'none', stroke: C.line, 'stroke-dasharray': '2 4' });
  if (!narrow) {
    for (let k = 1; k <= SEG; k++) { const [x, y] = polar(cx, cy, R0 + (k - 0.5) * segH, 15); s += text(x, y + 3, `L${k}`, { 'text-anchor': 'middle', 'font-size': 9, fill: C.dim }); }
    s += text(cx, cy - R0 + 18, 'CORE', { 'text-anchor': 'middle', 'font-size': 9, 'letter-spacing': '.2em', fill: C.dim });
    s += text(cx, cy + R0 - 10, 'SUPPORT', { 'text-anchor': 'middle', 'font-size': 9, 'letter-spacing': '.2em', fill: C.dim });
  }
  [...CORE, ...SUPPORT].forEach((k, idx) => {
    const a = angleOf(k), a0 = a - wid / 2, a1 = a + wid / 2, level = lv[k] || 1, picked = r.role === k;
    for (let g = 0; g < SEG; g++) {
      const r0 = R0 + g * segH + 1.5, r1 = r0 + segH - 3, lit = g < level, gained = picked && v === 'keep' && g === level - 1, refused = picked && v === 'drop' && g === level;
      const d = wedge(cx, cy, r0, r1, a0, a1);
      if (gained) s += el('path', { d, fill: C.mint, filter: 'url(#g2)', class: 'fade', style: `--i:${g + idx}` });
      else if (refused) s += el('path', { d, fill: 'url(#hatch)', stroke: C.coral, 'stroke-width': 1.2, class: 'fade', style: `--i:${g + idx}` });
      else if (lit) s += el('path', { d, fill: C.ice, 'fill-opacity': .32 + g * 0.1, stroke: C.ice, 'stroke-opacity': .5, class: 'fade', style: `--i:${g + idx}` });
      else s += el('path', { d, fill: 'none', stroke: C.line });
    }
    if (level > SEG) { const [x, y] = polar(cx, cy, R1 + 2, a); s += text(x, y, `+${level - SEG}`, { 'text-anchor': 'middle', fill: C.ice, 'font-size': 10 }); }
    const n = (st[k] && st[k].n) || 0;
    if (n) {
      const t = 3 + (n / maxN) * 14;
      s += el('path', { d: wedge(cx, cy, R1 + 10, R1 + 10 + t, a0, a1), fill: C.amber, 'fill-opacity': .85, filter: 'url(#g1)', class: 'fade', style: `--i:${idx + 5}` });
      const [bx, by] = polar(cx, cy, R1 + 18 + t, a); s += text(bx, by + 4, `${n}`, { 'text-anchor': 'middle', fill: C.amber, 'font-size': 10 });
    }
    if (picked) s += el('path', { d: wedge(cx, cy, R0 - 2, R1 + 4, a0 - 2, a1 + 2), fill: 'none', stroke: C.lime, 'stroke-width': 1.2, filter: 'url(#g1)' });
    const [lx, ly] = polar(cx, cy, Rmax + (narrow ? 20 : 30), a), cos = Math.cos(a * Math.PI / 180);
    const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
    s += text(lx, ly, NAME[k], { 'text-anchor': anchor, class: 't-ui', fill: picked ? C.lime : C.text, 'font-size': narrow ? 10 : 12, 'font-weight': 600 });
    if (!narrow) s += text(lx, ly + 14, JOB[k], { 'text-anchor': anchor, 'font-size': 10, fill: C.mute });
    s += el('path', { class: 'hit', d: wedge(cx, cy, R0 - 6, Rmax + 12, a - slot / 2, a + slot / 2), 'data-role': k });
  });
  s += text(cx, cy - 4, `RUN ${V.sel + 1}`, { 'text-anchor': 'middle', class: 't-ui t-strong', 'font-size': narrow ? 12 : 20, 'font-weight': 600 });
  if (!narrow) s += text(cx, cy + 14, r.role ? `${NAME[r.role]} ${v === 'keep' ? '↑' : v === 'drop' ? '✕' : ''}` : 'no change', { 'text-anchor': 'middle', fill: VC[v], 'font-size': 10 });
  return { title, head: head('Levels, and the pages blamed on each', title, kpis), svg: s };
}

// ============================================================================
// Does it hold up outside? Pass rates, every held-out task, and the difference against what the
// test can detect at all.
// ============================================================================
let TILES = [];
function drawBenchmark() {
  const W = V.W, H = V.H, title = 'Does it hold up outside?';
  if (!BCB || !BCB.n) return { title, head: head('Outside check', title, []), svg: emptyChart('This build carries no outside check') };
  const res = (VERDICT && VERDICT.loop_vs_baseline) || BCB.resolution || {}, n = BCB.n, d = BCB.delta_pp;
  const p = num(res.p_two_sided) ? res.p_two_sided : BCB.p_two_sided, mde = res.mde_pp;
  const kpis = [['Held-out tasks', `${n}`, ''], ['Difference', num(d) ? `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}` : '—', num(d) ? (d > 0 ? 'mint' : 'coral') : '', 'pp'],
    ['McNemar p', num(p) ? p.toFixed(3) : '—', ''], ['Verdict', res.resolved ? 'Resolved' : 'Unresolved', res.resolved ? 'lime' : '']];
  const fixed = BCB.fixed || [], broken = BCB.broken || [];
  const both = Math.max(0, (BCB.baseline.solved || 0) - broken.length), neither = Math.max(0, n - both - fixed.length - broken.length);
  TILES = [...fixed.map(id => ({ k: 'fixed', id })), ...broken.map(id => ({ k: 'broken', id })),
    ...Array.from({ length: both }, () => ({ k: 'both' })), ...Array.from({ length: neither }, () => ({ k: 'neither' }))];
  const narrow = W < 620, topH = H * (narrow ? 0.62 : 0.64);
  let s = '';
  // two gauges
  const gx0 = narrow ? W * 0.25 : W * 0.13, gx1 = narrow ? W * 0.75 : W * 0.37;
  const gR = Math.max(28, Math.min((gx1 - gx0) / 2 - 22, topH * 0.3)), gy = narrow ? gR + 34 : topH * 0.5;
  const gauge = (gx, arm, label, color, i) => {
    const rate = arm.pass_at_1 || 0;
    let g = el('circle', { cx: n1(gx), cy: n1(gy), r: n1(gR), fill: 'none', stroke: 'rgba(255,255,255,.06)', 'stroke-width': 9 });
    for (let k = 0; k < 40; k++) { const [x0, y0] = polar(gx, gy, gR + 9, k * 9 - 90), [x1, y1] = polar(gx, gy, gR + 13, k * 9 - 90); g += el('line', { x1: n1(x0), y1: n1(y0), x2: n1(x1), y2: n1(y1), stroke: C.line }); }
    if (rate > 0) g += el('path', { d: arc(gx, gy, gR, -90, -90 + Math.min(359.9, rate * 360)), fill: 'none', stroke: color, 'stroke-width': 9, filter: 'url(#g1)', class: 'draw' });
    g += text(gx, gy + 6, `${pct(rate)}%`, { 'text-anchor': 'middle', fill: C.text, 'font-size': narrow ? 16 : 22 });
    g += text(gx, gy + gR + 30, label, { 'text-anchor': 'middle', class: 't-ui', fill: color, 'font-size': 11, 'letter-spacing': '.12em' });
    g += text(gx, gy + gR + 45, `${arm.solved}/${n} solved`, { 'text-anchor': 'middle', 'font-size': 10 });
    return g;
  };
  s += gauge(gx0, BCB.baseline, 'STARTING HARNESS', C.ice, 0) + gauge(gx1, BCB.loop, "LOOP'S CHAMPION", C.violet, 1);
  if (num(d)) {
    const my = gy - gR - 26, mx = (gx0 + gx1) / 2;
    s += el('path', { d: `M${n1(gx0)},${n1(my + 10)}L${n1(gx0)},${n1(my)}L${n1(gx1)},${n1(my)}L${n1(gx1)},${n1(my + 10)}`, fill: 'none', stroke: C.line2 });
    s += el('rect', { x: n1(mx - 40), y: n1(my - 11), width: 80, height: 22, fill: C.bg, stroke: d > 0 ? C.mint : C.coral });
    s += text(mx, my + 4, `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} pp`, { 'text-anchor': 'middle', fill: d > 0 ? C.mint : C.coral, 'font-size': 12 });
  }
  // every task
  const cols = 10, rows = Math.ceil(TILES.length / cols);
  const areaX = narrow ? 16 : W * 0.52, areaW = narrow ? W - 32 : W * 0.46, areaY = narrow ? gy + gR + 64 : 20, areaH = narrow ? topH - (gy + gR + 64) + H * 0.1 : topH - 30;
  const cs = Math.max(6, Math.min(areaW / cols, areaH / rows)), tx0 = areaX + (areaW - cs * cols) / 2, ty0 = areaY;
  TILES.forEach((t, i) => {
    const x = tx0 + (i % cols) * cs, y = ty0 + Math.floor(i / cols) * cs, sz = cs - 4;
    const fill = t.k === 'fixed' ? C.mint : t.k === 'broken' ? C.coral : t.k === 'both' ? C.ice : 'none';
    s += el('rect', { x: n1(x + 2), y: n1(y + 2), width: n1(sz), height: n1(sz), fill, 'fill-opacity': t.k === 'both' ? .35 : 1,
      stroke: t.k === 'neither' ? C.line2 : fill, 'stroke-opacity': t.k === 'both' ? .5 : 1, filter: t.k === 'fixed' || t.k === 'broken' ? 'url(#g1)' : null, class: 'pop', style: `--i:${i}` });
    s += el('rect', { class: 'hit', x: n1(x), y: n1(y), width: n1(cs), height: n1(cs), 'data-task': i });
  });
  // where the difference sits against what n tasks can detect
  const sy = narrow ? H - 58 : topH + (H - topH) * 0.55, ax0 = 40, ax1 = W - 40;
  const lim = Math.ceil(Math.max(Math.abs(d || 0), mde || 0, 5) * 1.5 / 5) * 5, XS = v => ax0 + (v + lim) / (2 * lim) * (ax1 - ax0);
  if (num(mde)) {
    s += el('rect', { x: n1(XS(-mde)), y: n1(sy - 16), width: n1(XS(mde) - XS(-mde)), height: 32, fill: C.slate, 'fill-opacity': .1, stroke: C.slate, 'stroke-opacity': .5, 'stroke-dasharray': '3 3' });
    if (!narrow) s += text(XS(0), sy - 24, `differences inside ±${mde} pp can't be told from noise with ${n} tasks`, { 'text-anchor': 'middle', 'font-size': 10 });
  }
  s += el('line', { x1: ax0, x2: ax1, y1: sy, y2: sy, stroke: C.line2 });
  for (let v = -lim; v <= lim; v += 5) { const x = n1(XS(v)); s += el('line', { x1: x, x2: x, y1: sy - 4, y2: sy + 4, stroke: v ? C.line2 : C.mute }) + text(x, sy + 20, `${v > 0 ? '+' : ''}${v}`, { 'text-anchor': 'middle', 'font-size': 10, fill: v ? C.dim : C.mute }); }
  if (num(d)) {
    const x = n1(XS(d)), col = res.resolved ? (d > 0 ? C.mint : C.coral) : C.coral;
    s += el('path', { d: `M${x},${n1(sy - 9)}L${n1(x + 9)},${sy}L${x},${n1(sy + 9)}L${n1(x - 9)},${sy}Z`, fill: col, filter: 'url(#g2)', class: 'pop' });
    s += text(x, sy + 38, `observed ${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} pp${num(p) ? ` · p = ${p.toFixed(3)}` : ''}`, { 'text-anchor': 'middle', fill: col, 'font-size': 11 });
  }
  s += text(ax0, sy - 24, 'pp', { 'font-size': 10 });
  return { title, head: head(`${BCB.benchmark || 'Benchmark'} · measured, not a demo`, title, kpis), svg: s };
}

// ============================================================================
// Panels
// ============================================================================
function paintSource() {
  const el2 = $('src'), live = S.source === 'live';
  el2.className = 'tx-src ' + S.source;
  el2.querySelector('b').textContent = live ? (S.linkDown ? 'Live · link down' : 'Live from this machine') : S.demo ? 'Recorded · demo season' : 'Recorded season';
}
function runHead(r) {
  const v = verdictOf(r);
  const what = r.role ? `${esc(NAME[r.role])} <em>· ${esc(JOB[r.role])}${r.part ? ` · part ${esc(r.part)}` : ''}</em>` : 'No component changed';
  const why = v === 'keep' ? 'The change cleared every gate and was kept.' : v === 'drop' ? `Refused: ${esc(WHY[r.failed[0]] || r.failed[0] || 'its own gates threw it out')}.`
    : r.rule_fired === 'circuit' ? 'It rebuilt the practice set instead of changing a component.' : 'No candidate had enough evidence behind it, so nothing was written.';
  return `<div class="f-h"><h2>Run ${V.sel + 1}<small>/ ${S.all.length}</small></h2><span class="f-tag ${v}">${verdictWord(v)}</span></div>
    <p class="f-what">${what}</p><p class="f-why">${why}${r.summary ? ` <q>${esc(r.summary)}</q>` : ''}</p>`;
}
function paintFacts() {
  const box = $('facts'), st = V.station;
  if (st === 'benchmark') return paintBenchFacts(box);
  const r = S.all[V.sel];
  if (!r) { box.innerHTML = '<p class="f-small">No run has been decided yet. The first one appears here when it is.</p>'; return; }
  const prev = S.all[V.sel - 1], passed = r.pages.filter(p => p.passed).length;
  if (st === 'loop') {
    box.innerHTML = runHead(r) + '<p class="f-small">Every run goes round the same seven steps. The cards on the ring are what <b>this</b> run produced at each one. Hover a step for what it does.</p>';
  } else if (st === 'progress') {
    const d = prev && num(prev.official_s) && num(r.official_s) ? r.official_s - prev.official_s : null;
    box.innerHTML = runHead(r) + `<div class="f-grid">
      <div><span class="f-k">Held-out lap</span><span class="f-v">${fmt(r.official_s)}<em>s</em></span></div>
      <div><span class="f-k">Vs run before</span><span class="f-v ${d === null ? '' : d < -0.005 ? 'mint' : d > 0.005 ? 'coral' : ''}">${d === null ? '—' : Math.abs(d) < 0.005 ? '0.00' : (d < 0 ? '−' : '+') + fmt(Math.abs(d))}<em>s</em></span></div>
      <div><span class="f-k">Its own lap</span><span class="f-v">${fmt(r.claimed_s)}<em>s</em></span></div>
      <div><span class="f-k">Cost</span><span class="f-v">${num(r.cost) ? '$' + fmt(r.cost) : '—'}</span></div></div>
      ${r.gates.length ? `<p class="f-small"><b>${r.gates.filter(g => g.ok).length} of ${r.gates.length}</b> gates cleared</p><ul class="f-list">${r.gates.map(g => `<li class="${g.ok ? '' : 'hot'}"><span>${esc(GATE[g.gate] || g.gate)}</span><b style="color:${g.ok ? C.mint : C.coral}">${g.ok ? 'cleared' : 'failed'}</b></li>`).join('')}</ul>` : '<p class="f-small">No gates ran: nothing was proposed.</p>'}
      <p class="f-small">The held-out lap is timed on a split the agent never sees. The dashed violet line is the time it measured for itself.</p>`;
  } else if (st === 'interfaces') {
    const rules = {}; r.pages.forEach(p => (p.rules || []).forEach(x => { const id = ruleId(x); if (id) rules[id] = (rules[id] || 0) + 1; }));
    const top = Object.entries(rules).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const worst = r.pages.filter(p => !p.passed).sort((a, b) => (b.weighted || 0) - (a.weighted || 0)).slice(0, 4);
    box.innerHTML = runHead(r) + `<div class="f-grid">
      <div><span class="f-k">Pages built</span><span class="f-v">${r.pages.length}</span></div>
      <div><span class="f-k">Passed the audit</span><span class="f-v ${r.pages.length && passed === r.pages.length ? 'mint' : ''}">${passed}<em>of ${r.pages.length}</em></span></div></div>
      ${top.length ? `<p class="f-small">Most-broken rules this run</p><ul class="f-list">${top.map(([k, c]) => `<li><span>${esc(k)}</span><b>${c} page${c > 1 ? 's' : ''}</b></li>`).join('')}</ul>` : '<p class="f-small">No rule was broken on any page this run.</p>'}
      ${worst.length ? `<p class="f-small">Open a failing page and audit it yourself</p><ul class="f-list">${worst.map(p => `<li><a href="/pages/${esc(p.file)}" target="_blank" rel="noopener">${esc(p.title)}</a><b>${p.weighted} weighted</b></li>`).join('')}</ul>` : ''}
      <div class="f-legend"><span><i style="background:${C.mint}"></i>all passed</span><span><i style="background:${C.amber}"></i>some</span><span><i style="background:${C.coral}"></i>none</span><span>core size = weighted violations</span></div>`;
  } else if (st === 'components') {
    const lv = levelsAfter(V.sel + 1), sd = r.standings || {};
    box.innerHTML = runHead(r) + `<p class="f-small">Levels after this run, and how many failing pages were blamed on each component.</p>
      <ul class="f-list">${ROLE_KEYS.map(k => `<li class="${r.role === k ? 'hot' : ''}"><span>${NAME[k]}${sd[k] && sd[k].n ? ` · ${sd[k].n} blamed` : ''}</span><b>L${lv[k]}</b></li>`).join('')}</ul>
      <div class="f-legend"><span><i style="background:${C.ice}"></i>level</span><span><i style="background:${C.mint}"></i>earned this run</span><span><i style="background:${C.coral}"></i>refused</span><span><i style="background:${C.amber}"></i>blamed</span></div>`;
  }
}
function paintBenchFacts(box) {
  if (!BCB) { box.innerHTML = '<p class="f-small">This build carries no outside check.</p>'; return; }
  const res = (VERDICT && VERDICT.loop_vs_baseline) || BCB.resolution || {}, scaling = VERDICT && VERDICT.loop_vs_scaling;
  box.innerHTML = `<div class="f-h"><h2 style="font-size:24px">Outside check</h2><span class="f-tag ${res.resolved ? 'resolved' : ''}">${res.resolved ? 'Resolved' : 'Unresolved'}</span></div>
    <p class="f-why" style="margin-top:10px">${esc(BCB.benchmark)}: ${BCB.n} held-out tasks, graded by running their own unit tests in a sealed sandbox. The loop never saw them while it was changing itself.</p>
    <div class="f-grid">
      <div><span class="f-k">Starting harness</span><span class="f-v">${pct(BCB.baseline.pass_at_1)}<em>%</em></span></div>
      <div><span class="f-k">Loop's champion</span><span class="f-v">${pct(BCB.loop.pass_at_1)}<em>%</em></span></div>
      <div><span class="f-k">Solved only by loop</span><span class="f-v mint">${(BCB.fixed || []).length}</span></div>
      <div><span class="f-k">Lost by the loop</span><span class="f-v coral">${(BCB.broken || []).length}</span></div></div>
    ${res.claim ? `<p class="f-claim${res.resolved ? ' resolved' : ''}">${esc(res.claim)}</p>` : ''}
    ${num(res.mde_pp) ? `<p class="f-small">Smallest effect this comparison can detect: <b>${res.mde_pp} pp</b> (${esc(res.mde_method || '')}). Tasks needed to detect the observed effect: <b>${res.n_star || '—'}</b>.</p>` : ''}
    ${scaling && scaling.claim ? `<p class="f-small">Against spending the same money on more samples: <b>${esc(scaling.claim)}</b></p>` : ''}
    <div class="f-legend"><span><i style="background:${C.mint}"></i>solved only by the loop</span><span><i style="background:${C.coral}"></i>only by the start</span><span><i style="background:${C.ice};opacity:.5"></i>both</span><span><i style="border:1px solid ${C.line2}"></i>neither</span></div>`;
}
function paintScrub() {
  const box = $('scrub');
  box.hidden = V.station === 'benchmark' || !S.all.length;
  if (box.hidden) return;
  box.innerHTML = `<button class="tx-play" id="play" type="button" aria-label="${V.playing ? 'Pause' : 'Play through the runs'}">${V.playing ? '❚❚' : '▶'}</button>
    <div class="tx-rail">${S.all.map((r, i) => { const v = verdictOf(r);
      return `<button type="button" class="tx-run ${v}" data-i="${i}" aria-current="${i === V.sel}" aria-label="Run ${i + 1}, ${verdictWord(v).toLowerCase()}"><span>${i + 1}</span></button>`; }).join('')}</div>`;
  $('play').onclick = () => { V.playing = !V.playing; V.playAt = performance.now(); if (V.playing && V.sel >= S.all.length - 1) select(0); paintScrub(); };
  box.querySelectorAll('.tx-run').forEach(b => { b.onclick = () => { V.playing = false; select(+b.dataset.i); }; });
}
function paintNote() {
  $('note').innerHTML = S.source === 'live' ? '<b>Live</b> from the loop running on this machine.'
    : S.demo ? '<b>Demo season.</b> The pages are real and really audited, but no model wrote them.' : '<b>Recorded season</b> from the loop\'s own bundle.';
}

// ============================================================================
// Render, navigation, input
// ============================================================================
const DRAW = { loop: drawLoop, progress: drawProgress, interfaces: drawInterfaces, components: drawComponents, benchmark: drawBenchmark };
function render(enter) {
  const plot = $('plot'), box = plot.getBoundingClientRect();
  V.W = Math.max(240, box.width); V.H = Math.max(220, box.height);
  const out = DRAW[V.station]();
  const svg = $('chart');
  svg.setAttribute('viewBox', `0 0 ${V.W.toFixed(0)} ${V.H.toFixed(0)}`);
  plot.classList.toggle('enter', !!enter && !reduced());
  svg.innerHTML = `<title id="chartTitle">${esc(out.title)}</title>${DEFS}${out.svg}`;
  $('over').innerHTML = out.over || '';
  $('head').innerHTML = out.head;
  if (enter) for (const p of svg.querySelectorAll('.draw')) p.style.setProperty('--len', Math.ceil(p.getTotalLength()) + 1);
}
function select(i) {
  V.sel = clamp(i, 0, Math.max(0, S.all.length - 1));
  render(false); paintFacts(); paintScrub();
}
function goStation(name) {
  if (!DRAW[name]) name = 'loop';
  V.station = name;
  document.querySelectorAll('#nav button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.st === name)));
  if (location.hash.slice(1) !== name) history.replaceState(null, '', location.pathname + location.search + '#' + name);
  render(true); paintFacts(); paintScrub(); paintNote();
}
document.querySelectorAll('#nav button').forEach(b => b.addEventListener('click', () => goStation(b.dataset.st)));
addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h !== V.station && DRAW[h]) goStation(h); });
addEventListener('keydown', ev => {
  if (ev.altKey || ev.metaKey || ev.ctrlKey) return;
  if (ev.key === 'ArrowRight') { V.playing = false; select(V.sel + 1); }
  else if (ev.key === 'ArrowLeft') { V.playing = false; select(V.sel - 1); }
  else if (['1', '2', '3', '4', '5'].includes(ev.key)) goStation(Object.keys(DRAW)[+ev.key - 1]);
});

const tip = $('tip');
function showTip(ev, html) { tip.innerHTML = html; tip.hidden = false; tip.style.left = Math.min(ev.clientX + 16, innerWidth - 300) + 'px'; tip.style.top = Math.min(ev.clientY + 16, innerHeight - 90) + 'px'; }
function tipFor(target) {
  const t = target.closest && target.closest('[data-run],[data-cell],[data-role],[data-task],[data-step]'); if (!t) return null;
  if (t.dataset.run !== undefined) { const r = S.all[+t.dataset.run];
    return `<b>RUN ${+t.dataset.run + 1} · ${verdictWord(verdictOf(r)).toUpperCase()}</b>held-out ${fmt(r.official_s)} s · its own ${fmt(r.claimed_s)} s<br>${r.gates.filter(g => g.ok).length}/${r.gates.length} gates · ${esc(r.role ? NAME[r.role] : 'no component')}`; }
  if (t.dataset.cell !== undefined) { const c = CELLS[+t.dataset.cell];
    return `<b>RUN ${c.ri + 1} · ${esc(c.f.toUpperCase())}</b>${c.pages.length} page${c.pages.length === 1 ? '' : 's'} · ${c.passed} passed · ${c.weighted} weighted${c.critical ? ` · ${c.critical} critical` : ''}${c.rules.length ? `<br>${esc(c.rules.slice(0, 3).join(', '))}` : ''}`; }
  if (t.dataset.role !== undefined) { const k = t.dataset.role, r = S.all[V.sel], s = r && r.standings[k];
    return `<b>${NAME[k]} · L${levelsAfter(V.sel + 1)[k]}</b>decides ${esc(JOB[k])}<br>${s && s.n ? `blamed for ${s.n} failing page${s.n === 1 ? '' : 's'} this run` : 'not blamed this run'}`; }
  if (t.dataset.task !== undefined) { const x = TILES[+t.dataset.task];
    return `<b>${x.id ? esc(x.id) : 'TASK'}</b>${{ fixed: 'solved by the loop, not by the start', broken: 'solved by the start, lost by the loop', both: 'solved by both', neither: 'solved by neither' }[x.k]}`; }
  if (t.dataset.step !== undefined) { const p = PHASES[+t.dataset.step]; return `<b>0${+t.dataset.step + 1} · ${p.id.toUpperCase()}</b>${esc(p.say)}`; }
  return null;
}
for (const host of [$('chart'), $('over')]) {
  host.addEventListener('pointermove', ev => { const h = tipFor(ev.target); if (h) showTip(ev, h); else tip.hidden = true; });
  host.addEventListener('pointerleave', () => { tip.hidden = true; });
}
$('chart').addEventListener('click', ev => {
  const t = ev.target.closest('[data-run],[data-cell]'); if (!t) return;
  V.playing = false;
  select(t.dataset.run !== undefined ? +t.dataset.run : CELLS[+t.dataset.cell].ri);
});
let resizeT = 0;
new ResizeObserver(() => { clearTimeout(resizeT); resizeT = setTimeout(() => render(false), 120); }).observe($('plot'));
setInterval(() => {
  if (!V.playing) return;
  if (V.sel >= S.all.length - 1) { V.playing = false; paintScrub(); } else select(V.sel + 1);
}, 2200);

(async function start() {
  await detectLive();
  paintSource(); paintNote();
  V.sel = Math.max(0, S.all.length - 1);
  goStation((location.hash || '#loop').slice(1));
})();
})();
