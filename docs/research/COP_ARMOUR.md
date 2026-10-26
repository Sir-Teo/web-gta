# Cop health, armour and crew transitions

Ambient cops now have 100 health and separate armour instead of the previous
combined-health approximation. The existing model-to-cop-type rosters assign
50 armour to SWAT, 100 to FBI and army, and zero to city/countryside officers.
Player hits on seated police crews retain the raw weapon factor, absorb armour
and apply forced head death afterwards. Repeated hits during a dead driver's
coast return the dead result without spending more armour.

## PC source

The reversed CCopPed constructor at PC `0x5DDC60` explicitly calls SetArmour(50)
for COP_TYPE_SWAT1/SWAT2, SetArmour(100) for COP_TYPE_FBI and COP_TYPE_ARMY,
and SetArmour(0) in the ordinary case. Its base CPed has 100 health. The model
mapping here applies to the cop-type rosters already selected by policeCrew
and officer spawns, rather than claiming every arbitrary model-ID constructor
argument receives the special cop-type branch.

Pinned reference revision:
`4281f82d8af83e14935ac84a69dfd1ceebb9f256`,
`source/game_sa/Entity/Ped/CopPed.cpp` and `Ped.cpp`.
Armour absorption/death ordering is documented in [script ped armour](SCRIPT_PED_ARMOUR.md).

## Preserving the same cop

Police unit seats retain both health and armour. A crew exit or roadblock
placement passes their current values to the walking cop, including exits from
a vehicle CJ took. A returning cop's live values are captured before boarding,
including a move to a different seat. Live drag-out descriptions carry the
same values into the officer spawned after the drag animation.

Unit checks cover starting values, absorption, forced death, corpse/coast
contacts, exit/drag-out descriptions and return-to-another-seat capture.
Original-model browser checks cover the four officer classes through body
hits, falls, drowning and forced heads. A native FBI crew trial exercises its
animated exit and return with armour already spent.

The host still uses separate browser bodies for vehicle and foot states.
Other CPed fields, ambient NPC-to-police seated routing, dead-body reconstruction
and complete crew kill accounting/task equivalence remain open. This change
does not establish complete population or pursuit parity with retail PC 1.0.

The live FBI trial sets the wanted maximum to six through the game API before
requesting five stars; the opening campaign cap is four. It observes an actual
dispatched FBI unit, requests its normal animated exit, wounds the walking
cop, then clears wanted so its ordinary return/entry tasks run. Armour moves
100 → 75 in the seat → 75 outside → 50 after the next body hit → 50 back in the
car. A real player pistol head hit then leaves 0 HP and 25 armour, emits 32
blood particles after damage and preserves vehicle health during that shot.
The trial controls the muzzle and spread and is not a matched retail input
capture.

Validation includes 27 focused units, the full suite (5,672 passed, 51 skipped),
the production build, both live armour trials and six surrounding pursuit,
entry/exit, jacking and driver-death browser regressions, plus the roadblock crew check.
