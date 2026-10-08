# Routes over the native road graph

`findNativeRoadRoute` searches the imported exterior path graph without changing
its nodes, links or serialized search fields. It returns copied node addresses,
ordered steps with navigation addresses and lane counts, summed native byte
link lengths, visited-node count and missing-reference count.

This is a browser Dijkstra implementation, informed by the lane eligibility and
flood-fill checks in pinned
[PathFind.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/PathFind.cpp).
The reversed `DoPathSearch` is marked unreversed at hook registration and has
questionable reconstruction/indexing code. This implementation does not claim
its route choices, internal bucket ordering, search limits or truncation match
the retail executable. It expands forward links and uses each forward link's
stored byte length. Equal-cost alternatives retain first discovery order.

## Contract

- Inputs are explicit path-node addresses in loaded areas. Missing endpoints
  return `unavailable`; there is no implicit snapping to a nearby road.
- Search stays on land vehicle nodes with matching flood-fill IDs. Water and
  pedestrian nodes are excluded. This does not by itself identify every track,
  mission-only road, or acceptable traffic spawn.
- Every step needs a loaded navigation record and a positive forward lane count
  under `pathDirection`. Missing navigation is never assumed to be two-way.
- Native `DoPathSearch` does not filter `m_isSwitchedOff`. Accordingly, closure
  avoidance is optional (`avoidSwitchedOff: true`), disabled by default. The raw
  archive's nearest Grove, Chiliad, Verdant and Santa Maria nodes are marked
  switched off; blanket exclusion would reject these endpoints before searching.
  Mission road switching and traffic spawning require their own native rules.
- Costs are summed stored link lengths, not a fresh Euclidean measurement or
  a travel-time estimate. Zero-length cycles terminate because only strict
  distance improvements enter the queue.
- `maxVisited` defaults to 65,536 and is bounded to 1–250,000. Exhausting it
  returns `limit`, never a partial route presented as success.
- Missing links/areas are skipped and counted. An exhausted search with missing
  references returns `unavailable`; otherwise it returns `disconnected`. A found
  route can carry a nonzero missing-reference count: it is shortest only in the
  accessible permitted graph, not necessarily the complete unloaded world.
- A start equal to the destination returns one node, zero steps and zero cost.
  Returned addresses can be edited without mutating the imported graph.

Run expensive searches in a worker when connecting this to the game. The solver
does not retain references after a call; a moving vehicle must resolve each
step again as streamed areas change. It does not schedule streaming itself.
Ambient traffic does not use this solver: it picks its next node as `CCarCtrl`
does (`pickNextNodeRandomly` in `src/vehicle/nativeCarCtrl.ts`, driven by
`src/simulation/WorldTraffic.ts`). The solver serves the workshop's route
preview (`src/assets/regionRoute.ts`).

## Acquired-world verification

The content audit now searches from Grove Street's nearest land node to the
nearest land node of each other preset. All eight routes resolve with no missing
references and include cross-area steps:

| Destination | Native link-length sum | Steps | Cross-area steps |
|---|---:|---:|---:|
| Mount Chiliad | 8,899 | 745 | 21 |
| Verdant Meadows | 6,266 | 506 | 9 |
| Doherty | 6,414 | 526 | 12 |
| Las Venturas | 4,079 | 278 | 5 |
| Chiliad eastern countryside | 6,242 | 459 | 11 |
| Gant Bridge | 8,842 | 622 | 14 |
| Santa Maria | 2,112 | 159 | 3 |
| Sherman Dam | 6,791 | 523 | 9 |

The reference test verifies every returned step against the native active link
span, navigation reference, byte length and lane permission; it also checks
endpoint identity, no repeated nodes and cost totals. Synthetic graphs cover
cheaper indirect routes, equal-cost ties, zero-length cycles, closures, water,
cross-area node identities, unavailable alternatives and bounded termination.
All 718 unit tests across 154 files and the production build pass.
Logs: `/tmp/web-gta-path-route-tests.log`,
`/tmp/web-gta-path-route-audit.log`,
`/tmp/web-gta-path-route-all-tests.log`,
`/tmp/web-gta-path-route-final-build.log`.

This establishes selectable graph routes, not lane-center geometry, vehicle
steering, legal spawn positions, streamed statewide gameplay or visual parity.

## Workshop inspection

After loading a bounded exterior region from the local content folder, choose
**Road route destination** below the preview. Each endpoint is the nearest land
vehicle node within its respective region radius; this explicit inspection
selection is separate from the address-only solver. The status names the exact
snapped addresses, segment count, native length sum and unavailable-reference
count. No node outside the selected radius is substituted when an endpoint is
unavailable.

The worker reads the native path areas locally and returns transferred float
positions with native Z-up heights converted to renderer Y-up. Magenta x-ray
lines show the full graph route. The camera, model framing and LOD state remain
unchanged; geometry outside the loaded region is not automatically loaded. The
route and **Show native paths** overlays are independently controlled. Selecting
**No route**, changing the loaded scene, or clearing the workshop removes the
route. Destination changes terminate pending route workers and ignore stale
responses. Page exit terminates both path and route workers.

Browser verification uses Grove→Santa Maria (159 segments, native length 2,112)
and Grove→Sherman Dam (523 segments, native length 6,791). It checks the actual
rendered line count, changed canvas pixels, unchanged camera/LOD, stable GPU
allocation counts across replacement, removal, rapid destination changes and
scene cancellation. Inspected `artifacts/native-grove-road-route.png` shows the
route through the loaded Grove street layout and extending into unloaded space.
This is geometry inspection, not a claim of calibrated appearance parity.

Ten focused unit tests, both path/route browser cases and production smoke pass.
Logs: `/tmp/web-gta-route-preview-unit.log`,
`/tmp/web-gta-route-preview-browser.log`,
`/tmp/web-gta-route-preview-production.log`.
