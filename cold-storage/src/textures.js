import * as THREE from "three";
import {
  asset,
  canvas2D,
  loadImage,
  random,
  textureFrom,
  withTimeout,
} from "./utils.js";

/**
 * The shipped maps are real CC0 PaintedMetal012 PBR maps from ambientCG.
 * We blend the base-color wear down rather than turning the fridge into a rusty prop.
 * REPLACE: assets/enamel-{color,normal,roughness}.jpg with your enamel PBR set.
 * Color is sRGB; roughness/normal are linear. Normal map must be OpenGL (+Y).
 */
export async function makeEnamelTextures() {
  const images = await Promise.all(
    ["enamel-color.jpg", "enamel-roughness.jpg", "enamel-normal.jpg"].map(
      (name) => withTimeout(loadImage(asset(name))).catch(() => null),
    ),
  );
  const [color, c] = canvas2D(1024),
    [rough, r] = canvas2D(1024),
    [normal, n] = canvas2D(1024);
  const rand = random(86);
  c.fillStyle = "#faf9f4";
  c.fillRect(0, 0, 1024, 1024);
  // Downloaded PBR material detail, softened into aged but cared-for enamel.
  if (images[0]) {
    c.globalAlpha = 0.115;
    c.drawImage(images[0], 0, 0, 1024, 1024);
    c.globalAlpha = 1;
  }
  r.fillStyle = "#a4a4a4";
  r.fillRect(0, 0, 1024, 1024);
  if (images[1]) {
    r.globalAlpha = 0.31;
    r.drawImage(images[1], 0, 0, 1024, 1024);
    r.globalAlpha = 1;
  }
  n.fillStyle = "#8080ff";
  n.fillRect(0, 0, 1024, 1024);
  if (images[2]) n.drawImage(images[2], 0, 0, 1024, 1024);
  const data = c.getImageData(0, 0, 1024, 1024),
    roughData = r.getImageData(0, 0, 1024, 1024);
  for (let i = 0; i < data.data.length; i += 4) {
    const grain = (rand() - 0.5) * 4;
    for (let j = 0; j < 3; j++) {
      data.data[i + j] += grain;
      roughData.data[i + j] += grain * 3;
    }
  }
  c.putImageData(data, 0, 0);
  r.putImageData(roughData, 0, 0);
  // Procedural supplemental micro-scuffs and fingerprint oil in the roughness only.
  for (let i = 0; i < 190; i++) {
    const x = rand() * 1024,
      y = rand() * 1024;
    c.strokeStyle = `rgba(110,102,80,${rand() * 0.07})`;
    c.lineWidth = 0.3 + rand() * 0.7;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + rand() * 30, y + rand() * 2);
    c.stroke();
    r.strokeStyle = "rgba(224,224,224,.14)";
    r.lineWidth = 0.6;
    r.beginPath();
    r.moveTo(x, y);
    r.lineTo(x + rand() * 40, y + 3);
    r.stroke();
  }
  for (let f = 0; f < 6; f++) {
    r.save();
    r.translate(110 + rand() * 80, 385 + rand() * 200);
    r.rotate(rand() * 2);
    for (let k = 0; k < 20; k++) {
      r.strokeStyle = "rgba(45,45,45,.11)";
      r.lineWidth = 0.65;
      r.beginPath();
      r.ellipse(0, 0, 4 + k * 0.8, 7 + k * 1.35, 0, -0.5, Math.PI * 1.7);
      r.stroke();
    }
    r.restore();
  }
  const map = textureFrom(color),
    roughnessMap = textureFrom(rough, false),
    normalMap = textureFrom(normal, false);
  return { map, roughnessMap, normalMap, usedRealMaps: !!images[0] };
}

export function floorTexture() {
  const [canvas, ctx] = canvas2D(512),
    rand = random(1986);
  const image = ctx.createImageData(512, 512);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 113 + rand() * 17;
    image.data[i] = v;
    image.data[i + 1] = v + 2;
    image.data[i + 2] = v - 7;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = textureFrom(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(35, 35);
  return texture;
}

export function groundShadow() {
  const [canvas, ctx] = canvas2D(256);
  const gradient = ctx.createRadialGradient(128, 128, 10, 128, 128, 125);
  gradient.addColorStop(0, "rgba(0,0,0,.78)");
  gradient.addColorStop(0.4, "rgba(0,0,0,.51)");
  gradient.addColorStop(0.75, "rgba(0,0,0,.12)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  return textureFrom(canvas);
}
