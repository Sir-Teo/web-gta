# Whole-pool damage flags and nearby vehicle fires

SET_ALL_CARS_CAN_BE_DAMAGED previously updated only the fleet's automobiles.
Bikes, boats, aircraft and trains kept their previous flags. The callback also
omitted the native command's nearby-fire cleanup when disabling damage.

The fleet now applies the flag to every current valid vehicle across its five
collections. Wrecked vehicles remain valid entries; disposed entries are skipped.
The operation changes existing entries without imposing a policy on later
spawns. Trains expose the same flag, without adding train weapon-damage physics.
Player-safety and resurrection cleanup use this shared whole-pool write too.

When the command disables damage, the handler also extinguishes vehicle fires
strictly inside 4000 units of CJ's native origin. The host raises non-wrecked
health to at least 300, clears represented automobile/aircraft burn timers and
removes attached fires after clearing their script flag. Player-safety's vehicle
fire cleanup uses the same complete traversal. General CDamageManager engine
status remains unmodeled here, including its native 225-to-215 adjustment; this
does not add complete engine damage or general fire parity.

Pending bomb timers still count down while protected. The destruction entry
refuses the expired blast, without making the vehicle a wreck or replaying the
blast after protection is released. Accepted destruction resets any recovered
health to zero. See the separate [destruction captures](VEHICLE_DESTRUCTION_GATES.md).

`scripts/research/native-all-vehicle-damage.py` runs the pinned iOS executable in
Unicorn 2.1.4 and verifies SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
Twenty cases execute the command at `0x1001e0f7c`, the complete flag traversal at
`0x100276910` and the complete fire-selection traversal at `0x10027652c`.
Only parameter collection, player coordinates and selected ExtinguishCarFire
calls are intercepted; the latter's internal engine/CFire behavior is outside
these captures.

The pool stride is 0xc68. Slots with allocation bit 0x80 are skipped; valid slots
have only bit 21 of the flag word at +0x568 replaced. No vehicle-type filter is
used. Nonzero command arguments normalize to enabled. The false branch supplies
radius 4000. Float32 subtraction, square/add order and the strict radius check
execute natively: exactly 4000 is excluded, and coordinate rounding matters.

The pinned PC CWorld::SetAllCarsCanBeDamaged at `0x5668F0` confirms the complete
valid pool. PlayerInfo::MakePlayerSafe calls it with the inverse safety flag.
Native unit comparisons cover all twenty cases, including mixed families,
invalid/empty slots, raw boolean arguments and distance boundaries. Two further
checks cover future spawns, wrecked health, burn timers and attached-fire visits.
All 4,404 unit tests pass (51 skipped), and the build passes.

Three browser regressions pass. `all-vehicle-damage.spec.ts` executes the actual
SCM command against a Landstalker, BMX, Tropic, Maverick, Beagle and Freight. It
checks all flags, health recovery, automobile/aircraft burn timers and attached
fire removal, then verifies a new Maverick keeps its default flag. Global enable
and player-safety release restore every class. The existing player-proof/respawn
check also passes, as does SYN6's original combat, native result, rewards and
cleanup from controlled checkpoints. Historical sweep bytes are unchanged.
