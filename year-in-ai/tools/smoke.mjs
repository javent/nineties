// Dev-only: exercises the controls and grabs a couple of responsive sizes.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const EXEC = process.env.CHROME_BIN || "/tmp/chrom/package/bin/chromium";
const OUT = "/tmp/shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: EXEC,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--in-process-gpu",
    "--disable-gpu-sandbox",
    "--hide-scrollbars",
  ],
  env: { ...process.env, LD_LIBRARY_PATH: "/tmp/chrom/package/bin:/tmp/chrom/lib:/tmp/chrom/lib/lib" },
});

const errors = [];
async function run(label, width, height, steps) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => errors.push(`[${label}] PAGEERROR ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`[${label}] ${m.text()}`);
  });
  await page.goto("http://localhost:5174/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await steps(page, label);
  await page.close();
}

await run("desktop", 1452, 830, async (page, label) => {
  // wheel into the year
  for (let i = 0; i < 26; i++) {
    await page.mouse.wheel(0, 320);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/ix-wheel.png` });
  const t1 = await page.evaluate(() => window.__yia.state.travel);

  // next milestone x3
  for (let i = 0; i < 3; i++) {
    await page.click('[data-nav="next"]');
    await page.waitForTimeout(1200);
  }
  const t2 = await page.evaluate(() => window.__yia.state.travel);
  await page.screenshot({ path: `${OUT}/ix-next.png` });

  // change the followed lab
  await page.click(".follow-btn");
  await page.waitForTimeout(350);
  await page.click('.follow-menu [data-lab="anthropic"]');
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}/ix-follow.png` });
  const who = await page.evaluate(() => window.__yia.state.followed);

  // milestone index sheet
  await page.click(".brand-menu");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/ix-sheet.png` });
  await page.click(".sheet-close");
  await page.waitForTimeout(300);

  // keyboard
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(900);
  const t3 = await page.evaluate(() => window.__yia.state.travel);
  console.log(`${label}: wheel→${t1.toFixed(0)} next→${t2.toFixed(0)} follow=${who} key→${t3.toFixed(0)}`);
});

await run("laptop", 1280, 720, async (page) => {
  await page.evaluate(() => window.__yia.set(258));
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}/rs-1280.png` });
});

await run("tablet", 834, 1112, async (page) => {
  await page.evaluate(() => window.__yia.set(258));
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}/rs-834.png` });
});

await run("phone", 414, 896, async (page) => {
  await page.evaluate(() => window.__yia.set(258));
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}/rs-414.png` });
});

console.log(errors.length ? "\nERRORS:\n" + [...new Set(errors)].join("\n") : "\nno page errors");
await browser.close();
