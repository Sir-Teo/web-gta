# Imported rendering regression baseline

Verified code commit `aec93d6` after native character shadow integration, collision-facing corrections and ordinary exterior alpha/depth changes. No runtime edits were made during these runs.

## Full browser run

Command: `GTA_REFERENCE_DIR=/tmp/web-gta-noclip-world npm run test:browser`

Result: **70 passed, no failures or skips**, in 2.8 minutes. Local reference inputs enabled the actual Grove, FAM1 and native terrain cases. The source assets remain outside the repository.

The suite covers:

- Movement, driving, camera controls, crouching, health/recovery, saves, pause and audio failure paths.
- Graphics-context recovery and preservation of simulation state.
- Local IMG/TXD/DFF/IFP/IDE/IPL/COL loading, dependency resolution, replacement, cancellation and malformed-input recovery.
- Timed native-scene visibility, LOD transitions, collision walking and stable GPU geometry residency.
- Character replacement, animation binding, source root motion and native FAM1 shadow framing.
- Native texture sampling, fog, lighting, building alpha passes, exterior alpha thresholds, projected shadow composition and renderer-state restoration.

The 37.3-second native-scene test intentionally waits for a time-of-day visibility transition through the real game clock. It completed without extending its configured timeout. Log: `/tmp/web-gta-rendering-full-browser.log`.

## Production build and smoke

Command: `npm run test:production`

Result: passed. The generated static build boots and supports the checked workshop, native character/animation, imported scene, texture binding, archive scene assembly, local lighting, local sun texture and local object-data flows. The loading shell remains available while physics is deferred. Development observation hooks are absent and all observed runtime requests remain on the static site's origin. No runtime/console errors were recorded.

Environment: Chrome 152.0.7977.83, ANGLE Metal on Apple M5 Pro, 1440×900 viewport. Report: `artifacts/production-smoke.json`; log: `/tmp/web-gta-rendering-production.log`. This is one browser/GPU combination, not cross-device certification or a frame-time benchmark.

## Limits and next work

Passing regression tests establishes the covered behavior and recovery paths. It does not establish original-game parity, complete world streaming, CJ assembly, campaign/mission compatibility, or all weapon, police, population and vehicle systems. Source-derived lighting/rendering currently combines verified San Andreas rules with explicitly labeled related-source candidates. Matched original-platform captures, foliage sampler provenance, full render-queue ordering and broader performance measurements remain outstanding.

The preceding unit run on the same runtime changes passed 537 tests across 111 files. It is recorded in `/tmp/web-gta-world-alpha-final-unit.log`; this documentation-only baseline does not require another identical unit run.

## Post-collider full regression

Verified runtime commit `58c957c` after source/placement allocation rollback, native player alpha/depth policy, shadow near-clip bias, root-bone attenuation, paused raster reuse, inactive HUD cleanup and player collider synchronization.

Full browser command: `GTA_REFERENCE_DIR=/tmp/web-gta-noclip-world npm run test:browser`. Result: **72 passed, no failures or skips**, in 2.8 minutes. This includes the expanded Grove context-loss/paused-cache/crouch/replacement lifecycle, the new perspective shadow-depth and player-alpha GPU checks, timed imported-scene visibility, and ordinary gameplay/save/recovery paths. No runtime edits were made during the run. Log: `/tmp/web-gta-post-collider-full-browser.log`.

Production command: `npm run test:production`. Result: passed. Fresh report `artifacts/production-smoke.json`, checked at 2026-09-13T23:47:10.908Z, records no errors, no development hook and no off-origin runtime requests. Local lighting/sun/object-data, archive/model/scene assembly and native character/animation workflows all passed their smoke assertions. Inspected `artifacts/production.png`: the authored scene and HUD render, with the inactive decorative armor/stars absent. Log: `/tmp/web-gta-post-collider-production.log`. Environment remains Chrome 152.0.7977.83, ANGLE Metal Apple M5 Pro, 1440×900.

The preceding unit run covering this runtime passed 551 tests/114 files (`/tmp/web-gta-player-collider-unit.log`). This documentation-only update does not repeat it. Full browser and production regression success does not establish retail pixel parity, full gameplay completeness, or performance/cross-device certification. The limits listed above remain in force.

## Actor-query combined regression

Verified runtime `b631fff`, including vehicle/resident collider propagation and current-actor queries for camera, standing, door clearance and traffic. Full browser command `GTA_REFERENCE_DIR=/tmp/web-gta-noclip-world npx playwright test` passed all 72 checks, no failures/skips, in 2.8 minutes. No runtime/test edits occurred during the run. Log: `/tmp/web-gta-current-full-browser.log`.

`npm run test:production` passed. The report at `artifacts/production-smoke.json`, checked at `2026-09-14T00:09:55.520Z`, reports no errors, no development hook and no external runtime requests. Environment: Chrome 152.0.7977.83, ANGLE Metal Apple M5 Pro, 1440×900. Inspected `artifacts/production.png`: the authored neighborhood, character and HUD render; this image does not test the proposed native sky replacement. Log: `/tmp/web-gta-current-production.log`.

The preceding unit run passed 558 tests/114 files with native references (`/tmp/web-gta-traffic-query-unit.log`). Current actor-query correctness is limited to the covered APIs: internal suspension/character-controller broad-phase timing remains open. Native sky source research is recorded separately in `SKY.md`; no new sky renderer is included in this baseline.
