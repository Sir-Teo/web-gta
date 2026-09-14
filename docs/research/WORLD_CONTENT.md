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
| Las Venturas sample | `vegas/vegasE.ipl` | 2020, 1500; 160 | 102 / 294 | Decoded/textured, collision complete; not yet browser walking-tested |

All four samples have zero omitted placements. Mount Chiliad, Verdant Meadows and Las Venturas have no reported unbound texture names. Doherty still reports unbound textures in `lodvingschlgrg_sfs`, `lod_03b_sfse` and `sub_floodlite`; its walking test is not visual-completeness proof. World streaming, adjacent district composition, water rendering, interiors and original traffic/path content remain unfinished.

## Content compatibility repair

Actual dictionaries contain zero-byte DXT mip payloads after a dimension falls below the 4×4 compression block size. Examples include `ws_scaffoldscreen`, `des_oldrunwayblend`, `sf_road5`, and rectangular tails such as `des_tunnellight` at 4×2. Previously, parsing these dictionaries aborted the entire scene even when another texture was the requested one.

The importer now accepts only absent non-base DXT levels with at least one dimension below four, retaining all supplied mip bytes. Missing pixels are reconstructed by box averaging the preceding decoded level; model notices identify the affected texture and levels. These reconstructed low-resolution pixels are an explicit browser content repair, not original raster data or verified retail rendering behavior. Empty base images, empty levels at least 4×4, wrong nonzero lengths and empty uncompressed levels remain rejected.

## Reproduce and inspect

Run `node scripts/content/audit-world.mjs /absolute/path/gta3.img /absolute/content-directory` from the project. It fetches the pinned manifest and metadata, copies the archive if needed, validates cached metadata hashes, and runs the project's native readers against the content. It records failures explicitly rather than substituting shapes. It does not download the large archive automatically; the verified compressed archive is linked above.

Open the model workshop, select the depot's `gta3.img`, and load the region's IDE folder plus `generic`, `leveldes/levelmap.ide`, `leveldes/seabed.ide`, `interior/propext.ide` and `txd.ide`. Select the listed static IPL, click **Select district streams**, enable all archived collision collections, and enter the listed area. Assemble, then use **Walk scene** when enabled. For cross-region assets, the audit adds globally unambiguous definitions; same-ID conflicts are not silently merged into a universal IDE. ID 16700, for example, has different definitions in `country/countn2.ide` and `leveldes/leveldes.ide`.

Validation: 577 unit tests in 120 files and build pass. Optional `world-content.spec.ts` loads the actual mountain and Doherty assets through the browser worker, checks exact placement counts and enabled collision-backed entry, then verifies grounded movement. Both tests pass. Inspected `artifacts/native-mount-chiliad-content.png`, `native-doherty-content.png` and the walking capture. The previews show actual native mountain/road/vegetation and city meshes. Current diagnostic lighting and authored character are not a claim of original-game appearance parity.

Production smoke also passes with no page errors, exposed development hooks or external runtime requests. Final content browser run: two passes in 7.6 seconds. Logs are `/tmp/web-gta-content-{audit,unit,mips,browser,build,production}.log`.
