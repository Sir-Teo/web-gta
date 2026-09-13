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

The current reader accepts a single non-native clump. Platform-native geometry and skinning fail explicitly; additional morphs use their first target with a visible warning. Unknown geometry/material plugins are reported. Material effects, animations, collision, lights, original rendering-pipeline evaluation and placement import remain incomplete. Archive model selection and multi-clump/UV-animation dictionary input are not implemented.

Bounds checks reject truncated attributes, bad counts/indices/material references, non-finite source floats and cyclic/deep frame hierarchies. Limits include a 64 MiB input, 4,096 frames/geometries/atomics, 256 hierarchy depth, 65,536 vertices per geometry and one million source vertices overall. Visible instances are limited to two million triangles and 16,384 material draw groups; composed world bounds beyond ±10 million units are rejected before drawing. These are practical inspection limits, not measured game-streaming budgets.

Independent list/strip fixtures verify preserved normals/UVs/materials/night colors, oriented faces, nested transforms, material groups and color interpolation. Browser checks verify visible rendered triangles, camera orbit, day/night pixel changes, malformed-file recovery, file replacement and narrow layout. Production checks load the emitted worker, inspect a rendered pixel, and confirm the development hook is absent. Orbit controls are a separate chunk requested only by the model preview.

No retail DFF has been validated. Passing these cases proves the implemented subset and independent-exporter interoperability, not complete San Andreas asset compatibility or pixel parity.


## Texture binding

The optional TXD input resolves referenced texture names without case sensitivity and rejects ambiguous matching names. Only materials with UVs request decoding. Source raster pixels are decoded in the worker and transferred to the preview; all mip levels are supplied to Three.js without generated replacements. Referenced RGBA mip data have a combined 64 MiB limit before decoding starts. Textures are shared across materials and disposed when the model is replaced or cleared.

[librw's texture lookup and stream reader](https://github.com/aap/librw/blob/master/src/texture.cpp) support case-insensitive dictionary lookup and retention of the dictionary texture's sampler when that texture already exists. The adapter uses the TXD filter/address values, including inherited U addressing when V is zero. [Three.js DataTexture](https://threejs.org/docs/pages/DataTexture.html) supplies raw pixel upload with `flipY=false`; the preview preserves the source V convention and performs raw color multiplication.

Nearest/linear and four mip-filter combinations, wrap/mirror/edge clamp, stored mip pixels and embedded alpha are supported. Border addressing falls back to edge clamp with a visible notice. Unknown filter values preview as linear with a notice. Texture alpha enables blending, disables depth writes and discards zero-alpha fragments at an authored 1/255 threshold. This is a preview policy, not a calibrated reproduction of San Andreas's alpha sorting/render states. Separate external mask composition, texture-parent dictionaries, compressed GPU upload, material effects and gameplay installation remain unfinished.

The companion `dragonff-model-textures.txd` contains original asymmetric quadrant pixels and a complete mip chain, independently exported by DragonFF. Tests check exact rows/mips, lookup, sampler mapping, shared texture disposal, rendered pixel changes, repeated-load GPU counts and removal restoring the untextured image. Production verification binds that companion to the independent DFF and observes a changed framebuffer pixel.
