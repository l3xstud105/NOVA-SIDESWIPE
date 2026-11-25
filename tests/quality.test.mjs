// quality.test.mjs — verify quality presets + adaptive resolution logic.
// Run: node tests/quality.test.mjs   (no browser)
import {
  QUALITY_PRESETS, QUALITY_ORDER, DEFAULT_QUALITY,
  resolveQuality, backingScale, AdaptiveResolution, autoQuality,
} from "../src/core/quality.js";

let passed = 0, failed = 0;
function check(name, cond, extra = "") {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failed++; console.log("  ✗ " + name + (extra ? "  -> " + extra : "")); }
}

console.log("NOVA SIDESWIPE — quality/perf tests\n");

// 1. presets defined and ordered
check("5 presets defined", Object.keys(QUALITY_PRESETS).length === 5, "n=" + Object.keys(QUALITY_PRESETS).length);
check("potato is lightest scale", QUALITY_PRESETS.potato.scale < QUALITY_PRESETS.cinematic.scale);
check("QUALITY_ORDER has 5 entries", QUALITY_ORDER.length === 5);
check("default quality is valid", !!QUALITY_PRESETS[DEFAULT_QUALITY]);

// 2. every preset has required fields
for (const k of QUALITY_ORDER) {
  const p = QUALITY_PRESETS[k];
  check("preset '" + k + "' has all fields", ["label", "scale", "particles", "shadows", "lighting", "postFX", "targetFps"].every((f) => f in p));
}

// 3. resolveQuality fallback
check("resolveQuality known preset", resolveQuality("medium").label === "Medium");
check("resolveQuality unknown falls back to default", resolveQuality("bogus").label === resolveQuality(DEFAULT_QUALITY).label);

// 4. backing scale clamps
const bs1 = backingScale("cinematic", 1);   // 1.25 * 1
check("backingScale cinematic @1x = 1.25", Math.abs(bs1 - 1.25) < 1e-9, "got " + bs1);
const bs2 = backingScale("potato", 2);      // 0.55 * 2 = 1.1
check("backingScale potato @2x = 1.1", Math.abs(bs2 - 1.1) < 1e-9, "got " + bs2);
const bs3 = backingScale("cinematic", 3);  // 1.25*3=3.75 capped at 2.0
check("backingScale capped at 2.0", bs3 === 2.0, "got " + bs3);
const bs4 = backingScale("potato", 0.1);   // 0.55*0.1=0.055 floored at 0.5
check("backingScale floored at 0.5", bs4 === 0.5, "got " + bs4);

// 5. adaptive resolution: slow frames reduce scale
{
  const ar = new AdaptiveResolution({ base: 1, floor: 0.55, targetFps: 60 });
  // feed slow frames (~25ms avg → well over 16.7ms budget)
  for (let i = 0; i < 80; i++) ar.push(25);
  check("adaptive: slow frames lower scale", ar.scale < 1, "scale=" + ar.scale.toFixed(3));
  check("adaptive: scale respects floor", ar.scale >= 0.55, "scale=" + ar.scale.toFixed(3));
}

// 6. adaptive resolution: fast frames restore scale
{
  const ar = new AdaptiveResolution({ base: 1, floor: 0.55, targetFps: 60 });
  for (let i = 0; i < 80; i++) ar.push(25);
  const reduced = ar.scale;
  // now feed fast frames (~8ms avg → well under budget)
  for (let i = 0; i < 120; i++) ar.push(8);
  check("adaptive: fast frames restore scale", ar.scale > reduced, "before=" + reduced.toFixed(3) + " after=" + ar.scale.toFixed(3));
  check("adaptive: scale caps at 1", ar.scale <= 1, "scale=" + ar.scale.toFixed(3));
}

// 7. adaptive: disabled does nothing
{
  const ar = new AdaptiveResolution({ enabled: false });
  for (let i = 0; i < 80; i++) ar.push(25);
  check("adaptive: disabled keeps scale at 1", ar.scale === 1, "scale=" + ar.scale);
  check("adaptive: disabled multiplier is 1", ar.multiplier() === 1);
}

// 8. adaptive reset
{
  const ar = new AdaptiveResolution({});
  for (let i = 0; i < 80; i++) ar.push(25);
  ar.reset();
  check("adaptive: reset restores scale to 1", ar.scale === 1);
}

// 9. auto quality heuristic
check("autoQuality strong device → cinematic/high", ["cinematic", "high"].includes(autoQuality(3, 8)));
check("autoQuality mid device → medium", autoQuality(1.5, 4) === "medium");
check("autoQuality weak device → low/potato", ["low", "potato"].includes(autoQuality(1, 2)));

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
