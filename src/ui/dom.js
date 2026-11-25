// dom.js — tiny DOM helpers
export function el(tag, props = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") e.className = v;
    else if (k === "style") Object.assign(e.style, v);
    else if (k === "html") e.innerHTML = v;
    else if (k === "text") e.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "dataset") Object.assign(e.dataset, v);
    else if (v != null) e.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return e;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

export function $(sel, root = document) { return root.querySelector(sel); }

// simple toast
let toastWrap = null;
export function toast(msg, kind = "") {
  if (!toastWrap) {
    toastWrap = el("div", { class: "toast-wrap" });
    document.getElementById("ui-root").appendChild(toastWrap);
  }
  const t = el("div", { class: "toast" + (kind ? " toast--" + kind : ""), text: msg });
  toastWrap.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .3s"; }, 2200);
  setTimeout(() => t.remove(), 2600);
}

export function banner(msg, kind = "") {
  const root = document.getElementById("banner-root");
  const b = el("div", { class: "banner" + (kind ? " is-" + kind : ""), text: msg });
  root.appendChild(b);
  setTimeout(() => { b.style.opacity = "0"; b.style.transition = "opacity .4s"; }, 4000);
  setTimeout(() => b.remove(), 4500);
}

export function hexToRgba(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
