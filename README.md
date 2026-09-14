# San Andreas browser game

An in-progress single-player browser recreation focused on native San Andreas content and presentation, with no application backend.

[Play on GitHub Pages](https://sir-teo.github.io/web-gta/). The game opens one continuous San Andreas world at Grove Street and streams native terrain as you travel. Separate district choices and their old public packages have been removed. Use desktop Chrome with a keyboard and mouse.

The static content includes all 16,297 archive entries and 212 vehicle definitions. The vehicle audit resolves 208 models; four malformed source resources remain unresolved. A native Greenwood is now drivable near the starting point. The remaining vehicle types, aircraft flight, traffic and missions are still in development. See [world content](docs/static-world-content.md).

WASD moves, Shift sprints, Space jumps, C crouches, drag looks around, V/Home changes camera distance, and Escape pauses. M opens the original full map; click it to set a waypoint. The minimap tracks roads, your heading and the Greenwood (cyan). F enters/exits the car; W/S accelerates/brakes/reverses, A/D steers and Space applies the handbrake. Entry/exit is immediate; driving animations, wheel animation, damage and vehicle audio are unfinished. Rendering and footstep audio use native assets. The authored sandbox, procedural character and car stand-ins, synthetic audio and sandbox save fixtures have been deleted.

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

Walking physics tests use a minimal flat-floor fixture. Native movement, collision and vehicle algorithms remain available for content integration.
