# Native region placement overlap

The content audit now identifies shared source placements across the nine native
region presets. This is preparation for continuous world loading. The playable
runtime still installs one bounded scene; this change does not implement live
streaming or resource retention.

## Verified native content

Using the acquired public world depot and the browser's folder planner:

| Transition | Shared unchanged placements | Shared physical placements | Added | Removed | Replaced |
|---|---:|---:|---:|---:|---:|
| Mount Chiliad → eastern approach | 90 | 48 | 337 | 113 | 0 |
| Eastern approach → Mount Chiliad | 90 | 48 | 113 | 337 | 0 |

Neither destination has unresolved LOD targets. The other preset pairs have no
shared source placements. These counts describe the current bounded selections,
not every possible overlap in the statewide map. Physical means a placement has
COL data and is not a resolved LOD replacement target; it does not count individual
collider shapes.

## Identity and reconciliation contract

`catalogScenePlacements` records the immutable dataset identity, case-normalized
source filename, text/binary format and original source row index. Local district
namespaces are deliberately excluded: they change when district selection order
changes. Archived source names retain their archive prefix.

The caller must change the dataset identity for another depot or modified source
bytes. This is not a content-hashing API. The audit uses a unique, private identity
for its single run and does not serialize reusable identity tokens into reports.

LOD targets are translated from local namespaces to stable source identities.
Placement transforms, model definition, time counterpart, visibility bounds and
physical eligibility are snapshotted. Duplicate source identities fail explicitly.
An unresolved LOD target always prevents retention, even when its numeric index
looks unchanged. A placement whose collision eligibility changes is replaced.

`planSceneWindow` partitions entries into retained, added, removed and replaced.
It does not allocate GPU objects or mutate physics. Retained entries establish
matching placement payloads only: a future installer must rebuild region-wide
visibility/LOD relationships, update source lookups, and manage geometry, material
and texture ownership. It must also stage collision before moving the player into
new territory and roll back failed loads without exposing a partly installed map.

## Reproduce

```sh
node scripts/content/audit-world.mjs /absolute/depot/gta3.img /absolute/depot
GTA_CONTENT_DIR=/absolute/depot node --test scripts/content/audit-world.test.mjs
npx vitest run tests/scene-window-plan.test.ts --maxWorkers=2
```

The generated `world-content.json` includes directed `regionOverlaps` records for
pairs with shared identities. The native regression checks the mountain overlap,
reverse transitions and placement conservation. Unit cases cover namespace and
part reordering, dataset isolation, transform changes, missing LOD targets,
duplicate provenance and collision-role changes when a child enters the region.
