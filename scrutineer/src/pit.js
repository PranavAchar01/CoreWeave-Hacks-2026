// ============================================================================
// SCR.pit — the pit board: the car on your desk while the loop runs behind it.
//
// A small card that stays on top. The car turns on its pit-box floor; each time the loop lands a
// generation the car rebuilds in front of you, and hovering the card opens the board: how far the
// agent has run, what it kept, what it is running on. Three ways to keep it in view:
//   · pop it out — Document Picture-in-Picture gives it a window of its own, above every app
//   · drag it anywhere on the page it lives in; it remembers where you left it
//   · embed it: one script tag, src="https://scrutineer-one.vercel.app/pit.js"
// Two sources, and the strip says which. LIVE when a `scrutineer watch` server answers — on this
// origin, or on 127.0.0.1:7777 from anywhere. Otherwise REPLAY: the recorded season shipped in
// the bundle, one generation every `every` seconds, around again when it ends. Nothing on the
// board is invented by the board: the numbers are the season's, live or recorded.
// ============================================================================
(function (SCR) {
'use strict';
const E = SCR.engine, C = SCR.car, S = SCR.sim, M = E.M, P = SCR.pit = {};
const W = 128, H = 80;                        // the board's own pixels; CSS doubles them, nearest neighbour
const LOCAL = 'http://127.0.0.1:7777';
const FONTS = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap';
const NAME = { AERO: 'RETRIEVAL', DATA: 'VERIFICATION', TYRES: 'SAMPLING', POWER_UNIT: 'MODEL',
  STRATEGIST: 'BUDGET', SIMULATOR: 'CURRICULUM', PIT_CREW: 'DEPLOY', ENGINEER: 'PROPOSER',
  SCRUTINEER: 'AUDIT', HISTORIAN: 'MEMORY' };
const WHY = { seesaw: 'the two splits disagreed', regression: 'it made the car slower', cost_cap: 'over the cost cap',
  scrutineering: 'black-flagged', diff_size: 'too big a change', comparable_ab: 'the A/B was not comparable',
  novelty: 'nothing new in it', evidence: 'not enough evidence', correlation: 'the splits did not track',
  rl_entropy: 'the model collapsed', 'debrief gate': 'the debrief did not clear' };
const esc = s => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const el = (t, c, txt) => { const n = document.createElement(t); if (c) n.className = c; if (txt !== undefined) n.textContent = txt; return n; };
const ease = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const canPip = () => 'documentPictureInPicture' in window;

const st = {
  source: 'probing', origin: '', demo: false, linkDown: false,
  rounds: [],                          // decided generations, oldest first
  levels: {}, run: 0, laps: 0, lap: 0, lapsRun: 0, busy: false, phase: '', error: null,
  claimed: null, official: null, since: 0, seenSeq: 0,
  replay: { all: [], i: 0, every: 24, at: 0, elapsed: 0, beat: 0, laps: 40 },
  orbit: 0.9, whip: 0, fx: [], anim: null, card: null, cardTimer: 0,
  R: null, ground: null, spec: null, mesh: null, car: null,
  root: null, host: null, win: window, raf: 0, last: 0, pip: null, open: false, drag: null, boardAt: 0, stripTxt: '',
};
P.state = () => st;

// ---------- the floor: concrete, with the box painted on it ----------
E.hooks[M.CONCRETE] = function (mx, my, mz) {
  const ax = Math.abs(mx), az = Math.abs(mz);
  return ((ax > 2.1 && ax < 2.26 && az < 3.95) || (az > 3.8 && az < 3.95 && ax < 2.26)) ? M.GOLD : M.CONCRETE;
};
function makeGround() { E.begin(); E.setGroup(0); E.setAux(0); E.Q([-8, 0, -8], [8, 0, -8], [8, 0, 8], [-8, 0, 8], M.CONCRETE); return E.end(); }

// ---------- the car, idling: turntable camera, a wink of DRS, a steering check ----------
function rebuild(animate) {
  st.spec = C.specForLevels(st.levels);
  const mesh = C.build(st.spec, C.eraForLevels(st.levels));
  if (animate && st.mesh) st.anim = { kind: 'kept', t: 0, len: reduced() ? 1.3 : 3.2, from: st.mesh, to: mesh, flash: 0, tint: 0, sparked: false };
  st.mesh = mesh;
  if (animate && !reduced()) st.whip = 5.5;
}
function camera(dt) {
  st.whip = Math.max(0, st.whip - dt * 4.5);
  st.orbit += dt * (0.3 + st.whip);
  const cam = st.R.cam, r = 5.35;
  cam.pos = [Math.sin(st.orbit) * r, 1.5, Math.cos(st.orbit) * r]; cam.target = [0, 0.4, 0]; cam.fov = 31;
}
function idle(dt) {
  const c = st.car, k = E.time % 9;
  c.spin = 0; c.roll = 0; c.pitch = 0;
  c.drsAngle = k > 6 && k < 6.9 ? 0.75 * Math.sin((k - 6) / 0.9 * Math.PI) : 0;
  c.steer = k > 2.5 && k < 4 ? 0.3 * Math.sin((k - 2.5) / 1.5 * Math.PI * 2) : 0;
  c.fanSpin += dt * 1.5;
}
const lifted = (xf, dy) => (x, y, z, g, o) => { xf(x, y, z, g, o); o[1] += dy; };
function burst(n) {
  for (let k = 0; k < n; k++) {
    const h = E.hash2(k, st.fx.length + 1), h2 = E.hash2(k * 7 + 3, 11), wd = C.WHEELS[k & 3];
    st.fx.push({ x: wd.cx * 1.1, y: 0.15, z: wd.cz, vx: (h - 0.5) * 9, vy: 2 + h2 * 4, vz: (h2 - 0.5) * 9, life: 0.45 + h * 0.5 });
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
  E.time += dt; camera(dt); idle(dt); S.stepSparks(st.fx, dt);
  const R = st.R; R.begin(); R.gradient('#0C1236', '#06081A'); R.drawStatic(st.ground);
  const a = st.anim;
  if (a) { a.t += dt; renderAnim(a); if (a.t > a.len) st.anim = null; }
  else { const xf = C.makeXform(st.car); R.drawDynamic(st.mesh, xf, 'shadow', 0); R.drawDynamic(st.mesh, xf, 'solid', 0); }
  S.drawSparks(R, st.fx); R.outline();
  if (a) { if (a.flash > 0) R.flash(a.flash); if (a.tint > 0) tint(R, [227, 30, 45], a.tint); }
  R.present();
}

// ---------- a generation landed ----------
function landed(r, animate) {
  st.rounds.push(r);
  st.levels = r.levels && Object.keys(r.levels).length ? r.levels : C.levelsAfter(st.rounds, st.rounds.length);
  st.run = st.rounds.length; st.busy = false; st.lap = 0;
  if (r.promoted) rebuild(animate);
  else { rebuild(false); if (animate) { st.anim = { kind: 'refused', t: 0, len: 1.4, flash: 0, tint: 0 }; if (!reduced()) st.whip = 1.6; } }
  if (animate) card(r.promoted ? 'kept' : r.rule_fired === 'no_upgrade' ? 'none' : 'refused',
    r.promoted ? `<b>KEPT</b> ${esc(NAME[r.role] || r.role)} <i>L${esc((st.levels || {})[r.role] || '')}</i>`
      : r.rule_fired === 'no_upgrade' ? '<b>NO CHANGE</b> not enough evidence'
      : `<b>REFUSED</b> ${esc(NAME[r.role] || r.role || '')} <i>${esc(WHY[(r.failed || [])[0]] || (r.failed || [])[0] || 'thrown out')}</i>`);
  paint(true);
}
function card(kind, html) {
  const c = st.card; if (!c) return;
  clearTimeout(st.cardTimer);
  c.className = 'pit-card ' + kind; c.innerHTML = html;
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
function replayTick(now) {
  const rp = st.replay; if (!rp.all.length) return;
  if (!rp.at) rp.at = now;
  const elapsed = (now - rp.at) / 1000;
  if (rp.beat) {                                          // the beat between seasons
    if (elapsed < rp.beat) return;
    rp.beat = 0; rp.at = now; rp.i = 0;
    st.rounds = []; st.levels = C.levelsAfter([], 0); st.run = 0; rebuild(true);
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
async function detect(pref) {
  const here = /^https?:/.test(location.origin) ? location.origin : '';
  const cands = pref === 'replay' ? [] : pref ? [pref] : [here, LOCAL].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
  for (const o of cands) { const s = await probe(o); if (s) { goLive(o, s); return; } }
  goReplay();
}
function goLive(origin, s) {
  st.source = 'live'; st.origin = origin; st.busy = !!s.busy; st.error = s.error || null;
  if (s.levels && Object.keys(s.levels).length) { st.levels = s.levels; rebuild(false); }
  st.run = s.run || 0;
  const es = new EventSource(origin + '/api/events'); st.es = es;
  // the server replays its whole history on every connect; those are facts, not news
  let warm = true, timer = 0;
  const settle = () => { clearTimeout(timer); timer = setTimeout(() => { warm = false; paint(true); }, 900); };
  es.onmessage = ev => { let d; try { d = JSON.parse(ev.data); } catch (e) { return; }
    if (d.seq !== undefined) { if (d.seq <= st.seenSeq) return; st.seenSeq = d.seq; }
    if (warm) settle(); st.linkDown = false; onLive(d, !warm); };
  es.onerror = () => { st.linkDown = true; paint(true); };
  settle(); paint(true);
}
function onLive(d, fresh) {
  if (d.kind === 'phase') { st.phase = d.phase; if (d.phase === 'RUN') { st.run = d.generation + 1; st.lap = 0; st.laps = d.total || 0; st.busy = true; }
    if (d.levels && !fresh) { st.levels = d.levels; rebuild(false); } }
  else if (d.kind === 'lap') { st.lap = d.index; st.laps = d.total; st.lapsRun++; }
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
// paint(now): the strip every time; the board when it is open and something changed, or once a
// second for the clocks. The actions row is built once so a button is never replaced under a click.
function paint(now) {
  const root = st.root; if (!root) return;
  const src = st.source === 'live' ? 'LIVE' : st.source === 'replay' ? 'REPLAY' : '';
  const runNo = st.busy ? st.run || st.rounds.length + 1 : st.rounds.length;
  const txt = st.source === 'probing' ? 'LOOKING FOR THE LOOP'
    : st.error ? `${src} · RUN STOPPED` : st.busy && st.laps ? `${src} RUN ${runNo} · LAP ${st.lap}/${st.laps}`
    : st.busy ? `${src} RUN ${runNo} · ${st.phase || 'STARTING'}` : `${src} · RUN ${runNo} · KEPT ${kept()}`;
  if (txt !== st.stripTxt) { st.stripTxt = txt; root.querySelector('.pit-txt').textContent = txt; }
  const dot = root.querySelector('.pit-dot'), dc = 'pit-dot ' + (st.source === 'live' ? (st.linkDown ? 'down' : st.busy ? 'busy' : 'live') : st.source === 'replay' ? 'replay' : 'probe');
  if (dot.className !== dc) { dot.className = dc; dot.title = st.source === 'live' ? `live · ${st.origin}` : st.source === 'replay' ? 'replaying the recorded season' : 'looking for a running loop'; }
  if (!st.open) return;
  const t = performance.now(); if (!now && t - st.boardAt < 1000) return; st.boardAt = t;
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
    for (let k = 0; k < n; k++) { const r = st.rounds[k]; ticks.append(el('i', r ? (r.promoted ? 'keep' : r.rule_fired === 'no_upgrade' ? 'none' : 'drop') : 'todo')); }
    if (st.busy && st.laps) { const p = el('i', 'now'); p.style.setProperty('--p', (st.lap / st.laps).toFixed(3)); ticks.append(p); }
    b.append(ticks);
  }
  const rig = el('div', 'pb-rig');
  for (const k of C.ROLE_KEYS) { const lv = (st.levels || {})[k] || 1, row = el('div', 'pb-comp' + (lv > 1 ? ' up' : '') + (last && last.promoted && last.role === k ? ' now' : ''));
    row.innerHTML = `<span>${esc(NAME[k])}</span><b>${'▮'.repeat(Math.min(6, lv))}</b><em>L${lv}</em>`; rig.append(row); }
  b.append(rig);
  if (last) { const l = el('div', 'pb-last');
    l.innerHTML = last.promoted ? `<b class="k">KEPT</b> ${esc(NAME[last.role] || last.role)} → L${esc((st.levels || {})[last.role] || '')}${last.part ? ` <code>${esc(last.part)}</code>` : ''}${last.summary ? `<span>${esc(last.summary)}</span>` : ''}`
      : last.rule_fired === 'no_upgrade' ? '<b class="n">NO CHANGE</b> nothing had enough evidence behind it'
      : `<b class="d">REFUSED</b> ${esc(NAME[last.role] || last.role || '')} <span>${esc(WHY[(last.failed || [])[0]] || (last.failed || [])[0] || 'its own gates threw it out')}</span>`;
    b.append(l); }
  const up = fmtT((performance.now() - st.since) / 1000);
  b.append(el('div', 'pb-foot', st.error ? `stopped: ${st.error}`
    : st.source === 'live' ? (st.linkDown ? 'link down · reconnecting' : st.busy ? `running · ${st.phase || 'RUN'} · watching for ${up}` : `idle · waiting for a run · watching for ${up}`)
    : st.source === 'replay' ? (st.phase === 'END' ? 'season over · starting again' : `next run in ${Math.max(0, Math.ceil(st.replay.every - st.replay.elapsed))} s · on the board ${up}`)
    : 'looking for a loop on this origin and on 127.0.0.1:7777'));
}
function paintActions() {
  const a = st.root.querySelector('.pb-actions'); a.innerHTML = '';
  if (canPip()) { const pb = el('button', 'pb-btn', st.pip ? 'BRING IT BACK' : 'POP OUT ↗'); pb.type = 'button';
    pb.addEventListener('click', ev => { ev.stopPropagation(); if (st.pip) st.pip.close(); else P.popOut(); }); a.append(pb); }
  const link = el('a', 'pb-link', 'THE BROADCAST ↗'); link.href = st.source === 'live' ? st.origin + '/' : 'https://scrutineer-one.vercel.app/'; link.target = '_blank'; link.rel = 'noopener'; a.append(link);
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
  r.addEventListener('mouseenter', () => setOpen(true)); r.addEventListener('mouseleave', () => setOpen(false));
  r.addEventListener('focusin', () => setOpen(true)); r.addEventListener('focusout', ev => { if (!r.contains(ev.relatedTarget)) setOpen(false); });
  r.querySelector('canvas').addEventListener('click', () => setOpen(!st.open));
  r.addEventListener('keydown', ev => { if (ev.key === 'Escape') setOpen(false); });
  window.addEventListener('resize', () => { if (!st.pip && r.style.left) place(parseFloat(r.style.left), parseFloat(r.style.top)); });
  const pop = r.querySelector('.pit-pop');
  if (!canPip()) pop.hidden = true;
  pop.addEventListener('pointerdown', ev => ev.stopPropagation());
  pop.addEventListener('click', ev => { ev.stopPropagation(); if (st.pip) st.pip.close(); else P.popOut(); });
}
P.popOut = async function () {
  if (!canPip() || st.pip) return;
  let w; try { w = await window.documentPictureInPicture.requestWindow({ width: 288, height: 230 }); } catch (e) { return; }
  for (const n of document.querySelectorAll('link[data-pit],style[data-pit]')) w.document.head.append(n.cloneNode(true));
  w.document.title = 'Scrutineer · pit board'; w.document.body.className = 'pit-pipbody';
  w.document.body.append(st.root); st.root.classList.add('inpip'); st.root.classList.remove('open', 'up'); st.open = false;
  st.pip = w; swapLoop(w); paintActions();
  w.addEventListener('pagehide', () => {
    if (st.pip !== w) return;
    st.pip = null; st.host.append(st.root); st.root.classList.remove('inpip'); restore(); swapLoop(window); paintActions(); paint(true);
  });
};
// the animation loop runs on whichever window holds the card: a background tab stops its own
// frames, but the popped-out window keeps drawing
function swapLoop(win) {
  try { st.win.cancelAnimationFrame(st.raf); } catch (e) { /* the old window is gone */ }
  st.win = win; st.last = 0;
  const tick = now => {
    if (!st.last) st.last = now; const dt = Math.min(0.05, (now - st.last) / 1000); st.last = now;
    frame(dt); if (st.source === 'replay') replayTick(now); paint(false);
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
  if (st.root) return P;
  ensureStyles();
  st.host = opts.host || document.body; st.since = performance.now();
  const root = st.root = el('div', 'pit'); root.tabIndex = 0; root.setAttribute('role', 'group'); root.setAttribute('aria-label', 'Scrutineer pit board');
  root.innerHTML = '<canvas width="128" height="80" aria-label="the car, as the harness stands now"></canvas>'
    + '<div class="pit-card" aria-live="polite"></div>'
    + '<div class="pit-strip"><i class="pit-dot probe"></i><span class="pit-txt">LOOKING FOR THE LOOP</span>'
    + '<button class="pit-pop" type="button" title="pop out — a window of its own, above every app" aria-label="pop out">↗</button></div>'
    + '<div class="pit-board"><div class="pb-body"></div><div class="pb-actions"></div></div>';
  st.host.append(root); st.card = root.querySelector('.pit-card');
  st.R = E.createRenderer(root.querySelector('canvas'), W, H, 1); st.R.ambient = 0.22; st.R.seamCutoff = 40;
  st.ground = makeGround(); st.car = C.displayState(0, 0, 0);
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
