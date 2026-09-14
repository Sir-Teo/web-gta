# Included Verdant Meadows scene

`verdant.scene.bin` is a gzip-compressed version-1 scene package built from the native content depot: 93 model parts, 164 placed instances, collision, textures, environment inputs, classic CJ body/clothing and movement animations. It also includes eight native procedural vegetation models, their textures and collision data, selected from surfaces present in the region. Compressed size: 19,957,758 bytes. The browser fetches and decodes this same-origin static file without a backend or external runtime requests.

World source URLs and checksums are recorded in `scripts/content/world-sources.json`; acquisition and character provenance are documented under `docs/research/CONTENT_START_HERE.md` and `docs/research/WORLD_CONTENT.md`. Source world archive: https://z.noclip.website/GrandTheftAutoSanAndreas/models/gta3.imgz . Native game assets retain their original ownership; availability from a public host is not an open asset license.

Rebuild after acquiring the content depot:

```sh
GTA_PUBLISH_PACK=1 GTA_CONTENT_DIR=/absolute/path/to/web-gta-content npx vitest run tests/build-pages-scene.test.ts --maxWorkers=2
BASE_PATH=/web-gta/ npm run build
node scripts/verify-pages.mjs
```

The package stores typed buffers once and reconstructs their views plus environment Files. This is a bounded native exploration scene, not a full-game content distribution or complete gameplay implementation.

## Grove Street and Ganton

`grove.scene.bin` adds a second bounded area: 238 native model parts and 550 placements, with native collision, textures, environment inputs and the same classic CJ/animation inputs. Compressed size: 30,314,670 bytes. No selected native terrain surface requires a procedural model package in this region. Placed vegetation remains part of the native scene.

Choose **Grove Street** from the game menu, or open `?area=grove-street`. Area selection starts a fresh scene and downloads only the selected package. Verdant Meadows remains the default. This is not seamless full-world streaming; walking beyond the packaged area remains outside the supported content region.

Rebuild and verify Grove Street:

```sh
GTA_PUBLISH_PACK=1 GTA_PUBLISH_REGION=grove-street GTA_CONTENT_DIR=/absolute/path/to/web-gta-content npx vitest run tests/build-pages-scene.test.ts --maxWorkers=2
GTA_PLAY_AREA=grove-street npm run test:production
node scripts/verify-pages.mjs 'https://sir-teo.github.io/web-gta/?area=grove-street'
```

The builder rejects omitted requested models and includes regional timecycle modifiers returned by the importer. This package contains no extra timecycle boxes. The source lock and provenance above apply to both areas. Browser checks verify Grove's spawn, grounded movement, 550 installed placements, pause, package selection and return to Verdant. The scene is a native content expansion, not completed pedestrian, traffic or mission gameplay.
