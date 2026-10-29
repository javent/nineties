import "./styles/app.css";
import * as THREE from "three";

import { CATEGORY_BY_ID, PALETTE, SCROLL, WORLD, YEAR_DAYS, dayOfYear } from "./config.js";
import { createStage } from "./world/stage.js";
import { createHud } from "./ui/hud.js";
import { createWorldLayer } from "./ui/world-layer.js";
import { createIntro } from "./ui/intro.js";
import {
  CHAPTERS,
  INTRO,
  TOTAL_TRAVEL,
  chapterAt,
  dateForTravel,
  followedTrail,
  labLayout,
  nextStation,
} from "./journey.js";
import { LABS } from "./data/labs.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (u) => u * u * (3 - 2 * u);
const ramp = (t, a, b) => smooth(clamp((t - a) / (b - a), 0, 1));

// ───────────────────────────── state ─────────────────────────────

const state = {
  travel: 0,
  target: 0,
  followed: "openai",
  mode: "milestones",
  dataMix: 0,
  chapter: CHAPTERS[0],
  transition: { age: 99, color: CATEGORY_BY_ID[CHAPTERS[0].category].color },
  booted: false,
};

const smoothed = new Map(
  LABS.map((l) => [l.id, { ahead: WORLD.followDistance, x: 0, opacity: 0, init: false }]),
);

// ───────────────────────────── boot ─────────────────────────────

const canvas = document.getElementById("stage");
const stage = createStage(canvas);

const ctx = {
  step: (dir) => {
    state.target = clamp(nextStation(state.travel, dir).t, 0, TOTAL_TRAVEL);
  },
  jumpTo: (t) => {
    state.target = clamp(t, 0, TOTAL_TRAVEL);
  },
  setMode: (mode) => {
    state.mode = mode;
    hud.setMode(mode);
  },
  setFollowed: (id) => {
    state.followed = id;
  },
  openSheet: () => hud.openSheet(true),
};

const hud = createHud(ctx);
const world = createWorldLayer(stage, ctx);
const intro = createIntro();

hud.setAccent(CATEGORY_BY_ID[state.chapter.category].color);

// ───────────────────────────── input ─────────────────────────────

function nudge(delta) {
  state.target = clamp(state.target + delta, 0, TOTAL_TRAVEL);
}

window.addEventListener(
  "wheel",
  (e) => {
    if (e.target.closest?.(".sheet-inner")) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
    nudge(e.deltaY * unit * SCROLL.wheelScale);
  },
  { passive: false },
);

let touchY = null;
window.addEventListener(
  "touchstart",
  (e) => {
    touchY = e.touches[0].clientY;
  },
  { passive: true },
);
window.addEventListener(
  "touchmove",
  (e) => {
    if (touchY === null) return;
    const y = e.touches[0].clientY;
    nudge((touchY - y) * SCROLL.touchScale * 3);
    touchY = y;
    e.preventDefault();
  },
  { passive: false },
);
window.addEventListener("touchend", () => {
  touchY = null;
});

window.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "ArrowDown":
    case "PageDown":
      e.preventDefault();
      nudge(SCROLL.keyStep * (e.key === "PageDown" ? 3 : 1));
      break;
    case "ArrowUp":
    case "PageUp":
      e.preventDefault();
      nudge(-SCROLL.keyStep * (e.key === "PageUp" ? 3 : 1));
      break;
    case "ArrowRight":
      e.preventDefault();
      ctx.step(1);
      break;
    case "ArrowLeft":
      e.preventDefault();
      ctx.step(-1);
      break;
    case " ":
      e.preventDefault();
      ctx.step(e.shiftKey ? -1 : 1);
      break;
    case "Home":
      e.preventDefault();
      state.target = 0;
      break;
    case "End":
      e.preventDefault();
      state.target = TOTAL_TRAVEL;
      break;
    case "Escape":
      hud.openSheet(false);
      break;
    default:
      break;
  }
});

// ───────────────────────────── loop ─────────────────────────────

const camPos = new THREE.Vector3();
const paperColor = new THREE.Color(PALETTE.paper);
let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  // damped scroll
  const k = 1 - Math.pow(1 - SCROLL.damping, dt * 60);
  state.travel += (state.target - state.travel) * k;
  const t = state.travel;

  // category / chapter transitions
  const chapter = chapterAt(t);
  if (chapter !== state.chapter) {
    state.chapter = chapter;
    const color = CATEGORY_BY_ID[chapter.category].color;
    state.transition = { age: 0, color };
    hud.setAccent(color);
    hud.blinkCategory();
    stage.grid.pulse(color, { x: 0, z: -t });
  }
  state.transition.age += dt;
  const category = CATEGORY_BY_ID[state.chapter.category];

  // opening titles + closing card, computed early so the world can fade with them
  const introState = intro.update(t, TOTAL_TRAVEL);
  const outro = introState.outroOpacity;
  const worldFade = 1 - outro * 0.92;

  // ── camera ──
  const rise = ramp(t, 34, INTRO.gate - 6);
  const wantLift = state.mode === "data" ? 1 : 0;
  state.dataMix += (wantLift - state.dataMix) * (1 - Math.pow(1 - 0.06, dt * 60));
  stage.placeCamera(t, state.dataMix, rise);
  camPos.copy(stage.camera.position);

  // ── floor ──
  const gu = stage.grid.uniforms;
  gu.uLong.value = ramp(t, 6, 44);
  gu.uLat.value = ramp(t, 58, 124);
  gu.uMinor.value = state.dataMix * 0.42;
  gu.uHorizon.value = 0.62 * (1 - state.dataMix) * ramp(t, 58, 124);
  gu.uOpacity.value = (0.78 + 0.22 * rise) * worldFade;
  stage.grid.update(dt, stage.camera);

  // ── labs ──
  const layout = labLayout(t, state.followed, state.chapter.category, state.dataMix);
  // during a category jump every slab but the followed one blinks out
  const jump = state.transition.age;
  const hideOthers = jump < 1.45 ? 1 : clamp(1 - (jump - 1.45) / 0.75, 0, 1);
  const appear = ramp(t, INTRO.horizon + 18, INTRO.gate - 30) * worldFade;

  const decorated = [];
  for (const l of layout) {
    const s = smoothed.get(l.lab);
    const targetAhead = -l.z - t;
    const targetOpacity = (l.followed ? 1 : 1 - hideOthers) * appear;
    if (!s.init) {
      s.ahead = targetAhead;
      s.x = l.x;
      s.init = true;
    }
    const kk = 1 - Math.pow(1 - 0.12, dt * 60);
    s.ahead += (targetAhead - s.ahead) * kk;
    s.x += (l.x - s.x) * kk;
    s.opacity += (targetOpacity - s.opacity) * (1 - Math.pow(1 - 0.14, dt * 60));

    const z = -(t + s.ahead);
    const item = stage.slabs.byId[l.lab];
    item.group.position.set(s.x, WORLD.slab.h / 2, z);
    stage.slabs.setOpacity(l.lab, s.opacity);
    if (l.followed) item.mat.color.set(category.color);
    else item.mat.color.copy(paperColor);
    item.edgeMat.color.copy(item.mat.color).multiplyScalar(0.24);

    decorated.push({
      ...l,
      x: s.x,
      z,
      opacity: s.opacity,
      hidden: s.opacity < 0.08,
    });
  }

  // ── trail of the followed lab ──
  const followedItem = decorated.find((d) => d.followed);
  const trailPts = followedTrail(t, state.followed, state.chapter.category);
  if (followedItem) {
    const dz = followedItem.z - -(t + WORLD.followDistance);
    for (const p of trailPts) p.z += dz;
  }
  stage.trail.update(trailPts, category.color, 0.06);
  stage.trail.mat.opacity = 0.95 * appear * (1 - state.dataMix * 0.6);

  // ── streaks ──
  stage.streaks.strength = ramp(t, 52, 116) * (1 - state.dataMix * 0.75) * (1 - outro * 0.55);
  stage.streaks.update(camPos.z);

  // ── overlays ──
  const horizonOp = ramp(t, 22, 52) * (1 - ramp(t, 76, 104));
  world.updateHorizon(horizonOp, camPos.y);
  const reveal = ramp(t, 120, INTRO.gate - 18) * worldFade;
  world.updateChips(decorated, t, category, WORLD.slab.h, reveal, state.dataMix);
  world.updateCards(t, camPos.y, reveal, state.dataMix);

  hud.update({
    visible: t > INTRO.gate - 18 && introState.outroOpacity < 0.55,
    travel: t,
    yearU: dateForTravel(t),
    chapterU: dayOfYear(state.chapter.date) / YEAR_DAYS,
    category,
    followedId: state.followed,
    followedRank: followedItem ? followedItem.rank : 1,
    labs: decorated,
  });

  stage.render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Small hook so the visual-check harness (tools/shots.mjs) can park the
// camera at an exact point in the journey.
window.__yia = {
  set(travel, mode) {
    state.travel = state.target = clamp(travel, 0, TOTAL_TRAVEL);
    if (mode) ctx.setMode(mode);
    state.chapter = chapterAt(state.travel);
    state.dataMix = mode === "data" ? 1 : 0;
    hud.setAccent(CATEGORY_BY_ID[state.chapter.category].color);
    state.transition.age = 99;
    for (const s2 of smoothed.values()) s2.init = false;
  },
  state,
};
