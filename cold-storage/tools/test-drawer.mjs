import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
await fs.mkdir("qa/drawer", { recursive: true });
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
async function open(viewport = { width: 1440, height: 900 }, touch = false) {
  const context = await browser.newContext({
    viewport,
    offline: true,
    isMobile: touch,
    hasTouch: touch,
    deviceScaleFactor: 1,
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
async function tick(page, n = 60) {
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
async function shot(cdp, name) {
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: false,
    captureBeyondViewport: false,
  });
  await fs.writeFile(`qa/drawer/${name}.png`, Buffer.from(data, "base64"));
}
async function surface(page, u, v) {
  return page.evaluate(
    ({ u, v }) => {
      const a = mid90sMinifridge,
        p = a.fridge
          .point({ surface: "front", u, v }, 0.025)
          .project(a.app.camera);
      return {
        x: (p.x * 0.5 + 0.5) * innerWidth,
        y: (-0.5 * p.y + 0.5) * innerHeight,
      };
    },
    { u, v },
  );
}
async function card(page, id) {
  await page.locator("#open-collection").click();
  await page.waitForTimeout(280);
  await page.locator('[data-filter="bands"]').click();
  const e = page.locator(`[data-sticker="${id}"]`);
  await e.scrollIntoViewIfNeeded();
  const r = await e.locator("img").boundingBox();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}
const { page, cdp, context } = await open();
const initial = await page.evaluate(() => {
  const a = mid90sMinifridge;
  return {
    total: a.stickers.items.length,
    placed: a.stickers.items.filter((s) => s.placed).length,
    bands: a.stickers.items.filter((s) => s.meta.category === "bands").length,
    fallback: a.stickers.items.filter((s) => s.art.usedFallback).length,
    badge: a.fridge.badge.userData,
    removed: document.querySelectorAll(
      "#sticker-tooltip,#selection-hint,#drag-hint,.scene-tools,#reset-view,#zoom-value,#save-image",
    ).length,
  };
});
console.log("INITIAL", initial);
assert.equal(initial.total, 39);
assert.equal(initial.placed, 24);
assert.equal(initial.bands, 15);
assert.equal(initial.fallback, 0);
assert.equal(initial.removed, 0);
assert.ok(initial.badge.gap < 0.07 && initial.badge.topClearance > 0.2);
await shot(cdp, "desktop");
await page.locator('.swatch[data-finish="mint"]').click();
await page.waitForTimeout(600);
assert.equal(
  await page.locator("#toast").evaluate((e) => e.classList.contains("visible")),
  false,
);
await page.locator('.swatch[data-finish="cream"]').click();
await page.waitForTimeout(500);
await page.locator("#home").hover();
await page.waitForFunction(() => mid90sMinifridge.brandPeel.state.peel > 0.9);
console.log(
  "HOVER",
  await page.evaluate(() => mid90sMinifridge.brandPeel.state),
);
assert.ok(
  await page.evaluate(() => mid90sMinifridge.brandPeel.state.peel > 0.7),
);
await shot(cdp, "wordmark-peel");
await page.locator("#home").click();
await page.waitForTimeout(350);
assert.ok(
  await page.evaluate(() => mid90sMinifridge.brandPeel.state.peel < 0.01),
);
await tick(page);
await page.mouse.move(12, 100);
await page.locator("#open-collection").click();
await page.waitForTimeout(280);
assert.equal(await page.locator(".sticker-card").count(), 39);
await shot(cdp, "wood-drawer");
await page.getByRole("button", { name: "Close collection" }).click();
await page.waitForTimeout(230);
let p = await card(page, "band-weezer");
await page.mouse.move(p.x, p.y);
await page.mouse.down();
await page.waitForTimeout(190);
assert.equal(
  await page.evaluate(
    () => mid90sMinifridge.interaction.active?.fromCollection,
  ),
  true,
);
let dest = await surface(page, -0.12, 0.65);
await page.mouse.move(dest.x, dest.y, { steps: 5 });
await tick(page, 50);
await shot(cdp, "dragging-to-fridge");
assert.equal(
  await page.evaluate(() => mid90sMinifridge.interaction.active?.valid),
  true,
);
await page.mouse.up();
await tick(page, 60);
assert.equal(
  await page.evaluate(
    () => mid90sMinifridge.stickers.find("band-weezer").placed,
  ),
  true,
);
assert.equal(
  await page.evaluate(
    () => mid90sMinifridge.stickers.items.filter((s) => s.placed).length,
  ),
  25,
);
console.log("Desktop drawer → fridge ✓");
// Invalid stock drop returns to the drawer, not an invisible stuck interaction.
p = await card(page, "band-oasis");
await page.mouse.move(p.x, p.y);
await page.mouse.down();
await page.waitForTimeout(190);
await page.mouse.move(100, 350, { steps: 4 });
await tick(page, 15);
await page.mouse.up();
await tick(page);
assert.equal(
  await page.evaluate(
    () => mid90sMinifridge.stickers.find("band-oasis").placed,
  ),
  false,
);
assert.equal(
  await page.evaluate(
    () => mid90sMinifridge.stickers.find("band-oasis").group.visible,
  ),
  false,
);
assert.equal(
  await page.evaluate(() => mid90sMinifridge.interaction.busy),
  false,
);
console.log("Invalid drop → drawer ✓");
// Quick click then click-to-place fallback.
p = await card(page, "band-radiohead");
await page.mouse.click(p.x, p.y);
assert.equal(
  await page.evaluate(() => mid90sMinifridge.interaction.active?.armed),
  true,
);
dest = await surface(page, 0.3, -0.75);
await page.mouse.click(dest.x, dest.y);
await tick(page);
assert.equal(
  await page.evaluate(
    () => mid90sMinifridge.stickers.find("band-radiohead").placed,
  ),
  true,
);
assert.equal(
  await page.evaluate(() => mid90sMinifridge.stickers.items.length),
  39,
);
console.log("Click-to-place ✓");
await page.evaluate(() => mid90sMinifridge.save());
await page.reload();
await page.waitForFunction(() => window.mid90sMinifridge, { timeout: 120000 });
await page.waitForFunction(
  () =>
    getComputedStyle(document.querySelector("#loader")).visibility === "hidden",
);
await page.evaluate(() => mid90sMinifridge.pause());
assert.equal(
  await page.evaluate(
    () => mid90sMinifridge.stickers.find("band-weezer").placed,
  ),
  true,
);
assert.equal(
  await page.evaluate(
    () => mid90sMinifridge.stickers.find("band-radiohead").placed,
  ),
  true,
);
assert.equal(
  await page.evaluate(
    () => mid90sMinifridge.stickers.find("band-oasis").placed,
  ),
  false,
);
console.log("Inventory placement persistence ✓");
await context.close();
const mobile = await open({ width: 390, height: 844 }, true);
await shot(mobile.cdp, "mobile");
p = await card(mobile.page, "band-weezer");
await shot(mobile.cdp, "mobile-drawer");
// A fast vertical swipe over a card scrolls the drawer without picking it.
await mobile.cdp.send("Input.dispatchTouchEvent", {
  type: "touchStart",
  touchPoints: [{ x: p.x, y: p.y, id: 1 }],
});
await mobile.cdp.send("Input.dispatchTouchEvent", {
  type: "touchMove",
  touchPoints: [{ x: p.x + 1, y: p.y - 72, id: 1 }],
});
await mobile.cdp.send("Input.dispatchTouchEvent", {
  type: "touchEnd",
  touchPoints: [],
});
await mobile.page.waitForTimeout(120);
assert.equal(
  await mobile.page.evaluate(() => mid90sMinifridge.interaction.busy),
  false,
);
assert.ok(
  await mobile.page
    .locator("#collection-dialog")
    .evaluate((e) => e.scrollTop > 10),
);
console.log("Touch drawer scroll ✓");
await mobile.page.getByRole("button", { name: "Close collection" }).click();
await mobile.page.waitForTimeout(230);
p = await card(mobile.page, "band-soundgarden");
await mobile.cdp.send("Input.dispatchTouchEvent", {
  type: "touchStart",
  touchPoints: [{ x: p.x, y: p.y, id: 2 }],
});
await mobile.page.waitForTimeout(260);
assert.equal(
  await mobile.page.evaluate(
    () => mid90sMinifridge.interaction.active?.fromCollection,
  ),
  true,
);
dest = await surface(mobile.page, 0.18, 0.3);
await mobile.cdp.send("Input.dispatchTouchEvent", {
  type: "touchMove",
  touchPoints: [{ x: dest.x, y: dest.y, id: 2 }],
});
await tick(mobile.page, 25);
await mobile.cdp.send("Input.dispatchTouchEvent", {
  type: "touchEnd",
  touchPoints: [],
});
await tick(mobile.page, 50);
assert.equal(
  await mobile.page.evaluate(
    () => mid90sMinifridge.stickers.find("band-soundgarden").placed,
  ),
  true,
);
assert.equal(
  await mobile.page.evaluate(() => mid90sMinifridge.interaction.busy),
  false,
);
console.log("Touch hold → drawer handoff → fridge ✓");
assert.deepEqual(errors, []);
assert.deepEqual(network, []);
console.log("DRAWER + BANDS + QUIET UI + BADGE + WORDMARK CHECKS PASSED");
await browser.close();
