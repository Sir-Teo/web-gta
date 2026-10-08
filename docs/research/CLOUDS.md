# Low-cloud source and asset integration contract

Research date: 2026-09-13. The source survey and initial integration contract are followed by the implemented low-cloud layer below. High clouds, moving fog and the moon are separate systems, since added outside this document: `CClouds::VolumetricCloudsRender` (`src/render/NativeVolumetricClouds.ts`, `src/world/nativeVolumetricClouds.ts`), moving fog (`src/render/NativeMovingFog.ts`) and the moon (`src/render/NativeMoon.ts`).

## Source and verified raster

Pinned [Clouds.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Clouds.cpp) resolves `cloud1` from the particle dictionary in `CClouds::Init`. `Render_RenderLowClouds` transcribes the section at 0x714019–0x71422A. Its rotated buffered sprite renderer is still delegated, so exact sprite rasterization/roll conventions remain unverified.

The public viewer's [loader](https://github.com/magcius/noclip.website/blob/master/src/GrandTheftAuto3/scenes.ts) explicitly fetches particle dictionaries from `models/particle.txd`. The [SA particle dictionary](https://z.noclip.website/GrandTheftAutoSanAndreas/models/particle.txd) was downloaded outside the repository and parsed successfully by the existing TXD reader:

- 650,536 bytes; SHA-256 `307f1e9c6d8f842c01bcc8d0fb406d1012072aa65d7e9a7d1144edc09cad44fd`.
- 34 textures. `cloud1`: 64×64 XRGB8888, one mip, no alpha, filter 1, wrapping U/V.
- The file also contains `coronastar` (128×128 XRGB8888), `coronamoon` (64×64 XRGB8888), `lunar` (32×32 ARGB8888), and `cloudmasked`/`cloudhigh` (64×64 ARGB8888).
- Inspected decoded `cloud1` and `coronastar` PNGs. Both are bright RGB imagery over black, consistent with their additive use. Alpha-mask textures must not be substituted for these rasters.

Inspection files: `/tmp/web-gta-particle-reference.txd`, `/tmp/web-gta-particle-report.json`, `/tmp/web-gta-particle-cloud1.png`, `/tmp/web-gta-particle-coronastar.png`. The source edition and byte equality to a retail installation are not established. The native file and extracted imagery are not bundled into the repository/build.

## Placement and color

The twelve source direction triples are `(1,0,0)`, `(.7,-.7,1)`, `(0,-1,.5)`, `(-.7,-.7,0)`, `(-1,0,1)`, `(-.7,.7,.3)`, `(0,1,.9)`, `(.7,.7,.4)`, `(.8,.4,1.3)`, `(-.8,.4,1.4)`, `(.4,-.8,1.2)`, `(-.4,-.8,1.7)`.

For each triple, source horizontal coordinates are camera XY plus direction XY times 800. Vertical position is direction Z times 60 plus 40. The source explicitly zeros the camera's vertical component, so cloud heights are fixed in world space: 40–142 units. Preserve this behavior and test it at elevated viewpoints; following the camera vertically would be a different model.

Projection disables far clipping and retains near clipping. Projected width/height scales are multiplied by 320/40, then the sprite renderer consumes camera roll. The surrounding Clouds pass uses additive blending and disables depth testing/writes. A browser implementation must reproduce foreground occlusion through draw ordering, with any depth adaptation documented as for the current constellation.

RGB comes from the timecycle low-cloud channels, cast to bytes and attenuated by `max(Foggyness, CloudCoverage, ExtraSunnyness)`. This is the low-cloud layer's rule; it must not be simplified to “more cloudy weather means more of this layer.” Other cloud layers are responsible for different weather appearances. The pinned function does not use CloudRotation in its positions, despite CClouds updating that global elsewhere.

## Implementation boundary

Extend the particle decoder to resolve `cloud1` alongside the required `coronastar`, preserving names, native mips and sampler metadata. Keep missing cloud data explicit; a sun-only dictionary should remain usable. The session owner must prepare both GPU textures before swapping either, dispose partial allocations on failure, retain the old pair on invalid replacement, and release canceled work. Existing sun/star consumers continue borrowing the sun texture; a low-cloud renderer borrows the cloud texture.

Retain raw low-cloud RGB in LocalTimecycle, separately from display-decoded lighting. The Euryopa weather approximation already used for sky fog has source flags for sunny/extra-sunny/cloudy behavior, but those remain viewer approximations until the original weather update is established. Keep that provenance explicit when supplying cloud attenuation.

The first renderer should use the actual `cloud1` raster and all twelve source placements, with camera-world position, roll, native size FOV and altitude handled explicitly. Missing raster means no native low-cloud layer, not a generated substitute. The existing file picker should report whether optional cloud data was loaded so the absent layer is understandable.

Acceptance must cover partial texture ownership/cancellation, sun-only replacement, raw color retention, clear/extra-sunny/cloudy attenuation, near/far projection, camera roll/aspect, altitude-independent cloud heights, foreground occlusion, pause/context restoration and comparison with a known reference camera. A synthetic GPU fixture verifies the math; this real raster verifies ingestion and visible content. Neither establishes retail pixel parity on its own.

## Implemented layer

The particle worker now resolves `cloud1` optionally alongside required `coronastar`. `LocalSunTexture` prepares both GPU textures before committing the pair. A failed cloud allocation disposes the newly prepared sun raster and retains the previous pair; sun-only replacement releases the old cloud. The picker reports whether the cloud raster was found and confirms that clearing the particle selection removes low clouds. Native assets remain local inputs, not build dependencies.

`LocalTimecycle.lowClouds` retains raw byte RGB and a separately named viewer-derived visibility factor. Euryopa's static flags produce visible low clouds for weather indices 1, 3, 5, 10, 14 and 18, and suppress this layer for the other entries. This implements the max-of-factors rule for that viewer approximation; it is not a complete original weather model.

`NativeLowClouds` uses all twelve source positions, fixed world heights, the existing source sprite projection with far checking disabled, and the 320/40 size factors. RGB is truncated after attenuation and emitted through an additive raw-color shader. The raster retains its native sampler/mips. No raster means no low-cloud layer; interiors and missing native timecycle data also hide it. The layer borrows the owner texture and disposes only its own geometry/materials.

Camera roll is derived from world camera right/up vectors and applied with pixel-aspect correction. The quads use far-plane depth and read the scene depth buffer to reproduce foreground occlusion within Three's transparent pass. These roll/depth choices and sprite extent mapping remain browser adaptations until compared with original raster output. Each visible cloud currently has a separate draw; original buffering and further batching are not reproduced. No artificial wind motion is added to this source placement function.

Verification: 571 tests/118 files with native references and build pass. Unit coverage includes optional/missing texture selection, pair rollback, sun-only replacement, weather flags/raw RGB, fixed heights under rising camera and borrowed ownership. GPU coverage includes raw tint, the rotated rectangular pixel footprint, foreground occlusion and missing-raster removal. The real public particle file passes through the worker into WorldLighting and renders `cloud1`; clearing removes the layer and changes the sampled output. Inspected `artifacts/native-low-clouds.png`, captured using the verified raster with diagnostic sky/color settings. Its stretched cloud bands and point sampling are visible; it is not a retail screenshot comparison.

Nine targeted browser checks pass: cloud/picker/reference tests plus Grove, sky, star and sun-texture regressions. Production smoke passes with no errors, no development hooks and no external runtime requests. Logs: `/tmp/web-gta-clouds-{focused,unit,build,browser-final,regression-browser,production}.log`. The optional real-raster browser check requires `GTA_PARTICLE_REFERENCE=/path/to/particle.txd`; it skips when no local reference is supplied. Original weather, high clouds, cloud-context recovery coverage, batching and calibrated retail output remain unfinished.

## Independent sprite-size cross-check

Pinned Euryopa [Sprite.cpp](https://github.com/aap/librwgta/blob/eb06ee545af46298696532b6f394cf83ac1337c3/tools/euryopa/Sprite.cpp) implements `RenderBufferedOneXLUSprite_Rotate_Dimension`: unrotated screen coordinates span center ± width and center ± height. It rotates those pixel offsets using cosine/sine before clipping. `CalcScreenCoors` supplies viewport width/depth and height/depth, each multiplied by 70/FOV. This independently supports the current half-extent mapping and pixel-aspect correction; the source-derived 320/40 factors are not full sprite dimensions.

At [the same revision](https://github.com/aap/librwgta/blob/eb06ee545af46298696532b6f394cf83ac1337c3/tools/euryopa/Clouds.cpp), the viewer aliases all three low-cloud texture slots to `cloud1` for SA. Its background routine hardcodes `ms_cameraRoll = 0`, so this viewer cannot establish the original SA camera-roll convention. The sprite implementation also applies `(channel * intensity) >> 8`; its caller supplies 255. That one-byte modulation difference from our raw tint remains an unresolved original-game rasterization question, not a reason to silently copy every viewer behavior into the native contract.

Added GPU checks at 384×256 and 256×384 with a 30-degree camera bank. Each isolates one cloud and scans its rendered pixel bounds against the independent pixel-space half-extent formula using its known world depth. This exercises the cross-axis aspect factors that a square viewport cannot validate. These checks confirm geometry within two pixels, not original-game roll direction, texture filtering, color modulation or retail pixel parity. No runtime change was needed.

Validation: build passes; all four low-cloud browser checks pass with the optional public particle file supplied (2.5 seconds). Logs: `/tmp/web-gta-cloud-aspect-build.log` and `/tmp/web-gta-cloud-aspect-reference.log`. This commit changes research and regression coverage only.
