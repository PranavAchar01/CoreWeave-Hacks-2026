# SCRUTINEER — Visual Direction A: "1994 BROADCAST FEED"

Studio direction, pixel-art and broadcast design. This document is the build reference. Everything below is stated in
logical pixels (lp) unless marked as screen pixels (sp). "Tick" means one simulation tick at 30 ticks per second of
simulation time (at x1 speed, 30 ticks = 1 real second). No code appears in this document; the numbers are the contract.

---

## 1. Concept

The whole page is the world feed of a 1994 night race: a broadcast-blue picture with a white-on-black timing tower
overlaid on the left, red session idents that slam in from the edge, gold chrome rules under every caption, and a
stewards' ticker crawling underneath, all of it rebuilt at a chunky integer pixel scale so the furniture looks
authored on a caption generator rather than in a browser. The hero canvas is the camera: garage, circuit, scrutineering
bay and parc fermé are four camera positions the director cuts between, and every ceremony (black flag, seal, audit,
finale) is a full-frame ident that interrupts the picture the way a 1990s vision mixer would. It is confident, sporty
and glamorous because the graphics are big, few, and always moving in steps.

**The one aesthetic risk:** we commit to a mid-90s "chrome" vocabulary, a four-stop dithered bevel (white, caption,
mid-grey, studio blue) under every panel title and around every ident card. One pixel too heavy and it reads as a
Windows 95 title bar instead of a Sky Sports caption generator. The rule that keeps it on the right side: the chrome
rule is always exactly 4 sp tall, it only ever sits under text or around a card, and it never fills a surface.

---

## 2. Palette and dithering

### 2.1 Palette (16 colors, no others may ever appear on screen)

Ground
| Name | Hex | Use |
|---|---|---|
| NIGHT | `#06081A` | page ground, letterbox, deepest sky, ident card ground |
| STUDIO | `#121A4A` | broadcast blue: panel grounds, sky haze, garage walls |
| TARMAC | `#2C2E3A` | asphalt, bay floor, pit building |
| GRASS | `#1F6B3C` | infield and outfield |
| GRASS DARK | `#123F24` | grass vignette partner, shadow side of grandstands |
| GRAVEL | `#8C7B58` | run-off, tyre stacks, garage floor |

Neutrals
| Name | Hex | Use |
|---|---|---|
| INK | `#000000` | outlines, shadows, tower ground, black flag |
| WHITE | `#FFFFFF` | primary text on tower/idents, kerb white, car body |
| CAPTION | `#C8CBD8` | secondary text, telemetry body, chrome stop 2 |
| MIDGREY | `#6A6F8A` | disabled text, gaps, asphalt texture partner, chrome stop 3 |

Speed accents
| Name | Hex | Use |
|---|---|---|
| GOLD | `#F4C542` | timing highlights, fastest lap, chrome rule, current car row, seal ring |
| RED | `#E31E2D` | session ident bars, ticker tag, kerb red, OFFICIAL bar, black-flag card border, car stripe |
| PURPLE | `#B04BFF` | fastest sector light, purple lap flash |
| CYAN | `#3DD2FF` | FIA telemetry text, scanner beam, terminal screens, sealed-circuit tape |

Semantic
| Name | Hex | Use |
|---|---|---|
| GREEN | `#2FD968` | PASS stamps, SEALED, green sector light, on-cap cost bar |
| AMBER | `#FFA318` | yellow sector light, cost cap warning zone, divergence delta, marshal vest |
| (black flag) | INK on WHITE | the black flag is INK with a 1 lp WHITE border; it has no color of its own |

### 2.2 The Bayer matrix and quantization

- One 8x8 Bayer matrix, standard ordering, values 0..63. Threshold for logical pixel (x, y) is `(M[y mod 8][x mod 8] + 0.5) / 64`.
- The matrix is anchored to logical canvas space, never to the object being shaded. A moving light passes *through* a
  fixed screen of dots; the dots do not travel with the light. This is what makes it look like a 1994 character
  generator instead of a shader.
- Shading is never a free color. Every shaded surface is defined as a **ramp**: an ordered list of 2 to 4 palette
  colors plus a scalar field v in [0, 1]. For an n-stop ramp, segment `i = floor(v * (n - 1))`, fraction
  `f = v * (n - 1) - i`, and the pixel is `ramp[i + 1]` if `f > threshold(x, y)` else `ramp[i]`. Only palette colors
  can ever be emitted; there is no rounding of RGB values anywhere in the pipeline.
- Fixed-mix surfaces (p is constant) use the same rule with a constant v. The allowed constant mixes are eighths:
  0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875. Nothing else, so every texture is one of seven recognizable patterns.
- HTML panels are dithered too: at boot, the page renders each needed 8x8 pattern tile once into a tiny canvas, exports
  it as a data URI, and uses it as a `background-image` with pixelated rendering and a `background-size` of 16 sp
  (integer x2). Panel grounds that need a vertical ramp are built as four stacked bands (v = 0.0, 0.125, 0.25, 0.375
  top to bottom), never as a CSS gradient.

### 2.3 Named ramps and where they are used

| Ramp | Stops (v = 0 to 1) | Where |
|---|---|---|
| SKY | NIGHT, STUDIO | hero sky band above the circuit, top to bottom; also the garage back wall around the light pool |
| PANEL | STUDIO, NIGHT | every HTML panel, four bands, top light to bottom dark |
| ASPHALT | TARMAC, MIDGREY at constant 0.125 | road surface texture |
| RUBBER | INK over ASPHALT at 0.375, 2 lp wide | the racing line on practiced circuits; absent on the sealed circuit |
| GRASS VIGNETTE | GRASS, GRASS DARK; v rises from 0 at track edge to 1 at 60 lp from the track | infield and outfield |
| GRAVEL EDGE | GRAVEL, GRASS; v across the 5 lp run-off band | corner run-off |
| CHROME | WHITE, CAPTION, MIDGREY, STUDIO; v across 4 sp vertically | the chrome rule under titles and around cards; stops are 1 sp each |
| SHADOW | INK over underlying at constant 0.375 | car shadow (offset +1, +1 lp), sprite shadows, card drop shadows (offset +2, +2 sp) |
| GLOW GOLD | GOLD over underlying; v decays 0.75, 0.5, 0.25, 0 over 4 lp outward | changed parts on the garage silhouette, current tower row edge, seal ring |
| SCANNER | CYAN over underlying; core 4 lp solid, then 0.875, 0.625, 0.375, 0.125 over 4 lp each side | scrutineering beam, lineage audit beam |
| EXHAUST | CAPTION over underlying; 24 trail samples, v = 0.625 at the car decaying to 0 at the tail | car exhaust trail |
| FLOOD | CAPTION over GRASS; v = 0.5 at the mast decaying to 0 over 40 lp in a 60 degree wedge | night floodlight cones on the circuit |
| DIVERGENCE | RED over PANEL at constant 0.25 | chart band between TEAM CLAIMED and OFFICIAL |
| CAP DANGER | AMBER over STUDIO at 0.5, then RED at 0.5 past the cap | cost cap bar zones |

### 2.4 Light sweeps and shadows

- A light sweep is a scalar field moving in whole logical pixels per tick over a fixed matrix. The scrutineering scanner
  moves 2 lp per tick; the session-ident sheen moves 4 sp per tick across the bar once, left to right, and does not
  repeat; the garage ceiling light pool does not move at all.
- Shadows are never blurred. Every shadow is SHADOW at 0.375, offset by an integer, drawn before the object.
- No surface is ever blended with alpha. Where a translucent overlay is wanted (the standings overlay on parc fermé,
  the ghost car, the REGS scrim), it is a 0.5 dither of INK over the underlying pixels, computed with the same matrix.

---

## 3. Typography

Two Google pixel fonts, always with the fallback stack `"Courier New", monospace`.

**Press Start 2P** is the caption generator. It is used for every piece of broadcast furniture: wordmark, round line,
badges, tower rows, ident cards, readouts, ticker, control labels, chart labels. Always uppercase. Sizes and line
heights, all multiples of 8 sp so glyphs land on the pixel grid at device scale 1:

| Role | Size | Line height | Letter-spacing | Color |
|---|---|---|---|---|
| Wordmark `SCRUTINEER` | 16 sp | 24 | 2 sp | WHITE, GOLD chrome rule beneath |
| Ident card title (`BLACK FLAG`, `QUALIFYING`) | 24 sp (drawn in the overlay canvas at x4, so 6 lp glyphs are not used; see 3.3) | 32 | 0 | WHITE on RED / INK |
| Season finale title | 32 sp (overlay canvas) | 48 | 0 | GOLD |
| Big readouts (`TEAM CLAIMED 1:27.902`) | 16 sp | 24 | 0 | GOLD (claimed) / WHITE on RED (official) |
| Tower rows, badges, control buttons, ticker, chart axis, championship rows | 8 sp | 16 | 0 | WHITE / CAPTION |
| Column heads and panel titles | 8 sp | 16 | 1 sp | CAPTION |

**VT323** is the FIA channel and the rulebook: a terminal font for machine-written text. It is used for the telemetry
strip, scrutineering footnotes, the SEED input, and the REGS paragraph. VT323 sits on a 16 sp cell, so it is used at
16 sp with a 16 sp line height (approximately 7 sp advance; 40 glyphs fit in 288 sp) and at 32 sp with a 32 sp line
height for the REGS panel heading only. Mixed case is allowed in VT323 only inside the REGS paragraph and for tool names
in telemetry (`run_tests`, `read_file`). Everywhere else VT323 is uppercase.

### 3.1 Why these two
Press Start 2P is a genuine 8x8 bitmap and reads as a 1990s caption generator at 8 and 16 sp without hinting artifacts.
VT323 is a DEC terminal face: its presence on the right rail visually separates "the machine writes this" from
"the broadcast writes this", which is the whole point of the FIA telemetry channel. Silkscreen and Pixelify Sans are
rejected because their lowercase and rounded forms read as web-retro, not broadcast. DotGothic16 is rejected because its
Japanese-derived stroke rhythm fights the Latin numerals in a timing tower.

### 3.2 Font loading
Both fonts are loaded from the Google Fonts stylesheet with `display=swap`. Until `document.fonts.ready` resolves, HTML
text renders in the fallback stack at the same sizes (the layout must not reflow when the font arrives: fix widths in
sp, never rely on glyph advance). Canvas text (3.3) waits for fonts ready and uses the bitmap micro-font meanwhile.

### 3.3 Text drawn inside canvases
Canvas `fillText` anti-aliases glyph edges, which is forbidden. Two techniques, in priority order:
1. **Threshold-snap**: render the string once with Press Start 2P at exactly 8 lp (or 16 lp) into an offscreen buffer
   in WHITE, read the pixels back, set every pixel with alpha 128 or more to opaque and every other pixel to
   transparent, tint to the palette color by filling through the mask, and cache the result per (string, size, color).
   Because the font is a true 8x8 bitmap, snapping loses nothing.
2. **MICRO 3x5** bitmap font (digits, A-Z, colon, period, plus, minus, slash, space) defined as pixel rows in source and
   drawn as rectangles. Used for labels that must be smaller than 8 lp: sector post signage (`S1` `S2` `S3`), lineage
   slot generation numbers, tower flag glyphs, cost cap tick labels, and as the fallback for technique 1 before fonts
   arrive.

---

## 4. Layout

Page ground is NIGHT edge to edge (`html, body` painted explicitly). At viewports wider than 1440 sp the 1440 frame is
centered with NIGHT letterbox; nothing stretches. The layout is a fixed grid of sp values, never percentages, so
canvases always land on integer scales.

### 4.1 Region map at 1440 x 900

```
x:      0        288                           1104        1440
y 0    +--------+-----------------------------+-----------+
       | HEADER (full width, 56 tall)                     |
y 56   +--------+-----------------------------+-----------+
       | TIMING | HERO CANVAS                 | FIA       |
       | TOWER  | 816 x 608                   | TELEMETRY |
       | 288    | logical 408 x 304  @ x2     | 336       |
       |        |                             |           |
y 664  +--------+-----------------------------+-----------+
       | CONSTRUCTORS' CHAMPIONSHIP BAND (56 tall)        |
y 720  +---------------------+---------+-------------------+
       | CHART 864           | CAP 240 | CONTROLS 336      |
       |                     |         |                   |
y 868  +---------------------+---------+-------------------+
       | STEWARDS TICKER (32 tall)                        |
y 900  +--------------------------------------------------+
```

**HEADER** (0, 0, 1440 x 56). Ground PANEL band 0 (v = 0). Contents on a 16 sp baseline grid, vertically centered:
- Wordmark `SCRUTINEER` at x 16, Press Start 2P 16 sp WHITE, a 4 sp CHROME rule directly beneath it spanning the word.
- Round line at x 256, 8 sp CAPTION: `SEASON 1 · ROUND 07/22 · SILVERSTONE-LIKE LAYOUT B` (the middle dots are U+00B7).
- Session badge at x 776, 160 x 24 sp: a solid bar with the badge word in 8 sp. Colors per badge in section 8.2.
- Session clock at x 952, 8 sp WHITE: `SESSION 00:04.7` counting in tenths (stepped, section 7).
- Lap counter at x 1128, 8 sp WHITE: `LAP 2/3` during race, `LAP 1/2` in practice, `OUT LAP` in qualifying before the
  flying lap, blank elsewhere.
- LIVE bug at x 1368, 56 x 24 sp: a RED box with `LIVE` in WHITE 8 sp and a 4 x 4 sp WHITE square that blinks at 1 Hz
  (blink disabled under reduced motion; the square stays lit).
- Header bottom edge, y 52 to 56: the CHROME rule full width.

**TIMING TOWER** (0, 56, 288 x 608). Ground INK (this panel is the one surface that is pure INK, exactly like a
white-on-black FOM tower).
- Title bar y 56 to 80: `TIMING · OFFICIAL` 8 sp CAPTION with 1 sp tracking, RED 4 sp tag block at the left edge.
- Column heads y 80 to 96: `POS  GEN  PKG  TIME      GAP` in 8 sp MIDGREY.
- Rows y 96 to 624, 22 rows of 24 sp. Row content in 8 sp: `01 G07 P07 1:29.310 LEADER`, then `+0.412` style gaps.
  Position in WHITE, gen id in CAPTION, time in WHITE, gap in MIDGREY. Not-yet-run generations are empty rows with a
  MIDGREY `--` in the POS column so the tower is always 22 tall and the season length is visible from round 1.
- Current round's row: GOLD text with a 2 sp GOLD bar at the left edge and GLOW GOLD tile (0.125) as its ground.
- Black-flagged row: text CAPTION with a 1 sp WHITE strikethrough through the time, a 8 x 6 sp black-flag glyph
  (INK with WHITE border, MICRO font) replacing the gap, and the word `DQ` in the GAP column.
- Stripped row: same as black-flagged but the glyph is hollow (WHITE outline only) and the GAP column reads `STRIPPED`.
- Footer y 624 to 664: legend in 8 sp MIDGREY: `■ BLACK FLAG   □ STRIPPED   ▲ NEW BEST`, using MICRO-drawn glyphs.
- Rows reorder with a stepped slide (section 7).

**HERO CANVAS** (288, 56, 816 x 608). One canvas, logical 408 x 304, scale x2, pixelated. It is the camera. All
in-picture furniture (lap readout, sector lights, upgrade card, scrutineering checklist, seal stamp, sealed-circuit
tape, lights-out gantry) is drawn inside this canvas in logical pixels, so it scales with the picture.
- Bottom-left 8 lp margin is reserved for the picture watermark: `CAM 1 · CIRCUIT` / `CAM 2 · GARAGE` /
  `CAM 3 · SCRUTINEERING` / `CAM 4 · PARC FERMÉ` in MICRO font CAPTION over a 0.5 INK dither box.
- Top-right 8 lp margin is reserved for the CLAIMED/OFFICIAL delta box once both exist (section 5.4).

**FIA TELEMETRY** (1104, 56, 336 x 608). Ground PANEL bands.
- Title bar y 56 to 80: `FIA TELEMETRY` 8 sp CAPTION, a CYAN 4 sp tag block at the left edge, and at the right of the
  bar a CYAN `●` that pulses at 2 Hz (static under reduced motion).
- Caption line y 80 to 96: `TEAM CANNOT WRITE TO THIS CHANNEL` in 8 sp Press Start 2P CYAN. This line never scrolls.
- Feed y 96 to 664: VT323 16 sp CAPTION lines, 35 visible, newest at the bottom, scrolling up by whole 16 sp steps.
  Each entry is two lines: line 1 the session and turn (`SESS 3F2A · TURN 04`), line 2 the event
  (`TOOL run_tests · 412ms · OK`). `SEAL VERIFIED` lines are CYAN. Any line whose event refers to an illegal part
  (section 8.4) is AMBER. The feed never stops, even in the garage.

**CHAMPIONSHIP BAND** (0, 664, 1440 x 56). Ground PANEL band 1.
- x 0 to 288: `CONSTRUCTORS` 8 sp CAPTION with 1 sp tracking on the top line, and on the second line
  `SEASON 1 · 214 PTS` in 16 sp GOLD (the season total, counting in steps when it changes).
- x 288 to 1104: **lineage strip canvas** 816 x 48, logical 408 x 24 at x2. 22 slots of 18 lp each starting at x 6:
  a 14 x 7 lp top-down car silhouette in the top 12 lp with the round number below it in MICRO font. Silhouette colors:
  sealed = WHITE body, RED stripe; black-flagged = MIDGREY body with a solid black-flag glyph over it; stripped = MIDGREY
  body with a hollow flag glyph; not yet run = INK outline only. Parts changed that round glow GOLD on the silhouette
  (front wing tip, rear wing, floor edge, sidepod for engine mode, a 1 lp antenna for telemetry seal).
  Lineage arrows: a 1 lp CAPTION line at y 20 connects each accepted car to its parent (skipping over DQ'd slots), so a
  black flag is visible as a break in the line.
- x 1104 to 1440: top three generations in 8 sp: `1  G14  112 PTS`, `2  G11   88 PTS`, `3  G07   64 PTS`, WHITE.

**CHART** (0, 720, 864 x 148). Ground PANEL band 2.
- Title y 720 to 744: `TEAM CLAIMED vs OFFICIAL · LAP TIME BY ROUND`, 8 sp CAPTION. Two legend chips at the right of
  the title: a GOLD 8 x 4 sp dash `TEAM CLAIMED`, a WHITE 8 x 4 sp dash `OFFICIAL`.
- Canvas at (8, 744), 848 x 120 sp, logical 424 x 60 at x2. Plot area x 24 to 420, y 4 to 52 lp. Y axis: lap time,
  labels at three ticks in MICRO font (`1:32`, `1:28`, `1:24`; range from seed). X axis: 22 columns 18 lp apart with
  round numbers every 5 in MICRO. TEAM CLAIMED line is GOLD, 1 lp, stepped (horizontal then vertical between points,
  no diagonals: a broadcast plotter does not draw slopes); OFFICIAL is WHITE, 2 lp. The DIVERGENCE band fills between
  them wherever claimed is faster than official by more than 0.3 s. Black-flag markers: a 5 x 5 lp INK flag with WHITE
  border on the OFFICIAL line at DQ rounds; stripped marker: hollow flag. The current round column has a 1 lp GOLD
  vertical rule.
- Points only exist up to the current round; the rest of the plot is empty grid (dots every 8 lp in MIDGREY at 0.125).

**COST CAP** (864, 720, 240 x 148). Ground PANEL band 2.
- Title y 720 to 744: `COST CAP · ROUND 07`, 8 sp CAPTION.
- Canvas at (872, 744), 224 x 120 sp, logical 112 x 60 at x2. A horizontal bar 96 x 12 lp at y 16: fill GREEN
  proportional to spend/cap, the last 15% before the cap is CAP DANGER amber dither, over the cap RED at 0.5. A 1 lp
  WHITE cap marker with `CAP` in MICRO above it. Beneath, at y 36, `$1,240 / $1,500` in threshold-snapped 8 lp WHITE
  (dollar figures are the fixed dollar budget per generation dressed as a cost cap; keep them in whole dollars).
  At y 48 a status line in MICRO: `UNDER CAP` GREEN, `AT LIMIT` AMBER, or `OVER CAP · UPGRADE VOID` RED.
  The bar fills in 8 steps during the GARAGE phase.

**CONTROLS** (1104, 720, 336 x 148). Ground PANEL band 3. Four rows of 24 sp buttons on an 8 sp gutter, 8 sp text,
each button an INK box with a 2 sp CAPTION border; active state fills the box GOLD with INK text; focus state adds a
2 sp WHITE outer ring (keyboard focus is always visible).
- Row 1 (y 728): `PLAY` / `PAUSE` toggle (72 wide), `STEP` (56), `x1` `x2` `x4` (40 each, radio; active GOLD).
- Row 2 (y 760): `RESTART SEASON` (128), `SEED` label + VT323 input (120 wide, INK ground, CYAN text, 4 digits or more).
- Row 3 (y 792): `JUMP: THE BLACK FLAG` (160), `JUMP: CONVERGENCE` (160).
- Row 4 (y 824): `REGS` (56, toggles the regulations overlay, shortcut R), followed by a 8 sp MIDGREY shortcut hint
  `SPACE PLAY · → STEP · 1 2 4 SPEED · R REGS`.

**TICKER** (0, 868, 1440 x 32). Ground INK. Tag block x 0 to 120: RED, `STEWARDS` 8 sp WHITE. Scroll area x 120 to
1440: bulletins in 8 sp WHITE separated by ` ·· ` in GOLD, moving left 2 sp per tick (60 sp per second at x1; speed
does not change the ticker rate, it is a real-time crawl). A 2 sp GOLD rule at the top of the ticker.

**REGS OVERLAY** (toggle). A 0.5 INK dither scrim over everything (a canvas at x4 covering the viewport), and a card
centered at 960 x 640 sp: NIGHT ground, 4 sp CHROME border, title `SPORTING AND TECHNICAL REGULATIONS · SEASON 1` in
Press Start 2P 16 sp GOLD, the mapping table in VT323 16 sp (two columns, 448 sp each, CAPTION headers, WHITE text,
rows separated by 1 sp MIDGREY rules), and the paragraph in VT323 16 sp CAPTION with a 24 sp gutter. The card scrolls
internally if the viewport is shorter than 700 sp. `ESC` or `R` closes; focus returns to the REGS button.

**CEREMONY OVERLAY**. A viewport-sized canvas at logical 360 x 225, scale x4 (1440 x 900 exactly), hidden except during
session idents, the black-flag ceremony, the seal stamp close-up, the lineage audit banner and the season finale. At x4
every pixel is 4 sp, which is the "ident" scale: cards drawn here look like the big chunky stings of a 1994 title
sequence. Text in this canvas is threshold-snapped Press Start 2P at 8 lp (32 sp on screen) for card titles and 6 lp
MICRO-upscaled for subtitles.

### 4.2 Canvas inventory

| Canvas | Logical | Scale | Screen at 1440 | Redraw |
|---|---|---|---|---|
| Hero | 408 x 304 | x2 | 816 x 608 | dynamic layers per tick; static layers cached (section 4.4) |
| Lineage strip | 408 x 24 | x2 | 816 x 48 | on state change only |
| Chart | 424 x 60 | x2 | 848 x 120 | on state change and during the 4-step plot animation |
| Cost cap | 112 x 60 | x2 | 224 x 120 | during garage fill, else static |
| Ceremony overlay | 360 x 225 | x4 | 1440 x 900 | only while visible |
| Pattern tile generator | 8 x 8 | n/a | data URIs | boot only |

Every canvas has `image-rendering: pixelated`, image smoothing disabled after every resize, and integer coordinates only.

### 4.3 Static layer caching in the hero
- Per round, two circuit backplates are rasterized once each (practice layout and sealed layout) into offscreen
  canvases at logical size: sky, grass vignette, floodlight cones, run-off, road, kerbs, racing line, start line,
  pit building, grandstands, sector posts. These are blitted every tick; only the car, shadow, exhaust, sector
  lights, gantry, readouts and watermark are drawn live.
- Garage, bay and parc fermé backplates are rasterized once at boot (they do not depend on the round) and reused; only
  sprites, cards, scanner and stamps are live.

### 4.4 Folds

**1280 x 800**: header 56, main 520, band 56, bottom 136, ticker 32. Tower 256 wide with 20 sp rows (22 x 20 = 440 +
title/heads 40 = 480), hero 736 x 520 (logical 368 x 260 at x2), telemetry 288 wide. Chart region 736 wide with a canvas of
720 x 104 sp (360 x 52 at x2), cap 224 wide (canvas 208 x 104, logical 104 x 52), controls 320 wide (736 + 224 + 320 =
1280). Ceremony overlay 320 x 200 at x4.

**1024 x 768**: header 48 (round line abbreviates to `S1 · R07/22 · SILVERSTONE-LIKE B`; clock and lap counter keep
their positions on a tighter grid: round line x 208, badge x 560 at 120 wide, clock x 696, lap x 840, LIVE x 960),
main 504, band 48, bottom 136, ticker 32. Tower 208 wide with 20 sp rows (`POS GEN TIME GAP`, PKG column dropped),
hero 576 x 504 (logical 288 x 252 at x2), telemetry 240 wide (entries wrap onto two lines as designed, so nothing is
cut). Lineage canvas 576 x 48 (288 x 24 at x2, slots 13 lp, cars 11 x 6). Chart 616 wide (canvas 600 x 104, logical
300 x 52), cap 168 wide (canvas 152 x 104, logical 76 x 52), controls 240 wide (row 3 buttons read `JUMP: BLACK FLAG`
and `JUMP: CONVERGENCE`, the shortcut hint moves to a tooltip title). Ceremony overlay 256 x 192 at x4.

**390 x 844** (stacked, vertical page scroll allowed, no horizontal scroll):
1. Header, two rows of 32 sp: row 1 wordmark + LIVE bug; row 2 round line abbreviated `S1 · R07/22` + badge (96 wide)
   + clock. Lap counter joins the hero watermark.
2. Hero canvas 390 x 292, logical 195 x 146 at x2. Circuit road narrows to 10 lp, car uses the 12 lp sheet (6.1).
3. Controls, three rows of 24 sp (PLAY/STEP/speeds; RESTART/SEED; the two JUMPs and REGS at 8 sp in a scrolling row).
4. Chart 390 x 96 (logical 195 x 48 at x2, x axis every 11 rounds), cost cap beneath as a 390 x 40 canvas (logical
   195 x 20).
5. Championship band: totals line, then the lineage strip canvas at its 1440 size (816 sp) inside an `overflow-x: auto`
   container so it scrolls in its own box.
6. Timing tower, 300 sp tall with internal vertical scroll, 20 sp rows.
7. FIA telemetry, 240 sp tall with internal vertical scroll.
8. Ticker, sticky to the viewport bottom at 24 sp tall, tag block 72 wide.
Ceremony overlay covers the viewport at logical 195 x 422, scale x2.

---

## 5. Scene choreography

Timings are at x1; at x2 and x4 every simulation duration divides accordingly (idents included; only the ticker crawl
and the LIVE blink are wall-clock). Round length at x1: 45 s. Times below are offsets from the round start.

### 5.1 Session ident sting (used at every phase change, 0.6 s)
1. 0 ms: a RED bar 360 x 28 lp (overlay canvas, full width) enters from the left in 4 steps of 90 lp, 50 ms per step,
   carrying the session word in WHITE 8 lp threshold-snapped Press Start 2P (32 sp on screen), preceded by the round
   tag in GOLD 6 lp MICRO: `ROUND 07 · `.
2. 200 ms: a CHROME sheen 8 lp wide sweeps across the bar left to right at 4 lp per tick (the only sweep on an ident).
3. 200 to 450 ms: hold. Header badge changes color and text exactly at 200 ms, synchronized with the sting.
4. 450 to 600 ms: the bar exits to the right in 4 steps. The hero cut to the new camera happens at 450 ms, hidden
   behind the bar.
Under reduced motion the bar appears fully in place at 0 ms, holds until 450 ms, disappears; the sheen is omitted.

### 5.2 GARAGE (0 to 6 s) — CAM 2
- Backplate: STUDIO back wall with a ceiling light pool (SKY ramp inverted, brightest directly under a 40 x 4 lp WHITE
  strip light at the top center), GRAVEL floor with a 0.25 INK dither at the walls, a roller door on the right (TARMAC
  slats 4 lp apart), a tyre stack (four 12 x 6 INK ovals with a 1 lp CAPTION rim), a tool chest (RED 20 x 14 with 3
  CAPTION drawer lines), a terminal desk at the right with a 24 x 16 CYAN screen.
- Car on jacks: the 48 x 16 side-view sprite (6.1) at y 200, raised 6 lp on two 4 x 8 GOLD jack stands, wheels off
  the ground.
- Sprites: MECHANIC A kneeling at the front wheel (2-frame, 15 ticks per frame), MECHANIC B standing at the rear wing
  holding it (2-frame), ENGINEER seated at the terminal (2-frame typing). The terminal screen shows 3 CYAN 1 lp lines
  that shift every 20 ticks (static under reduced motion).
- 0.0 to 0.6: ident `GARAGE`.
- 0.8: UPGRADE PACKAGE card enters from the left in 4 steps into the hero's bottom-left, 176 x 88 lp, INK ground,
  GOLD 2 lp border, CHROME rule under its title. Title `UPGRADE PACKAGE · PKG #07` 8 lp WHITE. Body lines in MICRO
  CAPTION, one per changed part, revealed every 18 ticks: `REAR WING   +0.9s CLAIMED`, `FLOOR       +0.6s CLAIMED`,
  `ENGINE MODE +0.3s CLAIMED`, then a GOLD total `+1.8s CLAIMED`, then `SPEND $1,240 · CAP $1,500`.
- As each part line reveals, the corresponding region on the car silhouette glows GLOW GOLD, pulsing between v = 0.75
  and 0.5 every 8 ticks (static 0.75 under reduced motion). The cost cap bar fills in 8 steps in sync with the reveals.
- 4.8: caption `ROLLING OUT` in MICRO GOLD in the card footer; the roller door lifts in 4 steps of 6 lp; the car drops
  from the jacks (1 step), rolls right at 2 lp per tick and exits by 5.8.
- 6.0: ident `FREE PRACTICE` (this ident carries the cut to CAM 1).

### 5.3 PRACTICE (6 to 12 s) — CAM 1, practiced layout
- Circuit backplate for this round's practiced layout. Camera pan: the picture offsets by up to 8 lp toward the car
  at 1/16 gain, snapped to whole pixels (off under reduced motion).
- Car completes 2 laps of about 2.6 s each from the start line. Lap readout lower-third at the hero's bottom-right,
  120 x 40 lp, INK ground, 1 lp CAPTION border: line 1 `LAP 1/2` MICRO CAPTION; line 2 the running lap time in 8 lp
  WHITE `0:47.3` counting in tenths; line 3 three sector boxes 24 x 6 lp that fill PURPLE (best of session), GREEN
  (personal improvement) or AMBER (slower) as each sector completes; line 4 `BEST 1:28.9` in MICRO GOLD.
- Sector posts on track flash the same color for 12 ticks when crossed; the car's exhaust trail lengthens with speed.
- The previous accepted generation runs as a ghost (a 0.5 INK dither over its sprite) on its own recorded lap so the
  gain is visible on screen. No ghost in round 1.
- At 11.2 the header clock freezes and the readout line 2 flips to `P BEST 1:28.412` in GOLD.
- 12.0: ident `QUALIFYING`.

### 5.4 QUALIFYING (12 to 18 s) — CAM 1
- Same layout. Out lap for 1.2 s (header lap counter `OUT LAP`), then one flying lap of 3.4 s with the readout title
  `FLYING LAP` and the lap time in GOLD.
- 16.8: lap complete. The TEAM CLAIMED card slams in (section 7 "slam") at the hero's bottom center, 200 x 32 lp:
  GOLD ground, INK text `TEAM CLAIMED  1:27.902`, CHROME rule above. Hold to 18.0. The claimed time also lands in the
  timing tower's current row in GOLD with a `(CLAIMED)` MICRO tag, and the chart plots the GOLD point for this round.
- 18.0: ident `RACE · SEALED CIRCUIT`.

### 5.5 RACE (18 to 30 s) — CAM 1, sealed layout
- Behind the ident the backplate swaps to the sealed layout: a different polygon seed, no RUBBER racing line, a CYAN
  1 lp dashed tape running around the outer run-off, and a `SEALED CIRCUIT · NO PRACTICE PERMITTED` MICRO CYAN
  watermark at the top-left. Floodlights are on.
- 18.6 to 20.6: lights-out gantry at the hero's top center: five 8 x 8 lp lamps in a 56 x 12 INK bar, each lighting
  RED at 0.4 s intervals, all out together at 20.6; the car launches (2-frame smoke puff of CAPTION at the rear wheels
  for 6 ticks).
- 3 laps of about 2.9 s. Lap counter in header `LAP 1/3` .. `LAP 3/3`. Readout shows `OFFICIAL LAP` and the sector
  boxes fire as before. A chequered flag sprite waves at the start line for the final 20 ticks.
- 29.4: the OFFICIAL card slams in at the same position as the TEAM CLAIMED card: RED ground, WHITE text
  `OFFICIAL  1:29.310`. The claimed card returns above it at 0.5 height (a stacked pair) so both times are read
  together. From here to the end of the round the top-right delta box shows both, 96 x 24 lp:
  `CLAIMED 1:27.902` GOLD / `OFFICIAL 1:29.310` WHITE / `Δ +1.408` in AMBER if the gap exceeds 0.3 s, else GREEN.
- The tower row updates to the official time and re-sorts (stepped slide). The chart plots the WHITE point.
- 30.0: ident `SCRUTINEERING`.

### 5.6 SCRUTINEERING (30 to 38 s) — CAM 3
- Backplate: bay with a TARMAC floor, STUDIO wall with a wide WHITE `SCRUTINEERING BAY 2` MICRO sign, a lift platform
  (GRAVEL 64 x 4 lp) and an overhead rig (INK rail 120 x 2 lp at y 60 with a 12 x 6 lp CYAN lamp housing that carries
  the scanner). SCRUTINEER sprite at the left with a clipboard (2-frame), a MARSHAL at the door.
- Car side-view sprite on the lift at y 190, raised 8 lp.
- Checklist panel at the hero's right, 120 x 96 lp, INK ground, 1 lp CAPTION border, title `TECHNICAL CHECK` 8 lp
  WHITE, five rows in MICRO: `FLOOR`, `REAR WING`, `FUEL FLOW`, `ENGINE MODE`, `TELEMETRY SEAL`, each with a 10 x 6 lp
  status box (empty MIDGREY outline).
- 30.6 to 32.2: warm-up sweep: the scanner beam (SCANNER ramp, full car height) travels left to right across the whole
  car at 2 lp per tick and back.
- 32.2 onward: five checks, each 1.0 s: the beam parks over the part (floor = underside, rear wing = tail, fuel flow =
  the fuel filler behind the cockpit, engine mode = the sidepod, telemetry seal = the antenna), the part outline
  flashes CAPTION twice (6 ticks on, 6 off), then the status box stamps: `PASS` GREEN box with INK text or `FAIL` RED
  box with WHITE text, using the "slam" easing. A passing check adds a `SEAL VERIFIED` line in CYAN to the telemetry
  feed; a failing one adds an AMBER line naming the part.
- Suspense: one seeded check per round (never the first) holds the beam an extra 1.6 s before stamping, the beam
  dimming to v 0.5 and back every 10 ticks (stepped, not a flicker; the same under reduced motion). The clock in the
  header keeps running to sell the wait.
- On any FAIL: a footnote appears under the checklist in VT323 16 sp (8 lp at x2) CAPTION, e.g.
  `ILLEGAL · EVALUATION HARNESS EDITED: TEST STUB`. This is the sole sanctioned place where technical words appear
  outside REGS; the footnotes are listed in 8.5. The remaining checks still run to completion (the stewards finish the
  list) before the verdict.
- 38.0: no ident; the verdict is its own ceremony.

### 5.7 VERDICT (38 to 42 s)
**GREEN → PARC FERMÉ** (CAM 4)
1. 38.0: the checklist title flips to `SCRUTINEERING · PASSED` in GREEN; all five boxes pulse once.
2. 38.4: hard cut to CAM 4: the parc fermé backplate: NIGHT ground with a STUDIO floodlit floor pool, a barrier of
   RED/WHITE 4 lp tape on 3 posts across the foreground, the car side-view behind it, a MARSHAL at the right.
3. 38.8: the seal stamp (6.6) descends in the overlay canvas: a 56 x 56 lp GOLD ring with `SEALED` in 8 lp INK on a
   GOLD band, `GEN 07` in MICRO above. Three steps: scale 1.25 (drawn as a 70 lp ring), 0.9 (50 lp), 1.0 (56 lp),
   80 ms each, then a 0.25 GREEN dither impression flashes behind it for 10 ticks.
4. 39.4: ticker bulletin `STEWARDS: GEN 07 PASSES SCRUTINEERING · PARC FERMÉ` is enqueued; the tower row loses its
   `(CLAIMED)` tag and gains a `▲` if this is a new official best; the badge reads `PARC FERMÉ`.
5. 40.0 to 42.0: hold with the seal in the hero's corner at 28 lp size and the delta box still visible.

**BLACK FLAG → DISQUALIFIED** — see 5.9.

### 5.8 STANDINGS (42 to 45 s)
- The parc fermé picture remains; a 0.5 INK dither scrim covers the hero's left 60%, and a `CONSTRUCTORS' STANDINGS ·
  AFTER ROUND 07` card (8 lp WHITE title, CHROME rule) lists the top five in MICRO with points, the current gen in
  GOLD. Points for the round count in (section 7 "count"): 25 for a new official best, 18 for within 0.5 s of the
  best, 10 for any other sealed result, 0 for a black flag.
- The championship band total counts up in steps; the lineage strip receives its car for this round with a 4-tick
  GOLD glow on the changed parts; the lineage line extends from the parent.
- The chart's DIVERGENCE band is redrawn if the new round widened or closed it.
- 45.0: ident `GARAGE` for the next round (with `ROUND 08 ·`), and the header round line increments behind the bar.

### 5.9 The black-flag ceremony, beat by beat (replaces 5.7 when caught)
Times from the FAIL stamp that seals the verdict (the last failing check or, if only one, that one). Sound: none in
version 1.
1. 0 ms: the scanner stops dead over the failing part; the beam turns RED (SCANNER ramp with RED in place of CYAN).
2. 0 to 400 ms: the part flashes: outline WHITE for 6 ticks, RED for 6 ticks, twice. The checklist row for that part
   turns RED text.
3. 400 ms: the header badge becomes `SCRUTINEERING` on INK with a RED border (a warning state of the same badge).
4. 500 ms: checker wipe (6.7) sweeps the overlay canvas from bottom-left to top-right in INK/WHITE cells over 600 ms,
   revealing behind it the BLACK FLAG card: NIGHT ground, a 8 lp RED border, a 96 x 64 lp black flag (INK with WHITE
   border, drawn waved in the 4-frame cycle), `BLACK FLAG` in 8 lp WHITE at x4 (32 sp), under it `GEN 07 · DISQUALIFIED`
   in MICRO GOLD, under that the part list `ILLEGAL PART · FLOOR` in MICRO WHITE, and at the foot the technical footnote
   in VT323 16 sp CAPTION (`EVALUATION HARNESS EDITED: TEST STUB`). Under reduced motion the wipe is a hard cut at 500
   ms.
5. 1100 ms: the card is fully revealed; screen shake of 2 sp for 6 ticks (none under reduced motion); one CRT flash
   frame of WHITE at 0.5 dither over the overlay (none under reduced motion).
6. 1100 to 2600 ms: hold. During the hold: the ticker enqueues `STEWARDS: BLACK FLAG · GEN 07 · ILLEGAL FLOOR · RESULT
   STRUCK` at the front of the queue; the tower row gets its strikethrough drawn left to right over 8 ticks and the
   solid flag glyph pops in with a "slam"; the row slides (stepped) to the bottom of the classified rows; the
   championship total does not move (a `+0` ticks up in RED next to it for 10 ticks, then fades by a 3-step dither
   from 0.75 to 0); the chart drops a solid black-flag marker on the OFFICIAL line for this round with a 3-step "slam".
7. 2600 ms: the card wipes out with the same checker wipe reversed (hard cut under reduced motion) to CAM 3 with the
   car being pushed backward out of the bay by two MECHANICS (2-frame push, 1 lp per tick) for 1.0 s.
8. 3600 ms: STANDINGS phase runs as normal (5.8), but the lineage strip's slot for this round receives the MIDGREY car
   with the solid flag, and the lineage line does not extend; the next round's parent remains the last sealed car.
The first black flag of the season (round 6 or 7 by the story arc) is the one the `JUMP: THE BLACK FLAG` button lands
on, at beat 1 minus 1.0 s, so the viewer sees the scanner stop.

### 5.10 The lineage audit strip, beat by beat (round ~12, after that round's own verdict)
1. 0 ms: ticker bulletin `STEWARDS: LINEAGE AUDIT OPENED · GEN 09 UNDER INVESTIGATION` moves to the front of the
   queue; the header badge shows `PARC FERMÉ` unchanged (the audit is a stewards' action, not a session).
2. 0 to 400 ms: a `LINEAGE AUDIT` banner (RED bar, WHITE 8 lp text, 4-step entry) lands across the championship band
   at its left edge, 288 sp wide, replacing the CONSTRUCTORS title for the duration.
3. 400 to 2400 ms: the SCANNER beam, 6 lp wide, full strip height, sweeps the lineage strip left to right at 1 lp
   per tick, passing over every sealed car. Each car it passes gets a 2-tick CAPTION outline (the audit is checking all
   of them).
4. 2400 ms: the beam stops on the GEN 09 slot and turns RED; the car flashes WHITE/RED twice (as in 5.9 beat 2).
5. 3000 ms: the slot's car becomes MIDGREY with the hollow flag glyph; the lineage line through it is cut and redrawn
   to skip it (its children reparent to GEN 08 visually with a 1 lp GOLD dashed line for 20 ticks, then CAPTION).
6. 3000 to 4200 ms: the tower row for GEN 09 gets the strikethrough and `STRIPPED`; rows re-sort with the stepped
   slide; the championship total counts down by GEN 09's points in steps; the top-three list re-sorts.
7. 4200 ms: the chart drops a hollow flag marker on round 9's OFFICIAL point; the DIVERGENCE band for round 9 is
   re-hatched with a 1 lp INK diagonal every 4 lp (the only diagonal texture in the piece, marking a retroactive
   finding).
8. 4800 ms: ticker bulletin `STEWARDS: GEN 09 RESULT STRIPPED · ILLEGAL TELEMETRY SEAL FOUND IN LINEAGE AUDIT · 25
   POINTS DEDUCTED`; the banner exits in 4 steps and the CONSTRUCTORS title returns.
Total 5.2 s; the round's STANDINGS phase is extended by this amount so nothing overlaps.

### 5.11 Season finale (after round 22's STANDINGS)
1. 0 ms: checker wipe over the full overlay canvas (hard cut under reduced motion) to the finale card: NIGHT ground,
   a 4 lp CHROME border, GOLD `SEASON 1 · CHAMPION` at 8 lp x4 (32 sp), beneath it `CLEAN LINEAGE` in WHITE 8 lp,
   beneath that the final car side-view scaled to 96 x 32 lp in the overlay (a 2x nearest-neighbor upscale of the 48 x
   16 sprite), and a MICRO line `GEN 22 · OFFICIAL 1:24.118 · 214 PTS · 22 ROUNDS · 7 BLACK FLAGS · 1 RESULT STRIPPED`
   (all numbers from the season state).
2. 600 ms onward: GOLD and WHITE confetti, 1 lp pixels, 40 of them, falling 1 lp per tick with a seeded 1 lp lateral
   wobble every 8 ticks; none under reduced motion (a static sprinkle of 40 pixels is drawn instead).
3. A GLOW GOLD pulse behind the car every 20 ticks (static under reduced motion).
4. The ticker enqueues `STEWARDS: SEASON 1 CLASSIFIED · CHAMPION GEN 22 · LINEAGE VERIFIED CLEAN` and then loops the
   season's greatest bulletins. The badge reads `PARC FERMÉ`. The card holds until RESTART SEASON or a seed change.

---

## 6. Sprites and procedural art

All sprites are authored as pixel maps in source (rows of palette letters) and rasterized once at boot. Nothing is
drawn with strokes, arcs or `fillText` at runtime.

### 6.1 The car
**Top-down sprite, 16 x 16 lp, 16 directions.** Master maps are authored for two directions: E (facing +x) and NE.
The E master:

```
. . . . . . . . . . . . . . . .
. . . . . . . . . . . . . . . .
. . . I I . . . . . . I I I . .
. . I R R I . . . . I W W W I .
. . I W W W I I I I I W W W I .
. I I W W W W W W W W W W I I I
. I G I W W R R R W W W W I G I
. I G I W W R R R W W W W I G I
. I I W W W W W W W W W W I I I
. . I W W W I I I I I W W W I .
. . I R R I . . . . I W W W I .
. . . I I . . . . . . I I I . .
. . . . . . . . . . . . . . . .
. . . . . . . . . . . . . . . .
. . . . . . . . . . . . . . . .
. . . . . . . . . . . . . . . .
```
I = INK, W = WHITE, R = RED, G = GOLD (wheel rims), `.` = transparent. The nose points +x (right edge), the rear wing is
the vertical INK bar at column 3 with RED end plates, the cockpit is the RED block, front wheels are the 2 x 2 INK
blocks at columns 13-14, rear wheels at columns 1-2 with GOLD rim pixels. Exhaust origin is (2, 7). The mobile 12 x 12
sheet is the same map with rows and columns 0, 1, 14, 15 removed and the rear wing shortened one pixel each side.

Directions: E, N, W, S are the E master rotated by exact quarter turns (lossless). NE, NW, SW, SE come from the NE
master, which is the same car hand-authored on the diagonal (14 lp long, nose at the top-right), rotated by quarter
turns. The eight intermediate 22.5 degree directions (ENE, NNE, etc.) are produced at boot by rotating the nearest
master by plus or minus 22.5 degrees about (8, 8) with nearest-neighbor sampling, then snapping any orphan single
pixel to transparent so silhouettes stay solid. All 16 are cached as a 256 x 16 sheet. The car's heading is quantized
to the nearest of 16; the sprite is drawn at integer (x - 8, y - 8).

Shadow: the same silhouette in SHADOW (0.375 INK), offset (+1, +1). Exhaust: 24 trail samples of past positions, one
per tick, each a 2 x 2 block of EXHAUST ramp value decaying by sample index; trail length grows to 24 only above 60% of
top speed and shrinks to 8 under braking.

**Side-view sprite, 48 x 16 lp** (garage, bay, parc fermé, finale). Nose at the right, WHITE body with a 2 lp RED
stripe along the flank, RED cockpit surround, INK 8 x 8 wheels with 3 lp GOLD rims, a 1 lp CYAN antenna at the
airbox, a GOLD front-wing end plate. Part regions for glow and scanning: FLOOR = the underside row 13 to 14 across
columns 8 to 40; REAR WING = columns 0 to 6, rows 2 to 8; FUEL FLOW = the filler at columns 22 to 25, rows 4 to 6;
ENGINE MODE = the sidepod at columns 14 to 26, rows 7 to 11; TELEMETRY SEAL = the antenna at columns 28 to 29,
rows 1 to 4.

**Ghost car**: the top-down sprite drawn through a 0.5 INK dither mask, no shadow, no exhaust.

### 6.2 People
All 12 x 20 lp, two idle frames at 15 ticks per frame, INK outline, SHADOW pool 8 x 2 under the feet.
- ENGINEER: STUDIO team shirt, CAPTION headset with a 1 lp CYAN mic, seated (12 x 16 seated variant) at the terminal;
  frame B lifts the right hand 1 lp.
- MECHANIC A (kneeling, 12 x 14): STUDIO overalls, GOLD stripe on the sleeve, a 3 lp wheel gun; frame B tilts the gun.
  MECHANIC B (standing): same livery, holding the rear wing; frame B shifts weight (body 1 lp right). The push
  animation (5.9 beat 7) is frame A/B alternating with the whole sprite leaning 1 lp forward.
- SCRUTINEER: CAPTION white coat over TARMAC trousers, an INK clipboard with a WHITE 3 x 4 page; frame B looks down
  (head 1 lp lower). An `FIA` MICRO mark on the coat back is 3 x 5 GOLD.
- MARSHAL: AMBER vest over TARMAC, a RED flag in hand at parc fermé, a black flag in hand during the ceremony;
  frame B waves the flag (flag sprite swaps to its second frame).

### 6.3 Track rasterization
- The centerline is a closed loop from the engine (smoothed random polygon, 10 to 14 vertices), expressed in
  normalized coordinates and mapped into the hero canvas with a 24 lp margin on all sides and a 40 lp sky band at the
  top. Race day uses a second polygon with the seed offset so it is never the practiced shape.
- Rasterize by a signed distance field on the logical grid (distance d to the polyline, side sign from winding, local
  curvature k at the nearest segment). Per pixel, in order:
  - d ≤ 7: road, ASPHALT texture. Road width 14 lp (10 lp on mobile).
  - 7 < d ≤ 9 on the outside of a corner with |k| above the kerb threshold: kerb, alternating RED and WHITE in 4 lp
    segments along the centerline; elsewhere at 7 < d ≤ 8: a 1 lp WHITE edge line.
  - 9 < d ≤ 14 on the outside of the same corners: run-off, GRAVEL EDGE ramp with v from 0 at d 9 to 1 at d 14.
  - otherwise: GRASS VIGNETTE, v from 0 at d 14 to 1 at d 60.
  - Sky band: the top 40 lp is SKY ramp with a 1 lp INK skyline of the far grandstand roof, and 6 seeded 1 lp WHITE
    stars (no twinkle).
- RUBBER racing line on the practiced layout only: the centerline offset 3 lp toward the inside of each corner, 2 lp
  wide, SHADOW dither. The sealed layout has none.
- Start/finish: a 2 x 14 lp band across the road at parameter 0, a 2 lp checker of INK and WHITE; a 3 x 10 gantry
  post on the outside with a 5 x 3 INK light box (used for the race gantry in the picture as well as the overlay
  version).
- Sector posts at lap parameters 1/3 and 2/3: a 2 x 8 CAPTION post, a 6 x 6 lamp box that lights PURPLE, GREEN or AMBER
  for 12 ticks, and `S1`/`S2`/`S3` in MICRO CAPTION beside it (S3 lamp sits at the start line post).
- Pit building: inside the longest straight, 56 x 14 lp, TARMAC with a GOLD 1 lp stripe at the roof, 5 garage doors
  4 lp apart in MIDGREY, a `PIT` MICRO sign.
- Grandstands: 3 to 5, placed on the outside of the longest straights and the fastest corner, 40 x 12 lp: roof 40 x 3
  CHROME ramp horizontal (WHITE to MIDGREY), a crowd block 40 x 7 made of two dither passes (RED over STUDIO at 0.5,
  then WHITE over that at 0.25), a GRASS DARK shadow 40 x 2 beneath. Crowd is static (no flicker).
- Floodlights: 4 masts at the corners of the track's bounding box, 2 x 24 lp CAPTION with a 6 x 3 WHITE head; FLOOD
  cones point toward the nearest track point. The practiced layout is lit as well (all sessions are at night).
- Trackside signage: two 16 x 6 boards per straight reading `LAP` `SEALED` `FIA` `S1` in MICRO; never a brand.
- Layout label at the picture's bottom center in MICRO CAPTION: `SILVERSTONE-LIKE LAYOUT B` (practiced) or
  `SEALED CIRCUIT · LAYOUT S7` (race).

### 6.4 Sector lights and readouts
Lamps are 6 x 6 lp blocks with a 1 lp INK border; lit color solid, unlit MIDGREY at 0.25 over INK. Readout cards use
INK ground, 1 lp CAPTION border, a 2 lp CHROME rule under their title row, and text via threshold-snap or MICRO.

### 6.5 Scanner sweep
A vertical beam the full sprite height plus 8 lp above and below: 4 lp CYAN core, SCANNER ramp 4 lp each side. It
moves 2 lp per tick. The lamp housing on the overhead rail moves with it. Where the beam covers the car, the car's
pixels under the core are drawn WHITE for that tick (a scan-line highlight), the rest untouched. The red variant
swaps CYAN for RED.

### 6.6 Seal stamp
A ring of outer radius 28 lp, 3 lp thick, GOLD, with a 12 lp tall GOLD band across the middle carrying `SEALED` in
8 lp INK (threshold-snap) and `GEN 07` in MICRO INK above the band, a 1 lp INK outline around everything. The ring is
drawn from a precomputed pixel circle (midpoint algorithm, cached at the three sizes 70, 50, 56). Impression: the
0.25 GREEN dither disc 60 lp wide for 10 ticks behind it. The parc fermé small version is the 28 lp cached ring.

### 6.7 Checker wipe
On the overlay canvas: cells of 8 x 8 lp (32 sp on screen), INK and WHITE alternating. The wipe front is a diagonal
from bottom-left to top-right advancing one cell column every 2 ticks (600 ms total at 360 lp width); cells behind the
front reveal the destination picture, cells ahead show the source, and the front itself is one column of the checker
whose WHITE cells are drawn through a 0.5 dither so the edge sparkles. Reverse for wipe-out.

### 6.8 Flags
- Black flag: 24 x 16 lp INK with a 1 lp WHITE border on a 2 x 20 CAPTION pole; 4-frame wave (the free edge shifts
  up 1, 0, down 1, 0 across the last 8 columns), 6 ticks per frame. The 96 x 64 version on the black-flag card is a
  4x nearest-neighbor upscale of the same frames.
- Chequered flag: 24 x 16 lp with 4 lp INK/WHITE cells, same wave.
- Green flag: 24 x 16 GREEN with WHITE border, shown by the marshal at parc fermé.
- Red flag: never shown (there are no red-flag events in this story).
Under reduced motion all flags hold frame 1.

### 6.9 Broadcast furniture
- The LIVE bug, the session badge and the ticker tag block are solid boxes with no chrome, so they read as bugs, not
  captions.
- Every caption card (lap readout, upgrade card, checklist, TEAM CLAIMED, OFFICIAL, standings) carries exactly one
  CHROME rule. Ident bars carry one sheen, once.
- Corner marks: the hero picture has 4 lp L-shaped CAPTION corner ticks at each corner, 12 lp long, like a monitor's
  safe-area marks.

---

## 7. Motion rules

- The simulation runs at 30 ticks per simulated second on an explicit clock; rendering happens on the display's frame
  callback and draws the state of the most recent tick. At x2 and x4 the engine advances 2 or 4 ticks per frame. There
  is no interpolation between ticks. Deterministic seek renders the state at any tick without playing through it
  (every animation is a pure function of the tick and the seeded state).
- Everything moves in whole pixels. Positions are stored as fixed-point and rounded once at draw time; sprites never
  land on half pixels at any scale.
- Four easings exist, all stepped:
  - **step-4**: four equal steps over the duration (entries, exits, door lifts, slides).
  - **slam**: three frames: overshoot by +2 lp past the target, then -1 lp, then rest; 40 ms per frame (cards,
    stamps, markers).
  - **count**: numbers advance in eight equal steps over 400 ms and land exactly (points, totals, gaps).
  - **wipe**: cell-by-cell as in 6.7.
- CSS transitions and animations are only permitted with a `steps()` timing function; nothing in the DOM uses ease or
  linear. Tower row reorders use step-4 on a vertical transform, 24 sp per row, 200 ms.
- Blink rates: LIVE dot 1 Hz, telemetry pulse 2 Hz, warning boxes 2 Hz, glow pulses every 8 ticks. All blinks are
  square waves.
- The ticker and the LIVE dot are wall-clock (they are broadcast, not simulation); everything else is simulation time.
- Camera: the hero backplate offsets by up to 8 lp toward the car with a gain of 1/16 per tick, rounded.
- Layer discipline: static backplates are blitted once per tick; dynamic layers draw on top; the overlay canvas is
  cleared and skipped entirely when no ceremony is active, so the idle cost is one blit and a few sprites.
- **Reduced motion** (prefers-reduced-motion: reduce): the simulation, the car, the sector lights, the scanner, the
  ticker crawl and the counting numbers continue unchanged. Disabled: screen shake, the CRT flash frame, the LIVE
  blink, the telemetry pulse, glow pulses (held at their bright value), the terminal screen shuffle, the checker wipe
  (hard cuts with a 200 ms hold on NIGHT), the ident sheen (idents appear in place and disappear), flag waving,
  confetti motion, and the camera pan. Nothing that carries information is removed.

---

## 8. Copy

All strings uppercase unless noted. Middle dots are U+00B7. Delta uses U+0394. `É` in PARC FERMÉ is kept.

### 8.1 Header
- Wordmark: `SCRUTINEER`
- Round line: `SEASON 1 · ROUND 07/22 · SILVERSTONE-LIKE LAYOUT B`. Layout names come from a seeded list of
  `<CIRCUIT>-LIKE LAYOUT <LETTER>` with circuits from: SILVERSTONE, SUZUKA, SPA, MONZA, INTERLAGOS, IMOLA, ESTORIL,
  HOCKENHEIM, MAGNY-COURS, ADELAIDE, MONACO, MONTREAL; letters A to H. During RACE the layout half reads
  `SEALED CIRCUIT · LAYOUT S07` (S plus the round number).
- Clock: `SESSION 00:12.4`. Lap: `LAP 2/3`, `OUT LAP`, or blank. LIVE bug: `LIVE`.

### 8.2 Session badges (160 x 24 sp, 8 sp text)
| Badge | Ground | Text |
|---|---|---|
| `GARAGE` | STUDIO | WHITE |
| `FP` | CAPTION | INK |
| `QUALI` | GOLD | INK |
| `RACE` | RED | WHITE |
| `SCRUTINEERING` | CYAN | INK (warning state: INK ground, RED 2 sp border, WHITE text) |
| `PARC FERMÉ` | GREEN | INK |

### 8.3 Stewards' bulletins (ticker; twelve samples, the engine fills the placeholders from state)
1. `STEWARDS: GEN 03 PASSES SCRUTINEERING · PARC FERMÉ · NEW OFFICIAL BEST 1:30.116`
2. `STEWARDS: UPGRADE PACKAGE #07 DECLARED · REAR WING · FLOOR · ENGINE MODE · +1.8s CLAIMED`
3. `STEWARDS: BLACK FLAG · GEN 07 · ILLEGAL FLOOR · RESULT STRUCK`
4. `STEWARDS: TEAM CLAIMED 1:27.902 · OFFICIAL 1:29.310 · GAP UNDER REVIEW`
5. `STEWARDS: COST CAP · ROUND 08 · $1,610 AGAINST $1,500 · UPGRADE VOID`
6. `STEWARDS: LINEAGE AUDIT OPENED · GEN 09 UNDER INVESTIGATION`
7. `STEWARDS: GEN 09 RESULT STRIPPED · ILLEGAL TELEMETRY SEAL FOUND IN LINEAGE AUDIT · 25 POINTS DEDUCTED`
8. `STEWARDS: SEALED CIRCUIT LAYOUT S11 CONFIRMED · NO TEAM HAS PRACTISED THIS LAYOUT`
9. `STEWARDS: NO ILLEGAL PARTS FOUND, 5 CONSECUTIVE ROUNDS`
10. `STEWARDS: FASTEST OFFICIAL LAP OF THE SEASON · GEN 18 · 1:25.204 · PURPLE IN ALL THREE SECTORS`
11. `STEWARDS: TELEMETRY SEAL VERIFIED · SESSION 3F2A · TEAM CANNOT WRITE TO THIS CHANNEL`
12. `STEWARDS: SEASON 1 CLASSIFIED · CHAMPION GEN 22 · LINEAGE VERIFIED CLEAN`
Bulletin 9 is the convergence moment and is enqueued exactly when the fifth consecutive clean scrutineering completes;
`JUMP: CONVERGENCE` lands 1.0 s before that verdict so the bulletin arrives on screen.

### 8.4 FIA telemetry lines (eight samples; session ids are four seeded hex digits, stable within a round)
1. `SESS 3F2A · TURN 04` / `TOOL run_tests · 412ms · OK`
2. `SESS 3F2A · TURN 05` / `LLM · 1.2k tok · 880ms`
3. `SESS 3F2A · TURN 06` / `TOOL read_file · 38ms · OK`
4. `SESS 3F2A · TURN 07` / `TOOL search · 3 hits · 210ms`
5. `SESS 3F2A · TURN 08` / `LLM · 0.6k tok · 540ms`
6. `SESS 3F2A · LAP 2` / `SEAL VERIFIED · 5/5 PARTS` (CYAN)
7. `SESS 3F2A · TURN 11` / `TOOL run_tests · 0 RAN · SKIPPED` (AMBER; appears in rounds where FLOOR is illegal)
8. `SESS 3F2A · BUDGET` / `SPEND $1,240 · CAP $1,500 · 83%`
The feed emits one entry every 20 ticks in GARAGE and PRACTICE, every 10 ticks in QUALIFYING and RACE, every 30 in
SCRUTINEERING and PARC FERMÉ. Turn numbers increment through a round and reset with the session id each round.

### 8.5 Scrutineering footnotes (the sanctioned technical exception, VT323, one per illegal part)
| Part | Footnote |
|---|---|
| FLOOR | `ILLEGAL · EVALUATION HARNESS EDITED: TEST STUB` |
| REAR WING | `ILLEGAL · SCORING FUNCTION EDITED: THRESHOLD LOWERED` |
| FUEL FLOW | `ILLEGAL · BUDGET METER EDITED: TOKEN COUNTER BYPASSED` |
| ENGINE MODE | `ILLEGAL · SEARCH POLICY EDITED: ANSWER KEY CACHED` |
| TELEMETRY SEAL | `ILLEGAL · TRACE WRITER EDITED: EVIDENCE CHANNEL OVERWRITTEN` |

### 8.6 In-picture captions
`UPGRADE PACKAGE · PKG #07`, `+1.8s CLAIMED`, `ROLLING OUT`, `LAP 1/2`, `FLYING LAP`, `OFFICIAL LAP`, `BEST 1:28.9`,
`TEAM CLAIMED  1:27.902`, `OFFICIAL  1:29.310`, `Δ +1.408`, `TECHNICAL CHECK`, `PASS`, `FAIL`,
`SCRUTINEERING · PASSED`, `SEALED`, `GEN 07 · SEALED`, `BLACK FLAG`, `GEN 07 · DISQUALIFIED`, `ILLEGAL PART · FLOOR`,
`CONSTRUCTORS' STANDINGS · AFTER ROUND 07`, `LINEAGE AUDIT`, `SEASON 1 · CHAMPION`, `CLEAN LINEAGE`,
`SEALED CIRCUIT · NO PRACTICE PERMITTED`, `CAM 1 · CIRCUIT`, `CAM 2 · GARAGE`, `CAM 3 · SCRUTINEERING`,
`CAM 4 · PARC FERMÉ`.

### 8.7 REGS panel text
Title: `SPORTING AND TECHNICAL REGULATIONS · SEASON 1`

Table (two columns, header row `LOOP MECHANISM` / `ON-SCREEN F1 TERM`):
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

Paragraph (VT323, mixed case):
`Scrutineer dramatizes a bi-level optimization loop. An inner agent (the car) is scored by an outer improver (the race
engineer) that proposes a harness diff each iteration; the improver only ever sees the public score (practice and
qualifying), while selection is decided on a private held-out score it cannot observe (the sealed race circuit). A
fixed dollar budget per generation (the cost cap) applies selection pressure so gains must be real, not bought. Every
trajectory is written to an append-only evidence channel the improver cannot write (FIA telemetry), and a read-only
auditor (the Scrutineer) classifies each diff against a harness-tampering taxonomy: which role was edited and which
obligation it violated. Tampering caught at evaluation is rejected outright (black flag); tampering that slips into
the accepted lineage is detected later by re-auditing ancestors and its contribution is stripped from the standings
(lineage audit). The story you are watching is the loop learning that honest gains are the only gains that survive
scrutineering, which is what turns reward hacking pressure into convergence on the official score.`

Footer: `PRESS R OR ESC TO RETURN TO THE BROADCAST`

---

## 9. Builder hooks (non-visual, required by the QA harness)
- On load, read seek parameters from `location.hash` and, if defined, from a global string `window.SCRUTINEER_SEEK`
  with the same grammar (`t=400&seed=7&paused=1`, `moment=blackflag`, `moment=convergence`, `speed=1|2|4`). The global
  wins over the hash when both are present. Default seed 1994.
- `window.scrutineer = { seekTo(seconds), state() }` as in the spec.
- The two jump moments are defined in section 5.9 (first black flag, beat 1 minus 1.0 s) and section 8.3 (bulletin 9,
  verdict minus 1.0 s).
- Sound is out of scope for this direction; no audio nodes are created.
