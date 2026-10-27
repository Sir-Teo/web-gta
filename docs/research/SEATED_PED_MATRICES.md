# Native seated ped matrices and script offsets

The native commands use different transforms. The PC handlers at the pinned
reference make the distinction explicit:

| Command | Native behavior for a seated ped |
| --- | --- |
| GET_CHAR_COORDINATES, 00A0 | Vehicle position |
| GET_CHAR_HEADING, 0172 | GetPedOrItsVehicle heading |
| GET_OFFSET_FROM_CHAR_IN_WORLD_COORDS, 04C4 | CPed's own matrix transforms the offset |

Source: [CharacterCommands.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Scripts/Commands/CharacterCommands.cpp).
The vehicle-based coordinate/heading behavior is retained. Raw SCM regression
instructions verify it alongside 04C4, which now receives the actual seated
matrix from the host for supported player and NPC seats.

CPed::SetPedPositionInCar at PC 0x5DF910 selects GetSeatPositionInVehicle,
transforms the native dummy through the vehicle matrix, and sets the ped matrix.
Animation group 13 then adds the rear van's seat translation and quarter-turn.
Bikes use CalculateLeanMatrix: native X nose dip followed by Y lean, composed
with the vehicle, plus GetUp() * (1-cos(lean)) * boundingBox.min.z.
Sources: [Ped.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Entity/Ped/Ped.cpp),
[Bike.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Entity/Vehicle/Bike.cpp),
[Matrix.cpp](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Core/Matrix.cpp).

`nativeSeatedPedMatrix` supplies independent native position/right/forward/up
vectors while reusing math temporaries. The host exposes the matrix lazily for
players and through a separate optional NPC callback, so ordinary coordinate,
heading and health queries do not compute the seated matrix. The offset
adapter preserves its previous on-foot fallback when no seated matrix exists.
The renderer's bike drop now follows the original vehicle up vector, including
on a pitched or rolled bike.

The live player check compares all four matrix vectors to CJ's rendered root
for fifteen seat/vehicle cases: car front/rear and driver, van rear seats,
leaning and pitched/leaning bike passengers, quad/Wayfarer/aircraft passengers, and car,
bike, quad, Wayfarer, aircraft and boat drivers. It also checks the matrix immediately
after warp, before a rendered frame. The NPC check covers eighteen driver and
passenger roots in a Greenwood, Burrito, PCJ-600, quad, Wayfarer, Cargobob and Dinghy.
Both also assert the separate vehicle-based coordinate and heading commands.
The original recorded DES3 helicopter regression remains vehicle-based and
passes independently.

The NPC check exposed a stationary quad driver missing from rendering. Native
[aQuadAnimations](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Animation/AnimAssocAnimations.h)
maps both riding and stationary slots to QUAD_ride. The shipped quad.ifp has
seventeen clips and no QUAD_still. WorldBike now uses QUAD_ride at rest as well,
restoring the script driver's visible pose and CJ's stationary riding pose.
The same all-model audit found that wayfarer.ifp uses WF_* names. Driver
ride/still/lean and player/NPC passenger selection now use those native names
while retaining the wayfarer block. Bicycle passenger association slots use the
corresponding ride clip, as in aBmxAnimations, aMtbAnimations and aChoppaAnimations.
All fourteen supported classes are checked against their shipped IFPs for idle,
moving, left/right lean and passenger slots.

Explicit attachments, on-foot tilt, unseen train riders, the combine's special
chassis transform, complete boarding tasks and matched retail PC captures remain
outside this slice. Native car/bike dynamics retain the documented limitations.

Evidence: `artifacts/seated-script-matrices-before.log`,
`artifacts/seated-matrices-unit.log`, `artifacts/script-rider-matrices-browser.log`,
`artifacts/script-rider-matrices.json`, `artifacts/player-seated-matrix-browser.log`,
`artifacts/player-seated-matrix.json`, `artifacts/quad-clips.json`.

The final full unit suite passes 5,395 tests with 51 skipped
(`artifacts/seated-matrices-final-unit.log`). All three final native-model/
player/NPC matrix browser checks pass (`artifacts/seated-matrices-final-browser.log`).
The production build and complete smoke check pass under `/web-gta/` with no
browser exceptions or failed requests (`artifacts/seated-matrices-production-recheck.log`).
