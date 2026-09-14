# Regional timecycle content

The acquired static IPL files contain eight `tcyc` records. They are now parsed and retained in scene metadata, including original line numbers, filenames and independent district namespaces. Their rendering effects are not applied yet. The workshop explicitly labels them metadata only; collecting a district does not imply its boxes affect the selected area.

## Source and format

The source reference is [gta-reversed FileLoader.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/FileLoader.cpp), `LoadTimeCyclesModifier` (0x5B81D0), and [TimeCycle.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/TimeCycle.cpp), `AddOne`, `FindTimeCycleBox` and `CalcColoursForPoint`. The pinned files were inspected locally. These reverse-engineered functions are implementation references, not captured retail rendering comparisons.

The first nine fields are native XYZ minimum and maximum bounds, signed far clip, extra-color index, and strength percentage. Optional fields supply falloff (default 100) and LOD multiplier (default 1). Eleven-field rows use the last field for LOD; twelve-field rows have an additional unused value before the LOD multiplier. All eight acquired records use eleven fields. The reader preserves decimal source values and the optional unused value instead of prematurely applying native float or byte conversions. It rejects malformed field counts, non-finite values, inverted bounds, invalid integer fields, negative falloff/LOD values and excessive input counts. This is deliberately stricter than the source loader's unchecked malformed input behavior.

## Acquired coverage

| Static IPL | Records | Source purpose fields |
|---|---:|---|
| `leveldes/levelmap.ipl` | 2 | Extra colors 4 and 1, strength 100%, falloff 5 |
| `country/countn2.ipl` | 1 | Extra color 1, strength 100%, falloff 5 |
| `country/countryS.ipl` | 1 | Far clip 1000, strength 0%, falloff 100 |
| `country/countrye.ipl` | 4 | Far clip 800/1000, strength 0%, LOD multiplier 0.9 |

All coordinates and fields are recorded in `/Users/teo/Developer/web-gta-content/timecycle-boxes.json`; the refreshed `world-content.json` also contains per-district and per-scene records. These boxes cover specific locations, not the entire districts. In particular, the countryS box lies south of the current mountain presets.

## Runtime work still required

Native preparation divides strength by 100 and packs LOD as `uint8(min(multiplier, 4) * 32)`. Thus the source multiplier 0.9 is effectively 28/32 = 0.875, not 0.9. Distance blending uses distance to the box with the vertical component multiplied by three; a broad rejection check uses falloff/3 vertically. Overlapping-box selection and ordering matter, and two far-clip boxes can reduce far clip sequentially. Extra-color blending includes per-channel sentinel rules and cannot be replaced by interpolating every field indiscriminately.

The next integration must pass boxes through the imported-scene handoff, prepare native field representations, sample them at the correct world position, and apply the source-specific color/fog/LOD rules. It must also preserve behavior when no native timecycle table is loaded and invalidate cached lighting when position changes. The current lighting cache only keys on time, so applying positional effects without changing that boundary would be incorrect.

## Validation

Synthetic tests cover 9/10/11/12-field layouts, comma-separated rows, comments, line numbers, malformed fields and the modifier-count limit. A real-content test parses all 53 static IPLs and verifies eight boxes, three full-strength extra-color records and four 0.9 LOD records. A scene test verifies preservation across two district namespaces. Browser verification checks that the actual countryS bounds survive the worker into workshop metadata while terrain assembly and grounded walking continue to pass.

Final checks: 593 unit tests / 124 files pass; production build/smoke passes; the real-content browser case passes in 4.7 seconds. Logs: `/tmp/web-gta-tcyc-{focused,audit,unit,browser,production}.log`. Re-running the world content audit also regenerates `timecycle-boxes.json`.


## Native spatial evaluator

`src/world/nativeTimecycleBoxes.ts` now prepares and evaluates the source box rules independently of rendering. Preparation rounds source floats and packs LOD into its capped byte representation. Selection implements vertical distance weighting, the LOD/far-clip filters, ignored-box lookup, inside-box tie order and the falloff envelope. Color evaluation uses extra-color weather 21/22 and each field group's sentinel checks. Sky channels truncate through unsigned-short storage; scalar/color blends use float32 operations. Two far-clip boxes apply widest first and can only reduce distance. The returned LOD multiplier remains separate from color data.

The evaluator preserves the input color set and table. It operates in native XYZ coordinates. It must run **before** the final altitude far-clip correction in `nativeFarClip.ts`; the source performs that correction later in `CalcColoursForPoint`. Earlier camera-height ambient processing is a separate stage. This ordering is part of the integration contract.

Regression examples include: 15 units outside a box horizontally and 5 vertically both produce half strength with falloff 30; an authored LOD of 0.9 prepares as 28/32; and overlapping boxes with 0.5/0.6 strength, limits 800/600 and initial far clip 1000 produce approximately 720 when ordered by width. Applying the narrow box first would produce 760, so the ordering changes the result. Tests also cover interior ties, ignored boxes, zero falloff, unchanged values outside all boxes, extra-color table selection and sentinel groups.

This evaluator is not yet connected to the playable-scene handoff, lighting cache or scene LOD selection. Consequently this commit does not change gameplay appearance. Integration must use the prepared evaluator rather than duplicating its rules in the renderer, and validate camera/position changes and scene lifecycle with browser tests.

Evaluator validation: 597 unit tests / 125 files pass; all four spatial tests pass after strengthening the color assertions; TypeScript and production build pass. Logs: `/tmp/web-gta-spatial-tcyc-{unit,tests,build}.log`.
