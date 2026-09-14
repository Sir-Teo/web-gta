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

## Sun visibility modulates imported building ambient

Implemented the source's corona lighting multiplier: recover toward 1, then attenuate toward 0.6 for a clear sun corona using the preceding render's offscreen state. The final unregistered fade update remains eligible, and core-only dawn cannot attenuate ambient. Imported building lighting consumes the current multiplier before drawing, including same-hour updates, without changing baked vertex colors or mutating input ambient values.

Verification: 269 unit tests across 54 files, all 52 browser checks, build and production smoke passed. GPU building output drops from 128 to about 77 and recovers to 128 as the source-informed sun state changes. Production reports no page errors/external runtime requests/development hook. Clouds, interiors, other native lighting consumers, native float/timing parity and retail captures remain unfinished. Evidence and implementation boundaries are recorded in `docs/research/SUN.md`.

## Imported interiors gate sun registration

Retained the selected placement area through scene installation and playable lighting. Area 0 permits sun registration; other areas suppress it while existing corona records fade naturally. Mixed/invalid scene areas reject before visual or collision allocation. Both procedural and textured sun paths share the gate, and the ambient multiplier recovers after the remaining records expire.

Verification: 271 unit tests across 54 files, all 19 targeted model-import/sun browser tests, build and production smoke passed. The real importer-to-game test carries area 5 into playable lighting; GPU checks verify indoor suppression and exterior return for both sun paths. Production reports no errors/external runtime requests/development hook. The unrelated full browser suite was not repeated. Interior portals, sky/background policy, area lighting and retail comparison remain unfinished.

## Textured sun retained-depth clipping

Corrected the sun pass to clip the retained world position before its camera-facing pull, then repeat projection after the pull. Added the source's independently registered sun range and truncated distance attenuation. This prevents a retained sun just beyond a shortened far plane from drawing and preserves the extreme-distance fade branch.

Build and both targeted sun GPU/browser checks passed, including far-plane boundaries and measured extreme-depth attenuation. Unit/full gameplay/production suites were not repeated. Weather research found the source's fog stretch/color rule but no reversed weather update mapping, so no unsupported mapping from timecycle rows was introduced. Exact sprite arithmetic, weather effects and retail comparison remain unfinished.

## Paused sun state no longer advances on wall time

Found and corrected a pause boundary mismatch: the game clock/physics stopped, but sun registration, fading and ambient recovery kept advancing behind the menu. Pause state now reaches the lighting controller and skips the entire sun state update while continuing to draw. Resume processes the retained state and any pending camera-look change. The pinned game process places both native sun calls in its unpaused branch.

Build, all 18 targeted gameplay/sun browser tests and production smoke passed. A GPU check preserves a partially faded pixel and its multiplier across 100 paused redraws, then verifies the deferred brightness transition on resume. Production had no errors/external runtime requests/development hook. Unit and full import-focused browser suites were not repeated; native menu compositing and other renderer pause behavior remain separate fidelity work.

## Raw vehicle handling ingestion

Started the vehicle-handling compatibility work with a source-backed HANDLING.CFG base-record reader. It preserves all 35 values, unsigned flags, source units/precision, exact names and ordered duplicates. Byte overflow and unsupported physical/enum values remain explicit issues. Specialized bike/aircraft/boat/animation rows are retained as raw tokens with an interpretation warning. No values are silently translated into Rapier forces.

276 unit tests across 55 files and build passed. New cases verify the complete independent field mapping, high-bit flags, duplicates, preserved specialized rows, malformed input and limits. Browser/production checks were not repeated because runtime handling is unchanged. `docs/research/HANDLING.md` records the source conversion dependencies and the next preparation/vehicle-integration requirements. Existing cars still use authored settings; original handling and retail motion matching remain unfinished.

## Native handling preparation and gear ratios

Implemented a separate source-based preparation stage: byte/float conversion, acceleration/velocity/braking units, reciprocal mass, buoyancy, damage scaling, drag-limited speed, special reverse branches and transmission slot/shift thresholds. The API requires a native handling-table ID explicitly. Invalid domains, unsafe gear counts, nonfinite output, precision-stalled searches and excessive work reject without mutating raw data.

282 unit tests across 56 files and build passed. Tests verify independent conversion examples, drag thresholds, branch precedence, unused gear slots and malformed-input work limits. Browser/production checks were not repeated because vehicle physics is not connected yet. Prepared values remain native-space quantities; handling-name resolution, controller integration and retail motion/float verification remain required.

## Source-based transmission drive controller

Implemented pure transmission updates over prepared handling: throttle-dependent shifts, boost/modifier rules, forward/reverse speed limits, gear taper and grounded/airborne inertia state. Multiple shifts can occur in one call; source behavior disables inertia and cheat modifiers after a shift. Returned acceleration remains a native drive increment and is not mislabeled as a physical wheel force.

288 unit tests across 57 files and build passed. New checks cover independent increment calculations, shift boundaries and direction, modifier precedence, smoothing/contact behavior, speed cutoffs and failure without partial state commits. Browser/production tests were not repeated because playable physics remains unchanged. Wheel-force conversion/consumer tracing, handling identity, local-data integration and retail driving comparison remain unfinished.

## Driven-wheel contact history

Traced the automobile caller and corrected the transmission contact contract: grounded inertia requires any retained driven-wheel contact, not all wheels. Added the source's four-unit contact retention and composed it with transmission updates and explicit per-wheel drive routing. Named wheel positions avoid mismatching native and Rapier index orders; the velocity-frequency divisor remains explicit.

293 unit tests across 58 files and build passed. Tests cover one-contact drive layouts, retention expiry, airborne transition, 2WD/4WD routing without double division and atomic invalid-input rejection. Browser/production checks were not repeated because playable physics remains unchanged. Wheel adhesion, braking, anti-dive, contact-point retention and force/unit conversion remain between this native thrust output and physical integration.

## Native scalar tire response

Implemented source-informed wheel response for braking/coasting, combined lateral/forward traction, spin/skid/lock states, burst-tire perturbation and anti-dive's separate turning component. Random perturbation is supplied explicitly. The source's shared skid latch remains an explicit input/output with its unverified lifetime documented rather than silently reset per wheel.

300 unit tests across 59 files and build passed. Tests cover independent response examples, traction limits, wheel-state branches, anti-dive, random-input requirements and invalid data without mutation. Browser/production checks were not repeated because the helper is not connected to the playable vehicles. Contact-basis projection, surface/bias inputs, effective turning mass, impulse conversion and retail behavior remain unfinished.

## Native tire response reaches real physics bodies

Added a bridge from scalar wheel response through native contact-basis/effective-turn-mass calculations to linear and angular velocity increments on a Rapier body. Origin-relative effective mass and the later COM-relative torque lever remain separate. Native 20 ms velocity units and Z-up axes convert once into browser per-second Y-up velocities; already-scaled response is not multiplied by dt again.

306 unit tests across 60 files and build passed. Real Rapier tests verify resulting velocity/translation, symmetric yaw cancellation, basis rotation and failure without partial writes. Browser/production checks were not repeated because the playable vehicle loop is not yet connected. Rapier collision/pose integration remains an approximation; contact sampling, surface/bias data, native update ordering and local handling application remain required.

## Physical contact sampling for native tires

Added road-plane wheel basis/steering and a sampler for real Rapier raycast contacts. Tire speed includes chassis rotation around its COM and subtracts moving/rotating ground velocity at the hit point. Native axis/time conversions and origin-relative offsets are explicit; raw suspension length is not mistaken for native compression.

311 unit tests across 61 files and build passed. Real-engine tests cover moving ground, COM offsets and a complete sampled-contact → tire braking → physical velocity change. Browser/production checks were not repeated because the playable loop remains unchanged. All contacts must be sampled before applying responses; native airborne fallback points, suspension conversion, surface/bias inputs and removal of duplicate Rapier tire forces remain integration requirements.

## Four-wheel native update composition

Connected contact retention, transmission, tire response and velocity conversion into a pure four-wheel frame. The frame respects source axle order and reverse spin-state correction, requires explicit geometry for retained contacts, and keeps previous state untouched on failure. Physical writes now validate the whole ordered batch before committing either velocity.

316 unit tests across 62 files and build passed. A real four-wheel raycast test exercises the complete composed chain and verifies expected forward motion without asymmetric yaw. Other cases cover processing order, reverse state correction, missing fallback geometry and atomic invalid batches. Browser/production tests were not repeated because the playable loop remains authored. Native surface/suspension inputs and local vehicle integration are still unfinished.

## Source wheel-pair brake and adhesion parameters

Added the parameter resolver used by the four-wheel update: axle biases, pedal/timestep braking, wet/suspension load, off-road priority, burst damage and rear-handbrake/tire-temperature/NOS branches. Neutral NPC and player-collision rules remain distinct. Burnout requiring an additional turning force rejects explicitly rather than silently omitting that force.

322 unit tests across 63 files and build passed. The real four-wheel raycast-to-motion check now uses resolved parameters; new cases cover branch precedence and load/bias calculations. Browser/production checks were not repeated because playable control remains authored. Surface-data ingestion, suspension compression conversion, upstream traction/modifiers and local handling integration remain required.

## Raw surface materials and adhesion research

Added bounded 36-column SURFINFO.DAT ingestion preserving raw grip values, flags, categories, duplicate records and provenance. Source research distinguishes that material file from the separate adhesion matrix, confirms wheelbase-to-road matrix lookup and group-based off-road eligibility, and records the unresolved native wet-grip conversion and unreversed matrix loader.

326 unit tests across 64 files and build passed. Browser/production checks were not repeated because playable behavior is unchanged. Surface-ID mapping, matrix loading, grip conversion and weather linkage are still required before imported surfaces can drive vehicle adhesion.

## Native surface IDs and load-order semantics

Added the source's 179 regular collision material identities, exact name lookup and explicit unknown-to-DEFAULT fallback. Native material indexing preserves overwrite order and reports unknown names/default replacement; missing material data remains missing. Audio-only IDs are not treated as road materials.

329 unit tests across 65 files and build passed, including a real imported-collision ray hit whose retained material byte resolves to the source name. Browser/production checks were not repeated because playable driving remains unchanged. Mesh contact material selection, adhesion matrix ingestion and native grip preparation remain ahead of tire integration.

## Wheel contact face materials

Added per-wheel source material/light sampling, including triangle meshes. A collider-specific ray repeats the saved wheel contact to recover Rapier's face ID; front/back IDs map to the same source face. Contact snapshots can now include surface metadata, and missing/mismatched mesh hits remain unresolved.

333 unit tests across 66 files and build passed. Real tests cover two wheel contacts on different materials within one mesh, back faces and stale geometry. Browser/production checks were not repeated because playable control remains unchanged. Equal-distance triangle seams remain unverified; material tables, adhesion loading and grip conversion still need integration.

## Explicit adhesion matrix cells

Primary Mod Loader source confirms SURFACE.DAT's positional row order and preservation of numeric/string cells. Added bounded ingestion and explicit pair lookup without inferred symmetry or placeholder defaults. The real wheel-contact test now traverses collision face → material ID → material group → supplied matrix cell.

337 unit tests across 67 files and build passed. Browser/production checks were not repeated because playable driving remains unchanged. Native missing-cell expansion and wet-grip conversion remain unverified; local data installation and vehicle integration are still required.

## Native suspension geometry and compression

Added ordinary source suspension-line construction and line-hit-to-spring compression conversion, plus a real Rapier contact adapter that avoids clamped spring length. Source tracing found negative prepared compression is valid; corrected the tire parameter validator so overcompression contributes to wheel loading.

342 unit tests across 68 files and build passed, including real contact, overcompression and contact loss. Browser/production checks were not repeated because playable driving remains unchanged. Native spring/damping forces, burst/soft-ground and special suspension paths remain unfinished.

## Native spring force reaches chassis motion

Implemented source spring-force magnitude/direction and ordinary ApplyForce linear/angular conversion. Contact-normal flipping, capped timestep and special mass-flag precedence are explicit. The atomic physics bridge now accepts both tire and spring velocity deltas.

347 unit tests across 69 files and build passed. Real Rapier verification checks four symmetric springs lift the body without adding rotation. Browser/production checks were not repeated because playable control remains authored. Source tracing establishes damping's post-spring ordering; damping constants/implementation and full vehicle integration remain unfinished.

## Native suspension damping

Implemented source damping with separate saved ground-relative/current chassis speeds, motion-reversal checks, COM-relative effective mass and the one-sided spring-force cap. Executable limit constants remain required inputs pending verification.

353 unit tests across 70 files and build passed, including real-body damping response. Browser/production checks were not repeated because playable control remains authored. Ordered full suspension frames, verified constants and application integration are still required.

## Ordered suspension composition

Connected ordinary spring and damping calculations into one pure four-wheel pass: all springs first, one ground-relative velocity snapshot, then sequential damping with updated chassis speeds. Returned normals also control the road-normal damping branch.

357 unit tests across 71 files and build passed. New checks cover ordering, moving ground and atomic failure. Browser/production checks were not repeated because playable driving remains unchanged. Verified constants, special suspension paths and application integration remain required.

## Damaged tires and soft-ground suspension

Added source adjustments to raw suspension fractions for missing/burst wheels, sand sinking and rail-joint pulses. Random input is explicit, and adjustment precedes spring compression conversion. Source branch precedence and wet/off-road effects are retained.

362 unit tests across 72 files and build passed. Browser/production checks were not repeated because playable driving remains unchanged. Full contact/model/RNG ownership, verified damping constants and application integration remain required.

## Upstream vehicle grip modifiers

Added source vehicle-status traction calculation and player/nonplayer handling boosts, plus NOS/perfect transmission modifier selection. Velocity-frequency scaling and the instance car-traction field remain distinct, explicit inputs.

367 unit tests across 73 files and build passed. Browser/production checks were not repeated because playable driving remains unchanged. Runtime field ownership, steering and integration with the composed suspension/tire update remain required.

## Native steering limit and axle routing

Added source speed-dependent player steering attenuation, countersteer/handbrake exceptions and rear/secondary steering flag routing. Fixed tarmac adhesion and retained left-wheel contacts remain explicit inputs matching the caller.

372 unit tests across 74 files and build passed. Browser/production checks were not repeated because playable driving is unchanged. Input/secondary-angle ownership and contact-basis/controller integration remain unfinished.

## Caller acceleration reaches driven tires

Connected explicit vehicle-grip context to drivetrain thrust routing after frequency division. The composed wheel frame now applies those acceleration modifiers through tire response and reports the resolved grip diagnostics.

373 unit tests across 74 files and build passed. Real-physics verification confirms the expected boosted forward increment; player, engine-off and 2WD/4WD cases are covered. Browser/production checks were not repeated because playable driving remains unchanged. Consistent adhesion construction and application adapter composition remain required.

## Consistent grip and tire-frame composition

Added a resolved wheel-frame entry point that derives traction, transmission modifier and wheel adhesion from one context before tire response. This removes independently supplied base-grip/cheat values from that integration path.

376 unit tests across 75 files and build passed. New checks exercise limited wheelspin, NOS/perfect precedence and wet/load/damage scaling. Browser/production checks were not repeated because playable driving remains authored. Full suspension/contact/material ownership and application integration remain unfinished.

## Native mechanical initialization and source audit

Added independent source-constructor mechanical state, including zero-initialized transmission inertia. A full pinned-source scan found frequency/car traction initialized to one with no other named writes. It also exposed an unexplained 62,500× difference in the reversed STATUS_PHYSICS traction formula at those defaults; retail correctness remains unverified.

378 unit tests across 76 files and build passed. Initial inertia use and state ownership are covered. Browser/production checks were not repeated because playable driving remains unchanged. The traction anomaly requires stronger evidence before authentic NPC integration.

## Corrected historical NPC traction rewrite

Traced the 62,500× traction anomaly to an exact 2022 source refactor that replaced multiplication with a non-equivalent division. Restored the earlier San Andreas expression and nonnegative instance-traction semantics. Default physics traction now agrees with ordinary traction and scales proportionally.

380 unit tests across 76 files and build passed, including resolved tire-response regression coverage. Browser/production checks were not repeated because playable control is unchanged. Historical source evidence strongly supports this correction; original executable comparison remains unperformed.

## Prepared surface grip resolution

Added runtime signed-byte wetness calculation and a bridge from material IDs/adhesion cells to tire surface parameters. Older source history did not resolve the disputed file conversion or damping constants; both remain explicit requirements.

384 unit tests across 77 files and build passed. Browser/production checks were not repeated because playable driving remains unchanged. Raw wet-grip conversion, local data ownership and controller integration remain unfinished.

## Suspension feeds tire contact motion

Connected suspension and resolved tire frames, resampling tire speeds after spring/damping motion. Corrected normals and ground-relative motion are preserved, with explicit fallback geometry for retained airborne tires.

388 unit tests across 78 files and build passed. Browser/production checks were not repeated because playable driving remains authored. Steering scheduling, contact/model/material ownership and controller integration remain unfinished.

## Steering joins the composed vehicle update

Connected source steering controls between suspension and tire contact-basis construction. The update uses refreshed contact retention, shared traction and post-suspension lateral motion while preserving the earlier forward-speed input.

391 unit tests across 78 files and build passed. Same-frame countersteer threshold and axle-routing behavior are covered. Browser/production checks were not repeated because playable driving is unchanged; input generation and runtime ownership/integration remain unfinished.

## Native player steering input

Added source pad/mouse steering accumulation, signed-square angle mapping and rear-handbrake steering updates. Pause semantics are explicit because some branches update per call even with zero timestep.

395 unit tests across 79 files and build passed. Browser/production checks were not repeated because playable input remains unchanged. Pedal/handbrake task logic and runtime input-state integration remain unfinished.

## Native pedal transitions

Added source gas/brake direction logic, low-speed burnout detection, automatic/manual handbrake distinction and driver-input fallback/gating. Previous gas affects the reverse-to-forward transition as in the source.

401 unit tests across 80 files and build passed. Browser/production checks were not repeated because playable controls remain authored. Driver task eligibility, burnout force and runtime controller integration remain unfinished.

## Rear-drive burnout turning force

Connected the source burnout turning force to rear-axle processing and enabled fully specified rear-drive burnouts in the resolved tire frame. Rear brake/adhesion clear in that branch; handbrake precedence remains intact. The source's unusual force/point argument order is preserved and documented.

404 unit tests across 81 files and build passed. Browser/production checks were not repeated because playable controls remain unchanged. Runtime geometry/state integration and retail comparison remain unfinished.

## Source pedal logic reaches playable cars

Replaced the active-player car's approximate gas/brake direction decision with the native pedal calculation. It uses current projected forward velocity and per-car previous gas, maps analog pressure, and brakes before changing from reverse to forward. Existing engine, suspension and steering tuning remain authored.

406 unit tests across 82 files and build passed. All 19 targeted gameplay/character browser tests and production smoke passed, including actual driving/braking/exiting and pause/save flows. This changes playable behavior but does not establish retail physics parity; full native controller integration remains unfinished.

## Native steering response reaches playable cars

Active-player steering now uses native pad accumulation and the signed-square angle curve, with per-car raw input state and explicit native timestep conversion. The existing speed-dependent steering limit remains authored pending handling/material integration.

407 unit tests across 82 files, build, all 17 gameplay browser tests and production smoke passed. This changes playable steering response without claiming full source physics or retail driving parity.

## Vehicle definition ingestion

Added source cars-section IDE ingestion, retaining handling identity, wheel sizes, type-specific raw misc values and optional fields. Missing wheel data remains explicit instead of receiving a later source bug-fix default.

411 unit tests across 83 files and build passed. Browser/production checks were not repeated because the new parser is not yet connected to runtime imports. Vehicle model/handling association and native controller application remain unfinished.

## Vehicle-to-handling identity

Added explicit native handling-table ingestion and vehicle resolution. Handling row prefix matching and exact vehicle-name lookup remain separate; preparation uses the table ID rather than the vehicle model ID.

415 unit tests across 84 files and build passed. Browser/production checks were not repeated because runtime loading is unchanged. Verified table data and model/controller integration remain unfinished.

## Model-based suspension geometry

Added an ordinary-car adapter combining explicit DFF wheel-frame positions, IDE axle sizes and prepared handling suspension limits. Local frame translation follows the source's car branch; wheel identities remain explicit pending verified frame mapping and hierarchy preprocessing.

418 unit tests across 85 files and build passed. Browser/production checks were not repeated because playable suspension is unchanged. Native model installation and controller integration remain unfinished.

## Ground-aware wheel-ray sampling

Separated raw collision-ray fractions from spring compression and composed real wheel sampling with native burst, sand and rail adjustments in that order. The adapter preserves intermediate values and derives dimensions from one suspension line.

420 unit tests across 85 files and build passed, including real Rapier ray-hit checks for ground effects, missing tires, overcompression and contact loss. Playable suspension remains unchanged; browser/production checks were not repeated. Native controller integration and retail comparison remain unfinished.

## Burnout shares resolved steering and suspension geometry

Removed an inconsistent input path from the combined source-steering frame. Burnout torque now derives its primary steering angle, chassis axis, COM and rear-left point from the same resolved frame as tire response, including explicit airborne fallback.

423 unit tests across 85 files and build passed. Analytic combined-frame checks cover rear steering, attenuation, contact selection and failure/suppression branches. Playable physics is unchanged; browser/production tests were not repeated. Native controller integration and retail accuracy remain unfinished.

## Automatic standard car wheel selection

Ordinary-car suspension geometry now resolves the four conventional wheel dummy names automatically when each is unique. Explicit selections remain supported; ambiguous names reject. Research documents the distinction between this naming adapter and the still-unrecovered native descriptor/visibility-ID setup.

425 unit tests across 85 files and build passed. Playable imports and physics remain unchanged; browser/production suites were not repeated. Full vehicle model installation and native controller integration remain unfinished.

## Playable vehicle rotation interpolation

Vehicle visuals now interpolate both position and orientation over the same fixed-step interval. Previously position interpolated while rotation jumped immediately to the newest physics state. Quaternion SLERP follows the shortest turn across the yaw wrap; Simulation owns an independent pre-step rotation snapshot. Save restoration, traffic reset and traffic recycling initialize rotation history to the new pose to avoid interpolating through a teleport. Physics, wheel tuning and save-file schema are unchanged.

428 unit tests across 86 files and build passed. New tests cover interpolation endpoints/midpoint across +170/-170 degrees, independent pre-step capture and save/traffic reset. All 17 gameplay browser tests passed, including driving, entering/exiting, pause and save/reload. Production smoke passed with no external runtime requests or development hook. Inspected street/driving captures for rendering regressions; still images do not prove temporal smoothness or retail fidelity. This is a browser presentation correction, not a claim about the original renderer's interpolation. Imported vehicle installation and native controller integration remain unfinished.

## Native tire heat feeds subsequent traction

Added the rear wheel-pair burnout heating/cooling calculation and exposed its result from resolved tire frames. NOS preserves its separate field semantics; the current frame uses the old temperature and callers can feed the result into the next frame.

431 unit tests across 87 files and build passed, including a two-frame heat/traction check. Playable Rapier tire forces are unchanged, so browser/production suites were not repeated. The model-rendering investigation confirmed preserved DFF hierarchy but an unreversed source PreRender routine; full imported car installation remains unfinished.

## Native suspension ray-controller setup

Added a Rapier wheel-query controller built from native suspension lines, preserving named wheel identity, coordinate conversion and independent axle dimensions. Rapier's own tire/engine/spring forces are disabled so the native solver can own velocity changes without double application.

434 unit tests across 88 files and build passed. Real-contact tests verify geometry and unchanged chassis velocities during queries. Playable controller replacement remains unfinished; browser/production suites were not repeated.

## Suspension contact assembly

Connected named wheel rays to native suspension inputs, including ground-adjusted compression, chassis-relative points, normals and moving-ground velocity. Geometry sampling is now independent of tire tangent projection, preserving valid suspension contacts when tire projection degenerates.

436 unit tests across 88 files and build passed. Real-contact tests verify conversion, ground effects and read-only sampling. Playable physics is unchanged; browser/production suites were not repeated. Complete native controller integration remains unfinished.

## Native wheel pipeline reaches a real chassis

Added native chassis pose/motion sampling and verified the full physical chain from four real wheel rays through suspension and tire calculations to one velocity batch on the same Rapier body. The integration checks an independently calculated spring lift and converted forward acceleration.

439 unit tests across 89 files and build passed. This proves the diagnostic pipeline can drive a physical chassis; playable controller replacement and retail accuracy remain unfinished. Browser/production suites were not repeated because gameplay installation is unchanged.

## Persistent native wheel-force controller

Added ownership of wheel/contact/transmission history and tire heat around the complete force calculation. Chassis state is sampled directly; the next history is committed after velocity application, and external result mutation cannot alter it.

442 unit tests across 90 files and build passed. Multi-frame heat/contact behavior and failure preservation are verified. Playable installation, remaining vehicle state and retail validation are unfinished; browser/production suites were not repeated.

## Native gravity scale and ownership

Added the source finite-mass gravity branch before native suspension, with an explicit check that Rapier chassis gravity is disabled. Source timestep/velocity units imply 20 world-units/s²; the authored playable world's 9.81 is unchanged.

446 unit tests across 91 files and build passed. Real-body tests verify force ordering and no double gravity during world stepping. Playable installation and remaining physical-control branches remain unfinished; browser/production suites were not repeated.

## Native vehicle air resistance

Connected source linear drag and per-call angular damping after gravity and before suspension, with explicit ownership and checks against duplicate Rapier damping. Handling drag conversion and optional zone multiplier are preserved.

450 unit tests across 92 files and build passed. Playable car installation and sustained retail driving comparisons remain unfinished; browser/production tests were not repeated.

## Corrected speed ordering and sustained suspension stability

Fixed transmission and steering to use forward speed after suspension, matching the source's actual ordering. Removed the separate velocity input that allowed stale speed to enter the combined frame.

453 unit tests across 92 files and build passed. A sloped-contact regression verifies speed cutoff/steering behavior. Ten-second physical runs at both 30 and 60 Hz settle at the analytically predicted spring height with stable contact. Playable installation and retail driving comparison remain unfinished; browser/production checks were not repeated.

## Retained airborne wheel geometry

Added current suspension-endpoint fallback for wheels temporarily lacking ray contact. Points rotate with the chassis instead of retaining old hit positions; normals and ground velocity remain explicit inputs.

456 unit tests across 93 files and build passed. A multi-frame controller test verifies retained tire contact and expiry without airborne spring forces. Playable installation and retail comparison remain unfinished; browser/production checks were not repeated.

## Player inputs drive native physical forces

Connected native pedal and steering input to the persistent force controller, including handling steering lock, previous gas and raw steering history. Input history commits with successful physical updates.

458 unit tests across 93 files and build passed. Real-body tests verify braking, steering accumulation, burnout heating and failure preservation. Playable installation and retail comparison remain unfinished; browser/production tests were not repeated.

## Sustained native acceleration and braking

Added complete native pedal-to-body driving sequences at 30 and 60 Hz. Both settle, accelerate to the same fixture speed, and brake to low speed within bounded time/distance while retaining stable support. An initial failure identified the end of the test platform; extended continuous ground and reran without changing physics.

460 unit tests across 93 files and build passed. These are synthetic physical integration checks, not retail performance comparisons. Playable installation and real-terrain driving remain unfinished; browser/production checks were not repeated.

## Sustained native steering in both directions

Verified mirrored physical turns at 30 and 60 Hz through the complete native input/force path. Steering direction, body yaw, lateral displacement, mirrored paths and suspension bounds pass together. Shared the road fixture with acceleration/braking checks.

462 unit tests across 93 files and build passed. Playable installation and retail driving comparisons remain unfinished; browser/production checks were not repeated.

## Unified native raycast vehicle controller

Consolidated wheel query ownership, contact sampling, current fallback geometry, player input and persistent forces into one step API. Per-wheel material/physics profiles remain explicit, and the world scheduler owns integration.

463 unit tests across 93 files and build passed. Sustained driving and turning tests at both rates now use this controller; fourth-wheel resolution failure preserves body/history. Playable imported-car installation and retail validation remain unfinished; browser/production checks were not repeated.

## Dynamic imported chassis collision

Added dynamic COL installation with source sphere/box/mesh geometry and explicit handling mass/COM. Geometry contributes no extra mass; native gravity/drag own motion, while Rapier collision coefficients and isotropic inertia remain explicit adapter assumptions.

465 unit tests across 94 files and build passed. Real ray hits, mass properties, metadata ownership and installation rollback are verified. Playable imported-car installation and retail collision comparison remain unfinished; browser/production checks were not repeated.

## Owned imported car instance

Combined raw DFF visuals, dynamic COL collision and the unified native controller into one assembly API with shared pose interpolation and cleanup. Wheel geometry and scene-root checks happen before installation; later visual failure rolls back physical resources.

469 unit tests across 95 files and build passed. This API is not yet connected to gameplay imports, and retail car preprocessing/animation remains unfinished. Browser/production checks were not repeated.

### Multi-collection district collision import

Following the public map-resource survey, removed the scene importer's single-COL restriction. The model workshop now offers additional external COL files and an explicit option to include all COL entries in the selected IMG. Existing single-model preview and external-file override behavior remain intact. Scene parts retain model-specific collision provenance; ambiguous case-insensitive model names reject with both source names, and malformed collections identify their source. Source-count, aggregate byte and model-count limits bound the import. Clearing collision resets the new controls and scene collision together.

Validation: 471 tests across 95 unit files pass; TypeScript/Vite build passes; two focused Chrome browser tests pass, covering existing archive/override behavior and a two-model scene assembled from archived plus external COL files. The latter enables Walk scene with both overlays, then disables it and removes overlays after clearing. Logs: `/tmp/web-gta-district-unit.log`, `/tmp/web-gta-district-build.log`, `/tmp/web-gta-district-browser.log`. Fixtures remain synthetic/independent diagnostic exports, not retail district assets. Actual district/world fidelity, multi-IPL streaming and full-state coverage remain incomplete.

### Shared-static multi-IPL district assembly

Implemented related binary stream loading from multiple archived entries and external files, with distinct stream namespaces, original indices and one explicitly selected static LOD array. Shared replacement collision exclusion remains correct. Added limits and source validation, archive-selection cleanup and stacked placement/collision picker layout. Verified 473/95 unit tests, build and two focused browser tests; reviewed the updated multi-IPL preview capture. Logs: `/tmp/web-gta-multi-ipl-unit.log`, `/tmp/web-gta-multi-ipl-build.log`, `/tmp/web-gta-multi-ipl-browser.log`. See `docs/research/PLACEMENT_FORMATS.md` for constraints; full-world streaming and actual district fidelity remain unverified.

### District stream discovery from static IPL names

Added a workshop action to select related archived IPLs using the inspected original loader's case-insensitive static-name-plus-`_stream` prefix rule. Handles more than the search UI's first 200 entries, keeps independent stream references and refuses oversized groups without changing selections. Verified 475 tests/96 files, build and the district assembly browser scenario. Logs: `/tmp/web-gta-related-unit.log`, `/tmp/web-gta-related-build.log`, `/tmp/web-gta-related-browser.log`. Actual retail district validation and dynamic world streaming remain outstanding.

### External district textures and parent dictionaries

Added scene TXD selection and source-aware caching for external base/parent dictionaries, with explicit same-name override precedence and duplicate-name validation. Diagnostic district now renders its external shared texture across four placements with one GPU texture and complete clear cleanup. Verified 477 tests/96 files, build and two focused browser scenarios; visually inspected `artifacts/multi-ipl-preview.png`. Logs: `/tmp/web-gta-external-txd-unit.log`, `/tmp/web-gta-external-txd-build.log`, `/tmp/web-gta-external-txd-browser.log`. Actual original-world asset/visual parity remains unverified.

### Public native world validation and terrain clump fix

Downloaded and inspected Noclip's public native San Andreas archive outside the repository. Verified district metadata, 13 streamed IPLs, ten district collision collections and nearby Grove models. A terrain model exposed valid light attachment frame STRUCTs being rejected as duplicate clump headers. Fixed header/attachment parsing, retained object payloads and validated attachment counts/frames. Authored regression tests pass; native terrain and CJ house rendered with native textures in a temporary Chrome audit, and both captures were inspected. Ordinary suite: 478/96; build passes. Logs `/tmp/web-gta-clump-unit.log`, `/tmp/web-gta-clump-build.log`, `/tmp/web-gta-real-model-browser.log`. Full source provenance, inventory and next asset steps are in `docs/research/PUBLIC_WORLD_RESOURCES.md`. No original game assets bundled; embedded lights, full district completeness and calibrated pixel fidelity remain unfinished.

### First real Grove-area scene walking

Added bounded XY-origin selection with preserved LOD ancestry, and fixed a real five-field legacy IDE compatibility issue. Using the public native archive and applicable district/shared definitions, assembled 469 placements/171 models with no omissions or required collision gaps. Chrome installed the scene and verified grounded keyboard walking about 4.1 world units. Reviewed both scene preview and gameplay captures. Ordinary suite 480/96, build and district browser regression pass; real-data browser run passes separately. Source asset paths, exact selection, registration conflict and remaining limits are in `docs/research/PLACEMENT_FORMATS.md`. The placeholder protagonist, lighting calibration, automatic world streaming, full geometry coverage and original gameplay remain incomplete.

### Centered Grove import spawn

Area imports now carry their completed region center into gameplay as a collision-checked spawn preference. Nearby and general scene fallbacks retain support/clearance validation. The real Grove scene starts at the selected cul-de-sac center instead of the first backyard surface, and grounded walking passes. Reviewed the updated native Grove gameplay capture. Verified 481/96 unit tests, build, real-data browser audit; logs `/tmp/web-gta-centered-spawn-unit.log`, `/tmp/web-gta-centered-spawn-build.log`, `/tmp/web-gta-centered-grove-browser.log`. Original protagonist/lighting and multi-floor street-level selection remain unfinished.

### Native timecycle applied to real Grove reference

Verified Noclip's public `timecycp.dat` with LocalTimecycle, then loaded it through the game UI in the native Grove scene. Inspected the resulting sky/building appearance and confirmed grounded movement. Recorded exact file hash, active fog/ambient sample and 37 fallback fog samples in `docs/research/TIMECYCLE.md`. Added an opt-in reference browser test using `GTA_REFERENCE_DIR`; it passes against the inspected local assets and skips without them. No assets or network downloads added to the regular test/build path. Full color/atmosphere parity remains unverified; this establishes an executable real-data baseline for future rendering changes.

### Native altitude fog/camera correction

Applied the inspected timecycle altitude rule to imported far clips, using world camera altitude and keeping camera projection/fog in sync without mutating source samples. Verified 483 tests/97 files, build and a focused Chrome WorldLighting integration probe including parent transforms and clearing native lighting. Logs `/tmp/web-gta-altitude-unit.log`, `/tmp/web-gta-altitude-build.log`, `/tmp/web-gta-altitude-browser.log`. Other timecycle spatial effects and calibrated original atmospheric rendering remain incomplete.

### Native protagonist dependencies audited

Parsed eight real character/texture/animation files from the public world archive. Confirmed `player.dff` and `csplay.dff` are two-triangle skeleton templates, while `fam1.dff` is a complete pedestrian candidate. Inspected the pinned clothing builder: CJ requires separate PLAYER.IMG components, texture composition and skeleton assembly; critical assembly functions still delegate to the original executable. Recorded file measurements, hashes, the failed public player.imgz candidate, and an incremental assembly design in `docs/research/CHARACTER_ASSETS.md`. Audit passed; no gameplay code or native protagonist replacement claimed. Temporary asset-dependent test removed from the ordinary suite.

### Real native pedestrian playback and origin fix

Browser-tested a textured FAM1 pedestrian with native FatIdle/FatWalk through the workshop and playable-character handoff. Screenshot inspection caught a buried lower body even though movement passed. Added explicit native-pedestrian origin support using the source collision minimum Z=-1, preserving feet-origin custom rigs and fixed origin during crouching. Added a unit regression and optional real-data browser audit; inspected the corrected render. Verified 484 unit tests/97 files, build and three character browser tests. Normal animation choice, facing, calibrated foot contact/lighting and CJ assembly remain open; see `docs/research/CHARACTER_ASSETS.md`.

### Native pedestrian forward-axis correction

Measured native root-track displacement and strengthened the real-data browser test to check direction: W previously moved about 1.32 units backward. The native character coordinate preset now applies the same 180-degree heading correction to rendered pose and extracted motion, alongside the existing origin height. The custom convention stays unchanged. Cardinal-direction unit coverage and the real-data directional assertion pass; reviewed the corrected front-facing look-behind capture. Verified 485/97 unit tests, build and three browser tests. Full locomotion turning, contact, original appearance and protagonist assembly remain unfinished.

### Character workshop linked to an existing game

Added session-local character installation from a game-menu workshop link, preserving the current imported world, position and lighting. Requests receive success/failure acknowledgements; closed games produce retry feedback. Standalone character tests still work. The real Grove audit now installs FAM1 with native animation into the actual textured district and timecycle; reviewed `artifacts/native-grove-character.png`. Added lifecycle browser coverage for replacement, invalid-input recovery and closed targets. Verified 485/97 unit tests, build, two existing standalone character browser tests, and both final session/Grove browser tests. Logs `/tmp/web-gta-character-session-{unit,build,final}.log`. No backend, asset bundling or save-format change. CJ assembly and original rendering/gameplay parity remain unfinished.

### Explicit multi-clump component inspection

Checked further CJ asset leads: the public converted-skin repository has no model URL for CJ, and the candidate normal animation download is unavailable. MTA's clothing documentation identifies multi-clump component files; inspection found our reader silently ignored later clumps. Added bounded explicit clump selection through the DFF reader, model worker and workshop. Scene imports reject unspecified multi-clump input instead of silently dropping variants. Verified 486/97 unit tests, build, a clump selection/recovery browser test and the existing real native Grove/character audit. Logs `/tmp/web-gta-multiclump-{unit,build,browser,grove}.log`. No real CJ clothing acquired or assembled; source and limits recorded in `docs/research/CHARACTER_ASSETS.md`.

### Native sampler mode correction

Investigated native Grove foliage sampling and found RW modes 4/5 reversed in both the texture adapter and its old test. Corrected minification/magnification and single-level fallback against RenderWare enum definitions and librw GL tables. Added a GPU pixel probe that independently distinguishes texel interpolation from mip interpolation. Verified 486/97 unit tests, build and browser probe. Actual foliage rasters often request mode 1, so their speckled appearance remains a separate calibration issue; no unsupported global smoothing applied. Evidence and limits: `docs/research/TEXTURE_FILTERING.md`.

### Native stride follows the turning actor

Reproduced sideways sliding caused by immediate desired-direction root motion alongside gradual body rotation. Native pedestrian motion now stays actor-local until Simulation applies its updated heading before collision, including transition blending. Preserved explicit/default world-space movement. Added cardinal/intermediate-turn, wall-collision and invalid-space regressions; the real pedestrian browser audit now verifies stride/heading alignment during a turn. Verified 488/97 unit tests, build, four character/Grove browser scenarios and the strengthened real-data test; inspected the updated character capture. Original turning-rate and transition fidelity remain uncalibrated.

### Native pedestrian ambient color

Connected the separate timecycle object-ambient channels to imported character materials, normalized in native lighting units and multiplied by the existing sun-light multiplier. Shared uniforms replace authored indirect ambient and restore it on clear. Verified colored ambient/direct-light GPU output, field separation and uniform lifecycle; inspected the real Grove character render. Final suite 490/97, build and both GPU/Grove browser scenarios pass. An initial lifecycle test reused a disposed Simulation in teardown; its setup now owns a fresh instance. Directional, collision/contact, brightness and other original light factors remain incomplete; this is not overall brightness or pixel-parity calibration.

### Imported ground contact lighting

Connected source collision day/night light bytes to character ambient/direct illumination through the source contact/ambient multiplier. Grounded support queries preserve source triangle metadata and stop at unknown nearer colliders; airborne retention and the bounded probe are documented approximations. Real Grove resolves byte 0x35 and the inspected character render is less over-bright. Verified 493/98 unit tests, build and GPU/Grove browser scenarios. Original CPed contact selection/smoothing, directional illumination and generated-light/brightness effects remain incomplete; details in `docs/research/CHARACTER_ASSETS.md`.

### Fixed native scene illumination direction

Replaced the authored moving illumination direction when native timecycle data is active with the fixed direction from TimeCycle initialization and app lighting. The visible sun remains independent. Positioned the light and target together at player elevation to preserve direction and keep the browser shadow volume near high terrain; clear restores authored lighting. Verified 493/98 unit tests, build, native direction/time/elevation/restoration browser checks, altitude fog and real Grove walking. Inspected the updated character capture. Directional color/intensity and original shadow rendering remain incomplete. Source evidence and limits are in `docs/research/SUN.md`.

### Native directional intensity and neutral color

Resolved the final timecycle column using stock reversed code and SilentPatch's independent fix for fractional parsing. Added stock pre-scale integer truncation, byte-percentage storage, float interpolation and optional missing-field propagation. Native lighting now supplies neutral directional RGB and illumination × 0.99609375 × corona LightsMult; explicit zero is honored and missing data restores authored fallback. Verified 496/98 unit tests, build, four browser checks and inspected real Grove output. Details and remaining lighting/shadow limitations are recorded in `docs/research/TIMECYCLE.md`.

### Collision geometry for projected pedestrian shadows

Traced the missing imported-ground shadow to the separate native shadow pass, which Three shadow reception cannot supply to baked building materials. Implemented bounded projection/clipping of COL triangles with terrain heights, UVs and source face/light metadata preserved. Verified five geometric cases, an opt-in actual Lae2_landHUB04 receiver test, all 502/100 tests and build. This is a receiver stage only, not a visible game shadow: texture generation, candidate selection and native shadow blending remain to integrate. Evidence and concrete integration sequence are in `docs/research/PEDESTRIAN_SHADOWS.md`.

### Spatial shadow receiver selection and road winding

Connected bounded Rapier broad-phase selection and combined projection budgets to installed native scenes. Real Grove initially returned no output because the first projection stage rejected its downward-wound supporting road triangle. Accepting either COL winding and emitting upward faces now produces 24 vertices from 3 candidates/282 source triangles at spawn. Added actual-scene diagnostics, removal/disposal and budget tests. Verified 505/101 tests with local reference data, build and strengthened Grove browser audit. Texture generation and the separate shadow draw pass are still pending; no visible shadow is claimed yet.

### Projected shadow GPU pass

Implemented the separate inverse-color draw pass over clipped receiver geometry, with source triangle day/night attenuation, depth testing, no fog/depth write, and browser framebuffer-alpha preservation. Added reusable bounded uploads and explicit borrowed-texture lifecycle. Verified 507/102 tests with local references, build and GPU pixel cases including colored terrain and foreground occlusion. The pass remains standalone until animated silhouette generation and game submission are connected; this stage adds no visible Grove character shadow. Details: `docs/research/PEDESTRIAN_SHADOWS.md`.

### Animated character silhouette capture

Added an owned 128×128 intensity target that captures the existing animated skeleton without reparenting or advancing the character. Temporary materials, culling and renderer state restore even after an injected render failure, including pending shadow-map updates. Verified 509/103 tests with local references, build, silhouette GPU displacement/coverage/state recovery and the projected-shadow probe. Native camera placement, blur and connection to GameRenderer remain outstanding, so Grove Street still has no new character shadow.

### Native silhouette-camera framing

Implemented source square orthographic bounds, float32 near/far clips and radius-offset camera positioning while retaining caller-supplied orientation. Clears stale zoom/view offsets and rejects invalid or parented cameras. The animated silhouette GPU probe now uses these rules. Verified 512/104 tests with local references, build and GPU recovery/capture test. Entity sphere selection, native light orientation, blur and game submission remain unfinished; no new visible Grove shadow is claimed.

### Preserved native morph spheres

Found the importer discarded the source spheres needed to investigate stable shadow framing. Retained all morph-target spheres without changing geometry/culling and added invalid-radius diagnostics. Measured real FAM1 radius 0.9706013203 versus 0.0614373796 for the six-vertex player/cutscene skeleton placeholders; these cannot frame assembled CJ. Verified 515/105 tests with references, build and actual Grove character/import browser audit. Original entity sphere selection and game shadow integration remain unfinished.

### Native shadow light-frame orientation

Verified RenderWare rotation order and screen-left convention against pinned librw matrix/camera code. Implemented the original azimuth-only light frame and its Three camera conversion; the silhouette GPU fixture now checks the resulting mirrored horizontal motion and downward up vector. Verified 518/106 tests with references, build and GPU capture/recovery test. Real-time raster-to-terrain mapping, sphere selection, blur and game submission still need work; capture orientation alone is not a complete shadow projection.

### Native silhouette resampling and blur

Implemented the source 128→64 resample and paired bilinear blur with D3D9-to-WebGL pixel-center correction. Reuses two owned targets, prevents feedback, validates sampler/input bounds and restores rendering state. Connected it to the animated silhouette GPU fixture; movement and hidden-actor clearing survive filtering. Verified 520/107 tests with local references, build and two GPU tests. Terrain mapping, quality/intensity/gradient details and game submission remain pending; no visible Grove shadow is added yet.

### Native shadow intensity and camera-distance fade

Implemented the manager's ±3-per-update numerical fade and source distance attenuation from 7.5 to 15 units with both byte truncations preserved. Forwarded native timecycle shadow strength; real Grove reports 138. Verified 524/108 tests with references, build, GPU fade-to-receiver composition and strengthened Grove import audit. Allocation/keep-alive ownership, terrain mapping and game submission remain pending; these functions do not yet produce a visible game shadow.

### Final native shadow raster gradient

Added the source discrete row gradient and its half-texel-adjusted multiplication after blur, using the spare target without feedback. GPU tests verify exact row progression, composition with blurred masks and disabling the stage without retained darkening. Confirmed native manager configuration enables resampling, four blur iterations and gradient. Verified 524/108 tests with references, build and filter/silhouette GPU tests. Native edge calibration, terrain UV mapping and game ownership/submission remain unfinished.

### Related Vice City terrain projection candidate

Located a complete reversed cutscene-shadow projection in reVC and added its matrix as an explicitly separate candidate. It tilts the capture frame for terrain mapping and converts the result to framebuffer UV coordinates. Verified analytic footprint endpoints, translation/radius covariance and framing validation: 527 tests/109 files with references and build pass. This does not prove San Andreas uses the same mapping and does not enable a visible game shadow. Source provenance and remaining validation are recorded in `docs/research/PEDESTRIAN_SHADOWS.md`.

### Captured shadow projection on native road geometry

Added height-aware affine UV mapping to clipped receivers and fragment bounds handling to prevent stretched texture edges. Connected GPU skinning, capture, native filtering, candidate projection and inverse-color drawing in one diagnostic, including real Grove road COL geometry. Visual inspection corrected an unsuitable land-hub placement; the road probe verifies predicted movement, stable coverage and complete clearing. Verified 528 tests/109 files with references, build and three targeted browser tests. The controlled diagnostic actor is not a native character, and San Andreas mapping equivalence, projection-depth behavior and playable-scene integration remain pending.

### Actual FAM1 shadow framing audit

Added 192 GPU captures of actual FAM1 idle/walk/run poses across cardinal light directions, comparing stored and 10%-padded radius. Stored-radius framing clips 16 walking and 12 running samples; all 96 padded samples retain every vertex and leave border pixels empty. Actual walking animation now also passes through the complete diagnostic shadow chain, with changed silhouettes, full hidden clearing and exact repeatability. Verified build and four targeted browser tests. This validates a related-source framing candidate for sampled FAM1 poses, not general San Andreas sphere selection or playable-scene integration.

### Playable imported-character shadows

Connected the tested capture/filter/projection chain to GameRenderer and native collision queries. Native single-atomic characters with stored bounds and imported timecycle strength now cast animated shadows in playable Grove Street. The scene test confirms real pixel darkening, movement, hidden-pose clearing, replacement reset and resume fade-in. Query failures clear stale draws; owner teardown releases resources. Verified 530 tests/110 files, build and three targeted browser tests. Framing/projection remain related-source candidates; general clump spheres, native projection-depth behavior and broader performance/ordering calibration remain pending.

### Candidate triangle depth rejection

Added the related callback's whole-triangle rejection for negative projection depth and shared outside UV boundaries before footprint clipping. Preserved zero/crossing planes and the absence of a far-depth cutoff. Verified actual tilted-frame geometry, GPU pixel cases and the full Grove shadow lifecycle. The inspected Grove uploads fall to 36/45 vertices while retaining a real shadow contribution. All 533 tests/110 files, build and two targeted browser tests pass; San Andreas equivalence and remaining native receiver rules are still unresolved.

### Vertical shadow receivers

Removed the inherited horizontal-area restriction from affine shadow projection. Vertical walls now retain their actual geometry, clipped area, height-dependent UVs and native face lighting. Verified rotated-wall geometry, two-row GPU texture sampling and animated FAM1 projection onto a wall, including clearing and exact repeatability. All 534 tests/110 files, build, Grove lifecycle and targeted GPU/browser checks pass. Native facing/selection calibration remains unfinished.

### Native collision-normal shadow facing

Found San Andreas uses the reverse triangle cross product, resolving why Grove roads appeared downward-wound under render conventions. Added source-space float32 normalization and signed 1/4096 normal storage, then world-space facing selection for native affine receiver queries. Tests cover rotation, quantization and GPU rejection of a reversed wall while retaining Grove's road shadow. All 537 tests/111 files, build, Grove lifecycle and focused GPU checks pass. Exact SA projection/rotated-receiver equivalence and remaining receiver rules are still unverified.

### Ordinary exterior alpha and depth

Investigating speckled foliage exposed an independent mismatch: ordinary imported alpha materials lacked native exterior reference 140 and depth writes. Added the scoped playable placement policy, strict GREATER comparison, sorted reference 100/0 behavior and safe zero-alpha fading. GPU tests verify exact byte boundaries, blending, occlusion, no-write flags and source-material restoration; existing building dual-pass and Grove checks pass. All 537 tests/111 files and build pass. Foliage sampler uncertainty remains; source texture filtering is preserved.

### Full rendering regression baseline

Ran all browser tests with local native references after the rendering changes: 70 passed, no failures/skips, in 2.8 minutes. Production build/smoke also passed with no runtime errors, no external runtime requests and no development hooks. Verified timed LOD transitions, graphics recovery, native asset/character flows and the new alpha/shadow paths. Recorded environment, commands, coverage and explicit fidelity limits in `docs/research/RENDERING_REGRESSION.md`; this is a regression baseline, not full-game or retail-parity approval.

### Stable shadow projection across sunlight changes

A Grove regression caught a valid affine camera inverse whose homogeneous W rounded to 0.9999999999999999. Canonicalized the generated mapping's affine row while preserving strict receiver validation. A regression test reproduces the failure before the fix and verifies all 1,440 minute samples afterward. Grove movement, shadow clearing/replacement and pixel checks pass.

### Source-backed perspective shadow bias

Verified San Andreas renders fading entities before stored shadows and temporarily adjusts the near clip during the shadow pass. Replaced guessed polygon offset for ordinary perspective draws with the source float32 adjustment in a private projection uniform. GPU depth measurements verify the effect, repeatability and preservation of the borrowed camera/view offsets. All 540 tests/112 files, build and three targeted browser tests pass. Nonstandard/orthographic cameras retain the diagnostic fallback; original depth precision and complete render ordering remain uncalibrated.

### Root-bone shadow distance

Corrected native character shadow distance attenuation to use the posed HAnim root bone, matching StoreRealTimeShadow, with entity-position fallback when missing. Capture sphere framing remains separate. Verified transformed pose coordinates and the 7.5/11.25/15-unit strength boundaries independently of sphere offset and camera height. All 542 tests/112 files, build and Grove lifecycle/pixel checks pass. Complete manager eligibility/fade-out behavior remains unfinished.

### Native player transparency and depth

Applied the source player alpha reference 1 with strict GREATER comparison and ordinary depth writes to controlled native pedestrian materials. Generic imports retain their existing policy. GPU checks verify transparent holes, blended surviving fragments and occlusion for basic/native-lit shaders; unit coverage verifies convention scope and opacity. All 543 tests/112 files, build and two browser tests pass. Grove screenshot inspected; PS2 skin pipeline parity and foliage filtering remain unresolved.

### Foliage sampler provenance audit

Added a reproducible read-only IMG sampler audit and saved its metadata report. All 2,750 dictionaries/25,995 textures lack anisotropy extension overrides. Grove tree DFF references request linear filtering while their TXD stores nearest with one mip; identically named leaves elsewhere use other filters. Verified pinned librw reference-count behavior that preserves dictionary samplers. This narrows the next fidelity investigation to original texture-read semantics/reference capture; no speculative runtime override was made.

### Inactive HUD decorations

Removed the permanently drawn empty armor bar and six decorative wanted-star outlines. Neither was backed by simulation state. The pinned [CHud::RenderArmorBar](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Hud.cpp#L1602) explicitly skips armor at values <=1; the source file was fetched and byte-compared. Wanted rendering remains an undecoded source trampoline, so no full wanted algorithm is claimed. Actual armor/wanted gameplay and active indicators remain required future work. Removed their unused CSS. Build, ordinary movement/jump/pause/save smoke and native Grove lifecycle pass; inspected the resulting Grove screenshot. Logs `/tmp/web-gta-hud-empty-{build,browser}.log`.

### Reuse stable paused shadow rasters

Stopped repeating silhouette/filter GPU passes during unchanged paused frames. Cache validity includes actor identity, sampled pose/blend revision and capture transforms; draw geometry and strength continue updating. Replacement and graphics-context recovery invalidate the raster. Real Grove checks verify unchanged capture counts while paused, retained pixel darkening, successful recapture after forced context loss, and resumed captures. All 543 tests/112 files, build and the expanded browser lifecycle pass. Active-frame capture and receiver-query optimization remain open.

### Placement installation rollback

Fixed a resource leak when a placement transform or cloning/bounds operation throws after the source model and earlier instances have been created. The placement owner now catches those failures and disposes every cloned skeleton plus its source resources. Normal disposal is idempotent and detaches the placed root. Regression tests deliberately fail the second placement: both fail against the previous implementation and pass after the change. They verify three distinct skeleton disposals, shared-texture reference release without destroying another owner, and successful subsequent installation/disposal. All 545 tests/113 files, build, model-clump browser checks and the expanded Grove lifecycle pass. Logs `/tmp/web-gta-placement-owner-{before,unit,build,browser}.log`. This covers failures after modelObject returns; failures inside source-model construction remain a separate audit boundary.

### Source-model construction rollback

Extended native model ownership to track texture acquisitions, geometries and materials immediately, before their enclosing map/array construction completes. Exceptions during source construction now release partial allocations and any created skeletons. Three failure-injection tests cover a later texture allocation, incomplete geometry and failed skinned-atomic attachment; all three fail against the previous implementation and pass after the fix. Shared texture owners survive, and a subsequent valid model can be created/disposed normally. All 548 tests/114 files, build and the final three targeted browser checks pass. Logs `/tmp/web-gta-model-rollback-{before,unit,final-build,final-browser}.log`.

The initial combined browser run failed when Grove's character did not reappear after standing from crouch. An isolated rerun and the final combined rerun pass, so the intermittent failure is not resolved. Added `/tmp/web-gta-grove-stand-failure.json` state capture on recurrence without changing the expected behavior. Initial failure log: `/tmp/web-gta-model-rollback-browser.log`; isolated rerun: `/tmp/web-gta-model-rollback-grove-retry.log`.

### Crouch recovery test diagnosis

Reproduced the intermittent original Grove check twice in eight runs. Captured state shows a running game with a still-crouched player and no shadow error. Updated the test to verify stance acceptance and ground contact separately from native character/shadow visibility, and retain pre-stand state on failure. Eight revised runs and build pass. Runtime behavior is unchanged; the exact rejected/missed-input cause remains unproven. Detailed evidence and observation-timing limits are recorded in `docs/research/CROUCH_RECOVERY.md`.

### Synchronize player collision after stance changes and teleports

Found Rapier body teleports leave the query collider at its previous pose until physics propagation, while our movement sweep runs before that step. Synchronized collider positions during stance changes, resets, save restores and vehicle-to-foot placement; reset now clears stale ground contact. Three before/after regression cases verify immediate query alignment, ten grounded stance cycles, and safe elevated save restoration. All 551 tests/114 files and build pass. Four current Grove runs and eight runs of the original unguarded Grove test pass. Detailed stale-pose measurements and limits are in `docs/research/CROUCH_RECOVERY.md`.

The real-controls vehicle entry/driving/braking/exit browser check also passes (`/tmp/web-gta-player-collider-vehicle.log`), covering the synchronized vehicle-to-foot placement path.

### Full regression after rendering and collider fixes

Verified `58c957c` with all 72 browser tests passing, no failures/skips, in 2.8 minutes. Production smoke also passes with no errors, no development hooks and no off-origin runtime requests. Inspected the production screenshot and recorded the fresh environment/report in `docs/research/RENDERING_REGRESSION.md`. This verifies the covered combined behavior; full-game and original-platform fidelity remain incomplete.

### Vehicle collider pose synchronization

Applied Rapier's native `propagateModifiedBodyPositionsToColliders()` after save vehicle restoration, traffic reset and offscreen traffic repositioning. It updates each compound collider's world pose while preserving local offsets and rotations. A new regression case restores a rotated car at a distant position, checks direct shape intersection and offset geometry, verifies local attachments remain unchanged, and checks reset traffic poses; it fails against the previous code and passes after the change. All 552 tests/114 files, build and three browser checks (driving/exit, save import/reload, traffic/pause) pass. Logs `/tmp/web-gta-vehicle-sync-{before,unit,build,browser}.log`.

Important scope: this native propagation updates collider transforms but does not refresh Rapier's world spatial index until the normal physics step. A probe using world.intersectionWithShape at the newly restored car missed it before that step, while direct collider.intersectsShape uses the corrected pose. World-query refresh after teleports remains a separate issue; no immediate broad-phase correctness is claimed. No extra simulation step or custom quaternion-transform implementation was introduced.

### Resident query origins after reset

Population reset now propagates restored body poses to their attached colliders before the next character movement query. A regression first moves a resident far above the world, resets the population, verifies immediate collider alignment and checks a downward sweep stops at the sidewalk. It fails before the fix and passes afterward. This corrects the moving capsule's query origin; the separate broad-phase refresh limitation above remains open.

All 553 tests/114 files pass with `GTA_REFERENCE_DIR=/tmp/web-gta-noclip-world`; the initial default run passed 551 tests and skipped the two optional native-reference cases. Build and browser save-import/reload and crowd-movement/pause checks pass (2 tests, 9.6 seconds). Logs: `/tmp/web-gta-population-sync-{before,focused,unit,unit-reference,build,browser}.log`.

### Camera obstruction after restoring moving bodies

Confirmed the camera boom returned its full ten-unit distance through a restored car before the next physics step. Camera obstruction now queries fixed scenery through Rapier's spatial index and non-fixed bodies through direct collider shape casts, retaining the nearest hit and excluding the player's collider, occupied/transition vehicle, and disabled bodies/colliders. It covers both vehicle compound shapes and pedestrian capsules. Native pose propagation at reset/restore remains required; the camera does not advance physics or update transforms itself.

Regression cases cover the previously missed restored car, elevated cabin-only obstruction, occupied/disabled car exclusion, a relocated pedestrian and closest-hit selection. Existing scenery obstruction tests pass. All 555 tests/114 files with native references and build pass. This is a camera correction, not a global Rapier query refresh: door-clearance, standing-clearance, traffic casts and character-controller queries still require an audit of moved target bodies before the first physics step. Direct actor casts scale with the number of resident non-fixed colliders; a streamed full-world population will need to preserve this correctness within its active simulation budget.

Four browser checks pass (26.1 seconds): driving/exit, save import/reload, crowd movement/pause and camera distance controls/reload. Logs: `/tmp/web-gta-camera-query-{before,focused,unit,build,browser}.log`.

### Standing and vehicle-door clearance after actor relocation

Reproduced two additional stale-index errors: a crouched save restored beneath a car allowed standing into its body, and a resident relocated into the driver doorway did not block entry before physics. Standing and both door clearance volumes now share an overlap query that uses indexed fixed scenery and direct current shapes for non-fixed bodies. It preserves player/selected-vehicle exclusions and ignores disabled actors and colliders. No physics time is advanced by the query.

Both regression cases fail before the fix and pass afterward, including successful standing/entry after disabling the obstruction. All 557 tests/114 files with native references and build pass. Traffic sweeps, suspension and character-controller queries are not changed by this patch; the remaining global query timing problem is not declared solved. Logs: `/tmp/web-gta-clearance-{before,focused,unit,build,browser}.log`.

Three browser checks pass (19.3 seconds): real-control driving/entry/exit, save import/reload and crouch persistence through save/reload.

### Traffic braking uses current actor positions

Confirmed traffic returned zero brake for a pedestrian relocated immediately ahead of its bumper before the next physics step. Extracted the camera's fixed-scenery/current-actor shape sweep into `src/simulation/currentShapeCast.ts` and applied it to traffic clearance. The helper preserves compound colliders, disabled/excluded actor handling, nearest time of impact and the original stationary-target sweep semantics. Traffic braking distances and control tuning are unchanged.

The regression fails before the fix, then verifies braking with the relocated resident and resumption when its collider is disabled. Existing three-minute traffic recycling, pedestrian avoidance and camera/scenery obstruction tests pass. All 558 tests/114 files with native references and build pass. Logs: `/tmp/web-gta-traffic-query-{before,focused,unit,build,browser}.log`.

Remaining query scope: Rapier's internal vehicle suspension rays (`updateVehicle`) and player/resident character-controller sweeps still run before `world.step`; their target actor broad-phase entries can lag a teleport. These APIs do not use the new helper. Solving that requires preserving controller behavior and physics timing, not merely adding an extra simulation step. Fixed scenery must also be indexed before querying newly created geometry. Full-world population scaling and original traffic AI remain unfinished.

Four browser checks pass (27.7 seconds): driving/exit, camera controls/reload, traffic movement/pause and pedestrian traffic impact/recovery.

### Native sky source contract

Re-fetched pinned `Clouds.cpp` and verified it matches the research copy by SHA-256. Its five camera-yaw-aligned sky quads differ from the current radial smoothstep sphere: source dimensions define separate upper, horizon and lower bands, plus caps. Traced below-horizon gray to the native time samples, underwater blending and altitude/foggyness blend. Recorded dimensions, data-interface gaps, color interpolation uncertainty, sun-fallback integration requirements and GPU/reference acceptance cases in [SKY.md](research/SKY.md). No sky runtime change or retail parity is claimed by this research.

The combined runtime at `b631fff` passes all 72 browser tests and production smoke. Inspected the production screenshot and recorded the fresh report/environment in `docs/research/RENDERING_REGRESSION.md`. No runtime changes occurred during verification.

### Source sky bands integrated

Imported timecycles now activate a five-quad camera-yaw-aligned sky shell with the source upper, horizon and lower bands and caps. Retained raw byte channels prevent linear-color interpolation from changing intermediate source colors. The below-horizon function handles native day-gray samples, altitude and explicit atmospheric factors; foggyness/underwaterness currently remain dry defaults until weather simulation supplies them. Shared procedural sun code preserves the existing fallback, and clearing imported lighting restores the authored sphere.

All 561 tests/115 files with native references, build, five distinct targeted browser checks and production smoke pass. GPU checks cover planar interpolation, caps, foreground occlusion, camera position/yaw, short clips, sun contribution, activation/restoration and disposal. The native Grove test passes; its screenshot was inspected. [Sky research](research/SKY.md) records the implemented policy and limits, including unverified retail color matching, numeric edge behavior, dynamic weather and missing clouds/moon. This is a visible native-background improvement, not a claim of complete atmospheric or original-platform parity.

### Static sky weather factors from Euryopa

The pinned San Andreas weather update is still delegated to the executable. Inspected and pinned Euryopa's SA weather flags and interpolation instead, and explicitly labeled the resulting adapter as a viewer approximation. Static foggy-SF and sandstorm selections now blend the lower sky toward sky-bottom color; other rows retain the altitude/day-gray behavior. No weather scheduling, regional fog or underwater detection is inferred. [Weather research](research/WEATHER.md) records source hashes, the original-source gap and remaining work.

All 563 tests/116 files with native references, build and three browser checks pass. GPU integration verifies the lower sky changes and restores when the weather factor changes; the real lighting-picker regression passes. Logs: `/tmp/web-gta-weather-{focused,unit,build,browser}.log`.
