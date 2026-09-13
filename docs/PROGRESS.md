# Production progress

The full production-level clone objective remains active. This file records concrete implementation evidence and the largest remaining gaps; it does not redefine completion around the current slice.

## Implemented foundation

- TypeScript/Vite static browser application; Three.js rendering and Rapier physics.
- Fixed 60 Hz simulation with bounded catch-up and independent rendering.
- Authored residential street, turning head, houses, palms, utilities, cross street and bridge.
- Kinematic character movement, sprint stamina, jump, grounded behavior and an articulated visual stand-in.
- Physical sedans with raycast suspension, steering, propulsion, braking and handbrake.
- Vehicle entry/exit control transfer and stationary exit-space checks.
- Follow/chase camera with a collision-volume sweep, pointer drag and optional lock.
- Geographic radar, status HUD, pause/resume, focus handling and graphics-context recovery flow.
- IndexedDB current/previous-good saves, continuation after reload, save-file export and validated import.
- Fixed-clock tests and browser scenarios for real controls and persistence.

## Current fidelity and production gaps

The map is an authored approximation with limited extent, not an imported or measured original map. Character geometry, animation and vehicle meshes are stand-ins. Handling parameters, camera timing, weather and all numeric behavior still need the reference measurements specified in the design. Vehicle transitions currently switch control without the full door/seat animation choreography.

There are no story missions, police, combat, ambient population, audio, bicycles, swimming, aircraft, full progression, interiors, world-sector streaming, original-file importer or complete offline installation yet. The current clock advances while scene lighting remains a fixed afternoon look. Gamepad/touch support, schema migrations, production-host testing and long-session memory/performance verification remain work. These omissions prevent any claim of production readiness or full authenticity.

## Next priority

Resolve concrete issues from the first browser playtest, improve the neighborhood composition, and establish simulation regression fixtures for physical collisions and vehicles. Follow with proper animated character and vehicle-transition assets, reference-calibrated handling/camera, and the first traffic/pedestrian/mission loop. Track real hardware results separately from the proposed budgets in the design.
