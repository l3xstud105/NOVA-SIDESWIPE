# Physics Specification — Vehicle & Ball

Reference: observable Rocket League Sideswipe behavior (see REFERENCE_SPEC.md).
All NOVA values are tunable in `src/game/config.js` (`PHYS`).

## 1. Vehicle ground physics

### Reference (confirmed)
- Forward/reverse acceleration along the drive axis; braking via releasing
  throttle (friction decelerates).
- A max ground speed; cannot exceed it under throttle.
- Cars can drive up walls and along the ceiling (surface-aligned driving).
- Landing auto-corrects orientation to the surface normal (animation cancel),
  restoring control + flip.

### NOVA implementation
- `DRIVE_ACCEL`, `MAX_DRIVE_SPEED`: acceleration + tangential speed cap.
- `GROUND_FRICTION`: per-second velocity damping when no throttle (braking).
- `GROUND_TURN_EASE`: angular alignment to surface normal on contact.
- Ground control projects throttle along the surface tangent, so wall/ceiling
  driving works via `groundNormal`.
- **Status: Verified** for driving, friction, speed cap, surface alignment.

## 2. Jumping

### Reference (confirmed)
- Tap = jump straight up. Tap again mid-air = double jump. Resets on landing.
- The second airborne tap is the **flip/dodge**: directional (full 360°).

### NOVA implementation
- `JUMP_VEL`: ground jump impulse (world-up).
- `DOUBLE_JUMP_VEL`: neutral second jump (up-only) when no dodge direction.
- Directional second tap = flip (see §3). `canFlip` gates the second jump;
  restored on any surface contact (ground/ceiling/ball).
- **Status: Verified** for single/double jump and reset-on-landing.

## 3. Dodging / flips

### Reference (confirmed)
- Dodge = directional flip that **affects real movement** (not a canned
  animation): horizontal dash + vertical pop + full rotation.
- Full 360° rotation achievable via steering direction.

### NOVA implementation
- `FLIP_DURATION` 0.46 s, `FLIP_ANGVEL` 13.6 rad/s (~1.4 rotations),
  `FLIP_IMPULSE` horizontal burst, `FLIP_UP` vertical component.
- `dodgeDir` selects direction; the flip spins `angVel` and imparts impulse.
- **Status: Verified** — flip moves the vehicle and rotates it; not a canned
  animation.

## 4. Aerial control

### Reference (confirmed)
- Air steering = rotation (air roll) via directional input; free while held.
- Boost works mid-air for aerial moves; momentum preserved.
- Gentle self-righting assist so aerials stay controllable.

### NOVA implementation
- `AIR_TORQUE`, `AIR_MAX_ANGVEL`: rotation from directional input (air roll).
- `AERIAL_DRIVE` / `AERIAL_DRIVE_BOOST`: small horizontal nudge, stronger
  while boosting (aerial steer).
- `AIR_AUTO_LEVEL`: gentle self-righting torque when no input; `AIR_DAMP`
  angular damping.
- **Status: Implemented / not fully verified** against reference footage.

## 5. Boost

### Reference (confirmed)
- Hold = accelerate forward; drains a boost meter; works mid-air.
- Boost pads refill instantly and respawn after a cooldown (~10 s observed).
- Passive regen when not boosting.

### NOVA implementation
- `BOOST_ACCEL` along car axis, `BOOST_MAX_SPEED` cap, `BOOST_DRAIN`,
  `BOOST_REGEN`, `BOOST_PAD_AMOUNT`.
- Boost works in air and during flip recovery.
- **Status: Verified** for drain/regen/pads; pad respawn timing to be aligned
  to ~10 s (see GAME_MODES_SPEC / world.js).

## 6. Ball physics

### Reference (confirmed)
- Gravity, linear momentum, bounce off floor/walls/ceiling with elasticity.
- Vehicle contact imparts velocity proportional to car speed; off-center hits
  curve the ball (slice/hook).
- The ball can be carried/dribbled on the car.

### NOVA implementation
- Gravity + linear drag; `RESTITUTION_GROUND` / `RESTITUTION_WALL` elasticity.
- Capsule-vs-circle collision with restitution + `BALL_EXTRA_KICK` speed bonus
  + boost bonus.
- `BALL_SPIN_KICK`: off-center hits impart spin; `BALL_MAGNUS`: spin curves
  the path (slice/hook). `BALL_CARRY_DRAG`: dribble carry.
- **Status: Implemented / not fully verified** — physically consistent and
  tested for determinism; exact tuning vs reference is qualitative.

## 7. Flip resets

### Reference (confirmed)
- Touching a surface (ground, ceiling, or **the ball**) with the car
  refreshes the flip. Very lenient — underside contact at most angles.
- Grants a small boost. Visual cue: white flash.

### NOVA implementation
- `collideBall`: airborne ball contact with car underside (`ny > 0.35`) sets
  `canFlip = true`, grants `FLIP_RESET_BOOST`, emits `flipReset`.
- Ground/ceiling contact also restores `canFlip`.
- **Status: Verified** for reset-on-surface and reset-on-ball; leniency is
  reasonable (underside hemisphere).

## 8. Landing auto-correct (animation cancel)

### Reference (confirmed)
- On landing, the car snaps to upright (surface normal), restoring control +
  flip. **Exception**: if the player holds input directly away from the
  landing surface, auto-correct does not force the flip back.

### NOVA implementation
- On ground contact, `canFlip` is restored and the car aligns to the surface
  normal via `GROUND_TURN_EASE`.
- **Gap**: NOVA does not yet honor the "input away from landing surface"
  exception. **Status: Partial.** (Tracked for implementation.)

## Determinism / testing
- Fixed-timestep loop; physics tests assert frame-rate independence and
  repeatable trajectories (`tests/physics.test.mjs`, `tests/ball.test.mjs`,
  `tests/aerial.test.mjs`).
