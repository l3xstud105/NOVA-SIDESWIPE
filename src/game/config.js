// config.js — centralized, tunable physics configuration
// All values are in world units (px) and seconds. Frame-rate independent.

export const PHYS = {
  // ground driving
  DRIVE_ACCEL: 2600,
  MAX_DRIVE_SPEED: 1320,
  GROUND_FRICTION: 6.5,        // velocity damping per second when no throttle
  GROUND_TURN_EASE: 16,        // how fast car aligns to ground normal

  // jumping
  JUMP_VEL: 1040,
  DOUBLE_JUMP_VEL: 760,
  DOUBLE_JUMP_UP_ONLY: true,

  // flips / dodges
  FLIP_DURATION: 0.46,
  FLIP_ANGVEL: 13.6,           // rad/s spin during flip (~ one full rotation)
  FLIP_IMPULSE: 1180,          // horizontal burst
  FLIP_UP: 360,                // vertical component of a flip
  FLIP_RESET_BOOST: 12,        // boost granted by a flip reset

  // air control
  AIR_TORQUE: 30,              // angular acceleration from directional input
  AIR_MAX_ANGVEL: 14,
  AIR_DAMP: 2.0,              // angular damping when no air-roll input
  AIR_AUTO_LEVEL: 3.2,        // gentle self-righting torque when airborne w/ no input
  AERIAL_DRIVE: 900,          // small horizontal nudge in air
  AERIAL_DRIVE_BOOST: 1500,   // aerial steer strength while boosting

  // boost
  BOOST_ACCEL: 3000,
  BOOST_MAX_SPEED: 2350,
  BOOST_DRAIN: 33,            // per second
  BOOST_REGEN: 11,            // passive per second
  BOOST_PAD_AMOUNT: 100,      // instant refill from pads

  // global
  AIR_DRAG: 0.18,             // linear drag coefficient (per second)
  RESTITUTION_CAR: 0.45,      // car vs ball energy retention
  RESTITUTION_WALL: 0.62,     // ball vs wall
  RESTITUTION_GROUND: 0.66,   // ball vs ground
  BALL_EXTRA_KICK: 0.18,      // extra ball speed from car contact speed
  BALL_MAGNUS: 0.32,          // Magnus coefficient: spin -> lateral curve
  BALL_CARRY_DRAG: 0.85,      // how strongly a moving car drags a pinned ball (dribble)
  BALL_SPIN_KICK: 0.0009,     // spin imparted per unit contact offset * car speed
};

export const BALL_RADIUS = 27;
export const CAR_RADIUS_PAD = 4; // added to car half-height for collision
