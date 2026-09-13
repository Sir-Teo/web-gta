# Public San Andreas world resources and acquisition design

Research date: 2026-09-13. Scope: original GTA San Andreas, personal educational browser project, no application backend. Public availability, advertised download availability, and verified file contents are recorded separately. This is a focused resource survey, not an exhaustive inventory of every mirror.

## Recommended direction

Preserve the native world as placed meshes, textures, collision and LOD relationships. Use public height data and overhead imagery as supporting references. A single height field cannot represent several surfaces at the same XY coordinate: bridges, tunnels, interiors and overpasses require meshes. A monolithic OBJ export also loses useful streaming and game metadata.

Continue the existing Three.js/native-format implementation. Use DragonFF as an independent Blender inspection route and noclip/euryopa as renderer references. Choose the original PC release as the first data-format baseline; record a separate visual reference profile when comparing with PS2. Do not mix Definitive Edition geometry, enhanced texture packs and original assets in fidelity tests.

## Actual assets and datasets

### MapAndreas: verified downloadable terrain heights

[Repository](https://github.com/philip1337/samp-plugin-mapandreas), [heightmap directory](https://github.com/philip1337/samp-plugin-mapandreas/tree/master/heightmaps), [reader source](https://github.com/philip1337/samp-plugin-mapandreas/blob/master/src/MapAndreas.cpp).

Pinned revision: `05411aae78410600a74213140b22afb4df5a6e60`.

- `SAfull.hmap`: repository metadata reports 72,000,000 bytes, 6000 × 6000 unsigned 16-bit samples.
- `SAmin.hmap`: downloaded and inspected; 8,000,000 bytes, 2000 × 2000 samples at three-unit grid spacing. Little-endian decoding gives heights in hundredths of a world unit.
- SHA-256 of inspected reduced file: `c54bf25a103c53b7a5481a45811cc0e81b723808a41550b0bc5a5f5898d763ba`.
- Observed range: 0–525.19; 3,181,258 nonzero samples. Query `(2495,-1687)` returns 12.51; these are dataset observations, not independently verified ground truth.
- Source lookup uses truncation toward zero, column `trunc(x)+3000`, row `3000-trunc(y)`, dividing both by three in minimal mode. A browser adapter must explicitly reject out-of-array boundary indices; do not copy the source's inclusive edge check blindly.
- Useful for terrain overview, broad height checks and fallback diagnostics. It contains no textures, buildings or complete collision topology. Zero does not distinguish all missing/water cases.
- No repository license was detected by GitHub metadata; record provenance separately from code reuse permission.

Inspection copy: `/tmp/web-gta-SAmin.hmap`; not bundled into the game.

### MTA:SA Map Images: verified public overhead image files

[Repository and preview](https://github.com/gptrk0/mtasa-map-images), [day images](https://github.com/gptrk0/mtasa-map-images/tree/853e59ce24dedce027a9b0c3f724b83542d8bd9d/default), [shadow-free images](https://github.com/gptrk0/mtasa-map-images/tree/853e59ce24dedce027a9b0c3f724b83542d8bd9d/noshadow).

Pinned revision: `853e59ce24dedce027a9b0c3f724b83542d8bd9d`.

The publisher supplies orthographic renders in day, shadow-free and night variants, from 1024 through 20480 pixels. The repository tree confirms actual JPEG files; for example `default/map_default_2048.jpg` is 2,023,267 bytes. Useful for a debug atlas, geography comparison or optional satellite-style map. These are 2D images, not terrain geometry, and do not reproduce the original stylized radar art. Calibrate image/world coordinates against known landmarks before overlaying objects. Repository metadata identifies MIT; rendered game content provenance remains distinct from the repository's license label.

### Candyshoppa: downloadable Los Santos mesh candidate

[San Andreas full LA Map](https://sketchfab.com/3d-models/san-andreas-full-la-map-a855f55018d747568af4bf00e48a43b4).

The indexed publisher page advertises a free downloadable model, approximately 347,200 triangles and 267,400 vertices, with a CC Attribution label. This is the strongest discovered ready-made city mesh lead. However, the live page returned HTTP 403 to the research fetcher; the archive, formats, textures and geometry have **not** been inspected. The title does not establish coverage of the whole state. Treat it as a Los Santos candidate until bounds and landmarks are checked. No verified COL, LOD links, interiors or night colors. Attribution and underlying asset provenance need to remain attached to any evaluated copy.

[Low-detail San Andreas model](https://sketchfab.com/3d-models/san-andreas-map-low-detail-d69e0b950fee425c8a672e2f2550d551) is another indexed viewer lead, but download availability and license were not verified. Do not call it a ready-to-use asset.

## Public tools and reverse-engineered references

| Resource | What it provides | Original world assets included? | Project use |
|---|---|---|---|
| [DragonFF](https://github.com/Parik27/DragonFF), [map importer instructions](https://github.com/Parik27/DragonFF/wiki/Map-Importer) | Blender GTA format support: DFF, TXD, COL, IPL/IDE; map import marked partial/experimental | Import workflow requires game data and extracted archive contents | Inspect a district independently; compare placement, vertex colors and collision; prepare selective exports. GPL-3.0 code. |
| [noclip GTA renderer](https://github.com/magcius/noclip.website/tree/master/src/GrandTheftAuto3), [scene definitions](https://github.com/magcius/noclip.website/blob/master/src/GrandTheftAuto3/scenes.json), [viewer](https://noclip.website/) | Public TypeScript rendering code; scene definitions explicitly include `GrandTheftAutoSanAndreas`; DFF/TXD and streamed IPL loading paths | Source and hosted viewer are distinct; no standalone complete asset pack verified | Compare browser world rendering, weather/water and placement. Do not assume the GTA III-specific extractor works unchanged for SA IMG archives. |
| [librwgta / euryopa](https://github.com/aap/librwgta), [librw](https://github.com/aap/librw) | GTA III–SA map viewer, RenderWare reconstruction, DFF/TXD conversion utilities | Tools, not an original world pack | Independent native renderer and format behavior reference. librwgta README includes a GPL dual-licensing note; audit exact files before reuse. |
| [ColAndreas](https://github.com/Pottus/ColAndreas), [releases](https://github.com/Pottus/ColAndreas/releases) | SA-MP collision simulation and Wizard-generated `ColAndreas.cadb`; Bullet-based | Official instructions describe generating the database, not a ready bundled textured world | Inspect collision extraction and compare ray queries. Existing browser COL/Rapier path avoids needing its server plugin. GPL-3.0 code. |
| [SanMap Studio](https://github.com/mgmoldova/sanmap-studio) | Electron/Three.js editor; IMG/DFF/TXD/IDE/IPL asset package, opt-in IPL world streaming | Explicitly requires user-selected game installation | Relevant parser/editor architecture; Electron file APIs need browser adapters. README identifies MIT. Claims not execution-tested here. |

[OpenSA](https://github.com/AlexSergey/opensa) was also found in indexed results advertising browser RenderWare world streaming. Live repository/API access returned not found during this survey. It is an unverified availability lead, not a dependable dependency or verified downloadable asset source.

## Acquisition and browser packaging design

1. **Inventory before conversion.** Index archive entries, external map files and texture dictionaries. Record source filename, hash, platform/version and provenance. Resolve each IPL placement through IDE to DFF, TXD and COL; record missing dependencies instead of silently substituting geometry.
2. **First district: Grove Street and its approaches.** Include nearby roads, terrain, vegetation and distant silhouettes. Keep native coordinates and IDs. Compare explicit landmark positions and original LOD links before expanding coverage.
3. **Canonical native data plus optional GLB cache.** Preserve raw model metadata, day/night vertex colors, material flags, collision surface IDs, area IDs and time restrictions. If converting geometry to GLB, keep unsupported native properties in a versioned sidecar. Generic Blender PBR export is insufficient for appearance parity.
4. **Spatial streaming.** Start experiments with 256-unit cells, adjusting from measured density. Separate asset identity from placement: one model/texture may serve many cells. Maintain near collision, medium-distance visuals and far LOD tiers, with hysteresis and reference-counted unload. Never merge the whole state into one giant mesh or collider.
5. **No backend.** Import selected local files in workers and cache processed chunks in browser storage, or load prepared chunks from static hosting. Both keep simulation, saves and gameplay entirely client-side. Static file delivery is compatible with the requirement. Keep saves separate from evictable caches and provide export/import.
6. **Verify fidelity before optimization.** Capture fixed camera, time and weather comparisons. Check streets, slopes, bridge undersides, tunnel entrances, water edges, alpha foliage, texture UVs, night colors and LOD transitions. Test collision independently from visual meshes. Compression is acceptable only after inspecting decoded output.

Initial acceptance gate: one complete, textured district with correct placement and walk/drive collision, predictable unload/reload, and a dependency report without unexplained missing assets. Then add rural hills and a bridge/tunnel district to prove the approach generalizes. Full-world coverage comes after these gates.

## Decision

Use **native DFF/TXD + IDE/IPL + COL** as the accuracy route. Use the **verified MapAndreas files** for supporting terrain analysis and **MTA overhead images** for map alignment. Evaluate the **Sketchfab Los Santos mesh** as a quick geometry/reference candidate, but do not replace the native-world plan until its contents pass inspection. This survey did not verify a complete, textured, collision-equipped, browser-ready San Andreas asset pack.
