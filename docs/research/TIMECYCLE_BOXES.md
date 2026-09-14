# Regional timecycle content

The acquired static IPL files contain eight `tcyc` records. They are now parsed and retained in scene metadata, including original line numbers, filenames and independent district namespaces. Playable color and fog effects now apply when a local timecycle table is loaded. The workshop preview displays the records as metadata; collecting a district does not imply its boxes affect the selected area.

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


## Playable color and fog integration

The workshop now sends the parsed modifiers with its scene handoff. The receiver validates/prepares the whole set before installation; failed scene setup clears it. `LocalTimecycle` owns prepared scene modifiers separately from the user-loaded timecycle table. Clearing/reloading that table preserves the scene's modifiers but restores fallback lighting while no table is loaded. Invalid replacement modifiers preserve the previous valid set.

`WorldLighting` supplies the camera's world position to native sampling. Browser `(x,y,z)` converts to native `(x,-z,y)` before evaluation. Cached results key on time and the native float32 position whenever modifiers exist, so camera movement at a paused clock cannot reuse stale regional lighting. Imported terrain ambient now uses the same camera sample as the scene lights. The existing final altitude far-clip correction runs after regional fog-distance evaluation.

The source-backed sky, ambient/object ambient, water and fog channels now reach their existing render consumers. The diagnostic snapshot includes the installed modifier count and computed regional LOD multiplier. The calculated post-FX fields do not establish native post-processing parity; the renderer still has its existing post-FX limitations.

Low-LOD distance application remains outstanding. Source `CRenderer::ConstructRenderList` multiplies `ms_lowLodDistScale` by the regional result (Renderer.cpp line 954 at the pinned revision); it does not uniformly multiply every object's draw distance. The current scene visibility adapter lacks that distinct native low-LOD classification/scale path. The multiplier is therefore exposed without changing general object draw distances. This supersedes the earlier statement that the evaluator is wholly disconnected from gameplay.

Validation: 598 unit tests / 125 files passed, including atomic modifier replacement, axis conversion, same-time position invalidation, cache reuse and table reload behavior. Browser tests verify parented world-space camera sampling, source regional ambient, regional-before-altitude clipping and authored fallback after clearing the table. An imported countryside test verifies the actual countryS modifier arrives in the game. Both browser tests pass. Build/production smoke also passes. Logs: `/tmp/web-gta-tcyc-runtime-{all-unit,browser,production}.log`.


## Low-LOD range integration

Low-LOD scaling is now connected to playable imported visibility. The source classification in `CFileLoader::LoadScene` (`FileLoader.cpp`, pinned revision, around 0x5B5285) marks entities with LOD children or camera-adjusted draw distance above 300 as big buildings. Under this project's current camera LOD preference of one, the visibility adapter identifies such roots from the resolved placement graph and original draw distances. Only roots without a further LOD receive the low-LOD scale. Names beginning with “LOD” are not used as evidence.

`CRenderer::SetupMapEntityVisibility` and `CVisibilityPlugins::CalculateFadingAtomicAlpha` both clip the base range against camera far clip plus bound radius, calculate the fading width, and then multiply a big root's range. The adapter now preserves that ordering for selection, fading and child coverage. Unknown draw distances are not treated as evidence of a native big-building flag. This changes visibility only; complete original entity streaming/flags and collision behavior remain separate work.

The exterior camera-height multiplier is one through height 80, increases linearly to 2.2 at height 250, and remains capped above that. Interior scenes omit this height contribution. The regional multiplier multiplies that result. `WorldLighting` computes the factor from the same world-space camera position as regional lighting, then passes it into imported scene visibility. With no native table, the regional factor is one while the source camera-height rule still applies. Ordinary props and intermediate LOD objects with their own parent do not receive this scale. This supersedes the earlier pending-integration notes.

Validation: 602 unit tests / 126 files pass. Tests distinguish root/ordinary/nested objects, verify clipping-before-scaling, confirm pre-scale fade width, and exercise the 80/250 height thresholds and interior rule. The browser probe confirms a parented camera at height 350 produces 1.925 inside a 0.875 region and 2.2 outside; the actual eastern countryside still assembles and supports walking. Both browser tests pass. Production smoke/build passes. Logs: `/tmp/web-gta-low-lod-{all-unit,browser,production}.log`.
