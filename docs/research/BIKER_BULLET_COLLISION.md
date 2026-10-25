# Direct animated collision for script bike riders

Script motorcycle and bicycle riders now take bullets against their animated
pedestrian collision model even when the ray misses the vehicle entirely.
Previously the host required a vehicle-body hit before testing its seated
occupants, so a horizontal shot through an exposed rider could pass through.
The car/window occupant handoff remains a separate head-sphere path.

PC CWorld::ProcessLineOfSightSectorList (0x566EE0) includes a collision-disabled
ped when `bIncludeBikers && ped.bTestForShotInVehicle`. Both instant-hit fire and
CBulletInfo::Update set bIncludeBikers. This branch calls
CPedModelInfo::AnimatePedColModelSkinned, rather than requiring a vehicle hit.
CreateHitColModelSkinned (0x4C6D90) and AnimatePedColModelSkinnedWorld (0x4C7170)
establish the original bone-bound sphere transform and body-piece IDs.

The twelve-node table is PC 0x8A6308, absent from the reversed implementation.
It is captured from the pinned executable's ARM64 table at 0x10064afc8, with
32-byte records. All twelve records agree with its ARMv7 slice, whose records
take 28 bytes. Each sphere has a bone, a local X offset, radius and piece ID:
head; two torso spheres; midsection; four arm spheres; and four leg spheres.
The head radius is 0.15 with a local bone offset of 0.05. This differs from the
vehicle-occupant handoff's 0.2 sphere lifted 0.1 over the head node.

NativeCharacter transforms these centers through the currently sampled bone
matrices. The weapon system finds the nearest body piece before the first
world collision, preserving nearer cover and tyres. Only a head piece receives
the existing critical-hit rule. Player shotgun pellets accumulate on the same
rider, and flying sniper rounds use the existing stable seat key to avoid
damaging that rider again on a later flight step. The ordinary muzzle path,
scripted drive-by and gang drive-by adapters can reach the direct model without
a physical collider hit; they receive the first world/tyre distance for occlusion.
Foot NPC shotgun pellets can also accumulate against that same direct victim.
Instant-hit blood reads the damage result before choosing the native head
scale; CBulletInfo sniper impacts keep their fixed eight-particle rule.

The expensive skeleton query is lazy: aim-target enumeration never requests the
twelve spheres. Bullet traces request a bike-only roster, avoiding unrelated
traffic/police/passenger head queries on every sniper flight step. Script bike
corpses use the native CAR_dead_LHS/RHS association instead of continuing their
live rider pose, matching the seated task selected by moving non-automobiles.

Sources at revision 4281f82d8af83e14935ac84a69dfd1ceebb9f256:
[World.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/World.cpp),
[PedModelInfo.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Models/PedModelInfo.cpp),
[BulletInfo.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/BulletInfo.cpp),
[Weapon.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Weapon.cpp),
[TaskComplexDieInCar.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Tasks/TaskTypes/TaskComplexDieInCar.cpp).
The [table capture](ped-hit-spheres-capture.json) is reproducible:

```
node scripts/content/capture-ped-hit-spheres.mjs [path-to-pinned-executable]
```

Units compare the host table with captured records and exercise body/limb/head
damage, a ray missing the vehicle, cover, shot protection, own-vehicle exclusion,
ordinary-car exclusion, nearer tyres, shotgun accumulation and once-per-sniper
damage. NPC adapter checks cover lines with and without a physical body hit.
The live regression loads the original BMX and PCJ-600 driver/pillion models,
checks all twelve rendered spheres, fires an actual sniper body shot, exercises
a real cop muzzle, checks cover/protection and fires at an exposed head surface.
It also checks the resulting dead-seat clips. A side-on pillion head shot can
correctly hit the raised arm first; the test preserves that nearest-piece result.

Remaining scope: the native writer of bTestForShotInVehicle is still unidentified.
The host enables this path for its existing motorcycle/bicycle rider class and
preserves SET_CHAR_CAN_BE_SHOT_IN_VEHICLE protection. Quad eligibility is left
on the existing vehicle-occupant path. The player bike capsule and ordinary
on-foot collision/classification are still approximations. Full stationary
leave-and-die tasks, biker knock-off/death transitions, weapon-event/stat/crime
parity and original-game comparison remain open. These traces use the last
sampled rendered skeleton; they do not establish complete native combat parity.
