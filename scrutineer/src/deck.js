// ============================================================================
// SCR.deck — the pitch, one beat of the script per slide, on a 1920×1080 stage.
//
// The car and the circuit are drawn by the same engine every other surface uses, and every number
// on a slide comes from the recorded season or from the cited paper. `?slide=N` opens a slide,
// `?export=1` renders one slide still and flags the page ready, which is how the JPEGs are made.
// ============================================================================
(function (SCR) {
'use strict';
const E = SCR.engine, C = SCR.car, Wd = SCR.world;
const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);
const EXPORT = q.get('export') === '1';
const LOOP = window.SCRUTINEER_LOOP || { rounds: [] }, R = LOOP.rounds || [];
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const PAL = { gold: '#F4C542', cyan: '#3DD2FF', green: '#2FD968', red: '#E31E2D', amber: '#FFA318', purple: '#B04BFF',
  white: '#FFFFFF', mid: '#6A6F8A', studio: '#121A4A', night: '#06081A', black: '#000000', caption: '#C8CBD8' };
const ORDER = ['AERO', 'POWER_UNIT', 'TYRES', 'DATA', 'SIMULATOR', 'ENGINEER', 'STRATEGIST', 'SCRUTINEER', 'HISTORIAN', 'PIT_CREW'];
const NAME = { AERO: 'RETRIEVAL', DATA: 'VERIFICATION', TYRES: 'SAMPLING', POWER_UNIT: 'MODEL', STRATEGIST: 'BUDGET',
  SIMULATOR: 'CURRICULUM', PIT_CREW: 'DEPLOY', ENGINEER: 'PROPOSER', SCRUTINEER: 'AUDIT', HISTORIAN: 'MEMORY' };
const JOB = { AERO: 'context assembly', POWER_UNIT: 'inference', TYRES: 'decode policy', DATA: 'pre-submit audit',
  SIMULATOR: 'task selection', ENGINEER: 'patch synthesis', STRATEGIST: 'stop policy', SCRUTINEER: 'tamper check',
  HISTORIAN: 'trace compaction', PIT_CREW: 'install and smoke' };
// what each one decides, in the regulations' words
const PART = { AERO: 'wings', DATA: 'floor', TYRES: 'tyre compound', POWER_UNIT: 'power unit', SIMULATOR: 'DRS',
  STRATEGIST: 'gearbox', PIT_CREW: 'brakes', ENGINEER: 'livery', SCRUTINEER: 'livery', HISTORIAN: 'livery' };
const HUE = { AERO: 'cyan', POWER_UNIT: 'red', TYRES: 'amber', DATA: 'green', SIMULATOR: 'cyan',
  ENGINEER: 'gold', STRATEGIST: 'purple', SCRUTINEER: 'white', HISTORIAN: 'gold', PIT_CREW: 'white' };
const GATE = { diff_size: 'SIZE', comparable_ab: 'FAIR A/B', novelty: 'NOVELTY', evidence: 'EVIDENCE', seesaw: 'SPLITS AGREE',
  correlation: 'CORRELATION', regression: 'REGRESSION', cost_cap: 'COST', scrutineering: 'SCRUTINEER', rl_entropy: 'RL ENTROPY', ladder: 'LADDER' };
const NAMED = new Set(['diff_size', 'novelty', 'evidence', 'regression', 'seesaw', 'cost_cap']);
// the partners whose parts each slide runs on (the band), and all ten on the closing wall
const PARTNER = {
  1: { chips: [['COREWEAVE HACKS', 'cyan'], ['WEIGHTS & BIASES', 'gold']], line: 'Built at CoreWeave Hacks, running on W&B from model to registry.' },
  2: { chips: [['W&B SERVERLESS RL', 'gold'], ['W&B INFERENCE', 'gold']], line: 'Every page built on W&B Inference; a real LoRA job one command away.' },
  3: { chips: [['W&B WEAVE EVALS', 'gold'], ['W&B SANDBOXES', 'amber']], line: 'Both timings land in Weave Evals; Sandboxes keep the agent’s code isolated.' },
  4: { chips: [['W&B WEAVE', 'gold'], ['W&B RUNS', 'gold'], ['MARIMO', 'green']], line: 'Every step traced, a run per component, memory as a marimo notebook.' },
  5: { chips: [['TYPESAFE SYSTEM1', 'purple'], ['W&B REGISTRY', 'gold']], line: 'Typed decisions for the credit router; every harness version registered.' },
  6: { chips: [['MARIMO', 'green'], ['ARIA', 'cyan']], line: 'A marimo notebook must reproduce each promotion; ARIA sees every generation.' },
  7: { chips: [['W&B REGISTRY', 'gold'], ['W&B · A COREWEAVE COMPANY', 'cyan']], line: 'What raced is what was promoted. W&B: part of CoreWeave since 2025.' },
  8: { chips: [['OUR PIT WALL', 'gold']], line: 'None of this laps without them. Thank you.' },
};
const WALL = [
  { name: 'COREWEAVE', role: 'TITLE HOST', hue: 'cyan', says: 'The hackathon this loop was built for, and the home of W&B since 2025.' },
  { name: 'W&B INFERENCE', role: 'ENGINE SUPPLIER', hue: 'gold', says: 'The model behind the pages. Open models, OpenAI-compatible, nothing to self-host.' },
  { name: 'W&B WEAVE', role: 'TELEMETRY', hue: 'gold', says: 'Every build, audit, replay, blame and gate traced. Nothing the car does goes unseen.' },
  { name: 'W&B RUNS', role: 'TIMING', hue: 'gold', says: 'A run per component: credit you can open as a curve, not dig out of a log.' },
  { name: 'W&B REGISTRY', role: 'HOMOLOGATION', hue: 'gold', says: 'Every harness version registered with an alias. What raced is what was promoted.' },
  { name: 'W&B SERVERLESS RL', role: 'WIND TUNNEL', hue: 'gold', says: 'A real LoRA job registered from one command, rollouts through the trainer’s own client.' },
  { name: 'W&B SANDBOXES', role: 'PARC FERME', hue: 'amber', says: 'Built for exactly what a seal needs: the agent’s own code, isolated.' },
  { name: 'ARIA', role: 'RACE CONTROL', hue: 'cyan', says: 'The board every generation reports to, kept or refused.' },
  { name: 'TYPESAFE SYSTEM1', role: 'TEAM RADIO', hue: 'purple', says: 'Typed decisions for the pit wall, the credit router and the gates.' },
  { name: 'MARIMO', role: 'DEBRIEF ROOM', hue: 'green', says: 'A notebook that must reproduce every promotion. If it cannot, the change is refused.' },
];

// ---------- pixel icons: 12×12 drawings, X = colour, o = white ----------
const ICONS = {
  file: ['..XXXXXX....', '..X....XX...', '..X....XoX..', '..X....XXXX.', '..X.oooo..X.', '..X.......X.', '..X.ooooo.X.', '..X.......X.', '..X.oooo..X.', '..X.......X.', '..XXXXXXXXX.', '............'],
  clock: ['....XXXX....', '...XoooooX..'.slice(0, 12), '..XoooooooX.', '.XoooXooooX.', '.XoooXooooX.', '.XoooXXXooX.', '.XooooooooX.', '.XooooooooX.', '..XoooooooX.', '...XooooX...', '....XXXX....', '............'],
  chart: ['X...........', 'X........XX.', 'X.......X.X.', 'X......X....', 'X.X...X.....', 'X.XX.X......', 'X.X.X.......', 'X...........', 'X.o.o.o.o.o.', 'X.o.o.o.o.o.', 'XXXXXXXXXXXX', '............'],
  fork: ['.XX......oo.', '.XX......oo.', '..X......o..', '..X.....o...', '..X....o....', '..XXXXX.....', '..X.........', '..X....oo...', '..X...o..o..', '.XXX..oooo..', '.XXX...oo...', '............'],
  moon: ['....XXXX....', '..XXX.......', '.XXX........', '.XX.........', 'XXX.....o...', 'XXX.........', 'XXX.........', 'XXX.........', '.XXX......o.', '.XXXX...XX..', '..XXXXXXX...', '....XXXX....'],
  chip: ['..o.o.o.o...', '.XXXXXXXXX..', 'oXooooooooXo', '.XoXXXXXoX..', 'oXoXooooXoXo', '.XoXooooXoX.', 'oXoXooooXoXo', '.XoXXXXXoX..', 'oXooooooooXo', '.XXXXXXXXX..', '..o.o.o.o...', '............'],
  car: ['............', '.....XX.....', '....XXXX....', '.XX.XooX.XX.', '.XX.XXXX.XX.', '....XXXX....', '...XXXXXX...', '.XXXXXXXXXX.', '.XX.XXXX.XX.', '.XX.XXXX.XX.', '...XXXXXX...', '............'],
  scan: ['XXX......XXX', 'X..........X', 'X..oooooo..X', '...o....o...', '...o.XX.o...', 'XXXXXXXXXXXX', '...o.XX.o...', '...o....o...', 'X..oooooo..X', 'X..........X', 'XXX......XXX', '............'],
  eye: ['............', '............', '....XXXX....', '..XXooooXX..', '.XoooXXoooX.', 'XoooXXXXoooX', '.XoooXXoooX.', '..XXooooXX..', '....XXXX....', '............', '............', '............'],
  lock: ['....XXXX....', '...X....X...', '...X....X...', '...X....X...', '.XXXXXXXXXX.', '.XooooooooX.', '.XoooXXoooX.', '.XoooXXoooX.', '.XooooXoooX.', '.XooooooooX.', '.XXXXXXXXXX.', '............'],
  ladder: ['.X......X...', '.XXXXXXXX...', '.X......X...', '.X......X...', '.XXXXXXXX...', '.X......X...', '.X......X...', '.XXXXXXXX...', '.X......X...', '.X......X...', '.XXXXXXXX...', '.X......X...'],
  deck: ['...XXXXXXXX.', '...XooooooX.', '.XXXXXXXXXX.', '.XooooooooX.', 'XXXXXXXXXXX.', 'XoooooooooX.', 'XoXXXXXXooX.', 'XoooooooooX.', 'XoXXXXXooXX.', 'XoooooooooX.', 'XXXXXXXXXXX.', '............'],
  book: ['.XXXXXXXXX..', '.XoooooooXX.', '.XoXXXXXoXX.', '.XoooooooXX.', '.XoXXXXooXX.', '.XoooooooXX.', '.XoXXXXXoXX.', '.XoooooooXX.', '.XoXXXooooX.', '.XoooooooXX.', '.XXXXXXXXXX.', '..XXXXXXXXX.'],
  coin: ['....XXXX....', '..XXooooXX..', '.XooXXXXooX.', '.XoXooooXoX.', 'XoXooXXooXoX', 'XoXoXXoooXoX', 'XoXooXXooXoX', 'XoXoooXXoXoX', '.XoXoXXooXX.', '.XooXXXXooX.', '..XXooooXX..', '....XXXX....'],
};
function icon(name, color, size = 72) {
  const rows = ICONS[name]; if (!rows) return '';
  const c = PAL[color] || color, u = size / 12;
  let r = '';
  rows.forEach((row, y) => [...row.padEnd(12, '.')].slice(0, 12).forEach((ch, x) => {
    if (ch === 'X') r += `<rect x="${x * u}" y="${y * u}" width="${u}" height="${u}" fill="${c}"/>`;
    else if (ch === 'o') r += `<rect x="${x * u}" y="${y * u}" width="${u}" height="${u}" fill="${color === 'black' ? '#F4C542' : '#FFFFFF'}" fill-opacity="${color === 'black' ? 0 : .9}"/>`;
  }));
  return `<svg class="pxi" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="flex:none;filter:drop-shadow(${u / 2}px ${u / 2}px 0 #000)">${r}</svg>`;
}

// ---------- the car, drawn by the season's own engine ----------
function pitBox() {
  E.begin(); E.setGroup(0); E.setAux(0);
  E.Q([-9, 0, -9], [9, 0, -9], [9, 0, 9], [-9, 0, 9], E.M.CONCRETE);
  for (let k = -4; k < 4; k++) E.Q([k, 0.01, 3.1], [k + 1, 0.01, 3.1], [k + 1, 0.01, 3.9], [k, 0.01, 3.9], (k & 1) ? E.M.KERB_W : E.M.CARBON);
  for (const s of [-1, 1]) E.Q([s * 2.2 - 0.08, 0.012, -3.6], [s * 2.2 + 0.08, 0.012, -3.6], [s * 2.2 + 0.08, 0.012, 3.6], [s * 2.2 - 0.08, 0.012, 3.6], E.M.GOLD);
  return E.end();
}
const GROUND = [];
function renderCar(canvas, levels, view) {
  const r = E.createRenderer(canvas, canvas.width, canvas.height, 1); r.ambient = 0.24; r.seamCutoff = 40;
  const mesh = C.build(C.specForLevels(levels), C.eraForLevels(levels));
  if (!GROUND[0]) GROUND[0] = pitBox();
  const car = C.displayState(0, 0, 0);
  const draw = orbit => {
    const cam = r.cam, a = orbit === undefined ? view.orbit : orbit;
    cam.pos = [Math.sin(a) * view.dist, view.h, Math.cos(a) * view.dist]; cam.target = view.target || [0, 0.42, 0]; cam.fov = view.fov || 30;
    r.begin(); r.gradient(view.top || '#0C1236', '#06081A'); r.drawStatic(GROUND[0]);
    const xf = C.makeXform(car, { pose: 'display' });
    r.drawDynamic(mesh, xf, 'shadow', 0); r.drawDynamic(mesh, xf, 'solid', 0); r.outline(); r.present();
  };
  draw();
  return { r, draw, view };
}
const levelsAfter = n => C.levelsAfter(R, n);

// ---------- slide contents ----------
function build() {
  const slides = [...document.querySelectorAll('.slide')], total = slides.length;
  slides.forEach((s, i) => {
    const top = document.createElement('header'); top.className = 's-top';
    top.innerHTML = `<span class="s-mark">SCRUTINEER</span><span class="s-kick">${esc(s.dataset.kick)}</span><span class="s-num">${String(i + 1).padStart(2, '0')} / ${total}</span>`;
    s.prepend(top);
    const pt = PARTNER[s.dataset.partner];
    if (pt) {
      const band = document.createElement('footer'); band.className = 's-partner';
      band.innerHTML = `<span class="lbl">PIT ${pt.chips.length > 1 ? 'PARTNERS' : 'PARTNER'}</span>`
        + pt.chips.map(([n, h]) => `<b style="--h:var(--${h})">${esc(n)}</b>`).join('') + `<p>${esc(pt.line)}</p>`;
      s.append(band);
    }
  });
  const wall = $('wall16');
  if (wall) wall.innerHTML = WALL.map(w => `<div class="partner" style="--h:var(--${w.hue})"><span class="lbl">${esc(w.role)}</span><b>${esc(w.name)}</b><p>${esc(w.says)}</p></div>`).join('');
  document.querySelectorAll('[data-icon]').forEach(n => { n.outerHTML = icon(n.dataset.icon, n.dataset.c || 'gold', +(n.dataset.s || 72)); });

  // 01: a night of experiments, about twelve an hour for eight hours
  $('night').innerHTML = Array.from({ length: 96 }, () => '<i></i>').join('');
  // 03
  $('harness3').innerHTML = ORDER.map(k => `<span style="--h:var(--${HUE[k]})">${NAME[k]}</span>`).join('');
  // 04: the twenty pages of run 4, as the audit left them
  const run4 = R[3] || R[0] || { pages: [] };
  $('wins').innerHTML = run4.pages.slice(0, 20).map(p => `<div class="win${p.passed ? '' : ' fail'}"><div class="bar"><i></i><i></i><i></i><b>${esc(p.title)}</b></div><div class="wf">${wire(p.family)}</div></div>`).join('');
  const nf = run4.pages.slice(0, 20).filter(p => !p.passed).length;
  $('wins-key').textContent = `${nf} of 20 failed audit or timing`;
  $('pagewf').innerHTML = wire('header', 3.2);
  // 06
  $('peek').innerHTML = peekChart();
  // 07: run 4's failing pages, and where the blame went
  const fails = run4.pages.filter(p => !p.passed), blamed = run4.standings || {}, top = Object.entries(blamed).sort((a, b) => b[1].n - a[1].n)[0];
  $('fails').innerHTML = fails.slice(0, 5).map(p => `<div><span>${esc(p.title)}</span><span>${esc(((p.rules || [])[0] || {}).id || '')}</span></div>`).join('')
    + `<div style="border-left-color:var(--mid);background:#04060F"><span class="mid">…and ${Math.max(0, fails.length - 5)} more</span><span></span></div>`;
  $('comps').innerHTML = ['AERO', 'DATA', 'TYRES', 'POWER_UNIT'].map(k => {
    const n = blamed[k] && blamed[k].n;
    return `<div class="${top && top[0] === k ? 'hot' : ''}" data-k="${k}"><span>${NAME[k]}</span>${n ? `<em>${n}</em>` : '<em class="mid">·</em>'}</div>`;
  }).join('') + `<p class="cap" style="margin:6px 0 0">${top ? `${top[1].n} of ${fails.length} failing pages traced to <span class="gold">${NAME[top[0]]}</span>. Blame counts only when correcting that one component flips the page.` : ''}</p>`;
  // the ten components, curriculum and memory lit
  $('comps8').innerHTML = ORDER.map(k => `<div class="ctile${k === 'SIMULATOR' || k === 'HISTORIAN' ? ' lit' : ''}" style="--h:var(--${HUE[k]})">${icon(compIcon(k), HUE[k], 40)}<b>${NAME[k]}</b><span>${JOB[k]}</span><em>car: ${PART[k]}</em></div>`).join('');
  // curriculum: practice mined from what kept failing; memory: the latest kept finding
  const fam = {}; R.slice(0, 4).forEach(r => r.pages.filter(p => !p.passed).forEach(p => { fam[p.family] = fam[p.family] || { t: p.title.replace(/ \(\d\)$/, ''), n: 0 }; fam[p.family].n++; }));
  $('cur4').textContent = 'practice mined from what kept failing: ' + Object.values(fam).sort((a, b) => b.n - a.n).slice(0, 2).map(f => `${f.t} ${f.n}×`).join(', ');
  const noted = R.filter(r => r.diff_summary && r.promoted).slice(-1)[0];
  $('mem4').textContent = 'a marimo notebook each generation' + (noted ? ` · run ${noted.generation + 1}: ${noted.diff_summary}` : '');
  // 05
  $('bars10').innerHTML = [['AERO', 92], ['TYRES', 61], ['DATA', 48], ['SIMULATOR', 30], ['POWER_UNIT', 18]].map(([k, w]) =>
    `<div class="${k === 'AERO' ? 'pick' : ''}"><span>${NAME[k]}</span><i style="width:${w}%"></i><em>${k === 'AERO' ? 'PICKED' : ''}</em></div>`).join('');
  const aero = R.map((r, i) => ({ r, i })).filter(x => x.r.role === 'AERO' && x.r.diff_summary);
  document.querySelector('.term pre').innerHTML = `<span class="c"># RETRIEVAL's own proposals, from the recorded season</span>\n`
    + aero.map(({ r, i }) => `<span class="g">run ${i + 1}</span>  ${esc(r.diff_summary)}\n        ${r.promoted ? `<span class="add">+ KEPT${r.part ? ` · part ${esc(r.part)}` : ''}</span>` : `<span class="del">- REFUSED · ${esc((r.gates || []).filter(g => !g.ok).map(g => GATE[g.gate] || g.gate).join(', ').toLowerCase() || 'gates')}</span>`}`).join('\n');
  // 11
  $('tree11').innerHTML = archiveTree();
  // 12: run 4's gates, as they came back, and the Ladder that was added after
  $('gantry').innerHTML = [...(run4.gates || []), { gate: 'ladder', ok: null }].map(g =>
    `<div class="light${NAMED.has(g.gate) ? ' named' : ''}"><i class="${g.ok === null ? 'off' : g.ok ? '' : 'bad'}"></i><span>${GATE[g.gate] || g.gate}</span></div>`).join('');
  // 13: every kept run, chained
  const kept = R.map((r, i) => ({ r, i })).filter(x => x.r.promoted);
  $('chain').innerHTML = kept.slice(0, 5).map(({ r, i }, n) => {
    const lv = levelsAfter(i + 1)[r.role];
    return `${n ? '<div class="link"></div>' : ''}<div class="block"><div class="h3">ROW ${n + 1} · RUN ${i + 1}</div>
      <div class="kv"><b>KEPT</b>${NAME[r.role]} → L${lv}</div>
      <div class="kv"><b>PREDECESSOR</b>${n ? `sha256(row ${n})` : 'genesis'}</div>
      <div class="kv"><b>SIGNATURE</b>Ed25519</div></div>`;
  }).join('');
  // 15
  $('map15').innerHTML = lapMap(0.62);
}
const compIcon = k => ({ AERO: 'scan', POWER_UNIT: 'chip', TYRES: 'coin', DATA: 'eye', SIMULATOR: 'deck', ENGINEER: 'file', STRATEGIST: 'clock', SCRUTINEER: 'lock', HISTORIAN: 'book', PIT_CREW: 'fork' }[k]);

// a page's wireframe, by the kind of interface it is
function wire(family, k = 1) {
  const b = (x, y, w, h, c = '#AEB4C8') => `<i style="position:absolute;left:${x * k}px;top:${y * k}px;width:${w * k}px;height:${h * k}px;background:${c}"></i>`;
  const ink = '#1A245C', gold = '#F4C542';
  switch (family) {
    case 'checkout': case 'signup': return b(10, 8, 110, 10, ink) + b(10, 26, 180, 14) + b(10, 46, 180, 14) + b(10, 66, 120, 14) + b(10, 90, 80, 18, gold);
    case 'invoices': return b(10, 8, 190, 14, ink) + [0, 1, 2, 3, 4].map(n => b(10, 28 + n * 16, 190, 10, n % 2 ? '#C8CDDD' : '#AEB4C8')).join('');
    case 'dialog': return b(30, 12, 150, 92, '#FFFFFF') + b(42, 24, 100, 10, ink) + b(42, 42, 126, 8) + b(42, 56, 110, 8) + b(42, 80, 56, 16, '#E31E2D') + b(106, 80, 56, 16);
    case 'pricing': return [0, 1, 2].map(n => b(10 + n * 66, 10, 58, 96, n === 1 ? '#FFFFFF' : '#D5D9E6') + b(18 + n * 66, 20, 42, 10, ink) + b(18 + n * 66, 84, 42, 14, gold)).join('');
    case 'gallery': return [0, 1, 2, 3, 4, 5].map(n => b(10 + (n % 3) * 64, 10 + Math.floor(n / 3) * 50, 56, 42, n % 2 ? '#8F98B8' : '#AEB4C8')).join('');
    case 'header': return b(0, 0, 250, 30, ink) + b(10, 9, 40, 12, gold) + b(120, 11, 24, 8, '#FFFFFF') + b(150, 11, 24, 8, '#FFFFFF') + b(180, 11, 24, 8, '#FFFFFF')
      + b(10, 44, 150, 16) + b(10, 68, 190, 10, '#C8CDDD') + b(10, 84, 170, 10, '#C8CDDD') + b(10, 104, 70, 18, gold);
    default: return b(10, 10, 150, 12, ink) + b(10, 32, 190, 10) + b(10, 50, 170, 10);
  }
}
function peekChart() {
  const W = 692, H = 472, X = i => 60 + i * 60, eyes = 10;
  const a = Array.from({ length: eyes }, (_, i) => [X(i), 380 - i * 30 - (i > 4 ? (i - 4) * 6 : 0)]);
  const bLine = Array.from({ length: eyes }, (_, i) => [X(i), 380 - Math.min(i, 3) * 22]);
  const path = p => p.map((q, k) => `${k ? 'L' : 'M'}${q[0]},${q[1]}`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" style="position:absolute;inset:0;shape-rendering:crispEdges">
    <path d="M40 20 L40 410 L670 410" fill="none" stroke="#6A6F8A" stroke-width="4"/>
    <path d="${path(a)}" fill="none" stroke="#E31E2D" stroke-width="10"/>
    <path d="${path(bLine)}" fill="none" stroke="#3DD2FF" stroke-width="10" stroke-dasharray="20 12"/>
    ${a.map(q => `<rect x="${q[0] - 9}" y="${q[1] - 9}" width="18" height="18" fill="#E31E2D" stroke="#000" stroke-width="4"/>`).join('')}
    ${Array.from({ length: eyes }, (_, i) => `<g transform="translate(${X(i) - 18},420)">${icon('eye', 'caption', 36).replace(/<svg[^>]*>|<\/svg>/g, '')}</g>`).join('')}
    <text x="70" y="96" fill="#E31E2D" style="font:18px 'Press Start 2P'">SCORE ON THE TEST</text>
    <text x="70" y="124" fill="#E31E2D" style="font:18px 'Press Start 2P'">IT KEEPS CHECKING</text>
    <text x="330" y="360" fill="#3DD2FF" style="font:18px 'Press Start 2P'">SCORE ON TESTS IT</text>
    <text x="330" y="388" fill="#3DD2FF" style="font:18px 'Press Start 2P'">HAS NEVER SEEN</text>
    <text x="520" y="44" fill="#6A6F8A" style="font:14px 'Press Start 2P'">ILLUSTRATIVE</text></svg>`;
}
function archiveTree() {
  // a deterministic archive: every agent stays in it; each layer is grown from agents in the one below
  const COUNTS = [1, 3, 5, 7, 9, 11], BEST = [0, 1, 2, 4, 5, 7], rnd = E.mulberry32(20250528);
  const layers = COUNTS.map((c, d) => Array.from({ length: c }, (_, k) =>
    ({ x: 446 + (k - (c - 1) / 2) * (780 / 11), y: 548 - d * 88, d, best: k === BEST[d] })));
  const edges = [];
  layers.slice(1).forEach((layer, j) => layer.forEach(n => {
    const below = layers[j];
    const p = n.best ? below[BEST[j]] : below.reduce((a, b) => Math.abs(b.x - n.x + (rnd() - 0.5) * 60) < Math.abs(a.x - n.x) ? b : a);
    edges.push([p, n]);
  }));
  const nodes = layers.flat();
  return edges.map(([a, b]) => `<path d="M${a.x},${a.y} L${a.x},${(a.y + b.y) / 2} L${b.x},${(a.y + b.y) / 2} L${b.x},${b.y}" fill="none" stroke="${b.best ? '#F4C542' : '#2A3570'}" stroke-width="${b.best ? 8 : 5}"/>`).join('')
    + nodes.map(n => `<rect x="${n.x - 15}" y="${n.y - 15}" width="30" height="30" fill="${n.best ? '#F4C542' : '#3A4CA8'}" stroke="#000" stroke-width="5"/>`).join('')
    + `<text x="24" y="44" fill="#6A6F8A" style="font:16px 'Press Start 2P'">ARCHIVE OF AGENTS</text><text x="24" y="72" fill="#F4C542" style="font:14px 'Press Start 2P'">— THE LINE THAT IMPROVED</text>`
    + `<text x="24" y="572" fill="#6A6F8A" style="font:12px 'Press Start 2P'">SHAPE ILLUSTRATIVE</text>`;
}
function lapMap(frac) {
  const c = Wd.makeCircuit(LOOP.seed === undefined ? 1994 : LOOP.seed), pts = c.pts;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; pts.forEach(p => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); });
  const W = 892, H = 632, pad = 80, s = Math.min((W - pad * 2) / (x1 - x0), (H - pad * 2) / (z1 - z0));
  const P = p => [pad + (p.x - x0) * s + ((W - pad * 2) - (x1 - x0) * s) / 2, pad + (p.z - z0) * s + ((H - pad * 2) - (z1 - z0) * s) / 2].map(v => Math.round(v));
  const all = pts.map(P), upto = Math.floor(pts.length * frac), line = arr => arr.map((q, k) => `${k ? 'L' : 'M'}${q[0]},${q[1]}`).join('');
  const [cx, cy] = all[upto], [sx, sy] = all[0];
  return `<path d="${line(all)}Z" fill="none" stroke="#000" stroke-width="30" stroke-linejoin="miter"/>
    <path d="${line(all)}Z" fill="none" stroke="#121A4A" stroke-width="20"/>
    <path d="${line(all.slice(0, upto + 1))}" fill="none" stroke="#F4C542" stroke-width="12"/>
    <rect x="${sx - 20}" y="${sy - 20}" width="40" height="40" fill="#FFF" stroke="#000" stroke-width="5"/><rect x="${sx - 20}" y="${sy - 20}" width="20" height="20" fill="#000"/><rect x="${sx}" y="${sy}" width="20" height="20" fill="#000"/>
    <rect x="${cx - 22}" y="${cy - 22}" width="44" height="44" fill="#F4C542" stroke="#000" stroke-width="6"/>
    <g transform="translate(${Math.min(W - 300, cx + 34)},${Math.max(40, cy - 60)})"><rect width="270" height="54" fill="#000" stroke="#F4C542" stroke-width="4"/><text x="16" y="36" fill="#F4C542" style="font:16px 'Press Start 2P'">RUN 4 · 62%</text></g>
    <text x="${sx + 30}" y="${sy + 56}" fill="#C8CBD8" style="font:14px 'Press Start 2P'">START · FINISH</text>
    <text x="30" y="${H - 30}" fill="#6A6F8A" style="font:14px 'Press Start 2P'">${esc(c.name)}</text>`;
}

// ---------- cars and callouts ----------
const LIVE = [];
function cars() {
  const end = levelsAfter(R.length), start = levelsAfter(0);
  LIVE.push(renderCar($('car1'), end, { orbit: 0.75, dist: 5.4, h: 1.55, fov: 30, spin: true }));
  $('car1run').textContent = `RUN ${R.length}`;
  const main = renderCar($('car14'), end, { orbit: 2.25, dist: 5.2, h: 1.9, fov: 32, target: [0, 0.35, 0] });
  renderCar($('carA'), start, { orbit: 2.25, dist: 5.4, h: 1.7, fov: 30 });
  renderCar($('carB'), end, { orbit: 2.25, dist: 5.4, h: 1.7, fov: 30 });
  // three callouts, pinned to where those parts really are on the drawn car
  const k = 2, host = $('calls14'), anchors = [
    { k: 'AERO', t: 'WINGS = RETRIEVAL', s: 'more of the right references', p: [0, 0.3, 2.1], box: [30, 36] },
    { k: 'DATA', t: 'FLOOR = VERIFICATION', s: 'renders and audits before it submits', p: [0.62, 0.08, -0.3], box: [30, 520] },
    { k: 'TYRES', t: 'COMPOUND = SAMPLING', s: 'how boldly it decodes', p: [-0.86, 0.36, -1.88], box: [760, 500] },
  ];
  main.draw();
  let lines = '';
  anchors.forEach(a => {
    const pr = main.r.project(a.p[0], a.p[1], a.p[2]); if (!pr) return;
    const ax = pr[0] * k, ay = pr[1] * k, bx = a.box[0] + 170, by = a.box[1] + (a.box[1] > 300 ? 0 : 76);
    lines += `<path d="M${bx},${by} L${bx},${ay} L${ax},${ay}" fill="none" stroke="#000" stroke-width="10"/><path d="M${bx},${by} L${bx},${ay} L${ax},${ay}" fill="none" stroke="${PAL[HUE[a.k]]}" stroke-width="5"/>
      <rect x="${ax - 12}" y="${ay - 12}" width="24" height="24" fill="${PAL[HUE[a.k]]}" stroke="#000" stroke-width="5"/>`;
    const d = document.createElement('div'); d.className = 'callout'; d.style.cssText = `left:${a.box[0]}px;top:${a.box[1]}px;--h:var(--${HUE[a.k]})`;
    d.innerHTML = `<b>${a.t}</b><span>${a.s}</span>`; $('callcar').append(d);
  });
  host.setAttribute('viewBox', '0 0 1152 648'); host.innerHTML = lines;
}

// ---------- the trace lines on slide 4, once the layout is known ----------
function traceLines() {
  const host = $('trace'), svg = $('traceLines'), hb = host.getBoundingClientRect(), sc = hb.width / host.offsetWidth || 1;
  const hot = host.querySelector('.comps .hot'); if (!hot) return;
  const hr = hot.getBoundingClientRect(), tx = (hr.left - hb.left) / sc, ty = (hr.top - hb.top + hr.height / 2) / sc;
  let d = '';
  host.querySelectorAll('.fails div').forEach((f, i, all) => {
    if (i === all.length - 1) return;
    const r = f.getBoundingClientRect(), fx = (r.right - hb.left) / sc, fy = (r.top - hb.top + r.height / 2) / sc, mx = fx + 60 + i * 6;
    d += `<path d="M${fx},${fy} L${mx},${fy} L${mx},${ty} L${tx},${ty}" fill="none" stroke="#F4C542" stroke-width="4" stroke-opacity=".75"/>`;
  });
  svg.setAttribute('viewBox', `0 0 ${host.offsetWidth} ${host.offsetHeight}`); svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
  svg.innerHTML = d;
}

// ---------- navigation ----------
const slides = () => [...document.querySelectorAll('.slide')];
let at = 0, autoT = 0;
function show(i) {
  const all = slides(); at = Math.max(0, Math.min(all.length - 1, i));
  all.forEach((s, n) => s.classList.toggle('on', n === at));
  $('count').textContent = `${at + 1} / ${all.length}`;
  $('progress').style.width = `${((at + 1) / all.length) * 100}%`;
  if (!EXPORT) history.replaceState(null, '', `${location.pathname}?slide=${at + 1}`);
  if (at === 3) requestAnimationFrame(traceLines);
}
function fit() {
  if (EXPORT) return;
  const s = Math.min(innerWidth / 1920, innerHeight / 1080);
  $('stage').style.transform = `translate(-50%,-50%) scale(${s})`;
}
function autoplay(on) {
  clearTimeout(autoT); $('auto').textContent = on ? 'STOP' : 'AUTOPLAY';
  if (!on) return;
  const words = (slides()[at].querySelector('.say') || { textContent: '' }).textContent.split(/\s+/).length;
  autoT = setTimeout(() => { if (at < slides().length - 1) { show(at + 1); autoplay(true); } else autoplay(false); }, Math.max(4000, words / 2.6 * 1000 + 1200));
}

SCR.deck = { show, count: () => slides().length };
function boot() {
  if (EXPORT) document.documentElement.classList.add('export');
  build(); cars();
  show((+q.get('slide') || 1) - 1); fit();
  addEventListener('resize', fit);
  addEventListener('keydown', e => {
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); show(at + 1); }
    else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); show(at - 1); }
    else if (e.key === 'Home') show(0); else if (e.key === 'End') show(slides().length - 1);
  });
  $('next').onclick = () => show(at + 1); $('prev').onclick = () => show(at - 1);
  $('auto').onclick = () => autoplay($('auto').textContent === 'AUTOPLAY');
  $('stage').addEventListener('click', e => { if (!e.target.closest('a,button')) show(at + 1); });
  const done = () => { traceLines(); document.documentElement.dataset.ready = '1'; };
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(done, 60));
  if (EXPORT) return;
  let last = 0;
  const tick = ts => {
    const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts; E.time += dt;
    if (at === 0) LIVE[0].draw((LIVE[0].view.orbit += dt * 0.35));
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.SCR = window.SCR || {});
