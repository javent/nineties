import * as THREE from "three";
import { canvas2D, textureFrom, clamp, random } from "./utils.js";

/** Nickelodeon-grade slime: a pooled sprite burst, pooled ground splats, and a
 *  slow green takeover of the hill. Everything is preallocated — the explosion
 *  never allocates mid-frame, so it stays smooth on weak GPUs. */

const PARTICLES = 90;
const SPLATS = 44;

function blobTexture(seed, core = "#8bea3c", edge = "rgba(74,182,22,0)") {
  const [canvas, ctx] = canvas2D(128, 128);
  const rand = random(seed);
  for (let i = 0; i < 5; i++) {
    const x = 40 + rand() * 48,
      y = 40 + rand() * 48,
      radius = 22 + rand() * 30;
    const blob = ctx.createRadialGradient(x, y, 2, x, y, radius);
    blob.addColorStop(0, core);
    blob.addColorStop(0.6, "rgba(107,206,38,0.75)");
    blob.addColorStop(1, edge);
    ctx.fillStyle = blob;
    ctx.fillRect(0, 0, 128, 128);
  }
  return textureFrom(canvas);
}

function splatTexture(seed) {
  const [canvas, ctx] = canvas2D(256, 256);
  const rand = random(seed);
  ctx.translate(128, 128);
  for (const [radius, color] of [
    [104, "rgba(74,182,22,0.95)"],
    [78, "rgba(114,214,44,0.95)"],
  ]) {
    ctx.beginPath();
    const points = 22;
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const r = radius * (i % 2 ? 0.62 + rand() * 0.22 : 0.9 + rand() * 0.28);
      const x = Math.cos(angle) * r,
        y = Math.sin(angle) * r;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  // Satellite droplets.
  for (let i = 0; i < 9; i++) {
    const angle = rand() * Math.PI * 2,
      distance = 88 + rand() * 34;
    ctx.beginPath();
    ctx.arc(
      Math.cos(angle) * distance,
      Math.sin(angle) * distance,
      3 + rand() * 7,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = "rgba(94,198,32,0.9)";
    ctx.fill();
  }
  return textureFrom(canvas);
}

export function createSlime(scene, heightAt) {
  const rand = random(1997);
  const blobMaps = [blobTexture(31), blobTexture(67, "#a5f556")];
  const particles = [];
  for (let i = 0; i < PARTICLES; i++) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: blobMaps[i % blobMaps.length],
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    );
    sprite.visible = false;
    sprite.renderOrder = 4;
    scene.add(sprite);
    particles.push({
      sprite,
      velocity: new THREE.Vector3(),
      life: 0,
      maxLife: 1,
      size: 1,
    });
  }
  let particleCursor = 0;

  const splatMaps = [splatTexture(11), splatTexture(29), splatTexture(53)];
  const splats = [];
  for (let i = 0; i < SPLATS; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: splatMaps[i % splatMaps.length],
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    mesh.renderOrder = 2;
    scene.add(mesh);
    splats.push({ mesh, age: 0, active: false });
  }
  let splatCursor = 0;

  function emit(origin, count, speed, spread = 1) {
    for (let i = 0; i < count; i++) {
      const p = particles[particleCursor];
      particleCursor = (particleCursor + 1) % PARTICLES;
      p.sprite.visible = true;
      p.sprite.position.copy(origin);
      p.velocity
        .set(
          (rand() - 0.5) * 2 * spread,
          0.5 + rand() * 0.9,
          (rand() - 0.5) * 2 * spread,
        )
        .normalize()
        .multiplyScalar(speed * (0.5 + rand() * 0.8));
      p.life = 0;
      p.maxLife = 0.8 + rand() * 0.9;
      p.size = 0.5 + rand() * 1.1;
      p.sprite.material.opacity = 0.95;
      p.sprite.scale.setScalar(p.size * 0.5);
    }
  }
  function stamp(x, z, size) {
    const s = splats[splatCursor];
    splatCursor = (splatCursor + 1) % SPLATS;
    s.mesh.visible = true;
    s.active = true;
    s.age = 0;
    s.mesh.position.set(x, heightAt(x, z) + 0.03 + splatCursor * 0.0006, z);
    s.mesh.rotation.z = rand() * Math.PI * 2;
    s.mesh.scale.setScalar(size * (0.8 + rand() * 0.7));
    s.mesh.material.opacity = 0.96;
  }
  function burst(origin) {
    emit(origin, 46, 11, 1.4);
    stamp(origin.x, origin.z, 4.2);
  }
  function update(dt) {
    let alive = false;
    for (const p of particles) {
      if (!p.sprite.visible) continue;
      alive = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.sprite.visible = false;
        continue;
      }
      p.velocity.y -= 14 * dt;
      p.sprite.position.addScaledVector(p.velocity, dt);
      const k = p.life / p.maxLife;
      p.sprite.scale.setScalar(p.size * (0.5 + k * 1.3));
      p.sprite.material.opacity = 0.95 * (1 - k * k);
      const floor = heightAt(p.sprite.position.x, p.sprite.position.z);
      if (p.sprite.position.y <= floor + 0.1) {
        stamp(p.sprite.position.x, p.sprite.position.z, 0.6 + p.size * 0.5);
        p.sprite.visible = false;
      }
    }
    for (const s of splats) {
      if (!s.active) continue;
      s.age += dt;
      // Splats stay; they only relax their first flash of brightness.
      s.mesh.material.opacity = 0.96 - clamp(s.age * 0.2, 0, 0.24);
    }
    return alive;
  }
  function reset() {
    for (const p of particles) p.sprite.visible = false;
    for (const s of splats) {
      s.mesh.visible = false;
      s.active = false;
    }
  }
  function dispose() {
    for (const map of [...blobMaps, ...splatMaps]) map.dispose();
    for (const p of particles) {
      p.sprite.material.dispose();
      p.sprite.removeFromParent();
    }
    for (const s of splats) {
      s.mesh.geometry.dispose();
      s.mesh.material.dispose();
      s.mesh.removeFromParent();
    }
  }
  return { emit, stamp, burst, update, reset, dispose };
}
