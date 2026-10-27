# Passenger bumper camera selection

## Observed gap

The host enables vehicle camera controls for a seated passenger, but its bumper
source block selects only driven cars, bikes and boats. Pressing V can therefore
select the stored bumper setting while `bumperView` stays false and the camera
continues to use the follow view.

## Integration

Resolve the seated passenger's car or bike as the same camera target used for
driven land vehicles. The existing first-person source, look, ground-lift and
draw-time ownership paths then apply. Aircraft remain outside the established
bumper camera scope.

A motorcycle or bicycle passenger must use the driver's neck for the normal
first-person height stage. The selected native `Process_1stPerson` explicitly
reads `targetVeh->m_pDriver`, then requests bone 4 with update enabled; it does
not select the player merely because the player is in the vehicle. Existing
native scalar evidence is in [bike bumper height](BIKE_BUMPER_HEIGHT.md).
The host's NPC occupant pose update precedes the renderer camera update, so a
camera callback can sample that frame's rendered driver. If no rendered driver
pose is ready, retain the base source until it is available.

Cars and quads use the existing front dummy source irrespective of passenger
seat. The PC source fragment and selected native dummy/source capture already
cover the same declared type/matrix/dummy inputs; this change concerns the host
vehicle and driver selection. Existing forward vehicle/body culling includes
all registered seated bodies through vehicle render ownership. The PC renderer
uses `FindPlayerVehicle()` in its forward first-person suppression branch.
See [vehicle/body culling](FIRSTPERSON_VEHICLE_CULLING.md).

Complete retail-PC camera target selection, task scheduling, interpolation and
matched captures remain outside those selected routine/source checks.

## Validation

The unchanged game records all 84 real-key observations: three Greenwood
passenger seats, a quad passenger, a Wayfarer passenger with an NPC driver, and
a Wayfarer passenger without a driver. Each scenario records near view, real V
selection of bumper mode, then forward, left, right and rear observations.
All 72 bumper selections retain `bumperView=false`, FOV 70, and visible vehicle,
player and NPC bodies. The corrected test first waits for each real V press to
change the stored mode, so the failure is distinct from missed key processing.
Evidence: `artifacts/passenger-bumper-camera-baseline.json` and `.log`.

All 864 focused camera/reference/ownership/passenger tests and TypeScript pass.
All 84 corrected browser observations pass, including the 72 bumper views.
All 18 forward views suppress the vehicle and seated bodies, and all side/rear
views restore them. Visibility is restored after each draw. The NPC driver is
the sampled bone owner for every Wayfarer height update; the driverless bike
does not substitute the passenger's neck.

All 12 NPC-driver source samples match the actual native neck/velocity stage
exactly. The 15 car/quad/driverless forward sources agree with the selected
native base-source stage within 0.000120 metres. This checkpoint retained the host
double transform, so these base sources were not called bit-exact.
The base replay declares the current rendered matrix position and dummy. The
height replay separately declares the prior source, current driver neck and
physical body position. Zero frozen velocity removes lead cadence from the
driver-height comparison. The existing bike render-origin adapter is retained;
this check does not establish the complete native lean-matrix/body-origin owner.
The later [bike body-origin correction](BIKE_BUMPER_ORIGIN.md) separately
removes the lean translation from the camera's interpolated origin.
A subsequent [source-precision correction](VEHICLE_BUMPER_SOURCE_PRECISION.md)
uses the captured float32 source arithmetic.

Evidence: `artifacts/passenger-bumper-camera-browser.log`,
`artifacts/passenger-bumper-camera-live.json`,
`artifacts/passenger-bumper-camera-native.json` and
`artifacts/passenger-bumper-camera-verification.json`.
All four regression browser checks pass: the existing driver V/FOV cycle,
quad and PCJ-600 passenger controls/ejection/cleanup, and the script-car
passenger ride/exit (`artifacts/passenger-bumper-camera-regression-browser.log`).
The production build and smoke pass, including save/resume, walking, car entry,
map waypoint, pause/resume and aircraft takeoff/gear, with no browser errors or
failed requests (`artifacts/passenger-bumper-camera-build.log` and
`artifacts/passenger-bumper-camera-production.log`).
