import * as THREE from "three";
import { CATALOG, makeStickerArt, makeStickerTextures } from "./sticker-art.js";
import { canvas2D, clamp, textureFrom, loadImage } from "./utils.js";

const Z_AXIS = new THREE.Vector3(0, 0, 1);
// Reused inside update() so the per-frame loop over placed stickers does not
// allocate a Vector3 per sticker per frame. Only ever used synchronously.
const SCRATCH_POSITION = new THREE.Vector3();
// Retain the original allowance of 16 uploads as the built-in collection grows.
export const MAX_CUSTOM_STICKERS = 16;
export const MAX_STICKERS = CATALOG.length + MAX_CUSTOM_STICKERS;
export class Sticker {
  constructor(meta, art, fridge, index) {
    this.meta = meta;
    this.id = meta.id;
    this.art = art;
    this.fridge = fridge;
    this.width = meta.width;
    this.height = meta.height;
    this.angle = THREE.MathUtils.degToRad(meta.angle || 0);
    this.index = index;
    this.placed = meta.placed !== false;
    this.placement = {
      surface: meta.surface || "front",
      u: meta.u || 0,
      v: meta.v || 0,
    };
    this.peel = 0;
    this.peelVelocity = 0;
    this.lift = 0;
    this.hovered = false;
    this.dragging = false;
    this.selected = false;
    this.demo = false;
    this.curlDirection = new THREE.Vector2(0.94, 0.34).normalize();
    this.lastDeformation = -1;
    this.settle = 0;
    this.group = new THREE.Group();
    this.group.name = `Sticker · ${meta.name}`;
    this.geometry = new THREE.PlaneGeometry(this.width, this.height, 36, 28);
    this.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
    this.base = new Float32Array(this.geometry.attributes.position.array);
    const print = textureFrom(art.front),
      back = textureFrom(art.back),
      contact = textureFrom(art.shadow);
    this.textures = [print, back, contact];
    this.frontMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0.58, 0.58, 0.58),
      map: print,
      alphaTest: 0.28,
      side: THREE.FrontSide,
      roughness: 0.75,
      metalness: 0,
      clearcoat: 0.045,
      clearcoatRoughness: 0.65,
      envMapIntensity: 0.65,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    this.backMaterial = new THREE.MeshPhysicalMaterial({
      map: back,
      bumpMap: back,
      bumpScale: 0.0027,
      alphaTest: 0.28,
      side: THREE.BackSide,
      metalness: 0.96,
      roughness: 0.265,
      clearcoat: 0.4,
      clearcoatRoughness: 0.19,
      envMapIntensity: 1.65,
    });
    this.front = new THREE.Mesh(this.geometry, this.frontMaterial);
    this.back = new THREE.Mesh(this.geometry, this.backMaterial);
    this.front.castShadow = true;
    this.back.castShadow = false;
    this.frontMaterial.shadowSide = THREE.DoubleSide;
    this.front.receiveShadow = this.back.receiveShadow = true;
    this.front.userData.sticker = this.back.userData.sticker = this;
    this.group.add(this.front, this.back);
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(this.width * 1.055, this.height * 1.055),
      new THREE.MeshBasicMaterial({
        map: contact,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    );
    this.shadow.name = `Contact occlusion · ${meta.name}`;
    this.targetPosition = new THREE.Vector3();
    this.targetQuaternion = new THREE.Quaternion();
    this.normal = new THREE.Vector3(0, 0, 1);
    this.setPlacement(this.placement, true);
    this.deform(0);
    this.setPlaced(this.placed);
    // Curled vertices can extend outside the flat sheet's original bounds.
    this.geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(),
      Math.hypot(this.width, this.height) * 1.15,
    );
  }
  get offset() {
    return 0.009 + this.index * 0.0011;
  }
  setPlaced(value) {
    this.placed = !!value;
    this.group.visible = this.placed || this.dragging;
    this.shadow.visible = this.placed && !this.isOffSurface;
  }
  setPlacement(placement, immediate = false) {
    this.placement = this.fridge.fitPlacement(
      placement,
      this.width,
      this.height,
      this.angle,
    );
    this.setTarget(this.placement);
    if (immediate) {
      this.group.position.copy(this.targetPosition);
      this.group.quaternion.copy(this.targetQuaternion);
    }
  }
  setTarget(placement, freePosition = null) {
    const surface = this.fridge.surfaces[placement.surface];
    this.normal.copy(surface.normal);
    this.targetPosition.copy(
      freePosition || this.fridge.point(placement, this.offset),
    );
    this.targetQuaternion
      .copy(surface.quaternion)
      .multiply(new THREE.Quaternion().setFromAxisAngle(Z_AXIS, this.angle));
    this.shadow.position.copy(
      this.fridge.point(placement, 0.003 + this.index * 0.00015),
    );
    this.shadow.quaternion.copy(this.targetQuaternion);
  }
  chooseCurl(uv) {
    this.curlDirection.set(
      (uv.x - 0.5) * this.width,
      (uv.y - 0.5) * this.height,
    );
    if (this.curlDirection.length() < 0.1) this.curlDirection.set(0.94, 0.34);
    this.curlDirection.normalize();
  }
  /**
   * CYLINDRICAL PEEL (CPU-deformed segmented plane; real front and back materials).
   * q is the vertex's distance along the peel direction. The hinge advances as p
   * increases. Beyond it, arc length is conserved: q' = hinge + R sin(theta),
   * z' = R(1-cos(theta)). Once theta > PI/2 the silver BackSide faces the viewer.
   * Positions AND normals change, so PBR highlights and cast shadows bend too.
   * Unlike baked DecalGeometry, the same mesh remains deformable after placement.
   */
  deform(p) {
    if (Math.abs(p - this.lastDeformation) < 0.00008) return;
    this.lastDeformation = p;
    this.shadowChanged = true;
    const position = this.geometry.attributes.position,
      data = position.array;
    const dx = this.curlDirection.x,
      dy = this.curlDirection.y;
    const span = (Math.abs(dx) * this.width + Math.abs(dy) * this.height) * 0.5;
    const hinge = span - span * 1.49 * Math.max(0, p),
      radius = span * 0.555;
    for (let i = 0; i < data.length; i += 3) {
      const x = this.base[i],
        y = this.base[i + 1],
        q = x * dx + y * dy,
        dist = Math.max(0, q - hinge);
      let px = x,
        py = y,
        z = 0;
      if (dist > 0) {
        const theta = dist / radius,
          shift = hinge + Math.sin(theta) * radius - q;
        px += shift * dx;
        py += shift * dy;
        z = radius * (1 - Math.cos(theta));
      }
      // Barely curled die-cut paper at rest, rather than perfectly sterile planes.
      z +=
        0.004 *
        Math.pow(x / this.width + 0.5, 6) *
        Math.pow(y / this.height + 0.5, 3);
      z += Math.sin((x / this.width + y / this.height) * 5) * 0.003 * p;
      data[i] = px;
      data[i + 1] = py;
      data[i + 2] = z;
    }
    position.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }
  update(dt, reducedMotion = false) {
    this.shadowChanged = false;
    const target =
      this.dragging || this.demo ? 1 : this.hovered || this.selected ? 0.13 : 0;
    if (reducedMotion) {
      this.peel = target * 0.8;
      this.peelVelocity = 0;
    } else {
      this.peelVelocity += (target - this.peel) * 180 * dt;
      this.peelVelocity *= Math.exp(-19 * dt);
      this.peel += this.peelVelocity * dt;
      this.peel = clamp(this.peel, -0.008, 1.04);
    }
    this.deform(this.peel);
    const desiredLift = this.dragging ? 0.19 : this.demo ? 0.23 : 0;
    this.lift = THREE.MathUtils.damp(this.lift, desiredLift, 16, dt);
    if (this.settle > 0) this.settle = Math.max(0, this.settle - dt);
    const bounce =
      this.settle > 0
        ? Math.sin((0.33 - this.settle) * 28) * 0.027 * (this.settle / 0.33)
        : 0;
    const targetPosition = SCRATCH_POSITION.copy(
      this.targetPosition,
    ).addScaledVector(this.normal, this.lift + Math.max(0, bounce));
    const ease = 1 - Math.exp(-dt * (this.dragging ? 26 : 20));
    this.shadowChanged ||=
      this.group.position.distanceToSquared(targetPosition) > 1e-8 ||
      this.group.quaternion.angleTo(this.targetQuaternion) > 0.0001;
    this.group.position.lerp(targetPosition, ease);
    this.group.quaternion.slerp(this.targetQuaternion, ease);
    this.shadow.material.opacity = 0.31 - this.peel * 0.15;
    const scale = 1 + this.lift * 0.55;
    this.shadow.scale.setScalar(scale);
    this.group.visible = this.placed || this.dragging || this.demo;
    this.shadow.visible = (this.placed || this.dragging) && !this.isOffSurface;
  }
  hitIsOpaque(uv) {
    if (!uv) return false;
    const x = clamp(
        Math.floor(uv.x * this.art.alphaWidth),
        0,
        this.art.alphaWidth - 1,
      ),
      y = clamp(
        Math.floor((1 - uv.y) * this.art.alphaHeight),
        0,
        this.art.alphaHeight - 1,
      );
    return this.art.alpha[y * this.art.alphaWidth + x] > 80;
  }
  dispose() {
    this.geometry.dispose();
    this.frontMaterial.dispose();
    this.backMaterial.dispose();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
    this.textures.forEach((t) => t.dispose());
    this.group.removeFromParent();
    this.shadow.removeFromParent();
  }
}

export class StickerManager {
  constructor(fridge, scene) {
    this.fridge = fridge;
    this.scene = scene;
    this.items = [];
    this.onChange = () => {};
  }
  async loadCatalog(onProgress = () => {}) {
    let loaded = 0;
    const artwork = await Promise.all(
      CATALOG.map(async (meta) => {
        const art = await makeStickerArt(meta);
        onProgress(++loaded / CATALOG.length);
        return art;
      }),
    );
    CATALOG.forEach((meta, index) => this.add(meta, artwork[index]));
  }
  get pickMeshes() {
    return this.items
      .filter((s) => s.placed && s.group.visible)
      .flatMap((s) => [s.front, s.back]);
  }
  add(meta, art) {
    const sticker = new Sticker(meta, art, this.fridge, this.items.length);
    this.scene.add(sticker.shadow, sticker.group);
    this.items.push(sticker);
    return sticker;
  }
  find(id) {
    return this.items.find((s) => s.id === id);
  }
  bringToFront(sticker) {
    this.items = this.items.filter((s) => s !== sticker);
    this.items.push(sticker);
    this.items.forEach((s, i) => {
      s.index = i;
      if (!s.dragging) s.setTarget(s.placement);
    });
  }
  update(dt, reduced) {
    let shadowChanged = false;
    this.items.forEach((s) => {
      if (!s.placed && !s.dragging && !s.demo) return;
      s.update(dt, reduced);
      shadowChanged ||= s.shadowChanged;
    });
    return shadowChanged;
  }
  async addCustom(image, name = "Your sticker", options = {}) {
    if (this.items.filter((s) => s.meta.custom).length >= MAX_CUSTOM_STICKERS)
      throw new Error(
        `You can add ${MAX_CUSTOM_STICKERS} custom stickers alongside the collection. Start fresh to make more space.`,
      );
    const aspect = image.width / image.height;
    if (!Number.isFinite(aspect) || aspect <= 0)
      throw new Error("This image could not be read.");
    const cw = Math.round(aspect >= 1 ? 640 : 640 * aspect),
      ch = Math.round(aspect >= 1 ? 640 / aspect : 640);
    const [canvas, ctx] = canvas2D(Math.max(1, cw), Math.max(1, ch));
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const width = aspect >= 1 ? 1.06 : Math.max(0.24, 1.06 * aspect),
      height = aspect >= 1 ? Math.max(0.24, 1.06 / aspect) : 1.06;
    const id =
      options.id || `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const sticker = this.add(
      {
        id,
        name: name.slice(0, 38),
        category: "custom",
        width,
        height,
        u: 0.32,
        v: 0.3,
        angle: -5,
        custom: true,
      },
      makeStickerTextures(canvas, 86),
    );
    sticker.source = canvas.toDataURL("image/png");
    this.onChange();
    return sticker;
  }
  serialize() {
    return this.items.map((s) => ({
      id: s.id,
      placed: s.placed,
      placement: s.placement,
      angle: s.angle,
      ...(s.meta.custom ? { name: s.meta.name, source: s.source } : {}),
    }));
  }
  async restore(data) {
    if (!Array.isArray(data)) return;
    for (const record of data.slice(0, MAX_STICKERS)) {
      if (!record || typeof record.id !== "string") continue;
      let s = this.find(record.id);
      if (
        !s &&
        record.id.startsWith("custom-") &&
        typeof record.source === "string" &&
        record.source.startsWith("data:image/png;base64,") &&
        record.source.length < 3000000
      ) {
        try {
          const image = await loadImage(record.source);
          s = await this.addCustom(
            image,
            String(record.name || "Your sticker"),
            { id: record.id },
          );
        } catch {
          continue;
        }
      }
      if (!s) continue;
      // Old layouts predate drawer inventory; their recorded stickers were placed.
      s.setPlaced(typeof record.placed === "boolean" ? record.placed : true);
      if (Number.isFinite(record.angle)) s.angle = record.angle;
      const p = record.placement;
      if (
        p &&
        this.fridge.surfaces[p.surface] &&
        Number.isFinite(p.u) &&
        Number.isFinite(p.v)
      )
        s.setPlacement(p, true);
      this.bringToFront(s);
    }
  }
  reset() {
    this.items.filter((s) => s.meta.custom).forEach((s) => s.dispose());
    this.items = this.items.filter((s) => !s.meta.custom);
    this.items.sort(
      (a, b) =>
        CATALOG.findIndex((c) => c.id === a.id) -
        CATALOG.findIndex((c) => c.id === b.id),
    );
    this.items.forEach((s, i) => {
      s.index = i;
      s.angle = THREE.MathUtils.degToRad(s.meta.angle || 0);
      s.dragging = false;
      s.selected = false;
      s.demo = false;
      s.setPlaced(s.meta.placed !== false);
      s.setPlacement({
        surface: s.meta.surface || "front",
        u: s.meta.u,
        v: s.meta.v,
      });
      s.settle = 0.33;
    });
    this.onChange();
  }
  dispose() {
    this.items.forEach((s) => s.dispose());
  }
}
