import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
await fs.mkdir("qa/hunter-green", { recursive: true });
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
async function material() {
  return page.evaluate(() => {
    const f = mid90sMinifridge.fridge,
      m = f.enamel;
    return {
      finish: f.finish,
      color: m.color.getHexString(),
      map: !!m.map,
      roughMap: !!m.roughnessMap,
      normal: m.normalScale.x,
      roughness: m.roughness,
      metalness: m.metalness,
      clearcoat: m.clearcoat,
      clearcoatRoughness: m.clearcoatRoughness,
      specularIntensity: m.specularIntensity,
      resources: f.textureResources.length,
    };
  });
}
await page.goto(new URL("../../Mid90s-Minifridge.html", import.meta.url).href);
await ready();
const original = await material();
assert.equal(original.finish, "cream");
await page.getByRole("button", { name: "Hunter green finish" }).click();
await page.waitForTimeout(250);
const green = await material();
assert.equal(green.finish, "hunter");
assert.equal(green.color, "183b29");
assert.equal(green.map, false);
assert.equal(green.roughMap, false);
assert.equal(green.normal, 0.004);
assert.equal(green.roughness, 0.42);
assert.equal(green.clearcoat, 0.06);
assert.equal(green.resources, 3);
assert.equal(await page.locator("#finish-name").innerText(), "Hunter green");
assert.equal(await page.locator('.swatch[data-finish="gold"]').count(), 0);
assert.equal(
  await page.locator("#toast").evaluate((e) => e.classList.contains("visible")),
  false,
);
await page.mouse.move(8, 110);
await page.evaluate(() => {
  const a = mid90sMinifridge;
  a.app.renderer.render(a.app.scene, a.app.camera);
});
const cdp = await context.newCDPSession(page);
const { data } = await cdp.send("Page.captureScreenshot", {
  format: "png",
  fromSurface: false,
  captureBeyondViewport: false,
});
await fs.writeFile("qa/hunter-green/desktop.png", Buffer.from(data, "base64"));
await page.getByRole("button", { name: "Sea glass finish" }).click();
const mint = await material();
assert.equal(mint.color, "a4c8b9");
assert.equal(mint.map, true);
assert.equal(mint.roughMap, true);
assert.equal(mint.roughness, original.roughness);
assert.equal(mint.normal, original.normal);
await page.getByRole("button", { name: "Buttermilk finish" }).click();
assert.deepEqual(await material(), original);
// Existing saved Harvest Gold selections migrate to the replacement, not to cream.
await page.addInitScript(() => {
  localStorage.setItem(
    "mid90s-minifridge-v1",
    JSON.stringify({ version: 3, finish: "gold", sound: false, stickers: [] }),
  );
});
await page.reload();
await ready();
assert.equal((await material()).finish, "hunter");
assert.equal(
  await page
    .locator('.swatch[data-finish="hunter"]')
    .getAttribute("aria-pressed"),
  "true",
);
await page.evaluate(() => mid90sMinifridge.save());
assert.equal(
  await page.evaluate(
    () => JSON.parse(localStorage.getItem("mid90s-minifridge-v1")).finish,
  ),
  "hunter",
);
assert.equal(
  await page.evaluate(() => mid90sMinifridge.stickers.items.length),
  39,
);
assert.deepEqual(errors, []);
assert.deepEqual(requests, []);
console.log("Hunter Green", green);
console.log(
  "Smooth dark finish, chip/label, quiet selection, original finish restoration, legacy gold migration, resource ownership and offline loading: PASSED.",
);
await browser.close();
