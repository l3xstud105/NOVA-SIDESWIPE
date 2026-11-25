// hud.js — in-match HUD overlay (DOM)
import { el, clear } from "./dom.js";

export class Hud {
  constructor(root) {
    this.root = root;
    this.elem = el("div", { class: "hud" });
    root.appendChild(this.elem);
    this._countEl = null;
  }

  build(world) {
    clear(this.elem);
    this.world = world;
    const m = world.match;
    this.elem.innerHTML = `
      <div class="hud__mode">${m.cfg.label}</div>
      <div class="hud__score">
        <div class="hud__team hud__team--blue" id="hud-blue">0</div>
        <div class="hud__clock" id="hud-clock">${m.timeString()}</div>
        <div class="hud__team hud__team--orange" id="hud-orange">0</div>
      </div>
      <div class="hud__boostwrap">
        <div class="hud__boostlabel">BOOST</div>
        <div class="hud__boostbar"><div class="hud__boostfill" id="hud-boost"></div></div>
      </div>
      <div class="hud__names" id="hud-names"></div>
      <div class="hud__center" id="hud-center"></div>
    `;
    this.blue = this.elem.querySelector("#hud-blue");
    this.orange = this.elem.querySelector("#hud-orange");
    this.clock = this.elem.querySelector("#hud-clock");
    this.boost = this.elem.querySelector("#hud-boost");
    this.names = this.elem.querySelector("#hud-names");
    this.center = this.elem.querySelector("#hud-center");
    this._updateNames();
  }

  _updateNames() {
    const players = this.world.vehicles.filter((v) => v.isPlayer);
    this.names.innerHTML = players
      .map((v) => `<div><b style="color:${v.team === "blue" ? "#9af6ff" : "#ffd0a0"}">${v.name}</b> · ${Math.round(v.boost)}%</div>`)
      .join("");
  }

  update(world) {
    const m = world.match;
    this.blue.textContent = m.score.blue;
    this.orange.textContent = m.score.orange;
    this.clock.textContent = m.overtime ? "OT" : m.timeString();
    const me = world.vehicles.find((v) => v.isPlayer);
    if (me) this.boost.style.width = me.boost + "%";
    this._updateNames();
  }

  showCountdown(n) {
    this.center.innerHTML = `<div class="hud__countdown">${n}</div>`;
    clearTimeout(this._ct);
    this._ct = setTimeout(() => { if (this.center.childElementCount) this.center.innerHTML = ""; }, 700);
  }
  showGo() {
    this.center.innerHTML = `<div class="hud__countdown" style="color:#4bff9d">GO!</div>`;
    setTimeout(() => { this.center.innerHTML = ""; }, 800);
  }
  flashGoal(team) {
    const f = el("div", { class: "hud__goalflash" });
    this.elem.appendChild(f);
    setTimeout(() => f.remove(), 1000);
    this.center.innerHTML = `<div class="hud__banner" style="color:${team === "blue" ? "#2ce3ff" : "#ff9a3c"}">GOAL!</div>`;
    setTimeout(() => { this.center.innerHTML = ""; }, 1400);
  }

  destroy() { this.elem.remove(); }
}
