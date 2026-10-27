# Player motorcycle and quad passengers

The player bridge for WARP_CHAR_INTO_CAR_AS_PASSENGER now accepts WorldBike,
including the quad, alongside cars and aircraft. The task adapter shares the
same boarding function. Bikes expose one passenger seat only when their model
has ped_backseat; bicycles without that dummy reject the warp.

CPed::GetSeatPositionInVehicle (the reference helper used by SetPedPositionInCar) selects the backseat for a bike's
first passenger and for an automobile with the quad model flag. The quad runs
through WorldBike in this port, so both paths use its backseat dummy directly.
CJ holds the final pose of the model's native ride-group passenger clip, such
as bikes_passenger or quad_passenger, through the existing vehicle render frame.
The script driver's seat remains independent.

Source: [Ped.cpp at the pinned PC reference](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Entity/Ped/Ped.cpp).

Passenger occupancy disables CJ's foot collider and follows the real bike body
without setting occupied or replacing the driver, autopilot or recording.
Warp-out and deletion restore his collider. Destruction kills the passenger;
collision, water and explosion ejections clear passenger occupancy while keeping
the existing fall response. The host clears the render seat after such an
ejection without resetting the fall's momentum.

CVehicle::CanPedJumpOutCar (PC 0x6D2030) permits a bike pillion to jump when
planar velocity squared reaches 0.07 native units per frame squared. The quad
uses the automobile window, 0.1 through 0.5, with the existing tilted/recent-hit
exception and slowdown. Source: [Vehicle.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Entity/Vehicle/Vehicle.cpp).

`tests/bike-passenger.test.ts` covers physics following, driver/playback ownership,
warp-out, missing rear dummy, destruction and the distinct jump thresholds.
The live quad and PCJ-600 checks measure CJ's rendered root against the original
backseat dummy, verify the native clip, NPC driver and script passenger queries,
hold W without taking control, move the real body, warp out, trigger an explosion
ejection and delete the ride. Both bike/quad cases pass, alongside seven combined
car, bike and helicopter transport regressions. The production build passes.
Evidence is under `artifacts/bike-passenger-*`.

This change does not establish complete native passenger mount/exit animation
tasks, bike passenger drive-bys for CJ, street-follower bike recruitment, or
original bike dynamics. Those remain separate fidelity work.
