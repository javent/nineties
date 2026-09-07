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
export function canvas2D(width = 512, height = width) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext("2d", { willReadFrequently: true })];
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
  /** Short filtered-noise transient; shared by the door and vending sounds. */
  noiseBurst(startAt, duration, frequency, peak, Q = 0.8) {
    const ctx = this.context,
      time = ctx.currentTime + startAt;
    const buffer = ctx.createBuffer(
      1,
      Math.ceil(ctx.sampleRate * duration),
      ctx.sampleRate,
    );
    const data = buffer.getChannelData(0);
    const rand = random(1996 + Math.round(time * 1000));
    for (let i = 0; i < data.length; i++)
      data[i] = (rand() * 2 - 1) * Math.pow(1 - i / data.length, 1.4);
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = Q;
    gain.gain.setValueAtTime(peak, time);
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
  thump(fromHz, toHz, peak, duration = 0.16, startAt = 0) {
    const ctx = this.context,
      time = ctx.currentTime + startAt,
      oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(fromHz, time);
    oscillator.frequency.exponentialRampToValueAtTime(
      toHz,
      time + duration * 0.6,
    );
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  doorOpen() {
    if (!this.enabled || !this.context) return;
    const ctx = this.context,
      time = ctx.currentTime;
    // Gasket pop, cabinet thump, then a slow hinge creak with a wobbling pitch.
    this.noiseBurst(0, 0.07, 1400, 0.09);
    this.thump(110, 45, 0.15, 0.18);
    const creak = ctx.createOscillator(),
      lfo = ctx.createOscillator(),
      lfoGain = ctx.createGain(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    creak.type = "sawtooth";
    creak.frequency.setValueAtTime(178, time + 0.1);
    creak.frequency.linearRampToValueAtTime(148, time + 0.62);
    lfo.frequency.value = 5.2;
    lfoGain.gain.value = 13;
    lfo.connect(lfoGain).connect(creak.frequency);
    filter.type = "lowpass";
    filter.frequency.value = 900;
    gain.gain.setValueAtTime(0.0001, time + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.026, time + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.66);
    creak.connect(filter).connect(gain).connect(ctx.destination);
    creak.start(time + 0.1);
    lfo.start(time + 0.1);
    creak.stop(time + 0.7);
    lfo.stop(time + 0.7);
    creak.onended = () => {
      creak.disconnect();
      lfo.disconnect();
      lfoGain.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  doorClose() {
    if (!this.enabled || !this.context) return;
    this.thump(130, 50, 0.2, 0.15);
    this.noiseBurst(0.02, 0.06, 900, 0.06);
  }
  vendButton() {
    if (!this.enabled || !this.context) return;
    const ctx = this.context,
      time = ctx.currentTime,
      oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = 750;
    gain.gain.setValueAtTime(0.045, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.05);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  vendThunk() {
    if (!this.enabled || !this.context) return;
    this.thump(96, 30, 0.24, 0.2);
    this.noiseBurst(0.01, 0.09, 420, 0.1);
  }
  vendRattle() {
    if (!this.enabled || !this.context) return;
    this.noiseBurst(0, 0.09, 1100, 0.12);
    this.noiseBurst(0.11, 0.07, 1250, 0.07);
    this.noiseBurst(0.2, 0.05, 950, 0.04);
  }
  slimePop() {
    if (!this.enabled || !this.context) return;
    const ctx = this.context,
      time = ctx.currentTime;
    this.thump(70, 24, 0.3, 0.32);
    this.noiseBurst(0, 0.22, 520, 0.16, 0.5);
    // A cartoon "bloop" rising out of the burst.
    const bloop = ctx.createOscillator(),
      gain = ctx.createGain();
    bloop.type = "sine";
    bloop.frequency.setValueAtTime(180, time + 0.05);
    bloop.frequency.exponentialRampToValueAtTime(560, time + 0.24);
    gain.gain.setValueAtTime(0.0001, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.09, time + 0.09);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
    bloop.connect(gain).connect(ctx.destination);
    bloop.start(time + 0.05);
    bloop.stop(time + 0.32);
    bloop.onended = () => {
      bloop.disconnect();
      gain.disconnect();
    };
  }
  printer() {
    if (!this.enabled || !this.context) return;
    // A little thermal-printer chatter: quick ticks while the sheet feeds.
    for (let i = 0; i < 7; i++)
      this.noiseBurst(i * 0.16, 0.05, 2100 - i * 90, 0.028, 2);
    this.thump(96, 62, 0.035, 0.9);
  }
  slimeSquelch() {
    if (!this.enabled || !this.context) return;
    const ctx = this.context,
      time = ctx.currentTime,
      rand = random(Math.round(time * 977));
    this.noiseBurst(0, 0.12, 420 + rand() * 380, 0.09, 0.5);
    this.thump(200 + rand() * 90, 60, 0.07, 0.12);
  }
  /** Looping ambience (field wind, machine hum). Levels are eased targets, so the
   *  caller can feed them every frame; muting simply drives the target to zero. */
  setLoopLevel(nodes, level) {
    if (!nodes) return;
    level = this.enabled ? level : 0;
    if (Math.abs(level - nodes.level) < 0.0005) return;
    nodes.level = level;
    nodes.gain.gain.setTargetAtTime(level, this.context.currentTime, 0.14);
  }
  startWind() {
    if (!this.context || this.windNodes) return;
    const ctx = this.context,
      buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate),
      data = buffer.getChannelData(0),
      rand = random(90210);
    for (let i = 0; i < data.length; i++) data[i] = rand() * 2 - 1;
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      lfo = ctx.createOscillator(),
      lfoGain = ctx.createGain(),
      gain = ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = "lowpass";
    filter.frequency.value = 380;
    filter.Q.value = 0.35;
    lfo.frequency.value = 0.16;
    lfoGain.gain.value = 130;
    lfo.connect(lfoGain).connect(filter.frequency);
    gain.gain.value = 0;
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
    lfo.start();
    this.windNodes = { source, filter, lfo, lfoGain, gain, level: 0 };
  }
  setWind(level) {
    this.setLoopLevel(this.windNodes, level);
  }
  stopWind() {
    this.stopLoop("windNodes");
  }
  startHum() {
    if (!this.context || this.humNodes) return;
    const ctx = this.context,
      saw = ctx.createOscillator(),
      sine = ctx.createOscillator(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    saw.type = "sawtooth";
    saw.frequency.value = 60;
    sine.type = "sine";
    sine.frequency.value = 120;
    filter.type = "lowpass";
    filter.frequency.value = 300;
    gain.gain.value = 0;
    saw.connect(filter);
    sine.connect(filter);
    filter.connect(gain).connect(ctx.destination);
    saw.start();
    sine.start();
    this.humNodes = { source: saw, extra: sine, filter, gain, level: 0 };
  }
  setHum(level) {
    this.setLoopLevel(this.humNodes, level);
  }
  stopHum() {
    this.stopLoop("humNodes");
  }
  stopLoop(key) {
    const nodes = this[key];
    if (!nodes) return;
    this[key] = null;
    const ctx = this.context,
      time = ctx.currentTime;
    nodes.gain.gain.cancelScheduledValues(time);
    nodes.gain.gain.setTargetAtTime(0, time, 0.1);
    const stopAt = time + 0.5;
    nodes.source.stop(stopAt);
    nodes.extra?.stop(stopAt);
    nodes.lfo?.stop(stopAt);
    nodes.source.onended = () =>
      Object.values(nodes).forEach((node) => node?.disconnect?.());
  }
  dispose() {
    this.stopWind();
    this.stopHum();
    this.context?.close();
  }
}
