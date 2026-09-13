# Native timecycle data

## Source contract

The pinned gta-reversed [TimeCycle.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/TimeCycle.cpp) reads weather-major rows with eight samples each. [TimeCycle.h](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/TimeCycle.h) names the eight samples; [eWeatherType.h](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Enums/eWeatherType.h) defines 23 slots, including underwater and two extra-color slots. A complete table therefore has 184 data rows. The sample hours are 0, 5, 6, 7, 12, 19, 20 and 22; 24 closes interpolation back to sample zero. The inspected calculation caps hours at 23.999 before selecting an interval.

The loader's scanning format contains 52 fields. Its warning condition is `n < 51`, so a missing final directional multiplier needs separate treatment. The code also documents a malformed retail row with shifted leading ambient fields. Do not silently repair a row or manufacture its missing final value and then label the result original data.

Field order is encoded in `TIMECYCLE_FIELDS`: static/object ambient RGB; unused directional RGB; sky top/bottom RGB; sun core/corona RGB; sizes and brightness; shadow strengths; far clip, fog start and ground light; cloud RGB; water RGBA; two post-effect colors stored alpha-first; cloud alpha; highlight minimum; water fog alpha; directional multiplier. The [file loader](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/FileLoader.cpp) replaces commas and control characters with spaces before scanning.

## Implemented reader

`src/assets/timecycle.ts` reads the raw numeric table and retains physical line numbers, weather index and sample hour. It accepts 51- and 52-field layouts, reporting the absent multiplier for 51-field rows. Other numeric field counts remain inspectable with an explicit unsafe-to-apply issue. Integer-column token mismatches are reported because native scanning would stop at such a token. Malformed numeric syntax, nonfinite numbers, incomplete/oversized tables and text above 1 MiB are rejected. No missing fields are filled from another row. Comments beginning with a slash, blank lines, a leading BOM, CRLF, commas and control whitespace are handled.

`timecycleInterval` supplies current/next sample indices and a blend fraction, including fractional minutes, overnight wrapping and the native upper-hour clamp. It does not interpolate or quantize color fields yet.

The reader deliberately preserves numeric precision. The source loader converts many values to bytes or int16, scales some sizes by ten, doubles post-effect alpha, and contains a suspicious nested byte conversion for the directional multiplier. [ColourSet.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Collision/ColourSet.cpp) then constructs/interpolates runtime color sets. These conversions and their rounding order must be checked before raw rows drive rendering; the current raw schema is not a display-ready color set.

## Verification and remaining integration

Original synthetic tables verify weather-major indexing, all 52 field positions, decimal precision, missing/shifted fields, integer scanning diagnostics, invalid input and nonuniform interpolation intervals. No retail timecycle file was bundled or used to claim compatibility. All 223 unit tests and the build pass.

This module is not yet connected to a local file picker or the playable renderer. The existing authored sky and ambient values remain in use. Next work must implement validated storage conversion and color-set interpolation, old/new weather blending, local import ownership and diagnostics, and routing to static/object ambient, sky, fog and post effects. Weather regions, altitude changes, timecycle boxes, tunnels, extra colors and original platform display conversion remain separate fidelity requirements. Retail malformed-row behavior and matched original-game captures remain unverified.
