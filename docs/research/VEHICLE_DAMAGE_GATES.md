# Captured vehicle damage gates and attacker storage

Script damage flags were assigned to bikes, boats and aircraft, but their weapon
damage methods did not read those flags or keep the last weapon and attacker.
The common script queries consequently could not identify CJ's hit on an aircraft,
including SYN6's later HAS_CAR_BEEN_DAMAGED_BY_CHAR check.

The weapon paths now honor bCanBeDamaged, the player-only gate and the five physical
proofs, retaining their existing occupied-vehicle scaling, aircraft scaling and
destruction timers. Accepted damage records its weapon and attacker before scaling.
Cars also retain the previous attacker when a subsequent hit has no source: the
native routine updates the reference only for a non-null attacker. A known other
attacker replaces it; a host that knows only that the hit was non-player clears
the old player attribution without inventing an entity identity.

The iOS physical proof helper also rejects Molotov damage for explosion proof,
in addition to fire proof. The shared physical helper now applies that rule to
its other consumers. The pinned PC reversal checks only fire proof for Molotovs;
this difference is established by executable capture.

`scripts/research/native-vehicle-damage-gates.py` runs in Unicorn 2.1.4 against
executable SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.

- All of CanVehicleBeDamaged at `0x1004780a8` and its CPhysical helper at
  `0x100252b84` execute. Only player and player-vehicle lookups are supplied.
  The 418 cases cover weapons 0–60 against each individual proof, player-only
  sources, occupied health around 249/250 (including float32 rounding), disabled damage
  and the attached-player gate. Three newly captured boundary cases failed until
  the health comparison read the native float32 value.
- Twelve cases execute InflictDamage's storage fragment from `0x10047853c` to
  `0x100478574`, including native health subtraction. Reference registration is
  intercepted. A null source retains the previous reference. These captures do
  not execute later events, component damage or destruction.
- Unit tests compare every captured gate and storage result and exercise all
  four live-class damage methods for rejection, acceptance, source replacement
  and zero-health metadata preservation. All 4,258 unit tests pass (51 skipped),
  and the build passes. Both browser regressions pass: the existing car-ram
  attribution check and live M4 hits against a Landstalker, BMX, Tropic, Maverick
  and Beagle. The latter checks script immunity and bullet proof, then verifies
  health loss, weapon 31 and CJ attribution after those gates clear. Its isolated
  arena stays within the bike's ground-loading probe, and each collision body
  must be enabled before firing. This is controlled damage coverage.

The generic host still has incomplete attacker identities for some NPC weapon
and blast paths. The gate can represent an attached player's refused shot, but
this change does not add general player attachment. Collision responses, visible
damage and script-directed destruction retain their existing separate paths;
these checks cover weapon damage. The controlled [SYN6 result and reward
regression](SYN6_VALIDATION.md) passes; an uninterrupted play-through remains unverified.
Subsequent [blast-creator captures](VEHICLE_BLAST_CREATOR.md) cover delayed
explosion attribution and timer rounding separately.
