# Bike and quad bumper camera offsets

## Change

Motorcycle, bicycle and quad bumper views now include the model's front-seat
dummy before applying the `(0, 0.08, 0.62)` offset. X is ignored, as in the
reference. Missing the seat's Y/Z changed the horizontal source even when a
motorcycle's neck later replaced the camera height, especially on a tilted hull.

Quads retain the transformed dummy height. They are automobiles, so they do not
take `Process_1stPerson`'s vehicle-type-9 neck override. The host previously
applied that override to everything implemented by its `WorldBike` class.
No rider, physics, aiming or weapon algorithm changes here.

## Independent references

The PC source identity and source-compiled replay are documented in
[BOAT_BUMPER_CAMERA.md](BOAT_BUMPER_CAMERA.md). `Process_1stPerson` chooses the
front-seat dummy for non-boats and uses the neck only for `IsBike()`;
`CVehicle::IsBike` tests `VEHICLE_TYPE_BIKE`, distinct from an automobile/quad.

The pinned native iOS routine was independently identified at `0x10021769c`.
Disassembly: `artifacts/vehicle-firstperson-disassembly.txt`. Its relevant stages:

- `0x100217874`: vehicle type 9 selects the bike lean matrix.
- `0x100217890..0x10021794c`: model dummy slot 0 for boats/4 otherwise, zero X,
  add the native offsets, actual `CMatrix::TransformVector`, add vehicle position.
- `0x10021794c..0x100217a90`: vehicle type 5 adds world height 0.5; vehicle type 9
  takes the driver neck/velocity/visibility branch; other types skip it.

`scripts/research/emulate-vehicle-bumper-source.py` runs the actual dummy/source
instructions and native matrix helper at `0x1002cb268`. Matrix, dummy slots and
vehicle/model type are declared inputs. The unselected dummy slot contains a
different vector to check the type-dependent read. It stops before bike neck/LOS
or upside-down protection, and excludes the earlier lean-matrix selection.

The 72 fixed cases cover automobile/boat/bike types, varied headings and tilted
bases, positive/negative dummy coordinates and large world positions. Their
float32 positions and FOV agree exactly with the independently compiled PC
source fragment after round-tripping its decimal output back to float32:
`artifacts/vehicle-bumper-fixed-source-verification.json`.

The binary is the existing 14,226,544-byte reference, SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
Neither reference establishes retail-PC FPU/task/render scheduling equivalence.

## Baseline and validation

The unchanged game reproduces horizontal errors of approximately 0.20–0.48 metres
across all 14 playable models at varied headings. The quad's full source error
reaches 0.38 metres. All 140 baseline frames were independently replayed through
the native source stage. Evidence:

- `artifacts/bike-bumper-camera-baseline.json`
- `artifacts/bike-bumper-camera-baseline-final.log`
- `artifacts/bike-bumper-baseline-native.json`
- `artifacts/bike-bumper-baseline-verification.json`

The browser test checks horizontal coordinates for motorcycles/bicycles and all
three coordinates for quads. The neck-height path was outside this offset change. A subsequent
[neck/lead/visibility change](BIKE_BUMPER_HEIGHT.md) covers selected native height
branches. A subsequent [ground-lift change](BUMPER_GROUND_LIFT.md) covers the
upside-down source guard; wheelie camera and full original-PC scheduling remain
open.
The later [body-origin correction](BIKE_BUMPER_ORIGIN.md) separates the
interpolated physical origin from the lean matrix's rendered translation.
The checkpoint's double/quaternion transform was compared with a declared millimetre
tolerance, not called bit-exact. A later [source-precision correction](VEHICLE_BUMPER_SOURCE_PRECISION.md)
uses the captured float32 order. Arbitrary nested dummy preprocessing and matched
original-PC screenshots remain acceptance boundaries.

All 14 bike/quad models pass the corrected browser check. All **140 frames**
agree with the native stage within **0.000132 metres** for the tested coordinates
(horizontal for motorcycles/bicycles, full XYZ for quads). Native and PC-source
float32 outputs agree exactly for those declared inputs. The ten-boat regression
also passes: its 110 current frames agree within a millimetre and have matching
native/PC-source float32 outputs. Evidence:

- `artifacts/bike-bumper-camera-browser.log`
- `artifacts/bike-bumper-camera-live.json`
- `artifacts/bike-bumper-live-native.json`
- `artifacts/bike-bumper-live-source.json`
- `artifacts/bike-bumper-live-verification.json`
- `artifacts/boat-bumper-native-live-verification.json`

TypeScript and the `/web-gta/` production build pass. The production browser
smoke passes saved-game launch, walking, map waypoint, car entry/exit, pause,
aimed pistol, takeoff and gear control, with no page errors or failed requests.
Logs: `artifacts/bike-bumper-camera-types.log`,
`artifacts/bike-bumper-camera-build.log` and
`artifacts/bike-bumper-camera-production.log`.
