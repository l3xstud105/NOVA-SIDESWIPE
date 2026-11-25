// arenas.js — original stadium themes for NOVA SIDESWIPE (side-view)
// Coordinates are in world units. Ground at y=0, ceiling at y=H.
// Each arena is a distinct environment, not a recolor.

export const ARENAS = [
  {
    id: "neon",
    name: "NEON ARENA",
    theme: "urban-night",
    W: 1600, H: 900, goalHeight: 360, goalDepth: 70,
    gravity: 2000,
    bg: "#070b18",
    bgAccent: "#10183a",
    floor: "#0c1430",
    floorEdge: "#2ce3ff",
    wall: "#0a1024",
    wallEdge: "#2a3a66",
    ambient: "#1a2440",
    crowd: "#2ce3ff",
  },
  {
    id: "lava",
    name: "MAGMA FORGE",
    theme: "volcanic",
    W: 1560, H: 860, goalHeight: 340, goalDepth: 70,
    gravity: 2050,
    bg: "#150805",
    bgAccent: "#3a1408",
    floor: "#1c0c08",
    floorEdge: "#ff9a3c",
    wall: "#1a0a06",
    wallEdge: "#ff6a2c",
    ambient: "#3a1408",
    crowd: "#ff9a3c",
  },
  {
    id: "orbital",
    name: "ORBITAL STATION",
    theme: "space",
    W: 1680, H: 940, goalHeight: 380, goalDepth: 70,
    gravity: 1700, // lower gravity, floatier
    bg: "#04060f",
    bgAccent: "#0a1230",
    floor: "#0a1024",
    floorEdge: "#b14bff",
    wall: "#080c1c",
    wallEdge: "#5a3a8a",
    ambient: "#0a1230",
    crowd: "#b14bff",
  },
  {
    id: "verdant",
    name: "VERDANT DOME",
    theme: "nature",
    W: 1600, H: 900, goalHeight: 360, goalDepth: 70,
    gravity: 1980,
    bg: "#06120c",
    bgAccent: "#0e2418",
    floor: "#0a1c12",
    floorEdge: "#4bff9d",
    wall: "#08160e",
    wallEdge: "#2a6a44",
    ambient: "#0e2418",
    crowd: "#4bff9d",
  },
];

export function getArena(id) {
  return ARENAS.find((a) => a.id === id) || ARENAS[0];
}
