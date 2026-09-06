const SVG = "http://www.w3.org/2000/svg";

/** An articulated paper wordmark: uneven raised middle folds plus an edge curl.
 * SVG <use> shares the original font outlines; it does not load/distribute a font.
 * Motion sleeps when settled and respects reduced-motion preferences.
 */
export class BrandPeel {
  constructor(button, reducedMotion = false) {
    this.button = button;
    this.reduced = reducedMotion;
    this.original = button.querySelector(".brand-wordmark");
    this.view = this.original.viewBox.baseVal;
    this.ink = this.original.querySelector("g");
    this.ink.id = "header-wordmark-ink";
    const defs = document.createElementNS(SVG, "defs");
    defs.innerHTML =
      '<linearGradient id="header-wordmark-silver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#707980"/><stop offset=".34" stop-color="#edf0ed"/><stop offset=".66" stop-color="#a3acb2"/><stop offset="1" stop-color="#e2e5e4"/></linearGradient>';
    this.original.prepend(defs);
    this.layer = document.createElement("span");
    this.layer.className = "brand-peel-layer";
    this.layer.setAttribute("aria-hidden", "true");
    button.appendChild(this.layer);
    this.original.classList.add("brand-template");
    this.slices = [];
    this.p = 0;
    this.velocity = 0;
    this.target = 0;
    this.press = 0;
    this.frame = 0;
    this.locked = false;
    this.disposed = false;
    // Segment the entire wordmark, not just its last letter. Adjacent strips share
    // the same 3D edge positions, so creases bend the lettering without tearing it.
    const fractions = Array(56).fill(1 / 56);
    const bleed = 0.00065;
    let left = 0;
    for (const fraction of fractions) {
      const piece = document.createElement("span");
      piece.className = "brand-slice";
      let frontFace;
      for (const back of [false, true]) {
        const face = document.createElement("span");
        face.className = back
          ? "brand-face brand-back"
          : "brand-face brand-front";
        if (!back) frontFace = face;
        const svg = document.createElementNS(SVG, "svg");
        svg.setAttribute(
          "viewBox",
          `${(left - bleed / 2) * this.view.width} 0 ${(fraction + bleed) * this.view.width} ${this.view.height}`,
        );
        svg.setAttribute("preserveAspectRatio", "none");
        const use = document.createElementNS(SVG, "use");
        use.setAttribute("href", "#header-wordmark-ink");
        use.setAttribute(
          "fill",
          back ? "url(#header-wordmark-silver)" : "currentColor",
        );
        svg.appendChild(use);
        face.appendChild(svg);
        piece.appendChild(face);
      }
      this.layer.appendChild(piece);
      this.slices.push({ piece, frontFace, left, fraction, bleed });
      left += fraction;
    }
    this.enter = () => {
      if (!this.locked) {
        this.target = this.reduced ? 0.18 : 1;
        this.wake();
      }
    };
    this.leave = () => {
      this.locked = false;
      this.target = 0;
      this.wake();
    };
    button.addEventListener("pointerenter", this.enter);
    button.addEventListener("pointerleave", this.leave);
    button.addEventListener("focus", this.enter);
    button.addEventListener("blur", this.leave);
    this.observer = new ResizeObserver(() => this.draw());
    this.observer.observe(this.original);
    this.draw();
  }
  slam() {
    this.locked = true;
    this.target = 0;
    this.press = this.reduced ? 0 : 1;
    this.velocity = 0;
    this.slamFrom = this.p;
    this.slamStarted = performance.now();
    if (this.reduced) {
      this.p = 0;
      this.press = 0;
      this.slamStarted = 0;
      this.draw();
    }
    this.wake();
  }
  wake() {
    if (!this.frame && !this.disposed) {
      this.time = performance.now();
      this.frame = requestAnimationFrame((t) => this.animate(t));
    }
  }
  animate(time) {
    this.frame = 0;
    if (this.disposed) return;
    const dt = Math.min(0.4, Math.max(0.001, (time - this.time) / 1000));
    this.time = time;
    if (this.slamStarted) {
      const t = Math.min(1, (time - this.slamStarted) / 150);
      this.p = this.slamFrom * Math.pow(1 - t, 3);
      this.press = Math.sin(t * Math.PI);
      if (t >= 1) {
        this.p = 0;
        this.press = 0;
        this.velocity = 0;
        this.slamStarted = 0;
      }
    } else {
      // Integrate real elapsed time in stable small steps, even on a slow GPU.
      const steps = Math.max(1, Math.ceil(dt / 0.016)),
        step = dt / steps;
      for (let i = 0; i < steps; i++) {
        this.velocity += (this.target - this.p) * 210 * step;
        this.velocity *= Math.exp(-22 * step);
        this.p += this.velocity * step;
      }
    }
    if (this.p < 0) {
      this.p = 0;
      this.velocity = Math.max(0, this.velocity) * 0.1;
    }
    this.p = Math.min(1.06, this.p);
    this.press *= Math.exp(-dt * 24);
    this.draw();
    if (
      Math.abs(this.target - this.p) > 0.0005 ||
      Math.abs(this.velocity) > 0.003 ||
      this.press > 0.003
    )
      this.frame = requestAnimationFrame((t) => this.animate(t));
    else {
      this.p = this.target;
      this.press = 0;
      this.draw();
    }
  }
  /** Signed ridge slopes: three different widths/heights make the middle feel
   * crumpled rather than uniformly wavy. Each ridge rises and returns to the
   * surface. Integrating its tangent preserves paper length as the folds pull in.
   */
  foldAngle(u, amount) {
    const ridge = (start, end, height) => {
      if (u <= start || u >= end) return 0;
      const wave = Math.sin(((u - start) / (end - start)) * Math.PI * 2);
      return Math.sign(wave) * Math.pow(Math.abs(wave), 0.7) * height;
    };
    const middle =
      ridge(0.17, 0.42, 0.72) + ridge(0.4, 0.73, 1.0) + ridge(0.72, 0.89, 0.62);
    const edge = Math.max(0, (u - 0.895) / 0.105) * 1.95;
    return amount * (middle + edge);
  }
  draw() {
    const width = this.original.getBoundingClientRect().width;
    if (!width) return;
    const amount = Math.max(0, this.p);
    const active = amount > 0.0001 || this.press > 0.0001;
    // Render the unsliced original at rest, for perfect text edges and no extra
    // idle compositing. Only the moving paper needs the 3D strip layers.
    this.original.style.opacity = active ? "0" : "1";
    this.layer.style.visibility = active ? "visible" : "hidden";
    const color = getComputedStyle(this.button)
      .color.match(/[\d.]+/g)
      ?.map(Number) || [242, 242, 244];
    let x = 0,
      y = 0,
      z = 0;
    this.middleLift = 0;
    this.peakLift = 0;
    for (const { piece, frontFace, left, fraction, bleed } of this.slices) {
      const size = width * fraction,
        start = { x, y, z };
      // Four integration samples per strip create a continuous, inextensible
      // ribbon. A small upward component makes the raised middle folds visible
      // from the straight-on view as well as through perspective and shading.
      const samples = 4,
        ds = size / samples;
      for (let j = 0; j < samples; j++) {
        const u = left + (fraction * (j + 0.5)) / samples;
        const angle = this.foldAngle(u, amount),
          rise = Math.sin(angle);
        const vertical = -0.29 * rise,
          length = Math.hypot(Math.cos(angle), vertical, rise);
        x += (Math.cos(angle) / length) * ds;
        y += (vertical / length) * ds;
        z += (rise / length) * ds;
        this.peakLift = Math.max(this.peakLift, z);
        if (u > 0.2 && u < 0.86) this.middleLift = Math.max(this.middleLift, z);
      }
      const tx = (x - start.x) / size,
        ty = (y - start.y) / size,
        tz = (z - start.z) / size;
      const normalLength = Math.hypot(tx, tz) || 1;
      const cx = (x + start.x) / 2,
        cy = (y + start.y) / 2,
        cz = (z + start.z) / 2;
      const paintedWidth = size + width * bleed;
      piece.style.width = `${paintedWidth}px`;
      piece.style.left = `${cx - paintedWidth / 2}px`;
      // Tangent + a common vertical edge form an affine paper segment; matching
      // endpoints avoid the gaps caused by independently lifting letter slices.
      piece.style.transform = `matrix3d(${tx},${ty},${tz},0,0,1,0,0,${-tz / normalLength},0,${tx / normalLength},0,0,${cy},${cz},1)`;
      const light = Math.min(1.025, 0.72 + 0.28 * Math.max(0, tx + tz * 0.5));
      frontFace.style.color = `rgb(${color
        .slice(0, 3)
        .map((c) => Math.min(255, Math.round(c * light)))
        .join(",")})`;
    }
    this.foldedWidth = x;
    this.layer.style.transform = `translateY(${this.press * 1.4}px) scaleY(${1 - this.press * 0.017})`;
    this.button.dataset.peel = String(this.p.toFixed(3));
    this.button.dataset.middleLift = this.middleLift.toFixed(2);
  }
  get state() {
    return {
      peel: this.p,
      target: this.target,
      locked: this.locked,
      press: this.press,
      middleLift: this.middleLift || 0,
      peakLift: this.peakLift || 0,
      foldedWidth: this.foldedWidth || 0,
    };
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.button.removeEventListener("pointerenter", this.enter);
    this.button.removeEventListener("pointerleave", this.leave);
    this.button.removeEventListener("focus", this.enter);
    this.button.removeEventListener("blur", this.leave);
    this.layer.remove();
    this.original.classList.remove("brand-template");
    this.original.style.removeProperty("opacity");
  }
}
