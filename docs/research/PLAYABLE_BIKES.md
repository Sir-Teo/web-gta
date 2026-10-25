# Playable bikes

## Source audit

- Fourteen `bike`/`bmx`/`quad` definitions resolve with models, textures, collision and car-like handling rows (`static-world-vehicle-audit` scope): Pizzaboy 448, PCJ-600 461, Faggio 462, Freeway 463, Sanchez 468, Quad 471, BMX 481, Chopper 509, Mountain Bike 510, FCR-900 521, NRG-500 522, HPV-1000 523, BF-400 581, Wayfarer 586. Handling-table IDs are the handling.cfg row indices (bike interval 162–174).
- The thirteen `!` BIKEH rows parse in `tBikeHandlingData::InitFromData` column order (COM/force pairs, MaxLean/FullAnimLean/DesLean caps, SpeedSteer/SlipSteer, wheelie/stoppie angles and multipliers).
- Rider animations live per class in the archive IFPs (`bmx_ride/pedal/still/left/right/fwd/back/jumponl/r/getofflhs/rhs/back/pushes/bunnyhop/driveby…`, same shape for `bikes/bikev/bikeh/biked/wayfarer/mtb/choppa/quad`), not in ped.ifp; entry/exit names match `aStdBikeAnimations…aQuadBikeAnimations` in the reversed assoc definitions, which supply the vehicle anim group tables 3–12 (align/kick/getoff fall back to the shared ped block `stdbike`, whose clips are in ped.ifp).
- gta-reversed `CBike::CalculateLeanMatrix` (roll about the forward axis, dropping `(1-cos) × bbox min`) and `CBike::DamageKnockOffRider` (mass-scaled force, player/NPC skill resistance, per-axis weights, Sanchez/quad weighting, upside-down branch, 75 threshold) are fully reversed. Lean-angle dynamics (`ProcessRiderAnims`), wheelie/stoppie, drive acceleration and `CBike::BlowUpCar` are not, so those stay authored.

## Slices

1. Bike handling (`readBikeHandling`): ID plus 15 floats per `!` row. Covered by `tests/bike-handling.test.ts` (all 13 rows, BMX values, malformed/duplicate rejection).
2. Entry groups (`vehicleAnimGroups` 3–12): jumpon/geton/getoff/kick names per class with ped-block align/elbow/fall fallback through the real `^` flag rows. Covered by `tests/bike-anim-groups.test.ts`. The jumpon/getoff sequence itself is now wired by `src/simulation/BikeMount.ts` (jump-on, get-off and the get-off-back tumble at speed); boarding stays immediate only until the bike's clips have loaded.
3. Fixed loader (`loadFixedWorldBike`): bike/bmx/quad validation, handling-table ID, per-axle wheel frames (single pair, car-style quad set), first-variant paint, prepared handling plus the BIKEH row. Covered by `tests/browser/bike-assets.spec.ts` (BMX/Faggio/Sanchez/Quad models, handling, seats, wheels).
4. Lean and knock-off (`nativeBikeLean`, `nativeBikeKnockOff`): lean-into-the-turn target capped by BIKEH MaxLean with an authored DesLean rate, the reversed lean-matrix drop, rider blend toward FullAnimLean, and the reversed knock-off force/threshold (stairs exemption and knock-off flags skipped). Covered by `tests/native-bike-lean.test.ts`.
5. Rideable bikes (`WorldBike`): COL rigid body with minimal contact friction under an arcade velocity controller (prepared per-step magnitudes at 50 Hz, authored variable-ratio steering from SpeedSteer, manual gravity, upright body with visual-only lean roll), immediate F boarding, slow-only exit, rider poses from the class IFP (ride/pedal/still idle, left/right lean overlay at ped_frontseat), knock-off and tip-over ejection, collision-aware knock-off via contact Δv, 1000-health damage with burn-out and explosion hook. Covered by `tests/browser/bike-ride.spec.ts` (pedal away, steer with lean and rider overlay, wall-stop knock-off).
6. Fleet and HUD: one bike parked on flat ground near the player (BMX first), F enter/exit beside cars/boats/planes, W/S/A/D/Space drive, rider pose through the shared vehicle-pose path, knock-off messages, explosion hook. Covered by `tests/browser/bike-fleet.spec.ts`. Since then the jumpon/getoff sequence (`src/simulation/BikeMount.ts`), bike drive-bys (`fireDrivebyBike`), pillion passengers on the rear seat, engine audio (the bike and BMX branches of `src/audio/native/NativeVehicleAudio.ts`) and STAT_BIKE_SKILL (`WorldBike.ridingSkill`) have landed. Wheel spin now follows travel and rear braking ([source and scope](BIKE_WHEEL_ROLL.md)); pedal-crank motion and wheelie/stoppie control are still absent from `WorldBike` (`src/simulation/nativeWheelStats.ts` only records wheelie and stoppie stats).

CJ can also be warped into a motorcycle or quad's rear passenger seat by the
original script commands while its driver keeps control. Models without a rear
dummy reject the seat. See [player passenger implementation and remaining scope](PLAYER_BIKE_PASSENGERS.md).

The thirteen motorcycle and bicycle front forks also follow their native rake
axes with interpolated steering ([source and live model checks](BIKE_STEERING.md)).
Handlebar hand tasks and complete suspension articulation remain separate work.
