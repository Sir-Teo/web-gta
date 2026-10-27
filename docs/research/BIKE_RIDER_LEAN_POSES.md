# Native motorcycle and quad rider lean poses

The subsequent [ordinary rider controller](BIKE_RIDER_ASSOCIATIONS.md) adds
Still/Pushes availability, automatic fore/aft lean, passenger suppression and
held base time. Its owner replaces the initial lean-only class documented
here; the independent filter and pose fixtures remain applicable.

The eleven supported motorcycles and quads now filter rider lean and sample
the matching Left/Right clip at the captured native phase. Previously the
host chose a side from steering and blended the clip's final frame by lean
magnitude. Steering can cross zero while the body's filtered lean remains
on its old side; the new pose follows that residual lean.

This applies to player and scripted drivers when their IFP metadata is
loaded. A frozen vehicle holds its filtered lean and pose. Rendering and a
repeated afterStep without a new physics step do not advance the filter.
An empty rider frame releases the owner before a later driver starts.
Bicycle lean/fallback behavior is unchanged by this pass, preserving its
separately captured pedal/sprint association owner.

## Independent captures

The pinned iOS reference is 14,226,544 bytes, SHA256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.

**1,134 pose cases** execute CBike::ProcessRiderAnims from
`0x100457d58` to `0x100457f0c`, including actual SetCurrentTime. Existing
Left/Right/Back/Fwd associations, filtered lean, filtered forward lean,
available blend and clip durations are declared inputs. No executed call
or arithmetic is stubbed. Zero association nodes keep this a scalar pose
selection/time capture, without skeleton sampling or association creation.

**360 filter cases** execute `0x100457c8c` to `0x100457cf8`. Prepared handling
FullAnimLean, previous filtered lean, LeanAngle, native timestep and the
reverse-pedalling sentinel are declared inputs. The imported `powf` is an
explicit external boundary, evaluated by the host C library's float powf;
each call's arguments and result are recorded. This does not execute the
iOS system library's powf implementation. Selected native normalization and
filter arithmetic is executed, and rounded browser Math.pow matches the
recorded coefficient for every fixed and live case.

All three fixtures regenerate byte for byte. The 1,494 reference tests compare
all captured outputs exactly. The executable's threshold constants are
float32(0.56), float32(0.01), and filter retention float32(0.86).

## Rules and host integration

The filter divides LeanAngle by the prepared FullAnimLean, clamps the target
to [-1, 1], and retains `powf(float32(0.86), timeStep)` of the previous
filtered value. The native reverse sentinel substitutes target zero.
Arithmetic rounds at the selected float32 operations.

For ordinary sideways lean, the selected side usually receives all available
blend, while its clip time is `duration * abs(filteredLean)`. Player lean
and forward lean share normalized directional weights when both magnitudes
are at most 0.56 and their vector length exceeds 0.01. Sideways magnitude
above 0.56 takes precedence; otherwise forward magnitude above 0.56 selects
the forward/back axis. Non-player riders
skip the forward/back pose stage. Pose associations pause at their selected
time; an opposite side's amount is zeroed.

WorldBike advances the selected stage after physics, once per active step.
The quad supplies its existing rider LeanAngle; motorcycles supply their
existing body LeanAngle. Handling degrees are converted to prepared float32
radians. Current host ride/still selection supplies available blend as 1/0;
the host has no forward rider-lean input, so forward is zero. The player
reverse target is zero below 1.5 times prepared max reverse velocity, matching
the selected ordinary reverse-pedalling decision. Its float32 field reads
followed by a promoted double comparison are independently covered by
80 native boundary cases (`bike-rider-reverse-reference.json`).

The existing base ride/still pose and physical lean targets/rates remain
host controllers. Full native Still/Pushes/DriveBy blend prediction,
collision/task reactions, forward lean, CBmx fallback/phase handoffs and
complete native rider association lifecycle are not established here.
Native pose-key sampling still uses the browser's existing IFP sampler and
[track-aware partial pose sum](BICYCLE_ASSOCIATION_BLENDING.md), rather than a
bit-exact native skeleton sampler. Selected iOS slices do not establish
whole-game original-PC parity.

## Verification

Six browser checks pass in 14.7 seconds, covering the all-model loaded pose
stage plus existing BMX steering/hop/knock-off, quad lean, vehicle drowning,
boarding speed and airborne bike steering checks. The stronger all-model
reversal run also passes (6.5 seconds): actual smoothed steering has become
negative while filtered rider lean remains positive, so the Right pose is
retained. It also checks real clip times/weights, finite bound bone matrices,
freeze/repeated frames, rider release and a later scripted driver.

All **2,112 recorded live steps** independently replay with **2,112 exact
matches** for filtered lean and active pose identifier/amount/time/flags,
using the real loaded clip durations. The powf external boundary is the same
one declared above. Evidence:

- `artifacts/bike-rider-lean-browser-final.log`
- `artifacts/bike-rider-lean-browser-direction-final.log`
- `artifacts/bike-rider-lean-browser-reverse-final.log`
- `artifacts/bike-rider-lean-live.json`
- `artifacts/bike-rider-lean-live-native.json`
- `artifacts/bike-rider-lean-filter-live-native.json`
- `artifacts/bike-rider-lean-live-verification.json`

Regenerate with `scripts/research/emulate-bike-rider-lean.py` and
`scripts/research/emulate-bike-rider-lean-filter.py` and
`scripts/research/emulate-bike-rider-reverse.py`, supplying `--binary`
and `--output`. Unicorn is required; filter captures also require the host
C library float powf. `--profiles` accepts the recorded live input rows.


The final all-model run also seeds actual reverse velocity once per model
and confirms target-zero decay on the player path. Those eleven reverse
steps are included in the 2,112 exact live replays. It passes in 8.9 seconds.

The full unit suite passes **12,333 tests / 51 skipped** across 879 passing
files (164.17 seconds). The subsequent final reverse-boundary helper change
is covered by **1,820 passing focused tests**, including its 80 new native
cases, lean/filter, existing body lean, native partial poses and bicycle
controller regression checks. TypeScript passes. Evidence:
`artifacts/bike-rider-lean-full-unit-final.log` and
`artifacts/bike-rider-lean-final-focused.log`.


The final TypeScript/production build passes (6.26 seconds). The built-game
smoke passes saved-game resume, walking, car entry/driving, map waypoint,
pause/resume, takeoff and gear checks, with no page errors or failed requests.
Evidence: `artifacts/bike-rider-lean-build-final.log` and
`artifacts/bike-rider-lean-production-final.log`.
