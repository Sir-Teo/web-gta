# Native texture sampler audit

Inspected 2026-09-13 after the combined Grove/character capture showed speckled foliage and fences. This investigation found an independent sampler translation bug; it does not establish that correcting those modes removes the observed foliage artifacts.

## Verified mode mapping

The pinned [RenderWare filter enum](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/RenderWare/rw/rwplcore.h) distinguishes per-texel interpolation from interpolation between mip levels. The [librw OpenGL conversion tables and setFilterMode](https://github.com/aap/librw/blob/master/src/gl/gl3device.cpp) independently specify the corresponding GL filters and use the non-mip table when the raster has no generated or additional mip levels.

| RW mode | Minification with stored mip levels | Magnification / single-level minification |
|---|---|---|
| 1 NEAREST | Nearest | Nearest |
| 2 LINEAR | Linear | Linear |
| 3 MIPNEAREST | Nearest texel, nearest mip | Nearest |
| 4 MIPLINEAR | Linear texels, nearest mip | Linear |
| 5 LINEARMIPNEAREST | Nearest texel, linear mip interpolation | Nearest |
| 6 LINEARMIPLINEAR | Linear texels and mip interpolation | Linear |

`nativeTexture` previously swapped modes 4/5 and their magnification behavior. The unit test repeated that incorrect table. Both are corrected; tests now also check magnification and single-level fallback. Unknown modes retain the existing linear fallback. Source pixels, stored mip levels and addressing stay intact; this change does not generate replacement mipmaps.

The browser GPU probe samples a red/blue base image and a green mip at explicit LOD 0.25. Mode 4 yields approximately `[128,0,128,255]`; mode 5 yields `[0,64,191,255]`. It also checks magnification and textures without lower mip levels. These independent pixel expectations distinguish the two modes rather than merely checking Three.js enum values.

Validation: 486 unit tests/97 files, build, `tests/browser/sampler.spec.ts`. Logs `/tmp/web-gta-sampler-{unit,build,browser}.log`.

## Foliage evidence and remaining uncertainty

The actual Grove scene audit found source filter 1 on `newtreeleaves128`, `planta256`, `kbtree4_test`, and several tree bark/leaf rasters. The corrected modes 4/5 do not change those textures. The source archive's precise retail provenance remains unverified.

Current [librw Texture::streamRead](https://github.com/aap/librw/blob/master/src/texture.cpp) retains a dictionary texture's sampler when lookup adds a reference to an existing texture. This supports preserving the resolved TXD sampler in the inspection path. It does not prove that every original game pipeline leaves that sampler untouched.

Noclip's [GTA renderer](https://github.com/magcius/noclip.website/blob/master/src/GrandTheftAuto3/render.ts) uses bilinear texture sampling and may generate missing mip levels. Its smoother appearance therefore cannot by itself prove that the source TXD filters should be overridden for original-game fidelity. A reference-platform comparison is still needed before changing point-filtered foliage, alpha thresholds, mip generation or anisotropy globally.

Local evidence: `/tmp/web-gta-world-alpha.json` lists sampled model/texture filter and alpha metadata; `/tmp/web-gta-world-alpha.local.test.ts` is the temporary scene audit, removed from the ordinary suite. Source excerpts are retained at `/tmp/web-gta-librw-gl3device.cpp` and `/tmp/web-gta-noclip-render.ts`. No downloaded native data is bundled.

## Ordinary exterior alpha follow-up

The next audit found a separate render-state mismatch rather than evidence for a sampler override. Ordinary imported materials with texture alpha disabled depth writes and normally used a near-zero alpha threshold. The inspected source's ordinary exterior non-road pass uses reference 140, with a strict greater-than comparison and depth writes. The playable placement path now applies that policy; details and pixel tests are recorded in `BUILDING_ALPHA.md`. Point-filtered foliage still looks speckled in the updated Grove screenshot. This change does not establish that source texture filtering, mip availability or reference-platform appearance is correct, and it does not override source samplers.

## Archive-wide extension and DFF/TXD comparison

A new read-only audit (`scripts/research/audit-texture-samplers.py`) inspects the local public reference IMG without extracting assets. Run `python3 scripts/research/audit-texture-samplers.py /path/to/gta3.img`. The recorded metadata is `texture-sampler-audit.json`: 2,750 dictionaries, 25,995 native textures, no texture extension subchunks, and 40 leaf/plant-name raster records. Thus ignored anisotropy extension data does not explain this archive's visible foliage artifacts. This result describes the available noclip archive, whose retail provenance is still unverified.

All three texture references in `veg_bevtree2.dff` request filter 2 (linear), with sampling word 0x11102. In `gta_tree_bevhills.txd`, `newtreeleaves128`, `planta256` and `kbtree3_test` instead store filter 1 (nearest), only one mip level, and no extension overrides. The same leaf name in other dictionaries has different filtering: e.g. `newtreeleaves128` is linear in `des_trees.txd` and trilinear in `des_dinerw.txd`. Texture names alone cannot determine the intended sampler.

Pinned [librw texture.cpp](https://github.com/aap/librw/blob/18532c2e13efbc1aa43f0b00b4459831f9414de0/src/texture.cpp#L332) adds a reference for dictionary lookup, then applies the material stream's sampler only when the resulting texture reference count is one. Native dictionary textures begin with one reference, so a lookup normally produces two and preserves the dictionary sampler. The exact pinned file was fetched and compared with the inspected source. Its anisotropy reader consumes a separate plugin payload, absent from the audited archive. This supports the present related-renderer behavior but is not proof of the original San Andreas executable's texture-read semantics.

No runtime filter override was introduced. The next discriminating evidence is the original game's `RwTextureStreamRead`/dictionary reference handling or a matched reference capture with sampler inspection. A smoother bilinear rendering alone would not settle which metadata wins. Audit validation: the script completes against the full reference IMG, reports all three known Grove tree material samplers and all 40 leaf-name rasters, and writes metadata only. Existing browser/production results are unchanged by this research-only commit.
