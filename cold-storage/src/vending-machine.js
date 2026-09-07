import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  asset,
  canvas2D,
  clamp,
  loadImage,
  random,
  textureFrom,
} from "./utils.js";

/** A late-90s SURGE soda machine. The cabinet is geometry; every art surface is
 *  a canvas texture. Panels paint themselves twice: a hand-painted fallback
 *  immediately, then again with the authentic 1996 logo and can artwork once
 *  those images decode (bundled in assets, so the swap is near-instant). */

function drawRays(ctx, cx, cy, inner, outer, count, color, rand) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.12;
    const length = outer * (0.68 + rand() * 0.5);
    const halfWidth = 0.05 + rand() * 0.05;
    ctx.beginPath();
    ctx.moveTo(
      cx + Math.cos(angle - halfWidth) * inner,
      cy + Math.sin(angle - halfWidth) * inner,
    );
    ctx.lineTo(cx + Math.cos(angle) * length, cy + Math.sin(angle) * length);
    ctx.lineTo(
      cx + Math.cos(angle + halfWidth) * inner,
      cy + Math.sin(angle + halfWidth) * inner,
    );
    ctx.closePath();
    ctx.fill();
  }
}

function drawSplat(ctx, cx, cy, radius, color, rand, points = 26) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const wobble = i % 2 ? 0.6 + rand() * 0.16 : 0.92 + rand() * 0.24;
    const r = radius * wobble;
    const x = cx + Math.cos(angle) * r,
      y = cy + Math.sin(angle) * r;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawSurgeWordmark(ctx, cx, cy, size, rand, options = {}) {
  const { fill = "#e0281f", outline = "#4d150b", tilt = -0.05 } = options;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  ctx.transform(1, 0, -0.24, 1, 0, 0);
  ctx.font = `${size}px "Sticker Heavy", "Arial Black", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const letters = "SURGE".split("");
  const widths = letters.map((l) => ctx.measureText(l).width * 0.94);
  let x = -widths.reduce((a, b) => a + b, 0) / 2;
  letters.forEach((letter, i) => {
    ctx.save();
    ctx.translate(x + widths[i] / 2, (rand() - 0.5) * size * 0.12);
    ctx.rotate((rand() - 0.5) * 0.13);
    ctx.lineJoin = "round";
    ctx.strokeStyle = outline;
    ctx.lineWidth = size * 0.15;
    ctx.strokeText(letter, 0, 0);
    ctx.fillStyle = fill;
    ctx.fillText(letter, 0, 0);
    ctx.globalAlpha = 0.5;
    ctx.fillText(letter, size * 0.025, -size * 0.02);
    ctx.restore();
    x += widths[i];
  });
  ctx.restore();
}

function drawCan(ctx, cx, cy, width, height, rotation, rand) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  const body = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
  body.addColorStop(0, "#175814");
  body.addColorStop(0.28, "#2f9e28");
  body.addColorStop(0.52, "#46c437");
  body.addColorStop(0.78, "#2f9e28");
  body.addColorStop(1, "#124510");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(-width / 2, -height / 2, width, height, width * 0.16);
  ctx.fill();
  ctx.fillStyle = "#c9cdd2";
  ctx.beginPath();
  ctx.ellipse(
    0,
    -height / 2 + width * 0.05,
    width * 0.44,
    width * 0.11,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.strokeStyle = "rgba(224,255,150,0.55)";
  ctx.lineWidth = width * 0.045;
  ctx.lineCap = "round";
  for (const [offset, sweep] of [
    [-0.18, 0.7],
    [0.12, 0.55],
  ]) {
    ctx.beginPath();
    ctx.arc(
      width * 0.7,
      height * offset,
      width * 0.85,
      Math.PI - sweep,
      Math.PI + sweep,
    );
    ctx.stroke();
  }
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.18 + rand() * 0.3})`;
    ctx.beginPath();
    ctx.arc(
      (rand() - 0.5) * width * 0.8,
      (rand() - 0.5) * height * 0.85,
      width * (0.012 + rand() * 0.022),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
}

function drawContained(ctx, image, cx, cy, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const w = image.width * scale,
    h = image.height * scale;
  ctx.drawImage(image, cx - w / 2, cy - h / 2, w, h);
}

function paintFront(ctx, art) {
  const rand = random(2097);
  const bg = ctx.createLinearGradient(0, 0, 0, 2048);
  bg.addColorStop(0, "#cede44");
  bg.addColorStop(0.55, "#bcd334");
  bg.addColorStop(1, "#a3c02b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 2048);
  if (art) {
    drawRays(ctx, 512, 1180, 300, 760, 18, "rgba(75,158,51,0.5)", rand);
    drawContained(ctx, art.logo, 512, 350, 880, 470);
    drawContained(ctx, art.can, 500, 1220, 940, 1360);
  } else {
    drawRays(ctx, 470, 880, 250, 900, 22, "#4b9e33", rand);
    drawRays(ctx, 470, 880, 220, 700, 18, "#2f7d24", rand);
    drawSplat(ctx, 470, 880, 430, "#f4f7ea", rand);
    drawCan(ctx, 470, 900, 380, 840, -0.17, rand);
    drawSurgeWordmark(ctx, 500, 870, 262, rand, { tilt: -0.07 });
  }
  ctx.save();
  ctx.translate(500, art ? 1930 : 1460);
  ctx.rotate(-0.08);
  ctx.fillStyle = "#d21e1e";
  ctx.beginPath();
  ctx.roundRect(-330, -44, 660, 88, 16);
  ctx.fill();
  ctx.fillStyle = "#ffe9c9";
  ctx.font = 'italic 52px "Sticker Marker", "DM Sans", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("fully loaded citrus soda", 0, 4);
  ctx.restore();
}

function paintSide(ctx, art) {
  const rand = random(1997);
  const bg = ctx.createLinearGradient(0, 0, 0, 1536);
  bg.addColorStop(0, "#c8d93e");
  bg.addColorStop(1, "#a6c22c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 768, 1536);
  if (art) {
    drawRays(ctx, 384, 900, 220, 560, 16, "rgba(75,158,51,0.5)", rand);
    drawContained(ctx, art.logo, 384, 400, 660, 380);
    drawContained(ctx, art.can, 384, 1030, 620, 900);
  } else {
    drawRays(ctx, 384, 640, 190, 720, 20, "#4b9e33", rand);
    drawSplat(ctx, 384, 640, 320, "#f4f7ea", rand);
    drawCan(ctx, 384, 650, 300, 660, 0.14, rand);
    drawSurgeWordmark(ctx, 390, 630, 190, rand, { tilt: 0.05 });
  }
}

function paintMarquee(ctx, art) {
  const rand = random(555);
  const bg = ctx.createLinearGradient(0, 0, 0, 320);
  bg.addColorStop(0, "#f3f8dd");
  bg.addColorStop(1, "#d9ecac");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 320);
  drawRays(ctx, 256, 160, 70, 250, 14, "rgba(96,168,52,0.5)", rand);
  if (art) drawContained(ctx, art.logo, 256, 160, 430, 260);
  else drawSurgeWordmark(ctx, 262, 162, 130, rand, { tilt: -0.04 });
}

function paintCanLabel(ctx, art) {
  const rand = random(777);
  const bg = ctx.createLinearGradient(0, 0, 512, 0);
  bg.addColorStop(0, "#1d6b1a");
  bg.addColorStop(0.5, "#3fbb32");
  bg.addColorStop(1, "#1d6b1a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 256);
  if (art) {
    // Camouflage blotches under the splat logo, like the real 1996 wrap.
    for (let i = 0; i < 46; i++)
      drawSplat(
        ctx,
        rand() * 512,
        rand() * 256,
        12 + rand() * 34,
        ["#2c8f24", "#1a5c17", "#5ecf3a", "#3fae2b"][i % 4],
        rand,
        10,
      );
    // Twice around the cylinder, so a logo faces you from any spin angle.
    drawContained(ctx, art.logo, 128, 128, 230, 170);
    drawContained(ctx, art.logo, 384, 128, 230, 170);
  } else {
    drawSplat(ctx, 256, 128, 108, "rgba(244,247,234,0.9)", rand, 20);
    drawSurgeWordmark(ctx, 258, 128, 74, rand, { tilt: -0.05 });
  }
}

function buttonLabelTexture() {
  const [canvas, ctx] = canvas2D(256, 128);
  const bg = ctx.createLinearGradient(0, 0, 0, 128);
  bg.addColorStop(0, "#e8e8e2");
  bg.addColorStop(1, "#c4c4bc");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = "#1f7d1d";
  ctx.font = '700 62px "DM Sans", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.transform(1, 0, -0.18, 1, 0, 0);
  ctx.fillText("SURGE", 142, 52);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#55565a";
  ctx.font = '500 26px "DM Sans", sans-serif';
  ctx.fillText("20 FL OZ", 128, 102);
  return textureFrom(canvas);
}

function haloTexture() {
  const [canvas, ctx] = canvas2D(128, 128);
  ctx.strokeStyle = "#c9ff54";
  ctx.shadowColor = "#9dff3d";
  ctx.shadowBlur = 14;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(64, 64, 44, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.shadowBlur = 0;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(64, 64, 44, 0, Math.PI * 2);
  ctx.stroke();
  return textureFrom(canvas);
}

function promptTexture() {
  const [canvas, ctx] = canvas2D(512, 144);
  ctx.fillStyle = "rgba(10,16,6,0.88)";
  ctx.strokeStyle = "#c9ff54";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(12, 12, 488, 120, 26);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#c9ff54";
  ctx.font = '700 64px "DM Sans", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("CLICK HERE", 256, 76);
  return textureFrom(canvas);
}

/** The authentic logo ships on a white card; lift the artwork off it once. */
function knockoutWhite(image, maxWidth = 1600) {
  const scale = Math.min(1, maxWidth / image.width);
  const [canvas, ctx] = canvas2D(
    Math.round(image.width * scale),
    Math.round(image.height * scale),
  );
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 232 && data[i + 1] > 232 && data[i + 2] > 232)
      data[i + 3] = 0;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

export function createVendingMachine({ audio, reducedMotion } = {}) {
  const group = new THREE.Group();
  group.name = "SURGE vending machine";
  const casing = new THREE.MeshStandardMaterial({
    color: "#101013",
    roughness: 0.52,
    metalness: 0.28,
  });
  const darker = new THREE.MeshStandardMaterial({
    color: "#08080a",
    roughness: 0.7,
    metalness: 0.2,
  });
  const chrome = new THREE.MeshStandardMaterial({
    color: "#c9cdd2",
    roughness: 0.25,
    metalness: 0.95,
  });
  const textures = [];
  const track = (texture) => (textures.push(texture), texture);

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.24, 2.7), darker);
  plinth.position.y = 0.12;
  plinth.castShadow = plinth.receiveShadow = true;
  group.add(plinth);
  const cabinet = new THREE.Mesh(
    new RoundedBoxGeometry(3.5, 6.8, 3.0, 4, 0.07),
    casing,
  );
  cabinet.position.y = 3.64;
  cabinet.castShadow = cabinet.receiveShadow = true;
  group.add(cabinet);

  // Paintable surfaces, procedural first and authentic once the images decode.
  const [frontCanvas, frontCtx] = canvas2D(1024, 2048);
  paintFront(frontCtx, null);
  const frontMap = track(textureFrom(frontCanvas));
  const [sideCanvas, sideCtx] = canvas2D(768, 1536);
  paintSide(sideCtx, null);
  const sideMap = track(textureFrom(sideCanvas));
  const [marqueeCanvas, marqueeCtx] = canvas2D(512, 320);
  paintMarquee(marqueeCtx, null);
  const marqueeMap = track(textureFrom(marqueeCanvas));
  const [canCanvas, canCtx] = canvas2D(512, 256);
  paintCanLabel(canCtx, null);
  const canMap = track(textureFrom(canCanvas));

  const front = new THREE.Mesh(
    new THREE.PlaneGeometry(2.42, 4.3),
    new THREE.MeshStandardMaterial({
      map: frontMap,
      emissive: 0xffffff,
      emissiveMap: frontMap,
      emissiveIntensity: 0.36,
      roughness: 0.42,
    }),
  );
  front.position.set(-0.42, 4.55, 1.503);
  group.add(front);
  for (const side of [-1, 1]) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 5.6),
      new THREE.MeshStandardMaterial({ map: sideMap, roughness: 0.45 }),
    );
    mesh.position.set(side * 1.752, 3.95, 0);
    mesh.rotation.y = (side * Math.PI) / 2;
    group.add(mesh);
  }

  // Selection column: lit SURGE sign, coin hardware, six buttons, coin return.
  const column = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 6.1), darker);
  column.position.set(1.26, 3.85, 1.502);
  group.add(column);
  const marqueeMaterial = new THREE.MeshStandardMaterial({
    map: marqueeMap,
    emissive: 0xffffff,
    emissiveMap: marqueeMap,
    // Bright enough to read as backlit without blowing the red logo to orange.
    emissiveIntensity: 0.75,
    roughness: 0.4,
  });
  const marquee = new THREE.Mesh(
    new THREE.PlaneGeometry(0.74, 0.48),
    marqueeMaterial,
  );
  marquee.position.set(1.26, 6.2, 1.508);
  group.add(marquee);
  const glow = new THREE.PointLight(0xd6f07d, 3.2, 8, 2);
  glow.position.set(1.26, 6.1, 2.3);
  group.add(glow);
  const coinPlate = new THREE.Mesh(
    new RoundedBoxGeometry(0.24, 0.36, 0.04, 2, 0.02),
    chrome,
  );
  coinPlate.position.set(1.26, 5.45, 1.51);
  group.add(coinPlate);
  const coinSlit = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, 0.16, 0.03),
    darker,
  );
  coinSlit.position.set(1.26, 5.5, 1.525);
  group.add(coinSlit);
  const bill = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.36, 0.03), casing);
  bill.position.set(1.26, 4.82, 1.505);
  group.add(bill);
  const billSlot = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.08, 0.02),
    darker,
  );
  billSlot.position.set(1.26, 4.82, 1.525);
  group.add(billSlot);
  const coinReturn = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.22, 0.03),
    darker,
  );
  coinReturn.position.set(1.26, 1.2, 1.505);
  group.add(coinReturn);

  const buttons = [];
  const labelTexture = track(buttonLabelTexture());
  for (let i = 0; i < 6; i++) {
    const material = new THREE.MeshStandardMaterial({
      color: "#d9d9d3",
      roughness: 0.45,
      metalness: 0.15,
    });
    const button = new THREE.Mesh(
      new RoundedBoxGeometry(0.58, 0.32, 0.07, 2, 0.025),
      material,
    );
    button.position.set(1.26, 4.18 - i * 0.47, 1.52);
    button.userData.buttonIndex = i;
    button.userData.restZ = 1.52;
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.25),
      new THREE.MeshStandardMaterial({ map: labelTexture, roughness: 0.4 }),
    );
    label.position.z = 0.036;
    button.add(label);
    group.add(button);
    buttons.push(button);
  }

  // Dispenser, hinged along its top edge so a landing can kicks the flap open.
  // A stamped metal surround and a brighter flap keep it readable against the
  // black cabinet — this is where the can appears, so it must look like a door.
  const recess = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.95, 0.2), darker);
  recess.position.set(-0.42, 1.3, 1.42);
  group.add(recess);
  const bezel = new THREE.MeshStandardMaterial({
    color: "#2c3038",
    roughness: 0.35,
    metalness: 0.7,
  });
  for (const [w, h, x, y] of [
    [1.94, 0.11, -0.42, 1.83],
    [1.94, 0.11, -0.42, 0.77],
    [0.11, 1.17, -1.335, 1.3],
    [0.11, 1.17, 0.495, 1.3],
  ]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), bezel);
    trim.position.set(x, y, 1.505);
    group.add(trim);
  }
  const flapPivot = new THREE.Group();
  flapPivot.position.set(-0.42, 1.775, 1.5);
  group.add(flapPivot);
  const flap = new THREE.Mesh(
    new RoundedBoxGeometry(1.46, 0.72, 0.045, 2, 0.02),
    new THREE.MeshStandardMaterial({
      color: "#3a3e46",
      roughness: 0.32,
      metalness: 0.65,
    }),
  );
  flap.name = "dispenser flap";
  flap.position.y = -0.38;
  flapPivot.add(flap);
  const [pushCanvas, pushCtx] = canvas2D(256, 96);
  pushCtx.fillStyle = "#23262c";
  pushCtx.fillRect(0, 0, 256, 96);
  pushCtx.strokeStyle = "#565b64";
  pushCtx.lineWidth = 4;
  pushCtx.strokeRect(6, 6, 244, 84);
  pushCtx.fillStyle = "#aeb4bd";
  pushCtx.font = '700 52px "DM Sans", sans-serif';
  pushCtx.textAlign = "center";
  pushCtx.textBaseline = "middle";
  pushCtx.fillText("PUSH", 128, 52);
  const push = new THREE.Mesh(
    new THREE.PlaneGeometry(0.52, 0.2),
    new THREE.MeshStandardMaterial({
      map: track(textureFrom(pushCanvas)),
      roughness: 0.4,
    }),
  );
  push.position.set(0, 0.02, 0.028);
  flap.add(push);

  // One real can. Hidden until the first vend.
  const can = new THREE.Group();
  can.name = "SURGE can";
  const canBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 0.46, 20),
    new THREE.MeshStandardMaterial({
      map: canMap,
      roughness: 0.32,
      metalness: 0.25,
    }),
  );
  canBody.userData.isCan = true;
  can.add(canBody);
  for (const y of [0.25, -0.25]) {
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.145, 0.155, 0.05, 20),
      chrome,
    );
    rim.position.y = y;
    can.add(rim);
  }
  can.visible = false;
  // Clicks on the rims count as clicks on the can.
  can.userData.isCan = true;
  can.traverse((o) => (o.castShadow = true));
  group.add(can);

  // Come-hither cues for the resting can: a pulsing halo and a CLICK HERE chip.
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: track(haloTexture()),
      transparent: true,
      depthTest: false,
      opacity: 0,
    }),
  );
  halo.renderOrder = 8;
  // Pure decoration: the cue sprites must never swallow a click meant for the
  // can or the machine behind them.
  halo.raycast = () => {};
  halo.visible = false;
  group.add(halo);
  const prompt = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: track(promptTexture()),
      transparent: true,
      depthTest: false,
      opacity: 0,
    }),
  );
  prompt.renderOrder = 9;
  prompt.raycast = () => {};
  prompt.scale.set(1.45, 0.41, 1);
  prompt.visible = false;
  group.add(prompt);
  let promptEnabled = true;

  // Swap in the real 1996 artwork once both images decode; the painted
  // fallback simply stays if anything goes wrong (offline, blocked, missing).
  (async () => {
    try {
      const [logoImage, canImage] = await Promise.all([
        loadImage(asset("surge-logo-1996.png")),
        loadImage(asset("surge-can.png")),
      ]);
      const art = { logo: knockoutWhite(logoImage), can: canImage };
      paintFront(frontCtx, art);
      frontMap.needsUpdate = true;
      paintSide(sideCtx, art);
      sideMap.needsUpdate = true;
      paintMarquee(marqueeCtx, art);
      marqueeMap.needsUpdate = true;
      paintCanLabel(canCtx, art);
      canMap.needsUpdate = true;
    } catch {
      /* Hand-painted art remains. */
    }
  })();

  const CAN_START = new THREE.Vector3(-0.42, 3.3, 1.12);
  const TRAY_Y = 1.25;
  const state = {
    phase: "idle", // idle | pressing | dropwait | falling | settling | rest | gone
    timer: 0,
    vy: 0,
    spin: 0,
    bounced: false,
    flapKick: 0,
    pressed: null,
    time: 0,
  };

  function vend(index = 0) {
    if (!["idle", "rest"].includes(state.phase)) return false;
    state.phase = "pressing";
    state.timer = 0;
    state.pressed = buttons[clamp(index, 0, buttons.length - 1)];
    audio?.vendButton();
    return true;
  }
  /** Hand the can over to the field for the focus/explosion ride. */
  function releaseCan() {
    if (state.phase !== "rest") return null;
    state.phase = "gone";
    halo.visible = false;
    prompt.visible = false;
    return can;
  }
  /** Take the can back after its ride so the buttons vend again. The caller
   *  re-parents the can into the machine group before asking. */
  function reclaimCan() {
    if (state.phase !== "gone") return false;
    can.visible = false;
    can.position.copy(CAN_START);
    can.rotation.set(0, 0, 0);
    can.scale.setScalar(1);
    can.traverse((o) => (o.castShadow = true));
    promptEnabled = true;
    state.phase = "idle";
    return true;
  }
  function setPrompt(value) {
    promptEnabled = value;
  }
  function setButtonGlow(button, t) {
    button.material.emissive.setRGB(0.4, 0.85, 0.3).multiplyScalar(0.55 * t);
  }

  function update(dt) {
    state.time += dt;
    let moved = false;
    if (!reducedMotion)
      marqueeMaterial.emissiveIntensity =
        0.75 + Math.sin(state.time * 11.3) * Math.sin(state.time * 2.7) * 0.05;
    if (state.flapKick > 0.001) {
      state.flapKick = Math.max(0, state.flapKick - dt * 2.4);
      flapPivot.rotation.x = 0.55 * Math.sin(state.flapKick * Math.PI);
      moved = true;
    }
    if (state.pressed) {
      state.timer += dt;
      const depth = Math.sin(clamp(state.timer / 0.24, 0, 1) * Math.PI) * 0.045;
      state.pressed.position.z = state.pressed.userData.restZ - depth;
      if (state.timer >= 0.24 && state.phase === "pressing") {
        state.phase = "dropwait";
        state.timer = 0;
      }
      if (state.phase !== "pressing" && state.timer >= 0.24) {
        state.pressed.position.z = state.pressed.userData.restZ;
        state.pressed = null;
      }
      moved = true;
    }
    switch (state.phase) {
      case "dropwait":
        state.timer += dt;
        if (state.timer >= 0.28) {
          audio?.vendThunk();
          can.visible = true;
          can.position.copy(CAN_START);
          can.rotation.set(0, 0.4, 0.06);
          state.vy = 0;
          state.bounced = false;
          state.phase = "falling";
          moved = true;
        }
        break;
      case "falling":
        state.vy -= 26 * dt;
        can.position.y += state.vy * dt;
        can.rotation.y += dt * 1.4;
        if (can.position.y <= TRAY_Y) {
          can.position.y = TRAY_Y;
          if (!state.bounced) {
            state.bounced = true;
            state.vy = -state.vy * 0.32;
            state.flapKick = 1;
            audio?.vendRattle();
          } else {
            state.phase = "settling";
            state.timer = 0;
          }
        }
        moved = true;
        break;
      case "settling": {
        state.timer += dt;
        const k = clamp(state.timer / 0.5, 0, 1);
        const ease = 1 - Math.pow(1 - k, 3);
        can.position.y = TRAY_Y - 0.09 * ease;
        can.position.z = 1.12 + 0.42 * ease;
        can.rotation.x = -1.22 * ease;
        can.rotation.y *= 1 - 0.1 * ease;
        if (k >= 1) state.phase = "rest";
        moved = true;
        break;
      }
    }
    // The resting can invites a click: halo hugging the can, chip floating above.
    const showCues = state.phase === "rest" && promptEnabled;
    halo.visible = showCues;
    prompt.visible = showCues;
    if (showCues) {
      const pulse = reducedMotion ? 0 : Math.sin(state.time * 3.2);
      halo.position.copy(can.position).add(new THREE.Vector3(0, 0.02, 0.28));
      halo.scale.setScalar(0.78 + pulse * 0.07);
      halo.material.opacity = 0.85 + pulse * 0.12;
      prompt.position
        .copy(can.position)
        .add(
          new THREE.Vector3(
            0,
            0.62 + (reducedMotion ? 0 : Math.sin(state.time * 2.1) * 0.035),
            0.3,
          ),
        );
      prompt.material.opacity = 0.96;
    }
    return moved;
  }

  return {
    group,
    buttons,
    can,
    canBody,
    vend,
    releaseCan,
    reclaimCan,
    setPrompt,
    hopCan: () => false,
    setButtonGlow,
    update,
    get busy() {
      return !["idle", "rest"].includes(state.phase);
    },
    get canResting() {
      return state.phase === "rest";
    },
    dispose() {
      textures.forEach((texture) => texture.dispose());
    },
  };
}
