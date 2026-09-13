// ============================================================================
// SCR.timeline — the car, across the whole season, under your thumb.
//
// One scrubber. Drag it and the harness rebuilds at that generation: the parts
// the loop had earned by then, the score it was running, and what the change
// that generation actually altered on the car. Stubbed by design — it reads the
// recorded season, so it is the same ten runs every time and nothing waits on a
// model.
// ============================================================================
(function (SCR) {
'use strict';
const T = SCR.timeline = {};
const $ = id => document.getElementById(id);
const el = (t, c, txt) => { const n = document.createElement(t); if (c) n.className = c;
  if (txt !== undefined) n.textContent = txt; return n; };
const esc = s => String(s === undefined || s === null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// role key -> the name on screen and the part of the car it moves
const PARTS = [
  ['AERO', 'RETRIEVAL', 'front wing, rear wing, fin', 'AERO'],
  ['DATA', 'VERIFICATION', 'floor', 'DATA'],
  ['TYRES', 'SAMPLING', 'compound', 'TYRES'],
  ['POWER_UNIT', 'MODEL', 'engine', 'POWER'],
  ['STRATEGIST', 'BUDGET', 'gearbox', 'STRATEGY'],
  ['SIMULATOR', 'CURRICULUM', 'DRS', 'SIM'],
  ['PIT_CREW', 'DEPLOY', 'brakes', 'TOOLS'],
  ['ENGINEER', 'PROPOSER', 'pit wall', 'ENGINEER'],
  ['SCRUTINEER', 'AUDIT', 'scrutineering bay', 'COMPLIANCE'],
  ['HISTORIAN', 'MEMORY', 'the archive', 'HIST'],
];
const UI_OF = Object.fromEntries(PARTS.map(p => [p[0], p[3]]));
const NAME = Object.fromEntries(PARTS.map(p => [p[0], p[1]]));

const st = { rounds: [], i: 0, scene: null, mesh: null, dd: null, spec: null, raf: 0,
             dragging: false, A: null, R: null, view: 'car', garage: null, timer: null };

/** Component levels after `n` generations have been decided. */
const levelsAt = n => SCR.car.levelsAfter(st.rounds, n);

/** The car is the harness: every component that levels up moves a part you can see. */
const specFor = lv => SCR.car.specForLevels(lv);

// The garage was built for a long game: station tiers step at role level 4, 7 and 10, and the
// eras begin at team level 26, 49, 73. A ten-run season moves the team from 10 to 15 and puts no
// role above 3, so left alone the garage never leaves the lock-up and every bench stays tier 0.
// This stretches the season's real span across the garage's visual range — the same kind of
// choice as picking a chart's axis. The levels in the side panel stay the true ones, and the view
// says on screen that the fit-out is scaled.
const GARAGE_SCALE = 6;

/** The same levels as a garage team: stations, crew and era all follow the component levels. */
function teamFor(lv, scaled) {
  const T = SCR.team, levels = {};
  for (const [key, , , ui] of PARTS) {
    const real = lv[key] || 1;
    levels[ui] = scaled ? 1 + (real - 1) * GARAGE_SCALE : real;
  }
  return T.newTeam(levels);
}

function specDiff(a, b) {
  const out = [];
  for (const k of Object.keys(b)) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push([k, a[k], b[k]]);
  }
  return out;
}

// ---------------------------------------------------------------------------------------
function rebuild() {
  const lv = levelsAt(st.i);
  const prev = specFor(levelsAt(Math.max(0, st.i - 1)));
  st.spec = specFor(lv);
  st.dd = SCR.car.derive(st.spec);
  st.mesh = SCR.car.build(st.spec, SCR.car.eraForLevels(lv));

  // The garage is the same state seen from the other side: each component owns a station, and a
  // station rebuilds itself at the tier its component has reached.
  if (st.garage && SCR.team) {
    const r = st.rounds[st.i - 1];
    st.garage.setTeam(teamFor(lv, true), st.spec);
    // Overview, always. A station camera frames one bench and a crate, which is the wrong shot
    // for a timeline: the point is seeing the whole floor change. `select` only moves the camera
    // when it is already at a station, so setting the wide shot first keeps it wide and still
    // marks where this run's change landed.
    const ui = r && r.promoted && r.role ? UI_OF[r.role] : null;
    st.garage.setCamera('OVERVIEW');
    st.garage.select(ui || null);
    const eraN = $('tlEra');
    if (eraN) {
      const t = teamFor(lv, true);
      eraN.textContent = t.era ? t.era.name : '';
    }
  }
  paint(specDiff(prev, st.spec), lv);
}

function paint(changed, lv) {
  const r = st.rounds[st.i - 1];                 // the run that produced this state
  const cur = st.rounds[Math.min(st.i, st.rounds.length - 1)];
  const set = (id, v) => { const n = $(id); if (n) n.textContent = v; };

  set('tlGen', st.i === 0 ? 'START' : `RUN ${st.i}`);
  set('tlOf', `of ${st.rounds.length}`);
  const score = st.i === 0 ? (st.rounds[0] || {}).official_s : (r || {}).official_s;
  set('tlScore', typeof score === 'number' ? score.toFixed(2) : '—');
  const first = (st.rounds[0] || {}).official_s;
  const gained = typeof score === 'number' && typeof first === 'number' ? first - score : 0;
  set('tlGain', gained > 0.005 ? `−${gained.toFixed(2)}s since the start` : 'the harness it starts with');

  // what this run did
  const box = $('tlWhat'); if (box) {
    box.innerHTML = '';
    if (st.i === 0) {
      box.append(el('p', 'tl-none', 'Ten components, all at level one. Drag the slider to watch '
        + 'the loop rebuild the car one part at a time.'));
    } else if (r && r.promoted) {
      const h = el('div', 'tl-kept');
      h.innerHTML = `<span class="tl-tag keep">KEPT</span><b>${esc(NAME[r.role] || r.role)}</b>`
        + `<code>${esc(r.part || '')}</code>`;
      box.append(h, el('p', 'tl-sum', r.diff_summary || ''));
    } else if (r) {
      const failed = (r.gates || []).filter(g => !g.ok).map(g => g.gate);
      const h = el('div', 'tl-kept');
      h.innerHTML = `<span class="tl-tag drop">${r.rule_fired === 'no_upgrade' ? 'NO CHANGE' : 'REFUSED'}</span>`
        + `<b>${esc(NAME[r.role] || r.role || '—')}</b>`;
      box.append(h, el('p', 'tl-sum', r.rule_fired === 'no_upgrade'
        ? 'Nothing had enough evidence behind it. The loop wrote no change.'
        : `Its own gates threw it out${failed.length ? ` — ${failed[0]}` : ''}. The car is unchanged.`));
    }
    if (changed.length) {
      const list = el('div', 'tl-parts');
      for (const [k, a, b] of changed) {
        const n = el('span', 'tl-part');
        n.innerHTML = `${esc(k)} <i>${esc(SCR.car.fmtVal(a))}</i>→<b>${esc(SCR.car.fmtVal(b))}</b>`;
        list.append(n);
      }
      box.append(list);
    }
    void cur;
  }

  // the ten components, with the ones that have moved lit
  const rig = $('tlRig'); if (rig) {
    rig.innerHTML = '';
    for (const [key, name, part] of PARTS) {
      const n = el('div', 'tl-comp' + (lv[key] > 1 ? ' up' : '')
        + (r && r.promoted && r.role === key ? ' now' : ''));
      n.innerHTML = `<span class="tl-cn">${esc(name)}</span>`
        + `<span class="tl-cp">${esc(part)}</span><b>L${lv[key]}</b>`;
      rig.append(n);
    }
  }

  for (const node of document.querySelectorAll('.tl-tick')) {
    const k = Number(node.dataset.k);
    node.classList.toggle('on', k === st.i);
    node.classList.toggle('past', k < st.i);
  }
  const fill = $('tlFill');
  if (fill) fill.style.width = `${(st.i / Math.max(1, st.rounds.length)) * 100}%`;
}

// ---------------------------------------------------------------------------------------
function buildScrubber() {
  const rail = $('tlRail'); if (!rail) return;
  rail.innerHTML = '<span class="tl-line"></span><span class="tl-fill" id="tlFill"></span>';
  for (let k = 0; k <= st.rounds.length; k++) {
    const r = st.rounds[k - 1];
    const tick = el('button', 'tl-tick' + (r && r.promoted ? ' keep' : ''));
    tick.dataset.k = String(k);
    tick.style.left = `${(k / st.rounds.length) * 100}%`;
    tick.title = k === 0 ? 'the harness it starts with'
      : `run ${k}${r && r.promoted ? ` · kept ${r.part}` : ' · refused'}`;
    tick.append(el('i'), el('span', 'tl-tn', k === 0 ? '0' : String(k)));
    tick.addEventListener('click', () => go(k));
    rail.append(tick);
  }
}

function go(k) {
  const n = Math.max(0, Math.min(st.rounds.length, Math.round(k)));
  if (n === st.i) return;
  st.i = n;
  rebuild();
}

function fromPointer(ev) {
  const rail = $('tlRail'); if (!rail) return;
  const b = rail.getBoundingClientRect();
  const x = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - b.left) / b.width;
  go(x * st.rounds.length);
}

function wire() {
  const rail = $('tlRail');
  const down = ev => { stopTour(); st.dragging = true; fromPointer(ev); ev.preventDefault(); };
  const move = ev => { if (st.dragging) fromPointer(ev); };
  const up = () => { st.dragging = false; };
  rail.addEventListener('mousedown', down);
  rail.addEventListener('touchstart', down, { passive: false });
  window.addEventListener('mousemove', move);
  window.addEventListener('touchmove', move, { passive: true });
  window.addEventListener('mouseup', up);
  window.addEventListener('touchend', up);

  // the wheel is the obvious thing to reach for on a timeline, so it scrubs
  let acc = 0;
  document.addEventListener('wheel', ev => {
    acc += ev.deltaY;
    if (Math.abs(acc) > 40) { stopTour(); go(st.i + (acc > 0 ? 1 : -1)); acc = 0; }
  }, { passive: true });

  document.addEventListener('keydown', ev => {
    if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(ev.key)) stopTour();
    if (ev.key === 'ArrowRight') go(st.i + 1);
    if (ev.key === 'ArrowLeft') go(st.i - 1);
    if (ev.key === 'Home') go(0);
    if (ev.key === 'End') go(st.rounds.length);
  });

  for (const [id, view] of [['tlViewCar', 'car'], ['tlViewGarage', 'garage']]) {
    const b = $(id);
    if (b) b.addEventListener('click', () => { stopTour(); showView(view); rebuild(); });
  }

  const play = $('tlPlay');
  if (play) play.addEventListener('click', () => (st.timer ? stopTour() : startTour()));
}

// The car or the garage, and the controls that say which. The garage sets its own ambient on
// entry, so it is handed back when the car view returns.
function showView(view) {
  st.view = view;
  for (const [id, v] of [['tlViewCar', 'car'], ['tlViewGarage', 'garage']]) {
    const n = $(id); if (n) n.classList.toggle('on', v === view);
  }
  if (st.R) st.R.ambient = view === 'garage' ? 0.34 : 1;
  const note = $('tlNote');
  if (note) {
    note.textContent = view === 'garage'
      ? 'station fit-out and era are scaled ×' + GARAGE_SCALE + ' — ten runs move the real '
        + 'team level from 10 to 15, which the garage alone would not show'
      : '';
  }
}

// PLAY is the season as one tour, about 35 seconds: the starting car, then every run in order.
// A kept run cuts to the garage, where that component's station is rebuilt, then back to the car
// it produced; a refused run holds on the unchanged car.
const HOLD = 1.4;
function tourBeats() {
  const beats = [{ k: 0, view: 'car', s: 1.5 }];
  st.rounds.forEach((r, i) => {
    if (r.promoted && r.role && st.garage) beats.push({ k: i + 1, view: 'garage', s: SCR.garage.UPGRADE_DUR, up: UI_OF[r.role] });
    beats.push({ k: i + 1, view: 'car', s: HOLD });
  });
  return beats;
}
function startTour() {
  const beats = tourBeats(), play = $('tlPlay');
  if (play) { play.classList.add('on'); play.textContent = '❚❚ PAUSE'; }
  let n = 0;
  const next = () => {
    if (n >= beats.length) { stopTour(); return; }
    const b = beats[n++];
    showView(b.view);
    st.i = b.k;
    rebuild();
    if (b.up) st.garage.playUpgrade(b.up, { tier: SCR.garage.tierFor(teamFor(levelsAt(b.k), true).roles[b.up].level) });
    st.timer = setTimeout(next, b.s * 1000);
  };
  next();
}
function stopTour() {
  if (!st.timer) return;
  clearTimeout(st.timer); st.timer = null;
  const play = $('tlPlay'); if (play) { play.classList.remove('on'); play.textContent = '▶ PLAY'; }
}

// ---------------------------------------------------------------------------------------
T.boot = function () {
  const L = window.SCRUTINEER_LOOP || {};
  st.rounds = (L.rounds || []).slice();
  if (!st.rounds.length) return;

  const E = SCR.engine;
  st.R = E.createRenderer($('stage'), 384, 216, 1);
  const circ = SCR.world.makeCircuit(1994), world = SCR.world.build(circ);
  const car = SCR.car.newState();
  SCR.sim.physics(car, SCR.car.derive(specFor(levelsAt(0))), specFor(levelsAt(0)), circ, 0, {});
  // pulled back from the broadcast's studio shot, so the whole car stays in a wide 16:9 frame
  st.scene = SCR.trackScene.create({ R: st.R, world, car, studioDist: 7.4 });
  st.scene.setMode('STUDIO');            // the car turning on the spot, not lapping

  // The garage wants an app. It needs three things from one, so it gets three things.
  st.A = { R: st.R, params: {}, diagExtra: null };
  const garage = SCR.scenes && SCR.scenes.garage;
  if (garage) {
    garage.enter(st.A, { team: teamFor(levelsAt(0), true), spec: specFor(levelsAt(0)),
                         cam: 'OVERVIEW' });
    st.garage = garage;
  }

  buildScrubber();
  wire();
  rebuild();

  let last = performance.now();
  const loop = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    E.time += dt;
    if (st.view === 'garage' && st.garage) {
      st.garage.update(dt);
      st.garage.render();
    } else {
      st.scene.updateCamera(dt);
      st.scene.render({ car: st.mesh });
    }
    st.R.present();
    st.raf = requestAnimationFrame(loop);
  };
  st.raf = requestAnimationFrame(loop);
};

T.go = go; T.play = startTour;
})(window.SCR = window.SCR || {});
