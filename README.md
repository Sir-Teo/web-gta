# San Andreas browser game

An in-progress single-player browser recreation focused on native San Andreas content and presentation, with no application backend.

[Play on GitHub Pages](https://sir-teo.github.io/web-gta/). The game opens one continuous San Andreas world at Grove Street and streams native terrain as you travel. Separate district choices and their old public packages have been removed. Use desktop Chrome with a keyboard and mouse.

The static content includes all 16,297 archive entries and 212 vehicle definitions. The vehicle audit resolves all 212 models, including four corrupt depot sources repaired at load (coordinate sanitize, box-collision fallback). A native Greenwood is drivable near the starting point. Fixed-model car spawns now load nearby from the original world records, with original models, paint, collision and handling. Seventeen native aircraft are flyable, including nine helicopters and the Hydra with switchable VTOL. A bounded civilian population walks native sidewalk links nearby. Up to three ambient cars follow nearby native road links, brake for obstacles and traffic lights, and stop before unloaded road. This is an initial browser traffic controller; native population budgets drive density (36/44 device clamp) and the story-mission chain runs five Grove Street threads; traffic now has seated native drivers. See [world content](docs/static-world-content.md).

WASD moves, Shift sprints, Space jumps, C crouches, G recruits nearby Families members into a crew of three (they shadow you, pile into passenger seats and share your attackers; empty-handed G disbands), drag looks around, V/Home changes camera distance, and Escape pauses. M opens the original full map; click it or choose a named destination to set a waypoint. The minimap tracks roads, your heading and the radar's blips; the full map shows the same blips under the original's exploration fog. With Unarmed selected, R punches nearby pedestrians in front of you. Punches and moving-car impacts knock pedestrians down; they recover and flee, and nearby witnesses flee too. These are simplified gameplay reactions using native animations, with wanted levels, pursuing armed police and native combat audio; ragdolls remain unfinished. F enters/exits the nearest car, boat, bike or aircraft; moving traffic must stop before you can take over; W/S accelerates/brakes/reverses, A/D steers, Space applies the handbrake and H (or Caps Lock) sounds the horn; tap it in a police car to toggle the siren. Bikes pedal with W/S, lean into A/D steering and throw the rider on hard impacts. Ctrl fires a drive-by from the driven car or boat with a one-handed weapon (R reloads); The original wheels now roll, steer and follow suspension. Entry/exit is immediate; native seated driver poses are implemented, and vehicle, aircraft and weather sounds run through a port of the game's sound manager (docs/research/NATIVE_AUDIO.md). Weapon damage can disable cars and reveal native damaged body components. Rendering and footstep audio use native assets. The authored sandbox, procedural character and car stand-ins, synthetic audio and sandbox save fixtures have been deleted.

**Tab opens the arsenal**, with all 44 handheld weapon/equipment IDs unlocked, native models, HUD icons and use animations. Right mouse aims; left mouse while aiming, or Ctrl, fires/uses the selected item. R reloads guns (with native reload animations for ten supported weapons) or swings the equipped melee weapon; the mouse wheel cycles weapons. The arsenal includes an ammunition refill button. Firearms damage civilians and cars; rockets, grenades, remote satchels, fire and gas have distinct behaviors. Select the detonator to trigger placed satchels. Camera use downloads a PNG; night/thermal goggles toggle their view; use the parachute while airborne to slow descent. Ammo, effects and civilian/traffic movement pause with menus. Weapon tuning and aim correction are approximate browser implementations; dual wielding, stealth executions and the remaining reload animations remain unfinished. Confirmed hits improve weapon practice, reducing reload time and spread. Wanted levels bring foot police: at one star they club an unarmed suspect with the nightstick and bust him once he is knocked down. See [weapon implementation](docs/research/PLAYABLE_WEAPONS.md).

Open **M → Aircraft → Fly from Verdant Meadows** to start on the original airfield in the same world. W/S adjusts throttle, ↓/↑ raises/lowers the nose, A/D banks, Q/E steers the rudder, G toggles retractable gear, and Space brakes on the ground. F exits after landing and stopping. The flight HUD shows airspeed, height above ground, throttle and gear. Nearby supported planes also spawn at original IPL locations. Flight uses authored flight equations with native assets and source handling coefficients (stall authority, ground effect, crosswind coupling); helicopters and Hydra VTOL use an authored lift controller. Space stabilizes hover, T switches Hydra flight mode, Ctrl fires mounted guns and B launches rockets on supported military aircraft. Collision and weapon damage can destroy aircraft. Helicopter searchlight pursuit, rotor-gated flight response and pilot seating run through the port; full-mission flight choreography remains unfinished. See [aircraft implementation](docs/research/PLAYABLE_AIRCRAFT.md).

Money, ammunition, the weapons held, weapon and driving skill, collected pickups, sprayed tags, stunt jumps, explored map squares and the last save point save locally; a game started after a save point was used skips the introduction and resumes there.

See the [remaining gaps checklist](docs/GAPS_CHECKLIST.md) for implemented features and outstanding work.

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

Browser tests use locally installed Chrome and an owned development server on port 5189; they run on three parallel workers (`PW_WORKERS=1 npm run test:browser` for a serial run), then the load-sensitive specs listed in `playwright.config.ts` as a second pass, and only one `playwright test` may run at a time since it owns that port. `ROUTE='{...}' npx playwright test tests/browser/route-drive.spec.ts` drives a scripted route and reports streaming latency and holds. The unit suite keeps its module transforms across runs. The production check serves a build under `/web-gta/`, verifies native loading, movement and pause/resume, and rejects HTTP failures and browser exceptions. Screenshots are written to the ignored `artifacts/` directory.

Walking physics tests use a minimal flat-floor fixture. Native movement, collision and vehicle algorithms remain available for content integration.
