# Building model swaps

SWAP_NEAREST_BUILDING_MODEL (03B6) now replaces one loaded building's visible model and collision.
DECON uses it at three sites to open the excavation, restore it on failure and fill it on success.
This is authored coverage: the native selection arithmetic and ledger are reproduced, while the
browser's placement streaming and resource lifetime remain different.

## Native evidence

The iOS opcode-900 jump table at `0x1001db248` routes command 950 to `0x1001da7c4`.
It collects six arguments, replaces Z at or below -100 with FindGroundZForCoord and resolves
negative used-object references. It calls CWorld::FindObjectsOfTypeInRange (`0x1002737e8`)
with buildings enabled, every other entity list disabled, a planar radius and a sixteen-entry
output buffer. The building branch at `0x100273940` filters model identity before a strict
float32 squared-distance test; only the first sixteen matches enter the buffer.

The command then selects the strictly nearest float32 three-dimensional distance, starting
with twice the radius. Equal distances keep the first result. CBuilding::ReplaceWithNewModel
at `0x100172200` deletes the render object, removes the old streamed model if its reference
count reaches zero and changes the model index. It preserves the allocated building, its
transform, entity class and LOD link. Future collision queries use the new model's COL.
The reversed PC function at `0x403EC0` agrees.

For entities with IPL index zero, the handler maintains a 25-slot building-swap array. A second
swap updates the current model; returning to the original model clears the slot. A full array
does not prevent the model replacement. The iOS update/clear tails are `0x1001daf94` and
`0x1001db1b4`. The reversed PC AddToBuildingSwapArray at `0x481140` agrees.
UndoBuildingSwaps (`0x481290`) restores tracked originals during game reinitialization;
ordinary mission cleanup does not call it. Native saves serialize this ledger with pool references.

PC reference: gta-reversed revision `4281f82d8af83e14935ac84a69dfd1ceebb9f256`,
`Entity/Building.cpp`, `Scripts/TheScripts.cpp` and `Game.cpp`. Executable identity is recorded
in the other October 22 research notes: Google61/gta3sa.app `67f70cb7`, SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.

## Integration and limits

The selector includes loaded placement rows even when they lack a collision handle or are
currently hidden. OBJECT.DAT determines building versus dummy classification. Replacement
splits out the selected row with the new DFF, TXD and COL, retaining its source reference,
transform, area and LOD reference. A CBuilding stays a building even when its new model has
an OBJECT.DAT row. The existing transactional scene replacement retains unchanged physical
bodies, forwards lighting/view state and transfers shared model resources. A failed replacement
rolls back the swap ledger and leaves the previous scene installed.

Text IPL overrides are reapplied to incoming windows after resident model hydration and before
prebuilding. Binary IPL overrides retire when their entity leaves a successfully installed
window. A rejected or speculative window cannot erase a live override. The command waits for
an in-flight terrain prebuild or a missing replacement asset, then retries through the existing
ScmEntityPending path. New window messages receive the current overrides.

Candidate order is loaded placement order rather than native sector/pointer-list order. Native
big-building list coverage, render-object creation timing, per-entity render flags, exact model
reference counts/removal, TXD parent loading for a newly requested model and complete save/undo
integration remain unverified or incomplete. The browser holds model data for restoration and
reconciles the current window rather than changing one allocated CEntity in place. General
models without supported collision may fail explicitly. No native save compatibility is claimed.

## DECON checks

The original mission-50 sites are:

| SCM offset | Old model | New model |
| --- | --- | --- |
| 1384334 | HUBHOLE1_SFSE | HUBHOLE2_SFSE |
| 1402873 | HUBHOLE2_SFSE | HUBHOLE1_SFSE |
| 1402940 | HUBHOLE2_SFSE | HUBHOLE4_SFSE |

All use radius 20 around `(-2049.17138671875, 250.31930541992188, 34.47700119018555)`.
The matching text IPL row is at `(-2049.171875, 250.3203125, 33.078125)`.
Another pit model already exists below ground; checks therefore follow the original source row,
rather than selecting whichever part first has the requested model name.

Seven unit checks cover strict planar/3D selection, float32 boundaries, sixteen-entry ordering,
classification, source/LOD preservation, restoration, 25-slot bookkeeping, failed-window retention,
binary retirement, changed physical surfaces and retained neighboring bodies, plus dispatch of
all three original instructions. The live browser check executes those instructions, observes
different installed mesh data and ground heights, restores the original and streams away and back
to the filled replacement. Full DECON completion remains unverified.

A separate 120-second player-only mission probe on October 22 ran DECON through the garage
opening and to the construction site with zero skipped commands, thread failures or page errors.
It ended at the ordinary objective-loop WAIT (relative 137), without a mission result. Its
27.4% furthest-offset metric is not a completion score. Raw output is retained in the ignored
`artifacts/port/decon-player-only-oct22.json`; the historical sweep data was restored afterwards.
