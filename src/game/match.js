// match.js — match state machine, scoring, timers and mode rules
import { angLerp } from "../core/math.js";

// Reference match rules (Rocket League Sideswipe): standard competitive
// matches are 2:00 (120s) and time-based — no target-score cap ends a
// match early. Tied at time-up → sudden-death (golden-goal) overtime.
const MODES = {
  "1v1":      { label: "1v1 Duel",     teamSize: 1, target: 0, duration: 120, mode: "standard" },
  "2v2":      { label: "2v2 Doubles",  teamSize: 2, target: 0, duration: 120, mode: "standard" },
  "local2p":  { label: "Local 2P",     teamSize: 1, target: 0, duration: 120, mode: "standard" },
  "hoops":    { label: "Hoops",        teamSize: 1, target: 0, duration: 120, mode: "hoops" },
  "volleyball": { label: "Volleyball", teamSize: 1, target: 0, duration: 120, mode: "volleyball" },
  "free":     { label: "Free Play",    teamSize: 1, target: 0, duration: 0,   mode: "free" },
};

export const MODE_INFO = MODES;

// Real-ish rule constants
const HOOPS = {
  shotClock: 24,        // seconds to attempt a shot after gaining possession
  threePtDist: 460,     // px from hoop beyond which a FG is worth 3
  swishBonus: 0.5,      // bonus multiplier when ball enters without touching rim
};
const VOLLEY = {
  maxTouches: 3,        // max consecutive touches per team before fault
  netW: 6,              // net wall half-width
};

export class Match {
  constructor(opts) {
    this.cfg = MODES[opts.mode] || MODES["1v1"];
    this.modeKey = opts.mode;
    this.arena = opts.arena;
    this.ball = opts.ball;
    this.vehicles = opts.vehicles; // all Vehicle instances (players + bots)
    this.duration = this.cfg.duration;
    this.target = this.cfg.target;
    this.score = { blue: 0, orange: 0 };
    this.state = "countdown"; // countdown | playing | goal | ended
    this.time = this.duration;
    this.countdown = 3.2;
    this._lastCount = 4;
    this.goalCooldown = 0;
    this.lastGoalTeam = null;
    this.winner = null;
    this.overtime = false;
    this.events = [];
    this.stats = {
      blue: { goals: 0, shots: 0, saves: 0, aerials: 0, points: 0 },
      orange: { goals: 0, shots: 0, saves: 0, aerials: 0, points: 0 },
    };
    this.netH = this.arena.H * 0.34;
    this.hoops = {
      orange: { x: this.arena.W - 130, y: this.arena.H * 0.62, r: 52, dir: -1 }, // blue attacks (right side)
      blue:   { x: 130, y: this.arena.H * 0.62, r: 52, dir: 1 },  // orange attacks (left side)
    };
    this._hoopCd = 0;
    // hoops rule state
    this._shotClock = HOOPS.shotClock;
    this._possession = null;     // team currently on offense
    this._rimTouched = false;
    this._shotOrigin = null;     // where the possessing team took their shot
    // volleyball rule state
    this._touches = { blue: 0, orange: 0 };
    this._floorWasUp = true;
    this._volleyCd = 0;
    this._kickoff(true);
  }

  isActive() { return this.state === "playing"; }

  _kickoff(initial = false) {
    const A = this.arena;
    this.ball.reset(A.W / 2, this.cfg.mode === "hoops" ? A.H * 0.5 : A.H * 0.72);
    // assign spawn sides: blue left, orange right
    const blue = this.vehicles.filter((v) => v.team === "blue");
    const orange = this.vehicles.filter((v) => v.team === "orange");
    this._spawnTeam(blue, "blue", 0.26);
    this._spawnTeam(orange, "orange", 0.74);
    // reset rule state
    this._shotClock = HOOPS.shotClock;
    this._possession = this.cfg.mode === "hoops" ? "blue" : null;
    this._rimTouched = false;
    this._shotOrigin = null;
    this._touches = { blue: 0, orange: 0 };
  }

  _spawnTeam(team, side, xFrac) {
    const A = this.arena;
    const n = team.length;
    team.forEach((v, i) => {
      const spread = (i - (n - 1) / 2) * 90;
      const x = A.W * xFrac + (side === "blue" ? -spread : spread);
      const y = 150 + (i % 2) * 60;
      v.reset(x, y, side === "blue" ? 0 : Math.PI);
    });
  }

  teamSize() { return this.cfg.teamSize; }

  update(dt, env, sfx) {
    this.events.length = 0;
    if (this._hoopCd > 0) this._hoopCd -= dt;
    if (this._volleyCd > 0) this._volleyCd -= dt;

    if (this.state === "countdown") {
      const prev = Math.ceil(this.countdown);
      this.countdown -= dt;
      const now = Math.ceil(this.countdown);
      if (now !== prev && now >= 1 && now <= 3) this.events.push({ type: "count", n: now });
      if (this.countdown <= 0) {
        this.state = "playing";
        this.events.push({ type: "go" });
        if (sfx && this.cfg.mode !== "free") sfx.countdownBeep(true);
      }
      return this.events;
    }

    if (this.state === "goal") {
      this.goalCooldown -= dt;
      if (this.goalCooldown <= 0) {
        this._kickoff();
        this.state = "playing";
      }
      return this.events;
    }

    if (this.state === "ended") return this.events;

    // ---- playing ----
    if (!this.overtime && this.duration > 0) this.time -= dt;

    // mode-specific detection
    if (this.cfg.mode === "volleyball") this._volley(dt, env, sfx);
    else if (this.cfg.mode === "hoops") this._hoops(dt, sfx);
    else if (this.cfg.mode === "free") { /* sandbox: no scoring */ }
    else this._standardGoal(sfx);

    // end conditions
    // (epsilon guards against floating-point residue leaving a tiny positive
    // time after exactly the match duration, which would otherwise skip time-up)
    if (this.duration > 0 && this.time <= 0.01 && !this.overtime) {
      this.time = 0;
      if (this.score.blue !== this.score.orange) this._end();
      else this.overtime = true; // golden goal
    }
    if (this.target > 0 && (this.score.blue >= this.target || this.score.orange >= this.target)) {
      this._end();
    }
    return this.events;
  }

  _standardGoal(sfx) {
    const A = this.arena, b = this.ball, gd = A.goalDepth, gh = A.goalHeight;
    let team = null;
    if (b.x > A.W - gd && b.y < gh) team = "blue";
    else if (b.x < gd && b.y < gh) team = "orange";
    if (team) this._registerGoal(team, sfx);
  }

  // ---------------- HOOPS ----------------
  _hoops(dt, sfx) {
    const b = this.ball;

    // track possession: last team to touch becomes offense (if different)
    if (b.lastTouch && b.lastTouch !== this._possession) {
      this._possession = b.lastTouch;
      this._shotClock = HOOPS.shotClock;
      this._rimTouched = false;
      this._shotOrigin = null;
    }
    // record the shot origin: where the ball was when the possessing team shot it.
    // Only while the ball is outside the hoop scoring cylinders, so the origin reflects
    // the shooter's release point (not the ball's position as it drops in).
    if (b.lastTouch === this._possession && this._possession) {
      let inHoop = false;
      for (const h of Object.values(this.hoops)) {
        if (Math.hypot(b.x - h.x, b.y - h.y) < h.r * 1.3) { inHoop = true; break; }
      }
      if (!inHoop) this._shotOrigin = { x: b.x, y: b.y };
    }

    // shot clock violation → turnover (opponent of possession gets the ball)
    if (this._possession) {
      this._shotClock -= dt;
      if (this._shotClock <= 0) {
        const turnover = this._possession === "blue" ? "orange" : "blue";
        this._possession = turnover;
        this._shotClock = HOOPS.shotClock;
        this._rimTouched = false;
        this._shotOrigin = null;
        this.events.push({ type: "shotclock" });
      }
    }

    if (this._hoopCd > 0) return;

    // rim contact marks the shot (so swish can be detected). Only when the ball is
    // in the rim ring zone — not already inside the hoop cylinder.
    for (const h of Object.values(this.hoops)) {
      const d = Math.hypot(b.x - h.x, b.y - h.y);
      if (!this._rimTouched && d > h.r * 0.6 && d < h.r * 1.3) {
        this._rimTouched = true;
      }
    }

    for (const [team, h] of Object.entries(this.hoops)) {
      const d = Math.hypot(b.x - h.x, b.y - h.y);
      if (d < h.r * 0.7 && b.vx * h.dir > 60) {
        // attacking team is the opposite of the hoop's defending team
        const scorer = team === "orange" ? "blue" : "orange";
        // only the possessing team may score
        if (scorer === this._possession || !this._possession) {
          // 2pt / 3pt by shooter's distance from the hoop (shot origin)
          const origin = this._shotOrigin || { x: b.x, y: b.y };
          const dist = Math.hypot(origin.x - h.x, origin.y - h.y);
          const pts = dist > HOOPS.threePtDist ? 3 : 2;
          const swish = !this._rimTouched;
          const gained = pts + (swish ? HOOPS.swishBonus : 0);
          this._registerGoal(scorer, sfx, pts, swish);
          this.stats[scorer].points += gained;
          this._hoopCd = 1.2;
          break;
        }
      }
    }
  }

  // ---------------- VOLLEYBALL ----------------
  _volley(dt, env, sfx) {
    const A = this.arena, b = this.ball;

    // center net (ball only)
    if (Math.abs(b.x - A.W / 2) < b.r && b.y < this.netH) {
      const s = Math.sign(b.x - A.W / 2) || 1;
      b.x = A.W / 2 - s * (b.r + 1);
      b.vx = -b.vx * 0.5;
    }

    // 3-touch rule: count touches per team; fault when a team uses >3
    if (b.lastTouch) {
      this._touches[b.lastTouch] += 1;
      // a touch by the other team resets that team's count (rally continues)
      this._touches[b.lastTouch === "blue" ? "orange" : "blue"] = 0;
    }

    // fault: team exceeded touch limit → point to opponent
    if (this._touches.blue > VOLLEY.maxTouches) {
      this._registerGoal("orange", sfx);
      this._volleyCd = 1.5;
      return;
    }
    if (this._touches.orange > VOLLEY.maxTouches) {
      this._registerGoal("blue", sfx);
      this._volleyCd = 1.5;
      return;
    }

    // floor touch → rally ends, opponent of last toucher scores
    if (b.y - b.r <= 0.5 && this._floorWasUp && this._volleyCd <= 0) {
      const concede = b.lastTouch;
      let scorer = null;
      if (concede === "blue") scorer = "orange";
      else if (concede === "orange") scorer = "blue";
      if (scorer) {
        this._registerGoal(scorer, sfx);
        this.flashVolley = scorer;
        this._volleyCd = 1.5;
      } else {
        // neutral drop: just reset ball
        this.ball.reset();
        this._kickoff();
      }
    }
    this._floorWasUp = b.y - b.r > 1;
  }

  _registerGoal(team, sfx, pts = 1, swish = false) {
    this.score[team]++;
    this.stats[team].goals++;
    // record the individual scorer (whoever last touched the ball)
    if (this.ball && this.ball.lastTouchId) {
      this.scorers = this.scorers || {};
      this.scorers[this.ball.lastTouchId] = (this.scorers[this.ball.lastTouchId] || 0) + 1;
    }
    this.lastGoalTeam = team;
    this.state = "goal";
    this.goalCooldown = 2.4;
    this.events.push({ type: "goal", team, pts, swish });
    if (sfx) sfx.goal();
  }

  _end() {
    this.state = "ended";
    this.winner = this.score.blue === this.score.orange ? "draw" :
      this.score.blue > this.score.orange ? "blue" : "orange";
    this.events.push({ type: "end", winner: this.winner });
  }

  timeString() {
    if (this.duration === 0) return "--:--";
    const t = Math.max(0, Math.ceil(this.time));
    const m = Math.floor(t / 60), s = t % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
}
