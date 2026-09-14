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

## Native COL candidate extraction

`nativePlantCollisionCandidates` now enumerates one eligible entity's collision
triangles in face-group/triangle order. It transforms decoded COL vertices with
a supplied native Z-up placement matrix using float32 operations, applies the
surface flags, preserves triangle index and packed lighting, and attaches the
initialized grass counts. Object-only candidates use native slot three; empty
grass-only candidates are rejected. An optional phase selects indices modulo
eight. The generator is lazy so a caller can stop at its allocation limit.

Face groups follow the source's two-corner transform/recalculated bounds and
`CCollision::TestSphereBox` axis-overlap test, not an enclosing eight-corner box
or closest-point sphere intersection. Group order is preserved. Overlapping
groups may revisit an index; the future pool owner must skip allocated entries,
as the native caller does. Admission uses seven points, while `retainedNear`
implements the removal pass's six points (no centroid). A triangle can therefore
pass admission at its centroid and fail retention at the same camera position.

The imported placement utility now exposes its existing native Z-up matrix
before the unchanged renderer coordinate conversion. This reuses the project's
IPL transform behavior; it is not an independent verification of the original
engine's quaternion construction.

At native camera `(-1750,-1450,35)`, the acquired eastern countryside's current
physical placements yield **158 candidates across three models**, including
**142 grass** and **73 object** candidates (categories overlap). This read-only
inventory uses the browser's loaded scene; it does not reproduce native sector
traversal/cache order, the 40-entity cache, 340-unit entity-distance filter, the
256-triangle pool, allocation history or random seeds. Counts are candidate
availability, not a claim about the original game's visible instance count.

Tests verify real-file counts, transformed coordinates, original triangle IDs,
lighting bytes, face ranges, phase selection, object-only fallback, missing
grass-property rejection and asymmetric admission/removal behavior. Rendering
and the persistent native allocation lifecycle remain unfinished.

## Grass instance equations and reference caveat

`nativeGrassInstance` implements triangle sampling, XY/Z scale variation and
wind shear around five explicitly supplied samples. The two position samples
are reflected when their sum exceeds one and used as barycentric weights.
Plants remain upright in native Z-up coordinates; the local Z axis bends equally
toward X and Y. They are not aligned to the collision triangle's normal.
`nativeGrassDrawColor` implements byte intensity multiplication divided by 256
and the 20-unit far-distance alpha fade, using triangle-center distance. Its
input color must already contain collision lighting.

The pinned [`GrassRenderer.cpp`](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/GrassRenderer.cpp)
explicitly replaces the original `srand`/`rand` generator with `std::mt19937`
and includes a `FIX_BUGS` seed alternative. Its random consumption is also
deliberately arranged before near culling. Consequently this implementation
does **not** adopt that generator or claim retail seed/sequence parity.
Supplying identical samples reproduces transforms, but matching native plants
requires verifying the original RNG and allocation/consumption order first.
Both this file and `PPTriPlantBuffer.cpp` were byte-compared with the pinned
public revision and match.

Three regressions cover reflected positions, upright transforms, repeated
samples, invalid inputs, intensity rounding and fade endpoints. These helpers
are not yet connected to the grass renderer. Collision lighting, quality-level
selection, near culling, pool lifetime and original seed sequencing remain
unfinished.

## Packed collision lighting for grass

`nativeGrassLitColor` now prepares the byte color passed to the existing grass
intensity/fade helper. The low nibble is day brightness and the high nibble is
night brightness. Each is multiplied by 0.5 and divided by 15 before blending
with the building day/night balance. RGB multiplication uses float32 and
truncates to bytes; the original alpha is preserved. The shared calculation
now lives in `assets/collisionLighting.ts`, so grass does not import Rapier or
ground-probe code. Existing contact-lighting callers retain their old export.

The pinned [ColPoint.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Collision/ColPoint.cpp),
`ColPoint.h` and `RGBA.h` were byte-compared with the public source. PlantMgr's
comment questioning an additional multiplication by 255 remains unresolved;
this helper follows its executable expression, without adding that multiplier.
This is fidelity to the inspected implementation, not proof of retail pixels.

Regression coverage checks opposing day/night nibbles, alpha preservation and
the complete collision-light → byte-intensity → distance-fade sequence. For
cover RGB (220,210,165), alpha 40, lighting 0x0f and night balance 0.5, the lit
color is (55,52,41,40); intensity 160 at distance 70 with far distance 60 yields
(34,32,25,20). Renderer integration and original seed sequencing remain open.
