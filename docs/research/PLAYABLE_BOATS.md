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
3. Drifting hull (`WorldBoat`): COL rigid body over flat water with native float, browser gravity, stern wake points and bow spray edges. Covered by `tests/native-boat-float.test.ts` (Predator settles mid-immersion and trails a wake). Not yet wired into the fleet, map spawns, entry, FX/audio drains or damage.
4. Drive forces (`nativeBoatDrive` wired into `WorldBoat.beforeStep`): thrust from the submerged prop, aquaplane lift, traction/handbrake, water resistance, turn damping and wave hits. Covered by the same suite (makes way, yaws, checks). Throttle/steer mapping is authored; the engine-speed ramp, Skimmer branches and `AE_BOAT_HIT_WAVE` audio are omitted.
5. Playable runabouts: the fleet moors one boat on open water near the shore, F boards with an immediate warp (no boat entry clips exist) and leaves in wadeable shallows, W/S/A/D/Space drive it, spray drains through the shared `prt_watersplash` path with the collision-bank splash pair, and immersion jumps play the wave-hit splash end (event 99, 1500 ms per-hull throttle). Covered by `tests/native-boat-float.test.ts` (boarding warp, deep-water refusal) and `tests/native-audio.test.ts` (wave-hit volume/throttle). No driver poses, wakes rendering, engine audio, damage or swimming yet.
