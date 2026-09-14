# Playable fixed-wing aircraft

Seven native models are supported: Rustler 476, Beagle 511, Cropduster 512, Stuntplane 513, Shamal 519, Nevada 553 and Dodo 593. DFF geometry, TXD textures, COL collision, IDE wheel sizes, CARCOLS paint, base handling mass/inertia and flying-handling coefficients come from the existing hash-verified static archive and resource lock.

The map hangar places the selected model at browser coordinates (150, ground height, -2500) on Verdant Meadows, facing east. This is an explicit browser convenience, not a recovered mission spawn. It loads an 400-metre window in the same world and enters the aircraft. The original fixed-model IPL plane spawns also load nearby; remote-control planes, Skimmer, Hydra and airliners are not enabled by this controller.

## Simulation and presentation

A fixed-step browser flight adapter supplies throttle-dependent thrust, quadratic forward drag, speed-dependent lift, gravity, lateral damping, bank/pitch/rudder control, ground steering/brakes and stall indication. Original coefficients tune aircraft response, but the formulas and units are browser approximations. The pinned [CVehicle::FlyingControl reference](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Vehicle/Vehicle.cpp) still forwards to the original executable and contains an incomplete reconstruction; this implementation does not claim to reproduce that routine.

Rapier uses the original COL body plus support spheres at native wheel frames. Shared wheel atomics are replicated onto empty wheel frames. Damaged and low-detail alternatives are hidden; propellers and control surfaces animate. Gear-frame aircraft can retract their wheel supports; aircraft without gear frames retain fixed gear. Retraction is an immediate browser operation, not the native transition animation. Pose interpolation remains in the renderer; simulation state stays in the controller.

The aircraft follows the player camera and minimap, hides the on-foot character and disables its collider while occupied. Leaving requires low speed, ground contact and a clear capsule-sized exit beside a wing. Airborne terrain replacements preserve the aircraft's physical pose/velocity instead of requiring pedestrian ground support. The window expands to 400 metres while flying; existing loading pauses still protect the edge of the loaded region. Full distant-world LOD rendering remains unfinished.

## Controls and limits

W/S increases/decreases retained throttle; down/up arrows raise/lower the nose; A/D banks; Q/E operates the rudder and ground steering; G toggles supported gear; Space brakes on the ground; F enters/exits; M opens the map. Flight telemetry reports local forward airspeed, height above the raycast ground, throttle, gear and low-speed stall warning.

Native aircraft sound, pilot seating/entry animations, damage/explosions, weapons, missions, autopilot, VTOL, helicopters, seaplane buoyancy and exact flight dynamics are not implemented. The project remains a recreation in progress.

## Verification

Browser tests assemble and dispose all seven original aircraft, take a Rustler off from Verdant Meadows through real keyboard input, check map navigation and airborne gear, and reject an in-flight exit. A Dodo landing/braking/exit test uses an isolated test floor to verify physical settling and restored player collision. Car and map regression scenarios remain enabled. Production verification repeats hangar takeoff and gear operation through visible controls without development hooks.
