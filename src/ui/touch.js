// touch.js — on-screen joystick + buttons for mobile/touch devices
import { el } from "./dom.js";

export function createTouchControls(input) {
  const root = document.getElementById("touch-root");
  root.innerHTML = "";

  const stick = el("div", { class: "touch-stick" });
  const nub = el("div", { class: "touch-stick__nub" });
  stick.appendChild(nub);
  const boostBtn = el("div", { class: "touch-btn touch-btn--boost", text: "BOOST" });
  const jumpBtn = el("div", { class: "touch-btn touch-btn--jump", text: "JUMP" });
  root.append(stick, boostBtn, jumpBtn);

  let stickId = null;
  const stickCenter = () => {
    const r = stick.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const onMove = (e) => {
    if (stickId == null) return;
    const t = e.touches ? [...e.touches].find((x) => x.identifier === stickId) : e;
    if (!t) return;
    const c = stickCenter();
    const dx = t.clientX - c.x;
    const dy = t.clientY - c.y;
    const max = 44;
    const nx = Math.max(-max, Math.min(max, dx));
    nub.style.transform = `translate(${nx}px, ${Math.max(-max, Math.min(max, dy))}px)`;
    input.touch.throttle = Math.abs(dx) > 14 ? Math.sign(dx) : 0;
  };
  const onUp = (e) => {
    if (stickId == null) return;
    const t = e.changedTouches ? [...e.changedTouches].find((x) => x.identifier === stickId) : e;
    if (!t) return;
    stickId = null; nub.style.transform = ""; input.touch.throttle = 0;
  };
  stick.addEventListener("touchstart", (e) => {
    e.preventDefault();
    stickId = e.changedTouches[0].identifier;
    onMove(e);
  }, { passive: false });
  stick.addEventListener("touchmove", (e) => { e.preventDefault(); onMove(e); }, { passive: false });
  stick.addEventListener("touchend", (e) => { e.preventDefault(); onUp(e); }, { passive: false });
  stick.addEventListener("touchcancel", onUp);

  const bindBtn = (btn, set) => {
    const down = (e) => { e.preventDefault(); set(true); };
    const up = (e) => { e.preventDefault(); set(false); };
    btn.addEventListener("touchstart", down, { passive: false });
    btn.addEventListener("touchend", up, { passive: false });
    btn.addEventListener("touchcancel", up);
  };
  bindBtn(boostBtn, (v) => (input.touch.boost = v));
  bindBtn(jumpBtn, (v) => { input.touch.jump = v; if (v) input.touch.jumpEdge = true; });

  input.touch.active = true;
  return {
    show() { root.hidden = false; input.touch.active = true; },
    hide() { root.hidden = true; input.touch.active = false; },
  };
}

export function isTouchDevice() {
  return ("ontouchstart" in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
}
