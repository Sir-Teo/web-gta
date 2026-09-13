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

## Controls

WASD moves or drives. Shift sprints, Space jumps on foot and applies the handbrake in a car, F enters/exits a nearby vehicle, mouse dragging looks around, L requests pointer lock, and Escape pauses. Save and export are available in the pause menu while on foot.

## Verification

```sh
npm run build
npm test
npm run test:browser
```

Browser tests currently use locally installed Google Chrome. The suite starts its own development server on port 5183 unless one is already running. Screenshots are written to the ignored `artifacts/` directory.

See [current progress and fidelity gaps](docs/PROGRESS.md) and [asset provenance](docs/ASSETS.md). The design's performance budgets, schedule and fidelity thresholds are proposals, not achieved benchmarks. Research checked September 13, 2026.
