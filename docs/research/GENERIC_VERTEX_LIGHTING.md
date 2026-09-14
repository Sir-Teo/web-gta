# Generic native vertex lighting

The generic native material now evaluates ambient, diffuse and prelight at each vertex, clamps RGB there, and interpolates the result across the triangle. Texture and material modulation follow interpolation. Previously the material used Three.js's fragment Lambert lighting and clamped after interpolating prelight. These differ on coarse meshes even when the light colors and geometry are identical.

The reference is [librw's generic vertex shader](https://github.com/aap/librw/blob/18532c2e13efbc1aa43f0b00b4459831f9414de0/src/gl/shaders/default.vert), which accumulates prelight, ambient and dynamic light, clamps the vertex color, then applies material color. This is the generic path; it does not justify adding clamping to the separate SkyGFX building shader.

The adapter uses Three.js's current light uniforms and directional, sun, point, spot, hemisphere and probe helpers. Native ambient and contact multipliers remain explicit shared uniforms. Skinning and morph transforms occur before vertex lighting. Alpha handling remains separate and retains the existing rejection/blending behavior. Material and texture coefficients remain in the fragment modulation, which commutes with interpolation for a constant material coefficient. The resulting varying uses ordinary perspective-correct interpolation.

## Validation

A GPU test renders one large triangle with a deliberately saturated first vertex. At its sampled pixel, that vertex's barycentric weight is 0.244140625. With 0.2 ambient and prelight values 1, 0, 0, the expected clamped-vertex result is about 101/255; fragment clamping would instead produce about 113/255. A second pass uses differing normals to distinguish interpolated vertex lighting (62/255) from normalized fragment lighting. The test also compiles point and spot paths and checks a nonzero contribution. All assertions read rendered pixels, not shader strings.

Existing GPU checks cover player alpha, actual packaged vegetation ambient response and its absent-normal directional suppression. The walking check exercises the skinned native character and visible procedural models. Unit and production smoke suites also pass.

## Remaining differences

librw is a RenderWare reimplementation, not a retail executable comparison. The current browser retains its normal transformation/normalization policy and Three.js light attenuation, rather than claiming that these match every original pipeline. Native point-light generation, brightness-slider additions, vertex precision, original color quantization and matched retail screenshots remain incomplete. Generic materials do not implement Three.js shadow-map reception, normal mapping or baked lightmaps through this path; the game's existing character shadow is handled by its separate native shadow renderer. The specialized building pipeline remains unchanged.
