# Parking-node query

`GET_PARKING_NODE_IN_AREA` (0810) now reads the loaded native path data. It shares one cycling cursor across
boxes and script threads. SCRASH3 (mission 51) calls it at SCM 1406114 with corners
`{-1760.1785,972.2405,16.1633}` and `{-1679.6055,1064.2927,24.8629}`, writing globals 292/296/300.

## Native evidence

The pinned, hash-verified iOS executable is identified in [AIRCRAFT_WEAPONS.md](AIRCRAFT_WEAPONS.md#source-observations).
Handler `0x1001fc268` sorts each pair of coordinates and calls CPathFind::FindParkingNodeInArea at
`0x1001bf7ac`. That function scans exterior area IDs 0–63 in ascending order and each loaded area's vehicle
nodes in index order. It reads vehicle count at path manager +0x20e8 (also used by the nearest-node vehicle
branch at `0x1001bbacc`); pedestrian nodes and interior areas are not scanned.

Candidates have behaviour type 2 and coordinates strictly inside all six float32 bounds. There are no water,
switched-off, dead-end, visibility, distance, link or occupancy filters. Coordinates are the node's signed
int16 components multiplied by 0.125; no road-side offset or extra height is applied.

The shared cursor is at `0x100931e60`. The function remembers its first match and its cursor-th match. It
returns the cursor-th match if present, otherwise the first match, or the origin if none exists. After scanning,
the cursor increments, resetting to zero when the increment is at least the match count. Thus changing to a
smaller box can return its first node twice; this is not a modulo of the old cursor.

## Integration and checks

ScmMission keeps the cursor across all threads and mission cleanup and reads its existing loaded path areas.
Undefined/unloaded areas give no candidates, as in the native pointer scan. The browser's separate path-loader
neighborhoods remain an existing engine difference; the command does not request or fabricate a node itself.

Four unit checks cover ordered cycling, strict bounds, native filters, changing box sizes, float32 boundaries
and empty/unloaded data. The adapter check executes the original SCRASH3 instruction and verifies float outputs
and shared state across threads.

The published exterior graph contains 215 behaviour-2 vehicle nodes. SCRASH3's box contains ten, all in area 41:
indices 169, 170, 172, 175, 203, 208, 209, 210, 230 and 232, each at native height 16.5. The browser check loads
that San Fierro neighborhood and executes the original instruction twelve times, checking all ten coordinates
and the wrap to the first two. The final fixture lends a separately loaded neighborhood to the adapter during
the synchronous batch, leaving CJ's physical world in Grove Street. An earlier cross-city teleport exercised
terrain-support warnings; the final check makes no claim about cross-city collision placement or path-loader
scheduling. Full SCRASH3 or valet mission completion remains unverified.
