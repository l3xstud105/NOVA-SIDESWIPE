# NOVA SIDESWIPE — Reference Specification

Recreation target: **Rocket League Sideswipe** (Psyonix/Epic), a 2D side-view
car-soccer game. This document records observable behavior studied from
legitimate public sources. It distinguishes **confirmed** behavior from
**community-reported** behavior and **assumptions**. No proprietary code or
assets are reproduced — only observable gameplay behavior.

## Evidence sources (public, legitimate)

- Official support: "Getting started in Rocket League Sideswipe" — Epic Games
  help center. Controls, modes, rank system.
- Controller guide — Gamepur / Charlie INTEL. Button layout, air roll.
- "Grand Champion's Guide to Rocket League Sideswipe" — r/RLSideSwipe wiki.
  Flip resets, animation cancels, wave dashes, mechanics.
- Sideswipe shooting & control tutorial — aoeah.com. Flip reset, ceiling reset.
- Sideswipe tips & tricks — AndroidPolice. Purple flick, killipop, turtling,
  wavedash, boost reset.
- Match rules — pocketgamer, gamingonphone, charlieintel. 2-minute matches,
  sudden-death overtime, Duel/Doubles/Hoops formats.
- 3D Rocket League field values (rlgym.org, RLBot wiki) — **NOT Sideswipe**.
  Sideswipe is a distinct 2D game with smaller arenas. These values are
  listed only to warn against misattributing 3D RL geometry to Sideswipe.

## Confirmed core behavior

### Matches
- Match length: **2 minutes** for Duel 1v1, Doubles 2v2, Hoops 2v2.
- Tied at time-up → **overtime = sudden death** (first team to score wins).
- No target-score cap ends the match; play is time-based only.
- Offline solo: Free Play, Exhibition (vs bot), Tutorial.
- Online competitive: Duel 1v1, Doubles 2v2, Hoops 2v2 (+ seasonal LTMs
  such as Volleyball).

### Controls (touch primary; controller supported)
- **Drive**: left/right steering. Can drive up and down walls.
- **Jump**: tap. **Double jump**: tap again mid-air. Resets on landing.
- **Boost**: hold to accelerate forward. Works mid-air for aerials.
- **Dodge/Flip**: tap while steering to dash in a direction; full 360°
  rotation possible. A dodge shot pushes the ball away (useful for
  shooting/defense).
- **Air roll**: rotate left/right (LT/LB on controller, or directional
  input). Free air roll while held.
- **Controller**: left stick = move; LT/L2 = rotate left; LB/L1 = rotate
  right; Boost = X/B/Circle/Square; Jump = A/Y/X/Triangle (double-tap =
  double jump).

### Core mechanics (confirmed)
- **Flip reset**: touching a surface (ground, ceiling, or the ball) with the
  car refreshes the double jump / flip. In Sideswipe this is **very lenient**
  — contact with the underside at most angles counts. Visual cue: white flash
  around the car. A reset also grants a small amount of boost.
- **Animation cancel / landing auto-correct**: on landing, the car
  automatically corrects to upright, immediately restoring full control and
  the flip. Exception: if the player holds the input **directly away from
  the surface being landed on**, auto-correct does not force the flip back.
- **Ceiling reset**: reaching the ceiling restores flip + boost.
- **Boost pads**: respawn after a cooldown (~10 s observed).
- **Kickoff**: cars start facing each other; the ball is centered and
  bounces up. Players flick into it (e.g. the "Brodoff": air-roll into the
  center of the ball).

### Community-reported advanced mechanics (observed, names vary)
- Wave dash (flip back into the ground, cancel the flip).
- Musty flick (backward flip propels the ball forward).
- Purple flick (jump → air roll to wheel-contact with ball → jump again).
- Turtling (jump, partial air roll, hold).
- Flicks / redirects / pinches / stalls.

These are **not universally defined**; the implementation reproduces the
underlying physics (flip resets, air roll, momentum transfer) rather than
hard-coding named effects.

## Status labeling used in this project

Each system is classified as one of:
- **Verified** — tested and matching reference behavior.
- **Implemented / not fully verified** — present and physically plausible,
  not yet measured against reference footage.
- **Partial** — some behavior present, gaps remain.
- **Missing** — not implemented.

See PHYSICS_SPEC.md, CONTROLS_SPEC.md, MECHANICS_SPEC.md, GAME_MODES_SPEC.md
for per-system detail and the NOVA-vs-reference comparison.
