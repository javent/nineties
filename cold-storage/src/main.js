import * as THREE from "three";
import { createScene } from "./scene.js";
import { setupLighting } from "./lighting.js";
import { makeEnamelTextures } from "./textures.js";
import { createFridge, FINISHES, resolveFinish } from "./fridge.js";
import { StickerManager } from "./stickers.js";
import { Interaction } from "./interaction.js";
import { CollectionDrawer } from "./collection-drawer.js";
import { createPortal } from "./portal.js";
import { createFieldWorld } from "./field-world.js";
import lottie from "lottie-web/build/player/lottie_light";
import headerSmiley from "./header-smiley.json";
import { CATALOG, CATALOG_VERSION } from "./sticker-art.js";
import {
  $,
  $$,
  clamp,
  debounce,
  downloadBlob,
  loadImage,
  TactileAudio,
  withTimeout,
} from "./utils.js";

const STORAGE_KEY = "mid90s-minifridge-v1";
const LEGACY_STORAGE_KEY = "cold-storage-v1";
const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
let progress = 0,
  toastTimer,
  app,
  lighting,
  fridge,
  stickers,
  interaction,
  drawer,
  frameId,
  disposed = false,
  renderingPaused = false;
const audio = new TactileAudio();
// The header smiley draws itself in once, alongside the wordmark. It waits for
// the loader to lift so the play-through isn't hidden or starved by asset work.
const brandSmiley = lottie.loadAnimation({
  container: $("#brand-smiley"),
  renderer: "svg",
  loop: false,
  autoplay: false,
  animationData: headerSmiley,
});
if (reducedMotion) brandSmiley.goToAndStop(brandSmiley.totalFrames, true);
// The doorway to the Bliss field. One renderer, two worlds; `mode` decides which
// scene updates and renders each frame.
let mode = "fridge", // "fridge" | "opening" | "field" | "returning"
  field = null,
  portal = null,
  transition = null;
const OPEN_ANGLE = 1.83;
// Approach from slightly left of center: the right-hinged door sweeps toward the
// viewer's right, so a left-of-center dolly keeps the glowing doorway in view.
const DOLLY_TO = new THREE.Vector3(-0.3, 0.14, 2.9);
const DOLLY_LOOK = new THREE.Vector3(0.2, 0.14, 0.9);
// Entering has no white-out anymore: the doorway is a live window into the
// field, and the swap fires when it fills the frame. Reduced motion skips the
// dolly, so it keeps a quick flash to cover its instant cut.
const TIMES = reducedMotion
  ? { door: 0.18, flashAt: 0.08, swapAt: 0.45, whiteIn: 0.28, close: 0.18 }
  : { door: 0.8, flashAt: Infinity, swapAt: 1.7, whiteIn: 0.42, close: 0.6 };
const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function report(value) {
  progress = Math.max(progress, value);
  $("#loading-progress").style.width = `${progress}%`;
}
function toast(message, duration = 3000) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  toastTimer = setTimeout(
    () => $("#toast").classList.remove("visible"),
    duration,
  );
}
function loadingError(error) {
  console.error(error);
  $("#loader").classList.remove("ready");
  $("#loader-title").textContent = "A little too vintage?";
  $("#loader-description").textContent =
    "This fridge needs WebGL 2. Try a current browser with hardware acceleration enabled.";
  $("#reload").hidden = false;
  $("#reload").onclick = () => location.reload();
}
function storedState() {
  try {
    // Renaming the experience must not throw away an existing fridge layout.
    for (const key of [STORAGE_KEY, LEGACY_STORAGE_KEY]) {
      const value = localStorage.getItem(key);
      if (!value) continue;
      try {
        const state = JSON.parse(value);
        if (state && typeof state === "object") return state;
      } catch {
        /* A malformed newer entry can still fall back to the legacy one. */
      }
    }
    return null;
  } catch {
    return null;
  }
}
let storageWarningShown = false;
function save() {
  if (!fridge || !stickers) return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 3,
        catalog: CATALOG_VERSION,
        finish: fridge.finish,
        sound: audio.enabled,
        stickers: stickers.serialize(),
      }),
    );
  } catch {
    if (!storageWarningShown) {
      storageWarningShown = true;
      const note = document.querySelector(".auto-save-note");
      if (note) note.textContent = "Changes are kept for this visit.";
      console.info(
        "Browser storage is unavailable; keeping this layout for the current visit.",
      );
    }
  }
}
const saveSoon = debounce(save, 400);
function setFinish(id, announce = false) {
  id = resolveFinish(id);
  if (!FINISHES[id]) return;
  fridge.setFinish(id);
  $$(".swatch").forEach((button) => {
    const active = button.dataset.finish === id;
    button.classList.toggle("selected", active);
    button.setAttribute("aria-pressed", String(active));
  });
  $("#finish-name").textContent = FINISHES[id].name;
  if (announce) saveSoon();
}
function updateSound() {
  $("#sound-toggle").setAttribute("aria-pressed", String(audio.enabled));
  $("#sound-icon").setAttribute(
    "href",
    audio.enabled ? "#i-volume" : "#i-muted",
  );
  $("#sound-label").textContent = audio.enabled ? "Sound on" : "Sound off";
}
let catalogSignature = "";
function refreshCollection(force = false) {
  const signature = stickers.items
    .map((s) => `${s.id}:${s.placed}`)
    .sort()
    .join("|");
  $("#sticker-count").textContent = stickers.items.length;
  if (!force && signature === catalogSignature) return;
  catalogSignature = signature;
  const grid = $("#sticker-grid");
  grid.replaceChildren();
  // One flat alphabetical tray — no filters, no category priority.
  const ordered = [...stickers.items].sort((a, b) =>
    a.meta.name.localeCompare(b.meta.name, undefined, { sensitivity: "base" }),
  );
  ordered.forEach((sticker, index) => {
    const card = document.createElement("button");
    card.className = "sticker-card";
    card.classList.toggle("is-on-fridge", sticker.placed);
    card.dataset.placed = String(sticker.placed);
    card.dataset.sticker = sticker.id;
    card.setAttribute(
      "aria-label",
      `Pick ${sticker.meta.name} sticker${sticker.placed ? ", on fridge" : ""}`,
    );
    const preview = document.createElement("span");
    preview.className = "sticker-preview";
    const image = document.createElement("img");
    image.src = sticker.art.thumbnail;
    image.alt = "";
    image.loading = "lazy";
    image.draggable = false;
    preview.appendChild(image);
    const number = document.createElement("small");
    number.className = "sticker-number";
    number.textContent = String(index + 1).padStart(2, "0");
    preview.appendChild(number);
    const label = document.createElement("span");
    label.className = "sticker-card-label";
    const name = document.createElement("span");
    name.textContent = sticker.meta.name;
    label.appendChild(name);
    const kind = document.createElement("small");
    kind.textContent =
      { logos: "Logo", graphics: "Graphic", bands: "Band", custom: "Custom" }[
        sticker.meta.category
      ] || sticker.meta.category;
    label.appendChild(kind);
    card.append(preview, label);
    drawer.attach(card, sticker);
    grid.appendChild(card);
  });
}
/** Older saves can carry damaged layouts (an earlier bug clamped every
 *  sticker into a tight center column, and fixed landing spots stacked
 *  stickers on one point). Heal them on load so nobody arrives at a clump:
 *  a save with virtually everything piled on the front is re-seeded to the
 *  catalog's spread; individual same-spot stacks are fanned out. Genuine
 *  hand-made arrangements never trip either signature. */
function healLayout() {
  const placed = stickers.items.filter((s) => s.placed);
  const frontHeavy =
    placed.length >= 20 &&
    placed.filter((s) => s.placement.surface === "front").length >= 18;
  if (frontHeavy) {
    for (const s of placed) {
      if (s.meta.custom)
        s.setPlacement(stickers.openSpot(s.width, s.height, s.angle), true);
      else
        s.setPlacement(
          { surface: s.meta.surface || "front", u: s.meta.u, v: s.meta.v },
          true,
        );
    }
    saveSoon();
    // Fall through: band stickers share one catalog spot, so a re-seeded
    // save can still hold same-point stacks the pass below fans out.
  }
  const kept = [];
  let healed = 0;
  for (const s of placed) {
    const stacked = kept.some(
      (other) =>
        other.placement.surface === s.placement.surface &&
        Math.hypot(
          other.placement.u - s.placement.u,
          other.placement.v - s.placement.v,
        ) < 0.12,
    );
    if (stacked) {
      s.setPlacement(stickers.openSpot(s.width, s.height, s.angle), true);
      healed += 1;
    }
    kept.push(s);
  }
  if (healed) saveSoon();
}
function openDialog(dialog) {
  interaction.cancel();
  interaction.stopDemo();
  interaction.setHover(null);
  drawer?.close();
  app.stopMotion();
  app.controls.enabled = false;
  dialog.showModal();
}

function flash(on) {
  const overlay = $("#flash");
  overlay.classList.toggle("fast", reducedMotion);
  overlay.classList.toggle("visible", on);
}
function frontStickers() {
  return stickers.items.filter(
    (s) => s.placed && s.placement.surface === "front",
  );
}
function buildField() {
  const created = createFieldWorld({
    renderer: app.renderer,
    canvas: $("#world"),
    audio,
    reducedMotion,
    environment: app.scene.environment,
    onExit: exitField,
  });
  // Warm the field shaders during the door swing so the white-out swap can't hitch.
  if (app.renderer.extensions.has("KHR_parallel_shader_compile"))
    app.renderer.compileAsync(created.scene, created.camera).catch(() => {});
  return created;
}
function enterField() {
  if (mode !== "fridge") return;
  drawer.close();
  interaction.suspend(true);
  app.stopMotion();
  app.controls.enabled = false;
  // Stickers on the door ride the swing; their `placement` is untouched, so the
  // round trip back to the scene at angle 0 restores them exactly.
  for (const s of frontStickers()) {
    fridge.doorPivot.attach(s.group);
    fridge.doorPivot.attach(s.shadow);
  }
  field ||= buildField();
  // Prime the doorway view now: the field's sun shadow renders once and its
  // shaders compile under the click, not mid-swing.
  app.renderer.shadowMap.needsUpdate = true;
  portal.renderView(field, app.camera);
  audio.unlock();
  audio.doorOpen();
  mode = "opening";
  transition = {
    t: 0,
    flashOn: false,
    fromPosition: app.camera.position.clone(),
  };
}
function exitField() {
  if (mode === "field") {
    mode = "returning";
    field.deactivate();
    transition = {
      t: 0,
      phase: "toWhite",
      startAngle: OPEN_ANGLE,
      doorSound: false,
    };
    flash(true);
  } else if (mode === "opening") {
    // Abort mid-swing: close from the current angle, no white-out needed.
    mode = "returning";
    flash(false);
    transition = {
      t: 0,
      phase: "closing",
      startAngle: fridge.doorAngle,
      doorSound: false,
    };
  }
}
function updateOpening(dt) {
  const tr = transition;
  tr.t += dt;
  const doorT = easeInOutCubic(clamp(tr.t / TIMES.door, 0, 1));
  const doorMoved = fridge.setDoorAngle(OPEN_ANGLE * doorT);
  portal.setAmount(clamp(tr.t / TIMES.door, 0, 1));
  if (!reducedMotion && tr.t > 0.25) {
    const k = easeInOutCubic(clamp((tr.t - 0.25) / 1.3, 0, 1));
    app.camera.position.lerpVectors(tr.fromPosition, DOLLY_TO, k);
    app.camera.lookAt(DOLLY_LOOK);
  }
  // Live view through the doorway first (it consumes its own shadow pass),
  // then the swinging door's shadow update, then the room itself.
  portal.renderView(field, app.camera);
  if (doorMoved) app.renderer.shadowMap.needsUpdate = true;
  if (!tr.flashOn && tr.t >= TIMES.flashAt) {
    tr.flashOn = true;
    flash(true);
  }
  if (tr.t >= TIMES.swapAt) {
    // The doorway fills the frame and the field camera takes over from the
    // exact pose the portal was rendered with — no cut to hide.
    field.activate({ from: portal.viewCamera });
    document.body.classList.add("in-field");
    mode = "field";
    transition = null;
    if (tr.flashOn) flash(false);
    toast("Scroll to walk · drag to look · Esc returns");
    app.renderer.shadowMap.needsUpdate = true;
    field.update(dt);
    field.render();
    return;
  }
  app.renderer.render(app.scene, app.camera);
}
function updateReturning(dt) {
  const tr = transition;
  tr.t += dt;
  if (tr.phase === "toWhite") {
    field.update(dt);
    if (tr.t < TIMES.whiteIn) {
      field.render();
      return;
    }
    tr.phase = "closing";
    tr.t = 0;
    app.reset(true);
    flash(false);
    document.body.classList.remove("in-field");
  }
  const k = easeInOutCubic(clamp(tr.t / TIMES.close, 0, 1));
  const angle = tr.startAngle * (1 - k);
  const doorMoved = fridge.setDoorAngle(angle);
  portal.setAmount(angle / OPEN_ANGLE);
  // The field stays visible through the shrinking gap until the door seals.
  if (angle > 0.001) portal.renderView(field, app.camera);
  if (doorMoved) app.renderer.shadowMap.needsUpdate = true;
  if (!tr.doorSound && angle < 0.35) {
    tr.doorSound = true;
    audio.doorClose();
  }
  app.update(dt);
  app.renderer.render(app.scene, app.camera);
  if (k >= 1) {
    fridge.setDoorAngle(0);
    portal.setAmount(0);
    for (const s of frontStickers()) {
      app.scene.attach(s.group);
      app.scene.attach(s.shadow);
    }
    interaction.suspend(false);
    app.controls.enabled = true;
    app.renderer.shadowMap.needsUpdate = true;
    mode = "fridge";
    transition = null;
  }
}

function bindUI() {
  $("#home").onclick = () => {
    if (mode === "field" || mode === "opening") {
      audio.unlock();
      exitField();
      return;
    }
    if (mode === "returning") return;
    drawer.close();
    interaction.cancel();
    interaction.select(null);
    interaction.setHover(null);
    audio.unlock();
    audio.stick();
    app.reset(reducedMotion);
  };

  $$(".swatch").forEach(
    (button) => (button.onclick = () => setFinish(button.dataset.finish, true)),
  );
  $("#sound-toggle").onclick = () => {
    audio.enabled = !audio.enabled;
    audio.unlock();
    updateSound();
    saveSoon();
  };
  $("#open-collection").onclick = () => {
    refreshCollection();
    drawer.open();
  };
  $("#open-about").onclick = () => openDialog($("#about-dialog"));
  $$(".close-dialog").forEach(
    (button) =>
      (button.onclick = () => {
        if (button.closest("dialog").id === "collection-dialog") {
          drawer.cancel();
          drawer.close();
        } else button.closest("dialog").close();
      }),
  );
  $$("dialog").forEach((dialog) => {
    dialog.addEventListener("close", () => {
      app.controls.enabled = mode === "fridge" && !interaction.busy;
    });
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        dialog.close();
    });
  });
  $("#upload-sticker").onclick = () => $("#sticker-file").click();
  $("#sticker-file").onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = "";
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast("Choose a PNG, JPG, or WEBP image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast("Please choose an image smaller than 8 MB.");
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      if (
        image.width * image.height > 16777216 ||
        image.width > 8192 ||
        image.height > 8192
      )
        throw new Error("Use an image no larger than 4096 × 4096 pixels.");
      const sticker = await stickers.addCustom(
        image,
        file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "),
      );
      refreshCollection(true);
      audio.unlock();
      printSticker(sticker);
      saveSoon();
    } catch (error) {
      toast(
        error.message || "That image could not be loaded. Please try another.",
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  let confirmReset = false,
    resetTimer;
  const resetLabel = () => {
    $("#reset-stickers").innerHTML =
      '<svg class="icon"><use href="#i-reset"/></svg>Start fresh';
    confirmReset = false;
  };
  $("#reset-stickers").onclick = () => {
    if (!confirmReset) {
      confirmReset = true;
      $("#reset-stickers").textContent = "Reset all? Yes, start fresh";
      resetTimer = setTimeout(resetLabel, 4500);
      return;
    }
    clearTimeout(resetTimer);
    interaction.select(null);
    interaction.cancel();
    stickers.reset();
    refreshCollection(true);
    resetLabel();
  };
}

/** The upload button is a printer: the new sticker feeds out of the slot,
 *  then flies down into its (alphabetized) tray cell, which the tray scrolls
 *  to meet. Reduced motion skips straight to the scroll and glow. */
function printSticker(sticker) {
  const station = $("#print-station");
  const card = $("#sticker-grid").querySelector(
    `[data-sticker="${sticker.id}"]`,
  );
  if (reducedMotion || !card || !station) {
    station?.classList.remove("is-printing");
    if (card) {
      card.scrollIntoView({ behavior: "auto", block: "center" });
      card.classList.add("just-printed");
    }
    audio.stick();
    return;
  }
  const image = station.querySelector(".print-out img");
  image.src = sticker.art.thumbnail;
  station.classList.add("is-printing");
  audio.printer();
  setTimeout(() => {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      const from = station.querySelector(".print-out").getBoundingClientRect();
      const to = card.getBoundingClientRect();
      const flight = image.cloneNode();
      Object.assign(flight.style, {
        position: "fixed",
        left: `${from.left}px`,
        top: `${from.top}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
        zIndex: 40,
        pointerEvents: "none",
        objectFit: "contain",
        transition:
          "transform 0.55s cubic-bezier(0.3, 0.8, 0.3, 1), opacity 0.55s",
        filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.5))",
      });
      document.body.appendChild(flight);
      station.classList.remove("is-printing");
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          flight.style.transform = `translate(${dx}px, ${dy}px) scale(${Math.min(
            1,
            (to.width * 0.72) / from.width,
          )})`;
          flight.style.opacity = "0.2";
        }),
      );
      setTimeout(() => {
        flight.remove();
        card.classList.add("just-printed");
        audio.stick();
      }, 590);
    }, 560);
  }, 1200);
}

function takeSnapshot() {
  try {
    app.renderer.render(app.scene, app.camera);
    const source = app.renderer.domElement,
      canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(source, 0, 0);
    const ratio = source.width / source.clientWidth,
      pad = source.width * 0.06;
    // Match the viewer exactly: a pure black canvas, no tinted vignette.
    ctx.fillStyle = "#f0f0f0";
    ctx.font = `500 ${14 * ratio}px "DM Sans"`;
    ctx.fillText("AventXP", pad, 60 * ratio);
    ctx.font = `${11 * ratio}px "DM Sans"`;
    ctx.fillStyle = "#99999e";
    ctx.fillText("Your sticker collection", pad, source.height - 38 * ratio);
    ctx.textAlign = "right";
    ctx.fillText(
      FINISHES[fridge.finish].name,
      source.width - pad,
      source.height - 38 * ratio,
    );
    canvas.toBlob((blob) => {
      if (!blob) {
        toast("Snapshot unavailable. Please try again.");
        return;
      }
      downloadBlob(blob, "mid90s-minifridge-my-fridge.png");
      toast("Snapshot saved.");
    }, "image/png");
  } catch (error) {
    console.warn(error);
    toast("Snapshot unavailable in this browser.");
  }
}

async function init() {
  const start = performance.now();
  app = createScene($("#world"));
  report(12);
  lighting = setupLighting(app.scene, app.renderer);
  const fonts = Promise.all(
    [
      'italic 32px "Instrument Serif"',
      '16px "IBM Plex Mono"',
      '400 16px "DM Sans"',
      '500 24px "DM Sans"',
      '700 24px "DM Sans"',
      // The vending machine's canvas art is painted lazily on first door-open.
      '24px "Sticker Heavy"',
      '24px "Sticker Marker"',
    ].map((f) => document.fonts.load(f)),
  ).catch(() => {});
  const [maps] = await Promise.all([makeEnamelTextures(), fonts]);
  report(55);
  fridge = createFridge(maps);
  app.scene.add(fridge.group);
  // Yield before loading the reference cutouts so the loading state remains responsive.
  await new Promise((resolve) => requestAnimationFrame(resolve));
  stickers = new StickerManager(fridge, app.scene);
  await stickers.loadCatalog((fraction) => report(55 + fraction * 22));
  report(77);
  const previous = storedState();
  if (previous && [1, 2, 3].includes(previous.version)) {
    await stickers.restore(previous.stickers);
    audio.enabled = previous.sound !== false;
    healLayout();
  }
  setFinish(previous?.finish || "cream");
  portal = createPortal(app.renderer);
  app.scene.add(portal.group);
  interaction = new Interaction(app, fridge, stickers, audio, {
    handleClick: () => enterField(),
  });
  drawer = new CollectionDrawer($("#collection-dialog"), interaction, {
    reducedMotion,
  });
  stickers.onChange = () => {
    app.renderer.shadowMap.needsUpdate = true;
    saveSoon();
    refreshCollection();
  };
  bindUI();
  updateSound();
  refreshCollection();
  await lighting.ready;
  report(91);
  app.scene.updateMatrixWorld(true);
  app.camera.updateMatrixWorld(true);
  if (app.renderer.extensions.has("KHR_parallel_shader_compile"))
    await withTimeout(
      app.renderer.compileAsync(app.scene, app.camera),
      20000,
    ).catch((error) =>
      console.info(
        "Continuing shader compilation during the first frame.",
        error.message,
      ),
    );
  else app.renderer.compile(app.scene, app.camera);
  app.renderer.render(app.scene, app.camera);
  report(100);
  setTimeout(
    () => {
      $("#loader").classList.add("ready");
      if (!reducedMotion) brandSmiley.play();
    },
    Math.max(50, 650 - (performance.now() - start)),
  );
  let previousTime = performance.now();
  function step(dt) {
    if (mode === "fridge") {
      interaction.update();
      app.update(dt);
      if (stickers.update(dt, reducedMotion))
        app.renderer.shadowMap.needsUpdate = true;
      app.renderer.render(app.scene, app.camera);
    } else if (mode === "field") {
      field.update(dt);
      field.render();
    } else if (mode === "opening") updateOpening(dt);
    else if (mode === "returning") updateReturning(dt);
  }
  function animate(now) {
    if (disposed) return;
    frameId = requestAnimationFrame(animate);
    const dt = clamp((now - previousTime) / 1000, 0.001, 0.033);
    previousTime = now;
    if (document.hidden || renderingPaused) return;
    step(dt);
  }
  frameId = requestAnimationFrame(animate);
  $("#world").addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    cancelAnimationFrame(frameId);
    loadingError(new Error("WebGL context lost"));
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      interaction.cancel();
      saveSoon.flush();
      // The render loop idles while hidden; the WebAudio loops must not drone on.
      field?.muteAmbience();
    }
  });
  window.addEventListener("pagehide", (event) => {
    saveSoon.flush();
    if (!event.persisted) dispose();
  });
  // Small, documented API for inspecting/extending the scene; no external services.
  window.mid90sMinifridge = {
    app,
    fridge,
    stickers,
    interaction,
    collection: drawer,
    takeSnapshot,
    reset: () => stickers.reset(),
    save,
    pause: (value = true) => {
      renderingPaused = value;
    },
    enterField,
    exitField,
    // Deterministic frame advance for QA scripts that pause the render loop.
    step,
    get mode() {
      return mode;
    },
    get field() {
      return field;
    },
    version: THREE.REVISION,
  };
  // Backward compatibility for integrations and previously supplied QA scripts.
  window.coldStorage = window.mid90sMinifridge;
}
function dispose() {
  disposed = true;
  cancelAnimationFrame(frameId);
  drawer?.dispose();
  interaction?.dispose();
  stickers?.dispose();
  lighting?.dispose();
  field?.dispose();
  portal?.dispose();
  audio.dispose();
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set();
  app?.scene.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material))
        if (value?.isTexture) textures.add(value);
    }
  });
  for (const texture of fridge?.textureResources || []) textures.add(texture);
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
  app?.dispose();
}
init().catch(loadingError);
