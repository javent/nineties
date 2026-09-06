/** Bundle the ES modules, Three.js, fonts, PBR maps, and HDRI into ONE offline HTML. */
import { build, transform } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.resolve(root, "..", "Mid90s-Minifridge.html");
const mimeTypes = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".hdr": "application/octet-stream",
};
const assets = {};
for (const name of await fs.readdir(path.join(root, "public/assets"))) {
  const mime = mimeTypes[path.extname(name)];
  if (!mime) continue;
  const data = await fs.readFile(path.join(root, "public/assets", name));
  assets[name] = `data:${mime};base64,${data.toString("base64")}`;
}
let css =
  (await fs.readFile(path.join(root, "src/styles.css"), "utf8")) +
  "\n" +
  (await fs.readFile(path.join(root, "src/minimal-theme.css"), "utf8")) +
  "\n" +
  (await fs.readFile(path.join(root, "src/drawer.css"), "utf8"));
css = css.replace(
  /url\((["']?)\/assets\/([^)'"\s]+)\1\)/g,
  (_, quote, name) => {
    if (!assets[name]) throw new Error(`Missing asset: ${name}`);
    return `url("${assets[name]}")`;
  },
);
css = (await transform(css, { loader: "css", minify: true })).code;
const bundle = await build({
  entryPoints: [path.join(root, "src/main.js")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2022",
  platform: "browser",
  write: false,
  legalComments: "inline",
  logLevel: "info",
});
const js = bundle.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const runtimeAssets = Object.fromEntries(
  Object.entries(assets).filter(
    ([name]) => !name.endsWith(".woff2") && name !== "drawer-wood.jpg",
  ),
);
let html = await fs.readFile(path.join(root, "index.html"), "utf8");
html = html.replace(
  /<link\s+rel="stylesheet"\s+href="\/src\/drawer\.css"\s*\/?>/,
  "",
);
html = html.replace(
  /<link\s+rel="stylesheet"\s+href="\/src\/minimal-theme\.css"\s*\/?>/,
  "",
);
html = html.replace(
  /<link\s+rel="stylesheet"\s+href="\/src\/styles\.css"\s*\/?>/,
  () => `<style>${css}</style>`,
);
html = html.replace(
  /<script\b[^>]*src=["']\/src\/main\.js["'][^>]*><\/script>/,
  () =>
    `<script>window.__MID90S_MINIFRIDGE_ASSETS__=${JSON.stringify(runtimeAssets)};</script>\n<script type="module">${js}</script>`,
);
html = html.replace(
  "<!doctype html>",
  "<!doctype html>\n<!-- MID90S MINIFRIDGE · Minimal edition · Offline standalone edition. Three.js r185 (MIT). Reference-derived sticker artwork; see embedded credits.\nCC0 painted-metal maps: ambientCG PaintedMetal012. CC0 HDRI: Poly Haven Studio Small 09.\nUI fonts: Google Fonts, OFL / Apache 2.0. Header: outlined Revue artwork; see usage notes.\nFull notices and commented ES-module source\nare provided in Mid90s-Minifridge-Source.zip. No CDN, analytics, API keys or network required. -->",
);
if (
  html.includes('src="/src/main.js"') ||
  html.includes('href="/src/styles.css"') ||
  html.includes('href="/src/minimal-theme.css"') ||
  html.includes('href="/src/drawer.css"')
)
  throw new Error("Entry point was not inlined.");
const licenseSections = [];
for (const name of await fs.readdir(path.join(root, "licenses"))) {
  const text = await fs.readFile(path.join(root, "licenses", name), "utf8");
  licenseSections.push(`=== ${name} ===\n${text}`);
}
const notices = licenseSections
  .join("\n\n")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");
html = html.replace(
  "</body>",
  () =>
    `<template id="third-party-license-notices"><pre>${notices}</pre></template>\n</body>`,
);
await fs.writeFile(output, html);
// Keep earlier download links usable while the renamed file is canonical.
await fs.writeFile(path.resolve(root, "..", "Cold-Storage.html"), html);
console.log(
  `\nStandalone created: ${output}\n${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB · all assets embedded · fully offline\n`,
);
