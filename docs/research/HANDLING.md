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
