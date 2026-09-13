# Native animation data

## Source-backed interpretation

Implementation research uses gta-reversed revision `0076f9017b4aeef7433957ac2bd8b6988e9df166`:

- [AnimManager.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Animation/AnimManager.cpp): ANP2/ANP3 package, animation and sequence layout; keyframe types 1–4; compressed-animation flag and source bone/name bindings.
- [AnimSequenceFrames.h](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Animation/AnimSequenceFrames.h): 20/32-byte uncompressed and 10/16-byte compressed records; quaternion scale 4096, time scale 60 and translation scale **1024**.
- [AnimBlendHierarchy.h](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Animation/AnimBlendHierarchy.h): total duration uses the final source timestamp, then converts absolute timestamps into frame differences.

The [native quaternion layout](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Core/Quaternion.h) and [compressed quaternion definition](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/extensions/FixedQuat.hpp) confirm xyzw ordering.

The [ifp-reader README](https://github.com/tmfksoft/ifp-reader) was a useful discovery lead, but its proposed translation divisor of 4096 conflicts with the explicit native keyframe definitions. This implementation uses 1024. The package's claimed retail coverage was not reproduced here and is not our compatibility evidence.

## Implemented contract

`readIfp` accepts bounded ANP2 and ANP3 packages, including zero-filled IMG sector padding. It retains package/clip names, bone IDs (including -1 name binding), source xyzw quaternions, absolute timestamps in seconds, optional translations, flags and clip duration. Fixed-width strings stop at the first NUL; unused trailing bytes are ignored. No coordinate conversion, conjugation, skeleton mapping or root-motion policy is silently applied.

The reader checks package and animation sizes, count budgets, type/flag consistency, nonzero finite rotations, finite translations, monotonic nonnegative times and ambiguous bindings. Limits are 64 MiB of input, 2,048 clips, 512 tracks per clip, 65,536 total tracks and one million keys. Unsupported ANPK/other containers fail explicitly. These are implementation limits, not original game limits.

`sampleTrack` samples source-space transforms into a reusable output: normalized shortest-arc quaternion interpolation and linear translation, with clamped track endpoints and well-defined duplicate timestamps. `animationTime` provides explicit clip loop/clamp policy. This is an interpolation foundation, not a reproduction of original animation blending, bone flags, action events or locomotion synchronization.

`readAnimation` supports a standalone file or a selected bounded IMG entry. The model worker's animation action transfers decoded typed arrays back to its caller, keeping decoding off the game thread. The model preview now includes a local IFP picker and single-model clip playback controls.

## Evidence and next work

`generate-animation-reference.py` writes original diagnostic ANP2/ANP3 fixtures using Python's independent struct packing. Both encode a two-second root turn/translation and a rotation-only named child track. The last quaternion deliberately changes sign. These fixtures are authored test data, not an external exporter or retail asset validation.

Tests verify translation scaling, absolute time, fixed-width names, bone bindings, both encodings, shortest-arc interpolation, endpoints, looping, duplicate timestamps, all truncated prefixes, archive padding, malformed counts/types/flags/keys and standalone/archive equivalence. A browser worker test verifies decoded values, unsupported-format errors and local-only requests.

DFF skin/HAnim parsing and bind-pose rendering are now covered by the [skin pipeline](SKIN_FORMATS.md). Next: explicit animation-track matching, source-to-engine pose conversion, then synchronized clip playback on the diagnostic rig. Original character motion, deformation and timing require representative source files and reference captures before a fidelity claim. The game still uses its authored articulated character animation.


## Track-to-rig binding

`bindAnimation` now binds a clip to one constructed model instance using native frame indices plus HAnim IDs, or normalized names only when the track explicitly uses name binding. Missing IDs never silently fall back to a name. Duplicate targets, ambiguous instances and unsupported sheared/singular rest transforms fail before changing the pose.

The pinned [native quaternion-to-matrix implementation](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Core/Quaternion.cpp) matches Three's rotation convention in source coordinates. Sampling replaces local rotation, applies source local translation when provided, retains rest translation for rotation-only tracks, and preserves rest scale. The existing outer root performs the coordinate conversion once. This is direct clip pose evaluation; original root-motion extraction, task scheduling and blend associations are separate pending work.

The binding supports explicit loop/clamp sampling and exact rest-matrix restoration. Animated skin bounds are invalidated and frustum culling is temporarily disabled for these instances; callers can request exact bounds for framing. This avoids CPU deformation of every vertex during each sample. Restoring the bind pose restores prior culling behavior.

Four additional unit cases verify native clip deformation on the independently exported rig, ID/name selection, failure atomicity, loop and frame-rate independence, rest-pose restoration, bounds policy, multi-instance ambiguity and unsupported rest transforms. The diagnostic animation IDs/names are explicitly mapped to the diagnostic model in tests; they are not an original character clip. The model preview now uses this API for clip selection, scrubbing, playback and bind-pose restoration.


## Preview playback controls

Load one unplaced model, then choose a local IFP package and clip. The animation controls show source seconds and provide play/pause, exact-time scrubbing and bind-pose restoration. Playback loops the clip and pauses when the page is hidden. Clearing or replacing the model cancels pending animation reads and the animation frame callback, preventing a stale clip from affecting the next model. Missing or incompatible tracks produce a binding error; there is no silent retargeting.

The matching `animation-rig.ifp` fixture explicitly assigns the authored root track to bone 10 and names its child Tip, matching the separately exported diagnostic skin. Browser checks use the real file picker, range keyboard input and buttons, compare changed pixels and exact restoration, check pause timing, recover from unsupported data and replace a model during playback. Static production smoke also binds, scrubs and restores the diagnostic clip. This is direct clip inspection, not original gameplay root-motion extraction or animation blending.
