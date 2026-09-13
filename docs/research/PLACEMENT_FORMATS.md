# IPL placement reader

The asset pipeline now reads San Andreas text `inst` records and binary `bnry` instance records. The local model preview accepts a separate IPL file and displays matching placements of the selected model. It does not yet assemble a complete district.

## Evidence

- [FileLoader::LoadObjectInstance](https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/FileLoader.cpp) supplies the eleven text fields and negates the quaternion imaginary component when constructing a matrix. Its heading-only path uses the corresponding inverse rotation.
- [FileObjectInstance](https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/FileObjectInstance.h) specifies the 40-byte instance layout: position, quaternion, model ID, instance flags and LOD index. Interior is the low eight bits of instance flags; the complete word must be retained.
- [tBinaryIplFile](https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/tBinaryIplFile.h) specifies the 76-byte header and instance offset at byte 28.
- [IplStore](https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/IplStore.cpp) resolves streamed LOD indices against a separately selected static instance array. The reader therefore retains nonnegative LOD indices without assuming they index the current file.
- [DragonFF map reader](https://github.com/Parik27/DragonFF/blob/master/gtaLib/map.py) independently uses the same instance offset and forty-byte record layout.

Sources inspected September 13, 2026. These are implementation references; no retail map data or original-game placement capture was verified.

## Supported behavior

Text input accepts comma/whitespace separators, hash comments and CRLF. It retains model names; binary records contain IDs without names. Source positions and quaternion values are preserved. The rendering adapter conjugates and normalizes the quaternion, applies native translation, then converts Z-up to Y-up once. It does not mirror geometry or alter scale. `modelObject` optionally composes this placement above the retained DFF frame hierarchy.

The reader limits source files to 64 MiB and 200,000 instances. It rejects incomplete binary headers/instance ranges, invalid IDs/flags/LOD fields, nonfinite or extreme coordinates, near-zero/non-unit quaternions and malformed text records. Accepted quaternion length tolerance is 0.01; this is an importer policy. Unrelated sections produce notices and are not interpreted. Binary instance count and offset define the consumed range; the header size fields and unrelated section payloads are not used or validated.

## Verification and remaining work

Five unit cases cover matching text/binary diagnostic records, retained flags and external LOD references, quarter-turn orientation on multiple axes, unit scale/handedness, malformed/truncated data, skipped-section notices and placement composed with the independently exported DFF's nested frames. The composed diagnostic top lands at the explicitly calculated runtime coordinate. Existing model browser scenarios verify that the optional adapter does not change unplaced previews.

Next work includes multi-model assembly, IPL selection inside archives, explicit LOD-array ownership, collision import and streaming. Full original clump-root behavior, special object transforms and small-angle heading optimizations still need comparison with source assets and captures. No gameplay scene is replaced by this reader yet.


## Placement preview

Choose a DFF directly or from an IMG, optionally load IDE definitions and textures, then choose a separate IPL file and press **Apply placements**. Text instances match the selected model basename without case sensitivity; binary instances use the selected model's IDE ID and require that definition. Interior selection is explicit, defaulting to exterior 0. No-match and missing-ID cases report an error. **Remove placements** restores the unplaced model; **Clear / cancel** also clears the IPL selection.

Repeated placements clone object hierarchies while sharing geometry, materials, native mip textures and day/night vertex-color buffers. Resources are disposed once through their common owner. The preview fits all displayed instances and records source positions, quaternions, interior flags and unresolved LOD references in metadata. Placement limits are 4,096 instances, two million submitted triangles and 100,000 hierarchy nodes. These are bounded preview policies, not production district-streaming budgets. No LOD switching occurs.

Two added unit cases cover model/interior selection, binary ID requirements, shared mesh resources, one-time disposal and excessive placement rejection. Two browser cases verify repeated placement coordinates, unchanged geometry counts, interior filtering, no-match recovery, restoration to the unplaced model, and binary IPL resolution through IDE data. A captured pair of diagnostic models was visually inspected. Original district assembly and retail pixel comparison remain unverified.
