// ball.js — dedicated ball physics (gravity, bounce, Magnus spin, collision events)
import { PHYS, BALL_RADIUS } from "./config.js";

export class Ball {
  constructor(arena) {
    this.arena = arena;
    this.r = BALL_RADIUS;
    this.mass = 1;
    this.reset();
  }

  reset(x, y) {
    const A = this.arena;
    this.x = x ?? A.W / 2;
    this.y = y ?? A.H * 0.72;
    this.vx = 0; this.vy = 0;
    this.spin = 0;          // angular velocity (visual + Magnus source)
    this.lastTouch = null;  // 'blue' | 'orange'
    this.lastTouchId = null;
    this.carryTimer = 0;    // how long the ball has been held against a car
  }

  kick(vx, vy) { this.vx = vx; this.vy = vy; }

  // impart spin from an off-center car hit: offset (-1..1 across the car face)
  // and the contact normal drive the spin direction.
  applySpin(amount) { this.spin += amount; }

  // returns { floor: bool, wall: bool, ceiling: bool } for events this step
  update(dt, env, sfx) {
    const A = this.arena;
    this.vy -= env.gravity * dt;

    // ---- Magnus effect: spin curves the ball's path ----
    // Force is perpendicular to velocity, proportional to spin. Gives slices/hooks.
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 40 && Math.abs(this.spin) > 8) {
      // perpendicular direction (rotate velocity 90deg), sign from spin
      const px = -this.vy / speed, py = this.vx / speed;
      const magnus = this.spin * PHYS.BALL_MAGNUS * dt;
      this.vx += px * magnus;
      this.vy += py * magnus;
    }

    // spin decays in the air and faster on ground contact
    this.spin *= Math.max(0, 1 - 0.6 * dt);

    const drag = Math.max(0, 1 - 0.04 * dt);
    this.vx *= drag; this.vy *= drag;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.spin += this.vx * dt * 0.02;

    const ev = { floor: false, wall: false, ceiling: false };
    const eW = PHYS.RESTITUTION_WALL;
    const eG = PHYS.RESTITUTION_GROUND;

    // ground
    if (this.y - this.r <= 0) {
      this.y = this.r;
      if (this.vy < 0) {
        // only count a real bounce on a significant impact; tiny velocities just rest
        if (Math.abs(this.vy) > 40) {
          this.vy = -this.vy * eG;
          // ground contact bleeds spin into a roll and damps sideways spin
          this.spin *= 0.9;
          ev.floor = true;
          if (sfx) sfx.wall(Math.abs(this.vy) / 400 + 0.3);
        } else {
          this.vy = 0;
        }
      }
    }
    // ceiling
    if (this.y + this.r >= A.H) {
      this.y = A.H - this.r;
      if (this.vy > 0) { this.vy = -this.vy * eW; ev.ceiling = true; if (sfx) sfx.wall(Math.abs(this.vy) / 400 + 0.3); }
    }
    // left wall
    if (this.x - this.r <= 0) {
      this.x = this.r;
      if (this.vx < 0) { this.vx = -this.vx * eW; ev.wall = true; if (sfx) sfx.wall(Math.abs(this.vx) / 400 + 0.3); }
    }
    // right wall
    if (this.x + this.r >= A.W) {
      this.x = A.W - this.r;
      if (this.vx > 0) { this.vx = -this.vx * eW; ev.wall = true; if (sfx) sfx.wall(Math.abs(this.vx) / 400 + 0.3); }
    }
    return ev;
  }
}
