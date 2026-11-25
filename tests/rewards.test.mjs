// rewards.test.mjs — verify level-up reward track + tournament achievements.
// Run: node tests/rewards.test.mjs   (no browser; storage falls back to memory)
import { profile } from "../src/core/profile.js";
import {
  ACHIEVEMENTS, LEVEL_REWARDS, REWARD_LEVELS, rewardsAtLevel,
  levelForXP, highestRewardLevelReached,
} from "../src/data/progression.js";

let passed = 0, failed = 0;
function check(name, cond, extra = "") {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failed++; console.log("  ✗ " + name + (extra ? "  -> " + extra : "")); }
}

console.log("NOVA SIDESWIPE — rewards & progression tests\n");

profile.init();

// 1. tournament achievements present
check("tournament_round achievement defined", ACHIEVEMENTS.some((a) => a.id === "tournament_round"));
check("tournament_champion achievement defined", ACHIEVEMENTS.some((a) => a.id === "tournament_champion"));
check("volley achievement has valid desc", ACHIEVEMENTS.find((a) => a.id === "volley").desc.endsWith("match."));

// 2. reward track structure
check("LEVEL_REWARDS is a non-empty array", LEVEL_REWARDS.length > 0);
check("reward levels sorted & unique", REWARD_LEVELS.every((v, i, a) => i === 0 || v > a[i - 1]));
for (const r of LEVEL_REWARDS) {
  check("reward '" + r.label + "' has level/category/id", "level" in r && "category" in r && "id" in r);
}

// 3. rewardsAtLevel returns the tier's rewards
{
  const tier2 = rewardsAtLevel(2);
  check("rewardsAtLevel(2) returns cobalt paint", tier2.some((r) => r.id === "cobalt"));
  check("rewardsAtLevel(30) returns multiple rewards", rewardsAtLevel(30).length >= 2);
}

// 4. grantLevelRewards grants rewards up to current level
{
  profile.reset();
  profile.data.grantedRewards = {};
  // reach level 5 (XP for level 5)
  const lvl5 = levelForXP(0);
  // compute xp needed to reach level 5
  let xp = 0, acc = 0, need = 200, lvl = 1;
  while (lvl < 5) { acc += need; lvl++; need = 180 + lvl * 30; }
  xp = acc;
  profile.data.xp = xp;
  const granted = profile.grantLevelRewards();
  check("grantLevelRewards returns newly granted rewards", granted.length > 0, "n=" + granted.length);
  check("granted rewards include level-2 cobalt", granted.some((r) => r.id === "cobalt"));
  check("granted rewards include level-5 ace title", granted.some((r) => r.id === "ace" && r.category === "title"));
  check("granted rewards do not exceed current level", granted.every((r) => r.level <= 5));
}

// 5. granting unlocks cosmetics into owned
{
  profile.reset();
  profile.data.grantedRewards = {};
  profile.data.xp = 0;
  // reach level 4 to unlock sport wheels
  let acc = 0, need = 200, lvl = 1;
  while (lvl < 4) { acc += need; lvl++; need = 180 + lvl * 30; }
  profile.data.xp = acc;
  profile.grantLevelRewards();
  check("level reward unlocks sport wheels into owned", profile.owns("wheel", "sport"));
}

// 6. rewards do not re-grant
{
  profile.reset();
  profile.data.grantedRewards = {};
  let acc = 0, need = 200, lvl = 1;
  while (lvl < 4) { acc += need; lvl++; need = 180 + lvl * 30; }
  profile.data.xp = acc;
  const first = profile.grantLevelRewards();
  check("first grant returns rewards", first.length > 0);
  const second = profile.grantLevelRewards();
  check("second grant returns nothing (no duplicates)", second.length === 0, "n=" + second.length);
}

// 7. getGrantedRewards + nextReward
{
  profile.reset();
  profile.data.grantedRewards = {};
  let acc = 0, need = 200, lvl = 1;
  while (lvl < 6) { acc += need; lvl++; need = 180 + lvl * 30; }
  profile.data.xp = acc;
  profile.grantLevelRewards();
  const got = profile.getGrantedRewards();
  check("getGrantedRewards returns earned rewards", got.length > 0, "n=" + got.length);
  const next = profile.nextReward();
  check("nextReward returns the next tier above current level", next && next.level > lvl - 1, "next=" + (next && next.level));
  check("nextReward rewards are for that level", next && next.rewards.every((r) => r.level === next.level));
}

// 8. hasReward
{
  profile.reset();
  profile.data.grantedRewards = {};
  profile.data.xp = 0;
  let acc = 0, need = 200, lvl = 1;
  while (lvl < 3) { acc += need; lvl++; need = 180 + lvl * 30; }
  profile.data.xp = acc;
  profile.grantLevelRewards();
  check("hasReward true for granted item", profile.hasReward("paint", "mint"));
  check("hasReward false for ungranted item", !profile.hasReward("paint", "chrome"));
}

// 9. highestRewardLevelReached
{
  check("highestRewardLevelReached works from xp", highestRewardLevelReached({ xp: 0 }) === 0);
  // level 10 xp
  let acc = 0, need = 200, lvl = 1;
  while (lvl < 10) { acc += need; lvl++; need = 180 + lvl * 30; }
  check("highestRewardLevelReached at level 10", highestRewardLevelReached({ xp: acc }) === 10, "got=" + highestRewardLevelReached({ xp: acc }));
}

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
