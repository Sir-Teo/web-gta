# Aircraft passenger warps and transport

Interdiction's original instruction at MAIN.SCM offset 1951143 seats CJ in the
Cargobob's first passenger seat. The host accepted only automobiles and gave up
with WARP_CHAR_INTO_CAR_AS_PASSENGER. The exact instruction is preserved in
`tests/browser/script-heli-passenger.spec.ts`; the failed trace is
`artifacts/script-heli-passenger-before.json`.

The player can now take an aircraft passenger seat through the immediate warp
path. WorldPlane keeps a passenger seat independently from its pilot/remote
control flags. Boarding preserves its AI and recorded playback, disables CJ's
on-foot collision and excludes the aircraft from his camera collision. Its
normal after-step synchronization carries him with the aircraft. Warp-out and
vehicle deletion clear the passenger state and restore collision; accepted
aircraft destruction kills the player aboard even when he is not its pilot.

Passengers use the existing aircraft follow-camera distance, including the larger
minimum required by the Cargobob. Terrain replacement treats an aircraft passenger
as airborne, as it already does for a pilot, so it does not wait for on-foot
ground support.

The passenger is drawn with CAR_SITP at the existing native seat helper's point.
The live Cargobob copilot point is its raw ped_frontseat dummy:
(0.43751809, 3.27016497, 0.59916973) in native model coordinates. Capacity uses
the existing GetMaximumNumberOfPassengersFromNumberOfDoors rules; this Cargobob
has one passenger seat. The script's passenger-seat lookup, free-seat predicate
and passenger count now include CJ, alongside NPC passengers. Aircraft weapon
target selection includes a player passenger without assigning him controls.

## Source and checks

The pinned reference revision 4281f82d8af83e14935ac84a69dfd1ceebb9f256 has no
vehicle-family restriction in CharacterCommands.cpp WarpCharIntoCarAsPassenger:
it computes the passenger door, flushes the ped's tasks and processes
CTaskSimpleCarSetPedInAsPassenger. Its ProcessPed is a retail call in that
reference. This change connects the host's immediate warp and transport state;
it does not claim a newly captured complete native boarding task.

Seat positioning reuses CPed::GetSeatPositionInVehicle at iOS 0x10032bd40 through
nativeSeatPosition.ts, and capacity reuses nativeVehiclePassengers.ts. Tests
exercise the existing seat/capacity rules, real Rapier-body passenger following,
exit and destruction, player/NPC seat queries and enemy aircraft targeting a
passenger vehicle. The aircraft retains its AI physical/control mode; boarding
does not turn it into a player-piloted aircraft.

The focused live check executes DES3's exact original warp with its original
local/parameter layout. It preserves HELI_GOTO_COORDS, checks the rendered
copilot point, starts the mission's actual recording 530, holds a movement key
and observes about 35 metres of transport without pilot/remote ownership. CJ's
script position follows the aircraft. Warp-out leaves playback running, and
reboarding followed by deletion restores collision and leaves CJ unfrozen.
Skipped commands, give-ups and page errors are empty. Trace:
`artifacts/script-heli-passenger.json`.

This validates immediate seating and controlled transport mechanics. The full
Interdiction defence, cargo retrieval and result remain unverified. Walking
through aircraft doors, full native boarding/exit choreography and complete
passenger combat/rendering parity remain separate work.

## Final verification

All 5,360 unit tests pass (51 skipped), and the build passes. Seven combined
browser regressions cover aircraft transport, natural automobile passenger entry,
four automobile passenger exit/cleanup cases and occupied-vehicle teleporting.
The additional camera regression first fails with the old 9-metre setting, then
passes with the existing 22-metre aircraft setting. The inspected riding screenshot
shows the entire Cargobob from behind; the measured camera distance is 23.66 metres.
No ground-support warnings occur in that final run. Logs:
`artifacts/aircraft-passenger-regressions-browser.log`,
`artifacts/aircraft-passenger-camera-distance-before-browser.log`,
`artifacts/aircraft-passenger-camera-browser.log` and
`artifacts/aircraft-passenger-camera-build.log`.
