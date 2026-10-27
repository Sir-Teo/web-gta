# Boat AI heading and throttle precision

The script boat controller used JavaScript atan2 and double arithmetic. The
native heading helper uses float operations and CGeneral::GetATanOfXY, whose
range is 0..2PI, including 2PI on positive X. The boat's subsequent wrap
retains both -PI and +PI. A boat facing west with its destination east
therefore chooses positive half-radian steering; the old controller chose
negative half-radian steering. Quantization also affects shallow turns,
world-coordinate subtraction and the easing into cruise speed.

## Evidence and implementation

The pinned gta-reversed revision
`4281f82d8af83e14935ac84a69dfd1ceebb9f256` contains the full PC
CGeneral::GetATanOfXY body at `0x53CC70`. The independent fixture executes
selected iOS SteerAIBoatWithPhysicsHeadingForTarget at `0x10019c4dc` and
GetATanOfXY at `0x10023f3dc`. Its binary SHA-256 is
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.

The imported _atanf thunk at `0x1004eccec` is supplied by host libm rounded
to float32. Its identity comes from the Mach-O indirect symbol table and
pointer slot `0x1005acf78`; its library implementation is not captured.
Each fixture case records those primitive inputs and outputs. The actual
normalization, quadrant arithmetic, wrap, clamp and throttle instructions
execute unchanged. The west-to-east turn uses signed-zero atan inputs, so
that direction does not depend on a nontrivial libm approximation.

`scripts/research/emulate-boat-ai.py` requires the existing pinned binary,
performs no download, and regenerates the 149-case fixture byte-identically:

```sh
PYTHONPATH=artifacts/reversing-deps python scripts/research/emulate-boat-ai.py \
  --binary artifacts/gta3sa-ios-reference --output artifacts/boat-ai-reference-regenerated.json
cmp tests/fixtures/boat-ai-reference.json artifacts/boat-ai-reference-regenerated.json
```

The shared nativeAtanOfXY helper reproduces the native quadrants and float
rounding. Boat AI now rounds normalization, coordinate subtraction, angle
difference, wrapping and throttle intermediates at the represented native
operations. Reverse throttle also reverses steering, retaining signed zero.
Other vehicle controllers remain outside this change because their angle
wrappers need independent validation.

## Checks and limits

The fixture covers 81 combinations of bow/destination directions, 64 cruise
and speed combinations, and four near-zero/cancellation cases. Before the
repair, 74 of the 149 exact-output checks failed; afterward all pass. The
existing boat mission, engine and anchor checks pass too.

The live Speeder fixture sets real SCM heading and navigation state and
samples WorldBoat's control adapter with the actual Rapier body quaternion.
It checks the exact-astern positive turn from rest and its reversal above
cruise speed, then exercises ordinary navigation, engine stop and restart.
Synchronous control sampling isolates that boundary from subsequent water
forces; it is not a long-run trajectory comparison.

All 7,086 unit tests pass (51 skipped), as do TypeScript validation and the
production build. The live astern/reverse controls, navigation, stop/restart
and Predator anonymous-round/gun/audio/history regressions pass without page
errors.
Player engine/skimming and anchor/propeller-water lifecycle checks pass too.
Normal production smoke passes saved-game return, movement, vehicle entry,
map/waypoint, pause/resume, takeoff and landing gear without page errors,
failed requests or a development inspection hook.

The fixture establishes the represented selected-executable arithmetic. It
does not establish matched original-PC trajectories, an identical platform
atanf implementation, all temporary AI actions, obstacle recovery or complete
native boat dynamics.
