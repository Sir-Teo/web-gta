# Unique stunt jumps

The 70 unique stunt jumps run in the playable world (`src/simulation/StuntJumps.ts`), fed by the original script (`src/assets/scmStuntJumps.ts`).

## Sources

- gta-reversed revision `0076f9017b4aeef7433957ac2bd8b6988e9df166`: `StuntJumpManager.cpp` (fully reversed `Update`, `AddOne`, `Init`, `ShutdownForRestart`, `Save`/`Load`), `StuntJumpManager.h`, `Game.cpp` (the update runs after `CWorld::Process`), `Cam.cpp` (`Process_Fixed`), `Audio/Entities/AEFrontendAudioEntity.cpp` (`AE_FRONTEND_PART_MISSION_COMPLETE` shares the collectable pair).
- `public/play/world/files/scripts/main.scm`: the INITIAL mission's 70 `ADD_STUNT_JUMP` (0x0814) commands, each with 15 floats and a 500 reward.

## Behaviour

- A jump arms when the player drives a car (boats, planes and helicopters are excluded natively), touches nothing (`m_nNumEntitiesCollided == 0`), moves faster than 20 m/s and its position is inside a start box. The jump is marked found, time scale drops to 0.3 and the camera jump-cuts to `MODE_FIXED` at the script's camera position, looking at the vehicle.
- In flight, reaching the landing box sets the reward flag. Touching anything after the first 100 ms fails the jump; leaving the car, wrecking, drowning or submerging ends it as well.
- 300 ms (game time, so a second of real time at 0.3 scale) after the landing state begins, the camera and time scale are restored and an unfinished jump pays its reward: 500, or 10,000 once every jump is done, with the part-mission-complete front-end sound and the big message. Repeating a completed jump slows time again but pays nothing.

## Reconstructions

- The script handler for 0x0814 is not reversed. The command passes a centre and a radius for each box (the second triple is smaller than the first in every jump), and `CBoundingBox::IsPointWithin` needs `min < max`, so the boxes are built as centre ± radius. Sampling the world confirms it: the ground under each ramp and landing sits inside centre ± radius and below the centre + radius corner, so a car on the ramp would fall outside a corner-and-size box.
- Text and audio: the game's `USJ`, `USJ_ALL` and `REWARD` strings are shown as a big message (GXT is not in the local depot); the passenger's `CTX_GLOBAL_CAR_JUMP` line needs speech, which is not ported. `CStats` unique-jump counters are kept as the found/completed sets in the local save.
- `CPhysical::m_nNumEntitiesCollided` becomes the count of bodies a car's colliders touch after a step, with resting wheels counted as the one entity they stand on.

## Verification

- `tests/stunt-jumps.test.ts`: all 70 jumps parse with their boxes and rewards; the state machine's speed, airborne and driving conditions, the 100 ms collision grace, the landing-box reward, the 300 ms restore, the all-jumps bonus, repeats paying nothing and lost cars.
- `tests/browser/stunt-jumps.spec.ts`: the second script jump, launched from its start box over the streamed Los Santos geometry, runs waiting → flight → landed → waiting with time scale 0.3, takes and restores the fixed camera once and pays 500.
- In-game: the running world loads all 70 jumps with no page errors.
