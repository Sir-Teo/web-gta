# Save points

The PICKUPSAVE discs from the original script now save the game (`src/assets/scmSavePoints.ts`, the pickup and save flow in `src/simulation/WorldPickups.ts` and `src/main.ts`).

## Sources

- `public/play/world/files/scripts/main.scm`: the INITIAL mission creates thirteen `CREATE_PICKUP` discs (object −43, type ONCE) from the globals `$886`/`$904`/`$922`, and the `PSAVE1` thread re-creates the same set, adding five more as `$885` rises past 13. The respawn spot and heading for each slot are the globals `$940`/`$958`/`$976` and `$994`.
- `PSAVE1`'s collected branch: player control off, `ACTIVATE_SAVE_MENU`, wait for the save, fade to black over 1000 ms, remove and re-create the disc, `CLEAR_AREA`, `SET_CHAR_COORDINATES` and `SET_CHAR_HEADING` at the respawn spot, fade in over 1000 ms, restore the camera behind the player and return control after 500 ms.
- gta-reversed revision `0076f9017b4aeef7433957ac2bd8b6988e9df166`: `GenericGameStorage.cpp` (`DoGameSpecificStuffBeforeSave`) and `GameLogic.cpp` (`PassTime`).

## Behaviour

- Walking into a disc (never from a vehicle: the pickup reach only applies on foot) saves: health rises to `min(200, max health)`, six hours pass on the clock with pickup regeneration moved forward with it, the wanted level clears and sprint energy is restored. The screen fades to black for a second, the player is put back on the disc's respawn spot facing its heading, the camera goes behind the player and the screen fades back in.
- The disc is not consumed: the script removes and immediately re-creates it, so walking back in saves again.
- The save keeps the browser's own progress (money, weapons, ammo, practice, collected pickups, stunt jumps) and now the location and clock, so a reload starts at the last save point. Loading a save outside the starting region streams that region first, as the flight transfer does.

## Gaps

- Only the Verdant Meadows disc (slot 2) is outside an interior; the other twelve sit in safehouse interiors. Interiors are now published (`gta_int.img` under `public/play/world/int/`, listed in the world manifest's `archives`) and entered through the entry-exit doors (`src/world/nativeEntryExits.ts`), but saving at the interior discs has not been verified.
- The Verdant disc remains below the streamed ground. The October 22 support probe loads 54 models/83 placements with no missing COL: `ne_bit_08` is at Z=15.53686, with `des_byoffice` surfaces above it, and no floor is found below Z=15 at the disc or respawn point. The original INITIAL values remain Z=9.5077/9.0077; native CREATE_PICKUP preserves that disc height, then compresses it to 9.5. The reason for this script/world discrepancy remains unresolved. Pickup-system save checks do not establish a reachable disc there.
- Native ACTIVATE_SAVE_MENU/HAS_SAVE_GAME_FINISHED remain unimplemented. The direct disc flow saves browser progress and shows a HUD confirmation; it does not provide the native menu or complete world/script persistence. `CStats` safehouse visits, gang wars, ropes and `TidyUpMemory` remain outside this flow.

## Verification

- `tests/save-points.test.ts`: the thirteen new-game discs, their respawn spots and headings (Verdant Meadows the only exterior one), and the save effects including the 200 health cap and the six-hour clock roll.
- `tests/verdant-save-disc.test.ts`: the Verdant disc collects at its script height on foot but not from the streamed strip ~6 m above. `PICKUP_REACH` stays native; the script/world height discrepancy still needs an explanation before a placement or terrain correction is justified.
- `tests/browser/pickups.spec.ts`: a save disc reports the save on foot but not from a car, stays active for a repeat save, and its effects match.
- `node scripts/research/verdant-save-support.mjs` probes the packaged world offline and writes `artifacts/verdant-save-support.json`. Native [pickup position captures](PICKUP_POSITION_STORAGE.md) establish storage without moving the disc to another floor.
