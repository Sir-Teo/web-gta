# San Andreas browser game

An in-progress single-player browser recreation focused on native San Andreas content and presentation, with no application backend.

[Play on GitHub Pages](https://sir-teo.github.io/web-gta/). The game opens one continuous San Andreas world at Grove Street and streams native terrain as you travel. Separate district choices and their old public packages have been removed. Use desktop Chrome with a keyboard and mouse.

The static content includes all 16,297 archive entries and 212 vehicle definitions. The vehicle audit resolves 208 models; four malformed source resources remain unresolved. A native Greenwood is drivable near the starting point. Fixed-model car spawns now load nearby from the original world records, with original models, paint, collision and handling. Seven original aircraft are flyable: Dodo, Rustler, Shamal, Beagle, Cropduster, Stuntplane and Nevada. Random vehicle population, traffic and missions remain in development. See [world content](docs/static-world-content.md).

WASD moves, Shift sprints, Space jumps, C crouches, drag looks around, V/Home changes camera distance, and Escape pauses. M opens the original full map; click it or choose a named destination to set a waypoint. The minimap tracks roads, your heading and parked vehicles (cyan). F enters/exits the nearest car; W/S accelerates/brakes/reverses, A/D steers and Space applies the handbrake. The original wheels now roll, steer and follow suspension. Entry/exit is immediate; driving animations, damage and vehicle audio are unfinished. Rendering and footstep audio use native assets. The authored sandbox, procedural character and car stand-ins, synthetic audio and sandbox save fixtures have been deleted.

Open **M → Aircraft → Fly from Verdant Meadows** to start on the original airfield in the same world. W/S adjusts throttle, ↓/↑ raises/lowers the nose, A/D banks, Q/E steers the rudder, G toggles retractable gear, and Space brakes on the ground. F exits after landing and stopping. The flight HUD shows airspeed, height above ground, throttle and gear. Nearby supported planes also spawn at original IPL locations. Flight uses an approximate browser controller with native assets and source handling coefficients; native flight physics, weapons, aircraft damage/audio, helicopters and VTOL remain unfinished. See [aircraft implementation](docs/research/PLAYABLE_AIRCRAFT.md).

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
