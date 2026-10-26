# Foot-shooter ped types on seated bullet impacts

The ordinary pedestrian bullet adapter retained its shooter and applied
DoBulletImpact's same-type exclusion. The seated bridge received only the
shooter body, so a cop's round transferred through a car could wound a seated
cop that the same round would spare on foot.

Foot use-gun rays now pass the actual shooter record into SeatedShot, including
the direct biker pellet queries. The shared native type predicate lives in
nativeAcquaintance and is used by both ordinary and seated application. It
resolves CREATE_CHAR's actual type before any model type. Equal types are
excluded except CIVMALE/CIVFEMALE.

The seated bridge returns the recognized contact with no damage operation for
an excluded type. It does not run pedestrian impact audio, blood, health or
kill callbacks, and the caller does not fall back to damaging the car or
someone behind the occupant. NPC vehicle-mounted sources supply no ped shooter
and keep their distinct native creator behavior.

Source: CWeapon::DoBulletImpact (PC 0x73B550) tests the creator's ped type before
DoBulletHitFx and GenerateDamageEvent. The condition also exempts a player-ped
creator; player weapon paths do not use this NPC shooter context. Pinned source:
[Weapon.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Weapon.cpp).

Pure cases cover noncivilian types, the two civilian exceptions, unknown types
and script/model overrides. Existing pedestrian acceptance tests continue to
exercise the same rule. A real LAPD1 officer's muzzle fires at a COP in MALE01,
a CIVMALE in LAPD1 and a CIVMALE in MALE01. The live fixture checks the actual
shooter object reached the contact, health, blood, contact audio and unchanged
vehicle health. A public NPC mounted round then wounds the protected COP via
the non-ped creator path. Existing CJ car/bike, mission-rider kill accounting
and recruited death/exit regressions check the surrounding routing.

This supplies the known foot shooter to the existing seated NPC bridge.
The [group acceptance check](NPC_GROUP_BULLET_ACCEPTANCE.md) then uses that
reference for known script/player groups inside damage acceptance.
Opaque script/gang shooter identities, complete NPC same-group rules,
full damage/armour/critical-death calculation, ambient-crew NPC damage,
native contact lighting and matched PC captures remain open.
