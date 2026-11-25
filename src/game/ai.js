// ai.js — intelligent opponent that drives the same Vehicle physics as players.
// Difficulty scales reaction, accuracy, boost usage, aerials and flip frequency.

const DIFF = {
  easy:   { react: 0.18, err: 46, boost: 0.35, flip: 0.15, aerial: 0.0,  speed: 0.82 },
  medium: { react: 0.10, err: 22, boost: 0.7,  flip: 0.45, aerial: 0.4,  speed: 0.95 },
  hard:   { react: 0.05, err: 8,  boost: 0.95, flip: 0.8,  aerial: 0.85, speed: 1.0  },
};

export class AICar {
  constructor(vehicle, difficulty = "medium") {
    this.v = vehicle;
    this.diff = DIFF[difficulty] || DIFF.medium;
    this.name = difficulty;
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
    const d = this.diff;
    this._reactT -= dt; this._flipCd -= dt; this._jumpCd -= dt;

    const dir = this.attackDir;
    const errX = (this._rng() * 2 - 1) * d.err;
    // ideal contact point: behind the ball, opposite the attack goal
    let targetX = ball.x - dir * (ball.r + v.hw + 14) + errX;
    let targetY = ball.y - 4;

    // intercept if ball is close to our own goal and rolling toward it
    const ownGoalX = dir > 0 ? 0 : A.W;
    const ballToOwn = Math.abs(ball.x - ownGoalX);
    if (ballToOwn < A.W * 0.28 && Math.sign(ball.vx) === -dir && this._rng() < 0.5) {
      targetX = ball.x + dir * (ball.r + v.hw + 30); // push it away from own goal
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
    const behind = Math.sign(ball.x - v.x) === dir; // we are on the correct side
    const aligned = Math.abs(ball.x - v.x) < ball.r + v.hw + 24;

    // vertical: jump for aerials if ball is clearly above us
    const ballAbove = ball.y - v.y > v.hh + ball.r + 14;
    if (ballAbove && v.onGround && this._jumpCd <= 0 && this._rng() < d.aerial) {
      intent.jump = true; intent.jumpPressed = true;
      this._jumpCd = 0.9;
      this._flipArmed = false;
    }

    // charging the ball on the ground
    if (v.onGround && behind && aligned && distToBall < ball.r + v.hh + 70) {
      intent.boost = this._rng() < d.boost;
      // commit to a flip
      if (this._flipCd <= 0 && this._rng() < d.flip) {
        intent.jump = true; intent.jumpPressed = true;
        this._flipArmed = true; this._wantFlip = dir;
        this._flipCd = 1.1; this._jumpCd = 0.9;
      }
    }

    // airborne flip follow-through
    if (!v.onGround && this._flipArmed && v.canFlip && v.airTime > 0.14) {
      intent.jump = true; intent.jumpPressed = true; intent.dodgeDir = this._wantFlip;
      intent.boost = this._rng() < d.boost;
      this._flipArmed = false;
    }

    // boost toward goal when we have a good angle and are airborne with ball above
    if (!v.onGround && ballAbove && this._rng() < d.boost) intent.boost = true;

    // speed limiting: don't over-boost when already fast on ground
    if (v.onGround && v.speed > v.def.shape.maxSpeed * d.speed) intent.boost = false;

    // recover if stuck upside down on ground
    if (v.onGround && Math.abs(Math.sin(v.angle)) > 0.6 && this._jumpCd <= 0) {
      intent.jump = true; intent.jumpPressed = true; this._jumpCd = 0.6;
    }

    return intent;
  }
}
