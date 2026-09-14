# Native constellation rendering

Research and implementation date: 2026-09-13. This replaces the random authored star field only when native lighting is active. It is partial source-based night-sky rendering, not original-platform pixel parity.

## Pinned source

[Clouds.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Clouds.cpp), `Render_MaybeRenderRockstarLogo`, transcribes the section at 0x713D2A–0x714019. It supplies nine constellation positions, repeats the first two on the opposite side, then adds a separate large star. The fixed world offsets follow camera position, not camera orientation. [Coronas.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Coronas.cpp) maps the shiny-star slot to `coronastar`, already supported by our particle dictionary loader.

Visibility is restricted to 22:00–06:00. Integer game minutes fade brightness up during hour 22 and down during hour 05. The source uses eleven small-star draws and one large-star draw, with separate random attenuation ranges. Its `colorRG` weather calculation is unused by the subsequent star draws in this pinned transcription; this implementation does not invent additional weather attenuation. That detail needs comparison against the executable before treating it as authoritative original behavior.

[Sprite.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Sprite.cpp) confirms that the supplied `(false,true)` projection arguments disable far clipping and retain near clipping. Both star draw functions themselves remain delegated to the executable, so exact buffer rasterization and sprite extents are not independently established by this source.

## Browser implementation

`nativeStars.ts` retains the source offsets/sizes with the native-to-browser axis conversion and minute-based brightness schedule. `NativeStars` projects the twelve screen quads with the existing native sprite metrics, bypassing far clipping while retaining the default near test. The shared projection helper keeps its previous default far-clipping behavior for existing callers.

Native lighting hides the authored random field and activates the constellation outdoors. Clearing native lighting restores the authored field; interiors suppress the native constellation. The quads are additive, do not write depth, and use far-plane depth to let scene geometry occlude them. This is a browser ordering adaptation to the source's earlier background pass, not a bit-exact recreation of its sprite buffer.

When a local particle dictionary has supplied `coronastar`, stars borrow its current texture from `LocalSunTexture` alongside the sun. Replacing/clearing the texture is observed on the next update; star disposal never disposes the borrowed raster. Without a texture, the constellation remains visible using a provisional soft disc. This preserves placement/timing while exposing the missing original raster rather than retaining 260 unrelated authored stars.

Twinkle uses the source attenuation formulas with a seeded browser random sequence. It advances only during active simulation rendering and freezes while paused. The original CRT random sequence, exact original frame cadence, sprite pixel boundaries, weather/cloud occlusion and original display conversion remain unverified. The large star's fallback disc is visibly broader than the small points and is not a substitute for its textured shape.

## Verification

All 565 tests/117 files with native references and build pass. Unit checks cover midnight wrapping, fade boundaries, integer minutes, source offsets, mirrored points, large-star size and attenuation endpoints. GPU checks verify a borrowed solid raster, fallback output, foreground occlusion, short far clips, opposite viewing directions, paused twinkle and ownership cleanup. WorldLighting integration checks native/authored replacement, interior suppression and restoration. Existing sky, lighting picker and day/night save/driving checks pass: six browser tests in 15.6 seconds.

Inspected `artifacts/native-night-sky.png`: a diagnostic dark native sky shows the fixed constellation with the fallback disc. It uses synthetic sky colors and no original particle texture; it is not a retail reference capture. Logs: `/tmp/web-gta-stars-{focused,unit,build,gpu,browser}.log`. Moon, clouds, streaks and complete weather-driven night rendering remain unfinished.
