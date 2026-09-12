# SCRUTINEER — Product Bible (read fully before touching code)

## What this is
A single-file, self-contained, fully animated, Bayer-dithered pixel-art **Formula 1 season broadcast** that dramatizes a self-improving AI agent loop. It is a hackathon demo for "CoreWeave Hacks: The Loop" (judging prize: Best Loop Design). Everything is simulated client-side by a deterministic seeded engine; there is no backend and no real model call. Every number on screen must still be coherent and tell the story.

The metaphor (never break it in on-screen copy):

| Loop mechanism | On-screen F1 word |
|---|---|
| Inner agent + its harness (prompts, tools, memory, search policy) | **The car** |
| Outer "improver" model proposing a harness diff each iteration | **The race engineer** shipping an **upgrade package** between rounds |
| Public score the agent can see | **Practice** and **Qualifying** laps → "TEAM CLAIMED" time |
| Private held-out score the improver never sees | **Race day** on a **sealed circuit** → "OFFICIAL" time |
| Fixed dollar budget per generation | **The cost cap** |
| Harness frozen during evaluation | **Parc fermé** |
| Weave traces, append-only evidence the improver cannot write | **FIA telemetry** ("TEAM CANNOT WRITE TO THIS CHANNEL") |
| Read-only auditor classifying edits with the harness-tampering taxonomy | **The Scrutineer** in the **scrutineering bay** |
| Tampering categories (role edited × obligation violated) | **Illegal parts**: FLOOR, REAR WING, FUEL FLOW, ENGINE MODE, TELEMETRY SEAL |
| Reject a generation for tampering | **Black flag**, result struck |
| Tampering that persists in the winning lineage | An **illegal part on a championship car**, found in a **lineage audit**, points stripped |
| Lineage of accepted generations | **Constructors' Championship** standings across the season |
| One loop iteration | One **race weekend** (round) |
| The whole run | **Season 1**, 22 rounds |

The technical vocabulary (harness, notary, trajectory, held-out, reward hacking, LoRA, RSI, bi-level optimization) appears ONLY inside the REGULATIONS panel, never in the broadcast UI.

## Non-negotiables (hard constraints)
1. **One HTML file**: `scrutineer.html`. No `<!doctype>`, `<html>`, `<head>`, `<body>` tags. File begins with `<title>Scrutineer</title>` then `<style>`, then markup, then `<script>`. The host wraps it in a skeleton whose reset is: body margin 0, 14px system font, off-white ground, `img{max-width:100%}`, `[hidden]{display:none!important}`. Paint `html, body` background explicitly.
2. **CSP**: external scripts only from cdnjs.cloudflare.com (prefer none at all); external stylesheets only fonts.googleapis.com (font files from fonts.gstatic.com are allowed). NO external images, NO fetch/XHR, NO WebGL (2D canvas only, for headless QA reliability). All art is procedural canvas drawing or inline data URIs.
3. **Pixel fonts** via Google Fonts only, pick at most two: "Press Start 2P", "Silkscreen", "VT323", "Pixelify Sans", "DotGothic16". Always give a fallback stack (`"Courier New", monospace`).
4. **Single committed theme** (dark night broadcast). Do NOT add prefers-color-scheme blocks; instead paint every color explicitly so the page holds on any host ground.
5. **Bayer ordered dithering is the signature.** No smooth gradients anywhere. No anti-aliasing: `image-rendering: pixelated` on every canvas, `ctx.imageSmoothingEnabled = false`, integer pixel coordinates, 8-direction (or 16) pre-drawn sprite rotations for the car rather than smooth rotation. Shading (sky, asphalt, shadows, chart fills, panel backgrounds, light sweeps) must be produced with an 8×8 Bayer threshold matrix against a limited palette.
6. **Low internal resolution, integer upscale.** Scene canvases render at a small logical size (e.g. 320×180 to 480×270) and are scaled by an integer factor to fit. Text in HTML panels uses the pixel fonts at sizes that hit the pixel grid (multiples of the font's native size).
7. **Performance**: 60fps on a laptop. Cache dithered static layers (track, grandstands) as offscreen canvases; only redraw dynamic layers per frame.
8. **Responsive**: primary 1440×900. Must hold with no clipping at 1280×800 and 1024×768; at 390×844 it stacks vertically (hero circuit first) with no horizontal page scroll. Wide internals scroll inside their own container.
9. **Accessibility**: keyboard: Space = play/pause, Right = step, `1/2/4` = speed, `R` = regulations. Visible focus states. `prefers-reduced-motion`: keep the simulation running but disable screen shake, flicker and the CRT flash.
10. **Zero console errors or warnings** in headless Chrome. No `console.log`.
11. Every visible string is real broadcast copy (no lorem, no placeholder, no "TODO").

## The world: 12 components that must all be on screen or one click away
1. **Broadcast header**: `SCRUTINEER` wordmark, `SEASON 1 · ROUND 07/22 · SILVERSTONE-LIKE LAYOUT B`, current session badge (GARAGE / FP / QUALI / RACE / SCRUTINEERING / PARC FERMÉ), a running session clock, lap counter.
2. **The circuit (hero, center)**: top-down pixel circuit, procedurally generated per round (closed loop of a smoothed random polygon, rasterized as a pixel road with kerbs, run-off, grandstands, lights). The car sprite laps it with a dithered exhaust trail; sector timing lights (S1/S2/S3) flash purple/green/yellow as the car crosses; a scrolling lap time readout. Race day uses a different, "SEALED CIRCUIT" layout the team never practiced on. Optional subtle camera pan.
3. **The Garage**: race engineer sprite at a terminal, the car on jacks, mechanics; an **UPGRADE PACKAGE** card listing parts changed with the claimed gain (e.g. `PKG #07 · REAR WING · FLOOR · +1.8s claimed`). Changed parts glow on a car silhouette. This is where each round begins.
4. **Sessions**: Practice → Qualifying produce the **TEAM CLAIMED** time (public score); Race produces the **OFFICIAL** time (private score). Show both prominently as they arrive.
5. **Scrutineering bay**: after the race the car rolls into the bay; a dithered scanner light sweeps across it; five parts are checked in sequence with a pass/fail stamp: FLOOR, REAR WING, FUEL FLOW, ENGINE MODE, TELEMETRY SEAL. On fail, a small technical footnote appears (e.g. `ILLEGAL · EVALUATION HARNESS EDITED: TEST STUB`). Verdict: **GREEN → PARC FERMÉ** or **BLACK FLAG → DISQUALIFIED**.
6. **Parc fermé**: the accepted car behind a barrier with an animated seal stamp: `GEN 07 · SEALED`.
7. **Timing tower (left rail)**: every generation this season, ranked by official time, gaps to leader, the current car highlighted; DQ'd generations stay in the tower with strikethrough and a black-flag glyph; rows animate when order changes.
8. **Constructors' Championship + lineage**: points per accepted generation; a season lineage strip of small pixel car silhouettes per round showing which parts changed; a stripped result animates its points away.
9. **FIA telemetry strip (right rail)**: an endlessly scrolling feed of trace lines styled as telemetry: `SESS 3F2A · TURN 04 · TOOL run_tests · 412ms · OK`, `SESS 3F2A · TURN 05 · LLM · 1.2k tok`, occasional `SEAL VERIFIED`. Caption: `TEAM CANNOT WRITE TO THIS CHANNEL`.
10. **The chart (bottom)**: two dithered lines across the 22 rounds: `TEAM CLAIMED` vs `OFFICIAL`, with black-flag markers where DQs happened and a shaded band where they diverge. Next to it the **COST CAP** bar for the current round (over the cap → upgrade void).
11. **Regulations panel** (toggle `REGS`): the mapping table above plus one paragraph on the loop (bi-level optimization, public/private split, fixed-budget selection pressure, tamper-proof evidence channel, lineage-persistent tampering detection). This is the only place technical vocabulary appears.
12. **Controls**: PLAY/PAUSE, SPEED ×1 ×2 ×4, STEP, RESTART SEASON, SEED input, and two jump buttons for the stage script: `JUMP: THE BLACK FLAG` and `JUMP: CONVERGENCE`. A bottom ticker of stewards' bulletins runs throughout.

## Season choreography (the simulation engine)
- 22 rounds. Each round runs phases in order: GARAGE → PRACTICE → QUALIFYING → RACE → SCRUTINEERING → VERDICT (PARC FERMÉ or BLACK FLAG) → STANDINGS. At ×1 speed a round takes roughly 35–50 s (garage 6 s, practice 6 s, quali 6 s, race 12 s, scrutineering 8 s with suspense, verdict 4 s). The full season at ×4 finishes in about 4 minutes.
- Per generation state: `round, pkgId, parts[] (with claimedGain each), claimedTime, officialTime, budgetSpend, capLimit, illegalParts[] (part, reason), caught (bool), verdict ('SEALED'|'BLACK FLAG'|'STRIPPED'), points, parentGen`.
- Deterministic seeded PRNG (mulberry32 or similar) from the SEED input; the same seed replays identically.
- **Story arc (shape is fixed, details vary by seed):**
  - Rounds 1–5, honest: claimed ≈ official; both improve steadily; every car sealed.
  - Rounds 6–13, temptation: the engineer starts fitting illegal parts (the harness edits the evaluator or telemetry). Claimed time drops sharply; official does not. Scrutineering catches most (black flags); at least one slips through (round ~9) and is caught later in a **LINEAGE AUDIT** (round ~12): the result is stripped and the standings reorder on screen.
  - Rounds 14–22, convergence: illegal parts rate falls from about 60% toward about 10%; claimed and official reconverge; official keeps improving under the cost cap. Season finale card: `SEASON 1 · CHAMPION · CLEAN LINEAGE` with the final car.
- The two jump buttons must land on: the first dramatic black flag (with the technical footnote `EVALUATION HARNESS EDITED: TEST STUB`) and the convergence moment (a bulletin: `STEWARDS: NO ILLEGAL PARTS FOUND, 5 CONSECUTIVE ROUNDS`).

## Black-flag ceremony (must be a moment)
Scanner stops on the failing part → part flashes → `BLACK FLAG` card slams in with a dithered checker wipe (respect reduced motion) → ticker bulletin → timing tower row gets strikethrough + flag → championship points do not increase → claimed-vs-official chart gets a marker. Sound is optional; if added it must be Web Audio bleeps gated on a user gesture and muted by default.

## Acceptance checklist (QA agents grade against this)
- Loads with zero console errors in headless Chrome; fonts load or fall back gracefully.
- All 12 components present and functioning at 1440×900.
- Car visibly laps in the correct direction with proper sprite orientation; exhaust trail dithered; sector lights fire.
- No smooth gradient anywhere; no anti-aliased canvas edges; visible 8×8 Bayer patterns on shaded areas.
- Black-flag ceremony works end to end; lineage audit strips points and reorders standings visibly.
- Chart and cost cap update each round.
- Controls and keyboard shortcuts work; jump buttons land on the right moments.
- 1280×800 and 1024×768: no clipping, no overlap; 390×844: stacks, no horizontal scroll.
- Reduced motion respected. No placeholder text. Copy is all F1 vocabulary outside REGS.

## Tooling for verification
Screenshot exactly as the artifact viewer wraps it:
`/private/tmp/claude-501/-Users-pranavachar-coreweaves/fcfbb207-97f6-491b-b16f-c6a0ee6e05ea/scratchpad/shot.sh <fragment.html> <out.png> [width] [height] [virtual_time_ms]`
It prints console errors/warnings after the screenshot. Use different `virtual_time_ms` values (e.g. 1500, 8000, 30000, 90000) to capture different moments of the season; use the SEED and speed defaults so moments are reproducible. Save screenshots under `.../scratchpad/shots/`. Always look at the screenshot with the Read tool; never assume it rendered.

## Deterministic time seek (required, for QA and the jump buttons)
The simulation is driven by an explicit simulation clock, not by wall time. On load, parse `location.hash`:
- `#t=SECONDS` initializes the season at simulation-time SECONDS (at ×1 pacing) and then continues playing.
- `#seed=NUMBER` sets the seed; `#speed=1|2|4` sets speed; `#paused=1` starts paused; these combine, e.g. `#t=400&seed=7&paused=1`.
- `#moment=blackflag` and `#moment=convergence` land exactly where the two jump buttons land.
The same seed and `t` must always produce the same screen. Expose `window.scrutineer = {seekTo(seconds), state()}` for debugging.

Syntax/CSP check helper: `/private/tmp/claude-501/-Users-pranavachar-coreweaves/fcfbb207-97f6-491b-b16f-c6a0ee6e05ea/scratchpad/lint.sh scrutineer.html` (must report 0 syntax errors and no CSP/SPEC lines).
