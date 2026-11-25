// input.js — unified, remappable input (keyboard + mouse + gamepad + touch)
import { load, save } from "./storage.js";

export const DEFAULT_BINDINGS = {
  p1: {
    left: ["KeyA"],
    right: ["KeyD"],
    jump: ["Space"],
    boost: ["ShiftLeft", "ShiftRight"],
    reset: ["KeyR"],
    pause: ["Escape"],
  },
  p2: {
    left: ["ArrowLeft"],
    right: ["ArrowRight"],
    jump: ["ArrowUp", "Numpad0"],
    boost: ["ControlRight", "Numpad1"],
    reset: ["Numpad2"],
    pause: ["KeyP"],
  },
};

export class Input {
  constructor() {
    this.keys = new Set();
    this.justPressed = new Set();
    this.mouse = { left: false, right: false };
    this.mousePressed = { left: false, right: false };
    this.mouseHeldThisFrame = false;
    this.gamepads = [];
    this.bindings = load("controls", structuredCloneSafe(DEFAULT_BINDINGS));
    this.suppressContextMenu = false;
    this.touch = { active: false, throttle: 0, jump: false, jumpEdge: false, boost: false };
    this._capture = null; // rebind capture callback
    this._attach();
  }

  resetBindings() {
    this.bindings = structuredCloneSafe(DEFAULT_BINDINGS);
    save("controls", this.bindings);
  }

  setBinding(scheme, action, code) {
    this.bindings[scheme] = this.bindings[scheme] || {};
    this.bindings[scheme][action] = [code];
    save("controls", this.bindings);
  }

  captureNext(cb) {
    this._capture = cb;
  }

  _attach() {
    window.addEventListener("keydown", (e) => {
      if (this._capture) {
        // ignore pure modifier presses
        if (["ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight", "MetaLeft", "MetaRight"].includes(e.code)) return;
        const cb = this._capture;
        this._capture = null;
        cb(e.code, e.key);
        e.preventDefault();
        return;
      }
      if (!this.keys.has(e.code)) this.justPressed.add(e.code);
      this.keys.add(e.code);
      // prevent page scroll for game keys
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.mouse.left = this.mouse.right = false;
    });

    window.addEventListener("mousedown", (e) => {
      if (e.button === 0) { this.mouse.left = true; this.mousePressed.left = true; }
      if (e.button === 2) { this.mouse.right = true; this.mousePressed.right = true; }
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    window.addEventListener("contextmenu", (e) => {
      if (this.suppressContextMenu) e.preventDefault();
    });

    window.addEventListener("gamepadconnected", () => this.pollGamepads());
  }

  pollGamepads() {
    if (navigator.getGamepads) {
      const pads = navigator.getGamepads();
      this.gamepads = [];
      for (const p of pads) if (p) this.gamepads.push(p);
    }
  }

  // call once per frame BEFORE reading intents
  beginFrame() {
    this.pollGamepads();
  }

  // call once per frame AFTER intents consumed
  endFrame() {
    this.justPressed.clear();
    this.mousePressed.left = false;
    this.mousePressed.right = false;
    this.touch.jumpEdge = false;
  }

  _down(b, scheme) {
    if (b.some((c) => this.keys.has(c))) return true;
    if (scheme === "p1") {
      if (b.includes("__mouseLeft") && this.mouse.left) return true;
      if (b.includes("__mouseRight") && this.mouse.right) return true;
    }
    return false;
  }
  _pressed(b, scheme) {
    if (b.some((c) => this.justPressed.has(c))) return true;
    if (scheme === "p1") {
      if (b.includes("__mouseLeft") && this.mousePressed.left) return true;
      if (b.includes("__mouseRight") && this.mousePressed.right) return true;
    }
    return false;
  }

  getIntent(schemeName = "p1") {
    const b = this.bindings[schemeName] || DEFAULT_BINDINGS[schemeName];
    const down = (a) => this._down(b[a] || [], schemeName);
    const pressed = (a) => this._pressed(b[a] || [], schemeName);

    let throttle = (down("right") ? 1 : 0) - (down("left") ? 1 : 0);

    // Mouse: left = boost, right = jump (player 1 gameplay convenience)
    let boost = down("boost");
    let jump = down("jump");
    let jumpPressed = pressed("jump");
    if (schemeName === "p1") {
      if (this.mouse.right) jump = true;
      if (this.mousePressed.right) jumpPressed = true;
      if (this.mouse.left) boost = true;
    }

    // Gamepad (player 1 uses pad 0; player 2 uses pad 1 if present)
    const pad = this.gamepads[schemeName === "p1" ? 0 : 1];
    let gpThrottle = 0, gpJump = false, gpJumpP = false, gpBoost = false;
    if (pad) {
      const dz = 0.22;
      const ax = pad.axes[0] || 0;
      if (ax > dz) gpThrottle = 1; else if (ax < -dz) gpThrottle = -1;
      const btn = (i) => pad.buttons[i] && pad.buttons[i].pressed;
      const btnP = (i) => pad.buttons[i] && pad.buttons[i].value > 0.5;
      gpJump = btn(0) || btn(9);
      gpJumpP = btnP(0) || btnP(9);
      gpBoost = btn(7) || btn(5) || btn(1) || btn(2);
      // dpad left/right
      if (btn(14)) gpThrottle = -1;
      if (btn(15)) gpThrottle = 1;
    }
    if (gpThrottle !== 0) throttle = gpThrottle;
    jump = jump || gpJump;
    jumpPressed = jumpPressed || gpJumpP;
    boost = boost || gpBoost;

    const resetPressed = pressed("reset");
    const pausePressed = pressed("pause");

    // touch overlay (player 1 only)
    if (schemeName === "p1" && this.touch.active) {
      if (this.touch.throttle !== 0) throttle = this.touch.throttle;
      if (this.touch.jump) jump = true;
      if (this.touch.jumpEdge) jumpPressed = true;
      if (this.touch.boost) boost = true;
    }

    // dodge direction = direction held at moment of jump (for aerial flip)
    const dodgeDir = throttle !== 0 ? Math.sign(throttle) : 0;

    return { throttle, jump, jumpPressed, boost, resetPressed, pausePressed, dodgeDir, source: schemeName };
  }
}

function structuredCloneSafe(o) {
  try { return structuredClone(o); } catch (e) { return JSON.parse(JSON.stringify(o)); }
}
