# San Andreas browser game

An in-progress single-player browser recreation with no application backend. The production goal is a highly faithful San Andreas experience; the current runtime is an early authored neighborhood and driving foundation.

Start with the [design document](docs/DESIGN.md). The [implementation plan](docs/IMPLEMENTATION.md) specifies development gates, data contracts, and acceptance tests. The [research register](docs/research/SOURCES.md) records sources, evidence limits, and unresolved questions.

The proposed foundation is TypeScript, Vite, Three.js, Rapier, streamed world sectors, and local browser storage. Original PS2-era presentation is the provisional reference. Exact content fidelity depends on an authorized asset strategy; a newly authored content pack and an optional local importer are treated separately.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL Vite prints. Production files are generated with `npm run build` and can be served from static hosting.

Ambient cars travel along the cross street beyond the bridge. They brake for obstacles; stopped traffic cars can be entered and retained in local saves. Traffic routing and driver takeover animation are still provisional.

Hard falls and vehicle strikes reduce on-foot player health. Vehicle hits briefly interrupt movement and apply knockback; sustained contact causes one hit until the car separates. Fatal injuries trigger a short Wasted sequence and recovery at the neighborhood spawn. This is an initial health loop; hospital recovery and combat damage are not implemented yet.

## Controls

WASD moves or drives. C toggles crouching, Shift sprints, Space jumps on foot and applies the handbrake in a car, F enters/exits a nearby vehicle, H sounds the horn while driving, V or Home cycles near/medium/far camera distance, mouse dragging looks around, middle mouse holds rear view, Numpad 1 holds rear view on foot, Q/E look left/right in a vehicle (both look behind), L requests pointer lock, and Escape pauses. Save and export are available in the pause menu while on foot. The Audio panel controls master volume, sound effects, ambience and mute; preferences persist on this device.

## Verification

```sh
npm run build
npm test
npm run test:browser
npm run test:production
npm run test:audio
```

Browser tests currently use locally installed Google Chrome. The suite starts its own development server on port 5183 unless one is already running. Screenshots are written to the ignored `artifacts/` directory.

The production smoke check builds the application, serves its static output on port 5185, verifies loading and startup, confirms development hooks are absent, and rejects external runtime requests. It writes a browser/GPU evidence record to `artifacts/production-smoke.json`.

The audio check uses Chrome and a separate development server on port 5187. It records the real output graph during walking, vehicle entry, acceleration and horn use, checks signal levels and clipping, and writes `artifacts/game-audio.webm` and `artifacts/audio-verification.json`. It verifies playback behavior, not subjective likeness to the original game. Audio sources, licenses and conversions are listed in [audio credits](public/audio/CREDITS.txt); the [audio manifest](public/audio/manifest.json) includes hashes and durations.

See [current progress and fidelity gaps](docs/PROGRESS.md) and [asset provenance](docs/ASSETS.md). The design's performance budgets, schedule and fidelity thresholds are proposals, not achieved benchmarks. Research checked September 13, 2026.

For a fixed vehicle rendering observation, run the development server on port 5183, then `node scripts/observe-vehicle-rendering.mjs current`. The script imports its own view fixture into an isolated browser context and writes a screenshot plus 120 frame observations under `artifacts/`. This is a bounded diagnostic, not a full performance benchmark.


Open **Local texture library** from the game menu to inspect classic PC `.txd` files or dictionaries inside a `VER2` `.img` archive. Reading and decoding happen locally in a worker. Native mip levels can be previewed; source textures are not yet applied to the game. See [format support and verification](docs/research/ASSET_FORMATS.md).

The texture library links to a **Local model preview** for static and supported skinned `.dff` files or models selected directly from a local `VER2` `.img` archive, with orbit controls and a day/night vertex-color slider. Optional local `.ide` files select the dictionary named by model definitions and resolve texture-parent links within the archive. Choose an archived dictionary or select an optional separate PC `.txd` dictionary to bind matching textures with their source mip levels. See [model support and limits](docs/research/MODEL_FORMATS.md). Choose an archived `.ipl` entry or add a separate `.ipl` file and apply placements to inspect matching instances by interior, or use **Assemble archive scene** to load all resolvable model types from the selected IMG. An archived or separate `.col` collection adds matching collision overlays. For an assembled scene with no omitted placements and matching COL data for every model, **Walk scene** opens a temporary game window. The existing character controller walks and jumps on the imported collision. This mode hides the authored neighborhood radar and does not save imported environments.

Supported non-native skinned models now display their bind pose in the model preview, with independent skeletons for repeated placements. See [skin formats and validation](docs/research/SKIN_FORMATS.md). For one unplaced model, choose an optional local `.ifp`, select a compatible clip, and use play/pause, the time slider or **Restore bind pose**. Gameplay animation blending and character replacement remain in development.
