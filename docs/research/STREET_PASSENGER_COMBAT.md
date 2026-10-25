# Street follower combat in vehicles

Street recruits now participate in the existing seated-head bullet path. Their
targets use the same native seat dummies and rendered head nodes as their ride
poses. The original code only enumerated traffic drivers, police/gang crews and
mission riders, leaving recruits stored by CarEntry immune while riding.

Boarding retains health, the pedestrian's defense multiplier, critical-hit and
targeting flags, weapons, identity and member slot. Noncritical damage follows
the existing on-foot AccountForPedDamageStats rules (iOS `0x10028a070`), including
the player's reduced damage to followers. A critical instant-hit headshot
bypasses these reductions. Wounds survive the return to the street.

Foot NPCs, including police, and gang-car shooters now ask the same
CheckForShootingVehicleOccupant adapter as scripted drive-bys. The first ray hit
must still be the vehicle; a nearer tyre takes precedence, and the shooter's
own body/car remains excluded. These NPC hooks currently transfer hits only to
mission riders and street followers. Other driver/crew damage paths retain
their existing coverage.

The [pinned PC DieInCar task](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Tasks/TaskTypes/TaskComplexDieInCar.cpp)
chooses an immediate exit when the car can be stepped out of; a passenger in a
moving car dies seated, using CAR_DEAD_RHS. The host now keeps this distinction.
It clears a killed follower's drive-by, reports the kill once with its player/
NPC attribution and excludes it from the living group. A seated corpse remains
in its vehicle after CJ leaves and reserves its seat if he returns. Retiring the
vehicle retires the retained corpse. A corpse placed outside is rebuilt dead,
without another kill event or cash from dying inside a vehicle.

The exit placement is the existing authored placement at the passenger's door;
full native leave-and-die animation/task choreography, all damage-event
responses and complete NPC combat equivalence remain unverified.

Focused checks:

- `passenger-damage.test.ts`: retained wounds, friendly scaling, critical death,
  corpse pose/lifetime, exit timing, death attribution, seat ownership and
  disposed/wrecked exclusions.
- `npc-seated-shot.test.ts`: the gang shooter's muzzle hit transfers to an
  occupant without also damaging the car.
- `street-passenger-damage.spec.ts`: live native head rays, wound preservation,
  a real foot cop's muzzle ray, group/kill statistics, corpse retention and
  vehicle disposal.

All eight new unit checks and the 12 combined browser regressions pass on
October 25. The browser run also covers ordinary entry/exit, a moving-car
roll-out, NPC jacking, bike targeting and scripted/group drive-bys. Logs:
`artifacts/passenger-combat-regressions.log` and
`artifacts/passenger-combat-build.log`.
