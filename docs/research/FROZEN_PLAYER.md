# Frozen player physical motion

FREEZE_CHAR_POSITION now holds the player's physical position, including gravity, pending
movement, impulses and animation root motion. Previously the host only suppressed player
input. This caused the original pool mission to lose its table and opponent during aiming.

## Source and failure

The pinned gta-reversed source described in [POOL_BALLS.md](POOL_BALLS.md) implements
FreezeCharPosition (04D7) by writing CPhysical::bDontApplySpeed. ApplyMoveSpeed resets linear
speed while that flag is set; ApplyTurnSpeed (542E20) resets angular speed. Explicit script
placement still writes the entity's position. Freezing does not stop the world clock or
other physical bodies.

POOL2 moves its current shooter down ten units at 374926–374950, then freezes that ped at
374964. This hides CJ while the overhead aiming view is active. The browser's former
input-only flag left gravity running: CJ fell over eighty units away, object-brain lifetime
management released the table and opponent, and POOL2's missing-table check at 390174
sent it into cleanup. There was no VM error. This was reproduced through the real Ganton
BAR2 entrance and POOL_SCRIPT brain, without launching POOL2 directly.

## Host behavior and checks

Simulation owns playerFrozen. Its on-foot physical step holds the current body position,
cancels a queued kinematic target and clears linear movement, vertical speed, jump momentum
and contact pushes/shifts. The clock, world physics and existing death/task clocks continue.
The main script adapter writes that flag; ordinary input suppression reads the same flag.
Script teleports still work while held, and clearing the flag resumes normal motion.

Two unit checks cover gravity, input, animation motion, stored impulses, queued motion,
solid capsule contact, continued world/clock updates, explicit placement and release. One
executes POOL2's original freeze instruction with the player in local 215.

The browser enters the native Ganton bar portal, lets its map-object brain create an opponent,
steps beside that opponent and presses F. POOL2 creates sixteen balls, offers its wager and
deducts $50 from a supplied $500 balance. Shift proceeds to aiming, which now holds CJ's
hidden pose for over five seconds while the table and healthy opponent remain present.
Shift enters the shooting view, which explicitly places CJ by the cue while retaining the
native freeze. F returns to aiming, then quits and releases the freeze with CJ back above
the floor. The stake remains committed: original instruction 371157 clears the refundable
amount on Proceed, so the final balance is $450. The two single-player SET_SCRIPT_COOP_GAME
sites are still reported skipped.

This fixes the on-foot physical controller. It does not implement native physical collision
scheduling, every task's direct position writes, multiplayer pool, a complete pool match or
new behavior for a ped seated in or attached to a vehicle. Those paths retain their existing
controllers. The command's static census classification is unchanged.

The following [mouse-stroke work](SCRIPT_MOUSE_MOVEMENT.md) also corrected the host's
frozen-input branch to advance PlayerScriptTasks. Holding physical motion must not strand
the cue-start/shot animation sequence. A responding NPC shot is now covered after the
mouse and segment-intersection fixes. The later [complete-match regression](POOL_MATCH.md)
also verifies that normal quit releases the physical hold after a result and rematch offer.

All 3,636 unit tests pass (51 skipped), and the build passes. Both the normal bar-entry
regression and the focused real-table contact/pocket regression pass. Historical mission
sweep outcomes are preserved.
