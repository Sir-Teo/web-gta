# Acquired map and terrain content

The project now has a persistent native-content depot at `/Users/teo/Developer/web-gta-content`, outside the game repository. This is actual downloaded map data, not placeholder geometry or a list of uninspected asset links.

## Sources and coverage

- [Noclip SA world archive](https://z.noclip.website/GrandTheftAutoSanAndreas/models/gta3.imgz): previously downloaded and inflated into `gta3.img`; copied into the persistent depot. The existing archive reader verifies its directory and bounds. It contains 12,955 DFF models, 2,750 TXD texture dictionaries, 216 COL collections and 164 IPL streams, among 16,297 total entries. Compressed size/hash provenance is in [the original acquisition report](PUBLIC_WORLD_RESOURCES.md).
- [Pinned Noclip scene manifest](https://github.com/magcius/noclip.website/blob/75086f2350cb6f320023931d6d73f20f5c6bbc32/src/GrandTheftAuto3/scenes.json): acquired all 55 listed IDE files and all 53 listed static IPL files from the viewer's public data host, plus `water.dat` and `timecycp.dat`. The manifest includes the three cities, countryside/desert, seabed, interiors and supporting placement metadata. The audit parsed 31 placement-bearing static/stream groups, totaling 44,818 exterior placement records. This includes LOD records and is not a count of unique visible objects.
- [MapAndreas heightmaps](https://github.com/philip1337/samp-plugin-mapandreas/tree/05411aae78410600a74213140b22afb4df5a6e60/heightmaps): useful supporting terrain-height data. The previously verified `SAmin.hmap` remains a separate diagnostic resource; it cannot replace native mountain, road, bridge and tunnel meshes.
- [DragonFF](https://github.com/Parik27/DragonFF): independent Blender inspection/import route for the same native formats. It is a tool, not the source of the acquired world archive.

The depot's `world-content.json` records source URLs, downloaded metadata sizes and SHA-256 hashes, district bounds, archive dependency gaps, and each sampled region's actual model/texture inventory. Public pack provenance is established; retail byte identity and complete original-game content are not.

## Newly assembled regions

Coordinates use native XY. Selection includes placement origins in the radius plus linked LOD ancestors; it does not guarantee a seamless circular boundary.

| Region | Static IPL | Center; radius | Models / placements | Verified state |
|---|---|---|---|---|
| Mount Chiliad | `country/countryS.ipl` | -2320, -1620; 400 | 87 / 162 | Decoded, textured, collision complete for selected scene; browser walking passes |
| Verdant Meadows | `country/countn2.ipl` | 400, 2500; 300 | 74 / 142 | Decoded/textured; missing collision dependency `lod_airstrm_med_`; not claimed walk-ready |
| Doherty | `SF/SFSe.ipl` | -2020, -100; 160 | 96 / 140 | Decoded, collision complete; browser walking passes; three models report unbound textures |
| Las Venturas sample | `vegas/vegasE.ipl` | 2020, 1500; 160 | 102 / 294 | Decoded/textured, collision complete; browser walking passes |

All four samples have zero omitted placements. Mount Chiliad, Verdant Meadows and Las Venturas have no reported unbound texture names. Doherty still reports unbound textures in `lodvingschlgrg_sfs`, `lod_03b_sfse` and `sub_floodlite`; its walking test is not visual-completeness proof. World streaming, full interior support and original traffic/path content remain unfinished. Bounded neighboring-district composition is now verified below; static textured water is covered in the water report.

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
