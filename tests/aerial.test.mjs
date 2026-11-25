// aerial.test.mjs — verify enhanced aerial controls: flip rotation, auto-level,
// boost-steer, and ground handling.
// Run: node tests/aerial.test.mjs   (no browser)
import { Vehicle } from "../src/game/vehicle.js";
import { Ball } from "../src/game/ball.js";
import { getArena } from "../src/data/arenas.js";
import { VEHICLES } from "../src/data/vehicles.js";
import { PHYS } from "../src/game/config.js";

let passed = 0, failed = 0;
function check(name, cond, extra = "") {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failed++; console.log("  ✗ " + name + (extra ? "  -> " + extra : "")); }
}

const A = getArena("neon");
const env = { gravity: 2000, arena: A };
const NEUTRAL = { throttle: 0, jump: false, jumpPressed: false, boost: false, resetPressed: false, pausePressed: false, dodgeDir: 0 };

function airborneCar(angle = 0) {
  const v = new Vehicle({ id: "t", team: "blue", isPlayer: true, name: "T", vehicleDef: VEHICLES[0], cosmetics: {}, x: A.W / 2, y: 500 });
  v.onGround = false; v.airTime = 0.5; v.angle = angle; v.angVel = 0; v.vx = 200; v.vy = 0;
  return v;
}

console.log("NOVA SIDESWIPE — aerial control tests\n");

// 1. Air throttle rotates the car (flip)
{
  const v = airborneCar(0);
  const intent = { ...NEUTRAL, throttle: 1 };
  for (let i = 0; i < 30; i++) v.controlPhase(1 / 60, intent, env);
  check("air throttle rotates the car", Math.abs(v.angle) > 0.5, `angle=${v.angle.toFixed(2)}`);
  check("air rotation respects max angular velocity", Math.abs(v.angVel) <= PHYS.AIR_MAX_ANGVEL + 1, `angVel=${v.angVel.toFixed(2)}`);
}

// 2. Auto-level: no input in air eases the car back toward upright
{
  const v = airborneCar(Math.PI * 0.5); // 90deg tilted
  for (let i = 0; i < 60; i++) v.controlPhase(1 / 60, NEUTRAL, env);
  // auto-level should pull the angle back toward 0 (mod 2pi)
  const norm = ((v.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const distFromUp = Math.min(norm, Math.PI * 2 - norm);
  check("auto-level returns toward upright", distFromUp < Math.PI * 0.5, `angle=${v.angle.toFixed(2)} dist=${distFromUp.toFixed(2)}`);
}

// 3. Boost-steer: boosting in air gives stronger horizontal nudge
{
  const v1 = airborneCar(0);
  const v2 = airborneCar(0);
  const base = { ...NEUTRAL, throttle: 1 };
  const boosted = { ...NEUTRAL, throttle: 1, boost: true };
  for (let i = 0; i < 30; i++) v1.controlPhase(1 / 60, base, env);
  for (let i = 0; i < 30; i++) v2.controlPhase(1 / 60, boosted, env);
  check("boosting in air steers harder", v2.vx > v1.vx, `normal=${v1.vx.toFixed(1)} boost=${v2.vx.toFixed(1)}`);
}

// 4. Snappier flip: reaches higher peak angular velocity than a weak setting
{
  const v = airborneCar(0);
  const intent = { ...NEUTRAL, throttle: 1 };
  let peak = 0;
  for (let i = 0; i < 20; i++) { v.controlPhase(1 / 60, intent, env); peak = Math.max(peak, Math.abs(v.angVel)); }
  check("flips reach a strong angular velocity", peak > 8, `peak=${peak.toFixed(2)}`);
}

// 5. Ground handling: car aligns to ground normal when grounded
{
  const v = new Vehicle({ id: "t", team: "blue", isPlayer: true, name: "T", vehicleDef: VEHICLES[0], cosmetics: {}, x: A.W / 2, y: 400 });
  v.angle = Math.PI * 0.5; // tilted
  v.onGround = true;
  for (let i = 0; i < 60; i++) v.controlPhase(1 / 60, NEUTRAL, env);
  const norm = ((v.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const distFromUp = Math.min(norm, Math.PI * 2 - norm);
  check("grounded car aligns upright on flat floor", distFromUp < 0.2, `angle=${v.angle.toFixed(2)}`);
}

// 6. Air control does not fire while flipping (dodge lockout)
{
  const v = airborneCar(0);
  v.flipping = true;
  v.flipTimer = PHYS.FLIP_DURATION; // a real, active flip
  const before = v.angVel;
  v.controlPhase(1 / 60, { ...NEUTRAL, throttle: 1 }, env);
  check("air control locked during flip", Math.abs(v.angVel - before) < 1e-6, `before=${before} after=${v.angVel}`);
}

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
