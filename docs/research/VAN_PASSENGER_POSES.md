# Van rear-seat positions and facing

CPed::SetPedPositionInCar at PC `0x5DF910` has a special transform for handling
animation group 13, used by the Pony, Rumpo, Burrito, ambulance and Enforcer:

- Passenger 1 (the left rear seat) moves 0.6 forward from its seat dummy and
  turns -pi/2 relative to the vehicle.
- Passenger 2 turns +pi/2 with no additional translation.
- The driver, front passenger and other animation groups retain their ordinary
  seat positions and facing.

The rear passengers therefore face inward. Source:
[Ped.cpp at the pinned PC reference](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Entity/Ped/Ped.cpp).
The native Z rotation maps to the same-signed renderer Y rotation; the extra
translation stays in the vehicle frame. The raw model dummy is unchanged.

`nativeCarSeatPose` now feeds script riders, CJ's passenger pose, recruited
street followers and seated police crews. Rendered bodies and bullet targets
share the adjusted point and facing. Before a head model is available, the
head-position fallback rotates its offset by that facing too. The Enforcer's
rear seated death pose uses CAR_DEAD_RHS, as DieInCar selects for all passengers,
while its driver uses CAR_DEAD_LHS.

Focused algorithm checks cover the native offsets and groups, fallback aim and
head-ray intersections, and Enforcer rendering/target binding. The live native
Burrito check measures actual character-root positions and forward vectors for
all four scripted seats, CJ's rear seat and both recruited rear passengers.
The ordinary-car and passenger-combat regressions pass alongside it. Logs:
`artifacts/van-passenger-browser.log`; screenshot: `artifacts/van-passengers.png`.

This verifies this native seating transform and its host bindings. Complete
native boarding/exit tasks, van drive-by choreography and the combine's separate
chassis/seat transform remain outside this change.

The full unit suite passes 5,371 tests with 51 skipped on October 25. All three
combined car/street/van browser checks pass. Logs:
`artifacts/final-unit-tests.log` and `artifacts/van-passenger-build.log`.
