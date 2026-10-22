# Cached dead-body sight

CAN_CHAR_SEE_DEAD_CHAR (0480) now queries an on-foot observer's cached nearby-ped list. MANSIO2
uses its three original sites at SCM 2495410, 2495421 and 2509087 to detect bodies. The command
previously returned the skipped-condition result, false. It remains authored/partial.

## Native contract

The pinned iOS handler `0x1001e23cc`, tail `0x1001e2af0`, scans sixteen intelligence pointers,
tests IsAlive and calls CanPedTargetPed with direction checking. It ignores the second ped-type
argument. IsAlive (`0x10032911c`) tests DIE/DEAD states, independently of health.
CanPedTargetPed (`0x1003483e0`) raises the target origin by 0.75, or lowers it by 0.25 while
ducking. CanPedTargetPoint (`0x1003482fc`) rejects a negative forward dot and squared 3D
distance greater than 1600, then checks a line from observer origin +0.75. Buildings and
objects block it; vehicles, peds and dummies do not. Native camera-ignore checking is enabled.
See [the original observations](DEAD_BODY_SIGHT_RESEARCH.md) for reference identities.

Reversed PC CEntityScanner (`0x5FFA20`) retains the nearest sixteen candidates within a strict
3D sense sphere. It uses max(hearing, seeing); defaults are fifteen, or forty for gang types.
CPedScanner (`0x5FFEF0`) ticks only for a living observer. CTickCounter's period sixteen means
the first call refreshes, then every seventeenth call. An NPC's fresh scan excludes DEAD peds
but can include dying ones. A cached reference can become dead or move away before refresh;
deletion clears its slot. Players may scan fully dead bodies too.

## Browser integration and limits

Each on-foot ped and CJ now has a cached scan, advanced by the existing thirty-Hz AI cadence.
SET_SENSE_RANGE applies to the observer's next refresh. Queries inspect current death/position
information through the retained references and never refresh the list themselves. Range and
direction arithmetic use float32 native-axis ordering. The query uses the existing world line
filter for buildings and objects. All three native ped-type operands behave identically.

The browser maps zero health to dying and latches fully dead when the actual death animation
finishes, or corpse-hit readiness is established. It clears the latch on revival. Medical
removal-clock resets and restarted FLOOR_HIT reactions do not make a settled corpse dying
again. This is a browser task-phase model: native CTaskSimpleDie's physical-support/death-event
conditions, complete PEDSTATE transitions, vehicle occupants, sector traversal/tie order,
tilted observer matrices and camera-ignore material flags remain incomplete. Existing AI
consumers have not all migrated to this scanner. A vehicle-occupant observer fails explicitly.
Full MANSIO2 completion and complete PC/iOS scan parity remain unverified.

## Checks

Six unit checks cover nearest-sixteen selection, stable ties, strict 3D boundaries, refresh
timing, dead-observer behavior, NPC/player corpse differences, deleted references, target-point
geometry and death-phase retention through animation restarts and revival.

The browser executes all three original MANSIO2 instructions, including the NOT bit, against
real scripted peds. Living targets are rejected; a paused dying target is seen from the cached
list. A real fixed physics wall and turning the observer away block sight. Completing the
death association drops the body on refresh; a subsequent FLOOR_HIT does not reintroduce it.
No commands are skipped and no script failures or page errors occur in that focused run.
