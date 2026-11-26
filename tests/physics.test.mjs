// physics.test.mjs — reproducible physics & rules tests (run: node tests/physics.test.mjs)
// No browser required. Pure simulation on the same modules the game uses.
import { Vehicle } from "../src/game/vehicle.js";
import { Ball } from "../src/game/ball.js";
import { Match } from "../src/game/match.js";
import { getArena } from "../src/data/arenas.js";
import { VEHICLES } from "../src/data/vehicles.js";
import { PHYS } from "../src/game/config.js";

let passed = 0, failed = 0;
function check(name, cond, extra = "") {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failed++; console.log("  ✗ " + name + (extra ? "  -> " + extra : "")); }
}
const approx = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

function sim(vehicle, ball, steps, dt = 1 / 60, envOverride) {
  const env = { gravity: 2000, arena: getArena("neon"), ...envOverride };
  for (let i = 0; i < steps; i++) {
    vehicle.controlPhase(dt, { throttle: 0, jump: false, jumpPressed: false, boost: false, resetPressed: false, pausePressed: false, dodgeDir: 0 }, env);
    ball.update(dt, env, null);
    vehicle.collideBall(ball, env);
  }
}

console.log("NOVA SIDESWIPE — physics & rules tests\n");

// 1. Gravity + ground rest
{
  const A = getArena("neon");
  const v = new Vehicle({ id: "t", team: "blue", isPlayer: true, name: "T", vehicleDef: VEHICLES[0], cosmetics: {}, x: A.W / 2, y: 400 });
  const ball = new Ball(A); ball.x = 60; // keep ball away so it doesn't interact
  const extY = v.hh + v.hw * Math.abs(Math.sin(v.angle)); // angle 0 -> hh
  sim(v, ball, 240);
  check("vehicle falls under gravity and rests on floor", approx(v.y, v.hh, 2), `y=${v.y.toFixed(2)} expected~${v.hh}`);
  check("vehicle is grounded after settling", v.onGround === true);
  check("vehicle vertical velocity damped to ~0 on ground", Math.abs(v.vy) < 5, `vy=${v.vy.toFixed(2)}`);
}

// 2. Jump leaves the ground
{
  const A = getArena("neon");
  const v = new Vehicle({ id: "t", team: "blue", isPlayer: true, name: "T", vehicleDef: VEHICLES[0], cosmetics: {}, x: A.W / 2, y: v_hh(A) });
  const ball = new Ball(A); ball.x = 60;
  sim(v, ball, 240);
  const intent = { throttle: 0, jump: false, jumpPressed: true, boost: false, resetPressed: false, pausePressed: false, dodgeDir: 0 };
  v.controlPhase(1 / 60, intent, { gravity: 2000, arena: A });
  check("jump applies upward velocity", v.vy > 500, `vy=${v.vy.toFixed(1)}`);
  check("jump clears ground", v.onGround === false);
}

// 3. Ball bounces off floor with restitution (check immediately after first contact)
{
  const A = getArena("neon");
  const ball = new Ball(A);
  ball.x = A.W / 2; ball.y = ball.r + 2; ball.vy = -800; ball.vx = 0;
  const b4 = ball.vy;
  ball.update(1 / 60, { gravity: 2000, arena: A }, null); // first contact with floor
  check("ball reverses vertical velocity on floor bounce", ball.vy > 0 && b4 < 0, `b4=${b4} after=${ball.vy.toFixed(1)}`);
  // gravity is applied before floor resolution in the same step, so the incoming speed is b4 - g*dt
  const incoming = Math.abs(b4) + 2000 / 60;
  const expected = incoming * PHYS.RESTITUTION_GROUND;
  check("ball bounce retains energy (restitution)", Math.abs(ball.vy - expected) < 5, `after=${ball.vy.toFixed(1)} expected~${expected.toFixed(1)}`);
}

// 4. Standard goal detection
{
  const A = getArena("neon");
  const ball = new Ball(A);
  const vehicles = [new Vehicle({ id: "b", team: "blue", vehicleDef: VEHICLES[0], cosmetics: {}, x: 100, y: 100 }),
                    new Vehicle({ id: "o", team: "orange", vehicleDef: VEHICLES[0], cosmetics: {}, x: 100, y: 100 })];
  const m = new Match({ mode: "1v1", arena: A, ball, vehicles });
  // ball in right goal (blue scores)
  ball.x = A.W - A.goalDepth * 0.5; ball.y = A.goalHeight * 0.5;
  m._standardGoal(null);
  check("ball in right goal scores for blue", m.score.blue === 1, `blue=${m.score.blue}`);
  // reset and ball in left goal (orange scores)
  m.score.blue = 0; ball.x = A.goalDepth * 0.5; ball.y = A.goalHeight * 0.5;
  m._standardGoal(null);
  check("ball in left goal scores for orange", m.score.orange === 1, `orange=${m.score.orange}`);
}

// 5. Flip reset: touching ball from below while airborne re-enables flip + grants boost
{
  const A = getArena("neon");
  const v = new Vehicle({ id: "t", team: "blue", isPlayer: true, name: "T", vehicleDef: VEHICLES[0], cosmetics: {}, x: A.W / 2, y: 300 });
  v.onGround = false; v.canFlip = false; v.boost = 50; v.airTime = 0.5;
  const ball = new Ball(A);
  ball.x = v.x; ball.y = v.y + v.hh + ball.r - 2; ball.vy = 0; // ball above car
  const before = v.boost;
  v.collideBall(ball, { gravity: 2000, arena: A });
  check("flip reset re-enables canFlip", v.canFlip === true);
  check("flip reset grants boost", v.boost > before, `before=${before} after=${v.boost.toFixed(1)}`);
  check("flip reset flagged for achievement", v.flipResetReady === true);
}

// 6. Determinism: same inputs => same final state
{
  const A = getArena("neon");
  function run() {
    const v = new Vehicle({ id: "t", team: "blue", isPlayer: true, name: "T", vehicleDef: VEHICLES[0], cosmetics: {}, x: A.W / 2, y: 400 });
    const ball = new Ball(A);
    const intent = { throttle: 1, jump: false, jumpPressed: false, boost: false, resetPressed: false, pausePressed: false, dodgeDir: 0 };
    const env = { gravity: 2000, arena: A };
    for (let i = 0; i < 120; i++) {
      v.controlPhase(1 / 60, i === 30 ? { ...intent, jumpPressed: true } : intent, env);
      ball.update(1 / 60, env, null);
      v.collideBall(ball, env);
    }
    return { x: v.x, y: v.y, bx: ball.x, by: ball.y };
  }
  const a = run(), b = run();
  check("simulation is deterministic", approx(a.x, b.x) && approx(a.y, b.y) && approx(a.bx, b.bx) && approx(a.by, b.by),
    `a=(${a.x.toFixed(3)},${a.y.toFixed(3)}) b=(${b.x.toFixed(3)},${b.y.toFixed(3)})`);
}

// 7. Boost drains and regenerates
{
  const A = getArena("neon");
  const v = new Vehicle({ id: "t", team: "blue", isPlayer: true, name: "T", vehicleDef: VEHICLES[0], cosmetics: {}, x: A.W / 2, y: 400 });
  const ball = new Ball(A); ball.x = 60;
  sim(v, ball, 240); // settle
  v.boost = 100;
  const env = { gravity: 2000, arena: A };
  const boostIntent = { throttle: 0, jump: false, jumpPressed: false, boost: true, resetPressed: false, pausePressed: false, dodgeDir: 0 };
  const start = v.boost;
  for (let i = 0; i < 60; i++) v.controlPhase(1 / 60, boostIntent, env);
  check("boost drains while held", v.boost < start, `start=${start} now=${v.boost.toFixed(1)}`);
  const after = v.boost;
  const idle = { throttle: 0, jump: false, jumpPressed: false, boost: false, resetPressed: false, pausePressed: false, dodgeDir: 0 };
  for (let i = 0; i < 60; i++) v.controlPhase(1 / 60, idle, env);
  check("boost regenerates when idle", v.boost > after, `after=${after.toFixed(1)} now=${v.boost.toFixed(1)}`);
}

// 12. landing animation-cancel: flip restored on ground, EXCEPT when holding
// a directional input away from the landing surface (reference behavior)
{
  const A = getArena("neon");
  // Case A: land with no input → flip restored
  const va = new Vehicle({ id: "a", team: "blue", isPlayer: true, name: "A", vehicleDef: VEHICLES[0], cosmetics: {}, x: A.W / 2, y: 300 });
  va.canFlip = false; va.flipping = true; va.flipTimer = 0.4;
  va.vy = 600; // descending
  const idle = { throttle: 0, jump: false, jumpPressed: false, boost: false, resetPressed: false, pausePressed: false, dodgeDir: 0 };
  let landedA = false;
  for (let i = 0; i < 120 && !landedA; i++) { va.controlPhase(1 / 60, idle, { gravity: 2000, arena: A }); if (va.onGround) landedA = true; }
  check("vehicle lands (case A)", landedA);
  // flip restore applies on the ground frame after landing
  for (let i = 0; i < 3; i++) va.controlPhase(1 / 60, idle, { gravity: 2000, arena: A });
  check("landing with no input restores flip (animation cancel)", va.canFlip === true, "canFlip=" + va.canFlip);

  // Case B: land while holding a directional input → flip NOT restored
  const vb = new Vehicle({ id: "b", team: "blue", isPlayer: true, name: "B", vehicleDef: VEHICLES[0], cosmetics: {}, x: A.W / 2, y: 300 });
  vb.canFlip = false; vb.flipping = true; vb.flipTimer = 0.4;
  vb.vy = 600; // descending
  const held = { throttle: 1, jump: false, jumpPressed: false, boost: false, resetPressed: false, pausePressed: false, dodgeDir: 0 };
  let landedB = false;
  for (let i = 0; i < 120 && !landedB; i++) { vb.controlPhase(1 / 60, held, { gravity: 2000, arena: A }); if (vb.onGround) landedB = true; }
  check("vehicle lands (case B)", landedB);
  // holding input keeps the flip preserved across subsequent ground frames
  for (let i = 0; i < 3; i++) vb.controlPhase(1 / 60, held, { gravity: 2000, arena: A });
  check("landing while holding input preserves flip (exception)", vb.canFlip === false, "canFlip=" + vb.canFlip);
  // releasing input on the ground then restores the flip
  for (let i = 0; i < 3; i++) vb.controlPhase(1 / 60, idle, { gravity: 2000, arena: A });
  check("releasing input on ground restores flip", vb.canFlip === true, "canFlip=" + vb.canFlip);
}

// 13. wall driving: the car sticks to and drives along a vertical wall
// (reference: "you can also drive up and down walls")
{
  const A = getArena("neon");
  const v = new Vehicle({ id: "w", team: "blue", isPlayer: true, name: "W", vehicleDef: VEHICLES[0], cosmetics: {}, x: 48, y: 300 });
  const ball = new Ball(A); ball.x = A.W - 10; ball.y = 5;
  const env = { gravity: 2000, arena: A };
  const drive = { throttle: -1, jump: false, jumpPressed: false, boost: false, resetPressed: false, pausePressed: false, dodgeDir: 0 };
  let contactFrames = 0;
  for (let i = 0; i < 120; i++) {
    v.controlPhase(1 / 60, drive, env);
    ball.update(1 / 60, env, null);
    v.collideBall(ball, env);
    // on the left wall => surface normal points +x (into the arena)
    if (v.groundNormal.x > 0.7) contactFrames++;
  }
  check("car drives along the wall staying in contact", contactFrames >= 90, "contactFrames=" + contactFrames);
  check("car does not detach from the wall (x clamped)", v.x < 60, "x=" + v.x.toFixed(1));
  check("car moves along the wall surface (y changes)", Math.abs(v.y - 300) > 20, "y=" + v.y.toFixed(1));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

function v_hh(A) { return VEHICLES[0].shape.height / 2 + 4; }
