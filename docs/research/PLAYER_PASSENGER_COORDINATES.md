# Player passenger coordinates and facing

The player host previously reported the vehicle center and vehicle facing to
script commands while CJ was rendered in his passenger seat. A controlled live
check measured errors of 0.49–1.66 units in ordinary/van seats and 3.35 units in
the Cargobob. Van rear passenger headings were off by 90 degrees. These are
position/heading query differences, independent of boarding and camera focus.

CPed::SetPedPositionInCar at PC 0x5DF910 copies the vehicle matrix (the bike lean
matrix for bikes), transforms GetSeatPositionInVehicle into it, and makes that
the ped matrix. Animation group 13 then supplies its rear-seat translation and
facing. CPlaceable::GetHeading reads the resulting matrix's forward vector.
Sources at pinned revision 4281f82d8af83e14935ac84a69dfd1ceebb9f256:

- [Ped.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Entity/Ped/Ped.cpp)
- [Placeable.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Entity/Placeable.cpp)
- [Bike.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Entity/Vehicle/Bike.cpp)

`nativeSeatedPedPose` now composes the physics vehicle transform, native seat
point, bike lean/drop and seat facing. Passenger GET_CHAR_COORDINATES and
GET_CHAR_HEADING, and mission/player native-position consumers, use that result.
The native seat facing applies after translating the seat, so it cannot rotate
the seat position around the vehicle. Heading comes from the final forward
vector, which also captures the small projected heading change on a leaning
bike. The helper reuses math temporaries but returns independent points.

CalculateLeanMatrix drops a bike along its original vehicle up vector. The
renderer now applies that same direction when the bike is pitched or rolled,
so its drawn passenger and script origin agree there too. The internal vehicle
center continues to own simulation/camera focus and driver controls.

The new live regression failed before the fix. It compares script queries with
CJ's actual rendered root for Greenwood front/rear seats, both inward-facing van
rear seats, a quad, a Cargobob, and a motorcycle both leaning and pitched/leaning.
It also checks queries immediately after the warp, before a render frame.
The recorded DES3 helicopter check now verifies CJ at the transformed seat
while the original playback moves and rotates the body, plus warp-out/deletion.
The old assertion requiring CJ within one unit of the Cargobob center was
inconsistent with its original seat dummy and has been replaced by that check.

This establishes these passenger query bindings. Driver, boat and train seat
query parity, the combine's special chassis matrix, full native passenger tasks
and matched retail PC traces remain separate work.

Evidence: `artifacts/player-passenger-coordinates-before.log`,
`artifacts/player-passenger-coordinates.json`, `artifacts/passenger-coordinates-recheck.log`
and `artifacts/passenger-coordinates-unit.log`. The unit checks cover axes,
seat-facing order, lean/drop, tilted up-vector projection and independent results.

The full unit suite passes 5,393 tests with 51 skipped. The immediate-query
regression passes, including pitched/leaning bike geometry; recorded Cargobob
playback passes with the corrected seat-origin assertion. Six additional script
entry/exit, blocked-exit, moving bail-out and phone-passenger checks pass. Logs:
`artifacts/passenger-coordinates-full-unit.log`,
`artifacts/passenger-immediate-coordinates.log`,
`artifacts/passenger-coordinate-regressions.log`. The production build passes
(`artifacts/passenger-coordinates-build.log`).
The complete production check also passes under `/web-gta/` with no browser
exceptions or failed HTTP requests (`artifacts/passenger-coordinates-production.log`).
