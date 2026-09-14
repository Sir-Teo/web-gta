# Continuous native San Andreas world

The game has one world entry. `world-start.scene.bin` bootstraps Grove Street with native terrain, collision, textures, CJ, animation, vegetation and environment inputs. Subsequent windows stream from `world/`, the complete 16,297-entry original archive split into 235 independently verified static chunks. Districts share a single coordinate system and session. The former Grove and Verdant menu choices and public packages have been removed; Verdant's bounded package survives only as a development vegetation fixture outside the shipped site.

`navigation/san-andreas.png` losslessly joins all 144 original radar textures. Its provenance file records each source tile's SHA-256. Radar.cpp's original 12×12 grid maps the 6,000-unit world north-up. The browser draws local roads, player heading and a user waypoint from this same map; M opens the full map.

`vehicles/greenwood/` supplies the original Greenwood model, texture dictionaries, collision, color and handling records. The game installs one near Grove Street and connects entry/exit and native ordinary-car mechanics. Road contacts resolve the native surface/adhesion table. Entry/exit animation, vehicle sound, dynamic wheel rendering, damage, traffic and aircraft flight are unfinished. The full archive contains the other vehicle assets; availability is not a claim that every type is playable.

Source URLs/checksums are recorded in `scripts/content/world-sources.json`, `scripts/content/vehicle-sources.json` and the world manifest. Native assets retain their original ownership.

```sh
GTA_PUBLISH_PACK=1 GTA_CONTENT_DIR=/absolute/path/to/web-gta-content npx vitest run tests/build-pages-scene.test.ts
GTA_BUILD_RADAR=1 GTA_CONTENT_DIR=/absolute/path/to/web-gta-content npx vitest run tests/build-native-radar.test.ts
npm run test:production
```
