# Pedestrian firearm crime reports in and out of vehicles

Accepted shots on seated NPCs now follow the original firearm crime call chain.
The old seated adapter emitted one assault-style report for an instant hit, or
one impact report for a sniper hit. It omitted the queued CEventDamage crime,
used a vehicle-wide victim identity and lost some victims' police/gang type.

For an ordinary live firearm victim, the PC source establishes this order:

1. CWeapon::GenerateDamageEvent (0x73A530) calls CCrime::ReportCrime with
   CRIME_DAMAGED_PED, including when the victim is a cop.
2. CEventGroup::Add (0x4AB420) calls CEventDamage::ReportCriminalEvent
   (0x4B3440). Firearms queue CRIME_DAMAGE_CAR, or CRIME_DAMAGE_COP_CAR for a cop.
3. CWeapon::DoBulletImpact (0x73B550) reports CRIME_DAMAGE_CAR. The flying
   CBulletInfo path (0x7360D0) selects CRIME_DAMAGE_COP_CAR for a cop instead.

GenerateDamageEvent skips EventGroup::Add for a surviving seated ped whose
active task is TASK_SIMPLE_GANG_DRIVEBY. The immediate calls still apply. A
fatal hit enters the event group. The host now carries that active-task fact
for scripted drive-bys, rival-car shooters and recruited passengers' drive-bys.
Accepted on-foot damage also follows the event order, and the flying sniper
path carries the impact distinction through to a cop on foot.

Victim identity belongs to the ped: script riders use their SCM handle, street
passengers retain their on-foot ID, and opaque ambient occupants fall back to
stable per-seat keys. Different people in one car no longer collapse onto the
same vehicle crime record. Repeated hits on one victim still deduplicate in
CWanted. A street passenger's ID and ped type survive the exit reconstruction;
restoring an ID also keeps the allocator beyond it so later peds cannot alias it.

CPedType::PoliceDontCareAboutCrimesAgainstPedType (0x608A40) selects GANG1–10,
CRIMINAL and DEALER. The seated target carries its actual ped type, including a
script's CREATE_CHAR type even when its model suggests another type. This flag
reaches the existing crime host explicitly, rather than looking for a seated
victim among the removed on-foot bodies. Crew membership continues to exclude
weapon practice; crime classification still follows the victim's type.

Sources at revision 4281f82d8af83e14935ac84a69dfd1ceebb9f256:
[Weapon.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Weapon.cpp),
[EventGroup.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Events/EventGroup.cpp),
[EventDamage.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Events/EventDamage.cpp),
[BulletInfo.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/BulletInfo.cpp),
[PedType.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/PedType.cpp).

Units cover civilian/cop instant and sniper reports, all twelve ignored victim
types, active drive-by survival/death, script type overrides, retained recruit
identity and real CWanted queue deduplication for two seats in one car. A live
Greenwood contains three MALE01 models with different CREATE_CHAR types; it
verifies type and identity through the actual weapon host and checks a native
TASK_DRIVE_BY survivor/fatal case. The street-passenger regression verifies
the surviving recruit's original ID and wound after exiting, with its measured
NPC shooter removed before exit and terrain loading allowed to release game time.

The ped type lookup moved into the existing pure acquaintance module, retaining
its WorldPedestrians re-export. Its unit no longer imports the complete scene
simulation inside a five-second test just to exercise three pure lookups.

Remaining scope: this integrates reports for the accepted-hit adapters; it is
not a full CEventGroup/response-task implementation. Event-group capacity,
rejected damage/corpse gates, identity replacement in opaque ambient seats,
complete witness/pursuit behavior and matched retail PC traces remain open.
The existing CWanted implementation still carries its own documented limits.
