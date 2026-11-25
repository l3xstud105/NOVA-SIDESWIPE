// vehicles.js — original NOVA vehicle definitions (stats + silhouette style)
// All numbers are tuning multipliers around a baseline. No proprietary assets.

export const VEHICLES = [
  {
    id: "nova",
    name: "NOVA-01",
    rarity: "common",
    blurb: "Balanced all-rounder. The studio's signature chassis.",
    stats: { drive: 1.0, boost: 1.0, handling: 1.0, mass: 1.0 },
    shape: { style: "sedan", length: 64, height: 26, cabin: 0.5, nose: 0.18, accel: 1250, maxSpeed: 1320, maxBoostSpeed: 2050 },
  },
  {
    id: "comet",
    name: "COMET",
    rarity: "rare",
    blurb: "Light and twitchy. Exceptional aerial handling, lower mass.",
    stats: { drive: 1.06, boost: 1.05, handling: 1.18, mass: 0.86 },
    shape: { style: "sport", length: 60, height: 22, cabin: 0.42, nose: 0.26, accel: 1340, maxSpeed: 1410, maxBoostSpeed: 2160 },
  },
  {
    id: "titan",
    name: "TITAN",
    rarity: "epic",
    blurb: "Heavy bruiser. Wins physical challenges, slower to rotate.",
    stats: { drive: 0.94, boost: 1.08, handling: 0.84, mass: 1.28 },
    shape: { style: "truck", length: 72, height: 30, cabin: 0.46, nose: 0.12, accel: 1180, maxSpeed: 1240, maxBoostSpeed: 1980 },
  },
  {
    id: "wraith",
    name: "WRAITH",
    rarity: "legendary",
    blurb: "Prototype hyperframe. Top-tier boost and crisp control.",
    stats: { drive: 1.1, boost: 1.14, handling: 1.1, mass: 0.96 },
    shape: { style: "wedge", length: 66, height: 20, cabin: 0.36, nose: 0.32, accel: 1420, maxSpeed: 1480, maxBoostSpeed: 2300 },
  },
];

export function getVehicle(id) {
  return VEHICLES.find((v) => v.id === id) || VEHICLES[0];
}
