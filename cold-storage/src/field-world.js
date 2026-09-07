import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { canvas2D, textureFrom, clamp, lerp, random } from "./utils.js";
import { createVendingMachine } from "./vending-machine.js";
import { FieldControls } from "./field-controls.js";
import { createSlime } from "./slime.js";

/** A fever-dream take on the 2001 "Bliss" wallpaper: a rolling hill dressed in
 *  real grass detail — tufts, flowers, a trodden path, ground mist, drifting
 *  pollen — sunk in pale haze, with a SURGE machine humming in the middle
 *  distance under an aura. Owns its own scene and camera; shares the renderer
 *  with the fridge room. `gate` is where the fridge doorway opens into this
 *  world, so the portal can map camera poses between the two spaces. */

const MACHINE_POSITION = new THREE.Vector3(0.6, 0, -30);
const FOG_COLOR = 0xd9e9dc;
const CAN_FLOOR = 0.26;
const EYE_HEIGHT = 6.05;

function smoothBump(x, z, cx, cz, radius, height) {
  const d = Math.hypot(x - cx, z - cz);
  if (d >= radius) return 0;
  return height * (0.5 + 0.5 * Math.cos((d / radius) * Math.PI));
}

export function heightAt(x, z) {
  let y = 0;
  y += smoothBump(x, z, -60, -80, 100, 11); // the Bliss crest, ahead and left
  y += smoothBump(x, z, 65, -45, 85, 5.5);
  y += smoothBump(x, z, -20, 70, 95, 4.5);
  y += Math.sin(x * 0.11) * Math.cos(z * 0.09) * 0.45;
  // Keep the walking corridor to the machine gentle underfoot.
  const corridor =
    Math.exp(-Math.pow(x / 11, 2)) * Math.exp(-Math.pow((z + 14) / 26, 2));
  return y * (1 - corridor * 0.85);
}

function grassTexture() {
  // Near-white base so the hill's vertex colors stay in charge; the blades
  // only break up the flat paint into something that reads as ground cover.
  const [canvas, ctx] = canvas2D(256, 256);
  ctx.fillStyle = "#f0f8dc";
  ctx.fillRect(0, 0, 256, 256);
  const rand = random(4141);
  for (let i = 0; i < 900; i++) {
    const x = rand() * 256,
      y = rand() * 256,
      length = 5 + rand() * 9,
      lean = (rand() - 0.5) * 5;
    ctx.strokeStyle = `rgba(${Math.round(105 + rand() * 70)}, ${Math.round(
      175 + rand() * 65,
    )}, ${Math.round(60 + rand() * 55)}, ${0.14 + rand() * 0.22})`;
    ctx.lineWidth = 0.8 + rand() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + lean,
      y - length * 0.6,
      x + lean * 1.7,
      y - length,
    );
    ctx.stroke();
  }
  const texture = textureFrom(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(90, 90);
  return texture;
}

function buildHill(pathPoints) {
  const geometry = new THREE.PlaneGeometry(400, 400, 130, 130);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const low = new THREE.Color("#45871d"),
    high = new THREE.Color("#98d94a"),
    dirt = new THREE.Color("#b3a066"),
    tint = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      z = positions.getZ(i);
    const y = heightAt(x, z);
    positions.setY(i, y);
    // A whisper of deterministic mottle keeps the paint from looking vector-flat.
    const jitter = Math.sin(x * 12.9898 + z * 78.233) * 0.035;
    tint.lerpColors(low, high, clamp(y / 11 + 0.22 + jitter, 0, 1));
    // The walk to the machine has been walked before: a soft trodden trail.
    // Radius comfortably wider than the ~3-unit vertex spacing, or it vanishes.
    let trail = Infinity;
    for (const p of pathPoints) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < trail) trail = d;
    }
    if (trail < 3.8) tint.lerp(dirt, (1 - trail / 3.8) * 0.5);
    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({ vertexColors: true, map: grassTexture() }),
  );
  mesh.receiveShadow = true;
  mesh.name = "bliss hill";
  return mesh;
}

function buildSky() {
  const [canvas, ctx] = canvas2D(64, 512);
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, "#2b5fae");
  gradient.addColorStop(0.42, "#5f9bd6");
  gradient.addColorStop(0.58, "#a5cdec");
  gradient.addColorStop(0.66, "#dceefb");
  gradient.addColorStop(1, "#dceefb");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 512);
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(320, 32, 16),
    new THREE.MeshBasicMaterial({
      map: textureFrom(canvas),
      side: THREE.BackSide,
      toneMapped: false,
      fog: false,
      depthWrite: false,
    }),
  );
  mesh.name = "sky dome";
  return mesh;
}

function cloudTexture(seed) {
  const [canvas, ctx] = canvas2D(256, 128);
  const rand = random(seed);
  for (let i = 0; i < 6; i++) {
    const x = 40 + rand() * 176,
      y = 46 + rand() * 42,
      r = 26 + rand() * 34;
    const blob = ctx.createRadialGradient(x, y, 2, x, y, r);
    blob.addColorStop(0, "rgba(255,255,255,0.95)");
    blob.addColorStop(0.65, "rgba(255,255,255,0.5)");
    blob.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = blob;
    ctx.fillRect(0, 0, 256, 128);
  }
  return textureFrom(canvas);
}

function auraTexture() {
  const [canvas, ctx] = canvas2D(256, 256);
  const glow = ctx.createRadialGradient(128, 128, 8, 128, 128, 126);
  glow.addColorStop(0, "rgba(230,255,190,0.95)");
  glow.addColorStop(0.35, "rgba(170,240,120,0.55)");
  glow.addColorStop(1, "rgba(140,220,90,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 256, 256);
  return textureFrom(canvas);
}

function tuftTexture() {
  const [canvas, ctx] = canvas2D(128, 128);
  const rand = random(717);
  for (let i = 0; i < 11; i++) {
    const baseX = 24 + rand() * 80,
      tipX = baseX + (rand() - 0.5) * 56,
      tipY = 6 + rand() * 34,
      width = 3 + rand() * 4;
    const shade = ctx.createLinearGradient(0, 128, 0, tipY);
    shade.addColorStop(
      0,
      `rgb(${Math.round(52 + rand() * 24)}, ${Math.round(108 + rand() * 30)}, 32)`,
    );
    shade.addColorStop(
      1,
      `rgb(${Math.round(120 + rand() * 50)}, ${Math.round(190 + rand() * 50)}, 72)`,
    );
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(baseX - width, 128);
    ctx.quadraticCurveTo(baseX - width * 0.4, (128 + tipY) / 2, tipX, tipY);
    ctx.quadraticCurveTo(
      baseX + width * 0.4,
      (128 + tipY) / 2,
      baseX + width,
      128,
    );
    ctx.closePath();
    ctx.fill();
  }
  return textureFrom(canvas);
}

function flowerTexture() {
  const [canvas, ctx] = canvas2D(64, 64);
  const rand = random(919);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + 0.3;
    ctx.fillStyle = "rgba(252,252,244,0.96)";
    ctx.beginPath();
    ctx.ellipse(
      32 + Math.cos(angle) * 12,
      30 + Math.sin(angle) * 12,
      9 + rand() * 2,
      6,
      angle,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.fillStyle = "#f4c93e";
  ctx.beginPath();
  ctx.arc(32, 30, 6.5, 0, Math.PI * 2);
  ctx.fill();
  // Stem, so ground-level flowers do not float.
  ctx.strokeStyle = "#5f9c37";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(32, 36);
  ctx.lineTo(31, 62);
  ctx.stroke();
  return textureFrom(canvas);
}

function mistTexture() {
  const [canvas, ctx] = canvas2D(256, 64);
  ctx.save();
  ctx.translate(128, 34);
  ctx.scale(1, 0.26);
  const blob = ctx.createRadialGradient(0, 0, 6, 0, 0, 122);
  blob.addColorStop(0, "rgba(236,248,238,0.85)");
  blob.addColorStop(0.6, "rgba(228,244,232,0.4)");
  blob.addColorStop(1, "rgba(228,244,232,0)");
  ctx.fillStyle = blob;
  ctx.fillRect(-128, -128, 256, 256);
  ctx.restore();
  return textureFrom(canvas);
}

function dotTexture() {
  const [canvas, ctx] = canvas2D(32, 32);
  const blob = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
  blob.addColorStop(0, "rgba(255,251,222,1)");
  blob.addColorStop(0.5, "rgba(255,251,222,0.5)");
  blob.addColorStop(1, "rgba(255,251,222,0)");
  ctx.fillStyle = blob;
  ctx.fillRect(0, 0, 32, 32);
  return textureFrom(canvas);
}

function dirtTexture() {
  const [canvas, ctx] = canvas2D(256, 256);
  const rand = random(626);
  for (const [radius, color] of [
    [118, "rgba(122,108,66,0.55)"],
    [86, "rgba(104,94,54,0.5)"],
  ]) {
    ctx.beginPath();
    for (let i = 0; i <= 26; i++) {
      const angle = (i / 26) * Math.PI * 2;
      const r = radius * (0.72 + rand() * 0.3);
      const x = 128 + Math.cos(angle) * r,
        y = 128 + Math.sin(angle) * r * 0.8;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(90,82,48,${0.15 + rand() * 0.3})`;
    ctx.beginPath();
    ctx.arc(
      30 + rand() * 196,
      40 + rand() * 176,
      1.5 + rand() * 4,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  return textureFrom(canvas);
}

function crossPlaneGeometry(width, height) {
  const a = new THREE.PlaneGeometry(width, height);
  a.translate(0, height / 2, 0);
  const b = a.clone();
  b.rotateY(Math.PI / 2);
  const merged = mergeGeometries([a, b]);
  a.dispose();
  b.dispose();
  return merged;
}

export function createFieldWorld({
  renderer,
  canvas,
  audio,
  reducedMotion,
  environment,
  onExit,
}) {
  const scene = new THREE.Scene();
  // Fever-dream haze: the machine half-dissolves in it at spawn and condenses
  // into focus as you walk. The sky dome ignores fog, so blue still burns above.
  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.Fog(FOG_COLOR, 22, 120);
  if (environment) {
    scene.environment = environment;
    scene.environmentIntensity = 0.35;
  }
  const camera = new THREE.PerspectiveCamera(
    45,
    Math.max(1e-6, canvas.clientWidth / Math.max(1, canvas.clientHeight)),
    0.1,
    700,
  );

  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, -0.5),
    new THREE.Vector3(-1.4, 0, -8.5),
    new THREE.Vector3(1.7, 0, -15.5),
    new THREE.Vector3(0.4, 0, -21.8),
  ]);
  // Where the fridge doorway opens into this world: at the path start, hung at
  // eye height so stepping through lands the camera exactly on its feet.
  const gate = new THREE.Vector3(0, heightAt(0, -0.5) + EYE_HEIGHT, -0.5);

  const hill = buildHill(path.getSpacedPoints(40));
  scene.add(hill, buildSky());

  const sun = new THREE.DirectionalLight(0xfff2d4, 2.8);
  sun.position.copy(MACHINE_POSITION).add(new THREE.Vector3(-28, 48, 20));
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -9;
  sun.shadow.camera.right = 9;
  sun.shadow.camera.top = 9;
  sun.shadow.camera.bottom = -9;
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = 150;
  sun.shadow.normalBias = 0.02;
  sun.shadow.bias = -0.0002;
  sun.shadow.radius = 3;
  scene.add(sun);
  sun.target.position.copy(MACHINE_POSITION);
  scene.add(sun.target);
  scene.add(new THREE.HemisphereLight(0xbfdcff, 0x4d8a2a, 0.9));
  // The sun itself, burning through the haze high to the left.
  const sunGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: auraTexture(),
      color: 0xfff4cd,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.55,
      fog: false,
    }),
  );
  sunGlow.position
    .copy(MACHINE_POSITION)
    .add(new THREE.Vector3(-28, 48, 20).normalize().multiplyScalar(290));
  sunGlow.scale.setScalar(58);
  scene.add(sunGlow);

  const cloudMaps = [cloudTexture(11), cloudTexture(23), cloudTexture(47)];
  const clouds = [];
  const cloudRand = random(1990);
  for (let i = 0; i < 10; i++) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: cloudMaps[i % cloudMaps.length],
        transparent: true,
        depthWrite: false,
        opacity: 0.92,
        fog: false,
      }),
    );
    sprite.position.set(
      -170 + cloudRand() * 340,
      34 + cloudRand() * 30,
      -180 + cloudRand() * 210,
    );
    const width = 24 + cloudRand() * 26;
    sprite.scale.set(width, width * 0.45, 1);
    sprite.userData.speed = 0.3 + cloudRand() * 0.5;
    scene.add(sprite);
    clouds.push(sprite);
  }
  // Ground mist: low wide banks that creep across the grass, above the fog.
  const mistMap = mistTexture();
  const mists = [];
  const mistRand = random(808);
  for (let i = 0; i < 12; i++) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: mistMap,
        transparent: true,
        depthWrite: false,
        opacity: 0.16 + mistRand() * 0.16,
        fog: false,
      }),
    );
    // The first few banks hug the walk and the machine; the rest roam far.
    const near = i < 4;
    const x = near ? -26 + mistRand() * 52 : -90 + mistRand() * 180,
      z = near ? -20 - mistRand() * 26 : -14 - mistRand() * 106;
    sprite.position.set(x, heightAt(x, z) + 1.6 + mistRand() * 1.6, z);
    sprite.scale.set(26 + mistRand() * 24, 3.4 + mistRand() * 3, 1);
    sprite.userData.speed = 0.18 + mistRand() * 0.35;
    scene.add(sprite);
    mists.push(sprite);
  }

  const machine = createVendingMachine({ audio, reducedMotion });
  machine.group.position.set(
    MACHINE_POSITION.x,
    heightAt(MACHINE_POSITION.x, MACHINE_POSITION.z),
    MACHINE_POSITION.z,
  );
  machine.group.rotation.y = -0.08;
  scene.add(machine.group);
  const machineFocus = machine.group.position
    .clone()
    .setY(machine.group.position.y + 3.6);

  // The light behind the machine: a rect of real illumination plus a visible
  // aura billboard that bleeds through the haze like a sign seen in a dream.
  const backlight = new THREE.PointLight(0x9dffb0, 60, 42, 2);
  backlight.position.copy(machineFocus).add(new THREE.Vector3(0, 2.2, -4.5));
  scene.add(backlight);
  const aura = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: auraTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
      fog: false,
    }),
  );
  aura.position.copy(machineFocus).add(new THREE.Vector3(0, 1.6, -3.8));
  aura.scale.setScalar(26);
  aura.renderOrder = 1;
  scene.add(aura);

  // ——— Meadow dressing: instanced tufts and flowers, two draw calls total ———
  const tuftMaterial = new THREE.MeshLambertMaterial({
    map: tuftTexture(),
    alphaTest: 0.45,
    side: THREE.DoubleSide,
  });
  const flowerMaterial = new THREE.MeshLambertMaterial({
    map: flowerTexture(),
    alphaTest: 0.4,
    side: THREE.DoubleSide,
  });
  function scatter(geometry, material, count, seed, place) {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    const rand = random(seed);
    const matrix = new THREE.Matrix4(),
      position = new THREE.Vector3(),
      quaternion = new THREE.Quaternion(),
      scale = new THREE.Vector3(),
      euler = new THREE.Euler(),
      shade = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const spot = place(rand, i);
      position.set(spot.x, heightAt(spot.x, spot.z) - 0.02, spot.z);
      euler.set(0, rand() * Math.PI * 2, 0);
      quaternion.setFromEuler(euler);
      scale.setScalar(spot.scale);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
      const brightness = 0.82 + rand() * 0.3;
      mesh.setColorAt(i, shade.setRGB(brightness, brightness, brightness));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.receiveShadow = false;
    mesh.castShadow = false;
    scene.add(mesh);
    return mesh;
  }
  const meadowSpot = (rand) => {
    if (rand() < 0.28) {
      // A denser ring right around the machine, where the eye lingers.
      const angle = rand() * Math.PI * 2,
        radius = 2.8 + rand() * 9;
      return {
        x: MACHINE_POSITION.x + Math.cos(angle) * radius,
        z: MACHINE_POSITION.z + Math.sin(angle) * radius,
        scale: 0.8 + rand() * 0.9,
      };
    }
    const side = rand() - 0.5;
    return {
      x: Math.sign(side) * Math.pow(Math.abs(side) * 2, 1.35) * 44,
      z: 8 - rand() * 66,
      scale: 0.7 + rand() * 1.0,
    };
  };
  scatter(crossPlaneGeometry(0.62, 0.5), tuftMaterial, 2300, 5150, meadowSpot);
  scatter(crossPlaneGeometry(0.2, 0.2), flowerMaterial, 260, 6160, (rand) => {
    const spot = meadowSpot(rand);
    spot.scale = 0.8 + rand() * 0.7;
    return spot;
  });

  // Pollen motes drifting through the sunlight along the walk.
  const POLLEN = 130;
  const pollenBase = new Float32Array(POLLEN * 3);
  const pollenPhase = new Float32Array(POLLEN);
  const pollenRand = random(303);
  for (let i = 0; i < POLLEN; i++) {
    const x = (pollenRand() - 0.5) * 32,
      z = 4 - pollenRand() * 42;
    pollenBase[i * 3] = x;
    pollenBase[i * 3 + 1] = heightAt(x, z) + 1.2 + pollenRand() * 5.6;
    pollenBase[i * 3 + 2] = z;
    pollenPhase[i] = pollenRand() * Math.PI * 2;
  }
  const pollenGeometry = new THREE.BufferGeometry();
  pollenGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(pollenBase.slice(), 3),
  );
  const pollen = new THREE.Points(
    pollenGeometry,
    new THREE.PointsMaterial({
      map: dotTexture(),
      size: 0.14,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  scene.add(pollen);

  // The machine has been here a while: worn dirt, a power cable that just
  // runs off into the grass, and a couple of spent cans.
  const dirt = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 8),
    new THREE.MeshLambertMaterial({
      map: dirtTexture(),
      transparent: true,
      depthWrite: false,
    }),
  );
  dirt.rotation.x = -Math.PI / 2;
  dirt.position.set(
    MACHINE_POSITION.x - 0.2,
    machine.group.position.y + 0.025,
    MACHINE_POSITION.z + 1.6,
  );
  dirt.renderOrder = 1;
  scene.add(dirt);
  const cableBase = machine.group.position.y;
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(1.5, cableBase + 0.4, -31.3),
        new THREE.Vector3(3.2, heightAt(3.2, -33.6) + 0.06, -33.6),
        new THREE.Vector3(6.4, heightAt(6.4, -38) + 0.05, -38),
        new THREE.Vector3(8.8, heightAt(8.8, -44) - 0.2, -44),
      ]),
      48,
      0.055,
      8,
    ),
    new THREE.MeshStandardMaterial({ color: "#14161a", roughness: 0.85 }),
  );
  scene.add(cable);
  const litterRand = random(555);
  for (const [x, z] of [
    [3.1, -27.2],
    [-1.8, -26.4],
  ]) {
    const litter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.3, 12),
      new THREE.MeshStandardMaterial({
        color: "#3f7a33",
        roughness: 0.55,
        metalness: 0.35,
      }),
    );
    litter.position.set(x, heightAt(x, z) + 0.1, z);
    litter.rotation.set(Math.PI / 2 + 0.2, 0, litterRand() * Math.PI);
    litter.scale.y = 0.55;
    scene.add(litter);
  }

  const slime = createSlime(scene, heightAt);
  const slimeOverlay = document.querySelector("#slime");

  // ——— Can journey: machine → focused (blurred world) → flying → landed ———
  let canState = "machine"; // machine | focused | dropped | flying | landed
  let exploded = false;
  const canFlight = {
    velocity: new THREE.Vector3(),
    spin: new THREE.Vector3(),
    time: 0,
    bounces: 0,
    fall: 0,
  };
  const flightRand = random(4242);
  let hillTint = 0;
  const tintables = [hill.material, tuftMaterial, flowerMaterial];
  let overlayTimer = -1;

  const focusScene = new THREE.Scene();
  focusScene.environment = environment || null;
  focusScene.environmentIntensity = 0.6;
  focusScene.add(new THREE.HemisphereLight(0xe8f4ff, 0x3d6b1f, 0.85));
  const focusKey = new THREE.DirectionalLight(0xfff2d4, 2.2);
  focusKey.position.set(2, 3, 4);
  focusScene.add(focusKey);

  // Low-res ping-pong targets: rendering the world small and stretching it back
  // IS the blur — two downsamples, zero postprocessing shaders, very cheap.
  let rtA = null,
    rtB = null;
  const blitCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blitScene = new THREE.Scene();
  const blitMaterial = new THREE.MeshBasicMaterial({
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const blitQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blitMaterial);
  blitScene.add(blitQuad);
  function ensureTargets() {
    const width = Math.max(64, Math.floor(canvas.clientWidth / 3)),
      height = Math.max(64, Math.floor(canvas.clientHeight / 3));
    if (rtA && rtA.width === width) return;
    rtA?.dispose();
    rtB?.dispose();
    const options = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
    };
    rtA = new THREE.WebGLRenderTarget(width, height, options);
    rtB = new THREE.WebGLRenderTarget(
      Math.max(32, Math.floor(width / 2)),
      Math.max(32, Math.floor(height / 2)),
      options,
    );
    // Null→texture map changes need a program rebuild; texture→texture doesn't.
    blitMaterial.map = rtA.texture;
    blitMaterial.needsUpdate = true;
  }

  function focusCan() {
    const can = machine.releaseCan();
    if (!can) return;
    machine.setPrompt(false);
    focusScene.attach(can);
    canState = "focused";
    audio.unlock();
    audio.stick();
  }
  function refocusCan(can) {
    focusScene.attach(can);
    canState = "focused";
    audio.stick();
  }
  function dropCan() {
    // Escape hatch from the focus trance: the can just falls into the grass.
    scene.attach(machine.can);
    canFlight.velocity.set(0, 0, 0);
    canState = "dropped";
  }
  function explodeCan() {
    const can = machine.can;
    scene.attach(can);
    canState = "flying";
    exploded = true;
    canFlight.time = 0;
    canFlight.bounces = 0;
    const angle = flightRand() * Math.PI * 2;
    canFlight.velocity.set(Math.cos(angle) * 14, 10, Math.sin(angle) * 14);
    canFlight.spin.set(
      6 + flightRand() * 8,
      4 + flightRand() * 6,
      6 + flightRand() * 8,
    );
    can.traverse((o) => (o.castShadow = false));
    slime.burst(can.getWorldPosition(new THREE.Vector3()));
    audio.slimePop();
    if (slimeOverlay) {
      if (reducedMotion) slimeOverlay.classList.add("slimed");
      else {
        slimeOverlay.classList.add("burst");
        overlayTimer = 0.9;
      }
    }
  }
  function settleCanNow() {
    if (canState === "focused" || canState === "flying") {
      const can = machine.can;
      scene.attach(can);
      can.position.y = heightAt(can.position.x, can.position.z) + CAN_FLOOR;
      canState = exploded ? "landed" : "dropped";
      can.traverse((o) => (o.castShadow = true));
    }
  }

  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  let hoveredButton = null;
  const glowLevels = new Map();
  function setRay(event) {
    const rect = canvas.getBoundingClientRect();
    pointerNDC.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointerNDC, camera);
  }
  // Generous reach: the machine looks close well before the path ends, and a
  // click that looks like it should work, should work.
  const VEND_RANGE = 16;
  function nearMachine() {
    return camera.position.distanceTo(machineFocus) < VEND_RANGE;
  }
  function canPickable() {
    return (
      (machine.canResting && nearMachine()) ||
      canState === "dropped" ||
      canState === "landed"
    );
  }
  function pick(event) {
    setRay(event);
    const targets = [];
    if (nearMachine()) targets.push(...machine.buttons);
    if (canPickable()) targets.push(machine.can);
    if (!targets.length) return null;
    const hit = raycaster.intersectObjects(targets, true)[0];
    if (!hit) return null;
    let object = hit.object;
    while (
      object &&
      object.userData.buttonIndex === undefined &&
      !object.userData.isCan
    )
      object = object.parent;
    return object || null;
  }
  function hover(event) {
    if (event.pointerType === "touch") return;
    if (canState === "focused") {
      setRay(event);
      canvas.classList.toggle(
        "is-handle-hover",
        raycaster.intersectObject(machine.canBody, false).length > 0,
      );
      return;
    }
    const object = pick(event);
    setHoveredButton(
      object?.userData.buttonIndex !== undefined ? object : null,
    );
    // Beyond arm's reach the whole machine is still an invitation: the cursor
    // signals that clicking it will walk you over.
    let interactive = !!object;
    if (!interactive) {
      setRay(event);
      interactive = raycaster.intersectObject(machine.group, true).length > 0;
    }
    canvas.classList.toggle("is-handle-hover", interactive);
  }
  function setHoveredButton(button) {
    if (hoveredButton === button) return;
    hoveredButton = button;
    if (!button) canvas.classList.remove("is-handle-hover");
  }
  function tap(event) {
    if (canState === "focused") {
      setRay(event);
      if (raycaster.intersectObject(machine.canBody, false).length)
        explodeCan();
      return;
    }
    const object = pick(event);
    if (!object) {
      // No button or can under the cursor — but clicking the machine itself,
      // from any distance, strolls you up to it instead of doing nothing.
      setRay(event);
      if (raycaster.intersectObject(machine.group, true).length) {
        audio.unlock();
        controls.progressTarget = 1;
      }
      return;
    }
    audio.unlock();
    if (object.userData.buttonIndex !== undefined) {
      // A spent can lying in the grass doesn't jam the machine: pressing a
      // button pulls it back into stock and vends it fresh.
      if (canState === "landed" || canState === "dropped") {
        machine.group.attach(machine.can);
        if (machine.reclaimCan()) canState = "machine";
      }
      machine.vend(object.userData.buttonIndex);
    } else if (object.userData.isCan) {
      if (machine.canResting) focusCan();
      else if (canState === "dropped") refocusCan(machine.can);
      else if (canState === "landed") {
        // The spent can still squirts a little when poked.
        slime.emit(machine.can.getWorldPosition(new THREE.Vector3()), 10, 5);
        audio.slimeSquelch();
      }
    }
  }
  const controls = new FieldControls(camera, canvas, {
    path,
    heightAt,
    reducedMotion,
    onExit: () => {
      if (canState === "focused") dropCan();
      else onExit();
    },
    onTap: tap,
    onHover: hover,
    focus: machineFocus,
  });

  let active = false,
    lastWidth = 0,
    lastHeight = 0;
  function resize() {
    const width = canvas.clientWidth,
      height = Math.max(1, canvas.clientHeight);
    if (width === lastWidth && height === lastHeight) return;
    lastWidth = width;
    lastHeight = height;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (rtA) ensureTargets();
  }

  const workVector = new THREE.Vector3();
  const scratchVector = new THREE.Vector3();
  const scratchQuaternion = new THREE.Quaternion();
  function updateCan(dt) {
    const can = machine.can;
    if (canState === "focused") {
      camera.getWorldDirection(workVector);
      workVector.multiplyScalar(1.7).add(camera.position);
      can.position.lerp(workVector, 1 - Math.exp(-dt * 7));
      const scale = lerp(can.scale.x, 1.9, 1 - Math.exp(-dt * 6));
      can.scale.setScalar(scale);
      can.rotation.y += dt * (reducedMotion ? 0.25 : 0.9);
      can.rotation.x = lerp(can.rotation.x, -0.2, 0.06);
      return false;
    }
    if (canState === "dropped") {
      const floor = heightAt(can.position.x, can.position.z) + CAN_FLOOR;
      if (can.position.y > floor) {
        canFlight.fall += dt * 16;
        can.position.y = Math.max(floor, can.position.y - canFlight.fall * dt);
        can.scale.setScalar(lerp(can.scale.x, 1, 1 - Math.exp(-dt * 6)));
        return false;
      }
      canFlight.fall = 0;
      return false;
    }
    if (canState !== "flying") return false;
    canFlight.time += dt;
    canFlight.velocity.y -= 9.5 * dt;
    can.position.addScaledVector(canFlight.velocity, dt);
    can.rotation.x += canFlight.spin.x * dt;
    can.rotation.y += canFlight.spin.y * dt;
    can.rotation.z += canFlight.spin.z * dt;
    can.scale.setScalar(lerp(can.scale.x, 1.2, 1 - Math.exp(-dt * 4)));
    // A slime ribbon trails the whole ride.
    slime.emit(can.position, 1, 3.2, 0.8);
    const floor = heightAt(can.position.x, can.position.z) + CAN_FLOOR;
    if (can.position.y <= floor && canFlight.velocity.y < 0) {
      can.position.y = floor;
      canFlight.bounces += 1;
      slime.stamp(can.position.x, can.position.z, 1.6 + flightRand() * 2.2);
      slime.emit(can.position, 8, 7, 1.3);
      audio.slimeSquelch();
      if (canFlight.bounces >= 12 || canFlight.time > 10) {
        canState = "landed";
        canFlight.velocity.set(0, 0, 0);
        can.rotation.set(0, can.rotation.y, 1.45);
        can.traverse((o) => (o.castShadow = true));
        renderer.shadowMap.needsUpdate = true;
        return true;
      }
      canFlight.velocity.y = Math.abs(canFlight.velocity.y) * 0.82 + 2.5;
      // Ricochet somewhere new; drift back toward the middle when far out.
      const toCenter = workVector
        .set(-can.position.x, 0, -can.position.z)
        .normalize();
      const angle = flightRand() * Math.PI * 2;
      const speed = 11 + flightRand() * 6;
      canFlight.velocity.x = Math.cos(angle) * speed;
      canFlight.velocity.z = Math.sin(angle) * speed;
      if (can.position.length() > 90) {
        canFlight.velocity.x = toCenter.x * speed;
        canFlight.velocity.z = toCenter.z * speed;
      }
    }
    return false;
  }

  // Stepping through the doorway: the first beat of field time eases from the
  // portal camera's pose (and its tighter fridge lens) into the walk pose.
  let arrival = null;
  function update(dt) {
    resize();
    controls.update(dt);
    if (arrival) {
      arrival.t += dt;
      const k = clamp(arrival.t / 0.85, 0, 1);
      const s = k * k * (3 - 2 * k);
      scratchVector.copy(camera.position);
      camera.position.lerpVectors(arrival.position, scratchVector, s);
      scratchQuaternion.copy(camera.quaternion);
      camera.quaternion.slerpQuaternions(
        arrival.quaternion,
        scratchQuaternion,
        s,
      );
      camera.fov = lerp(arrival.fov, 45, s);
      camera.updateProjectionMatrix();
      if (k >= 1) {
        arrival = null;
        camera.fov = 45;
        camera.updateProjectionMatrix();
      }
    }
    const drift = reducedMotion ? 0.5 : 1;
    for (const cloud of clouds) {
      cloud.position.x += cloud.userData.speed * drift * dt;
      if (cloud.position.x > 190) cloud.position.x = -190;
    }
    for (const mist of mists) {
      mist.position.x += mist.userData.speed * drift * dt;
      if (mist.position.x > 140) mist.position.x = -140;
    }
    if (!reducedMotion) {
      const time = performance.now() * 0.001;
      const positions = pollen.geometry.attributes.position;
      for (let i = 0; i < POLLEN; i++) {
        positions.array[i * 3] =
          pollenBase[i * 3] +
          Math.sin(time * 0.21 + pollenPhase[i] * 1.7) * 0.9;
        positions.array[i * 3 + 1] =
          pollenBase[i * 3 + 1] + Math.sin(time * 0.5 + pollenPhase[i]) * 0.8;
        positions.array[i * 3 + 2] =
          pollenBase[i * 3 + 2] + Math.cos(time * 0.17 + pollenPhase[i]) * 0.7;
      }
      positions.needsUpdate = true;
    }
    if (machine.update(dt)) renderer.shadowMap.needsUpdate = true;
    updateCan(dt);
    slime.update(dt);
    if (exploded && hillTint < 1) {
      // The field itself succumbs: grass, tufts and flowers slide slime-green.
      hillTint = Math.min(1, hillTint + dt / 3);
      for (const material of tintables)
        material.color.setRGB(1 - hillTint * 0.35, 1, 1 - hillTint * 0.55);
    }
    if (overlayTimer > 0) {
      overlayTimer -= dt;
      if (overlayTimer <= 0 && slimeOverlay) {
        slimeOverlay.classList.remove("burst");
        slimeOverlay.classList.add("slimed");
      }
    }
    if (!reducedMotion) {
      const throb = 0.85 + Math.sin(performance.now() * 0.0012) * 0.12;
      aura.material.opacity = throb;
      backlight.intensity = 55 + throb * 14;
    }
    for (const button of machine.buttons) {
      const target = button === hoveredButton ? 1 : 0;
      const level = glowLevels.get(button) || 0;
      if (Math.abs(level - target) > 0.001) {
        const next = level + (target - level) * 0.18;
        glowLevels.set(button, next);
        machine.setButtonGlow(button, next);
      }
    }
    if (active) {
      audio.setWind(0.022);
      const distance = camera.position.distanceTo(machineFocus);
      audio.setHum(clamp(1.8 / (distance * distance), 0, 0.05));
    }
  }

  /** Render the frame: plain in the field, blurred-world composite in focus. */
  function render() {
    if (canState !== "focused") {
      renderer.render(scene, camera);
      return;
    }
    ensureTargets();
    renderer.setRenderTarget(rtA);
    renderer.render(scene, camera);
    blitMaterial.map = rtA.texture;
    renderer.setRenderTarget(rtB);
    renderer.render(blitScene, blitCamera);
    renderer.setRenderTarget(null);
    blitMaterial.map = rtB.texture;
    renderer.render(blitScene, blitCamera);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(focusScene, camera);
    renderer.autoClear = true;
  }

  function activate(options = {}) {
    active = true;
    resize();
    controls.resetPose();
    controls.attach();
    controls.update(0.016);
    if (options.from && !reducedMotion) {
      arrival = {
        t: 0,
        position: options.from.position.clone(),
        quaternion: options.from.quaternion.clone(),
        fov: options.from.fov ?? 34,
      };
      camera.position.copy(arrival.position);
      camera.quaternion.copy(arrival.quaternion);
      camera.fov = arrival.fov;
      camera.updateProjectionMatrix();
    } else {
      arrival = null;
      camera.fov = 45;
      camera.updateProjectionMatrix();
    }
    audio.startWind();
    audio.startHum();
    renderer.shadowMap.needsUpdate = true;
  }
  function deactivate() {
    active = false;
    arrival = null;
    camera.fov = 45;
    camera.updateProjectionMatrix();
    settleCanNow();
    controls.detach();
    setHoveredButton(null);
    canvas.classList.remove("is-handle-hover");
    audio.stopWind();
    audio.stopHum();
  }
  function muteAmbience() {
    audio.setWind(0);
    audio.setHum(0);
  }
  function dispose() {
    deactivate();
    controls.dispose();
    machine.dispose();
    slime.dispose();
    rtA?.dispose();
    rtB?.dispose();
    blitQuad.geometry.dispose();
    blitMaterial.dispose();
    const geometries = new Set(),
      materials = new Set(),
      textures = new Set();
    for (const root of [scene, focusScene])
      root.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          if (!material) continue;
          materials.add(material);
          for (const value of Object.values(material))
            if (value?.isTexture) textures.add(value);
        }
      });
    // The shared PMREM environment belongs to the fridge scene; leave it alone.
    textures.delete(environment);
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
  }
  return {
    scene,
    camera,
    controls,
    machine,
    heightAt,
    gate,
    update,
    render,
    activate,
    deactivate,
    muteAmbience,
    dispose,
    focusCan,
    explodeCan,
    get canState() {
      return canState;
    },
    get exploded() {
      return exploded;
    },
  };
}
