// router.js — minimal hash router for menu screens
import { clear } from "../ui/dom.js";

export class Router {
  constructor(root, routes, fallback = "menu") {
    this.root = root;
    this.routes = routes; // { name: (params)=>void }
    this.fallback = fallback;
    this.current = null;
    window.addEventListener("hashchange", () => this.resolve());
  }
  go(name, params = {}) {
    const q = params && Object.keys(params).length ? "?" + new URLSearchParams(params).toString() : "";
    const target = "#/" + name + q;
    if (location.hash === target) this.resolve();
    else location.hash = target;
  }
  parse() {
    const h = location.hash.replace(/^#\//, "") || this.fallback;
    const [name, qs] = h.split("?");
    const params = {};
    if (qs) new URLSearchParams(qs).forEach((v, k) => (params[k] = v));
    return { name: name || this.fallback, params };
  }
  resolve() {
    const { name, params } = this.parse();
    const fn = this.routes[name] || this.routes[this.fallback];
    if (this.current && this.current.destroy) { try { this.current.destroy(); } catch (e) {} }
    clear(this.root);
    this.current = fn(params) || {};
    this.current.name = name;
  }
}
