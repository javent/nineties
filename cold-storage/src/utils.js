import * as THREE from "three";

/** The standalone build injects data URLs here. The modular build uses local files. */
export const asset = (name) =>
  window.__MID90S_MINIFRIDGE_ASSETS__?.[name] ||
  window.__COLD_STORAGE_ASSETS__?.[name] ||
  `./assets/${name}`;
export const clamp = THREE.MathUtils.clamp;
export const lerp = THREE.MathUtils.lerp;
export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => [...document.querySelectorAll(selector)];
export function random(seed = 1) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** `willReadFrequently` pins a canvas to a CPU-backed surface, which makes
 * drawImage and GPU texture uploads markedly slower. Only opt in for the few
 * canvases we actually call getImageData on; everything else stays
 * hardware-accelerated. */
export function canvas2D(width = 512, height = width, readFrequently = false) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return [
    canvas,
    canvas.getContext(
      "2d",
      readFrequently ? { willReadFrequently: true } : undefined,
    ),
  ];
}
export function textureFrom(canvas, color = true) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = 8;
  return texture;
}
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
export function withTimeout(promise, milliseconds = 15000) {
  let timeout;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeout = setTimeout(
        () => reject(new Error("Asset timeout")),
        milliseconds,
      );
    }),
  ]).finally(() => clearTimeout(timeout));
}
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function debounce(fn, delay = 350) {
  let id;
  const debounced = (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), delay);
  };
  debounced.flush = () => {
    clearTimeout(id);
    fn();
  };
  return debounced;
}

/** Local, gesture-unlocked sound effects. No recordings or network requests. */
export class TactileAudio {
  constructor() {
    this.enabled = true;
    this.context = null;
  }
  unlock() {
    if (!this.enabled) return;
    try {
      this.context ||= new (window.AudioContext || window.webkitAudioContext)();
      if (this.context.state === "suspended") this.context.resume();
    } catch {
      /* Sound is optional. */
    }
  }
  peel() {
    if (!this.enabled || !this.context) return;
    const ctx = this.context,
      time = ctx.currentTime,
      duration = 0.23;
    const buffer = ctx.createBuffer(
      1,
      Math.ceil(ctx.sampleRate * duration),
      ctx.sampleRate,
    );
    const data = buffer.getChannelData(0);
    const rand = random(1986 + Math.round(time * 100));
    for (let i = 0; i < data.length; i++)
      data[i] =
        (rand() * 2 - 1) *
        (0.55 + 0.45 * Math.sin(i * 0.011)) *
        Math.pow(1 - i / data.length, 0.7);
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = 2800;
    filter.Q.value = 0.75;
    gain.gain.setValueAtTime(0.06, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(time);
    source.stop(time + duration);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  stick() {
    if (!this.enabled || !this.context) return;
    const ctx = this.context,
      time = ctx.currentTime,
      oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(148, time);
    oscillator.frequency.exponentialRampToValueAtTime(56, time + 0.095);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.14, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.17);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.18);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  dispose() {
    this.context?.close();
  }
}
