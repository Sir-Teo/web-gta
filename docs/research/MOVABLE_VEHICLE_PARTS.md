# Movable vehicle parts

Native research, October 22, 2026. CONTROL_MOVABLE_VEHICLE_PART (08A4) and GET_CAR_MOVING_COMPONENT_OFFSET (098D)
now reach the supported cars' moving components. Forklift tines, dozer blades, packer ramps and dumper beds change
both their drawing and surface-65 collision geometry. Player car-gun input and the touch stick operate these parts.

Evidence uses the hash-verified ARM64 executable described in [remote control](REMOTE_CONTROL.md#evidence), and
pinned gta-reversed `4281f82d8af83e14935ac84a69dfd1ceebb9f256`: `Automobile.cpp`, `MonsterTruck.cpp`, `Vehicle.cpp`
and the vehicle node enums.

- CONTROL's 2200-range table is 0x100200f1c; entry 12 reaches 0x1001fff90, continues at 0x100200ac0 and calls
  CAutomobile::UpdateMovingCollision, 0x10043ddf8. The parameter is a fraction multiplied by 2500, truncated and
  stored as uint16 (+0xa88); script input is not clamped to [0,1]. Previous angle is at +0xa8a.
- Outside player control, the vehicle must be mission-created and the supplied fraction nonnegative. Player
  control checks the driver and playing state. Automatic control passes a negative angle and uses car-gun up/down
  only outside the inclusive [-10,10] dead zone. Ordinary increments are trunc(pad * 10 * timeStep / 128).
  The native forklift uses 20 for negative pad values and 10 for positive ones (0x10043e09c–0x10043e0f0).
  Native arithmetic adds a **signed** increment and clamps to [0,2500] before storing, unlike the reversed source's
  uint16 cast and forklift sign logic. The implementation follows the executable.
- Cement/ladder trucks use a separate angle branch: negative pad beyond -10 increases at twice the ordinary rate,
  otherwise their positive angle decays by trunc((pad+100)*10*timeStep/128). Their reported offset is zero.
- GET's handler is 0x100203edc, tail 0x100204708, calling GetMovingCollisionOffset at 0x10043e8c8. Zero angle returns
  positive zero. Factors are float32: forklift +0.0006 (translation), dozer +0.0002, packer -0.0001, dumper +0.0002,
  Andromada +0.00015 (rotations). Dozer/dumper/Andromada require their component frame; forklift/packer offset
  reads do not. The dumper's generic CAR_MISC_C index 22 is MONSTER_MISC_A, named `misc_a` in its DFF.

Collision follows UpdateMovingCollision: transform original vertices belonging to material 65
(SURFACE_CAR_MOVINGCOMPONENT), plus spheres of that material. Boxes and other primitives are unchanged. Rotation
is about the native component frame's local position; the forklift translates upward directly. Bounds expand in z.
Each update starts from original COL geometry. The host updates existing Rapier collider shapes and metadata,
preserving handles and filters, and updates the same component's native frame. The model cache remains immutable.
The relevant drawing branches are iOS 0x10044a1ec (packer), 0x10044a57c (dozer), 0x10044a650 (forklift), and
CMonsterTruck::PreRender (PC 0x6C7DE0, reversed) for the dumper.

This is intentionally classified as **authored coverage** in the census: native angle/COL behavior is implemented
for these supported cars, while the complete vehicle family is unfinished. The cement drum and fire-ladder
pitch/sway drawing are connected; see below and [ladder evidence](DOOR_ANGLE_AND_LADDER.md). Andromada is now supported (see below); native AddMovingCollisionSpeed's
contact velocity/impulse behavior remains unported. Rapier resolves changed shapes; this is not proof that loads
lift or balance as in the original. The shared four-slot special-COL pool (GetSpecialColModel, iOS 0x100480370)
is also not reproduced; supported browser vehicles already own separate collision copies. Full mission completion
is unverified.

Unit checks cover script storage, gates, signed clamping, dead zones, asymmetric forklift rates, special-truck
state, exact offset factors, marked/unmarked primitives, original-geometry restoration and adapter dispatch.
Browser checks exercise all four supported models, immutable assets, visible frames and direct shape contacts at
old/new forklift tine heights, plus keyboard raising/lowering and disabled controls. A touch check exercises the
contextual Lift stick and release behavior.

## Cement mixer drawing

The native PreRender branch (0x10044a5a8–0x10044a648) stops for STATUS_WRECKED. It pitches `misc_a` by
float32(-10 degrees), increments the drum phase by float32((angle/2500 + 0.5)*0.02*timeStep), sets `misc_b` about
native Y to that phase, then applies the same X pitch. This Rx(pitch)*Ry(phase) basis keeps both original frame
positions. WorldCar performs that update at its existing 30-fps component cadence. The touch stick is offered as
Drum in the mixer and Ladder in the ladder truck. Exact native rendering/visibility cadence remains a limitation.

The model-524 browser check passes for baseline, half and full input rates, original frame positions, compound
rotation, zero reported collision offset, and stopping after wrecking. The loader and touch-loader checks also pass.

## Andromada cargo ramp and aircraft host

Model 592 now constructs a WorldPlane from its shipped DFF, COL and 40,000-unit handling mass, instead of falling
through to the automobile factory. It uses the existing native fixed-wing flight controller. The map hangar's
seventeen choices are unchanged; scripts can create the cargo aircraft, bringing assembled aircraft support to 21.

Its generic CAR_MISC_E slot 24 is **PLANE_MISC_B**, named `misc_b` in the DFF. Collision setup reads that pointer
at iOS 0x10043e258, multiplying angle by float32(0.00015) at 0x10043e268. The drawing branch at
0x10046b374–0x10046b398 uses the same slot/factor and SetComponentRotation about X with rotation replacement.
The host now applies those transforms to the frame and its two surface-65 COL triangles, preserving original
frame position and shared assets. Vehicle bounds queries use the instance's changed COL bounds. Collider updates
are shared with the car implementation and retain existing handles/filters. Occupied keyboard car-gun input is
wired to the ramp; the new aircraft is not added to the touch hangar selector.

Browser checks pass for actual CREATE_CAR host routing, SCM control/offset calls, full/half/reset ramp poses,
original asset preservation, all 21 aircraft assemblies/disposals, and a ten-second in-air flight using the
original handling (about 679 units traveled, finite pose and velocity, health 1000). This does not verify an
Andromada runway takeoff/landing, passenger behavior or a complete cargo-plane mission. Existing plane suspension,
gear and native moving-contact-force limitations remain.
