# Anonymous vehicle attacker storage

FireOneInstantHitRound always calls vehicle damage with a null attacker. The
host routed that as byPlayer false without an entity, which cleared the
previous damager reference. The selected native InflictDamage instead leaves
the old reference intact while storing the new weapon. That distinction is
observable to HAS_CAR_BEEN_DAMAGED_BY_CHAR and related history queries.

## Evidence

The pinned PC CVehicle::InflictDamage (`0x6D7C90`) remains a retail delegate.
The existing independent `native-vehicle-damage-gates.json` fixture executes
the selected iOS storage fragment `0x10047853c..0x100478574`; the null-source
skip is at `0x100478548..0x100478564`. It is pinned to executable SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.

Its null-source cases retain an absent, player or other-entity reference and
still store the incoming weapon. CWeapon::FireOneInstantHitRound, PC
`0x73AF00`, supplies the null argument explicitly in its reversed body.
This establishes the represented storage behavior, without claiming an
independent original-PC InflictDamage capture.

## Change

The shared damage recorder and car/bike/boat/aircraft damage inputs accept an
explicit null attacker. `by: null` preserves the old reference after storing
the accepted weapon. The anonymous-round backend passes it alongside byPlayer
false, so non-player immunity and proof gates still run normally.

A missing entity with byPlayer false keeps the existing unknown non-player
behavior of clearing the old reference. A known entity still replaces it.
The stored history field remains an optional entity record; the API's null
marker is not stored into that field. Rejected or already-dead targets keep
both their weapon and source history.

## Checks

Seventeen new checks expose the mismatch before the repair. The captured
null-source rows run through all four vehicle hosts, preserving reference
identity and updating the weapon. Other checks distinguish null, unknown and
known sources, retain proof/player-only/dead-target rejection, and fire an
actual anonymous round into a boat after earlier player damage.

The live Predator/SCM fixture seeds a real player-caused hull wound, then fires
FIRE_SINGLE_BULLET into the same hull. Health decreases, weapon 28 replaces the
previous weapon, the original damager object remains identical, and
HAS_CAR_BEEN_DAMAGED_BY_CHAR for CJ stays true before and after the anonymous
round. Existing gun gates, NPC anonymous damage, native contact audio,
protected hull and high-water-probe checks pass in the same run without page
errors.

This change covers explicit null source storage. Complete native entity
reference lifetime and source identity for other host damage paths remain
separate work.

All 657 focused checks and 6,937 unit tests pass (51 skipped). The first full
run exposed repeated whole-program decoding in a camera test's lookup helper,
which crossed its five-second deadline under load. The unchanged test passed
alone; a shared decoded catalog now supplies independent script-memory copies
to the same six assertions, with no timeout increase. The full rerun passes.
The final TypeScript/build validation passes as well.
Normal production smoke passes saved-game return, movement, car entry,
map/waypoint, pause/resume, Rustler takeoff and landing gear, without page
errors, failed requests or a development inspection hook.
