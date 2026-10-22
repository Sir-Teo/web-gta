# Frozen vehicle collision

The browser previously disabled a frozen vehicle's entire Rapier body. Cars, bikes, boats and
aircraft therefore disappeared from collision and bullet queries while their models remained
visible. This was exposed while checking gunfire from an attached player: even an explicitly
targetable carrier could not intercept the shot because its body was absent.

The motion hold now retains nearby loaded collision. A shared body constraint records the prior
physics mode, holds the current pose with a position-driven kinematic body, cancels queued movement
and restores the prior mode on release. The constraint itself leaves independent body/collider enable flags untouched;
each vehicle's existing range and terrain-readiness logic still controls body residency. Explicit
script teleports can move the held pose. Repeated freezes do not overwrite the original mode.

An attachment can take ownership of the same kinematic mode while frozen; the main host leaves
that mode in place on release. Playback or another controller taking a different body mode is
preserved, including a controller change followed by another frozen physics step. Each vehicle
class holds its physics update while retaining its collision body.

## Native evidence and scope

The pinned iOS opcode-1301 table is `0x1001e5c58`. FREEZE_CAR_POSITION (0519) enters at
`0x1001e4d08`, with its live-vehicle tail at `0x1001e57c4`. A true operand sets physical
flags with mask `0x200c`, calls the routine at `0x1002499cc` and clears the six linear/angular
speed words at +0x68..+0x7c. A false operand clears the corresponding mask at `0x1001e5bb4`.
FREEZE_CAR_POSITION_AND_DONT_LOAD_COLLISION (0574) enters at `0x1001e4c0c`; its tail at
`0x1001e57a0` sets `0x2004`, with a different clear path at `0x1001e5b2c`.

The reversed PC CPhysical::ApplyMoveSpeed and ApplyTurnSpeed reset motion under their relevant
physical flags. CPhysical::SkipPhysics clears contact/safe-position/postponement/wall state and
friction data without removing the entity's collision. The iOS routine has an additional entity
flag clear in its `~0x1069` mask relative to the reversed PC skip routine; its exact collision
timing and the complete command-specific flag lifetimes are not established here.

Consequently **both freeze adapters are authored/partial**, replacing their earlier blanket
fidelity classification. The Rapier body constraint is not a complete CPhysical flag model.
The separate collision-loading switch of 0574, complete frozen engine/component behavior, native
contact/force scheduling, every attachment/playback interaction and tiny solver-derived
velocity differences remain incomplete or unverified. This change establishes the browser's
motion hold and retained collision; it does not establish complete PC or iOS freeze parity.
Reference identities are recorded in [BUILDING_MODEL_SWAPS.md](BUILDING_MODEL_SWAPS.md).

## Checks

Five unit checks use real Rapier bodies to verify held poses under gravity, solid ray/physical
contacts, release to dynamic motion, repeated toggles, playback/attachment ownership, independent
collision disabling and explicit teleports. The browser executes SYN1's original 0519 instruction
at SCM 1551265 (local 386, true) against a car, bike, boat and helicopter. Their collisions remain
queryable and their poses remain held; unfreezing restores dynamic physics and the original
forward-speed command moves all four. Full SYN1 completion remains unverified.
The release fixture explicitly clears the boat's independent anchor before
applying forward speed. Without that step the hull correctly becomes dynamic
but its constructor's anchor cancels horizontal movement. Per-model held and
released states are recorded in `artifacts/frozen-vehicle.json`; the original
movement threshold remains unchanged.

A separate 120-second player-only probe of each DECON and SYN6 opening after this change
reported no skipped commands, script failures or page errors. DECON reached its construction
objective (27.4% instruction-offset coverage); SYN6 completed its phone sequence and reached
the travel objective (17.2%). Neither mission completed. The saved result is
`artifacts/port/frozen-vehicle-mission-openings-oct22.json`; the historical sweep was restored.

## Burning frozen boats

CBoat::ProcessControl (`0x6F0F50` in the pinned PC source, Boat.cpp) runs its health/fire timer
before CPhysical::ProcessControl. The physical motion flags do not bypass that timer. Below 250
health, while both horizontal camera-axis distances are strictly under 200, it accumulates
`TimeStep * 20` milliseconds and explodes strictly after 5000 ms. Above 460 health or after
wrecking, the fire state clears; intermediate health holds the accumulated timer.

The browser now calls its existing boat fire update while frozen. Previously, the early motion
return also prevented a burning held hull from ever exploding. Two real-Rapier checks cover the
strict deadline, held collision/pose, health reset/hold and range gate. A live Speeder burns through
to an explosion while held, and the four-class freeze/release browser regression passes. The full
suite passes 3,489 tests (51 skipped), and the build passes. Remaining freeze limits above apply.

## Helicopter rotors during a motion hold

The iOS CHeli vtable at `0x1005c0868` resolves ProcessControl to `0x10046471c`. It calls
CAutomobile::ProcessControl at `0x100442708`; that routine dispatches ProcessFlyingCarStuff through
virtual offset `0x228` at `0x100443af8..0x100443b04` (with an earlier RC Baron-specific call).
The ordinary physics-skip branch at `0x100442f70` comes from vehicle status/idle processing,
not a blanket return for the script freeze mask. The reversed PC automobile update supplies
the matching control structure, including the running-rotor helicopter exception to idle skipping.

CHeli::ProcessFlyingCarStuff at `0x100465884` updates `m_fHeliRotorSpeed` at +0xa68 before
the flight-force gates. `0x1004658dc..0x100465978` contains the engine/status-dependent spin-down
and spin-up branches: 0.00055 times TimeStep down, 0.001 per frame up (0.003 for models 465/501),
with the 0.22 threshold. The physical freeze mask is not a rotor-clock gate. Disassembly extracts
are saved as `artifacts/native-heli-control.asm`, `native-automobile-control.asm` and
`native-heli-rotor.asm`.

The browser now advances its existing rotor state and visible blade angle while holding the
body. Flight forces and steering remain behind the motion return. This preserves the browser's
existing engine/AI approximation, 30-fps frame conversion and authored blade-angle rate; it does
not establish complete native engine/status, prerender, water or playback/freeze parity.

Three added unit checks cover normal/RC rates, stopped/submerged wind-down, AI speed and a solid
held hull. The browser loads the native Maverick and checks its actual rotor-frame matrices:
they turn during spin-up, stop after wind-down, and leave the body pose/collision intact. SYN1's
four-class freeze/release check and DRUGS4's recorded helicopter regression pass. All 3,492 unit
tests pass (51 skipped), and the build passes. No mission completion or census status changes.

All seven rotorcraft flight regressions also pass. Two stale fixtures were corrected without
changing their flight/weapon assertions: free flight now ends INTRO before selecting a hangar
aircraft (the pre-change failure screenshot showed its airport cutscene still running), and the
Hydra gun check advances 20 ms before its first shot to satisfy the strict 17 ms native gun timer.
The takeoff failure was reproduced with the pre-change rotor path before correcting the fixture.
