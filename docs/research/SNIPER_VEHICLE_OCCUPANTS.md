# Sniper bullets and vehicle occupants

The native [CBulletInfo::Update](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/BulletInfo.cpp)
(PC `0x7360D0`) calls CheckForShootingVehicleOccupant immediately after its line
query, before switching on the hit entity type. The browser's instant-hit guns
already did this, but its separate flying sniper bullets did not: a head shot
through a car window damaged the bodywork and left its occupant untouched.

Sniper bullet segments now use the shared occupant-head test, with the native
critical-hit gate and the existing host's pedestrian damage callback. A nearer
tyre retains priority, an occupant with shot immunity is skipped and the first
line collision must be its vehicle. A seated hit ends that frame's segment at
the head intersection, then the bullet continues. Its crime uses CBulletInfo's
DAMAGE_CAR / DAMAGE_COP_CAR selection. Shooting one's own seated crew no longer
grants weapon practice, matching the on-foot exclusion.

The browser already skipped pedestrians a sniper bullet had hit before. That
authored once-per-bullet rule now includes stable negative vehicle/seat keys;
they cannot alias positive Rapier collider handles. This prevents repeated
damage to a noncritical occupant while allowing the next seat to be hit. It
does not claim complete native penetration, corpse or audio/FX equivalence.

Five focused unit cases use real Rapier collision and native weapon.dat tuning
to cover occupant transfer without simultaneous body damage, critical and cop
hits, two-seat traversal, proof/wall/tyre gates and the crew-practice exclusion.
Disabling the sniper transfer makes four of these cases fail. All 40 combined
sniper/weapon/targeting/drive-by checks pass with the transfer restored.

The live regression fires an actual native sniper round at a scripted passenger
with critical hits disabled. His health goes from 500 to 375, the host records
one 125-damage hit with weapon 34 and the bullet expires without hitting him
again. Trace: `artifacts/sniper-occupant.json`. Logs:
`artifacts/sniper-occupant-before.log`, `sniper-occupant-unit.log` and
`sniper-occupant-browser.log`.

The full run passes 5,375 tests with 51 skipped and reaches the existing
five-second timeout in the exhaustive cutscene clip audit. All 15 tests in that
file pass on recheck with a bounded 15-second budget; this covers all 5,376
active unit tests. The three combined live sniper, follower-combat and targeting
checks pass. Logs: `artifacts/sniper-final-unit-tests.log` and
`artifacts/cutscene-budget-recheck.log`.
