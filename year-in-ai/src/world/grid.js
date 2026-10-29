import * as THREE from "three";
import { PALETTE, WORLD } from "../config.js";

const vert = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const frag = /* glsl */ `
  precision highp float;
  varying vec3 vWorld;

  uniform vec3  uCam;
  uniform vec3  uColor;
  uniform vec3  uTintColor;
  uniform float uTint;
  uniform float uCell;
  uniform float uLong;
  uniform float uLat;
  uniform float uOpacity;
  uniform float uFadeFar;
  uniform float uRipple;
  uniform float uRippleAge;
  uniform vec2  uRippleOrigin;
  uniform float uMinor;
  uniform float uHorizon;

  // crisp 1px-ish line with a density fade so distant lines don't turn to mush
  float lineMask(float coord, float cell, float w) {
    float c = coord / cell;
    float d = abs(fract(c - 0.5) - 0.5);
    float fw = fwidth(c);
    float m = 1.0 - smoothstep(0.0, fw * w, d);
    float density = clamp(1.0 - fw * 2.9, 0.0, 1.0);
    return m * density;
  }

  void main() {
    vec2 p = vWorld.xz;

    if (uRipple > 0.0008) {
      float d = distance(p, uRippleOrigin);
      vec2 dir = normalize(p - uRippleOrigin + vec2(1e-4));
      float ring = exp(-pow((d - uRippleAge * 150.0) / 110.0, 2.0));
      float wave = sin(d * 0.13 - uRippleAge * 7.0);
      p += dir * wave * uRipple * (1.8 + 6.6 * ring);
    }

    float gx = lineMask(p.x, uCell, 1.15) * uLong;
    float gz = lineMask(p.y, uCell, 1.15) * uLat;
    float g = max(gx, gz);

    if (uMinor > 0.002) {
      float mx = lineMask(p.x, uCell * 0.25, 1.0) * uLong;
      float mz = lineMask(p.y, uCell * 0.25, 1.0) * uLat;
      g = max(g, max(mx, mz) * uMinor);
    }

    float dist = distance(vWorld.xz, uCam.xz);
    float fade = 1.0 - smoothstep(uFadeFar * 0.38, uFadeFar, dist);

    // the bright band where the floor meets the sky
    float band = exp(-pow((dist - uFadeFar * 0.74) / 5.0, 2.0)) * uHorizon;

    vec3 col = mix(uColor, uTintColor, uTint);
    float a = max(g * fade, band) * uOpacity;
    if (a < 0.0025) discard;
    gl_FragColor = vec4(col, a);
  }
`;

export function createGrid() {
  const DEPTH = 1150;
  const WIDTH = 2400;
  const geo = new THREE.PlaneGeometry(WIDTH, DEPTH, 1, 1);
  geo.rotateX(-Math.PI / 2);

  const uniforms = {
    uCam: { value: new THREE.Vector3() },
    uColor: { value: new THREE.Color(PALETTE.paper) },
    uTintColor: { value: new THREE.Color(PALETTE.paper) },
    uTint: { value: 0 },
    uCell: { value: WORLD.cell },
    uLong: { value: 1 },
    uLat: { value: 1 },
    uOpacity: { value: 1 },
    uFadeFar: { value: 390 },
    uRipple: { value: 0 },
    uRippleAge: { value: 0 },
    uRippleOrigin: { value: new THREE.Vector2() },
    uMinor: { value: 0 },
    uHorizon: { value: 0.62 },
  };

  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;

  const state = {
    mesh,
    uniforms,
    ripple: { active: false, age: 0, strength: 0 },
    tintTarget: 0,
    tintColor: new THREE.Color(PALETTE.paper),
  };

  /** Fire the category-change shockwave. */
  state.pulse = (color, origin) => {
    state.ripple.active = true;
    state.ripple.age = 0;
    state.ripple.strength = 1;
    uniforms.uRippleOrigin.value.set(origin.x, origin.z);
    uniforms.uTintColor.value.set(color);
  };

  state.update = (dt, camera) => {
    // keep the slab of floor centred on the camera, snapped to the grid so
    // the lines never crawl
    const cell = uniforms.uCell.value;
    mesh.position.x = Math.round(camera.position.x / cell) * cell;
    mesh.position.z = Math.round(camera.position.z / cell) * cell - DEPTH * 0.28;
    uniforms.uCam.value.copy(camera.position);

    const r = state.ripple;
    if (r.active) {
      r.age += dt;
      r.strength = Math.max(0, 1 - r.age / 2.3);
      uniforms.uRipple.value = r.strength * r.strength;
      uniforms.uRippleAge.value = r.age;
      // tint rushes in then falls away
      const tint = Math.max(0, Math.sin(Math.min(1, r.age / 1.5) * Math.PI)) * 1.0;
      uniforms.uTint.value = tint;
      if (r.age > 2.4) {
        r.active = false;
        uniforms.uRipple.value = 0;
        uniforms.uTint.value = 0;
      }
    }
  };

  return state;
}
