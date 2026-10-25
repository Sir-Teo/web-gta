# Scripted car passenger seats

Scripted automobile passengers now render in both rear seats and participate in
the same seated-head bullet checks as front occupants. Previously the mission
kept rear passengers alive and seated, but the host explicitly skipped their
render poses and bullet targets.

`WorldCar.seatPosition` reuses `nativeSeatPosition.ts`, the existing port of
CPed::GetSeatPositionInVehicle (iOS `0x10032bd40`). The driver uses the mirrored
front dummy, passenger 0 the front dummy, passenger 1 the mirrored rear dummy,
and passenger 2 the rear dummy. Quad passenger 0 uses its back dummy. Missing
dummies keep the native zero-position fallback. Both rendered poses and bullet
targets call this same method, and target identities retain separate indices
for every seat. Attached peds retain their explicit offsets.

The [pinned PC reference](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Entity/Ped/Ped.cpp)
agrees on these seat/dummy rules. The van-specific rotation in
SetPedPositionInCar remains separate; this change uses the existing ordinary
automobile pose.

The live `script-car-passengers` regression uses a native Greenwood and four
scripted peds. It checks the actual front/rear dummies, waits for all four drawn
head nodes, directs individual head rays at every seat, excludes the shooter's
own car, toggles a rear passenger's shot immunity, applies nonfatal and fatal
damage, follows a translated car and removes the occupants and vehicle.
`native-seat-position`, `vehicle-targeting` and `script-rider-death` provide the
existing focused algorithm and lifecycle checks.

This connects existing native seat math to the live game. It does not establish
complete native boarding, drive-by muzzle placement, collision or death-task
parity. Recruited street followers use a separate passenger store; their combat
integration remains separate work.

Verification on October 25: the build and seven passenger/targeting/drive-by
browser checks pass. The full unit run passes 5,358 tests with 51 skipped and
hits the existing five-second limit in two native-data scans; both affected
files pass all 21 tests when rerun alone (5,360 passing tests across the run and
recheck). Logs are in `artifacts/car-passenger-browser.log`, `build.log`,
`unit-tests.log` and `unit-timeout-recheck.log`.
