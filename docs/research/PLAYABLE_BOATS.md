# Playable boats

## Source audit

- Ten `boat` definitions resolve with models and textures (`static-world-vehicle-audit` scope): Predator 430, Squalo 446, Speeder 452, Reefer 453, Tropic 454, Coastguard 472, Dinghy 473, Marquis 484, Jetmax 493, Launch 595. Each has a `handling.cfg` row.
- `CAEVehicleAudioEntity` carries `BOAT` audio rows locally (`vehicleAudioSettings.ts`).
- Engine audio was first blocked on data: the throttle→pitch/volume constants (`FrqEngineBase`, `VolBase`, …) and the prop-speed ramp live at static addresses upstream. Both are ported now: the `m_EngineSpeed` ramp in `WorldBoat.stepPropeller` (`src/simulation/WorldBoat.ts`, with the four exe-only constants two gta-reversed forks record) and `ProcessBoatEngine` on the `s_Config` defaults in `src/audio/native/NativeVehicleAudio.ts`.
- gta-reversed `CBoat.cpp` (ProcessControl, wake trail) and `Buoyancy.cpp` (`ProcessBuoyancyBoat`, `PreCalcSetup` boat bounds, `CalcBuoyancyForce`, `SimpleCalcBuoyancy`, `AddSplashParticles`) are fully reversed with no plugin calls at the pinned revision. The 3x3 hull volume tables live at static addresses, so per-model class selection is ported over authored uniform tables.
- No boat entry clips exist in the archive (no `boat*.ifp` beyond buildings; the anim group table carries no boat groups), so entry stays an immediate warp until clips surface.
- Model IDs follow the local vehicle definitions; the reversed comments name JETMAX 498 while the local JETMAX/CUPBOAT is 493.

## Slices

1. Boat buoyancy (`applyNativeBoatBuoyancy`): nine-point footprint sampling with class bounds, per-point wave power from point velocity and suspension damping, force up plus turn torque. Covered by `tests/native-boat-buoyancy.test.ts`.
2. Wake trail (`createWakeTrail`/`pruneWakeTrail`/`addWakePoint`): newest-first stern points with speed intensity, 2-unit spacing, 150-frame life and caller caps. Covered by the same suite.
3. Drifting hull (`WorldBoat`): COL rigid body over flat water with native float, browser gravity, stern wake points and bow spray edges. Covered by `tests/native-boat-float.test.ts` (Predator settles mid-immersion and trails a wake). The fleet, entry, FX/audio drains and damage were wired in slice 5.
4. Drive forces (`nativeBoatDrive` wired into `WorldBoat.beforeStep`): thrust from the submerged prop, aquaplane lift, traction/handbrake, water resistance, turn damping and wave hits. Covered by the same suite (makes way, yaws, checks). Throttle/steer mapping is authored; the engine-speed ramp (since ported in `WorldBoat.stepPropeller`), Skimmer branches and `AE_BOAT_HIT_WAVE` audio were omitted at this step.
5. Playable runabouts: the fleet moors one boat on open water near the shore, F boards with an immediate warp (no boat entry clips exist) and leaves in wadeable shallows, W/S/A/D/Space drive it, spray drains through the shared `prt_watersplash` path with the collision-bank splash pair, immersion jumps play the wave-hit splash end (event 99, 1500 ms per-hull throttle), fast hulls throw the reversed DoBoatSplashes stern spray through `prt_boatsplash`, the wake trail renders as a striped ribbon per the reversed RenderWakePoints formulas with authored foam-white material, and hulls take collision and weapon damage with the CBoat player/non-player divisors, burning below 250 and blowing up after 5 s with [boat fire at the PC per-model offsets](BOAT_FIRE_LIFECYCLE.md). Covered by `tests/native-boat-float.test.ts` (boarding warp, deep-water refusal, ramming damage, burn-out), `tests/native-audio.test.ts` (wave-hit volume/throttle), `tests/native-fx.test.ts` (stern pair, slow/distant silence), `tests/boat-wakes.test.ts` (width/alpha, ribbon counts, burn smoke/fire routing) and `tests/browser/boats.spec.ts` (fleet mooring, boarding, driving, shallow exit in the live world). Driver poses (the `DRIVE_BOAT` clips, `BOAT_RIDE` in `src/main.ts`), engine audio and [swimming](PLAYABLE_SWIMMING.md) have since been added.

## Script-driven engine lifecycle (October 26, 2026)

Physics-controlled script boats now update their propeller and pass their
actual engine flag to native audio without requiring CJ aboard. Live native
SCM navigation, stop and restart verify the bank and engine loop; the player
engine/skimming regression passes. Full native physics and engine ownership
remain separate work. [Source, transitions and checks](BOAT_PILOT_ENGINE_AUDIO.md).

## Moving render components (October 26, 2026)

Native propeller, steering-flap and scan transforms now reach each supplied
component frame. Captured native alpha combines with vehicle fading, and all
ten boat models have asset/material/lifetime coverage. The independent
executable fixture contains 132 cases. Marquis door/flap physics and complete render-pipeline comparison remain
separate work. Propeller water systems are integrated in the follow-up below.
[Source, captures, actual inventory and checks](BOAT_RENDER_COMPONENTS.md).

## Physics anchor release and propeller water effects (October 26, 2026)

Known physics-controlled boats now release the constructor anchor and retain
their scripted horizontal movement, including the engine-off physics branch.
Real Speeder navigation travels about 21 metres in three simulated seconds.
Two owned boat_prop systems follow the supplied static propeller origins,
using the native submersion and movement-speed gates, local particles and copied
parent matrices. Dry/wet, engine-stop and removal states pass live checks.
[Source, movement and effect lifecycle evidence](BOAT_PROP_WATER_FX.md).

## Marquis boom (October 26, 2026)

The Marquis's supplied boat_flap_left frame now uses the native boat-specific
CDoor acceleration, damping, limit rebounds and render cadence. The selected
executable initializes native Z, contrary to the transcription's Y. Exact
integration captures and the actual painted model verify small motion, both
stops, coordinate conversion and cleanup. [Sources and limits](BOAT_MARQUIS_FLAP.md).

## Native boat fire ownership (October 26, 2026)

Boat fire now uses the actual camera's native distance square, explicit PC
model offsets, the 460-health recovery boundary and float millisecond timer.
It survives partial repairs and camera movement without gaining car overheat
smoke or engine particle velocity. Independent branch captures and real-model
lifecycle renders verify the adapters; native event delivery remains open.
[Sources, PC/mobile differences and checks](BOAT_FIRE_LIFECYCLE.md).

## Predator fixed twin guns (October 26, 2026)

The Predator's player-controlled fixed guns now use their own captured native
origins, spread, aiming, 150 ms interval and 20-volley reload state. They fire
independently of inventory and drive-by permission and retain camera/control
gates. The shared anonymous round backend also serves FIRE_SINGLE_BULLET.
[Captured instructions, live input and remaining limits](PREDATOR_FIXED_GUNS.md).

## Anonymous round contact sounds (October 26, 2026)

Predator and SCM anonymous rounds now report native facing-surface and water
contact sounds, including rejected wounds. The real collision backend plays
flesh/water/metal samples; the original endpoint height gates the water probe.
[Source, resource safety and live sample checks](INSTANT_ROUND_AUDIO.md).

## Anonymous attacker history (October 26, 2026)

Anonymous rounds now preserve the vehicle's prior damager reference while
storing the new weapon and applying normal non-player gates. The live SCM
damaged-by-player query stays true after an earlier CJ hit followed by an
anonymous hull round. [Native storage and cross-vehicle checks](ANONYMOUS_VEHICLE_SOURCE.md).
