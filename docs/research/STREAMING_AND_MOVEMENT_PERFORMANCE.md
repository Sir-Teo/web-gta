# Streaming and basic movement — September 16, 2026

The map still uses native IMG/DFF/TXD/IDE/IPL/COL content. This pass changes how it is loaded and fixes two native weapon movement rules.

## Loading

`readScene` now overlaps four model reads and consumes their results in source order. Concurrent requests for the same dictionary share one promise and byte identity, retaining texture decode sharing. The window bounds decoded results waiting for validation; failed requests settle outstanding work. Model lookup uses an archive-name index.

The world worker retains its model-reading cache between regions. Cache identity includes the archive and exact supplemental dictionary files. An LRU budget accounts for source bytes plus decoded mip pixels (64 MiB); it does not claim to bound the entire browser heap, in-flight payloads, or installed GPU textures. Geometry and archive chunk budgets remain separate.

A local Chrome worker probe loaded native XY (2495,-1687), (2570,-1687), then (2495,-1687), with radius 180. Before/after region milliseconds were 1966/1831, 1276/984, 1230/919. Counts remained 238/201/238 models and 550/426/550 placements. These single samples measure local worker request-to-response latency, not remote download performance or frame rate. Raw outputs: `artifacts/stream-before.json` and `artifacts/stream-after-cache.json`.

## Animation frame cost

The Chrome CPU profile found `SkinnedMesh.computeBoundingSphere` and `applyBoneTransform` consuming substantial time during ordinary rendering. `bindAnimation` invalidated the sphere every sample. Three.js computes a missing sphere for depth sorting even when `frustumCulled` is false (`WebGLRenderer.js`, installed package).

Animated meshes now supply the DFF morph-sphere center for sorting and an unbounded radius for conservative ray rejection. This preserves the existing disabled animation culling and avoids skinning every vertex for sorting. Exact box/sphere computation remains available through `updateBounds`; restoring the pose restores normal bounds/culling. A diagnostic ray test verifies identical triangle hits before and after exact bounds computation. This is a browser adapter optimization, not a replacement for native occlusion.

The sorting skinning functions disappeared from the dominant entries in the follow-up CPU profile. Both five-second Grove samples sustained roughly 60 frames/s at 1440×900 on this machine; no claim of a frame-rate increase on this already-vsync-limited view is made.

## Native movement

[PlayerControlZelda, pinned gta-reversed source](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Tasks/TaskTypes/TaskSimplePlayerOnFoot.cpp) checks the standard weapon-info row when deciding whether to initiate sprint/jump. Heavy weapons prevent both; targeting prevents jumping. `nativeWeaponMovement` applies these checks before animation selection, using the packaged weapon.dat. Swimming keeps its separate input rules.

`ControlButtonSprint` and `SetRealMoveAnim` remain executable calls in this pinned source. The browser's existing exhaustion hysteresis and gait blending are therefore still approximations; this pass does not claim to replace them with native algorithms.

## Verification

The full unit run passed 1003 tests (41 reference-dependent skips), and the build passed. Browser checks passed for the new weapon movement rules, walking through terrain replacement, weapons/arsenal/reloading, and repeated terrain loading. The repeated-window check hashes geometry, texture metadata and raw mip bytes across cold and warm loads; decoded content is identical and all reported residency budgets hold. The first version of that test attempted to JSON-encode raw mip arrays and exceeded the string-size limit; hashing the pixel bytes directly fixed the test harness.

Screenshots inspected: `artifacts/game-performance.png` (Grove idle) and `artifacts/native-movement-sprint.png` (native sprint). The optional externally supplied pedestrian-reference fixture was unavailable and skipped.

Production verification also passed: native world loading, walking, car entry/exit, map waypoint, pause/resume, aircraft takeoff and landing gear, with no browser exceptions or failed requests. Its obsolete exit-message assertion was replaced with an actual on-foot aiming check; the native exit sequence no longer publishes that old message. Cross-district loading (Los Santos, countryside, San Fierro) passed as well.
