// loop.js — fixed-timestep game loop with render separation + perf tracking
export class GameLoop {
  constructor({ update, render, fixedDt = 1 / 60, maxFrame = 0.1 }) {
    this.update = update;       // (dt) => void  — physics step (fixed)
    this.render = render;       // (alpha, frameDt) => void
    this.fixedDt = fixedDt;
    this.maxFrame = maxFrame;
    this.acc = 0;
    this.last = 0;
    this.running = false;
    this.raf = 0;
    this._frame = this._frame.bind(this);
    // perf
    this.fps = 60;
    this.physicsMs = 0;
    this.renderMs = 0;
    this._fpsAcc = 0;
    this._fpsFrames = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this._frame);
  }
  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  _frame(now) {
    if (!this.running) return;
    let frameDt = (now - this.last) / 1000;
    this.last = now;
    if (frameDt > this.maxFrame) frameDt = this.maxFrame;

    // FPS tracking
    this._fpsAcc += frameDt; this._fpsFrames++;
    if (this._fpsAcc >= 0.5) {
      this.fps = Math.round(this._fpsFrames / this._fpsAcc);
      this._fpsAcc = 0; this._fpsFrames = 0;
    }

    const pt0 = performance.now();
    this.acc += frameDt;
    let steps = 0;
    while (this.acc >= this.fixedDt && steps < 5) {
      this.update(this.fixedDt);
      this.acc -= this.fixedDt;
      steps++;
    }
    if (steps === 5) this.acc = 0; // avoid spiral of death
    this.physicsMs = performance.now() - pt0;

    const rt0 = performance.now();
    const alpha = this.acc / this.fixedDt;
    this.render(alpha, frameDt);
    this.renderMs = performance.now() - rt0;

    this.raf = requestAnimationFrame(this._frame);
  }
}
