import { asset, canvas2D, random, loadImage, withTimeout } from "./utils.js";
export { CATALOG, CATALOG_VERSION } from "./sticker-catalog.js";

/** Load a genuine image cutout. Its exact alpha outline is shared by the printed
 * front, metallic adhesive back, soft contact shadow, and pointer hit mask.
 * REPLACE: change a catalog item's texture to any local transparent PNG / WebP.
 * Photographic color, detail and white die-cut edges are kept; no synthetic
 * "vintage" treatment is painted over the supplied brand artwork.
 */
export async function makeStickerArt(item) {
  try {
    const image = await withTimeout(loadImage(asset(item.texture)), 12000);
    const [canvas, ctx] = canvas2D(image.width, image.height);
    ctx.drawImage(image, 0, 0);
    return makeStickerTextures(canvas, item.seed);
  } catch (error) {
    console.warn(`Sticker image unavailable: ${item.texture}`, error.message);
    // Explicit, functional placeholder if a replacement URL is missing.
    // It is not substituted with another brand's art or the retired collection.
    const width = 480,
      height = Math.round((width * item.height) / item.width);
    const [canvas, ctx] = canvas2D(width, height);
    ctx.fillStyle = "#e6dfc4";
    ctx.beginPath();
    ctx.roundRect(12, 12, width - 24, height - 24, 22);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#30382c";
    ctx.font = `700 ${Math.min(54, height * 0.22)}px "DM Sans"`;
    ctx.fillText(item.name, width / 2, height * 0.46, width - 55);
    ctx.font = `${Math.min(14, height * 0.065)}px "IBM Plex Mono"`;
    ctx.fillText("IMAGE UNAVAILABLE", width / 2, height * 0.69, width - 50);
    const art = makeStickerTextures(canvas, item.seed);
    art.usedFallback = true;
    return art;
  }
}

/** Longest edge of the downscaled working copy that feeds the pointer hit mask,
 * the drawer thumbnail and the procedural silver grain. */
const MASK_MAX = 256;
/** Longest edge of the adhesive back map. Its alpha drives the peeled sticker's
 * die-cut silhouette (via alphaTest), so it stays higher than the grain. */
const BACK_MAX = 512;

/** Front alpha is reused for the silver back and the soft, die-cut contact shadow.
 *
 * Performance: the per-pixel JavaScript here used to run at the artwork's full
 * resolution for every catalog entry (~9.4 MP across 39 stickers, with three
 * trig calls per pixel). The expensive grain is now generated once at MASK_MAX
 * and magnified, while the silhouette is cut with a native composite from the
 * full-resolution art, so edge quality is preserved.
 */
export function makeStickerTextures(frontCanvas, seed = 1) {
  const w = frontCanvas.width,
    h = frontCanvas.height;

  // One small working copy, read back once, shared by every derived map.
  const maskScale = Math.min(1, MASK_MAX / Math.max(w, h));
  const mw = Math.max(1, Math.round(w * maskScale)),
    mh = Math.max(1, Math.round(h * maskScale));
  const [mask, m] = canvas2D(mw, mh, true);
  m.drawImage(frontCanvas, 0, 0, mw, mh);
  const pixels = m.getImageData(0, 0, mw, mh),
    alpha = new Uint8Array(mw * mh);
  for (let i = 0; i < alpha.length; i++) alpha[i] = pixels.data[i * 4 + 3];

  // Silver grain + wrinkles, rendered small. Frequencies are divided by the
  // scale so the pattern keeps its original spatial size once magnified.
  const [grainCanvas, g] = canvas2D(mw, mh);
  const image = g.createImageData(mw, mh),
    rand = random(seed + 9000),
    inverse = 1 / (maskScale || 1);
  for (let y = 0; y < mh; y++)
    for (let x = 0; x < mw; x++) {
      const i = (y * mw + x) * 4,
        fx = x * inverse,
        fy = y * inverse,
        grain = (rand() - 0.5) * 27,
        wrinkle =
          Math.sin(fy * 0.092 + Math.sin(fx * 0.03) * 0.6) * 7 +
          Math.cos(fx * 0.049 + fy * 0.011) * 5;
      const v = 179 + grain + wrinkle;
      image.data[i] = v;
      image.data[i + 1] = v + 2;
      image.data[i + 2] = v + 3;
      image.data[i + 3] = 255;
    }
  g.putImageData(image, 0, 0);
  for (let i = 0; i < 24; i++) {
    const y = rand() * mh;
    g.strokeStyle = i % 2 ? "rgba(255,255,255,.18)" : "rgba(30,35,38,.13)";
    g.lineWidth = Math.max(0.15, (0.5 + rand() * 2) * maskScale);
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(
      mw * 0.33,
      y - 9 * maskScale,
      mw * 0.66,
      y + 8 * maskScale,
      mw,
      y + 3 * maskScale,
    );
    g.stroke();
  }

  // Magnify the grain, then punch the die-cut outline from the full-resolution
  // artwork so the peeled underside keeps a crisp edge.
  const backScale = Math.min(1, BACK_MAX / Math.max(w, h));
  const bw = Math.max(1, Math.round(w * backScale)),
    bh = Math.max(1, Math.round(h * backScale));
  const [back, b] = canvas2D(bw, bh);
  b.drawImage(grainCanvas, 0, 0, bw, bh);
  b.globalCompositeOperation = "destination-in";
  b.drawImage(frontCanvas, 0, 0, bw, bh);
  b.globalCompositeOperation = "source-over";

  const [shadow, s] = canvas2D(256, Math.max(64, Math.round((256 * h) / w)));
  s.filter = "blur(3px)";
  s.drawImage(mask, 6, 6, shadow.width - 12, shadow.height - 12);
  s.filter = "none";
  s.globalCompositeOperation = "source-in";
  s.fillStyle = "#202517";
  s.fillRect(0, 0, shadow.width, shadow.height);

  return {
    front: frontCanvas,
    back,
    shadow,
    alpha,
    alphaWidth: mw,
    alphaHeight: mh,
    // The mask is already the thumbnail size. WebP encodes far faster than PNG
    // and browsers that lack WebP encoding transparently fall back to PNG.
    thumbnail: mask.toDataURL("image/webp", 0.82),
  };
}
