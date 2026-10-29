# Arena — Year in AI 2026

A scroll-driven 3D retrospective of 2026's AI milestones. You fly low over an
infinite wireframe plane; labs are extruded slabs whose distance ahead of you
encodes their leaderboard rank, and milestones dock in front of the camera as
you reach their point in the year.

Built with [three.js](https://threejs.org) for the world and plain DOM/SVG for
the HUD, so the type stays crisp and the interface stays selectable and
accessible. No framework, no state library — one `requestAnimationFrame` loop
driving a small immutable-ish state object.

## Run it

```bash
npm install
npm run dev      # http://localhost:5174
npm run build    # static bundle in dist/
npm run preview
```

## The journey

Scroll position maps to a single scalar, `travel`, measured in world units.
Everything else is a function of it.

| travel      | what happens                                                       |
| ----------- | ------------------------------------------------------------------ |
| `0 – 46`    | Title card. Arena column, *Year in* AI 2026, scroll cue.             |
| `46 – 104`  | The horizon resolves: longitudinal lines only, logo at the vanishing point. |
| `104 – 152` | "What a year it's been / 2,000,000 / people voted on arena.ai", streaks, first slabs. |
| `152 – 690` | The year itself: six chapters, 17 milestones, HUD live.              |
| `690 – 794` | The world fades out under the closing card.                          |

Station positions are decoupled from calendar dates. Real milestone dates
cluster (two are six days apart), which would dock two cards on top of each
other, so `src/journey.js` pushes stations apart to a `MIN_GAP` of 24 units and
then builds a piecewise-linear `travel → day` map. The timeline playhead still
lands exactly on each pip, but the flight between them is evenly paced.

## Reading the scene

- **Slabs are labs.** The followed lab sits `followDistance` ahead of you in
  your lane and wears the current category colour; every other lab is offset
  forward or back by `(theirRank − yourRank) × rankSpacing`, so a lab you can
  see in the distance is literally ahead of you on the leaderboard.
- **Chips** are HTML, positioned each frame from the projected top face of
  their slab and joined to it with an SVG elbow leader line.
- **The radar** (bottom right) is a plan view of the same arrangement.
- **Category changes** fire a ripple: the grid warps outward from the camera
  and flashes the incoming colour for ~1.5 s, the timeline label blinks, and
  every lab except the one you follow drops out for a beat before fading back.
- **DATA mode** lifts the camera to 52 units, pitches to 33°, squeezes the pack
  together and turns on the minor grid so the whole field reads at once.

## Controls

| input                         | action                     |
| ----------------------------- | -------------------------- |
| wheel / trackpad / drag       | move through the year      |
| ↑ ↓ , PageUp / PageDown       | move through the year      |
| ← → , Space / Shift-Space     | previous / next milestone  |
| Home / End                    | jump to the start / end    |
| Esc                           | close the milestone index  |

The hamburger opens an index of every milestone; `FOLLOWING` switches which lab
the camera tracks; `⚡ MILESTONES / ▥ DATA` toggles the two camera modes.

## Layout

```
src/
  config.js            palette, categories, world geometry, scroll feel
  journey.js           travel ↔ date mapping, stations, chapters, lab layout
  main.js              state + input + the rAF loop that drives everything
  data/
    labs.js            the eight labs and their illustrative rank series
    milestones.js      six chapter cards, 17 milestone cards, media map
  world/
    stage.js           renderer, camera placement, resize
    grid.js            the ground plane (custom shader: ripple, fade, tint)
    slabs.js           instanced lab slabs + the followed-lab trail
    streaks.js         the speed streaks above and below the horizon
  ui/
    intro.js           title, statement and closing blocks
    hud.js             timeline, nav, brand, mode toggle, radar, index sheet
    world-layer.js     3D-positioned milestone cards, chips, leader lines
    marks.js           inline SVG lab glyphs and the Arena wordmark
  styles/app.css
tools/
  shots.mjs            dev-only: screenshot the scene at given travel values
  smoke.mjs            dev-only: click through the controls, check breakpoints
```

### Grid shader notes

The floor is one large plane with a fragment shader rather than line geometry,
which keeps the near-horizon density under control. Line coverage is derived
from screen-space derivatives (`fwidth`) so distant cells thin out instead of
aliasing into moiré, `uFadeFar` pulls everything into the background colour,
and a narrow Gaussian band re-brightens the horizon the way the mock does.
`uRipple` / `uRippleAge` displace the sampled coordinates along a ring
travelling out at 150 units/second for category transitions.

## Data

The milestones, rank series and screenshots are illustrative — a plausible 2026
rather than a reported one — so the piece can be read end to end without
pretending to be a source. Swapping in real data means editing
`src/data/milestones.js` and `src/data/labs.js`; nothing else knows about the
content.

## Dev tooling

`tools/shots.mjs` and `tools/smoke.mjs` drive a local Chromium through
`playwright-core` against the dev server. They are not part of the build and
need a browser binary:

```bash
node tools/shots.mjs                       # /tmp/shots/t<travel>.png
SHOT_STOPS=0,160,450,690 node tools/shots.mjs
SHOT_MODE=data SHOT_STOPS=450 node tools/shots.mjs
node tools/smoke.mjs                       # interactions + 1280/834/414 widths
```

Point `CHROME_BIN` at any Chromium build. Software rendering works
(`--use-angle=swiftshader`), just slowly.
