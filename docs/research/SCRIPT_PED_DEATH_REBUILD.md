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

## Direct on-foot script death (October 26, 2026)

Unnamed on-foot TASK_DIE previously called damageCollider with a synthetic
10,000-damage bullet. It spent armour, wrote a weapon-damage record, produced
a damage event and registered a nonplayer kill. High health, high armour or
zero damage weakness could leave the actor alive. Named deaths set health
directly but also called the nonplayer kill callback; missing named clips
fell back to the same synthetic bullet.

Both forms now use the direct health-zero/death-clip path. They preserve
armour and previous attacker/weapon records, reset the death/removal clock and
corpse-hit readiness, and hold the selected death pose. Missing named clips
use the default front death without a damage calculation. Removed, already
dead or disposed bodies are ignored before a late animation is installed.

PC CTaskSimpleDie::StartAnim (`0x637520`) sets health to zero and records the
current death time without consulting damage stats, armour or proofs.
CTaskComplexDie::CreateFirstSubTask (`0x6302D0`) sets the dying state and
selects the death task. CTaskSimpleDie::ProcessPed (`0x6397E0`) later sends
CEventDeath; ComputeDeathResponse (`0x4B9400`) creates CTaskSimpleDead.
Those task/death-event paths do not call the damage handler's RegisterKill.
CPed::SetPedState (`0x5E4500`) and ClearAll (`0x5E5320`) do not register one
either. The reference is the pinned gta-reversed revision listed above.
The host's kill callback credits STAT_PEOPLE_WASTED_BY_OTHERS (120), so
scripted task death must not invoke it as if a damage creator killed the ped.

Eleven initial integration cases expose ten failures before repair. A twelfth
case exposes the stale death/removal and corpse-hit clocks before their reset.
All 74 focused task, script, rider-death/rebuild and corpse-clock checks pass,
followed by the build. The live fixture submits TASK_DIE and
TASK_DIE_NAMED_ANIM through the real SCM adapter against proofed actors with
ordinary, large-health and large-armour fields. It checks preserved armour,
prior damage metadata, allocation, held pose, fresh clocks, absence of damage
events/kill callbacks and zero immediate nonplayer/vehicle kill-stat deltas.
The existing CASINO1 die/detach and vehicle-explosion rebuild fixture is a
separate regression.

Both live fixtures pass without page errors. The four direct on-foot cases
retain their prior armour, last weapon and attacker, report health zero through
the script pool, keep their death poses allocated and start fresh death clocks.
They invoke neither the damage entry nor a damage-event/kill callback, and
their immediate nonplayer/vehicle kill-stat deltas stay zero. The existing
CASINO1 die/detach, seated allocation and scorched explosion-transfer checks
remain green.

PC CTaskSimpleDead::ProcessPed (`0x630600`) remains a retail delegate in the
inspected revision. These direct-start and early corpse checks do not establish
every later native corpse/cleanup effect or complete death-task parity.

The first full run passes 6,222 checks but times out in the unrelated
all-recordings signed-byte scan. That test slices all 426 entries through a
filesystem-backed Blob and its repeated filesystem validation. Its exhaustive
scan now uses one 2.3 MB archive snapshot, retaining every frame/range assertion;
the separate index and individual-recording tests keep disk-backed Blob
coverage. No timeout was increased. All 85 focused checks, including that
unchanged full-archive sweep, pass in about 2.2 seconds before the full rerun.
The corrected full rerun passes all 6,223 unit tests (51 skipped).
The final build and full production smoke pass as well, including saved-game
return, walking, native car entry, map/waypoint, pause/resume, Rustler takeoff
and landing gear. No page errors or failed requests occur.

This repair covers the on-foot task adapter. Its existing death-pose/contact
and nearby reaction integration still has authored pieces; complete native
death/event scheduling, every die variant and all ownership transitions remain
the broader compatibility work described above.
