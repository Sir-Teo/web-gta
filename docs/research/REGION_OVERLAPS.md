# Native region placement overlap

The content audit now identifies shared source placements across the nine native
region presets. This is preparation for continuous world loading. The playable
runtime supports manual replacement of its bounded scene; automatic streaming
and shared resource retention remain unfinished.

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

## Installed scene replacement

`InstalledNativeScene.replace(parts)` now provides a synchronous full-scene swap.
It builds the next scene while the previous owner remains valid, prepares the
last clock/ambient settings, debug night override, object classifications and
camera visibility, then disposes the old owner and returns the new one. Failed
installation or state preparation disposes only the candidate. Callers must
publish the returned owner before stepping physics or rendering again.

This operation allocates the entire destination; the overlap catalog does not
yet retain shared geometry or colliders. Old and new allocations briefly coexist,
so the peak memory requirement includes both regions. It is synchronous and must
not contain asynchronous callbacks or physics steps between construction and
retirement. Querying destination collision requires the normal physics update.

The method does not move the player, replace environment files, or request new
regions. A streaming controller must still preserve supported player placement,
coordinate weather/water and lighting modifiers, and connect folder discovery to
movement. The walk-test UI now connects this operation through the manual control
described below.

`native-scene.test.ts` checks late-failure rollback, inherited timed visibility
and classifications, source lookup ownership and independent colliders. The
optional `native-scene-replacement-reference.test.ts` loads the actual mountain
regions, swaps 203 → 427 → 203 placements, checks destination spawn support and
retired collider handles, then verifies that both generations release their
owned resources. Run it with `GTA_CONTENT_DIR` pointing to the acquired depot.

## Update terrain in an existing walk session

1. Load a native region in the model workshop and choose **Walk scene**.
2. Assemble another region in the workshop.
3. Choose **Update terrain in walk session**. The existing game pauses while the
   destination is checked, then offers **Walk imported scene** in the same tab.

This operation replaces placed world models, collision and regional timecycle
modifiers. It moves the player to a supported destination spawn while retaining
the clock, environment files/weather selection and character settings. Load a
fresh walk session to apply a different region's optional environment files.

For overlapping regions, **Keep player position when updating terrain** instead
validates the player's current upright capsule and leaves its body, coordinates,
heading, crouch state and camera orientation unchanged. It requires a grounded,
living character on foot with no vehicle transition. The destination must have
support within the controller's ground-snap range and an acceptable surface
normal, plus clearance for the actual standing or crouched capsule. It never
searches for a nearby substitute position. Rejection keeps the previous terrain.
The supported current foot position becomes the fallback respawn for this region.

This option is off by default so selecting a distant district can still move the
player there. Automatic streaming will need the position-preserving operation;
it must wait for safe character state instead of resetting a jumping or seated
player. The browser regression expands the mountain selection with a crouched
player, checks exact position/heading/clock preservation, rejects a distant Grove
selection, and resumes movement on the retained mountain terrain.

The receiver validates modifiers before retirement and checks spawn support in
an isolated Rapier world using only destination collision. That avoids advancing
the live simulation or allowing old overlapping terrain to invalidate capsule
clearance. This adds temporary collision memory to the existing two-scene peak.
The synchronous validation callback must finish before the previous owner is
disposed; a failed callback removes the candidate and keeps the old owner usable.

The game channel remains open until the session closes. Workshop assembly clears
the candidate preview without disconnecting the walking session; incomplete or
collision-deficient scenes cannot be sent through the update control. Automatic
requests based on player position are not implemented.

The browser regression exercises the mountain round trip in one tab, retains
weather, resumes grounded movement after both replacements, injects an invalid
request and verifies that the previous terrain remains playable. Its screenshot
is `artifacts/native-session-chiliad-east.png`; this is a functional capture, not
evidence of calibrated retail appearance parity.
