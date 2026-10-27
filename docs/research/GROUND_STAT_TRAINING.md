# Captured run and sprint training

The browser's ground training counters previously used unrestricted JavaScript
numbers, double-precision thresholds and unrounded gain callbacks. The port
now follows the selected native float32 and unsigned-counter operations.
Normal fixed-frame gameplay retains its five-minute stamina thresholds.

## Source and independent execution

Pinned gta-reversed `4281f82d8af83e14935ac84a69dfd1ceebb9f256`
reverses UpdateStatsWhenSprinting (PC `0x55C660`) and
UpdateStatsWhenRunning (`0x55C6F0`). The harness executes the complete
selected iOS routines at `0x100265518` / `0x100265644`, including their
actual [body exercise](BODY_EXERCISE.md) callee at `0x100265280`.
Only CheckForStatsMessage and DisplayScriptStatUpdateMessage are logged
external stubs. Body-entry and stamina-store hooks observe instructions
without skipping them. The pinned 14,226,544-byte binary has SHA256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.

Packaged AR_STATS.DAT supplies the runtime configuration. The fixture records
its values and file hash. All 137 cases execute actual body/caller stat writes,
covering equality/next-call thresholds, normal frame lengths, capped/negative
stats, negative energy, simultaneous body/health/stamina awards, non-positive
and fractional gain settings, float32 counter comparisons and uint32 wrap.
These executable traces support selected-platform matching; the reversed PC
source alone is not an independent original-PC execution.

```sh
PYTHONPATH=artifacts/reversing-deps python scripts/research/emulate-ground-training.py \
  --binary artifacts/gta3sa-ios-reference --output artifacts/ground-training-reference-regenerated.json
cmp tests/fixtures/ground-training-reference.json artifacts/ground-training-reference-regenerated.json
```

## Behavior and validation

The host keeps its existing millisecond method interface. It restores native
50-Hz timestep units with float32 rounding, then truncates native
float32(timeStep / 50 × 1,000) into an unsigned integer. Counter additions
wrap to uint32. The old unsigned counter is compared as float32 against
float32(AR limit × 1,000), strictly greater than; equality still accumulates
and waits for the next call. At threshold, it resets and invokes the stamina
increment only for a positive float32 award. Body exercise runs first.

Twelve of the first 136 complete-profile checks fail before repair: wrapped
counters, float32 threshold decisions, fractional award precision and
non-positive callback suppression. All 137 captured profiles and all 421
focused body/swim/save/caller checks pass after repair. The fixture regenerates
byte-identically. TypeScript validation passes.

The live browser seeds only threshold counters and uses real W then W+Shift.
Running awards stamina 100→105; sprinting awards 105→115. Each complete
caller/body result matches an independent native profile, including rate,
body values, body-counter additions and stamina-counter reset. Idle time
does not advance the running counter. The existing exercise/earned-stat
pagehide-reload regression passes too (two checks, 1.5 minutes). Both have
no page errors; distant water streaming in the exercise regression reports
terrain-support warnings. Evidence is `artifacts/ground-training.json` and
`artifacts/ground-training-browser.log`.
The complete unit suite passes all 8,867 tests (51 skipped).
Final TypeScript validation and the production build pass.
Production smoke passes old-save resume, walking, car entry, map waypoint,
pause/resume, aircraft takeoff and landing gear, without page errors or failed requests.

The existing 30-Hz host task scheduling remains. Native stat-condition/HUD
effects, broader task ownership, cycling/fighting callers and full original-PC
matching remain separate work. The feedback calls are captured for inspection;
this checkpoint validates stat writes, exercise ordering and counter ownership.
