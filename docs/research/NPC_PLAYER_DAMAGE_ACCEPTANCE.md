# NPC ped-source protection when damaging CJ

The foot-ped player-damage adapter already represented two native protections,
but identified Families by the model's gang assignment and knew only street
followers as player-group members. Scripted/ambient drive-by physical hits
called player damage directly; the shared seated-player bridge did so too
unless its caller provided an explicit player-hit callback.

The shared npcPedCanDamagePlayer rule now resolves the creator's actual native
type, including CREATE_CHAR's override. Main's player-group resolver recognizes
street follow state or actual script membership with player handle 1. Foot
weapons/melee use that context, and both drive-by emitters consult it before
ordinary player damage. The shared CJ seat callback consults it for car and
exposed-bike contacts. Ambient gang initialization installs the hook beside
its other gun callbacks, inside the asynchronous construction callback.

## Native ordering

CEventDamage::AffectsPed (PC `0x4B35A0`, gta-reversed revision
`4281f82d8af83e14935ac84a69dfd1ceebb9f256`) applies these distinct rules to
FindPlayerPed:

- A raw ped creator of PED_TYPE_GANG2 using WEAPON_GRENADE or a higher enum
  needs CTaskComplexKillPedOnFoot with CJ as its target.
- A raw nonplayer ped in the victim's group cannot damage him except by
  WEAPON_EXPLOSION. This does not override the earlier Families rule.
- Raw vehicle creators do not enter these ped-only checks.

The native rule uses ped type, independently of model appearance or a model's
population gang label. The host retains its existing mapping of a foot kill
on CJ to retaliation with no other ped foe. A rider's drive-by is not mapped
to KillPedOnFoot. Full native task-tree/source identity remains open.

DoBulletImpact has already played contact audio before GenerateDamageEvent
runs these AffectsPed rules. Protected player impacts therefore keep audio,
reject health/armour changes and blood, and retain the contact rather than
hitting the vehicle behind CJ. Existing player proofs and damage response
remain owned by Simulation.damagePlayer. The weapon/rank boundary is the native
enum, not a browser-authored weapon category.

Pinned source:
[EventDamage.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Events/EventDamage.cpp).

## Checks and limits

Nine initial foot-adapter tests expose five failures before repair: type/model
disagreements and script-group members lacking the street follow flag. Added
checks distinguish raw vehicle creators, the ordered Families/explosion rules,
explicit kill-task targeting and an unrelated foe. Scripted and ambient gunner
collision fixtures exercise the actual shared acceptance callback for both
Families and known-group bullets before player wounds.

The live task fixture uses centered native dispersion draws, restored at the
actual muzzle trace. It tests CJ on foot, in a native Greenwood and on a native
PCJ-600. Each scenario checks Families immunity, different-gang membership in
CJ's actual script group and accepted damage after removing membership. Actual
rays must reach the physical head, transferred car head or exposed biker.

This supplies known native source-type and player-group acceptance. Complete
raw source/event bookkeeping, native task-tree ownership and matched retail
combat/damage calculation remain separate acceptance work. The explosion
exception is a predicate check, not coverage of the entire blast pipeline.

The build, 38 focused tests and all three live player scenarios pass. Nine
actual TASK_DRIVE_BY head contacts retain contact audio. The six protected
contacts preserve 5,000 HP without blood; the three separated-member hits
reduce health to approximately 4,993.4 and emit 16 head particles afterward. No
page errors occur. These are the host's existing player damage factors, not
new calculator constants introduced by this acceptance change.
The existing mounted-gun regressions also pass for CJ's physical body and car/
bike contacts, including player proofs and fatal-head blood. Raw vehicle
creators therefore retain their distinct path through the new seated callback.

All 5,801 unit tests pass (51 skipped). The first full run exposed an older
player-safety fixture containing only a model gang number. That fixture now
also supplies the actual GANG2/GANG1 native type; its original recruit, kill-
target, weapon and fist assertions remain. Forty-one focused checks and the
corrected full rerun pass.
The final build and production smoke pass as well, including walking, native
car entry, map/waypoint, pause/resume, saved-game return, Rustler takeoff and
landing gear. No page errors or failed requests occur.

## Accepted drive-by friendship (October 26, 2026)

Acceptance and damage scaling are separate decisions. The physical scripted
and ambient gang drive-by entries, and the shared seated-CJ fallback, previously
passed the source guard but omitted the source's friendship from player damage.
An accepted friendly shooter therefore inflicted the full player factor.

These entries now resolve friendship through WorldPedestrians.friendlyWithPlayer,
using the actual ped type and its individual acquaintance table. The gang hook
is installed when the asynchronous subsystem is constructed. The existing
acceptance check runs first: rejected Families/group hits never enter the
friendship calculation. A raw vehicle source has no ped friendship.

The selected iOS AccountForPedDamageStats branch at
`0x10028a114..0x10028a144` reduces accepted damage from a friendly ped to one
tenth, capped at 12.5. IsFriendlyWith checks respect/like in either direction,
or matching ped types. This wiring reuses that existing player calculation;
it does not establish the unavailable PC AccountForPedDamageStats body or
complete raw source/event ownership.

Four initial emitter tests fail before repair. The expanded eight cases cover
both emitters, hostile/friendly factors and rejection before friendship lookup.
The live fixture changes CREATE_CHAR's GANG1 rider through actual script
relationship commands: hate, respect, then clear respect. It requires real
TASK_DRIVE_BY contacts on CJ's foot body, transferred car head and exposed
bike body, independently checking native float response amounts, health,
blood and absence of protected-group membership.

The first live attempt found a fixture receiver error: the saved weapon ray
method was called without its WeaponSystem receiver. The fixture now calls it
with that receiver; game collision and targeting were unchanged.

The live checks then exposed two timing issues in the fixture: the game consumes
player damage events during its frame, and browser polling could allow a second
burst round. The fixture captures the response synchronously at damagePlayer
and ends the task in a microtask after the first completed shot. The existing
protection fixture uses that same immediate stop, after its car/bike checks
recorded an extra shot despite correct protection, blood and health behavior.

The same source audit found the police nightstick entry omitted friendship,
although ordinary fists and foot guns already passed it. Its accepted blows
now forward friendship too. Four combo tests exercise all three actual
BBALLBAT stages, native float factors and the third move's fall flag, including
rejection before lookup. Two accepted cases fail before repair. Together with
the emitter and existing player cases, 45 focused checks pass. A live native
COP/animation fixture uses script hate/respect/clear/group changes and runs
the real baton combo against CJ, retaining the earlier group rejection.

All three live relationship cases pass, followed by the corrected three
protection cases and live baton case, without page errors. The nine new
TASK_DRIVE_BY contacts preserve exact native float damage responses and
body/head blood across foot/car/bike. The protection fixture retains its nine
head-contact/audio checks. The twelve live baton blows retain all three move
indices and the third-stage fall flag: respect scales accepted blows by one
tenth, clearing respect restores full damage, and group membership rejects
every blow without a damage event. Existing physical/seated mounted-gun
regressions also pass, retaining proofs and the raw vehicle-source path.

All 6,054 unit tests pass (51 skipped), followed by the final build and full
production smoke: saved-game return, walking, native car entry, map/waypoint,
pause/resume, Rustler takeoff and landing gear. No page errors or failed
requests occur in that production check.
