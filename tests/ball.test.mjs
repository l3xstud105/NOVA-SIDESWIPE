// ball.test.mjs — verify enhanced ball physics: Magnus curve, off-center spin,
// dribble carry, and rolling behavior.
// Run: node tests/ball.test.mjs   (no browser)
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

console.log("NOVA SIDESWIPE — enhanced ball physics tests\n");

// 1. Magnus effect: spinning ball curves sideways
{
  const ball = new Ball(A);
  ball.x = A.W / 2; ball.y = 400;
  ball.vx = 600; ball.vy = 0;   // moving right
  ball.spin = 600;              // strong spin
  const startX = ball.x;
  for (let i = 0; i < 30; i++) ball.update(1 / 60, env, null);
  // with positive spin and moving right, Magnus pushes perpendicular (up or down)
  check("Magnus effect deflects a spinning ball off its straight path", Math.abs(ball.y - 400) > 1, `dy=${(ball.y - 400).toFixed(2)}`);
  check("Magnus keeps forward progress", ball.x > startX, `x=${ball.x.toFixed(1)}`);
}

// 2. Non-spinning ball travels straight (no Magnus)
{
  const ball = new Ball(A);
  ball.x = A.W / 2; ball.y = 400;
  ball.vx = 600; ball.vy = 0; ball.spin = 0;
  const startY = ball.y;
  for (let i = 0; i < 30; i++) ball.update(1 / 60, env, null);
  // only gravity acts vertically; no lateral curve
  check("non-spinning ball has no lateral Magnus deflection", Math.abs((ball.y - startY) - (-0.5 * 2000 * (30 / 60) ** 2)) < 8,
    `dy=${(ball.y - startY).toFixed(2)}`);
}

// 3. Spin decays over time in the air
{
  const ball = new Ball(A);
  ball.x = A.W / 2; ball.y = 400;
  ball.vx = 600; ball.vy = 0; ball.spin = 1000;
  const start = ball.spin;
  for (let i = 0; i < 60; i++) ball.update(1 / 60, env, null);
  check("ball spin decays in the air", ball.spin < start, `start=${start} now=${ball.spin.toFixed(1)}`);
}

// 4. Off-center car hit imparts spin
{
  const v = new Vehicle({ id: "t", team: "blue", isPlayer: true, name: "T", vehicleDef: VEHICLES[0], cosmetics: {}, x: A.W / 2, y: 400 });
  v.onGround = true; v.vx = 1000; v.vy = 0; v.angle = 0;
  const ball = new Ball(A);
  // contact the top of the car: normal is perpendicular to the car's motion,
  // so the car's horizontal velocity has a tangential component -> spin imparted
  ball.x = v.x + v.hw * 0.4; ball.y = v.y - v.hh - ball.r + 4;
  ball.vx = 0; ball.vy = 0; ball.spin = 0;
  v.collideBall(ball, env);
  check("off-center car hit imparts ball spin", Math.abs(ball.spin) > 0, `spin=${ball.spin.toFixed(2)}`);
}

// 5. Centered hit imparts little spin
{
  const v = new Vehicle({ id: "t", team: "blue", isPlayer: true, name: "T", vehicleDef: VEHICLES[0], cosmetics: {}, x: A.W / 2, y: 400 });
  v.onGround = true; v.vx = 1000; v.vy = 0; v.angle = 0;
  const ball = new Ball(A);
  // directly in front of the car (centered, t ~ 1) — tangential velocity ~0
  ball.x = v.x + v.hw + ball.r - 4; ball.y = v.y;
  ball.vx = 0; ball.vy = 0; ball.spin = 0;
  v.collideBall(ball, env);
  check("centered hit imparts minimal spin", Math.abs(ball.spin) < 5, `spin=${ball.spin.toFixed(2)}`);
}

// 6. Dribble carry: a slow ball in contact is dragged along by the car
{
  const v = new Vehicle({ id: "t", team: "blue", isPlayer: true, name: "T", vehicleDef: VEHICLES[0], cosmetics: {}, x: A.W / 2, y: 400 });
  v.onGround = true; v.vx = 900; v.vy = 0; v.angle = 0;
  const ball = new Ball(A);
  ball.x = v.x + v.hw + ball.r - 4; ball.y = v.y; // pressed against nose
  ball.vx = 880; ball.vy = 0; ball.spin = 0; // ball already moving with the car (relN small)
  v.collideBall(ball, env);
  check("car drags a pinned ball forward (carry)", ball.vx > 0, `vx=${ball.vx.toFixed(1)}`);
  check("carry flags the ball as held", ball.carryTimer > 0, `carry=${ball.carryTimer}`);
}

// 7. Ball rolls on the ground (bounce damps quickly)
{
  const ball = new Ball(A);
  ball.x = A.W / 2; ball.y = ball.r + 2; ball.vx = 500; ball.vy = -200; ball.spin = 0;
  let bounces = 0;
  for (let i = 0; i < 90; i++) {
    const ev = ball.update(1 / 60, env, null);
    if (ev.floor) bounces++;
 
    // settle: once slow vertical, it should stay near floor
  }
  check("ball settles to roll (few bounces)", bounces <= 4, `bounces=${bounces}`);
  check("ball rests near floor after settling", ball.y < ball.r + 4, `y=${ball.y.toFixed(2)}`);
}

// 8. Ball kick sets velocity
{
  const ball = new Ball(A);
  ball.kick(400, -300);
  check("kick() sets ball velocity", ball.vx === 400 && ball.vy === -300);
}

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
