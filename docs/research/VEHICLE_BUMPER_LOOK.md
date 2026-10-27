# First-person vehicle side and rear looks

## Behavior

Q/E and look-behind now update the bumper camera's source, direction, up vector
and near clip. The previous bumper branch discarded the glance orientation and
kept looking forward. The normal source is sampled first, including the current
bike neck/lead/visibility calculation, then the native look stage is applied.

Cars/quads, motorcycles/bicycles and boats retain their separate offsets. Boat
side looks use the available driver's neck; without a driver they use the
captured fallback. Side views use the vehicle up vector. Rear view rebuilds
world up through `GetVectorsReadyForRW`, including its vertical-direction guard.
The native look near clip is float32 0.05. Script near-clip overrides keep their
existing priority; release restores the host's normal bumper view and 0.08 near
policy. Forward-view vehicle/body culling remains scoped to forward view.

## Independent native reference

The pinned native executable is the existing 14,226,544-byte iOS binary, SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
The actual first-person routines and helpers execute in
`scripts/research/emulate-vehicle-bumper-look.py`:

- `LookRight`: `0x10021f500`, called with false for left and true for right.
- `LookBehind`: `0x10021ed60`.
- `GetVectorsReadyForRW`: `0x10021fbfc`.
- Actual vector normalize/cross: `0x1002cb4c4` / `0x1002cb230`.

Vehicle appearance, boat pose/bone services, selected matrix, initial camera
vectors, driver presence and the near-raster setter are declared boundaries.
No selected source, direction or up arithmetic is replaced. Whole first-person
look routines return; this is not a standalone reimplementation used as oracle.

The 432 fixed captures cover car/boat/bike classes, all three looks, driver
presence, varied headings/pitch/roll, scaled and exactly vertical bases, large
world positions and different initial camera up vectors. All source, front, up
and near outputs match the production float32 helper exactly. Rear bike looks
retain the extra native basis rebuild; normalizing once instead would not be
the same scalar sequence.

Regenerate with `--binary <pinned binary> --output <json>`; `--profiles` appends
recorded `nativeInput` objects. Checked-in tests read the fixture without needing
Unicorn. Disassembly evidence:
`artifacts/camera-process-disassembly.txt`,
`artifacts/camera-look-side-disassembly.txt` and
`artifacts/camera-look-behind-disassembly.txt`.

The PC `LookRight` and `LookBehind` in the available reversed source are stubs.
**Retail-PC look behavior is not established by this iOS capture.** Full camera
task/physics/render scheduling, wheelie camera, unsupported aircraft modes,
normal near-clip policy and complete side/rear renderer ordering remain open.
The host uses its physical matrix and current rendered neck as declared inputs;
full original interpolation/bone ownership is not claimed. Three.js constructs
the displayed quaternion from the captured float32 axes, so rendered-axis
agreement is measured separately from the exact scalar helper.

## Validation

The unchanged game reproduces the issue with 54 real-key observations across
Greenwood, Quadbike, Wayfarer, BMX, Squalo and Reefer. All requested look states
were recorded, but the maximum requested-direction dot product was below 0.00004
and the near clip remained 0.08. Evidence:
`artifacts/vehicle-bumper-look-baseline.json` and
`artifacts/vehicle-bumper-look-baseline.log`.

All 432 native reference cases, TypeScript and 759 focused camera/pose/ownership
checks pass (one existing optional asset check skipped). The corrected real-key
browser check passes all six models, left/right/rear view and release back to
forward view, with no page errors.

All **54 live look sources match native output exactly**. Maximum displayed-axis
differences are 9.53e-8 for direction and 1.56e-7 for up, including the Three.js
quaternion construction. Every look uses the captured near clip; release retains
the prior normal-view policy. Evidence:

- `artifacts/vehicle-bumper-look-browser.log`
- `artifacts/vehicle-bumper-look-live.json`
- `artifacts/vehicle-bumper-look-live-native.json`
- `artifacts/vehicle-bumper-look-live-verification.json`

All four regression browser specs pass: fourteen bike/quad height paths with
movement/visibility checks, all ten boats, car bumper controls, and draw-time
vehicle/body culling with the independent exit transition
(`artifacts/vehicle-bumper-look-regression-browser.log`). The full suite passes
**18,427 tests / 51 skipped** across 895 passing files
(`artifacts/vehicle-bumper-look-full-unit.log`). The production build and smoke
pass, including save/resume, walking, car entry, map waypoint, pause/resume and
aircraft takeoff/gear checks, with no browser errors or failed requests
(`artifacts/vehicle-bumper-look-build.log` and
`artifacts/vehicle-bumper-look-production.log`).
