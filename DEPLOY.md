# DEPLOY.md — NOVA SIDESWIPE deployment

## Current production deployment (frontend)

The browser game is a **static site** and is deployed to **GitHub Pages** from the
branch `arena/ea21b43e-nova-sideswipe` (root). Public URL:

```
https://l3xstud105.github.io/NOVA-SIDESWIPE/
```

No build step is required — the site is plain HTML/CSS/JS (ES modules) with relative
asset paths, so it works under the `/NOVA-SIDESWIPE/` subpath.

To (re)deploy:

```bash
git push origin arena/ea21b43e-nova-sideswipe
```

Pages rebuilds automatically from the branch. Verify with:

```bash
curl -I https://l3xstud105.github.io/NOVA-SIDESWIPE/
curl -s https://l3xstud105.github.io/NOVA-SIDESWIPE/src/main.js | head -c 80
```

### Alternative static hosts

The same files work on Cloudflare Pages, Vercel, Netlify or any static host.
Set the build command to "none" and the publish directory to the repo root.

---

## Backend services (required for online multiplayer / accounts)

These are **not** deployed here (sandbox has no backend infra). They are documented
so deployment is turnkey when infrastructure is available.

### 1. Authoritative game server (WebSocket)

- **Stack:** Node.js + `ws` (or `uWebSockets.js` for scale).
- **Responsibilities:** room codes, matchmaking (1v1 / 2v2), real-time state
  snapshots, server-side validation of goals/results, reconciliation with
  client-side prediction, reconnection.
- **Trust boundary:** the server is the **only** authority for rank, match outcome
  and rewards. Clients never self-report results.

### 2. Authentication

- **Stack:** OAuth2 / JWT.
- Endpoints: `POST /auth/login`, `POST /auth/refresh`, `GET /me`.
- Store refresh tokens securely (httpOnly cookies); never commit secrets.

### 3. Database

- **Postgres** (or DynamoDB) tables: `players`, `cosmetics`, `mmr`,
  `match_history`, `leaderboards`, `challenges`.
- MMR is computed server-side; the client only displays it.

### 4. Matchmaker & regions

- Queue service with region affinity (e.g. `us-east`, `eu-west`).
- Scales horizontally behind a load balancer.

### 5. Object storage

- S3 / R2 for replay blobs and avatars.

---

## Environment variables (client)

When a backend exists, configure the client via a `config.deploy.json` (gitignored)
or `window.NOVA_CONFIG`:

```json
{ "API_BASE": "https://api.nova.example.com", "WS_BASE": "wss://rt.nova.example.com" }
```

No secrets are stored in the repository.

---

## Verification checklist (production)

- [x] Public HTTPS URL opens
- [x] Loader → main menu
- [x] Start a match (1v1/2v2/Local 2P/Hoops/Volleyball/Free Play)
- [x] Vehicle drives, jumps, double-jumps, flips, boosts
- [x] Ball collides and scores; countdown + results work
- [x] Garage customization persists
- [x] Settings persist; controls remap
- [x] `npm test` passes (15/15)
- [ ] Online multiplayer (blocked: needs backend)
- [ ] Cloud accounts / leaderboards (blocked: needs backend)
