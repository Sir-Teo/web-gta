# Native collision data

`src/assets/col.ts` reads bounded COL2/COL3 model collections. This is the source-data foundation for imported collision; the workshop now displays optional local collision collections as overlays. It is not yet installed into the gameplay scene. A tested Rapier adapter is available.

## Evidence and independent fixtures

[DragonFF's collision reader/writer](https://github.com/Parik27/DragonFF/blob/5a7c2f18d6ff9ac4e3424d552cfe404c931d039d/gtaLib/col.py) describes the collection headers, sphere/box/surface layouts, signed vertex coordinates scaled by 1/128, face groups and separate shadow mesh. [gta-reversed FileLoader collision routines](https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/FileLoader.cpp) independently confirm offset adjustment relative to the four-byte signature and separate collision/shadow arrays. Sources inspected September 13, 2026.

Two original diagnostic files were exported with the pinned DragonFF revision. Each contains one sphere, one box, a two-triangle plane and a face group. COL3 additionally has one shadow triangle above the plane. Their surface/material/light bytes intentionally differ. The generator is `scripts/generate-collision-reference.py`; no retail game shapes or exporter code are bundled.

## Preserved data and validation

The reader retains model names/IDs, version, source flags, bounding box/sphere, individual volume surfaces, compressed mesh coordinates, triangle index order, material/light bytes, face groups and separate shadow triangles. Shadow triangles are not conflated with physical collision. Face-referenced vertex ranges are inferred from the maximum index because these formats do not store a collision vertex count.

COL model size excludes the eight-byte signature/size prefix; payload offsets are relative to the signature's end. Each nonempty interpreted region is checked against the model boundary and all previously read regions. Multiple models may share a file, with trailing zero IMG padding accepted. Duplicate model names are rejected case insensitively.

Limits: 64 MiB source, 4,096 models, one million decoded vertices, two million triangles and 200,000 sphere/box volumes per collection. Coordinates/radii must be finite and within the importer coordinate limit. Inverted bounds, negative radii, truncated data, overlapping regions and invalid face-group ranges fail explicitly. These are importer limits, not a measured original collision budget.

COLL/COL1, COL4, headless embedded collision and suspension lines/disks are not supported. Nonzero line counts fail; unused line/triangle-plane offsets produce a notice. Runtime triangle planes can be derived later. Unreferenced trailing vertices and unrelated payload bytes are not retained. Material/light bytes are preserved without assigning new friction or lighting semantics.

## Verification and next work

Four unit cases verify independent COL2 shapes/surfaces/groups, COL3 shadow separation, multiple models and padding, plus malformed ranges, overlap, invalid geometry, unsupported data and duplicate names. The complete unit suite passes with these fixtures. No original installation file has yet been verified through this reader. The independent diagnostic collision overlay has been inspected. Rapier contacts with the independent diagnostic shapes are now tested.

Next: broader association/import coverage and installation into a gameplay scene. Suspension handling, surface-driven effects and original-game comparisons remain separate fidelity work.


## Fixed Rapier adapter

`installNativeCollision` creates one fixed rigid body per imported object, with source spheres, cuboids and a triangle mesh attached in native local coordinates. The body's transform uses the same IPL inverse quaternion and Z-up conversion as the visual placement adapter. Enclosing bounds and shadow triangles are not colliders. [Rapier's collider documentation](https://rapier.rs/docs/user_guides/javascript/colliders/) supports these shapes and body-relative offsets; the installed 0.20 package and real simulation tests validate this adapter's usage.

Collider handles map back to source volume surfaces or the mesh's original per-triangle material/light arrays. IDs are retained as metadata; they are not interpreted as friction coefficients. The adapter currently uses Rapier defaults for friction, restitution, filtering and mesh processing. Original surface response, internal-edge behavior and dynamic imported objects remain work.

Construction failures remove the partially built body. Disposal removes its colliders and metadata and is safe to call twice. Three simulation cases verify separate sphere/box/mesh ray hits, a rotated vertical plane and normal, a falling ball resting at the physical plane's height despite an elevated shadow triangle, and removal followed by the ball falling through the former floor. The tests use an independently exported diagnostic COL3. They establish geometric physics integration, not original-game movement or surface-response parity.


## Collision overlays

The model preview accepts a separate local COL collection. Matching is by DFF/model basename without case sensitivity; absent names produce notices. Scene assembly reads the collection once and attaches each matching collision model to its instances. Green lines depict spheres, boxes and physical mesh edges; shadow triangles are excluded. The overlay has no DFF frame hierarchy applied to it: both visual and physical source data receive the IPL placement above their own local data.

Visibility can be toggled without rebuilding resources. Camera framing includes visible collision bounds. Repeated instances share overlay geometry, and clearing/replacing the preview disposes it once. Removing collision from a scene preserves scene mode. The whole preview caps its conservative line estimate at two million; sphere display uses a low-resolution wireframe while physics retains analytic spheres. The green color and depth-independent display are inspection choices, not game rendering.

A unit case checks placed sphere centers, shared repeated geometry, shadow exclusion and disposal. A browser scenario verifies visible lines, unchanged visual triangle count, hide/show and geometry cleanup. Its capture was inspected: the independent DFF and COL fixtures have different authored offsets, which are retained rather than fitted together. This is source-transform and overlay verification, not evidence of retail-model alignment. Per-model surface inspection and gameplay integration remain work.


## Archived collision collections

COL entries in the selected IMG are now searchable in the collision panel. Selecting one supplies collision models to both single-model loading and scene assembly; only the selected entry is read, under the IMG reader's bounds/packing/size checks. A separate COL file takes precedence, including when the archived choice is malformed. Metadata identifies the collision source actually used.

Removing collision clears both source choices and preserves assembled-scene mode. Archive replacement or clearing discards the archived COL selection. The picker shares its bounded search implementation with the archived IPL picker. Multiple COL collections and automatic collection discovery are not yet supported.

One unit case verifies archive collection parsing and external override precedence. A browser scenario selects a collection, assembles a placed overlay, checks its source label, recovers from a malformed collection using an external override, and removes/clears it. The whole model-browser suite and production smoke check pass; retail collections remain unverified.


## Owned scene installation

`installNativeScene` assembles the reusable model objects and fixed native colliders into one owned runtime unit. Shared textures and repeated geometry retain their existing ownership rules. The visual root is attached only after every object is built. Failure removes any previously created bodies and releases visual resources; disposal leaves unrelated scene/world objects intact. Collision handles retain model name, IPL placement and source surface/mesh metadata. Day/night vertex-color updates apply across installed visuals.

The destination Three.js scene must have an identity world transform so it agrees with Rapier world coordinates. Missing COL data fails by default; an explicit `allowMissingCollision` option supports intentional visual-only instances and returns their names. Neither policy infers original model collision flags. Limits cover 256 model types, 4,096 placements, 20,000 colliders, two million physical triangles, one million physical vertices, two million visual triangles and 100,000 visual hierarchy nodes.

Three runtime unit cases verify installed visuals and collision queries, retained source metadata, shared repeated geometry, day/night updates, complete owned cleanup while preserving unrelated objects, rollback after a later placement fails, missing-COL policy, excessive placement rejection and transformed-root rejection. Pure model construction now lives in `ModelObjects.ts`, independent of preview camera controls. The model workshop now exposes this installer through **Walk scene** for fully resolved scenes with collision. No original district has been validated. Persistent imported-scene saves, source streaming, LOD and source-specific surface responses remain unfinished.


## Walking imported scenes

The workshop passes assembled content to a temporary same-origin game window over a named BroadcastChannel. Original file bytes are not uploaded. This mode omits authored terrain, vehicles and pedestrians, installs imported visuals and fixed collision together, and searches bounded samples of collision bounds for an upright surface with clear capsule space. Missing support fails explicitly. The selected spawn is reused for player recovery; saving and the authored geographic HUD are hidden.

Static mesh orientation is baked into collider-local vertices before float32 physics conversion, while the fixed body retains placement translation. Sphere offsets and box offsets/orientations use the equivalent transform. The first deterministic walk exposed intermittent lost movement when a native Z-up floor was instead rotated as a whole rigid body. Baking its orientation restores the normal walking-distance check without changing controller speed or collision tolerances. Source surface and triangle metadata remain attached to collider handles.

The independently exported matching floor verifies the full IMG/IPL/COL-to-game path at an offset location. Unit checks cover walking, support, respawn and explicit failure on an unsupported vertical surface. Browser checks use real keyboard input, verify continued support, and inspect the temporary-mode HUD. This is a test environment using authored player animation, lighting and audio; it does not yet reproduce original gameplay or original materials completely.
