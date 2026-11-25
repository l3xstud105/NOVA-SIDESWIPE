// modes.test.mjs — verify real-ish Hoops & Volleyball rules in Match.
// Run: node tests/modes.test.mjs   (no browser)
import { Match, MODE_INFO } from "../src/game/match.js";
import { Ball } from "../src/game/ball.js";
import { Vehicle } from "../src/game/vehicle.js";
import { getArena } from "../src/data/arenas.js";
import { VEHICLES } from "../src/data/vehicles.js";

let passed = 0, failed = 0;
function check(name, cond, extra = "") {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failed++; console.log("  ✗ " + name + (extra ? "  -> " + extra : "")); }
}

function makeMatch(mode) {
  const A = getArena("neon");
  const ball = new Ball(A);
  const blue = new Vehicle({ id: "p", team: "blue", isPlayer: true, name: "P", vehicleDef: VEHICLES[0], cosmetics: {}, x: 400, y: 150 });
  const orange = new Vehicle({ id: "o", team: "orange", isPlayer: false, name: "CPU", vehicleDef: VEHICLES[0], cosmetics: {}, x: 800, y: 150 });
  blue.reset(400, 150, 0);
  orange.reset(800, 150, Math.PI);
  const m = new Match({ mode, arena: A, ball, vehicles: [blue, orange] });
  m.countdown = 0; m.state = "playing";
  return { A, ball, blue, orange, m };
}

console.log("NOVA SIDESWIPE — mode rule tests\n");

// 1. all modes declared
for (const key of ["1v1", "2v2", "local2p", "hoops", "volleyball", "free"]) {
  check("mode '" + key + "' declared", !!MODE_INFO[key]);
}

// 2. hoops: 2-point shot scored near the hoop
{
  const { ball, m } = makeMatch("hoops");
  const h = m.hoops.orange;
  m._possession = "blue";
  m._shotOrigin = { x: h.x - 200, y: h.y }; // close shot
  m._rimTouched = true; // non-swish 2-pointer
  ball.x = h.x; ball.y = h.y; ball.vx = -400; ball.vy = 0;
  ball.lastTouch = "blue";
  m._hoopCd = 0;
  m._hoops(0.016, null);
  check("hoops 2-point shot scores for blue", m.score.blue === 1, "blue=" + m.score.blue);
  check("2pt shot awarded 2 points", m.stats.blue.points === 2, "pts=" + m.stats.blue.points);
}

// 3. hoops: 3-point shot when shooter was far from hoop
{
  const { ball, m } = makeMatch("hoops");
  const h = m.hoops.orange;
  m._possession = "blue";
  m._shotOrigin = { x: h.x - 470, y: h.y }; // long shot
  ball.x = h.x; ball.y = h.y; ball.vx = -400; ball.vy = 0;
  ball.lastTouch = "blue";
  m._hoopCd = 0;
  m._hoops(0.016, null);
  check("hoops long shot scores 3 points", m.stats.blue.points >= 3, "pts=" + m.stats.blue.points);
}

// 4. hoops: swish bonus when no rim touched
{
  const { ball, m } = makeMatch("hoops");
  const h = m.hoops.orange;
  m._possession = "blue";
  m._rimTouched = false;
  m._shotOrigin = { x: h.x - 200, y: h.y };
  ball.x = h.x; ball.y = h.y; ball.vx = -400; ball.vy = 0;
  ball.lastTouch = "blue";
  m._hoopCd = 0;
  m._hoops(0.016, null);
  check("swish shot awards bonus points (2.5)", m.stats.blue.points >= 2.5, "pts=" + m.stats.blue.points);
}

// 5. hoops: shot clock violation → turnover
{
  const { ball, m } = makeMatch("hoops");
  m._possession = "blue";
  m._shotClock = 0.01;
  ball.lastTouch = "blue";
  const before = m._possession;
  m._hoops(0.02, null);
  check("shot clock violation causes turnover", m._possession !== before && m._possession === "orange", "poss=" + m._possession);
}

// 6. hoops: non-possessing team cannot score
{
  const { ball, m } = makeMatch("hoops");
  const h = m.hoops.orange;
  m._possession = "orange";
  m._shotOrigin = { x: h.x - 200, y: h.y };
  ball.x = h.x; ball.y = h.y; ball.vx = -400; ball.vy = 0;
  ball.lastTouch = "orange";
  m._hoopCd = 0;
  m._hoops(0.016, null);
  check("non-possessing team cannot score", m.score.blue === 0, "blue=" + m.score.blue);
}

// 7. volleyball: floor touch scores for opponent of last toucher
{
  const { ball, m } = makeMatch("volleyball");
  ball.x = 600; ball.y = 0.5; ball.vx = 0; ball.vy = 0;
  ball.r = 16;
  ball.lastTouch = "blue";
  m._floorWasUp = true; // ball was up last frame, now hits floor
  m._volleyCd = 0;
  m._volley(0.016, null, null);
  check("volleyball floor touch scores for opponent (orange)", m.score.orange === 1, "orange=" + m.score.orange);
}

// 8. volleyball: 4th touch is a fault → point to opponent
{
  const { ball, m } = makeMatch("volleyball");
  m._touches.blue = 3;
  ball.lastTouch = "blue";
  m._volleyCd = 0;
  m._volley(0.016, null, null);
  check("volleyball 4th touch faults (orange scores)", m.score.orange === 1, "orange=" + m.score.orange);
}

// 9. volleyball: opponent touch resets rally count (no fault)
{
  const { ball, m } = makeMatch("volleyball");
  m._touches.blue = 3;
  ball.lastTouch = "orange";
  m._volleyCd = 0;
  m._volley(0.016, null, null);
  check("volleyball opponent touch resets rally count (no fault)", m.score.blue === 0 && m._touches.blue === 0, "blue=" + m.score.blue + " tch=" + m._touches.blue);
}

// 10. free play never scores via update
{
  const { ball, m } = makeMatch("free");
  ball.x = m.arena.W - 1; ball.y = 5;
  m.update(0.016, {}, null);
  check("free play does not score", m.score.blue === 0 && m.score.orange === 0);
}

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
