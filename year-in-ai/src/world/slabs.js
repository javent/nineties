import * as THREE from "three";
import { PALETTE, WORLD } from "../config.js";
import { LABS } from "../data/labs.js";

// top, bottom, front, back and sides carry slightly different flat shades so
// the volumes read without any real lighting — same graphic look as the mocks.
const FACE_SHADE = {
  0: 0.84, // +x
  1: 0.84, // -x
  2: 1.0, // +y  top
  3: 0.52, // -y
  4: 0.93, // +z  facing the camera
  5: 0.8, // -z
};

function shadedBox(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  geo.groups.forEach((g, i) => {
    const s = FACE_SHADE[i] ?? 1;
    for (let v = g.start; v < g.start + g.count; v++) {
      const idx = geo.index.getX(v);
      colors[idx * 3] = s;
      colors[idx * 3 + 1] = s;
      colors[idx * 3 + 2] = s;
    }
  });
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.clearGroups();
  return geo;
}

export function createSlabs(scene) {
  const { w, h, d } = WORLD.slab;
  const geo = shadedBox(w, h, d);
  const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));

  const items = LABS.map((lab) => {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(PALETTE.paper),
      vertexColors: true,
      transparent: true,
      opacity: 1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const edgeMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(PALETTE.paper).multiplyScalar(0.22),
      transparent: true,
      opacity: 1,
    });
    const edges = new THREE.LineSegments(edgeGeo, edgeMat);
    group.add(mesh, edges);
    group.position.y = h / 2;
    group.visible = false;
    scene.add(group);
    return { id: lab.id, group, mesh, mat, edges, edgeMat, opacity: 0, color: new THREE.Color(PALETTE.paper) };
  });

  const byId = Object.fromEntries(items.map((i) => [i.id, i]));

  function setColor(id, hex) {
    const it = byId[id];
    if (!it) return;
    it.color.set(hex);
    it.mat.color.copy(it.color);
    it.edgeMat.color.copy(it.color).multiplyScalar(0.24);
  }

  function setOpacity(id, o) {
    const it = byId[id];
    if (!it) return;
    it.opacity = o;
    it.mat.opacity = o;
    it.edgeMat.opacity = o * 0.95;
    it.group.visible = o > 0.01;
  }

  return { items, byId, setColor, setOpacity };
}

/** The ribbon the followed lab leaves behind it. */
export function createTrail(scene) {
  const MAX = 64;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(MAX * 3);
  const col = new Float32Array(MAX * 3);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const line = new THREE.Line(geo, mat);
  line.frustumCulled = false;
  scene.add(line);

  const tmp = new THREE.Color();

  function update(points, hex, y) {
    const n = Math.min(points.length, MAX);
    tmp.set(hex);
    for (let i = 0; i < n; i++) {
      const p = points[i];
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = p.z;
      // brighter the closer it gets to the slab at the head of the trail
      const f = 0.12 + 0.88 * Math.pow(i / (n - 1), 1.7);
      col[i * 3] = tmp.r * f;
      col[i * 3 + 1] = tmp.g * f;
      col[i * 3 + 2] = tmp.b * f;
    }
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  return { line, mat, update };
}
