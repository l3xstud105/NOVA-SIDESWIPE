// ball.js — dedicated ball physics (gravity, bounce, collision events)
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
    this.spin = 0;
    this.lastTouch = null;   // 'blue' | 'orange'
    this.lastTouchId = null;
  }

  kick(vx, vy) { this.vx = vx; this.vy = vy; }

  // returns { floor: bool, wall: bool, ceiling: bool } for events this step
  update(dt, env, sfx) {
    const A = this.arena;
    this.vy -= env.gravity * dt;
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
      if (this.vy < 0) { this.vy = -this.vy * eG; ev.floor = true; if (sfx) sfx.wall(Math.abs(this.vy) / 400 + 0.3); }
      if (Math.abs(this.vy) < 50) this.vy = 0;
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
