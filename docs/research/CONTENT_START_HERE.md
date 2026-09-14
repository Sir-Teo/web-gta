# San Andreas map and terrain: content first

The [native vegetation content](VEGETATION_CONTENT.md) is now acquired: 68 grass
cover records, 95 procedural-object rules, eight grass DFFs and their texture
dictionary. Native `object.dat` is also acquired, with 994 parsed classification
records. The depot now verifies 128 files. The readers and dependency checks
pass; procedural vegetation rendering remains to be implemented.

New source finding: the reversed native loader's [big-building classification](BIG_BUILDING_CONTENT.md)
explains the unlinked Verdant Meadows trailer without editing its IPL. At the
source camera default, the distance rule excludes 29 additional placements
across the nine audited regions, including that missing collision dependency.
The runtime now applies that rule. Original Verdant Meadows files pass grounded
walking without the optional placement repair.

The [region overlap audit](REGION_OVERLAPS.md) now tracks shared native placement
identities: Mount Chiliad and its eastern approach share 90 unchanged placements,
including 48 with physical collision. The workshop can now **Update terrain in
walk session** after assembling another region, with rollback on failure.
Enable **Keep player position when updating terrain** for overlapping selections;
the replacement must support the current standing or crouched capsule.
**Load terrain as you walk** now prefetches overlapping regions from the selected
folder while movement continues. It pauses near the old boundary if loading is
late. Unchanged live collision now survives swaps within one folder session;
position-preserving swaps query that candidate collision directly without a
second physics world. A local support-query benchmark is recorded in the guide;
native texture reuse now retains 123 GPU textures in the mountain-to-east test,
while geometry/material reuse and frame-time optimization remain unfinished;
see the [following policy](REGION_OVERLAPS.md).

Completed folder loads now reuse their archive/IDE metadata and lazy district
indexes for later selections. The [district index guide](DISTRICT_INDEX.md)
records cache boundaries and cancellation checks; region assets still load afresh.

The [district coverage index](DISTRICT_INDEX.md) now audits 44,818 exterior
placements across all 53 manifest IPL sources. It exposed missing neighboring
Grove terrain: the corrected folder preset includes `LAs2` and assembles 550
placements with complete playable collision. The other identified neighboring
sources are now included for Mount Chiliad, Las Venturas, Chiliad's eastern
approach and Santa Maria; [current coverage](WORLD_CONTENT.md) records the
verified counts and remaining limits.

The archive also contains all 64 native exterior path files. See
[native road and pedestrian paths](NATIVE_PATHS.md) for the verified 68,237-node
graph, lane-navigation records and local audit command. Runtime traffic
integration remains unfinished.

Checked 2026-09-14. Start with the native world dataset below. Preserve original geometry, UVs, vertex colors, placement transforms, collision and LOD relationships before optimizing browser delivery.

## Actual downloadable content

| Priority | Source | Contents and use | Verification |
|---|---|---|---|
| 1 | [Noclip native world archive](https://z.noclip.website/GrandTheftAutoSanAndreas/models/gta3.imgz) | 532,753,381-byte compressed IMG; local decoded inventory contains 12,955 DFF models, 2,750 TXD dictionaries, 216 COL collections and 164 binary IPL streams. Primary terrain, roads, buildings, vegetation and props. These are archive-wide counts. | Fresh HEAD 200; existing inflated archive and companion files passed the project's size/SHA-256 verification. |
| 1 | [Pinned Noclip scene manifest](https://github.com/magcius/noclip.website/blob/75086f2350cb6f320023931d6d73f20f5c6bbc32/src/GrandTheftAuto3/scenes.json) | Paths for 55 IDE definition files and 53 external IPL placement files; combine with archived binary IPLs to assemble districts. | All companions are present in the verified local depot. |
| 1 | [Country south definitions](https://z.noclip.website/GrandTheftAutoSanAndreas/data/maps/country/countryS.ide), [placements](https://z.noclip.website/GrandTheftAutoSanAndreas/data/maps/country/countryS.ipl), [water polygons](https://z.noclip.website/GrandTheftAutoSanAndreas/data/water.dat) | Concrete countryside/Mount Chiliad inputs; geometry and collision resolve through the IMG. Water requires its own surface representation. | All three returned HEAD 200 in this pass. |
| 2 | [GTA Stuff model database](https://gtastuff.com/models/) | Search model IDs/names, inspect geometry and textures, retrieve individual native files to investigate missing dependencies. | Example [gym_bike.dff](https://gtastuff.com/api/file?name=gym_bike.dff) and [2630.col](https://gtastuff.com/api/file?name=2630.col) returned HEAD 200. Nine previously inspected Santa Maria gym supplements have their own acquisition lock. |
| 3 | [MapAndreas heightmaps](https://github.com/philip1337/samp-plugin-mapandreas/tree/05411aae78410600a74213140b22afb4df5a6e60/heightmaps) | Full 6000×6000 height grid and reduced 2000×2000 grid. Useful for terrain overview and elevation checks. No textures, buildings or multi-level collision topology. | [Reduced raw download](https://raw.githubusercontent.com/philip1337/samp-plugin-mapandreas/05411aae78410600a74213140b22afb4df5a6e60/heightmaps/SAmin.hmap) returned HEAD 200, 8,000,000 bytes. Prior binary inspection is recorded in the detailed survey. |
| 3 | [MTA map images](https://github.com/gptrk0/mtasa-map-images) | Orthographic day, night and shadow-free images for geography comparison or a debug atlas. These are 2D reference images. | Publisher repository rechecked; imagery is not a substitute for terrain meshes. |

Public hosting establishes accessibility, not an open-content license or certified retail identity. Keep source provenance attached to every file.

## Tools for understanding the content

- [DragonFF map importer](https://github.com/Parik27/DragonFF/wiki/Map-Importer): independently assemble selected districts in Blender from native assets; supports text and binary placements. Requires the assets separately.
- [Noclip GTA renderer](https://github.com/magcius/noclip.website/tree/master/src/GrandTheftAuto3): browser parsing, placement and rendering reference.
- [librwgta / euryopa](https://github.com/aap/librwgta): native map viewer and RenderWare/GTA utilities; useful as another comparison implementation.
- [ColAndreas](https://github.com/Pottus/ColAndreas): collision database generation and queries; a reference tool, not a textured world pack.

## Acquisition available in this project

The existing depot is `/Users/teo/Developer/web-gta-content`. This pass successfully ran:

```sh
node scripts/content/acquire-world.mjs /Users/teo/Developer/web-gta-content --verify-only
```

Result: **128 files verified, no network requests**, rechecked after acquiring
the vegetation resources and `object.dat`. The world archive and country-south IPL also
returned HTTP 200 on a fresh availability check. To reproduce content elsewhere:

```sh
node scripts/content/acquire-world.mjs /absolute/path/to/content-depot
node scripts/content/acquire-santa-maria.mjs /absolute/path/to/content-depot
node scripts/content/audit-world.mjs /absolute/path/to/content-depot/gta3.img /absolute/path/to/content-depot
```

The acquisition commands are preparation tools. Runtime can read a user-selected local folder and cache decoded assets entirely in the browser; static chunk hosting is an alternative requiring no application backend.

## Content assembly design

1. Resolve each placement's model ID through IDE to its DFF and TXD; load both external and archived IPL placements. Retain native coordinates and stable IDs.
2. Preserve native COL collision and material information independently of render geometry. A heightmap cannot represent a road above another road or a tunnel underneath terrain.
3. Include terrain that intersects a region even when its model origin lies outside the selection. Resolve cross-district dependencies and original LOD relationships.
4. Retain source texture sampling, transparency, day/night vertex colors and time-dependent objects. Generic PBR conversion alone will change appearance.
5. Package by spatial region with shared model/texture references. Keep raw native data as the reference; any GLB cache needs sidecar metadata for native properties it cannot express.
6. Validate an urban district, mountain, coast and bridge region before scaling to continuous statewide streaming. Track unresolved textures, missing collision and omitted placements explicitly.

The project already has bounded-region content work for Grove Street, Mount Chiliad, Verdant Meadows, Doherty, Las Venturas, Chiliad's eastern approach, Gant Bridge and Santa Maria. This is not a claim of complete statewide gameplay or appearance parity. Current coverage and source gaps are in [WORLD_CONTENT.md](WORLD_CONTENT.md); the broader source survey, including unverified third-party mesh leads, is in [PUBLIC_WORLD_RESOURCES.md](PUBLIC_WORLD_RESOURCES.md).
