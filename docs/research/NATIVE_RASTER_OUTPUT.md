# Native raster output and vehicle lighting

The generic native raster path already multiplies raw texture bytes, material bytes and source prelight/lighting coefficients. The in-game Three renderer used sRGB output while the native model preview used linear output. This applied an extra nonlinear transfer only in the game: a controlled material channel of 64/255, texture channel of 200/255 and lighting of 0.5 produced framebuffer red 88 instead of the raw modulation result 25.

`nativeRasterOutput` removes that extra output transfer from generic native lit/unlit materials, the existing building base pass and native grass. It does not alter source texture storage, paint colors, vertex coefficients, sky, water or sprite adapters. Material alpha, framebuffer blending, fog and building dual-pass behavior remain separate. The existing browser sky and water adapters intentionally have their own display conversions.

This matches the raw-channel convention already used by the import preview and source raster arithmetic. [Microsoft's Direct3D 9 gamma documentation](https://learn.microsoft.com/en-us/windows/win32/direct3d9/gamma) separately documents sRGB texture reads and framebuffer writes as opt-in, both disabled by default. That API fact is supporting context, not proof of every retail driver, gamma-ramp, brightness-slider or post-effect configuration. No retail pixel-parity claim follows from this correction alone.

The browser regression renders actual pixels using the game's sRGB output mode. It checks raw native lighting/material/texture modulation, building output, half-alpha blending over a known background, and fog toward a known display color. The earlier implementation fails red 25 versus 88. Existing Gouraud lighting and imported building/vegetation checks remain in place.

## Greenwood ambient and wheel-contact lighting

Pinned gta-reversed commit `0076f9017b4aeef7433957ac2bd8b6988e9df166`:

- `Vehicle.cpp`: constructor calls SetCollisionLighting(0x48); CalculateLightingFromCollision (0x6D0CF0) sums the four decoded lighting values and divides by four.
- `Automobile.cpp`: wheel collision processing stores each accepted collision's lighting byte. The adapter retains the last accepted byte across frames without a replacement contact.
- `Physical.cpp`: GetLightingFromCol(true) combines the world ambient mean and contact brightness.
- `Renderer.cpp`: SetupLightingForEntity multiplies that value by 0.95 then adds 0.05 before applying generated point-light scaling.
- `app_light.cpp`: SetLightColoursForPedsCarsAndObjects scales the separate object/vehicle ambient and directional light.

The native car now owns its ambient uniforms. Its four collision-lighting bytes initialize to 0x48 and update from native wheel ray contacts; day/night decoding and summation follow the existing source helpers. Rendering supplies the native object ambient and contact-scaled directional multiplier. Generated point lights, brightness-slider additions, vehicle environment/specular effects and retail comparison remain incomplete.
