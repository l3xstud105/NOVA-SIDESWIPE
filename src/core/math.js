// math.js — shared math helpers (no dependencies)
export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
export const deg = (r) => (r * 180) / Math.PI;
export const rad = (d) => (d * Math.PI) / 180;

// shortest angular difference b-a in range [-PI, PI]
export function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export function angLerp(a, b, t) {
  return a + angDiff(a, b) * t;
}
export function approach(value, target, maxDelta) {
  if (value < target) return Math.min(value + maxDelta, target);
  if (value > target) return Math.max(value - maxDelta, target);
  return value;
}

// 2D vector helpers (plain {x,y} objects)
export const v = (x = 0, y = 0) => ({ x, y });
export const vadd = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const vsub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const vscale = (a, s) => ({ x: a.x * s, y: a.y * s });
export const vlen = (a) => Math.hypot(a.x, a.y);
export const vdot = (a, b) => a.x * b.x + a.y * b.y;
export const vnorm = (a) => {
  const l = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / l, y: a.y / l };
};
export const vrot = (a, ang) => {
  const c = Math.cos(ang), s = Math.sin(ang);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
};

// simple seedable PRNG (mulberry32) for reproducible tests
export function makeRng(seed = 1) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randRange = (rng, lo, hi) => lo + (hi - lo) * rng();
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
