// Dev-only visual check: drives the running dev server with a headless
// Chromium (software WebGL) and writes screenshots at a list of scroll stops.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const EXEC = process.env.CHROME_BIN || "/tmp/chrom/package/bin/chromium";
const URL = process.env.SHOT_URL || "http://localhost:5174/";
const OUT = process.env.SHOT_OUT || "/tmp/shots";
const stops = (process.env.SHOT_STOPS || "0,60,110,205,245,420,470,700")
  .split(",")
  .map(Number);
const mode = process.env.SHOT_MODE || "";

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
    "--disable-software-rasterizer=false",
    "--hide-scrollbars",
  ],
  env: { ...process.env, LD_LIBRARY_PATH: "/tmp/chrom/package/bin:/tmp/chrom/lib:/tmp/chrom/lib/lib" },
});

const page = await browser.newPage({ viewport: { width: 1452, height: 830 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type().toUpperCase()} ${m.text()}`);
});

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

for (const s of stops) {
  await page.evaluate(
    ([target, m]) => {
      window.__yia?.set(target, m);
    },
    [s, mode],
  );
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}/t${s}${mode ? "-" + mode : ""}.png` });
  process.stdout.write(`shot t=${s} ${mode}\n`);
}

if (errors.length) {
  console.log("\n--- console ---");
  console.log([...new Set(errors)].slice(0, 30).join("\n"));
} else {
  console.log("\nno console errors");
}

await browser.close();
