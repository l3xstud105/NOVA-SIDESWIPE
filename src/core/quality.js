// quality.js — graphics quality presets (Potato → Cinematic) + adaptive resolution
// Pure logic (no DOM) so it can be unit-tested.

// Presets: ordered from lightest to heaviest.
// scale: backing-resolution multiplier applied on top of devicePixelRatio
// particles: particle-count multiplier
// shadows: ground/airborne vehicle shadows on/off
// lighting: per-arena dynamic lighting + vignette on/off
// postFX: screen-space glow / bloom pass on/off
export const QUALITY_PRESETS = {
  potato:  { label: "Potato",  scale: 0.55, particles: 0.3, shadows: false, lighting: false, postFX: false, targetFps: 30 },
  low:     { label: "Low",     scale: 0.7,  particles: 0.5, shadows: true,  lighting: false, postFX: false, targetFps: 40 },
  medium:  { label: "Medium",  scale: 0.9,  particles: 0.8, shadows: true,  lighting: true,  postFX: false, targetFps: 60 },
  high:    { label: "High",    scale: 1.0,  particles: 1.0, shadows: true,  lighting: true,  postFX: true,  targetFps: 60 },
  cinematic: { label: "Cinematic", scale: 1.25, particles: 1.3, shadows: true, lighting: true,  postFX: true,  targetFps: 60 },
};

export const QUALITY_ORDER = ["potato", "low", "medium", "high", "cinematic"];
export const DEFAULT_QUALITY = "high";

// resolve a setting name into a full preset; unknown → default
export function resolveQuality(name) {
  return QUALITY_PRESETS[name] || QUALITY_PRESETS[DEFAULT_QUALITY];
}

// effective backing-resolution scale for a preset at a given devicePixelRatio.
// Caps the backing store so Cinematic never exceeds ~2.0x native on 4K screens.
export function backingScale(presetName, devicePixelRatio) {
  const p = resolveQuality(presetName);
  const dpr = devicePixelRatio || 1;
  return Math.max(0.5, Math.min(2.0, dpr * p.scale));
}

// adaptive resolution controller: watches frame times and adjusts a render scale
// multiplier between a floor (potato-level) and the preset's full scale.
// Returns the multiplier to apply on top of the base backing scale.
export class AdaptiveResolution {
  constructor(opts = {}) {
    this.base = opts.base || 1;          // preset scale multiplier
    this.floor = opts.floor || 0.55;     // never render below this fraction
    this.targetFps = opts.targetFps || 60;
    this.scale = 1;                      // current multiplier
    this.samples = [];                    // recent frame times (ms)
    this.sampleSize = 60;
    this.cooldown = 0;                   // avoid oscillating every frame
    this.enabled = opts.enabled !== false;
  }

  push(frameTimeMs) {
    if (!this.enabled) return;
    this.samples.push(frameTimeMs);
    if (this.samples.length > this.sampleSize) this.samples.shift();
    if (this.cooldown > 0) { this.cooldown--; return; }
    if (this.samples.length < this.sampleSize / 2) return;
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    const budget = 1000 / this.targetFps;
    // if we're running slower than budget, ease scale down; if comfortably fast, ease up
    if (avg > budget * 1.25) {
      this.scale = Math.max(this.floor, this.scale - 0.05);
      this.cooldown = 12;
    } else if (avg < budget * 0.7 && this.scale < 1) {
      this.scale = Math.min(1, this.scale + 0.05);
      this.cooldown = 30;
    }
  }

  // final multiplier to apply to the base backing scale
  multiplier() {
    if (!this.enabled) return 1;
    return this.scale;
  }

  reset() { this.scale = 1; this.samples = []; this.cooldown = 0; }
}

// pick a sensible default preset from a rough device capability signal
// (used for the "Auto" mode). Heuristic, conservative.
export function autoQuality(devicePixelRatio, coresHint) {
  const dpr = devicePixelRatio || 1;
  const cores = coresHint || 4;
  if (dpr >= 2.5 && cores >= 8) return "cinematic";
  if (dpr >= 2 && cores >= 6) return "high";
  if (dpr >= 1.5 && cores >= 4) return "medium";
  if (cores >= 2) return "low";
  return "potato";
}

// ---- PowerManager -------------------------------------------------------------
// Browser performance that respects real device constraints — especially
// Chromebooks and other low-power / battery devices. Tracks battery level,
// charging state, thermal pressure and tab visibility, and exposes a single
// `throttle()` multiplier plus flags that the renderer uses to cut load.
// Pure logic (no DOM at import); call update() with live signals.
export class PowerManager {
  constructor(opts = {}) {
    this.batteryLevel = opts.batteryLevel != null ? opts.batteryLevel : 1; // 0..1
    this.charging = !!opts.charging;
    this.thermal = opts.thermal || "nominal"; // "nominal" | "medium" | "critical"
    this.visible = opts.visible !== false;
    this.autoEnabled = opts.autoEnabled !== false;
    this.manualParticles = null; // user override multiplier (1..), else null
    this._dirty = true;
  }

  // snapshot from the Battery API shape (battery.level, battery.charging)
  update(signal = {}) {
    if (signal.level != null) this.batteryLevel = Math.max(0, Math.min(1, signal.level));
    if (signal.charging != null) this.charging = !!signal.charging;
    if (signal.thermal) this.thermal = signal.thermal;
    if (signal.visible != null) this.visible = !!signal.visible;
    this._dirty = true;
  }

  // are we under power pressure that should reduce load?
  shouldThrottle() {
    if (!this.autoEnabled) return false;
    if (!this.visible) return true; // hidden tab: never burn cycles
    if (this.thermal === "critical") return true;
    if (this.thermal === "medium") return true;
    if (!this.charging && this.batteryLevel < 0.3) return true; // low battery, unplugged
    return false;
  }

  // render-load multiplier (0..1). Stronger pressure → lower.
  throttle() {
    if (!this.shouldThrottle()) return 1;
    let m = 0.55;
    if (this.thermal === "critical") m = 0.35;
    if (!this.charging && this.batteryLevel < 0.2) m = 0.3;
    if (!this.visible) m = 0.0; // hidden: render nothing
    return m;
  }

  // effective particle multiplier: base preset * throttle, unless overridden
  particleMul() {
    if (this.manualParticles != null) return this.manualParticles;
    return this.throttle();
  }

  reset() { this._dirty = true; }
}
