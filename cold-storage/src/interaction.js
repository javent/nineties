import * as THREE from "three";
import { clamp } from "./utils.js";

/** Capture sticker gestures before OrbitControls; empty-space gestures pass through. */
export class Interaction {
  constructor(app, fridge, stickers, audio, callbacks = {}) {
    Object.assign(this, { app, fridge, stickers, audio, callbacks });
    this.canvas = app.renderer.domElement;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.active = null;
    this.hovered = null;
    this.hoveredHandle = false;
    this.selected = null;
    this.demoUntil = 0;
    this.handlers = {
      pointerdown: (e) => this.down(e),
      pointermove: (e) => this.move(e),
      pointerup: (e) => this.up(e),
      pointercancel: (e) => this.cancel(e),
      pointerleave: () => {
        if (!this.active) {
          this.setHandleHovered(false);
          this.setHover(null);
        }
      },
      lostpointercapture: (e) => {
        if (this.active?.pointerId === e.pointerId) this.cancel(e);
      },
    };
    for (const [type, handler] of Object.entries(this.handlers))
      this.canvas.addEventListener(type, handler, { capture: true });
    this.armedMove = (e) => {
      if (this.active?.armed) this.moveActive(e);
    };
    this.blurHandler = () => this.cancel();
    window.addEventListener("pointermove", this.armedMove, { capture: true });
    window.addEventListener("blur", this.blurHandler);
    this.keyHandler = (e) => this.key(e);
    window.addEventListener("keydown", this.keyHandler);
    this.preventContext = (e) => e.preventDefault();
    this.canvas.addEventListener("contextmenu", this.preventContext);
  }
  setRay(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.app.camera);
  }
  pickSticker() {
    const body = this.raycaster.intersectObjects(this.fridge.meshes, false)[0];
    return this.raycaster
      .intersectObjects(this.stickers.pickMeshes, false)
      .find(
        (hit) =>
          (!body || hit.distance <= body.distance + 0.055) &&
          hit.object.userData.sticker.hitIsOpaque(hit.uv),
      );
  }
  pickHandle() {
    if (!this.fridge.handleMeshes?.length) return null;
    return this.raycaster.intersectObjects(this.fridge.handleMeshes, false)[0] || null;
  }
  get busy() {
    return !!this.active;
  }
  /** Pointer handoff from a drawer card into the same 3D curl/drop system. */
  beginFromCollection(sticker, event, uv = { x: 0.5, y: 0.5 }, armed = false) {
    this.cancel();
    this.stopDemo();
    this.select(null);
    this.setHover(null);
    this.app.stopMotion();
    this.app.controls.enabled = false;
    this.audio.unlock();
    this.setRay(event);
    const normal = this.app.camera
      .getWorldDirection(new THREE.Vector3())
      .negate();
    const center = this.app.controls.target
      .clone()
      .addScaledVector(normal, 1.8);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      normal,
      center,
    );
    const dx = (0.5 - uv.x) * sticker.width,
      dy = (0.5 - uv.y) * sticker.height,
      angle = sticker.angle;
    this.active = {
      sticker,
      pointerId: armed ? null : event.pointerId,
      started: true,
      armed,
      fromCollection: true,
      original: { ...sticker.placement },
      originalPlaced: sticker.placed,
      angle,
      plane,
      offsetU: dx * Math.cos(angle) - dy * Math.sin(angle),
      offsetV: dx * Math.sin(angle) + dy * Math.cos(angle),
      lastValid: { surface: "front", u: 0, v: 0.3 },
      valid: false,
      uv: new THREE.Vector2(uv.x, uv.y),
      lastEvent: { clientX: event.clientX, clientY: event.clientY },
    };
    sticker.dragging = true;
    sticker.group.visible = true;
    sticker.isOffSurface = true;
    sticker.chooseCurl(this.active.uv);
    sticker.peel = 0.7;
    sticker.peelVelocity = 0;
    sticker.lastDeformation = -1;
    sticker.lift = 0.19;
    this.stickers.bringToFront(sticker);
    this.canvas.classList.add("is-dragging");
    this.moveActive(event);
    sticker.group.position
      .copy(sticker.targetPosition)
      .addScaledVector(sticker.normal, 0.19);
    sticker.group.quaternion.copy(sticker.targetQuaternion);
    sticker.deform(sticker.peel);
    this.app.scene.updateMatrixWorld(true);
    this.app.renderer.shadowMap.needsUpdate = true;
    if (!armed) {
      try {
        this.canvas.setPointerCapture(event.pointerId);
      } catch {
        this.cancel();
        return;
      }
    }
    this.audio.peel();
    this.callbacks.drag?.(true, sticker, this.active.valid);
  }
  placeFromCollectionKeyboard(sticker) {
    this.cancel();
    this.stopDemo();
    if (!sticker.placed) {
      sticker.setPlaced(true);
      sticker.setPlacement({ surface: "front", u: 0.2, v: 0.35 });
      sticker.peel = 0.4;
      sticker.settle = 0.33;
      this.stickers.bringToFront(sticker);
      this.audio.unlock();
      this.audio.stick();
      this.stickers.onChange();
    }
    this.select(sticker);
    this.canvas.focus({ preventScroll: true });
  }
  pickSurface() {
    for (const hit of this.raycaster.intersectObjects(
      this.fridge.meshes,
      false,
    )) {
      const placement = this.fridge.fromIntersection(hit);
      if (placement) return { placement, hit };
    }
    return null;
  }
  setHandleHovered(value, event) {
    value = !!value;
    if (this.hoveredHandle === value) return;
    this.hoveredHandle = value;
    this.fridge.setHandleHovered?.(value);
    this.canvas.classList.toggle("is-handle-hovering", value);
    this.callbacks.handleHover?.(value, event);
  }
  setHover(sticker, event) {
    if (this.hovered !== sticker) {
      if (this.hovered) this.hovered.hovered = false;
      this.hovered = sticker;
      if (sticker) sticker.hovered = true;
    }
    this.canvas.classList.toggle("is-hovering", !!sticker);
    this.callbacks.hover?.(sticker, event);
  }
  select(sticker) {
    if (this.selected) this.selected.selected = false;
    this.selected = sticker;
    if (sticker) {
      sticker.selected = true;
      this.app.reset(
        false,
        this.fridge.surfaces[sticker.placement.surface].normal,
      );
    }
    this.callbacks.select?.(sticker);
  }
  down(event) {
    if (event.button !== 0 || document.querySelector("dialog[open]")) return;
    if (this.active?.armed) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.active.armed = false;
      this.active.pointerId = event.pointerId;
      this.canvas.setPointerCapture(event.pointerId);
      this.moveActive(event);
      return;
    }
    if (this.active) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    this.stopDemo();
    this.setRay(event);
    const handle = this.pickHandle();
    if (handle) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.setHandleHovered(true, event);
      this.audio.unlock();
      this.callbacks.handleClick?.(event, handle.object);
      return;
    }
    this.setHandleHovered(false, event);
    const hit = this.pickSticker();
    if (!hit) {
      this.select(null);
      this.setHover(null);
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    this.audio.unlock();
    const sticker = hit.object.userData.sticker;
    this.select(null);
    this.app.stopMotion();
    this.app.controls.enabled = false;
    const surface = this.fridge.surfaces[sticker.placement.surface],
      point = this.fridge.point(sticker.placement);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        surface.normal,
        point,
      ),
      intersection = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(plane, intersection);
    const local = intersection.clone().sub(surface.origin);
    this.active = {
      sticker,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTime: performance.now(),
      started: false,
      original: { ...sticker.placement },
      originalPlaced: sticker.placed,
      angle: sticker.angle,
      plane,
      offsetU: sticker.placement.u - local.dot(surface.u),
      offsetV: sticker.placement.v - local.dot(surface.v),
      lastValid: { ...sticker.placement },
      valid: true,
      lastEvent: { clientX: event.clientX, clientY: event.clientY },
      uv: hit.uv.clone(),
    };
    this.canvas.setPointerCapture(event.pointerId);
    this.setHover(null);
    // Gesture timing is independent of GPU frame rate (important on older phones).
    clearTimeout(this.holdTimer);
    this.holdTimer = setTimeout(() => {
      if (this.active?.pointerId === event.pointerId) {
        this.startDrag();
        this.moveActive(this.active.lastEvent);
      }
    }, 125);
  }
  startDrag() {
    const active = this.active;
    if (!active || active.started) return;
    active.started = true;
    active.sticker.dragging = true;
    active.sticker.chooseCurl(active.uv);
    this.stickers.bringToFront(active.sticker);
    this.canvas.classList.add("is-dragging");
    this.audio.peel();
    this.callbacks.drag?.(true, active.sticker, true);
  }
  move(event) {
    if (this.active) {
      if (this.active.armed) return; // Window-level movement also works over UI controls.
      if (event.pointerId !== this.active.pointerId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const active = this.active;
      active.lastEvent = { clientX: event.clientX, clientY: event.clientY };
      if (
        !active.started &&
        Math.hypot(
          event.clientX - active.startX,
          event.clientY - active.startY,
        ) > 4
      )
        this.startDrag();
      if (active.started) this.moveActive(event);
      return;
    }
    if (
      event.pointerType === "touch" ||
      event.buttons ||
      document.querySelector("dialog[open]")
    ) {
      this.setHover(null);
      return;
    }
    this.setRay(event);
    if (this.pickHandle()) {
      this.setHover(null, event);
      this.setHandleHovered(true, event);
      return;
    }
    this.setHandleHovered(false, event);
    this.setHover(this.pickSticker()?.object.userData.sticker || null, event);
  }
  moveActive(event) {
    const a = this.active,
      s = a.sticker;
    this.setRay(event);
    const result = this.pickSurface();
    if (result) {
      let placement = {
        ...result.placement,
        u: result.placement.u + a.offsetU,
        v: result.placement.v + a.offsetV,
      };
      placement = this.fridge.fitPlacement(
        placement,
        s.width,
        s.height,
        s.angle,
      );
      a.valid = true;
      a.lastValid = placement;
      s.isOffSurface = false;
      s.setTarget(placement);
      const surface = this.fridge.surfaces[placement.surface];
      if (!a.fromCollection)
        a.plane.setFromNormalAndCoplanarPoint(
          surface.normal,
          this.fridge.point(placement),
        );
    } else {
      a.valid = false;
      s.isOffSurface = true;
      const free = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(a.plane, free)) {
        const surface = this.fridge.surfaces[a.lastValid.surface];
        const u = a.fromCollection
          ? new THREE.Vector3(1, 0, 0).applyQuaternion(
              this.app.camera.quaternion,
            )
          : surface.u;
        const v = a.fromCollection
          ? new THREE.Vector3(0, 1, 0).applyQuaternion(
              this.app.camera.quaternion,
            )
          : surface.v;
        free.addScaledVector(u, a.offsetU).addScaledVector(v, a.offsetV);
        s.setTarget(a.lastValid, free);
        if (a.fromCollection) {
          s.normal.copy(
            this.app.camera.getWorldDirection(new THREE.Vector3()).negate(),
          );
          s.targetQuaternion
            .copy(this.app.camera.quaternion)
            .multiply(
              new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(0, 0, 1),
                s.angle,
              ),
            );
        }
      }
    }
    this.callbacks.drag?.(true, s, a.valid);
  }
  up(event) {
    const a = this.active;
    if (!a || a.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const s = a.sticker;
    if (a.started) {
      this.moveActive(event);
      s.dragging = false;
      s.isOffSurface = false;
      s.setPlacement(a.valid ? a.lastValid : a.original);
      s.setPlaced(a.valid ? true : a.originalPlaced);
      s.settle = 0.33;
      if (a.valid) {
        this.audio.stick();
        this.stickers.onChange();
        this.callbacks.stick?.(s);
      }
    } else this.select(s);
    this.finishActive();
  }
  finishActive() {
    clearTimeout(this.holdTimer);
    const pointerId = this.active?.pointerId;
    this.active = null;
    this.app.controls.enabled = true;
    if (
      pointerId !== undefined &&
      pointerId !== null &&
      this.canvas.hasPointerCapture(pointerId)
    )
      this.canvas.releasePointerCapture(pointerId);
    this.canvas.classList.remove("is-dragging");
    this.setHandleHovered(false);
    this.app.renderer.shadowMap.needsUpdate = true;
    this.callbacks.drag?.(false);
  }
  cancel(event) {
    const a = this.active;
    if (!a) return;
    if (event?.pointerId !== undefined && event.pointerId !== a.pointerId)
      return;
    a.sticker.dragging = false;
    a.sticker.isOffSurface = false;
    a.sticker.angle = a.angle;
    a.sticker.setPlacement(a.original);
    a.sticker.setPlaced(a.originalPlaced);
    this.finishActive();
  }
  key(event) {
    if (
      document.querySelector("dialog[open]") ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)
    )
      return;
    if (event.key === "Escape") {
      if (this.active) this.cancel();
      this.select(null);
      this.stopDemo();
      this.setHover(null);
      return;
    }
    if (!this.active && ["+", "=", "-", "0"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "0") this.app.reset();
      else this.app.zoom(event.key === "-" ? 1.1 : 0.9);
      return;
    }
    const s = this.selected;
    if (!s || this.active) return;
    const step = event.shiftKey ? 0.025 : 0.09,
      placement = { ...s.placement };
    let handled = true;
    switch (event.key) {
      case "ArrowLeft":
        placement.u -= step;
        break;
      case "ArrowRight":
        placement.u += step;
        break;
      case "ArrowUp":
        placement.v += step;
        break;
      case "ArrowDown":
        placement.v -= step;
        break;
      case "[":
        s.angle += THREE.MathUtils.degToRad(event.shiftKey ? 1 : 5);
        break;
      case "]":
        s.angle -= THREE.MathUtils.degToRad(event.shiftKey ? 1 : 5);
        break;
      default:
        handled = false;
    }
    if (handled) {
      event.preventDefault();
      s.setPlacement(placement);
      this.stickers.bringToFront(s);
      this.stickers.onChange();
    }
  }
  demo() {
    this.cancel();
    this.select(null);
    this.stopDemo();
    this.app.reset();
    const s = this.stickers.find("spitfire");
    if (!s) return;
    // Reset its curl direction so the demonstration clearly exposes the metallic back.
    s.curlDirection.set(0.98, 0.18).normalize();
    s.lastDeformation = -1;
    s.demo = true;
    this.demoSticker = s;
    this.demoUntil = performance.now() + 1700;
    this.audio.unlock();
    this.audio.peel();
  }
  stopDemo() {
    if (this.demoSticker) {
      this.demoSticker.demo = false;
      this.demoSticker.settle = 0.33;
      this.demoSticker = null;
      this.demoUntil = 0;
    }
  }
  update() {
    if (
      this.active &&
      !this.active.started &&
      performance.now() - this.active.startTime > 125
    ) {
      this.startDrag();
      this.moveActive(this.active.lastEvent);
    }
    if (this.demoUntil && performance.now() > this.demoUntil) {
      this.stopDemo();
      this.audio.stick();
    }
  }
  dispose() {
    this.cancel();
    for (const [type, handler] of Object.entries(this.handlers))
      this.canvas.removeEventListener(type, handler, { capture: true });
    window.removeEventListener("keydown", this.keyHandler);
    window.removeEventListener("pointermove", this.armedMove, {
      capture: true,
    });
    window.removeEventListener("blur", this.blurHandler);
    this.canvas.removeEventListener("contextmenu", this.preventContext);
  }
}
