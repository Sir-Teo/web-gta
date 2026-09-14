# Acquired San Andreas water topology

The public [water.dat](https://z.noclip.website/GrandTheftAutoSanAndreas/data/water.dat), listed by the [pinned scene manifest](https://github.com/magcius/noclip.website/blob/75086f2350cb6f320023931d6d73f20f5c6bbc32/src/GrandTheftAuto3/scenes.json), is now parsed and exported for inspection. It remains local content, not a bundled asset or an implemented gameplay water system.

## Verified file and geometry

- File size: 70,099 bytes; SHA-256 `1562bc86766ce595d7513f3ca3ae3fc4147b574c8c4e703fe6a76678507969bf`.
- `processed` header, 307 polygons: 301 quads and 6 triangles.
- 1,222 per-polygon vertices, triangulated into 608 faces.
- Source vertex heights range from -5 to 1082.72998. Elevated records must not be flattened into a sea-level surface or assumed to belong to the exterior near the player.
- Flag counts: 0 on 2 polygons, 1 on 284, 3 on 21. These values are preserved; the classification follow-up below records their source-derived visibility/depth interpretation.

`readWater` retains each vertex's native XYZ, XY flow, big-wave value and small-wave value, plus polygon flags and source line. It accepts three/four seven-value vertices with an optional trailing unsigned flag. Blank lines/comments and the processed header are supported; malformed rows fail explicitly instead of dropping portions of the map.

The field interpretation agrees with the NOTSA `LoadDataFile` helper in [the pinned reversed WaterLevel.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/WaterLevel.cpp). That helper is explicitly a reconstruction, not proof of the original loader's exact acceptance rules. It casts XY positions to integers and flow to signed bytes after multiplying by 64; our content representation preserves the raw values so any runtime quantization can be implemented explicitly later.

The independent [Noclip water reader](https://github.com/magcius/noclip.website/blob/master/src/GrandTheftAuto3/water.ts), inspected on 2026-09-13, supplies the quad triangulation `[0,1,2,2,1,3]`. The source quad order is two rows, not perimeter order. `waterGeometry` converts coordinates to browser Y-up `(x,z,-y)` and preserves topology. It does not add UV assumptions, waves, opaque ground collision or a global ocean plane.

## Inspectable content outputs

Run `node scripts/content/audit-water.mjs /absolute/content-directory` after acquiring `water.dat`. It writes:

- `water-inspection/water.json`: complete polygon data, source hash, flags, flow/wave fields and summary.
- `water-inspection/water.obj`: static Y-up mesh for Blender/other geometry inspection; the JSON sidecar retains fields OBJ cannot represent.
- `water-inspection/water.svg`: north-up plan of the acquired polygons. Blue means every vertex is within one unit of sea level; amber marks other heights. Background is unclassified, not generated land. It displays all recorded flags and heights, without claiming original visibility behavior.

The current files are in `/Users/teo/Developer/web-gta-content/water-inspection`. Inspected the SVG rendered to `artifacts/native-water-atlas.png`: it reveals river/coastline polygon chains and separate elevated patches. It is a data diagnostic, not original radar art or a final game-water material.

Validation: three focused tests pass, including the actual acquired file. Synthetic coverage checks triangle/quad order, elevated/sloped coordinates, flow/wave retention, optional flags and malformed-row rejection. Build passes. Logs: `/tmp/web-gta-water-{audit,tests,build}.log`.

Next integration requirements remain: limited-depth behavior, camera/spatial applicability, water texture selection and native material behavior, wave/flow animation, visibility/region composition, height queries, swimming/buoyancy and waterline collision behavior. No gameplay-water completeness claim follows from this topology export.


## Source visibility and interior classification

The pinned `AddWaterLevelQuad` and `AddWaterLevelTriangle` set invisible when `(flags & 1) == 0`, and limited depth when `(flags & 2) != 0`. [CWaterPolygon in WaterLevel.h](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/WaterLevel.h) considers a polygon interior when the first stored vertex's height is strictly greater than 950. `DoMarkToBeRendered` requires visible water and an interior/exterior match; camera/block visibility still imposes further runtime requirements.

The first stored vertex can differ from the first file vertex. Quad insertion sorts by Y then X; triangle insertion puts the pair sharing a Y coordinate first, ordered by X. `waterProperties` follows that classification order and compares single-precision height at the strict threshold. It preserves unknown flag bits and does not pretend limited-depth behavior is implemented.

The acquired file contains **304 visible exterior polygons, one visible interior polygon, two invisible polygons, and 21 limited-depth polygons**. `visibleWaterPolygons` supplies separate surface sets, and the audit writes `water-exterior.obj` and `water-interior.obj` alongside the complete original export. The two invisible polygons remain in `water.json` and `water.obj`; they are excluded only from the visible sets. This avoids accidentally putting the elevated interior surface into the exterior scene.

Five focused tests pass, including the real file, independent visibility/depth bits, the strict 950 boundary, float rounding at that boundary, and reordered quad/triangle vertices. Build passes. The reader/exporter is ready for rendering integration, but no waves, water material, swim collision or gameplay water are added by this change. Logs: `/tmp/web-gta-water-visibility-{audit,tests,build}.log`.

## In-game static surface integration

`LocalWater` now displays imported geometry in the game. Open **Lighting → Water surfaces**, select `water.dat`, and load a local timecycle. The source water RGB and alpha drive an untextured transparent material; imported exterior/interior visibility follows the flag/height classification above. Clearing the timecycle hides water until lighting is supplied again; clearing water removes the geometry. This is the current static surface stage, superseding the earlier export-only status.

The owner builds replacement geometries before removing its current pair, rejects invalid data without losing the previous surfaces, and disposes geometry/material resources during clear and renderer cleanup. The UI bounds file size to 4 MiB and cancels stale asynchronous reads when selection changes, clearing or cleanup occurs. Files are local inputs and add no backend/runtime download dependency.

Geometry remains at source heights with ordinary scene depth testing, double-sided rendering and no depth writes. Display-decoded timecycle RGB is converted through Three's output color pipeline; alpha is clamped from its 0–255 source range. This is an explicit browser material adaptation. It does not reproduce native texture layers, wave displacement, flow animation, reflections, foam, water fog, limited-depth interaction, or native water color modulation. No rigid ground collider is added for the water; swimming and buoyancy remain missing. Original-platform water appearance parity is not claimed.

Validation: GPU checks exercise half-opacity blending, exclusion of invisible records, foreground occlusion, interior selection, missing-timecycle suppression and clear. The real 307-polygon file loads through the game controls with 304 exterior / 1 interior visible polygons; an invalid replacement retains the current water. Independent timecycle checks verify water RGB and opacity. All 586 unit tests in 123 files pass with native/content references; both targeted browser tests and production smoke pass. Logs: `/tmp/web-gta-water-runtime-{unit,full-unit,browser,build,production}.log`.

## Borrowed native water raster

The particle decoder now optionally resolves `waterclear256` alongside the sun/star and low-cloud rasters. The acquired dictionary contains a **128×128 XRGB8888** image under that name, one mip, filter 1 and repeat addressing on both axes. The name is not its actual dimension. `LocalSunTexture` prepares all available rasters before swapping the set, releases partial preparations on error and retains the previous set after a failed water allocation. Water surfaces borrow the raster; clearing the particle selection returns them to flat color.

`LocalWater` supplies first-layer UVs from native world XY divided by 25. This scale follows `GetWaterLayerTexInfo(0)` in the pinned WaterLevel.cpp. In the rectangle path, zero texture shift and repeating addressing make the source's fractional base plus integer ±7 offsets equivalent to these world UVs. The current renderer uses this mapping across its triangulated surfaces. Native triangle mapping details still need independent output comparison.

This is a **single static texture layer** through the existing Three material/color pipeline. It is not the complete native water shader: the second 12.5-unit layer, runtime texture shifts, original layer alpha values, 0.577 color modulation, display-space texture/color multiplication, high-detail waves and refraction remain unfinished. The borrowed raster preserves source sampler metadata; no smoothing override or texture upscaling is added.

The content acquisition script now includes `models/particle.txd`, placing it at `/Users/teo/Developer/web-gta-content/particle.txd` with URL/hash provenance in the content report. In-game, load it under **Lighting → Sun texture → Local particle TXD** after loading `water.dat` and the timecycle. The status reports whether its water raster was found.

Validation: the real dictionary passes through the particle worker, reports the actual 128×128 raster, and produces spatially varying GPU pixels on a test water surface. The diagnostic 50-unit square has UVs spanning 0–2, and clearing the owner restores its white untextured probe output. Inspected `artifacts/native-water-texture.png`; its grayscale ripples are the native raster under white diagnostic color, not calibrated gameplay lighting. Four targeted browser checks pass, all 587 unit tests/123 files pass, and production smoke passes. Logs: `/tmp/web-gta-water-texture-{unit,full-unit,browser,build,production,content}.log`.

## Water color-space correction

The initial one-layer material treated the native `NoColorSpace` raster as linear samples while the timecycle color was already display-decoded. Three's output conversion then brightened the raster. A synthetic GPU probe exposed the error: source texture RGB `(128,64,32)` combined with water RGB `(128,192,224)` should produce approximately `(64,48,28)` under byte-space modulation; the old red output was 93, 29 levels too bright.

The water-specific material hook now converts its linear tint back to display values, multiplies the raw raster RGB there, and decodes the product for Three's remaining fog/output stages. Alpha remains an independent product. No borrowed texture's color space, filter, pixels or addressing is modified. Untextured water retains its prior color output. A stable program cache key distinguishes the modified material shader.

This supports the intended raw texture/color modulation rule; it does not establish complete original-platform water parity. The independent [librw immediate-mode texture shader](https://github.com/aap/librw/blob/18532c2e13efbc1aa43f0b00b4459831f9414de0/src/d3d/shaders/im2d_PS.hlsl) demonstrates direct sampled-color multiplication, but is not a capture of the original water pipeline. Original two-layer composition, final fog/color-space behavior and native color modulation remain separate fidelity work.

The failing-before probe now passes within one output level per channel; untextured color remains `(128,192,224)`. All four local-water browser checks pass, including the actual public raster, and production build/smoke passes. Re-inspected `artifacts/native-water-texture.png`: the raster no longer receives the extra output brightening. Logs: `/tmp/web-gta-water-color-{before,browser,production}.log`.
