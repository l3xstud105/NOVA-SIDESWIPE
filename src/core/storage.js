// storage.js — persistent local storage with namespacing + safe fallbacks
const PREFIX = "nova.swipe.";
const mem = {}; // fallback when localStorage unavailable

function backend() {
  try {
    if (typeof localStorage !== "undefined") {
      const k = PREFIX + "__probe";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return localStorage;
    }
  } catch (e) {}
  return null;
}

export function load(key, fallback) {
  const full = PREFIX + key;
  try {
    const b = backend();
    const raw = b ? b.getItem(full) : mem[full];
    if (raw == null) return structuredCloneSafe(fallback);
    return JSON.parse(raw);
  } catch (e) {
    return structuredCloneSafe(fallback);
  }
}

export function save(key, value) {
  const full = PREFIX + key;
  const raw = JSON.stringify(value);
  try {
    const b = backend();
    if (b) b.setItem(full, raw);
    else mem[full] = raw;
  } catch (e) {
    mem[full] = raw;
  }
}

export function remove(key) {
  const full = PREFIX + key;
  try {
    const b = backend();
    if (b) b.removeItem(full);
    else delete mem[full];
  } catch (e) {}
}

function structuredCloneSafe(o) {
  try { return structuredClone(o); } catch (e) { return JSON.parse(JSON.stringify(o)); }
}

// Convenience: load-or-init a section.
export function loadOr(key, init) {
  const existing = load(key, null);
  if (existing == null) {
    const fresh = typeof init === "function" ? init() : init;
    save(key, fresh);
    return fresh;
  }
  return existing;
}
