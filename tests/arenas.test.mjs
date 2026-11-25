// arenas.test.mjs — verify per-arena effects config + ambient particle system.
// Run: node tests/arenas.test.mjs   (no browser)
import { ARENAS, getArena } from "../src/data/arenas.js";
import { World } from "../src/game/world.js";
import { Ball } from "../src/game/ball.js";
import { Vehicle } from "../src/game/vehicle.js";
import { VEHICLES } from "../src/data/vehicles.js";
import { Match } from "../src/game/match.js";

let passed = 0, failed = 0;
function check(name, cond, extra = "") {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failed++; console.log("  ✗ " + name + (extra ? "  -> " + extra : "")); }
}

console.log("NOVA SIDESWIPE — arenas & effects tests\n");

// 1. every arena has a valid effects config via getArena
const validTypes = ["rain", "snow", "sparks", "embers", "leaves", "motes", "confetti", "petals", "none"];
for (const a of ARENAS) {
  const got = getArena(a.id);
  check("arena '" + a.id + "' has effects config", got.effects && typeof got.effects.type === "string", "type=" + (got.effects && got.effects.type));
  check("arena '" + a.id + "' effects type valid", validTypes.includes(got.effects.type), "type=" + got.effects.type);
  check("arena '" + a.id + "' effects has color", typeof got.effects.color === "string" && got.effects.color.startsWith("#"));
}

// 2. all 8 arenas present
check("8 arenas defined", ARENAS.length === 8, "n=" + ARENAS.length);
check("getArena unknown falls back to neon", getArena("nope").id === "neon");

// 3. effects are distinct across arenas (not all the same)
const types = ARENAS.map((a) => getArena(a.id).effects.type);
const unique = new Set(types);
check("arenas have varied effects", unique.size >= 4, "unique=" + unique.size);

// 4. World ambient system seeds particles for an effect arena
{
  const A = getArena("lava");
  const ball = new Ball(A);
  const v = new Vehicle({ id: "t", team: "blue", isPlayer: true, name: "T", vehicleDef: VEHICLES[0], cosmetics: {}, x: A.W / 2, y: 400 });
  const m = new Match({ mode: "free", arena: A, ball, vehicles: [v] });
  const w = new World({ mode: "free", arenaId: "lava", players: [{ team: "blue", isPlayer: true, name: "T", def: VEHICLES[0], cosmetics: {}, control: "p1" }], input: { get: () => ({}) }, sfx: null, record: false, quality: { particles: 1, shadows: true, lighting: true, postFX: true } });
  w.match = m;
  check("lava arena seeds ambient particles", w.ambient.length > 0, "n=" + w.ambient.length);
  check("lava ambient particles have ember color", w.ambient[0] && w.ambient[0].color === "#ff9a3c", "color=" + (w.ambient[0] && w.ambient[0].color));
}

// 5. ambient updates and recycles off-screen particles
{
  const A = getArena("neon");
  const ball = new Ball(A);
  const v = new Vehicle({ id: "t", team: "blue", isPlayer: true, name: "T", vehicleDef: VEHICLES[0], cosmetics: {}, x: A.W / 2, y: 400 });
  const m = new Match({ mode: "free", arena: A, ball, vehicles: [v] });
  const w = new World({ mode: "free", arenaId: "neon", players: [{ team: "blue", isPlayer: true, name: "T", def: VEHICLES[0], cosmetics: {}, control: "p1" }], input: { get: () => ({}) }, sfx: null, record: false, quality: { particles: 1, shadows: true, lighting: true, postFX: true } });
  w.match = m;
  const start = w.ambient.length;
  for (let i = 0; i < 60; i++) w._updateAmbient(1 / 60);
  check("ambient update keeps particle count bounded", w.ambient.length > 0 && w.ambient.length <= 120, "start=" + start + " now=" + w.ambient.length);
}

// 6. quality particles multiplier affects ambient cap
{
  const A = getArena("neon");
  const ball = new Ball(A);
  const v = new Vehicle({ id: "t", team: "blue", isPlayer: true, name: "T", vehicleDef: VEHICLES[0], cosmetics: {}, x: A.W / 2, y: 400 });
  const m = new Match({ mode: "free", arena: A, ball, vehicles: [v] });
  const wPotato = new World({ mode: "free", arenaId: "neon", players: [{ team: "blue", isPlayer: true, name: "T", def: VEHICLES[0], cosmetics: {}, control: "p1" }], input: { get: () => ({}) }, sfx: null, record: false, quality: { particles: 0.3, shadows: false, lighting: false, postFX: false } });
  wPotato.match = m;
  const wHigh = new World({ mode: "free", arenaId: "neon", players: [{ team: "blue", isPlayer: true, name: "T", def: VEHICLES[0], cosmetics: {}, control: "p1" }], input: { get: () => ({}) }, sfx: null, record: false, quality: { particles: 1.3, shadows: true, lighting: true, postFX: true } });
  wHigh.match = m;
  check("potato quality seeds fewer ambient particles", wPotato.ambient.length < wHigh.ambient.length, "potato=" + wPotato.ambient.length + " high=" + wHigh.ambient.length);
}

// 7. an arena with no effects (none) seeds no ambient
{
  const A = { ...getArena("neon"), effects: { type: "none", density: 0, color: "#fff" } };
  const ball = new Ball(A);
  const v = new Vehicle({ id: "t", team: "blue", isPlayer: true, name: "T", vehicleDef: VEHICLES[0], cosmetics: {}, x: A.W / 2, y: 400 });
  const m = new Match({ mode: "free", arena: A, ball, vehicles: [v] });
  const w = new World({ mode: "free", arenaId: "neon", players: [{ team: "blue", isPlayer: true, name: "T", def: VEHICLES[0], cosmetics: {}, control: "p1" }], input: { get: () => ({}) }, sfx: null, record: false, quality: { particles: 1, shadows: true, lighting: true, postFX: true } });
  // force the none-effects arena
  w.arena = A;
  w.match = m;
  w._seedAmbient();
  check("none-effect arena seeds no ambient", w.ambient.length === 0, "n=" + w.ambient.length);
}

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
