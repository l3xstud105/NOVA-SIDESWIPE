// tournament.js — single-elimination tournament bracket (local, vs AI)
import { profile } from "../core/profile.js";

const AI_NAMES = [
  "Ignite", "Vortex", "Comet Kid", "Night Owl", "Ember", "Gravity", "Phantom", "Raptor",
  "Skyline", "Cobalt", "Apex", "Drift", "Halo", "Spark", "Vortex Jr", "Blaze",
];
const AI_STYLES = ["aggressive", "defensive", "aerial", "control", "opportunistic", "team"];

function makeTeams(size) {
  // player is always team 0; fill the rest with AI
  const teams = [{ id: "player", name: "You", isPlayer: true, color: "#2ce3ff", difficulty: "medium", style: "balanced" }];
  for (let i = 1; i < size; i++) {
    const nm = AI_NAMES[(i - 1) % AI_NAMES.length] + (i > AI_NAMES.length ? " " + Math.ceil(i / AI_NAMES.length) : "");
    teams.push({
      id: "ai_" + i,
      name: nm,
      isPlayer: false,
      color: ["#ff9a3c", "#9b5cff", "#4bff9d", "#ff5c8a", "#ffd24b", "#5cc8ff", "#b06bff", "#7CFFB2"][i % 8],
      difficulty: ["easy", "medium", "hard"][i % 3],
      style: AI_STYLES[i % AI_STYLES.length],
    });
  }
  return teams;
}

// build a seeded single-elimination bracket for `size` teams
function seedBracket(size) {
  const n = size;
  // round 0 has n/2 matches, etc. Each slot holds a team or null.
  const slots = [];
  // standard seeding: 1 vs n, 2 vs n-1, ...
  const order = [];
  for (let i = 1; i <= n; i++) order.push(i);
  // place seeds so that top seeds can't meet early
  const bracket = [];
  let seeds = order.slice();
  while (seeds.length > 1) {
    const half = seeds.length / 2;
    const round = [];
    for (let i = 0; i < half; i++) {
      round.push([seeds[i], seeds[seeds.length - 1 - i]]);
    }
    bracket.push(round);
    // winners advance, preserving seed order
    const winners = round.map((m) => null);
    seeds = winners;
  }
  return bracket;
}

export class Tournament {
  constructor(opts = {}) {
    const size = Math.max(4, Math.min(16, opts.size || 8));
    this.size = size;
    this.teams = makeTeams(size);
    // bracket: array of rounds; each round is array of matches [a, b]; match may be [team, null] etc.
    this.bracket = [];
    this.rounds = Math.log2(size);
    this.currentRound = 0;
    this.complete = false;
    this.champion = null;
    this.runnerUp = null;
    this.history = [];
    this._seedIntoBracket();
  }

  _seedIntoBracket() {
    // build an empty bracket structure
    let slots = this.teams.slice();
    // shuffle AI slots but keep player seeded at top
    const ai = slots.filter((t) => !t.isPlayer);
    // simple shuffle
    for (let i = ai.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ai[i], ai[j]] = [ai[j], ai[i]];
    }
    const all = [slots[0], ...ai];
    this.bracket = [];
    let cur = all.slice();
    while (cur.length > 1) {
      const half = cur.length / 2;
      const round = [];
      for (let i = 0; i < half; i++) round.push([cur[i], cur[cur.length - 1 - i]]);
      this.bracket.push(round.map(() => [null, null]));
      // winners placeholders
      const winners = new Array(half).fill(null);
      cur = winners;
    }
    // place teams into round 0
    for (let i = 0; i < this.bracket[0].length; i++) {
      this.bracket[0][i][0] = all[i];
      this.bracket[0][i][1] = all[all.length - 1 - i];
    }
  }

  // the next match to be played for the player (or null if none/finished)
  nextMatch() {
    // find first match in the current round that is not yet resolved
    for (let r = this.currentRound; r < this.bracket.length; r++) {
      for (let i = 0; i < this.bracket[r].length; i++) {
        const m = this.bracket[r][i];
        if (m[0] && m[1] && m[0].winner === undefined && m[1].winner === undefined && !m.done) {
          // player's match: the one containing the player team (if alive)
          if (m[0].isPlayer || m[1].isPlayer) return { round: r, index: i, match: m };
        }
      }
      // if no player match in this round and round is fully resolved, advance
      if (!this._roundResolved(r)) {
        // a non-player match is pending — we still expose it for sim
        for (let i = 0; i < this.bracket[r].length; i++) {
          const m = this.bracket[r][i];
          if (m[0] && m[1] && !m.done) return { round: r, index: i, match: m };
        }
      }
    }
    return null;
  }

  _roundResolved(r) {
    return this.bracket[r].every((m) => m.done);
  }

  // record a match result: winnerTeam is the team object (or its id)
  recordResult(round, index, winnerId) {
    const m = this.bracket[round][index];
    if (!m || m.done) return false;
    m.done = true;
    const winner = m[0].id === winnerId ? m[0] : m[1];
    const loser = m[0].id === winnerId ? m[1] : m[0];
    if (winner) winner.advanced = true;
    if (loser) loser.eliminated = true;
    m.winner = winner;
    this.history.push({ round, index, winner: winnerId, loser: loser ? loser.id : null });

    // advance winner into next round
    if (round + 1 < this.bracket.length) {
      const next = this.bracket[round + 1];
      const slot = index % next.length;
      // place into the first empty slot of the corresponding next-round match
      const target = next[Math.floor(index / 2) % next.length];
      // find an empty position
      if (!target[0]) target[0] = winner;
      else if (!target[1]) target[1] = winner;
    }

    // check round completion
    if (this._roundResolved(round)) {
      // all matches in this round done
    }
    // check tournament completion
    if (this._roundResolved(this.bracket.length - 1)) {
      const final = this.bracket[this.bracket.length - 1][0];
      this.champion = final.winner;
      this.runnerUp = final.winner === final[0] ? final[1] : final[0];
      this.complete = true;
    }
    return true;
  }

  playerAlive() {
    const p = this.teams[0];
    return !p.eliminated;
  }

  playerMatch() {
    // find the player's current match across all rounds
    for (let r = 0; r < this.bracket.length; r++) {
      for (let i = 0; i < this.bracket[r].length; i++) {
        const m = this.bracket[r][i];
        if ((m[0] && m[0].isPlayer) || (m[1] && m[1].isPlayer)) {
          if (!m.done) return { round: r, index: i, opponent: m[0].isPlayer ? m[1] : m[0] };
        }
      }
    }
    return null;
  }

  // progress info for UI
  progress() {
    return {
      size: this.size,
      rounds: this.rounds,
      currentRound: this.currentRound,
      complete: this.complete,
      champion: this.champion ? this.champion.name : null,
      playerAlive: this.playerAlive(),
      playerMatch: this.playerMatch(),
      bracket: this.bracket.map((round) =>
        round.map((m) => ({
          a: m[0] ? { name: m[0].name, isPlayer: m[0].isPlayer, color: m[0].color, adv: m.done && m.winner === m[0] } : null,
          b: m[1] ? { name: m[1].name, isPlayer: m[1].isPlayer, color: m[1].color, adv: m.done && m.winner === m[1] } : null,
          done: m.done,
          winner: m.winner ? m.winner.name : null,
        }))
      ),
    };
  }

  // persist / load
  save() {
    profile.data.tournaments = profile.data.tournaments || {};
    profile.data.tournaments.current = this.serialize();
    profile.save();
  }
  serialize() {
    return {
      size: this.size,
      teams: this.teams.map((t) => ({ ...t })),
      bracket: this.bracket.map((round) =>
        round.map((m) => ({ a: m[0] ? { ...m[0] } : null, b: m[1] ? { ...m[1] } : null, done: !!m.done, winner: m.winner ? m.winner.id : null }))
      ),
      currentRound: this.currentRound,
      complete: this.complete,
      champion: this.champion ? this.champion.id : null,
      runnerUp: this.runnerUp ? this.runnerUp.id : null,
      history: this.history.slice(),
    };
  }
  static fromSerialized(s) {
    const t = new Tournament({ size: s.size });
    t.teams = s.teams.map((x) => ({ ...x }));
    t.bracket = s.bracket.map((round) =>
      round.map((m) => ({
        a: m.a ? { ...m.a } : null,
        b: m.b ? { ...m.b } : null,
        done: !!m.done,
        winner: t.teams.find((x) => x.id === m.winner) || null,
      }))
    );
    // fix winner pointers
    for (const round of t.bracket) for (const m of round) {
      if (m.done && m.winner) m.winner = t.teams.find((x) => x.id === m.winner.id) || m.winner;
    }
    t.currentRound = s.currentRound || 0;
    t.complete = s.complete || false;
    t.champion = t.teams.find((x) => x.id === s.champion) || null;
    t.runnerUp = t.teams.find((x) => x.id === s.runnerUp) || null;
    t.history = (s.history || []).slice();
    return t;
  }
}

export function getCurrentTournament() {
  const t = profile.data.tournaments?.current;
  if (!t) return null;
  return Tournament.fromSerialized(t);
}

export function clearTournament() {
  if (profile.data.tournaments) delete profile.data.tournaments.current;
  profile.save();
}
