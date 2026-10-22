# Complex object pickup research

October 22, 2026. These are the native observations behind the partial on-foot NPC
implementation of TASK_COMPLEX_PICKUP_OBJECT (07C9). Its integration and limits are recorded
in [COMPLEX_OBJECT_PICKUP.md](COMPLEX_OBJECT_PICKUP.md).

## Script sites and dispatch

DESERT9 (mission 80) uses SCM 1987144 with ped -1 and object local 52 inside an open
sequence. The sequence then walks to 360.2195,2500.023,15.4921 and is assigned to ped local 45.
CASINO2 (mission 85) uses SCM 2104683 and 2109688 with ped local 224 and object local 228.
Sequence capture therefore matters even though the command is currently a direct missing-host call.

Pinned iOS opcode-1900 table `0x1001fa150` dispatches 07C9 to `0x1001f947c`. Its tail
`0x1001f9b50` constructs a 0x48-byte task at `0x10043149c`, passing the object and animation
group 81 (CARRY), then AssignTask with command 07C9. The task's vtable is `0x1005bf870`;
GetTaskType at `0x100433370` returns 310 (TASK_COMPLEX_GO_PICKUP_ENTITY).

## Approach, turn and lift

CreateFirstSubTask (`0x100431604`) requires an entity and records the current game timer.
It reads the model COL box. The hold offset is (-0.2, -0.2 - minY, -minZ). Elongated boxes
can turn toward the ped (maxX > 2*maxY), or perpendicular to that heading (maxY > 2*maxX).
Otherwise a matrix whose up.z is below 0.9 is made upright. Object linear/angular speeds are
cleared and an object is set static. Its current RW frame is synchronized before target calculation.

The relative ped position is projected onto the object's right/forward axes. Whichever box
side faces that point supplies a local approach coordinate: maxX+0.4, minX-0.4, maxY+0.4 or
minY-0.4, with the other horizontal coordinate zero and local Z minZ+1. The object matrix
transforms it to the world. The first subtask is a walk (move state 4), radius 0.2, through
the constructor at `0x1004035e4`.

CreateNextSubTask (`0x100431994`) turns to face the object after the go-to finishes. After
the turn, the CARRY default is adjusted by object bottom (origin Z + COL minZ) against ped
origin Z: below the bottom selects CARRY105 with pickup time 0.2; below bottom+0.55 selects
CARRY05 with time 0.26666668; otherwise CARRY uses time 0.6. These are absolute animation
times, not normalized progress. The simple pickup uses node 6 (right hand/bone tag 24),
flags 1 and LIFTUP (317). Finishing it creates a secondary HOLD_ENTITY with CRRY_PRTIAL
(318), unless that secondary slot already has a task.

ControlSubTask (`0x100431bf8`) streams and references the animation block. Go-to timeout is
5000 ms (data `0x100653378`); the no-association pickup timeout is 8000 ms (`0x10065337c`).
There are additional player vehicle/input cancellation checks. Full callbacks, association
lifetime, physical flags, object deletion and abort/drop ownership must be checked during integration.

## Available data

The published GTA3.IMG directory already contains carry.ifp: offset 923400192, length 24576,
chunk 1912 at expanded offset 159744. The chunk SHA-256 is
`359079d8f35f22ecbabd48358dcfefcdda400117ff50ab7169ca4a4d5b838946`.
Its clips include liftup (1.5333333 s), liftup05 (0.6333333 s), liftup105 (0.6666667 s),
crry_prtial (one-frame upper-body pose), and the three put-down clips. Existing native
animation loading and carry-pose drawing can use them without publishing another asset.

The executable and reversed-PC source identities are recorded in [BUILDING_MODEL_SWAPS.md](BUILDING_MODEL_SWAPS.md).
Ignored disassemblies are under artifacts/native-go-pickup-{first,next,control}.asm.
