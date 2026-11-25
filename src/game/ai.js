// ai.js — intelligent opponent that drives the same Vehicle physics as players.
// Difficulty scales reaction, accuracy, boost usage, aerials and flip frequency.
// Playstyle personality layers on top of difficulty for varied opponents.

const DIFF = {
  easy:   { react: 0.18, err: 46, boost: 0.35, flip: 0.15, aerial: 0.0,  speed: 0.82 },
  medium: { react: 0.10, err: 22, boost: 0.7,  flip: 0.45, aerial: 0.4,  speed: 0.95 },
  hard:   { react: 0.05, err: 8,  boost: 0.95, flip: 0.8,  aerial: 0.85, speed: 1.0  },
};

// Playstyle personalities: multipliers + behaviour flags layered over difficulty.
const PLAYSTYLE = {
  balanced:     { boostMul: 1.0, flipMul: 1.0, aerialMul: 1.0, defend: 0.5, rush: 0.5, control: 0.5 },
  aggressive:   { boostMul: 1.3, flipMul: 1.4, aerialMul: 1.1, defend: 0.2, rush: 1.4, control: 0.4 },
  defensive:    { boostMul: 0.8, flipMul: 0.6, aerialMul: 0.7, defend: 1.6, rush: 0.3, control: 0.8 },
  aerial:       { boostMul: 1.1, flipMul: 1.2, aerialMul: 1.8, defend: 0.4, rush: 0.6, control: 0.4 },
  control:      { boostMul: 0.9, flipMul: 0.5, aerialMul: 0.8, defend: 0.7, rush: 0.5, control: 1.7 },
  opportunistic:{ boostMul: 1.2, flipMul: 1.1, aerialMul: 1.0, defend: 0.6, rush: 1.1, control: 0.7 },
  team:         { boostMul: 1.0, flipMul: 0.9, aerialMul: 0.9, defend: 1.0, rush: 0.7, control: 1.2 },
  beginner:     { boostMul: 0.7, flipMul: 0.3, aerialMul: 0.2, defend: 0.8, rush: 0.6, control: 0.5 },
};

export const AI_PLAYSTYLES = Object.keys(PLAYSTYLE);

export class AICar {
  constructor(vehicle, difficulty = "medium", style = "balanced") {
    this.v = vehicle;
    this.diff = DIFF[difficulty] || DIFF.medium;
    this.style = style;
    this.ps = PLAYSTYLE[style] || PLAYSTYLE.balanced;
    this.name = difficulty + "/" + style;
    this.attackDir = vehicle.team === "blue" ? 1 : -1; // direction toward opponent goal
    this._reactT = 0;
    this._flipArmed = false;
    this._flipCd = 0;
    this._jumpCd = 0;
    this._target = { x: vehicle.x, y: vehicle.y };
    this._rng = Math.random;
  }

  think(dt, world) {
    const v = this.v, ball = world.ball, A = world.arena;
    const d = this.diff, ps = this.ps;
    this._reactT -= dt; this._flipCd -= dt; this._jumpCd -= dt;

    const dir = this.attackDir;
    const errX = (this._rng() * 2 - 1) * d.err;
    // ideal contact point: behind the ball, opposite the attack goal
    let targetX = ball.x - dir * (ball.r + v.hw + 14) + errX;
    let targetY = ball.y - 4;

    const ownGoalX = dir > 0 ? 0 : A.W;
    const ballToOwn = Math.abs(ball.x - ownGoalX);
    const ballHeadingToOwn = Math.sign(ball.vx) === -dir;

    // DEFENSIVE playstyle: prioritise clearing the ball away from own goal
    if ((ballToOwn < A.W * (0.34 * ps.defend) || (ballHeadingToOwn && ballToOwn < A.W * 0.5)) && this._rng() < ps.defend) {
      targetX = ball.x + dir * (ball.r + v.hw + 34); // push it toward opponent
    }

    // CONTROL playstyle: hold position on the ball, don't over-commit
    if (ps.control > 1.2 && Math.abs(ball.x - v.x) < ball.r + v.hw + 30 && ball.speed < 700) {
      targetX = ball.x - dir * (ball.r + v.hw + 8);
    }

    const intent = { throttle: 0, jump: false, jumpPressed: false, boost: false, resetPressed: false, pausePressed: false, dodgeDir: 0, source: "ai" };

    // recompute target periodically (reaction delay)
    if (this._reactT <= 0) {
      this._target.x = targetX; this._target.y = targetY;
      this._reactT = d.react;
    }

    const dx = this._target.x - v.x;
    if (Math.abs(dx) > 12) intent.throttle = Math.sign(dx);
    else intent.throttle = 0;

    const distToBall = Math.hypot(ball.x - v.x, ball.y - v.y);
    const behind = Math.sign(ball.x - v.x) === dir;
    const aligned = Math.abs(ball.x - v.x) < ball.r + v.hw + 24;

    // vertical: jump for aerials if ball is clearly above us
    const ballAbove = ball.y - v.y > v.hh + ball.r + 14;
    const aerialChance = clamp01(d.aerial * ps.aerialMul);
    if (ballAbove && v.onGround && this._jumpCd <= 0 && this._rng() < aerialChance) {
      intent.jump = true; intent.jumpPressed = true;
      this._jumpCd = 0.9;
      this._flipArmed = false;
    }

    // charging the ball on the ground
    const boostChance = clamp01(d.boost * ps.boostMul);
    if (v.onGround && behind && aligned && distToBall < ball.r + v.hh + 70) {
      intent.boost = this._rng() < boostChance;
      // commit to a flip
      const flipChance = clamp01(d.flip * ps.flipMul);
      if (this._flipCd <= 0 && this._rng() < flipChance) {
        intent.jump = true; intent.jumpPressed = true;
        this._flipArmed = true; this._wantFlip = dir;
        this._flipCd = 1.1; this._jumpCd = 0.9;
      }
    }

    // airborne flip follow-through
    if (!v.onGround && this._flipArmed && v.canFlip && v.airTime > 0.14) {
      intent.jump = true; intent.jumpPressed = true; intent.dodgeDir = this._wantFlip;
      intent.boost = this._rng() < boostChance;
      this._flipArmed = false;
    }

    // boost toward goal when airborne with ball above (aerial playstyle loves this)
    if (!v.onGround && ballAbove && this._rng() < boostChance) intent.boost = true;

    // RUSH playstyle: boost toward goal even without perfect alignment
    if (ps.rush > 1.2 && v.onGround && behind && distToBall < ball.r + v.hh + 110 && this._rng() < boostChance * 0.7) {
      intent.boost = true;
    }

    // speed limiting: don't over-boost when already fast on ground
    if (v.onGround && v.speed > v.def.shape.maxSpeed * d.speed) intent.boost = false;

    // recover if stuck upside down on ground
    if (v.onGround && Math.abs(Math.sin(v.angle)) > 0.6 && this._jumpCd <= 0) {
      intent.jump = true; intent.jumpPressed = true; this._jumpCd = 0.6;
    }

    return intent;
  }
}

function clamp01(x) { return Math.max(0, Math.min(1, x)); }
