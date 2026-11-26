# Game Modes & Match Rules Specification

Reference: observable Rocket League Sideswipe match rules (2-minute matches,
sudden-death overtime, Duel/Doubles/Hoops/Volleyball).

## Reference rules (confirmed)

| Mode | Teams | Duration | Overtime | Notes |
| --- | --- | --- | --- | --- |
| Duel (1v1) | 1v1 | 2:00 | sudden death (first to score) | pure skill |
| Doubles (2v2) | 2v2 | 2:00 | sudden death | coordinated team play |
| Hoops (2v2) | 2v2 | 2:00 | sudden death | basketball hoops, no goal posts; aerial precision |
| Volleyball (seasonal) | 1v1/2v2 | 2:00 | sudden death | ball must stay off the ground |

- Matches are **time-based**: no target-score cap ends a match early.
- Tied at time-up → **overtime = golden goal** (first team to score wins).
- Kickoff: cars face each other, ball centered and bounced up.
- Boost pads respawn after a cooldown (~10 s observed).
- Offline: Free Play, Exhibition (vs bot), Tutorial.

## NOVA implementation (`src/game/match.js`, `MODE_INFO`)

| Mode | teamSize | duration | target | overtime |
| --- | --- | --- | --- | --- |
| 1v1 | 1 | 180 s | 5 | golden goal |
| 2v2 | 2 | 180 s | 5 | golden goal |
| local2p | 1 | 180 s | 5 | golden goal |
| hoops | 1 | 240 s | 7 | golden goal |
| volleyball | 1 | 240 s | 7 | golden goal |
| free | 1 | 0 | 0 | — (sandbox) |

### Identified mismatches (to fix for accuracy)
1. **Duration**: NOVA uses 180 s (1v1/2v2) and 240 s (hoops/volleyball).
   Reference is **120 s (2:00)** for all standard competitive modes.
2. **Target-score cap**: NOVA ends matches early at 5/7 goals. Sideswipe is
   **purely time-based** — the cap is not a reference rule.
3. **Overtime**: NOVA already implements golden-goal sudden death. **Correct.**

### Fix plan
- Set standard mode duration to **120 s**.
- Set `target` to **0** for time-based modes (remove the early-end cap), so
  matches run the full 2 minutes and resolve via time-up + sudden-death OT.
- Hoops scoring (2pt/3pt) and Volleyball rules remain; only timing changes.

## Status
- Overtime (golden goal): **Verified**.
- Duration + time-based-only: **Partial** → being fixed to match reference.
- Hoops/Volleyball rule variants: **Implemented / not fully verified**.
- Kickoff, goal detection, respawn, ball reset: **Verified**.
