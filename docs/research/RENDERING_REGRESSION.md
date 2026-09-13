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
