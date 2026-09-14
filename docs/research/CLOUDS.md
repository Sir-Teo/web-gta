# Low-cloud source and asset integration contract

Research date: 2026-09-13. Low-cloud rendering is not implemented yet. This closes the source/texture acquisition questions needed for the next renderer change; high clouds, moving fog and moon are separate systems.

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
