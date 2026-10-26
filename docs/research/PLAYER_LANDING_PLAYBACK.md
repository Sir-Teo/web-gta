# Player landing playback and body stats

The player's landing animations previously used a fixed speed of 1 or 2.
They now apply the captured CStats mode-2 body modifier on the landing task's
first update and retain that speed until the association ends. Physical
sprint input is read independently of sprint energy and retained button
memory. NPC hosts retain their association's ordinary speed.

## Evidence and capture boundary

The pinned gta-reversed revision
`4281f82d8af83e14935ac84a69dfd1ceebb9f256` reverses
CTaskSimpleLand::ProcessPed (`0x67D380`). It doubles playback only for a player
whose move state is SPRINT and whose pad currently holds sprint. Except for
IDLE_tired, it then multiplies association speed by CStats modifier 2, once
while bPedNotUpdated is set. The stat routine (`0x559AF0`) remains a retail
delegate in that PC source.

The independent harness executes the complete selected iOS ProcessPed at
`0x100416148..0x100416340` and the actual modifier at `0x100266300`. The pinned
binary SHA-256 is
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.

The 64 modifier profiles include both sides of the fat/muscle offsets,
negative script values and the native lower bound. The 150 landing profiles
include players/NPCs, run/sprint states, held/released physical input,
ordinary/IDLE_tired animation IDs, fresh associations and reused association
speeds 0.5/1/2. A second ProcessPed call changes both stats and pad input;
the native first-update flag has cleared, so playback stays latched.

Declared logged stubs provide BlendAnimation's association and initial
speed, SetFinishCallback, IsPlayer, GetPadFromPlayer and GetSprint. The
modifier's table loads, floating-point operations, association multiplication
and first-update flag instructions execute unchanged. The pedestrian starts
upright with zero angular velocity. These profiles do not establish animation
allocation/blending, tilted-ped heading repair, callback execution, no-clip
landings or the full task manager. They are selected-executable evidence,
not matched original-PC traces.

```sh
PYTHONPATH=artifacts/reversing-deps python scripts/research/emulate-player-landing.py \
  --binary artifacts/gta3sa-ios-reference --output artifacts/player-landing-reference-regenerated.json
cmp tests/fixtures/player-landing-reference.json artifacts/player-landing-reference-regenerated.json
```

## Arithmetic and integration

Mode 2 uses float fat stat 21 and muscle stat 23. With native intermediate
rounding it computes:

```
max(0.8, 1 + max(0, (fat - 200) / 800) * -0.2
             + ((muscle - 50) * -0.1) / 950)
```

Default zero fat/muscle gives 1.0052632093429565; fat/muscle both 1,000 gives
float32 0.8. A sprinting player holding the physical sprint button gets 2
before this multiplication. Sprint exhaustion does not replace that pad
query, and released button memory does not count as physically held.
IDLE_tired skips the multiplier in the native task; the pure arithmetic
adapter covers that exception without adding a tired-idle animation.

The live Simulation supplies current script stats through a modifier
provider. NativeCharacter reads it only when entering a native-coordinate
landing role, latches playback, and advances pose, root travel and foot-contact
crossings at that speed. Later stat or input changes do not rescale the
current landing. A non-player character host without the player provider
keeps speed 1. Imported non-native-coordinate role policy remains separate.

## Checks

All 214 first-update arithmetic results match the independent capture
exactly and the fixture regenerates byte-identically. Four new character
checks exposed the original missing multiplier, exhausted held input,
released input with positive button memory, and NPC speed paths. They now
pass and verify that the provider is read once, with later changes ignored.
Three existing landing speed expectations now use the captured default
factor; their phase, extracting travel and unchanged-input latch assertions
remain. Foot-contact checks use the same factor at the native source times.
The focused animation/controller/swim run passes 303 checks (one existing
skip).

The live browser presses Space for two real jumps. Fat/muscle 1,000/1,000
lands at float32 0.8 across 35 landing updates even after stats become 0/0
and the current modifier becomes 1.0052632093429565. The second jump starts
with that default modifier, retains it across 28 landing updates, and ignores
a mid-landing change back to 1,000/1,000. Existing dry-land jump and airborne
aim/fire regressions pass. All three browser checks have no page errors.
The recorded rows are `artifacts/player-landing-stats.json`; browser output
is `artifacts/player-landing-browser.log`.

All 8,286 unit tests pass (51 skipped). TypeScript validation and the
production build pass.
Production smoke passes saved-game return, movement, car entry,
map/waypoint, pause/resume, aircraft takeoff and landing gear with no page
errors or failed requests (`artifacts/player-landing-production.log`).

Body-stat save ownership, launch/air task playback modifiers, full animation
manager timing/blending, tired partial idle and matched original-PC captures
remain separate work.
