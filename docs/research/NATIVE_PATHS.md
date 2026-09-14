# Native exterior paths

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
node scripts/content/audit-paths.mjs /Users/teo/Developer/web-gta-content
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

## Integration still required

This commit provides content decoding and graph validation, not native traffic
behavior. Next, compare path segments and lane offsets against the actual
rendered districts, retain neighboring-area references during streaming, then
connect native path selection to vehicle/pedestrian movement. Spawn eligibility,
lane transitions, traffic signals, roadblocks, water navigation and unloaded
area handling need their source behavior implemented and tested separately.
The existing authored traffic system is unchanged.
