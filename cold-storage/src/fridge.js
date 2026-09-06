import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { canvas2D, textureFrom, clamp } from "./utils.js";

export const FINISHES = {
  cream: { name: "Buttermilk", color: "#f0e7cd" },
  mint: { name: "Sea glass", color: "#a4c8b9" },
  hunter: { name: "Hunter green", color: "#183b29", smooth: true },
};

// Older saved layouts keep their selected third finish after the palette update.
export const resolveFinish = (id) => (id === "gold" ? "hunter" : id);

export function createFridge(maps) {
  const group = new THREE.Group();
  group.name = "1986 garage refrigerator";
  const enamel = new THREE.MeshPhysicalMaterial({
    color: FINISHES.cream.color,
    map: maps.map,
    roughnessMap: maps.roughnessMap,
    normalMap: maps.normalMap,
    normalScale: new THREE.Vector2(0.028, 0.028),
    metalness: 0.67,
    roughness: 0.67,
    clearcoat: 0.48,
    clearcoatRoughness: 0.24,
    envMapIntensity: 1.0,
  });
  const chrome = new THREE.MeshPhysicalMaterial({
    color: "#eeeeeb",
    metalness: 1,
    roughness: 0.145,
    clearcoat: 0.25,
    envMapIntensity: 1.45,
  });
  // The handle has its own chrome material so it can react to the pointer without
  // tinting the other hardware. The emissive channel is driven by the interaction
  // layer below and gives the door a clear, tactile affordance.
  const handleChrome = chrome.clone();
  handleChrome.emissive = new THREE.Color("#ff55d9");
  handleChrome.emissiveIntensity = 0;
  const dullChrome = new THREE.MeshStandardMaterial({
    color: "#969a8c",
    metalness: 0.9,
    roughness: 0.38,
  });
  const rubber = new THREE.MeshStandardMaterial({
    color: "#4a4b3c",
    roughness: 0.94,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: "#25271f",
    roughness: 0.65,
    metalness: 0.4,
  });
  const meshes = [];
  const rounded = (
    w,
    h,
    d,
    radius,
    material,
    x,
    y,
    z,
    segments = 4,
    parent = group,
  ) => {
    const mesh = new THREE.Mesh(
      new RoundedBoxGeometry(w, h, d, segments, radius),
      material,
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  // A deep cabinet, separate rubber gasket and a generously radiused enamel door.
  const cabinet = rounded(3.05, 5.58, 2.22, 0.235, enamel, 0, 0, -0.1, 8);
  cabinet.name = "enamel cabinet";
  meshes.push(cabinet);
  rounded(2.97, 5.28, 0.095, 0.045, rubber, 0, 0.13, 1.018, 5);
  rounded(2.99, 5.27, 0.065, 0.031, dullChrome, 0, 0.13, 1.049, 5);
  const door = rounded(2.995, 5.24, 0.38, 0.188, enamel, 0, 0.14, 1.14, 10);
  door.name = "single enamel door";
  meshes.push(door);
  // Chrome hinges peek past the right-hand door seam.
  rounded(0.1, 0.29, 0.2, 0.045, dullChrome, 1.485, 1.94, 0.99);
  rounded(0.1, 0.29, 0.2, 0.045, dullChrome, 1.485, -1.95, 0.99);
  // Curved chrome handle, with real volume, standoffs and small reflections on its caps.
  // Keep the complete handle in a named group so raycasting and the open-door
  // affordance can address it as one physical control.
  const handleGroup = new THREE.Group();
  handleGroup.name = "interactive fridge handle";
  group.add(handleGroup);
  const handleMeshes = [];
  const addHandle = (mesh) => {
    mesh.userData.handle = true;
    handleMeshes.push(mesh);
    return mesh;
  };
  for (const y of [0.17, 1.31]) {
    addHandle(
      rounded(
        0.19,
        0.235,
        0.06,
        0.029,
        rubber,
        -1.065,
        y,
        1.358,
        4,
        handleGroup,
      ),
    );
    addHandle(
      rounded(
        0.175,
        0.21,
        0.085,
        0.038,
        handleChrome,
        -1.065,
        y,
        1.39,
        4,
        handleGroup,
      ),
    );
    const pin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.055, 0.14, 18),
      handleChrome,
    );
    pin.rotation.x = Math.PI / 2;
    pin.position.set(-1.065, y, 1.48);
    pin.castShadow = true;
    handleGroup.add(addHandle(pin));
  }
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.065, 1.34, 1.47),
    new THREE.Vector3(-1.069, 1.26, 1.59),
    new THREE.Vector3(-1.08, 0.99, 1.65),
    new THREE.Vector3(-1.082, 0.49, 1.64),
    new THREE.Vector3(-1.07, 0.21, 1.57),
    new THREE.Vector3(-1.065, 0.13, 1.46),
  ]);
  const handle = new THREE.Mesh(
    new THREE.TubeGeometry(handleCurve, 48, 0.072, 16, false),
    handleChrome,
  );
  handle.castShadow = true;
  handle.receiveShadow = true;
  handle.name = "polished chrome handle";
  handleGroup.add(addHandle(handle));
  for (const point of [handleCurve.getPoint(0), handleCurve.getPoint(1)]) {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.071, 16, 12),
      handleChrome,
    );
    cap.position.copy(point);
    handleGroup.add(addHandle(cap));
  }
  const handleGlow = new THREE.Mesh(
    new THREE.TubeGeometry(handleCurve, 48, 0.108, 12, false),
    new THREE.MeshBasicMaterial({
      color: "#ff55d9",
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  handleGlow.name = "handle hover glow";
  handleGlow.renderOrder = 4;
  handleGroup.add(handleGlow);
  const handleLight = new THREE.PointLight("#ff55d9", 0, 3.4, 2);
  handleLight.position.set(-1.08, 0.75, 1.63);
  handleGroup.add(handleLight);
  let handleHovered = false;
  function setHandleHovered(value) {
    handleHovered = !!value;
    handleChrome.color.set(handleHovered ? "#fff2ff" : "#eeeeeb");
    handleChrome.emissiveIntensity = handleHovered ? 0.72 : 0;
    handleGlow.material.opacity = handleHovered ? 0.34 : 0;
    handleLight.intensity = handleHovered ? 2.5 : 0;
  }
  // The lower toe-kick is not a second door. Narrow ventilation slots + polished trim.
  rounded(2.81, 0.23, 0.085, 0.04, dullChrome, 0, -2.65, 1.003);
  for (let i = 0; i < 4; i++)
    rounded(2.49, 0.023, 0.024, 0.01, dark, 0, -2.723 + i * 0.046, 1.055, 3);
  for (const x of [-1.1, 1.1])
    for (const z of [-0.82, 0.65]) {
      const foot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.105, 0.13, 0.2, 24),
        dark,
      );
      foot.position.set(x, -2.86, z);
      foot.castShadow = true;
      group.add(foot);
    }
  // Compact manufacturer lockup. Trim transparent font margins before spacing,
  // so the actual star and lettering (not their empty texture boxes) are centered.
  const badgeGroup = new THREE.Group();
  badgeGroup.name = "Centered Evercool manufacturer badge";
  badgeGroup.position.set(0, 2.38, 1.337);
  group.add(badgeGroup);
  const [badge, b] = canvas2D(1024, 256);
  b.textAlign = "center";
  b.textBaseline = "middle";
  b.font = 'italic 171px "Instrument Serif"';
  b.fillStyle = "#474d3d";
  b.fillText("Evercool", 514, 115);
  b.fillStyle = "#eef0d9";
  b.fillText("Evercool", 510, 110);
  const pixels = b.getImageData(0, 0, badge.width, badge.height);
  let x0 = badge.width,
    y0 = badge.height,
    x1 = 0,
    y1 = 0;
  for (let y = 0; y < badge.height; y++)
    for (let x = 0; x < badge.width; x++) {
      if (pixels.data[(y * badge.width + x) * 4 + 3] > 4) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
  const [tight, tc] = canvas2D(x1 - x0 + 9, y1 - y0 + 9);
  tc.drawImage(
    badge,
    x0,
    y0,
    x1 - x0 + 1,
    y1 - y0 + 1,
    4,
    4,
    x1 - x0 + 1,
    y1 - y0 + 1,
  );
  const wordWidth = 0.82,
    wordHeight = (wordWidth * tight.height) / tight.width;
  const badgeMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(wordWidth, wordHeight),
    new THREE.MeshPhysicalMaterial({
      map: textureFrom(tight),
      transparent: true,
      metalness: 0.82,
      roughness: 0.3,
      depthWrite: false,
    }),
  );
  badgeMesh.name = "Evercool script";
  badgeMesh.position.set(0, 0, 0.002);
  badgeGroup.add(badgeMesh);
  const [sub, s] = canvas2D(1024, 100);
  s.fillStyle = "#6c7057";
  s.font = '27px "IBM Plex Mono"';
  s.textAlign = "center";
  s.textBaseline = "middle";
  s.fillText("AUTOMATIC  •  DELUXE", 512, 50);
  const subMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.79, 0.077),
    new THREE.MeshBasicMaterial({
      map: textureFrom(sub),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  subMesh.name = "Manufacturer microtype";
  subMesh.position.set(0, -0.18, 0.003);
  badgeGroup.add(subMesh);
  // A four-point chrome star next to the script nameplate.
  const starShape = new THREE.Shape();
  const points = [
    [0, 0.13],
    [0.023, 0.029],
    [0.087, 0],
    [0.023, -0.025],
    [0, -0.08],
    [-0.022, -0.025],
    [-0.073, 0],
    [-0.022, 0.029],
  ];
  points.forEach((p, i) =>
    i ? starShape.lineTo(...p) : starShape.moveTo(...p),
  );
  starShape.closePath();
  const star = new THREE.Mesh(
    new THREE.ExtrudeGeometry(starShape, {
      depth: 0.012,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.004,
      bevelSegments: 2,
      steps: 1,
    }),
    chrome,
  );
  star.name = "Evercool chrome star";
  star.geometry.computeBoundingBox();
  const starBounds = star.geometry.boundingBox,
    starWidth = starBounds.max.x - starBounds.min.x;
  const starCenter = starBounds.getCenter(new THREE.Vector3()),
    gap = 0.055,
    total = starWidth + gap + wordWidth;
  star.position.set(
    -total / 2 + starWidth / 2 - starCenter.x,
    -starCenter.y,
    -0.002,
  );
  badgeMesh.position.x = -total / 2 + starWidth + gap + wordWidth / 2;
  badgeGroup.add(star);
  badgeGroup.userData = {
    gap,
    totalWidth: total,
    wordWidth,
    topClearance:
      2.76 - (2.38 + Math.max(wordHeight / 2, starBounds.max.y - starCenter.y)),
  };

  // A little honesty around the back: condenser tubing and a faded service label.
  rounded(2.36, 4.39, 0.04, 0.019, dark, 0, -0.05, -1.22);
  const coilMaterial = new THREE.MeshStandardMaterial({
    color: "#34372c",
    metalness: 0.72,
    roughness: 0.55,
  });
  for (let row = 0; row < 16; row++) {
    const y = -2 + row * 0.26;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.1, y, -1.29),
      new THREE.Vector3(-1.19, y + 0.06, -1.29),
      new THREE.Vector3(-1.1, y + 0.12, -1.29),
      new THREE.Vector3(1.08, y + 0.12, -1.29),
      new THREE.Vector3(1.16, y + 0.18, -1.29),
      new THREE.Vector3(1.08, y + 0.245, -1.29),
    ]);
    const coil = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 40, 0.023, 6, false),
      coilMaterial,
    );
    group.add(coil);
  }
  const [label, l] = canvas2D(384, 256);
  l.fillStyle = "#b2b49d";
  l.fillRect(0, 0, 384, 256);
  l.fillStyle = "#3f4736";
  l.font = 'bold 34px "DM Sans"';
  l.fillText("EVERCOOL", 28, 52);
  l.font = '16px "IBM Plex Mono"';
  [
    "MODEL E-86  /  SERIAL 001986",
    "110–120 V  •  60 HZ",
    "INSPECTED: AUG. 1986",
    "KEEP THE GOOD TIMES COLD.",
  ].forEach((t, i) => l.fillText(t, 28, 98 + i * 34));
  const labelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 0.53),
    new THREE.MeshStandardMaterial({
      map: textureFrom(label),
      roughness: 0.89,
    }),
  );
  labelMesh.rotation.y = Math.PI;
  labelMesh.position.set(0.56, 2.39, -1.219);
  group.add(labelMesh);

  // Flat enamel regions bounded away from the cabinet's rounded seams. A drop near
  // a corner is clamped onto supported enamel instead of leaving a floating decal.
  const surface = (id, origin, u, v, normal, width, height) => ({
    id,
    origin: new THREE.Vector3(...origin),
    u: new THREE.Vector3(...u),
    v: new THREE.Vector3(...v),
    normal: new THREE.Vector3(...normal),
    width,
    height,
    quaternion: new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(
        new THREE.Vector3(...u),
        new THREE.Vector3(...v),
        new THREE.Vector3(...normal),
      ),
    ),
  });
  const surfaces = {
    front: surface(
      "front",
      [0, 0.14, 1.334],
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      2.61,
      4.86,
    ),
    right: surface(
      "right",
      [1.529, 0, -0.1],
      [0, 0, -1],
      [0, 1, 0],
      [1, 0, 0],
      1.74,
      5.1,
    ),
    left: surface(
      "left",
      [-1.529, 0, -0.1],
      [0, 0, 1],
      [0, 1, 0],
      [-1, 0, 0],
      1.74,
      5.1,
    ),
    back: surface(
      "back",
      [0, 0, -1.217],
      [-1, 0, 0],
      [0, 1, 0],
      [0, 0, -1],
      2.58,
      5.08,
    ),
    top: surface(
      "top",
      [0, 2.794, -0.1],
      [1, 0, 0],
      [0, 0, -1],
      [0, 1, 0],
      2.58,
      1.75,
    ),
  };
  function fromIntersection(hit) {
    const n = (hit.normal || hit.face.normal)
      .clone()
      .transformDirection(hit.object.matrixWorld);
    const abs = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)];
    let id =
      abs[1] > Math.max(abs[0], abs[2])
        ? n.y > 0
          ? "top"
          : null
        : abs[0] > abs[2]
          ? n.x > 0
            ? "right"
            : "left"
          : n.z > 0
            ? "front"
            : "back";
    if (!id) return null;
    const s = surfaces[id],
      delta = hit.point.clone().sub(s.origin);
    return { surface: id, u: delta.dot(s.u), v: delta.dot(s.v) };
  }
  function fitPlacement(placement, width, height, rotation = 0) {
    const s = surfaces[placement.surface] || surfaces.front;
    const halfW =
      (Math.abs(Math.cos(rotation)) * width +
        Math.abs(Math.sin(rotation)) * height) /
      2;
    const halfH =
      (Math.abs(Math.sin(rotation)) * width +
        Math.abs(Math.cos(rotation)) * height) /
      2;
    const boundU = Math.max(0, s.width / 2 - halfW),
      boundV = Math.max(0, s.height / 2 - halfH);
    let u = clamp(placement.u, -boundU, boundU),
      v = clamp(placement.v, -boundV, boundV);
    // Avoid sliding the paper underneath the raised handle's mounting hardware.
    if (
      s.id === "front" &&
      u - halfW < -0.94 &&
      u + halfW > -1.2 &&
      v + halfH > -0.12 &&
      v - halfH < 1.31
    )
      u = Math.min(boundU, -0.89 + halfW);
    return { surface: s.id, u, v };
  }
  function point(placement, normalOffset = 0) {
    const s = surfaces[placement.surface] || surfaces.front;
    return s.origin
      .clone()
      .addScaledVector(s.u, placement.u)
      .addScaledVector(s.v, placement.v)
      .addScaledVector(s.normal, normalOffset);
  }
  let currentFinish = "cream";
  function setFinish(id) {
    id = resolveFinish(id);
    const finish = FINISHES[id];
    if (!finish) return;
    currentFinish = id;
    enamel.color.set(finish.color);
    // Hunter Green is a clean, smooth enamel treatment, not simply a green tint
    // over the aged color/scuff map. Other finishes restore their original maps.
    // A satin paint topcoat suppresses broad silvery grazing-angle reflections,
    // keeping the cabinet dark green as well as the door.
    const smooth = !!finish.smooth;
    const nextMap = smooth ? null : maps.map;
    const nextRoughnessMap = smooth ? null : maps.roughnessMap;
    const mapChanged =
      enamel.map !== nextMap || enamel.roughnessMap !== nextRoughnessMap;
    enamel.map = nextMap;
    enamel.roughnessMap = nextRoughnessMap;
    enamel.normalScale.setScalar(smooth ? 0.004 : 0.028);
    enamel.metalness = smooth ? 0.1 : 0.67;
    enamel.specularIntensity = smooth ? 0.22 : 1.0;
    enamel.roughness = smooth ? 0.42 : 0.67;
    enamel.clearcoat = smooth ? 0.06 : 0.48;
    enamel.clearcoatRoughness = smooth ? 0.28 : 0.24;
    if (mapChanged) enamel.needsUpdate = true;
  }
  return {
    group,
    badge: badgeGroup,
    surfaces,
    meshes,
    enamel,
    // Retain ownership of maps while a smooth finish temporarily stops using them.
    textureResources: Object.values(maps).filter((value) => value?.isTexture),
    fromIntersection,
    fitPlacement,
    point,
    setFinish,
    handleGroup,
    handleMeshes,
    setHandleHovered,
    get handleHovered() {
      return handleHovered;
    },
    get finish() {
      return currentFinish;
    },
  };
}
