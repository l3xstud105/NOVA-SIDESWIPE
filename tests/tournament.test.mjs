// tournament.test.mjs — verify single-elimination bracket logic.
// Run: node tests/tournament.test.mjs   (no browser)
import { Tournament } from "../src/game/tournament.js";

let passed = 0, failed = 0;
function check(name, cond, extra = "") {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failed++; console.log("  ✗ " + name + (extra ? "  -> " + extra : "")); }
}

console.log("NOVA SIDESWIPE — tournament tests\n");

// 1. construction: 8-team bracket has 3 rounds, 4/2/1 matches
{
  const t = new Tournament({ size: 8 });
  check("8-team tournament has 3 rounds", t.bracket.length === 3, "rounds=" + t.bracket.length);
  check("round 0 has 4 matches", t.bracket[0].length === 4, "n=" + t.bracket[0].length);
  check("round 2 (final) has 1 match", t.bracket[2].length === 1, "n=" + t.bracket[2].length);
  check("player is in round 0", t.bracket[0].some((m) => m[0].isPlayer || m[1].isPlayer));
  check("8 teams seeded", t.teams.length === 8, "n=" + t.teams.length);
}

// 2. full tournament: player wins all → champion
{
  const t = new Tournament({ size: 8 });
  // simulate: player wins every match; AI matches resolved by picking winner
  for (let r = 0; r < t.bracket.length; r++) {
    for (let i = 0; i < t.bracket[r].length; i++) {
      const m = t.bracket[r][i];
      if (!m[0] || !m[1]) continue;
      let winner;
      if (m[0].isPlayer || m[1].isPlayer) {
        const p = m[0].isPlayer ? m[0] : m[1];
        winner = p.id;
      } else {
        winner = (i % 2 === 0 ? m[0] : m[1]).id;
      }
      t.recordResult(r, i, winner);
    }
  }
  check("tournament completes after all matches", t.complete, "complete=" + t.complete);
  check("a champion is crowned", !!t.champion, "champ=" + (t.champion ? t.champion.name : "none"));
  check("player is the champion", t.champion && t.champion.isPlayer, "champ=" + (t.champion ? t.champion.name : "none"));
  check("player has not been eliminated", t.playerAlive());
}

// 3. player eliminated early → not champion, not alive
{
  const t = new Tournament({ size: 8 });
  // round 0: player's match — player loses
  const pm = t.playerMatch();
  check("player has a match in round 0", !!pm);
  const opp = pm.opponent;
  t.recordResult(pm.round, pm.index, opp.id);
  check("player eliminated after loss", !t.playerAlive());
  check("player is not the champion", !(t.champion && t.champion.isPlayer));
  // complete remaining matches so tournament finishes
  for (let r = pm.round; r < t.bracket.length; r++) {
    for (let i = 0; i < t.bracket[r].length; i++) {
      const m = t.bracket[r][i];
      if (!m[0] || !m[1] || m.done) continue;
      t.recordResult(r, i, m[0].id);
    }
  }
  check("tournament still completes with player eliminated", t.complete);
}

// 4. winner advances into next round slot
{
  const t = new Tournament({ size: 8 });
  const m0 = t.bracket[0][0];
  t.recordResult(0, 0, m0[0].id);
  // winner should appear in round 1
  const r1 = t.bracket[1];
  const placed = r1.some((m) => m[0] === m0[0] || m[1] === m0[0]);
  check("winner advances into next round", placed);
}

// 5. serialize / deserialize round-trips
{
  const t = new Tournament({ size: 8 });
  const m0 = t.bracket[0][0];
  t.recordResult(0, 0, m0[0].id);
  const s = t.serialize();
  const t2 = Tournament.fromSerialized(s);
  check("serialize preserves teams", t2.teams.length === t.teams.length);
  check("serialize preserves match result", t2.bracket[0][0].done === true);
  check("serialize preserves winner id", t2.bracket[0][0].winner && t2.bracket[0][0].winner.id === m0[0].id);
}

// 6. progress() returns UI-safe data
{
  const t = new Tournament({ size: 8 });
  const p = t.progress();
  check("progress exposes size", p.size === 8);
  check("progress exposes bracket structure", Array.isArray(p.bracket) && p.bracket.length === 3);
  check("progress marks player alive", p.playerAlive === true);
}

// 7. size bounds clamp
{
  const t1 = new Tournament({ size: 3 });
  check("size clamps up to 4", t1.size === 4, "size=" + t1.size);
  const t2 = new Tournament({ size: 64 });
  check("size clamps down to 16", t2.size === 16, "size=" + t2.size);
}

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
