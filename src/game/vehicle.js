// vehicle.js — Sideswipe-style vehicle physics (side view)
import { PHYS } from "./config.js";
import { clamp, angLerp } from "../core/math.js";

const NOOP_EMIT = {
  boost() {}, flipReset() {}, impact() {}, touch() {}, trail() {},
};

export class Vehicle {
  constructor(opts) {
    this.id = opts.id;
    this.team = opts.team; // 'blue' | 'orange'
    this.isPlayer = !!opts.isPlayer;
    this.name = opts.name || "Player";
    this.def = opts.vehicleDef;
    this.cosmetics = opts.cosmetics || {};
    this.emit = opts.emit || NOOP_EMIT;
    this.sfx = opts.sfx || null;

    this.x = opts.x; this.y = opts.y;
    this.vx = 0; this.vy = 0;
    this.angle = opts.angle || 0;
    this.angVel = 0;
    this.onGround = false;
    this.groundNormal = { x: 0, y: 1 };
    this.canFlip = true;
    this.boost = 100;
    this.maxBoost = 100;
    this.flipping = false;
    this.flipTimer = 0;
    this.facing = 1;
    this.boostActive = false;
    this.flipResetReady = false;
    this.airTime = 0;
    this.touchTimer = 0;
    this._wasGround = false;

    const s = this.def.shape;
    this.hw = s.length / 2;          // half length (capsule segment)
    this.hh = s.height / 2;          // half height (capsule radius)
    this.mass = 3.2 * this.def.stats.mass;
  }

  get center() { return { x: this.x, y: this.y }; }
  get speed() { return Math.hypot(this.vx, this.vy); }

  // capsule axis direction
  _axis() { return { x: Math.cos(this.angle), y: Math.sin(this.angle) }; }

  controlPhase(dt, intent, env) {
    const st = this.def.stats;
    const g = env.gravity;
    const wasGround = this.onGround;

    // flip countdown
    if (this.flipping) {
      this.flipTimer -= dt;
      if (this.flipTimer <= 0) { this.flipping = false; }
    }

    // ----- JUMP / DOUBLE JUMP / DODGE -----
    if (intent.jumpPressed) {
      if (this.onGround) {
        // jump straight up along world-up (independent of tilt for control feel)
        this.vy += PHYS.JUMP_VEL;
        this.onGround = false;
        this.canFlip = true;
        this.flipping = false;
        if (this.sfx) this.sfx.jump();
      } else if (this.canFlip) {
        if (intent.dodgeDir === 0) {
          // neutral double jump
          this.vy += PHYS.DOUBLE_JUMP_VEL;
          this.canFlip = false;
          if (this.sfx) this.sfx.doubleJump();
        } else {
          // directional flip (dodge)
          this.flipping = true;
          this.flipTimer = PHYS.FLIP_DURATION;
          this.angVel = PHYS.FLIP_ANGVEL * intent.dodgeDir;
          this.vx += intent.dodgeDir * PHYS.FLIP_IMPULSE;
          this.vy += PHYS.FLIP_UP;
          this.canFlip = false;
          if (this.sfx) this.sfx.dodge();
        }
      }
    }

    // ----- BOOST -----
    this.boostActive = false;
    if (intent.boost && this.boost > 0) {
      const ax = Math.cos(this.angle), ay = Math.sin(this.angle);
      const a = PHYS.BOOST_ACCEL * st.boost;
      this.vx += ax * a * dt;
      this.vy += ay * a * dt;
      this.boost = Math.max(0, this.boost - PHYS.BOOST_DRAIN * dt);
      this.boostActive = true;
      const sp = this.speed;
      if (sp > 200 && Math.random() < 0.6) {
        this.emit.boost(this.x - ax * this.hw, this.y - ay * this.hw, -ax, -ay, this.cosmetics.boostColor);
      }
    }

    // ----- GROUND VS AIR CONTROL -----
    if (this.onGround && !this.flipping) {
      // animation-cancel: on the ground, restore flip control — but only when
      // the player is NOT holding a directional input away from the surface.
      // Holding a direction preserves the flip (reference exception).
      if (!intent.throttle && !intent.dodgeDir) this.canFlip = true;
      const n = this.groundNormal;
      const tangent = { x: n.y, y: -n.x }; // surface tangent, +x-ish
      const dir = intent.throttle;
      if (dir !== 0) {
        this.facing = dir;
        const a = PHYS.DRIVE_ACCEL * st.drive;
        this.vx += tangent.x * dir * a * dt;
        this.vy += tangent.y * dir * a * dt;
        // cap tangential speed
        const tv = this.vx * tangent.x + this.vy * tangent.y;
        const cap = PHYS.MAX_DRIVE_SPEED;
        if (tv > cap) { this.vx -= tangent.x * (tv - cap); this.vy -= tangent.y * (tv - cap); }
        if (tv < -cap) { this.vx -= tangent.x * (tv + cap); this.vy -= tangent.y * (tv + cap); }
      } else {
        // friction along tangent
        const tv = this.vx * tangent.x + this.vy * tangent.y;
        const f = Math.max(0, 1 - PHYS.GROUND_FRICTION * dt);
        const newTv = tv * f;
        this.vx += tangent.x * (newTv - tv);
        this.vy += tangent.y * (newTv - tv);
      }
      // orient so the car's "up" (-sin a, cos a) aligns with the surface normal
      const target = Math.atan2(-n.x, n.y);
      this.angle = angLerp(this.angle, target, clamp(PHYS.GROUND_TURN_EASE * dt, 0, 1));
      this.angVel = 0;
    } else if (!this.flipping) {
      // air control: rotate + horizontal nudge, with boost-steer and a gentle
      // auto-level assist so aerials stay controllable.
      if (intent.throttle !== 0) {
        this.angVel += intent.throttle * PHYS.AIR_TORQUE * dt;
        this.angVel = clamp(this.angVel, -PHYS.AIR_MAX_ANGVEL, PHYS.AIR_MAX_ANGVEL);
        const steer = this.boostActive ? PHYS.AERIAL_DRIVE_BOOST : PHYS.AERIAL_DRIVE;
        this.vx += intent.throttle * steer * dt;
      } else {
        // gentle self-righting toward upright (angle 0) when no air input
        const upright = -this.angle;
        this.angVel += upright * PHYS.AIR_AUTO_LEVEL * dt;
        this.angVel *= Math.max(0, 1 - PHYS.AIR_DAMP * dt);
      }
    }

    // ----- GRAVITY -----
    if (!this.onGround) {
      this.vy -= g * dt;
      this.airTime += dt;
    } else {
      this.airTime = 0;
    }

    // passive boost regen
    this.boost = Math.min(this.maxBoost, this.boost + PHYS.BOOST_REGEN * dt);

    // ----- DRAG + SPEED CAP -----
    const drag = Math.max(0, 1 - PHYS.AIR_DRAG * dt);
    this.vx *= drag; this.vy *= drag;
    const maxS = this.boostActive ? PHYS.BOOST_MAX_SPEED : PHYS.MAX_DRIVE_SPEED + 80;
    const sp = this.speed;
    if (sp > maxS) { const k = maxS / sp; this.vx *= k; this.vy *= k; }

    // ----- INTEGRATE -----
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.angVel * dt;
    // wheel spin follows forward speed (drives rotation + suspension squash)
    const ax = Math.cos(this.angle);
    const fwd = this.vx * ax + this.vy * Math.sin(this.angle);
    this.wheelSpin += (fwd / Math.max(20, PHYS.MAX_DRIVE_SPEED)) * dt * 6;
    if (this.touchTimer > 0) this.touchTimer -= dt;

    // ----- WORLD CONTACT -----
    this._resolveWorld(env.arena);

    // contact-start event → end any active flip duration. The flip itself is
    // restored by the animation-cancel below, EXCEPT when the player holds a
    // directional input away from the landing surface (reference behavior:
    // auto-correct does not force the flip back in that case).
    if (this.onGround && !wasGround) {
      this.flipping = false;
    }
  }

  _resolveWorld(arena) {
    const a = this._axis();
    const extX = this.hw * Math.abs(a.x) + this.hh;
    const extY = this.hw * Math.abs(a.y) + this.hh;
    let contact = false;
    let normal = this.groundNormal;

    // floor
    if (this.y - extY <= 0) {
      this.y = extY; if (this.vy < 0) this.vy = 0;
      contact = true; normal = { x: 0, y: 1 };
    }
    // ceiling
    if (this.y + extY >= arena.H) {
      this.y = arena.H - extY; if (this.vy > 0) this.vy = 0;
      contact = true; normal = { x: 0, y: -1 };
    }
    // left wall
    if (this.x - extX <= 0) {
      this.x = extX; if (this.vx < 0) this.vx = 0;
      contact = true; normal = { x: 1, y: 0 };
    }
    // right wall
    if (this.x + extX >= arena.W) {
      this.x = arena.W - extX; if (this.vx > 0) this.vx = 0;
      contact = true; normal = { x: -1, y: 0 };
    }

    this.groundNormal = normal;
    this.onGround = contact;
  }

  // capsule-vs-circle resolution with the ball
  collideBall(ball, env) {
    const a = this._axis();
    const cx = this.x, cy = this.y;
    // closest point on capsule segment to ball
    const bx = ball.x - cx, by = ball.y - cy;
    let t = (bx * a.x + by * a.y) / this.hw;
    t = clamp(t, -1, 1);
    const px = cx + a.x * t * this.hw;
    const py = cy + a.y * t * this.hw;
    let dx = ball.x - px, dy = ball.y - py;
    let dist = Math.hypot(dx, dy);
    const minDist = this.hh + ball.r;
    if (dist >= minDist) return false;

    if (dist < 1e-4) { dx = 0; dy = -1; dist = 1; }
    const nx = dx / dist, ny = dy / dist; // normal from car to ball

    // separate
    const pen = minDist - dist;
    ball.x += nx * pen;
    ball.y += ny * pen;

    // relative velocity along normal
    const rvx = ball.vx - this.vx, rvy = ball.vy - this.vy;
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      const e = PHYS.RESTITUTION_CAR;
      const invCar = 1 / this.mass;
      const invBall = 1 / ball.mass;
      const j = (-(1 + e) * vn) / (invCar + invBall);
      ball.vx += (j * invBall) * nx;
      ball.vy += (j * invBall) * ny;
      this.vx -= (j * invCar) * nx;
      this.vy -= (j * invCar) * ny;
    }
    // extra "kick" from car speed for shooting feel
    const carSpeed = this.speed;
    const kick = carSpeed * PHYS.BALL_EXTRA_KICK + (this.boostActive ? 120 : 0);
    ball.vx += nx * kick;
    ball.vy += ny * kick;

    // off-center spin: the tangential car velocity at the contact point curves the
    // ball (slice/hook). Off-center hits (|t| large) impart more spin.
    const tanX = -ny, tanY = nx; // tangent (perp to contact normal)
    const vTan = this.vx * tanX + this.vy * tanY; // car velocity along tangent at contact
    ball.applySpin(vTan * PHYS.BALL_SPIN_KICK * (1 + Math.abs(t)));

    // dribble carry: when the ball is pressed against the car and not flying away,
    // let the car drag it along for a natural "carry" instead of an instant bounce.
    const relN = (ball.vx - this.vx) * nx + (ball.vy - this.vy) * ny;
    if (relN < 240) {
      const carry = (1 - PHYS.BALL_CARRY_DRAG);
      ball.vx += (this.vx - ball.vx) * carry;
      ball.vy += (this.vy - ball.vy) * carry;
      ball.carryTimer = 0.12;
    } else {
      ball.carryTimer = 0;
    }

    // sounds + particles
    const intensity = Math.min(2, Math.abs(vn) / 600 + carSpeed / 1400 + 0.2);
    if (this.sfx) this.sfx.impact(intensity);
    this.emit.impact(ball.x - nx * ball.r, ball.y - ny * ball.r, intensity, this.team);
    this.touchTimer = 0.4;
    ball.lastTouch = this.team;
    ball.lastTouchId = this.id;

    // flip reset: ball contacts car's underside while airborne
    if (!this.onGround && ny > 0.35) {
      if (!this.canFlip) this.flipResetReady = true;
      this.canFlip = true;
      this.boost = Math.min(this.maxBoost, this.boost + PHYS.FLIP_RESET_BOOST);
      this.emit.flipReset(this.x, this.y, this.cosmetics.boostColor);
    }
    return true;
  }

  reset(x, y, angle = 0) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.angle = angle; this.angVel = 0;
    this.wheelSpin = 0;
    this.onGround = false; this.canFlip = true; this.flipping = false;
    this.facing = 1; this.airTime = 0; this.touchTimer = 0;
  }
}
