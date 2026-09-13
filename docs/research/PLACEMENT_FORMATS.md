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

Next work includes explicit LOD-array ownership, collision import and streaming. Full original clump-root behavior, special object transforms and small-angle heading optimizations still need comparison with source assets and captures. No gameplay scene is replaced by this reader yet.


## Placement preview

Choose a DFF directly or from an IMG, optionally load IDE definitions and textures, then choose a separate IPL file and press **Apply placements**. Text instances match the selected model basename without case sensitivity; binary instances use the selected model's IDE ID and require that definition. Interior selection is explicit, defaulting to exterior 0. No-match and missing-ID cases report an error. **Remove placements** restores the unplaced model; **Clear / cancel** also clears the IPL selection.

Repeated placements clone object hierarchies while sharing geometry, materials, native mip textures and day/night vertex-color buffers. Resources are disposed once through their common owner. The preview fits all displayed instances and records source positions, quaternions, interior flags and unresolved LOD references in metadata. Placement limits are 4,096 instances, two million submitted triangles and 100,000 hierarchy nodes. These are bounded preview policies, not production district-streaming budgets. No LOD switching occurs.

Two added unit cases cover model/interior selection, binary ID requirements, shared mesh resources, one-time disposal and excessive placement rejection. Two browser cases verify repeated placement coordinates, unchanged geometry counts, interior filtering, no-match recovery, restoration to the unplaced model, and binary IPL resolution through IDE data. A captured pair of diagnostic models was visually inspected. Original district fidelity and retail pixel comparison remain unverified.


## Multiple model types

**Assemble archive scene** loads all resolvable model types for the selected IPL interior from one IMG archive. Text names resolve directly; binary model IDs use IDE definitions. Repeated models are grouped and share their own GPU geometry/materials. Each model uses its IDE dictionary or a same-basename fallback and follows loaded texture-parent links. Single-model dictionary overrides are not applied to whole-scene assembly.

Missing model files and missing binary ID definitions are counted as omitted placements; missing dictionaries and unbound texture names are listed. Unsupported or malformed model payloads fail assembly instead of silently treating them as absent. Ambiguous IDE IDs fail explicitly. Clear/replacement terminate the scene worker, and completed geometry/pixel buffers are transferred to the renderer. Reassembly releases all previous model owners.

Scene limits are 4,096 interior placements, 256 model types, two million submitted triangles, 100,000 hierarchy nodes and 128 MiB retained geometry/pixel arrays. Source reading and per-model decoding retain their existing limits; these totals do not bound browser overhead or transient decoder memory. A scene-local cache now shares dictionary parsing, decoded raster objects and GPU textures across model types that resolve to the same source raster.

Two scene unit cases verify grouped repeated models, IDE dictionary binding, omitted placement counts, missing-texture notices, ambiguous IDs and empty interiors. A browser scenario assembles two model types with three instances, verifies world framing and submitted triangles, repeats assembly with stable GPU resource counts, and clears all geometry. Its capture was visually inspected. The production smoke check assembles two diagnostic placements and verifies visible framebuffer pixels using the emitted worker. None of these diagnostic checks establishes full original-map compatibility, automatic LOD ownership, collision or gameplay installation.


## Shared scene textures

Within one scene load, archive dictionary reads are cached by entry offset in the selected file. The source-byte cache evicts oldest entries above 64 MiB; eviction may cause later rereading/redecoding but does not prevent assembling a scene with more distinct source dictionaries. Native dictionary parsing and decoded textures use weak identity caches. Parent fallback reuses the resolved parent raster; child overrides retain distinct identity. Equal texture names from unrelated dictionaries are never sufficient for sharing.

Scene memory accounting counts shared decoded pixel buffers once. Transfer lists deduplicate shared buffers, and the renderer reference-counts GPU textures by the resulting shared raster object. Each model retains separate materials and geometry. Releasing one model leaves shared textures live for the others; releasing the last owner disposes the GPU texture once. Model disposal is idempotent.

The diagnostic scene browser case now uses two model types and three placements referencing one TXD and verifies exactly one loaded GPU texture, unchanged resource counts after reassembly and complete geometry cleanup. Unit checks verify shared decoded identity, independent same-name sources, inherited raster reuse and last-owner GPU disposal. These are resource-count/ownership checks, not full browser heap measurements or district frame-rate benchmarks. Source-cache eviction and transient decoder allocations can reduce sharing and increase peak memory; persistent streaming caches remain unfinished.


## Archived IPL selection

The placement panel now lists searchable IPL entries from the selected IMG, with up to 200 matches. An archived entry can drive both the selected model's placement preview and complete archive-scene assembly. Only its payload slice is read, under the existing IMG bounds, packing and 64 MiB limits. Separate IPL files take precedence over archive selection; preview metadata identifies the source actually used.

Trailing zero sector padding is removed from text IPL input before section parsing. Binary instances continue to use their declared offsets/counts. Removing placements clears both choices, and switching or clearing the archive discards its placement selection. Files remain local and are not persisted or uploaded.

A unit case verifies padded archived text parsing, source labels and external-file precedence. A browser scenario searches/selects an archived IPL, assembles its scene, reports a malformed entry, overrides it with a separate file, removes placements and clears the archive. Binary IPL parsing and IDE ID resolution retain their existing unit/browser coverage; this new scenario uses an authored text fixture. Simultaneous base and streamed IPL sources and explicit cross-file LOD mapping remain unfinished.


## Preserved visibility metadata and LOD identity

Scene parts now retain their unfiltered source placement indices, text/binary format and resolved IDE definition. Grouping repeated models and filtering interiors do not renumber those indices. The worker reports each selected placement's nonnegative LOD target as local, other-interior, missing-model, missing-placement or external-static-array. Binary links are always external-static-array until a corresponding static source is supplied; numeric overlap with a streamed placement is not sufficient to establish a link. Local status means that the indexed target exists and is loaded, not that the entire graph is acyclic or otherwise valid for rendering.

The IDE reader preserves draw distance and flags for `objs` and `tobj`, plus on/off hours for timed objects. It accepts supported modern layouts and legacy one-to-three-distance layouts, retaining the first distance as the source loader does. Distances must be finite and nonnegative within the importer's coordinate-scale limit; flags retain 32-bit bit patterns, including signed decimal representations; visibility hours must be integers from 0 through 24. Three-field association-only records remain accepted without visibility metadata. Other IDE sections still supply only associations. Model-name merging retains the last equivalent dictionary association and its metadata; it does not yet validate conflicting visibility definitions.

The workshop exposes these fields and target classifications in scene metadata. Visual placement behavior remains raw: no LOD suppression, fades, distance culling, time-of-day visibility or streaming has been introduced. Collision installation retains its current independent behavior.

Primary references checked at gta-reversed commit `0076f9017b4aeef7433957ac2bd8b6988e9df166`:

- [FileLoader.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/FileLoader.cpp): `LoadObject` and the timed-object loader select modern versus legacy fields and use the first draw distance. `LinkLods` uses original loaded-building indices. This supports preserving identity before filtering/grouping rather than deriving links from model groups.
- [IplStore.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/IplStore.cpp): streamed objects resolve LOD indices through a selected static entity array. The current single-IPL workflow lacks that explicit relationship.
- [Renderer.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Renderer.cpp): map visibility considers draw distance, camera multiplier, collision bounds, far clip, fading, model availability and LOD-child state. A section of the pinned LOD-list code initializes a loop condition false before testing that condition; this is a reason to verify the reverse-engineered control flow against stronger evidence before porting it. The source is not sufficient by itself to claim exact retail renderer behavior.

The next renderer work requires loading related static/streamed sources with explicit namespaces, validating links and cycles, and verifying child/fade selection. A nearest-distance toggle alone would not reproduce the source behaviors above. Diagnostic coverage now checks preserved indices after interior filtering and model grouping, missing targets, a binary index that must not resolve locally, modern/legacy visibility fields and invalid numeric data. Browser coverage verifies readable metadata while retaining the existing geometry/resource counts. Original-map compatibility and pixel fidelity remain unproven.
