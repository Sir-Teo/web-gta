# Script interiors without entry doors

New Model Army uses area 10's RC battlefield near native `(-1004, 1001, 1350)`.
Its models and collision are present in the active `leveldes/levelmap.ipl`, but
the browser only recognized script interiors near an ENEX door. The arena has
no such door. The original script therefore ran over the outdoor window: its
helicopter and cargo appeared in a blue void, and released cargo fell below the
script's deletion height.

The district index now retains compact native XYZ bounds for interior
placements. It uses transformed COL bounds when available and the placement
origin otherwise. Area 13's shared entities do not establish ownership of any
particular interior. The worker publishes this metadata after its initial ready
message, reusing the existing collision-bounded index. The live world carries
5,681 bounds (318,136 bytes), rather than another decoded scene.

A script scene transfer recognizes its own area's actual nearby content as well
as existing door metadata. XY and height guards preserve the street when a
cutscene sets a house area while CJ remains outside. The installed scene and
player pose are checked again after a replacement or delayed vehicle warp.

The cutscene return also uses the script's current area when the actual content
matches CJ's new position. Previously, a 24-part arena window could be followed
by the cutscene's older 251-part outdoor window, leaving the game in area 10
with area 0 installed. The scene profile and worker log preserve that sequence
in `artifacts/zero4-scene-timeline.json`.

## Waiting for collision

A script can teleport CJ while an outdoor installation is still busy. Starting
the interior request only after that installation finished let gravity carry
CJ below the future floor. The house reproduction found floor Z 1013.7421875,
but CJ was already at Z 1010.87478 when the interior first became available.

A queued script transfer now holds simulation immediately while the earlier
installation finishes, then hands off to the existing transfer/install hold.
The scene selector continues outside the simulation step. Once the destination
is installed, CJ resumes at the script's pose and ordinary collision grounds
him. No extra teleport or artificial floor is introduced.

## Validation and limits

Six focused tests use the original arena IPL, transformed large-room bounds,
strict XY/height margins, wrong areas and area 13. All 5,061 unit tests pass (51 skipped), and the build passes. The combined browser run passes occupied-area queries, the house/street
transfer regression and the original ZERO4 barrel pickup/carry/drop.

The scene regression retains the outside cutscene-area guard, grounding and
position checks in both destinations, outdoor following and empty door stack.
It now disables pad control during these script/cutscene transfers, as the
original scripts do. This prevents competing automatic walk-ins at its house
and pizza-door coordinates; all destination assertions remain in place.

The inspected ZERO4 screenshot now shows the track, terrain, river, bridges and
helipad. Its fixed ground query returns 1343.98858, and released cargo falls and
lands. See [mechanics evidence](ZERO4_VALIDATION.md) and
[detachment motion](OBJECT_DETACH_MOTION.md).

This corrects integration of native area/content data within the browser's
windowed scene model. The 100-unit XY/50-unit height lookup, interior coverage
budgets, transfer scheduling and complete native CStreaming behavior remain
partial. The evidence does not establish full New Model Army completion.
