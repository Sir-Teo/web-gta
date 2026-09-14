# San Andreas browser game

An in-progress single-player browser recreation focused on native San Andreas content and presentation, with no application backend.

[Play on GitHub Pages](https://sir-teo.github.io/web-gta/). The included Verdant Meadows region loads native terrain, buildings, collision, CJ and movement animations automatically. The first visit downloads a roughly 19.7 MB scene package. Use desktop Chrome with a keyboard and mouse.

WASD moves, Shift sprints, Space jumps, C crouches, drag looks around, V/Home changes camera distance, and Escape pauses.

The old authored driving sandbox has been removed. Old sandbox URLs open the native world. This build is bounded region exploration; full-map streaming, native vehicles, traffic, missions and persistent world saves remain in development.

## Development

```sh
npm install
npm run dev
```

Production files are generated with `npm run build` and served by static hosting. GitHub Pages deployments use `BASE_PATH=/web-gta/`.

The [content starting point](docs/research/CONTENT_START_HERE.md) and [scene provenance](public/play/README.md) document content acquisition and packaging. [Design](docs/DESIGN.md), [implementation plan](docs/IMPLEMENTATION.md), and [research register](docs/research/SOURCES.md) track the larger objective. Older progress records describe historical prototypes and are not claims about current shipped behavior.

The native texture/model workshops remain at `assets.html` and `models.html`. They support local native assets, character assembly, animation inspection, scene assembly and temporary playable scene sessions. The game pause menu links to the character workshop. Files are processed locally in the browser.

## Verification

```sh
npm test
npm run test:browser
npm run test:production
node scripts/verify-pages.mjs https://sir-teo.github.io/web-gta/
```

Browser tests use locally installed Chrome and an owned development server on port 5189. The production check serves a build under `/web-gta/`, verifies native loading, movement and pause/resume, and rejects HTTP failures and browser exceptions. Screenshots are written to the ignored `artifacts/` directory.

Physics tests retain isolated scenery and vehicle fixtures under `tests/fixtures/physics-world`; these are not imported or shipped by the application. Shared movement, collision and vehicle algorithms remain available for native-content integration.
