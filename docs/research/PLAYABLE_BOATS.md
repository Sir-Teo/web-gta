# Playable boats

## Source audit

- Ten `boat` definitions resolve with models and textures (`static-world-vehicle-audit` scope): Predator 430, Squalo 446, Speeder 452, Reefer 453, Tropic 454, Coastguard 472, Dinghy 473, Marquis 484, Jetmax 493, Launch 595. Each has a `handling.cfg` row.
- `CAEVehicleAudioEntity` carries `BOAT` audio rows locally (`vehicleAudioSettings.ts`).
- gta-reversed `CBoat.cpp` (ProcessControl, wake trail) and `Buoyancy.cpp` (`ProcessBuoyancyBoat`, `PreCalcSetup` boat bounds, `CalcBuoyancyForce`, `SimpleCalcBuoyancy`, `AddSplashParticles`) are fully reversed with no plugin calls at the pinned revision. The 3x3 hull volume tables live at static addresses, so per-model class selection is ported over authored uniform tables.
- No boat entry clips exist in the archive (no `boat*.ifp` beyond buildings; the anim group table carries no boat groups), so entry stays an immediate warp until clips surface.
- Model IDs follow the local vehicle definitions; the reversed comments name JETMAX 498 while the local JETMAX/CUPBOAT is 493.

## Slices

1. Boat buoyancy (`applyNativeBoatBuoyancy`): nine-point footprint sampling with class bounds, per-point wave power from point velocity and suspension damping, force up plus turn torque. Covered by `tests/native-boat-buoyancy.test.ts`.
2. Wake trail (`createWakeTrail`/`pruneWakeTrail`/`addWakePoint`): newest-first stern points with speed intensity, 2-unit spacing, 150-frame life and caller caps. Covered by the same suite.
3. Controller, entry/exit, wakes FX, audio service, spawns: unfinished.
