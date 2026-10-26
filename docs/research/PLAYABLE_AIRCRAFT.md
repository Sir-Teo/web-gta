# Playable aircraft

The original seven fixed-wing models are supported: Rustler 476, Beagle 511, Cropduster 512, Stuntplane 513, Shamal 519, Nevada 553 and Dodo 593. Nine helicopters (Leviathan, Hunter, Seasparrow, Sparrow, Maverick, News Maverick, Police Maverick, Cargobob and Raindance) and Hydra 520 bring the hangar total to seventeen. Scripts additionally support RC Baron 464, RC Raider 465, RC Goblin 501 and Andromada 592, for twenty-one assembled aircraft models. DFF geometry, TXD textures, COL collision, IDE wheel sizes, CARCOLS paint, base handling mass/inertia and flying-handling coefficients come from the existing hash-verified static archive and resource lock.

The map hangar places the selected model at browser coordinates (150, ground height, -2500) on Verdant Meadows, facing east. This is an explicit browser convenience, not a recovered mission spawn. It loads a 180-metre detailed window plus original distant LODs out to 1,000 metres in the same world and enters the aircraft. The original fixed-model IPL plane spawns also load nearby; RC models are controlled through the mission remote-control path rather than the hangar. Andromada is available to scripts, including its [moving cargo ramp](MOVABLE_VEHICLE_PARTS.md#andromada-cargo-ramp-and-aircraft-host); Skimmer and airliners remain unsupported.

## Simulation and presentation

Flight runs `CVehicle::FlyingControl` as the iOS executable has it (`src/simulation/nativeFlyingControl.ts`), in native units, replacing the earlier fixed-step browser flight adapter: `CPhysical`'s gravity and air resistance (`fDragMult / 2000`, times `fGearUpR` with the gear up), the plane branch with its stall timer, and `CPlane::ProcessControlInputs`' input smoothing and propeller speed. The pinned [CVehicle::FlyingControl reference](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Vehicle/Vehicle.cpp) has only a fragment of that routine. Side grip, brakes and nose-wheel steering on the ground remain the browser's (`src/simulation/WorldPlane.ts`).

Rapier uses the original COL body plus support spheres at native wheel frames. Shared wheel atomics are replicated onto empty wheel frames. Damaged and low-detail alternatives are hidden; propellers and control surfaces animate. Gear-frame aircraft can retract their wheel supports; aircraft without gear frames retain fixed gear. Retraction is an immediate browser operation, not the native transition animation. Pose interpolation remains in the renderer; simulation state stays in the controller.

The aircraft follows the player camera and minimap, hides the on-foot character and disables its collider while occupied. Leaving requires low speed, ground contact and a clear capsule-sized exit beside a wing. Airborne terrain replacements preserve the aircraft's physical pose/velocity instead of requiring pedestrian ground support. Original terminal LODs load out to 1,000 metres around every exterior window, flying or not, while nearby detail and collision keep a 180-metre window. Existing loading pauses protect its edge. See [aerial streaming](AERIAL_WORLD_STREAMING.md) for memory policy, active IPL selection and remaining limits.

## Controls and limits

W/S supplies the current throttle/brake input; down/up arrows raise/lower the nose; A/D banks; Q/E operates the rudder and ground steering; G toggles supported gear; Space brakes on the ground; F enters/exits; M opens the map. Flight telemetry reports local forward airspeed, height above the raycast ground, throttle, gear and low-speed stall warning.

Helicopters fly `FlyingControl`'s heli branch (`heliFlyingControl`): the collective comes from the throttle, the rotor must spin up before it lifts, and holding Space brakes the drift as `CHeli`'s hover button does (`heliHoverInputs`). T swings the Hydra's nozzle; past the VTOL angle the Hydra flies the heli model on the Hunter's flying handling (`hydraThrustAxis`). Native rotor frames rotate. Rustler, Hunter and Hydra have mounted guns (Ctrl); Hunter and Hydra have rockets (B), with bounded ammunition and self-collision exclusion. Weapon hits and hard impacts reduce aircraft health; destruction releases occupancy and damages the player.

Missions, autopilot and exact flight dynamics remain unfinished. Source aircraft carry no `_dam` visual variants (audited Rustler/Maverick against Greenwood), so damage reads through the smoke/fire bands and stopped rotors. The project remains a recreation in progress.

### Entry and exit clips

Entry/exit clips resolve through each model's handling anim group (`AssocGroupId 88+n`), verified against the shipped `handling.cfg` rows: Rustler/Hunter/Cropduster/Stuntplane align and climb from `animations/rustler.ifp` (`Plane_align_LHS/getin/getout`); Hydra aligns from ped and climbs from the rustler block; Shamal uses `animations/shamal.ifp` throughout; Nevada aligns from ped and climbs from `animations/nevada.ifp`; helicopters, Beagle and Dodo use ped `CAR_*` clips throughout. F starts the align (where one resolves) and getin clips at the door with controls locked and occupies the seat when the sequence completes; F after landing starts the getout clip at the cleared side spot and restores collision when it completes. Death or arrest cancels the phase (exiting lands on foot). Door-only open/close phases have no aircraft equivalent and are skipped, as is the native approach/door task sequence.

### Pilot seating

The player sits at the aircraft's `ped_frontseat` dummy, mirrored to the driver's side as `GetSeatPositionInVehicle` does, with the ride set that `CVehicle::ProcessDrivingAnims` picks for every vehicle type (gta-reversed `Vehicle.cpp`, 0x6DF4A0): the weak, standard or pro set by driving skill (the new-game skill selects the weak set), its `_slow` look clips at `|m_vecMoveSpeed| ≤ 0.4`, and the look-left/right blend `|m_fSteerAngle / 0.61|`. The aircraft's steer angle is the bank input times the handling steering lock. The reverse-gear look-back is skipped for helicopters and planes, as in the native test. Verified in a Maverick at Verdant Meadows: the pilot's `CAR_sit_weak` pose shows through the left cabin window.

### Flight refinement

The two refinements below were made to the earlier browser flight adapter, which `nativeFlyingControl.ts` has since replaced; there, gear-up drag is `ApplyAirResistance` times `fGearUpR`.

Bank-induced yaw measures wing tilt against the aircraft's horizontal heading, so equivalent banks turn consistently in all compass directions. Exactly vertical attitudes omit the undefined horizontal bank correction.

Gear-up drag now multiplies the browser's base quadratic drag by the original `gearUpResistance`, matching the multiplier used by the verified native gear endpoint. This replaces the universal 0.75 factor: Rustler uses 0.2, Shamal/Nevada 0.3, and the supported fixed-gear profiles 1.0. The base aerodynamic force remains an approximation; this does not import the native force integration or gear animation.

Original wheel frames roll about their native X axle using signed local forward travel and the existing tire radius. They coast down in the air, interpolate between simulation steps, and preserve their authored frame centers. Contact still uses the aircraft's ground estimate, not individual tire slip or native plane suspension; the exponential spin decay is a presentation approximation.

## Verification

Browser tests assemble and dispose all twenty-one supported aircraft models, take a Rustler off from Verdant Meadows through real keyboard input, check map navigation and airborne gear, and reject an in-flight exit. A Dodo landing/braking/exit test uses an isolated test floor to verify physical settling and restored player collision. `tests/plane-entry.test.ts` covers the model-to-clip mapping, phase completion timing and that every mapped clip exists in the packaged IFPs. Car and map regression scenarios remain enabled. Production verification repeats hangar takeoff and gear operation through visible controls without development hooks.

Production takeoff decisions now sample the visible speed/AGL at a regular
100 ms cadence and use the sample that crossed the threshold. Playwright's
default polling backs off to one second, enough to travel another 28 metres
at 100 km/h before pulling up; another read before the key press adds delay.
That cadence change initially retained rotation above 100 km/h and continuous
elevator through 15 m AGL, with key release in finally. A captured production
failure reached 108 km/h and 8 m AGL before a collision near the boneyard.
The dedicated takeoff/gear/airborne-exit case and an instrumented reproduction
pass; production also passes with the regular cadence. The failure and native
control/position samples are retained in artifacts/occupant-exit-vitals-flight-*
for further investigation of flight behavior.


The October 21 RC integration adds separate control/camera/streaming focus and delayed hand-back without seating CJ; see [remote control](REMOTE_CONTROL.md). Script aircraft placement includes the suspension-adjusted native base height, and [SET_HELI_STABILISER](HELICOPTER_STABILISER.md) reaches the rotor-axis and stick branches.

### Production takeoff piloting follow-up (October 26, 2026)

Regular polling alone did not resolve the intermittent check. A later
production trace rotated at 101 km/h, peaked at 15 m and lost forward speed
to 58 km/h while full elevator stayed held. An instrumented development run
showed the same continuous input driving pitch to about 45 degrees and forward
speed to 57 km/h; that run barely cleared 16 m. Roll/rudder were zero, throttle
was full and terrain hold was false. Releasing at 5 m with the original rotation
speed still peaked at 15 m in another production trial.

The verifier now builds speed past 115 km/h before rotation and releases the
elevator at 5 m AGL, then lets the aircraft climb. It still requires more than
15 m AGL within the same 20-second climb deadline and checks airborne gear
operation. This is an authored test-pilot choice; flight forces, input smoothing,
controls, terrain and vehicle data are unchanged.

The corrected production run rotates at 116 km/h, releases at 108 km/h and
5 m AGL, and clears 16 m 2.846 wall seconds after rotation. Walking, native car
entry, map waypoint, pause/resume, saved-game return and gear checks also pass,
with no page errors or failed requests. Successful samples are retained in
artifacts/aircraft-rotation-margin-production.json; the original and 5 m-release
failures remain in artifacts/npc-ambient-seats-flight-failure.* and
artifacts/aircraft-release-5m-failure.json. These trials do not establish matched
retail PC flight dynamics or resolve all aircraft/streaming behavior.
