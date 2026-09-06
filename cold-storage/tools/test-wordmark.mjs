import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";

await fs.mkdir("qa/revue", { recursive: true });
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
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  offline: true,
  deviceScaleFactor: 1,
});
const page = await context.newPage(),
  errors = [],
  requests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (/^https?:/.test(r.url())) requests.push(r.url());
});
await page.goto(new URL("../../Mid90s-Minifridge.html", import.meta.url).href);
await page.waitForFunction(() => window.mid90sMinifridge, { timeout: 120000 });
await page.waitForFunction(
  () =>
    getComputedStyle(document.querySelector("#loader")).visibility === "hidden",
);
await page.evaluate(() => mid90sMinifridge.pause());
const cdp = await context.newCDPSession(page);
async function shot(name) {
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: false,
    captureBeyondViewport: false,
  });
  await fs.writeFile(`qa/revue/${name}.png`, Buffer.from(data, "base64"));
}
async function render() {
  await page.evaluate(() => {
    const a = mid90sMinifridge;
    for (let i = 0; i < 80; i++) {
      a.app.update(1 / 60);
      a.stickers.update(1 / 60, false);
    }
    a.app.renderer.render(a.app.scene, a.app.camera);
  });
}
assert.equal(await page.locator('[data-typeface="Revue"]').count(), 1);
assert.equal(await page.locator('[data-typeface="Skate and font"]').count(), 0);
assert.match(
  await page.locator("body").evaluate((e) => getComputedStyle(e).fontFamily),
  /DM Sans/,
);
assert.equal(
  await page.evaluate(() => mid90sMinifridge.stickers.items.length),
  39,
);
assert.equal(
  await page.evaluate(
    () => mid90sMinifridge.stickers.items.filter((s) => s.placed).length,
  ),
  24,
);
await shot("desktop");
await page.locator("#home").hover();
await page.waitForFunction(() => mid90sMinifridge.brandPeel.state.peel > 0.9);
const raised = await page.evaluate(() => {
  const b = mid90sMinifridge.brandPeel;
  const width = document
    .querySelector("#home .brand-wordmark")
    .getBoundingClientRect().width;
  const middle = [...document.querySelectorAll(".brand-slice")]
    .slice(12, 45)
    .map((e) => new DOMMatrix(getComputedStyle(e).transform));
  return {
    ...b.state,
    width,
    strips: b.slices.length,
    liftedMiddle: middle.filter((m) => m.m43 > 8).length,
    upwardMiddle: middle.filter((m) => m.m42 < -2).length,
  };
});
assert.equal(raised.strips, 56);
assert.ok(raised.middleLift > raised.width * 0.075, JSON.stringify(raised));
assert.ok(
  raised.liftedMiddle > 10 && raised.upwardMiddle > 10,
  JSON.stringify(raised),
);
assert.ok(
  raised.foldedWidth < raised.width * 0.9 &&
    raised.foldedWidth > raised.width * 0.7,
);
console.log("Middle crumple:", raised);
await shot("hover");
await page.evaluate(() => {
  const a = mid90sMinifridge.app;
  a.camera.position.set(-9, 1.2, 12);
  a.controls.update();
});
await page.locator("#home").click();
await page.waitForFunction(() => mid90sMinifridge.brandPeel.state.peel < 0.001);
await render();
const flat = await page.evaluate(() => {
  const b = mid90sMinifridge.brandPeel;
  return {
    ...b.state,
    originalOpacity: b.original.style.opacity,
    layerVisibility: b.layer.style.visibility,
  };
});
assert.equal(flat.middleLift, 0);
assert.equal(flat.peakLift, 0);
assert.equal(flat.originalOpacity, "1");
assert.equal(flat.layerVisibility, "hidden");
assert.ok(
  await page.evaluate(() => mid90sMinifridge.app.camera.position.x > 0),
);
assert.equal(
  await page.evaluate(() => mid90sMinifridge.brandPeel.state.locked),
  true,
);
await page.mouse.move(8, 110);
for (const [width, height, name] of [
  [390, 844, "mobile"],
  [320, 720, "small-mobile"],
]) {
  await page.setViewportSize({ width, height });
  await page.waitForFunction(
    ({ width, height }) =>
      Math.abs(mid90sMinifridge.app.camera.aspect - width / height) < 0.001,
    { width, height },
  );
  await render();
  const bounds = await page.evaluate(() => {
    const a = document.querySelector("#home").getBoundingClientRect(),
      b = document.querySelector(".topbar nav").getBoundingClientRect();
    return { logoRight: a.right, navLeft: b.left, height: a.height };
  });
  assert.ok(bounds.logoRight + 5 < bounds.navLeft, JSON.stringify(bounds));
  await shot(name);
}
await page.locator("#open-collection").click();
assert.equal(await page.locator(".sticker-card").count(), 39);
assert.match(
  await page
    .locator("#collection-heading")
    .evaluate((e) => getComputedStyle(e).fontFamily),
  /DM Sans/,
);
assert.deepEqual(errors, []);
assert.deepEqual(requests, []);
console.log(
  "Revue-only wordmark; unchanged DM Sans UI, 39 stickers and wood drawer; raised middle crumples, click flatten/reset, mobile spacing and offline loading: PASSED.",
);
await browser.close();
