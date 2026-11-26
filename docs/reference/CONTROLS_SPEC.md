# Controls Specification

Reference: Rocket League Sideswipe mobile control scheme + supported
Bluetooth controllers. NOVA supports keyboard, mouse, gamepad, and touch.

## Reference control scheme (confirmed)

| Action | Touch | Controller |
| --- | --- | --- |
| Drive (forward/reverse) | Left/right steering zone | Left analog stick |
| Jump | Tap | Jump button (A/Y/X/Triangle) |
| Double jump | Tap again mid-air | Tap jump button again |
| Dodge / Flip (directional) | Tap while steering | Jump button + steer direction |
| Air roll (rotate) | Directional air input | LT/L2 (left), LB/L1 (right) |
| Boost | Hold | Boost button (X/B/Circle/Square) |
| Reset (Free Play) | Reset button | — |

Key behaviors:
- Double jump and dodge share the second airborne tap: no direction = neutral
  double jump; with direction = directional flip.
- Boost is hold-to-accelerate and works mid-air.
- Air roll is a free rotation while the input is held.
- Controllers only function in-match (menus use touch). Boost and jump
  buttons can be swapped in settings.

## NOVA implementation (`src/core/input.js`, `src/ui/touch.js`)

- Intent model: `{ throttle, jump, jumpPressed, boost, dodgeDir, reset,
  pause, source }`. `throttle` is -1/0/1; `dodgeDir` -1/0/1.
- Keyboard: A/D drive, Space jump (again = flip/dodge), Shift/L-Mouse boost,
  R reset (Free Play), Esc pause.
- Mouse: right-click = jump, left-click = boost during a match.
- Gamepad: auto-detected; analog stick drive, triggers/buttons mapped.
- Touch: on-screen zones mirror the mobile scheme.
- **Fully remappable** keyboard/controller bindings in Settings (Player 1).

## Status
- **Verified**: keyboard, mouse, gamepad, touch all produce intents; double
  jump + directional dodge share the jump input as in the reference.
- **Implemented / not fully verified**: exact on-screen touch layout vs
  reference (NOVA uses its own independent layout, per copyright rules).

## Input fidelity notes
- Jump edge-triggered (`jumpPressed`) so a tap = one jump, not continuous.
- Dodge direction carried on the same jump press (`dodgeDir`), matching the
  reference "tap while steering to dash in a direction".
- No input buffering beyond the edge trigger; matches the observed tap
  responsiveness.
