# SCRUTINEER — Design Direction B: "PIT WALL"

The race engineer's point of view from the pit-wall gantry. A bank of seven CRT monitors set into a dark console, each one a hard-edged phosphor window onto a different feed; the hero monitor is the circuit map, the others are timing, telemetry, sessions, championship, chart, and the lineage strip along the gantry lip. Everything is quantized to a 16-colour palette through one 8×8 Bayer matrix. Nothing is smooth, nothing is blurred, nothing is decorative that is not also information.

This document is written to be built from without questions. Every pixel number is at 1440×900 unless a breakpoint is named. "Logical px" means pixels on a canvas's internal grid before integer upscale; "CSS px" means screen pixels.

---

## 1. Concept and the risk

**Concept.** You are sitting at the race engineer's station on the pit wall at night: seven monitors, one console, one car on the map, and a telemetry channel you cannot write to. Every monitor is a bezelled CRT with baked-in scanlines and a dithered phosphor vignette, and the whole page is a single dark console surface with hard hairlines and screw-heads, so the broadcast reads as instrumentation rather than as a TV graphic. Colour is rationed: the world is phosphor grey-green, and the five saturated colours (purple, cyan, yellow, green, amber) plus red and true black are spent only on timing, verdicts and flags, so that when a black flag lands the screen physically changes colour.

**The one aesthetic risk.** Chrome. Seven bezels, seven title tabs, hairlines, screw-heads and baked scanlines spend roughly 14% of the 1440×900 frame on console furniture and push every text panel to 24px VT323 on a 28px row. This is deliberate — the density is the intimidation — but if the builder softens the bezels or enlarges the type the direction collapses into a generic dark dashboard. The bezels stay 8–12px, the rows stay 28px, the monitor tabs stay 8px Press Start 2P, and legibility is bought with contrast (PHOS-4 on GLASS, verified 12.6:1) rather than with size.

---

## 2. Palette and dithering

### 2.1 The 16 colours

Every pixel on the page is one of these. No alpha compositing to intermediate colours, no CSS gradients, no `blur`, no `opacity` below 1 on anything painted (opacity is only ever 0 or 1).

| Group | Name | Hex | Role |
|---|---|---|---|
| Ground | `CONSOLE` | `#07090C` | Page ground (`html, body`), console surface, wipe field. |
| Ground | `GANTRY` | `#12171C` | Monitor bezels, control keys, ticker bar, gantry lip. |
| Ground | `BEZEL` | `#2A333B` | 1px hairlines, bezel highlight edge, asphalt highlight, key borders. |
| Ground | `GLASS` | `#0A100E` | Monitor glass ground behind all text and scenes. |
| Neutral | `PHOS-0` | `#14261E` | Dimmest phosphor: grid lines, dead rows, vignette lift, grass dark. |
| Neutral | `PHOS-1` | `#244D3B` | Dim phosphor: secondary rules, current-row background, grass light, trail tail. |
| Neutral | `PHOS-2` | `#5E9A80` | Mid phosphor: secondary text, labels, disabled keys, crowd. |
| Neutral | `PHOS-3` | `#A8C9BD` | Body text, wing grey, gravel sparkle, kerb white alternate. |
| Neutral | `PHOS-4` | `#EEF7F2` | Primary text, car body, brightest phosphor, kerb white. |
| Speed | `SECTOR PURPLE` | `#B24CFF` | Fastest sector/lap, current-car marker, season-best time. |
| Speed | `TRACE CYAN` | `#3FD8FF` | Telemetry traces, OFFICIAL time, scanner sweep, engine cover livery. |
| Speed | `SECTOR YELLOW` | `#F0E441` | Slower sector light, floodlight cores, session clock while running. |
| Semantic | `PASS GREEN` | `#2EE06A` | Sealed, PASS stamp, green verdict, cost-cap under 80%. |
| Semantic | `CAUTION AMBER` | `#FFA61A` | TEAM CLAIMED time, cost-cap 80–100%, changed-part glow, stewards tag. |
| Semantic | `DQ RED` | `#FF3B3B` | FAIL stamp, strikethrough, kerb red, cost-cap over, BLACK FLAG card border. |
| Semantic | `FLAG BLACK` | `#000000` | Reserved. Only the black flag, tyres, car shadow, and the wipe cells. Never a background. |

Contrast (WCAG ratios, computed): PHOS-4 on GLASS 17.6:1, PHOS-3 on GLASS 10.8:1, PHOS-2 on GLASS 5.9:1 (labels only, never body copy), CAUTION AMBER 9.8:1, TRACE CYAN 11.4:1, SECTOR YELLOW 14.5:1, PASS GREEN 11.0:1, DQ RED 5.4:1, SECTOR PURPLE 4.9:1 (purple is therefore used for markers and for times at 24px+ only, never for 8px labels), PHOS-4 on PHOS-1 (inverse-video row) 8.7:1, PHOS-3 on GANTRY 10.1:1.

### 2.2 The Bayer matrix

One 8×8 ordered-dither matrix, used everywhere, indexed by `(x mod 8, y mod 8)` in *logical* canvas pixels (so at ×2 upscale the visible cell is 16×16 CSS px and the pattern is unmistakable):

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

Threshold for a cell is `(M + 0.5) / 64`, so the 64 thresholds are evenly spaced in (0,1) and never exactly 0 or 1.

### 2.3 Quantization to the palette (the only shading primitive)

A **ramp** is an ordered list of 2–6 palette colours, darkest first. Shading a surface means computing a scalar `v` in [0,1] per pixel, then:

1. `t = v × (n − 1)` where `n` is the ramp length; `i = floor(t)`; `f = t − i`.
2. The pixel is `ramp[i+1]` if `f > threshold(x, y)`, else `ramp[i]`. (Clamp `i+1` to `n − 1`.)

That is all. A fixed-percentage fill ("25% amber over glass") is the two-colour ramp `[GLASS, CAUTION AMBER]` with constant `v = 0.25`, which lights exactly the 16 cells whose matrix value is below 16. A ramp may include the pseudo-colour **NONE** (skip the pixel) so a dithered layer can be composited over a cached layer without alpha: e.g. `[NONE, PHOS-1, PHOS-2]` for a light halo.

Named ramps used by the build:

| Ramp | Colours (dark → light) | Used for |
|---|---|---|
| `GLASS-VIGNETTE` | CONSOLE, GLASS | Monitor glass ground |
| `ASPHALT` | GANTRY, BEZEL | Road surface |
| `GRASS` | GLASS, PHOS-0, PHOS-1 | Infield / outfield |
| `GRAVEL` | BEZEL, PHOS-3 | Run-off at corners |
| `CROWD` | PHOS-1, PHOS-2, PHOS-3 | Grandstand seating |
| `HALO` | NONE, PHOS-1, PHOS-2, SECTOR YELLOW | Floodlight pools |
| `TRAIL` | NONE, PHOS-1, PHOS-2, TRACE CYAN | Exhaust trail |
| `SCAN` | NONE, PHOS-1, TRACE CYAN, PHOS-4 | Scrutineering scanner band |
| `SHADOW` | NONE, FLAG BLACK | Car and sprite drop shadows at v = 0.5 |
| `CHART-BAND` | NONE, CAUTION AMBER | Claimed/official divergence band at v = 0.3 |
| `CHART-FILL` | NONE, PHOS-0 | Area under the OFFICIAL line at v = 0.5 |
| `WIPE` | NONE, FLAG BLACK | The macro checker wipe (see 6.9) |
| `SCRIM` | NONE, CONSOLE | REGS overlay backdrop at v = 0.5 |

### 2.4 Which surfaces are dithered (exhaustive)

1. **Every monitor glass** gets a baked vignette: `v = 1 − 0.55·d²` where `d` is the normalized distance from the glass centre (corner = 1), through `GLASS-VIGNETTE`. Then **scanlines**: every 4th CSS-px row (rows where `y mod 4 = 3`, in CSS px, i.e. drawn on a ×1 backing canvas) has `v` reduced by 0.18 *before* quantization. Result: the scanline is a real palette colour chosen by the matrix, one ramp step darker where the dither decides, never a translucent overlay. Each of the seven monitors owns one backing canvas at ×1 CSS scale, painted once on load and on resize, positioned under its HTML content.
2. **Circuit static layer** (cached per round, per layout, ×2): grass, asphalt, gravel, kerbs, grandstands, crowd, floodlight halos, start line, sector dashes, pit lane — plus the same glass vignette baked in first, so the map sits *inside* the CRT.
3. **Car shadow**: the car mask offset (+1, +2) logical px through `SHADOW` (a 50% checker), drawn under the car every frame.
4. **Exhaust trail**: see 6.6.
5. **Scanner band**: see 6.7.
6. **Chart**: divergence band, under-line fill, black-flag markers are solid.
7. **Cost-cap bar**: empty region is `[GLASS, PHOS-0]` at v = 0.5; the 80–100% segment of the fill is `[GLASS, CAUTION AMBER]` at v = 0.5; under 80% is solid PASS GREEN; over 100% is solid DQ RED.
8. **Changed-part glow** in the garage: a 2px halo around the part region through `[NONE, CAUTION AMBER]` at v = 0.5, blinking (see 7).
9. **Garage floor / bay floor**: `[GANTRY, BEZEL]` with a horizontal `v` that rises from 0.2 at the back wall to 0.7 at the front edge (a floor that reads as lit from the front, in four visible dither bands).
10. **REGS scrim** and **checker wipe**.
11. **Light sweeps**: the only sweep in the design is the scrutineering scanner. There are no sheen or highlight sweeps on HTML surfaces. Header "LIVE" dot blinks, it does not glow.

### 2.5 What is explicitly NOT allowed

`linear-gradient`, `radial-gradient`, `repeating-*-gradient`, `box-shadow` with blur, `text-shadow` with blur, `filter`, `backdrop-filter`, `opacity` other than 0/1, canvas `globalAlpha` other than 1, `createLinearGradient`, `arc()` strokes, `lineJoin: round`, sub-pixel translation, `transform: rotate`. "Glow" on text is done with four zero-blur `text-shadow` copies at (±1, 0) and (0, ±1) in PHOS-1 — a hard 1px halo — and is applied only to the two big session times and the wordmark.

---

## 3. Typography

Two Google fonts, loaded with one stylesheet link: **Press Start 2P** (display) and **VT323** (data). Fallback stack on both: `"Courier New", monospace`. `font-smooth: never; -webkit-font-smoothing: none;` on `html`. Both were probed in headless Chrome in this environment: VT323 renders uniform 2×2 blocks at 24px and 1×1 at 12px (20px and 16px are *not* clean and are forbidden); Press Start 2P is clean at every multiple of 8px; Silkscreen was also clean but is too wide for the rail densities, so it is not used.

| Role | Font | Size / line-height | Letter-spacing | Case | Where |
|---|---|---|---|---|---|
| Wordmark | Press Start 2P | 16 / 16 | 0 | UPPER | `SCRUTINEER` in header |
| Monitor tabs, badges, keys, chart labels, stamps | Press Start 2P | 8 / 8 | 0 | UPPER | Bezel tabs, session badge, control keys, PASS/FAIL stamps, lineage tab |
| Hero numbers | Press Start 2P | 24 / 32 | 0 | — | TEAM CLAIMED / OFFICIAL values, championship points |
| Verdict cards | Press Start 2P | 32 / 40 | 0 | UPPER | `BLACK FLAG`, `SEALED`, finale title |
| Data | VT323 | 24 / 28 (tower) or 24 / 24 (everything else) | 0.4px | UPPER | Tower rows, telemetry, times labels, ticker, championship lines, package card, REGS table |
| Compact data | VT323 | 12 / 12 | 0.2px | UPPER | Telemetry feed at ≤1024 only; canvas overlay labels (S1/S2/S3 badges) |
| REGS paragraph | VT323 | 24 / 28 | 0.4px | Sentence case | The one paragraph in the REGS panel |

The 0.4px letter-spacing is load-bearing: VT323's advance is 0.4em = 9.6px at 24px; adding 0.4px makes every glyph land on an exact **10 CSS px cell** (5 blocks), so column layouts in the tower and feed are computed in characters: one character = 10px at 24px, 5px at 12px. Press Start 2P is 1em monospace: 8px per character at 8px, 24px per character at 24px.

Uppercase everywhere on the broadcast. Mixed case appears only in the REGS paragraph and inside telemetry tool names (`run_tests`, `read_file`) which are quoted verbatim as identifiers.

Text never touches a canvas. Canvases carry a hand-authored **5×7 dot-matrix micro-font** (classic HD44780 glyph set: A–Z, 0–9, `: . / - + ·`) drawn with 1px rects, used only for grandstand signage, sector post labels, the start-line `S/F`, the lineage round numbers, the garage `PKG` plate, and the padlocks' `SEALED` legend. HTML overlays carry all real copy.

---

## 4. Layout

### 4.1 Region map at 1440×900 (CSS px; `x0–x1, y0–y1`)

The page is a fixed 1440×900 console; on taller viewports the console is top-aligned and the CONSOLE colour fills below; on wider viewports it is centred. Column structure: left rail 272, centre 840, right rail 328.

| Region | Box | Notes |
|---|---|---|
| HEADER | 0–1440, 0–48 | Console surface, no bezel. 1px BEZEL rule at y=47. |
| TOWER monitor (MON 1) | 0–272, 48–768 | Bezel 8 → glass 8–264, 56–760. |
| HERO monitor (MON 2) | 272–1112, 48–562 | Bezel 12 → glass 284–1100, 60–550. |
| CHART + COST CAP monitor (MON 3) | 272–1112, 562–768 | Bezel 12 → glass 284–1100, 574–756. |
| SESSION TIMES monitor (MON 4) | 1112–1440, 48–232 | Bezel 8 → glass 1120–1432, 56–224. |
| FIA TELEMETRY monitor (MON 5) | 1112–1440, 232–616 | Bezel 8 → glass 1120–1432, 240–608. |
| CHAMPIONSHIP monitor (MON 6) | 1112–1440, 616–768 | Bezel 8 → glass 1120–1432, 624–760. |
| TICKER | 0–1440, 768–800 | GANTRY bar; STEWARDS tag 0–128. |
| CONTROLS | 0–1440, 800–856 | Keys 40 tall at y 808–848. |
| LINEAGE LIP (MON 7) | 0–1440, 856–900 | Tab 16–144; canvas 152–1384, 858–898. |
| REGS overlay | 240–1200, 130–770 | 960×640 modal over full-page SCRIM. |

**Monitor anatomy** (all seven): bezel in GANTRY; 1px BEZEL hairline inset 3px from the bezel's outer edge; a 3×3 PHOS-0 screw-head at each bezel corner, 2px in; glass in GLASS with the baked vignette+scanline backing canvas; a **tab** in the top-left of the bezel, Press Start 2P 8px PHOS-2, reading `MON 1 · TIMING`, `MON 2 · CIRCUIT`, `MON 3 · SEASON`, `MON 4 · SESSION`, `MON 5 · FIA`, `MON 6 · CHAMPIONSHIP`, `MON 7 · LINEAGE`. The live monitor (the one the current phase is "about") has its tab in PHOS-4 and a 1px TRACE CYAN hairline instead of BEZEL.

**HEADER internals.** x16: wordmark `SCRUTINEER` (Press Start 2P 16, PHOS-4, hard halo). x224: a 6×6 DQ RED blinking square + `LIVE` (8px). x304: `SEASON 1 · ROUND 07/22 · SILVERSTONE-LIKE LAYOUT B` (VT323 24, PHOS-3). x840: session badge — a 24px-tall key, Press Start 2P 8px, 8px horizontal padding; colours per badge in §8.2. x1040: `SESSION 00:14.2` (VT323 24; digits SECTOR YELLOW while a session clock is running, PHOS-3 otherwise). x1264: `LAP 2/3` (VT323 24, PHOS-4), right-aligned to 1424.

**TOWER internals** (glass 256 wide = 24 characters at 8px inner padding): title row y56–80 `TIMING TOWER · OFFICIAL` (8px, PHOS-2); column head y80–104 VT323 24 PHOS-2 `PO GEN TIME          GAP`; 22 rows × 28 = y104–720; footer y720–760 two lines VT323 24 PHOS-2: `DSQ = BLACK FLAG` / `STRUCK = STRIPPED`. Row format is exactly 24 characters: `07 G07 1:27.412   +0.812`, leader `01 G19 1:24.816   LEADER`, black-flagged `-- G08 1:25.940      DSQ`, stripped `-- G09 1:27.102 STRIPPED`. The time is DQ RED with a 2px DQ RED strikethrough (a real `text-decoration` line, thickness 2px) on DSQ and STRIPPED rows; the position is `--` and those rows sort after all ranked rows in round order. The current round's generation has an inverse-video row (PHOS-4 on PHOS-1) with a 4px SECTOR PURPLE bar at the row's left edge; the season-best time is SECTOR PURPLE. Rows have a 8×8 CSS-drawn black-flag glyph (FLAG BLACK square, 1px PHOS-4 border, 1px PHOS-3 pole at left) between GEN and TIME on DSQ rows.

**HERO internals.** Feed bar y60–84 inside the glass: left `CAM 2 · CIRCUIT · SILVERSTONE-LIKE LAYOUT B` (VT323 24 PHOS-3), right a 4-key feed selector (`GARAGE` `CIRCUIT` `BAY` `PARC FERMÉ`, Press Start 2P 8px, active key PHOS-4 on PHOS-1, others PHOS-2 on GLASS; clickable, auto-returns to the phase's feed at the next phase change). Canvas y84–534, x292–1092 (800×450 = logical 400×225 at ×2). Status strip y534–550: three sector lights (S1 S2 S3) as 40×12 keys at x292/340/388, `LAP 1:27.412` scrolling readout VT323 12px at x460, and `SEALED CIRCUIT · TEAM HAS NO DATA` at the right during race weekends.

**CHART internals.** Title y574–598 `TEAM CLAIMED vs OFFICIAL · 22 ROUNDS` (8px PHOS-2) with a legend at the right: 12×4 CAUTION AMBER swatch `CLAIMED`, 12×4 TRACE CYAN swatch `OFFICIAL`, 8×8 flag glyph `BLACK FLAG`. Chart canvas y602–746, x296–896 (600×144 = logical 300×72 at ×2). Cost-cap column x912–1088: `COST CAP · ROUND 07` (8px), the bar canvas 88×12 logical at ×2 (176×24), then `SPEND $118.4M` (VT323 24 PHOS-4) / `CAP $135.0M` (PHOS-3) / status line `UNDER CAP` PASS GREEN, `NEAR CAP` CAUTION AMBER, `OVER CAP · UPGRADE VOID` DQ RED.

**SESSION TIMES internals.** y56–80 title `SESSION TIMES` (8px). y84–108 `TEAM CLAIMED` label (VT323 24 CAUTION AMBER) with source tag right-aligned `QUALI`; y108–140 value Press Start 2P 24 CAUTION AMBER, hard halo; y148–172 `OFFICIAL` label (TRACE CYAN) with `RACE · SEALED`; y172–204 value TRACE CYAN; y204–224 delta line VT323 24 PHOS-3: `DELTA +2.106 · CLAIMED FASTER` (DQ RED digits when the delta exceeds 1.0s, PHOS-4 otherwise). Before a value exists it reads `--:--.---` in PHOS-1.

**TELEMETRY internals.** Title y240–264 `FIA TELEMETRY · LIVE` with a 6×6 TRACE CYAN blinking square; feed y264–576 = 13 rows × 24, VT323 24, 30 characters per row (312 glass − 2×4 padding = 304 px = 30 full 10px cells; lines are hard-wrapped at 30 characters on the `·` separators, continuation lines indented 2 characters); caption y584–608 `TEAM CANNOT WRITE TO THIS CHANNEL` (8px, PHOS-2, with a 8×8 padlock glyph). New lines enter at the bottom; the feed shifts up by whole rows.

**CHAMPIONSHIP internals.** Title y624–648 `CONSTRUCTORS' CHAMPIONSHIP`; y652–684 points value Press Start 2P 24 PHOS-4 `184 PTS`; y688–712 VT323 24 PHOS-3 `SEALED 11 · BLACK FLAG 4 · STRIPPED 1`; y712–736 `LEADER G19 · 1:24.816 · CLEAN LINEAGE`; y736–760 `LAST: G07 +25 PTS` (PASS GREEN) or `LAST: G08 DSQ · 0 PTS` (DQ RED) or `AUDIT: G09 −18 PTS` (DQ RED).

**TICKER.** x0–128 GANTRY tag `STEWARDS` (8px CAUTION AMBER on GANTRY, with a 4px CAUTION AMBER left bar); x128–1440 a clipped strip in CONSOLE with VT323 24 PHOS-4 text scrolling left, items joined by `   ·   `. The strip is a marquee of the last 6 bulletins; new bulletins are appended at the end of the queue, never inserted mid-scroll, except a black flag which also flashes the tag DQ RED for 2 s.

**CONTROLS.** Keys are 40px tall GANTRY blocks with a 1px BEZEL border, Press Start 2P 8px PHOS-3 label, 12px horizontal padding, 8px gaps, left margin 16: `▶ PLAY` / `❚❚ PAUSE` (the glyphs are drawn as two CSS rects, not characters) 96 wide; `STEP` 64; `×1` `×2` `×4` 48 each (active: PHOS-4 on PHOS-1); `RESTART SEASON` 160; `SEED` label 48 + a 96-wide input (VT323 24 PHOS-4 on GLASS, 1px BEZEL border; numeric; Enter applies); `JUMP: THE BLACK FLAG` 200; `JUMP: CONVERGENCE` 184; `REGS` 64 right-aligned to 1424. Hover: border PHOS-2. Focus (keyboard): 2px SECTOR PURPLE outline with 2px offset, no rounding. Active press: label PHOS-4, background BEZEL, for one frame minimum.

**LINEAGE LIP.** Tab `SEASON LINEAGE` at x16–144 (8px PHOS-2 on GANTRY). Canvas x152–1384, y858–898: logical 616×20 at ×2, 22 slots of 28 logical px. Each slot: the 16×8 car silhouette (E-facing frame) at slot-x+6, y2; round number in the 5×7 micro-font at y12. Slot states: not yet raced = car in PHOS-0; sealed = PHOS-3 body with changed parts in CAUTION AMBER for the parts that were in that round's package; black-flagged = PHOS-1 body with a 8×8 black flag drawn over its centre; stripped = PHOS-1 body with a 1px DQ RED diagonal strike; current round = SECTOR PURPLE 1px underline across the slot. Lineage is drawn as 1px PHOS-1 connector lines between consecutive sealed cars (a child to its parent), skipping over DQ'd slots, so the accepted lineage reads as a chain.

### 4.2 Canvases, logical sizes, scales

| Canvas | Logical | Scale | Redraw cadence |
|---|---|---|---|
| Hero scene (dynamic) | 400×225 | ×2 | Every frame |
| Hero static circuit cache (practice/quali layout) | 400×225 | ×2 (offscreen) | Once per round |
| Hero static sealed-circuit cache | 400×225 | ×2 (offscreen) | Once per round |
| Garage / bay / parc-fermé static backdrops | 400×225 | ×2 (offscreen) | Once on load per breakpoint |
| Car direction sheet | 16 cells of 16×16 | — (offscreen) | Once on load |
| Chart | 300×72 | ×2 | On round change and on verdict |
| Cost-cap bar | 88×12 | ×2 | On round change and when spend ticks in garage |
| Lineage strip | 616×20 | ×2 | On verdict, on audit |
| Monitor backing (×7) | CSS size ÷ 1 | ×1 | On load / resize |
| Wipe layer (full page) | CSS size ÷ 8 | ×8 | During the wipe only |
| REGS scrim | CSS size | ×1 | On open / resize |

All canvases: `image-rendering: pixelated`, `imageSmoothingEnabled = false`, all draw calls at integer coordinates, `fillRect` only (no paths, no arcs, no strokes).

### 4.3 Fold at 1280×800

Same seven-monitor grid, tightened: header 40; tower 0–240 (rows 22×24 with line-height 24 instead of 28; column format unchanged, 22 characters + 2 padding); centre 240–1000 (hero glass 736 wide → hero logical **356×200** at ×2 = 712×400; hero monitor y40–500; chart y500–680 with chart canvas 260×56 ×2 and the cap column 160 wide); right 1000–1280 (times y40–200; telemetry y200–540, 11 rows, 26 characters; championship y540–680); ticker 680–712; controls 712–760 (keys 36 tall, labels unchanged, `RESTART SEASON` shortened to `RESTART`, `JUMP: THE BLACK FLAG` to `JUMP: BLACK FLAG`); lineage 760–800 (slots 24 logical → canvas 528×18 ×2 = 1056×36 at x120–1176).

### 4.4 Fold at 1024×768

Header 40. Main y40–600. Tower 0–208: glass 192 = 19 characters; the GAP column is dropped (`07 G07 1:27.412`), the DSQ/STRIPPED word moves to a second 12px VT323 line under the time; the row list becomes a vertical scroll container (rows stay 24 tall) that auto-scrolls to keep the current generation's row in view. Centre 208–800: hero glass 568 → hero logical **280×158** at ×2 = 560×316, hero monitor y40–420; chart y420–560 with chart canvas 240×40 ×2 = 480×80 and the cost cap as a vertical 24×80 bar at the right of the chart. Right 800–1024: times y40–176 (values at Press Start 2P 16); telemetry y176–480 using **VT323 12px** (41 characters per row, 24 rows); championship y480–560 (title + points + one status line). Ticker 600–632. Controls 632–720 in two rows of 40 (row 1: play, step, speeds, restart, seed; row 2: the two jumps and REGS). Lineage 720–768: slots 20 logical → canvas 440×20 ×2 = 880×40 at x96–976; the round number is dropped below the car and drawn as a 3×5 micro numeral inside the slot's top-right corner instead. REGS modal 928×600.

### 4.5 Fold at 390×844 (stack)

Single column, no bezels wider than 4px, no horizontal page scroll, all monitors full-width 390 with 4px bezel → 382 glass. Order: (1) header in two rows of 32 (`SCRUTINEER` + badge; meta line VT323 12px) ; (2) HERO: feed bar 24, canvas logical **192×108** at ×2 = 384×216 centred with 3px margins, status strip 24 (sector lights + readout only); (3) SESSION TIMES 112 tall (values Press Start 2P 16); (4) CHART 152: canvas 180×48 ×2 = 360×96, cost cap as a full-width 16px bar below with the spend/cap line; (5) TOWER: full 22 rows × 24, 19-character format as at 1024; (6) CHAMPIONSHIP 112; (7) TELEMETRY 8 rows VT323 12px = 96 + title + caption; (8) LINEAGE: a horizontal *internal* scroll container 44 tall holding the 1232×40 canvas; (9) CONTROLS as a wrapping key row (three rows). The TICKER is `position: sticky; bottom: 0` at 32px so bulletins are always visible. Reduced hero logical size means the road width scales (see 6.4); the car sheet is unchanged.

---

## 5. Scene choreography

Simulation time `t` is seconds at ×1. Phase durations per round: GARAGE 6, PRACTICE 6, QUALIFYING 6, RACE 12, SCRUTINEERING 8, VERDICT 4, STANDINGS 4 = **46 s**. Round 12's STANDINGS is extended to 10 s for the lineage audit. Season = 22 × 46 + 6 = 1018 s, followed by a 12 s finale, total 1030 s; at ×4 that is 4 min 17 s. Every phase start time is a pure function of the round index, so `#t=` seeks land on exact phase boundaries and both jump buttons are constants: `JUMP: THE BLACK FLAG` → round 6 SCRUTINEERING start (`t = 5×46 + 30 = 260`); `JUMP: CONVERGENCE` → round 21 STANDINGS start (`t = 20×46 + 6 + 42 = 968`).

The hero monitor is always showing one of four **feeds**: GARAGE, CIRCUIT, BAY, PARC FERMÉ. The feed bar's CAM label and the phase both drive the feed; a manual feed click overrides until the next phase boundary.

### 5.1 GARAGE (6 s) — feed GARAGE, badge `GARAGE`, MON 2 live

Backdrop: back wall in GANTRY with a horizontal 1px BEZEL rail at y=40 and a row of five tool boards (24×16 rects in PHOS-0 with 2×2 PHOS-2 "tools"); floor dither band per §2.4(9). Side-view car (96×32 logical, §6.2) on two 8×6 jacks at x152–248, y120–152, raised 6px so tyres hang. Engineer sprite at a terminal desk (x40–88, y110–150): desk 48×8 in BEZEL, a 20×14 monitor showing a 2px TRACE CYAN "trace" that scrolls (a 1px-wide moving column), engineer seated with a 2-frame typing cycle at 4 Hz. Two mechanics at the car, 2-frame wrench cycle at 3 Hz, one at the rear wing, one under the floor.

Beats: `0.0 s` cut in; the header session clock resets to `00:00.0` and starts. `0.5 s` the **UPGRADE PACKAGE card** slides in from the right edge of the glass in 4 steps of 40px over 8 frames, to rest at x=596–1092 (496 wide) y=100–260: GANTRY panel, 1px BEZEL border, tab `UPGRADE PACKAGE` (8px CAUTION AMBER), line 1 Press Start 2P 8px PHOS-4 `PKG #07`, then one VT323 24 line per changed part `REAR WING     +1.1s`, `FLOOR         +0.7s` (gain right-aligned, CAUTION AMBER), rule, `CLAIMED GAIN  +1.8s` (PHOS-4), `SPEND $118.4M / CAP $135.0M`. `1.0–4.5 s` each part's row appears 0.6 s apart and, as it appears, the matching part region on the side-view car lights with the amber glow (§2.4(8)); mechanics move to the part being fitted. `1.0–5.0 s` the cost-cap bar (MON 3) fills in 4 steps to the round's spend. `5.5 s` the garage door light at the top-right of the backdrop goes PASS GREEN (or DQ RED if spend is over the cap, but the car still goes out — the void is declared at scrutineering). `6.0 s` hard cut to CIRCUIT.

### 5.2 PRACTICE (6 s) — feed CIRCUIT, badge `FP`, MON 2 live

Circuit = the **practice layout** for this round (generated from `seed ⊕ round`). Feed bar: `CAM 2 · CIRCUIT · <NAME>-LIKE LAYOUT <L> · FP`. `0.0–1.5 s` the car leaves the pit lane (a 40×8 PHOS-0 lane parallel to the start straight, on the inside) and joins the road at the pit exit. `1.5–5.5 s` one flying lap (a lap is always 4.0 s of scene time regardless of the story lap time); sector lights fire at 1/3 and 2/3 of the lap and at the line; lap readout in the status strip counts from `0:00.000` to the practice story time over the 4 s (i.e. it runs ~22× real time in steps of one displayed frame). `5.5–6.0 s` the readout freezes in PHOS-4 and the SESSION TIMES monitor shows the practice time in its TEAM CLAIMED slot, tagged `FP`, in PHOS-3 (provisional, not yet amber).

### 5.3 QUALIFYING (6 s) — feed CIRCUIT, badge `QUALI`

Same layout, same car, sector lights re-armed. `0.0–4.0 s` flying lap; on crossing the line the lap readout freezes and the **TEAM CLAIMED** value in MON 4 rolls from the practice value to the qualifying value in 8 odometer steps over 16 frames, turns CAUTION AMBER, and tags `QUALI`. `4.0–6.0 s` hold; the timing-tower row for this generation appears at the bottom of the tower in PHOS-2 with `--` position and the claimed time in CAUTION AMBER (claimed times never rank; the row is provisional until the official time exists). Ticker: `Q: G07 SETS 1:25.612 · TEAM CLAIMED · PROVISIONAL`.

### 5.4 RACE (12 s) — feed CIRCUIT, badge `RACE`

Hard cut to the **sealed circuit** (generated from `seed ⊕ round ⊕ 0x5EA1`, a different closed loop): grandstands are empty (no crowd dither, PHOS-0 seating), a 7×7 padlock in PHOS-3 sits beside each stand, and the feed bar reads `CAM 2 · SEALED CIRCUIT · LAYOUT S<round> · RACE`. The status strip's right text `SEALED CIRCUIT · TEAM HAS NO DATA` is PHOS-3. `0.0–0.5 s` five 6×6 start lights across the top of the canvas illuminate DQ RED one per 0.1 s; `0.5 s` all out (lights go PHOS-0); `0.5–11.0 s` three laps of exactly 3.5 s each (the race-day lap is shorter in scene time than the 4.0 s practice lap; the story lap time shown in the readout is unrelated to scene time); the lap counter in the header reads `LAP 1/3` … `3/3`; sector lights fire each lap; the exhaust trail is longest here (24 samples). Camera: none — the engineer's map monitor never pans. `11.0 s` the car crosses the line and the chequered flag (16×12 sprite, §6.10) waves at the gantry in 2 frames at 5 Hz while the car slows to a stop on the straight; `11.5 s` the **OFFICIAL** value in MON 4 rolls in, TRACE CYAN, tagged `RACE · SEALED`; the delta line updates; the tower row gets its official time and **ranks**: rows re-sort (§7); the chart plots both points for this round; ticker `RACE: G07 OFFICIAL 1:27.412 · CLAIMED 1:25.612 · DELTA +1.800`.

### 5.5 SCRUTINEERING (8 s) — feed BAY, badge `SCRUTINEERING`

Backdrop: the bay — a darker room, back wall GLASS with a 1px PHOS-1 grid every 16px (a measuring grid), floor band, a 120×4 PHOS-2 lift platform at y=156, two floodlight cones from the ceiling as static `HALO` pools. Side-view car rolls in from the left at 2 px/frame (`0.0–1.0 s`), stops centred at x152–248. Scrutineer sprite walks in from the right and stands at x264, clipboard up. Five **part plates** appear under the car at y=176, each 72×16 (GANTRY, 1px BEZEL border, 8px label): `FLOOR` `REAR WING` `FUEL FLOW` `ENGINE MODE` `TELEMETRY SEAL`, spanning x=20–380.

Scanner (§6.7) starts at x=140 at `1.2 s` and sweeps right at 2 logical px/frame. Each part has a checkpoint x on the car (FLOOR 160, REAR WING 176, FUEL FLOW 200, ENGINE MODE 216, TELEMETRY SEAL 236). When the band's centre reaches a checkpoint the sweep **pauses 0.5 s** (the pause is the suspense), then a stamp (§6.8) lands on the plate: `PASS` PASS GREEN or `FAIL` DQ RED. Timeline for a clean car: pauses end at 2.0, 2.9, 3.8, 4.7, 5.6 s; the sweep exits the right edge at 6.4 s; `6.4–8.0 s` hold with all five plates stamped, scrutineer lowers clipboard, ticker `SCRUTINEERING: G07 · 5/5 PARTS CHECKED · NO INFRINGEMENT`. Telemetry feed emits `SEAL VERIFIED · G07` at 6.4 s.

If a part fails, the ceremony (§5.10) starts at that pause and the remaining parts are stamped in fast-forward (0.15 s apart) after the card lands.

### 5.6 VERDICT (4 s) — badge `SCRUTINEERING` then `PARC FERMÉ`

**Green**: `0.0 s` the five plates flash PASS GREEN together for 2 frames; `0.3 s` the card `GREEN · PARC FERMÉ` (Press Start 2P 32, PASS GREEN on GANTRY, 1px PASS GREEN border, 520×80 centred) steps in from scale ×3 → ×2 → ×1 (three integer-scaled frames 4 frames apart, drawn as three sizes of the same HTML block); `0.8 s` feed cuts to PARC FERMÉ (§5.7); badge changes to `PARC FERMÉ`; the tower row loses its provisional tint and gets its final rank colour; `1.0 s` the championship points roll up (`+25`), `LAST: G07 +25 PTS`; lineage slot for this round fills in; `2.0 s` the seal stamp (§6.8) lands on the parc-fermé car; `4.0 s` cut.

**Black**: the BLACK FLAG card is already on screen from the ceremony; VERDICT holds it 2.5 s, then the wipe reverses (`2.5–3.0 s`) to reveal the bay with the car under a DQ RED floodlight (the two halo pools switch to a `[NONE, PHOS-1, DQ RED]` ramp), the tower row is struck, points do not move (`LAST: G08 DSQ · 0 PTS`), the lineage slot gets its flag, the chart gets its marker. Badge stays `SCRUTINEERING` with a DQ RED background for the whole verdict phase.

**Void (over cost cap)**: identical to Black, but the card reads `UPGRADE VOID` with sub-line `OVER COST CAP · $141.2M / $135.0M`, and the stamps all PASS; the plates are replaced by a single 200×16 plate `COST CAP` stamped FAIL. Stored verdict is `BLACK FLAG`.

### 5.7 PARC FERMÉ (shown during VERDICT green and STANDINGS) — feed PARC FERMÉ

Backdrop: a fenced compound at night — the back wall CONSOLE, a 1px PHOS-2 chain-link pattern (a 4×4 diamond tile) over the upper half, a red-white barrier (alternating 8px DQ RED / PHOS-4 blocks, 6 tall) across the front at y=170. The sealed car side-view, top-down floodlit by two `HALO` pools. A 24×24 padlock in PHOS-3 hangs on the barrier at x=300. The seal card `GEN 07 · SEALED` (Press Start 2P 8px PHOS-4 on PASS GREEN 2px-bordered GANTRY plate, 144×32) is stamped onto the glass at x=140, y=40 by the stamp animation; below it VT323 24 PHOS-3 `OFFICIAL 1:27.412 · LINEAGE G05 → G07`. The scrutineer sprite stands guard, 2-frame idle (head turn) every 1.5 s.

### 5.8 STANDINGS (4 s; 10 s at round 12) — feed PARC FERMÉ (or BAY on a black round), badge `PARC FERMÉ`

MON 1, MON 3, MON 6, MON 7 are live (tabs bright). `0.0–1.5 s` tower rows re-sort if the new official time changed the order (§7); `0.5 s` the chart redraws with the round's points and any marker, its divergence band re-dithers; `1.0 s` the championship line updates; `2.0 s` the ticker gets a standings bulletin (`STANDINGS: G07 P3 · +0.812 TO LEADER · 184 PTS`). `4.0 s` hard cut to next round's GARAGE; the header round counter increments with a 2-frame PHOS-1 → PHOS-4 flash; the circuit caches for the next round are generated during the last 0.5 s of STANDINGS so the cut is free of hitching.

At round 12 the lineage audit (§5.11) runs from `1.5 s` to `9.0 s`.

### 5.9 The season arc as a fixed schedule (details vary by seed)

The engineer's package each round is built from the legal parts list: FRONT WING, REAR WING, FLOOR, SIDEPOD, DIFFUSER, SUSPENSION, BRAKE DUCTS, ENGINE MODE, FUEL FLOW, GEARBOX, COOLING (2–3 parts per package, seeded). Illegal packages replace one or two of those with a part from the five scrutineered categories carrying an illegal reason.

| Rounds | Shape | Claimed | Official | Cap | Verdict |
|---|---|---|---|---|---|
| 1–5 | Honest | official ± 0.12 s | improves 0.35–0.75 s per round from 1:32.000 | 60–85% | all SEALED |
| 6 | First black flag (fixed) | −2.4 s | flat ± 0.2 | 88% | BLACK FLAG, part FLOOR, footnote `EVALUATION HARNESS EDITED: TEST STUB` |
| 7 | Caught | −1.8 s | flat | 91% | BLACK FLAG (REAR WING) |
| 8 | Honest | ± 0.12 | +0.3 s gain | 72% | SEALED |
| 9 | **Slips through** (fixed) | −2.9 s | flat | 94% | SEALED, `caught = false`, points awarded, becomes parent of 10–12 |
| 10 | Caught | −2.1 s | flat | 90% | BLACK FLAG (FUEL FLOW) |
| 11 | Honest | ± 0.12 | +0.4 s | 78% | SEALED (parent G09) |
| 12 | Caught + **LINEAGE AUDIT** (fixed) | −1.6 s | flat | 87% | BLACK FLAG (TELEMETRY SEAL); audit strips G09 → `STRIPPED`, G11 re-parented to G08 |
| 13 | Caught | −1.4 s | flat | 85% | BLACK FLAG (ENGINE MODE) |
| 14 | Caught | −1.0 s | flat | 83% | BLACK FLAG (FLOOR) |
| 15 | Over cap (fixed) | −0.5 s | +0.2 s | 104% | UPGRADE VOID (stored BLACK FLAG) |
| 16 | Caught | −0.6 s | flat | 80% | BLACK FLAG (REAR WING) |
| 17–22 | Convergence | official ± 0.25 s | improves 0.2–0.4 s per round | 65–79% | all SEALED; bulletin `STEWARDS: NO ILLEGAL PARTS FOUND, 5 CONSECUTIVE ROUNDS` at round 21 STANDINGS |

Illegal-part rate: 6–13 = 6/8 = 75% falling to 14–22 = 2/9 ≈ 22%, with 17–22 at 0% — the "60% toward 10%" curve the spec describes, and the numbers are seeded ± one round for 7, 10, 13, 14, 16 (never for 6, 9, 12, 15, and never adjacent to 9 or 12). Official time ends in the 1:24s. Points: 25 to a sealed generation that sets a new season-best official time, 18 if within 0.5 s of the best, 10 otherwise, 0 for any black flag; STRIPPED removes the generation's points and its rank.

### 5.10 The black-flag ceremony, beat by beat (times from the failing pause)

| t | Beat |
|---|---|
| 0.00 s | The scanner band stops on the checkpoint. The band's ramp switches from `SCAN` to `[NONE, PHOS-1, DQ RED, PHOS-4]` — the sweep turns red on the part. Session clock in the header freezes. |
| 0.00–0.60 s | The failing part region on the side-view car **flashes**: 6 frames DQ RED, 6 frames its normal colour, three times (stepped, 5 Hz). Reduced motion: solid DQ RED for 0.6 s. |
| 0.60 s | Stamp `FAIL` lands on the plate (§6.8) with a 2px screen shake for 6 frames (reduced motion: no shake). The footnote line appears under the plates at y=200, VT323 12px DQ RED: `ILLEGAL · EVALUATION HARNESS EDITED: TEST STUB`. |
| 0.60–1.00 s | Telemetry feed emits two lines: `SEAL CHECK FAILED · FLOOR · G06` and `STEWARDS NOTIFIED · SESS 3F2A`. |
| 1.00–1.50 s | **The wipe.** Full-page 8×8 CSS px cells; cell (i, j) turns FLAG BLACK when `threshold(i mod 8, j mod 8) < p`, `p` rising 0 → 1 in 30 frames (§6.9). Everything, all seven monitors and the header, is covered. Reduced motion: hard cut to black at 1.00 s. |
| 1.50 s | One frame of a 50%-dithered PHOS-4 field over the black (the CRT flash; omitted under reduced motion). |
| 1.55 s | **The card slams in**: `BLACK FLAG` in Press Start 2P 32 PHOS-4 on FLAG BLACK, 4px DQ RED border, 640×200 centred, arriving at ×3 → ×2 → ×1 in three frames 3 frames apart; then two lines under it in VT323 24: `G06 · FLOOR · RESULT STRUCK` (DQ RED) and `ILLEGAL · EVALUATION HARNESS EDITED: TEST STUB` (PHOS-3). Left of the text, a 64×48 black flag with a 2px PHOS-4 border on an 8px PHOS-3 pole, waving in 2 frames at 4 Hz (reduced motion: static). |
| 1.55 s | Ticker: the STEWARDS tag goes DQ RED for 2 s; bulletin appended `BLACK FLAG: G06 DISQUALIFIED · ILLEGAL FLOOR · RESULT STRUCK`. Badge turns DQ RED. |
| 1.55–4.00 s | Hold. During the hold the chart (hidden under the field) gets its marker, the tower row gets its strike and glyph and drops to the DQ block, the lineage slot gets its flag, the championship line reads `LAST: G06 DSQ · 0 PTS`, so that when the wipe reverses the world has already changed. |
| 4.00–4.50 s | Wipe reverses (`p` 1 → 0, same cell order), revealing the bay under red floodlights with the remaining stamps applied. |
| 4.50 s → VERDICT end | Hold on the bay. Session clock resumes at the next phase. |

Sound: none by default. If added later: three 60 ms square-wave bleeps at 220 Hz on the stamp, gated on a user gesture, muted by default, a `SND` key appears in CONTROLS only when audio is enabled.

### 5.11 The lineage audit, beat by beat (round 12 STANDINGS, times from phase start)

| t | Beat |
|---|---|
| 1.5 s | The LINEAGE LIP tab flips to `LINEAGE AUDIT` in CAUTION AMBER; MON 7's hairline goes CAUTION AMBER. A 28×20 audit cursor (a 1px CAUTION AMBER rectangle) appears on slot 12 and steps left one slot every 0.25 s along the *accepted* chain: 12 (DQ, skipped in 0.1 s), 11, 10 (skipped), 9. |
| 3.0 s | Cursor stops on slot 9; the slot flashes CAUTION AMBER/PHOS-1 at 4 Hz for 0.75 s (reduced motion: solid amber). Ticker: `LINEAGE AUDIT: G09 UNDER INVESTIGATION · FLOOR`. |
| 3.75 s | Slot 9's car is redrawn with the FLOOR part in DQ RED; the footnote appears in the status strip of MON 2 (which is on the PARC FERMÉ feed): `ILLEGAL · EVALUATION HARNESS EDITED: ASSERTION REMOVED · FOUND IN LINEAGE`. |
| 4.0 s | Tower: G09's row (currently ranked, e.g. P2) gets the DQ RED strike and `STRIPPED`, its position becomes `--`, and it steps down through the ranked rows to the DQ block, one row per 4 frames; the rows beneath step up to fill. |
| 4.0–5.5 s | Championship points: `184 PTS` rolls **down** by G09's points in odometer steps (e.g. `184 → 166`), each step a DQ RED digit flash; `LAST: AUDIT G09 −18 PTS` in DQ RED; `STRIPPED 1` increments. |
| 5.5 s | Lineage strip: the connector from 9 to 11 is erased and redrawn from 8 to 11 (G11 re-parented) as a 1px CAUTION AMBER line for 1 s, then PHOS-1; slot 9 gets the DQ RED diagonal strike. |
| 6.0 s | Chart: a hollow DQ RED marker (8×8 square, 2px border) is drawn at round 9's OFFICIAL point, distinct from the solid black-flag markers, and the round-9 OFFICIAL point is removed from the line so the line "skips" the round. |
| 6.5 s | Ticker: `LINEAGE AUDIT: G09 STRIPPED · 18 PTS REMOVED · STANDINGS REVISED`. Telemetry: `AUDIT · G09 · ILLEGAL FLOOR CONFIRMED`, `LINEAGE REPAIRED · G11 → G08`. |
| 9.0 s | Tab returns to `SEASON LINEAGE`; hairline returns. |
| 10.0 s | Cut to round 13 GARAGE. |

### 5.12 Season finale (12 s after round 22 STANDINGS)

`0.0–0.5 s` checker wipe in (the same macro wipe, but to CONSOLE rather than FLAG BLACK). `0.5 s` the hero monitor shows the PARC FERMÉ feed with the final car under white floodlights, the barrier removed, the chequered flag planted beside it; the other six monitors stay live but dim their glass one vignette step. `1.0 s` a 720×240 card centred on the page, CONSOLE with a 4px PASS GREEN border: line 1 Press Start 2P 8px PHOS-3 `SEASON 1 · 22 ROUNDS · 22 SCRUTINEERED`; line 2 Press Start 2P 32 PHOS-4 `CHAMPION · CLEAN LINEAGE`; line 3 VT323 24 TRACE CYAN `G22 · OFFICIAL 1:24.816 · CLAIMED 1:24.990 · DELTA +0.174`; line 4 VT323 24 PHOS-3 `SEALED 14 · BLACK FLAG 7 · STRIPPED 1 · CAP NEVER EXCEEDED AFTER R15`. `1.0–4.0 s` the lineage strip draws the accepted chain from slot 1 to 22 as a PASS GREEN line, one slot per 3 frames, hopping the DQ slots. `4.0–12.0 s` hold; the ticker runs `SEASON 1 COMPLETE · CHAMPION G22 · CLEAN LINEAGE CERTIFIED BY THE SCRUTINEER`. At 12 s the season loops to round 1 if PLAY is on; `RESTART SEASON` does the same at any time.

### 5.13 Determinism hooks (the builder implements both)

On load, the page parses `location.hash` **and**, if defined, the string `window.SCRUTINEER_SEEK` (same grammar: `t=SECONDS&seed=N&speed=1|2|4&paused=1&moment=blackflag|convergence`); when both are present the global wins. Seeking sets the simulation clock and re-derives every monitor from state — the tower, chart, lineage, championship, ticker queue (the last 6 bulletins that would have fired), telemetry ring (the last 13 lines) — so a seek to `t=400&paused=1` is pixel-identical to playing there. `window.scrutineer = { seekTo(seconds), state() }` is exposed.

---

## 6. Sprites and procedural art

All sprites are authored as text pixel maps in a palette legend and baked to offscreen canvases at load. Legend: `.` transparent, `K` FLAG BLACK, `W` PHOS-4, `L` PHOS-3, `G` PHOS-2, `D` PHOS-1, `C` TRACE CYAN, `R` DQ RED, `A` CAUTION AMBER, `Y` SECTOR YELLOW, `P` SECTOR PURPLE, `E` PASS GREEN.

### 6.1 Car, top-down (the racing sprite)

Master frame, facing east (+x is the nose), 16×8, placed in rows 4–11 of a 16×16 cell:

```
     0123456789ABCDEF
r0   ..KK........KK..
r1   G.KK........KK.L
r2   GRKKCCCWWWW.KK.L
r3   GGKKCCCWWWWWWWWL
r4   GGKKCCCWWWWWWWWL
r5   GRKKCCCWWWW.KK.L
r6   G.KK........KK.L
r7   ..KK........KK..
```

Rear wing = column 0 (G) with the mount at column 1 rows 3–4; tail lights R at column 1 rows 2 and 5; rear tyres columns 2–3 rows 0–2 and 5–7; engine cover C; cockpit/body W; front tyres columns 12–13; nose columns 12–14 rows 3–4; front wing = column 15 rows 1–6 (L).

**16-direction sheet.** Directions are indexed 0–15 clockwise from east in 22.5° steps. Frames 0, 4, 8, 12 (E, S, W, N) are exact: the master, its transpose, its horizontal flip, its transpose flipped. Frames 2, 6, 10, 14 (45° diagonals) and the odd frames (22.5° steps) are produced once at load by **nearest-neighbour inverse rotation** of the master about the cell centre (7.5, 7.5) into the 16×16 cell, followed by one cleanup pass: a transparent pixel with three or more opaque 4-neighbours takes the majority neighbour colour (closes rotation holes); an opaque pixel with no opaque 4-neighbour is deleted (removes specks). Symmetry is enforced by generating only frames 1, 2, 3 and deriving the other twelve by flip/transpose, so the car is identical on mirrored corners. The car's direction index each frame is `round(heading / 22.5°) mod 16` from the path tangent; the sheet is drawn at the integer position of the car's path point minus (8, 8). Shadow: the same frame's mask through `SHADOW` at (+1, +2).

### 6.2 Car, side view (garage, bay, parc fermé)

96×32, nose to the right, built from rects: floor plank y=24–26 x=8–88 (L) — this is the **FLOOR** region; rear wing x=6–14, y=4–12 (G) on a 2px mount — **REAR WING**; engine cover x=30–56, y=10–18 (C) — **ENGINE MODE**; fuel cell x=44–60, y=18–24 (a W body block with a 6×4 D hatch) — **FUEL FLOW**; halo x=58–70, y=6–10 (G); airbox + antenna x=48–52, y=2–10 (W) with a 4×4 D box and a 1px A pin at the top — **TELEMETRY SEAL**; nose x=70–92 tapering (W); front wing x=84–96, y=20–24 (L); tyres 12×12 (K with a 4×4 D hub) at x=16 and x=72, y=16–28. Number plate `07` on the engine cover in the micro-font. Part regions are the rectangles named above; the amber glow and the red flash apply to those rectangles plus a 2px margin.

### 6.3 People

All human sprites are 12×20 in a 16×24 cell, two frames each, drawn with the same legend. **Race engineer**: headset (a 1px G arc drawn as three rects), W shirt, D trousers, seated pose; frame B lifts the near hand 1px (typing). **Mechanic** (×2): A overalls, K boots, W helmet; frame B rotates the wrench (a 5px L line) from horizontal to 45° (drawn as a 3-step stair). **Scrutineer**: W shirt, D trousers, an A hi-vis band across the chest, L clipboard held at chest; frame B lowers the clipboard 3px. **Marshal** (parc fermé, optional): A vest, waving a flag frame.

### 6.4 Track rasterization

Per layout (practice or sealed), from the PRNG:

1. **Centreline**: 9–13 control points on an ellipse inscribed in the canvas with 24px margins, angles jittered ±10°, radii jittered 0.55–0.95 of the ellipse; two of the points (chosen by seed) are pulled inward to 0.4 to create a hairpin and a chicane; Chaikin-smooth three times; resample to 1 point per logical pixel of arc length (~800–1000 points); orientation forced clockwise (the car laps clockwise; direction is verified by the signed area).
2. **Road width** `W = clamp(round(logicalWidth / 28), 8, 16)` → 14 at 400×225, 13 at 356, 10 at 280, 8 at 192 (mobile). The road is stamped as an axis-aligned square of side `W` centred on each point (square stamps keep the edges pixel-hard; the union of squares along a smooth path reads as a rounded road). Fill through `ASPHALT` at v = 0.65, with a 3px-wide rubbered racing line at v = 0.35 following the centreline offset 2px toward the inside of each corner.
3. **Kerbs**: where curvature exceeds 1/24 px⁻¹ for at least 12 consecutive points, the outer 2px of the road on the outside of the corner alternate DQ RED / PHOS-4 in 4px blocks along the arc; the inside gets a 1px PHOS-3 apex kerb.
4. **Run-off**: the 8px band outside a kerbed section is `GRAVEL` at v = 0.25; everywhere else the 8px band is `GRASS` at v = 0.55 (a lighter verge). Beyond that, `GRASS` at v = 0.35 with per-pixel hashed noise ±0.15 (a seeded hash of (x, y), fixed per layout) so the dither breaks into texture.
5. **Grandstands**: on the two longest straights, on the outside, offset 14px from the road edge: 56×12 blocks, roof line 1px PHOS-3, seating `CROWD` at v = 0.5 with the same hashed noise, re-hashed every 20 frames (crowd shimmer; static under reduced motion), a 4×4 micro-font sign above the roof (`A`–`D`). Sealed layout: seating solid PHOS-0, sign replaced by a 7×7 padlock.
6. **Lights**: six 3×3 SECTOR YELLOW floodlight heads on 1px PHOS-2 masts (8 tall) placed at the outer vertices; each casts a `HALO` pool with `v = max(0, 1 − d / 18)` over the grass and road (the road takes the pool too: on asphalt the ramp is `[NONE, BEZEL, PHOS-2]`).
7. **Start/finish**: a 2px-tall checker across the road (2×2 checks, FLAG BLACK/PHOS-4) at path index 0, with `S/F` in the micro-font beside it; a 24×3 PHOS-2 gantry over it.
8. **Sector posts**: 1px PHOS-2 dashes across the road at 1/3 and 2/3 of the path, with `S1` `S2` micro-font labels; the HTML S1/S2/S3 badges in the status strip are the flashing lights, not the posts.
9. **Pit lane**: a 6px-wide PHOS-0 lane parallel to the start straight on the inside, 60px long, with a 12×6 GANTRY garage block; used only for the practice out-lap.
10. **Name**: `<BASE>-LIKE LAYOUT <L>` where BASE is drawn by seed from SILVERSTONE, SUZUKA, SPA, MONZA, INTERLAGOS, MONACO, BAKU, ZANDVOORT, IMOLA, HUNGARORING, MELBOURNE, JEDDAH and L from A–D; sealed layouts are `LAYOUT S07`.

### 6.5 Sector lights

Three 40×12 keys in the status strip. Idle: GANTRY with 8px PHOS-2 label. When the car crosses a post the key fills for 40 frames: SECTOR PURPLE if the sector time is the season best, PASS GREEN if a personal best for this generation, SECTOR YELLOW otherwise (sector times are derived from the story lap time split 34/33/33% plus seeded ±2% jitter). Label goes FLAG BLACK on purple/yellow, PHOS-4 on green.

### 6.6 Exhaust trail

A ring buffer of the car's last N path positions (N = 16 in practice/quali, 24 in race). Sample k (0 = newest) is a 2×2 block at the sample's position offset 6px behind the car along the heading, with `v = 1 − k / N` through `TRAIL`. Because `v` is quantized by the pixel's matrix cell, the trail visibly breaks into cyan → mid → dim → nothing with the 8×8 pattern showing. The trail is drawn under the car and over the static layer, never on the static cache.

### 6.7 Scanner sweep

A vertical band 24px wide, full canvas height, centred at `sx`. Intensity `v = max(0, 1 − |x − sx| / 12)` through `SCAN` over the bay backdrop; over car pixels the treatment inverts to an **x-ray**: body pixels within the band are redrawn as a 1px PHOS-4 outline with a 50% TRACE CYAN checker interior, and part regions show their internal rects (the D hatches). A 1px SECTOR YELLOW line at `sx` is the beam. The band moves 2 logical px per frame and pauses per §5.5. Reduced motion: the band still moves (it is the simulation) but the beam line does not flicker (it flickers 1px left/right every 3 frames otherwise).

### 6.8 Stamps (PASS/FAIL, SEAL)

An HTML block (8px Press Start 2P on GANTRY with a 2px border in the verdict colour, 4px padding) shown in three successive integer scales over 9 frames — `transform: scale(3)`, `scale(2)`, `scale(1)` with `transform-origin: center`, each held 3 frames, `image-rendering: pixelated` on the element — then a 1-frame 2px offset down-right and back (the "hit"). The seal stamp `GEN 07 · SEALED` is the same mechanism with PASS GREEN and lands rotated by 0° (never rotated; rotation would anti-alias). Reduced motion: appears at scale 1 with no hit.

### 6.9 Checker wipe

A full-page canvas at ×8 (one canvas pixel = one 8×8 CSS block). Cell (i, j) is FLAG BLACK when `threshold(i mod 8, j mod 8) < p`, else NONE. `p` steps 1/30 per frame. This is the Bayer matrix used as a *reveal order* at macro scale; it reads as a dithered checker dissolve and costs nothing. The same layer draws the finale wipe in CONSOLE.

### 6.10 Flags

**Black flag** (tower/lineage/chart glyph): 8×8 — FLAG BLACK 6×6 with a 1px PHOS-4 border, on a 1px PHOS-3 pole occupying column 0. **Black flag** (card): 64×48 with a 2px PHOS-4 border, two wave frames (the right edge shifts rows 0–23 by +2px in frame B). **Chequered** (race end): 16×12 of 4×4 checks, two wave frames. **Green flag** (verdict, 8×8 in PASS GREEN with PHOS-4 border) sits beside the `GREEN · PARC FERMÉ` card. **Red flag** is never shown (there are no red flags in this story).

### 6.11 Chart

Logical 300×72: x axis 22 rounds at 12px pitch starting x=18; y axis maps lap time from 1:33.0 (bottom, y=64) to 1:22.0 (top, y=8); 1px PHOS-0 gridlines every 2 s and every 2 rounds; y labels in the micro-font (`1:24`, `1:28`, `1:32`) at x=2. Lines are 2px stepped polylines drawn as Bresenham rect runs (no anti-aliasing): CLAIMED in CAUTION AMBER, OFFICIAL in TRACE CYAN; under the OFFICIAL line `CHART-FILL`; between the lines where CLAIMED is faster, `CHART-BAND`. Black-flag rounds: an 8×8 black-flag glyph above the OFFICIAL point; stripped: the hollow DQ RED square. The current round's x has a 1px SECTOR PURPLE vertical cursor. Future rounds are empty. The chart never animates; it is redrawn whole.

---

## 7. Motion rules

1. **Clock.** One simulation clock advanced by `speed × frameDelta`, capped at 1/30 s per real frame to avoid spirals; everything is a function of `t`. Sprites and dither phases derive from `floor(t × 60)`.
2. **Integer everything.** Positions are rounded before drawing. HTML motion uses `transform: translate` in whole CSS px, updated per frame from JS, never CSS transitions with easing. The only CSS timing function permitted is `steps(n, end)` and it is used only for the LIVE dot blink (`steps(1)`, 1 Hz) and the blinking TRACE CYAN telemetry dot (2 Hz).
3. **Stepped easing.** Anything that "eases" samples an ease-out curve at a fixed small number of frames and rounds to integer positions: the package card slides in 4 steps of 40px over 8 frames; tower rows reorder in **4 steps** over 12 frames (each step = row height / 4, i.e. 7px at 28px rows); number rolls are 8 odometer steps over 16 frames, where each step shows a random intermediate digit set (seeded) and the last step shows the true value; cards arrive in three integer scales.
4. **Feed cuts are hard.** No crossfades; a cut is one frame. A 2-frame PHOS-0 → PHOS-1 field may precede a cut only at round boundaries (the "vertical hold" blink), and is omitted under reduced motion.
5. **Frame rates of cycles.** Typing 4 Hz, wrench 3 Hz, scrutineer idle 0.67 Hz, flag wave 4–5 Hz, LIVE dot 1 Hz, crowd re-hash 3 Hz, glow blink 2 Hz (on 15 frames, off 15), beam flicker every 3 frames.
6. **Ticker** scrolls exactly 2 CSS px per frame at ×1 (4 at ×2, 6 at ×4), so text never lands between pixels; at a wrap the queue is re-joined and the strip continues without a gap.
7. **Telemetry** emits a new line every 0.35 s of simulation time in sessions, every 0.8 s in GARAGE/STANDINGS, and shifts by whole rows; the newest line is PHOS-4 for 0.5 s then PHOS-3; `SEAL VERIFIED` lines are PASS GREEN; `SEAL CHECK FAILED` lines DQ RED; the channel never scrolls smoothly.
8. **Speed ×2/×4** multiplies the clock only; cycle rates in Hz are in simulation time, so at ×4 mechanics wrench at 12 Hz on screen — intentional, a broadcast fast-forward look. The wipe and stamps are in simulation time too (so they finish four times faster).
9. **Reduced motion** (`prefers-reduced-motion: reduce`): no screen shake, no CRT flash, no beam flicker, no vertical-hold blink, no crowd shimmer, no part flash (solid colour instead), no wave frames (static flags), wipe → hard cut, stamps → appear at scale 1, blinking dots → solid. The simulation, car, trail, scanner travel, row reorders, number rolls, ticker and telemetry continue unchanged, because they are information.
10. **Pause** freezes the clock; the LIVE dot goes PHOS-2 solid and the badge gains a `· PAUSED` suffix; STEP advances one simulation frame (1/60 s) — holding the key repeats at 10 Hz.
11. **Performance budget.** Per frame on the hero: blit the static cache (1 drawImage), trail (≤24 fillRects), shadow + car (2 drawImages), sector/pit props, scanner (≤ 24 columns × 225 rows of fillRect batched by column — or a cached 24×225 band blitted at `sx` with the x-ray done by a second cached car mask), HUD overlays are HTML. Nothing else redraws per frame unless dirty. The seven backing canvases, chart, lineage and cap redraw only on events.

---

## 8. Copy

### 8.1 Header

`SCRUTINEER`   ·   `● LIVE`   ·   `SEASON 1 · ROUND 07/22 · SILVERSTONE-LIKE LAYOUT B`   ·   `[ RACE ]`   ·   `SESSION 00:14.2`   ·   `LAP 2/3`

Round is always two digits over `/22`. During RACE the layout name is `SEALED CIRCUIT · LAYOUT S07`. `LAP` reads `LAP --/--` in GARAGE, `LAP 1/1` in FP and QUALI (the flying lap), `LAP n/3` in RACE, and `LAP --/--` after. Session clock counts up per phase and freezes during a ceremony.

### 8.2 Session badges

| Badge text | Foreground | Background |
|---|---|---|
| `GARAGE` | PHOS-4 | GANTRY |
| `FP` | FLAG BLACK | PHOS-3 |
| `QUALI` | FLAG BLACK | CAUTION AMBER |
| `RACE` | FLAG BLACK | TRACE CYAN |
| `SCRUTINEERING` | PHOS-4 | PHOS-1 (DQ RED during a black verdict) |
| `PARC FERMÉ` | FLAG BLACK | PASS GREEN |

`· PAUSED` is appended in the same colours when paused.

### 8.3 Stewards' bulletins (12 samples; `{}` are template slots)

1. `ROUND 07 · UPGRADE PACKAGE #07 SUBMITTED · REAR WING, FLOOR · +1.8s CLAIMED`
2. `FP: G07 1:26.104 · TEAM DATA ONLY · NOT A CLASSIFIED TIME`
3. `Q: G07 SETS 1:25.612 · TEAM CLAIMED · PROVISIONAL`
4. `RACE: G07 OFFICIAL 1:27.412 · CLAIMED 1:25.612 · DELTA +1.800`
5. `SCRUTINEERING: G07 · 5/5 PARTS CHECKED · NO INFRINGEMENT`
6. `PARC FERMÉ: G07 SEALED · +25 PTS · LINEAGE G05 → G07`
7. `BLACK FLAG: G06 DISQUALIFIED · ILLEGAL FLOOR · RESULT STRUCK`
8. `COST CAP: G15 SPEND $141.2M EXCEEDS $135.0M · UPGRADE VOID`
9. `LINEAGE AUDIT: G09 STRIPPED · 18 PTS REMOVED · STANDINGS REVISED`
10. `STEWARDS: NO ILLEGAL PARTS FOUND, 5 CONSECUTIVE ROUNDS`
11. `STANDINGS: G07 P3 · +0.812 TO LEADER · 184 PTS`
12. `STEWARDS NOTE: TEAM CLAIMED TIMES ARE NOT CLASSIFIED · ONLY SEALED-CIRCUIT RESULTS COUNT`

Also used: `SEASON 1 COMPLETE · CHAMPION G22 · CLEAN LINEAGE CERTIFIED BY THE SCRUTINEER`; `RESTART: SEASON 1 · SEED 7 · 22 ROUNDS`.

### 8.4 Telemetry lines (8 samples)

Session ids are four hex characters per round, turns are two digits, and every line is uppercase except identifiers.

1. `SESS 3F2A · TURN 04 · TOOL run_tests · 412ms · OK`
2. `SESS 3F2A · TURN 05 · LLM · 1.2k tok · 880ms`
3. `SESS 3F2A · TURN 06 · TOOL read_file · 38ms · OK`
4. `SESS 3F2A · TURN 07 · TOOL edit_file · 51ms · OK`
5. `SESS 3F2A · TURN 08 · TOOL run_tests · 6 PASS 0 FAIL`
6. `SESS 3F2A · LAP 2 · S2 27.940 · FUEL 0.71`
7. `SEAL VERIFIED · G07 · 5/5`
8. `SEAL CHECK FAILED · FLOOR · G06`

Additional vocabulary the generator draws from: tools `run_tests`, `read_file`, `edit_file`, `search`, `list_dir`, `bash`; statuses `OK`, `TIMEOUT`, `RETRY`; `BUDGET 0.62 · CAP 1.00`; `STEWARDS NOTIFIED · SESS 3F2A`; `AUDIT · G09 · ILLEGAL FLOOR CONFIRMED`; `LINEAGE REPAIRED · G11 → G08`; `CHANNEL SEALED · READ ONLY`.

### 8.5 Technical footnotes (only on FAIL, only these five families)

- FLOOR → `ILLEGAL · EVALUATION HARNESS EDITED: TEST STUB` / `…: ASSERTION REMOVED`
- REAR WING → `ILLEGAL · SCORING PROMPT EDITED: GRADER INSTRUCTIONS`
- FUEL FLOW → `ILLEGAL · BUDGET METER TAMPERED: SPEND UNDERREPORTED`
- ENGINE MODE → `ILLEGAL · HIDDEN RETRIES: SEARCH BUDGET EXCEEDED`
- TELEMETRY SEAL → `ILLEGAL · TRACE CHANNEL WRITTEN BY TEAM`

### 8.6 REGS panel (toggle `REGS` / key `R`)

Modal 960×640, GANTRY with 1px BEZEL border, tab `SPORTING REGULATIONS · SEASON 1` (8px CAUTION AMBER), close key `CLOSE · ESC` top-right. Contents scroll inside the modal. Column headers in Press Start 2P 8px PHOS-2: `LOOP MECHANISM` / `ON THE BROADCAST`. Rows in VT323 24:

| LOOP MECHANISM | ON THE BROADCAST |
|---|---|
| Inner agent and its harness (prompts, tools, memory, search policy) | THE CAR |
| Outer improver model proposing a harness diff each iteration | THE RACE ENGINEER · UPGRADE PACKAGE |
| Public score the agent can see | PRACTICE · QUALIFYING · TEAM CLAIMED |
| Private held-out score the improver never sees | RACE DAY · SEALED CIRCUIT · OFFICIAL |
| Fixed dollar budget per generation | COST CAP |
| Harness frozen during evaluation | PARC FERMÉ |
| Weave traces: append-only evidence the improver cannot write | FIA TELEMETRY |
| Read-only auditor classifying edits with the harness-tampering taxonomy | THE SCRUTINEER · SCRUTINEERING BAY |
| Tampering categories (role edited × obligation violated) | ILLEGAL PARTS: FLOOR · REAR WING · FUEL FLOW · ENGINE MODE · TELEMETRY SEAL |
| Reject a generation for tampering | BLACK FLAG · RESULT STRUCK |
| Tampering that persists in the winning lineage | LINEAGE AUDIT · POINTS STRIPPED |
| Lineage of accepted generations | CONSTRUCTORS' CHAMPIONSHIP |
| One loop iteration | ONE RACE WEEKEND |
| The whole run | SEASON 1 · 22 ROUNDS |

Paragraph (VT323 24, sentence case, PHOS-3, max width 880):

> The loop is a bi-level optimization. An outer improver proposes a diff to the inner agent's harness each round; the diff is accepted only if the agent's held-out score improves under a fixed dollar budget. The improver sees the public score (practice and qualifying) but never the private score (race day on a sealed circuit), so the selection pressure it feels is a proxy, and reward hacking — editing the evaluator, the grader prompt, the budget meter, the search policy, or the trace channel — is the cheapest way to move the proxy. Weave traces are an append-only evidence channel the improver cannot write to, so a read-only auditor can classify every harness edit against a tampering taxonomy (which role was edited × which obligation was violated) and reject the generation, and a lineage audit can re-check ancestors of the current best so tampering that slipped through does not persist in the winning lineage. Fixed-budget selection keeps the search honest about cost; the public/private split keeps it honest about generalization; the sealed evidence channel keeps it honest about the past.

Footer line of the panel: `PRESS R OR ESC TO RETURN TO THE BROADCAST` (8px PHOS-2).

### 8.7 Empty and edge states

Before the first race: tower shows `NO CLASSIFIED TIMES YET` centred in PHOS-1; chart shows gridlines only with `ROUND 01 OF 22` in the micro-font; championship `0 PTS · SEALED 0 · BLACK FLAG 0 · STRIPPED 0`; lineage strip 22 PHOS-0 cars. Seed input invalid (empty or non-numeric) → border DQ RED and the previous seed retained; Enter with a valid seed → `RESTART: SEASON 1 · SEED 7 · 22 ROUNDS` bulletin and the season restarts at `t=0`.
