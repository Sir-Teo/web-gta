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
