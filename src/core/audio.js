// audio.js — procedural Web Audio engine (no asset files required)
// Generates engine, boost, impacts, goals, UI, countdown, and generative music.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.enabled = true;
    this.volumes = { master: 0.8, sfx: 0.9, music: 0.5 };
    this._noise = null;
    this._engine = null;
    this._boostNode = null;
    this._music = null;
    this._musicTimer = null;
    this._started = false;
  }

  // must be called from a user gesture
  resume() {
    if (!this.ctx) this._build();
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  }

  _build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain.connect(this.master);
    this.musicGain.connect(this.master);
    this.master.connect(this.ctx.destination);
    this._applyVolumes();
    // noise buffer
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noise = buf;
  }

  _applyVolumes() {
    if (!this.master) return;
    this.master.gain.value = this.enabled ? this.volumes.master : 0;
    this.sfxGain.gain.value = this.volumes.sfx;
    this.musicGain.gain.value = this.volumes.music;
  }

  setVolumes(v) {
    Object.assign(this.volumes, v);
    this._applyVolumes();
  }
  setEnabled(on) { this.enabled = on; this._applyVolumes(); }

  _now() { return this.ctx ? this.ctx.currentTime : 0; }

  _noiseSource() {
    const s = this.ctx.createBufferSource();
    s.buffer = this._noise;
    s.loop = true;
    return s;
  }

  // ---------- one-shot SFX ----------
  ui(freq = 660) {
    if (!this.ctx) return;
    const t = this._now();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.06);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(this.sfxGain);
    o.start(t); o.stop(t + 0.14);
  }

  jump() {
    if (!this.ctx) return;
    const t = this._now();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(540, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(this.sfxGain);
    o.start(t); o.stop(t + 0.2);
  }

  doubleJump() {
    if (!this.ctx) return;
    const t = this._now();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.1);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(this.sfxGain);
    o.start(t); o.stop(t + 0.18);
  }

  dodge() {
    if (!this.ctx) return;
    const t = this._now();
    const s = this._noiseSource();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    f.type = "bandpass"; f.frequency.value = 1200; f.Q.value = 1.2;
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    s.connect(f).connect(g).connect(this.sfxGain);
    s.start(t); s.stop(t + 0.16);
  }

  impact(intensity = 1) {
    if (!this.ctx) return;
    const t = this._now();
    const i = Math.max(0.2, Math.min(1.6, intensity));
    // thump
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(180 * i, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.14);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3 * i, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(this.sfxGain);
    o.start(t); o.stop(t + 0.22);
    // click
    const s = this._noiseSource();
    const f = this.ctx.createBiquadFilter();
    const g2 = this.ctx.createGain();
    f.type = "highpass"; f.frequency.value = 1800;
    g2.gain.setValueAtTime(0.12 * i, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f).connect(g2).connect(this.sfxGain);
    s.start(t); s.stop(t + 0.06);
  }

  wall(intensity = 1) {
    if (!this.ctx) return;
    const t = this._now();
    const s = this._noiseSource();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    f.type = "lowpass"; f.frequency.value = 600;
    g.gain.setValueAtTime(0.12 * Math.min(1.2, intensity), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    s.connect(f).connect(g).connect(this.sfxGain);
    s.start(t); s.stop(t + 0.1);
  }

  goal() {
    if (!this.ctx) return;
    const t = this._now();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C
    notes.forEach((n, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sawtooth";
      const tt = t + i * 0.07;
      o.frequency.setValueAtTime(n, tt);
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(0.22, tt + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.5);
      o.connect(g).connect(this.sfxGain);
      o.start(tt); o.stop(tt + 0.55);
    });
    // crowd swell
    const s = this._noiseSource();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 0.6;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    s.connect(f).connect(g).connect(this.sfxGain);
    s.start(t); s.stop(t + 1.5);
  }

  countdownBeep(high = false) {
    if (!this.ctx) return;
    const t = this._now();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "square";
    o.frequency.value = high ? 880 : 440;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (high ? 0.4 : 0.2));
    o.connect(g).connect(this.sfxGain);
    o.start(t); o.stop(t + (high ? 0.45 : 0.25));
  }

  fanfare(win = true) {
    if (!this.ctx) return;
    const t = this._now();
    const seq = win ? [523.25, 659.25, 783.99, 1046.5] : [440, 392, 349.23, 293.66];
    seq.forEach((n, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = win ? "triangle" : "sawtooth";
      const tt = t + i * 0.16;
      o.frequency.setValueAtTime(n, tt);
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(0.2, tt + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.4);
      o.connect(g).connect(this.sfxGain);
      o.start(tt); o.stop(tt + 0.45);
    });
  }

  // ---------- continuous engine ----------
  startEngine() {
    if (!this.ctx || this._engine) return;
    const o = this.ctx.createOscillator();
    const sub = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = "sawtooth"; sub.type = "square";
    f.type = "lowpass"; f.frequency.value = 900;
    g.gain.value = 0.0001;
    o.frequency.value = 70; sub.frequency.value = 35;
    o.connect(f); sub.connect(f); f.connect(g).connect(this.sfxGain);
    o.start(); sub.start();
    this._engine = { o, sub, f, g };
  }
  updateEngine(speed01, throttle) {
    if (!this._engine) return;
    const e = this._engine;
    const base = 60 + speed01 * 220;
    const t = this._now();
    e.o.frequency.setTargetAtTime(base, t, 0.05);
    e.sub.frequency.setTargetAtTime(base * 0.5, t, 0.05);
    e.f.frequency.setTargetAtTime(500 + speed01 * 1600, t, 0.05);
    const target = 0.04 + (throttle ? 0.06 : 0) + speed01 * 0.05;
    e.g.gain.setTargetAtTime(target, t, 0.08);
  }
  stopEngine() {
    if (!this._engine) return;
    try { this._engine.o.stop(); this._engine.sub.stop(); } catch (e) {}
    this._engine = null;
  }

  // ---------- boost loop ----------
  startBoost() {
    if (!this.ctx || this._boostNode) return;
    const s = this._noiseSource();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    f.type = "bandpass"; f.frequency.value = 700; f.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, this._now());
    g.gain.exponentialRampToValueAtTime(0.14, this._now() + 0.05);
    s.connect(f).connect(g).connect(this.sfxGain);
    s.start();
    this._boostNode = { s, f, g };
  }
  stopBoost() {
    if (!this._boostNode) return;
    const { s, g } = this._boostNode;
    const t = this._now();
    g.gain.cancelScheduledValues(t);
    g.gain.setTargetAtTime(0.0001, t, 0.05);
    try { s.stop(t + 0.2); } catch (e) {}
    this._boostNode = null;
  }

  // ---------- generative background music ----------
  startMusic() {
    if (!this.ctx || this._musicTimer) return;
    // simple chord progression (Am - F - C - G) arpeggiated
    const chords = [
      [220.0, 261.63, 329.63],
      [174.61, 220.0, 261.63],
      [261.63, 329.63, 392.0],
      [196.0, 246.94, 392.0],
    ];
    let step = 0;
    let bar = 0;
    const tempo = 0.34; // seconds per 8th note
    const tick = () => {
      if (!this.ctx) return;
      const chord = chords[bar % chords.length];
      const t = this._now();
      // bass on beat
      if (step % 4 === 0) this._musicNote(chord[0] / 2, t, tempo * 3.6, 0.10, "triangle");
      // arpeggio
      const note = chord[step % chord.length] * (step % 8 >= 4 ? 2 : 1);
      this._musicNote(note, t, tempo * 0.9, 0.05, "sawtooth");
      // soft pad at bar start
      if (step === 0) chord.forEach((n) => this._musicNote(n, t, tempo * 7, 0.03, "sine"));
      step++;
      if (step >= 8) { step = 0; bar++; }
    };
    tick();
    this._musicTimer = setInterval(tick, tempo * 1000);
  }
  _musicNote(freq, t, dur, gain, type) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    o.type = type; o.frequency.value = freq;
    f.type = "lowpass"; f.frequency.value = 2200;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  }
  stopMusic() {
    if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; }
  }
}

export const audio = new AudioEngine();
