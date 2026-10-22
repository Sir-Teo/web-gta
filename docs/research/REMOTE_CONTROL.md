# Remote control: native behavior and integration

Implemented October 21, 2026. The seven remote-control commands now reach a separate vehicle control target,
its camera and streamed collision. CJ remains at his actual position and keeps his actual occupancy and collider.
Static command coverage does not establish a complete Zero mission pass. A later
[controlled ZERO2 regression](ZERO2_VALIDATION.md) now checks its original combat,
result, reward and delayed cleanup; uninterrupted flight remains unverified.

## Evidence

Pinned reference: gta-reversed `4281f82d8af83e14935ac84a69dfd1ceebb9f256`:
[Remote.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Remote.cpp),
[PlayerInfo.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/PlayerInfo.cpp),
[Automobile.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Entity/Vehicle/Automobile.cpp).
The Give/Take wrappers are unreversed there. Their behavior was read from the hash-verified ARM64 executable,
using the same acquisition and address mapping as `scripts/content/lib/ios-executable.mjs`:

- Repository: `Google61/gta3sa.app`, revision `67f70cb72eb207aeca650ea9e8c10b0e7dda166a`, file `gta3sa`.
- File size: 14,226,544 bytes; SHA-256 `9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
- Addresses below are ARM64 virtual addresses, not PC wrapper addresses.

| Command | Opcode | iOS handler |
| --- | --- | --- |
| IS_PLAYER_IN_REMOTE_MODE | 0241 | 0x1001d4b44 |
| GIVE_REMOTE_CONTROLLED_MODEL_TO_PLAYER | 046E | 0x1001e1b10 |
| GET_REMOTE_CONTROLLED_CAR | 0484 | 0x1001e1c2c |
| SET_ENABLE_RC_DETONATE | 048A | 0x1001e1c90 |
| SET_ENABLE_RC_DETONATE_ON_CONTACT | 04D6 | 0x1001e33f4 |
| REMOVE_RC_BUGGY | 04DB | 0x1001e3c2c |
| TAKE_REMOTE_CONTROL_OF_CAR | 0715 | 0x1001f67fc, tail 0x1001f7768 |

## Acquisition and hand-back

`CRemote::GivePlayerRemoteControlledCar` (0x1001c69f0) constructs an automobile, plane or helicopter by model
class, marks it mission-created and grounds it through FindGroundZFor3DCoord(x, y, z + 2), adding the model's base
lift. A high supplied z still goes through this ground query. The handler first resolves a z at or below the map's
low limit, and converts script degrees to radians. Give takes camera mode 18, interpolation switch 1, control 1.

`TakeRemoteControlOfCar` (0x1001c6d10) uses an existing vehicle. A different old target is abandoned and the
camera uses jump-cut switch 2; otherwise switch 1. It sets remote status and clears driving orders. Neither
acquisition routine clears a pending after-explosion state. The browser reserves the script vehicle handle before
asynchronous loading; a generation check prevents an older load from taking control back after replacement.
A failed spawn clears control and restores the camera. TAKE waits for an existing pending handle before effects.

`IsPlayerInRemoteMode` (0x100256560) returns the remote pointer **or** the after-explosion flag. GET returns the
pointer's script handle, or -1 for null. `TakeRemoteControlledCarFromPlayer` (0x1001c6c1c) retains the pointer,
clears the vehicle lock, sets after-explosion, create-explosion and fade-after-explosion state, and records the
unsigned millisecond clock. `BlowUpRCBuggy` (0x100256f14) ignores an absent/already-removing vehicle, calls Take,
and only explodes it when its argument requests that. REMOVE passes false.

`CPlayerInfo::Process` (0x100254048–0x10025419c) begins a one-second fade out when elapsed time crosses 1000 ms.
At **strictly more than 2000 ms**, it clears after-explosion, marks the remaining vehicle for removal and clears
the pointer. Camera restore and one-second fade in require the player still to be in PLAYING state and the fade
flag set. Explicit nonexplosive removal uses this same delayed hand-back. Repeated removal restarts the timer.
The browser tracks deletion separately from the after-explosion flag and guards late model completion.

## Detonation and RC weapons

The two SET_ENABLE commands store the inverse of their argument in independent disabled flags (globals
0x1008f7f08 and 0x1008f7f09). Both start clear. CAutomobile::ProcessAI (0x100446c90–0x100446d38) detonates a
remote automobile on a fresh car-gun press when manual detonation is enabled. RC Bandit 441 also detonates on
submersion or a native wheel hit when contact detonation is enabled. Destruction keeps player attribution without
using the occupied-vehicle path that directly kills CJ.

`RcbanditCheckHitWheels` (0x1004476a4) scans nearby sectors; contrary to the current reversed reference, it returns
false when no wheel hits. `RcbanditCheck1CarWheels` (0x10044cf30) skips self, non-automobiles, other RC Bandits and
already-scanned cars, and requires each horizontal separation below 10. It reads the **other car's** suspension
compression, transforms that car's static wheel dummies into the Bandit's frame, and tests wheels with compression
below 1 (or SIMPLE traffic). All four spheres use front wheel size × 0.25. Native TestSphereBox uses inclusive
expanded-box slab tests, not Euclidean corner distance. The browser uses the same geometry over its nearby fleet,
including traffic's SIMPLE/on-rails state; generic body contacts do not replace the wheel test.

The RC Baron 464 has a single M4 nose gun at native [0, 0.45, 0], with a 40 ms interval and no rockets
(CVehicle's reversed plane gun methods). The shared gun trace now accepts player-operated remote aircraft.
Its muzzle follows that nose offset. Existing large-aircraft barrel/spread approximations remain; see
[aircraft weapons](AIRCRAFT_WEAPONS.md).

## Browser integration and limits

- `nativeRemoteControl.ts` holds the pointer, independent flags, unsigned timers and camera transition result.
  `ScmMission` binds all seven commands to the actual script vehicle pool and host effects.
- Fleet control is separate from occupancy. Car and plane input follows the target; on-foot firing and vehicle
  entry are suppressed during remote mode. SET_PLAYER_CONTROL blocks remote flight input as well as driving.
- Streaming and active simulation follow the remote body. Terrain replacement preserves CJ, whose kinematic body
  stays at the source while that area is unloaded. Return streams CJ's area again. This uses the port's existing
  terrain window, rather than retaining two independently simulated collision regions.
  Fleet retirement, traffic paths and pedestrian population now use that same
  centre, with live ordinary population and hand-back lifetime checks
  ([coverage](REMOTE_POPULATION_FOCUS.md)).
- Camera mode 18 uses the existing entity-follow camera approximation. Native mode-specific spring, obstruction
  and recovery details have not been reproduced. Native mission/random vehicle ownership reclassification during
  TakeFromPlayer is not yet modeled separately from the fleet's temporary remote protection.
- RC models without native light textures now load without treating those absent textures as corrupt assets.
- The October 21 ZERO2 sweep reached its RC flight loop (offset 2912) without skipped commands, thread give-ups
  or page errors, then waited for gameplay. It did not complete the mission and is not evidence of flight playability.
  A subsequent focused test verifies the mission's actual roof placement, camera/radar focus and throttle handoff, with CJ remaining in its frozen van.
  A later controlled combat regression reaches the original first-courier death
  and counter update after fixing bike/boat collision focus
  ([evidence and limits](REMOTE_VEHICLE_FOCUS.md)). The extended
  [controlled result regression](ZERO2_VALIDATION.md) now completes all five
  couriers, the original reward and delayed cleanup. Uninterrupted flight and
  complete NPC combat parity remain unverified.
- ZERO4 now has no statically skipped commands. [Object/world intersection](OBJECT_WORLD_INTERSECTION.md), [SET_HELI_STABILISER](HELICOPTER_STABILISER.md), general vehicle collision-ignore binding and [oil-puddle removal](REMOVE_OIL_PUDDLES.md) are connected. Its live interior RC handoff and keyboard climb pass. The later
  [controlled route/result regression](ZERO4_VALIDATION.md) places both bridges,
  wrecks all three tanks with original bomb drops, clears the starting barrels
  and lets the Bandit reach its own goal. ZERO_4, $7,000 and a grounded, visible
  San Fierro return pass; uninterrupted/manual flight remains unverified.

## Verification

- `remote-control`: seven state tests for acquisition, switches, timer boundaries, wraparound, repeated removal,
  pointer deletion and replacement during recovery.
- `rc-bandit`: four geometry tests for filtering, the other car's compression, inclusive slabs and front-wheel radius.
- `script-remote-control`: six adapter tests for immediate handles/grounding, cancellation and replacement during
  loading, failed spawns, pending TAKE without premature effects, and independent detonation switches.
- `remote-control.spec.ts`: live GIVE/driving/nonexplosive removal; a flying Baron with CJ kept at the source,
  remote camera/streaming, actual nose-gun input and return; fresh-press manual detonation; independent wheel-contact
  detonation. Mission-handoff verification is maintained alongside these cases.

The full unit run after the placement, camera, radar and stabiliser follow-ups passed 3,291 tests (51 skipped), and the production build passed. All five live RC cases pass, including the ZERO2 opening and handoff. The RC ground fixture, aircraft assembly, Dodo landing, wheel animation, plane freezing, touch helicopter/VTOL flight and ordinary touch driving also pass. The 19 selected browser cases all passed across the main run and focused follow-ups. The hangar check now waits for free roam and sufficient bail-out clearance/speed; the tilt check uses clear fixture ground.

### ZERO2 handoff investigation

The mission itself creates a frozen Berkley van (459), places CJ in it and moves it to z=700.48 for remote play.
That staging is separate from the Baron (464), which GIVE creates at [-2205.44, 128.99, 57.33]. A dedicated browser
check exposed the Baron below the map at handoff despite successful command dispatch and input. Its ground query
had run before San Fierro's collision loaded. Remote GIVE now schedules the ground query again on streamed
collision arrival, holding physics until then; cars reuse their collision-wait path and planes carry the pending
query separately from occupancy/freeze. The mission test asserts the Baron's height as well as actual keyboard
motion, camera distance and unchanged CJ/van position. A motion-only assertion would miss this failure.


`CAutomobile::SetupSuspensionLines` (pinned reference, PC 0x6A65D0) extends the collision model's min.z to its
front-left suspension line end: wheel.z + suspensionLowerLimit − wheelSize / 2. CPlane explicitly requests that
setup in its automobile constructor. Plane GetWheelPosn accumulates parent transforms; helicopter dummies use
the local matrix. `CEntity::GetDistanceFromCentreOfMassToBaseOfModel` (iOS 0x100238c28, called by Give at
0x1001c6aa8) reads that adjusted minimum. The Baron's raw COL min.z is positive 0.00149, while its suspension
requires a base offset of about 0.407. Using only the raw COL bound stranded the plane across the thin roof
surface, with contacts on both sides. `nativeAircraftBase.ts` now supplies the adjusted height for script aircraft
creation, remote grounding and SET_CAR_COORDINATES. The mission handoff check now requires actual ground
clearance and native rooftop height, as well as movement. Aircraft meshes also use the existing native vehicle
filter that excludes triangle-versus-triangle solver response; wheels and hull spheres still meet world triangles.

The radar follows the remote target and retains DrawMap's on-foot range during remote mode, with script zoom
still applied. The camera switch constants were corrected to the native enum (NONE 0, INTERPOLATION 1, JUMPCUT 2).
Mode-specific camera movement remains the existing approximation.
