# Weather factors: evidence and current approximation

Research date: 2026-09-13. The static local timecycle selector now supplies sky foggyness using Euryopa's documented viewer behavior. This is not a reconstruction of the complete San Andreas weather simulation.

## Source boundary

Pinned [San Andreas Weather.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Weather.cpp) delegates `CWeather::Update` to executable address 0x72B850. Its header exposes both `Foggyness` and `Foggyness_SF`, but does not establish how they are calculated. `Clouds::RenderSkyPolys` consumes the former; `MovingFog_GetFXIntensity` consumes the latter. They must not be conflated. Search results for reversed GTA III/VC weather code are related-game evidence, not a San Andreas implementation.

Euryopa, the independent SA world viewer in librwgta, provides a bounded alternative:

- [Weather definitions](https://github.com/aap/librwgta/blob/eb06ee545af46298696532b6f394cf83ac1337c3/tools/euryopa/euryopa.cpp) mark SA weather 9 (foggy San Fierro) and 19 (desert sandstorm) with the Foggy flag. Other SA entries lack that flag.
- [Viewer weather update](https://github.com/aap/librwgta/blob/eb06ee545af46298696532b6f394cf83ac1337c3/tools/euryopa/timecycle.cpp) weights old/new fog flags by one minus interpolation and interpolation respectively. A static selection consequently produces either zero or one.

Inspected remote files were pinned to revision `eb06ee545af46298696532b6f394cf83ac1337c3`:

| File | SHA-256 |
|---|---|
| euryopa.cpp | `4b8841011ee4d2a62b135fe1831e9efe2ec9f181da4078e15b360d8ad706ddb7` |
| timecycle.cpp | `cfe75a04dc148b6d448de1468e057100aefb5c8f05edc04521d1a6000cb2624e` |

Inspection copies: `/tmp/web-gta-euryopa-main.cpp` and `/tmp/web-gta-euryopa-timecycle.cpp`. This behavior is encoded independently in the small `viewerFoggyness` adapter; no external runtime dependency or server is introduced.

## Integration and limits

`LocalTimecycle` returns `skyFoggyness` with each cached color sample. Changing weather invalidates the cache. `WorldLighting` forwards this to the existing below-horizon blend, independently of geometric fog start/end. A missing geometric fog range does not erase the sky weather factor. A caller without the optional value retains the explicit runtime factor fallback.

The adapter includes blend support for future old/new weather input, but the current selector uses static weather. It does not schedule weather transitions or implement region lists, San Fierro moving fog, rain, sand particles, wet roads, wind, clouds, sun suppression or underwater detection. Selecting the underwater timecycle row alone does not establish actual underwaterness. Original weather update code or matched runtime measurements are still needed to replace the viewer approximation and validate intermediate values.

Verification: 563 tests/116 files with native references and build pass. Unit coverage checks all 23 flags, blended endpoints, cache invalidation and independence from fog distance. Three browser checks pass: real lighting-picker selection/replacement/clear, sky geometry GPU probe and WorldLighting sky integration. The latter observes below-horizon pixels change from `[60,60,60]` to `[0,0,255]` for a diagnostic blue horizon at full fog, then return exactly when cleared. This demonstrates the connection; it is not a retail weather comparison. Logs: `/tmp/web-gta-weather-{focused,unit,build,browser}.log`.
