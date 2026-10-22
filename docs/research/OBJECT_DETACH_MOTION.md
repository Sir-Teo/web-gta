# Script object detachment and motion

New Model Army's original magnet attached, carried and released its barrel, but
the released barrel stayed suspended. DETACH_OBJECT only cleared the attachment
record. It left the object static and discarded all four motion arguments. The
longer baseline records exactly the same Z, 1347.9373290538788, immediately after
drop and 1.5 seconds later: `artifacts/zero4-detach-fall-before.json`.

CPhysical::DettachEntityFromEntity activates an object at its current pose,
clears its attachment state, inherits physical-parent speed and adds a push.
The script's first two arguments are angles, not XYZ velocity: the handler
converts X by float32 pi/180 and Y by negative float32 pi/180. The third argument
scales the transformed forward vector in native per-frame move-speed units.
The final flag requests angular force, including the object's centre of mass.

ScmObjects now activates detached objects, increments their explicit motion
revision, clears the attachment flag and retains the ignored-parent reference.
ScmMission supplies the actual parent basis and velocity and preserves every
command argument. Parent objects/peds already carry native per-frame velocity;
vehicle host velocity is converted from units per second. The shared motion
kernel uses float32 matrix/vector and angular-force arithmetic. The existing
ScriptObjectViews dynamic-body path supplies gravity, contacts and settling.
Parent collision exclusion lasts until the existing bounding-range check lets
it go. It can register after delayed collision-asset completion.

## Captured scope

`scripts/research/native-object-detach.py` verifies SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78` and executes
CPhysical::DettachEntityFromEntity at `0x1002526a0` in Unicorn 2.1.4. Ninety-six
cases vary parent basis (identity, yaw, tilt), parent velocity, angles/push,
turn-force flag and centre of mass. The native matrix composition, ApplyTurnForce,
COM transform, cross product and attachment stores execute. World remove/add,
virtual SetIsStatic and sincosf are intercepted; sincosf returns float32 results
from the host math library. The static callback records false.

Each case compares the browser's resulting move and turn speed with the native
stores. Captures also record ignored-parent assignment, clearing of the attached
flag, pointer, offsets and quaternion, and remove/static/add call order. An
encoded DETACH_OBJECT regression verifies argument transport through ScmMission;
an unattached-object case retains the native handler's no-op guard.

Captures cover normal collision-force flags with an existing parent matrix.
The native disabled-collision-force/heavy-object recovery branch, special
physical flags and complete collision-ignore lifetime parity remain outside
this evidence. The host's default object COM is zero unless provided; native
wind-sensitive tree COM initialization is not established by this change.

## Live result

The corrected original ZERO4 magnet regression passes after the arena's scene
loading is fixed. Its barrel falls from about 1348.323 to 1344.423 and lands on
the native helipad ground at 1343.98858. Pickup, carried pose, original held-state
changes, real-button release and CJ's unchanged position are checked, with no
skipped commands, give-ups or page errors. The native script owns all object
and mission state; only its player-operated helicopter uses checkpoints.
See [the controlled mechanics result](ZERO4_VALIDATION.md).
