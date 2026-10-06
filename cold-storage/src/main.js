import * as THREE from "three";
import { createScene } from "./scene.js";
import { setupLighting } from "./lighting.js";
import { makeEnamelTextures } from "./textures.js";
import { createFridge, FINISHES, resolveFinish } from "./fridge.js";
import { StickerManager } from "./stickers.js";
import { Interaction } from "./interaction.js";
import { CollectionDrawer } from "./collection-drawer.js";
import { BrandPeel } from "./brand-peel.js";
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
  brandPeel,
  frameId,
  disposed = false,
  renderingPaused = false;
const audio = new TactileAudio();
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
  if (announce) {
    saveSoon();
  }
}
function updateSound() {
  $("#sound-toggle").setAttribute("aria-pressed", String(audio.enabled));
  $("#sound-icon").setAttribute(
    "href",
    audio.enabled ? "#i-volume" : "#i-muted",
  );
  $("#sound-label").textContent = audio.enabled ? "Sound on" : "Sound off";
}
let filter = "all",
  catalogSignature = "";
function refreshCollection(force = false) {
  const signature =
    stickers.items
      .map((s) => `${s.id}:${s.placed}`)
      .sort()
      .join("|") + filter;
  const count = stickers.items.length;
  $("#sticker-count").textContent = count;
  $("#all-count").textContent = count;
  for (const category of ["logos", "graphics", "bands"]) {
    const badge = document.querySelector(
      `[data-filter="${category}"] .filter-count`,
    );
    if (badge)
      badge.textContent = stickers.items.filter(
        (s) => s.meta.category === category,
      ).length;
  }
  $("#custom-filter").hidden = !stickers.items.some((s) => s.meta.custom);
  if (!force && signature === catalogSignature) return;
  catalogSignature = signature;
  const grid = $("#sticker-grid");
  grid.replaceChildren();
  const ordered = [...stickers.items].sort((a, b) => {
    // Introduce the new collection first without reordering any placed meshes.
    const priority = (s) =>
      s.meta.category === "bands"
        ? 0
        : s.meta.edition === "mid90s-expansion"
          ? 1
          : s.meta.custom
            ? 3
            : 2;
    if (priority(a) !== priority(b)) return priority(a) - priority(b);
    const ai = CATALOG.findIndex((c) => c.id === a.id),
      bi = CATALOG.findIndex((c) => c.id === b.id);
    return (ai < 0 ? 100 : ai) - (bi < 0 ? 100 : bi);
  });
  ordered.forEach((sticker, index) => {
    if (filter !== "all" && sticker.meta.category !== filter) return;
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
function openDialog(dialog) {
  interaction.cancel();
  interaction.stopDemo();
  interaction.setHover(null);
  drawer?.close();
  app.stopMotion();
  app.controls.enabled = false;
  dialog.showModal();
}

function bindUI() {
  $("#home").onclick = () => {
    drawer.close();
    interaction.cancel();
    interaction.select(null);
    interaction.setHover(null);
    brandPeel.slam();
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
      app.controls.enabled = !interaction.busy;
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
  $$(".collection-filters button").forEach(
    (button) =>
      (button.onclick = () => {
        filter = button.dataset.filter;
        $$(".collection-filters button").forEach((b) => {
          b.classList.toggle("active", b === button);
          b.setAttribute("aria-pressed", String(b === button));
        });
        refreshCollection();
      }),
  );
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
      filter = "all";
      $$(".collection-filters button").forEach((b) => {
        b.classList.toggle("active", b.dataset.filter === "all");
        b.setAttribute("aria-pressed", String(b.dataset.filter === "all"));
      });
      refreshCollection(true);
      drawer.close();
      interaction.select(sticker);
      audio.unlock();
      audio.stick();
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
    filter = "all";
    $$(".collection-filters button").forEach((b) => {
      b.classList.toggle("active", b.dataset.filter === "all");
      b.setAttribute("aria-pressed", String(b.dataset.filter === "all"));
    });
    refreshCollection(true);
    resetLabel();
  };
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
    ctx.font = `500 ${28 * ratio}px "DM Sans"`;
    ctx.fillText("Mid90s Minifridge", pad, 60 * ratio);
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
    setFinish(previous.finish || "cream");
    audio.enabled = previous.sound !== false;
  }
  interaction = new Interaction(app, fridge, stickers, audio);
  drawer = new CollectionDrawer($("#collection-dialog"), interaction, {
    reducedMotion,
  });
  brandPeel = new BrandPeel($("#home"), reducedMotion);
  stickers.onChange = () => {
    app.renderer.shadowMap.needsUpdate = true;
    saveSoon();
    refreshCollection();
  };
  bindUI();
  updateSound();
  refreshCollection();
  // The procedural studio environment is already applied, so the 1.6 MB HDRI
  // is only a refinement. Resolving it in the background keeps it off the
  // critical path to first interaction; the swap is applied when it lands.
  lighting.ready.then(() => {
    app.renderer.shadowMap.needsUpdate = true;
  });
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
    () => $("#loader").classList.add("ready"),
    Math.max(50, 650 - (performance.now() - start)),
  );
  let previousTime = performance.now();
  function animate(now) {
    if (disposed) return;
    frameId = requestAnimationFrame(animate);
    const dt = clamp((now - previousTime) / 1000, 0.001, 0.033);
    previousTime = now;
    if (document.hidden || renderingPaused) return;
    interaction.update();
    app.update(dt);
    if (stickers.update(dt, reducedMotion))
      app.renderer.shadowMap.needsUpdate = true;
    app.renderer.render(app.scene, app.camera);
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
    brandPeel,
    takeSnapshot,
    reset: () => stickers.reset(),
    save,
    pause: (value = true) => {
      renderingPaused = value;
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
  brandPeel?.dispose();
  interaction?.dispose();
  stickers?.dispose();
  lighting?.dispose();
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
