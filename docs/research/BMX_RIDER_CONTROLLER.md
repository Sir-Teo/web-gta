# Full bicycle rider controller

BMX, Chopper and Mountain Bike now share the captured CBmx rider controller
for pedal/sprint and ordinary CBike fallback associations. Stationary, side
lean, fore/aft lean and reverse poses blend over a held Ride base. Resuming
pedalling can seed its phase from an existing Left/Right/Fwd pose. Native
fallback crank targets and easing replace the former generic crank return.
Rendering samples these associations and no longer adds the legacy side
lean overlay a second time.

This completes the fallback and phase-initialization work left open by
[Bicycle association blending](BICYCLE_ASSOCIATION_BLENDING.md), using the
[ordinary rider stage](BIKE_RIDER_ASSOCIATIONS.md) already captured for
motorcycles/quads. Physical lean remains an input from the existing host.

## Independent executable evidence

The pinned iOS executable is 14,226,544 bytes, SHA256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
`scripts/research/emulate-bmx-rider-controller.py` enters CBmx at
`0x100459b78` and stops at `0x10045a134` before hand placement or
`0x10045a214` before the hop pedal continuation. Nested ordinary CBike
executes normally except skeletal vibration: `0x100457f0c` redirects to
its `0x100457fa4` epilogue. The actual scalar clump update at
`0x10013ad30` follows with zero pose frames.

GetAssociation, BlendAnimation, AddAnimation, SetCurrentTime, association
and filter writes, crank arithmetic, UpdateBlend and UpdateTime execute.
Declared inputs/boundaries are:

- Model, actor/skill, handling, existing associations and prior crank/filter
  values; neutral pitch/contact/turn geometry. Wheelie/stoppie and collision
  task reactions are outside this capture.
- Scalar asset construction, decompression, allocation cleanup and pose-frame
  effects. Actual native descriptor flags and supplied loaded clip durations
  are used, without native resource-reference bookkeeping.
- Imported powf uses the host C library float function; its arguments and
  results are recorded. The iOS system-library implementation is not run.
- The PC hop task retains its existing time, blend and launch owner. Held
  Hop associations in this fixture check CBmx's short-circuit crank behavior,
  not the full hop task/callback schedule or hand IK.

All **868 fixed cases** compare exactly for association writes, filtered
lean, crank angle and the following clump frame. Cases cover three models,
coefficients around sprint eligibility, speed and lean changes, existing
pedal/sprint blends, existing lean/Still poses and held Hop presence.
The capture preserves native timestep globals explicitly.

The source dampens retained lean by 0.95 during active pedal fade-out and
conditionally during pedalling, using a 0.05 threshold. Fallback crank
lean overrides use a 0.1 blend threshold. A newly requested pedal/sprint
can use normalized seeds 0.5/0/0.75 from Left/Right/Fwd. On that initial
frame the source writes the normalized seed itself to the crank field;
the following frames return to angular phase. These details are fixture
outputs rather than inferred visual smoothing.

Regenerate with Unicorn installed, passing `--binary` and `--output`.
Optional `--profiles` accepts rows containing `nativeInput` and appends
independent native results after the 868 fixed cases. The browser cadence
spec records raw pre-step associations, filter state, prior crank, loaded
durations and timestep values for this replay.

## Validation

All **837 recorded game frames**, including 135 NPC frames, match native association state, filtered
lean and crank output exactly. Evidence:
`artifacts/bmx-rider-controller-live-verification.json` and
`artifacts/bmx-rider-live-native.json`.

The loaded-model browser check covers all three bicycles, stationary and
reverse fallback, strong lean, resumed pedalling, held base time, actual
character pose sampling, crank matrices, coast, freeze, repeated updates
and remount. The eleven-model motorcycle/quad regression also passes.
Real-key sprint/energy, all-model pedal articulation, phone hop, and actual
scripted boarding/ride/animation/exit checks pass (seven browser checks total).
The native key sampler, full task ownership, hands/feet IK and original-PC
whole-game parity remain separate work.

All 14,116 unit tests pass / 51 skipped (883 passing files, 175.29 seconds).
All 51 sampled live bicycle root poses match native blending within
1.35e-8 coordinate error and 1.69e-7 radians; this validates blending of
sampled keys, not native key sampling. Evidence:
`artifacts/bmx-rider-full-unit.log` and
`artifacts/bmx-rider-root-live-verification.json`.

The TypeScript/production build passes (Vite 7.11 seconds). The built-game
smoke passes saved-game resume, walking, vehicle entry/driving, map waypoint,
pause/resume, aircraft takeoff and landing gear, with no page errors or failed
requests. Evidence: `artifacts/bmx-rider-build.log` and
`artifacts/bmx-rider-production.log`.
