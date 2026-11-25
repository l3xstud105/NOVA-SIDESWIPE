// game.js — central controller: loop, match lifecycle, menus, progression
import { GameLoop } from "../core/loop.js";
import { World } from "./world.js";
import { Vehicle } from "./vehicle.js";
import { ReplayPlayer } from "./replay.js";
import { VEHICLES, getVehicle } from "../data/vehicles.js";
import { PAINTS, WHEELS, BOOSTS } from "../data/cosmetics.js";
import { getArena, ARENAS } from "../data/arenas.js";
import { profile } from "../core/profile.js";
import { audio } from "../core/audio.js";
import { clamp } from "../core/math.js";
import { resolveQuality, backingScale, AdaptiveResolution, autoQuality, PowerManager } from "../core/quality.js";
import { el, clear, toast, banner, hexToRgba } from "../ui/dom.js";
import { Hud } from "../ui/hud.js";

const AI_COSMETICS = [
  { paint: "#ff9a3c", paint2: "#1a0e08", wheel: WHEELS[0], boost: BOOSTS[0] },
  { paint: "#ff4bd8", paint2: "#1a0a18", wheel: WHEELS[1], boost: BOOSTS[2] },
  { paint: "#4bff9d", paint2: "#06120c", wheel: WHEELS[2], boost: BOOSTS[0] },
];

export class Game {
  constructor({ canvas, uiRoot, input, router }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.uiRoot = uiRoot;
    this.input = input;
    this.router = router;
    this.state = "menu";
    this.world = null;
    this.preview = null;
    this.previewCanvas = null;
    this.hud = null;
    this.touch = null;
    this.replay = null;
    this.replayEntry = null;
    this.replayHud = null;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.qualityName = this._resolveQualitySetting();
    this.quality = resolveQuality(this.qualityName);
    this.adaptive = new AdaptiveResolution({ base: this.quality.scale, floor: 0.55, targetFps: this.quality.targetFps });
    // power-aware load reduction (Chromebook / battery / thermal / hidden tab)
    this.power = new PowerManager({ visible: document.visibilityState !== "hidden" });
    this._endedHandled = false;
    this._paused = false;
    this._maxOppLead = 0;
    this._matchStart = 0;
    this.overlays = [];

    this.loop = new GameLoop({ update: (dt) => this.update(dt), render: (a, fd) => this.render(a, fd) });
    window.addEventListener("resize", () => this.resize());
  }

  start() {
    this.loop.start();
    this.resize();
  }

  // effective backing-resolution scale: preset scale × adaptive × power throttle
  _effectiveDpr() {
    const base = backingScale(this.qualityName, this.dpr);
    return base * this.adaptive.multiplier() * this.power.throttle();
  }

  // sample live device signals (battery / visibility / thermal) each frame.
  // All APIs are guarded — unsupported browsers simply keep last state.
  _updatePower() {
    const p = this.power;
    let signal = {};
    if (typeof document !== "undefined" && document.visibilityState != null) {
      signal.visible = document.visibilityState !== "hidden";
    }
    if (typeof navigator !== "undefined" && navigator.getBattery) {
      try {
        const b = navigator.getBattery();
        signal.level = b.level;
        signal.charging = b.charging;
      } catch (e) { /* ignore */ }
    }
    if (navigator.deviceHeatLevel != null) {
      const t = navigator.deviceHeatLevel;
      signal.thermal = t >= 5 ? "critical" : t >= 3 ? "medium" : "nominal";
    }
    p.update(signal);
  }

  resize() {
    const c = this.canvas;
    const w = c.clientWidth || window.innerWidth;
    const h = c.clientHeight || window.innerHeight;
    const ed = this._effectiveDpr();
    c.width = Math.floor(w * ed);
    c.height = Math.floor(h * ed);
    this._edpr = ed;
  }

  // re-resolve quality after a settings change (called from settings screen)
  // map a settings value (incl. "auto") to a concrete preset name
  _resolveQualitySetting() {
    const g = (profile.data.settings && profile.data.settings.graphics) || "high";
    if (g === "auto") {
      return autoQuality(window.devicePixelRatio || 1, navigator.hardwareConcurrency || 4);
    }
    return g;
  }

  rebuildQuality() {
    this.qualityName = this._resolveQualitySetting();
    this.quality = resolveQuality(this.qualityName);
    this.adaptive = new AdaptiveResolution({ base: this.quality.scale, floor: 0.55, targetFps: this.quality.targetFps });
    this.resize();
  }

  // -------- showcase (menu background) --------
  setShowcase() {
    const lo = profile.buildLoadout();
    const players = [
      { team: "blue", isPlayer: true, passive: true, name: profile.data.name, def: lo.vehicleDef, cosmetics: lo.toVehicleCosmetics(), control: "p1" },
      { team: "orange", isPlayer: false, name: "CPU", def: getVehicle("comet"), cosmetics: this._aiCos(0), difficulty: "hard" },
    ];
    // sfx:null keeps the menu ambience silent (music is handled separately)
    this.world = new World({ mode: "free", arenaId: "neon", players, input: this.input, sfx: null, record: false, quality: this.quality });
    this.state = "menu";
  }
  _aiCos(i) {
    const c = AI_COSMETICS[i % AI_COSMETICS.length];
    return { paint: c.paint, paint2: c.paint2, wheelColor: c.wheel.color, wheelAccent: c.wheel.accent, wheelRadius: c.wheel.radius, boostColor: c.boost.trail };
  }

  // -------- garage preview --------
  setPreview(loadout) {
    const v = new Vehicle({
      id: "pv", team: "blue", isPlayer: false, name: "Preview", vehicleDef: loadout.vehicleDef,
      cosmetics: loadout.toVehicleCosmetics(), x: getArena("neon").W / 2, y: getArena("neon").H / 2,
    });
    this.preview = { vehicle: v, canvas: this.previewCanvas };
  }
  clearPreview() { this.preview = null; }

  _renderPreview(ctx, cw, ch, v) {
    ctx.save();
    ctx.clearRect(0, 0, cw, ch);
    const g = ctx.createRadialGradient(cw / 2, ch * 0.4, 10, cw / 2, ch / 2, cw * 0.7);
    g.addColorStop(0, "#16213f"); g.addColorStop(1, "#070b18");
    ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
    const scale = Math.min(cw, ch) / 180;
    ctx.translate(cw / 2, ch / 2 + 20 * scale);
    ctx.scale(scale, scale);
    ctx.rotate(-v.angle);
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath(); ctx.ellipse(0, v.hh * 1.0, v.hw * 1.1, v.hh * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    // reuse world's vehicle draw via a temporary
    drawVehicleStandalone(ctx, v);
    ctx.restore();
  }

  // -------- match lifecycle --------
  startMatch(opts) {
    audio.resume();
    // leave the current menu screen
    if (this.router && this.router.current && this.router.current.destroy) {
      try { this.router.current.destroy(); } catch (e) {}
    }
    clear(this.uiRoot);
    const lo = profile.buildLoadout();
    const players = [];
    const mode = opts.mode;

    if (mode === "local2p") {
      players.push({ team: "blue", isPlayer: true, name: "P1", def: lo.vehicleDef, cosmetics: lo.toVehicleCosmetics(), control: "p1" });
      players.push({ team: "orange", isPlayer: true, name: "P2", def: lo.vehicleDef, cosmetics: lo.toVehicleCosmetics(), control: "p2" });
    } else if (mode === "free") {
      players.push({ team: "blue", isPlayer: true, name: profile.data.name, def: lo.vehicleDef, cosmetics: lo.toVehicleCosmetics(), control: "p1" });
      // Practice sandbox: optionally spawn AI opponents (1 or 2) so you can
      // train against a moving, predicting opponent. Off by default.
      const oppCount = Math.max(0, Math.min(2, opts.practiceOpps | 0));
      const pStyles = ["balanced", "aggressive", "defensive"];
      const oppDefs = ["wraith", "comet", "titan"];
      for (let i = 0; i < oppCount; i++) {
        const team = i === 0 ? "orange" : "orange";
        players.push({ team, isPlayer: false, name: "Training Bot " + (i + 1), def: getVehicle(oppDefs[i % oppDefs.length]), cosmetics: this._aiCos(i), control: "ai", difficulty: opts.practiceDifficulty || opts.difficulty || "medium", style: pStyles[i % pStyles.length] });
      }
    } else {
      // player on blue
      players.push({ team: "blue", isPlayer: true, name: profile.data.name, def: lo.vehicleDef, cosmetics: lo.toVehicleCosmetics(), control: "p1" });
      // blue teammate if 2v2
      if (mode === "2v2") players.push({ team: "blue", isPlayer: false, name: "CPU Mate", def: getVehicle("titan"), cosmetics: this._aiCos(2), difficulty: opts.difficulty, style: opts.style || "team" });
      // orange team
      const ocount = mode === "2v2" ? 2 : 1;
      const styles = [opts.style || "balanced", "aggressive"];
      for (let i = 0; i < ocount; i++) players.push({ team: "orange", isPlayer: false, name: "CPU", def: getVehicle(i === 0 ? "wraith" : "comet"), cosmetics: this._aiCos(i), difficulty: opts.difficulty, style: styles[i % styles.length] });
    }

    this.world = new World({ mode, arenaId: opts.arena, players, input: this.input, sfx: audio, record: true, quality: this.quality });
    this.state = "match";
    this._endedHandled = false;
    this._paused = false;
    this._maxOppLead = 0;
    this._matchStart = performance.now();
    this._matchOpts = opts;

    // HUD
    if (this.hud) this.hud.destroy();
    this.hud = new Hud(this.uiRoot);
    this.hud.build(this.world);

    audio.startEngine();
    if (this.touch) this.touch.show();

    // countdown beeps handled by match events
    this._consumeHudEvents();
  }

  _consumeHudEvents() {
    for (const e of this.world.match.events) {
      if (e.type === "count") this.hud.showCountdown(e.n);
      else if (e.type === "go") this.hud.showGo();
      else if (e.type === "goal") this.hud.flashGoal(e.team);
    }
  }

  togglePause() {
    if (this.state !== "match") return;
    this._paused = !this._paused;
    this.world.paused = this._paused;
    if (this._paused) { this._showPause(); audio.stopEngine(); }
    else { this._clearOverlays(); audio.startEngine(); }
  }

  _showPause() {
    this._clearOverlays();
    const ov = el("div", { class: "modal-backdrop" });
    const m = el("div", { class: "panel modal" });
    m.append(el("h2", { text: "Paused" }), el("p", { text: opts_mode_label(this._matchOpts) }));
    const resume = el("button", { class: "btn btn--primary", text: "Resume", onclick: () => this.togglePause() });
    const quit = el("button", { class: "btn btn--danger", text: "Quit to Menu", onclick: () => { this._clearOverlays(); this._endToMenu(); } });
    m.append(el("div", { class: "modal__actions" }, [resume, quit]));
    ov.append(m);
    this.uiRoot.appendChild(ov);
    this.overlays.push(ov);
  }

  _clearOverlays() { this.overlays.forEach((o) => o.remove()); this.overlays = []; }

  _endToMenu() {
    audio.stopEngine();
    if (this.hud) { this.hud.destroy(); this.hud = null; }
    profile.data.stats.playtime += Math.round((performance.now() - this._matchStart) / 60000);
    profile.save();
    if (this.touch) this.touch.hide();
    this.router.go("menu");
  }

  // -------- replay playback --------
  startReplay(entry) {
    audio.resume();
    this.endReplay();
    if (this.router && this.router.current && this.router.current.destroy) {
      try { this.router.current.destroy(); } catch (e) {}
    }
    clear(this.uiRoot);
    this.replayEntry = entry;
    const arena = getArena(entry.arena || "neon");
    this.replay = new ReplayPlayer(entry.frames, arena, {
      canvas: this.canvas, dpr: this.dpr,
      onEvent: (e) => this._onReplayEvent(e),
    });
    this.replay.play();
    this.state = "replay";
    this._buildReplayHud(entry);
  }

  _buildReplayHud(entry) {
    const root = el("div", { class: "hud replay-hud" });
    root.innerHTML = `
      <div class="hud__mode">REPLAY · ${entry.arenaName || entry.arena} · ${MODE_LABEL[entry.mode] || entry.mode}</div>
      <div class="hud__score">
        <div class="hud__team hud__team--blue">${entry.score.blue}</div>
        <div class="hud__clock" id="rp-clock">0:00</div>
        <div class="hud__team hud__team--orange">${entry.score.orange}</div>
      </div>
      <div class="replay-hud__controls">
        <button class="btn btn--sm rp-btn" data-act="play" title="Play/Pause">▶</button>
        <button class="btn btn--sm rp-btn" data-act="back" title="Back 5s">⏪</button>
        <button class="btn btn--sm rp-btn" data-act="fwd" title="Forward 5s">⏩</button>
        <span class="replay-hud__time" id="rp-time">0:00 / 0:00</span>
        <select class="replay-hud__speed" id="rp-speed">
          <option value="0.5">0.5x</option>
          <option value="1" selected>1x</option>
          <option value="1.5">1.5x</option>
          <option value="2">2x</option>
        </select>
        <button class="btn btn--sm rp-btn" data-act="exit" title="Exit">✕</button>
      </div>
      <div class="replay-hud__scrub" id="rp-scrub"><div class="replay-hud__progress" id="rp-progress"></div></div>
    `;
    this.uiRoot.appendChild(root);
    this.replayHud = root;
    this._rpTime = root.querySelector("#rp-time");
    this._rpClock = root.querySelector("#rp-clock");
    this._rpProgress = root.querySelector("#rp-progress");
    this._rpScrub = root.querySelector("#rp-scrub");
    this._rpPlayBtn = root.querySelector('[data-act="play"]');

    const onAct = (act) => () => {
      if (act === "play") { this.replay.toggle(); this._rpPlayBtn.textContent = this.replay.playing ? "⏸" : "▶"; audio.ui(); }
      else if (act === "back") { this.replay.seek(this.replay.currentTime - 5); audio.ui(); }
      else if (act === "fwd") { this.replay.seek(this.replay.currentTime + 5); audio.ui(); }
      else if (act === "exit") { audio.ui(); this.endReplay(); }
    };
    root.querySelectorAll(".rp-btn").forEach((b) => b.addEventListener("click", onAct(b.dataset.act)));
    root.querySelector("#rp-speed").addEventListener("change", (e) => { this.replay.setSpeed(parseFloat(e.target.value)); audio.ui(); });
    // scrub click-to-seek
    this._rpScrub.addEventListener("click", (e) => {
      const r = this._rpScrub.getBoundingClientRect();
      const frac = clamp((e.clientX - r.left) / r.width, 0, 1);
      this.replay.seek(frac * this.replay.duration);
    });
    this._rpPlayBtn.textContent = "⏸";
  }

  _onReplayEvent(e) {
    if (e.type === "goal") {
      audio.goal();
      this._flashReplayGoal(e.team);
    } else if (e.type === "end") {
      this._rpPlayBtn.textContent = "▶";
      toast("Replay finished.", "info");
    }
  }

  _flashReplayGoal(team) {
    if (!this.replayHud) return;
    const f = el("div", { class: "hud__goalflash" });
    this.replayHud.appendChild(f);
    setTimeout(() => f.remove(), 1000);
  }

  endReplay() {
    if (this.replay) { this.replay.destroy(); this.replay = null; }
    if (this.replayHud) { this.replayHud.remove(); this.replayHud = null; }
    this.replayEntry = null;
    this._clearOverlays();
    this.state = "menu";
    if (this.router) this.router.go("menu");
  }

  _updateReplayHud() {
    if (!this.replay || !this.replayHud) return;
    const t = this.replay.currentTime;
    const d = this.replay.duration;
    this._rpClock.textContent = fmtTime(t);
    this._rpTime.textContent = `${fmtTime(t)} / ${fmtTime(d)}`;
    this._rpProgress.style.width = (this.replay.progress * 100) + "%";
  }

  // -------- update --------
  update(dt) {
    this._updatePower();
    this.input.beginFrame();

    if (this.state === "replay" && this.replay) {
      this.replay.update(dt);
      this._updateReplayHud();
      const pz = this.input.getIntent("p1");
      if (pz.pausePressed) this.endReplay();
      this.input.endFrame();
      return;
    }

    if (this.state === "match" && this.world) {
      this.world.update(dt);
      if (this.hud) this.hud.update(this.world);
      this._consumeHudEvents();

      // engine audio
      const me = this.world.vehicles.find((v) => v.isPlayer);
      if (me && !this._paused) {
        const sp = clamp(me.speed / 2000, 0, 1);
        audio.updateEngine(sp, Math.sign(me.vx));
      }

      // pause (read pause edge separately; safe to call getIntent again)
      const pz = this.input.getIntent("p1");
      if (pz.pausePressed && !this._paused && this.world.match.state !== "ended") this.togglePause();

      // track deficit for comeback achievement
      const myTeam = me ? me.team : "blue";
      const lead = this.world.match.score[myTeam === "blue" ? "orange" : "blue"] - this.world.match.score[myTeam];
      if (lead > this._maxOppLead) this._maxOppLead = lead;

      // end detection
      if (this.world.match.state === "ended" && !this._endedHandled) {
        this._endedHandled = true;
        this._onMatchEnd();
      }
    } else if (this.world) {
      // showcase / menu background keeps animating
      this.world.update(dt);
    }

    // preview rotation
    if (this.preview && this.preview.world) {
      const v = this.preview.world.vehicles[0];
      v.angle += dt * 0.6;
    }

    this.input.endFrame();
  }

  _onMatchEnd() {
    audio.stopEngine();
    if (this.hud) { this.hud.destroy(); this.hud = null; }
    const m = this.world.match;

    // save replay (if we recorded enough frames)
    if (this.world.frames && this.world.frames.length > 30) {
      try {
        const A = this.world.arena;
        const meR = this.world.vehicles.find((v) => v.isPlayer);
        const myTeamR = meR ? meR.team : "blue";
        profile.saveReplay({
          id: "rp_" + Date.now().toString(36),
          mode: this._matchOpts.mode,
          arena: A.id,
          arenaName: A.name,
          score: { ...m.score },
          winner: m.winner,
          myTeam: myTeamR,
          frames: this.world.frames,
          created: Date.now(),
        });
        toast("Match replay saved.", "reward");
      } catch (e) { /* storage may be full; replay is best-effort */ }
    }

    const me = this.world.vehicles.find((v) => v.isPlayer);
    const myTeam = me ? me.team : "blue";
    const myScore = m.score[myTeam];
    const oppScore = m.score[myTeam === "blue" ? "orange" : "blue"];
    const win = m.winner === myTeam;
    const draw = m.winner === "draw";

    // progression
    const d = profile.data;
    d.stats.matches++;
    d.stats.goals += myScore;
    // accumulate per-match stats from the tracked match stats
    const teamStats = (me && m.stats[me.team]) || m.stats.blue;
    d.stats.shots = (d.stats.shots || 0) + (teamStats.shots || 0);
    d.stats.saves = (d.stats.saves || 0) + (teamStats.saves || 0);
    d.stats.aerials = (d.stats.aerials || 0) + (teamStats.aerials || 0);
    if (me && me.flipResetReady) {
      d.stats.flipResets = (d.stats.flipResets || 0) + 1;
      profile.achieve("flip_reset");
    }
    if (win) d.stats.wins++; else if (draw) d.stats.draws++; else d.stats.losses++;
    d.stats.playtime += Math.round((performance.now() - this._matchStart) / 60000);

    let xp = 100 + 30 * myScore + (win ? 160 : draw ? 40 : 0);
    // achievements
    if (myScore >= 1 && profile.achieve("first_goal")) {}
    if (myScore >= 3 && profile.achieve("hat_trick")) {}
    if (win && this._matchOpts.mode === "1v1" && profile.achieve("win_1v1")) {}
    if (win && this._matchOpts.mode === "2v2" && profile.achieve("win_2v2")) {}
    if (win && this._maxOppLead >= 3 && profile.achieve("comeback")) {}
    // aerial goal: last touch by me while airborne
    if (this.world.ball.lastTouchId === me.id && me.airTime > 0.3 && profile.achieve("aerial")) {}
    if (this._matchOpts.mode === "hoops" && myScore >= 1 && profile.achieve("hoops")) {}
    if (this._matchOpts.mode === "volleyball" && win && profile.achieve("volley")) {}

    // MMR (ranked only, authoritative server would override online)
    if (this._matchOpts.ranked && (this._matchOpts.mode === "1v1" || this._matchOpts.mode === "2v2")) {
      const diff = this._matchOpts.difficulty || "medium";
      const base = diff === "hard" ? 16 : diff === "easy" ? 8 : 12;
      const delta = win ? base : draw ? 0 : -Math.round(base * 0.7);
      profile.addMMR(this._matchOpts.mode, delta);
    }

    // challenges
    this._completeChallenge("d_score3", myScore >= 3);
    this._completeChallenge("d_win1", win);
    this._completeChallenge("w_win3", win);
    this._completeChallenge("w_play10", true);
    if (this._matchOpts.mode === "2v2") this._completeChallenge("w_2v2", true);

    // tournament progression
    let toNext = null;
    if (this._matchOpts.tournament && this._matchOpts.tournament.tournament) {
      const t = this._matchOpts.tournament;
      const finalWinnerId = win ? t.playerTeamId : t.opponentId;
      t.tournament.recordResult(t.round, t.index, finalWinnerId);
      t.tournament.save();
      toast(win ? "Advanced to next round!" : "Eliminated from tournament.", win ? "reward" : "info");
      if (win && !t.tournament.complete) profile.achieve("tournament_round");
      if (t.tournament.complete && t.tournament.champion && t.tournament.champion.isPlayer) profile.achieve("tournament_champion");
      toNext = t.tournament.progress();
    }

    profile.addXP(xp);
    // grant any level-up rewards reached by the XP gain
    const newRewards = profile.grantLevelRewards();
    if (newRewards.length) {
      toast("Level up! Unlocked: " + newRewards.map((r) => r.label).join(", "), "reward");
    }
    profile.save();

    this._showResults({ win, draw, myScore, oppScore, myTeam, xp, tournament: toNext, newRewards });
  }

  _startTournamentMatch() {
    const t = this._matchOpts && this._matchOpts.tournament;
    if (!t || !t.tournament) { this.router.go("menu"); return; }
    const pm = t.tournament.playerMatch();
    if (!pm) { this.router.go("tournaments"); return; }
    t.round = pm.round; t.index = pm.index; t.opponentId = pm.opponent.id;
    t.playerTeamId = t.tournament.teams[0].id;
    this.startMatch({
      mode: this._matchOpts.mode,
      arena: this._matchOpts.arena,
      difficulty: pm.opponent.difficulty,
      style: pm.opponent.style,
      tournament: t,
    });
  }

  _completeChallenge(id, cond) {
    const map = { d_score3: "daily", d_win1: "daily", d_boost: "daily", d_aerial: "daily", w_win3: "weekly", w_play10: "weekly", w_2v2: "weekly" };
    const period = map[id];
    if (!period) return;
    if (cond && !profile.data.challenges[period].done[id]) {
      const def = (period === "daily" ? DAILY : WEEKLY).find((c) => c.id === id);
      if (def) { profile.data.challenges[period].done[id] = true; profile.addXP(def.reward); toast(def.name + " complete! +" + def.reward + " XP", "reward"); }
    }
  }

  _showResults(r) {
    const m = this.world.match;
    const me = this.world.vehicles.find((v) => v.isPlayer);
    const myTeam = me ? me.team : "blue";
    const ts = m.stats[myTeam] || { shots: 0, saves: 0, aerials: 0 };

    // MVP = top individual scorer
    let mvpName = "—", mvpGoals = 0;
    if (m.scorers) {
      for (const v of this.world.vehicles) {
        const g = m.scorers[v.id] || 0;
        if (g > mvpGoals) { mvpGoals = g; mvpName = v.name; }
      }
    }

    const ov = el("div", { class: "modal-backdrop" });
    const panel = el("div", { class: "panel modal results" });
    const verdict = r.draw ? "DRAW" : r.win ? "VICTORY" : "DEFEAT";
    const vclass = r.draw ? "results__verdict--draw" : r.win ? "results__verdict--win" : "results__verdict--loss";
    panel.append(el("div", { class: "results__verdict " + vclass, text: verdict }));
    panel.append(el("div", { class: "results__score", html: `<span style="color:#2ce3ff">${r.myScore}</span> - <span style="color:#ff9a3c">${r.oppScore}</span>` }));
    if (mvpGoals > 0) panel.append(el("div", { class: "results__mvp", text: "MVP: " + mvpName + " (" + mvpGoals + " goals)" }));
    if (r.newRewards && r.newRewards.length) {
      panel.append(el("div", { class: "results__mvp", text: "Unlocked: " + r.newRewards.map((x) => x.label).join(", ") }));
    }
    const stats = el("div", { class: "results__stats" });
    const mk = (b, s) => el("div", { class: "results__stat" }, [el("b", { text: String(b) }), el("span", { text: s })]);
    stats.append(mk(m.score.blue, "Blue"), mk(m.score.orange, "Orange"), mk("+" + r.xp, "XP Earned"));
    stats.append(mk(ts.shots || 0, "Shots"), mk(ts.saves || 0, "Saves"), mk(ts.aerials || 0, "Aerials"));
    panel.append(stats);
    const actions = el("div", { class: "modal__actions", style: { justifyContent: "center" } });
    const tInfo = r.tournament;
    const nextRound = tInfo && tInfo.playerAlive && !tInfo.complete
      ? el("button", { class: "btn btn--primary", text: "Next Round", onclick: () => { this._clearOverlays(); audio.ui(880); this._startTournamentMatch(); } })
      : null;
    const rematch = el("button", { class: "btn btn--primary", text: "Rematch", onclick: () => { this._clearOverlays(); audio.ui(880); this.startMatch(this._matchOpts); } });
    const garage = el("button", { class: "btn", text: "Garage", onclick: () => { this._clearOverlays(); this.router.go("garage"); } });
    const menu = el("button", { class: "btn btn--ghost", text: "Menu", onclick: () => { this._clearOverlays(); this.router.go("menu"); } });
    actions.append(...(nextRound ? [nextRound] : []), rematch, garage, menu);
    panel.append(actions);
    ov.append(panel);
    this.uiRoot.appendChild(ov);
    this.overlays.push(ov);
    audio.fanfare(r.win);
  }

  // -------- render --------
  render(alpha, fd) {
    const ctx = this.ctx;
    const cw = this.canvas.clientWidth || window.innerWidth;
    const chh = this.canvas.clientHeight || window.innerHeight;
    const ed = this._edpr || this._effectiveDpr();
    // adaptive resolution: feed frame times to the controller
    if (fd != null && this.state !== "menu") this.adaptive.push((fd || 1 / 60) * 1000);
    // self-correct canvas backing size (e.g. after the app becomes visible)
    if (this.canvas.width !== Math.floor(cw * ed) || this.canvas.height !== Math.floor(chh * ed)) {
      this.resize();
    }
    ctx.setTransform(ed, 0, 0, ed, 0, 0);

    // power-aware particle load: reduce world particle density under throttle
    if (this.world && this.world.quality) {
      const baseP = this.quality.particles;
      this.world.quality.particles = Math.max(0, baseP * this.power.particleMul());
    }
    // hidden tab: skip all drawing to save battery entirely
    if (this.power.throttle() === 0) {
      return;
    }

    if (this.state === "replay" && this.replay) {
      this.replay.render(ctx, cw, chh);
    } else if (this.state === "match" && this.world) {
      this.world.render(ctx, cw, chh);
    } else if (this.world) {
      this.world.render(ctx, cw, chh);
    } else {
      ctx.clearRect(0, 0, cw, chh);
    }

    if (this.preview && this.preview.canvas) {
      const pc = this.preview.canvas;
      const pw = pc.clientWidth || 360, ph = pc.clientHeight || 360;
      if (pc.width !== pw * ed) { pc.width = pw * ed; pc.height = ph * ed; }
      const pctx = pc.getContext("2d");
      pctx.setTransform(ed, 0, 0, ed, 0, 0);
      this._renderPreview(pctx, pw, ph, this.preview.vehicle);
    }
  }
}

function fmtTime(t) {
  const s = Math.max(0, Math.floor(t || 0));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

const MODE_LABEL = { "1v1": "1v1", "2v2": "2v2", local2p: "Local 2P", hoops: "Hoops", volleyball: "Volleyball", free: "Free Play" };

function opts_mode_label(o) {
  const map = { "1v1": "1v1 Duel", "2v2": "2v2 Doubles", local2p: "Local 2P", hoops: "Hoops", volleyball: "Volleyball", free: "Free Play" };
  return (map[o.mode] || o.mode) + (o.ranked ? " · Ranked" : "");
}

// standalone vehicle draw (mirrors world's draw but simplified)
import { WHEELS as _W } from "../data/cosmetics.js";
function drawVehicleStandalone(ctx, v) {
  const hw = v.hw, hh = v.hh, cos = v.cosmetics;
  const body = cos.paint || "#2ce3ff";
  const accent = cos.paint2 || "#0c1020";
  const wheel = cos.wheelColor || "#23283a";
  const wheelAcc = cos.wheelAccent || body;
  // body
  ctx.fillStyle = body;
  roundRect(ctx, -hw, -hh, hw * 2, hh * 2, hh * 0.7); ctx.fill();
  // cabin
  ctx.fillStyle = accent;
  roundRect(ctx, -hw * 0.15, -hh * 0.1, hw * 0.7, hh * 1.2, hh * 0.4); ctx.fill();
  ctx.fillStyle = "rgba(120,200,255,0.55)";
  roundRect(ctx, hw * 0.08, -hh * 0.02, hw * 0.42, hh * 0.9, hh * 0.3); ctx.fill();
  // nose
  ctx.fillStyle = accent;
  ctx.beginPath(); ctx.moveTo(hw, -hh * 0.5); ctx.lineTo(hw + hw * 0.18, 0); ctx.lineTo(hw, hh * 0.5); ctx.closePath(); ctx.fill();
  // wheels
  const wr = (cos.wheelRadius || 13) * 0.7;
  for (const wx of [-hw * 0.55, hw * 0.55]) {
    ctx.fillStyle = wheel; ctx.beginPath(); ctx.arc(wx, hh * 0.95, wr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = wheelAcc; ctx.beginPath(); ctx.arc(wx, hh * 0.95, wr * 0.45, 0, Math.PI * 2); ctx.fill();
  }
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

// import challenge defs
import { DAILY_CHALLENGES as DAILY, WEEKLY_CHALLENGES as WEEKLY } from "../data/progression.js";
