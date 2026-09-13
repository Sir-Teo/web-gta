# IPL placement reader

The asset pipeline now reads San Andreas text `inst` records and binary `bnry` instance records. This is a reader and reusable model-assembly adapter; the current UI does not yet load IPL files or assemble a district.

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

Next work includes local IPL selection, ID-to-model resolution, multi-model assembly, explicit LOD-array ownership, interior filtering, collision import and streaming. Full original clump-root behavior, special object transforms and small-angle heading optimizations still need comparison with source assets and captures. No gameplay scene is replaced by this reader yet.
