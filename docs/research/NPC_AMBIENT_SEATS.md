# NPC bullets reaching ambient vehicle occupants

The shared NPC seated-shot bridge previously accepted only mission riders and
recruited passengers. Its head query could recognize a traffic, police, gang
or emergency occupant, then discard that contact. The caller consequently
applied vehicle damage instead of the pedestrian impact.

Recognized ambient seats now enter their existing damage handlers. The weapon
factor remains separate from forced head death, and these NPC sources use the
existing remote-creator accounting category. The actual seat handler owns
weakness, armour, fatal registration, dead-seat state and driver coast. The
bridge returns a stable contact identity per kind, vehicle body and seat even
when that occupant has no script rider object. Script-group lookups require
an actual rider; an ambient seat never dereferences an absent rider.

## Type and group protections

A recognized equal noncivilian type remains a contact with an empty damage
operation, before impact audio or health changes. It cannot fall through to
the car or a pedestrian behind it. Police seat targets explicitly identify
COP. Ambient gang gunners supply their unit's GANG1–GANG10 type. Scripted
riders supply their actual rider object, preserving script type overrides and
script-group identity; recruits supply retained ped type and follow status.
Vehicle-mounted sources still have vehicle creator semantics.

CWeapon::DoBulletImpact (PC `0x73B550`, gta-reversed revision
`4281f82d8af83e14935ac84a69dfd1ceebb9f256`) checks equal noncivilian ped types
before pedestrian impact audio and GenerateDamageEvent. Sitting in a car
does not make a ped firing CWeapon into a vehicle creator. The head transfer
geometry itself follows the iOS executable, as documented in
[NPC seat collision](NPC_SEATED_BULLET_EFFECTS.md) and
[nativeDieInCar](../../src/vehicle/nativeDieInCar.ts); the PC head-query entry
in the pinned source still delegates to the retail executable.

## Checks and limits

The live four-role fixture uses generated traffic, a native patrol, an adopted
gang-wave car and a native script-created firetruck. An actual LAPD1 pistol
muzzle reaches each rendered driver head, initially set to 5,000 HP. Accepted
fatal shots produce blood and pedestrian audio, spare vehicle health and
increment kills by others once, with no player kill or respect credit.
Repeated contacts do not recount. COP-to-COP contact preserves 5,000 HP with
no audio, blood or vehicle damage; an actual NPC mounted shot then kills the
same driver through the vehicle-source exception.

An additional real-frame scripted drive-by trial checks an ambient gang driver
with an equal gang type and then a different gang type. Centered native random
spread draws make both contacts deterministic; each recorded ray must reach
the driver seat, and the random function is restored at that trace. Focused collision
checks retain actual script shooter identity and each tested gang gunner's
type. Existing script/recruit proof, group and bullet-effect regressions cover
the previously supported contacts.

This closes the ambient bullet-routing gap recorded in the earlier traffic,
gang and emergency reports. Complete native source identity, every native
accounting field, NPC nonfatal response tasks, non-bullet deaths and matched
retail task/render traces remain open. Existing remote-creator categorization
does not establish full CPed source/event equivalence.

Validation: the build, 65 focused checks and 5,773 full-suite tests pass
(51 skipped), including four new
source-propagation checks. The four-role live trial, normal-frame scripted
shooter trial and four surrounding group/type/effect regressions pass.

The production smoke reaches its aircraft stage but fails takeoff on this
checkpoint: rotation at 101 km/h with continuously held elevator peaks at
15 m AGL, then loses speed to 58 km/h and repeats low hops. The failure samples
and screenshot are retained in artifacts/npc-ambient-seats-flight-failure.*.
The earlier cadence correction did not resolve this intermittent flight check;
this report does not claim a passing production run.

The subsequent [test-pilot correction](PLAYABLE_AIRCRAFT.md#production-takeoff-piloting-follow-up-october-26-2026)
builds takeoff speed before rotation and releases elevator once airborne.
The full production smoke then passes, including aircraft and landing gear,
with no page errors or failed requests. Flight physics are unchanged.
