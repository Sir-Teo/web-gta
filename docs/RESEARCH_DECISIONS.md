# Browser San Andreas: research decision brief

Reviewed September 13, 2026. Read the [full design](DESIGN.md), [accuracy blueprint](FIDELITY_BLUEPRINT.md), [source register](research/SOURCES.md), and [implementation evidence](PROGRESS.md) together. This brief resolves production priorities; it does not certify original-game compatibility.

## Recommended product

Build a desktop-first, single-player compatibility runtime delivered from static HTTPS hosting. All simulation, missions, asset conversion, sound scheduling and saves run locally. An original or licensed development pack keeps the runtime usable independently; a local import path provides the strongest route to original geometry and animation when suitable content is available. Importing assets alone does not implement their behavior or the campaign.

The provisional presentation target remains the original PS2 era, with PC asset ingestion tracked separately. Before approving fidelity, pin one edition, region, aspect ratio, resolution and capture path. A PC asset build with console-inspired effects is a hybrid until comparisons establish its actual match. Do not silently combine original, remastered and modern GTA conventions.

## Architecture and ownership

| Layer | Decision | Accuracy requirement |
|---|---|---|
| Simulation | TypeScript state, fixed-step updates, explicit commands and events | Rendering frequency must not change rules or skip animation-triggered events; calibrate timing against the selected release |
| Graphics | Three.js WebGL2 with isolated compatibility materials | Preserve source lighting, sampling, alpha, fog, draw order and LOD semantics before adding enhanced effects |
| Physics | Rapier/WASM as collision and rigid-body infrastructure | Implement and calibrate character and vehicle response separately; source handling values do not automatically become correct behavior |
| Content | Native import into a versioned internal representation; GLB for authored content | Retain IDs, frames, bones, prelighting, texture relationships, surface types, placement identity and LOD links |
| Loading | Worker decoding; dependency-aware residency; bounded main-thread installation | Visuals, collision, navigation and mission dependencies become usable coherently |
| Missions | Shared simulation command interface; authored graphs initially | Evaluate SCM interpretation early, including threads, waits, native commands, cleanup and saved script state |
| Interface/audio | DOM menus and HUD; Web Audio effects and long-track playback | Match framing, status conventions, event timing, spatial mix and radio continuity |
| Persistence | Transactional IndexedDB saves, managed large-asset cache, save export | Version saves and cache manifests independently; recover when cached content disappears |

Main-thread rendering and simulation are the initial ownership model; move simulation to a worker only after profiling justifies the synchronization cost. Parsing workers can transfer decoded buffers without requiring shared memory. Static hosting supplies files and any required headers; there is no application server. A service worker enables an offline installation workflow only after the selected content pack is completely cached and verified.

Three.js explicitly targets WebGL2 in its [renderer documentation](https://threejs.org/docs/pages/WebGLRenderer.html). Storage capacity and eviction vary by browser and device, so installation must handle quota failures and missing content rather than promise permanent storage. [MDN storage documentation](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

## Decisions that most affect clone accuracy

1. **Acquire a reference corpus before expanding content.** Capture matched street views and repeatable movement, camera, driving, combat and mission trials. Record world state and input timestamps. Source code is supporting evidence; ambiguous or incomplete reconstructed functions need observed confirmation.
2. **Make one authentic block the rendering laboratory.** Include a road, curb, stair, foliage, glass, a timed building and its LOD. Compare day, sunset, night and rain. Preserve an unoptimized fixture so conversion losses can be isolated from shader errors.
3. **Match the player, camera and vehicle together.** Gait, acceleration, turn response, jump launch, landing, car entry, door timing, chase offset and suspension all shape the recognizable experience. Start with one car, then a contrasting class to expose overfitting.
4. **Stream complete world dependencies.** Pin ground collision, occupied vehicles and mission actors. Use directional loading lookahead and a defined recovery transition when required data is unavailable. Never permit movement onto visible but unloaded collision.
5. **Investigate mission compatibility before authoring the whole story.** A script interpreter is useful only when its command semantics reproduce the required gameplay. Prove one bounded segment through success, failure, cancellation and reload before counting supported opcodes.
6. **Expand through acceptance gates.** Add population, low-level pursuit, combat and a complete mission loop inside the validated district. Expand geography and specialist vehicle families only while those comparisons and resource budgets continue to pass.

## Reuse assessment

The current [gta-reversed README](https://github.com/gta-reversed/gta-reversed) describes an injected DLL and a future standalone goal. It is useful for investigating behavior, but does not establish a complete engine that can simply be compiled to WebAssembly. A port proposal needs a working standalone build, dependency inventory, permission-compatible reuse and a browser experiment before replacing the recommended architecture.

[librw](https://github.com/aap/librw) addresses RenderWare graphics, and [DragonFF](https://github.com/Parik27/DragonFF) supports asset tooling. Treat them as focused references and validate the specific format variants used. Preserve game metadata beyond ordinary glTF when converting. Generic PBR replacements, procedural city generation and generated character approximations are poor substitutes for reference data when exactness is the priority.

## Evidence required before each expansion

| Stage | Deliverable | Stop expanding until |
|---|---|---|
| Reference | Version manifest, asset dependencies, capture scenarios | Target and provenance are explicit |
| Static block | Correct transforms, materials, collision, timed objects and LOD | Matched views and traversal are verified |
| Motion | Player rig, camera, one car and a contrasting car | Input/event traces and handling trials agree within documented tolerances |
| Living district | Streamed streets, population, weather and sound | Sustained traversal has bounded memory and no missing physical dependencies |
| Complete loop | Combat, pursuit, mission, failure and saves | All branches and reload behavior are exercised |
| Distribution | Static release and optional installed offline pack | Cold launch, offline restart, quota denial, context recovery and migration work |
| Full recreation | Remaining world, campaign, interiors, activities and transport | A release-specific inventory has evidence for every claimed feature |

Set numerical fidelity tolerances after measuring capture repeatability. Set performance budgets on named target hardware and report frame-time distributions, loading stalls and memory trends; a passing headless test is not a consumer-device benchmark. Keep implemented, integration-tested and reference-matched statuses separate.

## Present project boundary

The repository already has an authored playable foundation and diagnostic native-format import, animation and collision work. Its latest progress record includes timed-model fallback, LOD identity, replacement collision exclusion and inherited visibility bounds. Actual distance/LOD selection, full streaming, retail asset verification and campaign parity remain unfinished. These foundations inform the plan but do not prove visual identity with San Andreas.

The next accuracy-first work is to obtain the reference evidence, complete a representative imported block's rendering and LOD behavior, and calibrate motion against that evidence. Further placeholder map expansion would add coverage without resolving the largest fidelity uncertainties. Full campaign parity is a substantial game-production program; a defensible schedule needs the content inventory and measured throughput from the first validated district.
