# Production progress

The full production-level clone objective remains active. This file records concrete implementation evidence and the largest remaining gaps; it does not redefine completion around the current slice.

## Implemented foundation

- TypeScript/Vite static browser application; Three.js rendering and Rapier physics.
- Fixed 60 Hz simulation with bounded catch-up and independent rendering.
- Authored residential street, turning head, houses, palms, utilities, cross street and bridge.
- Kinematic character movement, sprint stamina, jump, grounded behavior and an articulated visual stand-in.
- Physical sedans with raycast suspension, steering, propulsion, braking and handbrake.
- Simulation-owned vehicle approach, door opening, seating/unseating and closing; stationary/upright checks, driver-door clearance checks, approach cancellation and control gating.
- Hinged driver doors, separated cabin surfaces, interior seats/steering wheel and a visible seated protagonist.
- Follow/chase camera with a collision-volume sweep, pointer drag and optional lock.
- Geographic radar, status HUD, pause/resume, focus handling and graphics-context recovery flow.
- IndexedDB current/previous-good saves, continuation after reload, save-file export and validated import.
- Ten transient residents with deterministic idle timing, sidewalk corridor following, local separation, parked-vehicle yielding and predicted-path evasion. Decisions are staggered; movement remains on the physics clock.
- Instanced articulated crowd parts with clothing/skin palettes and interpolated transforms. Restored saves regenerate transient residents away from the player and cars.
- Terrain heightfield replaces the large ground box after a regression exposed capsule contact instability.
- Fixed-clock, save, vehicle and population tests, plus browser scenarios for real controls and persistence.

## Current fidelity and production gaps

The map is an authored approximation with limited extent, not an imported or measured original map. Character geometry, animation and vehicle meshes are stand-ins. Handling parameters, camera timing, weather and all numeric behavior still need the reference measurements specified in the design. Vehicle transitions now have authored choreography, but lack original animation clips, hand/foot IK, automatic routing around the car, passenger-side exits, carjacking and physically simulated doors. Door clearance uses a conservative query volume. The 0.4/0.7/0.35-second opening/transfer/closing timings are provisional, not measurements of the original game.

There are no story missions, police, combat, ambient traffic, audio, bicycles, swimming, aircraft, full progression, interiors, world-sector streaming, original-file importer or complete offline installation yet. The initial pedestrian population uses a hand-authored sidewalk corridor and the same provisional articulated body with appearance variations. It lacks navmesh routing through the district, road crossing logic, dialogue, social/gang behavior, injuries, ragdolls, population streaming and regional/time-dependent spawn rules. Evasion does not implement vehicle-impact damage; pedestrians still use kinematic capsules. The current clock advances while scene lighting remains a fixed afternoon look. Gamepad/touch support, schema migrations, production-host testing and long-session memory/performance verification remain work. These omissions prevent any claim of production readiness or full authenticity.

## Next priority

Continue improving character/vehicle assets and the neighborhood composition, establish reference-calibrated handling/camera, and connect the pedestrian foundation to traffic, vehicle-impact reactions and the first mission loop. Replace the provisional transition poses with approved animated assets and add navigation around cars and alternate exits. Track real hardware results separately from the proposed budgets in the design.

## Verification record — September 13, 2026

- Production TypeScript compilation and Vite build pass.
- Fifteen unit cases pass: fixed-clock and save validation checks, plus five Rapier simulation cases covering timed entry/exit, input gating, blocked/moving cars, approach cancellation, reset during transfer, pushed-vehicle recovery, repeated interaction and blocked exits; and four population cases covering two minutes of corridor traversal without overlap, vehicle evasion/recovery, parked-obstruction recovery and regeneration after loading.
- Five Chromium browser scenarios pass: movement/jump/pause/save/reload; vehicle approach/entry/driving/braking/exit, including pause during transfer and rejection of a mid-transition save; save export/import/rejection/latest-slot continuation; forced graphics-context recovery plus resize; and crowd movement/pause/resume with stable renderer resource counts.
- The production smoke check verifies that the loading menu renders while the physics download is held, then starts the game, checks the absence of development hooks, and observes only requests to its own static origin.
- Production observation: Chrome 152.0.7977.83 using ANGLE Metal on Apple M5 Pro, at 1440×900. This is a smoke test and visual inspection, not a sustained performance benchmark or a browser-support certification.
- The entry and driving captures were visually inspected: the open driver door and cabin are visible, and the driver remains seated while driving. These are still primitive authored meshes.
- A 30-second observation in headless Chrome, development mode, with a stationary camera at 1440×900 recorded 1,801 animation frames, median/p95 interval 16.7 ms, 246 render calls and 86,726 triangles in the final frame. Geometry/texture counts stayed at 176/16. This bounded observation is not a production traversal benchmark or heap/GPU-memory measurement. `artifacts/population-observation.json` records it.
- The neighborhood crowd screenshot was visually inspected; residents appear along the sidewalk with distinct clothing colors.
- Captures and machine-readable production evidence are generated under `artifacts/` by the test commands; these generated files are intentionally not committed.

The checks establish the listed mechanics only. They do not validate original-game parity, a complete campaign, all browser/device combinations, or production readiness.
