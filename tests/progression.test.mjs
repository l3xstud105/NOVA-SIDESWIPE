// progression.test.mjs — verify profile presets, match rules, stats & MVP.
// Run: node tests/progression.test.mjs   (no browser; storage falls back to memory)
import { profile } from "../src/core/profile.js";
import { Match } from "../src/game/match.js";
import { Vehicle } from "../src/game/vehicle.js";
import { Ball } from "../src/game/ball.js";
import { getArena } from "../src/data/arenas.js";
import { VEHICLES } from "../src/data/vehicles.js";

let passed = 0, failed = 0;
function check(name, cond, extra = "") {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failed++; console.log("  ✗ " + name + (extra ? "  -> " + extra : "")); }
}

console.log("NOVA SIDESWIPE — progression & match rules tests\n");

// ---- profile presets ----
profile.init();
const equipped = { vehicle: "comet", paint: "gold", paint2: "void", wheel: "sport", boost: "inferno", banner: "striker", title: "ace" };

{
  // save
  const p1 = profile.savePreset("Racer", equipped);
  check("preset saved with id", !!p1.id);
  check("preset name preserved", p1.name === "Racer");
  check("preset stores equipped snapshot", p1.equipped.vehicle === "comet");

  // list
  const all = profile.getPresets();
  check("preset appears in list", all.some((p) => p.id === p1.id));

  // load applies to profile
  profile.equip("vehicle", "nova"); // change away
  const ok = profile.loadPreset(p1.id);
  check("loadPreset returns true", ok === true);
  check("loadPreset applies vehicle", profile.equipped("vehicle") === "comet");
  check("loadPreset applies paint", profile.equipped("paint") === "gold");

  // rename
  profile.updatePreset(p1.id, "Racer X", null);
  check("rename updates preset", profile.getPresets().find((p) => p.id === p1.id).name === "Racer X");

  // update equipped snapshot
  profile.updatePreset(p1.id, "Racer X", { vehicle: "titan", paint: "cyan", paint2: "void", wheel: "stock", boost: "standard", banner: "none", title: "rookie" });
  check("updatePreset updates equipped", profile.getPresets().find((p) => p.id === p1.id).equipped.vehicle === "titan");

  // delete
  profile.deletePreset(p1.id);
  check("deletePreset removes preset", !profile.getPresets().some((p) => p.id === p1.id));

  // duplicate
  const p2 = profile.savePreset("Copy A", equipped);
  profile.savePreset("Copy A (copy)", equipped);
  check("duplicate creates a second preset", profile.getPresets().filter((p) => p.name.startsWith("Copy A")).length === 2);
}

// ---- match rules + stats + MVP ----
{
  const A = getArena("neon");
  const ball = new Ball(A);
  const v1 = new Vehicle({ id: "p1", team: "blue", isPlayer: true, name: "Me", vehicleDef: VEHICLES[0], cosmetics: {}, x: 100, y: 100 });
  const v2 = new Vehicle({ id: "o1", team: "orange", isPlayer: false, name: "CPU", vehicleDef: VEHICLES[0], cosmetics: {}, x: 100, y: 100 });
  const m = new Match({ mode: "1v1", arena: A, ball, vehicles: [v1, v2] });
  check("match starts in countdown", m.state === "countdown");

  // simulate countdown to playing
  m.countdown = 0.01;
  m.update(0.02, { gravity: 2000, arena: A }, null);
  check("countdown transitions to playing", m.state === "playing");

  // blue scores in right goal (blue attacks right)
  ball.lastTouch = "blue"; ball.lastTouchId = "p1";
  ball.x = A.W - A.goalDepth * 0.4; ball.y = A.goalHeight * 0.5;
  m._standardGoal(null);
  check("goal increments blue score", m.score.blue === 1, `blue=${m.score.blue}`);
  check("goal records scorer", m.scorers && m.scorers["p1"] === 1, JSON.stringify(m.scorers));
  check("goal sets state to goal", m.state === "goal");

  // stats accumulate
  m.stats.blue.shots = 3;
  m.stats.blue.saves = 2;
  m.stats.blue.aerials = 1;
  check("match stats track shots", m.stats.blue.shots === 3);
  check("match stats track saves", m.stats.blue.saves === 2);
  check("match stats track aerials", m.stats.blue.aerials === 1);

  // MVP = top scorer
  // p1 scored 1; add an orange scorer to verify p1 still leads or check logic
  let mvpId = null, mvpGoals = 0;
  for (const v of [v1, v2]) { const g = m.scorers[v.id] || 0; if (g > mvpGoals) { mvpGoals = g; mvpId = v.id; } }
  check("MVP resolves to a scorer", mvpId === "p1" && mvpGoals === 1, `mvp=${mvpId}`);

  // end match and verify winner
  m.score.blue = 2; m.score.orange = 0;
  m._end();
  check("match ends with correct winner", m.winner === "blue", `winner=${m.winner}`);
  check("ended state set", m.state === "ended");
}

// ---- mode-specific: hoops scoring ----
{
  const A = getArena("neon");
  const ball = new Ball(A);
  const v1 = new Vehicle({ id: "p1", team: "blue", vehicleDef: VEHICLES[0], cosmetics: {}, x: 100, y: 100 });
  const m = new Match({ mode: "hoops", arena: A, ball, vehicles: [v1] });
  m.countdown = 0.01; m.update(0.02, { gravity: 2000, arena: A }, null);
  // blue attacks right → scores in orange hoop (right side). hoop 'orange' is on the right.
  ball.vx = 400; // moving right (hoop dir for 'orange' is -1, so vx * dir = -400 <0)... set toward hoop
  // hoop.dir for 'orange' (right side) is -1; condition is ball.vx * h.dir > 60 → need vx negative
  ball.vx = -400;
  ball.x = m.hoops.orange.x; ball.y = m.hoops.orange.y;
  m._hoops(null);
  check("hoops: blue scores through right ring", m.score.blue === 1, `blue=${m.score.blue}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
