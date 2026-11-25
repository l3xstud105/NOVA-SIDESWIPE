// cosmetics.js — original paint, wheels, boost effects, banners, titles
// Colors are NOVA original palette. Items are purely cosmetic.

export const PAINTS = [
  { id: "void", name: "Void Black", rarity: "common", hex: "#11131f" },
  { id: "white", name: "Plasma White", rarity: "common", hex: "#eef2ff" },
  { id: "cyan", name: "Nova Cyan", rarity: "rare", hex: "#2ce3ff" },
  { id: "violet", name: "Hyper Violet", rarity: "rare", hex: "#b14bff" },
  { id: "magenta", name: "Pulse Magenta", rarity: "rare", hex: "#ff4bd8" },
  { id: "gold", name: "Aurum Gold", rarity: "epic", hex: "#ffd24b" },
  { id: "mint", name: "Ion Mint", rarity: "rare", hex: "#4bff9d" },
  { id: "ember", name: "Ember Orange", rarity: "epic", hex: "#ff9a3c" },
  { id: "crimson", name: "Crimson Tide", rarity: "rare", hex: "#ff5a6e" },
  { id: "cobalt", name: "Deep Cobalt", rarity: "common", hex: "#2a63ff" },
  { id: "toxic", name: "Toxic Lime", rarity: "epic", hex: "#c6ff3a" },
  { id: "chrome", name: "Chrome Prism", rarity: "legendary", hex: "#cfd8ff" },
];

export const WHEELS = [
  { id: "stock", name: "Stock Rims", rarity: "common", radius: 13, color: "#23283a" },
  { id: "sport", name: "Sport Forged", rarity: "rare", radius: 13, color: "#1a1d2c", accent: "#2ce3ff" },
  { id: "magma", name: "Magma Hoop", rarity: "epic", radius: 14, color: "#1a1118", accent: "#ff9a3c" },
  { id: "prism", name: "Prism Disc", rarity: "legendary", radius: 14, color: "#15131f", accent: "#b14bff" },
];

export const BOOSTS = [
  { id: "standard", name: "Ion Trail", rarity: "common", trail: "#2ce3ff", burst: "#9af6ff" },
  { id: "inferno", name: "Inferno", rarity: "rare", trail: "#ff9a3c", burst: "#ffd24b" },
  { id: "void", name: "Void Surge", rarity: "rare", trail: "#b14bff", burst: "#e0a6ff" },
  { id: "toxic", name: "Toxic Spit", rarity: "epic", trail: "#c6ff3a", burst: "#eaffa0" },
  { id: "gold", name: "Aurum Flare", rarity: "legendary", trail: "#ffd24b", burst: "#fff3c0" },
];

export const BANNERS = [
  { id: "none", name: "No Banner", rarity: "common", color: "#2ce3ff" },
  { id: "striker", name: "Striker", rarity: "rare", color: "#ff4bd8" },
  { id: "guardian", name: "Guardian", rarity: "rare", color: "#4bff9d" },
  { id: "star", name: "Starborn", rarity: "epic", color: "#ffd24b" },
];

export const TITLES = [
  { id: "rookie", name: "Rookie" },
  { id: "ace", name: "Ace" },
  { id: "veteran", name: "Veteran" },
  { id: "legend", name: "Legend" },
];

export function getById(list, id) {
  return list.find((x) => x.id === id) || list[0];
}
