# NPC groupmate bullet acceptance

CEventDamage::AffectsPed (PC 0x4B35A0) rejects damage whose raw creator is a
nonplayer ped in the victim's group, except WEAPON_EXPLOSION. That check precedes
the damage calculator. The host previously allowed known foot groupmates'
bullets to reach its retained friendly-damage calculator rule instead.

WorldPedestrians now rejects a live groupmate bullet before calculation,
using known player-group follower membership or the existing script-group
identity resolver. Its earlier corpse acceptance stays ahead of the live
group check. The calculator's independent mobile-researched scaling behavior
is preserved for other callers; it does not establish bullet acceptance.

The seated bridge uses the actual foot-shooter reference supplied by the
[ped-type handoff](NPC_SEATED_PED_TYPES.md). Its script-group resolver accepts
both walking and riding host records; known player-group follower state also
reaches recruited passengers. The group rejection happens inside damage
acceptance, after contact audio and before wounds, blood or kill callbacks.
This is later than DoBulletImpact's separate equal-noncivilian-type exclusion.
NPC vehicle creators carry no raw ped shooter and keep their existing path.

Pinned source:
[EventDamage.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Events/EventDamage.cpp).
GenerateDamageEvent's dead-victim acceptance is in
[Weapon.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Weapon.cpp).

Units separate the retained calculator rule from live acceptance and check
resolved script membership and corpse contacts. A real civilian script-group
leader fires its native pistol at a different civilian type on foot, in a car
and on a motorcycle. Each membership-bound shot emits contact audio without a
wound or blood; removing the target from the group enables the next muzzle
hit. Existing drive-by, ped-type, NPC impact and mission-rider kill regressions
check surrounding behavior.

This covers known foot-shooter identities in the existing physical and seated
bullet entries. Opaque script/gang/vehicle creator identities, full native
group/task behavior, other damage entries, full damage calculation and matched
retail PC captures remain open. The exception for explosion does not establish
coverage of the separate blast pipeline.

The [on-foot drive-by follow-up](NPC_BULLET_IMPACTS.md#drive-by-source-identity-and-on-foot-contact-ordering-october-26-2026)
now forwards the actual scripted rider and the ambient gang gunner's type to
physical damage and impact preparation. A real TASK_DRIVE_BY head line checks
silent equal-type exclusion, audible group rejection and the accepted wound
once the victim leaves that script group. Full raw source/event and retaliation
bookkeeping for external riders remains open.
