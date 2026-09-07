import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
await fs.mkdir("qa/field", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: "chromium",
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-features=CDPScreenshotNewSurface",
  ],
});
const errors = [],
  network = [];
async function open(options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    offline: true,
    deviceScaleFactor: 1,
    ...options,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE", m.text());
  });
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) network.push(r.url());
  });
  await page.goto(
    new URL("../../Mid90s-Minifridge.html", import.meta.url).href,
  );
  await page.waitForFunction(() => window.mid90sMinifridge, {
    timeout: 120000,
  });
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector("#loader")).visibility ===
      "hidden",
  );
  await page.evaluate(() => mid90sMinifridge.pause());
  return { context, page, cdp: await context.newCDPSession(page) };
}
// Coarser dt covers the same simulated time with far fewer renders — vital
// under SwiftShader, where the portal's second scene render is expensive.
const tick = (page, n = 60, dt = 1 / 60) =>
  page.evaluate(
    ({ n, dt }) => {
      for (let i = 0; i < n; i++) mid90sMinifridge.step(dt);
    },
    { n, dt },
  );
async function shot(cdp, name) {
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: false,
    captureBeyondViewport: false,
  });
  await fs.writeFile(`qa/field/${name}.png`, Buffer.from(data, "base64"));
}

const { page, cdp, context } = await open();

// 1 — Closed-state regression: the pivot refactor must not move a single part.
const closed = await page.evaluate(() => {
  const a = mid90sMinifridge;
  const world = (name) => {
    const v = new a.app.camera.position.constructor();
    a.fridge.group.getObjectByName(name).getWorldPosition(v);
    return v.toArray().map((x) => +x.toFixed(4));
  };
  return {
    doorAngle: a.fridge.doorAngle,
    door: world("single enamel door"),
    badge: world("Centered Evercool manufacturer badge"),
    handles: a.fridge.handleMeshes.length,
    mode: a.mode,
  };
});
assert.equal(closed.doorAngle, 0);
assert.deepEqual(closed.door, [0, 0.14, 1.14]);
assert.deepEqual(closed.badge, [0, 2.38, 1.337]);
assert.equal(closed.handles, 7);
assert.equal(closed.mode, "fridge");
await tick(page, 5);
await shot(cdp, "01-closed-regression");
console.log("Closed-state pivot regression ✓");

// 2 — Handle hover: cursor affordance + isolated glow material.
const handlePoint = await page.evaluate(() => {
  const a = mid90sMinifridge;
  const rect = document.querySelector("#world").getBoundingClientRect();
  const p = new a.app.camera.position.constructor(-1.08, 0.75, 1.65).project(
    a.app.camera,
  );
  return {
    x: rect.left + (p.x * 0.5 + 0.5) * rect.width,
    y: rect.top + (-0.5 * p.y + 0.5) * rect.height,
  };
});
await page.mouse.move(handlePoint.x, handlePoint.y);
await tick(page, 30);
assert.equal(
  await page.evaluate(() =>
    document.querySelector("#world").classList.contains("is-handle-hover"),
  ),
  true,
);
assert.ok(
  await page.evaluate(() => mid90sMinifridge.interaction.handleGlow > 0.9),
);
await shot(cdp, "02-handle-glow");
console.log("Handle hover + glow ✓");

// 3 — Click the handle: door opens, stickers ride the door, field activates.
const beforeTrip = await page.evaluate(() =>
  mid90sMinifridge.stickers.items
    .filter((s) => s.placed && s.placement.surface === "front")
    .map((s) => {
      const v = new mid90sMinifridge.app.camera.position.constructor();
      s.group.getWorldPosition(v);
      return { id: s.id, world: v.toArray() };
    }),
);
assert.ok(beforeTrip.length > 0);
await page.mouse.click(handlePoint.x, handlePoint.y);
await tick(page, 15, 1 / 30); // ~0.5 s: mid-swing
const midSwing = await page.evaluate(() => ({
  mode: mid90sMinifridge.mode,
  angle: mid90sMinifridge.fridge.doorAngle,
  stickerParent: mid90sMinifridge.stickers.items.find(
    (s) => s.placed && s.placement.surface === "front",
  ).group.parent.name,
  portal: mid90sMinifridge.app.scene.getObjectByName("field portal").visible,
}));
assert.equal(midSwing.mode, "opening");
assert.ok(midSwing.angle > 0.2 && midSwing.angle < 1.83);
assert.equal(midSwing.stickerParent, "door pivot");
assert.equal(midSwing.portal, true);
// The doorway must be a live window: its plane samples a real render target.
assert.equal(
  await page.evaluate(() => {
    const plane = mid90sMinifridge.app.scene.getObjectByName("bliss doorway");
    return !!plane.material.uniforms?.portalMap?.value?.isTexture;
  }),
  true,
);
await shot(cdp, "03-door-mid-swing");
await tick(page, 15, 1 / 30); // t≈1.0 s: door open, dolly underway, flash not yet up
await shot(cdp, "04-doorway-dolly");
await tick(page, 24, 1 / 24); // past the swap (t≈2.0 s)
assert.equal(await page.evaluate(() => mid90sMinifridge.mode), "field");
assert.equal(
  await page.evaluate(() => document.body.classList.contains("in-field")),
  true,
);
await tick(page, 10);
await shot(cdp, "05-field-spawn");
console.log("Open → field transition ✓");

const buttonPoint = async () =>
  page.evaluate(() => {
    const f = mid90sMinifridge.field;
    const rect = document.querySelector("#world").getBoundingClientRect();
    const v = new f.camera.position.constructor();
    f.machine.buttons[1].getWorldPosition(v);
    v.project(f.camera);
    return {
      x: rect.left + (v.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-0.5 * v.y + 0.5) * rect.height,
    };
  });

// 3b — Clicking the far-off machine strolls you toward it instead of nothing.
const machinePoint = await page.evaluate(() => {
  const f = mid90sMinifridge.field;
  const rect = document.querySelector("#world").getBoundingClientRect();
  const v = f.machine.group.position.clone();
  v.y += 3.6;
  v.project(f.camera);
  return {
    x: rect.left + (v.x * 0.5 + 0.5) * rect.width,
    y: rect.top + (-0.5 * v.y + 0.5) * rect.height,
  };
});
await page.mouse.click(machinePoint.x, machinePoint.y);
await tick(page, 5);
assert.equal(
  await page.evaluate(() => mid90sMinifridge.field.controls.progressTarget),
  1,
);
console.log("Click-to-approach ✓");

// 3c — A button press from the machine's doorstep zone (the stretch that used
// to be silently dead beyond the old 10-unit gate) vends for real.
await page.evaluate(() => {
  mid90sMinifridge.field.controls.progressTarget = 0.78;
});
await tick(page, 45, 1 / 15);
const doorstep = await page.evaluate(() => {
  const f = mid90sMinifridge.field;
  return f.camera.position.distanceTo(
    f.machine.group.position.clone().setY(f.machine.group.position.y + 3.6),
  );
});
assert.ok(
  doorstep > 10 && doorstep < 16,
  `expected the old dead zone, got ${doorstep.toFixed(1)}`,
);
let press = await buttonPoint();
await page.mouse.click(press.x, press.y);
await tick(page, 75, 1 / 30);
assert.equal(
  await page.evaluate(() => mid90sMinifridge.field.machine.canResting),
  true,
);
console.log("Mid-path vend in the old dead zone ✓");

// 4 — Walk the rest of the way; vending again from up close still works.
await page.evaluate(() => {
  mid90sMinifridge.field.controls.progressTarget = 1;
});
await tick(page, 60, 1 / 15);
const arrival = await page.evaluate(() => {
  const f = mid90sMinifridge.field;
  return {
    progress: f.controls.progress,
    distance: f.camera.position.distanceTo(
      f.machine.group.position.clone().setY(f.camera.position.y),
    ),
  };
});
assert.ok(arrival.progress > 0.99);
assert.ok(arrival.distance < 10);
await shot(cdp, "06-at-machine");
// Vend the way a person does: click the second selection button.
press = await buttonPoint();
await page.mouse.click(press.x, press.y);
await tick(page, 75, 1 / 30);
const vended = await page.evaluate(() => {
  const m = mid90sMinifridge.field.machine;
  return {
    visible: m.can.visible,
    resting: m.canResting,
    state: mid90sMinifridge.field.canState,
  };
});
assert.equal(vended.visible, true);
assert.equal(vended.resting, true);
assert.equal(vended.state, "machine");
await page.evaluate(() => {
  // Look down at the flap so the payoff is in frame for the screenshot.
  mid90sMinifridge.field.controls.pitchTarget = -0.33;
});
await tick(page, 20, 1 / 30);
await shot(cdp, "07-can-vended");
console.log("Walk + vend ✓");

// 4b — Click the haloed can: the world blurs behind a centered, floating can.
const canPoint = await page.evaluate(() => {
  const f = mid90sMinifridge.field;
  const rect = document.querySelector("#world").getBoundingClientRect();
  const v = new f.camera.position.constructor();
  f.machine.canBody.getWorldPosition(v);
  v.project(f.camera);
  return {
    x: rect.left + (v.x * 0.5 + 0.5) * rect.width,
    y: rect.top + (-0.5 * v.y + 0.5) * rect.height,
  };
});
await page.mouse.click(canPoint.x, canPoint.y);
await tick(page, 30, 1 / 30);
assert.equal(
  await page.evaluate(() => mid90sMinifridge.field.canState),
  "focused",
);
await shot(cdp, "08-can-focused");
console.log("Can focus + blur ✓");

// 4c — Click it again: slime detonation, the can ricochets around the field.
await page.mouse.click(
  await page.evaluate(() => innerWidth / 2),
  await page.evaluate(() => innerHeight / 2),
);
await tick(page, 15, 1 / 30);
const boom = await page.evaluate(() => ({
  state: mid90sMinifridge.field.canState,
  exploded: mid90sMinifridge.field.exploded,
}));
assert.equal(boom.state, "flying");
assert.equal(boom.exploded, true);
await tick(page, 88, 1 / 8); // ~11 s of flight → landed, field slimed
const aftermath = await page.evaluate(() => {
  const f = mid90sMinifridge.field;
  let splats = 0;
  f.scene.traverse((o) => {
    if (o.visible && o.material?.map && o.geometry?.type === "PlaneGeometry")
      splats += o.rotation.x < -1.5 ? 1 : 0;
  });
  return {
    state: f.canState,
    splats,
    slimedClass: document.querySelector("#slime").className,
  };
});
assert.equal(aftermath.state, "landed");
assert.ok(
  aftermath.splats > 3,
  `expected ground splats, got ${aftermath.splats}`,
);
assert.ok(aftermath.slimedClass.includes("slimed"));
await shot(cdp, "09-slimed-field");
console.log("Slime explosion + landing ✓");

// 4d — The machine is not a one-shot: a button press reclaims the spent can
// and vends it fresh, halo and all.
await page.evaluate(() => {
  mid90sMinifridge.field.controls.pitchTarget = 0;
});
await tick(page, 20, 1 / 30);
press = await buttonPoint();
await page.mouse.click(press.x, press.y);
await tick(page, 75, 1 / 30);
const revend = await page.evaluate(() => ({
  state: mid90sMinifridge.field.canState,
  resting: mid90sMinifridge.field.machine.canResting,
  canParent: mid90sMinifridge.field.machine.can.parent.name,
}));
assert.equal(revend.state, "machine");
assert.equal(revend.resting, true);
assert.equal(revend.canParent, "SURGE vending machine");
console.log("Re-vend after explosion ✓");

// 5 — Wordmark returns home; stickers land exactly where they started.
await page.locator("#home").click();
await tick(page, 45, 1 / 30);
const home = await page.evaluate(() => {
  const a = mid90sMinifridge;
  const front = a.stickers.items.filter(
    (s) => s.placed && s.placement.surface === "front",
  );
  return {
    mode: a.mode,
    angle: a.fridge.doorAngle,
    inField: document.body.classList.contains("in-field"),
    suspended: a.interaction.suspended,
    controls: a.app.controls.enabled,
    stickers: front.map((s) => {
      const v = new a.app.camera.position.constructor();
      s.group.getWorldPosition(v);
      return { id: s.id, parent: s.group.parent.type, world: v.toArray() };
    }),
  };
});
assert.equal(home.mode, "fridge");
assert.equal(home.angle, 0);
assert.equal(home.inField, false);
assert.equal(home.suspended, false);
assert.equal(home.controls, true);
for (const sticker of home.stickers) {
  assert.equal(sticker.parent, "Scene");
  const before = beforeTrip.find((b) => b.id === sticker.id);
  for (let axis = 0; axis < 3; axis++)
    assert.ok(
      Math.abs(sticker.world[axis] - before.world[axis]) < 1e-4,
      `${sticker.id} moved on axis ${axis}`,
    );
}
await tick(page, 10);
await shot(cdp, "08-back-home");
console.log("Return trip + sticker round-trip ✓");

// 6 — A second visit reuses the built field and starts a fresh walk.
await page.evaluate(() => mid90sMinifridge.enterField());
await tick(page, 40, 1 / 20);
assert.equal(await page.evaluate(() => mid90sMinifridge.mode), "field");
assert.ok(
  await page.evaluate(() => mid90sMinifridge.field.controls.progress < 0.05),
);
await page.locator("#home").click();
await tick(page, 45, 1 / 30);
assert.equal(await page.evaluate(() => mid90sMinifridge.mode), "fridge");
console.log("Second visit ✓");
await context.close();

// 7 — Reduced motion: the whole trip stays quick and skips the dolly.
const rm = await open({ reducedMotion: "reduce" });
await rm.page.evaluate(() => mid90sMinifridge.enterField());
await tick(rm.page, 40); // 0.66 s of frames covers the 0.45 s reduced timeline
assert.equal(await rm.page.evaluate(() => mid90sMinifridge.mode), "field");
await rm.page.evaluate(() => mid90sMinifridge.exitField());
await tick(rm.page, 40);
assert.equal(await rm.page.evaluate(() => mid90sMinifridge.mode), "fridge");
console.log("Reduced motion ✓");
await rm.context.close();

assert.deepEqual(errors, []);
assert.deepEqual(network, []);
console.log("FIELD PORTAL + SURGE MACHINE CHECKS PASSED");
await browser.close();
