# Native procedural vegetation content

Acquired and validated 2026-09-14. Native terrain requires two additional systems:
`plants.dat` describes grass cover on collision surfaces, while `procobj.dat`
describes generated objects such as bushes, cacti, rubble and underwater props.
These records are not ordinary IPL placements. Grass now renders in imported
walking sessions using the documented PC compatibility policy; procedural-object
rendering and original-game appearance parity remain unfinished. Sections below
record the incremental implementation and its remaining fidelity questions.

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

## Imported walking-session activation

The normal workshop → Walk scene flow now decodes the handed-off vegetation
package and installs `WalkingVegetation` with the imported terrain owner.
Camera updates drive classification/cache/pool/rendering, using the scene's
day/night balance and camera frustum. Terrain replacements decode their supplied
package before committing the new scene; same-dataset replacement can inherit
an existing package when none is supplied. A different dataset does not silently
inherit old vegetation. Old owners dispose with their terrain, and candidate
validation failure preserves the old owner.

This is a deliberately documented PC compatibility policy: CRT initial state
one, the truncated-seed/five-sample policy, a full initial camera update, cyclic
eight-phase triangle updates and a full entity scan every 32 view updates. The
reversed source uses signed byte counters, whose rollover behavior is not yet
verified against retail. View updates are also not proven to match native tick
scheduling. High grass quality is currently fixed, weather-driven wind is zero,
and procedural-object callbacks report no additions. These remain explicit
fidelity gaps rather than completed native behavior.

The walking browser test loads eastern Chiliad, requires 36 eligible vegetation
entities and nonzero live triangles/draw batches, replaces it with Mount Chiliad,
and checks that a rejected replacement retains the current terrain/vegetation.
The inspected screenshot is `artifacts/native-walking-chiliad-grass.png`.
Grass is now visible around the imported character in the ordinary walking
flow. Visible billboard boundaries and overall grass appearance still require
comparison with original-game captures; this is not pixel-parity certification.

## Windows CRT compatibility sampling

`WindowsCrtRandom` implements the 32-bit recurrence with multiplier 214013 and
increment 2531011, exposing the upper 15-bit result. The algorithm is documented
by [Wine's pinned MSVCRT implementation](https://github.com/wine-mirror/wine/blob/aa1ee5dd3320407b60752987393ee28873c0ae6c/dlls/msvcrt/misc.c).
The inspected file has SHA-256
`570e52131830952f3a1568292f2d803cab054d9e997083822d6fa1389ae30807`.
Tests independently match all ten outputs from seed 1792 in
[Microsoft's rand example](https://learn.microsoft.com/en-us/cpp/c-runtime-library/reference/rand?view=msvc-170).
State is explicit, with no new global random source.

The float sample follows pinned `CGeneral`: multiply the integer by a float32
reciprocal of 32767. Both zero and one are reachable. Consequently the reversed
grass renderer's comment that the truncated float seed is always zero is not
universally true. `General.h` and `General.cpp` were byte-compared with the same
gta-reversed revision already recorded above.

`windowsCrtGrassSamples` provides an explicit compatibility policy: float32 seed
converted numerically to uint32, five samples per instance, including instances
later suppressed by near culling. It uses logarithmic affine jump-ahead to obtain
indexed samples without replaying every preceding instance. Tests compare jump
results to an independent BigInt recurrence, exercise uint32 wrapping, and
compare indexed samples to a sequential stream.

The Chiliad browser probe now uses this policy and an explicit initial seed of
one instead of the synthetic modular sample pattern. Repeated rendering still
produces identical pixels. This proves CRT algorithm compatibility, **not** the
original executable's initial state, global RNG interactions, seed lifecycle or
near-cull consumption ordering. Those uncertainties remain before retail parity
can be claimed. Ordinary walking sessions now use this compatibility policy.

## Billboard alpha investigation

Visible rectangular boundaries in the walking capture prompted a source/GPU
alpha audit. Direct inspection of the acquired DXT3 payload finds 2,753 fully
transparent texels out of 4,096 in `txgrass0_0`; the other grass rasters also
contain transparent, partially transparent and opaque texels.

The browser probe now exercises the **same grass material factory used by the
walking pass** on texel-aligned planes over a known background. It renders all
nine rasters at material alpha 255 and 40 and compares each RGB output with the
decoded source-alpha blend equation. In the inspected Chrome run all eighteen
comparisons had maximum channel error zero, and every zero-alpha texel preserved
the background exactly. Results are written to
`/tmp/web-gta-grass-alpha-audit.json`; regression tolerance permits up to two byte
values of nonzero-alpha rounding across GPU implementations.

This rules out lost texture alpha in the tested decoder/upload/material path.
It does not certify arbitrary filtering, fog, geometry UVs or retail model-table
selection. No alpha cutoff was added: the inspected PlantMgr explicitly disables
alpha testing for grass. Geometry/UV/model bindings and reference-game captures
remain the next evidence needed to explain the observed billboard boundaries.

## Native grass UV and repeat-sampling audit

The acquired DFFs contain intentionally repeated texture coordinates. Inspection
of their first atomic found identity source frames throughout the eight models:

| Source model | U range | V range | Native Z range (rounded) |
|---|---|---|---|
| grass0_1 | 0 to 1 | 0 to 1 | -0.012 to 0.992 |
| grass0_2 | 0 to 1 | 0 to 1 | -0.226 to 0.226 |
| grass0_3 | -4 to 6 | 0 to 1 | -0.003 to 0.219 |
| grass0_4 | 0.002541 to 1.019562 | -3.129127 to 1.964741 | -0.491 to 0.240 |
| grass1_1 through grass1_4 | 0 to 1 | 0 to 1 | -0.012 to 0.992 |

These are measurements of the checksum-locked public dataset, not a claim of
retail model-table selection. Preserve the UVs and below-origin geometry: neither
normalizing the UV range nor lifting every model onto its bounding-box bottom is
supported by this evidence. The content regression now checks retention of the
original UV arrays and the unusual ranges in grass0_3 and grass0_4.

The GPU alpha audit additionally renders each of the nine rasters over U=-4..6
and V=-4..2, at one pixel per source texel, with material alpha 255 and 40. Its
CPU oracle repeats the decoded source tiles using integer pixel coordinates;
it does not query the GPU sampler to derive expected values. Together with the
original single-tile cases this produces 36 comparisons. The inspected Chrome
run passed with maximum RGB channel error zero and no changed zero-alpha
background pixels. Temporarily replacing repeat with clamp made this same test
fail (76-byte channel error on txgrass1_3); the original sampler was restored
and the browser check passed again.

This verifies texel-aligned repeated sampling over the observed coordinate
range. Fractional UV filtering, projected/minified grass, fog, original-game
model selection and reference captures remain outside this check. The observed
walking billboard boundaries remain unresolved; no visual fix or pixel parity
is claimed from this audit.

## Retained grass transforms

The walking pass now retains each allocation's computed instance transforms.
A camera or lighting update with unchanged wind reuses them, still checking the
native one-unit near exclusion and retaining source instance order. Wind changes
recompute transforms from the retained samples. The compacted GPU matrix buffer
is marked for upload only when wind changes a visible batch or near culling
changes which source instance occupies a draw slot. Reducing only the tail count
requires no matrix upload.

The browser probe verifies zero matrix-upload requests on a repeated frame,
identical repeated pixels, and updated wind pixels. Unit checks additionally
move the camera across the near boundary, restore all instances, change lighting
without changing matrices, and return wind to zero with exact original matrix
bytes. The native Chiliad and imported walking/terrain-replacement browser checks
pass. Full validation: 804 unit tests passed, one optional benchmark skipped;
production smoke passed with no external runtime requests.

This trades retained CPU transform memory for less repeated construction and
GPU transfer work. It does not reduce grass draw calls or establish an FPS gain.
The existing visual boundaries, weather-wind integration and original placement
verification remain unfinished.

## Native wind equation evaluator

`nativeGrassWind(milliseconds, wind, seed)` now evaluates both inspected
PlantMgr wind branches with explicit uint32 timer, weather wind in [0,1] and
uint16 seed inputs. Below 0.5 it uses the 4096-ms sine cycle and the 0.2 strength
threshold; even wind zero has a small sway. At or above 0.5 it uses the sixteen
Weather offsets, wrapped timer multiplication, and the source's added one in
the second term. It deliberately does not replace that expression with ordinary
linear interpolation. Intermediate operations round to float32.

Both source files were freshly byte-compared to revision
`0076f9017b4aeef7433957ac2bd8b6988e9df166`:

- [PlantMgr.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/PlantMgr.cpp): SHA-256 `905d37c5655bcbd38f7a94e63a64579d217ccc3986270a5cb6b758156e0f0c5a`.
- [Weather.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Weather.cpp): SHA-256 `08f67cae2f4602ade6f3ad2e1d4b65859ce995fcda54427036e5c79f90b7d8ea`.

The reference fixture contains 288 results from separately compiled C++ float
expressions. Reproduce it from the project root:

```sh
clang++ -O0 -ffp-contract=off tests/fixtures/native-grass-wind-reference.cpp -o /tmp/web-gta-wind-reference
/tmp/web-gta-wind-reference > tests/fixtures/native-grass-wind-reference.json
npx vitest run tests/native-grass-wind.test.ts --maxWorkers=2
```

Cases include both branch thresholds, cycle boundaries, uint32 multiply/add
wrapping and extreme uint16 seeds. The tolerance allows small sinf/JavaScript
sine differences. The browser grass probe now derives calm and stronger-wind
bending from this evaluator instead of an arbitrary 0.4 amplitude; both produce
visible pixel changes and retain the existing repeat-frame checks.

This is source-equation compatibility, not original-executable certification.
The inspected seed-refresh counter increments only inside its even-counter
branch, leaving its intended lifecycle uncertain. No global random policy is
invented here. Ordinary walking still supplies zero bending: wiring the evaluator
to pause-aware time, selected weather and an explicit seed owner is outstanding.

## Walking wind integration

Imported walking sessions now evaluate native calm-wind sway using the existing
session elapsed-seconds counter converted to a wrapped uint32 millisecond timer.
That counter advances only during unpaused play. The wind input is explicitly
zero and the seed zero; the calm branch does not use the seed. This replaces the
previous constant zero *bending* without claiming that selected weather types
have a verified wind-strength mapping.

The scene view update accepts an explicit wind state and copies it when retaining
view state. Terrain replacement initializes its new vegetation owner with the
same timer, strength and seed before validation. Rejected replacement leaves the
previous owner available. Callers without a wind state retain the time-zero
behavior used by static scene tools. The vegetation diagnostic reports the
input state and computed bend.

The walking browser check verifies that the timer advances and bending becomes
nonzero during play, freezes over repeated animation frames after the normal
blur/pause event, and survives terrain replacement exactly while paused. This
updates the preceding evaluator section's integration status. Native weather
strength, weather transitions and original strong-wind seed refresh remain
unfinished; the calm policy is provisional.

## Bend-only updates during animation

With calm sway active every play frame, retaining transforms only while wind was
constant no longer avoided repeated full transform construction. The pass now
reuses the instance objects, positions, scales and matrix arrays when wind
changes. `nativeGrassBend` evaluates the existing float32 shear equation and
updates only column-major entries 8 and 9. Near-camera compaction still checks
all instances in their original order. A wind input change that leaves a
particular bend unchanged does not dirty that instance's matrix; this also
avoids uploads for rigid covers with zero wind-bend scale.

Focused tests verify unchanged non-shear matrix entries, exact restoration when
wind returns to zero, near-cull removal/reinsertion, overflow rejection and no
upload-version change for a rigid cover. Both the native grass browser probe
and pause/resume/terrain-replacement walking check pass. TypeScript validation
passes. This reduces repeated CPU transform construction, not draw calls; no
frame-rate improvement is claimed without a scene performance measurement.

## Prepared procedural-object rules

The local vegetation loader now returns `proceduralRules` alongside the untouched
`procobj.dat` records. Preparation preserves all 95 rows in file order, covering
17 surfaces and 56 model names. It applies the inspected native initialization:
minimum distance is clamped upward to 80 before squaring, density uses the
reciprocal squared spacing, rotations become float32 radians, alignment uses
nonzero truth, and the grid flag converts through uint8. Repeated surface rules
and reversed scale/offset endpoints are preserved. Model IDs remain unresolved
until the full model catalog and render/collision dependencies are supplied.

The native manager stores 128 surface rules and 512 object list items. The new
preparation path enforces the rule capacity. It rejects nonpositive spacing and
float32-overflow/underflow density values because those cannot support bounded
grid traversal; this is defensive input validation, not original behavior.
The shipped public table passes these checks. Unit cases cover the 128/129
boundary, uint8 wrapping, reversed ranges and the 80-unit clamp.

Freshly verified source revision: `0076f9017b4aeef7433957ac2bd8b6988e9df166`.
[ProcSurfaceInfo.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Plant/ProcSurfaceInfo.cpp)
has SHA-256 `cb95fa1d946c16fc0202f999752a072b78a1f2dbba607b31f33bba1aaf786764`;
[ProcObjectMan.h](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Plant/ProcObjectMan.h)
has SHA-256 `cc1080086054f86cef65887739d08a716db294dd574f36d8b6aee62787247ad7`.

Placement generation still requires care: the inspected random-density branch
uses a strict cutoff comparison that skips its final iteration at density
exactly one, and the grid branch does not reset its Y iterator for each X column.
These require original-game verification before silently correcting them. The
source comment suggesting its random point can fall outside the triangle is
not supported by the displayed formula: with samples u,v in [0,1], its weights
are (1-u), u(1-v), uv, all nonnegative and summing to one. Original RNG side
effects, object/matrix pool lifetime, orientation, model dependencies and actual
procedural-object rendering remain outstanding.
