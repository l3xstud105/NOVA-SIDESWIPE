// world.js — simulation orchestration, camera, particles, and all rendering
import { Vehicle } from "./vehicle.js";
import { Ball } from "./ball.js";
import { Match } from "./match.js";
import { AICar } from "./ai.js";
import { getArena } from "../data/arenas.js";
import { clamp, lerp } from "../core/math.js";

export class World {
  constructor(config) {
    this.cfg = config;
    this.arena = getArena(config.arenaId);
    this.input = config.input;
    this.sfx = config.sfx || null;
    this.record = !!config.record;
    this.frames = [];
    this.paused = false;
    // graphics quality flags (from src/core/quality.js)
    this.quality = config.quality || { particles: 1, shadows: true, lighting: true, postFX: true };

    this.ball = new Ball(this.arena);

    // build vehicles
    this.vehicles = [];
    this.ais = [];
    config.players.forEach((p, i) => {
      const v = new Vehicle({
        id: "v" + i,
        team: p.team,
        isPlayer: !!p.isPlayer,
        name: p.name || (p.isPlayer ? "You" : "CPU"),
        vehicleDef: p.def,
        cosmetics: p.cosmetics || {},
        x: this.arena.W / 2, y: 200,
        emit: this._emitter(),
        sfx: this.sfx,
      });
      v.controlScheme = p.control || "p1";
      v.profileId = p.profileId || null;
      this.vehicles.push(v);
      if (!p.isPlayer) this.ais.push(new AICar(v, p.difficulty || "medium", p.style || "balanced"));
    });

    this.match = new Match({ mode: config.mode, arena: this.arena, ball: this.ball, vehicles: this.vehicles });

    // boost pads
    this.pads = [];
    const padCount = 4;
    for (let i = 0; i < padCount; i++) {
      const x = this.arena.W * ((i + 1) / (padCount + 1));
      this.pads.push({ x, y: 30, r: 34, active: true });
    }

    // camera
    this.cam = { x: this.arena.W / 2, y: this.arena.H / 2, scale: 1, shake: 0, sx: 0, sy: 0 };
    this.particles = [];
    this.ambient = [];
    this._ambientTimer = 0;
    this.time = 0;
    this._initRenderState();
    this._seedAmbient();
  }

  _initRenderState() {
    // hoops/volleyball visuals handled in render based on match cfg
  }

  // ---- ambient weather / environment particles ----
  _seedAmbient() {
    this.ambient.length = 0;
    const e = this.arena.effects;
    if (!e || e.type === "none") return;
    const n = Math.round(60 * (e.density || 0.5) * (this.quality.particles || 1));
    for (let i = 0; i < n; i++) this._spawnAmbient(true);
  }

  _spawnAmbient(initial = false) {
    const A = this.arena;
    const e = A.effects;
    if (!e || e.type === "none") return;
    const x = initial ? Math.random() * A.W : A.W + 20 + Math.random() * 80;
    const y = initial ? Math.random() * A.H : Math.random() * A.H;
    let vx = -20 - Math.random() * 30;      // drift left by default
    let vy = 30 + Math.random() * 40;       // drift down
    let size = 2 + Math.random() * 3;
    let spin = (Math.random() - 0.5) * 4;
    let gravity = 0;
    switch (e.type) {
      case "rain":   vx = -60 - Math.random() * 40; vy = 500 + Math.random() * 200; size = 1 + Math.random() * 2; break;
      case "snow":   vx = -15 + Math.random() * 30; vy = 25 + Math.random() * 30; size = 2 + Math.random() * 3; spin = (Math.random() - 0.5) * 2; break;
      case "sparks": vx = -40 - Math.random() * 50; vy = 20 + Math.random() * 40; gravity = 30; break;
      case "embers": vx = -25 + Math.random() * 50; vy = -20 - Math.random() * 40; gravity = -10; break;
      case "leaves": vx = -30 + Math.random() * 60; vy = 30 + Math.random() * 30; spin = (Math.random() - 0.5) * 6; gravity = 20; break;
      case "motes":  vx = -10 + Math.random() * 20; vy = -10 + Math.random() * 20; size = 1.5 + Math.random() * 2.5; break;
      case "confetti": vx = -40 - Math.random() * 60; vy = 40 + Math.random() * 40; spin = (Math.random() - 0.5) * 10; gravity = 60; size = 3 + Math.random() * 3; break;
      case "petals": vx = -25 + Math.random() * 50; vy = 25 + Math.random() * 35; spin = (Math.random() - 0.5) * 5; gravity = 15; break;
    }
    this.ambient.push({ x, y, vx, vy, size, spin, gravity, color: e.color, life: 1, maxLife: 1 });
  }

  _updateAmbient(dt) {
    const A = this.arena;
    const e = A.effects;
    if (!e || e.type === "none") return;
    const ps = this.ambient;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.spin += p.spin * dt;
      // recycle when off-screen
      if (p.x < -30 || p.y > A.H + 30 || p.y < -60) {
        ps.splice(i, 1);
        this._spawnAmbient(false);
      }
    }
    // cap density by quality
    const cap = Math.round(80 * (e.density || 0.5) * (this.quality.particles || 1));
    if (ps.length < cap) {
      this._ambientTimer -= dt;
      if (this._ambientTimer <= 0) { this._spawnAmbient(false); this._ambientTimer = 0.08; }
    }
  }


  _emitter() {
    return {
      boost: (x, y, dx, dy, color) => this._spawnTrail(x, y, dx, dy, color),
      flipReset: (x, y, color) => this._spawnBurst(x, y, color, 14, 220),
      impact: (x, y, intensity, team) => { this._spawnBurst(x, y, team === "blue" ? "#2ce3ff" : "#ff9a3c", 6 + intensity * 5, 160 + intensity * 80); if (intensity > 0.7) this.addShake(intensity * 4); },
      touch: () => {},
      trail: () => {},
    };
  }

  addShake(a) { this.cam.shake = Math.min(28, this.cam.shake + a); }

  // ---------------- simulation ----------------
  update(dt) {
    if (this.paused) return;
    this.time += dt;
    const env = { gravity: this.arena.gravity, arena: this.arena };

    const active = this.match.isActive();
    // build intents
    const NEUTRAL = { throttle: 0, jump: false, jumpPressed: false, boost: false, resetPressed: false, pausePressed: false, dodgeDir: 0, source: "neutral" };
    const intents = new Map();
    for (const v of this.vehicles) {
      if (v.isPlayer && !v.passive) intents.set(v, this.input.getIntent(v.controlScheme));
      else if (v.isPlayer && v.passive) intents.set(v, NEUTRAL);
      else intents.set(v, this.ais.find((a) => a.v === v).think(dt, this));
    }

    if (this.match.state === "countdown") {
      // freeze gameplay, just tick match clock
      this.match.update(dt, env, this.sfx);
      this._consumeEvents();
      this._updateCamera(dt);
      this._updateParticles(dt);
      this._updateAmbient(dt);
      return;
    }

    if (this.match.state === "goal") {
      this.ball.update(dt, env, this.sfx);
      this._resolvePads();
      this.match.update(dt, env, this.sfx);
      this._consumeEvents();
      this._updateCamera(dt);
      this._updateParticles(dt);
      this._updateAmbient(dt);
      this._record();
      return;
    }

    if (this.match.state === "ended") {
      this.ball.update(dt, env, this.sfx);
      this._updateCamera(dt);
      this._updateParticles(dt);
      this._updateAmbient(dt);
      return;
    }

    // playing
    // reset key (free play / training)
    for (const v of this.vehicles) {
      const it = intents.get(v);
      if (it && it.resetPressed && this.cfg.mode === "free") {
        v.reset(v.x, 200);
        this.ball.reset();
      }
    }

    for (const v of this.vehicles) v.controlPhase(dt, intents.get(v), env);

    // boost pads
    this._resolvePads();

    this.ball.update(dt, env, this.sfx);

    for (const v of this.vehicles) v.collideBall(this.ball, env);

    this._trackStats();

    // arena-specific collisions (hoops visuals handled in detect via match)
    this.match.update(dt, env, this.sfx);
    this._consumeEvents();

    this._updateCamera(dt);
    this._updateParticles(dt);
    this._updateAmbient(dt);
    this._record();
  }

  _consumeEvents() {
    for (const e of this.match.events) {
      if (e.type === "goal") this._onGoal(e.team);
      else if (e.type === "go") this.addShake(4);
      else if (e.type === "count") { if (this.sfx && this.match.cfg.mode !== "free") this.sfx.countdownBeep(false); }
    }
  }

  _onGoal(team) {
    this.addShake(20);
    const b = this.ball;
    this._spawnBurst(b.x, b.y, team === "blue" ? "#2ce3ff" : "#ff9a3c", 40, 420);
    if (this.sfx) this.sfx.goal();
  }

  _resolvePads() {
    for (const pad of this.pads) {
      for (const v of this.vehicles) {
        const d = Math.hypot(v.x - pad.x, v.y - pad.y);
        if (d < pad.r + v.hh) {
          if (v.boost < v.maxBoost) { v.boost = v.maxBoost; this._spawnBurst(pad.x, pad.y, "#ffd24b", 10, 160); }
        }
      }
    }
  }

  // classify ball-car contact as shot / save / aerial touch for stat tracking
  _trackStats() {
    const b = this.ball;
    if (!b.lastTouchId) return;
    const v = this.vehicles.find((x) => x.id === b.lastTouchId);
    if (!v) return;
    const team = v.team;
    // attack direction: blue attacks +x (right), orange attacks -x (left)
    const attackSign = team === "blue" ? 1 : -1;
    const sp = Math.hypot(b.vx, b.vy);
    // a shot: ball leaves the car moving toward the opponent goal at speed
    if (b.vx * attackSign > 480) {
      this.match.stats[team].shots++;
    }
    // a save: the ball was arriving toward this team's own goal (opponent shot)
    // and this car deflected it. Approx: ball now moving away from own goal or slowed.
    const ownGoalSign = -attackSign;
    if (b.vx * ownGoalSign < -300 && b.vx * attackSign > -100) {
      this.match.stats[team].saves++;
    }
    // aerial touch (for player achievements/stats)
    if (v.isPlayer && !v.onGround && v.airTime > 0.25 && b.lastTouch === team) {
      this.match.stats[team].aerials = (this.match.stats[team].aerials || 0) + 1;
    }
  }

  _record() {
    if (!this.record) return;
    if (this.frames.length > 60 * 180) return; // cap ~3 min
    this.frames.push({
      t: this.match.time,
      state: this.match.state,
      score: { blue: this.match.score.blue, orange: this.match.score.orange },
      ball: { x: this.ball.x, y: this.ball.y, spin: this.ball.spin, vx: this.ball.vx, vy: this.ball.vy },
      v: this.vehicles.map((v) => ({ x: v.x, y: v.y, a: v.angle, b: v.boost, t: v.team, name: v.name, flip: !!v.flipping })),
    });
  }

  _updateCamera(dt) {
    // fit whole arena
    const cw = this._cw, ch = this._ch;
    if (!cw || !ch) return;
    const pad = 40;
    const s = Math.min((cw - pad * 2) / this.arena.W, (ch - pad * 2) / this.arena.H);
    this.cam.scale = lerp(this.cam.scale || s, s, Math.min(1, dt * 6));
    this.cam.x = this.arena.W / 2;
    this.cam.y = this.arena.H / 2;
    // shake decay
    this.cam.shake *= Math.max(0, 1 - dt * 8);
    this.cam.sx = (Math.random() * 2 - 1) * this.cam.shake;
    this.cam.sy = (Math.random() * 2 - 1) * this.cam.shake;
  }

  _updateParticles(dt) {
    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { ps.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy -= 600 * dt * (p.gravity ? 1 : 0);
      p.vx *= 0.98; p.vy *= 0.98;
    }
    if (ps.length > 500) ps.splice(0, ps.length - 500);
  }

  _spawnTrail(x, y, dx, dy, color) {
    const cap = this.particles.length + Math.ceil(1 * this.quality.particles);
    if (this.particles.length > 480 || cap > 480) return;
    if (Math.random() > this.quality.particles) return;
    this.particles.push({ x, y, vx: dx * 60 + (Math.random() * 40 - 20), vy: dy * 60 + (Math.random() * 40 - 20), life: 0.35, maxLife: 0.35, color, size: 6 + Math.random() * 4, gravity: false });
  }
  _spawnBurst(x, y, color, n, speed) {
    const scaledN = Math.max(1, Math.round(n * this.quality.particles));
    for (let i = 0; i < scaledN; i++) {
      if (this.particles.length > 480) break;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + 60, life: 0.5 + Math.random() * 0.4, maxLife: 0.9, color, size: 3 + Math.random() * 4, gravity: true });
    }
  }

  // ---------------- rendering ----------------
  render(ctx, cw, ch) {
    this._cw = cw; this._ch = ch;
    const A = this.arena;
    ctx.save();
    ctx.clearRect(0, 0, cw, ch);

    // background (variant-aware)
    this._drawBackground(ctx, cw, ch, A);

    this._updateCamera(0.016);
    const s = this.cam.scale;
    const ox = cw / 2 - this.cam.x * s + this.cam.sx;
    const oy = ch / 2 + this.cam.y * s + this.cam.sy; // y flip

    const W2S = (wx, wy) => ({ x: ox + wx * s, y: oy - wy * s });

    // crowd dots (parallax band)
    this._drawCrowd(ctx, cw, ch, A);

    // ambient weather / environment particles (world-space, parallax)
    this._drawAmbient(ctx, W2S, s);

    // arena floor/walls
    this._drawArena(ctx, W2S, s, A);

    // boost pads (pulsing)
    for (const pad of this.pads) {
      const p = W2S(pad.x, pad.y);
      const pulse = 0.8 + Math.sin(this.time * 4 + pad.x * 0.01) * 0.2;
      const pr = pad.r * s * pulse;
      const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, pr);
      g.addColorStop(0, "rgba(255,210,75,0.9)");
      g.addColorStop(1, "rgba(255,210,75,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, pr, 0, Math.PI * 2); ctx.fill();
      // inner ring
      ctx.strokeStyle = "rgba(255,210,75,0.5)";
      ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.arc(p.x, p.y, pr * 0.6, 0, Math.PI * 2); ctx.stroke();
    }

    // ball
    this._drawBall(ctx, W2S, s);

    // vehicles
    for (const v of this.vehicles) this._drawVehicle(ctx, v, W2S, s);

    // particles
    for (const p of this.particles) {
      const sp = W2S(p.x, p.y);
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, p.size * s * 0.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // post-processing (quality-gated): vignette + soft bloom glow
    if (this.quality.postFX) {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      const vg = ctx.createRadialGradient(cw / 2, ch / 2, ch * 0.35, cw / 2, ch / 2, ch * 0.8);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();
    }

    ctx.restore();
  }

  _drawBackground(ctx, cw, ch, A) {
    const variant = A.variant || "dome";
    if (variant === "outdoor") {
      const sky = ctx.createLinearGradient(0, 0, 0, ch);
      sky.addColorStop(0, A.bgAccent);
      sky.addColorStop(0.55, A.bg);
      sky.addColorStop(1, "#02030a");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, cw, ch);
      if (this.quality.lighting) {
        const sun = ctx.createRadialGradient(cw * 0.78, ch * 0.22, 4, cw * 0.78, ch * 0.22, ch * 0.4);
        sun.addColorStop(0, A.crowd); sun.addColorStop(0.4, A.crowd + "66"); sun.addColorStop(1, A.crowd + "00");
        ctx.fillStyle = sun; ctx.fillRect(0, 0, cw, ch);
      }
      const hz = ctx.createLinearGradient(0, ch * 0.6, 0, ch);
      hz.addColorStop(0, A.bg + "00"); hz.addColorStop(1, A.ambient);
      ctx.fillStyle = hz; ctx.fillRect(0, ch * 0.6, cw, ch * 0.4);
    } else if (variant === "hall") {
      const sky = ctx.createLinearGradient(0, 0, 0, ch);
      sky.addColorStop(0, "#05050f"); sky.addColorStop(0.7, A.bg); sky.addColorStop(1, A.bgAccent);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, cw, ch);
      if (this.quality.lighting) {
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 4; i++) {
          const bx = cw * (0.18 + i * 0.21);
          const lg = ctx.createLinearGradient(bx, 0, bx, ch * 0.8);
          lg.addColorStop(0, A.crowd + "33"); lg.addColorStop(1, A.crowd + "00");
          ctx.fillStyle = lg;
          ctx.beginPath();
          ctx.moveTo(bx - 20, 0); ctx.lineTo(bx + 20, 0); ctx.lineTo(bx + 90, ch * 0.8); ctx.lineTo(bx - 90, ch * 0.8);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }
    } else if (variant === "garden") {
      const sky = ctx.createLinearGradient(0, 0, 0, ch);
      sky.addColorStop(0, A.bgAccent); sky.addColorStop(0.7, A.bg); sky.addColorStop(1, "#02030a");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, cw, ch);
      if (this.quality.lighting) {
        const glow = ctx.createRadialGradient(cw * 0.5, ch * 0.3, 10, cw * 0.5, ch * 0.3, ch * 0.6);
        glow.addColorStop(0, A.ambient + "55"); glow.addColorStop(1, A.ambient + "00");
        ctx.fillStyle = glow; ctx.fillRect(0, 0, cw, ch);
      }
    } else {
      const sky = ctx.createLinearGradient(0, 0, 0, ch);
      sky.addColorStop(0, A.bgAccent); sky.addColorStop(0.6, A.bg); sky.addColorStop(1, "#02030a");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, cw, ch);
      if (this.quality.lighting) {
        const vig = ctx.createRadialGradient(cw / 2, ch * 0.5, ch * 0.2, cw / 2, ch * 0.5, ch * 0.7);
        vig.addColorStop(0, A.ambient + "33"); vig.addColorStop(1, A.ambient + "00");
        ctx.fillStyle = vig; ctx.fillRect(0, 0, cw, ch);
      }
    }
  }

  _drawAmbient(ctx, W2S, s) {
    const ps = this.ambient;
    if (!ps.length) return;
    ctx.save();
    for (const p of ps) {
      const sp = W2S(p.x, p.y);
      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.rotate(p.spin);
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = p.color;
      // rain = thin streaks; others = small dots/shapes
      if (this.arena.effects && this.arena.effects.type === "rain") {
        ctx.fillRect(-0.6 * s, -4 * s, 1.2 * s, 8 * s);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * s * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  _drawCrowd(ctx, cw, ch, A) {
    ctx.save();
    const r = (i) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
    for (let i = 0; i < 90; i++) {
      const x = (i * 53.3) % cw;
      const baseY = 40 + r(i) * 60;
      // gentle sway so the crowd feels alive
      const y = baseY + Math.sin(this.time * 2 + i * 0.7) * 3;
      ctx.fillStyle = i % 2 ? A.crowd : "#ffffff";
      ctx.globalAlpha = 0.15 + r(i + 5) * 0.3;
      ctx.fillRect(x, y, 3, 3);
    }
    ctx.restore();
  }

  _drawArena(ctx, W2S, s, A) {
    const corners = [W2S(0, 0), W2S(A.W, 0), W2S(A.W, A.H), W2S(0, A.H)];
    // floor band
    ctx.fillStyle = A.floor;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y); ctx.lineTo(corners[1].x, corners[1].y);
    ctx.lineTo(corners[2].x, corners[2].y); ctx.lineTo(corners[3].x, corners[3].y);
    ctx.closePath(); ctx.fill();

    // floor glow line
    const fl0 = W2S(0, 0), fl1 = W2S(A.W, 0);
    ctx.strokeStyle = A.floorEdge; ctx.lineWidth = 4 * s; ctx.shadowColor = A.floorEdge; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.moveTo(fl0.x, fl0.y); ctx.lineTo(fl1.x, fl1.y); ctx.stroke();
    ctx.shadowBlur = 0;

    // variant-specific field markings
    const variant = A.variant || "dome";
    if (variant === "hall" || variant === "dome") {
      const cc = W2S(A.W / 2, 0);
      ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.ellipse(cc.x, cc.y, A.W * 0.12 * s, A.W * 0.12 * s * 0.28, 0, 0, Math.PI * 2); ctx.stroke();
      for (const side of [0.16, 0.84]) {
        const px = W2S(A.W * side, 0);
        ctx.beginPath(); ctx.ellipse(px.x, px.y, A.W * 0.06 * s, A.W * 0.06 * s * 0.28, 0, 0, Math.PI); ctx.stroke();
      }
    } else if (variant === "garden") {
      ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 2 * s;
      for (let i = 1; i < 8; i++) {
        const x = W2S(A.W * (i / 8), 0).x;
        ctx.beginPath(); ctx.moveTo(x, W2S(0, 0).y); ctx.lineTo(x, W2S(0, A.H).y); ctx.stroke();
      }
    }

    // walls (left/right/ceiling)
    ctx.strokeStyle = A.wallEdge; ctx.lineWidth = 3 * s;
    const wl0 = W2S(0, 0), wl1 = W2S(0, A.H);
    const wr0 = W2S(A.W, 0), wr1 = W2S(A.W, A.H);
    const wc0 = W2S(0, A.H), wc1 = W2S(A.W, A.H);
    ctx.beginPath(); ctx.moveTo(wl0.x, wl0.y); ctx.lineTo(wl1.x, wl1.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wr0.x, wr0.y); ctx.lineTo(wr1.x, wr1.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wc0.x, wc0.y); ctx.lineTo(wc1.x, wc1.y); ctx.stroke();

    // center line
    const cl0 = W2S(A.W / 2, 0), cl1 = W2S(A.W / 2, A.H);
    ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 2 * s;
    ctx.setLineDash([8 * s, 8 * s]);
    ctx.beginPath(); ctx.moveTo(cl0.x, cl0.y); ctx.lineTo(cl1.x, cl1.y); ctx.stroke();
    ctx.setLineDash([]);

    // goals
    this._drawGoal(ctx, W2S, s, A, "left");
    this._drawGoal(ctx, W2S, s, A, "right");

    // hoops / net modes
    if (this.match.cfg.mode === "hoops") this._drawHoops(ctx, W2S, s, A);
    if (this.match.cfg.mode === "volleyball") this._drawNet(ctx, W2S, s, A);
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

  _drawHoops(ctx, W2S, s, A) {
    for (const [team, h] of Object.entries(this.match.hoops)) {
      const c = W2S(h.x, h.y);
      ctx.strokeStyle = team === "orange" ? "#2ce3ff" : "#ff9a3c";
      ctx.lineWidth = 7 * s; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(c.x, c.y, h.r * s, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;
      // backboard hint
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(c.x + (h.dir > 0 ? h.r * s : -h.r * s - 6 * s), c.y - h.r * s, 6 * s, h.r * 2 * s);
    }
  }

  _drawNet(ctx, W2S, s, A) {
    const top = W2S(A.W / 2, this.match.netH);
    const bot = W2S(A.W / 2, 0);
    ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 4 * s;
    ctx.beginPath(); ctx.moveTo(bot.x, bot.y); ctx.lineTo(top.x, top.y); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 1.5 * s;
    for (let i = 1; i < 6; i++) {
      const y = W2S(A.W / 2, (this.match.netH / 6) * i);
      ctx.beginPath(); ctx.moveTo(bot.x - 8 * s, y.y); ctx.lineTo(bot.x + 8 * s, y.y); ctx.stroke();
    }
  }

  _drawBall(ctx, W2S, s) {
    const b = this.ball;
    const c = W2S(b.x, b.y);
    const r = b.r * s;
    // glow
    ctx.save();
    ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 18;
    const g = ctx.createRadialGradient(c.x - r * 0.3, c.y - r * 0.3, 2, c.x, c.y, r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.7, "#dfe7ff");
    g.addColorStop(1, "#9fb0d8");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // panels
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

  _drawVehicle(ctx, v, W2S, s) {
    const c = W2S(v.x, v.y);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(-v.angle); // screen y is down

    const hw = v.hw, hh = v.hh;
    const cos = v.cosmetics;
    const body = cos.paint || "#2ce3ff";
    const accent = cos.paint2 || "#0c1020";
    const wheel = cos.wheelColor || "#23283a";
    const wheelAcc = cos.wheelAccent || body;
    const boost = cos.boostColor || "#ffd24b";

    // suspension squash: body sinks a touch under acceleration/braking, rebounds in air
    const sp = v.speed;
    const fwd = sp > 0.1 ? (v.vx * Math.cos(v.angle) + v.vy * Math.sin(v.angle)) / sp : 0;
    const onG = v.onGround ? 1 : 0;
    const sq = onG ? (1 - 0.16 * Math.max(-1, Math.min(1, fwd)) - 0.05) : 1.05;
    const wheelSq = onG ? (1 + 0.22 * Math.max(-1, Math.min(1, fwd))) : 0.7;

    // ---- ground shadow (quality-gated) ----
    if (this.quality.shadows && onG) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(0, hh * 1.1, hw * 1.25, hh * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (this.quality.shadows) {
      // airborne shadow shrinks as it rises
      const air = Math.min(1, (v.y - 60) / 500);
      ctx.save();
      ctx.globalAlpha = 0.18 * (1 - air * 0.6);
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(0, hh * 1.1, hw * (1.1 - air * 0.3), hh * (0.45 - air * 0.2), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // team ring (under)
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = v.team === "blue" ? "#2ce3ff" : "#ff9a3c";
    ctx.beginPath(); ctx.ellipse(0, hh * 0.9, hw * 1.1, hh * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // ---- boost flame ----
    if (v.boostActive) {
      const fl = (8 + Math.random() * 12) * s;
      const fg = ctx.createLinearGradient(-hw - fl, 0, -hw, 0);
      fg.addColorStop(0, "rgba(255,210,75,0)");
      fg.addColorStop(0.6, "rgba(255,170,60,0.8)");
      fg.addColorStop(1, boost);
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(-hw, -hh * 0.4);
      ctx.lineTo(-hw - fl, 0);
      ctx.lineTo(-hw, hh * 0.4);
      ctx.closePath(); ctx.fill();
      // glow
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = boost;
      ctx.beginPath();
      ctx.ellipse(-hw - fl * 0.4, 0, fl * 0.6, hh * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ---- chassis with shading ----
    ctx.save();
    ctx.scale(1, sq);
    // base
    ctx.fillStyle = body;
    this._roundRect(ctx, -hw, -hh, hw * 2, hh * 2, hh * 0.7);
    ctx.fill();
    // top highlight
    ctx.save();
    ctx.globalAlpha = 0.5;
    const hi = ctx.createLinearGradient(0, -hh, 0, hh);
    hi.addColorStop(0, "rgba(255,255,255,0.55)");
    hi.addColorStop(0.5, "rgba(255,255,255,0.05)");
    hi.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = hi;
    this._roundRect(ctx, -hw, -hh, hw * 2, hh * 2, hh * 0.7);
    ctx.fill();
    ctx.restore();
    // body edge outline
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1.4 * s;
    this._roundRect(ctx, -hw, -hh, hw * 2, hh * 2, hh * 0.7);
    ctx.stroke();
    ctx.restore();

    // ---- cabin / windshield ----
    ctx.save();
    ctx.scale(1, sq);
    ctx.fillStyle = accent;
    this._roundRect(ctx, -hw * 0.15, -hh * 0.1, hw * 0.7, hh * 1.2, hh * 0.4);
    ctx.fill();
    // glass sheen
    ctx.fillStyle = "rgba(150,210,255,0.6)";
    this._roundRect(ctx, hw * 0.08, -hh * 0.02, hw * 0.42, hh * 0.9, hh * 0.3);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    this._roundRect(ctx, hw * 0.1, -hh * 0.06, hw * 0.16, hh * 0.7, hh * 0.2);
    ctx.fill();
    ctx.restore();

    // ---- nose accent ----
    ctx.save();
    ctx.scale(1, sq);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(hw, -hh * 0.5); ctx.lineTo(hw + hw * 0.18, 0); ctx.lineTo(hw, hh * 0.5); ctx.closePath();
    ctx.fill();
    ctx.restore();

    // ---- wheels (rotating + suspension) ----
    const wr = (cos.wheelRadius || 13) * 0.7 * wheelSq;
    for (const wx of [-hw * 0.55, hw * 0.55]) {
      const wy = hh * 0.95;
      // tire
      ctx.fillStyle = wheel;
      ctx.beginPath(); ctx.arc(wx, wy, wr, 0, Math.PI * 2); ctx.fill();
      // rim
      ctx.fillStyle = wheelAcc;
      ctx.beginPath(); ctx.arc(wx, wy, wr * 0.62, 0, Math.PI * 2); ctx.fill();
      // rotating spokes
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(v.wheelSpin);
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 1.6 * s;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * wr * 0.58, Math.sin(a) * wr * 0.58);
        ctx.stroke();
      }
      ctx.restore();
      // hub
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath(); ctx.arc(wx, wy, wr * 0.18, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();

    // name label
    if (v.isPlayer || this.vehicles.length > 2) {
      ctx.save();
      ctx.font = `${Math.max(10, 11 * s)}px "Segoe UI", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = v.team === "blue" ? "#9af6ff" : "#ffd0a0";
      ctx.fillText(v.name, c.x, c.y - (v.hh + 18) * s);
      ctx.restore();
    }
  }

  _roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  dispose() {
    this.particles.length = 0;
  }
}
