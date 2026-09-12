# SCRUTINEER — Definitive Design: "1994 BROADCAST FEED"

This document supersedes DESIGN-A, DESIGN-B and DESIGN-C. It is the build contract. It keeps direction A's identity
(a 1994 night-race world feed with a white-on-black timing tower, red session idents, gold chrome rules and a
stewards' crawl) and grafts in the engineering that the judge panel asked for: a fixed story schedule with constant
jump times, no text drawn on canvas, an x-ray scanner, a sky that tells the session, a lineage strip column-aligned
over the chart, odometer number rolls, a points drain, a shadow-partner palette, world-anchored dither on cached
layers, probed VT323 sizes, a symmetric 16-direction car sheet, a square-stamp track raster and the UPGRADE VOID verdict.

Units: **lp** = logical pixel on a canvas before integer upscale; **sp** = screen (CSS) pixel. **Tick** = 1/30 s of
simulation time. At x1 speed 30 ticks pass per real second. No code appears here; the numbers are the contract.

---

## 0. The ten rules (read before anything else)

1. Every pixel on the page is one of the 16 palette colours in §2.1. No alpha, no `globalAlpha`, no CSS `opacity`
   other than 0 or 1, no gradients, no blur, no `filter`, no `transform: rotate`, no `arc()`, no `lineTo` strokes.
2. Every shade is a **ramp** (2–4 palette colours) quantised through the one 8x8 Bayer matrix (§2.2). Constant mixes
   are eighths only.
3. **Text never touches a canvas.** Every string of 8 lp or larger is HTML in Press Start 2P or VT323, positioned on
   the sp grid. Canvases carry art, wipes, flags and the 3x5 MICRO font for labels under 8 lp (§3.4).
4. Two fonts, five sizes: Press Start 2P at 8, 16, 32 sp; VT323 at 12 and 24 sp (§3). Nothing else.
5. Everything is a pure function of `(seed, tick)`. Seeking to a tick renders exactly what playing there renders,
   including the ticker, the telemetry ring, tower order, and every animation phase (§5.6).
6. Phase start times are pure functions of the round index (§5.1). `JUMP: THE BLACK FLAG` = t 262.0.
   `JUMP: CONVERGENCE` = t 963.0. Both are constants for every seed.
7. Everything moves in whole pixels in stepped easings (§8). CSS transitions only with `steps()`.
8. Static layers are rasterised once and blitted; only sprites, beams, trails, lamps and cards draw per tick (§4.3).
9. The camera pans in Practice and Qualifying only (deadzone follow, ±8 lp). On race day, in the garage, the bay and
   parc fermé it is locked: the official picture does not follow the team.
10. F1 vocabulary only outside REGS. The only exception is the scrutineering footnote family in §9.5, which appears
    under the checklist on a FAIL, on the BLACK FLAG card, and in the round-12 audit line.

---

## 1. Concept

The whole page is the world feed of a 1994 night race. A broadcast-blue picture sits between a pure-black FOM timing
tower on the left and a cyan FIA telemetry channel on the right; the constructors' band, the season chart and the
stewards' ticker run beneath. The hero canvas is the camera: CAM 2 GARAGE, CAM 1 CIRCUIT, CAM 3 SCRUTINEERING and
CAM 4 PARC FERMÉ are four positions the director cuts between, and every phase change is a red ident that slams in
from the left carrying the session word. Every ceremony (black flag, upgrade void, seal, lineage audit, finale) is a
full-frame card at x4 pixel scale, the "ident" scale, so it reads from the back of a room.

The furniture vocabulary is a 1994 caption generator: solid bugs (LIVE, the session badge, the STEWARDS tag), one
4 sp chrome rule under every card title, uppercase Press Start 2P for everything the broadcast writes and VT323 for
everything the machine writes (telemetry, footnotes, the seed, the rulebook).

**The one aesthetic risk** is the chrome rule tipping into a Windows 95 title bar. Fence: the chrome rule is always
exactly 4 sp tall, it sits only under text or around a ceremony card, it never fills a surface, and nothing on the
page has a bevelled edge.

---

## 2. Palette and dithering

### 2.1 Palette (16 colours; nothing else may ever appear)

| Name | Hex | Role |
|---|---|---|
| NIGHT | `#06081A` | page ground, letterbox, deepest sky, ceremony card ground, parc fermé ground |
| STUDIO | `#121A4A` | broadcast blue: panel grounds, sky haze, garage and bay walls |
| TARMAC | `#2C2E3A` | asphalt, bay floor, pit building |
| GRASS | `#1F6B3C` | infield and outfield |
| GRASS DARK | `#123F24` | grass vignette partner, grandstand shadow |
| GRAVEL | `#8C7B58` | run-off, garage floor, tyre-stack rims |
| INK | `#000000` | outlines, tower ground, ticker ground, black flag, wipe cells |
| WHITE | `#FFFFFF` | primary text on tower and cards, kerb white, car body, wipe cells |
| CAPTION | `#C8CBD8` | secondary text, telemetry body, chrome stop 2, exhaust |
| MIDGREY | `#6A6F8A` | disabled text, gaps, asphalt grain, chrome stop 3 |
| GOLD | `#F4C542` | TEAM CLAIMED, current tower row, chrome gold, seal ring, changed-part glow |
| RED | `#E31E2D` | idents, STEWARDS tag, kerb red, OFFICIAL card, black-flag border, car stripe, FAIL |
| PURPLE | `#B04BFF` | fastest sector, practice-dusk sky horizon |
| CYAN | `#3DD2FF` | FIA telemetry, scanner beam, terminal screens, sealed-circuit tape, antenna |
| GREEN | `#2FD968` | PASS, SEALED, green sector, under-cap bar |
| AMBER | `#FFA318` | slow sector, cap danger zone, divergence delta, marshal vest, garage window sky, illegal telemetry lines |

Contrast pairs that are always allowed: WHITE/INK, WHITE/NIGHT, WHITE/STUDIO, WHITE/RED, CAPTION/NIGHT,
CAPTION/STUDIO, CAPTION/INK, INK/GOLD, INK/GREEN, INK/CYAN, INK/CAPTION, INK/WHITE, GOLD/INK, GOLD/NIGHT,
CYAN/NIGHT, CYAN/STUDIO, AMBER/NIGHT, AMBER/INK, RED/INK (only at 16 sp and above). Never: MIDGREY text on STUDIO
at 8 sp, RED text on STUDIO, PURPLE text anywhere (PURPLE is a lamp and a sky colour, never a text colour).

### 2.2 The Bayer matrix and the quantisation rule

One 8x8 matrix, values 0–63, indexed `M[y mod 8][x mod 8]`:

```
 0 32  8 40  2 34 10 42
48 16 56 24 50 18 58 26
12 44  4 36 14 46  6 38
60 28 52 20 62 30 54 22
 3 35 11 43  1 33  9 41
51 19 59 27 49 17 57 25
15 47  7 39 13 45  5 37
63 31 55 23 61 29 53 21
```

Threshold `T(x, y) = (M[y mod 8][x mod 8] + 0.5) / 64`.

A **ramp** is an ordered list of 2–4 palette colours `ramp[0..n-1]`. To shade a pixel with scalar `v` in [0, 1]:
`u = v * (n - 1)`, `i = floor(u)` (clamped to n − 2), `f = u − i`, quantise `f` to eighths (`f8 = round(f * 8) / 8`),
then the pixel is `ramp[i + 1]` if `f8 > T(x, y)` else `ramp[i]`. A constant-mix surface is a 2-stop ramp with a
constant `v` in {0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875}. `v = 0.5` is therefore always the exact checkerboard.
A ramp may contain the pseudo-colour **NONE** (skip the pixel) so a dithered overlay can be composited on a cached
layer without alpha, e.g. `[NONE, CYAN]` at v 0.375.

**Coordinate spaces.** Cached static layers (sky, ground, garage/bay/parc fermé backplates, chart fills, panel
tiles) index the matrix by **world** logical coordinates: the dots are printed on the picture and slide with it when
the camera pans. Dynamic overlays (scanner, exhaust, glows, scrims, wipes, flood pulses) index by **screen** logical
coordinates: light passes through a fixed screen of dots. A layer never mixes the two, so nothing ever crawls.

**Shadow partners.** A shadow is a palette lookup, not a darkening. Partners: WHITE→CAPTION, CAPTION→MIDGREY,
MIDGREY→STUDIO, STUDIO→NIGHT, NIGHT→NIGHT, INK→INK, TARMAC→NIGHT, GRASS→GRASS DARK, GRASS DARK→NIGHT,
GRAVEL→MIDGREY, GOLD→GRAVEL, RED→TARMAC, PURPLE→STUDIO, CYAN→STUDIO, GREEN→GRASS, AMBER→GRAVEL. A shadow region
reads the pixel beneath, looks up the partner, and dithers toward it at v 0.5 (soft: sprite shadows, card drop
shadows) or v 1.0 (hard: under the car, under barriers and tyre stacks). Shadows are offset (+1, +1) lp and are
never blurred.

### 2.3 Named ramps

| Ramp | Stops (v 0 → 1) | Where |
|---|---|---|
| SKY GARAGE | NIGHT, STUDIO, AMBER | garage window strip, top to bottom (golden hour) |
| SKY PRACTICE | NIGHT, STUDIO, PURPLE | practice sky band (dusk) |
| SKY QUALI | NIGHT, STUDIO | qualifying sky band (twilight) |
| SKY RACE | NIGHT, STUDIO | race and parc fermé sky: v 0 for rows 0–31, rises to 0.25 by row 39; 12 seeded WHITE stars |
| PANEL | STUDIO, NIGHT | HTML panel grounds: four bands at v 0, 0.125, 0.25, 0.375 top to bottom |
| ASPHALT | TARMAC, MIDGREY at constant 0.125 | road grain |
| RUBBER | INK over ASPHALT at 0.375 | racing line, practiced layout only |
| GRASS VIGNETTE | GRASS, GRASS DARK; v = clamp((d − 14) / 46, 0, 1), d = distance to the road | grass |
| GRAVEL EDGE | GRAVEL, GRASS; v across the run-off band | corner run-off |
| CHROME | WHITE, CAPTION, MIDGREY, STUDIO | the 4 sp chrome rule: one solid 1 sp line per stop, top to bottom |
| CHROME GOLD | WHITE, GOLD, GRAVEL, STUDIO | chrome rule under the wordmark and on the TEAM CLAIMED card only |
| GLOW GOLD | NONE, GOLD; v 0.75, 0.5, 0.25, 0 over 4 lp outward | changed parts on the garage car, current tower row ground (0.125 tile), seal impression |
| SCANNER | NONE, CYAN; core 8 lp at v 1.0 then v = 1 − (|x − sx| − 4) / 8 quantised to eighths out to 12 lp | scrutineering beam, audit beam |
| SCANNER RED | NONE, RED, same field | the beam on a failing part |
| EXHAUST | NONE, CAPTION; sample k of N: v = 1 − k / N | trail |
| FLOOD | NONE, CAPTION; v = 0.5 at the mast head decaying to 0 over 40 lp in a 60° wedge | floodlight cones (static, baked) |
| DIVERGENCE | NONE, RED at 0.25 | chart band between TEAM CLAIMED and OFFICIAL |
| CAP DANGER | STUDIO, AMBER at 0.5 | cost cap 85–100% zone; over the cap STUDIO, RED at 0.5 |
| SCRIM | NONE, INK at 0.5 | standings scrim, REGS scrim, ghost car mask, CAM watermark box |
| GREEN IMPRESSION | NONE, GREEN at 0.25 | disc behind the seal stamp |
| HATCH | 1 lp INK diagonal every 4 lp | the chart divergence band at a STRIPPED round only; the sole diagonal texture on the page |

### 2.4 HTML surfaces

At boot the page renders every 8x8 tile it needs into an 8x8 canvas, exports a PNG data URI, and uses it as a
`background-image` with `image-rendering: pixelated` and `background-size: 16px 16px` (x2, so panel dots match the
hero's pixel size). Tiles: PANEL v 0 (solid STUDIO), 0.125, 0.25, 0.375; GLOW GOLD 0.125 over INK; SCRIM 0.5 (INK
over transparent); MIDGREY over STUDIO at 0.125 (chart empty grid). Panel grounds needing a vertical ramp are four
stacked bands of equal height, never a CSS gradient. The wipe, scanner, glows and ghost are canvas, never CSS.

---

## 3. Typography

Google Fonts stylesheet, `display=swap`, two families, fallback `"Courier New", monospace` on both.
`-webkit-font-smoothing: none` on `html`. Widths are fixed in sp; layout never depends on glyph advance, so nothing
reflows when the web font arrives.

**Press Start 2P** (the broadcast writes this). Uppercase always. 1 em monospace: one glyph = size in sp.

| Size / line | Where |
|---|---|
| 8 / 16 | tower rows, badges, buttons, ticker, chart legend, panel titles, header round line, hint text, band labels |
| 16 / 24 | wordmark, in-picture readouts, card titles, TEAM CLAIMED / OFFICIAL values, ident round tag, season total |
| 32 / 40 | ident session word, BLACK FLAG / UPGRADE VOID / SEASON 1 · CHAMPION titles, SEALED on the seal band |

**VT323** (the machine writes this). Probed in headless Chrome: clean 1x1 blocks at 12 sp, clean 2x2 blocks at
24 sp; 16 and 20 sp are forbidden. Letter-spacing 0.4 sp at 24 (glyph cell = exactly 10 sp) and 0.2 sp at 12 (cell
= 5 sp), so column layouts are computed in characters. Uppercase except tool identifiers (`run_tests`,
`read_file`) and the REGS paragraph.

| Size / line | Where |
|---|---|
| 24 / 24 | telemetry feed, in-picture card body lines, checklist rows, footnotes, SEED input, REGS table and paragraph, standings rows, upgrade card body |
| 12 / 12 | control hint at 1280 and 1024, tower DQ sub-label at 1024, telemetry at 390 |

### 3.1 Pixel scales on the page

Exactly three pixel scales exist: the caption generator at x1 (8 sp Press Start 2P, 12 sp VT323 in the rails and
controls), the picture at x2 (the hero, the strip, the chart, every HTML overlay on the hero: 16 sp Press Start 2P
and 24 sp VT323 whose glyph pixels are 2 sp, matching the hero's lp), and the ident scale at x4 (the ceremony
overlay and its 32 sp titles). Nothing is drawn at a fourth scale.

### 3.2 Text over canvases

All in-picture text is HTML absolutely positioned inside the hero's wrapper on even sp offsets (lp x 2). Card grounds
(INK boxes, CAPTION borders, chrome rules) are HTML too. The canvas beneath never draws text. Ceremony text is HTML in
a layer above the ceremony canvas. Text inside a ceremony card lands after the wipe has uncovered the card ground
(§6.9) so the wipe still reads as revealing the card.

### 3.3 Font loading

Until `document.fonts.ready`, HTML text renders in the fallback at the same sizes. No canvas depends on fonts.

### 3.4 MICRO font (canvas only)

A 3x5 bitmap font defined as pixel rows in source: digits, A–Z, `:` `.` `+` `-` `/` `·` and space, 1 lp gap between
glyphs (4 lp advance). Used only for: sector post signs `S1 S2 S3`, `PIT`, grandstand signs, the CAM watermark, the
layout label, the SEALED CIRCUIT note, lineage round numbers, chart y-axis labels, the cost cap `CAP` marker, the seal
ring's `GEN 07`, the car's number plate. Never for anything the audience must read from the back of the room.

---

## 4. Layout

Page ground NIGHT edge to edge (`html, body` painted). Wider than 1440 sp: the 1440 frame is centred in a NIGHT
letterbox; taller than 900: the frame is top-aligned. The grid is fixed sp values, never percentages, so every canvas
lands on an integer scale.

### 4.1 Region map at 1440 x 900

```
x:      0          288                              1104         1440
y 0     +----------+--------------------------------+------------+
        | HEADER (1440 x 56)                                     |
y 56    +----------+--------------------------------+------------+
        | TIMING   | HERO CANVAS 816 x 608          | FIA        |
        | TOWER    | logical 408 x 304 @ x2         | TELEMETRY  |
        | 288      |                                | 336        |
y 664   +----------+--------------------------------+------------+
        | CONSTR.  | LINEAGE STRIP 816 x 48         | SESSION    |
        | 288      | logical 408 x 24 @ x2          | TIMES 336  |
y 720   +----------+--------------------------------+------------+
        | COST CAP | CHART 816 x 148                | CONTROLS   |
        | 288      | canvas 816 x 120, logical      | 336        |
        |          | 408 x 60 @ x2                  |            |
y 868   +----------+--------------------------------+------------+
        | STEWARDS TICKER (1440 x 32)                            |
y 900   +--------------------------------------------------------+
```

The lineage strip and the chart canvas share x origin 288 and width 816, so lineage slot i and chart column i are
the same 17 lp column (§7.9): each round's car stands directly over its own two points and its flag marker.

**HEADER** (0, 0, 1440 x 56). Ground PANEL v 0. Contents vertically centred on a 16 sp baseline grid:
- Wordmark `SCRUTINEER` at x 16, 16 sp WHITE; CHROME GOLD rule 4 sp directly beneath, 160 wide.
- Round line at x 256, 8 sp CAPTION: `SEASON 1 · ROUND 07/22 · SILVERSTONE-LIKE LAYOUT B` (50 chars, 400 sp).
  During RACE: `SEASON 1 · ROUND 07/22 · SEALED CIRCUIT · LAYOUT S07`.
- Session badge at x 776, 160 x 24: solid bar, badge word 8 sp centred (§9.2).
- Session clock at x 952, 8 sp WHITE: `SESSION 00:04.7` (§6.0).
- Lap counter at x 1128, 8 sp WHITE: `LAP 2/3`, `OUT LAP`, or blank.
- LIVE bug at x 1368, 56 x 24: RED box, `LIVE` WHITE 8 sp, a 4 x 4 WHITE square at its left blinking at 1 Hz
  simulation time (lit steadily under reduced motion, and MIDGREY while paused).
- y 52–56: CHROME rule, full width.

**TIMING TOWER** (0, 56, 288 x 608). Ground INK, the one pure-INK panel.
- y 56–80: `TIMING · OFFICIAL` 8 sp CAPTION at x 16 with 1 sp tracking; RED 4 x 24 tag block at x 0.
- y 80–96: heads 8 sp MIDGREY: `POS` x 8, `GEN` x 32, `TIME` x 64, `GAP` x 144, `PTS` right-aligned to 280.
- y 96–624: 22 rows of 24 sp, text 8 sp on baseline 16 within the row. Columns as the heads. Row content:
  `01`, `G07`, `1:29.310`, `LEADER` / `+0.412`, `25`. POS WHITE, GEN CAPTION, TIME WHITE, GAP MIDGREY, PTS GOLD.
  Not-yet-run generations: `--` MIDGREY in POS, rest blank, so the season's length is visible from round 1.
  Rows with only a claimed time (between qualifying and the race): TIME in GOLD, GAP reads `CLAIMED`, unranked at
  the bottom of the ranked block.
- Current round's row: text GOLD, 2 sp GOLD bar at x 0, ground GLOW GOLD 0.125 tile.
- Black-flagged row: text CAPTION, 1 sp WHITE strikethrough through TIME (drawn left to right over 8 ticks when it
  lands), an 8 x 6 flag glyph (INK box, 1 sp WHITE border, CSS-drawn) at x 144, `DQ` at x 160 (`VOID` for an
  upgrade-void round), PTS `0`. Sorted after all ranked rows, in round order.
- Stripped row: as black-flagged but the glyph is hollow (WHITE border only), GAP reads `STRIPPED`, PTS `0`.
- New official best: a 4 x 4 GOLD square before POS for the rest of the round.
- y 624–664 footer, 8 sp MIDGREY with CSS glyphs: `[flag] BLACK FLAG  [hollow] STRIPPED  [gold square] NEW BEST`.
- Reorders: step-4 vertical slide, 24 sp per row, 6 ticks (§8).

**HERO** (288, 56, 816 x 608). One canvas, logical 408 x 304, x2, `image-rendering: pixelated`, plus an HTML overlay
layer of the same box. Canvas layers (offscreen, all 408 x 304 unless noted): `sky` 408 x 40 (cached per session
type), `ground` 424 x 280 (cached per layout, world y 32–312, drawn at screen offset (−8 − cx, 40 − 32 − cy) so the
camera offset (cx, cy) in [−8, 8] slides it), `dynamic` (drawn per tick straight onto the visible canvas). Corner
marks: 4 lp L-shaped CAPTION ticks, 12 lp long, at each hero corner, always.
HTML overlay slots (sp, relative to the hero's top-left; all listed in §6):
- top-left watermark block at (16, 16): CAM line, layout line, sealed-circuit note (MICRO on canvas, not HTML).
- UPGRADE PACKAGE card 400 x 200 at (16, 48).
- TECHNICAL CHECK panel 256 x 216 at (544, 80).
- Lap readout 240 x 88 at (560, 504).
- TEAM CLAIMED card 400 x 64 at (16, 528); its stacked strip 400 x 32 at (16, 496). OFFICIAL card 400 x 64 at (16, 528).
- Footnote line at (16, 552), full hero width, VT323 24.
- Standings card 400 x 168 at (48, 96).

**FIA TELEMETRY** (1104, 56, 336 x 608). Ground PANEL bands.
- y 56–80: `FIA TELEMETRY` 8 sp CAPTION at x 1120; CYAN 4 x 24 tag block at x 1104; a 6 x 6 CYAN square at x 1418
  pulsing at 2 Hz simulation time (steady under reduced motion).
- y 80–96: `TEAM CANNOT WRITE TO THIS CHANNEL` 8 sp CYAN at x 1120. Never scrolls.
- y 96–624: the feed. VT323 24, 32 characters per line (320 sp), 22 lines = 11 entries, newest at the bottom.
  Each entry is two lines: `SESS 3F2A · TURN 04` (CAPTION) then the event line (CAPTION; `SEAL VERIFIED` lines
  CYAN; lines naming an illegal part AMBER). The feed shifts up by 48 sp per entry, hard.
- y 624–664: blank PANEL band 3.

**CONSTRUCTORS** (0, 664, 288 x 56). Ground PANEL band 1. Line 1 (y 668): `CONSTRUCTORS' CHAMPIONSHIP` 8 sp CAPTION
at x 16, 1 sp tracking. Line 2 (y 688, 24 tall): `343 PTS` 16 sp GOLD at x 16 (odometer rolls), then at x 152
8 sp CAPTION `G22 LEADS` (the leader by points; `NO POINTS` before round 1's seal).

**LINEAGE STRIP** (288, 668, 816 x 48): canvas logical 408 x 24, x2 (§7.9).

**SESSION TIMES** (1104, 664, 336 x 56). Ground PANEL band 1.
- Line 1 (y 668): `TEAM CLAIMED` 8 sp GOLD at x 1112; value `1:27.902` 16 sp GOLD at x 1224.
- Line 2 (y 692): `OFFICIAL` 8 sp WHITE at x 1112; value 16 sp WHITE at x 1224; `DELTA +1.408` 8 sp at x 1336
  (AMBER when claimed is faster than official by more than 0.3 s, GREEN otherwise).
- Values read `--:--.---` in MIDGREY until they exist for the current round; they reset at each round's GARAGE.
  Values arrive with an odometer roll (§8). This block is visible at every seek time.

**COST CAP** (0, 720, 288 x 148). Ground PANEL band 2.
- y 720–744: `COST CAP · ROUND 07` 8 sp CAPTION at x 8.
- Canvas at (8, 744), 272 x 56 sp, logical 136 x 28: bar 112 x 12 lp at (12, 8): 0–85% of cap GREEN solid,
  85–100% CAP DANGER, beyond the cap RED at 0.5 over STUDIO; empty bar STUDIO/NIGHT at 0.25. A 1 lp WHITE cap
  marker at x 108 (the cap is 96 lp of bar; 112 lp = 117%), `CAP` in MICRO above it.
- y 808–832: `$1,240 / $1,500` 16 sp WHITE at x 16 (RED when over).
- y 848–864: status 8 sp: `UNDER CAP` GREEN, `AT LIMIT` AMBER (85–100%), `OVER CAP · UPGRADE VOID` RED.
- The bar fills in 8 steps during GARAGE (§6.2).

**CHART** (288, 720, 816 x 148). Ground PANEL band 2. A 1 sp MIDGREY rule at y 720 full width.
- Canvas at (288, 724), 816 x 120, logical 408 x 60 (§7.10).
- y 844–868: title `TEAM CLAIMED vs OFFICIAL · LAP TIME BY ROUND` 8 sp CAPTION at x 296; legend at the right,
  ending at x 1096: GOLD 8 x 4 dash `TEAM CLAIMED`, WHITE 8 x 4 dash `OFFICIAL`, flag glyph `BLACK FLAG`.

**CONTROLS** (1104, 720, 336 x 148). Ground PANEL band 3. Buttons 24 sp tall, 8 sp text, INK ground, 2 sp CAPTION
border, 4 sp horizontal padding; active state GOLD ground with INK text; hover border WHITE; keyboard focus adds a
2 sp WHITE outer ring offset 2 sp. Rows start at x 1112 with 8 sp gutters:
- Row 1 (y 728): `PLAY`/`PAUSE` toggle 72 wide; `STEP` 56; `x1` `x2` `x4` 40 each (radio, active GOLD).
- Row 2 (y 760): `RESTART SEASON` 120; `SEED` label 8 sp CAPTION 32; input 96 wide, VT323 24 CYAN on INK, 2 sp
  CAPTION border, RED border while invalid, Enter applies.
- Row 3 (y 792): `JUMP: THE BLACK FLAG` 168; `JUMP: CONVERGENCE` 144.
- Row 4 (y 824): `REGS` 40; hint at x 1160, 8 sp MIDGREY: `SPACE PLAY  → STEP  1/2/4  R REGS`.

**TICKER** (0, 868, 1440 x 32). Ground INK, 2 sp GOLD rule at its top. Tag block x 0–120 RED with `STEWARDS` 8 sp
WHITE centred. Crawl area x 120–1440, clipped: bulletins 8 sp WHITE, joined by ` ·· ` in GOLD, moving left 2 sp per
tick (§8). A black-flag bulletin is RED. The tag block turns INK with WHITE text for 60 ticks after a black flag.

**REGS OVERLAY** (toggle): SCRIM tile over the whole viewport; a card 960 x 760 centred (internal scroll when the
viewport is shorter than 800): NIGHT ground, 4 sp CHROME border, title `SPORTING AND TECHNICAL REGULATIONS · SEASON 1`
16 sp GOLD, the table (§9.7) in VT323 24 two columns of 448 sp with 8 sp CAPTION column heads and 1 sp MIDGREY row
rules, the paragraph in VT323 24 CAPTION, footer `PRESS R OR ESC TO RETURN TO THE BROADCAST` 8 sp MIDGREY. Focus
is trapped inside; `R`/`ESC` close and return focus to the REGS button. The simulation keeps running beneath.

**CEREMONY OVERLAY**: a viewport-sized canvas, logical 360 x 225 at x4 (1440 x 900), plus an HTML text layer above
it. Hidden (and skipped entirely) except during idents, the black-flag/void ceremony, the seal close-up, the audit
banner and the finale. Z-order, bottom to top: page panels → hero canvas → hero HTML overlay → ceremony canvas →
ceremony text layer → REGS scrim → REGS card.

### 4.2 Canvas inventory

| Canvas | Logical | Scale | Screen at 1440 | Redraw |
|---|---|---|---|---|
| Hero (visible) | 408 x 304 | x2 | 816 x 608 | every tick: sky blit, ground blit, dynamic layer |
| Ground backplates (2 per round) | 424 x 280 | offscreen | — | built in the last 15 ticks of the previous STANDINGS (or at seek) |
| Sky bands (4) | 408 x 40 | offscreen | — | boot |
| Garage / bay / parc fermé backplates | 408 x 304 | offscreen | — | boot |
| Car sheet (16 frames) | 256 x 16 | offscreen | — | boot |
| Side-view car, x-ray car, people, flags | native | offscreen | — | boot |
| Lineage strip | 408 x 24 | x2 | 816 x 48 | state change, audit beam ticks |
| Chart | 408 x 60 | x2 | 816 x 120 | state change |
| Cost cap bar | 136 x 28 | x2 | 272 x 56 | garage fill steps |
| Ceremony overlay | 360 x 225 | x4 | 1440 x 900 | while visible |
| Tile generator | 8 x 8 | — | data URIs | boot |

Every canvas: `image-rendering: pixelated`, `imageSmoothingEnabled = false` re-asserted after any resize, integer
coordinates only, `fillRect` and `drawImage` only.

### 4.3 Per-tick budget on the hero

Sky blit (1), ground blit (1), trail (≤ 24 fillRects), ghost (1 drawImage through the cached mask), shadow (1), car
(1), sector lamps (3), gantry (5), watermark box; in the bay: the beam (≤ 24 columns x 68 rows of fillRect) and the
x-ray band (1 drawImage of the cached x-ray car clipped to the band). Nothing else redraws per tick. Panels redraw
on events only.

### 4.4 Folds

**1280 x 800.** Header 56; main 520; band 56; bottom 136; ticker 32. Tower 256 (rows 20 sp: 22 x 20 = 440 + title
and heads 40 + footer 40 = 520). Hero 736 x 520 (logical 368 x 260). Telemetry 288 (28 characters per line, 19
lines = 9 entries). Band: CONSTRUCTORS 256 | strip 736 (logical 368 x 24, pitch 15 lp, origin 22, 12 x 6 cars)
| SESSION TIMES 288 (labels at x +8, values 16 sp at x +104; the DELTA text is dropped and the OFFICIAL value
itself turns AMBER when claimed is faster by more than 0.3 s). Bottom: COST CAP 256 (canvas 240 x 56, logical 120
x 28, bar 96 x 12, cap marker x 92) | CHART 736 (canvas 736 x 108, logical 368 x 54) | CONTROLS 288 with five rows
of 20 sp buttons and 4 sp gutters starting 4 sp below the region's top: [PLAY 72, STEP 56, x1 x2 x4 40 each] [RESTART SEASON 120, SEED
32, input 96] [JUMP: THE BLACK FLAG 168] [JUMP: CONVERGENCE 144, REGS 40] [hint VT323 12 MIDGREY]. Ceremony
overlay 320 x 200 at x4.

**1024 x 768.** Header 48 (round line abbreviates to `S1 · R07/22 · SILVERSTONE-LIKE B` at x 208; badge x 560,
120 wide; clock x 696; lap x 840; LIVE x 960); main 504; band 48; bottom 136; ticker 32. Tower 208 (rows 20 sp;
columns `POS GEN TIME GAP`, PTS dropped; `STRIPPED` abbreviates to `STRIP`). Hero 576 x 504 (logical 288 x 252).
Telemetry 240 (VT323 24, 23 characters; the event line wraps onto a third line when longer, indented 2
characters; 9 entries visible). Band: CONSTRUCTORS 208 (`343 PTS` only) | strip 576 (logical 288 x 24, pitch 12,
origin 20, 10 x 5 cars, round numbers only every 5th slot) | SESSION TIMES 240 (one line per time: label 8 sp at
x +8, value 16 sp at x +104; no DELTA text; the OFFICIAL value turns AMBER when claimed is faster by more than
0.3 s). Bottom: COST CAP 208 (canvas 192 x 56,
logical 96 x 28, bar 80 x 12, cap at x 76) | CHART 576 (canvas 576 x 108, logical 288 x 54) | CONTROLS 240, five
rows of 20 sp: [PLAY 56, STEP 48, x1 x2 x4 32 each] [RESTART SEASON 120, SEED 32, input 72] [JUMP: THE BLACK FLAG
168] [JUMP: CONVERGENCE 144, REGS 40] [hint VT323 12]. Ceremony overlay 256 x 192 at x4. The hero's TECHNICAL
CHECK panel moves to (320, 56) and the UPGRADE PACKAGE card to 352 x 200 with its body at VT323 24 (26 characters
still fit: 260 sp).

**390 x 844** (stacked, vertical page scroll, no horizontal scroll):
1. Header, two rows of 32: row 1 wordmark 16 sp + LIVE bug; row 2 `S1 · R07/22` 8 sp + badge 96 wide + clock.
2. Hero canvas 390 x 292, logical 195 x 146 at x2. Road 10 lp, the same 16 x 16 car sheet. HTML overlays shrink:
   lap readout 160 x 64 at (222, 220), claimed/official cards 240 x 40 at (8, 244), upgrade card 240 x 160 at (8, 24),
   checklist 200 x 176 at (182, 24), footnote VT323 12.
3. Session times, 56 tall, as at 1024.
4. Controls: three rows of 24 (PLAY, STEP, x1 x2 x4 / RESTART SEASON, SEED / the two JUMPs and REGS in a row that
   scrolls horizontally inside its own container).
5. Chart 390 x 96 (logical 195 x 48, pitch 8 lp, origin 12, no y labels), cost cap beneath as a 390 x 40 canvas
   (logical 195 x 20) with the spend line under it.
6. Constructors line, then the lineage strip canvas at its 1440 size (816 x 48) inside an `overflow-x: auto` box.
7. Timing tower, 300 sp tall, internal vertical scroll, 20 sp rows, 1024 column set.
8. FIA telemetry, 240 sp tall, internal vertical scroll, VT323 12 (one line per entry, 76 characters).
9. Ticker, sticky to the viewport bottom, 24 sp tall, tag block 72 wide.
Ceremony overlay covers the viewport at logical 195 x 422, x2; ceremony titles at 16 sp.

---

## 5. The engine

### 5.1 Clock and schedule

30 ticks per simulated second. The engine advances `speed` ticks per 1/30 s of real time (real dt accumulated, capped
at 100 ms per frame); rendering draws the latest tick. STEP advances one tick. Nothing interpolates.

Phase offsets within a round (seconds at x1): GARAGE 0, PRACTICE 6, QUALIFYING 12, RACE 18, SCRUTINEERING 30,
VERDICT 38, STANDINGS 42, end 46. Round 12's STANDINGS runs 42–52 (the lineage audit), so:

`S(r) = 46 (r − 1) + (r ≥ 13 ? 6 : 0)` for r = 1..22. S(6) = 230, S(9) = 368, S(12) = 506, S(15) = 650, S(21) = 926,
S(22) = 972, season end 1018. Finale card from 1018; it holds until RESTART SEASON or a seed change (the clock keeps
counting so the LIVE dot and ticker continue).

`JUMP: THE BLACK FLAG` / `#moment=blackflag` → t = S(6) + 32.0 = **262.0** (the warm-up sweep is under way; check
1 starts at 262.6, the beam parks on FLOOR by 262.8 and the FAIL stamp lands at 264.1). `JUMP: CONVERGENCE` / `#moment=convergence` → t = S(21) + 37.0 = **963.0** (the fifth
clean scrutineering's last check; the seal at 38.8 enqueues bulletin 9 at 39.4).

### 5.2 PRNG and seeds

mulberry32 from the SEED input (default 1994; integer, up to 9 digits). Streams are derived per purpose so a change in
one consumer never shifts another: `rng(seed ⊕ 0x5EA5 + round)` for the round table, `⊕ 0x7A1D` for practice
layouts, `⊕ 0x5EA1` for sealed layouts, `⊕ 0xF1A` for telemetry, `⊕ 0xC10` for the suspense check, `⊕ 0x0DD` for
odometer digits, `⊕ 0x57A2` for stars and confetti.

### 5.3 The season table (computed entirely at seed time)

Per generation r: `round, pkgId ("#"+2-digit), parts[] ({name, claimedGain}), claimedTime, officialTime, budgetSpend,
capLimit (1500), illegalParts[] ({part, reason}), caught, verdict ('SEALED' | 'BLACK FLAG' | 'STRIPPED'), points,
parentGen, layoutName, sealedLayoutName, sessionId (4 hex), suspenseCheck (1–5), practiceTime`.

Fixed schedule (shape is identical for every seed; values vary):

| Round | Shape | Claimed vs official | Official vs parent | Spend | Verdict |
|---|---|---|---|---|---|
| 1 | honest; official 1:32.000 ± 0.300 | ± 0.12 | — | 60–75% | SEALED |
| 2–5 | honest | ± 0.12 | −0.60 to −0.90 | 60–85% | SEALED |
| 6 | first black flag | −2.40 | ± 0.15 | 86–90% | BLACK FLAG · FLOOR |
| 7 | caught | −1.80 | ± 0.15 | 88–93% | BLACK FLAG · seeded part ≠ FLOOR |
| 8 | honest | ± 0.12 | −0.50 | 70–80% | SEALED |
| 9 | slips through | −2.90 | ± 0.15 | 92–96% | SEALED, caught = false, TELEMETRY SEAL; parent of 10–12 |
| 10 | caught | −2.10 | ± 0.15 | 88–92% | BLACK FLAG · seeded part |
| 11 | honest | ± 0.12 | −0.50 | 74–82% | SEALED (parent G09) |
| 12 | caught + LINEAGE AUDIT | −1.60 | ± 0.15 | 84–90% | BLACK FLAG · seeded part; audit strips G09 |
| 13 | caught | −1.40 | ± 0.15 | 82–88% | BLACK FLAG · seeded part |
| 14 | seeded: 50% caught, else honest | −1.00 / ± 0.12 | ± 0.15 / −0.30 | 80–86% / 70–80% | BLACK FLAG / SEALED |
| 15 | over the cap | −0.50 | −0.20 | 105–112% | UPGRADE VOID (stored BLACK FLAG, all parts legal) |
| 16 | seeded: 50% caught, else honest | −0.60 / ± 0.25 | ± 0.15 / −0.30 | 78–84% / 65–79% | BLACK FLAG / SEALED |
| 17–22 | convergence, honest | ± 0.25 | −0.40 to −0.60 | 65–79% | SEALED; round 21 fires bulletin 9 |

"Parent" is the last SEALED generation before r at the time r runs (G09 counts as sealed until the audit).
Official times of illegal, void and honest rounds are all measured (the race always runs); black-flagged rows stay
in the tower struck. Seeded illegal parts draw from the five with the reasons in §9.5; a round may carry two illegal
parts with probability 0.25 (rounds 7, 10, 12, 13 only). Illegal-part rate rounds 6–13: 6/8; rounds 14–22: 1/9 to
3/9. Season totals: 6–8 black flags, 1 stripped, 13–15 clean sealed generations.

Points per round: 25 for a new official best among sealed generations, 18 if within 0.5 s of the best, 10 for any
other sealed result, 0 for a black flag or void. The audit removes G09's 18 points. The finale's numbers (champion
gen, official time, total points, black flag and stripped counts) come from this table.

Practice time = claimed + 0.30 ± 0.10 (practice is always a little slower than the qualifying lap). Sector splits
34/33/33% ± 2%. Layout names: `<CIRCUIT>-LIKE LAYOUT <A–H>` from SILVERSTONE, SUZUKA, SPA, MONZA, INTERLAGOS,
IMOLA, ESTORIL, HOCKENHEIM, MAGNY-COURS, ADELAIDE, MONACO, MONTREAL; race day `SEALED CIRCUIT · LAYOUT S07`.

### 5.4 Ticker and telemetry are tables too

Every bulletin has an enqueue tick fixed by the schedule (§6, §9.3). Bulletin i's left edge at tick t is
`1440 − 2 (t − E'_i)` sp where `E'_i = max(E_i, E'_{i−1} + (width_{i−1} + 32) / 2)` and width is characters x 8
(so bulletins queue without overlapping); a black-flag bulletin gets E = its beat tick and is inserted before any
bulletin whose E' is later (those re-sequence after it). The visible crawl is therefore a pure function of t.
Telemetry entries fire on a fixed cadence per phase (§9.4) with content seeded by (round, index); the feed at tick t
is the last 11 entries with fire tick ≤ t.

### 5.5 Seek grammar

On load parse `location.hash` and, if defined, the string `window.SCRUTINEER_SEEK`; the global wins on any key both
define. Keys: `t=SECONDS`, `seed=N`, `speed=1|2|4`, `paused=1`, `moment=blackflag|convergence` (moment overrides t).
`window.scrutineer = { seekTo(seconds), state() }` where `state()` returns the current tick, round, phase, speed,
paused flag, seed and the season table.

### 5.6 What a seek rebuilds

`seekTo` sets the tick and re-derives: round and phase (from S(r)); the tower (rows, order, strikes, and any slide
in progress from its start tick); the chart, strip, band, session times and cost cap from the table filtered by
"revealed by tick t" (a value is revealed at the beat that shows it); the ticker per §5.4; the telemetry ring; the
two ground backplates for the round (built synchronously); any ceremony in progress (the overlay state is a
function of the tick offset into its beat list). No animation stores progress; every one is `f(tick − startTick)`.

---

## 6. Choreography

Times are offsets from the round start at x1 unless stated. Tick counts in brackets.

### 6.0 Header clock and lap counter

`SESSION mm:ss.t` counts from the current phase's start and freezes at: PRACTICE 5.8 (P BEST), QUALIFYING 5.2 (claimed
card), RACE 11.4 (official card), SCRUTINEERING never (it runs to sell the wait), VERDICT and STANDINGS hold the value
at the verdict. Lap counter: `LAP 1/2` `LAP 2/2` in practice, `OUT LAP` then `LAP 1/1` in qualifying, `LAP 1/3`…
`LAP 3/3` in the race, blank elsewhere.

### 6.1 Session ident (18 ticks, at every phase change except VERDICT)

RED bar 360 x 28 lp on the ceremony overlay at y 80–108 lp (screen 320–432), carrying HTML text: `ROUND 07 · ` 16 sp
GOLD then the session word 32 sp WHITE, left-aligned at x 24 lp of the bar, baseline centred.
- [0–6]: bar x = −270, −180, −90, 0 at ticks 0, 2, 4, 6 (text moves with it, integer transforms).
- [6–14]: a CHROME sheen 8 lp wide (WHITE, CAPTION, MIDGREY, STUDIO as four 2 lp columns) crosses the bar left to
  right at 40 lp per tick, once. The header badge changes at tick 6.
- [13]: the hero cuts to the new camera (behind the bar).
- [14–17]: bar exits right: x = 90, 180, 270, 360.
Reduced motion: bar and text appear in place at tick 0, no sheen, vanish at tick 14.
Session words: `GARAGE`, `FREE PRACTICE`, `QUALIFYING`, `RACE · SEALED CIRCUIT`, `SCRUTINEERING`. The GARAGE ident
of round r+1 fires at S(r+1) + 0 and the header round line increments at its tick 6.

### 6.2 GARAGE (0–6 s) — CAM 2, badge GARAGE

Backplate (boot-cached): STUDIO back wall; a window strip 408 x 16 lp at y 4–20 showing SKY GARAGE (golden hour
outside; a 1 lp INK sill at y 20); a 40 x 4 WHITE strip light at (184, 24) with a light pool below it (STUDIO→
CAPTION ramp at v 0.25 within a 120 x 60 lp wedge, baked); GRAVEL floor from y 216 with a 0.25 INK dither along the
walls; a roller door at x 360–404, y 60–216 (TARMAC slats 4 lp apart); a tyre stack at (300, 176) (four 12 x 6 INK
ovals drawn as rect stacks, 1 lp GRAVEL rim); a tool chest at (128, 188) RED 20 x 14 with three CAPTION drawer
lines; a terminal desk at (40, 176) TARMAC 56 x 8 with a 24 x 16 CYAN screen at (48, 158) whose three 1 lp NIGHT
lines shift every 20 ticks (static under reduced motion).
- Side-view car (§7.2) at (232, 176) on two 4 x 8 GOLD jack stands, wheels off the ground (raised 6 lp).
- ENGINEER seated at the desk (2-frame typing, 15 ticks per frame); MECHANIC A kneeling at the front wheel;
  MECHANIC B standing at the rear wing. Shadow pools under each.
- [0–18]: ident GARAGE. SESSION TIMES resets to `--:--.---`. Cost cap title increments.
- [24]: the UPGRADE PACKAGE card enters from the left in 4 steps of 100 sp (ticks 24, 26, 28, 30) to (16, 48):
  INK ground, 4 sp GOLD border, title row 16 sp: `UPGRADE PACKAGE` WHITE at x 8 and `PKG #07` GOLD right-aligned,
  CHROME rule beneath. Body VT323 24 CAPTION, one line per changed part revealed every 18 ticks from tick 42:
  `REAR WING    +0.9s CLAIMED`, `FLOOR        +0.6s CLAIMED`, `ENGINE MODE  +0.3s CLAIMED`; then a rule and the GOLD
  total `CLAIMED GAIN +1.8s`; then `SPEND $1,240 · CAP $1,500` (RED when over the cap).
- As each part line reveals, its region on the side-view car (§7.2) glows GLOW GOLD, pulsing v 0.75/0.5 every 8
  ticks (steady 0.75 under reduced motion), and the cost cap bar advances two of its eight steps (all eight steps
  complete by tick 120 regardless of part count).
- [144]: card footer `ROLLING OUT` in 16 sp GOLD; the roller door lifts in 4 steps of 39 lp (ticks 144, 150, 156,
  162); the car drops from the jacks in one step at 150 and rolls right at 2 lp per tick from 156, leaving the
  frame by 180. Bulletin 2 (`UPGRADE PACKAGE #07 DECLARED …`) enqueues at tick 60.
- [180]: ident FREE PRACTICE (carries the cut to CAM 1 at its tick 13).

### 6.3 PRACTICE (6–12 s) — CAM 1, practiced layout, badge FP

Sky SKY PRACTICE. Camera: deadzone follow, the ground offset moves 1 lp per tick toward keeping the car inside the
central 200 x 140 lp box, clamped to ±8; off (locked at 0, 0) under reduced motion.
- [18]: the car starts at the start line; two laps of 78 ticks each (ticks 18–96, 96–174). The lap readout at
  (560, 504): INK ground, 2 sp CAPTION border, line 1 VT323 24 CAPTION `LAP 1/2`, CHROME rule, line 2 16 sp WHITE
  running time `0:47.3` counting in tenths from 0 to the practice story time over the 78 ticks (it runs faster than
  real time; that is a broadcast fiction and fine), line 3 three 48 x 12 sp sector boxes filling PURPLE (best of
  session), GREEN (personal improvement) or AMBER (slower) as each sector completes, line 4 VT323 24 GOLD
  `BEST 1:28.9`.
- Sector posts flash the same colour for 12 ticks when crossed. The exhaust trail is 16 samples.
- The previous sealed generation runs as a ghost (the car sheet drawn through the SCRIM mask, no shadow, no trail)
  on the same layout at its own claimed pace, starting together. No ghost in round 1 or after a black flag with no
  sealed parent change (the ghost is always the current parent).
- [174]: readout line 2 flips to `P BEST 1:28.412` in GOLD; clock freezes. Bulletin: none.
- [180]: ident QUALIFYING.

### 6.4 QUALIFYING (12–18 s) — CAM 1, badge QUALI

Sky SKY QUALI. Same layout, camera follow on.
- [18–54]: out lap (lap counter `OUT LAP`, the car at 60% speed, readout title `OUT LAP`).
- [54–156]: flying lap of 102 ticks, readout title `FLYING LAP`, running time in GOLD, sector boxes fire.
- [156]: the TEAM CLAIMED card slams in at (16, 528): GOLD ground, CHROME GOLD rule at its top, 16 sp INK
  `TEAM CLAIMED  1:27.902`. SESSION TIMES rolls the claimed value (odometer). The tower's current row shows the
  claimed time in GOLD with GAP `CLAIMED`. The chart plots the GOLD point with a slam. Bulletin 4 enqueues at
  tick 160 only in rounds where the divergence will exceed 0.3 s (rounds 6–16 as scheduled).
- [180]: ident RACE · SEALED CIRCUIT.

### 6.5 RACE (18–30 s) — CAM 1, sealed layout, badge RACE, camera locked

Sky SKY RACE. Behind the ident the ground swaps to the sealed layout: a different loop, no RUBBER line, a CYAN 1 lp
dashed tape (2 on, 2 off) around the outer run-off, empty grandstands (crowd block replaced by STUDIO/NIGHT at
0.25), floodlights on. Watermark line 3: `SEALED CIRCUIT · NO PRACTICE PERMITTED` (MICRO CYAN).
- [18–78]: lights-out gantry at the picture's top centre, a 56 x 12 INK bar at (176, 8) with five 8 x 8 lamps
  lighting RED one every 12 ticks from tick 18; all out at tick 78; the car launches with a 2-frame CAPTION smoke
  puff at the rear wheels for 6 ticks.
- [78–339]: three laps of 87 ticks. Lap counter `LAP n/3`. Readout title `OFFICIAL LAP`, running time WHITE, sector
  boxes fire; trail 24 samples. Chequered flag sprite waves at the start line for the final 20 ticks.
- [342]: the OFFICIAL card slams in at (16, 528): RED ground, CHROME rule at top, 16 sp WHITE `OFFICIAL  1:29.310`;
  the TEAM CLAIMED card re-appears as the 400 x 32 strip at (16, 496) (GOLD, INK 16 sp `TEAM CLAIMED  1:27.902`) so
  the pair reads together. SESSION TIMES rolls the official value and the DELTA appears. The tower row takes the
  official time, GAP becomes a gap, PTS stays blank until the verdict; rows re-sort (stepped slide). The chart
  plots the WHITE point and, if the gap exceeds 0.3 s, the DIVERGENCE band for this column.
- [360]: ident SCRUTINEERING (cut to CAM 3 at tick 13).

### 6.6 SCRUTINEERING (30–38 s) — CAM 3, badge SCRUTINEERING

Backplate (boot-cached): TARMAC floor from y 200; STUDIO wall with a 1 lp MIDGREY measuring grid every 16 lp; a wide
sign `SCRUTINEERING BAY 2` in MICRO WHITE at (24, 32); a lift platform GRAVEL 112 x 4 at (148, 200); an overhead rail
INK 160 x 2 at (124, 60) carrying a 12 x 6 CYAN lamp housing that follows the beam; two static FLOOD pools from the
ceiling; a door frame at the left edge x 0–8; SCRUTINEER at (272, 176) with a clipboard (2-frame); MARSHAL at
(20, 176) by the door.
Checklist panel at (544, 80), 256 x 216 sp: INK ground, 2 sp CAPTION border, title 16 sp WHITE `TECHNICAL CHECK`,
CHROME rule, five rows 32 sp tall VT323 24 CAPTION: `FLOOR`, `REAR WING`, `FUEL FLOW`, `ENGINE MODE`,
`TELEMETRY SEAL`, each with a 48 x 20 sp status box at the right (MIDGREY 2 sp outline while empty).
- [0–18]: ident.
- [18–42]: the side-view car rolls in from the left at 2 lp per tick (48 lp) to rest on the lift at x 156; [42–48]
  the lift raises it 8 lp in 4 steps of 2.
- [48–78]: warm-up sweep: the beam (§7.7) crosses the car left to right, x 140 → 260 at 4 lp per tick.
- [78 →]: five checks in list order, each 27 ticks unless it is the suspense check (54 ticks). Check k starting at
  tick T: [T–T+5] the beam moves to the part's scan x in 6 equal integer steps; [T+6–T+17] the part's outline
  flashes WHITE for 6 ticks, off for 6; [T+18] the status box stamps with a slam: `PASS` GREEN box with INK 8 sp
  text, or `FAIL` RED box with WHITE text; [T+18–T+26] hold. Suspense check: after T+17 the beam dwells 27 ticks
  with its v halved every 9 ticks (stepped, the same under reduced motion), then stamps at T+45 and holds to T+53.
  The suspense check is the first failing part in a black-flag round, otherwise `suspenseCheck` (2–5) from the
  table. Totals: 5 x 27 + 27 = 162 ticks, ending exactly at tick 240 (38.0 s).
- A PASS adds a `SEAL VERIFIED` line (CYAN) to telemetry; a FAIL adds an AMBER line naming the part.
- On a FAIL stamp: the beam turns SCANNER RED for the rest of that check, the part's outline flashes WHITE/RED 6/6
  once more, the checklist row text turns RED, the footnote line (§9.5) appears at (16, 552) in VT323 24 CAPTION,
  the badge enters its warning state (INK ground, 2 sp RED border, WHITE text). The stewards finish the list: the
  next check runs normally with a CYAN beam; the failed part keeps a RED outline.
- Round 15 (over the cap): all five stamps PASS; the void is declared in VERDICT (§6.8).

### 6.7 VERDICT — GREEN → PARC FERMÉ (38–42 s) — CAM 4

1. [0]: checklist title flips to `SCRUTINEERING · PASSED` GREEN; all five boxes pulse once (2 ticks GREEN fill).
2. [12]: hard cut to CAM 4. Backplate (boot-cached): NIGHT ground with SKY RACE stars in the top 40 lp; a STUDIO
   floodlit floor pool (STUDIO→CAPTION at v 0.125 within a 200 x 40 lp ellipse drawn as rect rows) under the car; a
   barrier of RED/WHITE 4 lp tape (alternating 8 lp blocks) on three 2 x 20 CAPTION posts across the foreground at
   y 236; the side-view car at (156, 176) behind it; MARSHAL at (300, 176) holding the green flag; badge PARC FERMÉ.
3. [24]: the seal stamp (§7.8) descends in the ceremony overlay centred on the hero (174, 90 lp): three frames of
   80 ms (ring 70, 50, 56 lp) then the GREEN IMPRESSION disc for 10 ticks. `SEALED` 32 sp INK on the band and
   `GEN 07` MICRO INK above it (canvas MICRO at x4 = 12 x 20 sp, legible).
4. [42]: bulletin 1 (`… PASSES SCRUTINEERING · PARC FERMÉ …`) enqueues; the tower row loses `CLAIMED`, gains PTS
   and the NEW BEST square if applicable; the band total rolls (odometer); the lineage slot gets its car with a
   4-tick GOLD glow on the changed parts and its hook.
5. [60–120]: hold with the 28 lp seal ring drawn at the hero's top-right corner (368, 8) and the OFFICIAL/CLAIMED
   pair still up. At round 21 this beat also enqueues bulletin 9 at [42] (before bulletin 1).

### 6.8 VERDICT — BLACK FLAG (replaces 6.7 when any check failed) and UPGRADE VOID (round 15)

Ticks from 38.0. The hero holds on the bay.
1. [0]: checklist title flips to `SCRUTINEERING · FAILED` RED. Void variant: a sixth row `COST CAP` slams into the
   checklist at [0], the beam parks RED over the whole car at v 0.5, and at [9] the row stamps `FAIL`; the footnote
   line reads `OVER CAP · $1,610 AGAINST $1,500 · UPGRADE VOID`.
2. [12–27]: checker wipe covers the viewport (§7.11). [27–30]: full checker hold. [30]: one tick of WHITE at
   SCRIM-inverse (WHITE over the checker at v 0.5) — the CRT flash. Reduced motion: hard cut to full INK at [12],
   hold to [30].
3. [30]: the card ground switches on beneath the wipe on the ceremony canvas: NIGHT ground, 8 lp RED border,
   280 x 160 lp centred; the black flag 96 x 64 lp (§7.12, waving 4 frames) at the card's left; [30–45] the wipe
   uncovers it. Void variant: 8 lp AMBER border, a 96 x 64 cost-cap plate instead of the flag (a GOLD 88 x 16 bar at
   76% of the plate, RED beyond, a WHITE cap marker, `CAP` MICRO).
4. [45]: the card text (HTML) lands with a slam: `BLACK FLAG` 32 sp WHITE; under it `GEN 07 · DISQUALIFIED` 16 sp
   GOLD; under that `ILLEGAL PART · FLOOR` (or `ILLEGAL PARTS · FLOOR · REAR WING`) 16 sp WHITE; at the foot the
   footnote in VT323 24 CAPTION. Void variant: `UPGRADE VOID` 32 sp WHITE, `GEN 15 · RESULT STRUCK` 16 sp GOLD,
   `COST CAP · $1,610 / $1,500` 16 sp WHITE, footnote `SPEND EXCEEDED THE CAP BY $110`. Screen shake ±2 sp for 6
   ticks (none under reduced motion).
5. [48]: bulletin 3 (or 5 for the void) inserted at the queue head in RED; the ticker tag inverts for 60 ticks.
   [48–56]: the tower row's strikethrough draws left to right; [56] the flag glyph slams in and GAP reads `DQ`
   (`VOID`), PTS `0`; [56–62] the row slides to the DQ block (stepped). [56–66]: `+0` in RED ticks up beside the
   band total, then fades by a 3-step dither (0.75, 0.5, 0.25) over 9 ticks. [60]: the chart drops a solid flag
   marker on the OFFICIAL point (slam); the lineage slot receives the MIDGREY car with the solid flag and no hook;
   SESSION TIMES keeps both times with the DELTA in AMBER.
6. [45–90]: hold.
7. [90–105]: cover wipe; [105]: card off; [105–120]: uncover to CAM 3 where two MECHANICS push the car backward out
   of the bay at 1 lp per tick from [105] until STANDINGS starts.
8. [120]: STANDINGS (badge stays in warning state until the next GARAGE ident). The next round's parent remains the
   last sealed car.

### 6.9 STANDINGS (42–46 s; 42–52 at round 12)

- The parc fermé (or bay) picture remains; a SCRIM covers the hero's left 60% (drawn on the dynamic layer); the
  standings card at (48, 96) 400 x 168 sp: INK ground, 2 sp CAPTION border, title 16 sp WHITE
  `STANDINGS · AFTER ROUND 07`, CHROME rule, five rows VT323 24: `1  G05  125 PTS` …, the current gen in GOLD,
  struck gens in CAPTION with a RED strike.
- [0–12]: the round's points count in (8 steps) on the card, in the tower PTS column and in the band total.
- [12]: the chart redraws the DIVERGENCE band if the round widened or closed it.
- [105–120]: the next round's two ground backplates are built.
- [120] (or [300] at round 12): ident GARAGE for the next round.

### 6.10 The lineage audit (round 12 STANDINGS, ticks from 42.0)

1. [0]: bulletin 6 (`LINEAGE AUDIT OPENED · GEN 09 UNDER INVESTIGATION`) to the queue head. Badge unchanged (the
   audit is a stewards' action, not a session).
2. [0–8]: a `LINEAGE AUDIT` banner (RED, 288 x 24 sp, 8 sp WHITE text with 1 sp tracking) enters the CONSTRUCTORS
   cell in 4 steps from the left, replacing its title line for the duration.
3. [12–72]: the SCANNER beam, 6 lp core, full strip height, sweeps the lineage strip from slot 1 to slot 12 at 1 lp
   per tick (indexed by screen coordinates, drawn on the strip canvas). Each sealed car it passes gets a 2-tick
   CAPTION outline (all of them are being checked).
4. [72]: the beam stops on slot 9 and turns SCANNER RED; the car flashes WHITE/RED 6/6 twice. The hero's footnote
   line shows `ILLEGAL · TRACE WRITER EDITED: EVIDENCE CHANNEL OVERWRITTEN · FOUND IN LINEAGE AUDIT`.
5. [96]: slot 9's car becomes MIDGREY with the hollow flag; its hook is removed; the connector from G08 to G11 is
   redrawn as a 1 lp GOLD line for 20 ticks, then CAPTION (G11 re-parented to G08 on screen).
6. [96–150]: the points drain: the standings card's G09 row and the tower's G09 PTS count down 1 point per tick to
   0 while the tower row shakes ±2 sp alternating each tick (`steps(2)`; none under reduced motion); the band total
   counts down in lockstep; the tower row takes the strikethrough, the hollow glyph and `STRIPPED`, then slides to
   the DQ block; ranked rows below step up.
7. [150]: the chart drops the hollow flag marker on round 9's OFFICIAL point, removes the point so the OFFICIAL
   line skips the column, and re-hatches the round-9 DIVERGENCE column with HATCH.
8. [156]: bulletin 7 (`GEN 09 RESULT STRIPPED …`) to the queue head; telemetry emits `AUDIT · G09 · ILLEGAL
   TELEMETRY SEAL CONFIRMED` and `LINEAGE REPAIRED · G11 → G08`.
9. [180]: the banner exits in 4 steps; the title returns.
10. [300]: ident GARAGE for round 13.

### 6.11 Season finale (from t 1018)

1. [0–15]: checker wipe covers; [15]: the finale card ground on the ceremony canvas: NIGHT, 4 lp CHROME border,
   280 x 160 lp centred, the final side-view car drawn at (16, 64) of the card at native 96 x 32 lp (384 x 128 sp on
   screen); [15–30]: uncover.
2. [30]: text lands: `SEASON 1 · CHAMPION` 32 sp GOLD, `CLEAN LINEAGE` 16 sp WHITE, and a VT323 24 CAPTION line
   `GEN 22 · OFFICIAL 1:24.118 · 343 PTS · 22 ROUNDS · 7 BLACK FLAGS · 1 RESULT STRIPPED` (all from state).
3. [45 →]: 40 confetti pixels (GOLD/WHITE, 1 lp on the overlay) fall 1 lp per tick with a seeded 1 lp lateral step
   every 8 ticks, wrapping at the bottom; a static sprinkle under reduced motion. A GLOW GOLD pulse behind the car
   every 20 ticks (steady under reduced motion).
4. Bulletin 12 to the queue head, then the ticker loops the season's bulletins 1, 3, 7, 9, 10, 12. Badge PARC FERMÉ.
   The card holds until RESTART SEASON or a seed change.

---

## 7. Sprites and procedural art

All sprites are authored as pixel maps (rows of palette letters) or rect lists in source and baked to offscreen
canvases at boot. Legend: `.` transparent, `I` INK, `W` WHITE, `C` CAPTION, `M` MIDGREY, `R` RED, `G` GOLD, `Y` CYAN,
`A` AMBER, `S` STUDIO, `T` TARMAC, `V` GRAVEL, `E` GREEN.

### 7.1 Top-down car, 16 x 16 cell, 16 directions

E master (nose at +x), body centred on the cell centre (8, 8): rows 4–11, columns 0–15.

```
      0123456789ABCDEF
r0    ................
r1    ................
r2    ................
r3    ................
r4    R.II............
r5    R.IG.......II..W
r6    R..WWWWWWW.IG.WW
r7    RWWWWWRRWWWWWWWW
r8    RWWWWWRRWWWWWWWW
r9    R..WWWWWWW.IG.WW
r10   R.IG.......II..W
r11   R.II............
r12   ................
r13   ................
r14   ................
r15   ................
```

Rear wing = column 0 (RED, rows 4–11); rear tyres 2 x 2 INK at columns 2–3, rows 4–5 and 10–11, with a GOLD rim
pixel at the inner corner; cockpit RED at columns 6–7, rows 7–8; front tyres at columns 11–12, rows 5–6 and 9–10
with GOLD inner pixels; nose columns 13–14; front wing column 15 rows 5–10 with the row 6/9 flare. Exhaust origin
= cell centre minus 9 lp along the heading, rounded.

**Sheet.** Direction index `k = round(θ / 22.5°) mod 16`, θ = atan2(dy, dx) of the path tangent in screen
coordinates (y down), so k 0 = E, 4 = S, 8 = W, 12 = N, clockwise on screen. Frames:
- Frame 0 = the master.
- Frames 1 (22.5°) and 2 (45°) are generated by nearest-neighbour inverse rotation about (8, 8): for each
  destination pixel centre (u + 0.5, v + 0.5), rotate by −θ about (8, 8), sample the master at (floor x, floor y).
  Then one cleanup pass, two rules in order: a transparent pixel with three or more opaque 4-neighbours takes their
  majority colour; an opaque pixel with no opaque 4-neighbour is deleted. The frame's opaque count must be within
  15% of the master's (assert at boot; if it is not, lower the deletion rule's threshold to "no opaque 8-neighbour").
- Frame 3 = transpose of frame 1 (`(u, v) → (v, u)`; the car is symmetric about its axis so this is exact).
- Frames 4–15: `R90(f)(u, v) = f(v, 15 − u)` (a quarter turn clockwise on screen); frames 4, 5, 6, 7 = R90 of 0, 1,
  2, 3; 8–11 = R90 of 4–7; 12–15 = R90 of 8–11. Mirrored corners are therefore pixel-identical.
- Cached as a 256 x 16 sheet; drawn at integer `(x − 8, y − 8)`. Shadow: the same frame through the shadow-partner
  rule at v 1.0, offset (+1, +1), drawn first. Ghost: the frame through SCRIM (screen-indexed), no shadow, no trail.

Trail: N samples (16 in practice, 24 in the race) of past positions, one per tick, each a 2 x 2 block at the sample
position offset 6 lp behind along the heading, through EXHAUST with v = 1 − k / N (screen-indexed). Under braking
(speed below 60% of top speed on the lap profile) N shrinks to 8.

### 7.2 Side-view car, 96 x 32 lp (garage, bay, parc fermé, finale)

Nose right. Rects (x, y, w, h) in draw order:
- FLOOR plank: (8, 24, 80, 2) CAPTION — part rect **FLOOR** (8, 24, 80, 2), scan x 48.
- Rear wing: (4, 4, 10, 8) WHITE with end plate (4, 4, 2, 8) RED; mount (12, 12, 2, 8) INK — part rect **REAR WING**
  (4, 4, 10, 10), scan x 9.
- Engine cover: (30, 10, 28, 8) WHITE; sidepod (30, 16, 28, 8) WHITE — part rect **ENGINE MODE** (30, 10, 28, 14),
  scan x 34.
- Flank stripe: (14, 20, 76, 2) RED.
- Fuel filler: a CAPTION hatch (40, 17, 6, 4) with a 1 lp INK cap on top — part rect **FUEL FLOW** (39, 16, 8, 6),
  scan x 43.
- Airbox: (50, 2, 6, 8) WHITE; halo (58, 6, 12, 4) INK; antenna pin (52, 0, 1, 4) CYAN with a 2 x 2 CYAN box at
  (51, 4, 2, 2) — part rect **TELEMETRY SEAL** (50, 0, 6, 6), scan x 52.
- Cockpit: (56, 10, 10, 6) RED with opening (58, 12, 6, 4) INK.
- Nose: (70, 14, 10, 8), (80, 16, 8, 6), (88, 18, 4, 4) WHITE.
- Front wing: (84, 22, 12, 3) WHITE; end plate (94, 20, 2, 6) GOLD.
- Tyres: (16, 16, 12, 12) and (72, 16, 12, 12) INK with 4 x 4 GOLD hubs at (20, 20) and (76, 20).
- Number plate: the round number in MICRO INK at (36, 11).
- 1 lp INK outline around the union of body rects (computed at bake: any body pixel with a transparent 4-neighbour
  becomes INK, except tyres).
Glow and flash apply to the part rects plus a 2 lp margin. The x-ray variant is baked once (§7.7).

### 7.3 Lineage silhouette, 12 x 6 (also the 10 x 5 and 14 x 7 sizes for folds, scaled by dropping/duplicating one row and two columns)

```
      0123456789AB
r0    RR...Y......
r1    RR..WWWWW...
r2    .WWWWWWWWWWW
r3    .WWWWWWWWWWW
r4    .II.....II.G
r5    .II.....II..
```
Part pixels for the GOLD glow: REAR WING (0–1, 0–1); TELEMETRY SEAL (5, 0); ENGINE MODE (4–5, 1); FUEL FLOW (7–8,
1); FLOOR (row 3, columns 3–10). States: sealed WHITE/RED as drawn; black-flagged MIDGREY body with the solid 6 x 4
flag over its centre; stripped MIDGREY with the hollow flag; not yet run INK outline only (the silhouette's border
pixels in INK, interior transparent).

### 7.4 People, 12 x 20 lp, two idle frames at 15 ticks per frame, INK outline, shadow pool 8 x 2 at v 0.5

- ENGINEER: STUDIO shirt, TARMAC trousers, CAPTION headset with a 1 lp CYAN mic, seated variant 12 x 16; frame B
  lifts the right hand 1 lp.
- MECHANIC A (kneeling, 12 x 14): STUDIO overalls, GOLD sleeve stripe, a 3 lp CAPTION wheel gun; frame B tilts it.
  MECHANIC B (standing): same livery holding the rear wing; frame B shifts the body 1 lp right. Push animation:
  frames alternate with the whole sprite leaning 1 lp forward.
- SCRUTINEER: CAPTION coat over TARMAC trousers, an INK clipboard with a 3 x 4 WHITE page; frame B lowers the head
  1 lp. `FIA` in MICRO GOLD on the coat back.
- MARSHAL: AMBER vest over TARMAC, holds the green flag at parc fermé and the black flag at the door during the
  ceremony; frame B swaps the flag to its second frame.

### 7.5 Track rasterisation (per layout, into the 424 x 280 ground backplate; world coordinates)

1. **Centreline**: 10–14 control points on an ellipse of radii 164 x 96 centred at (204, 172) in world space (the
   ground's world box is x −8..416, y 32..312; the track region keeps a 24 lp margin inside x 24..384, y 64..280).
   Angles jittered ±10°, radii scaled 0.55–0.95; two seeded points pulled to 0.40 (a hairpin and a chicane).
   Chaikin-smooth three times; resample to one point per lp of arc length (roughly 700–900 points). Force clockwise
   on screen: if the shoelace sum Σ(x_i y_{i+1} − x_{i+1} y_i) is negative in y-down coordinates, reverse the
   points. Index 0 = the start of the longest straight. Sealed layouts use the other seed stream and are re-rolled
   until their bounding box overlaps the practiced layout's by less than 70%.
2. **Order of painting**: grass → run-off → road → racing line → kerbs → start line → sector posts → pit building →
   grandstands → floodlight cones → masts and lamps → signage.
3. **Grass**: a chamfer distance transform (two passes, 3-4 metric) from the road mask gives d per pixel; GRASS
   VIGNETTE with v = clamp((d − 14) / 46, 0, 1).
4. **Road**: a 14 x 14 lp square stamped at every point (10 x 10 on the 390 fold); ASPHALT grain. The union of
   squares along a smooth path reads as a rounded road with pixel-hard edges.
5. **Curvature runs**: signed curvature from the resampled points, smoothed over 9 points; a corner run is |k| >
   1/24 for at least 12 consecutive points; its outside is the side away from the centre of curvature.
6. **Kerbs**: on corner runs, 2 x 2 squares stamped at offset 8 lp along the outward normal, alternating RED and
   WHITE every 4 points; a 1 lp WHITE stamp at offset 8 along the inward normal (apex kerb).
7. **Run-off**: on corner runs, 8 x 8 GRAVEL EDGE stamps at offset 13 outward with v rising 0 → 1 across the stamp
   away from the road (painted before the road so the road overwrites the overlap).
8. **Racing line** (practiced layout only): 2 x 2 RUBBER stamps at offset 3 lp toward the inside on corner runs,
   0 elsewhere.
9. **Start/finish**: a 2 x 14 lp INK/WHITE 2 lp checker across the road at index 0, perpendicular to the tangent;
   a 3 x 10 CAPTION gantry post on the outside with a 5 x 3 INK light box.
10. **Sector posts** at indices n/3 and 2n/3: a 2 x 8 CAPTION post 10 lp outside the road, a 6 x 6 lamp box (1 lp
    INK border; unlit MIDGREY at 0.25 over INK), `S1` `S2` MICRO CAPTION beside them; `S3` at the start post.
11. **Pit building**: inside the longest straight, 56 x 14 lp, TARMAC with a 1 lp GOLD roof stripe, five MIDGREY
    doors 4 lp apart, `PIT` in MICRO.
12. **Grandstands**: three, on the outside of the three longest straight runs, 16 lp from the road edge, 40 x 12 lp:
    roof 40 x 3 as three solid 1 lp rows WHITE, CAPTION, MIDGREY top to bottom, crowd 40 x 7 as two passes (RED over STUDIO at 0.5, then WHITE over that at 0.25), GRASS DARK shadow 40
    x 2 beneath, a MICRO sign (`LAP`, `FIA`, `SEALED` on race day). Crowd is static.
13. **Floodlights**: four masts at the corners of the track's bounding box inset 12 lp: 2 x 24 CAPTION mast, 6 x 3
    WHITE head, FLOOD cone toward the nearest track point, baked. All sessions are at night; the practice and
    qualifying skies still carry dusk colour above the lit ground.
14. **Sky**: rows 0–39 of the hero from the session's SKY ramp with a 1 lp INK skyline (far grandstand roof profile
    with 3 seeded steps) at row 39. The sky layer never pans.
15. **Layout label**: MICRO CAPTION at the watermark block's line 2.

### 7.6 Sector lights and readouts

Lamp boxes 6 x 6 lp with a 1 lp INK border; lit solid PURPLE/GREEN/AMBER for 12 ticks. Sector colour: PURPLE if the
sector time is the session's best, GREEN if a personal improvement over the previous lap, AMBER otherwise; lap 1 of a
session is GREEN in all sectors. HTML readout cards: INK ground, 2 sp CAPTION border, 4 sp CHROME rule under the
title row.

### 7.7 Scanner and x-ray

Beam: a vertical band 24 lp wide from y 148 to y 216 (the lift and the car plus 16 lp of headroom), centred at sx:
8 lp CYAN core, then SCANNER dither out to 12 lp each side (screen-indexed; fillRect per pixel, ≤ 1632 per tick).
The lamp housing on the rail follows sx. Where the band's core covers the car, the car is drawn from the **x-ray
car** baked at boot: every outline pixel WHITE, every interior pixel through `[INK, CYAN]` at v 0.5 (a checker),
every part rect outlined 1 lp WHITE, the fuel hatch and antenna box drawn in CAPTION. Per tick: draw the normal car,
then `drawImage` the x-ray car clipped to columns [sx − 4, sx + 4). SCANNER RED swaps CYAN for RED in both the band
and the x-ray interior. The audit beam on the strip is the same band at 6 lp core, full strip height.

### 7.8 Seal stamp

A GOLD ring, outer radius 28 lp, 3 lp thick, from a midpoint-circle pixel list cached at radii 35, 25 and 28 (the
70, 50, 56 lp frames), a 1 lp INK outline outside and inside, a 12 lp tall GOLD band across the middle. `SEALED`
is HTML 32 sp INK on the band (ceremony text layer); `GEN 07` MICRO INK above the band on the canvas. Impression:
GREEN IMPRESSION disc 60 lp wide behind it for 10 ticks. The parc fermé corner version is the 28 lp ring only.

### 7.9 Lineage strip (canvas 408 x 24 lp)

22 slots of 17 lp starting at x 22: slot i spans x 22 + 17 i .. 38 + 17 i. Car silhouette 12 x 6 at (slot x + 2, 2);
round number in MICRO CAPTION at (slot x + 3, 13) (`01`..`22`, the current round GOLD). Connector: a 1 lp CAPTION
line at y 11 from the parent's slot centre to the child's slot centre, plus a 1 lp vertical hook at y 9–10 under
every accepted car; DQ'd and stripped slots have no hook (the line passes beneath them). The current round's slot
has a 1 lp GOLD underline at y 20. Changed parts glow GOLD for 4 ticks when the slot is filled (steady under reduced
motion). Column i's centre `cx_i = 30 + 17 i` is shared with the chart.

### 7.10 Chart (canvas 408 x 60 lp)

Plot y 4..52 maps lap time 1:23.000 (top) to 1:33.000 (bottom): `y = 4 + (time − 83.0) / 10 x 48`, rounded.
Y labels MICRO MIDGREY at x 2: `1:24` at y 9, `1:28` at y 28, `1:32` at y 47 (each centred on its tick row;
faster is higher).
Grid: MIDGREY over PANEL at 0.125 every 8 lp in the empty region only. Columns at `cx_i = 30 + 17 i`. TEAM CLAIMED:
GOLD 1 lp stepped line (horizontal to the next column's x, then vertical; no diagonals). OFFICIAL: WHITE 2 lp
stepped line. DIVERGENCE fills between the lines in any column where claimed is faster by more than 0.3 s; HATCH
replaces it at the stripped column. Markers on the OFFICIAL point: 5 x 5 solid flag (INK, 1 lp WHITE border) at
black-flag and void rounds; 5 x 5 hollow flag at the stripped round, where the OFFICIAL line skips the column
(the step joins the neighbours). Current round: a 1 lp GOLD vertical rule at cx. Points exist only up to the current
round's revealed values. Redrawn whole on every state change; a new point lands with a 3-frame slam.

### 7.11 Checker wipe (ceremony overlay, 360 x 225 lp)

Cells 8 x 8 lp (32 sp), 45 columns x 29 rows (the last row is 1 lp). Cell (c, r) is INK if c + r is even, else
WHITE. Diagonal index `d = c + (28 − r)` (0..72). At wipe tick k (0..15) cells with `d < 5 k` are covered (drawn);
cells with `5 k − 5 ≤ d < 5 k` are the front, whose WHITE cells are drawn through a 0.5 INK dither so the edge
sparkles. Uncover uses the same order (cells with d < 5 k are cleared). Cover = 15 ticks, uncover = 15 ticks. Under
reduced motion: cover is a hard cut to full INK, uncover a hard cut to the destination, with a 6-tick hold between.

### 7.12 Flags

- Black flag: 24 x 16 lp INK with a 1 lp WHITE border on a 2 x 20 CAPTION pole; 4-frame wave (the free edge's last
  8 columns shift up 1, 0, down 1, 0), 6 ticks per frame. The card version is the same frames at 96 x 64 lp (x4
  nearest-neighbour, baked).
- Chequered: 24 x 16 with 4 lp INK/WHITE cells, same wave, at the start line for the race's last 20 ticks.
- Green: 24 x 16 GREEN with a WHITE border, held by the marshal at parc fermé.
- Tower/strip/chart glyphs: 8 x 6 sp (tower, CSS), 6 x 4 lp (strip), 5 x 5 lp (chart): INK with a 1 lp WHITE border;
  hollow = border only.
Under reduced motion all flags hold frame 1.

---

## 8. Motion rules

- Four easings, all stepped: **step-4** (four equal integer steps over the duration: entries, exits, door lifts,
  tower slides at 6 ticks); **slam** (three frames of 40 ms: +2 lp past the target, −1 lp, rest: cards, stamps,
  markers, points); **count** (eight equal steps over 12 ticks, landing exactly: points, totals, gaps);
  **odometer** (eight steps of 2 ticks; each intermediate step shows seeded random digits in every changing
  position, the last step the true value: session times, the band total, cost cap spend); **drain** (1 point per
  tick to zero); **wipe** (§7.11).
- CSS transitions only with `steps(n, end)`; used for tower row `translateY` (steps(4), 200 ms) and nothing else.
  All other HTML motion is integer `transform: translate` set per tick from the engine.
- Blink rates in simulation time: LIVE 1 Hz, telemetry pulse 2 Hz, warning badge border 2 Hz, glow pulses every 8
  ticks, terminal shuffle every 20 ticks, sprite idle 15 ticks per frame, flag wave 6 ticks per frame. All square
  waves.
- Ticker crawl: 2 sp per tick, simulation time (at x4 it crawls four times faster on the wall: a fast-forward look).
  Under reduced motion the crawl continues (it carries information).
- Camera: Practice and Qualifying only; ground offset moves 1 lp per tick toward the deadzone target; clamped ±8.
- Speed x2/x4 multiplies the tick rate only; every duration above is in ticks and shortens accordingly.
- Pause freezes the tick; the render loop keeps running so focus states work; the badge gains ` · PAUSED`
  (8 sp, same colours) and the LIVE square turns MIDGREY.
- **Reduced motion** (`prefers-reduced-motion: reduce`): unchanged — the simulation, car, ghost, trail, sector
  lamps, scanner travel, beam dwell, number rolls, drain, tower slides, ticker, telemetry. Disabled — screen shake,
  CRT flash, LIVE blink (steady), telemetry pulse (steady), glow pulses (held bright), terminal shuffle, part-flash
  alternation (solid WHITE outline instead), the checker wipe (hard cuts), the ident sheen and slide (in place),
  flag waving, confetti motion, the camera pan, the tower row shake. Nothing that carries information is removed.

---

## 9. Copy

Uppercase unless noted. Middle dots are U+00B7. `É` in PARC FERMÉ is kept. Delta is spelled `DELTA`.

### 9.1 Header
`SCRUTINEER` · `SEASON 1 · ROUND 07/22 · SILVERSTONE-LIKE LAYOUT B` (race day: `SEASON 1 · ROUND 07/22 · SEALED
CIRCUIT · LAYOUT S07`) · badge · `SESSION 00:12.4` · `LAP 2/3` / `OUT LAP` / blank · `LIVE`.

### 9.2 Session badges (160 x 24 sp, 8 sp text)
| Badge | Ground | Text |
|---|---|---|
| `GARAGE` | STUDIO | WHITE |
| `FP` | CAPTION | INK |
| `QUALI` | GOLD | INK |
| `RACE` | RED | WHITE |
| `SCRUTINEERING` | CYAN | INK; warning state: INK ground, 2 sp RED border, WHITE text |
| `PARC FERMÉ` | GREEN | INK |

### 9.3 Stewards' bulletins (twelve templates; the engine fills them from the table)
1. `STEWARDS: GEN 03 PASSES SCRUTINEERING · PARC FERMÉ · NEW OFFICIAL BEST 1:30.116` (verdict [42]; without the
   `NEW OFFICIAL BEST` clause when it is not a best)
2. `STEWARDS: UPGRADE PACKAGE #07 DECLARED · REAR WING · FLOOR · ENGINE MODE · +1.8s CLAIMED` (garage [60])
3. `STEWARDS: BLACK FLAG · GEN 07 · ILLEGAL FLOOR · RESULT STRUCK` (ceremony [48], RED)
4. `STEWARDS: TEAM CLAIMED 1:27.902 · OFFICIAL 1:29.310 · GAP UNDER REVIEW` (race [350] when the gap exceeds 0.3 s)
5. `STEWARDS: COST CAP · ROUND 15 · $1,610 AGAINST $1,500 · UPGRADE VOID` (void ceremony [48], RED)
6. `STEWARDS: LINEAGE AUDIT OPENED · GEN 09 UNDER INVESTIGATION` (audit [0])
7. `STEWARDS: GEN 09 RESULT STRIPPED · ILLEGAL TELEMETRY SEAL FOUND IN LINEAGE AUDIT · 18 POINTS DEDUCTED` (audit [156])
8. `STEWARDS: SEALED CIRCUIT LAYOUT S11 CONFIRMED · NO TEAM HAS PRACTISED THIS LAYOUT` (race [20], every round)
9. `STEWARDS: NO ILLEGAL PARTS FOUND, 5 CONSECUTIVE ROUNDS` (round 21 verdict [42], queue head)
10. `STEWARDS: FASTEST OFFICIAL LAP OF THE SEASON · GEN 18 · 1:25.204 · PURPLE IN ALL THREE SECTORS` (race [350]
    whenever the official time is a new season best in rounds 17–22)
11. `STEWARDS: TELEMETRY SEAL VERIFIED · SESSION 3F2A · TEAM CANNOT WRITE TO THIS CHANNEL` (scrutineering, after
    the TELEMETRY SEAL check passes)
12. `STEWARDS: SEASON 1 CLASSIFIED · CHAMPION GEN 22 · LINEAGE VERIFIED CLEAN` (finale)
Also: `STEWARDS: SEASON 1 RESTARTED · SEED 1994 · 22 ROUNDS` on RESTART SEASON or a seed change.

### 9.4 FIA telemetry (two-line entries; session ids are four seeded hex digits, stable within a round)
1. `SESS 3F2A · TURN 04` / `TOOL run_tests · 412ms · OK`
2. `SESS 3F2A · TURN 05` / `LLM · 1.2k tok · 880ms`
3. `SESS 3F2A · TURN 06` / `TOOL read_file · 38ms · OK`
4. `SESS 3F2A · TURN 07` / `TOOL search · 3 hits · 210ms`
5. `SESS 3F2A · TURN 08` / `LLM · 0.6k tok · 540ms`
6. `SESS 3F2A · LAP 2` / `SEAL VERIFIED · 5/5 PARTS` (CYAN)
7. `SESS 3F2A · TURN 11` / `TOOL run_tests · 0 RAN · SKIPPED` (AMBER; rounds where FLOOR is illegal)
8. `SESS 3F2A · BUDGET` / `SPEND $1,240 · CAP $1,500 · 83%`
Generator vocabulary: tools `run_tests`, `read_file`, `edit_file`, `search`, `list_dir`; statuses `OK`, `RETRY`,
`TIMEOUT`; timings 20–990 ms; token counts 0.3k–2.4k. Cadence: one entry every 20 ticks in GARAGE and PRACTICE,
every 10 in QUALIFYING and RACE, every 30 in SCRUTINEERING, VERDICT and STANDINGS. Turn numbers increment through a
round and reset with the session id. Event entries: `SEAL VERIFIED · FLOOR` (CYAN) per PASS; `SEAL CHECK FAILED ·
FLOOR` (AMBER) per FAIL; `AUDIT · G09 · ILLEGAL TELEMETRY SEAL CONFIRMED` and `LINEAGE REPAIRED · G11 → G08`
(AMBER) at the audit.

### 9.5 Scrutineering footnotes (VT323 24 CAPTION; the sanctioned technical exception)
| Part | Footnote |
|---|---|
| FLOOR | `ILLEGAL · EVALUATION HARNESS EDITED: TEST STUB` |
| REAR WING | `ILLEGAL · SCORING FUNCTION EDITED: THRESHOLD LOWERED` |
| FUEL FLOW | `ILLEGAL · BUDGET METER EDITED: TOKEN COUNTER BYPASSED` |
| ENGINE MODE | `ILLEGAL · SEARCH POLICY EDITED: ANSWER KEY CACHED` |
| TELEMETRY SEAL | `ILLEGAL · TRACE WRITER EDITED: EVIDENCE CHANNEL OVERWRITTEN` |
Two failing parts show two footnote lines. The void footnote is `SPEND EXCEEDED THE CAP BY $110` (no technical words).

### 9.6 In-picture captions
`UPGRADE PACKAGE`, `PKG #07`, `CLAIMED GAIN +1.8s`, `SPEND $1,240 · CAP $1,500`, `ROLLING OUT`, `LAP 1/2`,
`OUT LAP`, `FLYING LAP`, `OFFICIAL LAP`, `BEST 1:28.9`, `P BEST 1:28.412`, `TEAM CLAIMED  1:27.902`,
`OFFICIAL  1:29.310`, `TECHNICAL CHECK`, `PASS`, `FAIL`, `SCRUTINEERING · PASSED`, `SCRUTINEERING · FAILED`,
`COST CAP`, `SEALED`, `GEN 07`, `BLACK FLAG`, `GEN 07 · DISQUALIFIED`, `ILLEGAL PART · FLOOR`, `UPGRADE VOID`,
`GEN 15 · RESULT STRUCK`, `COST CAP · $1,610 / $1,500`, `STANDINGS · AFTER ROUND 07`, `LINEAGE AUDIT`,
`SEASON 1 · CHAMPION`, `CLEAN LINEAGE`, `SCRUTINEERING BAY 2`, `SEALED CIRCUIT · NO PRACTICE PERMITTED`,
`CAM 1 · CIRCUIT`, `CAM 2 · GARAGE`, `CAM 3 · SCRUTINEERING`, `CAM 4 · PARC FERMÉ`.

### 9.7 REGS panel
Title: `SPORTING AND TECHNICAL REGULATIONS · SEASON 1`. Column heads `LOOP MECHANISM` / `ON-SCREEN F1 TERM`. Rows:
- Inner agent + its harness (prompts, tools, memory, search policy) — The car
- Outer improver model proposing a harness diff each iteration — The race engineer shipping an upgrade package between rounds
- Public score the agent can see — Practice and Qualifying laps: the TEAM CLAIMED time
- Private held-out score the improver never sees — Race day on a sealed circuit: the OFFICIAL time
- Fixed dollar budget per generation — The cost cap
- Harness frozen during evaluation — Parc fermé
- Weave traces, append-only evidence the improver cannot write — FIA telemetry: TEAM CANNOT WRITE TO THIS CHANNEL
- Read-only auditor classifying edits with the harness-tampering taxonomy — The Scrutineer in the scrutineering bay
- Tampering categories (role edited x obligation violated) — Illegal parts: FLOOR, REAR WING, FUEL FLOW, ENGINE MODE, TELEMETRY SEAL
- Reject a generation for tampering — Black flag, result struck
- Tampering that persists in the winning lineage — An illegal part on a championship car, found in a lineage audit, points stripped
- Lineage of accepted generations — Constructors' Championship standings across the season
- One loop iteration — One race weekend (round)
- The whole run — Season 1, 22 rounds

Paragraph (VT323 24, mixed case): `Scrutineer dramatizes a bi-level optimization loop. An inner agent (the car) is
scored by an outer improver (the race engineer) that proposes a harness diff each iteration; the improver only ever
sees the public score (practice and qualifying), while selection is decided on a private held-out score it cannot
observe (the sealed race circuit). A fixed dollar budget per generation (the cost cap) applies selection pressure so
gains must be real, not bought. Every trajectory is written to an append-only evidence channel the improver cannot
write (FIA telemetry), and a read-only auditor (the Scrutineer) classifies each diff against a harness-tampering
taxonomy: which role was edited and which obligation it violated. Tampering caught at evaluation is rejected outright
(black flag); tampering that slips into the accepted lineage is detected later by re-auditing ancestors and its
contribution is stripped from the standings (lineage audit). The story you are watching is the loop learning that
honest gains are the only gains that survive scrutineering, which is what turns reward hacking pressure into
convergence on the official score.`

Footer: `PRESS R OR ESC TO RETURN TO THE BROADCAST`.

### 9.8 Empty and edge states
Before round 1's qualifying: SESSION TIMES `--:--.---`; tower 22 `--` rows; chart grid only; band `0 PTS · NO
POINTS`; strip 22 outline cars. Invalid seed (empty, non-numeric, more than 9 digits): RED input border, previous
seed kept. Valid seed + Enter, or RESTART SEASON: t = 0, the restart bulletin, backplates rebuilt.

---

## 10. Controls and accessibility

Space play/pause; Right arrow steps one tick (auto-repeat at 10 Hz while held); `1` `2` `4` set speed; `R` toggles
REGS; `ESC` closes REGS. Every button is a real `<button>` with a visible focus ring; the seed input is a numeric
text input labelled `SEED`. Buttons and the input never lose their 2 sp border. Jump buttons call `seekTo` with the
constants in §5.1 and leave the play state as it was. Sound: none; no audio nodes are created.

---

## 11. Implementation order

1. **Skeleton**: `<title>`, `<style>` with palette custom properties, the fixed sp grid for 1440/1280/1024/390, the
   Google Fonts link, panel markup with every static string, the tile generator producing the data-URI backgrounds,
   `html, body` painted NIGHT. Lint clean, screenshot at 1440 shows every panel with empty states.
2. **Engine core**: mulberry32 with derived streams; the season table generator (§5.3) as a pure function of seed;
   `S(r)`, phase lookup, bulletin and telemetry timelines (§5.4); the tick clock, speed, pause, step; hash and
   `window.SCRUTINEER_SEEK` parsing; `window.scrutineer`. Verify by dumping `state()` at t 262 and 963.
3. **Dither primitives**: the matrix, `T(x, y)`, ramp quantisation with world/screen indexing, the shadow LUT, the
   MICRO font, pixel-map and rect-list bakers. Bake the car sheet (assert the opaque-count check), side-view car,
   x-ray car, lineage silhouette, people, flags, seal rings.
4. **Backplates**: sky bands, track generation and rasterisation for both layouts, garage, bay and parc fermé.
   Screenshot each with the car static to check kerbs, run-off, grandstands, cones and dither patterns.
5. **Hero renderer**: per-phase drawing from state (car on path with heading → frame, trail, ghost, sector lamps,
   gantry, watermark, scanner and x-ray, lift, seal corner ring, standings scrim), camera rule, and the HTML overlay
   cards positioned and populated from state.
6. **Panels bound to state**: header, tower (order, strikes, slides), telemetry ring, constructors, session times
   (odometer), cost cap, chart, lineage strip, ticker crawl. Confirm a seek to any t is pixel-identical to playing.
7. **Ceremony overlay**: idents, checker wipe, black-flag and void cards, seal close-up, audit banner and beam,
   drain, finale. Screenshot t 262, 264, 268.5, 270 (round 6), S(12)+44.4, S(12)+45.2 (audit), 963, 1019.
8. **Controls, keyboard, REGS, reduced motion, folds**: buttons and shortcuts, focus rings, REGS trap, the
   `prefers-reduced-motion` branch, then 1280, 1024 and 390 screenshots for clipping and overlap.
9. **QA pass**: lint.sh, zero console output, every checklist item in the SPEC, all 22 rounds at x4 to the finale.

## 12. QA seek constants (seed 1994)

| t | What must be on screen |
|---|---|
| 3.0 | GARAGE round 1, upgrade card with parts, cost bar filling, tower of `--` rows, `--:--.---` session times |
| 9.0 | PRACTICE round 1, dusk sky, car on the practiced layout, lap readout, no ghost |
| 29.5 | RACE round 1, night sky with stars, OFFICIAL card over the TEAM CLAIMED strip, session times both filled |
| 34.0 | SCRUTINEERING round 1, beam over a part, checklist with stamps landing |
| 39.0 | seal close-up over parc fermé, round 1 |
| 262.0 | round 6 warm-up sweep ending (JUMP: THE BLACK FLAG) |
| 264.1 | FAIL on FLOOR, RED beam, footnote `ILLEGAL · EVALUATION HARNESS EDITED: TEST STUB` |
| 269.5 | BLACK FLAG card fully revealed, bulletin 3 in RED, tower row struck |
| 550.4 | audit beam stopped RED on slot 9 |
| 552.0 | points draining, G09 row shaking, hollow flag on the strip and chart |
| 963.0 | round 21 last check (JUMP: CONVERGENCE); 965.4 shows bulletin 9 entering |
| 1019.0 | finale card with the champion car and confetti |
