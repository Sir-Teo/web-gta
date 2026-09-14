# Native procedural vegetation content

Acquired and validated 2026-09-14. Native terrain requires two additional systems:
`plants.dat` describes grass cover on collision surfaces, while `procobj.dat`
describes generated objects such as bushes, cacti, rubble and underwater props.
These records are not ordinary IPL placements. Rendering either system remains
unfinished; this step supplies verified content and raw table readers.

## Public files now in the depot

| Resource | Inspected contents |
|---|---|
| [plants.dat](https://z.noclip.website/GrandTheftAutoSanAndreas/data/plants.dat) | 9,887 bytes; 68 cover records across 42 native surface names; 18 columns per record |
| [procobj.dat](https://z.noclip.website/GrandTheftAutoSanAndreas/data/procobj.dat) | 10,019 bytes; 95 rules across 17 surfaces and 56 model names; 14 columns per record |
| [plant1.txd](https://z.noclip.website/GrandTheftAutoSanAndreas/models/grass/plant1.txd) | 42,152 bytes; eight 64×64 `txgrass0_0`–`txgrass1_3` rasters and one 128×64 `gras07Si`; all have one mip |
| [grass0_1.dff](https://z.noclip.website/GrandTheftAutoSanAndreas/models/grass/grass0_1.dff) through `grass0_4.dff`, plus [grass1_1.dff](https://z.noclip.website/GrandTheftAutoSanAndreas/models/grass/grass1_1.dff) through `grass1_4.dff` | Eight valid DFFs, each with one geometry containing 32 vertices and 30 triangles |

All eleven files total **76,375 bytes**. URLs, sizes and SHA-256 hashes are pinned
in `scripts/content/world-sources.json`; `acquire-world.mjs` now reproduces them.
The local depot is `/Users/teo/Developer/web-gta-content`, with tables at its root
and grass assets under `models/grass/`. All **127** locked world files pass offline
verification. Native binaries remain outside the repository and normal build.

All 56 procedural model names resolve through the existing 55 IDE sources; their
DFFs and assigned base TXDs exist in `gta3.img`. This is dependency availability,
not a claim that every material/parent chain has been rendered. Every surface
label in both tables resolves to one of the 179 native surface IDs.

The four `grass1_*` files are byte-identical in this public dataset. Preserve that
finding rather than inventing variants. Public provenance does not certify an
unmodified retail edition.

## Source contracts that affect accuracy

Pinned reversed source: `0076f9017b4aeef7433957ac2bd8b6988e9df166`. Local copies of
the following four files were compared with the pinned public files and match:

- [`ProcObjectMan.cpp`](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Plant/ProcObjectMan.cpp)
  reads fourteen fields, preserving multiple object rules per surface.
- [`ProcSurfaceInfo.cpp`](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Plant/ProcSurfaceInfo.cpp)
  clamps minimum distance to at least 80, uses `1 / (spacing * spacing)`, and
  converts degree rotations to radians. File values such as distance 60 must not
  be applied directly as the initialized runtime state.
- [`PlantSurfPropMgr.cpp`](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/PlantSurfPropMgr.cpp)
  reads eighteen fields, ends at `;the end`, and stores cover, slot/model/texture,
  color/intensity, scale variation, wind and density values. Parsed raw values
  are distinct from native byte casts and cover-index normalization.
- [`PlantMgr.cpp`](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/PlantMgr.cpp)
  loads `plant1.txd` into the **slot named** `grass_pc`; `grass_pc.txd` is not the
  file path. It sets linear filtering/wrap, loads the eight grass DFFs, replaces
  their material textures, and later selects `txgrass` rasters from cover records.
  Raw DFF names such as `fuzzygrass2` and `veg_leaf` are therefore not sufficient
  to reconstruct the grass pass. The source's model-table setup assigns table 0
  to all four renderer slots; validate that behavior before assuming distinct
  model sets per slot. Rendering also applies collision lighting and triangle
  seeds/counts, alpha blending, fog and wind, and disables depth writes.

## Readers and validation

`src/assets/vegetation.ts` provides `readPlants` and `readProcObjects`. Records
retain line numbers, surface/model names and named raw fields. They preserve
low alpha values, repeated rules and reversed offset ranges (the actual data
includes -2.4 to -3.4); they do not silently reorder or clamp them. Numeric syntax,
integer fields, finite float32 range, record count and file size are checked.

```sh
node scripts/content/acquire-world.mjs /absolute/depot
node scripts/content/acquire-world.mjs /absolute/depot --verify-only
GTA_CONTENT_DIR=/absolute/depot npx vitest run tests/vegetation.test.ts
```

The native-content test verifies all eleven hashes, both table counts/surface
labels, all eight decoded models, every texture mip, grass texture selection and
the 56 procedural models' base dependencies. Next work is native initialization,
surface eligibility, triangle selection/seeding and a dedicated grass render
path. Sprinkling generic grass over every visible terrain mesh would not match
these source rules.

## Initialized grass properties and triangle counts

`src/world/nativeVegetation.ts` now initializes all 42 acquired grass surfaces
with three independent cover slots each. It follows the source's uint16 cover
normalization (values above two become slot zero), byte-sized color/intensity,
uint16 model/texture indices, float32 parameters and last-record assignment.
Unspecified covers retain model 65535, density zero and the native defaults.
Repeated rows replace only their cover; the surface's slot follows the last row.
Raw imported records are unchanged.

The source has 57 allocatable surface-property records and a 178-entry pointer
table. Unknown/default surface names, RAILTRACK (178), excess records and indices
outside the fixed PC model/texture arrays are rejected here rather than allowing
the native code's unchecked accesses. These are explicit browser bounds checks.

`nativeVegetationEligibility` reads the two independent SURFINFO flags; missing
surface information enables neither system. The real-file regression confirms
that every surface flagged for plants has initialized cover properties. Its
surface-name check now rejects unknown-name fallback ID zero; the previous
`undefined` assertion could not detect that lookup behavior.

[`PlantLocTri.cpp`](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Plant/PlantLocTri.cpp)
casts float32 triangle area × density to uint16. `nativePlantCounts` reproduces
that truncation for representable nonnegative populations, rejects overflow,
and applies PlantMgr's draw expression `(count + 8) & 0xfff8` for defined covers
when the triangle has any plants. This is not ordinary ceiling-to-eight: eight
becomes sixteen, and a defined zero-count cover requests eight when another
cover activates the triangle. The uint16-mask boundary is also preserved.
Triangles with no plant population produce no grass draw requests.

The three additional source files (`PlantLocTri.cpp`, `PlantSurfPropMgr.h`,
`SurfaceInfos_c.cpp`) were hash-compared with the same pinned revision. Tests cover
defaults/casts, duplicate covers, unsupported tables, count boundaries and the
actual acquired data. Collision-triangle extraction, area calculation, seeding,
allocation lifecycle and rendering remain separate work; these helpers do not
yet add grass to the scene.

## Collision-triangle geometry

`nativePlantTriangle` now accepts already-transformed collision vertices and
computes float32 centroid, full 3D cross-product area and the native radius
`distance(centroid, first vertex) * 1.75`. It copies input vertices and rejects
invalid coordinates. Area feeds the existing population-count helper; a sloped
triangle must not use its projected horizontal area.

Its proximity test checks the three vertices, centroid and three edge midpoints
against a strict squared distance of 10,000, matching PlantMgr's 100-unit test.
It deliberately does not substitute closest-point-on-triangle distance. For
large triangles a position inside the triangle can fail all seven samples.
Likewise the source's radius is not guaranteed to enclose all three vertices.
Regression cases preserve these behaviors, the exact boundary, float32 rounding,
zero-area triangles and a sloped triangle's density-derived draw count.

This helper does not yet scan scene entities, transform local COL vertices,
apply face-group culling or the native eight-phase triangle scheduling, manage
the local-triangle pool, or generate seeds/instances. Those caller rules remain
necessary before renderer integration.
