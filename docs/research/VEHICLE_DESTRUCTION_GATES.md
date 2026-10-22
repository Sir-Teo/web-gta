# Vehicle destruction immunity and wrecked status

An armed delayed blast could previously destroy a protected motorbike, boat or
aircraft. Disabling damage globally also extinguishes nearby vehicle fires and
raises non-wrecked health to 300. The old aircraft destruction path then emitted
its explosion without resetting that recovered health. Its health-derived
`wrecked` getter also treated a protected zero-health aircraft as dead and let a
health write revive an existing wreck in script queries.

The destruction entry points now honor `canBeDamaged`. Accepted destruction
zeros health and the pending bomb timer. Aircraft retain an explicit wrecked
status, independent of later health or timer writes. A refused timed explosion
consumes its timer without producing a blast or becoming a wreck; enabling damage
later does not replay it. This follows the existing native countdown and its
virtual destruction call, rather than postponing the countdown during immunity.

Both capture scripts run the pinned iOS executable in Unicorn 2.1.4 and verify
SHA-256 `9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.

`scripts/research/native-vehicle-destruction-gates.py` establishes the actual
virtual methods using each recorded vtable's +0x150 entry:

| Class | BlowUpCar | Health/timer stores |
| --- | --- | --- |
| Bike | `0x1004566d4` | `0x100456744` |
| Boat | `0x10045c9c4` | `0x10045ca2c` |
| Helicopter | `0x100467858` | `0x100467a84` |
| Plane | `0x10046d550` | `0x10046d8a0` |

Ninety-six entry captures vary damage protection, health, packed status and the
hide-explosion argument. Protected entries execute through the complete native
return without changing object memory. Enabled entries stop at the destruction
body. Thirty-six separate two-instruction captures prove the zero health/timer
stores across three incoming health and timer values. These fragments do not
establish complete destruction effects, occupants, debris or event behavior.

`scripts/research/native-vehicle-dead-query.py` runs the IS_CAR_DEAD handler at
`0x1001d0f48`. Only parameter collection and the comparison sink are intercepted;
the native pool lookup and condition selection execute. Seventy-five captures
cover valid and invalid handles, four packed status values, three health values,
three timer values and drowning. Invalid handles return true. Valid handles
return true when `(status & 0xf8) == 0x28` or the drowning flag is set. Neither
health nor the pending timer determines this predicate.

The destruction tests exposed 80 failures before the fix. The previous aircraft
getter disagreed with eleven of the 75 native predicate cases. Current tests
compare actual class entry points and timer handoff, and execute both normal and
negated SCM conditions. All 4,617 unit tests pass (51 skipped); the build passes.

The Chromium regression `vehicle-destruction-immunity.spec.ts` passes nine live
cases across a PCJ-600, Tropic and Maverick. Actual weapon-system blasts arm the
timers. Global protection heals each vehicle to 300; individual protection keeps
its zero health. Both refuse destruction without becoming wrecks. Disabling then
restoring global damage before expiry produces a player-attributed secondary
blast, zero health and a wreck. Releasing protection after a refused blast does
not replay it. Observations are in `artifacts/vehicle-destruction-immunity.json`.
SYN6's controlled original combat/result/reward regression also passes alongside
it. Historical mission sweep bytes remain unchanged.

See also [whole-pool flags and nearby fire cleanup](GLOBAL_VEHICLE_DAMAGE.md),
[delayed-blast creator and countdown](VEHICLE_BLAST_CREATOR.md) and
[weapon damage gates](VEHICLE_DAMAGE_GATES.md). Full native destruction effects
and a matched PC executable capture remain outside these checks.
