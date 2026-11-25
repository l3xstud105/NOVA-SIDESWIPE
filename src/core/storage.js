// storage.js — persistent local storage with namespacing, atomic writes,
// quota handling, and backup/portability. Falls back to in-memory storage
// when localStorage is unavailable (private mode, sandboxed iframes, etc.).

const PREFIX = "nova.swipe.";
const mem = {}; // fallback when localStorage unavailable
const lastGood = {}; // last confirmed-good value per key (atomic write backup)

// health stats surfaced to the UI so players can see save status
const stats = { writes: 0, fallbacks: 0, quota: 0, corrupted: 0, lastWriteMs: 0 };
export function getStats() { return { ...stats }; }

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

// is the storage backend available right now?
export function storageAvailable() {
  try { return backend() !== null; } catch (e) { return false; }
}

function structuredCloneSafe(o) {
  try { return structuredClone(o); } catch (e) { return JSON.parse(JSON.stringify(o)); }
}

export function load(key, fallback) {
  const full = PREFIX + key;
  try {
    const b = backend();
    const raw = b ? b.getItem(full) : mem[full];
    if (raw == null) return structuredCloneSafe(fallback);
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (e) {
    stats.corrupted++;
    // corrupted value: keep the last good copy if we have it, else fallback
    if (lastGood[key] != null) return structuredCloneSafe(lastGood[key]);
    return structuredCloneSafe(fallback);
  }
}

// Atomic write: write to a temp key, verify it round-trips, then commit to
// the real key. If verification fails or quota is exceeded, the original
// value is preserved (in backend or lastGood) and a fallback is used.
export function save(key, value) {
  const full = PREFIX + key;
  const tmp = PREFIX + key + ".tmp";
  const raw = JSON.stringify(value);
  const b = backend();
  stats.writes++;

  if (!b) {
    // no persistent backend — keep in memory only
    mem[full] = raw;
    lastGood[key] = structuredCloneSafe(value);
    stats.fallbacks++;
    return false;
  }

  try {
    // stage to temp
    b.setItem(tmp, raw);
    // verify the staged value reads back correctly
    const roundtrip = b.getItem(tmp);
    if (roundtrip !== raw) throw new Error("round-trip verification failed");
    // commit
    b.setItem(full, raw);
    // confirm commit landed (read back)
    const committed = b.getItem(full);
    if (committed !== raw) throw new Error("commit verification failed");
    // cleanup temp
    try { b.removeItem(tmp); } catch (e) {}
    lastGood[key] = structuredCloneSafe(value);
    stats.lastWriteMs = Date.now();
    return true;
  } catch (e) {
    // quota or other failure: keep last known-good value, fall back to memory
    stats.quota++;
    if (lastGood[key] != null) {
      // keep backend intact — do not overwrite with a possibly-partial write
      return false;
    }
    mem[full] = raw;
    stats.fallbacks++;
    return false;
  }
}

export function remove(key) {
  const full = PREFIX + key;
  try {
    const b = backend();
    if (b) b.removeItem(full);
    else delete mem[full];
  } catch (e) {}
  delete lastGood[key];
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

// ---- Backup / portability (account progression export) --------------------
// Exports every nova-prefixed key as a versioned JSON blob. Players can
// back up their progression or move it to another device/browser.
export function exportAll() {
  const b = backend();
  const payload = { _nova: "v1", exportedAt: Date.now(), keys: {} };
  if (b) {
    for (let i = 0; i < b.length; i++) {
      const k = b.key(i);
      if (k && k.startsWith(PREFIX) && !k.endsWith(".tmp")) {
        payload.keys[k.slice(PREFIX.length)] = b.getItem(k);
      }
    }
  } else {
    for (const k in mem) {
      if (k.startsWith(PREFIX)) payload.keys[k.slice(PREFIX.length)] = mem[k];
    }
  }
  return JSON.stringify(payload);
}

// Import a blob produced by exportAll(). Merges keys (existing keys are
// overwritten by the backup). Returns count of imported keys or throws.
export function importAll(jsonString) {
  const payload = JSON.parse(jsonString);
  if (!payload || payload._nova !== "v1" || !payload.keys) {
    throw new Error("Invalid backup file");
  }
  const b = backend();
  let count = 0;
  for (const k of Object.keys(payload.keys)) {
    const full = PREFIX + k;
    const raw = payload.keys[k];
    try {
      if (b) b.setItem(full, raw);
      else mem[full] = raw;
      count++;
    } catch (e) {
      // stop at first failure but keep what we managed to write
      break;
    }
  }
  return count;
}

// Wipe all nova-prefixed keys (hard reset).
export function clearAll() {
  const b = backend();
  try {
    if (b) {
      for (let i = b.length - 1; i >= 0; i--) {
        const k = b.key(i);
        if (k && k.startsWith(PREFIX)) b.removeItem(k);
      }
    } else {
      for (const k in mem) if (k.startsWith(PREFIX)) delete mem[k];
    }
  } catch (e) {}
  for (const k in lastGood) delete lastGood[k];
}
