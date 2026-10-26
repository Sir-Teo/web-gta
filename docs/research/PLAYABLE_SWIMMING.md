# Playable swimming

## Sources

- gta-reversed `CTaskSimpleSwim` (fully reversed, no plugin calls at the pinned revision): six swim states, player input mapping, resistance blending, breath/drowning, water FX (`water_ripples`, `m_Wake`, `water_swim`) and swim audio events.
- `animations/swim.ifp` from the verified archive (34,816 bytes): `Swim_Tread` (1.30 s), `Swim_Breast` (1.30 s), `SWIM_crawl` (0.90 s), `Swim_Dive_Under` (1.07 s), `Swim_Under` (1.50 s), `Swim_Glide` (1.47 s), `Swim_jumpout` (0.33 s), all with 26–32 tracks.

## Slices

1. Clip inventory (`tests/native-swim.test.ts`): every mapped clip exists in the packaged IFP.
2. Movement core (`src/simulation/nativeSwim.ts`, `tests/native-swim-core.test.ts`): six states, the 0.6 m entry rule, surface state selection, the blend ramp, resistance blending, the submerge servo and breath/drowning. The original fixed-100 lung-capacity approximation is replaced by the captured stat modifier below; the buoyancy-ratio entry trigger is omitted.
3. State machine wiring, clips, input, FX, audio and boat exits exist in the browser. Their presence does not establish native task equivalence.

## PC 1.0 comparison corrections — September 17, 2026

Reference: gta-reversed revision `0076f9017b4aeef7433957ac2bd8b6988e9df166`, inspected from the local checkout.

- `CPed::ProcessBuoyancy` increments `m_fSwimStopTime` by `CTimer::GetTimeStep`; `CTaskSimpleSwim::ProcessPed` compares it with 15. The browser had incremented seconds, stretching the timeout by 50 times. The accumulator now uses native time units (15 units = 0.3 seconds, with a strict greater-than exit test).
- `CTaskSimpleSwim::ProcessPed` uses a breath multiplier of 1 on the surface and, underwater, `1 + SWIM_UNDER.speed * SWIM_UNDER.blendAmount` if that association exists. The constant 1.5 multiplier has been removed. The browser supplies its actual current stroke playback rate and blend weight; missing strokes use 1.
- `CPlayerPed::HandlePlayerBreath` (0x60A8D0) permits the recovery increment to exceed lung capacity and truncates the drowning damage-event argument to an integer. The browser helper now preserves both behaviors, including the infinite-oxygen and `bDrownsInWater` branches.
- The water-task integration had consumed the jump command on dry land. It now suppresses ordinary jumping only while the player is swimming. A browser regression reproduces the original failure and checks airborne motion and return to the ground.

Remaining differences at this comparison: lung capacity was the authored default 100 rather than `STAT_MOD_AIR_IN_LUNG` (replaced below); swim association blending, sprint-button results and fade-out scheduling are not a native animation-manager port; climb/jump-out, underwater pitch, buoyancy-trigger entry and full damage-event dispatch were incomplete. Later work implements portions of those paths; the source-based breath formula does not make the entire swimming system reference-matched.

Regression coverage: `tests/native-swim-core.test.ts`, `tests/player-swim.test.ts`, `tests/swim-integration.test.ts`, and `tests/browser/player-jump-input.spec.ts`.

## Player-control breath lifecycle

`playerBreath.ts` now follows the `CPlayerPed::ProcessControl` (0x60EA90) ownership flag: recover at the start of a frame only if no task handled breath in the preceding frame, then arm the flag for this frame. `HandlePlayerBreath` clears it. `ResetPlayerBreath` semantics clear the flag on player reset. This restores dry-land/ordinary seated recovery without adding recovery on top of underwater depletion or surface swim recovery.

`CAutomobile::ProcessPedInVehicleBuoyancy` drains the player's breath at multiplier 1. The existing car and aircraft buoyancy adapters now invoke that callback when their drowning branch is active. `CVehicle::ProcessBoatControl` has a separate branch: native buoyancy force greater than `timestep * mass * .0008`, up-axis Z below −0.6, and absolute horizontal speeds below .05. An overturned, nearly stationary boat invokes the same breath callback. The final boat drowning flag cannot substitute for that branch because the original routine clears the flag afterward. These callbacks use the browser's existing buoyancy estimates; they do not verify the underlying forces against retail.

The shared death timer now also advances when the simulation is following an occupied vehicle; seat ownership is released before respawn. This fixes the newly exposed dead-pilot stall without shortening the existing death delay. That delay and hospital/wasted flow are still browser implementations requiring separate reference comparison.

Later vehicle work also connects the bike drowning branch to shared player breath and its rider fall-off path. The infinite-oxygen branch is wired through nativeCheats. NPC/passenger drowning events and complete pedestrian head-submersion behavior remain partial. Native unit and callback tests are in `tests/player-breath.test.ts`; original-asset car, helicopter and boat adapter tests are in `tests/browser/vehicle-breath.spec.ts`.

## Current-stat breath capacity (October 26, 2026)

The selected executable's mode-8 stat modifier now supplies initial/reset
breath, dry/vehicle/swim recovery and HUD scaling. Initial stats give 1,150;
maximized lung and stamina stats give 4,000. Stat changes retain current
breath. Sixty-three independent captures and live underwater/recovery/HUD
checks cover the change. Natural swimming stat training is integrated in the follow-up below.
[Captured modifier, reset caller and integration](PLAYER_LUNG_CAPACITY.md).

## Natural swimming training (October 26, 2026)

Moving surface swimming now trains stamina, and underwater swimming trains
both stamina and lung capacity through separate captured native counters.
Dry land and idle treading pause the counters. Controlled ordinary-frame
awards reach current breath capacity and the stat-update HUD without
refilling breath; foot-running training is suppressed while swimming.
[Executable captures, live controls and remaining physiology limits](SWIMMING_STAT_TRAINING.md).

## Saved training (October 26, 2026)

Earned stamina and lung capacity now survive the browser's ordinary save and
reload path. The restored stats initialize breath and HUD capacity, and old
saves retain native initial defaults. Training counters start fresh after
reload, following the native save ownership.
[Format compatibility, validation and real reload check](TRAINING_STAT_PERSISTENCE.md).

## Captured sprint resource and stroke input (October 26, 2026)

Surface crawl and underwater stroke/glide input now use the captured player
sprint controller and its retained button state. Swim energy recovery,
the underwater 0.1 resource branch and stroke playback at loop restarts
follow their native callers. The stat-derived energy budget also reaches
ground movement, ordinary vehicle recovery and reset/fill paths.
[Executable controls, live exhaustion/restart and animation limits](PLAYER_SPRINT_ENERGY.md).
