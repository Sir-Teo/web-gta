# Native sky geometry and integration contract

Research date: 2026-09-13. This describes the pinned reversed PC source, the initial browser mismatch and the implementation below. It is not a retail PS2 capture match.

## Evidence

- [Clouds.cpp, pinned revision](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Clouds.cpp): `CClouds::RenderSkyPolys` (0x714650) and `SetUpOneSkyPoly` (0x713060) contain implementations, rather than calls back into the executable. `RenderBottomFromHeight` is explicitly marked unreversed; do not equate these functions.
- [Clouds.h](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Clouds.h): named sky dimensions.
- [TimeCycle.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/TimeCycle.cpp): below-horizon day values and underwater mixing in `CalcColoursForPoint` (0x5603D0).

The remote Clouds.cpp was fetched again and matches the local research copy byte-for-byte: SHA-256 `c0505e68004f9006d07ced56e9a9086e5c42d1abed0ee69705d3b732b61d86f6`. Inspection file: `/tmp/web-gta-sky-clouds-pinned.cpp`.

## Geometry contract

The source takes camera position and forward direction, zeros the forward vertical component, and normalizes the horizontal direction. It builds a rectangular shell aligned to camera yaw, not camera pitch. All positions below are relative to the camera; browser coordinates use Y as up.

| Surface | Horizontal placement | Height | Vertex colors |
|---|---|---|---|
| Upper front band | 30 units forward, ±42 sideways | +15 to 0 | Sky top to sky bottom |
| Horizon band | Same front face | 0 to −3 | Sky bottom throughout |
| Lower front band | Same front face | −3 to −9 | Sky bottom to below-horizon color |
| Top cap | Front face to 30 units behind | +15 | Sky top throughout |
| Bottom cap | Front face to 30 units behind | −9 | Below-horizon color throughout |

Five quads produce 20 vertices and 30 indices. Each quad uses indices `[0,2,1,1,2,3]` relative to its start. Source rendering disables depth test/write, fog, texture and culling. Vertex alpha is disabled; each supplied vertex alpha is 255. This is an opaque background pass, not a scene-lit material.

An analytical sphere gradient is not equivalent: the front-band interpolation depends on the ratio of vertical displacement to horizontal **forward** displacement, not the normalized ray's vertical component. At the middle of the front face, height 7.5 corresponds to slope 0.25 and equal top/bottom vertex contribution. Off-center horizontal rays intersect the same plane; a radial elevation gradient changes that relationship. The flat horizon band and lower transition are also absent from the current sphere.

## Below-horizon color

Time sample hours are `[0,5,6,7,12,19,20,22,24]`, with the final hour wrapping to the first sample. The eight gray values are `[30,30,30,50,60,60,50,35]`. TimeCycle interpolates adjacent gray samples, mixes that result toward each sky-bottom channel using underwaterness, and casts each channel to a byte.

RenderSkyPolys then uses `max(clamp((cameraAltitude − 25) / 80, 0, 1), foggyness)` to blend toward sky bottom. Ground-level clear weather therefore preserves the day gray; altitude 65 gives an altitude contribution of 0.5, and altitude 105 gives 1. Foggyness can increase the blend independently. Camera altitude must be the original game altitude after imported-world origin conversion.

The reversed expression casts the signed color difference product to an unsigned byte before adding it to the existing byte. Negative differences and exact float-to-integer behavior need explicit reference verification before describing a JavaScript transcription as bit-exact. Do not silently replace it with round-to-nearest or a gamma-space conversion.

## Initial browser mismatch and implementation boundary

Before this implementation, `WorldLighting` drew a radius-500 sphere with `smoothstep(-0.03,0.38,direction.y)` between the sky colors. It embedded procedural sun contributions in that same shader. `LocalTimecycle` supplied display-decoded top/bottom RGB but no raw sky bytes, below-horizon gray, foggyness or underwaterness. Consequently, replacing the gradient alone would leave both the lower sky and interpolation contract wrong.

The implementation should introduce a native sky background with the five source quads, retained raw timecycle color channels, world-camera position and horizontal direction. Keep the authored background available when no native lighting is loaded. Derive below-horizon time samples using the existing native interval function, preserving its day-boundary behavior. Supply altitude, foggyness and underwaterness explicitly; until those systems exist, identify a supported dry-weather state instead of inferring these values from the fog distance.

Separate the procedural sun fallback from the background shader before switching the background. A native timecycle without an imported particle texture must retain its visible sun behavior. Textured sun, stars, fog and scene geometry must retain their established draw ordering and lifecycle. Avoid double drawing either sky or sun when the local lighting table is replaced or cleared.

Raw source vertex colors and their interpolation must be tested independently of display output. The current conversion to linear RGB before interpolation changes intermediate shades relative to interpolating byte values first. The intended output policy must be checked against the pinned renderer state and a retail capture; reproducing geometry does not establish color-space or original-display fidelity.

## Acceptance work before integration approval

1. Verify the five quads, color assignment and source dimensions numerically, including yaw rotation and parented-camera world coordinates. Looking up/down must not rotate the shell vertically.
2. Render diagnostic red/blue front bands with labeled sample rays: top, midpoint, horizon, flat horizon band, lower midpoint and lower edge. Test both center and off-center rays so a spherical approximation cannot pass by coincidence.
3. Verify below-horizon time boundaries, midnight interpolation, altitude 25/65/105, fog overriding altitude, underwater mixing and descending color channels. Preserve numerical uncertainties separately from the defined implementation policy.
4. Test narrow/wide viewports, camera roll/pitch limits, short far clips and the source shell's finite width. Do not silently stretch source geometry to hide unsupported field-of-view gaps.
5. Through the real lighting picker, compare the same Grove camera/time/weather before and after; test sun texture present/absent, clearing/replacing timecycle, pause and context restoration. Inspect screenshots for missing sky, seams, duplicate sun and foreground occlusion.
6. Obtain a matched original-platform capture before calling the resulting sky pixel-accurate. Clouds, moon, distant fog and weather transitions remain separate missing atmospheric systems.

## Implemented native background

`NativeSky` now creates the five source quads, follows camera world position and horizontal direction, and interpolates normalized raw byte colors. `LocalTimecycle.skyColors` retains the final source byte casts separately from the display-decoded colors used elsewhere. The fragment shader decodes the interpolated sky color before adding the existing linear-color procedural sun contribution, then applies the renderer's output conversion. This preserves source-domain interpolation without applying a second display conversion to the background. It defines the browser policy; original platform output and floating-point/byte-cast edge behavior remain unverified.

`nativeSkyColors` supplies day gray, altitude blending, and explicit foggyness/underwaterness inputs. `WorldLighting.skyWeather` currently defaults to zero for both, because the weather simulation is not connected. Selecting a foggy timecycle row does not yet simulate native foggyness. The source finite width and caps are retained; near-vertical camera direction retains the previous yaw when horizontal direction is degenerate. The vertex shader places depth at the far plane so short imported far clips do not remove the background. This clip policy is a browser adaptation, not established retail behavior.

The authored sphere remains the fallback without raw imported sky colors. Both backgrounds use the same `proceduralSkySun` shader function and shared sun uniforms; importing a native sun texture suppresses that fallback through the existing uniform path. Clearing the lighting table restores the authored background. Native geometry/materials are removed and disposed with WorldLighting.

Verification: 561 tests/115 files with native references and build pass. GPU checks sample upper/horizon/lower bands, both caps, center/off-center rays, camera yaw/translation, short far clip, green foreground occlusion and procedural sun contribution. A second GPU integration check verifies native activation, exact authored-background restoration and disposal. The real local-lighting picker test, native Grove walking/context/crouch lifecycle, and existing visible-sun check pass. Inspected `artifacts/native-grove-character.png`: the source sky is present behind imported geometry and the animated native character. Production smoke passes with no errors, no development hooks and no off-origin runtime requests.

Logs: `/tmp/web-gta-sky-{unit,build,browser,lighting-browser,production}.log`; direct GPU initial run `/tmp/web-gta-sky-browser-focused.log`. The full 72-test browser baseline predates this change; this change ran five distinct targeted browser checks. Matched retail screenshots, calibrated display conversion, connected fog/underwater weather, clouds/moon and complete atmospheric rendering remain outstanding.
