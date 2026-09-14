# Acquired map and terrain content

## Sherman Dam and reservoir terrain

The folder preset **Sherman Dam and reservoir terrain** combines
`country/countryN.ipl`, `country/countn2.ipl`, their archived binary streams and
`leveldes/seabed.ipl`. Native center is `(-715, 2050)`, radius 350, with
intersecting collision bounds included. The dam's placement evidence is in
the acquired `countryN.ipl`: `damlodbit1` at
`(-794.828125, 2025.4375, 31.3359375)` and `damlodbit2` at
`(-615.2890625, 2028.554688, 31.3359375)`; linked detailed geometry comes from
the district streams.

The browser-equivalent audit resolves **109 model types / 162 placements**,
zero omitted placements and zero missing playable collision dependencies.
The selection includes `dambit1`, `dambit2`, turbine structures, surrounding
desert terrain and seven detailed `sbcn_seafloor` meshes. The content report
contains no unbound-texture notices for this selection. Native DXT dictionaries
still include the previously documented absent tiny mip tails; reconstruction
of those tails is reported by the readers.

The folder browser test verifies model membership, both neighboring-district
namespaces, water/timecycle loading, native CJ, grounded spawn specifically on
`dambit1`, height between 59 and 61, and movement. The measured ground is
59.4079 world units. Inspected captures are
`artifacts/native-sherman-dam-content.png` and
`artifacts/native-sherman-dam-walking.png`. The overview remains a raw placement
preview with overlapping LODs; this test does not certify visual parity,
reservoir water behavior or the dam's mission interactions.

Validation: the real-folder browser case, seven folder-planner unit tests,
the nine-region audit regression (including intentional dictionary-conflict
failure), and the production build pass. Logs are
`/tmp/web-gta-sherman-{audit,audit-test,browser,unit,build}.log`.

### Selected-area preview framing

Bounded scenes now initially frame the requested native XY area, intersected
with the loaded content bounds. Full vertical bounds are retained. This changes
only the camera: crossing terrain/seabed meshes, LODs and collision remain loaded.
**Frame selected area** restores that view; **Frame model** retains the original
full-content framing. The new control is disabled for unbounded scenes and after
clearing the selection.

The dam regression compares selected-area and full-content camera distances,
checks repeatable framing and unchanged GPU allocations/placement count, and
captures both raw content and the optional distance/LOD view. The latter is
`artifacts/native-sherman-dam-lod-preview.png`; at this overview distance some
models are outside their draw ranges, so it is not a complete-content overview.
Dam walking and Gant/Grove folder switching pass after this change. Logs:
`/tmp/web-gta-region-frame-final.log` and
`/tmp/web-gta-region-frame-build.log`.

Optional original footstep recordings can be acquired into the same depot with
`node scripts/content/acquire-feet.mjs /absolute/path/to/content-depot`.
See [native audio acquisition](SFX_BANKS.md) for dependencies and verification.

The depot now also includes the verified 179-row `surfaud.dat` table for
collision-material footstep selection. See [surface audio](SURFACE_AUDIO.md).

## Reproduce or verify the native content depot

From the repository root, run:

```sh
node scripts/content/acquire-world.mjs /absolute/path/to/content-depot
node scripts/content/acquire-world.mjs /absolute/path/to/content-depot --verify-only
```

The acquisition script downloads the public native archive plus 115 companion
files (55 IDE, 53 static IPL, scene manifest, water, timecycle, particle, surface-audio, surface-info and adhesion data).
`scripts/content/world-sources.json` records exact URLs, sizes and SHA-256 hashes
for the inspected dataset. Both the compressed archive and the inflated IMG are
checked. These hashes establish reproducibility of this public dataset, not
byte identity with a certified retail release.

Use a directory outside the repository. A fresh acquisition retains a roughly
533 MB compressed cache in `.source-cache/` alongside the roughly 938 MB IMG.
Allow additional temporary disk space when replacing an existing file. Downloads
and inflation stream to temporary files; each destination is replaced only after
size and hash verification. A rerun reuses verified files and reacquires changed
or incomplete ones. A changed upstream file fails verification instead of silently
becoming a new fidelity baseline. There is no HTTP range resume; an interrupted
file is downloaded again, while previously completed files remain reusable.

`--verify-only` checks the 116 base content files without network access or
mutation; the compressed cache is optional once the IMG exists. This acquires map
and environment content, not all character, audio, mission or gameplay data.
Choose the resulting folder in the workshop using the workflow below. The tool
runs during content preparation; the browser game needs no application backend.

Acquisition failure checks: `node --test scripts/content/verified-file.test.mjs`.
To regenerate the detailed district and region report after acquisition, run:

```sh
node scripts/content/audit-world.mjs /absolute/path/to/content-depot/gta3.img /absolute/path/to/content-depot
```

The audit performs additional parsing and may fetch metadata; use the dedicated
verification command above when an offline integrity check is required.

Verified 2026-09-14: the existing depot passes all 113 checks. A separate fresh
directory, seeded only with the previously downloaded compressed archive,
successfully inflated and verified the IMG and downloaded all 112 companion
files. Its independent verification pass succeeded. The game's readers then
assembled all seven region presets with the established model/placement counts
and no omitted selections. This confirms reproducible input data and parsing;
it does not eliminate the known texture/collision gaps described below or prove
whole-world streaming and visual parity. Failure tests cover wrong hashes,
truncation, oversize input, interrupted streams, invalid inflated content,
changed-cache repair and avoiding downloads for verified files.

## Load a region from the local content folder

In the model workshop, choose `/Users/teo/Developer/web-gta-content` under
**Local content folder**, select a named **Map region**, then click **Load region
from folder**. This selects the depot's `gta3.img`, exact district IDE/static IPL
paths, matching archived streams, shared definitions, texture-parent links and
archived COL collections in a worker. **Walk scene** uses the same collision
eligibility gate as manual assembly. The chosen folder can load another preset
without selecting its individual files again; **Clear / cancel** releases it.

This path expects the acquired depot layout (`gta3.img`, `ide/`, `ipl/`), not an
arbitrary retail-installation layout. Exact relative paths prevent duplicate
basenames from selecting the wrong district or optional repair. Neighboring
districts retain independent static LOD namespaces. Definitions from outside the
selected districts' folders are added only when their model ID has one fully
consistent parsed definition across the supplied IDE files. Conflicting scoped
IDs and dictionaries still fail through the native scene reader. File count and
IDE byte limits bound selection and parsing.

The folder loader does not automatically apply files in `repairs/` or comparison
TXDs. Verdant Meadows therefore retains its unmodified
collision dependency gap; use the documented manual repair workflow when
desired. Local files are not uploaded, bundled or persisted across page reloads.
No application backend is needed.

Verification covers real-folder Gant Bridge assembly (250 models / 565
placements), switching to Grove Street (232 / 542), gameplay handoff, grounded
spawn and clearing the selection. The existing manual Gant Bridge test also
passes. Inspected `artifacts/native-folder-grove-walking.png`; its authored
character and current native rendering are not a retail appearance reference. Unit
checks cover district-stream pairing, scoped model IDs, ambiguous external
definitions, exact missing paths, duplicate/mixed folder roots and ignored
optional repair/texture files.

Final validation: 622 unit tests in 133 files, all ten native-content browser
tests (nine manual region cases plus the folder workflow), build and production
smoke pass. Production reports no external runtime requests or exposed
development hook. Logs: `/tmp/web-gta-folder-all-unit.log`,
`/tmp/web-gta-folder-final-browser.log` and `/tmp/web-gta-folder-production.log`.

### Native environment travels with folder scenes

Folder scenes now carry optional root `timecycp.dat` (preferred over
`timecyc.dat`), `water.dat` and `particle.txd` files through the local worker and
scene handoff. The game awaits the same loaders used by its Lighting controls
before enabling **Walk imported scene**. Their file limits, malformed-input
handling, status messages, replacement ownership and clear controls remain in
effect. An unavailable environment file is reported in the scene-ready message;
other successfully loaded components remain usable. Files are selected by exact
root paths, so a comparison or repair subfolder cannot silently override them.

The initial weather is an explicit static sunny preset: Los Santos row 1,
San Fierro row 5, Las Venturas row 10, countryside row 14 and Verdant Meadows
desert row 18. It is user-adjustable in Lighting. This choice does not implement
native weather scheduling, regional transitions or random weather state.

This activates the existing native sky/fog/building lighting, static water
polygons and the particle dictionary's sun/star, low-cloud and water rasters.
Gant Bridge uses San Fierro colors, while Grove Street uses Los Santos colors.
Missing optional files retain the existing fallback paths. Manually assembled
scenes continue to use manually loaded environment data. The native character,
dynamic waves, swimming, post-processing parity and whole-world streaming are
separate unfinished work.

Real-folder browser checks verify both named timecycle loads and their weather
rows, water and particle loader status, grounded gameplay, region switching and
clear behavior. The captures `artifacts/native-folder-gant-environment.png` and
`artifacts/native-folder-grove-walking.png` use the imported table; the earlier
manual-region captures used fallback lighting. These are source-data integration
checks, not evidence of retail pixel parity.

Environment validation passes 626 unit tests in 134 files, seven browser checks
covering the real folder handoff and lighting/water/particle ownership and GPU
behavior, plus build and production smoke. Logs:
`/tmp/web-gta-folder-environment-all-unit.log`,
`/tmp/web-gta-folder-environment-final-browser.log` and
`/tmp/web-gta-folder-environment-production.log`. Production still has no
external runtime requests or exposed development hook.

## Inspect distance and LOD transitions in the workshop

After assembling a scene, enable **Preview distance and LOD visibility** beside
**Frame model**. Orbiting, zooming and resizing now run the same loaded-scene
visibility adapter used in gameplay: source draw distances, transformed bounds,
frustum selection, resolved LOD relationships and distance fades. The default
raw view remains available and displays all loaded placement layers. Turning
the option off restores their prior visibility and material references; changing
the source scene releases its temporary fade materials and resets the control.
Scene data sent to gameplay includes every assembled placement in either mode.

The preview uses its own orbit camera, far plane and the default low-LOD scale
of one. It remains an unlit vertex-color inspection view; the native timecycle,
runtime weather-dependent low-LOD scaling, timed-object schedule and streaming
are not simulated here. A whole-region overview may sit beyond source draw
distances, so zoom closer when the visibility view is empty. Collision overlays
remain independent; turn them off to inspect the visible geometry alone.

Validation: 21 model/folder browser tests, 11 visibility unit tests, build and
production smoke pass. The real Gant Bridge check verifies reduced visible
placement counts, zoom response, restoration of all 565 raw placements, stable
retained geometry/texture counts, resetting on region replacement and successful
gameplay handoff while preview filtering was enabled. Inspected
`artifacts/native-gant-lod-preview.png`. Logs:
`/tmp/web-gta-lod-preview-browser.log`, `/tmp/web-gta-lod-preview-unit.log` and
`/tmp/web-gta-lod-preview-production.log`.

## Gant Bridge and northern approach

The **Gant Bridge and northern approach** preset combines `SF/SFw.ipl` and
`SF/SFn.ipl`, including each district's own archived streams and static LOD
namespace. Its native center is `(-2681.5, 1850)`, radius 550, with transformed
collision-bound intersection enabled. This resolves **250 model types, 565
placements, zero omitted placements and no missing playable collision models**
in the acquired Noclip content. The 88 resolved LOD replacements retain their
visual relationships and are excluded from playable collision.

All seven `ggbrig_01_sfw` through `ggbrig_07_sfw` sections, both `gg_split`
sections and `ggbridgeend_sfn` are present with native collision. The browser
test verifies both district namespaces, exact scene counts, successful game
handoff and walking. It additionally checks that the supporting collider is a
native bridge section and the player is over 40 units above sea level, so a
grounded spawn on nearby shoreline cannot pass as a bridge-deck test. Inspected
captures: `artifacts/native-gant-bridge-content.png` and
`artifacts/native-gant-bridge-walking.png`.

Four surrounding models have unresolved texture bindings: `bussign1` requests
`chrome`; `lodpstairssfn02` requests `greyground256128`; `lod_land2_sfn09`
requests `sf_pave6`; and `lod_land2_sfn09a01` requests `ws_trans_concr`. These
remain visible in the dependency report without arbitrary cross-dictionary
substitution. The native bridge sections have no reported unbound textures.
Existing tiny DXT mip reconstruction notices still apply. This preset is a
bounded scene; water, matching San Fierro weather, continuous streaming and
end-to-end bridge traversal are not established by this check. The walking
capture uses the authored character and fallback lighting, not a retail visual
parity reference.

Load the depot archive, SF/shared IDE files, `SFw.ipl` as the static source and
its district streams, plus `SFn.ipl` under **Neighboring district static IPLs**.
Enable all archived COL collections, choose the preset, assemble and select
**Walk scene**. Reproduce the browser check with
`GTA_CONTENT_DIR=/Users/teo/Developer/web-gta-content npx playwright test tests/browser/world-content.spec.ts -g gant-bridge`.

### Gant texture provenance follow-up

The expanded texture audit scans all 2,750 archived dictionaries and records
every candidate's dictionary hash, per-mip decoded RGBA hashes, dimensions,
reconstructed mip markers, filter, addressing and alpha declaration. It reads
`txdp` relationships from all acquired IDE resources, records their provenance,
and reports candidates inside and outside each model's declared dictionary
chain. Pixel identity includes every mip and its dimensions; appearance identity
also includes sampler and alpha metadata. These are content fingerprints, not
proof of rendered pixel parity.

| Missing raster | Same-name archive candidates | Distinct mip/pixel sets | Distinct pixel/sampler/alpha sets | Candidates in declared chain |
|---|---:|---:|---:|---:|
| `chrome` | 0 | 0 | 0 | 0 |
| `greyground256128` | 36 | 1 | 2 | 0 |
| `sf_pave6` | 32 | 3 | 3 | 0 |
| `ws_trans_concr` | 13 | 1 | 2 | 0 |

`signs.txd` and `lodtnsfn.txd` have no declared parents in the acquired IDE
resources. The four missing bindings affect respectively 8, 2, 1 and 33 source
triangles per model geometry. The prior Doherty gaps bring the combined scan to
eight affected models and 112 candidate rasters, with no candidate parse or
decode errors. The GTA Stuff comparison supplied 13 unique DFF/TXD files for
these eight models; all are byte-identical to the Noclip copies. That mirror
therefore supplies no repair for the affected files.

The locally inspected pinned [CTxdStore implementation](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/TxdStore.cpp)
at `TxdStoreFindCB` (0x731720) searches the current dictionary and its parents;
`TxdStoreLoadCB` (0x731710) returns null. It does not establish a global fallback
to arbitrary same-name archive rasters. Preserve the missing bindings until a
source-supported relationship or explicitly separate content repair is available.
This conclusion concerns the inspected files and callback, not every platform
edition or custom asset pack.

Reproduce with `node scripts/content/audit-texture-gaps.mjs /absolute/content-directory`;
append `--compare-public` to fetch the second source again. The depot's
`texture-gaps.json` contains the detailed identity and chain audit;
`texture-gaps-public.json` retains the public comparison evidence. No texture
substitution or renderer behavior changed during this investigation.

The project now has a persistent native-content depot at `/Users/teo/Developer/web-gta-content`, outside the game repository. This is actual downloaded map data, not placeholder geometry or a list of uninspected asset links.

## Sources and coverage

- [Noclip SA world archive](https://z.noclip.website/GrandTheftAutoSanAndreas/models/gta3.imgz): previously downloaded and inflated into `gta3.img`; copied into the persistent depot. The existing archive reader verifies its directory and bounds. It contains 12,955 DFF models, 2,750 TXD texture dictionaries, 216 COL collections and 164 IPL streams, among 16,297 total entries. Compressed size/hash provenance is in [the original acquisition report](PUBLIC_WORLD_RESOURCES.md).
- [Pinned Noclip scene manifest](https://github.com/magcius/noclip.website/blob/75086f2350cb6f320023931d6d73f20f5c6bbc32/src/GrandTheftAuto3/scenes.json): acquired all 55 listed IDE files and all 53 listed static IPL files from the viewer's public data host, plus `water.dat` and `timecycp.dat`. The manifest includes the three cities, countryside/desert, seabed, interiors and supporting placement metadata. The audit parsed 31 placement-bearing static/stream groups, totaling 44,818 exterior placement records. This includes LOD records and is not a count of unique visible objects.
- [MapAndreas heightmaps](https://github.com/philip1337/samp-plugin-mapandreas/tree/05411aae78410600a74213140b22afb4df5a6e60/heightmaps): useful supporting terrain-height data. The previously verified `SAmin.hmap` remains a separate diagnostic resource; it cannot replace native mountain, road, bridge and tunnel meshes.
- [DragonFF](https://github.com/Parik27/DragonFF): independent Blender inspection/import route for the same native formats. It is a tool, not the source of the acquired world archive.

The depot's `world-content.json` records source URLs, downloaded metadata sizes and SHA-256 hashes, district bounds, archive dependency gaps, and each sampled region's actual model/texture inventory. Public pack provenance is established; retail byte identity and complete original-game content are not.

## Grove Street and Ganton preset

The model workshop now offers **Grove Street and Ganton**, centered on native XY `(2495, -1687)` with a 180-unit radius and transformed collision-bound intersection enabled. Select `LA/LAe2.ipl`, its archive streams, LA and shared IDE definitions, and all archived COL collections. The preset includes terrain whose origin lies outside the radius, together with linked LOD ancestors.

The native-content audit and browser assembly both resolve **232 model types and 542 placements**, with zero omitted placements, no reported unbound textures and no missing playable collision dependencies. There are 87 resolved LOD replacement placements excluded from playable collision. An initial comparison also loaded `LA/LAe.ipl`; it contributed no selected placements at this center/radius, so the final preset requires LAe2 only.

The Playwright case `public world content assembles and supports walking: grove-street` verifies preset coordinates, scene counts, successful handoff into gameplay, grounded spawn and movement. Inspected captures are `artifacts/native-grove-street-content.png` and `artifacts/native-grove-street-walking.png`. Native houses, road, sidewalks and surrounding terrain render in the playable scene. The player in this test remains the authored placeholder; lighting is not a calibrated original-game comparison. This is bounded region loading, not continuous world streaming, and IPL gameplay sections such as entrances, garages and pickups remain unimplemented.

Reproduce with `GTA_CONTENT_DIR=/Users/teo/Developer/web-gta-content npx playwright test tests/browser/world-content.spec.ts -g grove-street`.

## Newly assembled regions

Coordinates use native XY. Current presets include placement origins and intersecting transformed COL bounds, plus linked LOD ancestors. This improves coverage of large terrain pieces but does not guarantee a seamless circular boundary.

| Region | Static IPL | Center; radius | Models / placements | Verified state |
|---|---|---|---|---|
| Mount Chiliad | `country/countryS.ipl` | -2320, -1620; 400 | 120 / 195 | Decoded, textured, collision complete for selected scene; browser walking passes |
| Verdant Meadows | `country/countn2.ipl` | 400, 2500; 300 | 93 / 164 | Decoded/textured; missing collision dependency `lod_airstrm_med_`; not claimed walk-ready |
| Doherty | `SF/SFSe.ipl` | -2020, -100; 160 | 133 / 180 | Decoded, collision complete; browser walking passes; four models report unbound textures |
| Las Venturas sample | `vegas/vegasE.ipl` | 2020, 1500; 160 | 139 / 343 | Decoded/textured, collision complete; browser walking passes |

All four samples have zero omitted placements. Mount Chiliad, Verdant Meadows and Las Venturas have no reported unbound texture names. Doherty still reports unbound textures in `lodsion_09_sfs`, `lodvingschlgrg_sfs`, `lod_03b_sfse` and `sub_floodlite`; its walking test is not visual-completeness proof. World streaming, full interior support and original traffic/path content remain unfinished. Bounded neighboring-district composition is now verified below; static textured water is covered in the water report.

## Content compatibility repair

Actual dictionaries contain zero-byte DXT mip payloads after a dimension falls below the 4×4 compression block size. Examples include `ws_scaffoldscreen`, `des_oldrunwayblend`, `sf_road5`, and rectangular tails such as `des_tunnellight` at 4×2. Previously, parsing these dictionaries aborted the entire scene even when another texture was the requested one.

The importer now accepts only absent non-base DXT levels with at least one dimension below four, retaining all supplied mip bytes. Missing pixels are reconstructed by box averaging the preceding decoded level; model notices identify the affected texture and levels. These reconstructed low-resolution pixels are an explicit browser content repair, not original raster data or verified retail rendering behavior. Empty base images, empty levels at least 4×4, wrong nonzero lengths and empty uncompressed levels remain rejected.

## Reproduce and inspect

Run `node scripts/content/audit-world.mjs /absolute/path/gta3.img /absolute/content-directory` from the project. It fetches the pinned manifest and metadata, copies the archive if needed, validates cached metadata hashes, and runs the project's native readers against the content. It records failures explicitly rather than substituting shapes. It does not download the large archive automatically; the verified compressed archive is linked above.

Open the model workshop, select the depot's `gta3.img`, and load the region's IDE folder plus `generic`, `leveldes/levelmap.ide`, `leveldes/seabed.ide`, `interior/propext.ide` and `txd.ide`. Select the listed static IPL, click **Select district streams**, enable all archived collision collections, and choose the named **Map region** preset (or enter the listed area manually). Assemble, then use **Walk scene** when enabled. For cross-region assets, the audit adds globally unambiguous definitions; same-ID conflicts are not silently merged into a universal IDE. ID 16700, for example, has different definitions in `country/countn2.ide` and `leveldes/leveldes.ide`.

Validation: 577 unit tests in 120 files and build pass. Optional `world-content.spec.ts` loads the actual mountain and Doherty assets through the browser worker, checks exact placement counts and enabled collision-backed entry, then verifies grounded movement. Both tests pass. Inspected `artifacts/native-mount-chiliad-content.png`, `native-doherty-content.png` and the walking capture. The previews show actual native mountain/road/vegetation and city meshes. Current diagnostic lighting and authored character are not a claim of original-game appearance parity.

Production smoke also passes with no page errors, exposed development hooks or external runtime requests. Final content browser run: two passes in 7.6 seconds. Logs are `/tmp/web-gta-content-{audit,unit,mips,browser,build,production}.log`.


## Region presets and remaining-dependency audit

The workshop's **Map region** selector supplies the audited center/radius, exterior selection and required static IPL filename for Mount Chiliad, Verdant Meadows, Doherty and Las Venturas. Manual edits return the selector to Custom area. The acquisition script and workshop share `WORLD_REGIONS`, avoiding separate preset coordinates. The local files are still selected explicitly; choosing a preset does not download or assemble assets automatically.

All three collision-complete presets now pass browser scene assembly, exact placement counts and grounded walking: Mount Chiliad, Doherty and Las Venturas (three passes, 10.8 seconds). Inspected `artifacts/native-las-venturas-content.png`. Build passes and the refreshed acquisition audit retains the same four regional model/placement counts. Logs: `/tmp/web-gta-content-presets-{audit,browser,build}.log`.

Verdant Meadows' missing `lod_airstrm_med_` is static `countn2.ipl` index 161, positioned at native `(540.6171875,2360.984375,29.859375)`. No placement in the loaded countn2 streams links to that static LOD. Other instances of the same model do have linked high-detail model 3175. This evidence does not justify excluding the unlinked instance from collision planning merely because its name starts with LOD. The region remains unavailable for walking until the content relationship or original behavior is resolved.

A scan of all 2,750 archive TXDs found five exact-name `pierplanks_128` rasters: `cxref_desert.txd`, `laesmokecnthus.txd`, `santamonicalaw2.txd`, `pierc_law2.txd`, and `pierb_law2.txd`. All are 64×64, but sampler metadata differs (filter 2 in the desert dictionary, filter 6 in the others). No exact `ASJMSFSE2` or `striplights02` raster was found. No parent definitions connect the failing dictionaries in the supplied `txd.ide`. An arbitrary global texture fallback would hide the unresolved provenance, so none was added. This scan does not establish that external dictionaries or another source edition lack those textures. Candidate report: `/Users/teo/Developer/web-gta-content/missing-texture-search.json`.

## Optional Verdant Meadows placement repair

A follow-up scan of all 164 archived IPLs found the missing high-detail instance in the **same** district: `countn2_stream2.ipl`, instance 125, model 3175. Its position `(540.6171875,2360.984375,29.859375)` and quaternion match static `countn2.ipl` instance 161, model 3347. Unlike the other three instances of this high-detail/LOD pair, its binary `lodIndex` is -1. Thus the high-detail object was already in the scene; the unresolved relationship made the extra low-detail object appear to require its own collision.

`scripts/content/repair-verdant-lod.mjs` produces an **optional separate file**, never modifying `gta3.img`. It changes only the signed 32-bit LOD field at bytes 5112–5115 from -1 to 161. The exact source stream SHA-256 must be `ddd290e995e34497ce9cb55c9c55aca9abf1c5e029ec0c4fb440aa316999cefb`, and the static companion must hash to `3afc8a78a31cb41299136687debcf69740cf8bd965bbd17762ecbe9345bef9ab`. The repaired stream hashes to `06b0be323130d0e9598c3c1ef53898613f3cd6c9c68ce96e5ec4e88f3db9e093`. A sidecar records the hashes, exact byte changes and rationale. This is an inferred content repair supported by coincident transforms and the three existing model pairs, not proof of original retail placement data. No general LOD-name heuristic or invented collider was added.

Generate it with `node scripts/content/repair-verdant-lod.mjs /absolute/content-directory`. In the workshop, select the Verdant Meadows preset and its normal source files/streams. Deselect `countn2_stream2.ipl` from **Additional archived streamed IPLs**, then choose `repairs/verdant-lod/countn2_stream2.ipl` under **Additional streamed .ipl files**. Keep `countn2_stream0.ipl` as the primary source and all other district streams selected. Assemble and use **Walk scene**. Loading both the original and replacement stream is intentionally not supported.

Validation with this replacement: 74 model types, 142 placements, zero omitted placements, enabled collision-backed entry and grounded walking pass in the browser (one targeted test, 4.3 seconds). Inspected `artifacts/native-verdant-meadows-content.png`; the desert terrain, roads and aircraft-storage structures render. Build passes. A changed static IPL is rejected, and repeating the repair succeeds against the unchanged archive with the same output hash. The unmodified depot audit intentionally continues to report the original missing dependency. Logs: `/tmp/web-gta-verdant-{repair,repair-repeat,browser,build}.log`.

## Terrain crossing a region boundary

The workshop now offers **Include terrain crossing the area boundary**. Origin-only selection remains available for the existing snapshots; enabling this option also selects objects whose transformed COL bounding boxes overlap the chosen native-XY circle. This recovers large terrain meshes whose origins fall outside the region. It preserves original placement indices and linked LOD ancestry.

The implementation uses the same inverse IPL quaternion and native-to-browser coordinate transform as rendering. It projects the transformed world AABB onto the horizontal plane and tests the closest point against the region circle. This is conservative box coverage, not triangle intersection: it can include objects that occupy only part of their box. Models without COL bounds still use their placement origin, and visual overhangs beyond COL bounds can remain excluded. It does not merge neighboring static IPL namespaces or implement streaming. Existing decoded-memory/model limits still apply.

The audit can reproduce this selection with `--collision-bounds`, writing `world-content-bounds.json` separately from the origin-only audit:

| Region | Origin-only placements | With crossing bounds | Model types with bounds |
|---|---:|---:|---:|
| Mount Chiliad | 162 | 195 | 120 |
| Verdant Meadows | 142 | 164 | 93 |
| Doherty | 140 | 180 | 133 |
| Las Venturas | 294 | 343 | 139 |

All four expanded samples decode with zero omitted placements. The unmodified Verdant Meadows source still reports its documented unlinked LOD; the bounds audit does not silently apply the optional placement repair. Other expanded samples have no missing collision models. The expanded mountain scene passes browser assembly and grounded walking (4.5 seconds), and `artifacts/native-mount-chiliad-bounds-content.png` was visually inspected. Additional terrain/road meshes appear around the base. Synthetic tests cover a long terrain mesh with a distant origin, retained LOD ancestry, missing-bound fallback, asymmetric rotated bounds and interior exclusion. Logs: `/tmp/web-gta-terrain-bounds-{tests,rotation,audit,browser,unit,production}.log`.

Final validation: 579 unit tests/121 files pass; the asymmetric rotation check also passes after strengthening its fixture. Production build/smoke passes with no page errors, exposed development hooks or external runtime requests.

## Water content

The acquired `water.dat` now has a validated reader and inspectable mesh/atlas export: 307 polygons, 608 triangulated faces, with all source flow/wave fields and flags preserved. [Water topology research](WATER.md) records exact provenance, outputs and the remaining gameplay/render integration work.


## Combined Los Santos district content

The workshop can combine neighboring static IPLs with their matching archive streams. Each district retains its own static array and LOD references; identical numeric indices in different districts never resolve against one another. Source files are not rewritten. The primary district keeps its existing namespaces; neighbors use `district:1:static`, `district:1:primary`, and corresponding stream namespaces.

Reproduce the verified LAe2/LAe border scene from the acquired depot:

1. Select `gta3.img` and all IDE files in `ide/LA`, `ide/generic`, and `ide/leveldes`, plus `ide/interior/propext.ide` and `ide/txd.ide`. This sample needs shared definitions beyond `levelmap.ide` and `seabed.ide`.
2. Select `ipl/LA/LAe2.ipl` as the primary static IPL and use **Select district streams**. Select `ipl/LA/LAe.ipl` under **Neighboring district static IPLs**; its matching archive streams are selected automatically.
3. Enable all archived collision collections. Enter native center **2250, -1500**, radius **125**, exterior, with **Include terrain crossing the area boundary** enabled.
4. Assemble and select **Walk scene**.

At the same selection, LAe2 alone has 60 model types and 133 placements. Adding LAe produces **136 model types and 367 placements**, including **234 neighboring-district placements**, with zero omitted placements and zero missing collision models. The browser test verifies exact counts, distinct district references, enabled scene entry and grounded movement. Both the overview and walking captures were visually inspected: native roads, houses and vegetation appear across the selected border. The character remains an authored placeholder and lighting is not appearance-parity proof.

This is bounded scene composition, not continuous world streaming. Up to 15 neighboring districts are accepted, with a combined 128 MiB IPL input limit and 200,000 source instances. Existing selected-scene model, geometry and memory limits remain enforced. Duplicate placement filenames and nested district requests are rejected. Synthetic tests verify that two districts sharing static index zero retain distinct LOD targets, and malformed namespaces are rejected.

Validation: 588 unit tests passed before the final namespace-boundary test; all 16 scene tests passed afterward. Production build/smoke passed. The real combined-content browser test passed in 4.7 seconds. Logs: `/tmp/web-gta-district-{all-unit,focused-final,production,build-final,browser}.log`. Captures: `artifacts/native-la-border-content.png` and `artifacts/native-la-border-walking.png`.


## Texture-gap comparison against a second public host

[GTA Stuff's model database](https://gtastuff.com/models/?id=11372) provides individually downloadable DFF/TXD files. Its public viewer selects SA files with `/api/file?name=<filename>`; standalone archive assets additionally use a `source` parameter. This offers a useful per-model content source without acquiring another full world archive. Availability is not a redistribution license or proof of an independent retail extraction.

The six downloaded files for the three outstanding Doherty texture gaps are **byte-identical** to their entries in the acquired Noclip archive. All six parse successfully with the project's readers. The absent textures are referenced by actual triangle groups, not merely unused material entries:

| Model | Missing raster | Affected triangles per model |
|---|---|---:|
| `lodvingschlgrg_sfs` | `ASJMSFSE2` | 8 |
| `lod_03b_sfse` | `pierplanks_128` | 4 |
| `sub_floodlite` | `striplights02` | 6 |

The driving-school LOD's only material is affected. The floodlight has four placements in the audited Doherty region. A fresh case-insensitive scan of all 2,750 archive dictionaries again found five exact-name `pierplanks_128` candidates and no exact match for the other two names, with zero candidate-dictionary parsing errors. Matching names in unrelated dictionaries do not establish the intended binding. No source data or runtime texture bindings were changed.

Reproduce with `node scripts/content/audit-texture-gaps.mjs /absolute/content-directory --compare-public`. Without the flag, it performs only the local content audit. The script derives affected models from `world-content.json`, counts their material triangles and atomic references, scans candidate raster names, validates downloaded native files, and records archive/comparison SHA-256 hashes. Report: `/Users/teo/Developer/web-gta-content/texture-gaps-public.json`; downloaded comparison files: `comparison/gtastuff/` in that depot. The validated run found three affected models, five candidate rasters and six matching public files. Syntax validation and output assertions passed; no runtime code changed.

Direct comparison examples: [driving-school dictionary](https://gtastuff.com/api/file?name=drivingschool_sfse.txd), [San Fierro LOD dictionary](https://gtastuff.com/api/file?name=lod_sfse3.txd), [floodlight dictionary](https://gtastuff.com/api/file?name=docklight.txd).


## Eastern Mount Chiliad countryside

The **Mount Chiliad eastern countryside** preset combines `country/countryS.ipl` with neighboring `country/countryw.ipl`, covering native center **-1750, -1450**, radius **450**. This preset enables terrain crossing the selection boundary by default. The workshop shows both required static IPLs; the neighboring file is selected through **Neighboring district static IPLs**. Load the country and generic IDE folders, `leveldes/levelmap.ide`, `leveldes/seabed.ide`, `interior/propext.ide`, and `txd.ide`, plus all archived COL collections. Select the primary district streams normally; neighboring streams are discovered from its static filename.

At this selection, countryS alone contains 79 model types / 134 placements. Adding countryw produces **172 model types / 328 placements**, including **194 neighboring-district placements**. There are zero omitted placements, zero missing collision models, and no reported unbound textures. The browser assembled the real files and verified grounded walking. Inspected captures show native mountain slopes, river-valley terrain, roads and vegetation; the scene remains bounded and its river water must be loaded separately through the existing water controls. The authored player and current lighting still do not establish original-game appearance parity.

Region definitions now carry optional neighboring districts and the default collision-boundary selection. Selecting a preset applies those defaults; manually changing the boundary option returns the selector to Custom area. The acquisition audit uses the same defaults and composes the same district groups. `world-content.json` now reports a per-region `selection`; its top-level `preset-defaults` indicates that individual presets can differ. `--collision-bounds` continues to force bounds for every preset. The four prior presets retain their prior default counts.

Validation: all 589 unit tests in 123 files pass, production build/smoke passes with no external runtime requests, and the new content browser check passes. All region browser cases passed their final checks, including the existing mountain bounds case after updating its assertion for the intentional Custom area behavior. Logs: `/tmp/web-gta-chiliad-east-{audit,unit,production,all-browser,final-browser}.log`. Captures: `artifacts/native-chiliad-east-content.png` and `artifacts/native-chiliad-east-walking.png`.


## Regional lighting records

The IPL reader now preserves all eight acquired regional timecycle boxes. Scene metadata and the content audit retain their source files, lines, bounds and lighting/distance parameters. Playable color/fog effects now apply with a local timecycle table; regional low-LOD scaling is also connected to the native root-object range rules. See [regional timecycle content](TIMECYCLE_BOXES.md) for the exact layouts, coverage, native quantization/blending requirements and validation.


## Terrain boundary inclusion is now the preset default

All six native map presets now enable transformed COL-bound intersection. The older Mount Chiliad, Verdant Meadows, Doherty and Las Venturas defaults previously used only placement origins. Their selected placement counts increase from 162 to 195, 142 to 164, 140 to 180 and 294 to 343 respectively, without changing the center or radius. Manual origin-only selection remains available; its Mount Chiliad browser regression still resolves 87 models and 162 placements and returns the selector to Custom area.

The updated native audit reports no omitted placements. All eight content browser cases pass, including scene handoff, grounded spawn and movement. Verdant Meadows walking still uses the documented optional LOD repair; the unmodified archive continues to report `lod_airstrm_med_` as an unresolved collision dependency. The change does not bypass that condition.

The broader Doherty selection exposes `lodsion_09_sfs`, whose eight affected triangles request `ws_whitewall2_bottom` from `lod_sfse3.txd`. A fresh scan of all 2,750 dictionaries finds 26 exact-name candidates elsewhere, with differing sampler settings. Seven unique DFF/TXD files checked through GTA Stuff are byte-identical to their Noclip archive counterparts. No arbitrary cross-dictionary replacement is applied. Details, hashes and face counts are in the depot's `texture-gaps-public.json`.

Inspected screenshots cover mountain and Doherty walking plus the expanded Las Venturas and desert assemblies. These verify visible native content, not pixel parity: the region edges remain finite, preview LODs are raw, and the walking character remains a placeholder. Logs: `/tmp/web-gta-preset-bounds-{audit,browser,build,unit}.log` and `/tmp/web-gta-preset-texture-gaps.log`.

## Gant Bridge bay-floor content

The Gant Bridge folder preset now includes `leveldes/seabed.ipl` alongside
`SF/SFw.ipl` and `SF/SFn.ipl`, retaining the same center and 550-unit radius.
The acquired seabed source adds 16 placements: eight detailed terrain models
and their eight LOD replacements. The resulting assembly contains **266 model
types / 581 placements**, zero omissions and no missing playable collision
models. Detailed additions include `sbseabed_sfn02`, `sbseabed_sfn03`,
`sbseabed_sfncunt`, `sbseabed1_sfw`, `sbseabed2_sfw`, `sbseabed6_sfw`,
`sbseabed_sfn03bb` and `sbseabed_sfn01`. All eight have native COL data;
the linked LODs are excluded from playable collision. No added model reports
an unbound texture. Source files remain unchanged in the external depot.

The old 256-model assembly and installation caps prevented this complete local
selection. Both now allow 512 model types; the existing 128 MiB decoded-array
assembly budget, 4,096 placements, two-million-triangle visual/physics budgets
and other installation limits remain enforced. This is still a bounded region,
not full-world streaming or a total browser-memory guarantee.

Browser validation exposed a separate folder-planning issue: treating the seabed
as a district promoted all `leveldes` definitions into scope, including unrelated
`cargo_test` definitions with conflicting dictionaries. Folder planning now
selects the requested `leveldes` file explicitly while retaining existing shared
metadata and unambiguous external definitions. Unit coverage exercises that
scope boundary and verifies over-cap rejection before scene installation.

The real-folder browser check verifies seabed model names and their distinct
placement namespace, all 581 placements, LOD toggling, collision-backed scene
entry, environment loading, and switching back to Grove Street. This does not
establish underwater rendering parity or swimming behavior. The standalone
workshop preview omits water and uses diagnostic lighting.

Validation: 677 tests across 142 files pass; the folder browser test passes
(6.1 seconds); production build and smoke verification pass with no external
runtime requests. Inspected `artifacts/native-gant-seabed-content.png` shows the
bay-floor meshes beneath the bridge; the distant diagnostic view is not an
appearance-fidelity measurement. Logs: `/tmp/web-gta-seabed-{audit,unit,browser,production}.log`.

## Region audit follows browser folder planning

`audit-world.mjs` now calls `planWorldFolder` for each named region, using the
archive and the pinned manifest's IDE/IPL files. The audit previously assembled
its own request: it collapsed definitions by ID/model and did not run the
browser's dictionary-conflict validation. That let a region audit succeed even
when the corresponding browser folder selection failed. Shared metadata scope,
required district files and related stream matching now use the browser planner.
Each regional report includes `planner: "browser-folder"`.

A failed region still receives an error record, and the audit continues to
report other regions, but the process exits with status 1 after saving the
report. Missing collision or texture notices remain explicit content findings;
status 0 means region assembly succeeded, not that every fidelity issue is
resolved. District-wide inventory remains a preliminary dependency scan; the
named-region results are the browser-planned assembly evidence. The audit's
input includes manifest map files, not arbitrary extra files that a user might
add to a folder, and it does not validate environment installation or playback.

Run the regression with:

```sh
GTA_CONTENT_DIR=/absolute/path/to/content-depot node --test scripts/content/audit-world.test.mjs
```

The test copies small cached metadata into a temporary depot, links the archive
read-only, confirms all seven named assemblies and the Gant seabed, then injects
a conflicting `chinagate` dictionary definition. The changed fixture makes
Gant fail through the browser planner with process status 1 while Grove still
assembles. The original depot is never edited. Validation passed in 7.8 seconds;
all 114 source content files subsequently passed offline hash verification.
Logs: `/tmp/web-gta-folder-audit.log`, `/tmp/web-gta-folder-audit-test.log`.

## Santa Maria Beach, pier and coastal seabed

The `santa-maria` folder preset selects native XY `(600,-1900)`, radius 400,
from `LA/LAw2`, neighboring `LA/LAw`, and `leveldes/seabed`. Selection includes
transformed collision bounds and original LOD ancestry. With the supplemental
files below, it resolves **348 model types / 1,539 placements**, zero omissions
and no missing playable collision dependencies. Content includes the `pier01`–
`pier04` LAw2 structures, beach meshes, coastal roads and separate seabed.

The Noclip archive alone lacks four outdoor-gym DFFs: `gym_mat1`, `gym_bench1`,
`gym_bike` and `gym_mat02`. Its base assembly contains 344 model types / 1,535
loaded placements and four omissions; walking correctly remains disabled.
The supplied `interior/props2.ide` defines these models as IDs 2631, 2629,
2630 and 2632 respectively, all using `genintint_gym`.

The [GTA Stuff model database](https://gtastuff.com/models/?id=2630) supplies all
four missing DFFs, `genintint_gym.txd`, and individual COL3 files for IDs
2629–2632 through its public file endpoint. Its
[collision index](https://gtastuff.com/models/data/collisions.min.json) identifies
all four collision sources as `gta_int.img/props2.col`. These files were downloaded,
hashed, decoded by our readers and installed in the browser. This establishes
usable public content and its publisher's provenance, not certified retail-byte
identity. Exercise interactions and movable gym machinery are not implemented.

Acquire or verify the nine files with:

```sh
node scripts/content/acquire-santa-maria.mjs /absolute/path/to/content-depot
node scripts/content/acquire-santa-maria.mjs /absolute/path/to/content-depot --verify-only
```

`scripts/content/santa-maria-sources.json` pins URLs, byte sizes and SHA-256
hashes. Files live under `supplemental/`; acquisition verifies each file before
replacement and never modifies `gta3.img`. A fresh temporary-depot acquisition
and subsequent offline verification both passed.

Folder import recognizes direct `supplemental/*.dff`, `*.txd` and `*.col` files.
DFF/TXD files fill absent archive entries; same-name archived files retain
precedence. Additional collision collections must have unambiguous model names,
using the existing collection validation. Supplemental model imports are bounded
by 256 files, 128 MiB total source bytes and 64 MiB per file, plus existing decoded
scene budgets. Supplemental DFFs retain the archive texture cache and parent
lookup. Nested folders and unrelated comparison files are not automatically used.
The world audit now includes these files and records their source hashes separately
in `supplementalFiles`; it still reports the incomplete base content when they are
absent. The original 114-file content verifier remains the base-dataset check.

Two texture bindings remain unresolved: `kb_canopy128` on `kb_canopy_test`, and
`bevgrnd03b_lawLOD` on `lodcanal_floor3`. These remain reported rather than replaced
with unrelated rasters. The earlier San Fierro gaps also remain unresolved: a
renewed public search did not establish a verified repair for them.

The browser test verifies all placements, the pier/beach/seabed metadata,
environment and water transfer, grounded entry and walking. Inspected
`artifacts/native-santa-maria-content.png` and
`artifacts/native-santa-maria-walking.png` show the native coast and textured
shoreline. The walking capture uses the authored placeholder character; neither
capture establishes pixel parity. Full-world streaming remains absent.

Validation: 679 tests across 142 files pass, both folder browser tests pass
(9.8 seconds), and the eight-region audit/injected-conflict regression passes.
Production build and smoke checks pass with no external runtime requests.
Logs: `/tmp/web-gta-santa-maria-{audit,unit,browser,audit-test,production}.log`.


## Native surface behavior tables

The public host also supplies [surfinfo.dat](https://z.noclip.website/GrandTheftAutoSanAndreas/data/surfinfo.dat)
and [surface.dat](https://z.noclip.website/GrandTheftAutoSanAndreas/data/surface.dat).
They are now pinned in `world-sources.json` and acquired by `acquire-world.mjs`:

| File | Bytes | SHA-256 |
|---|---:|---|
| surfinfo.dat | 28,106 | `431b95d4dcb20ce5258f7d939902c56d50fb4ee68b30ed7a044919c666291b55` |
| surface.dat | 576 | `09cf086c44c2409f6d5f40f58d7a753f0384d227b7f8c27fec7fe5dbe56c4a90` |

All 179 surface-info rows map uniquely to the 179 native surface IDs, with no
unknown categories or narrowing issues reported by the reader. Every row has
37 tokens: the 36 gameplay fields followed by a repeated surface-name label.
The pinned [SurfaceInfo::Read](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/SurfaceInfo_c.h)
uses 36 scanf conversions and ignores trailing text. Our reader now follows
that behavior while retaining required-field validation and text-size limits.
The prior exact-column check rejected this actual public dataset.

The adhesion file has six positional rows and 21 explicit lower-triangle
coefficients. Verified wheelbase-to-tarmac adhesion is 4.5, and wheelbase-to-deep
sand is 3.0 using the existing explicit-cell reader. Absent upper-triangle cells
remain absent; no symmetry rule is inferred. Raw deep-sand wet grip is +0.50,
while default/tarmac wet grip is -0.25. These raw values are not Rapier friction
coefficients. The native loader's wet-grip byte conversion and missing-cell
handling remain separate implementation questions.

This step acquires and parses the tables; it does not yet automatically apply
them to imported-scene movement. Surface flags describe sprint restrictions,
steep slopes, stairs, soft landing and other behavior that still needs source-
matched integration. Validation: 681 tests / 143 files pass, including the real
hash-locked data, complete ID coverage, category validation and explicit
adhesion pairs. Log: `/tmp/web-gta-surface-content-unit.log`.

The sprint-eligibility field is now connected to imported on-foot movement and
gait selection. See [surface movement](SURFACE_MOVEMENT.md) for the source rule,
contact-query limits, and restricted/unrestricted floor browser evidence. Other
surface behaviors and adhesion remain separate integration work.

When the selected depot also contains the complete classic player files and
`animations/ped.ifp`, imported regions now start with native Normal CJ and the
existing normal movement preset automatically. See [character assets](CHARACTER_ASSETS.md).
## Custom areas from the content folder

The folder loader now accepts explicit region coordinates and radius while
retaining a named preset's district source selection. In the workshop:

1. Choose the local content folder and a **Map region** to establish its primary
   district and any neighboring district files.
2. Edit **Native center X**, **Native center Y**, **Area radius**, or the terrain
   boundary option. The preset label clears and the source note identifies the
   retained districts and custom-area mode.
3. Use **Load region from folder**, then **Walk scene** when collision is complete.
   Selecting a named preset again restores its original coordinates and radius.

`planWorldFolder(files, regionId, selection)` validates and copies the custom
selection before reading content. Geometry selection, preview framing, native
paths/routes and preferred walking spawn all receive those same coordinates.
The preset still controls district dependencies and the temporary regional
weather row. This is not automatic geographic district discovery: moving the
center outside those source districts can yield missing coverage or no scene.
Blank/nonfinite coordinates and invalid radii are rejected; disabling the area
limit blocks folder loading. Clearing the workshop removes retained source
selection so a later folder cannot silently reuse it.

Verified custom case: Grove district sources at native **(2495, −1600)** with
radius **140** and intersecting terrain bounds enabled. The custom scene has
zero omitted placements, complete collision for walking, correctly centered
preview framing and a grounded player within the requested radius. Inspected
captures: `artifacts/native-ganton-custom-area.png` and
`artifacts/native-ganton-custom-walking.png`. Existing Grove and Gant folder
loading/walking cases also pass. Eight planner tests, the two browser cases,
the final blank-coordinate browser regression and production smoke pass.
Logs: `/tmp/web-gta-custom-region-unit.log`,
`/tmp/web-gta-custom-region-browser.log`,
`/tmp/web-gta-custom-region-final-browser.log`,
`/tmp/web-gta-custom-region-production.log`.

Continuous exploration remains unfinished: gameplay currently installs one
bounded scene, and the loader does not automatically select new district
sources, reconcile overlapping placements, or stream collision around a moving
player. Custom-coordinate requests remove the preset-only loading restriction;
they do not yet implement that streaming lifecycle.
