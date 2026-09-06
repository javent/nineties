/** Wooden collection drawer with a pointer handoff into the actual 3D scene.
 * Touch: a vertical swipe scrolls; a hold or horizontal pull picks up the sticker.
 * Mouse: drag/hold picks up; click arms tap-to-place. Keyboard activation places
 * the sticker and keeps the existing arrow/bracket adjustment controls available.
 */
export class CollectionDrawer {
  constructor(dialog, interaction, options = {}) {
    this.dialog = dialog;
    this.interaction = interaction;
    this.reduced = !!options.reducedMotion;
    this.state = null;
    this.timer = 0;
    this.inertia = 0;
    this.suppressUntil = 0;
    this.handlers = {
      pointermove: (e) => this.move(e),
      pointerup: (e) => this.up(e),
      pointercancel: (e) => this.cancel(e),
      blur: () => {
        this.cancel();
        cancelAnimationFrame(this.inertia);
      },
      pointerdown: (e) => this.outside(e),
      keydown: (e) => {
        if (e.key === "Escape" && this.dialog.open) {
          e.preventDefault();
          this.close();
        }
      },
    };
    for (const [type, fn] of Object.entries(this.handlers))
      window.addEventListener(type, fn, { capture: true, passive: false });
  }
  open() {
    this.cancel();
    cancelAnimationFrame(this.inertia);
    this.interaction.cancel();
    this.interaction.stopDemo();
    this.interaction.setHover(null);
    clearTimeout(this.closeTimer);
    this.dialog.classList.remove("is-closing");
    if (!this.dialog.open) this.dialog.show();
    this.dialog.classList.add("is-opening");
    setTimeout(() => this.dialog.classList.remove("is-opening"), 260);
    document.body.classList.add("drawer-open");
  }
  close(animate = true) {
    if (!this.dialog.open) return;
    this.dialog.classList.remove("is-opening");
    if (animate && !this.reduced) this.dialog.classList.add("is-closing");
    this.dialog.close();
    document.body.classList.remove("drawer-open");
    clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(
      () => this.dialog.classList.remove("is-closing"),
      210,
    );
  }
  outside(e) {
    if (!this.dialog.open || this.state) return;
    if (
      this.dialog.contains(e.target) ||
      e.target.closest?.("#open-collection")
    )
      return;
    this.close();
  }
  attach(card, sticker) {
    card.draggable = false;
    card.addEventListener("dragstart", (e) => e.preventDefault());
    card.addEventListener("pointerdown", (e) => this.down(e, card, sticker));
    card.addEventListener("click", (e) => {
      e.preventDefault();
      if (performance.now() < this.suppressUntil) return;
      if (e.detail === 0) {
        this.close();
        this.interaction.placeFromCollectionKeyboard(sticker);
      }
    });
  }
  down(e, card, sticker) {
    if (e.button !== 0 || this.state || !e.isPrimary) return;
    cancelAnimationFrame(this.inertia);
    clearTimeout(this.timer);
    e.preventDefault();
    e.stopPropagation();
    const image = card.querySelector("img"),
      box = image.getBoundingClientRect(),
      ratio =
        (image.naturalWidth || sticker.art.front.width) /
        (image.naturalHeight || sticker.art.front.height);
    let w = box.width,
      h = w / ratio;
    if (h > box.height) {
      h = box.height;
      w = h * ratio;
    }
    const x = box.left + (box.width - w) / 2,
      y = box.top + (box.height - h) / 2;
    const uv = {
      x: Math.max(0.04, Math.min(0.96, (e.clientX - x) / w)),
      y: Math.max(0.04, Math.min(0.96, 1 - (e.clientY - y) / h)),
    };
    this.state = {
      id: e.pointerId,
      type: e.pointerType,
      card,
      sticker,
      uv,
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      scrollTop: this.dialog.scrollTop,
      scrolling: false,
      lastTime: performance.now(),
      velocity: 0,
    };
    card.classList.add("is-held");
    this.timer = setTimeout(
      () => {
        if (this.state && !this.state.scrolling)
          this.handoff({
            clientX: this.state.lastX,
            clientY: this.state.lastY,
            pointerId: this.state.id,
            pointerType: this.state.type,
          });
      },
      e.pointerType === "touch" ? 220 : 145,
    );
  }
  move(e) {
    const s = this.state;
    if (!s || e.pointerId !== s.id) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const dx = e.clientX - s.x,
      dy = e.clientY - s.y,
      now = performance.now();
    if (!s.scrolling && Math.hypot(dx, dy) > 7) {
      if (s.type === "touch" && Math.abs(dy) > Math.abs(dx) * 1.15) {
        s.scrolling = true;
        clearTimeout(this.timer);
        s.card.classList.remove("is-held");
      } else {
        this.handoff(e);
        return;
      }
    }
    if (s.scrolling) {
      const delta = s.lastY - e.clientY;
      this.dialog.scrollTop += delta;
      s.velocity = (delta / Math.max(8, now - s.lastTime)) * 16;
    }
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    s.lastTime = now;
  }
  handoff(event) {
    const s = this.state;
    if (!s) return;
    clearTimeout(this.timer);
    this.state = null;
    s.card.classList.remove("is-held");
    this.suppressUntil = performance.now() + 400;
    this.close();
    this.interaction.beginFromCollection(s.sticker, event, s.uv, false);
  }
  up(e) {
    const s = this.state;
    if (!s || e.pointerId !== s.id) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    clearTimeout(this.timer);
    this.state = null;
    s.card.classList.remove("is-held");
    this.suppressUntil = performance.now() + 350;
    if (s.scrolling) {
      if (!this.reduced) {
        let v = s.velocity;
        const step = () => {
          v *= 0.91;
          this.dialog.scrollTop += v;
          if (Math.abs(v) > 0.25 && this.dialog.open)
            this.inertia = requestAnimationFrame(step);
        };
        this.inertia = requestAnimationFrame(step);
      }
      return;
    }
    this.close();
    this.interaction.beginFromCollection(
      s.sticker,
      e,
      { x: 0.5, y: 0.5 },
      true,
    );
  }
  cancel(e) {
    if (
      e?.pointerId !== undefined &&
      this.state &&
      e.pointerId !== this.state.id
    )
      return;
    clearTimeout(this.timer);
    if (this.state) this.state.card.classList.remove("is-held");
    this.state = null;
  }
  dispose() {
    this.cancel();
    cancelAnimationFrame(this.inertia);
    clearTimeout(this.closeTimer);
    for (const [type, fn] of Object.entries(this.handlers))
      window.removeEventListener(type, fn, { capture: true });
  }
}
