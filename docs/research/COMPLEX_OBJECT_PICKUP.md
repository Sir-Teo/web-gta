# Complex NPC object pickup

TASK_COMPLEX_PICKUP_OBJECT (07C9) now captures sequence entries and runs an on-foot NPC
through approach, turn, lift and carry. It previously skipped all three sites in DESERT9
and CASINO2. The command remains authored/partial.

## Native behavior used

The task walks to the facing side of the object's COL box, 0.4 units outside it, at a
0.2-unit target radius. It orients elongated or tipped boxes as the native constructor does,
zeros object motion and makes it static. It then faces the object and chooses CARRY,
CARRY05 or CARRY105 from object-bottom height against the ped's current origin.

The object loses collision when the lift starts. Its bone attachment begins at absolute
association times 0.6, 0.26666668 or 0.2 seconds, depending on the group, with node 6 (right
hand), flags 1 and the COL-derived offset. A paused or slowed clip keeps that timing; script
time edits advance the same association. The browser total-time host reports milliseconds,
which are converted to seconds here. Completing the lift transfers to a secondary
CRRY_PRTIAL pose, allowing the primary sequence to continue walking with the object.

[Native handler, task addresses, data identities and disassembly observations](COMPLEX_OBJECT_PICKUP_RESEARCH.md)
record the contract. The existing packaged carry.ifp supplies all clips. Shared COL loads
now publish bounds regardless of their first consumer, so asynchronous dimensions do not
leave pickup waiting forever. A pending bounds query holds the NPC until it resolves.

## Ownership and limits

A new primary task cancels an unfinished lift and restores/drops its object. The secondary
carry survives a new primary task after completion. Explicit dropping, object deletion or
holder death clears the carry pose. The approach has the native five-second timeout;
missing animation associations have the native eight-second timeout. Sequence progress
advances only after the lift finishes, and task records use the existing runner lifecycle.

Player and vehicle-occupant forms fail explicitly. Full CTask/animation reference ownership,
blend/abort priorities, already-occupied secondary slots, native physical flags and object
deletion semantics remain incomplete. Before the hand attachment, the browser holds the
collision-disabled object static rather than modelling bAttachedToEntity's full physics.
Native pickup-time root-motion correction, animated RW-frame synchronization, all scaled/
tilted COL cases and every interaction with other partial animations remain unverified.
Full DESERT9/CASINO2 completion is not established by focused checks.

## Checks

Four plan checks cover facing-side/tie selection, world transforms, tipped/elongated boxes,
COL-derived offsets and all height/timing thresholds. Four integration checks execute the
original DESERT9 sequence and both CASINO2 direct sites, test the millisecond/second boundary,
verify cancellation before and after attachment, bounds waiting, approach timeout, explicit
player rejection, secondary carry survival, deletion and holder death.

The browser executes CASINO2's original instruction against a real NPC and native cardboard
box. It verifies actual approach movement, pauses the real lift association before attachment,
advances it to attach and complete, checks the right-hand hold and carry pose, walks with
the box and drops it. No commands are skipped and no script failures or page errors occur.
The existing player stealable-crate browser regression also passes.

Separate 120-second player-only mission probes report no skipped commands, script failures
or page errors. DESERT9 remains in its opening WAIT loop at relative 376; CASINO2 reaches
its objective loop at relative 8542 (88.2% instruction-offset coverage). Neither completes,
and those openings do not establish pickup-section success. Results are saved separately in
`artifacts/port/complex-object-pickup-mission-openings-oct22.json`; the historical sweep is restored.

The general script-object attachment regression also passes. Its old vertical-only assertion
assumed the car stayed upright; it now checks the full local-to-world offset at a synchronized
pose, with a 0.001-unit error bound.
