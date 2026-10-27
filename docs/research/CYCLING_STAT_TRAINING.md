# Captured cycling training

Riding a player BMX, Chopper or Mountain Bike now trains stamina and cycling
skill through the captured native counters, with body exercise before stamina
awards. Integer cycling stat 230 shares the script store and the browser
save. The host consumes the BMX pedal/boost decision rather than guessing
exercise from distance traveled or the sprint key alone.

## Independent reference

Pinned gta-reversed `4281f82d8af83e14935ac84a69dfd1ceebb9f256`
delegates UpdateStatsWhenCycling (PC `0x55C780`) to the retail executable.
The harness executes the complete selected iOS function
`0x100265770..0x100265a30`, including actual UpdateFatAndMuscleStats
`0x100265280`. Only CheckForStatsMessage and
DisplayScriptStatUpdateMessage are logged stubs. Bike fields, counters,
AR_STATS.DAT configuration and raw stats are declared inputs.

The pinned binary is 14,226,544 bytes, SHA256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
The fixture records the packaged AR_STATS.DAT hash. All 259 fixed captures
match exactly: stats, both cycling counters, shared body counters, feedback
alternation, check counts and ordered message arguments. Profiles cover
stopped/coasting/pedalling/boosted contexts, air/ground contact, speed
boundaries, fractional gains, simultaneous hungry-body/stamina awards,
integer precision/wrap/capping and variable time steps.

## Native arithmetic

Nonzero gas or boost runs body exercise at AR 26 (5) or AR 27 (15), then
updates the cycling stamina counter. Above the old counter's strict
float32(AR 33 × 1,000) limit (300,000), it resets and awards positive AR 0
(50) stamina. Otherwise it adds truncated float32 native milliseconds with
unsigned 32-bit wrap. A negative food-energy stat burns 23 fat on the stamina
increment, after body exercise has changed fat/muscle/health.

Cycling skill has an independent counter and is checked even while coasting
or stopped. Above float32(AR 39 × 1,000), normally 120,000, it resets and
awards positive AR 6 (50). Gain conversion, signed integer addition, float32
conversion, the 1,000 cap and conversion back follow the native instructions.
The host supplies raw saved skill to avoid GetStatValue's lossy conversion
before that addition.

Below the limit, fewer than two native suspension contact points down and native float32 squared speed
above `0.002500000176951289` weigh time by 3. Otherwise squared speed above
`0.04000000283122063` weighs time by 1, or 1.5 with boost. The weighted
truncated milliseconds round **up** before unsigned addition. At 30 Hz the
base is 33 ms: boost adds 50 and the airborne branch adds 99. Threshold
equality waits for another call; idle time preserves partial training.

## Host ownership and limits

WorldBike publishes the cycling call's gas, boost and pre-integration native
velocity only when its active player BMX controller runs. The main loop
consumes those inputs at the same 30-Hz schedule as other training counters,
with two native points per supported front/rear wheel. Frozen, unloaded, scripted and
non-player bicycle contexts do not publish this call. The body callback
shares the existing counters with running, sprinting and swimming.

Cycling skill is a raw signed integer in the versioned browser save, bound
through stat 230 after MAIN setup alongside driving/body ownership. Binding
preserves loaded values without awarding gains or refilling energy. Older
saves and New Game start at the native zero default. Native training counters
remain session state; this browser save subset does not serialize them.

Complete original-PC execution, full CStats/HUD ownership, complete native
bicycle acceleration and BIKE_SPRINT association blending remain open. The
selected native block and counter captures do not establish whole-vehicle
physics or original-PC frame/pose equivalence.

## Live validation

The riding award/reload check and the preceding BMX energy regression pass
(1.1 minutes). Only the training threshold counters and a negative food-energy
input are seeded; W runs the ordinary player bicycle controller and caller.
Cycling skill 0→50, stamina 100→150, muscle 50→60, raw max-health stat 569→589
and fat 200→162 survive pagehide/reload and MAIN startup. Restored sprint
capacity is 600. Coasting preserves the stamina counter and does no body
exercise. No page errors occur.

All **27 recorded live cycling inputs** were independently replayed through
the original selected routine, with **27 exact matches** for all stats,
cycling/body counters, feedback state, check counts and ordered message
arguments. Shared feedback state is carried between those declared inputs.
The fixture also regenerates byte-identically. Evidence is
`artifacts/cycling-training-browser.log`, `artifacts/cycling-training-live.json`,
`artifacts/cycling-training-live-native.json` and
`artifacts/cycling-training-live-verification.json`.

The 680 focused cycling, save, progression, body, ground-training and BMX
checks pass. One initial test incorrectly expected IncrementStat to preserve
an oversized skill instead of applying its existing native 1,000 cap; its
expectation was corrected. The native capture/port comparisons passed from
the first run.

```sh
PYTHONPATH=artifacts/reversing-deps python scripts/research/emulate-cycling-training.py \
  --binary artifacts/gta3sa-ios-reference --output artifacts/cycling-training-regenerated.json
cmp tests/fixtures/cycling-training-reference.json artifacts/cycling-training-regenerated.json
```

The final caller review corrected physical-wheel booleans to native suspension
contact points. CBike's selected loop `0x1004528e0..0x1004529ac` counts four
lines; the browser's front/rear supports each stand in for a pair. All 16
native line masks are captured, and four host pair combinations match their
native counts 0/2/2/4. A one-wheel ride therefore supplies two points and does
not incorrectly take cycling's fewer-than-two-point branch. Individual
one-line contacts and native suspension geometry remain outside the host's
paired-support approximation.

The complete suite passes **9,703 tests / 51 skipped** (183.70 seconds).
That baseline precedes the final paired-contact correction; 494 focused
checks pass after the correction, including the four native contact cases.
The only subsequent test-only type change declares the browser trace row's
shape; it changes no executed behavior.

The final three browser checks pass (1.2 minutes): all-model pedal articulation,
BMX input/energy and cycling award/save/reload. The final independent live
replay covers **27/27 exact profiles**, all with four native ground contact
points. Its evidence replaces the earlier 24-profile pre-correction trace.
The final TypeScript/production build and deployed-base-path smoke also pass,
with save resume, walking, car entry/driving, map, pause, takeoff and gear
checks and no page errors or failed requests. Evidence:
`artifacts/cycling-training-build-final.log` and
`artifacts/cycling-training-production-final.log`.
