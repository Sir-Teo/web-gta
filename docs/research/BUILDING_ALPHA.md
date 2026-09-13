# Building alpha and depth passes

## Evidence and current discrepancy

The current explicit building material sets `depthWrite = !transparent`. Vertex, material or texture alpha therefore removes depth writes for the entire draw. Preserving native mesh partitions fixes interference between different draws but does not let opaque texels within an alpha-bearing draw occlude later geometry.

Pinned SkyGFX commit `926616a3f31deaf0d300b3752383314db28994f0` supplies a concrete alternative in [D3D9RenderDual](https://github.com/aap/skygfx/blob/926616a3f31deaf0d300b3752383314db28994f0/src/main.cpp#L122). Its [building callback](https://github.com/aap/skygfx/blob/926616a3f31deaf0d300b3752383314db28994f0/src/buildingPipe.cpp#L237) invokes this per native mesh after selecting the base shader and texture. The helper reads actual alpha-blending and depth-write state; the former includes texture alpha, not only vertex alpha.

| Incoming state | Draw behavior |
| --- | --- |
| Dual enabled, alpha blending enabled, depth writes enabled | Draw alpha greater than or equal to the threshold with depth writes; then draw alpha strictly less than the threshold without depth writes. |
| Depth writes disabled | One draw with the alpha test set to always. |
| Otherwise | One draw with the incoming alpha/depth state. |

The split draws keep incoming blending factors. The high-alpha pass is not an unblended opaque pass: a pixel with alpha 128/255 can blend and still write depth. The two predicates are complementary, so a pixel at the threshold belongs to exactly one pass. The helper restores incoming alpha function, alpha reference and depth-write state afterward. It does not reorder all scene geometry into a global depth prepass.

The configuration loader in the same pinned file defaults `zwriteThreshold` to 128 and clamps it to 0–255. `dualPassBuilding` inherits `dualPass`, whose missing-config fallback is zero. Consequently, enabling dual pass is an explicit presentation choice, not proof that every SkyGFX configuration or retail platform uses it. The project should retain a named renderer policy rather than describing a selected threshold as universally native.

The inspected gta-reversed [entity renderer](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/VisibilityPlugins.cpp) supplies additional context: the no-depth-write flag disables writes, normal exterior alpha reference is 100, and interior/fading handling differs. Those incoming policies must remain separate from the dual-pass split threshold. The current implementation only partially reproduces these renderer paths.

## Integration design

Use the existing native mesh partitions as the unit of work. Keep both draws adjacent within the selected mesh's queue position. Reuse its geometry, transforms, texture and native day/night uniforms. Do not create scene-wide high/low alpha queues: that changes ordering relative to neighboring meshes.

Represent desired depth-write policy separately from the low-alpha pass's actual `depthWrite=false`. Otherwise a fade copy made after rendering can mistakenly inherit “depth disabled” as its source policy. Explicit no-depth-write placement flags must suppress the split and use the source helper's always-pass alpha behavior. Source material opacity, per-placement fading, texture alpha and wet-road alpha must all reach the final fragment alpha before deciding the pass.

A candidate Three.js integration is `Material.onBeforeRender`: in the installed renderer it runs after object model-view/normal matrices are prepared and before the ordinary `renderBufferDirect` call. An owned high-alpha material can issue the first direct draw; the normal draw then uses the low-alpha material. Unlike an object callback, this can travel with per-placement material variants, but the current clone helper must explicitly preserve the callback. Three's generic material copy does not copy custom rendering callbacks. This is a candidate requiring a GPU proof, not a validated implementation.

Use distinct material identities for the two draws so uniform refresh does not accidentally reuse the first pass's alpha settings. The low-alpha shader needs a strict upper-alpha discard, while the high-alpha material can use the existing inclusive alpha-test threshold. Both must compose with the existing building shader, material modulation, texture scaling and fade callback. Program cache keys must distinguish shader variants; changing the threshold should update uniforms rather than multiply shader programs.

Create each high-alpha material lazily per actual source/fade/normal material and release it when that owner is disposed. Do not dispose shared textures or geometry. A source material's closure must not make all placement copies share one mutable high-alpha material. Side, blending, opacity, color and no-depth-write state must reflect the actual placement material. Two-sided placements must not accidentally combine Three's front/back double rendering with native dual alpha passes.

## Required verification before enabling

- Render pixels at alpha 0, 127, 128 and 255 with threshold 128. Check both color and occlusion against geometry drawn afterward. Verify that threshold pixels blend once and write depth, while lower-alpha pixels do not write depth.
- Repeat at threshold 0 and 255, including alpha-zero pixels. Match the reference predicates rather than silently imposing a different alpha cutoff.
- Exercise texture alpha, vertex alpha, material opacity and distance fading independently and together, including night/wet alpha and textured color scaling.
- Check additive blending, explicit no-depth-write placements, exterior/interior alpha policies, front/back faces and draw-last ordering.
- Verify repeated native groups sharing one material, sibling placements with different fade values, material arrays, callback copies and exact disposal ownership.
- Inspect draw-call counts: one ordinary draw when splitting is disabled or unnecessary, two when the split applies, with no leaked high-pass draws after disposal.
- Run actual worker import, scene walking, timed LOD transitions, context restoration and production smoke after integration. Compare matched retail captures separately before claiming original-game parity.

Until these checks pass, the current one-pass material remains in place and dual-pass compatibility remains unfinished. This research resolves the operation order and threshold semantics; it does not establish console arithmetic, depth precision, all queue interactions or retail visual equivalence.
