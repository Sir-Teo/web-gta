# Bike and quad drive-by muzzle and aim rays

## Behavior

Loaded player motorcycle, bicycle and quad drive-by shots use the right-hand
bone 24 matrix, the standard-skill weapon fire offset/range, vehicle movement
lead and the selected forward/left/right bike axis. Three random draws add the
native pre-aim scatter. Nearby pedestrian origins then pass through the native
segment-distance scoring and target selection. The resulting line enters the
existing impact path without adding handheld crosshair spread a second time.
The right gun owns these shots even when the weapon supports dual wielding.

The quad right-side offset has the captured 1.8 scale and -0.1 vertical change.
Ordinary motorcycles and bicycles use native vehicle type 9 for this branch;
bicycle subtype 10 is separately supplied to automatic aiming. Local hand axes
are preserved when converting the world rows to native XYZ: the vehicle-body
matrix conversion cannot be reused for bone matrices.

## Independent reference

The reference executable is the pinned 14,226,544-byte iOS universal binary,
SHA-256 `9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
This establishes the selected native routines; independent original PC 1.0
behavior remains an acceptance requirement.

`scripts/research/emulate-bike-shot-seed.py` executes
`CWeapon::FireInstantHitFromCar` at `0x100497a48` through `0x100498044`, before
auto-aim setup. It runs the actual RenderWare point transform at `0x1000f7f34`
through the native dispatch initialized by the vector-module prefix
`0x1000f8780..0x1000f87fc`. Weapon fields, hand/vehicle matrices, velocity,
timestep, hierarchy lookup and three CRT draws are declared inputs. No selected
muzzle, direction or scatter arithmetic is replaced. The 432 fixed cases cover
rotated/tilted hand matrices, bike/quad directions, moving sources, timesteps
and scatter extremes. The float32 outputs match exactly.

`scripts/research/emulate-driveby-autoaim.py` executes
`CWeapon::DoDriveByAutoAiming` at `0x10049859c`, actual
`CCollision::DistToLine` at `0x10017fd10` and actual
`CVehicle::GetPlaneGunsAutoAimAngle` at `0x100483b34`. World-query result lists
and stack canary are declared; imported aircraft `tanf` uses host libm. The
668 fixed cases cover segment endpoints, negative residual-square rounding,
front/behind gates, dead/self/own-vehicle exclusions, caps/order/ties, absent
owner, matrix/simple positions and aircraft angle lookup. All selected outputs
and recorded score/threshold values match exactly. Aircraft cases validate the
shared helper; this change wires player bike/quad shots only.

Both scripts accept `--binary`, `--output` and optional `--profiles`; the latter
appends observed `nativeInput` objects after the fixed cases. Fixtures under
`tests/fixtures` are independent captured outputs, rather than helper snapshots.

## Host integration and boundaries

The host query retains enabled dead pedestrians until after its 16-candidate
cap and uses ped entity origins. It includes seated occupants and marks the
shooter's own vehicle for exclusion. Its active-pool membership, sector order
and occupant fallback are not a native CWorld sector implementation. No claim
of matching native candidate availability/order is made.

The three CRT values are supplied by the caller. Production currently derives
them from Math.random; shared native CRT state/lifetime is not implemented.
The loaded bone/vehicle state is declared input to the shot capture. Missing
native character pose or weapon data retains the existing host fallback.

Existing inventory cooldowns, animation fire readiness, damage, impact events,
tracers, audio and pad feedback remain host stages. In particular the native
FireFromCar/DoDriveByShootings shot timestamps are outside this change. This
work does not establish complete combat or original PC weapon equivalence.

## Validation

The real-key browser test fires on PCJ-600 (461), BMX (481) and quad (471),
checks forward/left/right poses and gun visibility, then releases back to riding.
A stationary bullet-proof pedestrian exercises automatic target selection.
All **50 live muzzle/seed rays match native float32 output exactly**. Replaying
the independent native seeds through native auto-aim reproduces all 50 final
ray endpoints exactly, including **12 accepted targets**. Maximum direction
angle error is 2.11e-8 radians from host normalization. Evidence:

- `artifacts/bike-ray-target-browser.log`
- `artifacts/bike-driveby-keys-live.json`
- `artifacts/bike-ray-seed-live-native.json`
- `artifacts/bike-ray-seed-live-verification.json`
- `artifacts/bike-ray-aim-live-native.json`
- `artifacts/bike-ray-live-verification.json`

Real Rapier integration checks confirm that the bike axes control impacts
while the camera points elsewhere, three draws are consumed per shot and dead
candidates count before the query cap. The 1,107 focused checks pass. TypeScript
passes. Full units: **15,978 passed / 51 skipped**, across 887 passing
files (214.20 seconds), in `artifacts/bike-ray-full-suite.log`. The final
TypeScript and production build pass (`artifacts/bike-ray-types-final.log` and
`artifacts/bike-ray-build.log`). The built-game smoke passes saved-game resume, walking, car entry/driving,
map waypoint, pause/resume, takeoff and landing gear with no page errors or
failed requests (`artifacts/bike-ray-production.log`).
