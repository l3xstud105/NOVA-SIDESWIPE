// progression.js — ranks, XP/levels, achievements (local progression)
// Competitive rank is derived from local MMR; in online play the server is authoritative.

export const RANKS = [
  { id: "bronze", name: "Bronze", color: "#cd7f32", min: 0 },
  { id: "silver", name: "Silver", color: "#c0c6d4", min: 300 },
  { id: "gold", name: "Gold", color: "#ffd24b", min: 700 },
  { id: "platinum", name: "Platinum", color: "#5fe0e6", min: 1200 },
  { id: "diamond", name: "Diamond", color: "#7ad6ff", min: 1800 },
  { id: "champion", name: "Champion", color: "#b14bff", min: 2500 },
  { id: "grand", name: "Grand Champion", color: "#ff4bd8", min: 3300 },
];

export function rankForMMR(mmr) {
  let r = RANKS[0];
  for (const rank of RANKS) if (mmr >= rank.min) r = rank;
  return r;
}

// Player level from lifetime XP (separate from competitive rank)
export function levelForXP(xp) {
  // gentle curve: level n needs ~ n*120 + n^2*8 xp cumulative-ish
  let lvl = 1;
  let need = 200;
  let acc = 0;
  while (xp >= acc + need) {
    acc += need;
    lvl++;
    need = 180 + lvl * 30;
  }
  const into = xp - acc;
  return { level: lvl, into, need, progress: into / need };
}

export const ACHIEVEMENTS = [
  { id: "first_goal", name: "First Strike", desc: "Score your first goal." },
  { id: "hat_trick", name: "Hat Trick", desc: "Score 3 goals in one match." },
  { id: "win_1v1", name: "Duelist", desc: "Win a 1v1 match." },
  { id: "win_2v2", name: "Squad Up", desc: "Win a 2v2 match." },
  { id: "aerial", name: "Airborne", desc: "Score an aerial goal." },
  { id: "flip_reset", name: "Reset Artist", desc: "Perform a flip reset." },
  { id: "comeback", name: "Comeback", desc: "Win after trailing by 3." },
  { id: "centurion", name: "Centurion", desc: "Reach level 10." },
  { id: "hoops", name: "Swish", desc: "Score in Hoops." },
  { id: "volley", name: "Volley Chef", desc: "Win a Volleyball match." },
  { id: "tournament_round", name: "Bracket Climber", desc: "Advance a round in a tournament." },
  { id: "tournament_champion", name: "Champion", desc: "Win a tournament." },
];

export const DAILY_CHALLENGES = [
  { id: "d_score3", name: "Score 3 goals", reward: 150 },
  { id: "d_win1", name: "Win 1 match", reward: 200 },
  { id: "d_boost", name: "Use boost 25 times", reward: 120 },
  { id: "d_aerial", name: "Hit 2 aerials", reward: 180 },
];

export const WEEKLY_CHALLENGES = [
  { id: "w_win3", name: "Win 3 matches", reward: 500 },
  { id: "w_play10", name: "Play 10 matches", reward: 400 },
  { id: "w_2v2", name: "Play 5 matches of 2v2", reward: 450 },
];

// Level-up reward track: cosmetics and titles unlocked as you reach levels.
// Each entry grants an item when the player first reaches the given level.
export const LEVEL_REWARDS = [
  { level: 2, category: "paint", id: "cobalt", label: "Deep Cobalt" },
  { level: 3, category: "paint", id: "mint", label: "Ion Mint" },
  { level: 4, category: "wheel", id: "sport", label: "Sport Forged" },
  { level: 5, category: "title", id: "ace", label: "Ace" },
  { level: 6, category: "paint", id: "crimson", label: "Crimson Tide" },
  { level: 7, category: "boost", id: "inferno", label: "Inferno" },
  { level: 8, category: "paint", id: "violet", label: "Hyper Violet" },
  { level: 9, category: "banner", id: "striker", label: "Striker Banner" },
  { level: 10, category: "title", id: "veteran", label: "Veteran" },
  { level: 12, category: "paint", id: "gold", label: "Aurum Gold" },
  { level: 14, category: "boost", id: "void", label: "Void Surge" },
  { level: 16, category: "wheel", id: "magma", label: "Magma Hoop" },
  { level: 18, category: "banner", id: "star", label: "Starborn Banner" },
  { level: 20, category: "title", id: "legend", label: "Legend" },
  { level: 22, category: "paint", id: "toxic", label: "Toxic Lime" },
  { level: 24, category: "boost", id: "toxic", label: "Toxic Spit" },
  { level: 26, category: "paint", id: "ember", label: "Ember Orange" },
  { level: 28, category: "wheel", id: "prism", label: "Prism Disc" },
  { level: 30, category: "paint", id: "chrome", label: "Chrome Prism" },
  { level: 30, category: "boost", id: "gold", label: "Aurum Flare" },
];

// all reward levels, sorted, deduped
export const REWARD_LEVELS = [...new Set(LEVEL_REWARDS.map((r) => r.level))].sort((a, b) => a - b);

// rewards available at a given level (the tier reached by that level)
export function rewardsAtLevel(level) {
  return LEVEL_REWARDS.filter((r) => r.level === level);
}

// highest reward level the player has reached
export function highestRewardLevelReached(profileData) {
  const lvl = (profileData && profileData.level != null)
    ? profileData.level
    : levelForXP((profileData && profileData.xp) || 0).level;
  return REWARD_LEVELS.filter((rl) => rl <= lvl).reduce((m, rl) => Math.max(m, rl), 0);
}

