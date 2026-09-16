# Playable aircraft

The original seven fixed-wing models are supported: Rustler 476, Beagle 511, Cropduster 512, Stuntplane 513, Shamal 519, Nevada 553 and Dodo 593. Nine helicopters (Leviathan, Hunter, Seasparrow, Sparrow, Maverick, News Maverick, Police Maverick, Cargobob and Raindance) and Hydra 520 bring the total to seventeen. DFF geometry, TXD textures, COL collision, IDE wheel sizes, CARCOLS paint, base handling mass/inertia and flying-handling coefficients come from the existing hash-verified static archive and resource lock.

The map hangar places the selected model at browser coordinates (150, ground height, -2500) on Verdant Meadows, facing east. This is an explicit browser convenience, not a recovered mission spawn. It loads a 180-metre detailed window plus original distant LODs out to 1,000 metres in the same world and enters the aircraft. The original fixed-model IPL plane spawns also load nearby; remote-control planes, Skimmer and airliners are not enabled by this controller.

## Simulation and presentation

A fixed-step browser flight adapter supplies throttle-dependent thrust, quadratic forward drag, speed-dependent lift, gravity, lateral damping, bank/pitch/rudder control, ground steering/brakes and stall indication. Original coefficients tune aircraft response, but the formulas and units are browser approximations. The pinned [CVehicle::FlyingControl reference](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Vehicle/Vehicle.cpp) still forwards to the original executable and contains an incomplete reconstruction; this implementation does not claim to reproduce that routine.

Rapier uses the original COL body plus support spheres at native wheel frames. Shared wheel atomics are replicated onto empty wheel frames. Damaged and low-detail alternatives are hidden; propellers and control surfaces animate. Gear-frame aircraft can retract their wheel supports; aircraft without gear frames retain fixed gear. Retraction is an immediate browser operation, not the native transition animation. Pose interpolation remains in the renderer; simulation state stays in the controller.

The aircraft follows the player camera and minimap, hides the on-foot character and disables its collider while occupied. Leaving requires low speed, ground contact and a clear capsule-sized exit beside a wing. Airborne terrain replacements preserve the aircraft's physical pose/velocity instead of requiring pedestrian ground support. Flying adds original terminal LODs out to 1,000 metres while nearby detail and collision retain a 180-metre window. Existing loading pauses protect its edge. See [aerial streaming](AERIAL_WORLD_STREAMING.md) for memory policy, active IPL selection and remaining limits.

## Controls and limits

W/S increases/decreases retained throttle; down/up arrows raise/lower the nose; A/D banks; Q/E operates the rudder and ground steering; G toggles supported gear; Space brakes on the ground; F enters/exits; M opens the map. Flight telemetry reports local forward airspeed, height above the raycast ground, throttle, gear and low-speed stall warning.

Helicopters and Hydra VTOL use authored collective lift, gravity, damping and self-leveling. Space stabilizes hover; T toggles Hydra VTOL/forward flight. Native rotor frames rotate. Rustler, Hunter and Hydra have mounted guns (Ctrl); Hunter and Hydra have rockets (B), with bounded ammunition and self-collision exclusion. Weapon hits and hard impacts reduce aircraft health; destruction releases occupancy and damages the player.

Entry animations, visual damage variants, missions, autopilot and exact flight dynamics remain unfinished. The project remains a recreation in progress.

### Pilot seating

The player sits at the aircraft's `ped_frontseat` dummy, mirrored to the driver's side as `GetSeatPositionInVehicle` does, with the ride set that `CVehicle::ProcessDrivingAnims` picks for every vehicle type (gta-reversed `Vehicle.cpp`, 0x6DF4A0): the weak, standard or pro set by driving skill (the new-game skill selects the weak set), its `_slow` look clips at `|m_vecMoveSpeed| ≤ 0.4`, and the look-left/right blend `|m_fSteerAngle / 0.61|`. The aircraft's steer angle is the bank input times the handling steering lock. The reverse-gear look-back is skipped for helicopters and planes, as in the native test. Verified in a Maverick at Verdant Meadows: the pilot's `CAR_sit_weak` pose shows through the left cabin window.

### Flight refinement

Bank-induced yaw measures wing tilt against the aircraft's horizontal heading, so equivalent banks turn consistently in all compass directions. Exactly vertical attitudes omit the undefined horizontal bank correction.

Gear-up drag now multiplies the browser's base quadratic drag by the original `gearUpResistance`, matching the multiplier used by the verified native gear endpoint. This replaces the universal 0.75 factor: Rustler uses 0.2, Shamal/Nevada 0.3, and the supported fixed-gear profiles 1.0. The base aerodynamic force remains an approximation; this does not import the native force integration or gear animation.

Original wheel frames roll about their native X axle using signed local forward travel and the existing tire radius. They coast down in the air, interpolate between simulation steps, and preserve their authored frame centers. Contact still uses the aircraft's ground estimate, not individual tire slip or native plane suspension; the exponential spin decay is a presentation approximation.

## Verification

Browser tests assemble and dispose all seventeen aircraft, take a Rustler off from Verdant Meadows through real keyboard input, check map navigation and airborne gear, and reject an in-flight exit. A Dodo landing/braking/exit test uses an isolated test floor to verify physical settling and restored player collision. Car and map regression scenarios remain enabled. Production verification repeats hangar takeoff and gear operation through visible controls without development hooks.
