import * as THREE from "three";
import { clamp } from "./utils.js";

/** First-person glide along a fixed path through the grass. Scroll (or a
 *  vertical touch drag) walks, dragging looks around, Escape heads home.
 *  Listeners exist only while the field is active, so fridge-mode input
 *  never sees them. */
export class FieldControls {
  constructor(
    camera,
    canvas,
    { path, heightAt, reducedMotion, onExit, onTap, onHover, focus },
  ) {
    Object.assign(this, {
      camera,
      canvas,
      path,
      heightAt,
      reducedMotion,
      onExit,
      onTap,
      onHover,
      focus,
    });
    this.progress = 0;
    this.progressTarget = 0;
    this.yaw = 0;
    this.yawTarget = 0;
    this.pitch = 0;
    this.pitchTarget = 0;
    this.walkPhase = 0;
    this.time = 0;
    this.pathLength = path.getLength();
    this.pointer = null;
    this.attached = false;
    this.euler = new THREE.Euler(0, 0, 0, "YXZ");
    this.handlers = {
      wheel: (e) => this.wheel(e),
      pointerdown: (e) => this.down(e),
      pointermove: (e) => this.move(e),
      pointerup: (e) => this.up(e),
      pointercancel: () => (this.pointer = null),
    };
    this.keyHandler = (e) => this.key(e);
  }
  /** Fresh walk from the gate — every arrival starts where the doorway shows. */
  resetPose() {
    this.progress = 0;
    this.progressTarget = 0;
    this.yaw = 0;
    this.yawTarget = 0;
    this.pitch = 0;
    this.pitchTarget = 0;
    this.walkPhase = 0;
  }
  attach() {
    if (this.attached) return;
    this.attached = true;
    this.canvas.addEventListener("wheel", this.handlers.wheel, {
      passive: false,
    });
    for (const type of [
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
    ])
      this.canvas.addEventListener(type, this.handlers[type]);
    window.addEventListener("keydown", this.keyHandler);
  }
  detach() {
    if (!this.attached) return;
    this.attached = false;
    this.canvas.removeEventListener("wheel", this.handlers.wheel);
    for (const type of [
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
    ])
      this.canvas.removeEventListener(type, this.handlers[type]);
    window.removeEventListener("keydown", this.keyHandler);
    this.pointer = null;
  }
  wheel(event) {
    event.preventDefault();
    const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1;
    this.progressTarget = clamp(
      this.progressTarget + event.deltaY * scale * 0.00042,
      0,
      1,
    );
  }
  down(event) {
    if (event.button !== 0 && event.pointerType !== "touch") return;
    this.pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      startTime: performance.now(),
      touch: event.pointerType === "touch",
      axis: null,
      moved: false,
    };
    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch {
      /* Capture is a nicety here, not a requirement. */
    }
  }
  move(event) {
    const p = this.pointer;
    if (!p || event.pointerId !== p.id) {
      if (!p) this.onHover?.(event);
      return;
    }
    const dx = event.clientX - p.x,
      dy = event.clientY - p.y;
    p.x = event.clientX;
    p.y = event.clientY;
    const totalX = event.clientX - p.startX,
      totalY = event.clientY - p.startY;
    // Forgiving click detection: a natural press wobbles a few pixels.
    if (Math.hypot(totalX, totalY) > 9) p.moved = true;
    if (p.touch && !p.axis && p.moved)
      p.axis = Math.abs(totalY) > Math.abs(totalX) ? "walk" : "look";
    if (p.touch && p.axis === "walk") {
      // Thumb-drag toward you walks forward, matching scroll direction.
      this.progressTarget = clamp(this.progressTarget + dy * 0.0011, 0, 1);
      return;
    }
    this.yawTarget = clamp(this.yawTarget + dx * 0.0032, -1.15, 1.15);
    // Deep enough downward range to center the dispenser tray up close.
    this.pitchTarget = clamp(this.pitchTarget - dy * 0.0028, -0.6, 0.45);
  }
  up(event) {
    const p = this.pointer;
    if (!p || event.pointerId !== p.id) return;
    this.pointer = null;
    if (!p.moved && performance.now() - p.startTime < 600) this.onTap?.(event);
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
      event.preventDefault();
      this.onExit?.();
      return;
    }
    const forward = ["ArrowUp", "w", "W"].includes(event.key),
      backward = ["ArrowDown", "s", "S"].includes(event.key);
    if (forward || backward) {
      event.preventDefault();
      this.progressTarget = clamp(
        this.progressTarget + (forward ? 0.035 : -0.035),
        0,
        1,
      );
    }
  }
  update(dt) {
    this.time += dt;
    const previous = this.progress;
    this.progress +=
      (this.progressTarget - this.progress) * (1 - Math.exp(-dt * 3.2));
    const lookEase = 1 - Math.exp(-dt * 9);
    this.yaw += (this.yawTarget - this.yaw) * lookEase;
    this.pitch += (this.pitchTarget - this.pitch) * lookEase;
    const t = clamp(this.progress, 0, 1);
    const position = this.path.getPointAt(t);
    const tangent = this.path.getTangentAt(t);
    const travelled = Math.abs(this.progress - previous) * this.pathLength;
    const speedNorm = clamp(travelled / Math.max(dt, 0.001) / 5, 0, 1);
    this.walkPhase += travelled * 1.9;
    let bob = 0,
      sway = 0;
    if (!this.reducedMotion) {
      bob =
        Math.sin(this.walkPhase * 2) * 0.055 * speedNorm +
        Math.sin(this.time * 1.3) * 0.012;
      sway =
        Math.sin(this.walkPhase) * 0.006 * speedNorm +
        Math.sin(this.time * 0.23) * 0.004;
    }
    this.camera.position.set(
      position.x,
      this.heightAt(position.x, position.z) + 6.05 + bob,
      position.z,
    );
    // The camera looks along -Z at rest, so the path-facing yaw negates the tangent.
    let baseYaw = Math.atan2(-tangent.x, -tangent.z);
    if (this.focus) {
      // Arriving, the gaze settles on the destination instead of the path tangent.
      const arrive = clamp((t - 0.72) / 0.26, 0, 1);
      if (arrive > 0) {
        const focusYaw = Math.atan2(
          -(this.focus.x - position.x),
          -(this.focus.z - position.z),
        );
        let delta = focusYaw - baseYaw;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        baseYaw += delta * arrive * arrive * (3 - 2 * arrive);
      }
    }
    this.euler.set(this.pitch, baseYaw + this.yaw + sway, 0);
    this.camera.quaternion.setFromEuler(this.euler);
  }
  dispose() {
    this.detach();
  }
}
