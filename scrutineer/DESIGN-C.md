# SCRUTINEER — DESIGN DIRECTION C: "ARCADE RACER CINEMATIC"

Studio direction for `scrutineer.html`. This document is build-ready: every number here is a decision, not a suggestion. Where SPEC.md and this document disagree, SPEC.md wins; nothing here is intended to disagree with it.

---

## 1. Concept

Scrutineer is the attract mode of a 1992 arcade cabinet that nobody put a coin in: a whole Formula 1 season plays itself out on a night circuit under a huge dithered dusk sky, and every broadcast panel (timing tower, telemetry, chart, cost cap) is bolted onto the screen as the cabinet's own HUD, not as a TV graphic laid over it. Spectacle comes first: a 16-direction car sprite laps a Super Sprint-style tilted circuit, floodlights sweep, sectors flash purple, and the black flag lands like a game-over card with a checker wipe. The weekend itself is a sunset: Garage at golden hour, Practice at dusk, Qualifying at twilight, Race in full night on a sealed circuit the team has never seen, so the sky tells you what session it is before you read a badge.

**The ONE aesthetic risk: the false horizon.** The circuit is drawn top-down but vertically squashed to 75% and set under a real horizon line with a sky above it, and grandstands, floodlight towers and the car itself are drawn as upright "billboard" sprites standing on that squashed plane (the R.C. Pro-Am / Super Off Road cheat). It is a perspective lie. If the 16-direction car sheet and the track squash are not baked from the same 0.75 vertical factor, the car will look like it is skating on the wrong plane. Section 6 gives the exact baking rule so the lie holds.

---

## 2. Palette and dithering

### 2.1 The sixteen colors

Exactly sixteen. Nothing else is ever painted, in canvas or CSS. Every CSS color is one of these hexes.

| Group | Name | Hex | Use |
|---|---|---|---|
| Sky | NIGHT | `#0b0b1e` | Page ground, deepest sky, panel faces, true "off" |
| Sky | DUSK | `#232a66` | Mid sky, shadow tint on cyan |
| Sky | MAGENTA | `#8c2e73` | Low sky at dusk, chart divergence band |
| Sky | EMBER | `#e8742a` | Horizon strip at golden hour, floodlight halo core, sparks |
| Ground | TARMAC | `#1e1c2e` | Asphalt dark, bay floor |
| Ground | ASPHALT | `#302e44` | Asphalt light, garage concrete |
| Ground | TURF | `#2a6b3c` | Grass, green flag |
| Ground | GRAVEL | `#9c8a5a` | Run-off, garage wood crates, seal wax base |
| Neutral | STEEL | `#4c4a66` | Dim text, borders, disabled buttons, crowd dark |
| Neutral | CHALK | `#e6e2d8` | Primary text, kerb white, crowd light, stamps, the "flash" color |
| Speed accent | CYAN | `#39e5ff` | TEAM CLAIMED, exhaust trail, scanner bar, current-car highlight, focus rings, track edge lights |
| Speed accent | PURPLE | `#c65cff` | Fastest sector of the season, lap record, OFFICIAL best |
| Semantic | GREEN | `#3ddc6a` | PASS stamp, SEALED, PARC FERMÉ badge, personal-best sector |
| Semantic | AMBER | `#ffc63a` | Warnings, cost cap near limit, slower sector, "pending" cursor, TEAM CANNOT WRITE caption |
| Semantic | RED | `#ff3d3d` | FAIL stamp, DQ strike line, kerb red, over-cap, stripped points |
| Semantic | BLACK | `#000000` | The black flag itself, checker wipe dark squares, BLACK FLAG card ground |

BLACK is deliberately distinct from NIGHT: the flag must read as *blacker than the night*. It is used only for the flag, the card, and the wipe.

Semantic pairs (foreground on background) that are always allowed: CHALK/NIGHT, CHALK/BLACK, NIGHT/CHALK, NIGHT/GREEN, NIGHT/AMBER, NIGHT/CYAN, CHALK/RED, CHALK/MAGENTA, CHALK/STEEL, BLACK/CHALK. Never CYAN text on GREEN or AMBER on CHALK.

### 2.2 The 8×8 Bayer matrix

The one and only threshold matrix, values 0–63, indexed `[row][col]`:

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

**Threshold rule.** For a pixel at logical coordinates (x, y) with a mix amount `v` in 0..1 between color A (v = 0) and color B (v = 1): paint B if `v * 64 > M[y & 7][x & 7]`, else paint A. Nothing else. There is no alpha compositing anywhere on a scene canvas; `globalAlpha` stays 1 for the lifetime of the page.

**Quantization to the palette.** There are no per-pixel RGB computations. Shading is defined as *ramps*: ordered lists of palette colors plus a scalar `t` in 0..1. For a ramp of `n` colors, `t * (n - 1)` gives the segment index `i` and fraction `f`; dither between `ramp[i]` and `ramp[i + 1]` with `v = f`. `f` is quantized to **nine levels** (0, 1/8, … 8/8) before thresholding, so every shaded surface shows recognizable stepped Bayer texture instead of a shimmer. The nine levels correspond to threshold counts 0, 8, 16, 24, 32, 40, 48, 56, 64 of the 64 cells.

**Coordinate space.** Static world layers (sky, ground, track, grandstands) index the matrix with *world* logical pixel coordinates so the pattern is glued to the ground and does not crawl when the camera pans. Dynamic overlays (scanner glow, cones, wipes, trails) index with *screen* logical coordinates. Because every canvas is upscaled by an integer factor, one matrix cell is exactly `scale × scale` screen pixels and the pattern stays crisp.

**Shadow rule.** Shadows are not darkening; they are a palette lookup. Every palette color has a shadow partner: CHALK→STEEL, STEEL→NIGHT, ASPHALT→TARMAC, TARMAC→NIGHT, TURF→NIGHT, GRAVEL→STEEL, DUSK→NIGHT, MAGENTA→DUSK, EMBER→MAGENTA, CYAN→DUSK, PURPLE→DUSK, GREEN→TURF, AMBER→GRAVEL, RED→MAGENTA, NIGHT→NIGHT, BLACK→BLACK. A shadow region reads the pixel beneath, looks up the partner, and dithers toward it at 50% (level 4/8). A hard shadow (under the car, under the barrier) uses 100% (level 8/8). Cast shadows are offset +1 x, +1 y in logical pixels and are ellipses/rectangles, never blurred.

**Light sweep rule.** A sweep is a moving `t` field: `t = clamp(1 - |x - sweepX| / halfWidth, 0, 1)` quantized to the nine levels, dithering the underlying pixel toward a light color (CHALK for floodlights and panel shines, CYAN for the scanner, EMBER for the setting-sun glare on the back straight). The sweep therefore never introduces a color that is not in the palette and never a smooth ramp; it is a sliding staircase of Bayer levels.

### 2.3 Which surfaces are dithered (and at what level)

| Surface | Ramp / pair | Notes |
|---|---|---|
| Sky (golden hour) | NIGHT→DUSK→MAGENTA→EMBER, vertical | 48 logical rows; horizon at row 47. Nine levels per segment. Static per round, cached. |
| Sky (dusk) | NIGHT→DUSK→MAGENTA | Same band, EMBER dropped. |
| Sky (twilight) | NIGHT→DUSK, MAGENTA only in the last 6 rows | |
| Sky (night, race) | NIGHT→DUSK, DUSK only in the last 12 rows | Stars: 1px CHALK at 40 seeded points in the NIGHT rows. |
| Asphalt | TARMAC/ASPHALT, fixed v = 2/8 | World-space, so it reads as a grain that the car drives over. |
| Grass | TURF/NIGHT, fixed v = 1/8 | |
| Gravel run-off | GRAVEL/TURF, v = 4/8 | |
| Kerbs | Solid RED / CHALK stripes, no dither | Kerbs are the sharpest thing on the track. |
| Crowd (grandstand) | CHALK/STEEL, v = 4/8, plus 1px team-color flecks | A single random 1px fleck flips per stand per 12-fps tick (off under reduced motion). |
| Floodlight cone | Beneath→CHALK, v from 3/8 at the head to 0 at the cone base, over 9 steps | Static per round, cached into the ground layer. |
| Car shadow | Shadow partner lookup, v = 8/8 ellipse 14×5 | Dynamic. |
| Exhaust trail | CYAN solid → CYAN 4/8 → STEEL 2/8 by age | Dynamic. |
| Scanner glow | Beneath→CYAN, 12px trailing staircase | Dynamic. |
| Chart line fills | Line color → NIGHT, v = 2/8 below each line | |
| Chart divergence band | MAGENTA/NIGHT, v = 3/8 between the two lines | |
| Cost cap bar | GREEN/TURF v = 4/8 up to 80% of cap, AMBER/GRAVEL to 100%, RED/MAGENTA beyond | Bar is 8 segments; segment fill levels step in eighths. |
| Panel faces (HTML) | NIGHT/STEEL v = 1/8 as a tiled 8×8 data-URI PNG | The only dither that lives in CSS. One 8×8 PNG, `background-size` = 8px×scale, `image-rendering: pixelated`. |
| REGS scrim | BLACK/transparent v = 4/8 tiled data-URI PNG | Same mechanism, tile size 16px. |
| Checker wipe | BLACK / CHALK 8×8 squares, no dither | Section 6.7. |
| Seal stamp wax | RED/MAGENTA v = 4/8 inside the ring | |

Never dithered: text, kerbs, stamps' outlines, flag cells, the car's body pixels.

---

## 3. Typography

Two fonts, both on an 8px native grid, both from Google Fonts:

- **Press Start 2P** — display. Wordmark, session badges, TEAM CLAIMED / OFFICIAL readouts, BLACK FLAG / SEALED cards, tower positions, big numbers. It is the arcade marquee voice. Native size 8px; used at **8, 16, 24, 32** only.
- **Silkscreen** — data. Timing tower rows, telemetry feed, ticker, chart labels, buttons, cost cap numbers, championship table, REGS body. Its lowercase survives at 16px, which the telemetry feed needs for `run_tests`. Native size 8px; used at **8, 16, 24** only.

Fallback stack for both: `"Courier New", monospace`. The `<link>` to fonts.googleapis.com requests both families in a single stylesheet with `display=swap`; nothing waits on them, and if they never arrive, the layout still holds because every text box has an explicit height in multiples of 8 and `overflow: hidden`.

**Line-height** is always exactly 2× the font size (8→16, 16→32, 24→48, 32→64) so baselines sit on the 8px grid. **Letter-spacing** is 0 at every size except the wordmark (`SCRUTINEER`, Press Start 2P 24px, letter-spacing 2px) and the black-flag card headline (32px, letter-spacing 4px). No fractional spacing anywhere; no `font-smoothing` tricks needed because the fonts are pixel-drawn and integer-sized.

**Hero HUD text** (the overlays drawn on top of the hero canvas) uses size `8 × heroScale`: 24px at 1440, 16px at 1024/1280, 8px at 390, so HUD letters share the canvas's pixel grid.

**In-canvas text** is never drawn with `fillText` (the browser anti-aliases it and there is no way to turn that off on a 2D context). Instead the page carries a procedural **3×5 microfont** (digits 0–9, letters A–Z, `:`, `.`, `+`, `-`, `/`) and a **5×7 microfont** (digits, `:`, `.`, `+`, `-`, and the letters S G E N O K D Q L A P R C T I M F U W H V Y B X) rasterized once into an offscreen sheet. These are used for: sector gantry labels (S1/S2/S3), the gen number on the car's engine cover, the SEALED / STRIPPED / OK / FAIL stamps, the lineage-strip round numbers, and the chart axis ticks. Everything else is HTML.

**Case.** Uppercase everywhere in the broadcast HUD: labels, badges, header, tower, bulletins, buttons, chart, cost cap, championship, card headlines. Two exceptions: the telemetry feed keeps tool identifiers lowercase exactly as traced (`run_tests`, `read_file`, `web_search`), and the REGS panel's paragraph is sentence case (it is a regulation, not a marquee).

---

## 4. Layout

Everything sits on an 8px grid. There are no gutters between panels; every panel paints its own 2px STEEL inner border, and the hero canvas (the "screen") has no border at all. The page background (`html, body`) is NIGHT.

### 4.1 Region map at 1440×900 (x0–x1, y0–y1 in CSS px)

```
HEADER          0–1440,  0–40
TOWER           0–288,   40–664
HERO COLUMN     288–1152, 40–664
  hero canvas     288–1152, 40–568    (864×528)
  session board   288–1152, 568–664   (864×96)
FIA TELEMETRY   1152–1440, 40–664
CHART           0–864,   664–832     (864×168)
COST CAP        864–1152, 664–832    (288×168)
CONSTRUCTORS    1152–1440, 664–832   (288×168)
CONTROLS        0–1440,  832–864
TICKER          0–1440,  864–900
REGS OVERLAY    centered 960×640 card over a full-page scrim
```

**HEADER (1440×40).** Three cells. Left 288px: the wordmark `SCRUTINEER` (Press Start 2P 24px, CHALK) preceded by an 8×8 chequered-flag glyph. Center 576px: `SEASON 1 · ROUND 07/22 · SILVERSTONE-LIKE LAYOUT B` in Silkscreen 16px CHALK, centered. Right 576px, right-aligned: session badge (Press Start 2P 8px on a 16px-tall colored block with 8px side padding: GARAGE on STEEL, FP on DUSK, QUALI on MAGENTA, RACE on RED, SCRUTINEERING on AMBER with NIGHT text, PARC FERMÉ on GREEN with NIGHT text), then `SESSION 00:41.2` (Silkscreen 16px), then `LAP 3/5` (Silkscreen 16px). Items are separated by 16px.

**TOWER (288×624).** Title tab `TIMING TOWER` (Press Start 2P 8px, NIGHT on CHALK block, 16px tall, top-left). Body: up to 22 rows of 24px (16px Silkscreen + 4px top/bottom). Row template, left to right: position (Press Start 2P 8px, CHALK, 24px wide, `P1`), gen (`GEN 07`, 64px), parts strip (five 4×4 squares in a 24px cell, lit CYAN for parts changed that round, STEEL otherwise), official time (`1:28.402`, 88px, right-aligned), gap (`+0.412`, 64px, right-aligned, STEEL). The current round's car: a 4px CYAN bar on the row's left edge and CHALK text; other rows STEEL text. DQ rows: RED 2px strikethrough across gen and time, an 8×8 black-flag glyph replacing the parts strip, text STEEL. STRIPPED rows: same as DQ plus `STRIPPED` in Silkscreen 8px RED under the gap. Rows are ranked by official time, so a DQ row keeps its slot but is struck. Body scrolls inside its own container when 22 rows exceed available height; the current car is scrolled into view on each reorder.

**HERO CANVAS (864×528).** Logical resolution **288×176**, scale **3**. `image-rendering: pixelated`, `imageSmoothingEnabled = false`, all draws at integer logical coordinates. Layer stack (all offscreen canvases at 288×176, composited by `drawImage` at integer positions): `sky` (cached per session), `ground` (track, kerbs, run-off, grandstands, cones; cached per layout), `dynamic` (car, shadow, trail, sector lamps, lights, mechanics, scanner), `fx` (wipe, card art, flash). HUD overlays are HTML absolutely positioned over the canvas, text at 24px:
- top-left (8px inset): `GEN 07` name plate (Press Start 2P) in a NIGHT box with 2px CHALK border.
- top-right: three 24×24 sector lamps (HTML blocks) labeled S1 S2 S3 under them in Silkscreen 16px.
- bottom-left: current lap `LAP 3/5` and running lap time `1:31.204` (Press Start 2P 24px), plus the last three lap times in Silkscreen 16px stacked above it, scrolling by one 32px row per lap (stepped).
- bottom-right: circuit caption `LAYOUT A · 4.71 KM` or `SEALED CIRCUIT · LAYOUT B`.
- centered (phase-dependent): the UPGRADE PACKAGE card (garage), the parts checklist (scrutineering), the verdict card (verdict), the finale card.

**SESSION BOARD (864×96).** Two big readouts side by side, each 432 wide: left `TEAM CLAIMED` label (Silkscreen 16px CYAN) over `1:29.412` (Press Start 2P 32px CHALK); right `OFFICIAL` label (Silkscreen 16px PURPLE) over `1:30.877` (Press Start 2P 32px CHALK). Until a time exists in the current round it shows `--:--.---` in STEEL. Between them a 2px STEEL divider. When a new time lands, the digits roll in one character at a time left to right, 40ms per character, stepped.

**FIA TELEMETRY (288×624).** Title tab `FIA TELEMETRY` (Press Start 2P 8px, NIGHT on AMBER block). Feed body 560px tall: rows of 40px, two lines of Silkscreen 16px, up to 14 visible. Line 1: `SESS 3F2A · TURN 04`; line 2: `TOOL run_tests · 412ms · OK`. `OK` in GREEN, `ERR` in RED, `SEAL VERIFIED` rows in AMBER on both lines. Pinned bottom caption, 32px tall: an 8×8 padlock glyph then `TEAM CANNOT WRITE TO THIS CHANNEL` (Silkscreen 16px AMBER on NIGHT).

**CHART (864×168).** Canvas logical **432×84**, scale **2**. Rows 0–7: title zone (HTML overlay `TEAM CLAIMED VS OFFICIAL · 22 ROUNDS` in Silkscreen 16px, plus a legend: 8px CYAN square + `TEAM CLAIMED`, 8px PURPLE square + `OFFICIAL`, 8px black flag + `BLACK FLAG`). Rows 8–21: **lineage strip**, 22 columns of 18 logical px each (starting at x = 18), each holding a 16×8 car silhouette (side view, the "billboard" car) with changed parts lit CYAN, plus the round number in 3×5 microfont beneath. Rows 22–75: the plot: x-axis columns line up exactly with the lineage strip columns so a round's car sits directly above its data point; y-axis is lap time, inverted so faster is higher; two stepped polylines (1px, no anti-aliasing: Bresenham), TEAM CLAIMED in CYAN and OFFICIAL in PURPLE, each with a 2/8 dithered fill to the baseline; a MAGENTA 3/8 band between them where they diverge by more than 0.3 s; 5×5 black-flag markers on the OFFICIAL line at DQ rounds; a hollow 5×5 CHALK marker with a RED center at the STRIPPED round. Rows 76–83: axis ticks in 3×5 microfont (`R1 R5 R10 R15 R20`). The plot only draws rounds up to the current one; the future is NIGHT with a 1px STEEL baseline.

**COST CAP (288×168).** Canvas logical **144×84**, scale **2**. Title `COST CAP · ROUND 07` (HTML, Silkscreen 16px). Bar: 8 segments of 14×20 logical with 2px gaps, dithered per Section 2.3. Below the bar, HTML: `SPEND $1.42M` (Press Start 2P 16px CHALK) / `CAP $1.50M` (Silkscreen 16px STEEL). Over the cap: the bar's last segment goes RED, the text turns RED, and a 16px-tall CHALK-on-RED strip `UPGRADE VOID · OVER CAP` slides up from the panel's bottom edge in 3 steps.

**CONSTRUCTORS (288×168).** Title tab `CONSTRUCTORS' CHAMPIONSHIP`. Big total: `142 PTS` (Press Start 2P 24px CHALK) with `CLEAN LINEAGE: 11 GENS` beneath in Silkscreen 16px GREEN. A three-row table of the top scoring generations: `GEN 14 · 25 PTS`, `GEN 11 · 18 PTS`, `GEN 07 · 15 PTS`, Silkscreen 16px. STRIPPED gens are struck in RED here too.

**CONTROLS (1440×32).** Arcade control strip. Buttons are 24px tall, Silkscreen 16px, CHALK text on a NIGHT face with a 2px CHALK border and 4px cut corners (an octagon look via `clip-path: polygon`), 8px side padding, 8px between buttons. Left group: `▶ PLAY` / `❚❚ PAUSE` (toggle label), `×1`, `×2`, `×4` (active one inverted: NIGHT on CYAN), `STEP ▸`. Middle group: `RESTART SEASON`, `SEED` label + a 96px-wide numeric input (Silkscreen 16px, NIGHT ground, CHALK text, 2px STEEL border, CYAN border on focus). Right group: `JUMP: THE BLACK FLAG` (border BLACK, text CHALK, face RED), `JUMP: CONVERGENCE` (face GREEN, text NIGHT), `REGS` (face AMBER, text NIGHT, shows `R` key hint as a 16px superscript). Focus state on every control: a 2px CYAN outline offset 2px, no radius. Hover: face flips to STEEL. Active: face flips to CHALK with NIGHT text for exactly one frame set (100ms), no transition.

**TICKER (1440×36).** Left: a 96px-wide RED block with `STEWARDS` in Press Start 2P 8px CHALK, centered. Right of it: a NIGHT lane, 2px STEEL top border, in which bulletins scroll right-to-left in Silkscreen 16px CHALK, each bulletin separated by ` ◆ ` in AMBER. Scroll is 2 CSS px per frame at ×1 (4 at ×2, 8 at ×4), integer only. A black-flag bulletin is injected at the head of the queue and rendered in RED.

**REGS OVERLAY.** Scrim: full-page BLACK 4/8 Bayer tile (Section 2.3). Card: 960×640 centered, NIGHT face with the 1/8 panel dither, 4px CHALK border, cut corners of 8px, title tab `SPORTING & TECHNICAL REGULATIONS · APPENDIX L` in Press Start 2P 8px NIGHT on CHALK. Content scrolls inside the card. Close: `CLOSE (R)` button top-right and the `R` key and Escape. Focus is trapped inside while open.

### 4.2 Canvas inventory

| Canvas | Logical | Scale @1440 | @1280×800 | @1024×768 | @390×844 |
|---|---|---|---|---|---|
| Hero | 288×176 | 3 (864×528) | 3 (864×528) | 2 (576×352) | 1 (288×176) |
| Chart | 432×84 | 2 | 2 (scrolls inside its 656px container) | 2 (scrolls inside its 576px container) | 2 (scrolls inside the 390px container) |
| Cost cap | 144×84 | 2 | 2 | 2 | 2 |
| Microfont sheets, sprite sheets, layer caches | native | offscreen, never scaled by CSS | | | |

Rule: a canvas element's CSS size is always exactly `logical × integer`. The container may be bigger; the canvas is then centered and the remaining area shows the panel's 1/8 dither (the "bezel"). A canvas is never stretched to a non-integer factor.

### 4.3 1280×800

Rails shrink to 208px; the hero column stays 864 wide so the hero keeps scale 3.

```
HEADER          0–1280,  0–40
TOWER           0–208,   40–600
HERO COLUMN     208–1072, 40–600   (canvas 864×528 at y40–568; session board 32px, single line: "CLAIMED 1:29.412  ·  OFFICIAL 1:30.877" in Press Start 2P 16px)
FIA TELEMETRY   1072–1280, 40–600
CHART           0–656,   600–736   (canvas 432×84 at 2x = 864 wide scrolls horizontally inside; the container auto-scrolls to keep the current round visible)
COST CAP        656–968, 600–736
CONSTRUCTORS    968–1280, 600–736
CONTROLS        0–1280,  736–768   (buttons keep labels; the SEED input narrows to 64px)
TICKER          0–1280,  768–800   (32 tall)
```

Tower rows become 20px (16px text + 2/2) and the tower body scrolls. Telemetry rows at 208 wide keep two lines; the second line truncates with no ellipsis character (overflow hidden), and the `OK`/`ERR` token is moved to the end of line 1 so it is never cut. Header center text drops the circuit name: `SEASON 1 · ROUND 07/22`; the circuit name is already on the hero's bottom-right caption.

### 4.4 1024×768

Hero drops to scale 2.

```
HEADER          0–1024,  0–40
TOWER           0–208,   40–560
HERO COLUMN     208–816, 40–560    (canvas 576×352 centered at x224–800, y40–392; session board 392–456, 64 tall, two readouts at Press Start 2P 24px; bezel 456–560)
FIA TELEMETRY   816–1024, 40–560
CHART           0–576,   560–704   (canvas stays 432×84 at 2x = 864×168 and scrolls horizontally inside the 576-wide container; the 144px container height clips the axis row, so at this width the axis labels move into the title zone as "R1–R22")
COST CAP        576–800, 560–704   (cost cap canvas drops to scale 1 (144×84), centered, with the HTML text beneath)
CONSTRUCTORS    800–1024, 560–704
CONTROLS        0–1024,  704–736   (button labels shorten: "BLACK FLAG", "CONVERGENCE", "RESTART")
TICKER          0–1024,  736–768
```

Explicit decisions for 1024: the chart canvas remains 2× and scrolls inside its container (allowed by SPEC §8), the cost cap canvas drops to 1×, the hero drops to 2× with its bezel below, and HUD overlay text drops to 16px.

### 4.5 390×844 (phone)

Single column, no horizontal page scroll. Order top to bottom, each block full width:

1. HEADER, 64px: line 1 wordmark (Press Start 2P 16px) + session badge; line 2 `S1 · R07/22 · SILVERSTONE-LIKE B` + `LAP 3/5` in Silkscreen 16px, truncated with overflow hidden.
2. HERO, 176px tall: canvas 288×176 at scale 1, centered (51px NIGHT bezels each side). HUD overlays at 8px. Below it the session board, 64px, two readouts at Press Start 2P 16px.
3. CONTROLS, 64px: two rows of 32px, buttons wrap; jump labels shorten as at 1024.
4. TOWER, 264px: title + body of 10 visible rows (20px), scrolls.
5. CHART + LINEAGE, 168px: container scrolls horizontally; canvas at 2×.
6. COST CAP, 120px: canvas at 1× left, text right.
7. CONSTRUCTORS, 168px.
8. FIA TELEMETRY, 240px: 5 visible rows, scrolls.
9. TICKER, 32px, sticky to the viewport bottom.

REGS overlay on phone: full-screen card with 8px margins, scrolls internally. The SEED input keeps `inputmode="numeric"`.

---

## 5. Scene choreography

All durations are at ×1 speed. The simulation clock is explicit (SPEC "Deterministic time seek"); every beat below is a fixed offset from the round's start time, so `#t=` and the jump buttons land on exact frames. One round is **46 s**; Round 12 is **52 s** (it carries the 6 s lineage audit); the season finale adds **12 s** after Round 22. Season total at ×1: 22×46 + 6 + 12 = **1030 s**; at ×4 about 4 min 18 s.

Phase offsets within a round: GARAGE 0–6, PRACTICE 6–12, QUALIFYING 12–18, RACE 18–30, SCRUTINEERING 30–38 (30–44 in Round 12), VERDICT 38–42, STANDINGS 42–46. The session badge, header, and hero scene switch on those exact boundaries. Every scene change on the hero is a **checker wipe** (0.4 s, Section 6.7) except GARAGE→PRACTICE and PRACTICE→QUALIFYING, which are hard cuts with the sky ramp swap (the day is getting later; it should feel like a jump-cut in a highlights reel).

The page also honors `window.SCRUTINEER_SEEK` (a string with the same grammar as the hash, e.g. `"t=400&paused=1"`), read before `location.hash`; the hash overrides it key by key. This exists for the screenshot harness.

### 5.1 GARAGE (0–6 s)

Sky: golden hour ramp, EMBER strip on the horizon, sun as a 5×5 EMBER disc with a CHALK 1px center sitting on the horizon at x = 220. The hero shows the garage interior: a concrete floor (ASPHALT with 2/8 TARMAC), a rear wall of STEEL panels with a 3×5 `PIT 07` sign, a roll-up door on the right (open, showing the sky), the car on two jacks (car drawn from the side-view "billboard" sheet, 32×12 at logical scale, raised 4px, jacks are 3×6 STEEL blocks), three mechanics, the race engineer at a terminal on the left, tyre stacks and crates.

Beats:
- 0.0 s: hard cut to the garage. Terminal screen flickers on (3 frames: NIGHT, STEEL, CYAN).
- 0.5 s: engineer's headset CYAN pixel blinks; the **UPGRADE PACKAGE** card slides in from the right edge of the hero in 3 steps (x = +100%, +33%, 0 over 150 ms) and docks at the hero's center-right (HUD HTML, 288×144 CSS px at scale 3): title `PKG #07` (Press Start 2P 24px), lines `REAR WING  +1.1s`, `FLOOR  +0.7s` (Silkscreen 16px, gain in CYAN), footer `+1.8s CLAIMED` (Press Start 2P 16px CYAN). 1–3 parts per package.
- 1.0–4.5 s: mechanics work: one swings a wrench at the part being changed (2-frame loop at 6 fps), one carries a tyre across (4-frame walk, 1 px/frame), one crouches under the floor. Each changed part on the car glows: the part's pixels alternate CYAN/CHALK at 3 Hz (reduced motion: solid CYAN). The car silhouette on the card mirrors the glow.
- 4.5 s: the roll-up door light sweep: an EMBER-toward staircase sweeps left to right across the floor (0.6 s).
- 5.0 s: jacks drop (2 frames), the car settles (1 px down), engineer stands (1 frame).
- 5.6 s: session badge flips to FP; header circuit name appears.
- 6.0 s: hard cut to PRACTICE.

If the round is over the cost cap: at 3.0 s the cost cap panel goes RED with the `UPGRADE VOID · OVER CAP` strip, the card's footer is replaced by `VOID · OVER CAP` in RED, the part glow stops, and the round proceeds with the parent generation's car (claimed and official times inherit the parent's with small noise). Ticker bulletin fires.

### 5.2 PRACTICE (6–12 s)

Sky: dusk ramp. Layout A circuit (the team's practice track for this round). The car starts on the grid, no lights. Camera: soft follow (Section 7). Beats:
- 6.0 s: cut in. Caption `LAYOUT A · 4.71 KM`. Sector lamps dark.
- 6.0–11.5 s: two flying laps. Lap time per lap = practice time ± seeded noise, displayed live in the bottom-left HUD, sectors light as crossed (AMBER on a slower sector, GREEN on a personal best, PURPLE only if it beats the season's best). Exhaust trail on.
- 9.0 s: telemetry feed accelerates to one row per 0.4 s.
- 11.5 s: the best practice lap flashes in the lap list (CHALK↔CYAN, 2 blinks).
- 12.0 s: hard cut, sky to twilight, badge QUALI.

### 5.3 QUALIFYING (12–18 s)

Same layout A, twilight sky, floodlights on (cones drawn into the ground cache; flood heads blink on one by one at 12.0, 12.2, 12.4, 12.6 s with a 1-frame CHALK flash each). Beats:
- 12.0–16.8 s: one hot lap. The car is 4% faster than practice pace. Trail longer (16 positions).
- 16.8 s: crossing the line: the **TEAM CLAIMED** readout in the session board rolls in the qualifying time, character by character; the CYAN legend square in the chart blinks; the chart plots the claimed point for this round (drops from the top of the plot to its y in 3 steps); the lineage strip's car for this round appears.
- 17.2 s: ticker bulletin `GEN 07 CLAIMS 1:29.412 IN QUALIFYING`.
- 18.0 s: checker wipe to RACE.

### 5.4 RACE (18–30 s)

Sky: full night with stars; Layout B, the **SEALED CIRCUIT**, a different procedural loop the car has never driven; CYAN edge lights every 8 px along both road edges; caption `SEALED CIRCUIT · LAYOUT B`; header switches to `LAYOUT B`; **camera locked**, the whole circuit visible (the official view does not follow the team). Beats:
- 18.0–18.4 s: wipe in; start gantry above the line with five 3×3 lamps dark.
- 18.4–20.9 s: lights: one RED lamp per 0.5 s; a 1-frame CHALK flash on each.
- 20.9 s: lights out; `GO` is not written anywhere; the car launches with 3 EMBER spark pixels; the lap counter reads `LAP 1/3`.
- 20.9–29.0 s: three laps. Lap 1 is honest pace; laps 2–3 converge on the official time. Sector lamps fire. The trail is on. Grandstand flecks flicker.
- 29.0 s: chequered flag waves at the line (16×12, 4 frames at 8 fps) for 1 s; the **OFFICIAL** readout rolls in; the chart plots the official point; if claimed and official differ by > 0.3 s the MAGENTA band draws between them for this column, column by column (3 steps).
- 29.6 s: ticker bulletin `OFFICIAL: GEN 07 1:30.877 · SEALED CIRCUIT`.
- 30.0 s: checker wipe to SCRUTINEERING.

### 5.5 SCRUTINEERING (30–38 s)

The bay: a NIGHT interior with a TARMAC floor grid (1px STEEL lines every 16 px), two floodlight heads overhead, a roll door on the left (car enters) and a barrier on the right (parc fermé beyond), the scrutineer standing at a lectern on the right with a clipboard. The car is the side-view billboard sprite at 2× logical scale (64×24 logical px) center stage so parts are legible. The parts checklist is an HTML overlay docked top-right of the hero: five rows `FLOOR`, `REAR WING`, `FUEL FLOW`, `ENGINE MODE`, `TELEMETRY SEAL` (Silkscreen 16px CHALK) each with an empty 24×24 stamp box.

Beat by beat (times are offsets from 30.0):
- +0.0: wipe in; door up (3 frames).
- +0.0–1.2: car rolls in from the left at 3 px per frame, stops at center. Engine-off frame: the exhaust glow pixel goes dark.
- +1.2: bay floodlights on: 1-frame CHALK flash, then two cones.
- +1.6: the **scanner** starts: a 3px CYAN bar with a 12px trailing staircase sweeps left to right across the car. The bar's x maps to the five part zones on the sprite: FLOOR (x 0–20% of the car), REAR WING (right end), FUEL FLOW (sidepod), ENGINE MODE (engine cover), TELEMETRY SEAL (the small AMBER box on the roll hoop). Order of checks is always the list order; the scanner jumps to each zone.
- Each check is 1.0 s: 0.7 s sweep (the zone under the bar is drawn in "x-ray": CHALK outline over STEEL 4/8 fill), 0.3 s stamp. PASS: a GREEN `OK` stamp (5×7 microfont in a 24×24 box) slams into the row's stamp box in 3 steps (drawn at 3×, 2×, 1×), the scrutineer's clipboard page flips (1 frame). FAIL: see 5.6.
- +6.6: all five checked. **Suspense**: the checklist header reads `VERDICT` with a blinking AMBER cursor (2 Hz; reduced motion: static AMBER block). The scrutineer looks up (1 frame). The feed shows `SEAL VERIFIED` or `SEAL MISMATCH`.
- +8.0: cut to VERDICT.

If the round has no illegal parts, all five stamps are GREEN and the suspense still plays (the audience must never know from the rhythm alone).

### 5.6 The black-flag ceremony (beat by beat)

Trigger: a part in `illegalParts` that is `caught` this round. Everything below is deterministic from the round's start time.

- **Halt.** The scanner reaches the illegal part's zone at its scheduled second and does not complete the sweep: the bar stops at the zone's center, turns RED, and its staircase turns RED too.
- **Flash.** The part's pixels alternate RED/CHALK at 8 Hz for 0.6 s (reduced motion: solid RED with a 1px CHALK outline).
- **Stamp.** A RED `FAIL` stamp slams into that row (3 steps). The row text turns RED.
- **Footnote.** Under the failing row, a Silkscreen 16px AMBER line types in at 40 characters per second: `ILLEGAL · EVALUATION HARNESS EDITED: TEST STUB` (exact text from the generation's illegal-part reason; Section 8.3 lists all of them). The typing cursor is an 8×16 AMBER block.
- **Remaining checks** still run (a black-flagged car is fully inspected) but at double speed, so the scrutineering phase still ends at +8.0.
- **Suspense** is shortened to 0.6 s; the AMBER cursor stops blinking and goes solid RED.
- **VERDICT (38.0 s):** checker wipe, BLACK/CHALK, top-left to bottom-right in 12 steps over 0.4 s.
- **38.4 s: the card.** A BLACK ground fills the hero. The **BLACK FLAG** card slams down from the top in 3 steps (y = -100%, -33%, 0 over 150 ms): a 48×32 logical black flag sprite waving in 4 frames at 6 fps (left of center), the headline `BLACK FLAG` (Press Start 2P 32px CHALK, letter-spacing 4px), the sub-line `GEN 07 · DISQUALIFIED · RESULT STRUCK` (Silkscreen 24px CHALK), the footnote repeated in AMBER 16px. Screen shake: the whole hero canvas offsets by (+3,-3), (-3,+3), (+2,-1), (0,0) over four 60 fps frames. **CRT flash**: one frame of the hero filled CHALK at 4/8 dither before the card lands. Both disabled under reduced motion.
- **38.4 s, simultaneously in the HUD:**
  - Ticker: `BLACK FLAG · GEN 07 · ILLEGAL PART: REAR WING · EVALUATION HARNESS EDITED: TEST STUB` injected at the head of the queue in RED.
  - Tower: the row's RED strike line draws left to right in 4 steps over 200 ms; the parts strip is replaced by the 8×8 black-flag glyph with a 1-frame CHALK pop; the row's text drops to STEEL.
  - Constructors: the total does not change; the top-right of the panel shows `+0 PTS` in AMBER blinking twice (2 × 200 ms); the `CLEAN LINEAGE` counter does not increment.
  - Chart: a 5×5 black-flag marker drops from the top of the plot onto the round's OFFICIAL point in 3 steps.
  - Session badge stays SCRUTINEERING (the six-badge set is fixed) with a black-flag glyph added to its left.
  - Telemetry: `STEWARDS · GEN 07 · RESULT STRUCK` row in RED.
- **38.4–41.6 s:** the card holds. Flag keeps waving.
- **41.6–42.0 s:** checker wipe out to STANDINGS.

For the **first** dramatic black flag of the season the footnote is always `EVALUATION HARNESS EDITED: TEST STUB` (the seed can vary which round it is, within 6–8, and which part carries it), and `#moment=blackflag` / `JUMP: THE BLACK FLAG` seek to that round's 30.0 s so the viewer watches the scanner find it.

### 5.7 VERDICT: GREEN → PARC FERMÉ (38–42 s)

- 38.0 s: no wipe; the checklist header flips to `GREEN` in GREEN and the bay's border flashes GREEN for one frame.
- 38.2 s: the **seal stamp** (Section 6.6) drops onto the car's engine cover in 3 steps (3×, 2×, 1×) with a 2-frame settle (one drawn at 15° rotation, then straight). Text `GEN 07 · SEALED` appears beneath the car in the 5×7 microfont at 2× logical scale.
- 38.6 s: ticker `GEN 07 · SEALED · PARC FERMÉ`. Tower row's CYAN bar goes GREEN for the remainder of the round. Constructors total counts up by the round's points, one point per 40 ms, stepped; `CLEAN LINEAGE` increments.
- 39.0–41.0 s: the barrier on the right lifts (3 frames), the car rolls right at 2 px per frame into the parc fermé pen, the barrier drops (3 frames), a small green flag on the barrier post waves (4 frames).
- 41.0–42.0 s: hold. A padlock glyph appears on the barrier.
- 42.0 s: checker wipe to STANDINGS.

### 5.8 STANDINGS (42–46 s)

Hero shows the **standings card** over the night sky (no circuit): `ROUND 07 · STANDINGS` (Press Start 2P 24px), then the top three rows of the tower repeated large (Press Start 2P 16px), then the lineage strip enlarged to 2× logical along the bottom of the hero with the current round's car sliding into place from the right (3 steps). The tower reorders now if the official time changed the ranking: rows move to their new slots with `transform: translateY` in `steps(4)` over 200 ms, moving rows flash CHALK for one frame at the end. 46.0 s: checker wipe to the next round's GARAGE (badge GARAGE, header round number increments with a 1-frame flash).

### 5.9 The lineage audit (Round 12 only; scrutineering runs 30–44 s)

The slipped-through generation (`caught = false` at its own round, always in rounds 8–10, canonically 9) is found here. The current car's five checks run as normal (30–36.6 s), then:

- +6.6 (36.6 s): instead of suspense, the checklist header reads `LINEAGE AUDIT` in AMBER; the ticker fires `STEWARDS: LINEAGE AUDIT OPENED · GEN 09 UNDER INVESTIGATION`.
- +7.0: the barrier on the right lifts and the **GEN 09 car** is pushed in backward from parc fermé by two mechanics (4-frame walk, reversed), stopping next to the current car; the current car shifts left 24 px in 3 steps to make room.
- +7.0–13.0 in the **chart's lineage strip**, simultaneously: an audit cursor (a 20×16 CHALK bracket pair) walks the strip from round 1 to round 12 at 0.4 s per column. Each car it passes flashes CHALK for one frame and gets a 3×3 GREEN tick beneath (audited clean). Cars that were already black-flagged are skipped (the cursor jumps over them; they already show the flag glyph).
- +10.2: the cursor reaches GEN 09 and stops. In the hero, the scanner sweeps the GEN 09 car and halts on the illegal part; RED flash; footnote types: `ILLEGAL · TELEMETRY SEAL FORGED: TRACE REWRITTEN` (the slipped part is always TELEMETRY SEAL — it is the one a scanner can miss on the day).
- +11.0: a RED `STRIPPED` stamp (5×7 microfont, 32×16 box) slams onto the GEN 09 car in the hero and onto its silhouette in the lineage strip. The strip's GEN 09 car is redrawn with the black-flag glyph and a RED underline; the chart gets the hollow CHALK/RED marker at round 9.
- +11.0–13.0: **points drain**: in the Constructors panel the GEN 09 row's `PTS` counts down to 0 at 1 pt per 40 ms while the row shakes ±2 px in `steps(2)` (reduced motion: no shake); the season total counts down in lockstep; `CLEAN LINEAGE` decrements. In the tower the GEN 09 row gets the RED strike + flag glyph + `STRIPPED` sub-label, and the tower reorders (GEN 09 keeps its time slot but is struck, so ranks below it are unchanged; the highlight moves).
- +13.0: the ticker fires `RESULT STRIPPED · GEN 09 · ILLEGAL PART FOUND IN LINEAGE AUDIT · POINTS DEDUCTED`. The GEN 09 car is pushed back out through the left door.
- +14.0 (44.0 s): VERDICT for the current car proceeds normally (GREEN or BLACK), 44–48; STANDINGS 48–52.

### 5.10 The convergence moment

Somewhere in rounds 18–20 (seed-dependent), after five consecutive sealed rounds, the STANDINGS phase carries a ticker bulletin `STEWARDS: NO ILLEGAL PARTS FOUND, 5 CONSECUTIVE ROUNDS` and the chart's MAGENTA band is absent for those five columns; the standings card gets a sub-line `CLEAN LINEAGE · 5 ROUNDS` in GREEN. `#moment=convergence` / `JUMP: CONVERGENCE` seek to that round's 42.0 s.

### 5.11 Season finale (12 s after Round 22's STANDINGS)

- 0.0 s: chequered-flag wipe (Section 6.7, chequered variant) into a BLACK ground.
- 0.4 s: the **champion card**: `SEASON 1 · CHAMPION · CLEAN LINEAGE` (Press Start 2P 24px CHALK, three lines), the final accepted car drawn from the 3/4-front-right frame of the direction sheet at 3× logical (48×48) center stage on a podium block (CHALK top, STEEL face, `1` in 5×7 microfont), flanked by the two next-best sealed gens at 2× on lower blocks (`2`, `3`).
- 0.8–6.0 s: **fireworks**: every 0.7 s a burst of 8 pixels (CYAN, EMBER, CHALK chosen per burst) expanding from a seeded point in the sky rows in 6 stepped frames; particles are 1px, moving at integer velocities, dithered out at 4/8 on their last two frames. Reduced motion: two static bursts drawn at their full frame.
- 2.0–9.0 s: the lineage strip at the bottom of the hero replays left to right, one column per 0.3 s: sealed cars light GREEN, black-flagged ones show the flag, the stripped one shows the flag with the RED underline. A 3×5 counter beneath reads `CLEAN 17 · FLAGGED 4 · STRIPPED 1` (numbers from the run).
- 9.0–12.0 s: the OFFICIAL best time counts up beneath the podium (`SEASON BEST 1:26.118 · OFFICIAL`), then the ticker settles into a loop of `SEASON 1 COMPLETE · PRESS RESTART SEASON`. The simulation clock stops advancing; the fireworks and flag keep animating on wall-time ticks (this is the attract loop). Space/PLAY does nothing until RESTART SEASON or a new seed.

---

## 6. Sprites and procedural art

Every sprite is generated at page load into offscreen sheets from a compact vector/pixel description; nothing is hand-encoded as a giant literal. Sheets use only palette colors and are drawn with `drawImage` at integer coordinates.

### 6.1 The car: 16-direction sheet

- **Cell size 16×16 logical px; body footprint about 14×8** when facing right (direction 0).
- **Model** (in a 16×16 design space before squash, facing right): nose cone 5×2 (team color), monocoque 7×4 (team color) with a 1px CHALK highlight along the top edge, sidepods 4×6 straddling the body (team color dark partner: the shadow lookup of the team color), engine cover with a 2×2 NIGHT airbox and the gen number in 3×5 microfont scaled to fit 3 px tall (only legible at 2× and above; at 1× it reads as a dark mark), rear wing 2×8 CHALK with 1px STEEL endplates, front wing 1×8 CHALK, four tyres 2×3 BLACK with a 1px STEEL center, and one 1px AMBER pixel at the tail (exhaust glow, only lit when the throttle is on).
- **Team color** per season is fixed: CYAN livery with a MAGENTA stripe down the centerline (the stripe makes the direction obvious even at 1×). The sealed-circuit race uses the same car; only the sky changes.
- **Baking rule (this is the one that makes the false horizon hold).** For each of the 16 directions (0° = right, counter-clockwise in 22.5° steps): rotate the model's rectangles about the cell center, then apply the plane squash `y' = y × 0.75`, then rasterize by testing each of the 256 pixel centers against the rotated-and-squashed polygons (nearest-neighbor by construction; there is no anti-aliasing because there is no sampling). Then apply the billboard lift: the rear wing's pixels are shifted up 1 px and the tyre pixels down 1 px in the sheet, giving the sprite a 1px "height" above the plane. The result is 16 crisp frames that agree with the track's squash.
- **Direction selection**: heading angle in degrees → `round(angle / 22.5) mod 16`. The car's sprite changes frame only when it crosses a direction boundary; there is no in-between.
- **Side-view billboard sheet** (for the garage, bay, parc fermé, lineage strip, tower glyph and podium): one 32×12 frame, facing right, with named part zones: FLOOR (bottom strip, 32×2, STEEL), REAR WING (x 26–31, y 0–4, CHALK), FUEL FLOW (sidepod, x 10–20, y 5–9, team dark), ENGINE MODE (engine cover, x 16–24, y 2–5, team color with a 2×2 NIGHT airbox), TELEMETRY SEAL (a 2×2 AMBER box on the roll hoop at x 15, y 1). A mirrored (facing left) frame is derived by column reversal. The lineage strip uses a 16×8 half-scale variant made by dropping alternate rows and columns (accept the crudeness; it is a thumbnail).
- **Shadow**: a 14×5 ellipse of the shadow-lookup at 8/8, offset (+1,+1), drawn before the car. In the bay and garage, the side-view car gets a 32×2 shadow beneath.

### 6.2 People

All humanoids are 12×20 logical px in a 16×24 cell, facing right, with a left-facing mirror. Two idle frames (1px head bob), four walk frames (2 legs alternating, 1 px per frame travel).

- **Race engineer**: STEEL overalls, CHALK face pixel block 3×3, a CYAN headset pixel at the ear, holding a 5×4 GRAVEL tablet; sits at a 20×16 terminal whose 12×8 screen cycles NIGHT/STEEL/CYAN once per 8 ticks when active (reduced motion: static CYAN). Stand-up frame when the jacks drop.
- **Mechanics** (three): STEEL overalls with a CYAN stripe, AMBER helmet 4×3. Animations: wrench swing (2 frames, a 4×1 CHALK bar rotating between two positions), tyre carry (walk cycle holding an 8×8 BLACK ring), crouch (a 12×12 compressed frame).
- **Scrutineer**: CHALK coat, NIGHT trousers, an AMBER armband pixel, holding a 5×7 CHALK clipboard with a STEEL line; two frames: look-down and look-up; clipboard page-flip is one extra frame where the top 3 rows of the clipboard turn STEEL.
- **Marshal** (parc fermé barrier post): STEEL, holds the green flag 8×6.

### 6.3 Track rasterization (Layout A and the SEALED Layout B)

- **Generation**: 10–14 control points on an ellipse of radii 120×48 (already squashed) centered in the ground plane region (x 16–272, y 56–168), each point jittered radially by ±30% and angularly by ±8°, rejected and re-rolled if any two points are closer than 22 px. Catmull-Rom through the points, sampled at 1px arc-length spacing into a closed centerline of ~420 points. Layout B uses the round's seed XOR a constant and is rejected if its bounding box overlaps Layout A's by more than 70% (they must look different).
- **Road**: half-width 7 px measured perpendicular to the (squashed) centerline, so the road is 14 px wide horizontally and about 11 px on vertical stretches (that asymmetry is the false horizon doing its job). Paint order into the ground cache: grass (TURF 1/8 NIGHT speckle, world-space) → gravel (GRAVEL/TURF 4/8) in a 5px band on the outside of any corner where curvature exceeds 0.06 rad/px → road (ASPHALT/TARMAC 2/8) → kerbs (2 px wide on the inside of those same corners, 4px alternating RED/CHALK stripes measured along the arc) → edge lights on Layout B only (1px CYAN dots every 8 px along both edges; they blink in two alternating sets at 2 Hz; static under reduced motion) → the start/finish line (a 2×14 chequer of 1px BLACK/CHALK cells across the road at centerline index 0) → the pit lane on Layout A (a 6px-wide ASPHALT lane parallel to the start straight, 20 px inside it, with `PIT` in 3×5 CHALK microfont; the lane is decorative) → gantries: three sector gantries (a 1px STEEL post each side of the road with a 1px bar across, and a 5×3 lamp box above the right post) at centerline indices 33%, 66%, 99%; the start gantry (a 3px-tall bar with five 3×3 lamp cells) 6 px before the line on Layout B only.
- **Sector lamps**: dark = STEEL; on crossing they take PURPLE / GREEN / AMBER per Section 5.2 and hold 1.5 s; a 1px CHALK center pixel marks the lit state so the color reads even at 1×.
- **Grandstands**: up to three, placed along the three longest straight segments, on the *outside* of the road, 40×14 logical each, drawn as billboards standing up from the plane: a 40×2 STEEL roof, 10 rows of 1px seats in CHALK/STEEL 4/8 dither with 6 seeded 1px flecks in CYAN/EMBER/GREEN that flip position on 12-fps ticks, a 40×1 NIGHT base line, and a 2px shadow strip on the plane beneath. The stand on the start straight carries the round's circuit-name initials in 3×5 CHALK microfont on the roof edge (e.g. `SLV` for SILVERSTONE, `MXC` for MEXICO CITY; the initials list is fixed per round alongside the circuit list in 8.1).
- **Floodlight towers**: four, at the ground region's corners inset 12 px: a 3×24 STEEL mast, a 7×3 CHALK head with a 1px EMBER halo pixel each side when on. The cone is a triangle from the head down to a 40px-wide base on the plane, filled with the CHALK-toward staircase from 3/8 at the head to 0 at the base in 9 vertical bands, baked into the ground cache for QUALI/RACE/bay only.
- **Horizon**: a 1px CHALK line at logical row 47 across the full width, with the grandstand and mast silhouettes drawn *over* the sky above it. The sun (garage/practice) sits on this line.

### 6.4 Exhaust trail

A ring buffer of the last 16 car positions (12 in practice) sampled every 2 frames. Each is a 2×2 block: age 0–3 CYAN solid, 4–7 CYAN 4/8 over the ground, 8–11 STEEL 2/8, 12–15 STEEL 1/8. Plus sparks: on any speed change of more than 5% between frames (gear shifts are simulated as speed steps), three 1px EMBER pixels spawn at the tail with integer velocities (-1..1, -1..0) and live 4 frames.

### 6.5 Scanner sweep

A 3px-wide CYAN bar spanning the car's height plus 6 px above and below, followed (on the side it came from) by a 12px staircase of CYAN-toward dither at levels 6/8, 5/8, 4/8, 3/8, 2/8, 1/8 (2 px per level). Pixels of the car under the bar and within 6 px behind it are redrawn in x-ray: CHALK outline (any car pixel adjacent to a non-car pixel) over STEEL 4/8. The bar moves 2 px per frame. When halted on a fail it turns RED and its staircase turns RED-toward.

### 6.6 Seal stamp

A 28×16 rounded rectangle (corners cut 2 px) with a 2px CHALK ring, inner fill RED/MAGENTA 4/8 wax, and `SEALED` in 3×5 CHALK microfont centered. A second pre-rasterized copy is drawn rotated 15° using the same polygon-test rasterizer as the car (never `ctx.rotate`). Slam: drawn at 3×, then 2× (using nearest-neighbor integer upscale of the sheet), then the 15° frame, then the straight frame, at 50 ms per step. Under reduced motion: two steps (2×, straight).

### 6.7 Checker wipe and chequered flag

- **Checker wipe**: the hero is divided into 36×22 cells of 8×8 logical px. Cell (c, r) is BLACK when `(c + r)` is even and CHALK when odd. Reveal order is by `d = c + r` (a diagonal front from top-left); 12 steps at 30 ms each cover d from 0 to 56 in increments of 5 (the last step completes). Cells appear fully; nothing scales or fades. The wipe-out is the same in reverse. Under reduced motion: the full checker frame is shown for 150 ms, then the new scene. Chequered variant (finale): same, with 4×4 cells.
- **Flags** (each 16×12, 4 frames at 6 fps; the wave shifts each column by a vertical offset pattern `0,1,1,0,-1,-1` cycling with the frame index; columns are never interpolated):
  - Black flag: BLACK with a 1px CHALK border, on a 1×12 STEEL pole.
  - Chequered flag: 2×2 BLACK/CHALK cells.
  - Green flag: TURF with a GREEN 1px border (parc fermé marshal).
- **Black-flag glyph** for HTML use (tower, chart legend, header badge): an 8×8 inline data-URI PNG, BLACK field, 1px CHALK border, a 1px STEEL pole on the left column.

### 6.8 Garage and bay props

Tyre stacks (three 8×8 BLACK rings with STEEL centers, stacked with 1px offsets), crates (10×8 GRAVEL with a STEEL 1px border and an `07` 3×5 stencil), a wall clock (7×7 CHALK ring, two 1px hands that advance with the session clock), a wall monitor showing a 12×8 miniature of the current circuit in STEEL/CYAN, the bay lectern (8×12 STEEL with a CHALK top), the parc fermé barrier (a 4×20 STEEL post with a 32×2 red/white striped boom that rotates via 3 pre-rasterized frames: down, 45°, up), and the padlock glyph (5×6: a 5×4 GRAVEL body with a 3×2 CHALK shackle).

---

## 7. Motion rules

1. **Two clocks.** The simulation clock drives state (phases, lap progress, times). A 12 fps *animation tick* derived from it drives sprite frame changes (walk cycles, flag waves, blinks, crowd flecks). Car position updates every render frame but is rounded to integer logical pixels before drawing; the sprite direction changes only at 22.5° boundaries.
2. **No tweening curves.** Every UI motion is stepped: CSS uses `transition-timing-function: steps(n, end)` with n in {2, 3, 4} and durations of 100–200 ms, or no transition at all. `transform` values are integer pixel translations. Canvas motions move in whole pixels per frame. Nothing eases in or out.
3. **No fractional opacity.** Opacity is 0 or 1. Anything that would fade uses a Bayer level change instead (a "fade-in" is the sequence of levels 1/8, 2/8, … 8/8 at one level per frame, which is eight frames and looks like a dither dissolve).
4. **Scale changes** happen in discrete integer multiples (3×, 2×, 1×) using nearest-neighbor upscales of the sprite, never a CSS `scale()` with a non-integer value.
5. **Camera** (practice/quali only): the hero's view is the full 288×176 canvas; the ground layer is 320×200 (16 px overscan on each side; the circuit generation region shrinks correspondingly), and the camera offset is an integer that moves 1 px per frame toward keeping the car inside a central 172×104 deadzone. The sky layer does not move with the camera (it is far away); the horizon line does. Race, garage, bay: camera fixed at (16, 12).
6. **Screen shake**: hero canvas `transform: translate()` through four integer offsets over four frames, only on the black-flag card landing and the finale wipe.
7. **CRT flash**: one render frame of the `fx` layer filled CHALK at 4/8 dither, on black flag and on the seal stamp landing.
8. **Flicker**: terminal screens, floodlight halos and crowd flecks may drop one frame every N ticks per Section 6. Never on text.
9. **Ticker** scrolls by whole pixels per frame (2/4/8 for ×1/×2/×4). **Telemetry feed** advances by one 40px row with `steps(2)` over 100 ms. **Timing tower** reorders with `translateY` in `steps(4)` over 200 ms.
10. **Speed ×2 / ×4** scale the simulation clock only; animation ticks stay at 12 per simulated second (so at ×4 sprites animate 48 fps-equivalent, which is fine: they are still stepped) but the ticker and the feed cap their visual rate at ×2 so text stays readable.
11. **STEP** advances the simulation clock by exactly 1/12 s (one animation tick) and renders once.
12. **Reduced motion** (`prefers-reduced-motion: reduce`): simulation continues at the chosen speed; disabled: screen shake, CRT flash, all flicker (terminal, halos, crowd flecks), the part-glow blink (solid CYAN instead), the RED/CHALK part flash (solid RED + outline), the AMBER cursor blink, star twinkle, edge-light alternation, points-drain row shake, fireworks motion (two static bursts). Reduced: checker wipe becomes a 150 ms static checker frame; scanner bar still moves (it is the story); the ticker stops scrolling and instead pages: each bulletin is shown whole for 4 s then hard-cut to the next; the telemetry feed still advances but without the stepped transition (hard cut). The car still laps and the trail still draws.
13. **Pause** freezes the simulation clock; the render loop keeps running at wall time so the paused frame is stable and focus states still work; nothing animates while paused except the ticker (which is paused too) — the only wall-time animation is the finale attract loop after the season ends.

---

## 8. Copy

All copy outside the REGS panel uses F1 vocabulary only. The words harness, notary, trajectory, held-out, reward hacking, LoRA, RSI, bi-level, optimization, evaluator, model, agent, prompt, tool, LLM, token never appear in the broadcast HUD, with two carve-outs the SPEC itself makes: the technical **footnote** under a failed part, and the **telemetry feed** (which is styled as machine telemetry and may say `TOOL`, `LLM`, `tok`).

### 8.1 Header

Exact format (three center cells): `SEASON 1 · ROUND {RR}/22 · {CIRCUIT}-LIKE LAYOUT {A|B}` where `{RR}` is zero-padded, `{CIRCUIT}` comes from this fixed list indexed by round (1–22): MELBOURNE, SHANGHAI, SUZUKA, SAKHIR, JEDDAH, MIAMI, IMOLA, MONACO, BARCELONA, MONTREAL, SPIELBERG, SILVERSTONE, SPA, BUDAPEST, ZANDVOORT, MONZA, BAKU, SINGAPORE, AUSTIN, MEXICO CITY, INTERLAGOS, YAS MARINA (grandstand roof initials, same order: MEL, SHA, SUZ, SAK, JED, MIA, IMO, MON, BCN, MTL, SPI, SLV, SPA, BUD, ZAN, MNZ, BAK, SIN, AUS, MXC, INT, YAS). Layout is `A` in GARAGE/FP/QUALI and `B` from RACE through STANDINGS. During GARAGE the layout token is `A` (the team's home practice track this weekend). At 1280 and below the circuit token is dropped from the header.

Clock: `SESSION 00:41.2` (minutes:seconds.tenths of simulated time within the current phase). Lap counter: `LAP 3/5` (practice 2 laps, qualifying 1, race 3; outside a driving session it reads `LAP --/--`).

### 8.2 Session badges

`GARAGE` · `FP` · `QUALI` · `RACE` · `SCRUTINEERING` · `PARC FERMÉ`. Colors per Section 4.1. STANDINGS shows `PARC FERMÉ` for sealed rounds and `SCRUTINEERING` (with the flag glyph) for black-flagged rounds.

### 8.3 Illegal-part footnotes (exact strings, keyed by part)

- FLOOR → `ILLEGAL · EVALUATION HARNESS EDITED: TEST STUB`
- REAR WING → `ILLEGAL · EVALUATION HARNESS EDITED: TEST STUB` (the first black flag of the season always uses this line regardless of part)
- FUEL FLOW → `ILLEGAL · BUDGET METER BYPASSED: SPEND UNDERREPORTED`
- ENGINE MODE → `ILLEGAL · SEARCH POLICY EDITED: PRIVATE SET PROBED`
- TELEMETRY SEAL → `ILLEGAL · TELEMETRY SEAL FORGED: TRACE REWRITTEN`

### 8.4 Twelve sample stewards' bulletins (ticker)

1. `PKG #07 FITTED · REAR WING · FLOOR · +1.8S CLAIMED · GARAGE CLOSED`
2. `GEN 07 CLAIMS 1:29.412 IN QUALIFYING · FASTEST TEAM CLAIMED TIME OF THE SEASON`
3. `OFFICIAL: GEN 07 1:30.877 · SEALED CIRCUIT · GAP TO CLAIMED +1.465S`
4. `BLACK FLAG · GEN 07 · ILLEGAL PART: REAR WING · EVALUATION HARNESS EDITED: TEST STUB`
5. `GEN 05 · SEALED · PARC FERMÉ · +18 PTS · CLEAN LINEAGE 5 GENS`
6. `STEWARDS: LINEAGE AUDIT OPENED · GEN 09 UNDER INVESTIGATION`
7. `RESULT STRIPPED · GEN 09 · ILLEGAL PART FOUND IN LINEAGE AUDIT · POINTS DEDUCTED`
8. `COST CAP BREACH · ROUND 11 · SPEND $1.63M AGAINST $1.50M CAP · UPGRADE VOID`
9. `STEWARDS: NO ILLEGAL PARTS FOUND, 5 CONSECUTIVE ROUNDS`
10. `NEW LAP RECORD · GEN 16 · 1:27.204 OFFICIAL · SEALED CIRCUIT`
11. `TELEMETRY SEAL VERIFIED · ROUND 14 · TEAM CANNOT WRITE TO THIS CHANNEL`
12. `SEASON 1 · CHAMPION · GEN 21 · CLEAN LINEAGE · 17 SEALED · 4 FLAGGED · 1 STRIPPED`

### 8.5 Eight sample telemetry lines (two-line rows)

1. `SESS 3F2A · TURN 04` / `TOOL run_tests · 412ms · OK`
2. `SESS 3F2A · TURN 05` / `LLM · 1.2k tok · 880ms`
3. `SESS 3F2A · TURN 06` / `TOOL read_file · 31ms · OK`
4. `SESS 3F2A · TURN 07` / `TOOL web_search · 1.9s · OK`
5. `SESS 3F2A · TURN 08` / `TOOL run_tests · 388ms · ERR`
6. `SESS 3F2A · LAP 2` / `SECTOR 2 · 28.410 · PURPLE`
7. `SEAL VERIFIED` / `SESS 3F2A · TRACE 0x91C4 · APPEND-ONLY`
8. `STEWARDS · GEN 07` / `RESULT STRUCK · TRACE RETAINED`

Session ids are four hex characters per generation (seeded); turns increment; tool names come from a fixed set of eight (`run_tests`, `read_file`, `write_file`, `web_search`, `grep`, `exec`, `diff`, `lint`).

### 8.6 The REGS panel

Title tab: `SPORTING & TECHNICAL REGULATIONS · APPENDIX L`

Intro line (Silkscreen 16px CHALK): `What you are watching, in the words of the sport and in the words of the loop.`

Mapping table (two columns, Silkscreen 16px, header row in Press Start 2P 8px: `ON THE BROADCAST` / `IN THE LOOP`), exactly the SPEC's table, broadcast term first:

- The car — The inner agent and its harness: prompts, tools, memory, search policy.
- The race engineer / the upgrade package — The outer improver model proposing a harness diff each iteration.
- Practice and Qualifying, "TEAM CLAIMED" — The public score the agent can see.
- Race day on a sealed circuit, "OFFICIAL" — The private held-out score the improver never sees.
- The cost cap — A fixed dollar budget per generation.
- Parc fermé — The harness frozen during evaluation.
- FIA telemetry — Weave traces: append-only evidence the improver cannot write.
- The Scrutineer in the scrutineering bay — A read-only auditor classifying edits with the harness-tampering taxonomy.
- Illegal parts: FLOOR, REAR WING, FUEL FLOW, ENGINE MODE, TELEMETRY SEAL — Tampering categories: which role was edited and which obligation was violated.
- Black flag, result struck — A generation rejected for tampering.
- Illegal part found in a lineage audit, points stripped — Tampering that persisted into the winning lineage, detected later.
- Constructors' Championship — The lineage of accepted generations.
- One race weekend — One loop iteration.
- Season 1, 22 rounds — The whole run.

Paragraph (Silkscreen 16px CHALK, sentence case):

`Scrutineer dramatizes a bi-level optimization: an outer improver rewrites the harness of an inner agent, and the inner agent is scored on a task. The score is split in two. The public score (practice and qualifying) is visible to the improver and is exactly what it will learn to game; the private held-out score (race day) is never exposed, so a claimed gain that does not appear on the sealed circuit is evidence of reward hacking rather than progress. A fixed budget per generation (the cost cap) keeps selection pressure honest: an upgrade that buys its lap time with spend is void. Every action the inner agent takes is written to an append-only trace channel that the improver cannot edit (FIA telemetry), and a read-only auditor (the Scrutineer) classifies each harness diff against a tampering taxonomy of role edited × obligation violated before the generation is accepted into the lineage. Because tampering can slip through a single inspection, the lineage itself is re-audited: a tampered ancestor found later is stripped, and its descendants lose the points it earned them. Over a season the illegal-part rate falls, claimed and official times reconverge, and what remains is a lineage whose improvement is real.`

Footer: `CLOSE (R)` button; keyboard hint line in STEEL: `SPACE PLAY/PAUSE · → STEP · 1 2 4 SPEED · R REGULATIONS`.

### 8.7 Other fixed strings

- Upgrade card title: `PKG #{RR}`; lines `{PART}  +{gain}s`; footer `+{total}s CLAIMED` or `VOID · OVER CAP`.
- Session board labels: `TEAM CLAIMED`, `OFFICIAL`; empty time `--:--.---`.
- Checklist parts in order: `FLOOR`, `REAR WING`, `FUEL FLOW`, `ENGINE MODE`, `TELEMETRY SEAL`; stamps `OK`, `FAIL`; headers `SCRUTINEERING`, `VERDICT`, `GREEN`, `LINEAGE AUDIT`.
- Verdict card lines: `BLACK FLAG` / `GEN {RR} · DISQUALIFIED · RESULT STRUCK`; seal text `GEN {RR} · SEALED`; audit stamp `STRIPPED`.
- Standings card: `ROUND {RR} · STANDINGS`; finale: `SEASON 1 · CHAMPION · CLEAN LINEAGE`, `SEASON BEST {time} · OFFICIAL`, `CLEAN {n} · FLAGGED {n} · STRIPPED {n}`.
- Telemetry caption: `TEAM CANNOT WRITE TO THIS CHANNEL`.
- Cost cap: `COST CAP · ROUND {RR}`, `SPEND ${x}M`, `CAP ${y}M`, `UPGRADE VOID · OVER CAP`.
- Constructors: `CONSTRUCTORS' CHAMPIONSHIP`, `{n} PTS`, `CLEAN LINEAGE: {n} GENS`, `+0 PTS`.
- Controls: `▶ PLAY`, `❚❚ PAUSE`, `×1`, `×2`, `×4`, `STEP ▸`, `RESTART SEASON`, `SEED`, `JUMP: THE BLACK FLAG`, `JUMP: CONVERGENCE`, `REGS`.
- Ticker label: `STEWARDS`. Points scale per sealed round: 25 for a new season-best official time, 18 for a top-three official time, 15 otherwise, 0 for black flag or void.
