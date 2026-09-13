# Static DFF model reader — September 13, 2026

`/models.html`, linked from the texture library, reads a locally selected DFF in a worker and previews its static geometry. No game assets are bundled or uploaded. Gameplay meshes are still authored stand-ins.

## Evidence

[librw's geometry reader](https://github.com/aap/librw/blob/master/src/geometry.cpp) establishes the geometry header, UV-layer flags, prelit colors, on-disk triangle ordering, morph target data and material list. Its [frame implementation](https://github.com/aap/librw/blob/master/src/frame.cpp) supplies the hierarchy/matrix reference. The TypeScript reader is independently implemented.

[DragonFF's DFF implementation](https://github.com/Parik27/DragonFF/blob/5a7c2f18d6ff9ac4e3424d552cfe404c931d039d/gtaLib/dff.py) provides a second implementation reference, including material/texture records, frame names, mesh strips and Rockstar's extra vertex colors. Its exporter generated the original diagnostic pyramid files used in tests. No retail geometry was used. `scripts/generate-model-reference.py` reproduces the fixtures with that external checkout.

## Preserved data and coordinate contract

- Frame names, parents, local matrix bases and translations; atomic-to-frame/geometry references and render flags.
- First morph-target positions and normals, all declared UV layers, prelit RGBA and extra night RGBA.
- Face winding and material IDs, material color/surface coefficients, texture/mask names and sampling flags. Shared material references remain references.
- Triangle-list fallback and alternating-winding triangle-strip expansion from Bin Mesh when geometry faces are omitted. Degenerate strip connectors are discarded.

The renderer applies one proper root rotation, `(x,y,z) → (x,z,-y)`, preserving scale and winding. Frames remain in source space underneath it. World matrices are calculated before camera framing; browser verification caught and fixed an initial ordering bug here. Source geometry buffers are shared across atomics and disposed on clear/replacement.

The preview deliberately uses unlit raw material/vertex colors with a day/night interpolation slider. Normals and extra UV layers are retained but do not establish final lighting fidelity. A selected PC TXD now supplies matching textures, including all stored mip levels. Missing textures are listed by name. No PBR conversion is applied.

## Limits and verification

The current reader accepts a single non-native clump. Platform-native geometry and skinning fail explicitly; additional morphs use their first target with a visible warning. Unknown geometry/material plugins are reported. Material effects, animations, collision, lights, original rendering-pipeline evaluation and placement import remain incomplete. Multi-clump/UV-animation dictionary input is not implemented.

Bounds checks reject truncated attributes, bad counts/indices/material references, non-finite source floats and cyclic/deep frame hierarchies. Limits include a 64 MiB input, 4,096 frames/geometries/atomics, 256 hierarchy depth, 65,536 vertices per geometry and one million source vertices overall. Visible instances are limited to two million triangles and 16,384 material draw groups; composed world bounds beyond ±10 million units are rejected before drawing. These are practical inspection limits, not measured game-streaming budgets.

Independent list/strip fixtures verify preserved normals/UVs/materials/night colors, oriented faces, nested transforms, material groups and color interpolation. Browser checks verify visible rendered triangles, camera orbit, day/night pixel changes, malformed-file recovery, file replacement and narrow layout. Production checks load the emitted worker, inspect a rendered pixel, and confirm the development hook is absent. Orbit controls are a separate chunk requested only by the model preview.

No retail DFF has been validated. Passing these cases proves the implemented subset and independent-exporter interoperability, not complete San Andreas asset compatibility or pixel parity.


## Texture binding

The optional TXD input resolves referenced texture names without case sensitivity and rejects ambiguous matching names. Only materials with UVs request decoding. Source raster pixels are decoded in the worker and transferred to the preview; all mip levels are supplied to Three.js without generated replacements. Referenced RGBA mip data have a combined 64 MiB limit before decoding starts. Textures are shared across materials and disposed when the model is replaced or cleared.

[librw's texture lookup and stream reader](https://github.com/aap/librw/blob/master/src/texture.cpp) support case-insensitive dictionary lookup and retention of the dictionary texture's sampler when that texture already exists. The adapter uses the TXD filter/address values, including inherited U addressing when V is zero. [Three.js DataTexture](https://threejs.org/docs/pages/DataTexture.html) supplies raw pixel upload with `flipY=false`; the preview preserves the source V convention and performs raw color multiplication.

Nearest/linear and four mip-filter combinations, wrap/mirror/edge clamp, stored mip pixels and embedded alpha are supported. Border addressing falls back to edge clamp with a visible notice. Unknown filter values preview as linear with a notice. Texture alpha enables blending, disables depth writes and discards zero-alpha fragments at an authored 1/255 threshold. This is a preview policy, not a calibrated reproduction of San Andreas's alpha sorting/render states. Separate external mask composition, compressed GPU upload, material effects and gameplay installation remain unfinished.

The companion `dragonff-model-textures.txd` contains original asymmetric quadrant pixels and a complete mip chain, independently exported by DragonFF. Tests check exact rows/mips, lookup, sampler mapping, shared texture disposal, rendered pixel changes, repeated-load GPU counts and removal restoring the untextured image. Production verification binds that companion to the independent DFF and observes a changed framebuffer pixel.


## Direct archive preview

The model preview now indexes local VER2 IMG archives in a worker. Searchable model and dictionary lists show up to 200 matches, retaining a suggested dictionary outside that window. Selecting a model suggests a same-basename TXD when present; this is a fallback when no loaded IDE definition names its dictionary. Users can choose another archived dictionary, use no dictionary, or override it with a separate TXD file.

Only the directory and selected payload slices are read. Each payload remains limited to 64 MiB, independently of archive size. Extraction rechecks bounds and rejects packed entries. Replacement and clear terminate pending workers and release the current preview. No archive contents are uploaded, persisted or installed into gameplay.

Diagnostic browser checks cover automatic dictionary suggestion, untextured and external-TXD overrides, malformed DFF recovery, model search, empty model lists, cancellation and switching to standalone files at a narrow viewport. The production check synthesizes a VER2 archive containing the independent DragonFF exports and verifies its rendered center pixel equals the standalone DFF/TXD result. This establishes a tested import path for these fixtures, not retail-installation compatibility. Cross-archive parent lookup, COL/IPL placement and gameplay installation remain unfinished.


## IDE dictionary associations

Optional local IDE files now provide model ID, model name and dictionary name associations. The section dispatch and common prefix follow [gta-reversed FileLoader](https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/FileLoader.cpp), inspected September 13, 2026. The association reader recognizes `objs`, `tobj`, `anim`, `hier`, `cars`, `peds` and `weap`; other sections are skipped. It accepts comma/whitespace separators and hash comments. It does not interpret or validate the remaining per-section parameters, draw distances, flags, times, handling or animation fields; this is not a complete IDE importer.

Up to 100 selected files totaling 4 MiB are decoded locally in the model worker. Model lookup is case insensitive. Conflicting dictionary assignments for one model fail explicitly; no file-order override is guessed. A supplied association takes priority over the same-name fallback. Missing dictionaries are named in the UI, with manual selection and separate-TXD overrides still available. Definitions persist while changing preview sources until removed or cleared. Clear and replacement terminate pending definition work.

Three unit cases cover section parsing, source names/IDs, duplicate/conflict handling, malformed prefixes and limits. A browser scenario binds a differently named archive dictionary from IDE data, exercises missing/conflicting definitions, removes them and cancels pending input. Fixtures are authored diagnostics, not original installation data. Applying IDE parameters to gameplay remains incomplete.


## Texture-parent lookup

IDE `txdp` records now connect child dictionaries to parents. [FileLoader::LoadTXDParent](https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/FileLoader.cpp) reads child then parent; [TxdStore's texture lookup](https://github.com/gta-reversed/gta-reversed/blob/master/source/game_sa/TxdStore.cpp) searches the current dictionary before walking its parents. These sources were inspected September 13, 2026. The preview follows that order: a child texture wins over the same name in an ancestor, while missing names inherit parent pixels, mip levels and samplers.

Loaded IDE parent links are validated for conflicting assignments and cycles, with a 32-dictionary chain limit. For an archive model, parent TXDs are read selectively from the same archive. A separate base TXD uses its filename to find parent links; a standalone DFF has no archive from which to obtain parents. A missing ancestor produces a visible notice and stops traversal while preserving successfully loaded textures. Dictionary lookup order is recorded in preview metadata. The total source chain and decoded referenced pixels each have separate 64 MiB limits.

Unit checks verify chain order, cycles, conflicting links, depth limits, child override and inherited exact pixels. A browser case binds a texture that exists only in the parent TXD, checks lookup metadata, and verifies missing-parent notices and unbound materials. Cross-archive and separately selected parent sources, persistent dependency caching and retail-installation verification remain unfinished.

## Skinned model extension

Supported non-native skins now retain HAnim mappings, weights and inverse matrices and render in their bind pose. See [skin format support and evidence](SKIN_FORMATS.md). Animation playback and full original-character compatibility remain unfinished.


## Atomic pipeline identity

The DFF reader now retains an atomic's Pipeline Set extension as an optional unsigned `pipeline` identifier. The plugin type is `0x0253f2f3` and its payload is exactly one little-endian 32-bit value. Repeated atomic extension containers, repeated Pipeline Set plugins and malformed identifier payloads fail explicitly. Missing identifiers remain absent; no renderer is inferred from frame/model names. The value survives worker transfer and appears as `nativePipeline` metadata on rendered atomic meshes, including skinned meshes. A warning exposes the exact hexadecimal identifier and states that its custom rendering is not implemented.

[DragonFF dff.py](https://github.com/Parik27/DragonFF/blob/5a7c2f18d6ff9ac4e3424d552cfe404c931d039d/gtaLib/dff.py) defines Pipeline Set as decimal 39056115, reads a little-endian uint32 into atomic extensions, and writes the same representation. That establishes the storage contract, not a complete semantic registry of pipeline IDs.

This matters for lighting: the pinned [Entity.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Entity.cpp) sets ordinary object-lighting participation when the custom building pipeline is not attached. However, [CustomBuildingRenderer.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Pipelines/CustomBuilding/CustomBuildingRenderer.cpp) still delegates pipeline setup/recognition to native calls, and the custom material/render callbacks in [CustomBuildingDNPipeline.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Pipelines/CustomBuilding/CustomBuildingDNPipeline.cpp) are also delegated. Applying the character-lighting shader indiscriminately to static buildings would therefore be an unsupported interpretation.

This change preserves information required for pipeline-aware material selection; playable imported-world shading remains unchanged. Unit checks cover preservation, mesh metadata, absent identifiers and malformed/duplicate rejection. The browser uploads a diagnostic model through the real worker, verifies the unsupported-pipeline warning, then replaces it with an ordinary model and checks that the warning clears. The diagnostic identifier is treated as opaque; these tests do not establish a retail pipeline implementation.
