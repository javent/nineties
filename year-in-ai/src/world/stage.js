import * as THREE from "three";
import { PALETTE, WORLD } from "../config.js";
import { createGrid } from "./grid.js";
import { createSlabs, createTrail } from "./slabs.js";
import { createStreaks } from "./streaks.js";

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(new THREE.Color(PALETTE.bg), 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(56, 1, 0.1, 1600);

  const grid = createGrid();
  scene.add(grid.mesh);
  const slabs = createSlabs(scene);
  const trail = createTrail(scene);
  const streaks = createStreaks(scene);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the horizon from drifting too far on short, wide windows
    camera.fov = w / h < 1.1 ? 68 : 56;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  const _v = new THREE.Vector3();
  /** world point → {x, y, visible} in CSS pixels */
  function project(x, y, z) {
    _v.set(x, y, z).project(camera);
    return {
      x: (_v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-_v.y * 0.5 + 0.5) * window.innerHeight,
      z: _v.z,
      visible: _v.z > -1 && _v.z < 1,
    };
  }

  /**
   * @param travel  how far down the corridor we are
   * @param lift    0 = driving along the floor, 1 = the overhead DATA view
   * @param rise    0 = eye on the deck (intro), 1 = normal cruising height
   */
  function placeCamera(travel, lift, rise) {
    const baseY = 0.55 + (WORLD.cameraHeight - 0.55) * rise;
    const y = baseY + (52 - baseY) * lift;
    const z = -travel + lift * 18;
    camera.position.set(0, y, z);

    const pitchDeg = 8.6 + (33 - 8.6) * lift;
    const ahead = 40;
    const drop = Math.tan((pitchDeg * Math.PI) / 180) * ahead;
    camera.lookAt(0, y - drop, z - ahead);
  }

  function render() {
    renderer.render(scene, camera);
  }

  return { renderer, scene, camera, grid, slabs, trail, streaks, project, placeCamera, render, resize };
}
