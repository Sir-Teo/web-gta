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


## Root-motion extraction and in-place preview

The root-motion API requires an explicitly selected translated track. It evaluates unwrapped displacement across clip loops, including reverse time and multiple cycles. Nonlooping sampling clamps at the clip ends. Values remain in that track's parent coordinate space: consumers must apply the appropriate parent, native-to-engine and actor-heading transforms before requesting physical movement.

Default extraction selects native x/y, retaining z motion in the rendered pose. The binder can hold selected axes at the first sampled clip position, or explicitly at the rig's rest position. Source buffers remain unchanged. This is a configurable integration policy, not a recovered original-game root-motion algorithm. The simulation can now consume extracted horizontal displacement through the integration contract below. Root rotation and synchronization of clip speed with blocked movement remain unfinished.

The model preview's **Animation movement** selector offers source motion and an in-place option for each nonempty translated track. Selection is explicit because a package may animate several translated bones. Changing movement policy rebinds the selected clip from its beginning; clip changes reset the policy to source motion. Bind-pose restoration and model replacement continue to clear playback state.

Six unit cases verify loop crossings, reverse and multi-cycle movement, clamped endpoints, vertical extraction, in-place horizontal removal, nonzero initial offsets, rest anchoring, step-size composition and invalid policies. A browser test compares source and in-place posed bounds, verifies the expected horizontal displacement and unchanged vertical position, restores source motion, then clears the model.


## Collision-constrained locomotion contract

`locomotionMotion` converts an extracted track delta with an explicitly supplied track-parent-to-world matrix. This includes parent scale, source coordinate conversion and actor heading while excluding translation. Nonfinite or vertical world displacement is rejected; simulation gravity remains authoritative.

The optional `Controls.animationMotion` supplies a displacement for one simulation step, in world meters. It replaces ordinary horizontal walking displacement for that step, passes through the same capsule controller, and is suppressed while incapacitated. Existing impact impulses and gravity still apply. `animationMovement` reports the gated request and actual horizontal capsule movement; actual movement includes any impact impulse and collision correction. Feedback clears on ordinary steps and reset. Vehicle and transition branches do not consume this input. The caller must supply the delta for the same simulation time interval; it is not a velocity.

Five tests exercise a three-second loop crossing, requested versus applied displacement, wall blocking with tangential sliding, incapacitation, default-walking fallback, zero-motion suppression of keyboard movement, coordinate transforms and invalid input. The initial combined gravity/lateral query shortened the diagnostic flat-ground path by roughly 6 percent. The collision resolution described below now bounds error to two centimeters over that six-meter path on three floor types. Tests continue to check extracted totals and feedback accounting separately from the collision-constrained path; obstacles must still shorten travel.

The workshop character test now connects this contract to a native rig and simulation-driven clip clock, as described below. Heading, stamina, action selection and authored pose phase still use existing gameplay rules. Native character replacement, blending, foot sliding correction and original reference comparisons are subsequent work.


## Separating grounded travel from downward gravity

A diagnostic sweep over contact offsets and normal nudges reproduced inconsistent horizontal losses with the combined downward/lateral query in Rapier 0.20.0. Disabling autostep did not change the baseline result. Removing downward movement preserved travel but would compromise descent, so the runtime now resolves lateral movement first and downward gravity second from the resulting capsule position. Ascending jumps and purely vertical movement retain one query. The contact offset, normal nudge, slope limits and autostep settings remain unchanged.

The intermediate collider pose is temporary and restored in `finally` before rigid-body integration. The returned movement adds both collision-constrained results, and grounding comes from the final query. This applies to both authored walking and optional clip displacement. It adds a second controller query when lateral movement and downward gravity occur together; representative streamed-city performance remains unmeasured.

Eight focused tests cover mesh, box and heightfield floor travel within two centimeters over six meters, step traversal and descent, a walkable ramp in both directions, jumping into a ceiling, unchanged body/collider transforms after a query, and restoration after a query failure. Existing wall-blocking and imported-floor tests remain in force. This is an authored collision policy, not evidence of San Andreas's original movement algorithm; arbitrary compound contacts, extreme world coordinates and original-animation foot placement still require validation.

The [upstream Rapier controller source](https://github.com/dimforge/rapier/blob/master/src/control/character_controller.rs) documents the stability purpose of the contact gap and normal nudge. That living source is background reference, not a version-pinned explanation of the observed loss. The reproduction and acceptance checks above use the project's installed 0.20.0 WASM package.


## Playable local character test

The workshop's **Test character in game** button transfers the current unplaced model, textures, selected clip and explicit extraction track to a temporary same-origin game window through an in-memory channel. The receiving renderer validates and owns an independent model/skeleton instance. Replacing or disposing it releases its geometry, materials and skeleton resources. No native character assets are uploaded or stored in save files.

The active clip advances once per fixed simulation step in a supported foot state; assigned idle also advances while stationary. Extracted displacement uses the selected track's rest-parent transform, source Z-up conversion and input heading. Rendering samples the interpolated clip interval and actor position without advancing time, so pause freezes both. Source scale and orientation are retained; no automatic rescaling or retargeting is performed. Animated extraction ancestors and vertical world displacement are rejected before installation.

The runtime supports explicit idle/walk/run roles, but does not implement the original character action controller. Without an idle assignment it holds the first walk pose. Crouching, airborne motion, vehicle transitions, seated states, impacts and death use the existing authored character. Root yaw extraction, original association tables, blending, collision-aware clip timing, character customization and original material lighting remain unfinished. A clip with lateral source travel preserves that travel; the importer does not reinterpret every animation as a straight walk.

Five unit tests cover simulation-owned time, render-only sampling, loop crossings, input orientation, unsupported-state fallback, interpolated actor placement, resource disposal and invalid ancestor extraction. The real-browser flow opens the test from the workshop, moves through keyboard input, pauses and resumes, and toggles crouch to verify fallback. The diagnostic rig is an original single-sided strip, so a front camera view was captured and inspected. This establishes native rig rendering and movement plumbing, not retail protagonist appearance or motion fidelity. Static production smoke exercises the same local popup path without development hooks.


## Explicit idle, walk and run assignments

The workshop stores up to three explicitly assigned clips for the current model. Moving roles require a selected horizontal extraction track. An idle assignment may omit extraction for a rotation-only clip, or retain its selected in-place policy. Assignments can survive selecting another IFP package for the same model; model replacement and **Clear assignments** remove them. Without an explicit walk assignment, the currently selected extracted clip remains the walk source for compatibility with the initial workflow.

The character validates every assigned binding before installation. Stationary input selects idle; movement selects walk; Shift selects assigned run while the existing stamina/exhaustion latch permits it. Missing run falls back to walk without consuming sprint stamina. Missing idle holds the walk's first pose. Idle adds no new clip displacement; the movement transition below decelerates any residual motion. Each moving role uses its own source displacement and duration rather than a hard-coded speed multiplier.

Walk/run changes preserve normalized cycle phase, including accumulated loop count. Entering or leaving idle starts the destination clip at zero. A role change restores the previous binding's rest transforms, preventing bones absent from the next clip from retaining old poses. Rendering still interpolates simulation-owned clip time. These are authored transition rules. The pose transition below smooths role changes, but phase matching does not prove that foot-contact events align across arbitrary source clips.

The original `animation-roles.ifp` diagnostic supplies a stationary two-second idle, a two-second 2 m/s walk and a one-second 4 m/s run on the existing skin. Three added unit cases verify source-derived speeds, phase preservation, exhaustion/recovery gates, missing-run stamina behavior and restoration of unanimated bones. The browser assigns all roles through actual controls, verifies native action and speed changes through W/Shift, pauses idle playback, then clears the model. Production smoke opens the same explicit role set. Original animation names are not guessed or hard-coded.


## Interrupted pose transitions

Native role changes now blend from the current composite local pose into the advancing destination clip over an authored 180 ms interval. Position and scale interpolate linearly; rotations use quaternion interpolation. This is a captured-pose transition, not a two-clock outgoing/incoming crossfade: the captured outgoing pose stays fixed while the destination advances. Destination displacement now feeds the movement transition described below.

The transition clock advances only on simulation ticks. Before a new role interrupts a blend, the runtime reconstructs the previous composite pose at the current simulation time and captures it. It does not capture whichever interpolated pose happened to be drawn last. Each render restores the union of animated frames to exact rest transforms, samples the destination and then applies the blend, preventing accumulation on frames absent from a clip. Exact captured matrices are retained at weight zero. Unsupported native states clear transition timing when returning to the authored character.

Two pose-level tests verify translation/rotation/scale interpolation, exact endpoints, interrupted capture and rest reset. A native-character test verifies continuity at two role changes and identical results after different render sampling orders; the prior missing-bone case now checks restoration after transition completion. Browser pause assertions include transition progress as well as clip time. Original blend durations and association weights, two-clock crossfades and foot locking remain unverified or unfinished.


## Movement transitions

Native role changes now use the same authored 180 ms interval to blend captured horizontal velocity toward the destination clip's per-tick displacement. The blend integrates its linear weight over the entire tick, including ticks that cross the end of the interval. Constant target velocities therefore produce the same displacement under different tick subdivisions. Once the transition completes, source displacement passes through exactly.

Starting from idle accelerates from zero. Stopping selects zero destination displacement and decelerates the previous motion over the interval. An interrupted role change captures the current blended velocity; unsupported native states clear residual motion. The result continues through the capsule controller and cannot bypass walls. The captured velocity is requested animation velocity, not collision-applied velocity; the clip clock still advances when obstructed.

Three focused tests verify integrated acceleration, tick subdivision, stopping, interruption, reset and invalid input. An additional native-character/physics test drives an accelerating runner into a wall and stops there without passing through it. Existing role tests now account for the authored acceleration distance while preserving clip-phase checks.

This is a velocity blend aligned in duration with the captured-pose transition, not the original association algorithm. A changing target is represented by its average displacement within each simulation tick, so exact subdivision equivalence is only established for constant target velocity. Source foot-contact alignment, collision feedback into animation, original stopping clips and original transition timing remain unfinished.
