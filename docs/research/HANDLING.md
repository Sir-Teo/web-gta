# Vehicle handling data

## Source and scope

Pinned reference: gta-reversed commit `0076f9017b4aeef7433957ac2bd8b6988e9df166`, [cHandlingDataMgr.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/cHandlingDataMgr.cpp). This is source-informed PC behavior, not a retail-file compatibility result or a PS2 handling measurement.

`readHandling` reads the base vehicle records from HANDLING.CFG into raw named values. It preserves ordered duplicate definitions, original numeric precision, source line numbers and exact handling names. It does not convert values to Rapier settings. Existing playable cars still use authored handling.

## Base record layout

Each base row contains a name followed by 35 values. The source `tHandlingData::InitFromData` expects 35 successful conversions after skipping the name.

| Positions after name | Fields |
|---|---|
| 1–6 | Mass, turn mass, drag multiplier, center of mass X/Y/Z |
| 7–10 | Percent submerged, traction multiplier, traction loss, traction bias |
| 11–16 | Gear count, maximum velocity, engine acceleration, engine inertia, drive type, engine type |
| 17–20 | Brake deceleration, brake bias, ABS byte, steering lock |
| 21–27 | Suspension force, damping, high-speed compression damping, upper/lower limits, front/rear bias, anti-dive |
| 28–30 | Seat offset, collision damage multiplier, monetary value |
| 31–35 | Hexadecimal model flags, hexadecimal handling flags, front/rear light bytes, animation-group byte |

Numbers remain in file units. Hex flags preserve the complete unsigned 32-bit range. Byte fields retain raw integer values and report values outside 0–255; no wrap is applied here. Invalid numeric syntax, nonfinite/float-overflow values, malformed field counts and oversized flag words reject with source-line context. Nonpositive mass, zero submerged percentage and unknown drive/engine characters remain inspectable with explicit issues rather than being silently replaced.

The browser reader accepts BOM, whitespace/control separators and commas, skips semicolon comments, and stops at the exact trimmed `;the end` marker. It caps input text at 4 MiB and total retained records at 50,000. These are browser resource limits, not native table capacities. It intentionally rejects partially scanned numeric tokens and extra base fields rather than emulating permissive scanf behavior.

Specialized prefixes are retained separately: `!` bike, `$` flying, `%` boat and `^` vehicle animation groups. Their raw token rows carry a noninterpretation warning; even malformed numeric tokens there are not claimed to have been validated. The aircraft source contains an explicit extra-character scan for an RCRAIDER field, reinforcing the need for a distinct schema. Specialized physics is not supported by this reader.

The convenience index is exact and case-sensitive with last-definition replacement. It does not emulate the native fixed 210-name table or `FindExactWord`'s prefix comparison. Model IDE handling-name associations and release-specific handling IDs remain integration work.

## Required preparation and physics integration

The source first multiplies engine acceleration by 0.4, then its game-unit conversion applies acceleration scale `1 / 50²` and velocity scale `0.277778 / 50`. It derives reciprocal mass, buoyancy and mass-scaled collision damage. A decrementing drag/acceleration search reduces maximum velocity in 0.01 increments before model/flag-dependent forward and reverse limits. Four-wheel versus two-wheel drive changes the engine-acceleration divisor, and transmission gear ratios are initialized afterward.

Those dependencies rule out treating maximum velocity as a direct Rapier speed cap or engine acceleration as a wheel force. Next work must preserve the raw record, implement a separately inspectable preparation result with explicit float and invalid-input policy, resolve model IDs/flags and gear behavior, and define how the vehicle controller consumes the result. Keep the existing authored settings as an explicit development preset until that mapping is verified. Do not install a half-converted record into a running vehicle.

Acceptance requires two contrasting vehicles, acceleration/braking/cornering traces, drive-wheel behavior, reverse limits, mass/center-of-mass effects, suspension contact and save/reload consistency. Retail measurements remain missing, so no handling-fidelity percentage is justified.

## Verification

276 unit tests across 55 files and the build passed. Five new tests check an independently specified synthetic record's complete field mapping, high-bit flags, special-row preservation, exact duplicate lookup, raw unsupported values, malformed tokens/counts and input limits. No retail HANDLING.CFG is bundled. Browser and production suites were not repeated because no runtime input or physics path consumes the reader yet.

## Prepared native handling

`prepareHandling(record, handlingId)` now produces a separate prepared result without modifying the raw record. The ID is explicitly the native 0–209 handling-table index, not a vehicle model ID. The [manager header](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/cHandlingDataMgr.h) identifies RC Bandit as 38 and the bike interval as 162–174. The [handling structure](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/tHandlingData.h) places the maximum-speed-limit flag at bit 24 of handling flags.

Preparation narrows the six byte fields explicitly and rounds floating fields/intermediate operations to float32. It applies the initial acceleration multiplier, game-unit acceleration/velocity/braking scales, reciprocal mass, buoyancy and damage conversion. The drag search preserves the mandatory first 0.01 decrement and both source resistance formulas. It exposes iteration count for inspection. RC reverse behavior takes precedence over the maximum-speed flag, which takes precedence over the bike reverse branch; ordinary reverse speed retains the source minimum magnitude.

[InitGearRatios](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/cTransmission.cpp) supplies the forward maxima and shift thresholds. The prepared array has six cleared slots, with reverse in slot zero and forward gears beginning at one. The [transmission header](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/cTransmission.h) declares six total slots even though its gear-count comment says 1–6. The browser rejects forward counts outside 1–5 to avoid reproducing an out-of-bounds write. Unused slots remain zeroed.

Input domains are explicit: mass and narrowed submerged percentage must be positive; speed, acceleration, braking and drag cannot be negative; drive/engine enums and integer ranges must be supported. Nonfinite results reject. A float subtraction that cannot advance or a drag search exceeding 100,000 iterations rejects instead of blocking the browser indefinitely. These are deliberate validation policies, not claims about native malformed-file behavior. Unchanged suspension/traction/center-of-mass fields retain their native axes and units in the prepared record; they are not yet Rapier parameters.

Float32-at-each-operation is an explicit browser arithmetic policy. The original executable's compiler, x87 register precision, constant folding and edge-case results have not been compared, so this is source-level reproduction rather than binary arithmetic parity. Gear selection, drive acceleration over time, tire contact, suspension forces, handling-name resolution and local file/UI-to-vehicle integration remain unfinished.

Verification: 282 unit tests across 56 files and build passed. Six preparation tests cover independently calculated zero-drag quantities, 2WD/4WD divisors, special-ID/flag precedence, both drag-threshold crossings, reverse and forward gear slots, raw-record preservation, byte narrowing, invalid IDs/gear counts and bounded pathological searches. No runtime vehicle path consumes prepared handling yet; browser and production checks were not repeated.

## Transmission drive increment

`stepNativeTransmission` now evaluates the pinned `CalculateDriveAcceleration` flow against a prepared handling record. Inputs explicitly use signed native forward velocity and native 20 ms timestep units. Output is a drive increment, not a Rapier wheel force. The function returns replacement gear/inertia state without mutating the caller's state, so failed evaluation cannot partially commit a gear change.

The implementation preserves throttle-dependent forward/reverse selection, strict versus inclusive shift thresholds, potentially multiple gear changes in one call, the 1G/2G boost flag priority, the single-gear exception, reverse multiplication, perfect-handling/nitros multipliers, global forward/reverse bounds and the separate gear-maximum taper. Any shift disables inertia pointers and cheat modifiers for the rest of that call, as in the source. The native `gearChangeCount` argument is unused in this implementation; no arbitrary shift delay was added.

Optional inertia state retains the source's two float accumulators as ratio and smoothing. Grounded updates use the current gear's velocity span, clamp the response to 0.1–1 and smooth with the source's 0.85 fraction. Airborne updates increase the stored ratio and set smoothing to 0.1, but do not multiply the current call's drive increment by that new smoothing value. The controller uses the caller's wheel-contact boolean; it does not infer contact from vehicle speed.

Browser input policy limits throttle to -1–1 and timestep to 0–3, rejects invalid gears/nonfinite arithmetic and rejects zero inertia when its airborne division is needed. A bounded shift loop fails if malformed prepared data does not converge. Like the preparation stage, arithmetic rounds intermediate operations to float32 without claiming original executable precision parity. Zero timestep is not a substitute for skipping a paused controller call: gear and inertia state may still change even when the resulting drive increment is zero.

Verification: 288 unit tests across 57 files and build passed. Six controller tests cover analytic drive increments and modifiers, reverse/forward boundary behavior, multi-gear shifts, inertia bypass after shifts, grounded smoothing, airborne memory, global cutoffs, an isolated diagnostic gear taper, raw state preservation and invalid inputs. Browser/production checks were not repeated because this controller is not connected to the playable cars yet. The next integration must trace the original wheel-force consumer and contact selection, establish native-to-Rapier units, and resolve handling identity before applying local data to a vehicle.
