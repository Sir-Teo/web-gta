# Police crews returning to their cars

Police units (`src/simulation/WorldPolice.ts`) chase the player with the CCarAI missions, stop beside a player on foot or in a stopped car, and send their crew out through the native get-out clips. Crew members become armed street officers (`src/simulation/WorldPedestrians.ts`) that remember which unit and seat they left.

## Sources

- gta-reversed revision `0076f9017b4aeef7433957ac2bd8b6988e9df166`: `Tasks/TaskTypes/TaskComplexCopInCar.cpp` (fully reversed: `CreateSubTask`, `CreateFirstSubTask`, `CreateNextSubTask`, `ControlSubTask`, `MakeAbortable`), `TaskComplexPolicePursuit.cpp` (`GetNextSubTaskType`, `PersistPursuit`), `TaskComplexGoToCarDoorAndStandStill.cpp` and `TaskComplexEnterCar.cpp` (the go-to-door task's 0.5 radius, 4-unit slow-down distance, 50-unit and 30-second limits), `Entity/Vehicle/Vehicle.cpp` (`IsOnItsSide`).

## Behaviour

- A cop on foot gets back into the car it arrived in when the player drives a different vehicle, the cop is within 4 units of the car, and that vehicle is not crawling (`|m_vecMoveSpeed|² × TimeStep × 50 ≤ 1`, 5.5 m/s at 30 fps) within 10 units of the cop. The car must have health left, not be burning and not lie on its side (right vector within 0.8 of vertical).
- Once the wanted level is clear, `CTaskComplexPolicePursuit` sends cops back to their vehicles (the entry is limited to the go-to-door task's 50 units).
- The cop runs to the door point and walks inside 4 units, then the car's anim group plays align, open (unless the door is already open or missing, or the group never opens doors), get in, and close from inside (unless the group skips it). The door follows `CVehicle::ProcessOpenDoor`'s windows.
- A driver back in the seat takes `CTaskComplexCarDriveMission` at once: the unit resumes its far/close chase (or cruises when the wanted level is clear), even if a partner is still outside.

## Reconstructions

- The reversed tasks let the partner re-enter from `ControlSubTask` and the original driver only after its pursuit subtask ends; the browser's street officers have no pursuit-membership state, so both use the same test. When two cops return, the one nearest the driver's door takes the wheel and the other takes its own seat, or another passenger seat with a door, rather than jacking the driver.
- A cop that cannot reach the door within 30 seconds or strays beyond 50 units resumes the pursuit.

## Verification

- `tests/cop-in-car.test.ts`: the 4-unit, crawling-vehicle, 10-unit and unusable-car rules, and the clear-wanted return range.
- `tests/browser/police.spec.ts`: an LAPD car stops beside the player on foot and both officers climb out; while the player sits in a car next to them nobody returns; once the player drives off at 12 m/s both officers walk back, the driver climbs in through the door it left open (align, get in, close from inside), the partner takes the passenger seat, the door ends closed and the car resumes the chase.

## Roadblocks

`CRoadBlocks::Init` (roadblox.dat: int32 count plus 325 `{int16 area, uint16 node}` entries) is covered by `src/assets/roadblox.ts`, but no retail table is local, so candidates come from the streamed car-path network instead. At three or more stars, with the player driving above 5 m/s, one unit parks across the longest link ahead of the car (40–100 units along its velocity, within 12 units of its line, 15 s cooldown) with sirens on, and its crew exits to hold the block; `CreateRoadBlockBetween2Points` itself is still a plugin call upstream, so the paired-car placement and `GenerateRoadBlockPedsForCar` offsets are authored. The block dissolves below three stars or once the player leaves (120 units), and the crew then reboards through the returning-officer path. Covered by `tests/roadblox.test.ts` (table format plus longest-ahead-link choice and the across-road heading).

## End of a far-mission route

- A police car on a FAR mission routes over the car paths to the node nearest
  the player. Before this fix, a car that reached the end of that route took
  the longest road leading on and drove away, then re-routed back three
  seconds later. Near a player on foot it could circle for as long as the
  wanted level lasted.
- Now, with the route used up and the player within 60 units, the car stays on
  its last link and drives at the player. The existing close switch (20 units,
  or 40 head-on) and the crew exit at 10 units then take over.
- This is authored: the native car AI stops at the route's end, but when its
  crew leaves the car there is set in stubbed code.
