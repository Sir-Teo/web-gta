# Quad rider lean arithmetic and ownership

The quad rider now uses the selected native float32 lean update and the
actual steering angle shared with vehicle motion. The former helper used
only normalized steering and number-precision smoothing. Native player
ownership also leaves this vehicle's LeanAngle unchanged for NPC and empty
quads; the host previously continued smoothing it in those states.

This is the vehicle's rider lean input, before the separately captured
[ordinary rider association/filter stage](BIKE_RIDER_ASSOCIATIONS.md).
The quad body remains level under the existing host physics controller.

## Executable evidence

The pinned iOS executable is 14,226,544 bytes, SHA256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
`scripts/research/emulate-quad-rider-lean.py` executes `0x10046eda4` through
`0x10046ee04` within CQuadBike::ProcessAI. Prior LeanAngle, native steering
angle, raw steering lock in degrees, prepared FullAnimLean in radians,
DesLean, native timestep and the preceding s8=1 are declared inputs.
Only the imported powf uses an external host C-library float implementation.
All selected ARM64 loads, angle conversion, divisions and lean arithmetic
execute. The negative pi/180 steering-lock conversion is captured directly.

All **396 fixed cases** compare exactly. They vary prior lean, steering,
handling retention, timestep, steering lock and FullAnimLean. Regenerate
with Unicorn and `--binary` / `--output`; `--profiles` appends raw browser
`nativeInput` rows after the fixed cases.

`scripts/research/emulate-quad-rider-gate.py` separately executes the entry
at `0x10046e914` until its player-control continuation at `0x10046ea1c`
or return. All 96 observed combinations of status, driver presence,
actor type, task presence and ped state confirm the source gate. Actor/task
lookups, unused model lookup, reference cleanup and automobile AI delegation
are external boundaries; the actual gate branches execute. Recording ID
is declared -1. Evidence: `artifacts/quad-rider-gate-reference.json`.

The host applies the update for an occupied player quad. Native arrested
and slow-exit task scheduling is not newly implemented by this change.
Existing host input/exit ownership remains responsible for those states.
Physical steering response, SpeedSteer scaling, contact/air turn forces,
forward rider input and complete native task scheduling remain separate.

## Live validation

All **214 recorded player updates** match the native lean leaf exactly.
The following rider association/filter/clump stage also matches for all
**2,704 recorded frames**, including 274 quad frames. Evidence:
`artifacts/quad-rider-lean-live-verification.json` and
`artifacts/quad-rider-associations-live-verification.json`.
The lean replay starts from recorded vehicle state and declared host steering
angle mapping; it does not establish native control-input/physics parity.

Four browser checks pass: loaded poses across eleven motorcycles/quads,
three-bicycle regression, CJ as quad passenger and CJ as motorcycle passenger with NPC drivers.
They check no player control takeover, retained lean under empty/NPC control,
freeze/repeated rendering, reversal, remount and loaded clip availability.
Evidence: `artifacts/quad-rider-lean-browser.log`.

All **14,512 unit tests pass / 51 skipped**, across 884 passing files
(186.38 seconds). TypeScript also passes. The focused controller/control/lean
checks pass 406 tests. Evidence: `artifacts/quad-rider-lean-full-unit.log`,
`artifacts/quad-rider-lean-types.log` and
`artifacts/quad-rider-lean-integrated-focus.log`.

The final TypeScript/production build and built-game smoke pass. The smoke
covers saved-game resume, walking, car entry/driving, map waypoint, pause,
aircraft takeoff and landing gear, with no page errors or failed requests.
Evidence: `artifacts/quad-rider-lean-build.log` and
`artifacts/quad-rider-lean-production.log`.
