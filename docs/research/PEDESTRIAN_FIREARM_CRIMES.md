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

## On-foot type and vehicle-creator propagation

WorldPedestrians.damageCollider now returns the resolved ped type alongside
the retained ped identity. CREATE_CHAR's type takes precedence over the model's
peds.ide type. A script COP using MALE01 therefore queues the cop firearm crime,
and a civilian using a police model retains the civilian crime. The same
accepted-hit path supplies the resolved type and cop classification to its
kill callback. This does not change the actor's AI role flags.

WeaponSystem carries this type's PoliceDontCareAboutCrimesAgainstPedType value
explicitly through immediate and queued reports. Callers that provide only the
older id/officer record retain the existing fallback. Handheld and sniper shots
keep their three-report order and the sniper-specific cop impact selection.

Mounted rounds carry their vehicle-creator class into on-foot damage as well
as seated damage. A vehicle driven by CJ queues only ReportCriminalEvent's
victim event; it does not add the two player-ped reports. A remotely controlled
vehicle without CJ as driver queues no damage criminal event. These are the
same PC GenerateDamageEvent, IsCriminalEvent and DoBulletImpact rules detailed
in [AIRCRAFT_WEAPONS.md](AIRCRAFT_WEAPONS.md). The host's separate player-input
fire/explosion notifications are outside this damage-event change.

Units cover model/type precedence, ordinary/sniper cop selection, all twelve
police-care exemptions, vehicle and remote creators, NPC sources and actual
CWanted identity deduplication. Other actor-role, kill-attribution and event
paths still need their own verification; the change does not establish full
CPed subclass/task or native pursuit parity.

The live test creates COP/MALE01, CIVMALE/LAPD1 and three MALE01 victims typed
GANG1, DEALER and CRIMINAL. It verifies the handheld damage adapter's exact
reports, then seats CJ in a real Hunter and fires its actual mounted gun along
a measured clear line. Each mounted hit queues one correctly classified victim
event and preserves pedstats damage scaling. A later fatal accepted hit emits
one kill callback with the actual type/cop classification. Existing seated,
player-mounted and recruit damage-scaling regressions also pass.

## Native victim types across on-foot deaths

CPed::IsCop and IsGangster inspect m_nPedType, independently of the character's
model. CDarkel::RegisterKillNotByPlayer (0x43D210) and RegisterKillByPlayer also
use that type for friendly/enemy gang counters and respect. Sources at the
same pinned revision:
[Ped.h](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Entity/Ped/Ped.h),
[Darkel.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Darkel.cpp).

The shared pedTypeInfo lookup now supplies all nine WorldPedestrians kill
callbacks: accepted direct damage, scripted/NPC drive-by bullets, scripted die
tasks, NPC melee, vehicle strikes, player unarmed strikes, fire, NPC foot guns
and stealth kills. GANG1–10 map to gang indices 0–9; GANG2 is the Families.
CREATE_CHAR's type overrides peds.ide, while legacy records without a type
retain their role-flag fallback. Cop classification in targeting metadata,
gun-aim threats, unarmed/car crime reports and evasive-dive reports uses the
same lookup.

Death cash passes the resolved type to the existing CreateDeadPedMoney adapter
(PC 0x4590F0). A COP, MEDIC or FIREMAN using a civilian model drops no cash;
a CIVMALE using a police model can drop its script-assigned money. Mission
ownership and script-money gates remain in that adapter. Its death scheduling
and pickup timeout still have the source limitations documented in MoneyDrops.ts.

These changes classify victims and reports. Actor-role flags and their AI
tasks still need separate native verification, and this does not establish
complete kill/respect, damage-calculator or task parity.

The live regression creates eight model/type combinations and kills them
through accepted direct damage, fire damage and the NPC bullet adapter. It
checks the emitted kill, the actual player/other/friendly/enemy stat deltas,
cop gun-aim reports and the later death-cash callback. Pure cases cover all
ten gang slots and legacy fallbacks; direct burn and NPC-bullet units verify
that their callbacks use the same classifier. The existing gunshot-sense
fixture now moves CJ with its test muzzle: native range is measured from the
firing entity's position.
