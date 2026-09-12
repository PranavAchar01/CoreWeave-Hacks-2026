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
// The loop's own events, out loud. Watching the strip fill is the point of the page; this lets
// you follow it without watching it.
const CUE = n => { if (SCR.audio && SCR.audio.cue) SCR.audio.cue(n); };

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
    } else if (d.rule === 'no_upgrade' || d.rule === 'circuit') {
      // the generation ended without a change: nothing had enough evidence behind it
      say('No change. Nothing had enough evidence behind it, so the agent wrote nothing and keeps what it had.');
      showGarage();
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
function harnessSpec(levels) {
  // the car is the harness: each component that levels up changes a part you can see
  const lv = levels || st.levels, C = SCR.car;
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

// The race, resumed rather than restarted — unless the season has moved to the next run, which
// is a different circuit, built with however much of the improvement has landed by then.
function enterTrack(newRound) {
  if (A.sceneName !== 'run') { A.setScene('run'); return; }
  if (newRound && track.seed !== trackSeed()) { A.setScene('run'); return; }
  if (track.refit) track.refit();
}

// How much of the season's improvement has landed, 0..1. The circuit is built around this:
// early runs race a bare track on a quiet evening, late ones a full house under lights.
function progress() {
  const maxKept = st.rounds.filter(r => r.promoted).length;
  const got = Object.values(st.levels).reduce((a, b) => a + b, 0) - ALL.length;
  return maxKept ? Math.max(0, Math.min(1, got / maxKept)) : 0;
}

// Two runs of this page should not be the same race. Unless a seed was asked for on the URL —
// screenshots and the diagnostic harness need that — every session gets its own salt, so the
// circuits it draws and the way the director covers them are new each time.
let SALT = null;
function salt() {
  if (SALT === null) SALT = (A.params && A.params.seed) ? 0 : (Math.random() * 0x7FFFFFFF) | 0;
  return SALT;
}
// Clamped at run 1: before the first run starts st.i is -1, so the intro used to build a
// circuit nobody ever races, and two seconds later the first run rebuilt a different one. The
// track you see on load is the track run 1 is about to be raced on.
const trackSeed = () => (A.seed + Math.max(0, st.i) * 7 + salt()) | 0;

const track = { name: 'run' };
track.enter = function () {
  pitAbort();
  // A new scene means new cars. The ghost's label was drawn for the old pair earlier in the
  // same frame, so drop it rather than let it hang over the new one until the next repaint.
  const gt = $('ghostTag'); if (gt) gt.hidden = true;
  const seed = trackSeed();
  const circ = SCR.world.makeCircuit(seed);
  // Where this one is: the sky and the ground the world is painted in.
  SCR.world.applyVenue(R, circ.venue);
  const world = SCR.world.build(circ, { detail: progress() });
  track.seed = seed;
  track.spec = harnessSpec();
  track.dd = SCR.car.derive(track.spec);
  track.mesh = SCR.car.build(track.spec, 0);
  track.car = SCR.car.newState();
  SCR.sim.physics(track.car, track.dd, track.spec, circ, 0, {});
  // The car the agent was on run 1, on the same circuit, from the same standing start. It is
  // not a handicap or a target time — it is the run-1 harness put through the same physics, so
  // the gap that opens is exactly the improvement the loop has actually kept.
  track.ghostSpec = harnessSpec(levelsAt(0));
  track.ghostDd = SCR.car.derive(track.ghostSpec);
  track.ghostMesh = SCR.car.build(track.ghostSpec, 0);
  track.ghost = SCR.car.newState();
  SCR.sim.physics(track.ghost, track.ghostDd, track.ghostSpec, circ, 0, {});
  // The director carries its own seed, so the same circuit is covered differently each session.
  track.scene = SCR.trackScene.create({ R, world, car: track.car, ghost: track.ghost,
    seed: (seed ^ 0x5F3759D) | 0 });
  track.scene.ghostActive = ghostWorthShowing();
  track.scene.setMode('AUTO');
  track.circuitName = circ.name;
  track.venue = circ.venue;
  track.shape = circ.shape;
};
track.update = function (dt) {
  const circ = track.scene.circ;
  const lapWas = track.car.lapsDone;
  const cap = pitStep(dt);
  SCR.sim.physics(track.car, track.dd, track.spec, circ, dt,
    { fx: track.scene.fx, speedCap: cap });
  // A pit stop takes the car out of the race for the best part of ten seconds. The ghost was
  // still lapping through all of it, so it came out hundreds of metres AHEAD — and a label
  // reading "the harness before" then sat on a car in front, which is the opposite of what it
  // means. The ghost waits out the stop and is put back on the line with the car afterwards.
  if (pit.state !== 'off') {
    if (track.scene.ghostActive) { track.scene.ghostActive = false; pit.ghostHeld = true; }
  } else if (pit.ghostHeld) {
    pit.ghostHeld = false;
    track.ghost.s = track.car.s; track.ghost.lapsDone = track.car.lapsDone;
    track.ghost.speed = track.car.speed;
    track.scene.ghostActive = ghostWorthShowing();
  }
  if (track.scene.ghostActive) {
    SCR.sim.physics(track.ghost, track.ghostDd, track.ghostSpec, circ, dt, {});
    // The ghost is a lap reference, not a cumulative one. Both cars start every lap together at
    // the line, so what you watch open up is the time this harness gains over the old one in a
    // single lap — and you get to watch it happen again every lap instead of once.
    if (track.car.lapsDone !== lapWas) {
      track.ghost.s = track.car.s;
      track.ghost.lapsDone = track.car.lapsDone;
      track.ghost.lap = track.car.lap;
      if (track.scene.duel) track.scene.duel();
    }
  }
  if (track.car.lapsDone !== lapWas) CUE('lap');
  if (track.car.drsOn !== track.drsWas) { if (track.car.drsOn) CUE('drs'); track.drsWas = track.car.drsOn; }
  SCR.sim.stepSparks(track.scene.fx, dt);
  track.scene.updateCamera(dt);
};
track.render = function () { track.scene.render({ car: track.mesh, ghost: track.ghostMesh }); };

// Nothing to compare against until at least one change has stuck.
function ghostWorthShowing() {
  return Object.values(st.levels).some(v => v > 1);
}

// How far ahead of its old self the agent is, in seconds: the distance between the two cars,
// over the speed the old car is doing. That is what a gap is.
function ghostGap() {
  if (!track.scene || !track.scene.ghostActive || !track.ghost) return null;
  const len = track.scene.circ.len;
  let d = track.car.s - track.ghost.s;
  if (d > len / 2) d -= len; if (d < -len / 2) d += len;
  const v = Math.max(8, track.ghost.speed);
  return { d, s: d / v };
}
// ---------------------------------------------------------------------------------------
// The pit stop.
//
// A kept change is a part fitted to the car, so the car comes in and has it fitted. The lane,
// the box and the openings in the armco are real geometry from world.build; the car is driven
// down them under a limiter by the same physics as everywhere else, with a lateral offset.
// ---------------------------------------------------------------------------------------
const LIMITER = 22, BOX_HOLD = 2.4, BLEND_MAX = 95;   // m/s, seconds, metres to cross the lane
const PIT_DECEL = 5.5;                            // m/s^2 on the way into the box
// Crossing in and out on a straight ramp leaves a kink at each end, because the car's sideways
// speed jumps from nothing to full and back. Smoothstep starts and finishes at zero.
const ease = t => { const k = Math.max(0, Math.min(1, t)); return k * k * (3 - 2 * k); };
const pit = track.pit = { state: 'off', pending: null, t: 0, clock: 0 };

function pitLane() { return track.scene && track.scene.world && track.scene.world.pit; }

// Ask for a stop. It happens the next time the car reaches the pit entry, the way it would.
function callToPits(r) {
  if (!pitLane() || !r || !r.role) return false;
  pit.pending = { role: r.role, part: r.part || 'REVISION', summary: r.diff_summary || '' };
  if (pit.state === 'off') pit.state = 'called';
  return true;
}

function pitAbort() {
  if (pit.thenCall && pit.state !== 'off') { callToGarage(pit.thenCall); }
  pit.thenCall = null;
  pit.state = 'off'; pit.pending = null; pit.fitted = null;
  if (track.car) { track.car.off = 0; track.car.lift = 0; }
  if (track.scene && (track.scene.mode === 'PITLANE' || track.scene.mode === 'STUDIO')) track.scene.setMode('AUTO');
}

// distance from the car to a circuit index, forwards along the lap
function aheadOf(idx) {
  const circ = track.scene.circ;
  let d = idx * circ.step - track.car.s;
  while (d < -circ.len / 2) d += circ.len;
  while (d > circ.len / 2) d -= circ.len;
  return d;
}

// Returns the speed cap to apply this frame, or undefined.
function pitStep(dt) {
  const p = pitLane();
  if (!p || pit.state === 'off') return undefined;
  const car = track.car, lane = p.lane, circ = track.scene.circ;
  // How much road there is to cross the lane in. A car cannot step ten metres sideways in forty
  // metres of track without sliding, so the crossing is spread over as much of the run to the
  // box (and from the box to the exit) as is available, up to a sensible maximum.
  const inRun = Math.max(20, (p.box - p.entry) * circ.step * 0.75);
  const outRun = Math.max(20, (p.exit - p.box) * circ.step * 0.75);
  const blendIn = Math.min(BLEND_MAX, inRun), blendOut = Math.min(BLEND_MAX, outRun);

  if (pit.state === 'called') {
    // wait for the entry to come round; start crossing once it is close
    const d = aheadOf(p.entry);
    if (d > 0 && d < 6) { pit.state = 'enter'; pit.t = 0; pit.clock = 0; }
    // Come down to the limiter on a profile that arrives at it exactly at the entry, rather
    // than standing on the brakes the moment the entry is within range.
    if (d > 0 && d < 170) return Math.sqrt(LIMITER * LIMITER + 2 * PIT_DECEL * d);
    return undefined;
  }

  if (pit.state === 'enter') {
    if (track.scene && track.scene.mode !== 'PITLANE') track.scene.setMode('PITLANE');
    // cross into the lane over the first stretch past the entry, eased at both ends
    const past = -aheadOf(p.entry);
    car.off = lane * ease(past / blendIn);
    // Brake onto the box, not merely to a halt somewhere near it. A flat zero cap thirty metres
    // out just meant the car shed speed at whatever rate it could and parked where it ran out —
    // seventeen metres short of the stall, every time. The cap follows v = sqrt(2ad) instead, so
    // it is still moving at ten metres out and reaches zero at the box.
    const d = aheadOf(p.box);
    if (d <= 0.3 || (car.speed < 0.7 && d < 2.5)) {
      // park it on the mark rather than a few centimetres either side of it
      car.s = ((p.box * circ.step) % circ.len + circ.len) % circ.len;
      car.speed = 0; car.off = lane;
      pit.state = 'stopped'; pit.t = 0;
      return 0;
    }
    if (d > 0 && d < 60) return Math.min(LIMITER, Math.sqrt(2 * PIT_DECEL * d));
    return LIMITER;
  }

  if (pit.state === 'stopped') {
    car.off = lane;
    pit.t += dt; pit.clock = pit.t;
    // On the jacks while it is worked on, and dropped on release.
    const up = Math.min(1, pit.t / 0.35) * (pit.t > BOX_HOLD - 0.3 ? Math.max(0, (BOX_HOLD - pit.t) / 0.3) : 1);
    car.lift = 0.11 * up;
    // The part goes on halfway through the stop, so the car that leaves is the new one.
    if (pit.t > BOX_HOLD * 0.5 && pit.pending) {
      const done = pit.pending;
      st.levels = levelsAt(st.i + 1);
      paintRig(done.role);
      track.refit();
      pit.fitted = done; pit.pending = null;
      paintRail(done.role);
      showSting(done.role, st.levels[done.role] || 1, done.summary);
      CUE('kept');
    }
    if (pit.t >= BOX_HOLD) { pit.state = 'exit'; pit.t = 0; car.lift = 0; }
    return 0;
  }

  if (pit.state === 'exit') {
    const d = aheadOf(p.exit);
    car.off = lane * ease(d / blendOut);
    pit.t += dt;
    if (pit.t > 1.6 && track.scene && track.scene.mode === 'PITLANE') track.scene.setMode('AUTO');
    if ((d <= 0.6 && d > -30) || pit.t > 12) {
      car.off = 0; car.lift = 0; pit.state = 'off'; pit.fitted = null;
      if (pit.thenCall) { callToGarage(pit.thenCall); pit.thenCall = null; }
    }
    // Hold the limiter while any part of the car is still off the racing line, then let it go
    // rather than dropping the cap the instant the exit line passes.
    return Math.abs(car.off) > Math.abs(lane) * 0.06 ? LIMITER : undefined;
  }
  return undefined;
}

function paintPit() {
  const host = $('rhPit'); if (!host) return;
  const on = pit.state !== 'off';
  host.hidden = !on;
  // The stop owns the bottom of the screen while it is happening; an offer to go and read about
  // a change can wait until the car is back out.
  const call = $('garageCall');
  if (call) {
    if (on) call.hidden = true;
    else if (st.pending && !st.garage) call.hidden = false;
  }
  if (!on) return;
  const what = pit.pending || pit.fitted || {};
  const p = BY_KEY[what.role] || { name: what.role || '' };
  const label = pit.state === 'called' ? 'BOX BOX'
    : pit.state === 'enter' ? 'PIT ENTRY'
    : pit.state === 'stopped' ? 'IN THE BOX' : 'PIT EXIT';
  host.className = 'rh-pit' + (pit.state === 'exit' ? ' done' : '');
  put('pitState', label);
  put('pitClock', pit.state === 'stopped' ? pit.clock.toFixed(1) + 's'
    : pit.state === 'exit' ? BOX_HOLD.toFixed(1) + 's' : '');
  const n = $('pitWhat');
  const html = `<b>${esc(p.name)}</b> \u2014 ${esc(what.summary || 'a revision to the harness')}`;
  if (n && n.dataset.h !== html) { n.innerHTML = html; n.dataset.h = html; }
}

// A kept change reaches the car without stopping it: new bodywork, same lap, same corner.
track.refit = function () {
  if (!track.scene) return;
  const spec = harnessSpec();
  if (JSON.stringify(spec) === JSON.stringify(track.spec)) return;
  track.spec = spec;
  track.dd = SCR.car.derive(spec);
  track.mesh = SCR.car.build(spec, 0);
  track.scene.ghostActive = ghostWorthShowing();
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
// ---------------------------------------------------------------------------------------
// Sectors. Not a grouping invented for the picture: the loop read its own ledger as a
// component x family matrix and found the families separate into two populations, one
// limited by RETRIEVAL and one by VERIFICATION. Those are S1 and S2. S3 is what fell
// outside the partition. loop/state/sides.json is where the split comes from.
// ---------------------------------------------------------------------------------------
const SECTORS = [
  { name: 'FORMS & TABLES', families: ['checkout', 'invoices', 'signup', 'stepper'] },
  { name: 'COMPONENTS', families: ['dialog', 'gallery', 'pricing', 'dashboard', 'search', 'settings', 'tabs'] },
  { name: 'SITE CHROME', families: [] },        // anything the partition did not cover
];
const SECTOR_OF = (() => {
  const m = {};
  SECTORS.forEach((s, i) => s.families.forEach(f => { m[f] = i; }));
  return f => (m[f] === undefined ? 2 : m[f]);
})();

function sectorOfTask(r, k) {
  const p = pageFor(r, k);
  return SECTOR_OF(p && p.family);
}

// clean / total per sector for one run, optionally only as far as the run has got
function sectorStats(r, upTo) {
  const out = SECTORS.map(() => ({ n: 0, clean: 0 }));
  const tasks = (r && r.tasks) || [];
  for (let k = 0; k < tasks.length; k++) {
    const si = sectorOfTask(r, k);
    out[si].n++;
    if ((upTo === undefined || k < upTo) && tasks[k].solved > 0) out[si].clean++;
  }
  return out;
}

// F1's own colours: purple is the best that sector has ever been, green is better than where
// it started, yellow is no better.
function sectorTone(si, runIdx, stats) {
  const first = sectorStats(st.rounds[0])[si];
  let best = -1;
  for (let i = 0; i < runIdx; i++) best = Math.max(best, sectorStats(st.rounds[i])[si].clean);
  const now = stats[si].clean;
  if (now > best && now > first.clean) return 'purple';
  if (now > first.clean) return 'green';
  return now ? 'yellow' : 'none';
}

const hud = { built: false, n: -1, cells: [], last: {}, fastSig: '' };

// Only write to the DOM when the text actually changed: this runs every frame.
function put(id, txt, cls) {
  const el_ = $(id); if (!el_) return;
  if (hud.last[id] !== txt) { el_.textContent = txt; hud.last[id] = txt; }
  if (cls !== undefined && el_.className !== cls) el_.className = cls;
}

// The audit result for one interface, keyed the way the bundle keys it. tasks[] carries the
// verdict; pages[] carries what the browser actually found.
function pageFor(r, k) {
  const t = (r && r.tasks) ? r.tasks[k] : null;
  if (!t) return null;
  const pages = (r && r.pages) || [];
  return pages.find(p => p.id === t.id) || pages[k] || null;
}

// "color-contrast x6 serious" — the rule the page broke, in axe's own words.
function ruleText(p) {
  if (!p) return '';
  const bits = (p.rules || []).map(x => `${x.id}${x.n > 1 ? ' \u00D7' + x.n : ''}`);
  for (const m of (p.missing || [])) bits.push(`missing: ${m}`);
  return bits.join(' \u00B7 ');
}

function stripFor(tasks, r) {
  const host = $('rhStrip'); if (!host) return;
  if (hud.n !== tasks.length) {
    host.textContent = ''; hud.cells = [];
    for (let k = 0; k < tasks.length; k++) {
      const n = el('div', 'rh-cell');
      n.dataset.k = String(k);
      n.addEventListener('mouseenter', () => showTip(k));
      n.addEventListener('mouseleave', hideTip);
      host.append(n); hud.cells.push(n);
    }
    hud.n = tasks.length;
  }
  void r;
}

// Any cell answers for itself: which brief it was, whether it passed, and what the browser
// found if it did not.
function showTip(k) {
  const tip = $('rhTip'), cell = hud.cells[k]; if (!tip || !cell) return;
  const r = st.rounds[st.i]; if (!r) return;
  const t = (r.tasks || [])[k]; if (!t) return;
  const revealed = st.phase !== 'RUN' || k < st.shown;
  const p = pageFor(r, k), ok = t.solved > 0;
  tip.textContent = '';
  const si = sectorOfTask(r, k);
  const head = el('div', 't-head', `LAP ${k + 1} \u00B7 S${si + 1} ${SECTORS[si].name}`
    + ` \u00B7 ${(t.title || t.id).toUpperCase()}`);
  tip.append(head);
  if (!revealed) {
    tip.append(el('div', 't-rule', 'not built yet this run'));
  } else {
    tip.append(el('div', 't-verdict ' + (ok ? 'ok' : 'no'),
      ok ? '\u2713 CLEAN \u00B7 NO VIOLATIONS' : '\u2717 FAILED'
        + (p && p.weighted ? ` \u00B7 ${p.weighted} WEIGHTED` : '')));
    const why = ruleText(p);
    if (why) { const n = el('div', 't-rule'); n.innerHTML = `<i>${esc(why)}</i>`; tip.append(n); }
    if (p && p.file) tip.append(el('div', 't-file', `pages/${p.file}`));
  }
  tip.hidden = false;
  // pin it above the cell, kept inside the picture
  const box = cell.getBoundingClientRect(), stage = $('viewTrack').getBoundingClientRect();
  const w = tip.offsetWidth || 200;
  let left = box.left - stage.left + box.width / 2 - w / 2;
  left = Math.max(6, Math.min(stage.width - w - 6, left));
  tip.style.left = left + 'px';
  tip.style.top = Math.max(6, box.top - stage.top - tip.offsetHeight - 8) + 'px';
}
function hideTip() { const tip = $('rhTip'); if (tip) tip.hidden = true; }

// ---------------------------------------------------------------------------------------
// The timing tower, and the championship.
//
// The loop only reports a component once its blame clears the evidence bar, so most runs name
// exactly one. That is the honest shape of the data and the tower says so rather than padding
// itself out to ten rows of zeroes.
// ---------------------------------------------------------------------------------------
function blameTower(r) {
  const rows = Object.entries(r.standings || {})
    .filter(([, v]) => v && v.n)
    .sort((a, b) => b[1].blame_s - a[1].blame_s);
  const host = $('rhStand');
  host.textContent = '';
  const h = el('div', 'st-head');
  h.innerHTML = `<span>BLAME</span><i>RUN ${st.i + 1}</i>`;
  host.append(h);
  if (!rows.length) {
    host.append(el('div', 'st-none',
      'No component cleared the evidence bar. Nothing is blamed, and nothing changes.'));
    return;
  }
  const cols = el('div', 'st-cols');
  cols.innerHTML = '<span></span><span>COMPONENT</span><span>LOST</span><span>CASES</span><span></span>';
  host.append(cols);
  rows.forEach(([key, v], i) => {
    const p = BY_KEY[key] || { name: key };
    const n = el('div', 'st-row' + (i === 0 ? ' lead' : '') + (key === r.role ? ' chosen' : ''));
    n.innerHTML = `<b>${i + 1}</b><span>${esc(p.name)}</span>`
      + `<i>${fx(v.blame_s, 1)}s</i><u>${v.n}</u><span></span>`;
    host.append(n);
  });
  const quiet = ALL.length - rows.length;
  host.append(el('div', 'st-note',
    `${quiet} others: no confirmed incidents this run. Blame is only recorded when correcting `
    + 'the component actually flips the failure.'));
}

// Across the season so far: how often each component was blamed, and how often the change
// written against it survived the gates.
function championship(upTo) {
  const tally = {};
  for (let i = 0; i < upTo; i++) {
    const r = st.rounds[i]; if (!r || !r.role) continue;
    const t = tally[r.role] || (tally[r.role] = { blamed: 0, kept: 0, lost: 0 });
    t.blamed++;
    if (r.promoted) t.kept++;
    const sd = (r.standings || {})[r.role];
    if (sd) t.lost = Math.max(t.lost, sd.blame_s);
  }
  const rows = Object.entries(tally).sort((a, b) => b[1].kept - a[1].kept || b[1].blamed - a[1].blamed);
  const host = $('rhStand');
  host.textContent = '';
  const h = el('div', 'st-head');
  h.innerHTML = `<span>CHAMPIONSHIP</span><i>AFTER RUN ${upTo}</i>`;
  host.append(h);
  if (!rows.length) { host.append(el('div', 'st-none', 'No component has been changed yet.')); return; }
  const cols = el('div', 'st-cols');
  cols.innerHTML = '<span></span><span>COMPONENT</span><span>BLAMED</span><span>KEPT</span><span>LV</span>';
  host.append(cols);
  rows.forEach(([key, t], i) => {
    const p = BY_KEY[key] || { name: key };
    const n = el('div', 'st-row' + (i === 0 ? ' lead' : '') + (t.kept ? ' kept' : ''));
    n.innerHTML = `<b>${i + 1}</b><span>${esc(p.name)}</span>`
      + `<i>${t.blamed}</i><u>${t.kept}</u><span>L${st.levels[key] || 1}</span>`;
    host.append(n);
  });
}

function standings(r) {
  const host = $('rhStand'); if (!host) return;
  // Up while the loop is working out the cause and acting on it; the championship between runs.
  // Down while it is building, so the picture is clean when there is nothing to rank.
  const live = ['DIAGNOSE', 'SELECT', 'CHANGE', 'GATES'].includes(st.phase);
  const table = st.phase === 'RESULT' || st.phase === 'INTRO';
  host.hidden = !(r && (live || table));
  if (host.hidden) { host.dataset.sig = ''; return; }
  const sig = live ? `b${st.i}` : `c${st.i}|${st.phase}`;
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;
  if (live) blameTower(r); else championship(st.i + 1);
}

function sectors(r, tasks) {
  const host = $('rhSectors'); if (!host) return;
  if (!r || !tasks.length) { host.hidden = true; return; }
  host.hidden = false;
  const upTo = st.phase === 'RUN' ? st.shown : undefined;
  const stats = sectorStats(r, upTo);
  const sig = `${st.i}|${stats.map(x => x.clean + '/' + x.n).join(',')}|${st.phase === 'RUN' ? 'r' : 's'}`;
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;
  host.textContent = '';
  SECTORS.forEach((sec, i) => {
    // A sector only earns a colour once the run has been through all of it.
    const done = st.phase !== 'RUN' || st.shown >= tasks.length;
    const tone = done ? sectorTone(i, st.i, stats) : 'none';
    const n = el('div', 'rh-sec ' + tone);
    n.innerHTML = `<b>S${i + 1}</b><span>${esc(sec.name)}</span>`
      + `<i>${stats[i].clean}/${stats[i].n}</i><u></u>`;
    host.append(n);
  });
}

// The purple flag, and only on a genuine season best.
function fastestLap(r) {
  const host = $('rhFastest'); if (!host) return;
  // Run 1 is trivially the best there has been, and flashing the flag for it would cheapen
  // every time it is raised afterwards.
  const show = r && st.i > 0 && st.phase !== 'RUN' && r.official_s !== undefined
    && st.rounds.slice(0, st.i).every(x => x.official_s > r.official_s);
  const sig = show ? `${st.i}` : '';
  if (hud.fastSig === sig) return;
  hud.fastSig = sig;
  host.hidden = !show;
  if (show) put('rhFastestVal', `${fx(r.official_s)} \u00B7 SEASON BEST`);
}

// ---------------------------------------------------------------------------------------
// Project a point in the world onto the picture, in stage pixels. The canvas letterboxes
// inside its box (object-fit: contain), so the buffer has to be mapped through the contained
// rect rather than treated as a straight percentage of the box.
// ---------------------------------------------------------------------------------------
const proj = { box: null, at: 0, cv: [0, 0, 0] };
function project(x, y, z) {
  const cam = R.cam, W = R.W, H = R.H;
  R.toView(x, y, z, proj.cv);
  const vz = proj.cv[2];
  if (vz <= 0.25) return null;                      // behind the camera
  const focal = (H / 2) / Math.tan((cam.fov * Math.PI / 180) / 2);
  const sx = W / 2 + proj.cv[0] * focal / vz;
  const sy = H / 2 - proj.cv[1] * focal / vz;
  if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) return null;
  const now = E.time;
  if (!proj.box || now - proj.at > 0.5) {           // layout read, but not every frame
    const n = $('viewTrack'); if (!n) return null;
    const r = n.getBoundingClientRect();
    proj.box = { w: r.width, h: r.height }; proj.at = now;
  }
  const scale = Math.min(proj.box.w / W, proj.box.h / H);
  return { x: (proj.box.w - W * scale) / 2 + sx * scale,
           y: (proj.box.h - H * scale) / 2 + sy * scale, z: vz };
}

// What each visible part of the car is actually made of, in harness terms. The mapping is
// harnessSpec() read backwards, so the caption can only ever say what the car is really built
// from.
const PART_IS = {
  frontWing: lv => `${lv.AERO > 1 ? lv.AERO + ' elements' : 'a single element'} \u2014 how much context it assembles`,
  rearWing: lv => `set for ${lv.AERO > 2 ? 'downforce' : 'low drag'} \u2014 the same retrieval budget, seen from behind`,
  floor: lv => `${lv.DATA > 1 ? 'sealed' : 'flat'} \u2014 what it checks before it submits`,
  engine: lv => `${lv.POWER_UNIT > 1 ? 'a tuned checkpoint' : 'the base model'} \u2014 the model doing the work`,
  tyres: lv => `${lv.TYRES > 2 ? 'soft' : lv.TYRES > 1 ? 'medium' : 'hard'} \u2014 how boldly it decodes`,
  drs: lv => (lv.SIMULATOR > 1 ? 'open on the straights \u2014 the practice set it mined for itself'
    : '<i>not fitted \u2014 it has not earned a curriculum yet</i>'),
  brakes: lv => `${lv.PIT_CREW > 1 ? 'uprated' : 'standard'} \u2014 how a change is installed and smoke-tested`,
};

// Ten bars, one per component, height by level. A status readout that happens to celebrate.
// The flare has to outlive the frame that raised it, or the next repaint takes it straight
// back off again.
const rail = { built: false, sig: '', bump: '', until: 0 };
function paintRail(bumped) {
  const host = $('rhRail'); if (!host) return;
  if (bumped) { rail.bump = bumped; rail.until = E.time + 1.8; }
  if (rail.bump && E.time > rail.until) rail.bump = '';
  bumped = rail.bump;
  if (!rail.built) {
    rail.built = true;
    for (const p of ALL) {
      const b = el('i'); b.dataset.k = p.key;
      b.style.setProperty('--hue', `var(--${HUE[p.key] || 'cyan'})`);
      b.title = p.name;
      host.append(b);
    }
  }
  // Scale against the highest level any component could reach this season, not against the
  // current leader: otherwise promoting one component visibly shrinks all the others, which
  // reads as them getting worse when nothing happened to them at all.
  const ceiling = Math.max(2, 1 + st.rounds.filter(x => x.promoted).length);
  const max = ceiling;
  const sig = ALL.map(p => st.levels[p.key] || 1).join(',') + '|' + (bumped || '');
  if (rail.sig === sig) return;
  rail.sig = sig;
  for (const b of host.children) {
    const lv = st.levels[b.dataset.k] || 1;
    b.style.height = (22 + 78 * (lv - 1) / (max - 1 || 1)).toFixed(0) + '%';
    b.classList.toggle('up', b.dataset.k === bumped);
  }
}

// The part going on, while it goes on: what changed on the car, and the clock running down.
const SPEC_LABEL = { frontWing: 'front wing', rearWing: 'rear wing', floor: 'floor',
  engine: 'power unit', tyres: 'tyres', drs: 'DRS', fin: 'fin', brakes: 'brakes',
  gearbox: 'gearbox', ballast: 'ballast', sidepods: 'sidepods' };
function fitPanel() {
  const host = $('pitFit'); if (!host) return;
  const on = pit.state === 'stopped' || pit.state === 'exit';
  host.hidden = !on;
  if (!on) { host.dataset.sig = ''; return; }
  const before = harnessSpec(levelsAt(st.i)), after = harnessSpec(levelsAt(st.i + 1));
  const k = Object.keys(after).find(key => String(after[key]) !== String(before[key]));
  const sig = `${st.i}|${k}`;
  if (host.dataset.sig !== sig) {
    host.dataset.sig = sig;
    put('pfPart', k ? (SPEC_LABEL[k] || k).toUpperCase() : 'SETUP');
    put('pfFrom', k ? String(before[k]) : '\u2014');
    put('pfTo', k ? String(after[k]) : '\u2014');
  }
  const bar = $('pfBar');
  if (bar) bar.style.width = Math.round(100 * Math.min(1, pit.clock / BOX_HOLD)) + '%';
}

// The sting. Raised once, at the moment the part is actually fitted.
const sting = { timer: 0 };
function showSting(role, level, summary) {
  const n = $('rhWipe'); if (!n) return;
  const p = BY_KEY[role] || { name: role || '' };
  put('wipeName', p.name);
  put('wipeLv', `L${level}`);
  const w = $('wipeWhat');
  if (w) w.textContent = summary || '';
  n.hidden = false;
  n.classList.remove('on');
  void n.offsetWidth;                     // restart the animation rather than reuse the old one
  n.classList.add('on');
  clearTimeout(sting.timer);
  sting.timer = setTimeout(() => { n.classList.remove('on'); n.hidden = true; }, 2700);
}

// The showcase caption: the part in shot, and the component it belongs to.
function detailCaption() {
  const n = $('rhDetail'); if (!n) return;
  const sp = track.scene && track.scene.detail;
  const on = sp && st.view === 'track' && !st.garage && $('rhFastest').hidden;
  if (!on) { if (!n.hidden) n.hidden = true; n.dataset.sig = ''; return; }
  const owner = BY_KEY[sp.key] || { name: sp.key, does: '' };
  const lv = st.levels[sp.key] || 1;
  const sig = `${sp.part}|${lv}`;
  n.hidden = false;
  if (n.dataset.sig === sig) return;
  n.dataset.sig = sig;
  put('rdPart', sp.label);
  put('rdOwner', `${owner.name} \u00B7 L${lv}`);
  const d = $('rdDoes');
  const html = (PART_IS[sp.part] || (() => owner.does))(st.levels);
  if (d && d.dataset.h !== html) { d.innerHTML = html; d.dataset.h = html; }
}

// The ghost is the same agent one season earlier, not a rival. Say so, on the car.
// What the tag decided and why, so a question about it can be answered rather than guessed at.
const ghostDbg = { gap: null, why: 'init' };
function ghostTag() {
  const n = $('ghostTag'); if (!n) return;
  const sc = track.scene;
  const on = sc && sc.ghostActive && track.ghost && st.view === 'track' && !st.garage;
  if (!on) { ghostDbg.why = 'no ghost'; ghostDbg.gap = null; if (!n.hidden) n.hidden = true; return; }
  // The tag has to be unmistakably on the ghost. Two ways it was not: the ghost has to actually
  // be behind (a ghost that has got ahead is not "the harness before" any more), and the two
  // cars have to be far enough apart on screen that the label cannot read as belonging to the
  // one in front.
  const circ = sc.circ, L = circ.len;
  let gap = track.car.s - track.ghost.s;
  if (gap > L / 2) gap -= L; if (gap < -L / 2) gap += L;
  ghostDbg.gap = gap;
  if (gap < 6) { ghostDbg.why = 'not behind'; if (!n.hidden) n.hidden = true; return; }
  // a little above the roll hoop, and only while it is close enough to read
  const p = project(track.ghost.x, 1.5, track.ghost.z);
  if (!p || p.z > 140) { ghostDbg.why = p ? 'too far' : 'off camera'; if (!n.hidden) n.hidden = true; return; }
  const pc = project(track.car.x, 1.5, track.car.z);
  // proportional to the picture, so the rule is the same on a phone and on a wall
  const apart = Math.max(44, (proj.box ? proj.box.w : 900) * 0.055);
  if (pc && Math.hypot(p.x - pc.x, p.y - pc.y) < apart) { ghostDbg.why = 'too close to the car'; if (!n.hidden) n.hidden = true; return; }
  ghostDbg.why = 'shown';
  n.hidden = false;
  // Keep it in the picture: the tag is centred on the car and would otherwise hang off the
  // edge when the ghost is near the side of frame.
  const w = n.offsetWidth || 130, h = n.offsetHeight || 30;
  const box = proj.box || { w: 0, h: 0 };
  const x = Math.max(w / 2 + 4, Math.min(box.w - w / 2 - 4, p.x));
  const y = Math.max(h + 4, Math.min(box.h - 4, p.y));
  n.style.left = x.toFixed(1) + 'px';
  n.style.top = y.toFixed(1) + 'px';
  n.style.opacity = p.z > 105 ? String(Math.max(0, (140 - p.z) / 35)) : '1';
}

// The caption under the strip: the interface in progress, and what happened to it.
function caption(r, tasks) {
  const n = $('rhCap'); if (!n) return;
  let html = '';
  if (r && tasks.length) {
    if (st.phase === 'RUN' && st.shown > 0) {
      const k = st.shown - 1, t = tasks[k], p = pageFor(r, k), ok = t.solved > 0;
      const why = ok ? '' : ruleText(p);
      html = `LAP ${k + 1} \u00B7 <b>${esc((t.title || t.id).toUpperCase())}</b> \u00B7 `
        + (ok ? '<span class="ok">CLEAN</span>'
              : `<span class="no">FAILED</span>${why ? ` \u00B7 <span class="why">${esc(why)}</span>` : ''}`);
    } else if (st.phase !== 'RUN') {
      const clean = tasks.reduce((a, t) => a + (t.solved > 0 ? 1 : 0), 0);
      html = `RUN ${st.i + 1} COMPLETE \u00B7 <b>${clean} OF ${tasks.length}</b> CLEAN `
        + '\u00B7 HOVER A LAP FOR WHAT THE BROWSER FOUND';
    } else {
      html = 'STANDING BY';
    }
  }
  if (hud.cap !== html) { n.innerHTML = html; hud.cap = html; }
}

// What is actually different about the agent since run 1. Quiet, and only ever the components
// that really moved.
function sinceRunOne() {
  const host = $('rhSince'); if (!host) return;
  const first = st.rounds[0], r = st.rounds[st.i];
  const moved = ALL.filter(p => (st.levels[p.key] || 1) > 1);
  if (st.i < 1 || !first || !moved.length) { host.hidden = true; host.dataset.sig = ''; return; }
  const scored = r && st.phase !== 'RUN';
  const nowClean = scored ? (r.tasks || []).reduce((a, t) => a + (t.solved > 0 ? 1 : 0), 0)
    : (st.phase === 'RUN' ? st.solvedNow : null);
  const firstClean = (first.tasks || []).reduce((a, t) => a + (t.solved > 0 ? 1 : 0), 0);
  const total = (first.tasks || []).length;
  const sig = `${st.i}|${st.phase === 'RUN' ? 'r' : 's'}|${nowClean}|${moved.map(p => p.key + st.levels[p.key]).join(',')}`;
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;
  host.hidden = false;
  host.textContent = '';
  host.append(el('div', 's-it', `ITERATION ${st.i + 1} OF ${st.rounds.length}`));
  const parts = moved.map(p => `<b>${esc(p.name)}</b> L1\u2192L${st.levels[p.key]}`).join('  ');
  const a = el('div', 's-line s-parts');
  a.innerHTML = `<span>changed</span><b>${parts}</b>`;
  host.append(a);
  if (nowClean !== null) {
    const b = el('div', 's-line');
    b.innerHTML = `<span>clean</span><b><i>${firstClean}</i> \u2192 <em>${nowClean}</em> of ${total}</b>`;
    host.append(b);
  }
  if (scored) {
    const d = first.official_s - r.official_s;
    const cc = el('div', 's-line');
    cc.innerHTML = `<span>held-out</span><b><i>${fx(first.official_s)}</i> \u2192 `
      + `<em>${fx(r.official_s)}</em> (${d >= 0 ? '\u2212' : '+'}${fx(Math.abs(d))})</b>`;
    host.append(cc);
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

  put('rhCircuit', (track.circuitName || 'SEALED CIRCUIT')
    + (track.venue ? ' \u00B7 ' + track.venue.name : ''));
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

  // How far ahead of the run-1 harness the car is, right now, on this circuit.
  const gapRow = $('rhGapRow'), gap = ghostGap();
  const gapReady = gap && Math.abs(gap.d) > 4;
  if (gapRow) gapRow.hidden = !gapReady;
  if (gapReady) {
    put('rhGap', (gap.s >= 0 ? '+' : '\u2212') + fx(Math.abs(gap.s)) + 's', gap.s < -0.02 ? 'behind' : '');
  }

  detailCaption();
  ghostTag();
  paintPit();
  fitPanel();
  paintRail();
  standings(r);
  sectors(r, tasks);
  fastestLap(r);
  sinceRunOne();
  caption(r, tasks);
  stripFor(tasks, r);
  for (let k = 0; k < hud.cells.length; k++) {
    const t = tasks[k];
    const revealed = st.phase === 'RUN' ? k < st.shown : true;
    const want = 'rh-cell s' + sectorOfTask(r, k)
      + (revealed ? (t.solved > 0 ? ' ok' : ' no') : '')
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
  // A stop that has been called but not served holds the next run, the way a race does not
  // restart until the car has come back out.
  if (pit.state !== 'off') { scheduleNext(700); return; }
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
    if (!st.garage) enterTrack(true);
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
    // A run that wrote nothing goes to the result. A run that wrote something but exported no
    // diff text still has a change to describe and still has ten gates to clear — bailing to
    // RESULT on a missing diff took the gates down with it, so the ten checks the whole thing
    // rests on never played at all during normal viewing.
    if (!r.role && !r.diff_summary) { phase((r.gates || []).length ? 'GATES' : 'RESULT'); return; }
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
      // The part is fitted in the box, not in mid-air: call the car in and let the stop apply
      // it. If there is no pit lane on this circuit, fit it where it stands.
      if (!st.garage && callToPits(r)) {
        st.dur = 14;                     // hold the result until the stop has been served
        pit.thenCall = r;                // the garage is offered after the stop, not over it
      } else {
        st.levels = levelsAt(st.i + 1);
        paintRig(r.role);
        if (!st.garage) enterTrack();
      }
      if (!pit.thenCall) callToGarage(r);
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
      CUE('refused');
      say(`Rejected. ${reason ? `<span class="bad">${esc(reason)}</span>${esc(extra)}. ` : ''}`
        + 'The agent throws it away and keeps what it had. '
        + '<b>A loop that cannot refuse itself is not a loop.</b>');
      showGarage();
    }
    keepScore(r, true);
    button(st.i + 1 < st.rounds.length ? 'RUN AGAIN' : 'START OVER', true);
    st.playing = false;
    // RESULT is the end of the phase list, so the frame loop stops advancing here. Nothing
    // re-armed the run timer, which meant the season played exactly one run and stood still
    // for ever after. Arm it: the loop runs on its own or it is not a loop.
    scheduleNext(Math.round(st.dur * 1000));
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
  if (!r.diff) {
    // No diff text in the bundle: say what the change was rather than print an empty box.
    const p = el('p', 'page-note');
    p.innerHTML = `<b>${esc((BY_KEY[r.role] || { name: r.role || '' }).name)}</b> \u2014 `
      + `${esc(r.diff_summary || 'a revision')}. The diff itself is not in this export; the `
      + 'change was written against that component\u2019s own files and is in the signed chain.';
    host.append(p);
    return;
  }
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
// What the car is doing, in the terms the synth needs. Read straight off the same state the
// renderer draws from, so the sound cannot describe a different car than the one on screen.
function feedAudio(dt) {
  if (!SCR.audio || !SCR.audio.isOn()) return;
  const on = A.sceneName === 'run' && track.car && track.dd && st.view === 'track' && !st.garage;
  SCR.audio.update(on ? {
    active: true,
    speed: track.car.speed,
    topSpeed: track.dd.topSpeed,
    gears: track.dd.gears,
    braking: track.car.braking,
    drs: track.car.drsOn,
    steer: track.car.steer,
    pit: pit.state === 'off' ? null : pit.state,
    lift: track.car.lift,
  } : { active: false }, dt);
}

S.frame = function (dt) {
  feedAudio(dt);
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
      CUE(ok ? 'pageOk' : 'pageBad');
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
      CUE(g.ok ? 'gateOk' : 'gateBad');
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
  const snd = $('sndBtn');
  if (snd) {
    if (!SCR.audio || !SCR.audio.available()) snd.hidden = true;
    else {
      const paint = on => { snd.setAttribute('aria-pressed', on ? 'true' : 'false');
        snd.lastChild.nodeValue = on ? 'MUTE \u00B7 M' : 'SOUND OFF';
        snd.title = on ? 'mute (M)' : 'sound on (M)'; };
      paint(false);
      snd.addEventListener('click', () => {
        const on = SCR.audio.toggle();
        paint(on);
        try { localStorage.setItem('scrutineer.sound', on ? '1' : '0'); } catch (e) { /* private window */ }
      });
      // A stored yes is remembered, but it still cannot start the audio on its own — the
      // browser wants a gesture on this page, so the first click is what actually begins it.
      try { if (localStorage.getItem('scrutineer.sound') === '1') snd.classList.add('wants'); } catch (e) { /* ignore */ }
    }
  }
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
    if (ev.key === 'm' || ev.key === 'M') { const b = $('sndBtn'); if (b) b.click(); }
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

S.diag = () => ({ audio: SCR.audio ? SCR.audio.diag() : null,
  story: { phase: st.phase, run: st.i + 1, of: st.rounds.length,
  playing: st.playing, levels: st.levels, shown: st.shown, scene: A && A.sceneName,
  ghostTag: { ...ghostDbg },
  garage: st.garage, pending: !!st.pending } });
})(window.SCR = window.SCR || {});
