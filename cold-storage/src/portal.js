import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { asset, canvas2D, textureFrom } from "./utils.js";

function makeSurgePanelTexture() {
  const [canvas, ctx] = canvas2D(760, 1200);
  ctx.fillStyle = "#b7da18";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // The jagged burst and acid-green palette follow the reference machine without
  // turning the whole interior into a flat photograph.
  ctx.save();
  ctx.translate(380, 510);
  ctx.fillStyle = "#286c38";
  for (let i = 0; i < 26; i++) {
    const angle = (i / 26) * Math.PI * 2;
    const next = angle + 0.07;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 115, Math.sin(angle) * 115);
    ctx.lineTo(Math.cos(angle - 0.025) * 360, Math.sin(angle - 0.025) * 360);
    ctx.lineTo(Math.cos(next) * 310, Math.sin(next) * 310);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = "#123e45";
  ctx.font = "900 173px Arial Black, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.save();
  ctx.translate(378, 492);
  ctx.rotate(-0.06);
  ctx.lineWidth = 14;
  ctx.strokeStyle = "#f5eece";
  ctx.strokeText("SURGE", 0, 0);
  ctx.fillText("SURGE", 0, 0);
  ctx.restore();

  ctx.fillStyle = "#eef3d2";
  ctx.font = "700 31px Arial, sans-serif";
  ctx.letterSpacing = "4px";
  ctx.fillText("EXTREME CITRUS SODA", 380, 122);
  ctx.fillStyle = "#e94239";
  ctx.font = "900 57px Arial Black, Arial, sans-serif";
  ctx.fillText("FEEL THE RUSH", 380, 1060);
  ctx.fillStyle = "#163f39";
  ctx.font = "700 25px Arial, sans-serif";
  ctx.fillText("COLD STORAGE // 1996", 380, 1131);
  return textureFrom(canvas);
}

function makeCanTexture() {
  const [canvas, ctx] = canvas2D(512, 512);
  ctx.fillStyle = "#d93f32";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#236f3d";
  ctx.beginPath();
  ctx.arc(256, 270, 170, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#f6efc9";
  ctx.lineWidth = 12;
  ctx.stroke();
  ctx.fillStyle = "#f4edc8";
  ctx.font = "900 78px Arial Black, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("SURGE", 256, 260);
  ctx.fillStyle = "#fff7d6";
  ctx.font = "700 18px Arial, sans-serif";
  ctx.fillText("EXTREME CITRUS", 256, 350);
  return textureFrom(canvas);
}

function makeGrassTexture() {
  const [canvas, ctx] = canvas2D(512, 512);
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, "#8fca3d");
  gradient.addColorStop(0.45, "#65ad2f");
  gradient.addColorStop(1, "#3e8b2d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#d6e66b";
  ctx.lineWidth = 2;
  for (let y = 30; y < 512; y += 26) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y - 8);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return textureFrom(canvas);
}

export function createPortal(app, fridge, stickers) {
  const group = new THREE.Group();
  group.name = "inside the fridge · field portal";
  group.visible = false;

  const loader = new THREE.TextureLoader();
  const fieldTexture = loader.load(asset("field.jpg"));
  fieldTexture.colorSpace = THREE.SRGBColorSpace;
  fieldTexture.minFilter = THREE.LinearFilter;
  fieldTexture.magFilter = THREE.LinearFilter;

  const photoPromise = new Promise((resolve) => {
    loader.load(
      asset("surge-vending-machine.jpg"),
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        resolve(texture);
      },
      undefined,
      () => resolve(null),
    );
  });

  const grassTexture = makeGrassTexture();
  grassTexture.wrapS = THREE.RepeatWrapping;
  grassTexture.wrapT = THREE.RepeatWrapping;
  grassTexture.repeat.set(11, 11);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(110, 110),
    new THREE.MeshStandardMaterial({
      map: grassTexture,
      color: "#7fbd37",
      roughness: 0.96,
      metalness: 0,
    }),
  );
  ground.name = "the green field";
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -3.16;
  ground.receiveShadow = true;
  ground.renderOrder = -2;
  group.add(ground);

  const machine = new THREE.Group();
  machine.name = "SURGE vending machine · 3D";
  group.add(machine);
  const rounded = (w, h, d, radius, material, position, segments = 5) => {
    const mesh = new THREE.Mesh(
      new RoundedBoxGeometry(w, h, d, segments, radius),
      material,
    );
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    machine.add(mesh);
    return mesh;
  };

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: "#1b2426",
    roughness: 0.5,
    metalness: 0.72,
  });
  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: "#384143",
    roughness: 0.36,
    metalness: 0.84,
  });
  const greenMaterial = new THREE.MeshStandardMaterial({
    color: "#98cc1d",
    roughness: 0.62,
    metalness: 0.08,
  });
  const blackMaterial = new THREE.MeshStandardMaterial({
    color: "#111617",
    roughness: 0.74,
    metalness: 0.35,
  });
  const panelTexture = makeSurgePanelTexture();
  const panelMaterial = new THREE.MeshStandardMaterial({
    map: panelTexture,
    roughness: 0.7,
    metalness: 0.06,
  });

  rounded(3.24, 5.85, 1.55, 0.14, bodyMaterial, new THREE.Vector3(0, -0.05, 0));
  rounded(3.04, 5.52, 0.13, 0.055, edgeMaterial, new THREE.Vector3(0, 0.02, 0.805));
  rounded(2.72, 5.18, 0.1, 0.045, panelMaterial, new THREE.Vector3(-0.13, 0.08, 0.883));

  // Dark rails and bright side strips make the silhouette read as a real cabinet.
  rounded(0.14, 5.58, 0.18, 0.035, greenMaterial, new THREE.Vector3(-1.53, 0, 0.82));
  rounded(0.14, 5.58, 0.18, 0.035, greenMaterial, new THREE.Vector3(1.53, 0, 0.82));
  rounded(0.17, 5.3, 0.12, 0.025, blackMaterial, new THREE.Vector3(1.13, 0.1, 0.96));

  const payment = rounded(
    0.58,
    2.45,
    0.16,
    0.045,
    blackMaterial,
    new THREE.Vector3(1.06, 0.28, 0.99),
  );
  payment.name = "payment column";
  const displayMaterial = new THREE.MeshStandardMaterial({
    color: "#ed4937",
    emissive: "#d9261e",
    emissiveIntensity: 0.35,
    roughness: 0.34,
  });
  rounded(0.38, 0.38, 0.04, 0.02, displayMaterial, new THREE.Vector3(1.06, 1.03, 1.095), 4);
  const buttonMaterial = new THREE.MeshStandardMaterial({
    color: "#a4a9a0",
    metalness: 0.8,
    roughness: 0.26,
  });
  for (let i = 0; i < 4; i++) {
    const button = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.045, 18),
      buttonMaterial,
    );
    button.rotation.x = Math.PI / 2;
    button.position.set(1.06, 0.62 - i * 0.25, 1.095);
    button.castShadow = true;
    machine.add(button);
  }
  rounded(0.28, 0.12, 0.045, 0.018, edgeMaterial, new THREE.Vector3(1.06, -0.48, 1.1), 4);
  rounded(0.42, 0.07, 0.04, 0.018, edgeMaterial, new THREE.Vector3(1.06, -0.78, 1.1), 4);

  // The can protrudes from the art panel, giving the flat reference graphic a
  // tangible focal point when the visitor zooms toward the machine.
  const canTexture = makeCanTexture();
  const can = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.96, 32),
    new THREE.MeshStandardMaterial({
      color: "#e04635",
      map: canTexture,
      roughness: 0.42,
      metalness: 0.16,
    }),
  );
  can.position.set(-0.12, -0.36, 1.02);
  can.castShadow = true;
  machine.add(can);
  const canTop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.345, 0.345, 0.012, 28),
    new THREE.MeshStandardMaterial({ color: "#c3c8b4", metalness: 0.85, roughness: 0.23 }),
  );
  canTop.position.set(-0.12, 0.125, 1.02);
  machine.add(canTop);

  const dispense = rounded(
    0.98,
    0.52,
    0.15,
    0.045,
    blackMaterial,
    new THREE.Vector3(-0.25, -1.96, 0.97),
  );
  dispense.name = "can dispenser";
  rounded(0.75, 0.2, 0.03, 0.015, edgeMaterial, new THREE.Vector3(-0.25, -1.84, 1.06), 4);

  // A turquoise shipping pallet echoes the reference photo and grounds the machine.
  const palletMaterial = new THREE.MeshStandardMaterial({
    color: "#18c2a5",
    roughness: 0.68,
    metalness: 0.12,
  });
  const pallet = new THREE.Group();
  pallet.name = "turquoise shipping pallet";
  pallet.position.y = -3.36;
  group.add(pallet);
  const palletTop = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.24, 2.25), palletMaterial);
  palletTop.castShadow = true;
  palletTop.receiveShadow = true;
  pallet.add(palletTop);
  for (let x = -1.55; x <= 1.55; x += 0.78) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.29, 2.35), palletMaterial);
    slat.position.set(x, -0.25, 0);
    slat.castShadow = true;
    slat.receiveShadow = true;
    pallet.add(slat);
  }

  const targetRing = new THREE.Mesh(
    new THREE.RingGeometry(2.1, 2.18, 64),
    new THREE.MeshBasicMaterial({
      color: "#eaff81",
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  targetRing.name = "machine destination marker";
  targetRing.rotation.x = -Math.PI / 2;
  targetRing.position.y = -3.04;
  group.add(targetRing);

  let photoTexture = null;
  let active = false;
  let elapsed = 0;
  let previousVisibility = [];
  const ready = photoPromise.then((texture) => {
    photoTexture = texture;
    if (texture) {
      // Keep a small archival side decal on the cabinet. The geometry remains
      // modeled, while the supplied photograph supplies the period-specific ink.
      const photo = new THREE.Mesh(
        new THREE.PlaneGeometry(0.94, 1.38),
        new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: 0.78,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      );
      photo.name = "reference photograph decal";
      photo.position.set(1.64, 0.15, -0.02);
      photo.rotation.y = Math.PI / 2;
      photo.renderOrder = 2;
      machine.add(photo);
    }
  });

  function hideFridge() {
    previousVisibility = stickers.items.map((sticker) => ({
      sticker,
      group: sticker.group.visible,
      shadow: sticker.shadow.visible,
    }));
    fridge.group.visible = false;
    stickers.items.forEach((sticker) => {
      sticker.group.visible = false;
      sticker.shadow.visible = false;
    });
  }

  function restoreFridge() {
    fridge.group.visible = true;
    previousVisibility.forEach(({ sticker, group: visible, shadow }) => {
      sticker.group.visible = visible;
      sticker.shadow.visible = shadow;
    });
    previousVisibility = [];
  }

  function enter() {
    if (active) return;
    active = true;
    app.stopMotion();
    hideFridge();
    app.setMode("portal");
    app.backdrop.visible = false;
    group.visible = true;
    app.scene.background = fieldTexture;
    app.renderer.shadowMap.autoUpdate = true;
    app.renderer.shadowMap.needsUpdate = true;
    app.setView(
      new THREE.Vector3(8.4, 4.35, 15.8),
      new THREE.Vector3(0, -0.2, 0),
      false,
    );
  }

  function exit() {
    if (!active) return;
    active = false;
    group.visible = false;
    restoreFridge();
    app.scene.background = new THREE.Color(0x000000);
    app.backdrop.visible = true;
    app.setMode("fridge");
    app.renderer.shadowMap.autoUpdate = false;
    app.renderer.shadowMap.needsUpdate = true;
    app.reset(false);
  }

  function update(dt) {
    if (!active) return;
    elapsed += dt;
    targetRing.rotation.z += dt * 0.28;
    targetRing.material.opacity = 0.52 + Math.sin(elapsed * 3.2) * 0.14;
    machine.rotation.y = Math.sin(elapsed * 0.32) * 0.022;
    machine.position.y = Math.sin(elapsed * 0.7) * 0.018;
    const distance = app.camera.position.distanceTo(app.controls.target);
    const readout = document.querySelector("#portal-distance");
    if (readout) {
      readout.textContent = `${Math.max(0, Math.round(distance - 3.6))} m`;
    }
  }

  function dispose() {
    group.traverse((object) => {
      object.geometry?.dispose();
      if (Array.isArray(object.material))
        object.material.forEach((material) => material.dispose());
      else object.material?.dispose();
    });
    grassTexture.dispose();
    panelTexture.dispose();
    canTexture.dispose();
    fieldTexture.dispose();
    photoTexture?.dispose();
  }

  return {
    group,
    ready,
    enter,
    exit,
    update,
    dispose,
    get active() {
      return active;
    },
    get distance() {
      return app.camera.position.distanceTo(app.controls.target);
    },
  };
}
