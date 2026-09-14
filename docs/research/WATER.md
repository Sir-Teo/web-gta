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
