# Scripted pedestrian death across body rebuilds

A dead scripted pedestrian now stays dead when the browser rebuilds its body into or out of a
vehicle or attachment. Scripted rider death also keeps the pedestrian allocated: killing and
deleting are separate operations. CASINO1's original TASK_DIE / DETACH_CHAR_FROM_CAR pair at
SCM 2089642 / 2089647 now leaves a visible, dead body rather than a healthy replacement.

## Native contract

CPed is the same allocated entity when it gets into, attaches to or detaches from a vehicle.
Those transitions do not create a new healthy CPed. The reversed DettachPedFromEntity
(`0x5E7EC0`, Ped.cpp) and the iOS function at `0x10032c8e0` clear the attachment and branch on
the existing dying/dead state; they do not restore health. The iOS dead branch returns without
the living-ped idle/weapon restoration. CTaskSimpleDie::StartAnim sets health zero and death
time. The reference revision is `4281f82d8af83e14935ac84a69dfd1ceebb9f256`.

## Fix and limits

ScmPedPool previously copied live health only when positive and only applied it to a new body
while its cached killed flag was false. A world-killed rider could therefore become healthy,
and even an explicitly killed ped could retain its replacement body's default health. The
pool now snapshots health and dead-cache state together and applies zero to a dead replacement.
Pending queries also remain dead. A real world revival updates the cache on the next rebuild.

The world host no longer removes a scripted rider when killing it. Seated corpses use the existing
dead-seat poses; attached scripted die tasks use a held death clip. Clip loading is guarded against
removal/replacement. The body rebuild restores a low collider and the existing standard front
death pose without another damage event, preserving the carried scorched flag.

Native PEDSTATE/task/event scheduling, every prior death animation/association, attachment dying
forces, saved-weapon handling and complete corpse-state persistence remain incomplete. The rebuilt
walker currently uses KO_SHOT_FRONT rather than transferring every possible death pose. Health-based
pool bookkeeping does not establish full native dying/dead-state parity.

Six added unit checks cover world-killed and script-killed rebuilds, pending dead queries, real
revival, retained rider allocation, held/stale/missing death clips and corpse pose/collider restoration.
The browser executes CASINO1's original die-and-detach pair, verifies a seated scripted death stays
allocated, and transfers an actual vehicle-explosion corpse onto the street with zero health,
scorched uniforms and a visible held pose. Full CASINO1 completion remains unverified.
