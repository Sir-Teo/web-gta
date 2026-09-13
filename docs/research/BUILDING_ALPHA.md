# Building alpha and depth passes

## Ordinary exterior placement policy

The playable scene now also applies source alpha/depth rules to ordinary imported materials, which were outside the explicit building dual-pass implementation. [CRenderer::RenderEverythingBarRoads](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Renderer.cpp) sets reference 140 for the exterior non-road pass. [DefinedState](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/app/app.cpp) enables depth writes and selects the GREATER alpha comparison. Both exact pinned source files were fetched and compared byte-for-byte with the local research copies. The sorted entity path in `VisibilityPlugins.cpp` supplies reference 100 for exterior non-fading draws, zero for interior/no-depth-write cases, and zero during fading.

`placementFade` accepts an explicit playable-world policy, enabled by `sceneVisibility`. Ordinary exterior non-road materials receive depth writes unless the IDE no-write flag is set. Their threshold is 140, or 100 for draw-last placements. `nativeAlphaReference` replaces Three's inclusive comparison with strict GREATER; alpha exactly 140 therefore fails while 141 passes. Reference zero uses a literal zero comparison so fully transparent texels never write depth during fading. Desired states live on reusable placement copies, and disposal restores shared inspection materials. Explicit building dual-pass materials keep their separate 128 split policy. Ordinary road/interior startup thresholds remain unchanged by this scoped correction; the known sorted interior path uses strict reference zero.

The new GPU probe uses texture alpha values 0,100,101,140,141,255, a blue background and later red geometry. It verifies exact threshold boundaries, one blend plus depth occlusion for passing pixels, exterior draw-last and sorted-interior policies, fading, explicit no-depth-write mode and shared-source restoration. Passing alpha 141 yields approximately RGB (0,141,114), while a rejected pixel lets the red geometry show through. At reference zero, an alpha-zero pixel also lets red show through rather than invisibly blocking it.

Verification: 537 tests/111 files with local references, production build, the new world-alpha GPU probe, existing building dual-pass/context tests and the Grove shadow/lifecycle audit pass. Logs `/tmp/web-gta-world-alpha-final-{unit,browser}.log` and `/tmp/web-gta-world-alpha-verified-build.log`. Visual inspection shows changed fence coverage/occlusion, but speckled point-filtered foliage remains. No sampler override or matched retail-render parity is claimed. Whole-scene queue ordering and other render-state inheritance paths still need calibration.

## Evidence and current discrepancy

Before the dual-pass implementation, the explicit building material set `depthWrite = !transparent`. Vertex, material or texture alpha therefore removed depth writes for the entire draw. Preserving native mesh partitions fixes interference between different draws but does not let opaque texels within an alpha-bearing draw occlude later geometry.

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

The implementation and verified scope are recorded below. Console arithmetic, depth precision, all queue interactions and retail visual equivalence remain unverified.


## Implemented base-pass policy

Explicit building materials now enable a 128/255 dual-pass policy through their shared lighting state. This is the project’s selected PS2-style presentation policy, not a claim about missing-config SkyGFX defaults. Material callbacks issue the high-alpha draw directly after transforms are prepared; Three then issues the complementary low-alpha draw. The split uses the existing alpha-test uniform, with a separate zero-threshold shader variant. Threshold changes and disabling the policy are covered by GPU checks.

Each actual material owns a lazily allocated, reusable high-pass copy through a weak map. The copy refreshes the actual placement’s opacity, color, side and blending state. Disposing the owner releases the high-pass material without releasing shared geometry or textures. Placement normal/fade clones retain the render callback. Intended depth writes and incoming alpha test are stored separately from the low draw’s transient settings. The no-depth-write flag now persists at full visibility as well as during fades; it suppresses splitting and disables the building alpha test.

GPU evidence covers texture alpha 0/127/128/255; thresholds 0/128/255; disabled dual policy; no-depth-write mode; ordinary and additive fades; back-face visibility; restoring normal policy; and context loss/restoration. Pixel assertions verify blending once and occlusion against a later red surface. Draw counts verify two building draws for a split and one when disabled. The earlier building probe continues to cover day/night and wet-alpha inputs, textured scaling, material coefficients, fades and native mesh arrays. Unit tests verify independent placement copies, reuse, single disposal and policy restoration.

Validation comprises 219 unit tests, all 45 pre-existing browser checks in a full run, and the final new dual-alpha check in a targeted run after fixture corrections. The new test initially failed due to a missing favicon; the added context probe required a deferred restore request and a fixture return-value correction. Final build and production smoke passed. Full retail queue ordering, non-building dual-pass families, original display/depth precision, every interior/exterior scene combination and matched retail captures remain outside this verified scope.

## Shared-placement GPU verification

The GPU probe now renders two differently positioned copies sharing one building material and geometry after graphics-context recovery. One placement fades to 128/255 while the other remains fully visible. Eight sampled pixels verify independent opacity and depth behavior across both transforms. Returning the faded placement to full visibility restores the exact shared material reference. Both frames issue five draws: two complementary passes for each placement and one later background draw. This checks actual GPU transforms and material refresh across consecutive placements, extending the previous ownership-only unit evidence. The targeted browser probe and build passed; no runtime code changed for this verification extension.
