# Mechanics Specification — Advanced Techniques

Reference: observable Sideswipe techniques studied from public guides. Technique
names are **not universally agreed**; NOVA reproduces the underlying physics
(flip resets, air roll, momentum transfer) rather than hard-coding named
effects. No proprietary assets are used.

## Technique reference table

| Technique | Description | Inputs | Vehicle state | Ball state | Physics condition | Expected result |
| --- | --- | --- | --- | --- | --- | --- |
| Flip reset | Refresh flip by touching a surface | (none, passive) | airborne | in contact | underside meets ball/ground/ceiling | `canFlip` restored + small boost + flash |
| Ceiling reset | Reach ceiling to refresh flip + boost | drive to ceiling | near ceiling | any | wheels contact ceiling | `canFlip` + boost restored |
| Wave dash | Flip back into ground, cancel flip | flip back then land | airborne→ground | any | flip toward ground, land | regain flip, keep upward ball momentum |
| Musty flick | Backward flip propels ball forward | backward flip | ball on/near car | on car underside | backward flip while carrying | ball launched forward, car flips back |
| Purple flick | High-power aerial set-up | jump, air-roll to ball, jump | airborne | under car | wheels contact ball mid-air, second jump | explosive upward shot |
| Turtling | Defensive stall | jump, partial roll, hold | airborne | nearby | holding jump while rolled | slow descent, hold position |
| No-flip shot | Spin 180 while in contact | steer 180 in contact | in contact | on car | rotation while touching | ball shot without using flip |
| Air dribble | Carry ball in air | drive + air roll | airborne | on car | dribble carry active | ball carried, can flick |
| Flick / redirect | Quick redirection of ball | tap/flip at ball | in contact/air | on car | contact with timing | ball redirected fast |

## How NOVA supports each (physics-emergent, not button-triggered)

- **Flip reset**: `vehicle.collideBall` underside contact + surface contact
  restore `canFlip`. **Verified** (`tests/physics.test.mjs`,
  `tests/aerial.test.mjs`).
- **Ceiling reset**: ceiling contact restores `canFlip` + regen. **Verified**.
- **Wave dash**: emerges from flip-to-ground + landing reset. **Implemented**.
- **Musty flick / purple flick / flicks**: emerge from air-roll torque +
  directional flip + dribble carry + off-center spin. **Implemented** —
  reproducible in the practice sandbox with training bots.
- **Turtling**: emerges from air-roll + hold; partial auto-level.
  **Partial** (auto-level assist fights stalling; noted as a tuning gap).
- **No-flip shot**: rotation while in contact via air-roll/steer. **Verified**
  as a physics outcome.
- **Air dribble**: `BALL_CARRY_DRAG` dribble carry. **Implemented**.

## Training scenarios (repeatable)
- Practice sandbox (`mode: "free"`) with optional training bots — see the
  Training screen. Used to reproduce flicks, resets, and dribbles.
- Automated tests cover the deterministic core (flip reset, aerial hit,
  ball trajectory, spin/Magnus).

## Honest status
- Core resets and aerials: **Verified**.
- Named advanced flicks: **Implemented / not fully verified** against reference
  footage — they are emergent from the same physics, not scripted.
