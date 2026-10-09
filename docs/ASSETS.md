# Current asset provenance

The playable world uses original native content from the inspected public dataset.

| Content | Provenance record |
|---|---|
| Complete IMG archive, terrain, buildings, collision, placement and environment data | `scripts/content/world-sources.json` and `public/play/world/manifest.json` |
| Vehicle definitions, handling, colors and shared textures | `scripts/content/vehicle-sources.json`; vehicle model/texture entries retain their IMG provenance; `handling.cfg` is the iOS bundle's (mobile flight tuning) |
| CJ body, clothes and movement animations | Native player/animation resources in `public/play/world/files`; source acquisition and format research under `scripts/content` and `docs/research` |
| Original radar tiles and assembled map | `public/play/navigation/provenance.json`; all 144 `radar*.txd` entries decoded losslessly from the original IMG |
| Interiors (`gta_int.img`) | `extraArchives` in `scripts/content/world-sources.json`; chunks under `public/play/world/int` |
| Game text (`text/american.gxt`, the stock PC 1.0 file) | `scripts/content/world-sources.json` |
| Native footstep banks | `scripts/content/feet-sources.json` and the published world resource manifest |
| PC sound banks (GENRL, combat, event volumes) | `public/play/audio/banks.json`, `combat.json`, `eventvol.json`; packaged by `scripts/content/package-native-audio.mjs`, `package-combat-audio.mjs`, `package-eventvol.mjs` |
| Banks, mission dialogue, pain cries, beat, ambience and emergency-channel tracks from the iOS port's bundle (github.com/Google61/gta3sa.app) | `public/play/audio/ios-banks.json`, `script/`, `pain/`, `streams/`; packaged by `scripts/content/package-ios-sound-banks.mjs`, `package-script-speech.mjs`, `package-stream-tracks.mjs` |
| Touch widget art from the iOS port's texture database | `public/play/touch/widgets.png`; packaged by `scripts/content/touch-widgets.mjs` |
| UnifrakturCook Bold | Google Fonts; bundled SIL Open Font License at `public/fonts/OFL.txt` |
| HUD | Native sprites from `models/hud.txd` in the published world (`src/ui/nativeHudSprites.ts`) |
| Favicon | Project-authored |

## iOS bundle coverage

Checked against the iOS bundle at revision `67f70cb7`:

- Audio: every GENRL bank the iOS SFX tables name is packaged (`ios-banks.json`), plus the SCRIPT banks, mission
  dialogue, pain cries, beats, ambience and emergency-channel tracks.
- `data/`: `gta.dat`, `melee.dat`, `object.dat`, `ped.dat`, `pedgrp.dat`, `pedstats.dat`, `plants.dat`, `popcycle.dat`,
  `procobj.dat`, `shopping.dat`, `surface.dat`, `surfaud.dat`, `surfinfo.dat` and `water.dat` match the published files
  byte for byte (line endings aside). `handling.cfg` differed in 18 flying rows (roll stabilisation tripled for the planes and the
  Sparrows, RUSTLER's vertical speed resistance 0 to 10, MAVERICK/POLMAV/RC helicopters' horizontal speed resistance
  raised to 1, RCRAIDER's `0.1s` typo fixed) and is now the iOS file.
- Not published, by decision (1 GB Pages cap): radio stations, ped speech packs, `CUTSCENE.osw`.
- Not in any source: the cutscene `.cut`/`.ifp` data for PROLOG and INTRO.
- Open: `timecyc.dat` (what iOS loads, CTimeCycle::Initialise iOS 0x1002f5f68) differs from the published PC
  `timecycp.dat`. Its colour-correction alphas are 255 where PC has 127, but both store `uint8(a * 2)` = 254, so that
  difference is moot. Its rows have 51 fields: the directional multiplier local is set to 1.28 once before the loop
  and never rescanned, so every iOS sample stores `(int)(1.28 * 100)` = 128 (PC: 100). Line 320 (RAINY_COUNTRYSIDE
  8 PM) keeps R*'s `255` typo, so sscanf shifts the row and the last two fields keep the 7 PM values; PC fixed it.
  Swapping needs carry-over parsing of short rows and the 1.28 path through WorldLighting. `fonts.dat` (proportional widths for
  GET_STRING_WIDTH), `clothes.dat`, `furnitur.dat`, `statdisp.dat`, `gridref.dat`, `colorcycle.dat` and `default.dat`
  are present in the bundle but unused by the port.

The manifest records exact source byte lengths, hashes and upstream URLs. Public
availability and successful parsing do not certify a retail version or establish
redistribution rights. See `static-world-content.md` and the vehicle audit for
coverage and unresolved source data.

The procedural sandbox geometry, characters, cars, star field, city lights,
synthetic ambience and third-party replacement audio are deleted. Native asset
workshops and independent parser/physics fixtures remain development tools.
