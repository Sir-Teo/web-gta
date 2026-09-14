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

## Persistent triangle allocation

`NativePlantPool` now owns 256 shared triangle slots across supplied entity
identities. Initial free slots follow table order; release returns a slot to
the free-list head. Allocations enter the head of their native render-slot
list. Existing source triangle indices, including repeated face-group visits,
retain their allocations and three grass seeds rather than consuming new
samples every update. Object-only triangles consume no grass seeds.

Each entity update first visits allocated triangle indices in ascending order.
It retries uncreated procedural objects before phase filtering, then applies
the six-point retention test to the selected phase. Candidate additions follow
the supplied face-group order after removal. Failed object-only additions are
released immediately; failed mixed grass/object additions retain grass and
retry later. Successful procedural additions receive one removal callback on
release. Entity release also walks source triangle order.

Random sampling and procedural-object addition/removal are required explicit
callbacks. Their implementations remain separate work. Entity traversal order,
the 40-entity cache, update counters and native RNG are not inferred by this
pool; callers must preserve them before claiming original population parity.
Callbacks are synchronous and must not reenter the pool; candidates are treated
as immutable source data. The pool is not yet installed into the scene.

`PlantMgr.cpp`, `PlantLocTri.cpp` and
[`PlantColEntEntry.cpp`](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Plant/PlantColEntEntry.cpp)
were rechecked byte-for-byte against the pinned revision. Five focused tests
cover seed retention, phase removal, slot reuse, shared capacity, render order,
object retries/cleanup and invalid samples. With explicitly disabled procedural
objects and fixed test samples, the real eastern Chiliad inventory retains
142 grass triangles across identical updates with only 426 seed calls, then
releases all slots. That test uses browser scene order, not native sector order.

## Entity cache and collision processing

`NativePlantEntityCache` now connects explicitly supplied building entities to
the triangle pool. It caps the cache at 40 entries, inserts at the head, skips
procedural/current-scan/noncurrent-area/non-atomic/non-plant-friendly inputs,
and avoids duplicate identities. An empty-collision addition stops the scan,
matching the inspected `AddEntry` failure path. Fast updates prune only missing
entity references; full updates also prune different-area and distant entities
before admitting new ones. Releasing a cache entry releases its triangles.

The distance helper transforms the COL bounding-sphere center into native world
coordinates and uses the source's conditional radius subtraction: subtract the
radius only when center distance exceeds it. Inside the sphere, center distance
is retained, not clamped to zero. Admission includes squared distance 340²;
full pruning uses strictly greater than 340². Native placements are rigid, and
the helper does not scale the sphere radius with the matrix.

Collision processing follows cache-list order and passes candidates into the
persistent pool. If the current collision triangle count differs from the
count captured at admission, both removal and addition are skipped, as in the
source. Five tests cover the distance branch, capacity/head order, eligibility,
fast versus full pruning, empty-collision scan termination and the complete
cache → collision candidates → pool → entity-release path.

This adapter does not yet generate native building-sector traversal, derive
atomic plant-friendly flags, advance scan codes or schedule fast/full passes.
Callers must supply those inputs and stable entity identities that are never
recycled while cached. Scene integration and original RNG remain unfinished.

## Building-sector traversal

`NativeBuildingSectors` supplies the regular building-sector scan to the entity
cache. It uses the source's 120×120 grid of 50-unit cells, Y-major/X-minor
iteration and head insertion within each sector. Bounds touching a sector
boundary occupy both cells. Cross-cell visits are preserved for the cache's
identity/scan-code checks. Big buildings are excluded from these regular lists;
they belong to native LOD-sector lists.

The bound rectangle follows `CEntity::GetBoundRect`: transform min/max corners,
swap their X coordinates, then transform the remaining two. It deliberately
does not project all eight box corners. Entity insertion applies the source's
-3000/2999 edge limits. Camera scans use the 340-unit rectangle without first
clipping its indices; each sector lookup clamps to 0–119. Consequently an edge
sector may be visited repeatedly even for a single-cell building. This is
preserved rather than silently deduplicated.

Pinned `World.h`, `Entity/Entity.cpp`, `Sector.h` and
[`PtrListSingleLink.h`](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Core/PtrListSingleLink.h)
were byte-compared with their public versions. Five tests cover traversal and
head order, inclusive boundaries, edge repeats, four-corner projection,
removal and sector-scan integration with 40-entry cache admission.

The source entity insertion order still must be supplied by the world loader;
model-grouped scene order does not establish native IPL/streaming insertion
history. Plant-friendly model flags, scan-code scheduling and scene integration
remain pending. These tests do not establish final visible vegetation parity.

## Imported scene classification and additional native content

Acquired [object.dat](https://z.noclip.website/GrandTheftAutoSanAndreas/data/object.dat):
126,118 bytes, SHA-256
`c963c980d90891cbb4ab81a6a8daa294a5813cba46fae4b1302951c32ca472d8`.
It is now pinned in the world acquisition lock and stored at the depot root.
The existing native reader parses 994 records before the first `*` stop marker.
All **128** locked files pass offline verification. `OBJECT.DAT` classifies
placed entities; it is separate from `procobj.dat` generation rules.

`nativePlantFriendly` inspects every collision triangle for either procedural
surface flag. `nativeScenePlantEntities` combines that finding with the imported
IDE section, complete supplied OBJECT.DAT index, source placement identity,
native matrix and existing big-building collision classification. It excludes
dummy objects and timed models: the inspected cache specifically requires
`MODEL_INFO_ATOMIC`, while timed models return `MODEL_INFO_TIME`. Area 13 is
accepted in any current area. Missing source identities fail explicitly.

The adapter currently returns scene order; it does not claim original insertion
history. Identities use original source name and index and must be scoped by
the caller's dataset session. Caller-provided OBJECT.DAT and SURFINFO indexes
must be complete for the intended dataset.

`FileLoader.cpp`, `Models/TimeModelInfo.cpp` and `Entity/Entity.h` were compared
byte-for-byte with the pinned reversed source. Three focused tests cover model
eligibility, object-only surfaces, native coordinates, source identities and
area semantics. The actual eastern Chiliad dataset runs through classification,
sectors, entity cache, collision candidates and the persistent pool: **36**
eligible entities, **19** cached and **142** grass triangles. Repeated processing
preserves allocations; cache clear releases them. Fixed samples and an explicit
no-object callback isolate this content/lifetime test. Renderer installation,
original RNG, actual world insertion history and scheduling remain unfinished.

## Prepared native grass models and cover texture bindings

`readNativeGrassAssets` now decodes the eight acquired grass DFFs and all nine
required rasters together. Each prepared model selects the first atomic,
replaces its frame with identity, creates white prelight colors, applies the
native geometry flag mask and material-color modulation, and initializes all
materials to black with alpha 50 and `gras07Si`. Grass textures use linear
filtering and wrap addressing. Original decoded models remain available and
unchanged; positions, indices and UV data are shared as immutable content.

`bindNativeGrassCover` applies the final supplied draw color and the selected
`txgrass{slot % 2}_{texture}` raster to every material without mutating other
covers or the prepared base. It follows the inspected loader's explicit
table-zero assignment for all four renderer slots, selecting `grass0_1` through
`grass0_4`. Both model tables are decoded and retained for comparison. This
binding policy is source-derived and still needs retail validation; it must
not be described as proof that the second model table is unused in all releases.

The package rejects missing resources and invalid cover indices, rather than
falling back to raw embedded texture names. Tests exercise every combination
of four slots, four model indices and four texture indices against the real
depot; verify white prelights, native flags and unchanged geometry; and check
independent cover colors and incomplete-package failure. `PlantMgr.cpp`,
`PPTriPlantBuffer.cpp`, `RwHelper.cpp` and `rpworld.h` were byte-compared with
the pinned public source. The resulting models and textures fit the existing
model-rendering data types, but a dedicated grass pass, instance scheduling
and scene installation remain unfinished.

## Dedicated instanced grass pass

`NativeGrassPass` now renders prepared grass through one instanced batch per
allocated triangle/cover. Four model geometries are shared; cover materials
retain independent color/opacity while textures use reference-counted ownership.
The root applies the native Z-up to browser Y-up rotation once. Triangle order
is supplied by the pool, with explicit render order to avoid automatic
back-to-front sorting changing the native sequence.

Each batch retains explicitly supplied samples for its allocation lifetime.
Updates apply the existing native placement/scale/wind equations and packed
collision lighting, byte intensity and far fade. Instances less than one native
unit from the camera are suppressed. Low quality disables grass; medium uses a
30-unit far distance, high/very-high use 60, each with the 20-unit fade interval.
The caller supplies native triangle-sphere visibility. The pass uses depth test,
no depth writes, alpha blending without alpha testing, and scene fog. It uses
the existing texture decoder's raw color-space convention. Surface definitions
and allocations must remain immutable while owned by a pass.

Retired allocations dispose instance buffers and materials and release texture
references; shared geometries survive until pass disposal. Repeated disposal
and updates after disposal are inert. Unit coverage checks retained samples,
near suppression, color/alpha, render state and exactly-once cleanup.

The [browser probe](../../tests/fixtures/native-grass.html) uses the acquired
native grass meshes/textures with a deliberately specified triangle and samples.
It verifies nonempty raster output, pixel-identical repeated frames, visible
wind changes, low-quality suppression and no page/console errors. The inspected
capture is `artifacts/native-grass-pass.png`. This is an isolated rendering test,
not a screenshot of original terrain or an original-game comparison. The first
browser run exposed a missing favicon in the fixture; the fixture now supplies
one and the complete test passes.

Production terrain installation, native scheduling/insertion history, original
RNG consumption, full procedural objects and retail pixel comparison remain
unfinished. The pass's explicit sampling boundary must not be mistaken for a
verified implementation of the original random stream.

### Distance precision and sampler ownership

The pass now uses float32 vector subtraction, squared sum and square root for
both triangle-center fading and instance near suppression. Previously its
`Math.hypot` calculation could disagree with native float32 at the one-unit
boundary. A regression demonstrates a point whose double-precision distance
is below one while the native calculation rounds to exactly one.

Retained samples are now copied immediately from the sampler. A callback can
reuse a scratch tuple without collapsing every grass instance to its final
sample or moving existing instances when the scratch storage changes. Tests
verify distinct matrices, unchanged repeated updates, high/medium/very-high
fade boundaries, visibility suppression and unchanged sample-call counts across
quality transitions. Invalid frame quality and non-float32 wind values are
rejected before changing pass visibility or ownership. Browser rendering is
rechecked after these corrections.

## Scene controller and native terrain render verification

`NativeVegetationScene` now owns building sectors, entity lookup/cache, persistent
triangles and the grass pass as one session. Simulation and rendering remain
separate calls. Full camera preupdates are supported; ordinary updates accept
explicit fast-cache mode and triangle phase. Removing an entity first removes
its sector/reference entry, then the next cache update releases its triangles.
Session disposal clears all cache, sector, allocation and render ownership.
Invalid phase/camera input is rejected before simulation changes state.

The new `native-grass-terrain` browser fixture reads the local depot directly,
assembles eastern Chiliad, loads OBJECT.DAT/SURFINFO/plants and the grass package,
and connects the entire vegetation chain. Its initial camera reproduces 36
eligible entities, 19 cache entries and 142 allocated grass triangles. A close
camera view then renders terrain and grass together using the existing terrain
visibility/LOD controller and a camera-frustum sphere test for grass.

Browser checks compare grass-enabled and disabled captures, require visible
pixel changes, require identical repeated frames, reject page/console errors,
and verify empty ownership after disposal. The inspected capture is
`artifacts/native-chiliad-grass.png`. Initial fixture rendering showed overlapping
terrain LODs; using the existing visibility controller removed that overlap.
The test still uses explicitly fixed samples, scene insertion order, no
procedural objects and simplified terrain lighting. It is a native-content
integration test, not a retail appearance comparison.

The scene controller is not yet wired into the normal walking-session content
flow. Verified update cadence, original RNG, insertion history, procedural
objects and original-game visual comparison remain required.

## Reusable local vegetation package loader

`readNativeVegetationFolder` replaces the terrain probe's basename lookup with
the same explicit relative-path validation used by world-folder loading. The
shared index requires one root, rejects traversal and duplicate case-insensitive
paths, and preserves paths across structured cloning. Required files are the
four root tables (`plants.dat`, `procobj.dat`, `object.dat`, `surfinfo.dat`) and
the nine `models/grass/` resources. All thirteen must exist before reading; the
package is capped at 32 MiB with a 16 MiB individual-file bound.

The loader reads only those resources, parses tables as Windows-1252, initializes
grass surfaces, validates that every SURFINFO plant-enabled surface has grass
properties, and prepares the grass models/textures. It returns raw records plus
initialized indexes only after the whole package validates. It does not open
the world IMG or mutate a previously returned package on failure.

Tests cover exact relative paths, case/backslash normalization, duplicate and
mixed roots, missing models, malformed tables and an unrelated archive that
must remain unread. The actual package yields 68 plant rows, 95 procedural-object
rows, 994 object rows, 42 grass surfaces and eight prepared models. The native
terrain browser probe now uses this production-module loader end to end.
Normal walking-session UI/transport wiring remains pending.

## Region environment handoff

World-folder plans now attach all thirteen vegetation files to the optional
scene environment when the complete package is present. Partial folders omit
the package; ordinary map loading remains supported. Explicit relative paths
and original File objects travel through the existing worker/workshop handoff,
without embedding decoded pixels or rereading the IMG.

Environment loading validates the vegetation envelope before dispatching any
existing lighting, water, audio or character owner: exact required path set,
local File values, single root and package-size bounds. The general environment
pickers do not install the grass pass; the dedicated vegetation session owner
must consume the validated files separately. No grass-enabled claim is made by
this transport addition.

Tests cover complete versus partial selection, remote/malformed values and
validation before owner changes. The terrain browser probe now consumes the
folder plan's environment package rather than reopening the original folder
selection. Walking-session region replacement is rechecked with this payload.
Normal walking-session grass activation and native random/update sequencing
remain unfinished.
