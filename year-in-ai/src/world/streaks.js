import * as THREE from "three";

/**
 * Thin white slivers lying along the travel axis. They read as radial speed
 * lines out of the vanishing point exactly like the mocks.
 */
export function createStreaks(scene, count = 78) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 2 * 3);
  const col = new Float32Array(count * 2 * 3);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));

  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  scene.add(lines);

  const SPAN = 470;
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push({
      x: (Math.random() - 0.5) * 320,
      y: Math.random() < 0.88 ? 7 + Math.pow(Math.random(), 1.25) * 108 : -4 - Math.random() * 16,
      z: -Math.random() * SPAN,
      len: 5 + Math.random() * 19,
    });
  }

  const state = { group: lines, mat, strength: 0 };

  state.update = (camZ) => {
    const s = state.strength;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      let z = it.z;
      // recycle in front of the camera
      const rel = z - camZ;
      if (rel > 24) {
        it.z = camZ - SPAN - Math.random() * 60;
        it.x = (Math.random() - 0.5) * 320;
        it.y = Math.random() < 0.88 ? 7 + Math.pow(Math.random(), 1.25) * 108 : -4 - Math.random() * 16;
        it.len = 5 + Math.random() * 19;
        z = it.z;
      }
      const o = i * 6;
      pos[o] = it.x;
      pos[o + 1] = it.y;
      pos[o + 2] = z;
      pos[o + 3] = it.x;
      pos[o + 4] = it.y;
      pos[o + 5] = z + it.len;

      const dist = Math.abs(z - camZ);
      const fade = Math.min(1, dist / 70) * (1 - Math.min(1, Math.max(0, (dist - 200) / 260)));
      const v = fade * s;
      col[o] = col[o + 1] = col[o + 2] = v * 0.35;
      col[o + 3] = col[o + 4] = col[o + 5] = v;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    lines.visible = s > 0.01;
  };

  return state;
}
