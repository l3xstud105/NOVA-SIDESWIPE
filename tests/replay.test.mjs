// replay.test.mjs — verify the replay playback engine reconstructs matches.
// Run: node tests/replay.test.mjs   (no browser needed; logic only)
import { ReplayPlayer } from "../src/game/replay.js";
import { getArena } from "../src/data/arenas.js";

let passed = 0, failed = 0;
function check(name, cond, extra = "") {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failed++; console.log("  ✗ " + name + (extra ? "  -> " + extra : "")); }
}

// Build a synthetic recorded match: 60 frames, ball arcs, a goal at frame ~40.
function makeFrames() {
  const frames = [];
  for (let i = 0; i < 60; i++) {
    const t = 60 - i; // time counts down like a match clock
    const score = { blue: 0, orange: 0 };
    if (i >= 40) score.blue = 1; // blue scored around frame 40
    frames.push({
      t,
      state: i >= 40 ? "goal" : "playing",
      score,
      ball: { x: 800 + i * 4, y: 400 + Math.sin(i / 5) * 40, spin: i * 0.1, vx: 4, vy: 0 },
      v: [
        { x: 400, y: 200, a: 0, b: 80, t: "blue", name: "P1", flip: false },
        { x: 1200, y: 200, a: Math.PI, b: 60, t: "orange", name: "CPU", flip: i > 30 },
      ],
    });
  }
  return frames;
}

console.log("NOVA SIDESWIPE — replay engine tests\n");

const arena = getArena("neon");
const frames = makeFrames();

// 1. Construction + duration
{
  const rp = new ReplayPlayer(frames, arena, { dpr: 1 });
  check("replay player constructed", rp != null);
  check("duration computed from last frame time", rp.duration > 0, `duration=${rp.duration}`);
  check("initial progress is 0", rp.progress === 0);
}

// 2. Playback advances through frames and detects the goal
{
  const events = [];
  const rp = new ReplayPlayer(frames, arena, { dpr: 1, onEvent: (e) => events.push(e) });
  rp.play();
  check("replay starts playing", rp.playing === true);
  // step it forward enough to cross the goal frame (index 40)
  for (let i = 0; i < 60; i++) rp.update(1 / 60);
  const goals = events.filter((e) => e.type === "goal");
  check("playback detects a goal event", goals.length >= 1, `goals=${goals.length}`);
  check("goal event attributes the scoring team", goals[0] && goals[0].team === "blue");
  check("replay reaches the final frame", rp.index >= frames.length - 1);
  check("replay stops at the end", rp.playing === false);
  check("end event emitted", events.some((e) => e.type === "end"));
}

// 3. Seeking
{
  const rp = new ReplayPlayer(frames, arena, { dpr: 1 });
  rp.seek(30);
  check("seek to time 30 lands on a frame near that time", Math.abs(rp.currentTime - 30) < 1.5, `t=${rp.currentTime}`);
  rp.seekToIndex(10);
  check("seekToIndex places at frame 10", rp.index === 10);
  // clamp
  rp.seekToIndex(9999);
  check("seek clamps to last frame", rp.index === frames.length - 1);
}

// 4. Speed control
{
  const rp = new ReplayPlayer(frames, arena, { dpr: 1 });
  rp.setSpeed(2);
  check("speed set to 2", rp.speed === 2);
  rp.setSpeed(0.5);
  check("speed set to 0.5", rp.speed === 0.5);
}

// 5. Pause / toggle
{
  const rp = new ReplayPlayer(frames, arena, { dpr: 1 });
  rp.play();
  const wasPlaying = rp.playing;
  rp.pause();
  check("pause stops playback", rp.playing === false && wasPlaying === true);
  rp.toggle();
  check("toggle resumes playback", rp.playing === true);
  rp.toggle();
  check("toggle pauses again", rp.playing === false);
}

// 6. Goal markers are precomputed
{
  const rp = new ReplayPlayer(frames, arena, { dpr: 1 });
  check("goal markers identified", rp._goals.length >= 1, `markers=${rp._goals.length}`);
  check("marker references a valid frame index", rp._goals[0].index >= 0 && rp._goals[0].index < frames.length);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
