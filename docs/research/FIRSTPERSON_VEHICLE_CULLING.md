# Forward first-person vehicle and seated-body culling

## Behavior

Forward bumper view now suppresses the occupied vehicle and its seated bodies
during the main scene draw. This removes the rider's face and vehicle geometry
that previously intruded into the view. Pose and bone updates still run before
camera sampling. Each root's prior visibility is restored immediately after the
draw, including after an exception; script visibility, hit queries and later
frames retain their state.

`vehicleRenderOwnership.ts` tracks seated character roots by vehicle. Registration
is constant-time and a culled draw visits only that vehicle's occupants. It does
not scan the world. On-foot updates and disposal clear ownership; changing seats transfers it.
The character root stays stable through body-model swaps.

Vehicle-relative animation is not sufficient to imply seated render ownership.
`renderWithVehicle:false` leaves entry, exit and attached bodies independently
drawable. This includes the player's car/bike/aircraft transitions, jacked drivers,
police/emergency crews leaving or boarding, and script attachments. Riders still
waiting in their seats retain vehicle ownership.

## PC source evidence and scope

The source is gta-reversed revision
`4281f82d8af83e14935ac84a69dfd1ceebb9f256`:

- `CRenderer::SetupEntityVisibility` (PC `0x554230`, `Renderer.cpp:544..573`)
  culls the player's forward first-person vehicle when direction is 3.
- `CRenderer::RenderOneNonRoad` (`0x553260`, `Renderer.cpp:108..120`) skips
  standalone `PEDSTATE_DRIVING` draws and renders those occupants through the
  vehicle.
- `CVehicle::RenderDriverAndPassengers` (`0x6D3D60`) draws the driving driver
  and passengers. Consequently, culling the forward vehicle also suppresses
  those seated body draws.

`Renderer.cpp` was compared byte-for-byte with the public raw file at that
revision. SHA-256:
`8f91fecefd17a8b06c17656c1660f89f978c777016cca7c8c549fd16bb1e58a0`.
Identity and URL: `artifacts/firstperson-culling-source-file.json`.
The pinned `Vehicle.cpp` identity is also recorded in the driving-ride research.

This is a source-backed forward-view rule, not a complete renderer port or a
matched retail-PC capture. The host applies it to its active forward bumper
view, with no fixed script camera. Side/rear vehicle ordering, the native wheelie
camera exception, mirror behavior and full original-PC visibility scheduling
remain acceptance boundaries. Camera glance geometry is a separate open task.

## Validation

The unchanged game reproduces the issue in 18 actual draw-time observations:
Greenwood (including an NPC passenger) and Wayfarer remain visible in forward
bumper draws. Evidence: `artifacts/firstperson-vehicle-culling-baseline.json`,
`artifacts/firstperson-culling-baseline.log` and
`artifacts/firstperson-culling-baseline-{492,586}.png`.

The first corrected browser run passes all four camera specs: all 14 bike models
with movement/blocked-height checks, all ten boats, car bumper controls, and
draw-time vehicle/body suppression with visibility restored after rendering.
Evidence: `artifacts/firstperson-culling-browser.log`.

TypeScript and all 325 focused ownership/character/pose/height checks pass (one
existing optional asset check skipped). The additional transition distinction
is exercised through `NativeCharacter`, rather than inferred from a frame's
vehicle pointer. All seven crew/culling transition checks pass, including
ambulance/firetruck/gang crews and medic deaths while jacking. Three actual
`getOut` bumper draws keep CJ visible independently while culling the car and
its seated passenger, then restore visibility afterward. The 30 recorded draw
observations cover Greenwood, Wayfarer and Squalo, and an NPC passenger:
`artifacts/firstperson-vehicle-culling-live.json` and
`artifacts/firstperson-culling-transitions-browser.log`.

The existing exit-camera check failed its ten-wall-second entry wait on both
the current game (`getIn`) and unchanged checkpoint `eb9e0822` (`closeInside`).
Its entry/exit readiness waits are now bounded at 30 wall seconds; camera
orientation assertions stay unchanged, and the walking distance assertion uses
one game second. The revised check passes on both apps. No entry or locomotion
behavior was changed for this test. Evidence:

- `artifacts/firstperson-culling-camera-exit-baseline.json`
- `artifacts/firstperson-culling-camera-exit-baseline.log`
- `artifacts/firstperson-culling-camera-exit-baseline-ready.log`
- `artifacts/firstperson-culling-camera-exit-final.log`

The owned temporary baseline worktree was removed. The full suite passes
**17,995 tests / 51 skipped**, across 894 passing files, in
`artifacts/firstperson-culling-full-unit.log`. TypeScript and the `/web-gta/`
production build pass. The production browser smoke passes saved-game launch,
walking, map waypoint, Greenwood entry/exit, pause/resume, aimed pistol, Rustler
takeoff and gear control, with no page errors or failed requests. Evidence:
`artifacts/firstperson-culling-build.log` and
`artifacts/firstperson-culling-production.log`.
