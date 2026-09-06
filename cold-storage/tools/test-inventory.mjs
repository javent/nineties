import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
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
  requests = [];
const context = await browser.newContext({
  viewport: { width: 1200, height: 850 },
  offline: true,
  reducedMotion: "reduce",
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (/^https?:/.test(r.url())) requests.push(r.url());
});
const url = new URL("../../Mid90s-Minifridge.html", import.meta.url).href;
async function ready() {
  await page.waitForFunction(() => window.mid90sMinifridge, {
    timeout: 120000,
  });
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector("#loader")).visibility ===
      "hidden",
  );
  await page.evaluate(() => mid90sMinifridge.pause());
}
async function tick(n = 60) {
  await page.evaluate((n) => {
    const a = mid90sMinifridge;
    for (let i = 0; i < n; i++) {
      a.interaction.update();
      a.app.update(1 / 60);
      a.stickers.update(1 / 60, false);
    }
    a.app.renderer.shadowMap.needsUpdate = true;
    a.app.renderer.render(a.app.scene, a.app.camera);
  }, n);
}
await page.goto(url);
await ready();
await page.locator("#open-collection").click();
await page.locator('[data-filter="bands"]').click();
await page.locator('[data-sticker="band-oasis"]').focus();
await page.keyboard.press("Enter");
await tick();
assert.equal(
  await page.evaluate(
    () => mid90sMinifridge.stickers.find("band-oasis").placed,
  ),
  true,
);
const before = await page.evaluate(
  () => mid90sMinifridge.stickers.find("band-oasis").placement.u,
);
await page.keyboard.press("ArrowLeft");
assert.ok(
  await page.evaluate(
    (v) => mid90sMinifridge.stickers.find("band-oasis").placement.u < v,
    before,
  ),
);
await page.keyboard.press("Escape");
console.log("Keyboard place + adjustment ✓");
await page.locator("#open-collection").click();
const nirvana = page.locator('[data-sticker="band-nirvana"]');
await nirvana.scrollIntoViewIfNeeded();
await nirvana.click();
assert.equal(
  await page.evaluate(() => mid90sMinifridge.interaction.active?.armed),
  true,
);
await page.keyboard.press("Escape");
assert.equal(
  await page.evaluate(
    () => mid90sMinifridge.stickers.find("band-nirvana").placed,
  ),
  false,
);
assert.equal(
  await page.evaluate(() => mid90sMinifridge.interaction.busy),
  false,
);
console.log("Armed placement cancellation ✓");
// A placed fridge sticker still uses ordinary on-object pointer dragging.
await page.locator("#home").click();
await tick(80);
const p = await page.evaluate(() => {
  const a = mid90sMinifridge,
    p = a.stickers
      .find("spitfire")
      .group.position.clone()
      .project(a.app.camera);
  return {
    x: (p.x * 0.5 + 0.5) * innerWidth,
    y: (-0.5 * p.y + 0.5) * innerHeight,
  };
});
await page.mouse.move(p.x, p.y);
await page.mouse.down();
await page.waitForTimeout(190);
await tick(40);
assert.equal(
  await page.evaluate(() => mid90sMinifridge.interaction.active?.sticker.id),
  "spitfire",
);
await page.keyboard.press("Escape");
await page.mouse.up();
assert.equal(
  await page.evaluate(() => mid90sMinifridge.interaction.busy),
  false,
);
console.log("Existing fridge interaction + Escape ✓");
// A 24-item-era layout with all 16 uploads survives the addition of 15 inventory items.
await page.addInitScript(() => {
  if (location.protocol !== "file:") return;
  const c = document.createElement("canvas");
  c.width = c.height = 4;
  c.getContext("2d").fillRect(0, 0, 4, 4);
  const source = c.toDataURL();
  localStorage.removeItem("mid90s-minifridge-v1");
  localStorage.setItem(
    "cold-storage-v1",
    JSON.stringify({
      version: 2,
      finish: "gold",
      sound: false,
      stickers: [
        {
          id: "spitfire",
          placement: { surface: "front", u: 0.24, v: -0.24 },
          angle: 0,
        },
        ...Array.from({ length: 16 }, (_, i) => ({
          id: `custom-old-${i}`,
          name: `Old upload ${i}`,
          source,
          placement: { surface: "back", u: 0, v: 0 },
          angle: 0,
        })),
      ],
    }),
  );
});
await page.reload();
await ready();
const migration = await page.evaluate(() => {
  const a = mid90sMinifridge;
  a.save();
  return {
    total: a.stickers.items.length,
    custom: a.stickers.items.filter((s) => s.meta.custom).length,
    bandPlaced: a.stickers.items.filter(
      (s) => s.meta.category === "bands" && s.placed,
    ).length,
    finish: a.fridge.finish,
    saved: JSON.parse(localStorage.getItem("mid90s-minifridge-v1")).version,
  };
});
assert.equal(migration.total, 55);
assert.equal(migration.custom, 16);
assert.equal(migration.bandPlaced, 0);
assert.equal(migration.finish, "hunter");
assert.equal(migration.saved, 3);
console.log("Legacy migration with 16 uploads ✓");
// Opaque-origin HTML preview: no storage permission or network is required.
await page.goto("about:blank");
const html = await fs.readFile(
  new URL("../../Mid90s-Minifridge.html", import.meta.url),
  "utf8",
);
await page.setContent(
  '<iframe sandbox="allow-scripts" style="width:100%;height:800px;border:0" title="Mid90s Minifridge"></iframe>',
);
await page
  .locator("iframe")
  .evaluate((iframe, html) => (iframe.srcdoc = html), html);
const frame = page.frames().find((f) => f.parentFrame());
await frame.waitForFunction(() => window.mid90sMinifridge, { timeout: 120000 });
await frame.waitForFunction(
  () =>
    getComputedStyle(document.querySelector("#loader")).visibility === "hidden",
);
await frame.evaluate(() => mid90sMinifridge.pause());
assert.equal(
  await frame.evaluate(() => mid90sMinifridge.stickers.items.length),
  39,
);
await frame.locator("#open-collection").click();
assert.equal(await frame.locator(".sticker-card").count(), 39);
assert.ok(
  await frame
    .locator("#collection-dialog")
    .evaluate((e) =>
      getComputedStyle(e).backgroundImage.includes("data:image/jpeg"),
    ),
);
console.log("Opaque sandboxed drawer + embedded wood ✓");
assert.deepEqual(errors, []);
assert.deepEqual(requests, []);
await browser.close();
console.log("INVENTORY, KEYBOARD, MIGRATION & SANDBOX CHECKS PASSED");
