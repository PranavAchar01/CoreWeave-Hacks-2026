#!/usr/bin/env node
// Concatenates src/ into the single artifact fragment scrutineer.html and syntax-checks the script.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = __dirname, src = path.join(root, 'src');
// The mark: a two-by-two chequer, gold on night, centred with a two-pixel margin. One
// definition — it used to be pasted into two of the three documents and missing from the third.
const FAVICON = `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'%3E%3Crect width='16' height='16' fill='%2306081A'/%3E%3Cpath d='M2 2h6v6H2zM8 8h6v6H8z' fill='%23F4C542'/%3E%3C/svg%3E">`;
const ORDER = ['engine.js', 'car.js', 'world.js', 'sim.js', 'trackscene.js', 'team.js', 'garage.js', 'scenes.js', 'season.js', 'ui.js', 'trial.js', 'dash.js', 'story.js', 'main.js'];
const present = ORDER.filter(f => fs.existsSync(path.join(src, f)));
const missing = ORDER.filter(f => !present.includes(f));
if (missing.length) console.log('build: skipping missing modules:', missing.join(', '));
const js = present.map(f => `// ===== ${f} =====\n${fs.readFileSync(path.join(src, f), 'utf8')}`).join('\n');
const css = fs.readFileSync(path.join(src, 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
// The loop's own output, when a season has been run. The broadcast reads it for the REGS
// articles, so nothing technical on screen is invented by the UI.
const bundlePath = path.join(root, 'loop', 'state', 'broadcast.json');
let loopJs = '', seeded = false;
if (fs.existsSync(bundlePath)) {
  const raw = fs.readFileSync(bundlePath, 'utf8');
  seeded = !!JSON.parse(raw).demo; // fail the build rather than ship a bundle the page cannot parse
  loopJs = `window.SCRUTINEER_LOOP = ${raw};\n`;
  // the blame matrix, so the page reports what was measured rather than what was written here
  for (const [file, global] of [['partition.json', 'SCRUTINEER_PARTITION'],
                                ['sides.json', 'SCRUTINEER_SIDES'],
                                ['bcb_compare.json', 'SCRUTINEER_BCB']]) {
    const f = path.join(root, 'loop', 'state', file);
    if (fs.existsSync(f)) loopJs += `window.${global} = ${fs.readFileSync(f, 'utf8')};\n`;
  }
  console.log(`build: inlined loop bundle ${(raw.length / 1024).toFixed(0)} KB`);
} else {
  console.log('build: no loop bundle (run `scrutineer season --export` in loop/)');
}
const out = `<title>Scrutineer</title>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;600&family=Press+Start+2P&family=VT323&display=swap">\n<style>\n${css}\n</style>\n${html}\n<script>\n${loopJs}${js}\n</script>\n`;
fs.writeFileSync(path.join(root, 'scrutineer.html'), out);

// The same page, wrapped as a standalone document for hosting. The artifact runtime supplies the
// skeleton; a web host does not, so the site build adds it (and a CSP that keeps the visitor's
// key from going anywhere except the relay).
const siteDir = path.join(root, 'site', 'public');
if (fs.existsSync(path.dirname(siteDir))) {
  fs.mkdirSync(siteDir, { recursive: true });
  const head = `<title>Scrutineer</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;600&family=Press+Start+2P&family=VT323&display=swap">
<style>
${css}
</style>`;
  const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="An agent that builds web interfaces and rebuilds its own harness. Every page it builds is a real document you can open and audit yourself.">
<meta property="og:title" content="Scrutineer">
<meta property="og:description" content="Watch an agent rewrite its own harness, run by run. Every interface it builds is a real page you can open and audit with axe-core yourself.">
<meta name="theme-color" content="#06081A">
${FAVICON}
${head}
</head>
<body>
${html}
<script>
${loopJs}${js}
</script>
</body>
</html>`;
  fs.writeFileSync(path.join(siteDir, 'watch.html'), doc);
  // The interfaces the agent built, copied in as real documents so each one has a URL a
  // reviewer can open and audit independently. They have to be the pages the inlined bundle
  // describes, so the seeded season's pages and a live season's pages live in separate
  // directories and the bundle picks which one ships.
  const pagesSrc = path.join(root, 'loop', 'state', seeded ? 'demo-pages' : 'pages');
  // Only replace what is published if the source can actually account for every page the bundle
  // links to. An interrupted `scrutineer demo` leaves a directory with one page in it, and this
  // used to wipe two hundred real documents and copy that one in — the build reported success
  // and the site lost the artifact it exists to show.
  const wanted = [];
  if (fs.existsSync(bundlePath)) {
    const b = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
    for (const r of (b.rounds || [])) for (const pg of (r.pages || [])) if (pg.file) wanted.push(pg.file);
  }
  const missing = fs.existsSync(pagesSrc)
    ? wanted.filter(f => !fs.existsSync(path.join(pagesSrc, f))) : wanted;
  if (fs.existsSync(pagesSrc) && missing.length) {
    console.log(`build: NOT touching site/public/pages — ${path.basename(pagesSrc)} is missing `
      + `${missing.length} of ${wanted.length} pages the bundle links to (e.g. ${missing[0]}). `
      + 'Re-run the season/demo to completion first.');
  } else if (fs.existsSync(pagesSrc)) {
    const dst = path.join(siteDir, 'pages');
    fs.rmSync(dst, { recursive: true, force: true });
    fs.cpSync(pagesSrc, dst, { recursive: true });
    const n = fs.readdirSync(dst).reduce((a, d) =>
      a + fs.readdirSync(path.join(dst, d)).length, 0);
    console.log(`build: copied ${n} ${seeded ? 'seeded' : 'built'} interface(s) `
                + 'into site/public/pages');
  }
  console.log(`build: site/public/watch.html ${(doc.length / 1024).toFixed(0)} KB`);
}
// ---------------------------------------------------------------------------------------
// The front door. Same palette, same two typefaces, same car — it has to read as the same
// object as the broadcast rather than as marketing wrapped around it. It carries only what
// the hero needs of the recorded season: which runs promoted, and which component.
// ---------------------------------------------------------------------------------------
if (fs.existsSync(path.dirname(siteDir))) {
  const LD_ORDER = ['engine.js', 'car.js', 'landing.js'];
  const ldSrc = LD_ORDER.map(f => fs.readFileSync(path.join(src, f), 'utf8')).join('\n');
  const ldCss = fs.readFileSync(path.join(src, 'landing.css'), 'utf8');
  const ldHtml = fs.readFileSync(path.join(src, 'landing.html'), 'utf8');
  let slim = { rounds: [] };
  if (fs.existsSync(bundlePath)) {
    const b = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
    slim.rounds = (b.rounds || []).map(r => ({ promoted: !!r.promoted, role: r.role || null }));
  }
  const ldDoc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Scrutineer — an agent that rebuilds its own harness</title>
<meta name="description" content="An agent builds web interfaces, measures which part of itself caused its failures, rewrites that part, and keeps the change only if it survives ten checks and a held-out split.">
<meta property="og:title" content="Scrutineer">
<meta property="og:description" content="The car is the agent. Ten components decide how it works, and it rewrites them itself.">
<meta name="theme-color" content="#06081A">
${FAVICON}
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap">
<style>
${ldCss}
</style>
</head>
<body>
${ldHtml}
<script>
window.SCRUTINEER_LOOP = ${JSON.stringify(slim)};
${ldSrc}
window.addEventListener('DOMContentLoaded', () => SCR.landing.boot());
</script>
</body>
</html>`;
  fs.writeFileSync(path.join(siteDir, 'index.html'), ldDoc);
  const t4 = path.join(root, '.build-check-ld.js'); fs.writeFileSync(t4, ldSrc);
  const r4 = cp.spawnSync(process.execPath, ['--check', t4], { encoding: 'utf8' });
  fs.unlinkSync(t4);
  if (r4.status !== 0) { console.error(r4.stderr); process.exit(1); }
  console.log(`build: site/public/index.html (landing) ${(ldDoc.length / 1024).toFixed(0)} KB`);
}

// ---------------------------------------------------------------------------------------
// A second, separate site: the car across the whole season on one scrubber. Stubbed on purpose —
// it reads the recorded season, so it is the same ten runs every time and nothing waits on a
// model. Deployed as its own Vercel project so it has a link of its own.
// ---------------------------------------------------------------------------------------
const TL_ORDER = ['engine.js', 'car.js', 'world.js', 'sim.js', 'trackscene.js',
                  'team.js', 'garage.js', 'timeline.js'];
const tlSrc = TL_ORDER.map(f => fs.readFileSync(path.join(src, f), 'utf8')).join('\n');
const tlHtml = fs.readFileSync(path.join(src, 'timeline.html'), 'utf8');
const tlCss = fs.readFileSync(path.join(src, 'timeline.css'), 'utf8');
const tlDoc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Scrutineer — the car, run by run</title>
${FAVICON}
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap">
<style>
${tlCss}
</style>
</head>
<body>
${tlHtml}
<script>
${loopJs}${tlSrc}
window.addEventListener('DOMContentLoaded', () => SCR.timeline.boot());
</script>
</body>
</html>`;
const tlDir = path.join(root, 'site-timeline', 'public');
fs.mkdirSync(tlDir, { recursive: true });
fs.writeFileSync(path.join(tlDir, 'index.html'), tlDoc);
{
  const t2 = path.join(root, '.build-check-tl.js'); fs.writeFileSync(t2, tlSrc);
  const r2 = cp.spawnSync(process.execPath, ['--check', t2], { encoding: 'utf8' });
  fs.unlinkSync(t2);
  if (r2.status !== 0) { console.error(r2.stderr); process.exit(1); }
}
console.log(`build: site-timeline/public/index.html ${(tlDoc.length / 1024).toFixed(0)} KB`);

// ---------------------------------------------------------------------------------------
// The pit board: the car on a card that stays on top. One bundle that mounts itself, shipped
// twice — as a page (site/public/pit.html) and as the embed (site/public/pit.js) any page can
// load in one line. It carries only what the card needs of the recorded season.
// ---------------------------------------------------------------------------------------
{
  const PIT_ORDER = ['engine.js', 'car.js', 'sim.js', 'pit.js'];
  const pitSrc = PIT_ORDER.map(f => fs.readFileSync(path.join(src, f), 'utf8')).join('\n');
  const pitCss = fs.readFileSync(path.join(src, 'pit.css'), 'utf8');
  const pageCss = fs.readFileSync(path.join(src, 'pitpage.css'), 'utf8');
  const pitHtml = fs.readFileSync(path.join(src, 'pit.html'), 'utf8');
  let season = { demo: false, rounds: [] };
  if (fs.existsSync(bundlePath)) {
    const b = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
    season = { demo: !!b.demo, rounds: (b.rounds || []).map(r => ({
      generation: r.generation, promoted: !!r.promoted, role: r.role || null, part: r.part || null,
      official_s: r.official_s, claimed_s: r.claimed_s, rule_fired: r.rule_fired || null,
      summary: r.diff_summary || '', failed: (r.gates || []).filter(g => !g.ok).map(g => g.gate),
      laps: (r.tasks || []).length * 2 || 40 })) };
  }
  const pitJs = `window.SCRUTINEER_PIT = ${JSON.stringify(season)};\nwindow.SCRUTINEER_PIT_CSS = ${JSON.stringify(pitCss)};\n${pitSrc}`;
  fs.writeFileSync(path.join(siteDir, 'pit.js'), pitJs);
  const fonts = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap';
  // inlined in a <script>, so the bundle must not contain the sequence that would close it
  const pitInline = pitJs.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
  const pitDoc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="The Scrutineer pit board: the agent's car on a card that stays on top, rebuilding each time the loop lands a generation.">
<meta property="og:title" content="Scrutineer — pit board">
<meta name="theme-color" content="#06081A">
${FAVICON}
<title>Scrutineer — pit board</title>
<link rel="stylesheet" data-pit href="${fonts}">
<style data-pit>
${pitCss}
</style>
<style>
${pageCss}
</style>
</head>
<body>
${pitHtml}
<script>
${pitInline}
</script>
</body>
</html>`;
  fs.writeFileSync(path.join(siteDir, 'pit.html'), pitDoc);
  const t3 = path.join(root, '.build-check-pit.js'); fs.writeFileSync(t3, pitJs);
  const r3 = cp.spawnSync(process.execPath, ['--check', t3], { encoding: 'utf8' });
  fs.unlinkSync(t3);
  if (r3.status !== 0) { console.error(r3.stderr); process.exit(1); }
  console.log(`build: site/public/pit.html ${(pitDoc.length / 1024).toFixed(0)} KB, pit.js ${(pitJs.length / 1024).toFixed(0)} KB, ${season.rounds.length} rounds`);
}

// syntax check
const tmp = path.join(root, '.build-check.js'); fs.writeFileSync(tmp, js);
const r = cp.spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' }); fs.unlinkSync(tmp);
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
if (/console\.log\(/.test(js)) console.log('build: WARNING console.log present in modules');
if (/getContext\(\s*["']webgl/i.test(js)) console.log('build: WARNING WebGL used');
console.log(`build: scrutineer.html ${(out.length / 1024).toFixed(0)} KB, modules: ${present.join(', ')}`);
