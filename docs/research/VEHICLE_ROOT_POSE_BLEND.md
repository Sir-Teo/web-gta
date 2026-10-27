# Vehicle rider root translation

Vehicle partial poses now treat the skinned root separately from ordinary
bones. Root translation is the weighted sum of the active non-extracting
vehicle tracks. It no longer receives the ordinary bone callback's second
translation-blend multiplication. This fixes an error introduced with the
track-aware partial pose blender.

For example, with a Ride base and a fully blended partial both carrying
root translation 0.3, the earlier path produced 0.6. The native skinned root
callback produces 0.3. Root correction preserves the existing ordinary-bone
translation and quaternion paths.

## Source and executable evidence

Pinned gta-reversed `4281f82d8af83e14935ac84a69dfd1ceebb9f256` initializes
skinned root BonePos to zero in RpAnimBlendClumpInitSkinned, marks the root
HasVelocity in RpAnimBlendClumpInit, and installs CPed's m_PedPosition pointer
in SetModelIndex. The vehicle association descriptors used here do not
extract movement. This gives a distinct root callback context, even while
these rider poses produce no extracted movement.

The harness enters the actual skinned frame callback at iOS `0x10013bb3c`
with HasVelocity, a valid PedPosition pointer, BonePos zero and non-extracting
associations. It executes the 2D root path at `0x10013ca34`, including actual
AnimBlendNode::Update and quaternion normalization. Static uncompressed keys
are declared inputs. No calls or arithmetic are stubbed.

The pinned executable is 14,226,544 bytes, SHA256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.

All 79 fixed cases cover root translation axes, negative/positive Z, partial
amounts, two overlapping partials, quaternion hemisphere signs and
rotation-only root tracks. Pose comparisons use angular tolerance 1e-6 and
translation tolerance 1e-5, because browser pose sampling uses number
arithmetic. The preexisting 67 ordinary-frame native cases remain applicable.

NativeCharacter passes its native HAnim root target to the vehicle partial
blender. The base and partials retain their existing sampled times and
association state; the correction changes root translation composition.
Other bones retain the captured ordinary-frame formula.

This does not establish bit-exact native IFP sampling, extracting root clips,
all 3D root callback contexts, or complete native vehicle positioning/IK.
Vehicle physics, association clocks, and the ordinary rider/controller
capture boundaries remain separate.

## Verification

The initial 155 focused checks pass: all 79 new root-frame cases, the existing
normal-frame pose cases, semantic partial coverage and animation bindings.
Evidence: `artifacts/root-partial-pose-focused.log`.

`scripts/research/emulate-root-partial-pose.py --binary <pinned-executable>
--output <temporary-json>` regenerates the fixed fixture. It requires Unicorn
and accepts `--profiles` containing sampled root-node inputs. Browser capture
records the sampled key inputs and final root matrix; the native executable
computes the reference blend independently.


All **101 captured live root poses** match the native root callback,
including loaded motorcycle/quad model poses and the actual CJ root from the
PCJ-600 passenger test. Inputs are the browser sampler's root keys; native
code computes the blend independently. Maximum coordinate error is
3.67e-9 units and maximum angular error is 1.40e-7 radians, within the
declared pose tolerances. This verifies blending, not native key sampling.
Evidence: `artifacts/root-partial-pose-live-native.json` and
`artifacts/root-partial-pose-live-verification.json`.

Four browser checks pass in 1.4 minutes: actual PCJ-600 keys/passenger/braking,
all eleven loaded motorcycle/quad riders with ownership/freeze/reverse,
bicycle crank/hop articulation, and actual touch bunny hop. Evidence:
`artifacts/root-partial-pose-browser.log`. A rotation-only limb regression
checks that selecting the root callback leaves ordinary joint positions
attached to their rest pose.


TypeScript and all **911 final focused checks** pass, including the ordinary
rider controller regression fixture. The full suite passes **13,248 tests /
51 skipped**, across 882 passing files (235.79 seconds). The root fixture
regenerates byte for byte. Evidence:
`artifacts/root-partial-pose-focused-final.log`,
`artifacts/root-partial-pose-types-final.log` and
`artifacts/root-partial-pose-full-unit-final.log`.


The final TypeScript/production build passes (6.93 seconds). The built-game
smoke passes saved-game resume, walking, car entry/driving, map waypoint,
pause, takeoff and gear checks with no page errors or failed requests.
Evidence: `artifacts/root-partial-pose-build-final.log` and
`artifacts/root-partial-pose-production-final.log`.
