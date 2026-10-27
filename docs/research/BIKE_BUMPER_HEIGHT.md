# Bike bumper neck, movement lead and visibility fallback

## Behavior

Motorcycle/bicycle bumper views sample neck bone 4 after the host updates the
current rider pose. The height includes native move-speed Z times the camera's
timestep, then float32 0.15. The previous path sampled the earlier pose and added
0.15 without movement lead or a visibility fallback. Quads keep their automobile
camera path.

The native visibility segment spans `source ± cross(front, up)`, using camera
axes on entry to the routine. A blocked building sightline replaces X/Y with
the vehicle position, then uses neck-with-lead Z plus 0.62 then 0.15. That float32
addition order is retained. The host camera timestep is elapsed **game** time
since the previous rendered frame, capped at three native steps; pauses and
terrain holds contribute zero movement lead.

`Renderer.bumper.sourceForCamera` defers bone sampling until `updateVehicle` has
applied the current pose. It is used only by the motorcycle/bicycle path. The
host building query includes fixed non-sensor scene buildings/terrain, excluding
known object and dummy sources. This is a host collision adapter, not native
`CWorld` sector/query equivalence.

## Native capture and limits

The pinned executable and base-source capture are described in
[BIKE_BUMPER_CAMERA.md](BIKE_BUMPER_CAMERA.md). Its actual
`Process_1stPerson` neck/velocity stage is `0x100217968..0x100217a90`:

- `0x100329034` is called with bone 4 and update flag 1. Its transformed bone
  result is a declared service input in the reference harness.
- Native neck/velocity arithmetic and `CVector` cross product execute.
- `0x10026e7e0` receives the actual computed sightline endpoints and flags
  `[1,0,0,0,0,0,0]` (buildings only). Its clear/blocked answer is declared.
- Both clear and blocked source branches execute. Capture stops before
  upside-down ground protection; wheelie camera and full camera ownership are
  outside this stage.

`scripts/research/emulate-vehicle-bumper-source.py --bike-height` generates
**240 independent native cases**, covering neck heights, positive/negative/zero
vertical speed, zero and fractional timesteps through 3, tilted axes, and both
visibility results. All final sources and query endpoints match the production
float32 helper exactly. The checked-in fixture is
`tests/fixtures/bike-bumper-height-reference.json`.

Live `declaredSource` profiles replace the native base source at
`0x100217968` with the host's declared dummy-transform result. Original native
base output remains in `baseSource`; selected matrix and body position are
separate inputs. This validates the following neck/visibility stage, **not**
the earlier transform/interpolation ownership. The previous base-source checks
remain separate coordinate comparisons with a millimetre tolerance.

The reversed PC `Cam.cpp` spells its query endpoints as cross products of source
vectors, whereas the selected native executable passes `source ± right`.
This change follows the executable capture. **Retail-PC sightline equivalence
is not established** by assuming the reversed spelling is correct or incorrect.
The PC `GetTransformedBonePosition(..., true)` source calls `UpdateRpHAnim` when
needed, but complete original task/bone/IK/render-phase ownership remains open.
The host game-clock timestep adapter is also separate from original `CTimer`
scheduling. This work does not claim full original-PC camera equivalence.

## Validation

All 240 native captures reproduce after separating selected and vehicle matrices.
All 396 focused camera/boat/ride checks and TypeScript pass. The existing car
bumper controls and all ten boats pass the browser regressions.

All 14 playable bike/quad models pass the corrected browser check. The 149
recorded frames include **139 motorcycle/bicycle height frames**, all with exact
native final-source and sightline-endpoint matches, including five blocked-wall
frames and four frames with nonzero vertical movement. The ten quad frames retain
their separate base-source comparison, within 0.000115 metres. Recorded sampled
necks equal the current rendered pose's neck after the frame. Evidence:

- `artifacts/bike-bumper-height-browser-final.log`
- `artifacts/bike-bumper-camera-live.json`
- `artifacts/bike-bumper-height-live-native.json`
- `artifacts/bike-bumper-height-live-verification.json`

The car bumper controls and ten-boat regressions pass in
`artifacts/bike-bumper-height-browser.log`. Bone-source identity comparisons are
recorded in `artifacts/bike-camera-bone-source-files.json`.

The full suite passes **17,991 tests / 51 skipped** across 893 passing files.
TypeScript and the `/web-gta/` production build pass. The production browser
smoke passes saved-game launch, walking, map waypoint, Greenwood entry/exit,
pause/resume, aimed pistol, Rustler takeoff and gear control, with no page errors
or failed requests. Logs: `artifacts/bike-bumper-height-full-unit.log`,
`artifacts/bike-bumper-height-build.log` and
`artifacts/bike-bumper-height-production.log`.
