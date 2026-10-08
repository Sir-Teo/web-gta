# Static DFF model reader — September 13, 2026

`/models.html`, linked from the texture library, reads a locally selected DFF in a worker and previews its static geometry. No game assets are bundled or uploaded. The game itself builds its world, vehicles and characters from these native models; their per-vertex lighting is described in [generic vertex lighting](GENERIC_VERTEX_LIGHTING.md).

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


## Imported prelight clock and building references

Playable imported scenes now derive their existing day/night palette mix directly from game time. Night balance is one before 06:00, decreases to zero from 06:00 to 07:00, stays zero until 20:00, increases to one by 21:00, and remains one overnight. Fractional minutes are retained. This schedule is transcribed in the pinned CustomBuildingRenderer source above; its live function still delegates to the original executable, so the transcription remains reference evidence rather than independent retail verification. The pinned [Clock.h](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Clock.h) explicitly includes seconds/60 in `GetMinutesToday`.

Scene time updates palette balance before the whole-hour timed-visibility cache. Thus colors can change within an hour without changing a tobj's visibility. Repeated identical balance values reuse the existing color buffers. The main loop no longer supplies the previous frame's authored sky-night factor to imported scenes. Workshop sliders, native character lighting and authored-world lighting retain their existing policies.

Unit cases cover both transition intervals, boundaries, fractional minutes, wraparound and invalid values. Installed-scene checks verify within-hour palette changes, unchanged-time caching and unchanged source arrays. The source's 0.01 threshold and staggered per-atomic updates are not reproduced. The existing imported palette path still interpolates RGBA; this change does not implement PS2-specific vertex alpha or custom shading.

Further primary implementation evidence is available in SkyGFX, pinned at `926616a3f31deaf0d300b3752383314db28994f0`: [buildingPipe.cpp](https://github.com/aap/skygfx/blob/926616a3f31deaf0d300b3752383314db28994f0/src/buildingPipe.cpp), [gta.h](https://github.com/aap/skygfx/blob/926616a3f31deaf0d300b3752383314db28994f0/src/gta.h), and [ps2BuildingVS.hlsl](https://github.com/aap/skygfx/blob/926616a3f31deaf0d300b3752383314db28994f0/shaders/vs/ps2BuildingVS.hlsl). The explicit PC building IDs are `0x53f2009c` and day/night `0x53f20098`. Its PS2-style shader weights RGB with day/night balance, weights alpha separately with wet-road state, applies material/color-scale modulation, and then adds ambient times the surface ambient coefficient. The non-DN path forces its single available color stream. These are leads for the next material stage, not implemented pipeline support or proof of console pixel identity.

## Explicit building base pass

Playable static atomics with pipeline `0x53f20098` or `0x53f2009c` now opt into a building base material. The day/night variant reads immutable day and night color attributes; RGB interpolates by the native clock balance, while alpha interpolates from night alpha when dry to day alpha when wet. The single-color variant uses ordinary day colors and ignores extra-color RGB and alpha. Other pipelines and skinned atomics retain their existing material path. Inspection previews remain unfiltered fallback materials and the importer labels playable building support as partial.

The vertex shader follows the pinned SkyGFX operation order: mixed color times material color divided by color scale, then ambient times the surface ambient coefficient added to RGB. The textured base pass uses scale 255/128 and multiplies texture/color by that scale afterward; the untextured pass uses scale one. Original source color bytes remain unchanged. Separate material variants let differently tagged atomics share geometry without accidentally sharing pipeline behavior. Building and fade-material copies retain callbacks, uniforms and texture ownership, and release only their owned material resources.

The playable scene supplies clock balance and the authored timecycle's ambient RGB. Wetness defaults to zero because the runtime has no weather-driven wet-road state yet. This does not reproduce original timecycle ambient values or the corona light multiplier. Directional character lighting is not applied to the explicit building base pass.

The pinned [SkyGFX building implementation](https://github.com/aap/skygfx/blob/926616a3f31deaf0d300b3752383314db28994f0/src/buildingPipe.cpp), [vertex shader](https://github.com/aap/skygfx/blob/926616a3f31deaf0d300b3752383314db28994f0/shaders/vs/ps2BuildingVS.hlsl), and [simple pixel shader](https://github.com/aap/skygfx/blob/926616a3f31deaf0d300b3752383314db28994f0/shaders/ps/simplePS.hlsl) establish these operations. SkyGFX is a PC implementation targeting PS2-style presentation; its code is not independent proof of retail console pixel identity.

GPU pixel checks cover day/night/midpoint RGB, wetness-dependent alpha, ambient-after-modulation order, ambient coefficient, textured scaling, single-color behavior and distance fading. Unit tests cover explicit opt-in, shared geometry with separate material variants, unchanged source data, ownership and the single-color alpha policy. A pipeline-tagged original floor fixture exercises the playable renderer in browser walking and production smoke verification.

Environment/reflection/detail passes, UV animation, dual-pass alpha treatment, vertex-stage clamping equivalence, original display/color conversion, original ambient/weather inputs and retail comparisons remain unfinished. Known building identifiers have a supported base pass, not complete custom pipeline compatibility.

## Building alpha scope and shader target

The pinned `DNInstance_PS2` in [buildingPipe.cpp](https://github.com/aap/skygfx/blob/926616a3f31deaf0d300b3752383314db28994f0/src/buildingPipe.cpp#L680) computes vertex-alpha presence separately for each mesh, reading `minVert` through `minVert + numVertices` from its day and night streams. The importer now checks each material group's minimum-to-maximum vertex span. An unrelated translucent section no longer makes every building material transparent and disables every section's depth writes. Gaps inside the span still participate, matching the inspected contiguous-range check. Empty groups have no vertex alpha. A prefix count makes overlapping span queries constant-time after one palette scan; only span endpoints are retained alongside geometry. Texture/material alpha and placement overrides continue to apply separately.

A GPU diagnostic places a later-drawn red surface behind the opaque green section of a two-material building, while its other section has vertex alpha. The opaque section must remain green through depth occlusion. Unit tests cover disjoint spans, empty groups, gaps, absent palettes and single-color versus day/night policies. The importer currently combines triangles by material; it does not preserve arbitrary original RenderWare mesh partition boundaries, so equivalence for multiple native meshes sharing one material remains unverified.

The pinned [shader build script](https://github.com/aap/skygfx/blob/926616a3f31deaf0d300b3752383314db28994f0/shaders/shaders.bat) compiles `vs_3_0` and `ps_3_0`. Microsoft's [Direct3D 9 shader guide](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-writing-shaders-9#pixel-shader-inputs) scopes its legacy color-input saturation rule to `ps_1_1` through `ps_2_0`; [Shader Model 3 documentation](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/shader-model-3) describes consolidated interpolator registers. Therefore the older color-register rule does not justify inserting vertex saturation into this SkyGFX-based material. The current shader remains unclamped before interpolation; original console arithmetic and precision still require separate evidence.

## Preserved Bin Mesh draw partitions

Non-native PC Bin Mesh lists are now decoded even when ordinary geometry triangle records are present. Their triangle-list or strip order supplies the rendering indices, while the original face records are still validated. Each native group retains its index start/count, source material and original minimum/maximum vertex index. Degenerate strip connectors contribute to the native vertex span even though they do not produce visible triangles. Duplicate plugins, invalid connector indices, trailing payload bytes and inconsistent counts are rejected.

The renderer preserves separate geometry draw groups when two native meshes refer to the same material. Explicit building pipelines allocate separate material variants for those draws, so one mesh's vertex alpha does not change the other mesh's blending/depth policy. Generic material references remain shared. Geometry without Bin Mesh data retains the existing per-material triangle grouping. The import draw-group budget now counts nonempty native groups rather than unique material IDs.

Format evidence: DragonFF's pinned [writer and reader](https://github.com/Parik27/DragonFF/blob/5a7c2f18d6ff9ac4e3424d552cfe404c931d039d/gtaLib/dff.py) serialize mesh headers, material references and index streams independently of ordinary triangles. The pinned SkyGFX instancer cited above consumes per-mesh vertex spans. Original diagnostic replacements test repeated material references and strip connectors; existing independently exported list/strip fixtures continue to verify face orientation. The GPU depth probe now uses two native draw groups sharing one material.

This closes the previous loss of native partition boundaries for supported PC Bin Mesh records. Platform-native geometry, 16-bit OpenGL variants, exact global queue ordering, native dual-pass rendering and retail capture comparison remain unsupported or unverified. Preserving geometry group order does not by itself reproduce the original renderer's complete draw scheduling.

## GPU building palette ownership

Geometry rendered only by explicit static building pipelines no longer allocates Three's mutable float RGBA color attribute. Its building materials disable Three's generic vertex-color path and read the immutable normalized byte attributes directly. This removes a 16-byte-per-vertex CPU buffer and its per-frame interpolation work during clock transitions. No GPU-memory or frame-rate improvement is claimed without measurement. If any rendered atomic sharing the geometry needs fallback or skinned shading, the CPU palette remains available; diagnostic model previews retain their slider-driven palette behavior.

Unit checks verify missing mutable buffers for building-only geometry, unchanged byte attributes and upload versions across repeated night updates, shared mixed-pipeline geometry, and preview interpolation. Existing GPU pixel probes verify that disabling generic vertex colors preserves building RGB, wet alpha, texture scaling, fade behavior and per-mesh depth policy.

## Clump light/camera attachment frame sections

A real public-world sample, `lae2_landhub04.dff`, has one atomic and one light. Its root contains a 12-byte clump header and a separate four-byte STRUCT immediately before the LIGHT chunk. Requiring exactly one STRUCT anywhere under the clump incorrectly rejected the terrain. The reader now treats the first STRUCT as the header and subsequent STRUCT/object pairs as attachments, validating declared counts, frame indices and chunk boundaries. Attachment bytes are retained with kind/frame metadata; the existing warning that embedded lights/cameras are not rendered remains accurate.

[librw clump.cpp](https://raw.githubusercontent.com/aap/librw/master/src/clump.cpp), `Clump::streamRead`/`streamWrite`, confirms a frame-index STRUCT precedes each light and camera. The synthetic regression covers both types, unchanged geometry, invalid frame indices, count mismatch and an orphan frame chunk. The actual terrain now parses to 257 rendered triangles and renders with `landhub.txd` in Chrome. CJ's house also renders with its native TXD. Final ordinary suite: 478 tests/96 files; build passes. The temporary real-asset browser audit passed separately. Original light behavior and full retail rendering remain incomplete.

### Stored morph bounding spheres

Geometry parsing now retains each morph target's original float32 center/radius as `morphBounds` rather than discarding it. Values remain in native coordinates, independently of rendered frame transforms and computed Three bounds. Later-target spheres are retained even though only first-target geometry is previewed. Negative radii remain available with a warning; non-finite values are rejected. These metadata do not yet select shadow camera radius or change culling. Real character measurements and tests are recorded in `PEDESTRIAN_SHADOWS.md`.

## Embedded vehicle collision

The selected DFF clump now decodes its direct extension plugin `0x253f2fa` through the bounded COL2/COL3 reader. DragonFF identifies this as Collision Model in its pinned [DFF implementation](https://github.com/Parik27/DragonFF/blob/5a7c2f18d6ff9ac4e3424d552cfe404c931d039d/gtaLib/dff.py). Duplicate plugins and malformed payloads are rejected. Collision data from another clump is never attached to the selected clump. Legacy COL1 remains unsupported.

The existing public San Andreas archive's `greenwoo.dff` contains a 2,952-byte COL3 plugin named `greenwoo_col`, with 19 spheres, no boxes and 12 triangles. A single embedded model belongs to its clump even when its label differs from the DFF basename. The model workshop uses this collision automatically; explicitly selected external collision data retains precedence and its existing filename matching. The Show collision control toggles the overlay.

Unit tests cover decoding, malformed/repeated plugins, clump isolation and external overrides. An opt-in native-depot test verifies the Greenwood record, and a browser test loads the actual DFF, checks the visible overlay, toggles it, then replaces the model and checks cleanup. This establishes collision import only: vehicle textures, component preprocessing, wheel setup and gameplay entry remain unfinished. The Greenwood is not yet drivable in the published scene.
