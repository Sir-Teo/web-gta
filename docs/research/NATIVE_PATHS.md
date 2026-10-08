# Native exterior paths

Signal metadata and the workshop's cycle inspector are documented in
[native traffic-light phases](NATIVE_TRAFFIC_LIGHTS.md).

## Source and verified content

The acquired public `gta3.img` contains all **64 `nodes0.dat`–`nodes63.dat`**
exterior path areas. These are additional original-world resources alongside
the meshes, textures and placements; no further download is needed.

The reader follows pinned revision
`0076f9017b4aeef7433957ac2bd8b6988e9df166` of the public reconstruction:

- [PathFind.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/PathFind.cpp): `LoadPathFindData` at `0x4529F0` defines header and array order, including 192 reserved link slots when the address count is nonzero.
- [PathFind.h](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/PathFind.h): 28-byte path nodes, 14-byte navigation nodes, lane counts, flags and packed navigation addresses.
- [NodeAddress.h](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/NodeAddress.h): two unsigned 16-bit fields, area followed by node.
- [CompressedVector.h](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/CompressedVector.h): signed 16-bit position components at 1/8-unit precision.

Fresh HTTP downloads of all four pinned files returned 200 and matched the
locally inspected source bytes. This establishes the reconstruction used;
it does not certify the hosted game assets against a retail installation.

## Browser reader contract

`src/assets/pathNodes.ts` reads little-endian data and retains native Z-up
coordinates. It skips serialized pointers and search-distance state. Path-node
positions use signed 16-bit components divided by eight; widths use unsigned
bytes divided by sixteen. Navigation direction components use signed bytes
divided by 100, and navigation width is signed and divided by sixteen. Direction
vectors are preserved without renormalization.

The five header counts describe total nodes, vehicle nodes, pedestrian nodes,
navigation records and static addresses. Vehicle nodes precede pedestrian
nodes. Water is a separate vehicle-node flag. Land vehicle nodes are not all
ordinary traffic roads: tracks and special paths still require runtime policy.

The connection arrays contain static addresses plus 192 reserved slots, a
separate packed navigation-address array, byte lengths and intersection flags.
Only each node's declared static span is treated as active. Packed navigation
addresses use six area bits and ten record-index bits; `0xffff` is preserved as
an invalid/sentinel reference. Raw flags remain available for later interpretation.

The reader validates count consistency, area/index identity, static link spans,
payload size and allocation bounds. Exact logical payloads or complete IMG
sector padding are accepted; arbitrary trailing lengths are rejected. Cross-area
references remain addresses until the corresponding area is available. The
all-area audit below resolves them independently.

## Reproducible graph audit

```sh
node scripts/content/audit-paths.mjs $GTA_CONTENT_DIR
```

The command reads the IMG locally, decodes the same reader used by the browser
codebase, and writes `path-content.json` in the depot. It records per-entry
size/SHA-256 provenance, aggregate counts, regional node counts and unresolved
references. It checks every active destination, every land-vehicle navigation
reference and every navigation anchor. Missing/duplicate areas or malformed
data fail; unresolved references produce a report and nonzero exit status.

Verified inventory:

| Item | Count |
|---|---:|
| Exterior areas | 64 |
| Total path nodes | 68,237 |
| Vehicle nodes, including water | 30,587 |
| Pedestrian nodes | 37,650 |
| Navigation records | 31,466 |
| Active directed connections | 143,622 |
| Connections crossing area boundaries | 2,424 |
| Unresolved audited references | 0 |

Within the existing XY selections, Grove Street has 156 land-vehicle and 274
pedestrian nodes; Santa Maria has 396 and 1,781; Sherman Dam has 160 and 167,
plus 33 water nodes. The dam's nearest land-vehicle node is address `(51,117)`
at native `(-716.5,2062.5,59.25)`. Counts use node origins and the region radius;
they do not imply that every connecting segment lies in the loaded mesh region.

Example provenance: archived `nodes15.dat` is 94,208 bytes with 93,802 bytes of
logical payload, SHA-256
`d5c7a8a01a42689c42bc560a3f630221f8745d94ee3b157c1d3c895d189a7293`.

Validation: four targeted tests pass, covering signed fields, reserved-array
offsets, padding, malformed headers/addresses/spans and the complete native
graph's active references. The production build passes. Logs:
`/tmp/web-gta-native-path-{audit,tests,build}.log`.

## Map-workshop path inspection

Bounded exterior scenes now offer **Show native paths**. On first activation,
a dedicated worker reads the native path entries from the same selected IMG,
resolves destinations across available areas, and sends only regional line
buffers to the preview. The UI reports available area count and unresolved
connections across those loaded areas. No network or backend is involved.

Cyan denotes land-vehicle connections, yellow pedestrian connections, and blue
water connections. These are straight node-to-node segments, not reconstructed
lane centerlines or driving curves. They retain native heights and intentionally
show through surfaces for inspection. Reverse edges of the same category share
one displayed segment; the native directed graph is unchanged.

Selection uses segment/circle intersection in native XY, retaining crossing
segments even when both endpoints lie outside the selected radius. Whole
segments remain visible at the boundary. The reader limits individual areas to
4 MiB, total path bytes to 16 MiB, decoded nodes to 250,000 and output segments
to 100,000. The worker is cancelled on model/region clear; toggling a loaded
overlay reuses its GPU geometry, while replacing/clearing a region disposes it.

Inspected captures `artifacts/native-grove-street-paths.png` and
`artifacts/native-sherman-dam-paths.png` show alignment with the sampled streets,
sidewalks and elevated dam roadway. This is visual inspection of connection
geometry, not quantitative validation of every lane or traffic maneuver.
Browser checks cover local loading, both regions, visibility changes, stable
camera/LOD state, reused allocations, and zero remaining geometries on clear.
Unit checks cover crossing endpoints, coordinate conversion, categories and
unresolved destinations.

Validation: 694 tests / 148 files, two browser cases and production smoke pass.
Logs: `/tmp/web-gta-path-overlay-all-unit.log`,
`/tmp/web-gta-path-overlay-final-browser.log` and
`/tmp/web-gta-path-overlay-production.log`.

## Remaining integration

### Lane-direction eligibility and one-way inspection

`pathDirection` implements the forward counterpart of `DoPathSearch`'s
`sameLaneOnly` branch in the pinned `PathFind.cpp`. The original search expands
backward from the destination. For forward travel, an anchor equal to the origin
selects opposite-direction lanes; otherwise it selects same-direction lanes.
The reverse direction is evaluated independently. This is routing eligibility
from lane counts, not lane positioning or a complete vehicle-driving policy.

The native all-area audit now reports **48,072 permitted and 11,548 prohibited
land-vehicle directions**, including **11,524 permitted one-way directions**.
Four connections have an anchor outside both endpoints. The implementation
preserves the source's else branch for these and reports the count; it does not
invent a new anchor or reject source connections for that reason.

The workshop adds white arrowheads to one-way land-vehicle connections, with
66 in the Grove Street region and 15 in Sherman Dam. Glyphs lie at 60% of the
forward segment and interpolate endpoint height; their size and placement are
inspection UI, not game lane offsets. The native directed graph is unchanged.
The overlay status lists arrow counts. Browser verification checks the actual
rendered line count includes both lines of every arrowhead, then checks toggle
reuse and disposal. Unit coverage checks direction reversal, cross-area
addresses with equal node indices, non-endpoint anchors and arrow orientation.

Six targeted tests, the two-region browser case and build pass. Logs:
`/tmp/web-gta-path-direction-final-unit.log`,
`/tmp/web-gta-path-direction-final-browser.log`,
`/tmp/web-gta-path-direction-build.log` and
`/tmp/web-gta-path-directions-audit.log`.

The available `CarCtrl.cpp` still delegates lane-positioning/road-joining
functions to the original executable. `OneWayLaneOffset` alone does not establish
complete lane curves, junction transitions or vehicle placement. Those remain
research and implementation work.
The [lane-layout audit](NATIVE_LANE_LAYOUT.md) now records the implemented offset
formula and the real archive's width ranges, branch counts and no-lane records.

This commit provides content decoding and graph validation, not native traffic
behavior. Path segments can now be compared in the workshop. Next, validate lane
offsets against the rendered districts, retain neighboring-area references during streaming, then
connect native path selection to vehicle/pedestrian movement. Spawn eligibility,
lane transitions, traffic signals, roadblocks, water navigation and unloaded
area handling need their source behavior implemented and tested separately.
The authored traffic system of the time was unchanged by this commit. Traffic has
since moved onto this graph: `src/simulation/WorldTraffic.ts` drives cars with a
port of `CCarCtrl` (`src/vehicle/nativeCarCtrl.ts`), creates them on path nodes
(`src/vehicle/nativeRandomCarSpawn.ts`) and stops them at signals
(`nativeShouldStopForLight` in `src/world/nativeSignalStop.ts`).

[Native graph routing](NATIVE_ROUTES.md) now resolves permitted routes between
all nine content presets, retaining navigation addresses for future vehicle
integration. It is a browser graph-search implementation, not a claim of retail
path-search equivalence or completed native driving.
