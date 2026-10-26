# NPC fist armour and native float response

NPC-to-NPC brawls previously subtracted `base * attack * weakness` directly
from health. They bypassed armour, used double arithmetic and supplied that
factor as the animation response even on death. A 28.5-HP victim hit with a
25-damage blow at weakness 1.1 incorrectly died just below one HP. A victim
with 40 armour lost health instead of retaining 12.5 armour.

`WorldPedestrians.strikeFoe` now reads and multiplies native float attack and
weakness fields, spends armour, then applies the ordinary native health
boundary. The animation receives the factor left after armour on survival,
or stored pre-hit health on death, plus the absorbed armour amount. A positive
response can survive even when HP quantization hides field loss. Mega punch
spends the ordinary armour factor before forcing death. Existing melee proof,
only-player damage, source identity and attacker/retaliation behavior remain.

The same entry now rejects known street/script groupmates before damage, as
CEventDamage::AffectsPed requires for a raw nonplayer ped source. Native
PLAYER1/PLAYER2 source types retain the player exception. Equal noncivilian
types alone do not reject fists: that exclusion belongs to DoBulletImpact.

## Independent reference

The pinned iOS arm64 ComputeDamageResponse contains its inlined armour body
at `0x100289d30` through the branch to `0x100289dc8`. It loads armour as a
single-precision field, skips only weapons 53/54 (drowning/fall), stores the
absorbed factor and subtracts it from either armour or the remaining factor.
Fists (0), knuckles (1), nightstick (3) and pistol (22) all spend armour.

`scripts/research/emulate-ped-armour.py` executes those actual instructions
with Unicorn 2.1.4 and records 120 combinations of weapon, input factor and
armour in `tests/fixtures/ped-armour-reference.json`. FindPlayerPed returns
null to select the NPC path; the player armour-loss timestamp is excluded.
Execution stops before the health calculator. The script verifies the entire
binary's 14,226,544-byte size and SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
It downloads nothing and does not call the host arithmetic.

Regenerate with an existing pinned reference and optional Unicorn install:

```
python scripts/research/emulate-ped-armour.py --binary /path/to/reference --output tests/fixtures/ped-armour-reference.json
```

PC ComputeWillKillPed (`0x4B3210`) supplies the strict below-one threshold and
response distinction. CEventDamage::AffectsPed (`0x4B35A0`) supplies the raw
source/group rejection. Both are available in gta-reversed revision
`4281f82d8af83e14935ac84a69dfd1ceebb9f256`. PC AccountForPedArmour remains a
retail delegate with an early return; the reconstruction below it is not
independent PC evidence. These selected rules do not establish complete PC
calculator/task equivalence.

## Checks and limits

Five initial integration cases fail before repair; two group cases and one
additional attack-field precision case expose their respective later repairs.
The 135-case fixture includes the 120 independent native armour captures and
15 host cases for one HP, full/partial armour, fatal and sub-ULP responses,
proofs, only-player immunity, source/group exceptions and mega-punch ordering.
All 180 focused checks pass with the existing melee, cheats, bullet acceptance
and bullet precision cases.

The live fixture loads native MALE01 bodies and the script-selected kickboxing
clips, runs all three original damage rows through the actual brawl routine,
then checks health again after normal world frames. It requires an exact
one-HP result, full/partial armour, genuine below-one death, native health/
armour animation responses, once-only fatal accounting and actual script-group
rejection. The earlier police baton friendship scenario is a separate live
regression.

The first live run confirms the expected armour, partial-armour, group and
fatal-response results, but exposes an invalid one-HP seed in the fixture.
Native MALE01 attack strength is 0.7; summing its three rounded factors before
adding one loses a float increment compared with their separate health
subtractions. The boundary is now constructed backward through those native
operations, retaining the actual pedstats and a strict exact-one assertion.

The corrected live trial passes all five scenarios. Twelve accepted native
combo blows preserve the expected health/armour responses and move indices;
the protected script-group combo emits no wounds or melee-impact callback.
Both one-HP survivors remain at exactly one after normal world frames. The
genuine below-one final blow emits one kill. The earlier live police baton
friendship regression also passes without page errors.

The separate player-click regression initially recorded repeated jabs. Its
trace shows 600 ms between swings, outside the existing 583 ms first-chain
window. The fixture now reads only the victim's health/down fields instead of
serializing the whole world between presses, positions the cursor once and
reuses the poll result rather than issuing another read. It seeds the intended
100 HP and zero armour on its randomly selected civilian. The saved input/
swing/fire/damage trace retains chain timing, queue state and target distance.
The traced trial records raw 6/9/15 moves, queued hook, knockdown and the raw
25-damage ground kick without changing player combat or its chain window.

The final player regression passes again after removing its duplicate victim
read. All 6,189 unit tests pass (51 skipped), including the native captures.
The final build and full production smoke pass as well: saved-game return,
walking, native car entry, map/waypoint, pause/resume, Rustler takeoff and
landing gear, with no page errors or failed requests.

This change covers on-foot NPC fist blows to another ped. Player melee,
armed NPC melee against other NPCs, complete task cadence, other generic
damage classes and matched retail PC combat traces remain separate work.
