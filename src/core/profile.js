// profile.js — local player profile, progression, cosmetics (persistent)
import { load, save, loadOr } from "./storage.js";
import { PAINTS, WHEELS, BOOSTS, BANNERS, TITLES } from "../data/cosmetics.js";
import { VEHICLES } from "../data/vehicles.js";
import { rankForMMR, levelForXP, LEVEL_REWARDS, REWARD_LEVELS, rewardsAtLevel } from "../data/progression.js";

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
    stats: { matches: 0, wins: 0, losses: 0, draws: 0, goals: 0, shots: 0, saves: 0, aerials: 0, flipResets: 0, playtime: 0 },
    achievements: {},
    grantedRewards: {},
    challenges: { daily: { date: today(), done: {} }, weekly: { date: week(), done: {} } },
    replays: [],
    presets: [],
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

  // ---- replays (local) ----
  saveReplay(entry) {
    if (!this.data.replays) this.data.replays = [];
    // keep last 12 replays, newest first
    this.data.replays.unshift(entry);
    if (this.data.replays.length > 12) this.data.replays.length = 12;
    this.save();
    return entry;
  },
  getReplays() { return this.data.replays || []; },
  getReplay(id) { return this.data.replays.find((r) => r.id === id) || null; },
  deleteReplay(id) {
    this.data.replays = (this.data.replays || []).filter((r) => r.id !== id);
    this.save();
  },

  // ---- vehicle presets ----
  getPresets() { return this.data.presets || []; },
  savePreset(name, equipped) {
    if (!this.data.presets) this.data.presets = [];
    const id = "preset_" + Date.now().toString(36);
    const preset = { id, name: name || "Preset", equipped: { ...equipped }, created: Date.now() };
    this.data.presets.unshift(preset);
    this.save();
    return preset;
  },
  updatePreset(id, name, equipped) {
    const p = (this.data.presets || []).find((x) => x.id === id);
    if (!p) return false;
    if (name) p.name = name;
    p.equipped = { ...equipped };
    this.save();
    return true;
  },
  deletePreset(id) {
    this.data.presets = (this.data.presets || []).filter((x) => x.id !== id);
    this.save();
  },
  loadPreset(id) {
    const p = (this.data.presets || []).find((x) => x.id === id);
    if (!p) return false;
    for (const [slot, val] of Object.entries(p.equipped)) this.equip(slot, val);
    return true;
  },

  // ---- level-up reward track ----
  // key = "category:id"; stored in data.grantedRewards
  _rewardKey(cat, id) { return cat + ":" + id; },

  hasReward(cat, id) {
    if (!this.data.grantedRewards) this.data.grantedRewards = {};
    return !!this.data.grantedRewards[this._rewardKey(cat, id)];
  },

  // grant every reward for all reward levels up to the player's current level
  // that have not been granted yet. Returns the list of newly granted rewards.
  grantLevelRewards() {
    if (!this.data.grantedRewards) this.data.grantedRewards = {};
    const lvl = this.level.level;
    const granted = [];
    for (const rl of REWARD_LEVELS) {
      if (rl > lvl) break;
      for (const r of rewardsAtLevel(rl)) {
        const key = this._rewardKey(r.category, r.id);
        if (!this.data.grantedRewards[key]) {
          this.data.grantedRewards[key] = true;
          // unlock the cosmetic (adds to owned if it's a cosmetic category)
          if (["paint", "wheel", "boost", "banner", "title", "vehicle"].includes(r.category)) {
            this.unlock(r.category, r.id);
          }
          granted.push({ ...r });
        }
      }
    }
    if (granted.length) this.save();
    return granted;
  },

  // all rewards the player has earned (granted)
  getGrantedRewards() {
    if (!this.data.grantedRewards) this.data.grantedRewards = {};
    return LEVEL_REWARDS.filter((r) => this.data.grantedRewards[this._rewardKey(r.category, r.id)]);
  },

  // next reward tier (level + label) the player is progressing toward
  nextReward() {
    const lvl = this.level.level;
    const upcoming = REWARD_LEVELS.filter((rl) => rl > lvl);
    if (!upcoming.length) return null;
    const nextLevel = upcoming[0];
    return { level: nextLevel, rewards: rewardsAtLevel(nextLevel) };
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
