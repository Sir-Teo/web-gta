# Research register

Research checked September 13, 2026. This register distinguishes source-backed capabilities from untested design recommendations.

## Evidence and source quality

Primary evidence here consists of Rockstar's published manual, browser/platform documentation, library documentation, and maintainers' own project descriptions. Repository READMEs are evidence of what maintainers claim, not independent verification of performance or completeness. No random fan demo, search snippet, screenshot, or generated code has been treated as proof of full gameplay parity.

No original executable, game assets or gameplay recordings were present in the workspace. No San Andreas build was played or measured. The original reference version, approved content route, target hardware and production team remain provisional. Those gaps limit any claim of accuracy, download size, frame rate or completion time.

## Source inventory

| Ref | Publisher and exact source | Supports | Limit or caveat |
|---|---|---|---|
| 1 | Rockstar Games, [PC manual](https://cdn.akamai.steamstatic.com/steam/apps/12120/manuals/GTASA_PC_MANUAL_FINAL.pdf), PDF pp. 4–6 | Foot/vehicle controls, HUD/radar and audio settings, described 30 fps limiter | PC edition; not a physics-tick or PS2-rendering specification. Web parser rejected file size; direct download and local extraction succeeded |
| 2 | Babylon.js, [specifications](https://www.babylonjs.com/specifications/) and [character-controller docs](https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/physics/v2/characterController.md) | Integrated physics and character-controller facilities | Does not establish SA handling or browser performance for this workload |
| 3 | PlayCanvas, [graphics](https://developer.playcanvas.com/user-manual/graphics/) and [self-hosting](https://developer.playcanvas.com/user-manual/editor/publishing/web/self-hosting/) | Browser rendering options and static deployment | Authoring and runtime workflows need separate evaluation |
| 4 | Godot, [stable web export docs](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html) | WebGL2/Compatibility renderer and export constraints | Living docs; stable source preferred over development-version search results |
| 5 | Three.js, [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html) | WebGL2 basis, diagnostics, compilation and context lifecycle facilities | API capabilities are not benchmark results |
| 6 | Three.js, [WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html) | WebGPU backend with WebGL2 fallback | Custom shader/effect equivalence requires testing |
| 7 | gta-reversed, [README](https://github.com/gta-reversed/gta-reversed) | Native injected-DLL workflow; standalone game remains the stated goal | Informal incomplete progress estimate; no browser-ready runtime established |
| 8 | aap, [librw](https://github.com/aap/librw) | RenderWare graphics reimplementation; format/platform limits | Graphics library, not the complete San Andreas game |
| 9 | Parik27, [DragonFF](https://github.com/Parik27/DragonFF) | DCC format workflow, material and animation metadata considerations | Map support includes partial/experimental areas; validate representative data |
| 10 | swift502, [Sketchbook](https://github.com/swift502/Sketchbook) | Third-person, vehicle and Blender/GLB workflow precedent | Archived; no maintained production dependency assumed |
| 11 | AlexSergey, [OpenSA lead](https://github.com/AlexSergey/opensa) | Indexed descriptions of SA-compatible browser-engine work | Direct repository, raw README, package/roadmap pages and GitHub API returned 404. No code, build or present license verified |
| 12 | MDN, [SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer) | Shared memory needs secure context and cross-origin isolation | Does not imply ordinary workers need shared memory |
| 13 | Emscripten, [pthreads](https://emscripten.org/docs/porting/pthreads.html) | Native thread-port deployment requirements | Porting strategy reference, not a ready GTA port |
| 14 | MDN, [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) | Visibility and background scheduling considerations | Pause behavior is a game-design choice |
| 15 | MDN, [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) | Offline resource interception and lifecycle | A worker does not guarantee that all game content is installed |
| 16 | Glenn Fiedler, [Fix Your Timestep!](https://gafferongames.com/post/fix_your_timestep/), 2004 | Fixed-step simulation, interpolation and catch-up hazards | General simulation guidance; not original GTA source behavior |
| 17 | Isaac Mason, [recast-navigation-js](https://github.com/isaac-mason/recast-navigation-js) | Tiled navigation and worker generation examples | Game must implement streamed-tile ownership and road traffic |
| 18 | Don McCurdy, [glTF Transform CLI](https://gltf-transform.dev/cli) | Inspection, validation and asset optimization tools | Optimization can discard needed structure unless configured carefully |
| 19 | Three.js, [KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html) | Basis-to-GPU texture transcoding | Measure chosen device formats and fallback memory |
| 20 | Rapier, [character controller](https://rapier.rs/docs/user_guides/javascript/character_controller/) | Collision-corrected movement, autostep, slope and snap settings | Does not provide animation or San Andreas-specific controls |
| 21 | Rapier, [raycast vehicle controller](https://rapier.rs/javascript3d/classes/DynamicRayCastVehicleController.html) | Suspension, propulsion, braking and wheel control | Requires a custom handling model and reference calibration |
| 22 | MDN, [Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) | Short buffers versus streaming long tracks | Radio scheduling and sound design remain application work |
| 23 | MDN, [autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) | Gesture and policy constraints on audio startup | Exact browser policies vary |
| 24 | MDN, [Pointer Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API) | Mouse delta capture and lock lifecycle | Capability/permission errors need an explicit flow |
| 25 | MDN, [OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system) | Private local file storage and worker access | Distinct from arbitrary access to the player's filesystem |
| 26 | MDN, [storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) | Variable quotas, persistence requests and possible data loss | No universal storage-capacity promise is justified |
| 27 | MDN, [WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) | Resource budgets, avoiding stalls, batching and device variation | Proposed project budgets remain unbenchmarked |
| 28 | Playwright, [visual comparisons](https://playwright.dev/docs/test-snapshots) | Screenshot comparison and environment dependence | Visual comparisons alone do not test gameplay correctness |
| 29 | DK22Pac and contributors, [plugin-sdk](https://github.com/DK22Pac/plugin-sdk) (`plugin_sa/game_sa`, MIT) | Game enums, structs and inline reconstructed helpers (e.g. `eAudioEvents.h` IDs) | Headers, not behavior; every consumed constant is verified against use in-game and recorded where applied |
| 30 | Multitheftauto contributors, [MTA:SA](https://github.com/multitheftauto/mtasa-blue) (GPLv3, active) | Long-studied behavior rules where MTA validates or drives native tasks (slots, seats, sync rules) | Mostly delegates to the original tasks; rules, not a reimplementation |
| 31 | in0finite, [SanAndreasUnity](https://github.com/in0finite/SanAndreasUnity) | Clean-room import/animation code paths for cross-checking formats | Gameplay tuning is authored Unity values, not native behavior; import code only |
| 32 | CookiePLMonster, [SilentPatch](https://github.com/CookiePLMonster/SilentPatch) | Verified original edge-case behaviors and bug-compatibility notes | Fix-level patches, not a behavior specification |

Most entries are living documentation without a fixed publication date. The access date above is the relevant currency marker. Exact dependency versions should be pinned only after an executable compatibility spike.

## Conflicts and decisions

**Original versus remastered references.** Some readily available documentation is for PC or later console releases. The PC manual is used only for the controls and settings it actually describes. The reference platform has since been settled as the original PC 1.0 release ([fidelity audit](../FIDELITY_AUDIT.md#reference-identity)), so PS2-specific lighting, presentation and timing are not the target; the executable hash and capture setup remain unverified. A modern PC import is not assumed to be visually identical.

**Renderer capability versus quality.** Three.js documents backend fallback, but that does not prove every custom material can be moved unchanged. The design chooses a WebGL2 baseline and measures any later WebGPU path against the same content.

**Existing projects versus reusable products.** `gta-reversed`, `librw`, DragonFF and Sketchbook solve different pieces. Their presence does not imply an available complete browser port. OpenSA's indexed claims conflict with current 404 responses; the correct status is unavailable/unverified, without guessing whether the repository was renamed, made private or removed.

**Reference ladder for re-engineering.** No single complete San Andreas reference exists: `gta-reversed` is the primary algorithm source but 861+ call sites still jump into the retail executable; DMCA-removed reimplementations are not pulled into this workflow. The working order is: `gta-reversed` pinned revision first, then MIT/GPL clean-room headers and rules (`plugin-sdk`, MTA, SanAndreasUnity, SilentPatch) for constants and behavior rules, then observed-data documentation (wikis, manuals) for tuning. Every consumed value records which rung it came from; unknowns stay marked unknown rather than reconstructed by guesswork.

**No backend versus no network.** Static HTTPS hosting satisfies the proposed no-application-backend architecture. First delivery and optional content downloads still use the network. Full offline play requires a verified locally installed content pack.

**Modern physics versus original behavior.** Rapier can handle contacts and rigid bodies, but physically plausible defaults are not evidence of accurate San Andreas dynamics. Measured response curves determine tuning and any custom correction layer.

## Research still needed before fidelity claims

| Open item | Why it matters | Concrete next evidence |
|---|---|---|
| Exact reference build (platform settled as original PC 1.0; see [fidelity audit](../FIDELITY_AUDIT.md#reference-identity)) | Camera, controls, art and behavior vary between versions | Executable hash, region and capture settings |
| Asset availability and approved distribution | Determines achievable content identity | Representative source files or approved authored samples |
| Original motion and camera response | No numeric baseline is established | Timed clips and input/event annotations |
| Vehicle parameters and unit conversion | Handling data cannot be assumed to map directly into Rapier | Multi-class measured trials and conversion specification |
| Wanted response and mission exceptions | Incorrect modern pursuit logic would reduce fidelity | Repeated incident, pursuit and clearing scenarios |
| Population and traffic tables | An empty or indiscriminate population misses regional character | Fixed-location observations at several times and story states |
| Full mission/activity/content inventory | Breadth cannot be honestly expressed as a percentage yet | Versioned checklist with source evidence and unique mechanics |
| Legacy import coverage | RenderWare and game-data variants can differ | Model, vehicle, skin, animation, map and collision fixture suite |
| Real browser performance | Counts alone do not establish frame rates | Dense route traces on named CPU/GPU/browser combinations |
| First-playable and total asset weight | Both depend on final content and codecs | Built manifest including all transitive dependencies |
| Reference visual appearance | Color grading alone does not reproduce platform rendering | Matched day, sunset, night and rain scenes |
| Team throughput | Schedule estimates are currently judgmental | Accepted output and rework rates after vertical slice |

## Recommended stopping boundary for this research phase

The available sources support the browser architecture and identify viable implementation tools. They do not supply the missing reference measurements or content. Additional general engine searches are unlikely to change the baseline decision. The next useful work is a small executable calibration and asset-feasibility build, followed by measured refinement of this design.


## Implementation reference check — September 13, 2026

The [PC 1.0 reverse-engineered initialization](https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/Game.cpp) passes 1000 milliseconds per game minute to the clock. [Clock.cpp](https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/Clock.cpp) describes that interval and increments game minutes accordingly. The browser simulation now uses one game minute per simulation second, replacing the provisional 0.4 rate. This is PC-reference evidence, not a matched PS2 timing measurement.

[TimeCycle.cpp](https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/TimeCycle.cpp) samples hours 0, 5, 6, 7, 12, 19, 20 and 22, wrapping to midnight. The authored table in `src/world/timecycle.ts` follows those sample times; it now serves only as the fallback. The game lights itself from the published original `timecycp.dat` through `src/world/LocalTimecycle.ts`, with weather interpolation and timecycle boxes ([timecycle](TIMECYCLE.md), [timecycle boxes](TIMECYCLE_BOXES.md)).

## Camera control implementation evidence — September 13, 2026

Rockstar's [PC manual](https://cdn.akamai.steamstatic.com/steam/apps/12120/manuals/GTASA_PC_MANUAL_FINAL.pdf), PDF pages 5–6, provides the temporary-view bindings: middle mouse for rear view, Numpad 1 as the on-foot keyboard alternative, and vehicle Q/E side views with their combination selecting rear view. Direct PDF download and local text extraction were used because the web parser rejects this file's size. This supports the bindings; it does not establish measured camera distance, elevation, recenter delay, interpolation or collision response. Those remain authored in the prototype.

The same PC manual, PDF page 5, assigns C to crouch. The game binds it as `PED_DUCK` (`src/input/nativePadState.ts`); crouched movement follows `CTaskSimpleDuck` (`src/locomotion/nativeDuck.ts`) at the `ped.ifp` root-motion speed (`NATIVE_CROUCH_WALK_SPEED` in `src/simulation/Simulation.ts`).

## Follow distance modes — September 13, 2026

The PC manual (PDF pages 5–6) assigns V/Home to camera changes. The game cycles three follow distances and keeps distinct walking/driving preferences (`src/render/cameraSettings.ts`). On foot they are 1.5/2.9/3.6 units, informed by [Camera.cpp](https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/Camera.cpp)'s `CCamera::Init` ground zooms and script ped zooms, replacing the earlier authored 2.8/4.8/6.4 metres. In a vehicle the three zooms scale the per-vehicle chase distance by an authored 0.75/1/1.35 (the native distances live in the unreversed `Process_FollowCar_SA`) and are followed by the bumper view.


## Implemented local texture reader

The [asset format record](ASSET_FORMATS.md) documents the IMG/TXD reader, primary implementation references, Direct3D block-compression specification, independent DragonFF fixture, and supported-format/retail-validation limits. No retail assets were acquired for this work.

## Native animation interpretation

The [animation format record](ANIMATION_FORMATS.md) pins native keyframe and hierarchy references, documents the translation-scale conflict, and separates authored fixture verification from missing retail animation evidence.

## Gameplay reference check — September 16, 2026

Pinned gta-reversed revision `0076f9017b4aeef7433957ac2bd8b6988e9df166` supplied the task-level behavior used across this round: `TaskSimplePlayerOnFoot.cpp` (move-blend slew, sprint/jump gating, aiming rotation), `TaskSimpleJump.cpp` (player launch force and momentum, blocked-launch probe), `TaskComplexJump.cpp` (air/land sequencing), `PlayerPed.cpp` (move-blend stops, FindPedToAttack line logic), `TaskSimpleArrestPed.cpp` (arrest gun pose and states), `Population.cpp` (creation-distance multiplier, ManagePed removal bands, cop override), `Wanted.cpp` (chaos thresholds, cop/car caps, decay and elusive rules), `TaskComplexCopInCar.cpp` (crew return) and `Entity/Ped/CopPed.cpp` (SWAT/FBI/army loadouts with shooting accuracies 60/68/76/84). `CTaskSimpleFight`, `ControlButtonSprint`, `SetRealMoveAnim`, `CalculateNewVelocity`, `CProjectileInfo` and `CHeli` remain executable calls or unreversed files upstream; the browser marks those approximations explicitly instead of presenting them as ports.

Native tuning tables come from the public dataset mirrored in `scripts/content/world-sources.json` (hashes recorded there, not retail-authenticity claims): `melee.dat` (UNARMED_1 fist chain plus BBALLBAT/KNIFE/SWORD/DILDO/FLOWERS tables, all 1.6 m reach), `pedstats.dat` (attack/defend/temper rows), `pedgrp.dat` (Gang 1–10 and dealer rosters), `peds.ide` (ped type, stats and anim-group assignment), `animgrp.dat` (walkcycle clip sets, all in ped.ifp), `weapon.dat` melee rows (per-weapon baseCombo mapping) and `object.dat` (entity kinds, explosion flags). Speeds derive from ped.ifp root motion measured in the verified depot. Authored mappings built on top of these values (elite accuracy scaling, gang hostility subset, dealer/turf probability rolls, stamina rates, slide/turn blending) are labeled as such where applied.
