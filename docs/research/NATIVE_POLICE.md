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
