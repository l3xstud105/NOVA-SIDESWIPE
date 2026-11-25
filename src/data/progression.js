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
