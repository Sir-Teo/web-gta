# Diving from a vehicle attachment

TASK_DIVE_FROM_ATTACHMENT_AND_GET_UP (06A5) now runs for scripted NPCs attached to vehicles and
for NPCs on foot. CASINO1 (mission 84, Fender Ketchup) calls it for local 324 with a ten-second
pause at SCM 2089844. It records through the ordinary task/sequence path, including character -1.
Player, object-attachment and seated cases remain unsupported; the command is classified authored.

## Native evidence

The executable identity is documented in [AIRCRAFT_WEAPONS.md](AIRCRAFT_WEAPONS.md#source-observations).
The 1700 command switch uses the signed-relative table at `0x1001f3138`. Handler `0x1001f0c84`
collects two operands and constructs the base evasive-dive task at `0x1003ec060` with null evade
vehicle, the supplied time, zero direction and achieve-heading-first true, then replaces its vtable
with `0x1005bcae0` and gives it as command 06A5.

The subclass next-task method (`0x1003f0574`) calls DettachPedFromEntity only after task type
0x386 (AchieveHeading) finishes. Its first-task method (`0x1003f05bc`) uses the attached entity's
hit side and full forward/left/back/right axes. A front/back direction with a positive dot against
vehicle move speed switches to the nearer lateral bounding plane; ties select the right side.
Without an attachment it uses the ped's own forward direction. The attached turret-angle limit
is widened before the heading task. These phases match the pinned reversed class at PC
`0x6577F0`/`0x657820`, revision `4281f82d8af83e14935ac84a69dfd1ceebb9f256`.

Geometry is traced through ComputeEntityDirs (`0x100345144`), ComputeEntityHitSide
(`0x1003451dc`), bounding-footprint corners (`0x10034541c`) and bounding planes
(`0x100345a78`). Vehicle bounds expand by 0.35. The largest horizontally projected box axis
sets the rectangle's direction, with the other axes expanding it; the diagonal-sector scan
determines the side. The port retains these operations and float32 intermediate arithmetic,
including the projected axes of tilted vehicles. Tall-object collision slicing and procedural
interior geometry branches are outside the supported vehicle path.

## Integration and limits

The mission runner owns the task through attached turning, the asynchronous on-foot rebuild,
and the existing evasive-dive/pause/get-up task. Turning uses the model's pedstats rate multiplied
by 2.0. The attached pose follows the requested heading, with the idle move animation. Only when
the heading finishes does it detach at the attached world origin, converting to feet for the
walker. Sequence progress and scripted task status remain associated during the rebuild.
Replacing or clearing the task before detachment cannot detach the former rider later.

Attached coordinate/heading queries now include the actual offset and relative facing. Plain
DETACH_CHAR_FROM_CAR also preserves that origin and heading during the rebuild and ignores a
ped that is not attached. Rendering, normal task-event arbitration, saved-weapon restoration,
the full native attachment/turret system and general asynchronous entity identity remain partial.
The dive inherits the [existing animation integration limits](SCRIPT_DIVE_MOTION.md).
These changes do not establish full CASINO1 completion or native attachment parity.

Eight new unit checks cover padded/tilted footprints, native side and velocity selection,
the original CASINO1 instruction, turn-before-detach, exact rebuild placement, task status,
sequence recording/cancellation, the on-foot direction and plain detachment. The live browser
check executes the original instruction against a real attached NPC, verifies its transformed
offset and initial heading, observes travel along the chosen direction, retains the ten-second
lie and reaches finished task status after the quarter-turn/get-up. Full mission completion
remains unverified.
