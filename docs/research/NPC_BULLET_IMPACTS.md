# NPC bullet impact acceptance and effects

Ordinary foot-NPC and drive-by hits previously emitted a tracer and muzzle FX
without the shared blood/surface impact path. NPC damage on a corpse could also
call onKill again. Script/gang bullet adapters applied raw weapon damage while
the foot-ped adapter accounted for victim weakness.

CWeapon::DoBulletImpact (PC 0x73B550) checks same-type noncivilian peds before
calling GenerateDamageEvent (0x73A530). GenerateDamageEvent accepts an already
dead victim without running another live damage calculation or death event.
Accepted instant hits emit eight body particles, four for accumulated shotgun
body damage, or 16/32 for a surviving/dead head. See
[PEDESTRIAN_BULLET_BLOOD.md](PEDESTRIAN_BULLET_BLOOD.md) for the separate flying
sniper rule. CEventDamage::AffectsPed supplies live proof/vest/only-player gates.

Sources at revision 4281f82d8af83e14935ac84a69dfd1ceebb9f256:
[Weapon.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Weapon.cpp),
[EventDamage.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Events/EventDamage.cpp).
Victim weakness and known mission-group scaling retain the existing
AccountForPedDamageStats adapter researched from iOS 0x10028a070; these routines
do not establish full retail PC calculator equivalence.

WorldPedestrians now shares NPC bullet application between its foot guns and
opaque script/gang sources. A dead victim reaches the existing corpse animation
adapter and emits no new kill. The legacy bulletHit method still reports collider
recognition; npcBulletHit reports damage acceptance for effects. Both paths apply
victim weakness, and known foot sources retain mission-group scaling. Same-type
exclusions resolve CREATE_CHAR's actual type. NPC mounted-gun damage also honors
the live only-damaged-by-player flag.

Simulation.damagePlayer reports accepted/rejected application, including armour
absorption and zero-health-loss events. Foot guns, script/gang drive-bys and
mounted guns can therefore emit blood after accepted damage, including on CJ.
Impact audio and surface FX precede damage. Destructible-object callbacks run
after physical routing so removal cannot invalidate a collider in use; NPC ped
hits skip object callbacks. NPC impacts use their existing nonplayer attribution
and do not trigger player building-shot records, weapon practice or damage crime
reports through this effect adapter. Object callbacks still run without FX assets.

The live muzzle fixture also exposed stale Three bone world matrices: a newly
positioned officer's gunflash could be read near the origin. NativeCharacter's
nodePosition now composes the current actor/bone/weapon local matrices through
the same chain used by its bone queries. The NPC muzzle uses that result. This
corrects the host's drawn-node lookup; complete original use-gun/task/muzzle
derivation remains separate acceptance work.

Nine live foot-NPC cases forward actual NativeFxEffects.blood calls while
recording health and native pieces: body/head/fatal head/shotgun, bullet proof,
vest, only-player, COP in a civilian model and CIVMALE in a police model. A fatal
muzzle hit plus two live corpse-adapter hits increments the actual other-kill
stat once. Incoming mounted hits verify CJ's surviving/fatal head blood and
proof rejection. Units cover acceptance, corpse accounting, actual types,
weakness/group scaling, callback ordering, prop removal without FX, drive-by
completion and a moved gunflash under stale bone world matrices.

The later [seated-impact adapter](NPC_SEATED_BULLET_EFFECTS.md) adds effects for
the shared CJ, mission-rider and recruited-passenger route.
The [seated type gate](NPC_SEATED_PED_TYPES.md) also retains known foot-shooter
identity across that handoff.
The later [group acceptance check](NPC_GROUP_BULLET_ACCEPTANCE.md) keeps live
NPC groupmate bullets from reaching the calculator in these known-source paths.

Remaining scope includes complete NPC critical
death/calculator/task behavior, creator/group identity for opaque drive-by
sources, native contact brightness and matched retail captures. The existing
host corpse animation gates and broader event/task limits remain documented
separately.

## Drive-by source identity and on-foot contact ordering (October 26, 2026)

The later ambient-seat routing retained scripted/ambient gang gunner types for
seat contacts, but their ordinary foot-victim adapter still discarded that
context. A matching noncivilian could consequently be wounded by a drive-by
that the native DoBulletImpact excludes. Foot use-gun damage already rejected
those types, but its shared impact preparation still emitted contact audio
before that rejection.

NpcBulletImpact now accepts the optional actual ped source. Scripted drive-bys,
ambient gang gunners and foot use-gun paths forward it to preparation. The
pedestrian impact description exposes its resolved native type; impact
preparation rejects an equal noncivilian before audio or effects. The native
civilian exceptions and the separate mounted-vehicle creator path remain.

Script/gang drive-by physical damage also forwards the source to npcBulletHit.
A shared acceptance predicate applies the same-type exclusion to live and dead
victims, then rejects known live groupmates except explosion. Script membership
uses the actual rider object, while street recruits retain follow status. The
group gate remains inside damage acceptance, after contact audio, and does
not suppress a corpse contact merely because it used to share a group.

This context establishes type/group acceptance. External riders are not cast
into live on-foot Pedestrian records: full damage-source/event identity,
retaliation tasks and native damager bookkeeping remain separate work. Known
foot sources keep their existing event/damage metadata. Accepted external hits
continue to apply victim weakness, armour, proofs and nonplayer accounting
through the existing damage adapter.

Pinned source ordering: CWeapon::DoBulletImpact PC `0x73B550` checks equal ped
types before DoBulletHitFx/GenerateDamageEvent; CEventDamage::AffectsPed PC
`0x4B35A0` supplies the live nonplayer-group rejection, after dead-victim
GenerateDamageEvent acceptance. These are the same pinned references above.

Fourteen initial focused cases expose nine failures before the fix; a fifteenth
checks external group identity on corpses. They cover both source
and victim type overrides, equal noncivilian/civilian contacts, live groups,
proofs, mounted creators and corpse ordering. Collision fixtures check that
both physical damage and effects receive the same source from real scripted
and ambient gunner routines.

The real-frame task trial records three head contacts on the same scripted
on-foot ped: equal gang type is silent at 5,000 HP; different-gang script
membership permits audio but no wound; removing membership enables 22 damage,
then 16 head blood particles at 4,978 HP. Centered native random spread draws
make each ray deterministic and are restored at its first source trace.
The existing nine-case NPC muzzle trial now explicitly checks silent COP-to-COP
contact. That trial, CJ mounted-hit acceptance, script drive-by completion,
foot/car/bike group membership and seated type/vehicle-creator checks all pass.

Validation: all 5,788 unit tests pass (51 skipped), as do 54 focused checks and
six live regression cases. The first full run found a stale exact-object
assertion in the skinned arm-piece test after impact descriptions gained ped
type. It now checks the head/dead fields that test owns; its damage, reaction
piece, critical-head and vest checks remain. The corrected full rerun passes.
The final build and full production smoke also pass, including saved-game
return, walking, native car entry, map/waypoint, pause/resume, Rustler takeoff
and landing gear, with no page errors or failed requests.
