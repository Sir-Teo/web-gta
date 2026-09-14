# Native region placement overlap

The content audit now identifies shared source placements across the nine native
region presets. This is preparation for continuous world loading. The playable
runtime supports manual replacement and opt-in movement-driven requests for its
bounded scene, including collision reuse within one immutable folder session.
Native GPU textures also survive matching-session swaps. Geometry/material reuse
and seamless statewide streaming remain unfinished.

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

`InstalledNativeScene.replace(parts, validate, datasetIdentity)` provides a synchronous scene swap.
It builds the next scene while the previous owner remains valid, prepares the
last clock/ambient settings, debug night override, object classifications and
camera visibility, then disposes the old owner and returns the new one. Failed
installation or state preparation disposes only the candidate. Callers must
publish the returned owner before stepping physics or rendering again.

This operation allocates destination visuals and can retain unchanged collision
when both owners have the same explicit dataset identity. Without that identity,
it rebuilds collision too. Old and new visual allocations briefly coexist,
so peak memory still includes both regions' graphics. It is synchronous and must
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
player there. Movement-driven loading uses the position-preserving operation and
waits for safe character state instead of resetting a jumping or seated player.
The browser regression expands the mountain selection with a crouched
player, checks exact position/heading/clock preservation, rejects a distant Grove
selection, and resumes movement on the retained mountain terrain.

The receiver validates modifiers before retirement. Position-preserving swaps
now query the installed candidate's colliders directly, without advancing the
live simulation or including old overlapping terrain in capsule clearance.
Searching for a new spawn still uses an isolated Rapier world and adds temporary
collision memory to the two-scene peak.
The synchronous validation callback must finish before the previous owner is
disposed; a failed callback removes the candidate and keeps the old owner usable.

The game channel remains open until the session closes. Workshop assembly clears
the candidate preview without disconnecting the walking session; incomplete or
collision-deficient scenes cannot be sent through the update control. Automatic
requests based on player position use the separate provider below.

The browser regression exercises the mountain round trip in one tab, retains
weather, resumes grounded movement after both replacements, injects an invalid
request and verifies that the previous terrain remains playable. Its screenshot
is `artifacts/native-session-chiliad-east.png`; this is a functional capture, not
evidence of calibrated retail appearance parity.

## Movement-driven region requests

Enable **Load terrain as you walk** before choosing **Walk scene** from a loaded
content folder. The selected radius must be 32–1000 native units. Keep the source
workshop open: its dedicated worker retains the original selected File inventory
and cached folder metadata independently of later workshop preview selections.

The policy requests a new center after the grounded exterior player moves
40% of the current radius. It discovers all overlapping supplied districts with
collision bounds enabled, validates the complete candidate and preserves the
player's supported pose. The worker now prepares the area while movement, held
input, walking audio and the clock continue. Automatic commits do not call the
menu pause/resume path or reset sound. If the grounded player reaches 75% of the
old radius while the request is pending, the game pauses on the old terrain and
resumes after a successful commit if focus/pause state has not changed. The
selected environment files stay fixed; native geographic weather scheduling is
still absent.

Only one request is pending. Increasing IDs match responses to the requested
window; stale replies cannot retire current terrain. Source failures, a 30-second
request deadline, missing assets/collision or unsupported player placement
stop following and leave the current area available. A manual terrain update
stops following as well. Closing the workshop releases its provider. Open a new
walk session to restart following or adopt another folder selection.

This is an initial background streaming path. It retains eligible native
textures and collision, but does not stream interiors or vehicles, or guarantee statewide
content completeness. Requests and safety-boundary pauses wait for a grounded
player, so long jumps across a loaded boundary still need a better policy. A ready
response also waits for safe player state before committing. Installing a region
still synchronously incurs visual replacement and candidate support queries;
background file loading does not eliminate that frame-time spike. These limits
prevent a production/seamless claim.

The browser test walks on actual Chiliad terrain until it requests a new area,
checks that input continues moving CJ during loading in the same tab, injects a source failure
on the next request, waits for the real worker's delayed reply and verifies that
the reply is ignored. The capture `artifacts/native-following-chiliad-east.png`
was visually inspected. Exact paused pose preservation is covered by the separate
region-session regression. A second browser case holds back the worker script:
the character keeps moving after the request, pauses between 48 and 50 units from
the old center for a radius-64 selection, retains the old scene, then resumes on
supported terrain when the worker is released. The policy unit test checks the
40% request and 75% waiting thresholds against the original center until commit.

## Retained live collision

Folder planners now issue a random identity for their immutable File selection.
The worker carries it with scene data to the game. A new planner or folder
selection receives a different identity; manual archive assembly has none.
If external IPL basenames are ambiguous across folders, identity-based reuse is
disabled, while ordinary loading remains available. This token is a session
boundary, not a file-content hash or permission to reuse modified source bytes.

The installer uses the stable source catalog to retain only physical placements
whose payload and collision-source selection agree. Source rows, not JavaScript
placement-object identity, determine physical eligibility. A new LOD relationship
that removes collision eligibility retires the former collider. Different or
absent destination identities force a fresh installation.

During preparation, matching rigid bodies are borrowed from the old owner. The
candidate's rollback disposes only newly created bodies. After visual/state and
destination validation succeed, ownership transfers before the old remainder is
disposed. Candidate disposal during validation is rejected. The source metadata
map is rebuilt for the new owner while retained Rapier handles stay valid.

The real Mount Chiliad ↔ eastern approach round trip retains **48 physical
placements** in each direction. Native reference and browser tests verify the
retained handles/counts, supported walking, retired nonshared handles and final
body cleanup. Additional cases cover changed transforms, dataset changes, absent
identity, failed validation and LOD role changes. The following provider starts
its own file session, so its first replacement cannot reuse the workshop worker's
collision; its second successful request can, and is checked in the browser.

This avoids live-world body reconstruction and preserves their collision handles.
Geometry/material reconstruction, CPU texture decode/transfer and whole-frame measurement remain work
to do. Retained-body counts alone are not evidence of a measured FPS improvement.

## Direct candidate support queries

`assertInstalledSceneSupport` uses each candidate collider's direct ray and shape
queries. In the installed Rapier version, these see fixed colliders immediately
after creation, before a world step updates broad-phase queries. The helper finds
the nearest downward hit across candidate handles and checks capsule clearance
only against those handles, excluding disabled colliders/bodies. Missing handles
fail explicitly and the scan is capped at 20,000 entries.

The acceptance policy is shared with the isolated reference helper: a short
downward support ray, the controller's 45-degree climb threshold, and the actual
standing/crouched capsule. It does not search for a different position. This removes
temporary-world construction and collision rebuilding from position-preserving
updates, including automatic prefetch commits. New-spawn search keeps its existing
isolated-world path; this change does not replace that broader search algorithm.

Checks cover unstepped colliders, an old ceiling that must not obstruct a new
candidate, unchanged live-body position/velocity, low-ceiling crouch clearance,
disabled/missing colliders and 18 native mountain poses compared with the isolated
reference. Browser regressions exercise manual and automatic swaps and delayed
prefetch with the direct path.

An optional 20-sample microbenchmark, after three warmups, measured a median of
**8.99 ms isolated versus 0.465 ms direct** on this machine (Node v26.7.0,
macOS arm64), for the eastern Chiliad region's **427 placements / 679 colliders**.
This measures only a support check at one position, not asset loading, scene
installation, GPU work or FPS. Raw samples are in
`artifacts/native-support-query-benchmark.json`. Reproduce with:

```sh
GTA_CONTENT_DIR=/absolute/depot GTA_BENCHMARK=1 npx vitest run tests/native-scene-replacement-reference.test.ts --maxWorkers=2
```


## Native texture retention across region swaps

Decoded `ModelTexture` records now carry the actual TXD selected by child-first
lookup. A parent-supplied raster is labeled with the parent dictionary, not the
model's base TXD. Existing cache results are never relabeled in place. The worker
transfers this provenance with the decoded pixel arrays.

Within one explicit immutable dataset identity, replacement scenes share a
reference-counted texture pool. Its key includes the resolved dictionary, raster
name, filtering, U/V addressing, alpha flag and every mip's dimensions. A matching
name in another dictionary cannot alias. Missing dataset identity or dictionary
provenance disables reuse between separately decoded source objects. An omitted
replacement identity does not implicitly inherit the old dataset.

The candidate acquires its textures before the old scene releases its owners.
Failed construction/validation releases candidate references while preserving
old owners. The last owner disposes the GPU texture exactly once. The pool keeps
no inactive world cache. Materials, geometry and lighting uniforms remain owned
by their individual scene, preserving independent day/night state.

Measured with the real Mount Chiliad → eastern approach transition:

| Resource | Unique native texture objects |
|---|---:|
| Initial mountain scene | 151 |
| Eastern approach scene | 414 |
| Reused across the transition | 123 |

The 123 shared objects retain their Three.js texture identity and upload version.
The native reference test also verifies that nonshared old textures retire and
all original textures are disposed exactly once after the round trip. This
measures avoided texture allocation/re-upload, not an FPS or frame-time result.

CPU raster decoding and worker transfer still occur on each region request.
A reused GPU texture retains its original backing pixel array while the new
scene carries freshly decoded arrays, so CPU memory duplication remains to be
addressed. The following provider's first request has a separate dataset identity
from the workshop worker; subsequent matching-session requests can reuse textures.

Validation: all 757 unit/native tests pass, four browser region-session/following
cases pass, and production build/smoke passes with no external runtime requests.
The inspected following screenshot shows native CJ and textured ground in its
small test selection; it does not establish statewide visual completeness.
Logs: `/tmp/web-gta-texture-reuse-{unit,reference,browser,production}.log`.
