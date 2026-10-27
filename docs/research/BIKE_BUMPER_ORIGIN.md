# Bike bumper body origin

The bike camera now adds the interpolated physical body position separately
from its selected lean orientation. The bike model retains its existing lean
translation and rendered pose.

## Evidence and correction

`Process_1stPerson` selects a bike's lean matrix for `TransformVector(dummy)`,
then adds the vehicle's own position. The lean matrix's position is not added.
The existing host source helper instead used the rendered root position, which
already includes `CalculateLeanMatrix`'s wheel-placement drop along physical up.
When physical up has horizontal components, the camera inherited that drop in
its horizontal coordinates. The neck-height stage replaces world height, so
that separate height calculation stayed correct.

The pinned reversed-PC `Cam.cpp` source fragment (`0x517EA0`) and selected
native `0x100217890..0x100217968` agree on the separate position addition.
The source hash is
`2df8f5b892109c4f71173b09558877dbdc79ef0ec6cf3fb15bbfcce9962a214d`
at revision `4281f82d8af83e14935ac84a69dfd1ceebb9f256`.
`scripts/research/emulate-vehicle-bumper-source.py` executes the actual selected
native transform and vehicle-position addition. Its `vehiclePosition` input
keeps the physical matrix position distinct from the selected matrix position.
An initial nine-case probe deliberately varies the selected matrix position;
the source still uses the separately declared vehicle position
(`artifacts/bike-bumper-origin-probe.json`).

`WorldBike.update` retains the interpolated body position immediately after
`interpolateVehiclePose`, before it adds lean orientation and translation.
The bumper adapter uses that retained position with the existing selected lean
quaternion. This keeps camera motion on the same interpolation endpoints as
the rendered bike, while removing the lean translation from the camera origin.
Car and boat source adapters retain their existing default root position.

## Validation

The unchanged browser check records 53 observations across PCJ-600, BMX,
Wayfarer and quad, with level and banked physical orientations, positive and
negative lean, and five unblocked moving/interpolated frames. The maximum
horizontal error against the independently reconstructed body-origin geometry
is 0.037908 metres. Actual native replay confirms a maximum horizontal error of
0.037957 metres and zero height error. The quad control case remains aligned.

Evidence: `artifacts/bike-bumper-origin-baseline.json`,
`artifacts/bike-bumper-origin-baseline.log`,
`artifacts/bike-bumper-origin-baseline-native.json` and
`artifacts/bike-bumper-origin-baseline-verification.json`.

All 864 focused camera/reference/ownership/passenger/vehicle-pose checks and
TypeScript pass. All 53 corrected browser observations pass, including all five
moving frames. Maximum horizontal error against independently reconstructed
body-origin geometry is 0.000102 metres. Actual native replay agrees within
0.000123 metres horizontally and exactly in height for every frame.
Baseline and corrected banked Wayfarer images were inspected; forward vehicle
and rider suppression remains intact.

Evidence: `artifacts/bike-bumper-origin-browser.log`,
`artifacts/bike-bumper-origin-live.json`,
`artifacts/bike-bumper-origin-live-native.json` and
`artifacts/bike-bumper-origin-live-verification.json`.
The 84-observation passenger regression also passes, including all car seats,
quad and bike driver/driverless variants, Q/E looks, and draw-time culling
(`artifacts/bike-bumper-origin-browser.log`). All 12 current passenger
NPC-driver sources also retain exact native agreement
(`artifacts/bike-bumper-origin-passenger-verification.json`). The production
build and smoke pass, including save/resume, walking, car entry, map waypoint,
pause/resume and aircraft takeoff/gear, with no browser errors or failed requests
(`artifacts/bike-bumper-origin-build.log` and
`artifacts/bike-bumper-origin-production.log`).

## Boundaries

Interpolation remains an explicit host adapter. The full original PC camera
owner, render/physics cadence, lean-matrix selection and matched PC captures are
outside these selected-stage checks. This checkpoint retained the quaternion/double
base transform and compared it separately with native float32 output; full-source
bit identity was not claimed. A later [source-precision correction](VEHICLE_BUMPER_SOURCE_PRECISION.md)
closes that scalar difference for the declared inputs. The normal bike neck/velocity/LOS stage
and the subsequent ground-lift/look routines retain their prior arithmetic.
