# Scripted evasive dive movement

TASK_DIVE_AND_GET_UP (0645) now moves CJ through EV_DIVE's extracted root curve. Script NPCs use
the same curve instead of a constant distance spread across the clip. The player turns before
starting the dive and rotates a quarter turn after the pause, before the get-up collision check.

## Source and asset evidence

In gta-reversed revision `4281f82d8af83e14935ac84a69dfd1ceebb9f256`,
CTaskComplexEvasiveDiveAndGetUp::CreateSubTask (`0x653820`) starts AchieveHeading with multiplier
2.0, then EvasiveDive, Pause with the supplied milliseconds, and GetUp. CreateNextSubTask
(`0x656000`) subtracts pi/2 from current and aiming rotation when the pause ends, before GetUp.
CTaskSimpleEvasiveDive::StartAnim (`0x655F20`) blends EV_DIVE at 8 and ends on its animation callback.
AchieveHeading's default tolerance is 0.2 radians.

Published ped.ifp SHA-256 is `f7483f49080a0f833dc73ef09aa2224f99a9e90757fa5c2b7db5505cbef33eac`.
EV_DIVE lasts approximately 2.333333 seconds. Its translated Root track runs from
`(0.09765625, 0.0205078125, -0.234375)` to
`(-0.0048828125, 6.7607421875, -0.9375)`: horizontal change is
`(-0.1025390625, 6.740234375)`. By one second it has already moved 4.263671875 along native Y;
the remaining third of a second has no horizontal movement. Constant-speed travel misses this timing.

## Integration and limits

The existing reaction binding extracts X/Y and retains vertical root motion in the pose. Its moving
shift is transformed using the same ped basis as other root-driven reactions. NPCs feed the frame's
shift to their character controller. The player has an explicit reaction shift, which remains active
while the knockdown suppresses the pad and walking animation. Both paths retain collision handling;
death rejects motion, and invalid values cannot advance the simulation.

The player task keeps sequence ownership while it loads, turns, dives and recovers. Replacement
invalidates an outstanding animation load. After its pause, the player's existing get-up path tests
for a car over him with the quarter turn already applied. Teleports and a different fall clear the
dive state. Ordinary falls and hits do not acquire root movement from this path.

Native association blending, changes to reaction speed/current time while the dive runs, general
task abort/event arbitration and separate aiming-rotation state remain incomplete. The player still
uses the existing knockdown clock for dive/pause/get-up timing; this is not full native task parity.
Vehicle-attached NPC dives now have a separate [turn/detach runner](ATTACHED_DIVE.md); player and
object-attachment cases remain unsupported. EV_STEP retains its existing distance-based response.

Four added units cover the installed clip's nonlinear motion and lateral shift, capsule collision,
pad suppression, death/invalid motion, turn-before-dive sequence ownership and stale loading. The live
script-dive browser check verifies both NPC and player travel, the player's final quarter-turn heading
and completed task status. The evasive and under-car get-up regressions exercise the shared paths.
