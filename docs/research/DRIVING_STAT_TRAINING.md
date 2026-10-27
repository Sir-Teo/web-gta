# Captured driving-skill training

Driving skill previously gained 1 per 25 metres in Progression.tick. It now
uses the selected native time/speed/wheel counter, updates integer stat 160
through its saved binding, and preserves earned skill across MAIN startup.

## Source and independent capture

Pinned gta-reversed `4281f82d8af83e14935ac84a69dfd1ceebb9f256`
delegates UpdateStatsWhenDriving (PC `0x55CAC0`) to the retail executable.
The harness executes the complete selected iOS routine
`0x100265c70..0x100265dfc`, including speed tests, counter arithmetic,
integer-stat mutation and feedback gates. Only CheckForStatsMessage and
DisplayScriptStatUpdateMessage are logged external stubs.

The pinned binary is 14,226,544 bytes, SHA256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
Vehicle velocity, type and wheel-contact count are declared inputs; no speed,
counter or stat arithmetic is stubbed. Packaged AR_STATS.DAT supplies the
configuration, recorded with its hash in the fixture. All 332 fixed profiles
match exactly and regenerate byte-identically:

```sh
PYTHONPATH=artifacts/reversing-deps python scripts/research/emulate-driving-training.py \
  --binary artifacts/gta3sa-ios-reference --output artifacts/driving-training-reference-regenerated.json
cmp tests/fixtures/driving-training-reference.json artifacts/driving-training-reference-regenerated.json
```

## Native arithmetic and ownership

The old counter is converted to float32 and compared strictly greater than
float32(AR 37 × 1,000), normally 300,000. Equality accumulates and waits for
another call. Above threshold the counter resets and positive AR 4 (20)
trains driving skill. The gain truncates to signed int32, adds to the raw
integer stat with 32-bit wrap, converts to float32, caps at 1,000 and converts
back to signed int32. The tests retain native overflow/precision behavior;
GetStatValue's lossy float view must not replace that raw input.

Otherwise, float32 native velocity magnitude selects a weight: 1.5 above
0.8 native units/frame, or for an automobile with no wheel contacts; 0.5
above 0.2; zero below. Native milliseconds truncate
float32(timeStep / 50 × 1,000) before weighting. The old unsigned counter
and weighted milliseconds add as float32, then convert to unsigned. This
conversion saturates at uint32's maximum; the run/sprint integer-add wrap
rule does not apply here. At the host's 30-Hz stat frame, native milliseconds
are 33. Feedback requires a gain above one, enabled updates and skill below
1,000. Hidden feedback does not suppress the stat change.

The selected CPlayerInfo caller sites (`0x100254f04` / `0x100254f1c`) have
an earlier positive native squared-speed gate (`0x100254e28..0x100254e4c`).
The host applies it to its current driver car or quad, maps Rapier velocity
into native x/y/z per-frame units, and supplies actual contact counts. Quads
use their existing two-contact-per-axle mapping as automobiles. Partial work
persists when parked or changing vehicles. Progression.tick now only handles
periodic saving; distance and teleports do not add a second award.

Stat 160 is stored as an integer. Valid signed int32 script/save values
survive, including negatives and above-cap direct sets. Older browser saves
with natural-range fractional distance progress migrate by truncation.
Six host checks fail before the distance/loading repair. All 383 focused
training, save, ride-animation and entry checks pass.

## Startup and live verification

The first driving browser run earns 40→60 in a Landstalker and 60→80 in a
quad, pauses the parked counter, then exposes a separate restore bug: the
save contains 80 but a fresh world reads zero. MAIN's original
SET_FLOAT_STAT 160, 0 is at file offset 56079. Driving ownership now binds
after the same completed MAIN/INITIAL boundary as saved body stats. A unit
check executes that actual instruction and verifies retained early-save
ownership, restored value, subsequent stat writes, no healing and no gain
notifications during binding. The new browser run restores both stat 160
and the ride-animation provider at 80.
The driving check, existing scripted-player-driving check and body/training
save-and-movement regression all pass (three browser checks, 2.0 minutes),
without page errors. TypeScript validation passes too.
The complete unit suite passes all 9,215 tests (51 skipped).
Final TypeScript validation and the production build pass. The first build
process ended without a completion result; the unchanged-source rerun passed
(`artifacts/driving-training-build-final.log`).
Production smoke passes save resume, walking, car entry, map waypoint,
pause/resume, aircraft takeoff and landing gear without page errors or failed requests.

The live test uses original vehicle creation/driver-warp adapters and real W
for horizontal acceleration. Only the award counter is seeded; it does not
write training results. Space parks the car and idle time pauses the counter.
All 82 recorded live inputs were then replayed independently through the
complete native routine. Every resulting skill, counter, condition-check
count and feedback argument matches exactly, including ordinary accumulation
calls and both seeded awards:

```sh
PYTHONPATH=artifacts/reversing-deps python scripts/research/emulate-driving-training.py \
  --binary artifacts/gta3sa-ios-reference --profiles artifacts/driving-training-live-inputs.json \
  --output artifacts/driving-training-live-native.json
```

Evidence is `artifacts/driving-training.json`,
`artifacts/driving-training-live-verification.json` and
`artifacts/driving-training-before-startup-restore.json`.

This validates selected native stat arithmetic and the browser's driver/save
adapter. Full CPlayerInfo scheduling, passenger/other appearance ownership,
native condition/HUD effects, original-PC traces and complete vehicle physics
matching remain separate work. The native training counter is not serialized;
fresh browser worlds start a new counter while saved integer skill persists.
