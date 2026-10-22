# Scripted ATM animation

`TASK_USE_ATM` (05C7) now uses the normal scripted-task/sequence path. HEIST2 (mission 98) records
it at SCM 2337284 with character -1, between a gesture and another scratch-head task in a repeating
seven-task sequence. Previously it tried an absent direct host command instead of recording a task.

The pinned executable is identified in [AIRCRAFT_WEAPONS.md](AIRCRAFT_WEAPONS.md#source-observations).
Handler `0x1001e7160` allocates 0x30 bytes and calls the RunAnim constructor (`0x1003a72a4`) with
group 0, animation 151 (ATM), blend delta 4, task type 0x1a4 and hold-last false. It replaces the
vtable with CTaskSimpleUseAtm's and gives the scripted task under opcode 05C7 at `0x1001e71b4`.
The pinned reversed constructor is `TaskSimpleUseAtm.cpp` / PC `0x48DFE0`; its RunAnim base starts
the association and finishes via the animation callback (`TaskSimpleRunAnim.cpp`, PC `0x61BAC0`).
The command does not navigate to an ATM or grant money. Attractor use and payment are separate behaviors.

The adapter records a dedicated task kind, then maps it to one PED/ATM clip through the existing player
and NPC animation runners. It does not loop, hold the last frame or impose an arbitrary timeout. The
command remains **authored**: the shared runner's blending, association management and task/event
interruptibility retain their existing limits; no general native animation/task manager is added here.

Three unit checks execute the original -1 instruction, verify the player/NPC animation mapping and
record HEIST2's entire original seven-task block, including its repeat flag. The browser records the
original instruction, runs it in live player and NPC sequences, observes both ATM clips and associated
task status, then waits for both sequences to finish and verifies unchanged money. Full HEIST2
completion remains unverified.
