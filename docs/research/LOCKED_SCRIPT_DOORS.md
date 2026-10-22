# Script door locks and hinge physics

LOCK_DOOR (0905) now reaches live script objects. Their OBJECT.DAT special response selects
swing doors (6) or initially locked, self-latching doors (7). This supplies the gameplay path
used by GF_DATE and HEIST1, with an authored Rapier physics adapter.

## Native evidence

References are pinned as recorded in [BUILDING_MODEL_SWAPS.md](BUILDING_MODEL_SWAPS.md).
The inspected iOS 2300-command table dispatches 2309 at `0x100201c64`, collecting an object
handle and boolean. The true tail calls `CObject::LockDoor` at `0x1002d8000`: physical flags
at +0x64 gain mask 0xC (disable collision force/collidable), door-open clears, and
`ResetDoorAngle` at `0x1002d9f14` runs. The false tail at `0x10020297c` clears mask 0xC,
zeros the three angular-speed words and calls virtual SetIsStatic(true). Neither path removes
the object's collision. Disassemblies are retained as `artifacts/native-{lock-door-handler,
lock-door-method,unlock-door-tail,reset-door-angle}.asm`.

Reversed PC `CObjectData::SetObjectData` initializes responses 6/7 with disabled move force.
Response 7 additionally disables collision force, starts closed and sets door-moving (the
self-latch policy). `CObject::SetIsStatic` (5A0760) records the start heading when a door first
becomes movable; its initial sentinel is −1001. `ResetDoorAngle` (59F4B0) requires a valid
start angle, resets heading, makes the object static and clears linear/angular/friction speed.
`LockDoor` (59F5C0) clears door-open and invokes that reset.

`CObject::ProcessControl` unwraps heading around the start angle, marks open past 30 degrees,
clamps the spring difference to ±0.3 radians and adds TimeStep × 0.002 × difference while
angular speed points away or is below the signed 0.02 cutoff. Within 0.01 radians, a moving
lock door (or sufficiently slow swing door) settles. A previously opened moving lock door
then locks. `CPhysical::ApplySpeed` (547B80) limits travel to ±108 degrees with a −0.2 rebound
and stops a moving lock door's angular velocity when it crosses the closed angle.

## Original script use

MAIN 140655–141028 creates seven persistent girlfriend doors, with models GEN_DOOREXT03,
GEN_DOORSHOP02, GEN_DOOREXT04, GEN_DOORSHOP3, GEN_DOOREXT07, GEN_DOOREXT03 and CUNTGIRLDOOR.
All seven locked PC definitions have mass/turn mass 5 and air resistance 0.98. GF_DATE uses
array base byte offset 4968, indexed by the global integer at byte offset 1556: 4219 unlocks
and 4476 locks. These are explicitly created script objects, rather than adopted map placements.

HEIST1 creates GEN_DOORINT01 at 2281943, sets rotation to 90 degrees and locks at 2281986.
Its response is 6. Because it has not moved and has no start angle, locking preserves that
rotation rather than snapping it to zero.

## Browser implementation and limits

ScmObjects keeps door-open, moving, locked and initial-angle state and performs explicit
lock/unlock resets. ScriptObjectViews gives unlocked doors dynamic, initially sleeping bodies
that collision can wake, fixes their translation at the model origin and permits rotation
about the vertical axis. It applies the inspected spring/latch thresholds and travel stops;
locking restores a kinematic solid body at the recorded heading. Full angle wrapping is kept
for doors whose home heading is near ±π.

This adapter is **authored/partial**. Rapier integrates contacts before the correction to a
travel stop, while native physics splits its time step at the impact. Native collision-force
scheduling, friction accumulators, end-stop flags/audio, every force/proof interaction and
unadopted world doors are not reproduced by this change. Ordinary non-hinge objects use the
host's existing kinematic/dynamic representation. The lock command does not imply that a
full GF_DATE or HEIST1 run completes.

## Validation

Five unit checks cover collision waking a real Rapier hinge, retained translation/solid
collision, explicit pose reset, self-latching versus swing behavior, the 108-degree rebound,
wrapped headings, both actual GF_DATE array instructions on all seven models and HEIST1's
original create/rotate/lock instruction sequence.

A browser regression loads the actual GEN_DOOREXT03 asset and COL, executes GF_DATE's
original unlock instruction, verifies a sleeping dynamic hinge, turns it with a physics torque,
then executes the original lock instruction and verifies its restored pose and solid ray
intersection. It reports no skipped commands, script failures or page errors.

All 3,536 unit tests pass (51 skipped), and the build passes. The census records 39 authored
and eight skipped commands; the historical mission sweep is preserved.

## Door movement audio

The hinge's nonzero closing displacement now calls the shared native door audio entity when
its door-moving flag is set, matching `CObject::ProcessControl` →
`CAudioEngine::ReportDoorMovement` (506F50). Swing doors with that flag clear do not report.
The existing `CAEDoorAudioEntity::AddAudioEvent` (4DC9F0) supplies sample 1 from DOORS bank 51
in slot 31, at the native door position, default event volume and rolloff 2. All entry doors
share one entity: a voice already playing or a clock at/below the last report + 4000 ms
suppresses a new voice. A missing bank requests its slot and still advances that report clock.

Two audio checks exercise the strict boundary, playing-voice suppression, native sample/position,
reset and unavailable-bank interval. The browser door regression also observes a native voice
allocation after the original unlock command and actual hinge movement. Diagnostics expose
`audio.native.entryDoors.started`. This validates playback scheduling and allocation, without
asserting subjective audio quality or complete native sound mixing.

After audio integration, all 3,538 unit tests pass (51 skipped), and the build passes.
