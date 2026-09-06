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

/** Front alpha is reused for the silver back and the soft, die-cut contact shadow. */
export function makeStickerTextures(frontCanvas, seed = 1) {
  const w = frontCanvas.width,
    h = frontCanvas.height,
    ctx = frontCanvas.getContext("2d", { willReadFrequently: true });
  const pixels = ctx.getImageData(0, 0, w, h),
    alpha = new Uint8Array(w * h);
  for (let i = 0; i < alpha.length; i++) alpha[i] = pixels.data[i * 4 + 3];
  const [back, b] = canvas2D(w, h),
    image = b.createImageData(w, h),
    rand = random(seed + 9000);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4,
        grain = (rand() - 0.5) * 27,
        wrinkle =
          Math.sin(y * 0.092 + Math.sin(x * 0.03) * 0.6) * 7 +
          Math.cos(x * 0.049 + y * 0.011) * 5;
      const v = 179 + grain + wrinkle;
      image.data[i] = v;
      image.data[i + 1] = v + 2;
      image.data[i + 2] = v + 3;
      image.data[i + 3] = alpha[y * w + x];
    }
  b.putImageData(image, 0, 0);
  b.save();
  b.globalCompositeOperation = "source-atop";
  for (let i = 0; i < 24; i++) {
    const y = rand() * h;
    b.strokeStyle = i % 2 ? "rgba(255,255,255,.18)" : "rgba(30,35,38,.13)";
    b.lineWidth = 0.5 + rand() * 2;
    b.beginPath();
    b.moveTo(0, y);
    b.bezierCurveTo(w * 0.33, y - 9, w * 0.66, y + 8, w, y + 3);
    b.stroke();
  }
  b.restore();
  const [shadow, s] = canvas2D(256, Math.max(64, Math.round((256 * h) / w)));
  s.filter = "blur(3px)";
  s.drawImage(frontCanvas, 6, 6, shadow.width - 12, shadow.height - 12);
  s.filter = "none";
  s.globalCompositeOperation = "source-in";
  s.fillStyle = "#202517";
  s.fillRect(0, 0, shadow.width, shadow.height);
  const thumbScale = Math.min(1, 256 / Math.max(w, h));
  const [thumbnail, thumb] = canvas2D(
    Math.max(1, Math.round(w * thumbScale)),
    Math.max(1, Math.round(h * thumbScale)),
  );
  thumb.drawImage(frontCanvas, 0, 0, thumbnail.width, thumbnail.height);
  return {
    front: frontCanvas,
    back,
    shadow,
    alpha,
    alphaWidth: w,
    alphaHeight: h,
    thumbnail: thumbnail.toDataURL("image/png"),
  };
}
