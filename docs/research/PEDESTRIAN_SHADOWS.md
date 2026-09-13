# Pedestrian shadow rendering

## Evidence and current gap

The native character already casts Three shadow maps, but imported building materials use baked lighting through MeshBasicMaterial. They do not receive Three's directional shadow pass. Simply enabling receiveShadow on those meshes cannot fix the missing ground shadow.

The pinned [CPed::PreRender](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Entity/Ped/Ped.cpp) selects a dummy textured shadow or a real-time shadow according to FX quality, player status and shadow availability. [CShadows](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Shadows.cpp) reads `shad_ped`, calculates projection axes, supplies a four-unit depth range for pedestrian shadows and draws them separately on collision geometry. Real-time shadow registration uses a generated texture and SHADOW_INVCOLOR. Its light orientation uses the visible sun vector, independently of the fixed scene-illumination direction. Shadow strength depends on timecycle strength, camera distance, real-time intensity and receiving triangle day/night lighting.

The available `CastShadowEntityXY` and `CastShadowEntityXYZ` implementations are original-function trampolines. Their exact clipping, UV arithmetic and native floating-point behavior remain unestablished. The browser implementation below is an explicitly geometric replacement stage; it is not described as a complete reversed shadow pipeline.

## Implemented receiver geometry

`src/render/projectShadowReceiver.ts` accepts a COL triangle mesh, its world transformation and a horizontal projection footprint. The side half-axis maps to U and front half-axis to V. The footprint center supplies the upper height and a positive depth supplies the lower height. These are explicit API conventions; original raster orientation still needs calibration.

It transforms source triangles, rejects vertical/degenerate projected faces, reorients downward-wound faces, and clips each triangle against four footprint boundaries plus both height planes. Polygon triangulation preserves terrain slopes. UVs follow the original projection axes rather than stretching each clipped fragment. Output retains the original source face index and packed light byte per vertex, so receiver lighting can be evaluated independently of the character's foot-contact sample. Degenerate fragments are omitted. Invalid inputs and output-budget exhaustion throw before returning a partial result. Positions and UVs are converted to float32 for upload.

This stage is not yet called by the game renderer. It does not create a shadow texture, apply blend modes, add depth bias, select scene candidates, select shadow versus ordinary COL meshes, handle primitives/water, or reproduce native real-time shadow quality levels. No new visible shadow is claimed by this commit.

## Integration sequence

1. Use a spatial query over installed collision sources to select nearby receiver meshes; do not scan the entire imported scene each frame. Transform each selected source with its IPL placement matrix and clip into a shared bounded upload buffer.
2. Generate a skinned character silhouette render target using the source real-time shadow light orientation; verify its texture orientation and intensity against the original registration and render passes. Keep the dummy `shad_ped` path as a distinct native quality mode, once its raster is available.
3. Draw the projected shadow in a dedicated pass over the receiver geometry, applying per-triangle day/night attenuation and the appropriate blend mode. Verify depth bias, fog/order, overlapping receivers, stairs and airborne separation in real Grove Street captures.
4. Add resource ownership, scene replacement and context recovery checks before enabling the path by default.

## Verification

502 tests across 100 files and the production build pass. Five geometric tests cover complete footprint area and UVs, slope clipping at both depth boundaries, converted/translated native coordinates, shared-edge lighting metadata, overhangs/deep surfaces/walls, boundary-only intersections and allocation limits.

The optional real-data test opens the inspected `gta3.img`, selects `lae2_4.col`, parses `Lae2_landHUB04` and projects onto its largest upward-facing triangle. It verifies nonempty clipped geometry, footprint/depth bounds and exact source face/light relationships. No archive content is bundled or downloaded by the test. Run with `GTA_REFERENCE_DIR=/tmp/web-gta-noclip-world npm test`; without that variable, the real-data test skips. Logs: `/tmp/web-gta-shadow-receiver-{unit,build}.log`. Browser rendering was not tested because this stage is not yet integrated into a draw pass.

## Spatial selection and actual road winding

`nativeShadowReceivers` now queries Rapier's broad phase using the horizontal footprint's enclosing AABB and its vertical depth interval. Call it after physics synchronization. It selects installed, enabled, nonsensor mesh colliders on fixed bodies, then projects with each source's IPL matrix. Unknown, primitive, moving and removed geometry is excluded. Stable collider-handle order supports reproducible uploads. Candidate count, total inspected source triangles and total emitted vertices share query-wide limits (256/100000/65535 by default); exhaustion throws rather than returning a partial shadow. These are browser budgets, not claimed native limits. The scene exposes this through `shadowReceivers` and rejects calls after disposal.

Real Grove testing exposed an invalid initial assumption: its supporting `lae2_roads89` collision triangle is hit on the back face (Rapier feature 144 for a 100-triangle mesh, hence source face 44). Rejecting downward winding produced zero output despite valid ground. Projection now accepts either nonvertical winding and emits upward-facing triangles while preserving face indices, lighting bytes and UVs. This is verified asset behavior; it does not establish every native casting routine's culling rules.

At the known Grove spawn the final query selects 3 candidate meshes, inspects 282 source triangles and emits 24 vertices across `lae2_roads89` and `carlshou1_lae2`. It does not scan the 469 visual placements. The development-only `shadowReceiverProbe` samples this explicitly on demand, not each frame. Diagnostics are recorded in `/tmp/web-gta-grove-shadow-receivers.json`. Candidate selection is now connected to installed scenes; automatic texture generation, blend/render submission and primitive/shadow-mesh policies remain unfinished, so this still adds no visible game shadow.

Verification: 505 tests across 101 files with local reference data, build, and strengthened real Grove browser audit pass. New checks cover nearby/distant selection, sensors, moving and unknown bodies, removal, global budgets, double-sided road winding and disposed-scene rejection. The browser asserts both nonempty receiver output and the known road's back-face support. Logs `/tmp/web-gta-shadow-selection-{unit,build,browser}.log`. Initial real-scene failure and correction are retained here because they explain the winding policy.
