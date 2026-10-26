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
