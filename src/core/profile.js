// profile.js — local player profile, progression, cosmetics (persistent)
import { load, save, loadOr } from "./storage.js";
import { PAINTS, WHEELS, BOOSTS, BANNERS, TITLES } from "../data/cosmetics.js";
import { VEHICLES } from "../data/vehicles.js";
import { rankForMMR, levelForXP } from "../data/progression.js";

function defaultProfile() {
  return {
    name: "Player",
    created: Date.now(),
    xp: 0,
    mmr: { "1v1": 0, "2v2": 0 },
    cosmetics: {
      owned: {
        paint: PAINTS.filter((p) => p.rarity === "common").map((p) => p.id),
        wheel: ["stock"],
        boost: ["standard"],
        banner: ["none"],
        title: ["rookie"],
        vehicle: ["nova"],
      },
      equipped: {
        vehicle: "nova", paint: "cyan", paint2: "void", wheel: "stock",
        boost: "standard", banner: "none", title: "rookie",
      },
    },
    stats: { matches: 0, wins: 0, losses: 0, draws: 0, goals: 0, saves: 0, aerials: 0, flipResets: 0, playtime: 0 },
    achievements: {},
    challenges: { daily: { date: today(), done: {} }, weekly: { date: week(), done: {} } },
    settings: { graphics: "high", musicVol: 0.5, sfxVol: 0.9, masterVol: 0.8, reducedMotion: false, touchLayout: "default" },
  };
}

function today() { return new Date().toISOString().slice(0, 10); }
function week() { const d = new Date(); const onejan = new Date(d.getFullYear(), 0, 1); return Math.ceil((d - onejan) / 604800000); }

export const profile = {
  data: null,
  init() {
    this.data = loadOr("profile", defaultProfile());
    this._ensureDaily();
    return this.data;
  },
  save() { save("profile", this.data); },
  reset() { this.data = defaultProfile(); this.save(); },

  _ensureDaily() {
    const t = today(), w = week();
    if (this.data.challenges.daily.date !== t) this.data.challenges.daily = { date: t, done: {} };
    if (this.data.challenges.weekly.date !== w) this.data.challenges.weekly = { date: w, done: {} };
  },

  get level() { return levelForXP(this.data.xp); },
  rank(mode) { return rankForMMR(this.data.mmr[mode] || 0); },

  addXP(n) { this.data.xp += n; this.save(); return this.level; },
  addMMR(mode, delta) {
    this.data.mmr[mode] = Math.max(0, (this.data.mmr[mode] || 0) + delta);
    this.save();
  },

  owns(cat, id) { return this.data.cosmetics.owned[cat]?.includes(id); },
  unlock(cat, id) {
    if (!this.owns(cat, id)) { this.data.cosmetics.owned[cat].push(id); this.save(); return true; }
    return false;
  },
  equip(slot, id) { this.data.cosmetics.equipped[slot] = id; this.save(); },
  equipped(slot) { return this.data.cosmetics.equipped[slot]; },

  isAchieved(id) { return !!this.data.achievements[id]; },
  achieve(id) {
    if (!this.data.achievements[id]) { this.data.achievements[id] = Date.now(); this.save(); return true; }
    return false;
  },

  // build the cosmetic bundle used by the game
  buildLoadout() {
    const e = this.data.cosmetics.equipped;
    return {
      vehicleId: e.vehicle,
      vehicleDef: VEHICLES.find((v) => v.id === e.vehicle) || VEHICLES[0],
      paint: PAINTS.find((p) => p.id === e.paint) || PAINTS[0],
      paint2: PAINTS.find((p) => p.id === e.paint2) || PAINTS[1],
      wheel: WHEELS.find((w) => w.id === e.wheel) || WHEELS[0],
      boost: BOOSTS.find((b) => b.id === e.boost) || BOOSTS[0],
      banner: BANNERS.find((b) => b.id === e.banner) || BANNERS[0],
      title: TITLES.find((t) => t.id === e.title) || TITLES[0],
      toVehicleCosmetics: function () {
        return {
          paint: this.paint.hex, paint2: this.paint2.hex,
          wheelColor: this.wheel.color, wheelAccent: this.wheel.accent || this.paint.hex,
          wheelRadius: this.wheel.radius, boostColor: this.boost.trail,
        };
      },
    };
  },
};
