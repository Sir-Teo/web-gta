# Retaining recruited passengers' damage protection

A follower's PassengerKeep record retained health, weapon, weakness and some
targeting flags, but dropped physical proofs, only-damaged-by-player and the
bullet-proof vest when the follower boarded. CarEntry.passengerShot also lacked
those gates, and the replacement pedestrian on exit did not restore them.

The boarding adapter now copies the five physical proof flags and retains the
two separate protection flags. The exit adapter restores an independent copy.
The seated bullet handler checks physical proof, the only-player gate for NPC
rounds, and the vest's native body-piece rule before ordinary damage or forced
head death. Clearing a flag makes the corresponding wound possible again.

The vest protects WEAPON_FIRE_INSTANT_HIT hits on torso (piece 3) and ass
(piece 4); a transferred car head (piece 9) remains exposed. The player seated
damage callback now receives the traced piece as well as the weapon, matching
the NPC callback, and its head-death predicate explicitly requires piece 9.
The existing WorldPedestrians helper exports remain available; their shared
weapon/vest predicates live in ped/bulletProofs.ts so the car entry task can use
the same rules without importing the pedestrian world implementation.

Source: CEventDamage::AffectsPed (PC 0x4B35A0), including bInvulnerable,
bHasBulletProofVest and CanPhysicalBeDamaged. CPed remains the same object in
the native vehicle enter/exit tasks; these copies preserve those properties
across the host's replacement records. Pinned source:
[EventDamage.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Events/EventDamage.cpp).
See [mission-rider proof handling](SCRIPT_RIDER_PROOFS.md) and
[NPC seated effects](NPC_SEATED_BULLET_EFFECTS.md).

Units check protected ordinary/forced-head damage from player and NPC sources,
clearing, the only-player flag, vest torso/ass/head/limb distinctions, unchanged
kill callbacks on rejection, and an actual boarding/rebuild round trip followed
by rejected pedestrian damage. Existing bike and mounted-gun tests verify
native piece propagation. A live FAM1 body passes through boardPassenger into a
drawn car seat; public scripted mounted-gun trials compare retained health,
blood and vehicle health across protection changes, then exit restores the
follower's health and flags. Passenger death/exit and drive-by regressions
exercise the existing task and death behavior alongside it.

This covers the existing recruited-passenger bullet entry and its retained
state. Full native damage/armour/force-death calculation, exact creator/group
identities, other damage paths, lighting and matched retail captures remain
open. Recruited followers currently ride car seats; direct bike pieces are
covered by the separate mission-rider path.
