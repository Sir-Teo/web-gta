# Accuracy-first build blueprint

This decision record sharpens the [full design](DESIGN.md) for the priority of maximum San Andreas accuracy. It describes proposed work, not achieved compatibility. Use the [implementation plan](IMPLEMENTATION.md) for system contracts and the [research register](research/SOURCES.md) for source limitations.

## The central decision

Build a local, single-player compatibility runtime with a browser renderer. Reconstruct the original content and behavior through documented importers, original-data interpretation and measured reference trials. Use an independently authored pack for development and distribution when original content is unavailable. Keep those packs interchangeable through stable content interfaces.

The runtime remains TypeScript, Three.js/WebGL2 and Rapier/WASM, served by static HTTPS hosting. Asset conversion runs in workers on the player's device or in local authoring tools. No game server, account, remote save database or remote simulation is needed. Offline use is a separate installation milestone: all required content must be present locally before it can be promised.

This is a fidelity strategy, not a claim that native game files will run unchanged. Reading world geometry, implementing gameplay semantics and reproducing the campaign are three separate programs of work.

## 1. Pin one reference before calling anything accurate

The user selected **original PC 1.0** on September 17, 2026 as the one-to-one target for both behavior and presentation. This supersedes the earlier provisional PS2-era visual target. Exact executable identity/hash, region, graphics settings, resolution, aspect ratio, frame limiter and capture path still need to be recorded before reference approval. PS2-inspired rendering choices are compatibility gaps until verified against PC 1.0; browser convenience features are not evidence of original behavior.

Every reference trial records:

```text
reference build and platform
capture resolution, aspect ratio and output processing
location, heading, camera mode, time and weather
story state, player stats, equipment and health
vehicle model, condition, load and surface
input sequence, frame timestamps and observed events
source/provenance and confidence of the measurements
```

Create a small fixed trial set: idle panorama, walk-start-stop-turn, sprint and jump, obstructed camera, car entry and exit, straight acceleration, braking, a constant-input corner, curb impact, one police incident and one mission retry. Capture video for motion. Screenshots alone cannot establish gait or handling accuracy.

Maintain separate completion fields for implemented, integration-tested and reference-matched. Leave reference match unknown when the evidence is absent. Do not publish an overall fidelity percentage without a defined inventory and scoring method.

## 2. Preserve original meaning through the asset pipeline

Use native formats as ingestion formats and a versioned internal content representation as the runtime contract. GLB remains suitable for newly authored models, but conversion must retain game-specific metadata in sidecars or documented extensions. The default optimization pipeline must not silently remove night colors, frame names, animation anchors or material behavior.

| Input family | Information the runtime needs | First acceptance fixture |
|---|---|---|
| IMG, IDE, IPL | Archive references, model IDs, texture inheritance, transforms, interiors, LOD links and relevant flags | One placed block with repeated models, a texture parent and its LODs |
| DFF and TXD | Frame hierarchy, materials, UVs, source mip levels, addressing, alpha, prelighting and supported platform variants | Road, foliage, glass, vehicle and day/night building samples |
| Skinned DFF and IFP | Bone mapping, bind transforms, clip timing, interpolation and action synchronization | Idle, walk, run, jump and car-entry clips on one rig |
| COL | Physical surfaces, static geometry, model association and separate dynamic-vehicle collision requirements | Stairs, curb, wall, slope and vehicle contact fixtures |
| Handling, weapon and population data | Source units, flags, relationships and formulas that consume the fields | Two contrasting cars, one weapon and one regional population table |
| Paths and navigation | Lane connections, route rules, pedestrian connectivity and sector ownership | One junction plus an adjacent walkable block |
| Timecycle, weather and effects | Interpolation, region overrides, material interactions and effect scheduling | Matched daylight, sunset, night and rain scenes |
| Text, audio and scripts | Stable IDs, scheduling, localization, sound events and script-native behavior | One fully traced conversation and mission segment |

Support one source release first. Reject unsupported variants explicitly, and report missing dependencies with their source IDs. Keep a converter version and source hash in every cached pack so a corrected importer invalidates stale output.

Before lossy optimization, preserve a small unoptimized reference fixture. Compare winding, bounds, UVs, alpha edges, mip transitions, animation poses and day/night states after conversion. Independently exported diagnostic fixtures verify parser behavior; only representative original files and captures can establish retail compatibility.

Relevant primary references are [DragonFF](https://github.com/Parik27/DragonFF) for interchange tooling and [librw](https://github.com/aap/librw) for RenderWare graphics behavior. Neither supplies the complete game's rules.

## 3. Build a reference renderer before beautifying the city

Start with one controlled material scene. Define texture sampling and color conversion explicitly, then reproduce prelighting, time/weather modulation, alpha testing and blending, fog and draw order. Add platform-specific screen processing only after the underlying scene matches. Do not conceal wrong source colors with a global orange tint.

Use separate reference and enhanced presentation presets. The reference preset fixes its virtual resolution, viewport, HUD scaling and effect choices. The enhanced preset may increase output resolution and selected quality settings, but must retain the same simulation. Pin the GPU/browser for image regressions and use additional human review across devices.

WebGL2 is sufficient as the initial implementation target; Three.js documents it as the basis of [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html). The claim that this particular full game will run well still requires measurements. Introduce a second graphics backend only when an identified problem justifies its compatibility cost.

## 4. Treat physics and animation as compatibility systems

Rapier supplies collision and rigid-body infrastructure. It does not interpret the original handling file or reproduce the original driving model automatically. Preserve source parameters, document unit conversions and implement the response equations or calibrated corrections that consume them.

Tune the car against acceleration, braking and steering traces before suspension cosmetics. Repeat the trials with a contrasting car early. Match the character's velocity and camera framing together, then synchronize animation phase with footsteps, jump launch, landing, seat transfer and door movement. Do not let a skipped render frame skip a gameplay event.

A more physically realistic tire or more elaborate animation blend can reduce fidelity if the reference behaves differently. Keep the implementation that best reproduces the observed outcome and document intentional accessibility or usability deviations as options.

## 5. Decide campaign compatibility early

Use typed mission graphs to test the engine and to author original scenarios. For an exact campaign, evaluate an SCM-compatible interpreter as a separate architecture decision before manually translating large numbers of missions.

The interpreter requires more than opcode decoding: script threads and waits, variables, entity handles, native command semantics, mission cleanup, cutscene state, audio scheduling and saved script state must agree with the reference. Keep its command interface independent of rendering and connected to the same simulation commands as authored missions.

The first proof is one bounded original mission segment with an execution trace and its success, failure, skip and reload cases. Expand by command families only after this works. If interpretation proves impractical, record the decision and reconstruct missions against explicit event traces. Never equate a high opcode count with campaign completeness.

The [gta-reversed project](https://github.com/gta-reversed/gta-reversed) is an implementation research source. Its native injected-DLL workflow and stated standalone goal do not establish a complete engine ready for browser compilation. Any reuse proposal needs a pinned build, dependency and license assessment, and an actual browser compatibility experiment.

## 6. Stream behavior and dependencies, not just meshes

A world cell owns or references visuals, collision, navigation, lane graph, population rules, audio and persistent changes. Its dependencies become ready together before the player can interact. Keep original LOD relationships and interior membership even if the browser uses a different spatial index.

Prioritize loading by measured time to contact, with directional lookahead and mission reservations. Collision under the player, occupied vehicles and mission actors is pinned. Use a controlled transition when required data is unavailable. It is a correctness defect to allow entry into visible ground whose physical data is still loading.

Share model and texture resources by stable content identity. Separate placement lifetime from shared-resource lifetime. Verify cancellation, failed conversion, scene replacement and eviction release all owned GPU and physics objects without releasing resources still in use.

Keep saves in transactional IndexedDB records and large imported assets in a managed local cache, with exportable saves. Browser quotas and eviction policies vary; the application must handle quota denial and missing cached content rather than assume permanent storage. [MDN storage documentation](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

## 7. Sequence production by evidence

| Gate | Deliverable | Evidence required to expand |
|---|---|---|
| A: Reference and content | Pinned reference manifest; one block, rig and car | Source dependencies understood; import and comparison possible |
| B: Static fidelity | Correctly placed street with materials, collision and LODs | Matched view comparisons; walking contacts agree with visible ground |
| C: Motion fidelity | Animated player, camera and one usable car | Repeatable motion, entry/exit and handling comparisons |
| D: Living district | Streamed streets, traffic, pedestrians, weather and audio | Stable traversal, consistent population transitions and bounded memory |
| E: Complete loop | Combat, low-level police response, mission, failure, save and reload | All branches exercised; critical behavior reference-matched |
| F: Distribution | Static build, installed offline pack and update recovery | Cold launch, offline restart, storage failure and version migration tested |
| G: Expansion | More districts, campaign content and vehicle families | Existing gates remain passing; throughput supports the next scope |

Prioritize gates A–C over additional placeholder city area. During A, investigate script compatibility enough to avoid a later architectural dead end; complete campaign integration belongs after the common simulation is reliable.

The browser performance budgets in the full design are hypotheses. Validate them on named machines using a dense route, cold asset loads, rapid direction changes and a sustained session. Report frame-time distributions, memory trends and stalls separately. Test fixtures and headless renders do not establish consumer GPU performance.

## Immediate design conclusion

The highest-value next investment is reference acquisition plus skinned-model/animation and material compatibility, followed by measured movement and vehicle behavior. The existing static import work can support this direction, but it is not proof of original visual or gameplay parity. Expand the map only when a small representative area survives these comparisons.
