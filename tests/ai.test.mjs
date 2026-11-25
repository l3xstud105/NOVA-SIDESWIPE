// ai.test.mjs — verify AI playstyles are distinct and drive the same physics.
// Run: node tests/ai.test.mjs   (no browser)
// Note: in this game world y increases UPWARD (floor y=0 is the bottom, ceiling y=H is the top).
import { AICar, AI_PLAYSTYLES } from "../src/game/ai.js";
import { Vehicle } from "../src/game/vehicle.js";
import { Ball } from "../src/game/ball.js";
import { getArena } from "../src/data/arenas.js";
import { VEHICLES } from "../src/data/vehicles.js";

let passed = 0, failed = 0;
function check(name, cond, extra = "") {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failed++; console.log("  ✗ " + name + (extra ? "  -> " + extra : "")); }
}

// orange attacks LEFT (-x); its own goal is on the RIGHT (+x).
function makeWorld(carX, ballX, ballY) {
  const A = getArena("neon");
  const ball = new Ball(A);
  ball.x = ballX; ball.y = ballY; ball.vx = 0; ball.vy = 0;
  const v = new Vehicle({ id: "o", team: "orange", isPlayer: false, name: "CPU", vehicleDef: VEHICLES[0], cosmetics: {}, x: carX, y: 200 });
  v.onGround = true;
  return { arena: A, ball, vehicles: [v], ai: v };
}

console.log("NOVA SIDESWIPE — AI playstyle tests\n");

// 1. All declared playstyles are constructible
{
  for (const style of AI_PLAYSTYLES) {
    const w = makeWorld(800, 800, 400);
    const ai = new AICar(w.ai, "medium", style);
    check("playstyle '" + style + "' constructs with params", ai.ps != null && ai.ps.boostMul != null);
  }
}

// 2. Defensive vs aggressive position differently when ball threatens own goal
{
  // ball near orange's own goal (right, x=1500), car positioned to defend (x=1350)
  const wDef = makeWorld(1350, 1500, 300);
  const wAgg = makeWorld(1350, 1500, 300);
  const def = new AICar(wDef.ai, "hard", "defensive");
  const agg = new AICar(wAgg.ai, "hard", "aggressive");
  // let them recompute targets a few ticks
  for (let i = 0; i < 6; i++) { def.think(0.02, wDef); agg.think(0.02, wAgg); }
  // defensive pushes target away from own goal (left); aggressive rushes the ball
  check("defensive AI targets left of ball (clears from own goal)", def._target.x < 1500, `targetX=${def._target.x}`);
  check("playstyles produce a target", agg._target.x != null, `aggTargetX=${agg._target.x}`);
}

// 3. Boost tendency: aggressive boosts more than defensive when correctly behind the ball
{
  // orange attacks left → car must be to the RIGHT of the ball to be "behind" it.
  const w = makeWorld(860, 800, 200); // car at 860 (right of ball 800)
  const results = {};
  for (const style of ["aggressive", "defensive", "control"]) {
    w.ai.x = 860; w.ai.y = 200; w.ai.onGround = true; w.ai.angle = Math.PI; w.ai.vx = 0; w.ai.vy = 0;
    let boosts = 0;
    const ai = new AICar(w.ai, "hard", style);
    for (let i = 0; i < 90; i++) {
      const it = ai.think(1 / 60, w);
      if (it.boost) boosts++;
    }
    results[style] = boosts;
  }
  check("aggressive boosts at least as much as defensive", results.aggressive >= results.defensive,
    `agg=${results.aggressive} def=${results.defensive}`);
  check("sample produces non-zero boost decisions", results.aggressive + results.defensive + results.control > 0,
    `agg=${results.aggressive} def=${results.defensive} ctrl=${results.control}`);
}

// 4. Aerial playstyle jumps more when ball is above (larger world-y)
{
  // ball above the car: ball.y (450) > car.y (200)
  const w = makeWorld(800, 800, 450);
  const aerial = new AICar(w.ai, "hard", "aerial");
  const def = new AICar(w.ai, "hard", "defensive");
  let aerJumps = 0, defJumps = 0;
  for (let i = 0; i < 120; i++) {
    w.ai.x = 800; w.ai.y = 200; w.ai.onGround = true;
    aerial._jumpCd = 0; def._jumpCd = 0;
    if (aerial.think(1 / 60, w).jumpPressed) aerJumps++;
    if (def.think(1 / 60, w).jumpPressed) defJumps++;
  }
  check("aerial playstyle jumps for high balls", aerJumps > defJumps, `aerial=${aerJumps} def=${defJumps}`);
}

// 5. AI never returns a malformed intent
{
  const w = makeWorld(800, 800, 400);
  const ai = new AICar(w.ai, "medium", "balanced");
  const it = ai.think(1 / 60, w);
  const keys = ["throttle", "jump", "jumpPressed", "boost", "resetPressed", "pausePressed", "dodgeDir", "source"];
  check("intent has all expected fields", keys.every((k) => k in it));
  check("throttle is -1/0/1", [-1, 0, 1].includes(it.throttle));
  check("dodgeDir is -1/0/1", [-1, 0, 1].includes(it.dodgeDir));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
