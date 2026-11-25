# NOVA SIDESWIPE

**A browser-based, side-view competitive car-soccer game.** Play instantly in any modern browser — no install, no download, no launcher. Built with HTML5 Canvas, the Web Audio API and ES modules. Original NOVA visual identity, physics, vehicles, arenas and audio (no proprietary assets).

- **Public URL:** `https://l3xstud105.github.io/NOVA-SIDESWIPE/`
- **Developer:** L3X STUD105 · **Version:** 0.2

---

## Play

Open the URL, wait for the loader, and you land in the main menu. Everything is playable from there:

1. **Play** → pick a mode (1v1, 2v2, Local 2P, Hoops, Volleyball, Free Play), a stadium, AI difficulty and Casual/Ranked, then **Enter Match**.
2. **Garage** → customize your vehicle (paint, wheels, boost trail, title) — changes persist locally.
3. **Training / Free Play** → sandbox with ball & car reset (`R`).
4. **Ranked** → see your 1v1 / 2v2 rank and ladder.
5. **Challenges** → daily & weekly objectives that auto-complete and grant XP.
6. **Profile / Settings / Stats** → career stats, achievements, audio, graphics, remappable controls, accessibility.

### Controls

| Action | Keyboard / Mouse | Gamepad |
| --- | --- | --- |
| Drive left / right | `A` / `D` | Left stick |
| Jump | `Space` (or right mouse) | `A` |
| Boost | `Shift` (or left mouse) | `RT` / `RB` |
| Double jump / directional flip (dodge) | `Space` again while airborne, hold a direction | `A` again |
| Reset ball & car (Free Play) | `R` | — |
| Pause | `Esc` | — |
| Scoreboard | `Tab` (reserved) | — |

Touch devices get an on-screen joystick + boost/jump buttons automatically.

---

## What's implemented (honest status)

| Area | Status | Notes |
| --- | --- | --- |
| Browser game, public URL | **COMPLETE** | Deployed to GitHub Pages (HTTPS). |
| Loading screen + main menu | **COMPLETE** | Animated showcase, vehicle rotation, nav, player chip. |
| Vehicle physics | **COMPLETE** | Acceleration, jump, double jump, dodge flips, air roll, boost, wall/ceiling riding, flip resets. Reproducible tests. |
| Ball physics | **COMPLETE** | Gravity, restitution, car/wall/ceiling collisions, goal detection. |
| Game modes | **COMPLETE** | 1v1, 2v2 (vs AI), Local 2P, Free Play, Hoops, Volleyball. |
| AI opponents | **COMPLETE** | Same physics as players; easy/medium/hard; offense/defense/aerials. |
| Garage & customization | **COMPLETE** | Paint (primary/secondary), wheels, boost trails, titles; persists in `localStorage`. |
| Training / Free Play | **COMPLETE** | Ball & car reset, sandbox. |
| Settings & accessibility | **COMPLETE** | Graphics quality, audio volumes, remappable controls, reduced motion. |
| Audio | **COMPLETE** | Procedural engine (pitch follows speed), boost, jumps, impacts, goals, countdown, generative music. |
| Progression | **COMPLETE (local)** | XP/level, rank ladder, achievements, daily/weekly challenges, stats — stored locally. |
| HUD / countdown / results | **COMPLETE** | Score, clock, boost, names, countdown, goal flash, results + rewards. |
| Performance | **COMPLETE** | Fixed-timestep sim, capped particles, DPR-aware canvas, quality presets. |
| Automated physics tests | **COMPLETE** | `node tests/physics.test.mjs` — 15 passing checks. |
| Online multiplayer | **NOT IMPLEMENTED** | Requires a backend (see *Backend requirements*). No fake players/bots冒充 real users. |
| Accounts / cloud saves / online leaderboards | **NOT IMPLEMENTED** | Local profile only; server-authoritative services described below. |
| Replays | **PARTIAL** | Frame recording exists in-match; a full replay viewer is not wired into a menu yet. |
| Tournaments | **NOT IMPLEMENTED** | Mode scaffolding present; bracket service needs backend. |

---

## Run it locally

```bash
npm run serve          # serves the static site at http://localhost:4173
# or any static server:
python3 -m http.server 4173
```

Then open the URL. Because the game uses ES modules, it must be served over HTTP(S) (not `file://`).

Run the test suite:

```bash
npm test
```

---

## Architecture

```
index.html              App shell, loader, canvas, UI roots
styles/main.css         NOVA design system (original identity)
src/
  core/                 math, storage, input, audio, loop, router, profile
  data/                 vehicles, cosmetics, arenas, progression (original content)
  game/                 config (tunables), vehicle, ball, ai, match, world, game
  ui/                   dom helpers, hud, screens, touch
tests/                  reproducible physics & rules tests
tools/serve.js          dev static server
```

- **Rendering:** HTML5 Canvas 2D. Side-view (Sideswipe-style) so a single fixed camera shows the whole arena.
- **Physics:** fixed timestep (`src/core/loop.js`), capsule-based vehicle collision, centralized tunables (`src/game/config.js`).
- **Audio:** fully procedural Web Audio (`src/core/audio.js`) — no audio files.
- **Persistence:** `localStorage` via `src/core/storage.js`.
- **Input:** keyboard + mouse + gamepad + touch, fully remappable (`src/core/input.js`).

---

## Backend requirements (for the not-yet-implemented online features)

Online multiplayer, accounts, cloud saves, ranked matchmaking and leaderboards require server-side services that cannot run on static hosting. The intended architecture:

| Service | Responsibility | Notes |
| --- | --- | --- |
| WebSocket relay / authoritative server | Real-time sync, server validation, match results | Node + `ws`/`uWebSockets.js`; client prediction + reconciliation. |
| Auth service | Accounts, sessions, secure tokens | OAuth/JWT; never trust client rank/results. |
| Database | Profiles, cosmetics, MMR, match history | Postgres / DynamoDB. |
| Matchmaker | 1v1 / 2v2 queues, regions | Scales with concurrent players. |
| Blob/object storage | Replay files, avatars | S3 / R2. |

The client already isolates match logic so an authoritative server can replace local AI/results. `window.__NOVA__` exposes `game`, `profile`, `audio`, `input` for integration testing. When these services exist, point the client at them via environment-configured endpoints (documented here; no secrets are committed).

---

## Deployment

Static frontend is deployed to **GitHub Pages** from this branch:

```bash
git push origin arena/ea21b43e-nova-sideswipe
# Pages is enabled on this branch (root) -> https://l3xstud105.github.io/NOVA-SIDESWIPE/
```

The site is pure static files with relative asset paths, so it works under the `/NOVA-SIDESWIPE/` subpath. See `DEPLOY.md` for the authoritative-server deployment notes.

---

## Known limitations

- Online multiplayer, accounts, cloud saves and online leaderboards are not deployed (no backend in this environment). The game is fully playable offline / local versus AI and Local 2P.
- Replay *recording* runs during matches; a dedicated replay viewer screen is planned.
- Physics is tuned for game-feel, not simulation accuracy; all values live in `src/game/config.js` for easy tuning.
