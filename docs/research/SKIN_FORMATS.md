# DFF skeleton and skin support

## References and supported data

The implementation was checked against the pinned external [DragonFF exporter](https://github.com/Parik27/DragonFF/blob/5a7c2f18d6ff9ac4e3424d552cfe404c931d039d/gtaLib/dff.py), and librw's [skin reader](https://github.com/aap/librw/blob/master/src/skin.cpp) and [HAnim implementation](https://github.com/aap/librw/blob/master/src/hanim.cpp). External implementation source was consulted, not bundled into the browser runtime.

The parser preserves HAnim version, frame ID, node palette index, flags and keyframe size. Skin data preserves used-bone indices, four influence slots per vertex, weights and inverse matrices. Source frame order is not assumed to match the skin palette: the renderer resolves each palette index through its HAnim node ID to a unique frame.

Non-native geometry skin plugins support modern unsplit records and older records with the per-matrix marker. RenderWare matrix fourth lanes contain flags/padding; those lanes are reconstructed as an affine column rather than interpreted as float coefficients. The mathematical coefficients remain unchanged. Split-remapping payloads and platform-native skin variants fail explicitly.

Checks reject invalid or duplicate palette mappings, unavailable nonzero-weight bone references, invalid weights/sums, singular or non-finite inverse matrices, malformed lengths and ambiguous hierarchy bindings. Weight sums must be within 0.01 of one. The source data stays unchanged; the renderer normalizes a copied weight attribute and clears unused zero-weight indices before GPU evaluation.

## Rendering and ownership

Model frames carrying HAnim data become Three.js bones. Skinned geometry uses source inverse matrices and explicit skeleton binding. The ordinary native-to-engine root conversion still applies once. Multiple placed copies share geometry/materials but clone the skeleton and bone hierarchy, so changing one copy's pose cannot move another copy. Skeleton GPU textures are released with owned model resources, including scene replacement and repeated disposal.

The preview exposes supported skins in their bind pose and labels them accordingly. The preview can now bind and play supported IFP tracks on a matching rig. The workshop can now test native idle/walk/run roles through the player controller, with authored pose and movement transitions. Original action coverage and reference verification remain unfinished. A clump requiring multiple ambiguous HAnim hierarchies is rejected rather than assigned an arbitrary skeleton.

## Fixture and validation

`generate-skin-reference.py` uses the external pinned DragonFF exporter to write an original two-bone, six-vertex strip. The palette and frame order deliberately differ. Bottom vertices use the root, middle vertices blend root/tip equally, and top vertices use the tip. The tip's inverse bind matrix includes a translation. None of this geometry comes from a retail character.

Unit checks verify parsed mappings, bind-pose equality, weighted deformation after a bone translation, distinct skeletons for repeated placements, owned texture disposal, malformed payloads and matrix metadata handling. The browser fixture loads the DFF through the existing file picker and worker, checks visible rendered pixels, records a screenshot, and verifies that replacing it releases the skeleton texture. These establish the diagnostic path, not retail character compatibility or original animation fidelity.


## Scene lighting for native characters

The native character requests a scene-lit material path when geometry sets `LIGHT` (0x20). The model workshop retains its unlit inspection path. Geometry without the flag remains unlit even in the character test. The source flag values are documented in [librw geometry definitions](https://github.com/aap/librw/blob/18532c2e13efbc1aa43f0b00b4459831f9414de0/src/rwobjects.h).

The pinned [librw skin vertex shader](https://github.com/aap/librw/blob/18532c2e13efbc1aa43f0b00b4459831f9414de0/src/d3d/shaders/skin_VS.hlsl) adds prelighting, ambient lighting scaled by the material ambient coefficient, and dynamic lighting scaled by diffuse. It clamps lighting before material-color multiplication. Our material preserves that combination order while using Three's light and shadow infrastructure. The Lambert BRDF normalization is removed from the accumulated light contribution before native modulation. Vertex alpha still multiplies material opacity; the source specular coefficient remains unused.

Native rigs now cast and receive the scene's existing shadows. GPU skinning transforms lighting normals along with the pose. A GPU fixture verifies dark, ambient, directional, prelit, additive, coefficient-scaled and clamped outputs, including clamping before material modulation and a rotated bone's normal response. Unit coverage verifies the opt-in policy and LIGHT flag. The production diagnostic rig was inspected with scene lighting and a cast shadow.

This establishes the defined material operations, not original-platform pixel parity. The current engine evaluates dynamic lighting per fragment, whereas the referenced skin shader does so per vertex. Scene light selection, hemisphere ambient, attenuation, shadow technique, color-space behavior and timecycle values still use the authored runtime. Native character prelight currently uses the loaded day colors; original per-character lighting and night-color policy require further work. The GPU tests run in a controlled linear-output scene and do not establish PS2 or retail PC capture equivalence.
