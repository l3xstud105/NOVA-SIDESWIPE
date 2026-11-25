// replay.js — match recording playback engine.
// Reconstructs a match from recorded snapshots (world.frames) and renders it
// with its own camera + controls. A replay replays the ACTUAL recorded frames,
// not a canned animation.

import { clamp, lerp } from "../core/math.js";

export class ReplayPlayer {
  constructor(frames, arena, opts = {}) {
    this.frames = frames || [];
    this.arena = arena;
    this.canvas = opts.canvas;
    this.dpr = opts.dpr || 1;
    this.onEvent = opts.onEvent || (() => {});
    this.speed = 1; // 0.25, 0.5, 1, 1.5, 2
    this.playing = false;
    this.index = 0;
    this.cam = { x: arena.W / 2, y: arena.H / 2, scale: 1, shake: 0, sx: 0, sy: 0 };
    this._lastScore = { blue: 0, orange: 0 };
    this._cw = 0; this._ch = 0;
    this._goals = []; // indices of goal frames
    this._duration = 0;
    this._buildGoalMarkers();
  }

  get duration() { return this._duration; }
  get currentTime() { return this.frames[this.index] ? this.frames[this.index].t : 0; }
  // progress is index-based so it is correct whether the clock counts up or down
  get progress() { return this.frames.length > 1 ? this.index / (this.frames.length - 1) : 0; }

  _buildGoalMarkers() {
    this._goals = [];
    this._lastScore = { blue: 0, orange: 0 };
    // match clock may count down; duration = max recorded time (match length)
    let maxT = 0;
    for (let i = 0; i < this.frames.length; i++) {
      const f = this.frames[i];
      if (f.t > maxT) maxT = f.t;
      const s = f.score;
      if (s.blue > this._lastScore.blue || s.orange > this._lastScore.orange) {
        this._goals.push({ index: i, team: s.blue > this._lastScore.blue ? "blue" : "orange" });
      }
      this._lastScore = { ...s };
    }
    this._duration = maxT;
    // reset so playback re-detects
    this._lastScore = { blue: 0, orange: 0 };
  }

  play() { this.playing = true; }
  pause() { this.playing = false; }
  toggle() { this.playing ? this.pause() : this.play(); }
  setSpeed(s) { this.speed = s; }

  seekToIndex(i) {
    this.index = clamp(i, 0, Math.max(0, this.frames.length - 1));
    this._emitGoalIfNeeded();
  }
  seek(t) {
    if (!this.frames.length) return;
    // binary search nearest frame
    let lo = 0, hi = this.frames.length - 1, best = 0, bestD = Infinity;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const d = Math.abs(this.frames[mid].t - t);
      if (d < bestD) { bestD = d; best = mid; }
      if (this.frames[mid].t < t) lo = mid + 1; else hi = mid - 1;
    }
    this.seekToIndex(best);
  }

  _emitGoalIfNeeded() {
    if (!this.frames.length) return;
    const f = this.frames[this.index];
    if (!f) return;
    if (f.score.blue > this._lastScore.blue) { this._lastScore.blue = f.score.blue; this.onEvent({ type: "goal", team: "blue", index: this.index }); }
    if (f.score.orange > this._lastScore.orange) { this._lastScore.orange = f.score.orange; this.onEvent({ type: "goal", team: "orange", index: this.index }); }
  }

  update(dt) {
    if (!this.playing || this.frames.length < 2) return;
    const fps = 60;
    const step = Math.max(1, Math.round(fps * this.speed * dt));
    this.index += step;
    if (this.index >= this.frames.length - 1) {
      this.index = this.frames.length - 1;
      this.playing = false;
      this.onEvent({ type: "end" });
      return;
    }
    this._emitGoalIfNeeded();
  }

  resize(cw, ch) {
    this._cw = cw; this._ch = ch;
    const pad = 40;
    const s = Math.min((cw - pad * 2) / this.arena.W, (ch - pad * 2) / this.arena.H);
    this.cam.scale = lerp(this.cam.scale || s, s, 0.5);
    this.cam.x = this.arena.W / 2;
    this.cam.y = this.arena.H / 2;
  }

  render(ctx, cw, ch) {
    this.resize(cw, ch);
    const A = this.arena;
    const f = this.frames[this.index] || this.frames[0];
    if (!f) return;
    ctx.save();
    ctx.clearRect(0, 0, cw, ch);

    // background
    const bg = ctx.createLinearGradient(0, 0, 0, ch);
    bg.addColorStop(0, A.bgAccent);
    bg.addColorStop(0.6, A.bg);
    bg.addColorStop(1, "#02030a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, ch);

    const s = this.cam.scale;
    const ox = cw / 2 - this.cam.x * s;
    const oy = ch / 2 + this.cam.y * s;
    const W2S = (wx, wy) => ({ x: ox + wx * s, y: oy - wy * s });

    // arena
    this._drawArena(ctx, W2S, s, A);

    // ball
    if (f.ball) this._drawBall(ctx, W2S, s, f.ball);

    // vehicles
    for (const v of f.v || []) this._drawVehicle(ctx, W2S, s, v);

    ctx.restore();
  }

  _drawArena(ctx, W2S, s, A) {
    const corners = [W2S(0, 0), W2S(A.W, 0), W2S(A.W, A.H), W2S(0, A.H)];
    ctx.fillStyle = A.floor;
    ctx.beginPath();
    for (const c of corners) c === corners[0] ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y);
    ctx.closePath(); ctx.fill();

    const fl0 = W2S(0, 0), fl1 = W2S(A.W, 0);
    ctx.strokeStyle = A.floorEdge; ctx.lineWidth = 4 * s; ctx.shadowColor = A.floorEdge; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.moveTo(fl0.x, fl0.y); ctx.lineTo(fl1.x, fl1.y); ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = A.wallEdge; ctx.lineWidth = 3 * s;
    const wl0 = W2S(0, 0), wl1 = W2S(0, A.H), wr0 = W2S(A.W, 0), wr1 = W2S(A.W, A.H), wc0 = W2S(0, A.H), wc1 = W2S(A.W, A.H);
    ctx.beginPath(); ctx.moveTo(wl0.x, wl0.y); ctx.lineTo(wl1.x, wl1.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wr0.x, wr0.y); ctx.lineTo(wr1.x, wr1.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wc0.x, wc0.y); ctx.lineTo(wc1.x, wc1.y); ctx.stroke();

    const cl0 = W2S(A.W / 2, 0), cl1 = W2S(A.W / 2, A.H);
    ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 2 * s;
    ctx.setLineDash([8 * s, 8 * s]);
    ctx.beginPath(); ctx.moveTo(cl0.x, cl0.y); ctx.lineTo(cl1.x, cl1.y); ctx.stroke();
    ctx.setLineDash([]);

    this._drawGoal(ctx, W2S, s, A, "left");
    this._drawGoal(ctx, W2S, s, A, "right");
  }

  _drawGoal(ctx, W2S, s, A, side) {
    const gh = A.goalHeight, gd = A.goalDepth;
    const x = side === "left" ? 0 : A.W;
    const inner = side === "left" ? gd : A.W - gd;
    const p0 = W2S(x, 0), p1 = W2S(x, gh), p2 = W2S(inner, gh), p3 = W2S(inner, 0);
    const col = side === "left" ? "rgba(255,154,60,0.22)" : "rgba(44,227,255,0.22)";
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = side === "left" ? A.crowd : A.floorEdge; ctx.lineWidth = 4 * s;
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.stroke();
    ctx.shadowBlur = 0;
  }

  _drawBall(ctx, W2S, s, b) {
    const c = W2S(b.x, b.y);
    const r = 27 * s;
    ctx.save();
    ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 18;
    const g = ctx.createRadialGradient(c.x - r * 0.3, c.y - r * 0.3, 2, c.x, c.y, r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.7, "#dfe7ff");
    g.addColorStop(1, "#9fb0d8");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(c.x, c.y); ctx.rotate(b.spin);
    ctx.strokeStyle = "rgba(40,60,110,0.7)"; ctx.lineWidth = 1.5 * s;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  _drawVehicle(ctx, W2S, s, v) {
    const c = W2S(v.x, v.y);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(-v.a);
    const hw = 32, hh = 13;
    const team = v.t === "blue" ? "#2ce3ff" : "#ff9a3c";
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = team;
    ctx.beginPath(); ctx.ellipse(0, hh * 0.9, hw * 1.1, hh * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (v.flip) {
      const fl = (8 + Math.random() * 10) * s;
      const fg = ctx.createLinearGradient(-hw - fl, 0, -hw, 0);
      fg.addColorStop(0, "rgba(255,210,75,0)");
      fg.addColorStop(1, "#ffd24b");
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(-hw, -hh * 0.4); ctx.lineTo(-hw - fl, 0); ctx.lineTo(-hw, hh * 0.4);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = team;
    roundRect(ctx, -hw, -hh, hw * 2, hh * 2, hh * 0.7); ctx.fill();
    ctx.fillStyle = "#0c1020";
    roundRect(ctx, -hw * 0.15, -hh * 0.1, hw * 0.7, hh * 1.2, hh * 0.4); ctx.fill();
    ctx.fillStyle = "rgba(120,200,255,0.55)";
    roundRect(ctx, hw * 0.08, -hh * 0.02, hw * 0.42, hh * 0.9, hh * 0.3); ctx.fill();
    const wr = 9 * s;
    for (const wx of [-hw * 0.55, hw * 0.55]) {
      ctx.fillStyle = "#23283a"; ctx.beginPath(); ctx.arc(wx, hh * 0.95, wr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = team; ctx.beginPath(); ctx.arc(wx, hh * 0.95, wr * 0.45, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  destroy() { this.playing = false; }
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
