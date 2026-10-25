# Incoming firearm hits on seated CJ

CJ's physical collider is disabled while he rides. NPC muzzle rays formerly
stopped at his car without asking whether its occupant had been hit. The shared
seated-shot adapter now includes his rendered head alongside NPC occupants.
The vehicle must be the first physical body hit, the head must intersect the
full shot segment, and the nearest eligible occupant wins. A nearer tyre or
world obstruction still consumes the shot; the shooter's own carrier is excluded.

This uses CWeapon::CheckForShootingVehicleOccupant (PC 0x73F480, pinned ARM64
0x100498190), already used by the host's NPC occupant handoff. Its vehicle driver
and passenger loops test bCanBeShotInVehicle without excluding the player, obtain
the head bone and build a piece-9 sphere of radius 0.2, lifted 0.1 above the node.
The PC function is an unreversed wrapper; the detailed algorithm comes from the
same pinned executable documented in [BIKER_BULLET_COLLISION.md](BIKER_BULLET_COLLISION.md).
This is the vehicle-hit handoff, separate from direct animated biker collision.

SET_CHAR_CAN_BE_SHOT_IN_VEHICLE (054A) now stores CJ's flag directly. Previously
the adapter attempted to resolve him in the script-NPC pool. The PC
[CharacterCommands.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Scripts/Commands/CharacterCommands.cpp)
handler assigns the same CPed flag for either player or NPC. The incoming bike
capsule path also respects it.

Hits use the existing Simulation.damagePlayer rules: proofs, MakePlayerSafe,
native float32 0.33 player damage scaling, armour, friendly damage and death.
Foot NPC callers retain their recruit/friendly-fire gates and group defence
callback. Script and gang drive-by callers share the same player handoff. CJ
is not added to the player's aim-target or outgoing occupant roster.

Units cover the first-body requirement, range, missed head, protection,
own-car wrappers and raw 054A bytecode on CJ. Live original-model tests cover
Greenwood driver/rear passenger and Burrito rear passenger; an actual cop muzzle
damages the driver through the handoff. Armour absorbs 25 * float32(0.33),
the hit retains piece 9, a wall blocks it, and disabling the flag protects CJ
while subsequent rounds damage his car. The cop/bike regression checks the flag
on its existing direct capsule path. Original scripted bike rider checks guard
the shared NPC query against regressions.

Remaining scope: CJ's direct bike collision still uses the host capsule rather
than the twelve animated spheres. Player hit reaction/death tasks and every
mounted-shooter weapon path are not established by these checks. The head query
uses the last rendered skeleton, and matched retail PC traces remain open.
