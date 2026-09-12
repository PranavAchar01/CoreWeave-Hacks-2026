// ============================================================================
// SCR.story — the thing you actually watch.
//
// One button. Press it and the agent runs: the car laps while it works through
// coding tasks it has never seen. When the run ends, the loop reads its own
// failures, decides which of its components caused them, writes a change to
// that component, checks the change against ten gates, and either keeps it or
// throws it away. Then you press the button again.
//
// Every number on screen came out of the control plane in loop/. Nothing here
// invents a result; this module is a director, not a simulator.
// ============================================================================
(function (SCR) {
'use strict';
const S = SCR.story = {};
const E = SCR.engine;
let A = null, R = null;

// -- the six components that shape a run, plus the four that keep it honest ---------------
const PARTS = [
  { key: 'AERO',       ui: 'AERO',     name: 'RETRIEVAL',    does: 'context assembly' },
  { key: 'POWER_UNIT', ui: 'POWER',    name: 'MODEL',        does: 'inference' },
  { key: 'TYRES',      ui: 'TYRES',    name: 'SAMPLING',     does: 'decode policy' },
  { key: 'DATA',       ui: 'DATA',     name: 'VERIFICATION', does: 'pre-submit audit' },
  { key: 'SIMULATOR',  ui: 'SIM',      name: 'CURRICULUM',   does: 'task selection' },
  { key: 'ENGINEER',   ui: 'ENGINEER', name: 'PROPOSER',     does: 'patch synthesis' },
];
const SUPPORT = [
  { key: 'STRATEGIST', ui: 'STRATEGY',   name: 'BUDGET',  does: 'stop policy' },
  { key: 'SCRUTINEER', ui: 'COMPLIANCE', name: 'AUDIT',   does: 'tamper check' },
  { key: 'HISTORIAN',  ui: 'HIST',       name: 'MEMORY',  does: 'trace compaction' },
  { key: 'PIT_CREW',   ui: 'TOOLS',      name: 'DEPLOY',  does: 'install and smoke' },
];
const ALL = PARTS.concat(SUPPORT);
const BY_KEY = Object.fromEntries(ALL.map(p => [p.key, p]));
const HUE = { AERO: 'cyan', POWER_UNIT: 'red', TYRES: 'amber', DATA: 'green', SIMULATOR: 'cyan',
  ENGINEER: 'gold', STRATEGIST: 'purple', SCRUTINEER: 'white', HISTORIAN: 'gold', PIT_CREW: 'white' };

// Two phrasings per gate. A gate description only reads correctly in one direction: "an auditor
// found no tampering" is what passing means, and printing it as the reason something failed is
// nonsense. The failure sentence has to be written separately.
const GATE_FAILS = {
  diff_size: 'the change was too small to be a change',
  comparable_ab: 'only one option was written, not two',
  novelty: 'it had already tried this exact change',
  evidence: 'it did not cite the failures that justify the change',
  seesaw: 'it was not better on both the practice briefs and the held-out ones',
  correlation: 'the three measurements disagree with each other',
  regression: 'something that worked before is broken now',
  cost_cap: 'it went over its budget',
  scrutineering: 'the auditor would not clear the change',
  rl_entropy: 'the model collapsed during training',
};

// what each gate means when it passes
const GATE_SAYS = {
  diff_size: 'the change is more than a typo',
  comparable_ab: 'two different options were written, not one',
  novelty: 'this is not a change it already tried',
  evidence: 'it cites the failures that justify the change',
  seesaw: 'faster on practice tasks AND on held-out tasks',
  correlation: 'the three measurements agree with each other',
  regression: 'nothing that worked before is broken now',
  cost_cap: 'it stayed inside its budget',
  scrutineering: 'an auditor found no tampering',
  rl_entropy: 'the model did not collapse during training',
};

const $ = id => document.getElementById(id);
const el = (t, c, txt) => { const n = document.createElement(t); if (c) n.className = c;
  if (txt !== undefined) n.textContent = txt; return n; };
const esc = s => String(s === undefined || s === null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fx = (n, d = 2) => (n === null || n === undefined || isNaN(n)) ? '—' : Number(n).toFixed(d);

// ---------------------------------------------------------------------------------------
// season: the real generations, plus the component levels implied by which ones stuck
// ---------------------------------------------------------------------------------------
const st = S.state = {
  rounds: [], i: -1, phase: 'INTRO', t: 0, dur: 0, levels: {}, shown: 0,
  playing: false, best: null, first: null, solvedNow: 0, seenTasks: [], bundle: null,
  // The race is the default and it never stops. `garage` is a place you choose to go, and
  // `pending` is the change waiting there for you — the loop carries on racing either way.
  view: 'track', garage: false, pending: null,
};

function levelsAt(n) {
  const lv = {}; for (const p of ALL) lv[p.key] = 1;
  for (let k = 0; k < n && k < st.rounds.length; k++) {
    const r = st.rounds[k];
    if (r.promoted && r.role && lv[r.role] !== undefined) lv[r.role]++;
  }
  return lv;
}


// ---------------------------------------------------------------------------------------
// Live mode. When the page is served by `scrutineer watch`, the button does not replay a
// recording — it runs a generation on this machine and the loop reports what it is doing as it
// does it. Same panels, driven by events instead of a timer.
// ---------------------------------------------------------------------------------------
const D = (kind, d) => { if (SCR.dash) SCR.dash.on(kind, d || {}); };

const live = { on: false, es: null, run: 0, laps: [], clean: 0, total: 0, gates: [], pages: [],
               busy: false, rounds: [], claimed: null, official: null };

async function detectLive() {
  try {
    const r = await fetch('/api/state', { cache: 'no-store' });
    if (!r.ok) return false;
    const st_ = await r.json();
    if (!st_ || !st_.live) return false;
    live.on = true;
    if (st_.levels && Object.keys(st_.levels).length) st.levels = st_.levels;
    connectLive();
    return true;
  } catch (e) { return false; }
}

function connectLive() {
  live.es = new EventSource('/api/events');
  live.es.onmessage = ev => {
    let d; try { d = JSON.parse(ev.data); } catch (e) { return; }
    onLive(d);
  };
}

function onLive(d) {
  if (d.kind === 'boot') { say('Warming up the harness — measuring which briefs are worth practising on.'); return; }
  if (d.kind === 'error') {
    say(`<span class="bad">The run stopped: ${esc(d.message)}</span>`);
    live.busy = false;
    return;                          // a real failure holds the loop rather than retrying blindly
  }
  if (d.kind === 'phase') {
    if (d.phase === 'RUN') D('run', { gen: d.generation + 1 });
    D('phase', { phase: d.phase, gen: d.generation + 1 });
    if (d.levels) { st.levels = d.levels; paintRig(); }
    if (d.phase === 'RUN') {
      live.run = d.generation; live.laps = []; live.clean = 0; live.total = d.total || 20;
      A.setScene('run');
      const rc = $('runCount'); if (rc) rc.textContent = `RUN ${d.generation + 1} · LIVE`;
      say(`Run ${d.generation + 1}. The agent is building interfaces on this machine, right now. `
        + 'Each one is written, opened in a real browser, and audited by axe-core.');
      meters([{ label: 'INTERFACE', value: `0 / ${live.total}` },
              { label: 'PASSED CLEAN', value: '0' },
              { label: 'SCORE  (lower is better)', value: '', tone: 'hero', tween: true,
                sub: 'measuring' }]);
      const host = work('THE AGENT IS BUILDING', 'live, on your machine');
      const grid = el('div', 'tasks'); grid.id = 'taskGrid'; host.append(grid);
    } else if (d.phase === 'DIAGNOSE') {
      showGarage(null, false);
      say('The run is scored. Now it replays each failure with one component corrected at a time, '
        + 'to find out which one actually caused it.');
    } else if (d.phase === 'CHANGE') {
      say('Writing a change to itself.');
    } else if (d.phase === 'GATES') {
      live.gates = [];
      say('Ten checks stand between a change and the agent keeping it.');
      const host = work('THE CHECKS', 'each one has to pass');
      const box = el('div', 'gates'); box.id = 'gateList'; host.append(box);
    }
    return;
  }
  if (d.kind === 'lap') {
    if (d.race !== 'quali') return;
    D('lap', d);
    live.laps.push(d);
    if (d.passed) live.clean++;
    const grid = $('taskGrid');
    if (grid) {
      const n = el('div', 'task ' + (d.passed ? 'ok' : 'no'));
      n.innerHTML = `<i>${d.passed ? '✓' : '✗'}</i><span>${esc(d.title)}</span>`
        + (d.passed ? '' : `<em style="color:var(--mid);font-style:normal"> ${d.weighted}</em>`);
      grid.append(n);
      grid.parentElement.scrollTop = grid.parentElement.scrollHeight;
    }
    meters([{ label: 'INTERFACE', value: `${d.index} / ${d.total}` },
            { label: 'PASSED CLEAN', value: String(live.clean), tone: live.clean ? 'good' : '' },
            { label: 'SCORE  (lower is better)', value: '', tone: 'hero', tween: true,
              sub: 'measuring' }]);
    return;
  }
  if (d.kind === 'score') {
    live.claimed = typeof d.claimed === 'number' ? d.claimed : null;
    live.official = typeof d.official === 'number' ? d.official : null;
    live.pages = d.pages || [];
    D('phase', { phase: 'SCORE' });
    D('score', d);
    tweenScore(null, d.official);
    meters([{ label: 'INTERFACES CLEAN', value: `${d.clean} / ${d.total}`,
              tone: d.clean ? 'good' : '' },
            { label: 'PRACTICE SCORE', value: fx(d.claimed) },
            { label: 'HELD-OUT SCORE  (lower is better)', value: fx(d.official), tone: 'hero',
              tween: true, sub: 'never seen by the improver' }]);
    say(`<span class="num">${d.clean}</span> of <span class="num">${d.total}</span> interfaces came `
      + 'back with zero accessibility violations. Every one of them is a real page — open it.');
    showPagesLive(d.pages || []);
    return;
  }
  if (d.kind === 'replay') {
    live.replays = (live.replays || 0) + 1;
    D('replay', d);
    if (!$('replayList')) {
      const host = work('REBUILDING EACH FAILURE', 'one component corrected at a time');
      const box = el('div', 'gates'); box.id = 'replayList'; host.append(box);
    }
    const box = $('replayList');
    const p = BY_KEY[d.role] || { name: d.role };
    const n = el('div', 'gate on ' + (d.flipped ? 'pass' : ''));
    n.innerHTML = `<i>${d.flipped ? '✓' : '·'}</i><span>${esc(d.title)} — rebuilt with `
      + `<b style="color:var(--${HUE[d.role] || 'cyan'})">${esc(p.name)}</b> corrected: `
      + (d.flipped ? `<span style="color:var(--green)">fixed it, ${fx(d.credit)}s</span>`
                   : '<span style="color:var(--mid)">no change — not the cause</span>') + '</span>';
    box.append(n);
    box.parentElement.scrollTop = box.parentElement.scrollHeight;
    return;
  }
  if (d.kind === 'blame') {
    const rows = Object.entries(d.standings || {})
      .map(([k, v]) => [k, { n: v.n, blame_s: v.blame_s }])
      .sort((a, b) => b[1].blame_s - a[1].blame_s);
    showBlame({ standings: d.standings }, rows);
    return;
  }
  if (d.kind === 'selection') {
    D('blame', d);
    if (!d.role) {
      say('No component cleared the evidence bar. <b>It refused to change anything</b> — which is '
        + 'the right answer when the evidence is thin.');
      return;
    }
    const p = BY_KEY[d.role] || { name: d.role };
    showGarage(d.role, false);
    say(`<b>${esc(p.name)}</b> is the component the evidence convicted — picked by gain per dollar `
      + `(<span class="num">${d.gain_per_usd}</span> s/$).`);
    return;
  }
  if (d.kind === 'change') {
    D('change', d);
    const p = BY_KEY[d.role] || { name: d.role };
    say(`The proposer wrote a change to <b>${esc(p.name)}</b>. This is the actual edit.`);
    showDiff({ diff: d.diff, part: null });
    return;
  }
  if (d.kind === 'gate') {
    live.gateN = (live.gateN || 0) + 1;
    D('gate', d);
    const box = $('gateList');
    if (box) {
      const n = el('div', 'gate on ' + (d.ok ? 'pass' : 'fail'));
      n.innerHTML = `<i>${d.ok ? '✓' : '✗'}</i>`
        + `<span>${esc(GATE_SAYS[d.gate] || d.gate)}</span>`;
      box.append(n);
    }
    return;
  }
  if (d.kind === 'result') {
    live.replays = 0; live.gateN = 0;
    // the curve is this season's, not the seeded one: the first real run replaces the demo
    live.rounds.push({
      generation: live.rounds.length, claimed_s: live.claimed, official_s: live.official,
      promoted: !!d.promoted, role: d.role || null, part: d.part || null,
      pages: live.pages || [], gates: [], tasks: [],
    });
    st.rounds = live.rounds;
    st.i = live.rounds.length - 1;
    if (st.bundle) st.bundle = Object.assign({}, st.bundle, { demo: false });
    if (st.first === null || live.rounds.length === 1) st.first = live.rounds[0].official_s;
      D('result', d);
    if (d.levels) { st.levels = d.levels; paintRig(d.promoted ? d.role : null); }
    const p = BY_KEY[d.role] || { name: d.role || '' };
    if (d.promoted) {
      showGarage(d.role, true);
      say(`Approved. <b>${esc(p.name)}</b> is now level `
        + `<span class="num">${(d.levels || {})[d.role] || 2}</span>. The change is part of the agent.`);
    } else {
      const reason = (d.failed || [])[0];
      say(`Rejected. <span class="bad">${esc(GATE_FAILS[reason] || reason || 'it did not pass')}</span>. `
        + 'The agent throws it away and keeps what it had. '
        + '<b>A loop that cannot refuse itself is not a loop.</b>');
      showGarage();
    }
    live.busy = false;
    scheduleNext();
    return;
  }
}

function showPagesLive(pages) {
  if (!pages.length) return;
  const clean = pages.filter(p => p.passed).length;
  const host = work('WHAT THE AGENT BUILT',
    `${clean} of ${pages.length} clean · open any of them and run axe-core yourself`);
  const grid = el('div', 'pages');
  for (const pg of pages) {
    const n = el('a', 'page ' + (pg.passed ? 'ok' : 'no'));
    n.href = '/pages/' + pg.file; n.target = '_blank'; n.rel = 'noopener';
    n.innerHTML = `<span class="page-top"><b>${esc(pg.title || pg.family)}</b>`
      + `<i class="${pg.passed ? 'ok' : 'no'}">${pg.passed ? 'CLEAN' : pg.weighted + ' pts'}</i></span>`
      + `<span class="page-sub">${pg.passed ? 'zero violations, every requirement met'
        : esc((pg.rules || []).map(v => v.id).slice(0, 3).join(', ') || 'did not render')}</span>`;
    grid.append(n);
  }
  host.append(grid);
}

async function startLiveRun() {
  if (live.busy) return;
  live.busy = true;
  try {
    const r = await fetch('/api/run', { method: 'POST' });
    const d = await r.json();
    if (!d.ok) { live.busy = false; scheduleNext(4000); }
  } catch (e) {
    live.busy = false;
    say('<span class="bad">The local server is not responding.</span>');
    scheduleNext(6000);
  }
}

S.init = function (app) {
  A = app; R = app.R;
  const L = window.SCRUTINEER_LOOP;
  st.bundle = L || null;
  st.rounds = (L && L.rounds) || [];
  st.levels = levelsAt(0);
  st.first = st.rounds.length ? st.rounds[0].official_s : null;
  buildRig();
  if (SCR.dash) SCR.dash.build();
  wire();
  paintMode();
  enterIntro();
  detectLive().then(ok => {
    if (ok) enterLiveIntro();
    // Nothing to press. The loop starts itself and keeps going.
    scheduleNext(ok ? 1500 : 2000);
  });
};

// ---------------------------------------------------------------------------------------
// the harness panel
// ---------------------------------------------------------------------------------------
function buildRig() {
  const host = $('rig'); if (!host) return;
  host.textContent = '';
  const add = (p, small) => {
    const n = el('button', 'part hue-' + (HUE[p.key] || 'cyan'));
    n.dataset.part = p.key;
    n.innerHTML = `<span class="part-top"><b>${esc(p.name)}</b><span class="part-lvl" data-lvl>L1</span></span>`
      + `<span class="part-does">${esc(p.does)}</span>`
      + (small ? '' : '<span class="part-bar"><b data-bar></b></span>');
    n.addEventListener('click', () => focusPart(p.key));
    host.append(n);
  };
  PARTS.forEach(p => add(p, false));
  const sep = el('div', 'rig-head');
  sep.innerHTML = '<span>KEEPING IT HONEST</span>';
  sep.style.marginTop = '8px';
  host.append(sep);
  SUPPORT.forEach(p => add(p, true));
  paintRig();
}

function paintRig(bumped) {
  const host = $('rig'); if (!host) return;
  const maxLv = Math.max(2, ...Object.values(st.levels));
  for (const node of host.querySelectorAll('.part')) {
    const k = node.dataset.part, lv = st.levels[k] || 1;
    const lvNode = node.querySelector('[data-lvl]');
    if (lvNode) lvNode.textContent = 'L' + lv;
    const bar = node.querySelector('[data-bar]');
    if (bar) bar.style.width = Math.round(100 * (lv - 1) / (maxLv - 1 || 1)) + '%';
    node.classList.toggle('up', k === bumped);
  }
  const sub = $('rigSub');
  if (sub) {
    const total = Object.values(st.levels).reduce((a, b) => a + b, 0) - ALL.length;
    sub.textContent = total ? `${total} upgrade${total === 1 ? '' : 's'} so far` : 'six components';
  }
}

function focusPart(key) {
  const g = SCR.scenes.garage;
  for (const n of document.querySelectorAll('.part')) n.classList.toggle('sel', n.dataset.part === key);
  if (!st.garage) { st.garage = true; paintMode(); }
  if (A.sceneName !== 'garage') showGarage();
  if (g) { const ui = (BY_KEY[key] || {}).ui; g.select(ui); g.setCamera('STATION_' + ui); }
  const p = BY_KEY[key];
  if (p) say(`<b>${esc(p.name)}</b> — ${esc(p.does)}. Level ${st.levels[key] || 1}.`);
}

// ---------------------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------------------
function say(html) { const n = $('say'); if (n) n.innerHTML = html; }

// ---------------------------------------------------------------------------------------
// station labels: the tie between the panel on the right and the room on the left
// ---------------------------------------------------------------------------------------
const tags = { built: false, nodes: {} };

function paintTags(highlight) {
  const host = $('cards'); if (!host) return;
  const g = SCR.scenes.garage;
  const on = A.sceneName === 'garage' && g && g.screenAnchors;
  if (!on && tags.built) {                      // nothing to pin to once we are on track
    for (const k in tags.nodes) tags.nodes[k].hidden = true;
    return;
  }
  if (!on) return;
  if (!tags.built) {
    tags.built = true;
    host.textContent = '';
    for (const p of ALL) {
      const n = el('div', 'stag hue-' + (HUE[p.key] || 'cyan'));
      n.innerHTML = `<b>${esc(p.name)}</b><i data-lvl>L1</i>`;
      host.append(n);
      tags.nodes[p.key] = n;
    }
  }
  for (const p of ALL) {
    const n = tags.nodes[p.key];
    const a = on ? g.screenAnchors[p.ui] : null;
    if (!a || a.z > 90) { n.hidden = true; continue; }
    n.hidden = false;
    n.style.left = Math.max(4, Math.min(96, a.x * 100)).toFixed(2) + '%';
    n.style.top = Math.max(5, Math.min(95, a.y * 100)).toFixed(2) + '%';
    n.querySelector('[data-lvl]').textContent = 'L' + (st.levels[p.key] || 1);
    n.classList.toggle('hot', p.key === highlight);
    n.classList.toggle('dim', !!highlight && p.key !== highlight);
  }
}

// The three numbers never leave the screen; only their values change. The score is tweened so a
// run that improved is something you watch happen rather than a value that has already changed.
const tween = { from: null, to: null, t: 0, dur: 1.1 };

function meters(list) {
  const host = $('meters'); if (!host) return;
  if (host.children.length !== list.length) {
    host.textContent = '';
    for (const m of list) {
      const n = el('div', 'meter');
      n.innerHTML = '<span data-l></span><b data-v></b><span class="delta" data-s></span>';
      host.append(n);
    }
  }
  list.forEach((m, i) => {
    const n = host.children[i];
    n.className = 'meter' + (m.tone ? ' ' + m.tone : '');
    n.querySelector('[data-l]').textContent = m.label;
    if (m.tween === undefined) n.querySelector('[data-v]').textContent = m.value;
    n.querySelector('[data-s]').textContent = m.sub || '';
  });
}

function tweenScore(from, to) {
  tween.from = from; tween.to = to; tween.t = 0;
  paintTween();
}

function paintTween() {
  const host = $('meters'); if (!host) return;
  const heroNode = host.querySelector('.meter.hero b');
  if (heroNode && tween.to === null) { heroNode.textContent = '—'; return; }
  if (tween.to === null) return;
  const hero = host.querySelector('.meter.hero b'); if (!hero) return;
  const k = tween.from === null ? 1 : Math.min(1, tween.t / tween.dur);
  const e = 1 - Math.pow(1 - k, 3);
  const v = tween.from === null ? tween.to : tween.from + (tween.to - tween.from) * e;
  hero.textContent = fx(v);
}

function work(head, sub) {
  const host = $('work'); if (!host) return null;
  host.textContent = '';
  const h = el('div', 'work-head');
  h.innerHTML = `<span>${esc(head)}</span>` + (sub ? `<em>${esc(sub)}</em>` : '');
  host.append(h);
  return host;
}

// The loop is not something you operate. It runs; the only control is a hold, which is outside
// the loop rather than a step in it.
const auto = { paused: false, timer: null, gap: 2600 };

function button(label, armed) {
  void label; void armed;      // kept so existing call sites stay honest about their intent
}

function setHold(paused) {
  auto.paused = paused;
  const b = $('holdBtn');
  if (b) { b.classList.toggle('paused', paused); b.lastChild.nodeValue = paused ? 'HELD' : 'RUNNING'; }
  if (!paused) scheduleNext(400);
}

function scheduleNext(ms) {
  clearTimeout(auto.timer);
  if (auto.paused) return;
  auto.timer = setTimeout(() => {
    if (auto.paused) return;
    if (live.on) { if (!live.busy) startLiveRun(); }
    else startRun();
  }, ms === undefined ? auto.gap : ms);
}

// ---------------------------------------------------------------------------------------
// scenes
// ---------------------------------------------------------------------------------------
function harnessSpec() {
  // the car is the harness: each component that levels up changes a part you can see
  const lv = st.levels, C = SCR.car;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  return {
    ...C.GEN01,
    frontWing: clamp(1 + (lv.AERO - 1), 1, 5),
    rearWing: clamp(1 + Math.floor((lv.AERO - 1) * 0.8), 1, 5),
    floor: clamp(1 + (lv.DATA - 1), 1, 4),
    engine: clamp(1 + (lv.POWER_UNIT - 1), 1, 5),
    gearbox: clamp(6 + (lv.STRATEGIST - 1), 6, 8),
    tyres: lv.TYRES > 2 ? 'SOFT' : lv.TYRES > 1 ? 'MEDIUM' : 'HARD',
    drs: lv.SIMULATOR > 1,
    fin: lv.AERO > 2,
    brakes: clamp(1 + Math.floor((lv.PIT_CREW - 1) * 1.5), 1, 4),
  };
}

function teamFor() {
  const T = SCR.team, team = T.newTeam();
  for (const p of ALL) { const r = team.roles[p.ui]; if (r) { r.level = st.levels[p.key] || 1; r.xp = 0; } }
  team.level = Object.values(team.roles).reduce((a, r) => a + r.level, 0);
  team.era = T.eraFor ? T.eraFor(team.level) : team.era;
  return team;
}

// The garage is only ever entered on purpose. Every phase that used to cut to it now just
// asks, and the ask is silently dropped while the race is on screen.
function showGarage(role, close) {
  const g = SCR.scenes.garage; if (!g || !st.garage) return;
  if (A.sceneName !== 'garage') A.setScene('garage', { spec: harnessSpec(), era: 0 });
  g.setTeam(teamFor(), harnessSpec());
  const ui = role ? (BY_KEY[role] || {}).ui : null;
  g.select(ui);
  // Wide, with the blamed station lit, while the loop is deciding: the question is which of the
  // ten it was. In close only when something actually changes there.
  g.setCamera(close && ui ? 'STATION_' + ui : 'OVERVIEW');
}

// ---------------------------------------------------------------------------------------
// race mode vs garage mode
//
// Race mode is the whole screen: the car, and nothing else. The harness rail, the narration
// line, the meters and the work panel all belong to the garage, because that is where you go
// to read about a change. TELEMETRY carries every number in either mode.
// ---------------------------------------------------------------------------------------
function paintMode() {
  const app = $('app');
  if (app) app.classList.toggle('race', st.view === 'track' && !st.garage);
  const back = $('trackBack'); if (back) back.hidden = !(st.view === 'track' && st.garage);
  if (st.garage) { const call = $('garageCall'); if (call) call.hidden = true; }
}

// Raised only when the loop actually kept a change. It waits; it does not interrupt.
function callToGarage(r) {
  st.pending = r;
  const call = $('garageCall'); if (!call || st.garage) return;
  const p = BY_KEY[r.role] || { name: r.role || '', does: '' };
  const eye = $('gcEyebrow'), what = $('gcWhat');
  if (eye) eye.textContent = `${p.name} \u2192 L${st.levels[r.role] || 1}`;
  if (what) what.textContent = r.diff_summary || p.does || 'a revision to the harness';
  call.hidden = false;
}

function openGarage() {
  const r = st.pending;
  st.garage = true;
  paintMode();
  showGarage(r && r.role, !!r);
  if (r) {
    const g = SCR.scenes.garage, ui = (BY_KEY[r.role] || {}).ui;
    if (g && g.playUpgrade && ui) {
      g.playUpgrade(ui, { name: (r.part || 'REVISION'), blurb: r.diff_summary || '',
        tier: Math.min(3, (st.levels[r.role] || 1) - 1) });
    }
    const p = BY_KEY[r.role] || { name: r.role || '' };
    say(`<b>${esc(p.name)}</b> is now level <span class="num">${st.levels[r.role] || 1}</span>. `
      + `<span class="num">${esc(r.diff_summary || 'a revision')}</span> — written by the agent `
      + 'against its own files, and kept because it cleared all ten checks.');
  }
  paintRig(r && r.role);
}

function closeGarage() {
  st.garage = false; st.pending = null;
  paintMode();
  enterTrack();
}

// The race itself, resumed rather than restarted: the car keeps whatever lap it was on.
function enterTrack() {
  if (A.sceneName !== 'run') A.setScene('run');
  else if (track.refit) track.refit();
}

// Two runs of this page should not be the same race. Unless a seed was asked for on the URL —
// screenshots and the diagnostic harness need that — every session gets its own salt, so the
// circuits it draws and the way the director covers them are new each time.
let SALT = null;
function salt() {
  if (SALT === null) SALT = (A.params && A.params.seed) ? 0 : (Math.random() * 0x7FFFFFFF) | 0;
  return SALT;
}
const trackSeed = () => (A.seed + st.i * 7 + salt()) | 0;

const track = { name: 'run' };
track.enter = function () {
  const seed = trackSeed();
  const circ = SCR.world.makeCircuit(seed), world = SCR.world.build(circ);
  track.spec = harnessSpec();
  track.dd = SCR.car.derive(track.spec);
  track.mesh = SCR.car.build(track.spec, 0);
  track.car = SCR.car.newState();
  SCR.sim.physics(track.car, track.dd, track.spec, circ, 0, {});
  // The director carries its own seed, so the same circuit is covered differently each session.
  track.scene = SCR.trackScene.create({ R, world, car: track.car, seed: (seed ^ 0x5F3759D) | 0 });
  track.scene.setMode('AUTO');
  track.circuitName = circ.name;
};
track.update = function (dt) {
  SCR.sim.physics(track.car, track.dd, track.spec, track.scene.circ, dt, { fx: track.scene.fx });
  SCR.sim.stepSparks(track.scene.fx, dt);
  track.scene.updateCamera(dt);
};
track.render = function () { track.scene.render({ car: track.mesh }); };
// A kept change reaches the car without stopping it: new bodywork, same lap, same corner.
track.refit = function () {
  if (!track.scene) return;
  const spec = harnessSpec();
  if (JSON.stringify(spec) === JSON.stringify(track.spec)) return;
  track.spec = spec;
  track.dd = SCR.car.derive(spec);
  track.mesh = SCR.car.build(spec, 0);
};
SCR.scenes.run = track;

// ---------------------------------------------------------------------------------------
// The world feed: the broadcast furniture over the race. Everything in the timing tower comes
// out of the loop's own bundle. The only invented readings are the car's speed and gear, and
// those are the car — not a measurement of the agent.
// ---------------------------------------------------------------------------------------
const PHASE_TAG = {
  RUN:      ['BUILDING', 'build'],
  SCORE:    ['SCORING', ''],
  DIAGNOSE: ['FINDING THE CAUSE', 'blame'],
  SELECT:   ['SELECTING', 'blame'],
  CHANGE:   ['WRITING A CHANGE', 'change'],
  GATES:    ['CHECKING', 'gates'],
  RESULT:   ['RESULT', ''],
  INTRO:    ['STANDING BY', ''],
};
const hud = { built: false, n: -1, cells: [], last: {} };

// Only write to the DOM when the text actually changed: this runs every frame.
function put(id, txt, cls) {
  const el_ = $(id); if (!el_) return;
  if (hud.last[id] !== txt) { el_.textContent = txt; hud.last[id] = txt; }
  if (cls !== undefined && el_.className !== cls) el_.className = cls;
}

function stripFor(tasks) {
  const host = $('rhStrip'); if (!host) return;
  if (hud.n !== tasks.length) {
    host.textContent = ''; hud.cells = [];
    for (let k = 0; k < tasks.length; k++) { const n = el('div', 'rh-cell'); host.append(n); hud.cells.push(n); }
    hud.n = tasks.length;
  }
}

function gatesPanel(r) {
  const host = $('rhGates'); if (!host) return;
  const gates = (r && r.gates) || [];
  const show = gates.length && (st.phase === 'GATES' || st.phase === 'RESULT');
  host.hidden = !show;
  if (!show) { host.dataset.sig = ''; return; }
  const shown = st.phase === 'GATES' ? Math.min(gates.length, st.shown) : gates.length;
  const sig = `${st.i}:${shown}`;
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;
  host.textContent = '';
  for (let k = 0; k < shown; k++) {
    const g = gates[k], n = el('div', 'g ' + (g.ok ? 'ok' : 'no'));
    n.innerHTML = `<i>${g.ok ? '\u2713' : '\u2717'}</i><span>${esc(GATE_SAYS[g.gate] || g.gate)}</span>`;
    host.append(n);
  }
}

function paintHud() {
  if (st.view !== 'track' || st.garage) return;
  const r = st.rounds[st.i] || null, tasks = (r && r.tasks) || [];

  put('rhCircuit', track.circuitName || 'SEALED CIRCUIT');
  const live_ = $('rhLive');
  if (live_) live_.className = 'rh-live' + (auto.paused ? ' held' : '');
  put('rhRun', st.rounds.length ? `RUN ${Math.max(1, st.i + 1)} / ${st.rounds.length}` : 'STANDING BY');

  // A lap is one interface: built, opened in a browser, audited.
  const done = st.phase === 'RUN' ? st.shown : (r ? tasks.length : 0);
  put('rhLap', tasks.length ? `${done} / ${tasks.length}` : '\u2014');
  const cur = st.phase === 'RUN' ? tasks[Math.max(0, st.shown - 1)] : null;
  put('rhTask', cur ? (cur.title || cur.id) : (r ? 'RUN COMPLETE' : '\u2014'));

  const clean = st.phase === 'RUN' ? st.solvedNow
    : (r ? tasks.reduce((a, t) => a + (t.solved > 0 ? 1 : 0), 0) : 0);
  put('rhClean', tasks.length ? `${clean} / ${tasks.length}` : '\u2014');
  const cleanRow = $('rhClean'); if (cleanRow && cleanRow.parentElement)
    cleanRow.parentElement.className = 'rh-row' + (clean ? ' clean' : '');

  // The score only exists once the run has been scored; showing this run's number while it is
  // still building would be printing an answer before it was measured.
  const scored = r && st.phase !== 'RUN';
  const shownScore = scored ? r.official_s : (st.i > 0 ? st.rounds[st.i - 1].official_s : null);
  put('rhScore', shownScore === null || shownScore === undefined ? '\u2014' : fx(shownScore));
  const ref = st.i > 0 ? st.rounds[st.i - 1].official_s : null;
  let dTxt = '', dCls = '';
  if (scored && ref !== null) {
    const d = ref - r.official_s;
    dTxt = (d >= 0 ? '\u2212' : '+') + fx(Math.abs(d));
    dCls = d > 0.005 ? 'good' : d < -0.005 ? 'bad' : '';
  } else if (!scored && ref !== null) dTxt = 'last run';
  put('rhDelta', dTxt, dCls);

  const lv = Object.values(st.levels).reduce((a, b) => a + b, 0);
  const kept = st.rounds.slice(0, Math.max(0, st.i)).filter(x => x.promoted).length
    + ((r && r.promoted && (st.phase === 'RESULT')) ? 1 : 0);
  put('rhHarness', `L${lv} \u00B7 ${kept} kept`);

  const blameRow = $('rhBlameRow');
  const showBlameRow = r && r.role && ['DIAGNOSE', 'SELECT', 'CHANGE', 'GATES', 'RESULT'].includes(st.phase);
  if (blameRow) blameRow.hidden = !showBlameRow;
  if (showBlameRow) put('rhBlame', (BY_KEY[r.role] || { name: r.role }).name, 'blame');

  let [tag, cls] = PHASE_TAG[st.phase] || ['RUNNING', ''];
  if (st.phase === 'RESULT' && r) { if (r.promoted) { tag = 'CHANGE KEPT'; cls = 'kept'; }
    else if (r.rule_fired === 'no_upgrade') { tag = 'NOTHING TO CHANGE'; cls = ''; }
    else { tag = 'CHANGE DROPPED'; cls = 'dropped'; } }
  put('rhPhase', tag, 'rh-phase' + (cls ? ' ' + cls : ''));

  // The car's own instruments.
  const car = track.car, dd = track.dd;
  if (car && dd) {
    const kmh = Math.round(car.speed * 3.6);
    put('rhSpeed', String(kmh));
    const bar = $('rhSpeedBar');
    if (bar) bar.style.width = Math.round(100 * Math.min(1, car.speed / (dd.topSpeed + 8))) + '%';
    const gears = dd.gears || 6;
    const g = car.speed < 4 ? 'N'
      : String(Math.max(1, Math.min(gears, Math.ceil(car.speed / (dd.topSpeed / gears)))));
    put('rhGear', g);
    put('rhDrs', 'DRS', 'rh-drs' + (car.drsOn ? ' on' : ''));
  }

  stripFor(tasks);
  for (let k = 0; k < hud.cells.length; k++) {
    const t = tasks[k];
    const revealed = st.phase === 'RUN' ? k < st.shown : true;
    const want = 'rh-cell' + (revealed ? (t.solved > 0 ? ' ok' : ' no') : '')
      + (st.phase === 'RUN' && k === st.shown - 1 ? ' now' : '');
    if (hud.cells[k].className !== want) hud.cells[k].className = want;
  }
  gatesPanel(r);
}

// ---------------------------------------------------------------------------------------
// phases
// ---------------------------------------------------------------------------------------
function enterIntro() {
  st.phase = 'INTRO'; st.playing = false;
  if (st.garage) showGarage(); else enterTrack();
  const first = st.rounds[0], last = st.rounds[st.rounds.length - 1];
  const kept = st.rounds.filter(r => r.promoted).length;
  const t0 = (first && (first.tasks || []).filter(t => t.solved > 0).length) || 0;
  const tN = (last && (last.tasks || []).filter(t => t.solved > 0).length) || 0;
  const n = (first && (first.tasks || []).length) || 0;
  const promise = (n && tN > t0)
    ? `Over ${st.rounds.length} runs it goes from <span class="num">${t0}</span> of `
      + `<span class="num">${n}</span> interfaces clean to <span class="good">${tN}</span> — `
      + `by changing <b>${kept}</b> things about itself.`
    : `It ran ${st.rounds.length} times and kept <b>${kept}</b> of the changes it wrote.`;
  say('An agent that builds web interfaces, drawn as a garage. Six components decide how it '
    + 'works — and it rewrites them itself. '
    + promise + ' It is running now; the garage opens when it keeps one.');
  meters([
    { label: 'RUNS COMPLETED', value: '0' },
    { label: 'INTERFACES CLEAN', value: '—' },
    { label: 'SCORE', value: '—', tone: 'hero' },
  ]);
  const host = work('WHAT YOU ARE ABOUT TO WATCH');
  if (host) {
    const box = el('div', 'two');
    const a = el('div');
    a.innerHTML = '<p style="margin:0;font-family:\'VT323\',monospace;font-size:17px;line-height:19px;'
      + 'color:var(--caption)">The agent runs, and most of it fails. It then reads its own failure '
      + 'traces, replays each failure with one component corrected to find out which one actually '
      + 'caused it, and writes a change to that component. The change only sticks if it survives '
      + 'ten checks — including one on a set of held-out tasks the agent never sees.</p>';
    const b = el('div');
    b.innerHTML = '<p style="margin:0;font-family:\'VT323\',monospace;font-size:17px;line-height:19px;'
      + 'color:var(--caption)">Nothing here is a mock-up. Every score, change and refusal on this '
      + 'page came from that loop actually running against a real model — '
      + `${st.rounds.length} runs of it.</p>`;
    box.append(a, b); host.append(box);
  }
  button('RUN THE AGENT', st.rounds.length > 0);
  paintRig();
}

function enterLiveIntro() {
  const rc = $('runCount'); if (rc) rc.textContent = 'LIVE · ON THIS MACHINE';
  say('This is the loop running on your own machine. It is '
    + 'actually building interfaces — writing each one, opening it in a browser, and auditing it — '
    + 'then working out which of its own components caused the failures and trying to fix one. '
    + 'It takes a few minutes, because it is really doing it.');
  const host = work('LIVE', 'nothing here is a recording');
  if (host) {
    const p = el('p', 'page-note');
    p.innerHTML = 'Your key never leaves this machine: there is no relay in this mode. Every page '
      + 'the agent builds is written to <code>loop/state/pages/</code> and served from there, so '
      + 'you can open one the moment it exists.';
    host.append(p);
  }
  button('RUN THE AGENT', true);
}

function startRun() {
  if (live.on) return startLiveRun();
  if (st.playing) return;
  st.i++;
  if (st.i >= st.rounds.length) {
    // Round the cycle again from the beginning, the way a loop does — without ever leaving
    // the track, because the point of this view is that the agent is always running.
    st.i = 0; st.levels = levelsAt(0);
    const call = $('garageCall'); if (call) call.hidden = true;
    st.pending = null;
  }
  st.levels = levelsAt(st.i);
  st.playing = true;
  paintRig();
  phase('RUN');
}

function phase(name) {
  st.phase = name; st.t = 0; st.shown = 0;
  if (name === 'RUN') D('run', { gen: st.i + 1 });
  D('phase', { phase: name, gen: st.i + 1 });
  const r = st.rounds[st.i];
  const rc = $('runCount');
  if (rc) rc.textContent = `RUN ${st.i + 1} OF ${st.rounds.length}`;

  if (name === 'RUN') {
    st.seenTasks = []; st.solvedNow = 0;
    if (!st.garage) enterTrack();
    const n = (r.tasks || []).length || 20;
    st.dur = Math.max(7, Math.min(15, n * 0.55));
    button('RUNNING…', false);
    say(`Run ${st.i + 1}. The agent is building <span class="num">${n}</span> web interfaces — a `
      + 'checkout form, a modal dialog, a sortable table. Each lap is one interface: it reads what '
      + 'RETRIEVAL gives it, writes a complete HTML document, and checks it with VERIFICATION '
      + 'before submitting. Every page is then opened in a real browser and audited by axe-core.');
    const prevScore = st.i > 0 ? st.rounds[st.i - 1].official_s : null;
    meters([
      { label: 'INTERFACE', value: `0 / ${n}` },
      { label: 'PASSED CLEAN', value: '0' },
      { label: 'SCORE  (lower is better)', value: prevScore === null ? '—' : fx(prevScore),
        tone: 'hero', tween: true, sub: prevScore === null ? 'first run' : 'from the last run' },
    ]);
    tween.from = null; tween.to = prevScore; tween.t = tween.dur;
    paintTween();
    work('THE AGENT IS BUILDING', 'each interface is opened in a browser and audited');
    const grid = el('div', 'tasks'); grid.id = 'taskGrid';
    $('work').append(grid);
    return;
  }

  if (name === 'SCORE') {
    st.dur = 5.5;
    const tasks = r.tasks || [];
    const solved = tasks.reduce((a, t) => a + (t.solved > 0 ? 1 : 0), 0);
    const prev = st.i > 0 ? st.rounds[st.i - 1] : null;
    const dScore = prev ? prev.official_s - r.official_s : 0;
    say(`Run ${st.i + 1} finished. <span class="num">${solved}</span> of `
      + `<span class="num">${tasks.length}</span> interfaces came back with zero accessibility `
      + `violations. Score <span class="num">${fx(r.official_s)}</span>`
      + (prev ? (dScore > 0.01
        ? ` — <span class="good">${fx(dScore)} better</span> than the last run.`
        : ` — <span class="bad">no better</span> than the last run.`) : '. Lower is better.'));
    meters(scoreMeters(r, solved, tasks.length));
    tweenScore(st.i > 0 ? st.rounds[st.i - 1].official_s : r.official_s + Math.abs(dScore || 0), r.official_s);
    showSamples(r);
    button('SCORING', false);
    return;
  }

  if (name === 'DIAGNOSE') {
    st.dur = 6;
    button('FINDING THE CAUSE', false);
    showGarage(r.role, false);
    const blame = Object.entries(r.standings || {}).sort((a, b) => b[1].blame_s - a[1].blame_s);
    const top = blame[0];
    if (!r.role) {
      say('The loop looked at the failures and found no component it could blame with enough '
        + 'confidence. <b>It refused to change anything.</b> That is a real outcome, not a bug — '
        + 'changing something on thin evidence is how these systems drift.');
    } else {
      const p = BY_KEY[r.role] || { name: r.role, does: '' };
      say(`It replayed each failure with one component corrected at a time, to find out which one `
        + `actually caused it. <b>${esc(p.name)}</b> — ${esc(p.does)} — came out worst`
        + (top ? `: <span class="num">${top[1].n}</span> confirmed failures, `
          + `<span class="num">${fx(top[1].blame_s, 1)}s</span> of lost time.` : '.'));
    }
    keepScore(r);
    showBlame(r, blame);
    return;
  }

  if (name === 'CHANGE') {
    st.dur = 7;
    button('WRITING THE CHANGE', false);
    if (!r.diff) { phase('RESULT'); return; }
    const p = BY_KEY[r.role] || { name: r.role };
    say(`The race engineer wrote a change to <b>${esc(p.name)}</b>: `
      + `<span class="num">${esc(r.diff_summary || 'a revision')}</span>. `
      + 'This is the actual edit, applied to the agent\'s own files.');
    keepScore(r);
    showDiff(r);
    return;
  }

  if (name === 'GATES') {
    st.dur = Math.max(3, (r.gates || []).length * 0.28 + 1.4);
    button('CHECKING', false);
    say('Ten checks stand between a change and the agent keeping it. They run in order, and the '
      + 'first failure stops the change.');
    keepScore(r);
    const host = work('THE CHECKS', 'each one has to pass');
    const box = el('div', 'gates'); box.id = 'gateList';
    host.append(box);
    for (const g of (r.gates || [])) {
      const n = el('div', 'gate'); n.dataset.gate = g.gate;
      n.innerHTML = `<i>·</i><span>${esc(GATE_SAYS[g.gate] || g.gate)}</span>`;
      box.append(n);
    }
    return;
  }

  if (name === 'RESULT') {
    st.dur = 6.5;
    const p = BY_KEY[r.role] || { name: r.role || '' };
    if (r.promoted) {
      st.levels = levelsAt(st.i + 1);
      paintRig(r.role);
      if (!st.garage) enterTrack();      // the new bodywork goes on without breaking the lap
      callToGarage(r);
      const next = st.rounds[st.i + 1];
      say(`Approved. <b>${esc(p.name)}</b> is now level <span class="num">${st.levels[r.role]}</span>`
        + (next ? `, and the next run scored <span class="num">${fx(next.official_s)}</span> — `
          + `<span class="good">${fx(r.official_s - next.official_s)} better</span>.`
          : '. That was the last run of the season.'));
    } else if (r.rule_fired === 'no_upgrade') {
      // Not a rejection: nothing was written. The selector found no component whose evidence
      // cleared the bar, and stopping there is the result, not a gap in it.
      say('No change this run. <b>No component had enough evidence to be worth touching</b> — '
        + 'every one of them was either below the sample floor or its confidence interval '
        + 'still crossed zero. The loop wrote nothing rather than guess.');
      showGarage();
    } else {
      const failed = (r.gates || []).filter(g => !g.ok);
      const why = failed.length ? failed[0] : null;
      const verdict = (r.verdict || {}).verdict;
      const reason = why ? (GATE_FAILS[why.gate] || why.gate) : null;
      const extra = (why && why.gate === 'scrutineering' && verdict === 'REFER_TO_STEWARDS')
        ? ' — it could not verify the change either way, so it refused rather than guess' : '';
      say(`Rejected. ${reason ? `<span class="bad">${esc(reason)}</span>${esc(extra)}. ` : ''}`
        + 'The agent throws it away and keeps what it had. '
        + '<b>A loop that cannot refuse itself is not a loop.</b>');
      showGarage();
    }
    keepScore(r, true);
    button(st.i + 1 < st.rounds.length ? 'RUN AGAIN' : 'START OVER', true);
    st.playing = false;
    return;
  }
}

function scoreMeters(r, solved, total) {
  const gained = st.first !== null ? st.first - r.official_s : 0;
  const prev = st.i > 0 ? st.rounds[st.i - 1] : null;
  const step = prev ? prev.official_s - r.official_s : 0;
  return [
    { label: 'INTERFACES CLEAN', value: total ? `${solved} / ${total}` : '—',
      tone: solved ? 'good' : '' },
    { label: 'BETTER THAN RUN 1 BY', value: gained > 0.005 ? fx(gained) : '—',
      tone: gained > 0.005 ? 'good' : '' },
    { label: 'SCORE  (lower is better)', value: fx(r.official_s), tone: 'hero', tween: true,
      sub: prev ? (step > 0.005 ? `${fx(step)} better this run`
        : step < -0.005 ? `${fx(-step)} worse this run` : 'unchanged') : 'first run' },
  ];
}

function keepScore(r, promotedView) {
  const tasks = r.tasks || [];
  const solved = tasks.reduce((a, t) => a + (t.solved > 0 ? 1 : 0), 0);
  meters(scoreMeters(r, solved, tasks.length));
  if (promotedView && r.promoted && st.rounds[st.i + 1]) {
    // the payoff: the score falls to what the change actually bought
    tweenScore(r.official_s, st.rounds[st.i + 1].official_s);
  } else {
    tween.from = null; tween.to = r.official_s; tween.t = tween.dur;
    paintTween();
  }
}

function showSamples(r) {
  const pages = r.pages || [];
  if (!pages.length) return showWrittenCode(r);
  const clean = pages.filter(p => p.passed).length;
  const host = work('WHAT THE AGENT BUILT',
    `${clean} of ${pages.length} clean · open any of them and run axe-core yourself`);
  if (!host) return;
  const grid = el('div', 'pages');
  for (const pg of pages) {
    const n = el('a', 'page ' + (pg.passed ? 'ok' : 'no'));
    n.href = 'pages/' + pg.file;
    n.target = '_blank';
    n.rel = 'noopener';
    const rules = (pg.rules || []).map(v => v.id).slice(0, 3).join(', ');
    n.innerHTML = `<span class="page-top"><b>${esc(pg.title || pg.family)}</b>`
      + `<i class="${pg.passed ? 'ok' : 'no'}">${pg.passed ? 'CLEAN'
        : (pg.weighted + ' pts')}</i></span>`
      + `<span class="page-sub">${pg.passed
        ? 'zero violations, every requirement met'
        : esc(rules || (pg.missing || []).join(', ') || 'did not render')}</span>`;
    grid.append(n);
  }
  host.append(grid);
  const note = el('p', 'page-note');
  note.innerHTML = 'Every one of these is a real HTML document this agent wrote. The score is '
    + '<b>axe-core</b> running in Chromium against the rendered page, weighted critical 10 / '
    + 'serious 5 / moderate 2 / minor 1, plus selector checks for the requirements in the spec. '
    + 'No model is anywhere in the judging path.';
  host.append(note);
}

function showWrittenCode(r) {
  const host = work('WHAT THE AGENT WROTE', 'its own output, unedited');
  if (!host) return;
  const box = el('div', 'samples');
  for (const smp of (r.samples || []).slice(0, 3)) {
    const n = el('div', 'sample');
    n.innerHTML = `<div class="sample-top"><span class="${smp.solved ? 'ok' : 'no'}">`
      + `${smp.solved ? 'PASSED' : 'FAILED'}</span> · ${esc(smp.family)}</div>`
      + `<div class="code">${esc((smp.wrote || '').split('\n').slice(0, 10).join('\n'))}</div>`;
    box.append(n);
  }
  host.append(box);
}

function showBlame(r, blame) {
  const host = work('WHERE THE TIME WENT', 'confirmed by replaying each failure');
  if (!host) return;
  const box = el('div', 'gates');
  const max = Math.max(1, ...blame.map(b => b[1].blame_s));
  for (const [role, s] of blame) {
    const p = BY_KEY[role] || { name: role };
    const w = Math.round(100 * s.blame_s / max);
    const n = el('div');
    n.innerHTML = `<div style="display:flex;justify-content:space-between;`
      + `font-family:'Press Start 2P',monospace;font-size:7px;color:var(--${HUE[role] || 'cyan'})">`
      + `<span>${esc(p.name)}</span><span style="color:var(--caption)">${s.n} failures · `
      + `${fx(s.blame_s, 1)}s</span></div>`
      + `<div style="height:8px;background:var(--studio);margin:3px 0 6px">`
      + `<div style="height:100%;width:${w}%;background:var(--${HUE[role] || 'cyan'})"></div></div>`;
    box.append(n);
  }
  if (!blame.length) box.append(el('p', null, 'No component cleared the evidence bar this run.'));
  host.append(box);
}

function showDiff(r) {
  const host = work('THE CHANGE IT MADE TO ITSELF', r.part ? `now ${r.part}` : '');
  if (!host) return;
  const box = el('div', 'code');
  box.innerHTML = (r.diff || '').split('\n').slice(0, 40).map(line => {
    const c = line.startsWith('+++') || line.startsWith('---') ? '' :
      line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' :
      line.startsWith('@@') ? 'at' : '';
    return c ? `<span class="${c}">${esc(line)}</span>` : esc(line);
  }).join('\n');
  host.append(box);
}

// ---------------------------------------------------------------------------------------
// The numbers. A rule-by-run heatmap is the most honest technical view of this task: each row
// is one WCAG rule, each column one run, and you watch specific failures go dark as the
// components that caused them are fixed.
// ---------------------------------------------------------------------------------------
function ruleMatrix(upTo) {
  const rules = new Map();      // rule id -> per-run weighted count
  const totals = [];
  for (let i = 0; i <= upTo && i < st.rounds.length; i++) {
    const pages = st.rounds[i].pages || [];
    let total = 0;
    for (const pg of pages) {
      for (const v of (pg.rules || [])) {
        const w = ({ critical: 10, serious: 5, moderate: 2, minor: 1 })[v.impact] || 1;
        // the row may predate later runs when the season is still growing, so never assume length
        const row = rules.get(v.id) || new Array(st.rounds.length).fill(0);
        row[i] = (row[i] || 0) + w * (v.n || 1);
        rules.set(v.id, row);
        total += w * (v.n || 1);
      }
    }
    totals.push(total);
  }
  return { rules, totals };
}

function showNumbers(upTo, into) {
  const host = into || work('THE NUMBERS', 'weighted violations by WCAG rule, run by run');
  if (!host) return;
  const { rules, totals } = ruleMatrix(upTo);
  if (!rules.size) {
    host.append(el('p', 'page-note', 'No audit detail was captured for these runs.'));
    return;
  }
  const n = st.rounds.length;
  const max = Math.max(1, ...[...rules.values()].flat());

  const wrap = el('div', 'heat');
  const head = el('div', 'heat-row heat-head');
  head.append(el('span', 'heat-rule', 'WCAG RULE'));
  for (let i = 0; i < n; i++) head.append(el('span', 'heat-cell', String(i + 1)));
  head.append(el('span', 'heat-rule', 'TREND'));
  wrap.append(head);

  const ordered = [...rules.entries()].sort((a, b) =>
    b[1].reduce((x, y) => x + y, 0) - a[1].reduce((x, y) => x + y, 0));
  for (const [id, row] of ordered.slice(0, 9)) {
    const line = el('div', 'heat-row');
    line.append(el('span', 'heat-rule', id));
    for (let i = 0; i < n; i++) {
      const v = row[i] || 0;
      const c = el('span', 'heat-cell' + (i > upTo ? ' future' : ''));
      c.style.setProperty('--v', String(Math.min(1, v / max)));
      c.title = `run ${i + 1}: ${v}`;
      c.textContent = i > upTo ? '' : (v ? String(v) : '·');
      line.append(c);
    }
    const first = row.slice(0, upTo + 1).find(x => x > 0) || 0;
    const now = row[upTo] || 0;
    const trend = el('span', 'heat-rule ' + (now === 0 && first > 0 ? 'gone'
      : now < first ? 'down' : now > first ? 'up' : ''));
    trend.textContent = now === 0 && first > 0 ? 'eliminated'
      : now < first ? `${first} → ${now}` : now > first ? `${first} → ${now}` : '—';
    line.append(trend);
    wrap.append(line);
  }

  const foot = el('div', 'heat-row heat-head');
  foot.append(el('span', 'heat-rule', 'TOTAL'));
  for (let i = 0; i < n; i++) {
    const c = el('span', 'heat-cell total');
    c.textContent = i <= upTo ? String(totals[i] ?? 0) : '';
    line_mark(c, st.rounds[i]);
    foot.append(c);
  }
  foot.append(el('span', 'heat-rule', totals.length > 1
    ? `${totals[0]} → ${totals[upTo]}` : ''));
  wrap.append(foot);
  host.append(wrap);

  const note = el('p', 'page-note');
  note.innerHTML = 'Weighted: critical 10, serious 5, moderate 2, minor 1. A gold underline marks '
    + 'a run where a change was kept. These counts come from axe-core running against the pages '
    + 'linked above — open one and check a cell.';
  host.append(note);
}

function line_mark(cell, round) {
  if (round && round.promoted) cell.classList.add('kept');
}

function showOutcome(r) {
  const host = work(r.promoted ? 'KEPT' : 'THROWN AWAY',
    r.promoted ? 'the change is now part of the agent' : 'the agent is unchanged');
  if (!host) return;
  const box = el('div', 'two');
  const left = el('div');
  const gates = (r.gates || []);
  left.innerHTML = '<div class="gates">' + gates.map(g =>
    `<div class="gate on ${g.ok ? 'pass' : 'fail'}"><i>${g.ok ? '✓' : '✗'}</i>`
    + `<span>${esc(GATE_SAYS[g.gate] || g.gate)}</span></div>`).join('') + '</div>';
  const right = el('div');
  const m = r.manifest || {};
  right.innerHTML = '<p style="margin:0 0 6px;font-family:\'VT323\',monospace;font-size:17px;'
    + 'line-height:19px;color:var(--caption)">'
    + (m.root_cause ? `<b style="color:var(--gold)">Its own diagnosis:</b> ${esc(m.root_cause)}` : '')
    + '</p>'
    + (m.predicted_delta_s !== undefined
      ? `<p style="margin:0;font-family:'VT323',monospace;font-size:17px;color:var(--mid)">`
        + `It predicted this would gain ${fx(m.predicted_delta_s)}s. It actually `
        + `${r.d_sealed >= 0 ? 'gained' : 'lost'} ${fx(Math.abs(r.d_sealed))}s on held-out tasks — `
        + `and it is scored on that forecast next run.</p>` : '');
  box.append(left, right);
  host.append(box);
}

// ---------------------------------------------------------------------------------------
// per-frame: reveal tasks and gates in time with the run
// ---------------------------------------------------------------------------------------
S.frame = function (dt) {
  paintHud();
  paintTags(st.phase === 'DIAGNOSE' || st.phase === 'CHANGE' || st.phase === 'GATES'
    || st.phase === 'RESULT' ? (st.rounds[st.i] || {}).role : null);
  if (tween.to !== null && tween.t < tween.dur) { tween.t += dt; paintTween(); }
  if (!st.playing && st.phase !== 'RUN') return;
  st.t += dt;
  const r = st.rounds[st.i];
  if (!r) return;

  if (st.phase === 'RUN') {
    const tasks = r.tasks || [];
    const want = Math.min(tasks.length, Math.floor(st.t / st.dur * tasks.length) + 1);
    while (st.shown < want) {
      const t = tasks[st.shown++];
      const ok = t.solved > 0;
      if (ok) st.solvedNow++;
      const grid = $('taskGrid');
      if (grid) {
        const n = el('div', 'task ' + (ok ? 'ok' : 'no'));
        n.innerHTML = `<i>${ok ? '✓' : '✗'}</i><span>${esc(t.title || t.id)}</span>`;
        grid.append(n);
        grid.parentElement.scrollTop = grid.parentElement.scrollHeight;
      }
      const prevScore = st.i > 0 ? st.rounds[st.i - 1].official_s : null;
      meters([
        { label: 'INTERFACE', value: `${st.shown} / ${tasks.length}` },
        { label: 'PASSED CLEAN', value: String(st.solvedNow), tone: st.solvedNow ? 'good' : '' },
        { label: 'SCORE  (lower is better)', value: '', tone: 'hero', tween: true,
          sub: prevScore === null ? 'first run' : 'from the last run' },
      ]);
    }
    if (st.t >= st.dur) phase('SCORE');
    return;
  }

  if (st.phase === 'GATES') {
    const gates = r.gates || [];
    const want = Math.min(gates.length, Math.floor(st.t / 0.28));
    const list = $('gateList');
    while (st.shown < want && list) {
      const g = gates[st.shown];
      const node = list.children[st.shown];
      if (node) {
        node.classList.add('on', g.ok ? 'pass' : 'fail');
        node.querySelector('i').textContent = g.ok ? '✓' : '✗';
      }
      st.shown++;
      if (!g.ok) { st.t = st.dur; break; }
    }
  }

  if (st.t >= st.dur) {
    const order = ['RUN', 'SCORE', 'DIAGNOSE', 'CHANGE', 'GATES', 'RESULT'];
    const k = order.indexOf(st.phase);
    if (k >= 0 && k < order.length - 1) phase(order[k + 1]);
  }
};

// ---------------------------------------------------------------------------------------
const VIEWS = { track: 'viewTrack' };
// SPEC is not one of these: it is a separate surface that covers the whole viewport
// rather than a panel inside the broadcast's layout.

function paintTabs(which) {
  for (const [k, id] of [['track', 'tabTrack'], ['dash', 'tabDash']]) {
    const t = $(id); if (t) t.classList.toggle('on', k === which);
  }
}

function showView(which) {
  const dash = $('dash');
  if (dash) {
    dash.hidden = which !== 'dash';
    if (which === 'dash') { if (SCR.dash) SCR.dash.show(); st.view = which; paintTabs(which); paintMode(); return; }
    if (SCR.dash) SCR.dash.hide();
  }
  for (const [k, id] of Object.entries(VIEWS)) {
    const n = $(id); if (n) n.hidden = k !== which;
  }
  paintTabs(which);
  st.view = which;
  // the work panel belongs to the run itself; the other two views carry their own detail, and
  // leaving it up under them just prints the same curve or the same table twice on one screen.
  const wk = $('work'); if (wk) wk.hidden = which !== 'track';
  paintMode();
}



function wire() {
  const hold = $('holdBtn');
  if (hold) hold.addEventListener('click', () => setHold(!auto.paused));
  const tabs = [['tabTrack', 'track'], ['tabDash', 'dash']];
  for (const [id, which] of tabs) {
    const t = $(id); if (t) t.addEventListener('click', () => showView(which));
  }
  const go = $('gcGo');
  if (go) go.addEventListener('click', openGarage);
  const back = $('trackBack');
  if (back) back.addEventListener('click', closeGarage);
  const rb = $('regsBtn');
  if (rb) rb.addEventListener('click', () => { if (SCR.ui && SCR.ui.toggleRegs) SCR.ui.toggleRegs(); });
  const tb = $('tryBtn');
  if (tb) tb.addEventListener('click', () => { if (SCR.trial) SCR.trial.open(); });
  document.addEventListener('keydown', ev => {
    if (ev.target && /input|textarea/i.test(ev.target.tagName)) return;
    if (ev.key === ' ') { ev.preventDefault(); setHold(!auto.paused); }
    if (ev.key === '1') showView('track');
    if (ev.key === '2') showView('dash');
    if (ev.key === 'g' || ev.key === 'G') { if (st.garage) closeGarage(); else openGarage(); }
    if (ev.key === 'Escape' && st.garage) closeGarage();
  });
}

// Deterministic entry into any run and phase, so a screenshot or a link can land on a beat.
S.seekTo = function (runIndex, phaseName) {
  st.i = Math.max(0, Math.min(st.rounds.length - 1, runIndex | 0));
  st.levels = levelsAt(st.i);
  st.playing = true;
  paintRig();
  const want = String(phaseName || 'RUN').toUpperCase();
  const order = ['RUN', 'SCORE', 'DIAGNOSE', 'CHANGE', 'GATES', 'RESULT'];
  phase(order.includes(want) ? want : 'RUN');
  // fast-forward the reveals so the beat is fully drawn rather than mid-animation
  if (st.phase === 'RUN') { S.frame(st.dur * 0.75); }
  if (st.phase === 'GATES') { S.frame(st.dur * 0.92); }
};

S.diag = () => ({ story: { phase: st.phase, run: st.i + 1, of: st.rounds.length,
  playing: st.playing, levels: st.levels, shown: st.shown, scene: A && A.sceneName,
  garage: st.garage, pending: !!st.pending } });
})(window.SCR = window.SCR || {});
