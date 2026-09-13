# Native collision data

`src/assets/col.ts` reads bounded COL2/COL3 model collections. This is the source-data foundation for imported collision; it is not yet exposed in the workshop or installed into the gameplay scene. A tested Rapier adapter is available.

## Evidence and independent fixtures

[DragonFF's collision reader/writer](https://github.com/Parik27/DragonFF/blob/5a7c2f18d6ff9ac4e3424d552cfe404c931d039d/gtaLib/col.py) describes the collection headers, sphere/box/surface layouts, signed vertex coordinates scaled by 1/128, face groups and separate shadow mesh. [gta-reversed FileLoader collision routines](https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/FileLoader.cpp) independently confirm offset adjustment relative to the four-byte signature and separate collision/shadow arrays. Sources inspected September 13, 2026.

Two original diagnostic files were exported with the pinned DragonFF revision. Each contains one sphere, one box, a two-triangle plane and a face group. COL3 additionally has one shadow triangle above the plane. Their surface/material/light bytes intentionally differ. The generator is `scripts/generate-collision-reference.py`; no retail game shapes or exporter code are bundled.

## Preserved data and validation

The reader retains model names/IDs, version, source flags, bounding box/sphere, individual volume surfaces, compressed mesh coordinates, triangle index order, material/light bytes, face groups and separate shadow triangles. Shadow triangles are not conflated with physical collision. Face-referenced vertex ranges are inferred from the maximum index because these formats do not store a collision vertex count.

COL model size excludes the eight-byte signature/size prefix; payload offsets are relative to the signature's end. Each nonempty interpreted region is checked against the model boundary and all previously read regions. Multiple models may share a file, with trailing zero IMG padding accepted. Duplicate model names are rejected case insensitively.

Limits: 64 MiB source, 4,096 models, one million decoded vertices, two million triangles and 200,000 sphere/box volumes per collection. Coordinates/radii must be finite and within the importer coordinate limit. Inverted bounds, negative radii, truncated data, overlapping regions and invalid face-group ranges fail explicitly. These are importer limits, not a measured original collision budget.

COLL/COL1, COL4, headless embedded collision and suspension lines/disks are not supported. Nonzero line counts fail; unused line/triangle-plane offsets produce a notice. Runtime triangle planes can be derived later. Unreferenced trailing vertices and unrelated payload bytes are not retained. Material/light bytes are preserved without assigning new friction or lighting semantics.

## Verification and next work

Four unit cases verify independent COL2 shapes/surfaces/groups, COL3 shadow separation, multiple models and padding, plus malformed ranges, overlap, invalid geometry, unsupported data and duplicate names. The complete unit suite passes with these fixtures. No original installation file or visual collision overlay has yet been verified through this reader. Rapier contacts with the independent diagnostic shapes are now tested.

Next: local COL selection, overlays aligned with DFF/IPL transforms, source-model association and installation into a gameplay scene. Suspension handling, surface-driven effects and original-game comparisons remain separate fidelity work.


## Fixed Rapier adapter

`installNativeCollision` creates one fixed rigid body per imported object, with source spheres, cuboids and a triangle mesh attached in native local coordinates. The body's transform uses the same IPL inverse quaternion and Z-up conversion as the visual placement adapter. Enclosing bounds and shadow triangles are not colliders. [Rapier's collider documentation](https://rapier.rs/docs/user_guides/javascript/colliders/) supports these shapes and body-relative offsets; the installed 0.20 package and real simulation tests validate this adapter's usage.

Collider handles map back to source volume surfaces or the mesh's original per-triangle material/light arrays. IDs are retained as metadata; they are not interpreted as friction coefficients. The adapter currently uses Rapier defaults for friction, restitution, filtering and mesh processing. Original surface response, internal-edge behavior and dynamic imported objects remain work.

Construction failures remove the partially built body. Disposal removes its colliders and metadata and is safe to call twice. Three simulation cases verify separate sphere/box/mesh ray hits, a rotated vertical plane and normal, a falling ball resting at the physical plane's height despite an elevated shadow triangle, and removal followed by the ball falling through the former floor. The tests use an independently exported diagnostic COL3. They establish geometric physics integration, not original-game movement or surface-response parity.
