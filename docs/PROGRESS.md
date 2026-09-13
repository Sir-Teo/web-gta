# Production progress

The full production-level clone objective remains active. This file records concrete implementation evidence and the largest remaining gaps; it does not redefine completion around the current slice.

## Implemented foundation

- TypeScript/Vite static browser application; Three.js rendering and Rapier physics.
- Fixed 60 Hz simulation with bounded catch-up and independent rendering.
- Authored residential street, turning head, houses, palms, utilities, cross street and bridge. Static surface UVs now use authored metre-based repeats, retaining consistent concrete grain, siding courses and roof tiles across differently sized meshes; labels retain their own UVs.
- Shared render/collision placement for house foundations, porches, stairs, posts, fences and mailboxes; pitched roof, palm trunk, utility pole, lamp pole and bridge-parapet collision. Raised sidewalk slabs support curb traversal. The turning-head curb opening follows the street entrance; offending fences and poles are moved out of the roadway.
- Kinematic character movement, sprint stamina with stable exhaustion recovery, jump, grounded behavior and an articulated visual stand-in. C toggles crouching on the ground, with a shorter capsule, reduced speed, camera lowering and an authored bent-leg pose. Standing checks overhead clearance, vehicle entry stands first, and saves preserve crouched stance, stamina and exhaustion. Exhaustion latches at zero and clears at 20 stamina, preventing frame-by-frame sprint/recovery oscillation.
- Physical sedans with raycast suspension, steering, propulsion, braking and handbrake. Compatible opaque body parts are batched by material and shadow policy; animated groups and transparent glass remain independent.
- Four transient cars follow the cross street in both directions using the same wheel physics, lane correction and forward shape-query braking. Distant endpoint recycling reuses the fixed pool; cars wait when an endpoint cannot safely recycle. Traffic cars have visible seated drivers and night lights. Taking a stopped car removes its traffic control and retains it in saves.
- Simulation-owned vehicle approach, door opening, seating/unseating and closing; stationary/upright checks, driver-door clearance checks, approach cancellation and control gating.
- Hinged driver doors, separated cabin surfaces, interior seats/steering wheel and a visible seated protagonist.
- Follow/chase camera with a collision-volume sweep, pointer drag and optional lock. PC-manual temporary look controls provide vehicle side/rear views and on-foot rear view; release restores the stored orbit without reversing walking input. Radar and audio listener follow the displayed orientation. V/Home cycles three follow distances with separate on-foot/vehicle choices persisted on the device, smoothed distance changes and collision shortening in every mode.
- Geographic radar, status HUD, pause/resume, focus handling and graphics-context recovery flow. Health now drives the HUD and is saved; hard landings apply damage once. Actual vehicle collider contacts use pre-solver linear/angular motion and relative approach along the contact normal to damage an on-foot player. A contact episode produces one hit, with separation required to rearm; a brief flinch, input interruption and collision-constrained knockback accompany nonfatal hits. Fatal falls gate movement/interaction, show a short death pose and Wasted overlay, block saves, and recover after four simulation seconds. Pausing freezes that recovery. The armor display is empty while no armor system exists.
- IndexedDB current/previous-good saves, continuation after reload, save-file export and validated import.
- Static DFF model preview linked from the texture library: worker parsing, hierarchy/atomic references, positions/normals/UVs, material assignments, day/night vertex colors and triangle-list/strip support. One root basis rotation preserves scale and winding. Local VER2 IMG archives can be searched for models and dictionaries, with IDE-defined dictionary associations and child-first texture-parent lookup, same-name fallback suggestions and a separate-file override. Only selected payloads are read. A selected TXD binds matching textures with source mip chains, filtering/addressing and embedded alpha; referenced pixels are decoded in the worker under a 64 MiB limit. Shared GPU textures are released on replacement/removal. Orbit/pan/zoom, source-color interpolation, missing-texture/plugin notices, explicit skinning/native-format rejection and replacement cleanup are available. See [model format evidence](research/MODEL_FORMATS.md).
- Local texture library linked from the pause menu: selective VER2 IMG directory/file reads, PC Direct3D 9 TXD decoding, native mip previews, sampling metadata and explicit unsupported-format errors. Parsing/decoding runs in a worker; clear/replacement terminates it. No local assets are uploaded or persisted. See [format evidence and limits](research/ASSET_FORMATS.md).
- Ten transient residents with deterministic idle timing, sidewalk corridor following, local separation, parked-vehicle yielding and predicted-path evasion. Decisions are staggered; movement remains on the physics clock.
- Instanced articulated crowd parts with clothing/skin palettes and interpolated transforms. Restored saves regenerate transient residents away from the player and cars.
- Terrain heightfield replaces the large ground box after a regression exposed capsule contact instability.
- Clock rate now follows the PC reverse-engineering reference: one game minute per simulation second.
- Clear-weather time-of-day table drives sky, fog, ambient light, sun direction and shadows, window emission, street lights and stars. Driven cars have a shadowed headlight beam and tail/brake-light response.
- Local licensed recordings for concrete/grass footsteps, car doors and an engine loop; HRTF spatial positioning, pitch response with provisional gear bands, horn and procedural wind/cricket ambience.
- Master/effects/ambience buses, a compressor, persistent mix/mute settings, a 16-one-shot limit, graceful asset/device failures, and audio suspension with transient cleanup during pause.
- Fixed-clock, time-cycle, audio, save, vehicle and population tests, plus browser scenarios for real controls and persistence.

## Current fidelity and production gaps

The map is an authored approximation with limited extent, not an imported or measured original map. Street props currently use static collision: fences, mailboxes and poles do not break or fall, and climbing/vaulting is absent. Cylindrical trunk proxies and segmented curb proxies are conservative approximations; overhead wires, lamp arms and decorative details are not complete collision meshes. Character geometry, animation and vehicle meshes are stand-ins. Crouch speed (1.4 m/s), capsule dimensions, pose and transition rate are authored, not original-game measurements. Sprint drain (12/s), recovery (8/s), and the 20% restart threshold are authored; stamina progression, training and original exhaustion animation/audio remain absent. Stamina currently updates during on-foot movement only. Crouched aiming, stealth reactions and crouch rolls remain absent. Health currently covers on-foot landing impacts and vehicle strikes against the player. Vehicle damage uses an authored 2 m/s approach threshold and 8 health per excess m/s, with a 0.6-second interruption and damped horizontal knockback. Contact tolerance is 4 cm and separation must last 0.15 seconds to rearm. The flinch is an authored arm pose; knockdowns, directional clips, injury sounds, ragdolls, and reference-calibrated damage are incomplete. The 10 m/s safe landing threshold, damage slope, four-second death sequence and neighborhood-spawn recovery are authored. Hospital locations, time advancement, medical fees, inventory losses, maximum-health progression, healing, armor, combat/occupant damage, ragdolls and original death animation/audio remain incomplete. The death pose retains the kinematic collision capsule. Handling parameters, camera timing, weather and all numeric behavior still need the reference measurements specified in the design. Vehicle transitions now have authored choreography, but lack original animation clips, hand/foot IK, automatic routing around the car, passenger-side exits, carjacking and physically simulated doors. Door clearance uses a conservative query volume. The 0.4/0.7/0.35-second opening/transfer/closing timings are provisional, not measurements of the original game.

There are no story missions, police, combat, original radio/dialogue, bicycles, swimming, aircraft, full progression, interiors, world-sector streaming, complete original-district importer or offline installation yet. The local texture library is an inspection tool; source textures can now accompany static imported scenes in a temporary game window; the authored neighborhood still uses its own materials. Static DFF geometry now has an inspected preview path with a tested basis conversion. Full skeletal/animated DFF compatibility, complete IDE/IPL/COL support and full IFP/skeleton playback, gameplay texture/material binding, source-hash caching, GPU compressed uploads and retail-installation compatibility remain incomplete. Traffic currently covers only two straight cross-street lanes. It lacks intersection/turning routes, signals, overtaking, roadblock recovery, regional vehicle selection and full population streaming. Cruise target and braking are authored, not reference-calibrated. Claiming a traffic car currently removes its driver visual when entry starts; driver exit, resistance, dialogue and carjacking animation remain absent. Vehicle impacts now damage the on-foot player; vehicle occupants and ambient residents still lack injury handling. The initial pedestrian population uses a hand-authored sidewalk corridor and the same provisional articulated body with appearance variations. It lacks navmesh routing through the district, road crossing logic, dialogue, social/gang behavior, injuries, ragdolls, population streaming and regional/time-dependent spawn rules. Evasion does not implement vehicle-impact damage; pedestrians still use kinematic capsules. The clock now drives a complete authored clear-weather day/night palette. Its colors, orbit, light intensity and fog are provisional; original timecycle assets, regional/weather blending, clouds, moon and original post-processing still need work. The current driven-car beam uses one projector between the two lamp meshes, not measured original twin-beam optics. The audio is a locally hosted foundation using third-party recordings and authored procedural beds. It does not reproduce original samples, radio continuity, speech, acoustic occlusion, Doppler, multiple engine/load layers, ignition or source-matched mix behavior. No subjective original-game listening comparison has been performed. Gamepad/touch support, schema migrations, production-host testing and long-session memory/performance verification remain work. These omissions prevent any claim of production readiness or full authenticity.

## Next priority

Continue improving character/vehicle assets and the neighborhood composition, establish reference-calibrated handling/camera, and expand traffic through the district, expand impact reactions to residents and add the first mission loop. Replace the provisional transition poses with approved animated assets and add navigation around cars and alternate exits. Track real hardware results separately from the proposed budgets in the design.

## Verification record — September 13, 2026

- Production TypeScript compilation and Vite build pass.
- Ninety-eight unit cases pass: fixed-clock and save validation checks, plus five Rapier simulation cases covering timed entry/exit, input gating, blocked/moving cars, approach cancellation, reset during transfer, pushed-vehicle recovery, repeated interaction and blocked exits; and four population cases covering two minutes of corridor traversal without overlap, vehicle evasion/recovery, parked-obstruction recovery and regeneration after loading; plus time-cycle checks for midnight wrap, continuous sample boundaries and full-day light ranges; and audio checks for malformed settings, deterministic bounded signal synthesis, grounded footstep events/reset and single door-cycle events. Five scenery cases cover a clear street entrance and pole/parapet ray hits, fences stopping a walking character and moving car, porch-step ascent, falling onto pitched roofs, and walking across a raised sidewalk. Two camera cases cover input combination precedence, vehicle-relative side/rear orientation and orbit preservation. A UV regression case checks world-to-texture edge lengths on long pavement, vertical walls and rotated/sloped surfaces. Three crouch cases cover foot-height stability within controller clearance, speed and sprint/jump gating, traversal under a low overhang with blocked standing, and save restoration/backward compatibility. Additional camera checks cover cyclic modes, malformed preference fallback, bounded speed expansion and wall shortening at every follow distance. Four traffic cases cover three minutes of lane following/recycling with a fixed 17-body population, braking/resuming for a pedestrian-shaped obstacle, entry/exit and persistence of a claimed car, and load-time separation from the saved player. A vehicle batching case checks transformed geometry, retained animated/glass parts, shadow policy and shared-geometry ownership. Two crouch-gait cases check sole clearance and ankle orientation across a full cycle and five stance blends, plus planted-foot travel matching normal crouch speed. Three health cases cover safe jumps, one-time fall damage, fatal-fall control/save gating and timed recovery, and backward-compatible saved health. Two stamina cases cover uninterrupted recovery under held sprint, eventual sprint resumption, saved exhaustion, malformed values, old saves and player reset. Four vehicle-impact cases cover physical strikes, interruption and knockback, save gating, fatal recovery, fast near misses, walking into parked cars, tangential motion, sustained-contact suppression and rearming after separation. Nine asset cases cover DXT endpoint/alpha behavior, small mip blocks, native metadata/mips, uncompressed and palette channels, malformed chunks and unsupported formats, selective IMG reads, invalid directory ranges/names, extraction-time bounds checks, and a TXD generated independently by DragonFF from original diagnostic pixels. Five model cases cover independently exported DFF data, transformed bounds, winding and material groups, day/night color interpolation, strip/list equivalence, malformed indices/hierarchies/native/skin data, and extreme world bounds. Four texture-binding cases cover case-insensitive selection and duplicates, retained mip pixels and sampler modes, shared material texture ownership/disposal, and an independently exported companion dictionary.
- Thirty-three Chromium browser scenarios are covered (the previous 23 passed together; all thirteen model-preview cases passed after the archive and IDE additions): movement/jump/pause/save/reload; vehicle approach/entry/driving/braking/exit, including pause during transfer and rejection of a mid-transition save; save export/import/rejection/latest-slot continuation; forced graphics-context recovery plus resize; crowd movement/pause/resume with stable renderer resource counts; and save-import restoration of noon, sunset, dawn and midnight, paused-clock stability and nighttime entry/driving without runtime errors; plus audio startup/signal/mute persistence, missing-file fallback, pause during downloads and audio-device initialization failure; and on-foot rear-view movement, middle-mouse release and pause recovery. The driving scenario also checks left, combined rear and right views and restoration on key release. A crouch scenario checks keyboard toggling, camera lowering, reduced movement speed and persistence through reload. Camera-distance testing checks V/Home, held-key repeat suppression, near/far framing and persistence; the driving scenario verifies that changing the vehicle mode preserves the on-foot mode. A cross-street traffic scenario checks motion, pause freezing, stable renderer resource counts and absence of runtime errors. A fatal-fall scenario checks the health gauge, Wasted display, paused recovery timer, rejected death-state save and restored health after respawn. A sprint scenario imports low stamina, exhausts through real keyboard input, checks steady walking speed, saves/reloads the exhausted state and waits for recovery. A traffic-crossing scenario uses real sprint input immediately in front of an approaching bumper, verifies health loss, frozen recovery during pause, save gating, hidden entry prompt during interruption and resumed control. Three texture-workshop scenarios verify local file/worker decoding and exact preview pixels, original mip selection, no uploads, archive search/selection and bad-data recovery, replacement/cancellation and a 390-pixel layout. Thirteen model-preview scenarios check visible triangles, day/night pixel changes, orbit/reframing, source metadata, malformed-file recovery, replacement and a narrow viewport, plus TXD binding/removal, rendered pixel changes and stable GPU texture counts across repeated loads. Archive cases add model/dictionary search and suggestion, missing models, malformed entries, dictionary overrides and switching back to standalone files.
- The production smoke check verifies that the loading menu renders while the physics download is held, then starts the game, checks the absence of development hooks, and observes only requests to its own static origin. It also opens the texture workshop from the game menu and decodes the independent TXD with the production worker bundle. It follows the model-preview link, loads an independent DFF, checks untextured and textured framebuffer pixels using the independent companion dictionary, verifies the model development hook is absent, and checks identical rendered pixels when the same DFF/TXD pair is read directly from a synthetic IMG archive. The game does not request the separate orbit-control bundle.
- Production observation: Chrome 152.0.7977.83 using ANGLE Metal on Apple M5 Pro, at 1440×900. This is a smoke test and visual inspection, not a sustained performance benchmark or a browser-support certification.
- The entry and driving captures were visually inspected: the open driver door and cabin are visible, and the driver remains seated while driving. These are still primitive authored meshes.
- Before the time-cycle lighting change, a 30-second observation in headless Chrome, development mode, with a stationary camera at 1440×900 recorded 1,801 animation frames, median/p95 interval 16.7 ms, 246 render calls and 86,726 triangles in the final frame. Geometry/texture counts stayed at 176/16. This bounded observation is not a production traversal benchmark or heap/GPU-memory measurement. `artifacts/population-observation.json` records it.
- The neighborhood crowd screenshot was visually inspected; residents appear along the sidewalk with distinct clothing colors. After physical scenery was added, the two-minute traversal and car-evasion recovery cases still pass. Residents spawn above the raised pavement, and their slope-slide settings now match the player to avoid stalling at curb edges. Daytime, entry and nighttime-driving captures were inspected again for scenery placement and readability.
- Noon, sunset, dawn, midnight and nighttime-driving captures were visually inspected. Night windows, street-light pools and the headlight beam are visible; this checks readability and integration, not original-game pixel parity.
- The audio capture check records the actual output graph during walk/entry/driving/horn/pause. The latest 9.66-second stereo capture measured peak 0.183, RMS 0.0154 and zero clipped samples; pausing left zero one-shot voices and a suspended context. This is signal/lifecycle evidence, not a listening verdict. Nine decoded recording buffers and five continuous sources are used; source PCM assets total 720,018 bytes.
- Vehicle-body batching was observed in a fixed side view at 1440×900 in development Chrome: 120 sampled frames before and after recorded 373 → 268 render calls, 91,386 triangles in both runs, and loaded geometry counts 241 → 171 with 21 textures in both. This is a bounded submission-count comparison, not a frame-rate, heap or GPU-memory benchmark. Before/after images were visually inspected. `scripts/observe-vehicle-rendering.mjs` reproduces the observation against a dev server on port 5183 and writes images/JSON under `artifacts/`.
- The cross-street traffic capture was visually inspected: a moving car and its seated driver are visible in the correct lane. The fixed-pool and pause checks passed; this is not a long-session rendering benchmark or full traffic-behavior validation.
- The Wasted capture was visually inspected: the player is collapsed, the health bar is empty and the overlay is readable. This verifies the authored sequence only; it does not establish original-game death/recovery parity.
- The crouched pose was visually inspected and corrected with ankle pivots so idle soles remain flat. The crouch and vehicle-entry browser scenarios passed again after that correction. The gait now uses a two-bone leg solve with planted and swinging foot targets; full-cycle checks prevent sole penetration on the local ground plane. Crouch cadence is tied to distance traveled. Moving/idle captures were inspected, and targeted crouch, vehicle-entry and crowd browser checks passed after the gait change. Per-foot terrain probes, slope adaptation and original animation clips remain absent.
- The audio settings menu was visually inspected at 1440×900.
- After the surface UV change, neighborhood and rear-view captures were inspected: the previous lengthwise sidewalk streaks are removed and roof/siding detail remains visible. Tile sizes are authored, not original-asset measurements; visible procedural repetition and missing original materials remain fidelity gaps.
- Near/far follow captures were visually inspected at 1440×900: both keep the full character visible and provide distinct framing. These checks do not establish original-game camera parity.
- Vehicle side/rear camera screenshots were visually inspected at 1440×900. The vehicle remains visible, the view changes with the requested direction and the radar follows it. Three follow distances are available. First-person/bumper and cinematic views, the complete original mode sequence, and reference-calibrated framing/recentering remain incomplete.
- Vehicle-impact capture was visually inspected: the player raises their arms and the health bar decreases beside the stopped traffic car. An entry prompt seen during interruption was removed and the focused browser scenario rechecked. The pose and damage response remain provisional; no original-game collision comparison has been performed.
- Texture-library captures were inspected at 1440×900 and 390×844. Diagnostic colors and mip choices are legible; the narrow layout has no horizontal overflow. The fixtures contain original test pixels, not retail assets.
- Model-preview day/night captures were inspected. The independent diagnostic pyramid is visible with changing source vertex colors; a camera-framing bug caused by uncalculated world matrices was fixed and covered by visible-triangle and transformed-bounds checks. These are original diagnostic assets, not retail game models.
- The textured diagnostic pyramid capture was inspected: source UVs place the calibration pattern on its faces. This proves the tested binding path, not retail texture orientation or final game material fidelity.
- Captures and machine-readable production evidence are generated under `artifacts/` by the test commands; these generated files are intentionally not committed.

The checks establish the listed mechanics only. They do not validate original-game parity, a complete campaign, all browser/device combinations, or production readiness.

- Direct archive-preview capture was inspected: searchable model/dictionary controls and the independently exported textured diagnostic mesh render clearly. This is format-path evidence; no original game asset or original-game pixel comparison has been verified.

- Local IDE association loading adds three unit cases and one browser scenario covering differently named dictionaries, absent dictionaries, conflicting definitions, removal and cancellation. Only model/dictionary associations are applied; other IDE fields remain work. Texture-parent chains now resolve within the selected archive.

- Texture-parent inheritance adds exact-pixel unit coverage for child overrides and ancestor fallback, graph conflict/cycle/depth checks, and a browser case for inherited binding and missing-parent recovery. Same-archive lookup is supported; cross-archive dependency loading is not.

- IPL reader and model-assembly adapter: text/binary instances preserve source transforms, interior/flags and unresolved external LOD indices. Five unit cases verify parsing, malformed data, inverse quaternion orientation, basis conversion and composition with nested DFF frames. Separate IPL selection now previews matching instances of the selected model by interior; multi-model scene inspection is now available; complete district fidelity remains unfinished. See [placement evidence and limits](research/PLACEMENT_FORMATS.md).

- Placement preview adds two unit cases for matching and shared-resource ownership, and two browser scenarios for repeated text placements, interior filtering, no-match recovery, binary IDE resolution and clearing. The rendered diagnostic pair was inspected; geometry counts remain stable across repeated instances.

- Multi-model archive assembly resolves IPL names/IDE IDs, groups repeated models and reports omitted placements or missing textures. Two unit cases and one browser scenario cover grouping, dictionary binding, ambiguous IDs, omission reports, world framing, repeated assembly and GPU cleanup. Production smoke now assembles a diagnostic scene and verifies visible framebuffer pixels. LOD, collision, streaming and gameplay installation remain incomplete.

- Scene texture pooling now shares cached source dictionaries, decoded rasters and GPU textures across model types. The diagnostic scene verifies one GPU texture for two model types/three placements and stable counts after reassembly. Two unit cases cover source identity, inherited reuse, equal-name isolation and last-owner disposal; scene accounting counts shared pixel buffers once. Source-byte caching is bounded with eviction.

- Archived IPL selection now drives model placements or whole-archive scene assembly without external extraction. Tests verify padded text entries, source labels, file overrides, search, malformed-entry recovery and clearing. A separate IPL file takes precedence. Simultaneous base/streamed sources and cross-file LOD ownership remain unfinished.

- COL2/COL3 reader preserves sphere/box surfaces, compressed mesh geometry, face groups and separate shadow triangles. Four unit cases use independently exported original diagnostics and malformed data. Collision overlays now match local model names; gameplay installation remains unfinished; a fixed Rapier adapter now has ray/contact coverage. See [collision format evidence](research/COLLISION_FORMATS.md).

- Native collision physics adapter creates source spheres, boxes and triangle meshes under an IPL transform, preserving surface metadata and excluding shadow geometry. Three Rapier cases verify separate shape ray hits, rotated normals, falling-body support and complete removal. Original surface response and gameplay scene installation remain unfinished.

- Local COL collections now add physical-shape overlays to individual models and assembled scenes. Tests verify placement, shadow exclusion, shared overlay geometry, toggling, cleanup and preserving scene mode on removal. The inspected diagnostic capture preserves the separate source offsets of its DFF and COL. No retail alignment comparison has been performed.

- Archived collision collections can now be searched and selected for model/scene overlays, with explicit source metadata and separate-file precedence. Unit/browser checks cover malformed entries, overrides, scene-preserving removal and clearing. Multiple collection loading and automatic collision discovery remain unfinished.

- Runtime scene installer now owns imported visual groups and fixed COL colliders together, with rollback on partial failure, model/placement/surface metadata, shared resources and cleanup that preserves existing objects. Three tests exercise queries, ownership, rollback, explicit missing-collision handling and limits. Model construction is separated from preview camera controls. Gameplay activation is not yet exposed.


## Imported scene gameplay integration

**Walk scene** now installs fully resolved local IMG/IPL/COL assemblies into a temporary game window with the existing keyboard character controller. It omits authored neighborhood geometry and population, chooses a clear supported spawn, and reuses it for recovery. Imported mode hides unrelated Grove Street labels/radar and save actions. Files pass locally between same-origin windows; they are not uploaded or persisted as an imported-world save.

The new matching DFF/COL floor is independently exported original diagnostic geometry. A deterministic movement check exposed intermittent capsule sweep stalls with rotated static triangle meshes. Baking static orientation into local vertices fixed this without relaxing movement assertions or changing character speed. Metadata and equivalent sphere/box placement are retained.

This is a gameplay connection for the static importer, not an original district or animation fidelity milestone. Source-specific materials, skinned models/IFP, streaming, LOD rules and reference capture comparisons remain priorities under the [fidelity blueprint](FIDELITY_BLUEPRINT.md).

Verification: 100 unit tests and all 34 browser tests passed. The static production smoke also launches the imported scene, confirms production hooks are absent, exercises keyboard input and pause, and verifies imported save/radar controls remain hidden. Screenshots were inspected at 1440×900 on Chrome 152 / Apple M5 Pro. Earlier development runs saw a texture-page navigation reset; the isolated case and complete rerun passed. These checks establish integration behavior, not retail compatibility or sustained performance.


## Native animation reader and sampler

Added bounded ANP2/ANP3 IFP parsing, standalone/IMG loading and a model-worker animation action. It preserves absolute timestamps, source rotations, optional translation and bone/name bindings. Source keyframe definitions establish compressed divisors of 4096 for quaternion, 60 for seconds and 1024 for translation; the latter corrects a conflicting external reader description. The sampler provides shortest-arc normalized quaternion interpolation, linear translation and explicit loop/clamp behavior without modifying source keys.

The authored Python-packed fixtures cover all four keyframe encodings across ANP2/ANP3. Verification passed: 108 unit tests, 14 existing model-browser checks, the new browser worker decoding/error test, build and production smoke. This turn did not rerun the unrelated gameplay browser suite. There is no player animation replacement yet: skin/HAnim parsing, bone binding, source pose conversion and original animation validation remain required. See [animation formats and sources](research/ANIMATION_FORMATS.md).


## Native skin and HAnim bind-pose rendering

DFF parsing now preserves supported non-native skin weights, inverse bind matrices and HAnim bone palettes. Skin rendering maps palette indices through bone IDs rather than frame order, normalizes copied GPU weight attributes, and preserves source values. Repeated placed models share geometry/materials while owning independent skeleton poses and GPU textures. The local preview identifies supported skinned geometry and displays its bind pose.

An independently DragonFF-exported original two-bone fixture verifies inverse bind alignment and weighted deformation, with palette order intentionally different from frame order. Unit tests also verify independent placed poses, skeleton texture disposal and malformed payload handling. Browser checks load the rig through the real picker/worker, verify visible pixels and release of its skeleton texture on model replacement. The canvas screenshot was inspected directly.

Verification: 114 unit tests, 16 model/animation browser checks, build and production smoke passed. The new skin browser case was repeated after improving its screenshot framing. Original IFP playback on the rig, action blending and gameplay character replacement remain unfinished; this does not establish retail character parity. See [skin format evidence](research/SKIN_FORMATS.md).


## Native animation binding

Added a validated clip-to-instance binding API. It resolves explicit bone IDs or name-bound tracks, applies native source-space poses, preserves rest translation for rotation-only tracks and restores exact rest matrices. Invalid bindings fail before modifying the rig. Animated instances avoid stale culling bounds without requiring full CPU vertex deformation every frame; exact bounds are available on demand.

Verification: 118 unit tests passed, including four clip-binding cases on the diagnostic skin, plus the affected imported-walking and skinned-preview browser checks. The new API is not yet wired to playback UI or the protagonist. Those integrations, root-motion policy and original animation blending remain next work; no retail motion fidelity is claimed.

## Native animation preview playback

The model workshop now exposes local IFP clip selection, play/pause, time scrubbing and bind-pose restoration for one unplaced model. Playback uses the validated skeleton binding and pauses while the page is hidden. Model replacement cancels animation reads and playback; unsupported data reports an error and can be replaced without reloading the page. The animation clock is not a live announcement on every frame.

Verification: 118 unit tests, all 17 model/animation browser checks and the updated static production smoke passed. The UI test compares changed pose pixels and exact bind-pose restoration, verifies frozen paused time, exercises malformed-file recovery and replaces a model during playback. The rendered animation fixture was inspected. Production checks additionally bind, scrub and restore the diagnostic clip using the shipped worker. The protagonist still uses authored motion; original gameplay blending, root-motion extraction and retail character validation remain unfinished.

## Root motion and in-place clip inspection

Added explicit translation extraction from a selected animation track, preserving motion across loop boundaries, reverse playback and multiple cycles. The binder can hold native horizontal axes in place while retaining vertical pose motion, with first-frame or rest-pose anchoring. The preview exposes source motion and per-track in-place choices; clip/model replacement resets that choice.

Verification: 124 unit tests, all 18 model/animation browser checks, build and production smoke passed. The browser compares source/in-place posed bounds, confirming removal of the authored horizontal displacement with vertical position preserved, and verifies switching back and clearing. Production smoke also selects the in-place mode. Original root-motion semantics and collision-constrained player integration remain unfinished; extracted deltas are currently in the selected track's parent coordinate space.

## Animation displacement through player collision

Added a track-parent-to-world displacement adapter and an optional per-step animation-motion input to the foot controller. Clip deltas replace keyboard-derived horizontal displacement, pass through capsule collision, and report requested versus applied movement. Gravity, impact impulses and incapacitation remain controlled by the simulation. Ordinary steps and resets clear animation feedback.

Verification: 129 unit tests, all 38 browser checks, build and static production smoke passed. Five new unit cases cover looped displacement accounting, wall blocking and sliding, coordinate conversion, incapacitation, zero-motion suppression and fallback to ordinary walking. The diagnostic flat-floor path loses roughly 6 percent through capsule contact correction; exact travel preservation and foot sliding remain unresolved. Native protagonist rendering and its clip clock are not connected to this input yet. The browser regressions validate existing gameplay and import workflows; they do not establish native protagonist or retail motion fidelity.

## Ground-contact travel preservation

The combined lateral/downward capsule query was shortening clip displacement by roughly six percent on the diagnostic floor. Resolving lateral travel first, then downward gravity from the intermediate position, reduces the six-meter path error to under two centimeters on mesh, box and heightfield floors. Ascending jumps and purely vertical movement retain a single query. Temporary collider positions restore before body integration, including query failures. Contact tolerances and locomotion speeds remain unchanged.

Verification: 137 unit tests, build and production smoke passed. The full browser run passed 37 checks; the animation worker check lost its page execution context to navigation. All three animation checks then passed twice in a focused rerun (six checks). New collision tests also verify step traversal/descent, ramp ascent/descent, ceiling contact, transform restoration and error cleanup. This is an authored collision-policy improvement; original character playback, arbitrary compound-contact fidelity and streamed-city performance are still unfinished. See the animation research notes for the query tradeoff and measured scope.

## Playable native character locomotion

The model workshop now opens its local skinned rig, textures and explicitly selected in-place clip in a temporary game window. Native clip time advances on simulation ticks, root displacement passes through player collision, and the rig follows interpolated actor positions. Pausing freezes the clip. Idle holds its first pose; unsupported actions use the existing character. Animated extraction ancestors are rejected before installation, and native resources are independently owned and disposed.

Verification: 142 unit tests, all 39 browser checks, build and the expanded production smoke passed. Five new unit cases cover clock ownership, loop crossings, direction, fallback, interpolation, disposal and invalid parents. The browser exercises the real workshop/popup/keyboard path, pause/resume and crouch fallback. A front-view capture of the single-sided diagnostic rig was inspected. Production smoke also loads and walks the rig without development hooks or external runtime requests.

This connects the native pipeline to gameplay, but remains a one-clip test. Original idle/walk/run associations, blending, native action coverage, root rotation, collision-aware clip pacing, original character materials and retail reference validation are still unfinished. Source scale and orientation are preserved, and local character assets are not part of saves.

## Native idle/walk/run assignments

The workshop now assigns clips explicitly to idle, walk and run for the current model. Native runtime selection follows movement and Shift, respects the existing stamina exhaustion/recovery latch, and uses each clip's own root displacement. Missing run falls back to walking without draining sprint stamina. Assigned idle plays while stationary without moving the capsule. Walk/run transitions preserve normalized phase; role changes restore bones absent from the next binding. Model replacement clears assignments.

Verification: 145 unit tests, all 40 browser checks, build and production smoke passed. The new original role fixture separates idle, 2 m/s walking and 4 m/s running with different cycle durations. Added tests verify role speeds, phase transitions, exhaustion thresholds, missing-run behavior and unanimated-bone restoration. Browser checks assign roles using the workshop, exercise W/Shift selection and speed, pause idle and clear the model. Production smoke opens the explicit role set and exercises sprint input.

This remains an authored association policy. Clip changes have no crossfade yet, arbitrary source clips may have different foot-contact phases, and the original game's association tables, native action coverage and retail visual comparisons remain unfinished.

## Native role pose transitions

Idle/walk/run changes now blend the current composite local pose into the advancing destination over an authored 180 ms interval. A new interruption captures the pose at simulation time rather than the last rendered interpolation. The transition clock pauses with simulation, retains exact matrices at its starting endpoint and restores unanimated targets before each sample to prevent accumulated deformation. Root displacement still switches to the destination clip directly.

Verification: 148 unit tests, build and production smoke passed. The full browser run passed 39 checks; the first animation-worker check lost its execution context during page navigation. All three animation checks then passed twice in a focused rerun. The recurring first-page navigation remains an unresolved development-test startup issue. New pose tests cover interpolation, exact endpoints, interrupted capture and rest reset; native tests cover interruption continuity and render-cadence independence. Browser pause checks now include transition progress.

This is a captured-pose blend, not the original game's association blending. The outgoing pose does not continue advancing during the transition. Original durations, velocity continuity, blended root displacement and foot-contact alignment remain unfinished.

## Browser startup isolation

Investigated the recurring first-page execution-context loss. Installed Vite 8.3.0 buffers a full-reload message when no WebSocket clients are connected and delivers it to the next client. A controlled reproduction on a separate server produced one navigation and a completed pending page evaluation with no buffered message; queuing a reload before opening the page produced two navigations and the same execution-context-destroyed error seen in the worker check. This establishes a reproducible cause matching the prior failures, rather than a worker-decoding defect.

Playwright now owns a fresh server on port 5189 for each invocation, refuses to reuse a listening process, and closes its process group afterward. The server has its own dependency cache through Playwright's server environment flag. Normal development and fixed-view diagnostic servers can continue independently. See [Playwright's web-server lifecycle documentation](https://playwright.dev/docs/test-webserver) for the reuse and shutdown behavior. Source edits during a running suite can still trigger legitimate HMR and should be avoided.

Verification: all 40 browser checks passed from a fresh server with a separate cold dependency cache. A second invocation started another fresh server and passed all three animation checks. Port 5189 had no listener after either run. Build and production smoke passed. No gameplay code changed, so the previously passing 148-unit-test suite was not rerun for this configuration-only fix. The first-page queued-reload mechanism is now excluded from ordinary browser test startup; this does not claim that every possible navigation failure has been eliminated.

## Native movement velocity transitions

Native idle/walk/run changes now blend requested horizontal velocity over the same authored 180 ms interval as pose transitions. The weight is integrated over each tick, preserving constant-velocity travel across tick subdivisions and transition completion. Stopping decelerates toward zero; interruptions capture the current blended velocity; unsupported native states clear residual motion. Capsule collision remains authoritative.

Verification: 152 unit tests, all 40 browser checks, build and production smoke passed. New unit cases verify integrated acceleration, subdivision, stopping, interruption, reset and invalid input. An additional native/physics case accelerates into a wall and stops without crossing it. Existing role tests now include transition distance while retaining phase assertions. The isolated browser server also completed another full run without the earlier first-page reload failure.

This is an authored velocity blend. It captures requested rather than collision-applied velocity, approximates within-tick variation by average clip displacement, and does not implement original stopping clips, association weights or foot locking. Those fidelity gaps remain active work.

## Native character scene lighting

Supported native character materials now honor the geometry LIGHT flag, add source prelighting to ambient/diffuse contributions, apply source surface coefficients, and clamp lighting before material modulation. Inspection previews retain their unlit rendering path. Native rigs also participate in the runtime's existing shadows. The operation order is backed by pinned librw shader/geometry sources documented in the skin research notes.

Verification: 153 unit tests, all 41 browser checks, build and production smoke passed. The new GPU fixture checks pixel values for ambient and directional light, additive prelighting, source coefficients, clamping/modulation order, unlit behavior and a deformed normal. Its first run exposed only a missing fixture favicon; that request was fixed before the full passing run. The production character capture was inspected and shows lighting and a shadow on the original diagnostic rig.

Original lighting and shadow fidelity remain unproven: this uses per-fragment Three lighting, authored scene lights/attenuation/timecycle and current color-space handling. Original per-character light selection, prelight night policy, specular behavior and retail capture comparisons remain unfinished. The fixture is not a retail character.

## Native day/night prelight integration

The renderer now forwards its timecycle night factor to the native character's owned color buffers. Day/night source palettes interpolate without mutating source bytes. Repeated factors and geometries without night colors avoid redundant attribute uploads; invalid factors fail before mutation and finite factors clamp to the supported range.

Verification: 155 unit tests, all 41 browser checks, build and rebuilt production smoke passed. Added unit coverage verifies interpolation, caching, unchanged source arrays and native-character forwarding. The GPU lighting fixture verifies the palette midpoint before lighting. An initial test-only BufferAttribute type annotation error was corrected before the verified build. Original per-character light selection and night-transition timing remain unverified; the integration uses the authored runtime timecycle.

## Native crouched idle and movement

Added paired crouched idle/walk assignments to the workshop and native character controller. Complete pairs retain the native rig while crouched and use its source pace; Shift cannot activate run in that posture. Crouch state, capsule dimensions and standing clearance remain simulation-owned. Partial pairs are rejected before installation, and missing pairs retain the prior authored fallback. Existing pose/movement transitions apply when changing posture.

Verification: 157 unit tests, all 41 browser checks, build and production smoke passed. New unit cases verify pose height, pace, visibility, sprint suppression, standing restoration and incomplete assignment rejection. Browser coverage now loads a separate crouch package while retaining standing roles, checks real C/W/Shift input and stamina, restores standing and captures the crouched diagnostic rig. That capture was inspected; production smoke also exercises native crouching. Original crouch animations, biomechanics and transition timing remain unverified.


## Native airborne animation

Added an optional workshop airborne assignment. The native character stays visible through jumps and falls, starts the clip at zero, plays once and holds its last pose until landing. The selected translation track stays fixed on XYZ; ordinary simulation controls retain ownership of flight. Ground movement blending resets during flight, and the existing pose transition handles role changes.

Verification: 159 unit tests, all 41 browser checks, build and production smoke passed. New unit cases check takeoff, clamping, root anchoring and the physical jump trajectory. Browser coverage assigns across three packages, jumps, pauses pose and position, and resumes to grounded idle. The production airborne capture was inspected and shows the original diagnostic strip above its ground shadow. No external runtime requests were observed.

This remains one generic airborne clip. Original takeoff/fall/landing tasks, anatomical assets, timing and retail capture comparisons remain unfinished; the passing checks demonstrate integration rather than clone accuracy.


## Native landing and source task review

Added an optional native landing role that plays once after flight before locomotion resumes at phase zero. The selected track is anchored on XYZ; movement, sprint and jump are suppressed during the clip. Initial placement does not trigger landing, and unsupported character states cancel it. The landing role can follow authored airborne fallback without requiring an airborne assignment. Reviewed pinned jump, airborne, landing and compound task sources; the animation research notes distinguish recovered task structure from current authored movement/blend policies and enumerate missing variants and launch timing.

Verification: 161 unit tests, build, production smoke and the final full 41-case browser run passed. Unit coverage checks timing, anchoring, repeat-jump suppression, phase restart, initial placement and death interruption. Browser coverage exercises assignment, actual landing and return to idle; the production landing capture was inspected and shows the original diagnostic strip at ground level. This is integration evidence, not anatomical or retail animation fidelity.

Earlier browser runs exposed failures that are retained here for accuracy. Crouch restoration failed once and passed subsequent runs without a code change; its cause was not established. A lighting probe was called before its top-level asynchronous fixture load installed it; that test now waits for probe availability. Car exit failed intermittently on the old timed route, with a captured car beside the driveway fence. The route now reverses more than eight meters into open space and waits for measured speed below 0.5 before exiting with the handbrake held. The focused car check and final full suite passed. Runtime door clearance was not relaxed, and these repairs do not prove the absence of every timing-dependent test failure.


## Animation-gated native takeoff

Added an optional launch assignment that plays to completion before emitting one physical jump request. The clip anchors selected root translation on XYZ, holds ground movement during launch, and hands off to the airborne role or existing fallback. Its completion gate runs on fixed simulation ticks. Death, crouching, loss of ground and other unsupported states cancel the pending launch rather than firing it after recovery. The pinned jump-task research now distinguishes this implemented ordering from missing original launch-side, stat, heading, climb and velocity policies.

Verification: 165 unit tests, build, production smoke and all 41 browser checks passed. Four new unit cases verify delayed single release, render-independent timing and cancellation. Browser coverage pauses during launch, observes grounded state, resumes into flight and completes landing. The first full browser run passed 40 cases but missed the brief airborne phase with the default widening polling interval after the two-second launch fixture; sampling that transient action every 50 ms fixed the observation and the full rerun passed. Production smoke captures launch, flight and landing; the launch capture was inspected. No external runtime requests were observed. Fixtures remain original diagnostic geometry and clips, so these results do not establish retail appearance or animation fidelity.


## Phase-selected launch variant

Added optional right-foot launch assignment, with a required base launch and validation before native model allocation. Walk/run phase selects the alternate using the reference offset and strict wrap boundary; stationary launches use the base clip. Selection stays fixed through launch completion and shares the existing root anchoring, cancellation and delayed physical jump gate. Original association-weight priority is still absent: the browser selects from its current locomotion role rather than the original weighted sprint/run/walk associations.

Verification: 174 unit tests, build, production smoke and the final 41-case browser suite passed. Parameterized tests cover phase thresholds, exact wrap behavior, accumulated cycles, retained selection and delayed release; another case checks stationary selection and invalid assignment. Browser coverage verifies incomplete assignment, stationary base launch and moving alternate launch. Production smoke installs both roles and exercises stationary takeoff without external runtime requests.

The initial full browser run passed the new scenario but again failed the older crouch-fallback check. That check now waits for explicit grounded/crouched state before its second C press, matching the controller's input precondition rather than relying on visibility alone. The full rerun passed. The earlier failure did not capture enough state to prove its exact cause. Diagnostic clips still do not establish anatomical foot-contact or retail animation fidelity.


## World LOD identity and visibility metadata

Inspected the raw imported-scene path and confirmed that LOD switching is absent and source indices were discarded during model grouping. Scene parts now preserve original indices, placement format and IDE definition metadata. The workshop reports local, external and unavailable LOD targets without interpreting streamed indices as local references. The IDE reader retains supported static/timed draw distances, flags and hours from modern and legacy layouts. These fields survive scene transfer; rendering is still raw pending related-IPL loading and verified LOD selection.

Verification: 177 unit tests, all 41 browser checks, build and production smoke passed. Added cases cover modern/legacy metadata, invalid values, identity after interior filtering/grouping, unavailable targets and binary external-array semantics. Browser checks expose source indices, distance/flags and a local target in expanded metadata. The scene capture was inspected; existing geometry and shared-texture counts still pass. Source review also identified a suspicious control-flow condition in the pinned reverse-engineered renderer, documented as a verification requirement rather than copied into runtime behavior. No claim of LOD rendering or original world fidelity is made by this metadata change.


## Related static and streamed IPL assembly

Added an explicit text static-source picker for binary primary IPLs. Both sources assemble together, retain namespaced placement identities through grouping/game transfer, and resolve streamed LOD indices against the supplied static array. Identical numeric indices across files no longer imply identity. Incompatible source formats and known cyclic links fail before model decoding. Removing the static source reassembles the primary alone and cancels/restarts a pending scene load.

Verification: 179 unit tests and a full 42-case browser run passed. After the final pending-removal safeguard, build and all 16 model-browser checks passed again. Production smoke also passed and explicitly resolved a static/streamed link. The combined preview capture was inspected. Added checks cover shared-model grouping with distinct namespaces, source-format rejection, cycles, picker/removal behavior and geometry release. Pending removal itself was reviewed through the shared cancellation path rather than a forced-race browser reproduction.

One explicit pair is supported; multiple streamed sources, automatic base discovery, original LOD collision ownership and actual LOD/distance/fade selection remain unfinished. The scene remains raw visually, with resolved relationships now available for the next renderer work.


## Imported timed-object visibility

Playable imported `tobj` groups now follow source on/off hours using the pinned clock predicate: inclusive start, exclusive end, overnight wrapping and inactive equal-hour ranges. Initial visibility is set at installation and cached per whole hour. Invalid supplied schedules fail before allocation; invalid clock inputs fail before mutation. Preview inspection remains unfiltered. Visibility changes retain GPU resources and collision; original counterpart availability, streaming and collision ownership remain separate fidelity gaps.

Verification: 181 unit tests, all 42 browser checks, build and production smoke passed. The browser imported-floor test uses a 17–18 schedule, confirms walking and pause behavior, waits for the actual 18:00 transition, then verifies that imported visuals are hidden while geometry count and ground support remain stable. Its timeout accommodates normal clock advance instead of changing simulation state through a test hook. Unit cases cover exact boundaries, overnight/equal/full-day ranges, normalization, malformed schedules and disposal. Production smoke installs a timed floor during its active interval. These are diagnostic integration checks rather than original-asset or retail pixel comparisons.


## Timed-model counterpart fallback

Scene assembly now links registered `_dy`/`_nt` timed definitions using source marker, lookup and registration-order semantics, retaining counterpart names even when no counterpart placement is loaded. Runtime timed visibility keeps an out-of-range model available when its registered counterpart is absent from the installed scene. With a loaded counterpart, or without a registered counterpart, the ordinary hour gate applies. Workshop metadata exposes counterpart availability.

Verification: 185 unit tests, all 42 browser checks, build and production smoke passed. New cases verify pairing order, non-timed/unpaired records, marker case and truncation behavior, an unplaced registered counterpart and missing/loaded runtime fallback. The browser inspects counterpart availability before and after removing a static source; its existing real-clock test confirms that an unpaired timed mesh still hides at 18:00. Production smoke is general regression coverage and does not exercise a missing-counterpart runtime scenario. Source references and the limits of installed-scene availability are documented in the placement research notes.

This does not add global streaming, proactively load replacement assets, synthesize counterpart placements, or reproduce original collision ownership. Original-asset and retail pixel fidelity remain unverified.


## Non-colliding LOD replacement entities

Resolved LOD targets now retain visuals and metadata without adding playable colliders. A shared per-placement planner drives workshop eligibility, runtime collider accounting/installation and spawn search. Detailed children remain collidable, including when their replacement lacks COL data. Duplicate reference identities and known cycles fail before allocation. Source inspection overlays remain unfiltered.

Verification: 187 unit tests, all 42 browser checks, build and production smoke passed. New cases cover COL-free and COL-supplying replacements, multiple children, per-placement behavior within one model, missing detailed collision and invalid graphs. Browser and production imported-scene workflows now load a distant COL-free LOD target, enter through the workshop and walk on detailed collision. The browser also preserves its actual 18:00 timed-visibility check; one raw LOD visual remains after the timed detail hides. Source evidence comes from the pinned big-building setup and its collision-disable operation.

This implements resolved replacement collision participation, not full LOD ownership. Shared bounds, additional draw-distance-based big-building rules, visual LOD selection/fades and retail world fidelity remain unfinished.


## Inherited LOD visibility bounds

Scene assembly now retains model-space COL visibility bounds separately from physics. Single-child replacements can reference their detailed child's loaded bounds and report the donor; aggregate targets keep their own bounds. Conflicting model-level donors and missing child collision are reported instead of guessed. The shared placement graph supplies identity, while the existing physics exclusion remains unchanged.

Verification: 190 unit tests, all 42 browser checks, build and production smoke passed. Three new cases verify reference sharing without colliders, aggregate/conflicting donors and unavailable data. The initial build caught a missing required field in a test fixture; that annotation was corrected before the passing build and browser run. Browser and production scene flows inspect inherited floor-bound provenance before entering the game. No external runtime requests were observed.

This preserves direct loaded-child bounds for renderer use; it does not yet perform visual LOD switching or reproduce multi-level/order-dependent collision-pointer propagation. Raw imported rendering and original pixel fidelity remain unfinished.

## Loaded-scene distance and LOD rendering

Playable imported scenes now apply nominal IDE draw distance, parent-origin distance measurement and the far-clip/radius limit after the current camera update. A child-first placement graph suppresses loaded replacements when descendants supply detail and restores them when eligible detail disappears. Timed model gates remain effective and collision ownership does not change. Preview inspection remains unfiltered.

Verification: 193 unit tests across 38 files, all 42 browser checks, build and production smoke passed. Unit cases cover cutoff boundaries, nested/shared LODs, time composition, converted parent origins and inherited bounds. Real browser camera controls switch a co-located floor pair between detail and LOD, then the actual 18:00 clock boundary restores the replacement while ground support persists. The first browser run exposed an obsolete GPU-count assertion: first rendering the hidden replacement registers one additional geometry. The revised test warms both choices through camera controls and verifies stable residency afterward. The production report has no page errors or external runtime requests, and no development hook. The imported walking capture was visually inspected.

This stage uses hard nominal cutoffs with multiplier one. Original fade bands, distance adjustments, alpha/streaming residency, low-LOD scaling and occlusion remain unfinished. Three.js mesh frustum culling does not yet feed the LOD coverage decision; heterogeneous aggregate children and the suspicious reference loop require stronger validation. Original assets and retail pixel fidelity remain unverified.

## Frustum-aware LOD coverage

Imported placement eligibility now includes a world-space sphere-frustum test before contributing LOD coverage. The retained COL center follows the receiving placement's rotation and axis conversion. Missing COL bounds use a static geometry sphere, including its radius in the far-clip limit. This prevents off-screen details from suppressing an eligible replacement and avoids premature far-plane disappearance for COL-free geometry. Camera world/projection changes are read in the same pre-render update.

Verification: 198 unit tests across 38 files, all 42 browser checks, build and production smoke passed. New cases cover disjoint detail/replacement visibility, camera turns, projection changes, inherited/rotated centers, malformed spheres, geometry fallback, parented camera transforms and a far-plane intersection. An initial complete browser pass preceded the added fallback far-plane repair; the final suite passed again with that repair. Production reported no page errors, no external runtime requests and no development hook. Its imported-scene capture was visually inspected.

Source investigation confirms the entity sphere and renderer eligibility order, but the pinned camera's low-level sphere test still delegates to the original executable. This is a Three.js frustum implementation using source bounds, not verified original clipping/occlusion parity. Mirrors, moving-bound refresh, aggregate LOD details and source fades remain unfinished. The research notes now retain the pinned fade constants and alpha formula for subsequent implementation.

## Distance fading and placement-owned materials

Imported detail now fades across the source-derived distance band and stops suppressing its replacement while fading. The implementation uses loaded model alpha 255, the 20-unit band, and expanded fade widths for unparented long-range objects. Per-placement material copies are created lazily and reused. They cap source opacity, preserve shared textures and existing depth policy, remove the fade alpha-test threshold, and apply retained source RGB modulation. Full detail restores original materials; disposal releases only the owned copies. Timed visibility and collision remain independent.

Verification: 201 unit tests across 39 files, all 43 browser checks, build and production smoke passed. The new real WebGL pixel probe verifies alpha capping, sibling isolation, restoration and RGB modulation. Unit cases verify distance-band boundaries and expanded widths, material-array reuse, callback retention and idempotent cleanup. Browser camera controls now produce detail plus LOD during the fade, then detail alone when moving closer; the actual 18:00 transition and warmed geometry/collision checks still pass. Initial unit failures identified obsolete hard-cut expectations. Inspection also corrected geometry fallback matrix refresh so manually assigned placement transforms are reflected in its sphere. Production reported no page errors, external runtime requests or development hook.

The source formula and material-alpha behavior are implemented for the loaded-scene path. Streaming/model-alpha evolution, distance multipliers and corrections, complete big-building/aggregate rules, original draw sorting, flags and occlusion remain unfinished. Original-asset visual parity is still unverified.

## IDE flags during distance fading

Imported placement fades now honor the source bits for additive blending, disabled depth writes and disabled backface culling. Two-sided transparent drawing uses one pass. The flags reach the placement-owned material copies without modifying shared originals; leaving the fade restores the original policy. Ordinary non-fading flags and draw-last ordering remain separate unfinished work.

Verification: 202 unit tests, all 43 browser checks, build and production smoke passed. GPU pixel checks distinguish additive from normal blending over a gray background, verify backface visibility and test depth-write suppression against a later drawn surface. Unit coverage checks the bit mappings, restoration and unrelated flags. Production reported no page errors or external runtime requests and no development hook. Source mappings and the inspected render paths are linked in the placement research notes. Retail visual fidelity remains unverified.

## Two-sided visibility across fade transitions

Imported placements with the source no-backface-culling flag now retain two-sided rendering at full visibility. Separate normal and fade overrides preserve the appropriate alpha, blending and depth policies while sharing source textures. Returning from a fade reuses the normal override; disposal restores original references and releases both owned material sets.

Verification: 203 unit tests, all 43 browser checks, build and production smoke passed. Added ownership checks cover normal/fade material reuse, arrays, siblings and disposal. The GPU probe verifies a back face before, during and after fading. Production reported no page errors, no external runtime requests and no development hook. Source evidence comes from entity culling-property assignment and the normal non-road renderer path. Draw-last ordering, other non-fading flags, road-specific behavior and retail pixel parity remain unfinished.

## Imported draw-last policy and ordering

The draw-last flag now creates a normal queued-material override with the inspected exterior/interior alpha threshold and no-depth-write exception. Fading and draw-last placements use negative camera distance for farthest-first ordering among their queued meshes. Ordinary visibility and disposal restore the captured render order. Normal and fade overrides retain separate blending policies.

Verification: 204 unit tests, all 43 browser checks, build and production smoke passed. GPU tests distinguish exterior/interior alpha behavior and reverse overlapping red/green composition by changing supplied placement distances. Unit checks cover queue material settings, transition/restoration, depth exceptions and distance validation. Production reported no page errors, no external runtime requests and no development hook. Pinned ordered-list insertion and traversal establish the source ordering direction. Specialized queues, equal-distance ties, full renderer-family ordering, exact threshold edges and retail comparison remain unfinished.

## Atomic pipeline identity for lighting compatibility

Lighting source inspection revealed that custom building pipelines bypass ordinary entity lighting setup, while the importer discarded atomic pipeline identifiers. The importer now preserves Pipeline Set uint32 values, validates malformed/duplicate records, carries identifiers onto atomic mesh metadata and reports unsupported custom rendering explicitly. Imported-world shading remains unchanged; indiscriminately applying the native character material would ignore the source pipeline distinction.

Verification: 206 unit tests, all 44 browser checks, build and production smoke passed. Diagnostic tests preserve the identifier through decoding/object creation and reject invalid payloads. The browser verifies the warning through an actual worker import and clears it by replacing the model. Production reported no page errors or external runtime requests and no development hook. DragonFF's pinned reader/writer establishes the format; the inspected custom building setup/render callbacks still delegate to the original executable. Pipeline-aware shading and retail visual fidelity remain unfinished.

## Clock-driven imported prelighting

Imported day/night colors now follow the transcribed native schedule: dawn from 06:00–07:00 and evening from 20:00–21:00. Scene time updates the existing palette blend before its whole-hour visibility cache. The main loop no longer supplies the previous frame's authored night factor. Fractional minutes are preserved after checking the source clock getter, which includes seconds.

Verification: 208 unit tests, all 44 browser checks, build and production smoke passed on the final fractional-minute version. Tests cover boundaries, overnight wrapping, fractional transitions, invalid inputs, within-hour palette changes, unchanged-time caching and source-array preservation. An earlier verification pass used a whole-minute assumption; the clock header contradicted it, so the implementation and tests were corrected and the full suite rerun. Production reported no page errors, external runtime requests or development hook.

The schedule transcription still lives beside a native delegated call and has not been verified against retail captures. Source update staggering, PS2 wet-road alpha, pipeline-aware shaders and original visual parity remain unfinished. Pinned SkyGFX building IDs, parameter setup and PS2-style vertex shader references are now recorded for the next material work.

## Explicit building base shader

Playable imports now select a PS2-style base shader for the two explicit building pipeline identifiers retained by the DFF reader. Pinned SkyGFX shader and parameter setup inform day/night RGB interpolation, separate wet-road alpha, material modulation followed by ambient addition, and textured color scaling. Single-color buildings ignore extra night colors, including their transparency policy. Atomic material variants share geometry and textures; placement fades retain shader callbacks and update material uniforms.

Verification: 210 unit tests, all 45 browser checks, build and production smoke passed. GPU pixel checks exercise both pipelines, time interpolation, wet/dry alpha, material and surface coefficients, textured ambient scaling, and fade opacity. The browser and production imported-scene paths now use an original building-tagged fixture. Production reported no page errors, no external runtime requests and no development hook. Its imported-scene screenshot was inspected and shows the fixture floor, player and HUD.

This is partial building rendering, not established retail pixel parity. Ambient values still come from the authored timecycle and wetness stays dry. Environment/detail passes, UV animation, dual-pass rendering, hardware vertex-color clamping, original weather/ambient values and matched retail captures remain unfinished. Model inspection deliberately retains fallback shading and reports the distinction.

## Material-scoped building transparency

Building vertex transparency now follows each material's contiguous vertex span instead of scanning the entire geometry for every material. Opaque sections retain depth writes when a separate section uses vertex alpha. Prefix counts support overlapping span queries without repeated palette scans; source arrays remain unchanged and temporary index buckets are not retained. Single-color pipelines still ignore extra night alpha, and texture/material alpha and placement overrides remain independent.

Verification: 213 unit tests across 41 files, all 45 browser checks, build and production smoke passed. The GPU probe verifies that a later-drawn red surface remains occluded by the opaque green section of a model with a separate translucent section. Unit coverage includes disjoint spans, empty groups, missing palettes and unindexed vertices within a native-style span. Production reported no page errors, no external runtime requests and no development hook.

Pinned SkyGFX instancing establishes the per-mesh range check. The importer still merges triangles by material, so arbitrary native mesh partitioning is not reproduced. Shader build inspection also found `vs_3_0`/`ps_3_0`; the legacy Direct3D color saturation rule does not establish a need to clamp this shader. No speculative clamp was added. Original console arithmetic and retail visual parity remain unverified.

## Preserved native mesh partitions

The DFF reader now retains supported PC Bin Mesh partitions even when ordinary face records are present. Rendering uses their triangle order and separate draw groups, including repeated references to one material. Building material variants and vertex-alpha checks use each native mesh's original vertex span, including degenerate strip connectors. Models without Bin Mesh data retain their prior fallback grouping. Draw-group limits count actual nonempty native groups; malformed/repeated plugin payloads and invalid connector indices are rejected.

Verification: 215 unit tests, build, the final full 45-test browser run and production smoke passed. Diagnostic tests cover repeated material references, ordering, strip parity and spans, malformed plugins and material disposal. The GPU probe verifies independent depth behavior for two native groups sharing one material. Existing independent DragonFF list/strip fixtures retain their orientation checks. Production reported no page errors, external runtime requests or development hook.

The first full browser run passed 44 checks but lost the imported scene during the timed LOD test; its screenshot showed the initial waiting-for-scene menu. An isolated rerun and then a fresh full run both passed without changing runtime logic. The reset cause was not established. A fixture-writer typed-array annotation error was also corrected before the successful build. Platform-native geometry, OpenGL index variants, complete native draw scheduling and retail visual parity remain unfinished.

## Remove redundant building CPU palettes

Explicit GPU building pipelines now avoid allocating and updating the unused float color palette for geometry with no rendered fallback atomic. Immutable day/night byte attributes remain shared with decoded source data. Mixed-pipeline geometry, skinning and inspection previews retain their required CPU interpolation path. This saves 16 CPU bytes per vertex for eligible geometry and removes its repeated interpolation loop; runtime FPS gains have not been benchmarked.

Verification: 216 unit tests across 41 files, build, 20 targeted browser checks (building, lighting, fades and all model-import tests), and production smoke passed. Tests check attribute ownership, upload versions, mixed use and preview behavior; GPU pixel and timed imported-scene checks passed. Production reported no page errors, external runtime requests or development hook. A test-only BufferAttribute type annotation was corrected before the successful build. The full gameplay suite was not rerun for this material-buffer change. Original-game visual parity and the wider production goal remain unfinished.

## Building dual-pass source investigation

Inspected pinned SkyGFX `D3D9RenderDual`, its configuration loader and building call site, plus the native entity alpha/depth policy and the installed Three.js render callback order. The high-alpha draw keeps blending enabled and writes depth at alpha greater than or equal to the threshold; the complementary lower-alpha draw does not write depth. Explicitly disabled depth writes instead produce one draw with alpha testing set to always. The threshold defaults to 128 and dual-pass activation is configurable, not a universal retail guarantee.

Recorded the concrete integration design and required pixel/ownership/order checks in `docs/research/BUILDING_ALPHA.md`. The proposed per-material callback route has not yet been GPU-validated. The current one-pass renderer is unchanged. This turn advances source evidence and implementation decisions; it does not claim new rendering support or retail parity. Documentation checks passed; runtime tests were not rerun for this research-only change.

## Building dual alpha passes

Implemented adjacent complementary alpha draws per native building mesh. The selected policy uses threshold 128/255: high-alpha pixels retain blending and write depth, lower-alpha pixels blend without writing depth. Each actual material owns a reusable high-pass copy; placement fades copy the render callback and preserve independent state and disposal. Explicit no-depth-write flags now persist outside fades and suppress the split. Shared geometry and textures remain shared.

Verification: 219 unit tests, all 45 existing browser checks in the full run, the final new dual-alpha browser check in a targeted run, build and production smoke passed. GPU checks cover thresholds 0/128/255, edge alpha pixels, single blending, later-surface occlusion, disabled policy, no-depth-write mode, fading, additive blending, back faces, restoration and graphics-context recovery. The full run’s only failure was the new fixture’s missing favicon. Subsequent fixture corrections fixed a return-value mistake and deferred the context restore request. Production reported no page errors, external runtime requests or development hook.

The policy is a chosen PS2-style configuration informed by pinned SkyGFX, not a universal retail default. Exact native queue ordering, other pipeline families, original depth/display precision and matched retail pixel verification remain unfinished. The source investigation and implementation limitations are recorded in `docs/research/BUILDING_ALPHA.md`.

## Shared building placement GPU regression

Extended the dual-alpha GPU probe to draw two placements at different transforms with shared geometry/material, fade only one, and then restore its original material reference. Pixel checks verify that opacity and depth state do not cross between placements; draw counts confirm both passes execute for each copy. This runs after context recovery, combining restored GPU resources with shared-material rendering.

The targeted browser probe and build passed. No runtime defect was found or runtime code changed; this turn adds concrete regression coverage for repeated city buildings. Broad runtime and production checks were not repeated for a test-only change. Retail comparison and the full production goal remain unfinished.

## Native timecycle table foundation

Added a raw native timecycle reader retaining 184 weather-major rows, physical source lines, 51/52-field layouts and explicit diagnostics for missing or shifted fields. The reader preserves values without synthesizing directional multipliers or silently repairing malformed rows. A source-based interval helper handles eight uneven sample hours, fractional minutes, midnight wrapping and the 23.999-hour clamp. The pinned file loader's comma/control-space handling is included.

Verification: 223 unit tests across 43 files and build passed, using original synthetic tables. Source references, field order, malformed-row evidence and unresolved byte/float conversions are recorded in `docs/research/TIMECYCLE.md`. No browser or production rerun was needed for this currently unconnected data module. Local picker integration, storage conversion, weather/color-set interpolation and renderer routing remain unfinished; the game still uses its authored timecycle. No retail timecycle compatibility or original lighting parity is claimed.

## Native color-set conversion and weather sampling

Added preparation of raw timecycle rows into named stored color fields, followed by separate time interpolation for old/new weather and a weather interpolation stage. Integer sky/sun/cloud/shadow fields truncate at each stage; float fields retain float32 results. Storage scaling and narrowing precede sampling, raw arrays remain unchanged, and unresolved required rows fail preparation. Directional illumination remains explicitly absent pending stronger source verification.

Verification: 227 unit tests across 44 files and build passed. Tests distinguish staged integer truncation from a collapsed blend, verify storage boundaries and wrapping, and reject invalid controls. Modular narrowing and float32 arithmetic are documented implementation models, not verified retail CPU behavior. This data pipeline is not yet connected to playable lighting, so browser/production tests were not rerun. Local import and renderer integration, spatial weather effects and retail visual comparison remain unfinished.

## Local timecycle lighting in play

Connected local timecycle files to sky endpoints and explicit native-building ambient lighting. The game/pause menu provides file selection, weather entries and an authored-lighting reset. Imports prepare atomically, retain current lighting on failure and ignore stale reads after replacement/reset/disposal. Sampling is cached for an unchanged clock/selection; building ambient updates before hourly visibility caching. Tables stay local and last only for the session.

Verification: 229 unit tests, all 47 browser checks, build and extended production smoke passed. Browser tests assert actual red/blue sky pixels from original synthetic weather entries, errors, reset and resumed gameplay. Scene tests inspect building ambient changes within one hour. Production exercises the real file picker, a sky pixel and reset without the development hook; it reported no page errors or external runtime requests. The menu was visually inspected. A weather-label association and a test type import were corrected during verification.

Sky endpoints use an explicit sRGB mapping and building ambient uses normalized stored values. Fog distances, post-effects, spatial weather effects, object/directional lighting and original platform display behavior remain incomplete. No retail lighting or full-game fidelity claim is made.

## Imported fog distances and far clip

Connected valid sampled fog ranges to linear camera-depth fog and the playable camera far clip. Sky and stars remain visible at shortened clips; clearing restores authored exponential fog and the original camera range. Invalid fog ranges retain authored fog with diagnostics while other supported lighting channels remain usable. The shared Three fog chunk now uses a clamped linear factor for ordinary and native-building materials, retaining its exponential branch.

Verification: 230 unit tests across 45 files, all 48 browser checks, build and production smoke passed. GPU pixels distinguish linear from smoothstep interpolation and verify the exponential fallback. Playable checks cover weather-dependent camera clips, sky visibility and reset. Production reported no page errors, external runtime requests or development hook, and its menu capture was inspected. An initial test assertion was changed to wait for the camera's rendered-frame update.

Application sources establish linear fog and timecycle camera inputs. SkyGFX's inspected Shader Model 3 shaders do not establish equivalent per-pass fog; this discrepancy and the selected browser policy are documented in `docs/research/TIMECYCLE.md`. Spatial modifiers, native pass enablement, original precision and retail comparisons remain unfinished, as does the wider production goal.

## Visible sun path and imported core/corona colors

Replaced the visible sky sun's provisional path with the normalized source vector in the same coordinate conversion as imported placements. Its core and halo now follow separate source registration elevation thresholds and independently sampled timecycle colors. Directional lighting and shadows retain their authored path rather than inheriting an unsupported connection to the visible sun.

Verification: 232 unit tests across 46 files, all 49 browser tests, build and production smoke passed. GPU checks aim at independently calculated positions and verify separate colored contributions, core-only dawn and no midnight contribution with a short far clip. Production had no page errors, external runtime requests or development hook, and its gameplay capture was inspected. The existing procedural shape, fixed angular size and shader blending are provisional. Source-based sprite projection, original texture, size, fades, LOS, flares and indoor eligibility remain necessary; `docs/research/SUN.md` records their design and evidence. Retail parity and the production goal remain unfinished.

## Native corona projection and fade calculations

Traced sprite scaling/clipping and registered-corona fading. Added native-view projection metrics, byte-truncated fade updates and half-range distance attenuation. Tests distinguish split updates from one combined step and verify that obstruction/offscreen fading takes precedence over camera-look brightness overrides. Source review also establishes that the final rotated-sprite routine is unreversed in the pinned source and that native view-matrix conventions must be resolved before using Three camera coordinates.

Verification: 237 unit tests across 47 files and build passed. The new module is not connected to runtime draws, so browser/production tests were not repeated and playable visuals are unchanged. Source references, timestep units, unresolved float precision, camera mapping, quad extents, state ownership and global-light coupling are recorded in `docs/research/SUN.md`. This supplies the calculations for the upcoming textured corona renderer; it does not complete sun fidelity or the wider goal.

## Corona camera-coordinate bridge

Resolved why native sprite inputs differ from ordinary Three camera space: the RenderWare view matrix includes projection scale and half-screen offsets. Added a bridge from homogeneous browser clip coordinates into the existing native sprite metrics, retaining explicit native size-FOV input and depth clipping. Pinned librw evidence and its limits are documented alongside the GTA camera attachment source.

Verification: 239 unit tests across 48 files, build and a new targeted GPU browser check passed. Tests cover camera translation/rotation, landscape/portrait viewports, off-axis projection, independent size-FOV scaling and clipping. GPU reads at calculated coordinates locate six rendered surfaces. The adapter is still a foundation for the upcoming textured corona renderer; playable visuals are unchanged, and full browser/production runs were not repeated. Native FOV setup, sprite extents, texture integration and retail comparisons remain incomplete.

## Persistent sun corona state in play

Connected separate core/corona records and byte fade histories to the playable sky. Registration refreshes world position and color; missing registration retains them until fade-out releases the record. Previous projection visibility controls offscreen fading and recovery. Camera matrices update after far-clip changes and before corona projection. The existing procedural disc and halo now use independent retained directions and intensities.

The duration guard exposed negative frame time after resume when a queued animation-frame timestamp preceded the refreshed performance-clock baseline. Clamped main-loop frame duration at zero as well as the existing upper limit. Verification: 243 unit tests across 49 files, all 50 browser checks, build and production smoke passed. State and GPU tests cover fade history, horizon release, projection delay, camera movement, far clip and measured brightness progression. Production had no page errors, external runtime requests or development hook; its gameplay capture was inspected.

Source-based texture/size/quad rendering, obstruction and clouds, indoor eligibility, immediate camera-look brightness, global light coupling and retail comparisons remain unfinished. The current procedural intensity mapping is explicitly documented in `docs/research/SUN.md`; the wider production goal remains active.

## Sun brightness on camera-look transitions

Connected supported left/right/rear view flags to the source's three-update corona brightness override. Session state tracks mask changes and counter expiry; returning to forward view retriggers it. Previous offscreen state continues to take precedence, and unregistered records can expire immediately when eligible. The native fourth flag corresponds to an unsupported zero-valued look-direction state and is not invented for ordinary forward view.

Verification: 245 unit tests across 49 files, build, targeted rear-view and sun GPU checks, and production smoke passed. The GPU probe measures the fade-to-full-brightness transition, and unit cases cover counter duration, return transitions and offscreen precedence. Production reported no page errors, external runtime requests or development hook. Full browser testing was not repeated for this focused change. Remaining camera modes, original scheduling, textures, sprite geometry, obstruction, global lighting and retail comparisons remain incomplete.

## Static world obstruction for the sun corona

Connected the playable halo fade to a sun-to-camera collision ray. Fixed world shapes and imported fixed triangle collision are eligible; vehicles, kinematic actors and sensors are excluded. Queries stop at the camera and use retained corona positions during fade-out. The core retains its separate source registration policy without a LOS query. Removing an obstacle allows the halo to fade back in.

Verification: 249 unit tests across 50 files, all 50 browser tests, build and production smoke passed. Physics cases cover segment bounds, collider categories and removal. The GPU fixture uses the real Simulation-to-WorldLighting callback and verifies that a fixed obstacle removes the halo color while preserving the core, then restores it when removed. Production reported no page errors, external runtime requests or development hook. Fixed collision is a documented approximation of native building-only LOS: imported entity categories, surface filtering, native collision precision, clouds and retail comparison remain unfinished, alongside textured corona rendering and the wider goal.

## Object data and entity classification foundation

Source investigation established that model assignment from OBJECT.DAT selects the native building/dummy branch; mass and IDE static-object sections cannot substitute for that data. Added a raw 13–24-field reader with ordered records, line diagnostics, optional-value preservation, unsafe-effect/buoyancy issues and case-normalized last-definition lookup. Classification stays unknown without a provided table. Native default-property reuse and the 160-property-record capacity are documented separately from raw model-row counts.

Verification: 254 unit tests across 51 files and build passed. Synthetic tests cover the full schema, partial optional rows, terminators, malformed inputs, duplicates and mass-independent classification. The module is not yet connected to local import/collider ownership, so playable obstruction remains the documented fixed-collider approximation and browser/production runs were not repeated. `docs/research/OBJECT_DATA.md` records the concrete integration requirements and remaining native object lifecycle work.

## Local object definitions in imported scenes

Connected session-local OBJECT.DAT selection to owned collider classification. The Lighting panel supports import, malformed-replacement recovery and clear. Imported collider metadata switches between building/dummy/unknown in place; known dummies are excluded from sun obstruction without removing physical collision. Unknown sources keep the explicit fixed-collision fallback. Scene disposal clears classification with its collider-source map.

Verification: 256 unit tests across 51 files, all 50 browser tests, build and production smoke passed. Tests cover metadata/handle preservation, reset/disposal, ray filtering, real file controls, malformed replacement and continued walking after classification changes. The menu capture was inspected. Production verifies local object-data import/clear without development hooks and reports no page errors or external runtime requests. Native dynamic-object conversion, property simulation, source completeness and retail compatibility remain unfinished.

## Particle texture selection for the sun

Confirmed the native particle-dictionary lookup uses coronastar for the sun, without a separate mask name. Extracted named texture selection from the DFF resolver so non-model consumers can retain the same mipmaps, sampler metadata, dictionary precedence, limits and cache identity. Added explicit sun-texture selection with missing/ambiguous-raster errors and no arbitrary fallback.

Verification: 259 unit tests across 52 files, build, 18 targeted model-import/sun browser checks and production smoke passed. Production reported no page errors, external runtime requests or development hook. The full unrelated gameplay suite was not repeated. The new sun selector is not yet connected to a local picker or render pass; procedural sun visuals remain. Atomic asynchronous texture ownership, source-based sprite drawing and retail comparisons remain required.

## Asynchronous sun texture ownership

Added a worker for local particle-TXD decoding and a session texture owner with atomic replacement. Pending loads cancel on supersession, clear or disposal; failures retain the current raster, stale results cannot commit and workers terminate after completion. One GPU raster can be borrowed by both future corona draws, with disposal owned centrally.

Verification: 262 unit tests across 53 files, build and a targeted real-worker GPU test passed. The browser verifies red/blue texture replacement, retained pixels after failure and GPU texture counts returning from one to zero on clear. Unit tests cover cancellation races, startup/transport failure and single release. The worker/owner are not yet connected to the playable menu/render pass, so production integration and full gameplay checks were not rerun. Source-sized textured sun rendering and retail fidelity remain unfinished.

## Optional textured sun render pass and picker

Connected the asynchronous local particle-TXD picker to two shared-raster sun draws. With a timecycle and usable stored size, the textured pass replaces the procedural core/halo; clear restores them. Registration retains size during fade-out. The pass uses source position/pull distance and size multipliers, while its half-extents, size-FOV scalar, intensity mapping and final blending/depth behavior remain explicitly provisional. The menu labels sprite sizing experimental.

Verification: 263 unit tests across 53 files, all 51 browser tests, build and production smoke passed. GPU cases cover shared-raster RGB, zero-alpha additive behavior, depth occlusion, zero size and procedural restoration. Picker cases cover load/failure/clear. The first GPU run exposed a tint uniform component mismatch, corrected before successful targeted/full runs. Production emits and loads the worker, verifies the real controls without development hooks and reports no page errors or external runtime requests. The menu capture was inspected and status wording clarified. Native sprite extents, FOV/aspect behavior, color arithmetic, weather scaling, flares and retail comparisons remain unfinished; this does not complete the wider goal.

## Textured sun raster orientation

Corrected the provisional sun quad's vertical UV mapping so the first decoded raster row appears at the top of the screen. Related native 2D sprite/rectangle source supports that convention, while the rotated-aspect sun routine remains unreversed. Added an asymmetric four-color GPU fixture and framebuffer-bound measurements across landscape/portrait viewports and two depths.

Build and all three targeted sun browser/GPU checks passed. The new check verifies orientation, centering and the documented provisional extent formula; it does not prove native proportions. Unit, full-gameplay and production runs were not repeated for this shader-coordinate change. Source limitations and remaining native sprite verification are recorded in `docs/research/SUN.md`.

## Source-based windowed camera projection

Replaced the fixed vertical camera angle with the pinned source's non-exclusive viewport conversion: the source FOV belongs to the larger viewport axis. The selected 70-degree baseline gives roughly 43 degrees vertical at 16:9. The same scalar now reaches textured sun sizing through the lighting controller. Fixed 70-degree gameplay behavior remains provisional because follow-ped processing is unreversed; this is a documented PC windowed adaptation, not PS2/exclusive-mode parity.

Verification: 266 unit tests across 54 files, all 52 browser tests, build and production smoke passed. Tests cover projected frustum edges, aspect-independent pixel shape, invalid inputs and GPU sun bounds at multiple FOVs. Production had no page errors/external runtime requests/development hook, and its gameplay capture was inspected. Full camera behavior, exact sprite extents and original-game comparisons remain unfinished.
