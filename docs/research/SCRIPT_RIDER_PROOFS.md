# Physical proof flags on mission riders

SET_CHAR_PROOFS was retained in ScmPedPool's script state and restored during a
ped rebuild, but the live host setter discarded it for ScriptRider records.
Their bullet callback also subtracted health without checking physical proofs.
A bullet-proof mission character could therefore be wounded or killed in a
vehicle even though the same script protection worked on foot.

The host now stores a copy of all five flags on the rider. The extracted
scriptRiderShot adapter consults the existing physicalCanBeDamaged mapping
before applying live damage. Clearing bullet proof permits damage again. The
same adapter serves the existing player and NPC bullet paths, so physical proof
also blocks an already-computed head-death amount. Its corpse and seat-death
handling is preserved, and rejected hits produce no instant-hit blood through
the existing accepted-damage effect path.

PC CEventDamage::AffectsPed (0x4B35A0) checks CPhysical::CanPhysicalBeDamaged
(0x5448B0); CWeapon::GenerateDamageEvent (0x73A530) accepts a dead victim before
the live event. Sources at the pinned revision:
[EventDamage.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Events/EventDamage.cpp),
[Weapon.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Weapon.cpp).
The shared proof mapping documents its separate PC/iOS provenance and the
molotov difference; the seated bullet entry uses the gun branch.

Unit cases check pistol, sniper and minigun proof rejection, clearing, separate
only-player protection, unrelated proof flags and corpse acceptance. Existing
ScmPedPool tests verify that proofs survive entering and leaving vehicles.
Live car and motorcycle cases use the public scripted mounted-gun command with
player/NPC attribution, compare health/blood/vehicle health while protected,
then clear the flag and fire again.

This closes physical proof handling for the mission-rider bullet adapter.
Recruited-passenger proof/vest behavior, complete damage/armour/force-death
calculation, exact source/group identities, other damage entry points, and
matched retail captures remain separate work.
