# Body stats in jump launch animation and force

Jump launch animations previously played at speed 1, and physical launch
always used the unmodified 8.5 force and association forward bands. The
player now reads CStats modifier 2 at launch-animation start, keeps that
animation speed, and reads current body stats again when physical launch
occurs. Landing uses the same stat computation at its own contact time.

## Source and executable evidence

The pinned gta-reversed revision
`4281f82d8af83e14935ac84a69dfd1ceebb9f256` reverses
CTaskSimpleJump::StartLaunchAnim (`0x67D7A0`) and Launch (`0x679B80`). They
read STAT_MOD_2 for launch playback and physical force/forward speed.
GetFatAndMuscleModifier (`0x559AF0`) remains a PC retail delegate.
The [landing capture](PLAYER_LANDING_PLAYBACK.md) establishes its selected
fat/muscle computation.

The new independent harness executes the complete selected iOS start
(`0x100417818`) and launch (`0x100417418`) routines, actual modifier
(`0x100266300`) and actual ApplyMoveForce (`0x1002482d4`). The binary SHA-256
is `9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.

Ten start profiles include nine body profiles plus an NPC without player
data. The 258 force profiles cover association presence and blend 0/0.5/1,
body profiles, mega jump, climb-jump zero horizontal speed and NPC normal/
high-jump force. The profiles begin with zero velocity, mass 70, heading 0,
no platform/climb entity and no bloody footprints.

Association lookup, BlendAnimation, callback registration, player identity,
steep-slope and direction-allowed queries are explicit logged stubs. The
heading-zero sinf/cosf stubs return exact 0/1. Stat arithmetic, blend
coefficients, mega-jump multiplication, physical reciprocal-mass arithmetic,
velocity writes and task flag instructions execute unchanged. The fixture
does not establish those external implementations or general-angle libm
equivalence. Start profiles use an empty movement clump, so this capture does
not establish the broader launch-foot phase chooser.

```sh
PYTHONPATH=artifacts/reversing-deps python scripts/research/emulate-player-jump-stats.py \
  --binary artifacts/gta3sa-ios-reference --output artifacts/player-jump-stats-regenerated.json
cmp tests/fixtures/player-jump-stats-reference.json artifacts/player-jump-stats-regenerated.json
```

## Arithmetic and ownership

Launch first builds the float forward band: 0.1 without run/sprint,
0.1–0.17 from the RUN association, or 0.17–0.22 from SPRINT. Presence of
SPRINT takes priority, including blend zero. Intermediate rounding matters:
the native sprint coefficient is float32(float32(0.22) − float32(0.17)),
not the rounded decimal 0.05. Fourteen captured cases exposed the latter
substitution; the implementation now uses the captured coefficient.

The body modifier scales the forward band and 8.5 player force. Mega jump
multiplies the resulting force by 10. Actual ApplyMoveForce multiplies by
float32(1/70); it does not defer division to JavaScript double arithmetic.
Zero body stats give force 8.544736862182617 and upward velocity
0.12206766754388809 native units/frame. Fat/muscle 1,000/1,000 give force
6.800000190734863 and velocity 0.09714286029338837. The host converts native
velocity to units/second with its existing factor 50, then retains its
gravity/collision integration. Climb jumps zero the requested horizontal
speed. The pure helper covers NPC force levels; the NPC physics controller
is separate from this player integration.

The shared body provider now serves launch start, physical launch and
landing. NativeCharacter reads and latches it at animation entry; the
Simulation reads it again at physical launch. A body change during the
launch clip therefore keeps the clip's original playback but changes the
physical impulse, following the two native call sites. Native-coordinate
roles use this path; other-coordinate imports retain their existing policy.

## Platform and scope limits

The PC source's velocity-retention comparison uses squared current speed
against an unsquared forward target. Selected iOS instructions
`0x100417534..0x10041753c` square the target before comparison. This change
does not replace the host's velocity-retention/carry policy with that mobile
branch. Zero-velocity and climb-jump capture profiles isolate the stat/force
arithmetic common to the represented caller paths. Full velocity retention,
platform/climb-entity behavior, arbitrary-angle trig, blocked-direction and
steep-slope queries, bloody-footprint FX, complete task/animation manager
equivalence and matched original-PC traces remain separate work.

## Checks

All 258 captured force/velocity profiles match exactly; the fixture
regenerates byte-identically. Ten character checks compare actual launch
entry and retained playback with the captured start profiles. Nine exposed
the missing player playback/provider read before repair. Six physical-player
checks exposed the missing body impulse, then verify captured upward and
association-forward velocity through real Simulation steps. Their heading
is explicitly zero to match the capture. The focused run passes 580 checks
(one existing skip), including the unchanged landing and movement checks.

The live browser performs two Space-key jumps and changes body stats after
the first launch-animation update. The first retains playback 0.8 for 15
launch updates, then uses the current 1.0052632093429565 factor for physical
launch. The second retains playback 1.0052632093429565 for 12 updates, then
uses the current 0.8 factor. Upward velocities after the existing first-step
gravity are 5.770050043861072 and 4.523809681336085 units/second, matching
the selected force capture. Requested horizontal speeds are
5.026316270232201 and 4.000000283122063.

The browser observes requested momentum at the real collision-controller
call and records post-collision momentum separately. A wall reduces the
second jump's actual horizontal momentum to 3.826693177598606; comparing
post-collision speed directly with the free-space impulse caused the first
browser assertion to fail. The corrected check retains exact impulse
comparison and bounds the resulting motion. It changes no controller or
collision output. There are no page errors. The existing landing-stat,
dry-land jump and airborne aim/fire checks also pass. Evidence is in
`artifacts/player-jump-stats.json` and `artifacts/player-jump-stats-browser-final.log`.

All 8,560 unit tests pass (51 skipped). TypeScript validation and the
production build pass.
Production smoke passes saved-game return, movement, car entry,
map/waypoint, pause/resume, takeoff and landing gear with no page errors or
failed requests (`artifacts/player-jump-stats-production.log`).
