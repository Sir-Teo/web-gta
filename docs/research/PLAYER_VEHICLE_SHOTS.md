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
bike collision path also respects it.

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
on its direct collision path. Original scripted bike rider checks guard
the shared NPC query against regressions.

## Direct animated player bike collision

CJ's motorcycle/bicycle body now uses the same twelve bone-bound spheres as
script riders, replacing the standing Rapier capsule. The shared incoming-shot
query tests these spheres only up to the first world or tyre collision. Direct
ped collision wins before any vehicle/head transfer, as it does in CWorld's
line trace. The nearest sphere supplies the body-piece ID to damagePlayer;
the NPC critical-head rule is not substituted for the player's damage rules.

The eligibility class is the host's existing motorcycle/bicycle rider class;
the native writer of bTestForShotInVehicle remains unidentified. Quads use the
vehicle/head handoff, as they do for script NPCs. The original sphere table,
both executable slices and the PC transform consumer are documented in
[BIKER_BULLET_COLLISION.md](BIKER_BULLET_COLLISION.md).

Foot NPCs now use this common query along with scripted and gang drive-by
shooters. Shotgun pellets query the same direct victim independently and
accumulate only those that reach him. Skeleton sampling remains lazy and is
skipped for protected players and the shooter's own carrier. CJ remains absent
from the player's outgoing aim/occupant roster.

Focused geometry units check range, a missed piece, an arm shielding the head
and exclusions that must not sample the skeleton. Live original BMX driver and
PCJ-600 driver/pillion tests check all twelve spheres, torso/arm piece IDs,
armour, cover, protection and own-car exclusion. They also find shots accepted
by the removed capsule that correctly miss the actual rider. Real cop pistol
and shotgun muzzle trials reach CJ; the shotgun accumulates multiple pellets.
The seated-car and script-rider browser cases guard the two shared paths.

The later [on-foot trace](SKINNED_PED_BULLETS.md) supplies CJ's animated pieces
to incoming foot and mounted rounds too. Remaining scope: player hit
reaction/death tasks and all mounted-shooter engagement/selection
paths are not established by these checks. Queries use the last rendered
skeleton, and matched retail PC traces remain open.
