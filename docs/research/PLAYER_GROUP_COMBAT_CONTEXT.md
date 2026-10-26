# Combat membership for waiting script group members

A script's stand-still allocator can keep a ped in CJ's group while the
browser's locomotion `follow` flag is false. Incoming player-damage acceptance
already resolved that script membership, but outgoing damage scaling, weapon
practice and foot kill-accounting metadata still used the flag alone. A waiting
mission ally consequently took full player damage, trained his weapon and
could lose the recruited-member kill classification.

WorldPedestrians now resolves those combat decisions through one membership
predicate: the host's known membership result, with the street-follow flag as
a fallback when no resolver is supplied. Main's resolver checks an actual
loaded script handle in a group containing player handle 1 before falling back
to follow for street actors without a script handle. The physical damage entry
captures membership before changing health, uses it for the existing friendly
factor and retains it for the kill callback. The incoming foot-ped source guard
also uses that membership. All seven foot kill-emission paths now resolve the
same membership, including NPC bullets/fists, vehicle kills, fire, the legacy punch
entry and stealth kills. Locomotion and SCM's membership ownership are unchanged.

## Reference and scope

CWeapon::DoBulletImpact (PC `0x73B550`) checks CPedGroups::AreInSameGroup
before CStats::UpdateStatsWhenWeaponHit. A ped must be alive and outside the
shooter's group; whether its current task follows him is not the test.

The selected iOS AccountForPedDamageStats branch (`0x10028a070`) applies the
retained player-to-member tenth/cap rule after weakness, excluding flamethrower
and explosion. This change supplies actual membership to that existing rule;
its multipliers, native float arithmetic and weapon exceptions are retained.
It does not replace the separate incoming IsFriendlyWith acquaintance test.
The inspected PC AccountForPedDamageStats entry is still a retail delegate.

CDarkel::RegisterKillNotByPlayer (PC `0x43D210`) reads membership in the
player's group before subtracting two respect and counting a recruited member.
RegisterKillByPlayer (`0x43DCD0`) counts that membership for a Families victim
alongside its ordinary five-respect penalty. The callbacks now retain this
identity even for members not following. Existing raw vehicle-creator handling,
victim native-type resolution and once-only damage/death gates are preserved.
The source revision is `4281f82d8af83e14935ac84a69dfd1ceebb9f256`.

The existing immediate follow-field clear after player damage remains distinct
from script membership, which SCM can retain/restore. Complete native group
events, task responses, removal and ownership are still separate compatibility
work. This repair does not claim that every authored group behavior or damage
class now has native semantics.

## Verification

Twelve initial cases expose eight failures before repair. Three later cases
expose stale-follow errors after removal, and a fourth exposes that same stale
flag in incoming foot damage. Known membership now wins even when follow is
still true immediately after script removal. They check friendly
bullet/melee one-HP results without follow, practice exclusion/removal/street
fallback and dead/unknown controls, plus membership on player/raw-vehicle/NPC
bullet, NPC-fist and fire kill callbacks. All 255 focused checks pass with the
existing precision, armour, source/proof, crime, fire and corpse adapters. The
final full suite passes all 6,239 tests (51 skipped), and the build passes too.

The live fixture sets the real player group's default allocator to stand still,
adds CREATE_CHAR Families members and waits for actual membership with follow
false. It then fires real player/NPC pistols and a public native ground kick.
All six cases pass without page errors:

- A member takes 2.75 pistol damage and grants zero weapon practice.
- A removed member takes 27.5 and grants the native 0.8 pistol-skill increment.
- An immediately removed following member still has follow true, but takes
  27.5, grants practice and passes incoming source acceptance.
- A waiting member takes 8.25 from the player's ground kick.
- A player kill retains recruited-member credit, one player kill and minus
  five respect, while granting no practice.
- An NPC kill retains recruited-member credit, one nonplayer kill and minus
  two respect.

The existing six-case player-melee precision/armour/recruitment regression also
passes, with exact one-HP survivors and native responses intact.

The final production smoke reaches saved-game return, walking, car entry, map,
pause/resume and flight loading, but two runs fail the unchanged Rustler pilot:
one waits below the 115 km/h / 15 m gate, and another reaches the speed gate
but not the required climb. Both flight traces are retained in ignored
artifacts. Production flight is an unresolved regression, not a passing check
for this checkpoint; this repair changes no flight code.
