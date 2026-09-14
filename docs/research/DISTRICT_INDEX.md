# District coverage index

`buildDistrictIndex` records exterior IPL origins and transformed COL bounds for
each district. `queryDistrictIndex` tests a requested native XY circle against
those records, reporting origin matches and additional bounds-only matches.
It accepts the same terrain-boundary option as `selectSceneRegion`; rotated
collision bounds use the same native-to-renderer transform and double precision.
Queries do not mutate source placements or retain references to their arrays.

This is a browser content-discovery index, not a reconstruction of the native
game's streaming manager. It identifies which supplied district files overlap
an area; it does not select texture budgets, stream collision, or install models.
LOD ancestors still resolve through the existing scene assembler after selecting
the source districts. A placement with no available COL bound falls back to its
origin. Visual geometry extending beyond COL bounds remains a coverage limit.

## Acquired-world audit

Run locally, without network requests:

```sh
node scripts/content/audit-district-index.mjs /absolute/content-depot
```

The script uses the acquired Noclip manifest, external and archived IPLs, scoped
IDE definitions, native COL collections and optional supplemental collision.
Ambiguous model IDs do not silently pick a collision shape. It writes
`district-index.json` in the depot with counts, matching source districts and
models from sources that the current presets omit.

The inspected dataset contains **53 manifest IPL sources**, **44,818 exterior
placements**, and **40,525 placements with resolved collision bounds**. There
are **zero unresolved exterior model IDs** in the audit's definition scope.
These are raw exterior placement counts, including LODs; they are not counts of
unique models, physically installed entities or complete playable coverage.

The first audit found `LAs2` contributing six directly selected placements to the
Grove circle, including `stormdraifr1_las2`, `btoroad1mnk_las2`,
`riverbridls_las2`, vegetation and a lamp. The preset previously selected only
`LAe2`. Adding `LA/LAs2` and retaining its independent static/streamed LOD arrays
now assembles **238 model types / 550 placements**, up from **232 / 542**. All
requested placements resolve, playable collision is complete, and the three
named structural models have no reader notices. Required LOD ancestors account
for the difference between direct index matches and final assembled counts.

Source gaps found in the initial audit, now included in the folder presets:

- Mount Chiliad: `countryw`, `seabed`, and `SFSe` terrain.
- Las Venturas: `vegaxref` signs.
- Chiliad eastern approach: `seabed` and `SFSe` terrain, tunnels and roads.
- Santa Maria: `LAs` beach/cliff geometry.

All four expanded presets now pass scoped assembly, browser walking and collision
checks. The coverage regression finds no unselected overlapping sources for the
nine named presets. Updated counts and the remaining texture/coverage limits are
in [WORLD_CONTENT.md](WORLD_CONTENT.md). The index is not yet automatically invoked
by every workshop load. The **Find overlapping districts** option now invokes
it for coordinate-based folder loads; without that option, custom requests retain
explicitly selected sources.

## Verification

Unit checks cover crossing terrain whose origin lies outside the circle,
interior exclusion, missing-bound fallback, rotated bounds and circle tangency,
independence from later source-array mutations, duplicate IDs and invalid inputs.
The content regression verifies Grove's new counts, complete collision and the
three restored structural models. Browser checks cover Grove/Gant folder loading
and walking, custom Ganton loading, route rendering and cancellation. Inspected
`artifacts/native-grove-road-route.png` shows the added bridge/drain geometry.
All 723 unit tests across 155 files, three browser cases, the content-audit
regression and production smoke pass.

Logs: `/tmp/web-gta-district-index-audit.log` (initial gap discovery),
`/tmp/web-gta-district-index-final-audit.log`,
`/tmp/web-gta-district-index-world.log`,
`/tmp/web-gta-district-index-regression.log`,
`/tmp/web-gta-district-index-browser.log`,
`/tmp/web-gta-district-index-all-tests.log`,
`/tmp/web-gta-district-index-production.log`.

## Automatic discovery for custom areas

Choose a map preset to initialize coordinates and the temporary weather row,
then enable **Find overlapping districts** and edit the region coordinates/radius.
**Load region from folder** discovers overlapping sources from the supplied
external IPLs and their matching archived streams. It reports the actual loaded
district IDs. The preset's previous district list does not constrain discovery.

`discoverDistricts` runs inside the existing scene worker. It scans at most 100
external IPL files and 128 MiB of combined IPL data, limiting total placements
to 250,000. When terrain-bound selection is enabled it reads the archived and
eligible supplemental COL collections and builds the index with transformed
bounds. It resolves names using district-scoped IDE definitions and unambiguous
shared IDs. No overlapping source yields a clear error. More than 16 overlapping
districts requires a smaller radius rather than silently dropping sources.

The selected sources then pass through the existing scoped definition merge,
model/texture readers, LOD namespace handling and scene resource limits. Discovery
does not relax missing-model or playable-collision requirements. External files
not included in the selected folder cannot be discovered. The COL/origin coverage
limits still apply. This implementation rebuilds metadata per request; persistent
index/cache reuse and continuous world streaming remain work to do.

Verified browser case: select Grove initially, enable discovery, then request
native center **(−1750, −1450)** with radius **450**. The loader selects
`country/countrys`, `country/countryw`, `leveldes/seabed` and `sf/sfse`, yielding
**224 model types / 427 placements / zero omitted placements**, with a grounded
character in gameplay. It does not retain `la/lae2`. Inspected
`artifacts/native-discovered-chiliad-east.png` shows the resulting terrain/roads.
The temporary weather row still follows the chosen preset; this option does not
claim native geographic weather scheduling.

Unit checks cover exterior/interior filtering, distant sources, archived binary
placements, missing coverage and overlap limits. Browser checks cover the above
cross-region request, missing coverage at (9000, 9000), source-label changes and
the existing manual custom-area workflow. All 726 unit tests across 156 files,
both browser workflows and production smoke pass. A final change avoids spreading
large streamed placement arrays onto the JavaScript call stack; its focused tests
and build also pass. Logs:
`/tmp/web-gta-district-discovery-unit.log`,
`/tmp/web-gta-district-discovery-browser.log`,
`/tmp/web-gta-district-discovery-final-browser.log`,
`/tmp/web-gta-district-discovery-all-tests.log`,
`/tmp/web-gta-district-discovery-production.log`.
