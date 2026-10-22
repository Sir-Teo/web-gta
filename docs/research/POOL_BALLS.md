# Pool table coordinates and ball physics

SET_POOL_TABLE_COORDS (0830) now supplies live table bounds to pool balls selected by
OBJECT.DAT special collision response 9. The browser preserves staged cue velocities,
keeps rolling balls on their playing plane, allows ball contacts, rebounds from cushions
and enables gravity at pocket openings. This is an **authored/partial Rapier integration**.

## Native evidence

The reference checkout and executable are pinned as described in
[the building swap research](BUILDING_MODEL_SWAPS.md). The executable SHA-256 is
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.

The iOS 2000-command table at `0x1001fd234` dispatches opcode 2096 to `0x1001fb838`.
It collects six parameters, copies the first three to CWorld::SnookerTableMin at
`0x1007c4a1c` and the last three to SnookerTableMax at `0x1007c4a10`. It does not sort
the corners or adjust their height. POOL2 sorts X and Y itself before both original
instructions at 368265 and 390614. Their Z is table origin +0.7; balls start at +0.93.

Reversed PC CObjectData::SetObjectData gives response 9 bDisableZ and clears bApplyGravity.
All sixteen original ball definitions have mass 10, turn mass 0.003, air resistance 0.992
and elasticity 0.75. CObject::ProcessControl excludes bDisableZ from ordinary prop settling.
SpecialEntityPreCollisionStuff (59FEE0) disables contacts with other CPhysicals that lack
bDisableZ while a ball has gravity off. Other balls keep their bDisableZ even after pocketing.

The bDisableZ branch of ApplySpeed (PC 547B80; inspected iOS `0x100248828`) splits movement
at the first crossed X or Y boundary. Exact predicted-edge equality does not trigger an
impact, and an exact impact-time tie selects Y. The short sides have corner pockets; the
long sides also have a central pocket, each using strict/inclusive 0.06 cutoffs. A cushion
reverses the corresponding velocity. A pocket enables gravity and limits that axis's travel
to ±0.03 per original time step. Both paths request contact friction and mission audio event
1016, and write last-weapon damage 54 if previously 255, otherwise 50. A falling ball whose
next Z crosses Min.z stops there with linear and angular speeds cleared.

`scripts/research/native-pool-ball.py` runs this routine in Unicorn 2.1.4 and checks the
executable hash. Movement, splitting, pocket tests and velocity writes execute in the native
routine; ApplyTurnSpeed, contact friction and audio are intercepted. The 36 checked-in
captures in `tests/fixtures/native-pool-ball.json` include both orientations, cushion and
pocket boundaries, varying time steps, inward movement and falling/catch behavior.
`nativePoolBallStep` matches every captured position, velocity, gravity decision and friction
request exactly, including float32 rounding. This does not emulate complete native physics.

## Browser integration and limits

ScmObjects owns the raw table corners and each ball's gravity flag. SET_OBJECT_DYNAMIC
writes have a revision so the host can observe an explicit static command even if the
record already says static. A sleeping ball can retain a velocity written by the script
until activation. POOL2 explicitly stages this way at 382692–382713 and releases at
383310–383317. A zero-speed Rapier wake must not consume that stored shot.

ScriptObjectViews snapshots balls before each world step and applies the inspected boundary
decisions to Rapier's actual displacement afterward, preserving ball-to-ball contact response.
Static balls remain dynamic sleeping bodies that contact can wake. Rolling balls have gravity
off and vertical contact movement constrained; a pocket restores gravity and vertical movement.
Explicit vertical velocity can still move a rolling ball. Freezing or teleporting a pocketed
ball does not clear its gravity flag. Pool balls use CCD for fast contacts.

Solver groups exclude ordinary script objects and the existing vehicle/ped groups while
rolling, then restore those contacts while falling. Script object meshes retain their
car-mesh exclusion. Unadopted world CObjects, collider families without those groups and
native sector/collision ordering remain partial. Native contact friction accumulators,
cloth-induced spin and spin-Z damping are now reproduced for response-9 balls with zero
centre-of-mass offset. Rapier still supplies ball contacts, orientation integration and
OBJECT.DAT air damping; exact native collision substeps are not reproduced. A post-contact correction differs
from native physics splitting before its contact processing. Native audio event scheduling
uses the existing script audio adapter rather than the native object audio entity lifetime.

## Cloth and cushion friction

Native ApplyFriction(float, CColPoint&) at `0x100248fb4` obtains contact speed from
GetSpeed (`0x100248554`), including pending friction move/turn speed. It removes the normal
component, computes the tangential effective mass from mass, turn mass and the contact
lever arm, caps the impulse at the supplied friction strength and calls ApplyFrictionForce
(`0x1002497cc`). bDisableZ suppresses its vertical linear force while retaining torque.

The no-argument ApplyFriction (`0x1002494a8`; PC 5483D0) makes a contact at the model's
COL bound radius below its centre, supplies TimeStep × 0.001 friction and damps vertical-axis
turn speed by pow(0.98, TimeStep). It then adds and clears the accumulated linear/angular
friction. CPhysical::ProcessControl performs this before gravity/air resistance; a cushion's
impulse is accumulated during movement for the next control step.

`scripts/research/native-pool-friction.py` executes these routines and their speed, transform
and cross-product helpers in the same pinned executable. Only powf (host pow rounded to
float32) and surface-effect lookup (no sparks) are intercepted. Twenty-five checked-in
captures cover rest, sliding, rolling, topspin, backspin, vertical spin, pending cushion
impulses, both cushion orientations, different frame times, world heights and masses.
`nativePoolFriction` matches every captured velocity, angular speed and accumulator exactly.
The powf results are not an independent native libm validation.

The live host applies cloth friction before each step and carries cushion friction into
the following one. Sliding now rotates the ball; a glancing cushion contact transfers spin.
This retains the authored contact-order and Rapier integration limits above. Other special
physical flags, nonzero centre-of-mass offsets, full ball-to-ball native friction and live
updates of Rapier inertia are outside this friction port's scope.

## Validation

The normal bar/browser round now continues beyond the NPC's responding shot. It
observes fewer than sixteen live balls and original potted flags, waits for the
player's result prompt, acknowledges it, accepts the original legal cue-ball
placement after the opponent's foul, and reaches CJ's next aiming screen. CJ is
frozen near the retained table, with the opponent and committed stake intact and
no script/page errors. This verifies live pocket scoring and a complete turn
handoff. The later [complete-match regression](POOL_MATCH.md) covers a result,
rematch wager, refunded quit and release of player control.

Seven live Rapier/unit checks cover staged shots and zero-speed wakes, cushion rebound,
horizontal contact waking another ball, pocket gravity and the lower catch plane, freeze
state, ordinary-object collision filtering in both gravity states, both original table
instructions and all sixteen original ball definitions, visible rolling orientation and
delayed cushion spin. Sixty-one native movement/friction capture comparisons pass separately.

The browser loads the real k_pooltablesm, k_poolballcue and k_poolball8 models and COLs,
checks the cue ball contributes pixels, and executes original POOL2 instructions to stage
and release a shot. It verifies ball contact, rolling orientation, a cushion rebound and entry into a side pocket.
The original 389412–389686 detection loop then observes the ball below playing height minus
two radii, deletes it and increments the potted flag and count. The table COL can catch a
ball above the lower safety plane; the script scores it before that matters. The image is
retained as `artifacts/script-pool-table.png`.

This focused instruction flow does not establish a complete player/AI pool game, foul logic,
turn handling, betting, payouts or campaign completion. SET_SCRIPT_COOP_GAME remains skipped
at POOL2's three sites. The census classifies SET_POOL_TABLE_COORDS as authored.

The normal bar-entry investigation subsequently found and fixed the player's input-only
freeze, which let gravity unload the table during aiming. See
[the physical freeze and normal entry regression](FROZEN_PLAYER.md). Complete
single-player result/rematch/quit coverage is recorded in [POOL_MATCH.md](POOL_MATCH.md).

All 3,634 unit tests pass (51 skipped), and the build passes. The pool browser passes after
friction integration. Six browser checks passed immediately before it across pool, ordinary
object translation/spin, object/car collision sorting and door hinges. The
census records 1,342 faithful, 41 authored, seven skipped and no stopping commands; historical
mission sweep outcomes are preserved.
