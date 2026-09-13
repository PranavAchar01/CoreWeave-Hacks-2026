// ============================================================================
// SCR.mode — what this site is, said on every page.
//
// The season published here is a stub. Its two hundred pages are real documents, really audited
// in a browser, but the loop's choices across its ten runs are scripted and no model wrote the
// pages (research/LEDGER.md says so: "it is not evidence about the loop"). The measured findings
// come from real runs and are labelled where they appear. No model is called when you load a
// page, and none should be — a public site that spends someone else's inference budget on every
// visitor is a site that gets turned off.
//
// So the site runs in one of two modes, and says which one in the corner of every page:
//
//   DEMO  — the stubbed season, replayed. Real pages and real audits; scripted loop.
//   LIVE  — a visitor pasted their own key. The comparison on /watch now calls a model for real.
//
// The key is held for the tab and nowhere else (sessionStorage, cleared when the tab closes, with
// a FORGET button that clears it sooner). It is never sent anywhere except this site's own relay,
// which forwards it once to the model endpoint and keeps no copy. Opting in is explicit, the
// warning is on screen, and the trial module reads it from here rather than keeping its own copy.
// ============================================================================
(function (SCR) {
'use strict';
const M = SCR.mode = {};
const STORE = 'scrutineer.key';

// The surfaces, in the order a first-time visitor should meet them. Each one names what it is
// in a sentence a person who has never seen the project can act on.
// The same layer ships on the timeline, which is its own Vercel project on its own domain, so a
// relative "/watch" there points at a page that does not exist. The timeline build sets
// SCRUTINEER_SITE to the main site; everywhere else it is unset and links stay relative, which
// keeps local builds pointing at themselves.
const BASE = window.SCRUTINEER_SITE || '';
const TIMELINE = 'https://scrutineer-timeline.vercel.app';
const SURFACES = [
  { href: BASE + '/', name: 'FRONT DOOR', at: ['/', '/index.html'],
    says: 'The one idea, in three pictures: it builds, it finds the cause, ten checks decide.' },
  { href: BASE + '/watch', name: 'WATCH A SEASON', at: ['/watch', '/watch.html'],
    says: 'Ten runs as a race. Blame, the ten gates, the pit stop when a change is kept.' },
  { href: BASE + '/telemetry', name: 'TELEMETRY', at: ['/telemetry', '/telemetry.html'],
    says: 'Five instrument charts on one scrubber: lap times, the audit, the outside check.' },
  { href: TIMELINE, name: 'SCRUB THE SEASON', ext: !BASE, timeline: true,
    says: 'One slider across all ten runs. Drag it and the car rebuilds at that generation.' },
  { href: BASE + '/deck', name: 'THE PITCH', at: ['/deck', '/deck.html'],
    says: 'Eight slides. What it does, how it knows, and what it got wrong.' },
  { href: BASE + '/pages/run-09/checkout-w01.html', name: 'AUDIT IT YOURSELF', ext: true,
    says: 'A real page from the season. Open it, run axe on it, check our number.' },
];

const el = (t, c, txt) => { const n = document.createElement(t); if (c) n.className = c;
  if (txt !== undefined) n.textContent = txt; return n; };

function read() { try { return sessionStorage.getItem(STORE) || ''; } catch (e) { return ''; } }
function write(v) {
  try { v ? sessionStorage.setItem(STORE, v) : sessionStorage.removeItem(STORE); }
  catch (e) { /* a private window refuses storage; the key still works for this page */ }
}

// The key a visitor pasted, for whoever needs to make a call with it. Kept behind a function
// rather than a property so nothing can accidentally serialise it into a bundle or a log.
let memory = '';
M.key = () => memory || read();
M.live = () => !!M.key();

// A key is the visitor's money and the visitor's secret. Show enough to recognise it, never the
// rest — a screen-shared demo should not leak one.
function mask(k) {
  if (k.length <= 10) return k.slice(0, 3) + '…';
  return k.slice(0, 7) + '…' + k.slice(-4);
}

// --------------------------------------------------------------------------------------------
// the badge
// --------------------------------------------------------------------------------------------
let badge, veil;

function paintBadge() {
  const live = M.live();
  // An anchored page keeps its own chip; all it gets is a marker saying a key is in play, drawn
  // with ::after so the page repainting the chip's contents cannot wipe it.
  const anchor = document.querySelector('[data-scrm-anchored]');
  if (anchor) anchor.toggleAttribute('data-scrm-live', live);
  if (!badge) return;
  badge.className = 'scrm-badge' + (live ? ' live' : '');
  badge.innerHTML = '';
  badge.append(el('i'), el('b', null, live ? 'LIVE' : 'DEMO'),
    el('s', null, live ? 'your key · ' + mask(M.key()) : 'stubbed season · add a key to go live'));
  badge.setAttribute('aria-label', live
    ? 'Live mode: your own key is in use for this tab. Open the mode panel.'
    : 'Demo mode: this season is stubbed. Open the mode panel to go live with your own key.');
}

// --------------------------------------------------------------------------------------------
// the panel
// --------------------------------------------------------------------------------------------
function here(s) {
  if (s.timeline) return !!BASE;
  if (s.ext || BASE) return false;
  const p = location.pathname.replace(/\/+$/, '') || '/';
  return (s.at || []).some(a => a === p || (a === '/' && p === ''));
}

function buildPanel() {
  veil = el('div', 'scrm-veil'); veil.hidden = true;
  veil.setAttribute('role', 'dialog'); veil.setAttribute('aria-modal', 'true');
  veil.setAttribute('aria-label', 'What this site is, and how to run it live');

  const panel = el('div', 'scrm-panel');
  const head = el('div', 'scrm-head');
  head.append(el('span', 'scrm-chq'), el('h2', null, 'Scrutineer · demo mode'));
  const x = el('button', 'scrm-x', 'CLOSE  ESC'); x.addEventListener('click', () => M.close());
  head.append(x);

  const body = el('div', 'scrm-body');
  body.append(el('p', 'scrm-lede', 'This is the demo. The season you are watching is stubbed.'));
  const sub = el('p', 'scrm-sub');
  sub.textContent = 'Its two hundred pages are real documents, really audited in a browser — but '
    + 'the loop\'s choices across its ten runs are scripted, and no model wrote the pages. It shows '
    + 'how the loop works; it is not evidence that it works. The measured results come from real '
    + 'runs and are marked where they appear. Loading a page calls no model and spends nobody\'s '
    + 'budget. Bring your own key and one part of the site runs for real, right now.';
  body.append(sub);

  const two = el('div', 'scrm-two');
  const real = el('div', 'scrm-col real');
  real.innerHTML = '<h3>What you get without a key</h3><ul>'
    + '<li>Every page in the season, as a real document at its own URL you can audit.</li>'
    + '<li>The real browser audit that scored them — axe-core, no model judging.</li>'
    + '<li>The whole loop played out: build, blame, fix, ten checks, keep or refuse.</li>'
    + '<li>The measured findings from real runs — including the one that went against us.</li>'
    + '<li><b>Stubbed:</b> which change the loop picked each run, and the pages it wrote.</li></ul>';
  const key = el('div', 'scrm-col key');
  key.innerHTML = '<h3>What your key turns on</h3><ul>'
    + '<li>On <b>Watch a season</b>, the panel called <b>Run the comparison yourself</b>.</li>'
    + '<li>It asks a model for the same interface twice — once with the context the agent gave '
    + 'itself on run 1, once with the context it wrote for itself later.</li>'
    + '<li>Both pages are rendered and audited in your browser, by the same engine.</li>'
    + '<li>That is the whole claim of this project, checked live instead of taken.</li></ul>';
  two.append(real, key);
  body.append(two);

  const row = el('div', 'scrm-key');
  const input = el('input');
  input.type = 'password'; input.id = 'scrmKey'; input.autocomplete = 'off';
  input.spellcheck = false; input.placeholder = 'wandb_v1_…  or  sk-ant-…';
  input.setAttribute('aria-label', 'Your W&B Inference or Anthropic API key');
  const go = el('button', null, 'GO LIVE');
  const forget = el('button', 'ghost', 'FORGET KEY');
  row.append(input, go, forget);
  body.append(row);

  const note = el('p', 'scrm-note'); note.id = 'scrmNote';
  body.append(note);

  const nav = el('div', 'scrm-nav');
  nav.append(el('h3', null, 'Every surface, and what it is for'));
  const tiles = el('div', 'scrm-tiles');
  SURFACES.forEach((s, i) => {
    const a = el('a', 'scrm-tile'); a.href = s.href;
    if (s.ext) { a.target = '_blank'; a.rel = 'noopener'; }
    if (here(s)) a.setAttribute('aria-current', 'page');
    a.append(el('em', null, String(i + 1)), el('b', null, s.name + (here(s) ? ' · here' : '')),
      el('span', null, s.says));
    tiles.append(a);
  });
  nav.append(tiles);
  body.append(nav);

  const foot = el('p', 'scrm-foot');
  foot.innerHTML = 'Press <kbd>?</kbd> anywhere to open this · <kbd>1</kbd>–<kbd>6</kbd> to jump '
    + 'to a surface · <kbd>ESC</kbd> to close. The key is held for this browser tab only, is sent '
    + 'to the model endpoint through this site\'s relay, and is never stored or logged.';
  body.append(foot);

  panel.append(head, body);
  veil.append(panel);

  const setNote = (txt, kind) => {
    note.className = 'scrm-note' + (kind ? ' ' + kind : '');
    note.textContent = txt;
  };
  const apply = () => {
    const v = (input.value || '').trim();
    if (!v) return setNote('Paste a key first — or keep exploring the demo; the pages and audits are real.', 'bad');
    if (v.length < 20) return setNote('That does not look like a key.', 'bad');
    memory = v; write(v); input.value = '';
    paintBadge();
    setNote('Live for this tab. Open Watch a season and use "Run the comparison yourself".', 'ok');
  };
  go.addEventListener('click', apply);
  input.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); apply(); } });
  forget.addEventListener('click', () => {
    memory = ''; write(''); input.value = '';
    paintBadge();
    setNote('Forgotten. Back to the demo.', 'ok');
  });

  // Clicking the backdrop closes; clicking inside it must not.
  veil.addEventListener('click', ev => { if (ev.target === veil) M.close(); });
  panel.addEventListener('click', ev => ev.stopPropagation());

  // 1–6 jump between surfaces, but only while the panel is open and only when the visitor is
  // not typing — the pages underneath already bind single letters of their own.
  veil.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') { ev.preventDefault(); return M.close(); }
    const t = ev.target && ev.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
    const n = parseInt(ev.key, 10);
    if (n >= 1 && n <= SURFACES.length) {
      const s = SURFACES[n - 1];
      ev.preventDefault();
      if (s.ext) window.open(s.href, '_blank', 'noopener'); else location.href = s.href;
    }
  });
  return veil;
}

M.open = function () {
  if (!veil) document.body.append(buildPanel());
  veil.hidden = false;
  const k = veil.querySelector('.scrm-x'); if (k) k.focus();
};
M.close = function () {
  if (veil) veil.hidden = true;
  const back = badge || document.querySelector('[data-scrm-anchored]');
  if (back && back.focus) back.focus();
};
M.toggle = function () { (veil && !veil.hidden) ? M.close() : M.open(); };

M.boot = function () {
  if (document.querySelector('.scrm-badge') || document.querySelector('[data-scrm-anchored]')) return;
  document.documentElement.classList.add('scrm');

  // A page that already says which season it is showing does not need a second thing saying it.
  // /telemetry has that chip in its own header, and a floating badge in the corner sat straight
  // on top of the run scrubber. So a page can nominate an element to be the trigger, and keeps
  // its own layout; every other page gets the corner badge.
  const anchor = document.querySelector('[data-scrm-anchor]');
  if (anchor) {
    // Marked with attributes, not classes: /telemetry reassigns this chip's className as it
    // repaints, which silently wiped a class and left the chip dead.
    anchor.setAttribute('data-scrm-anchored', '');
    anchor.setAttribute('role', 'button');
    anchor.setAttribute('tabindex', '0');
    anchor.title = 'What this site is, and how to run it live with your own key';
    anchor.addEventListener('click', () => M.toggle());
    paintBadge();
    anchor.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); M.toggle(); }
    });
  } else {
    badge = el('button', 'scrm-badge');
    badge.type = 'button';
    badge.addEventListener('click', () => M.toggle());
    paintBadge();
    document.body.append(badge);
  }

  document.addEventListener('keydown', ev => {
    const t = ev.target && ev.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
    if (ev.key === '?') { ev.preventDefault(); M.toggle(); }
  });

  // A link can point straight at the explanation — the README does, so a judge lands on the
  // honest framing rather than having to find the badge.
  if (/(^|[?&])(demo|mode)(=|&|$)/.test(location.search)) M.open();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => M.boot());
} else { M.boot(); }
})(window.SCR = window.SCR || {});
