# Captured bicycle rider cadence

The initial clock integration documented here is superseded by
[native bicycle association blending](BICYCLE_ASSOCIATION_BLENDING.md), which
adds pedal/sprint pose selection, synchronization, lifetime and wrapped phase.
The 370 decision captures remain applicable.

The BMX, Chopper and Mountain Bike now advance the available pedal clip at
the captured native cadence instead of a constant one second per second.
Native lean, drive-by-association, coasting and status decisions determine whether that clock
plays. Cranks consume the updated phase in the same post-physics step.
Rider absence releases the clock, so a later rider starts a fresh available
pedal phase; a frozen bicycle holds it.

## Selected native execution

Pinned gta-reversed `4281f82d8af83e14935ac84a69dfd1ceebb9f256`
delegates CBmx::ProcessDrivingAnims (PC `0x6BFB50`) to the retail executable.
The harness executes selected iOS code from `0x100459cb0` through its rider
fallback or pedal/sprint/coasting continuations. It includes actual
existing-association playing-bit and playback-speed writes, stopping at
`0x100459db0` or `0x10045a0a8` before phase/pose work.

Velocity/forward-basis registers, vehicle fields and preexisting fully blended
pedal/sprint associations are declared inputs. No animation-manager calls,
pose sampling or full blend transitions execute. Mode is the selected native
continuation; playing is read from the actual pedal association's flag, and
its written speed is also captured. Initially paused associations verify
resume as well as stop decisions.

The pinned executable is 14,226,544 bytes, SHA256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
All **370 fixed captures match exactly**. Cases cover all three models,
gear/cadence boundaries, coefficient precision, forward/reverse/zero motion,
lean cutoffs, forward lean, drive-by-association presence, player/simple/physics
status and retained or absent gas. The source's simple-traffic status is 2;
player status is 0.

## Native rules and host mapping

The ordinary rider fallback is selected when absolute lean reaches its
float32 limit (0.4, or 0.7 with pedal coefficient above 5), a drive-by association
is present, forward speed is at most float32(0.01), or forward lean reaches
the same limit. Speed uses native units per 50-Hz frame.

BMX and Chopper cadence is float32(forward speed × 3). Mountain Bike cadence
is zero in gear zero; otherwise it is
`float32(float32(speed × 5) / float32(float32(gear × maxFlatVelocity) − 0.25))`.
The handling field is cTransmission::m_MaxFlatVelocity at handling +0x88,
not the configured top-speed field. Cadence is not capped at 1: the Mountain
Bike's pedal clip can advance faster than wall time.

The native sprint continuation requires coefficient above 5 and cadence below
2.5 (BMX/Chopper), or 2 (Mountain Bike). Otherwise the pedal continuation
plays while coefficient is positive, gas is nonzero or status is simple
traffic. A player coasting with zero coefficient/gas pauses the pedal clip.

WorldBike supplies current post-physics forward speed, handling, gear, lean,
resulting gas and captured player pedal coefficient. The native blocking
association is BIKE_DRIVEBYLHS/RHS/FT (202–204). Current browser rider posing
has no such association, so the host supplies false for its presence; the
weapon trigger is not substituted for an animation association. The current
host has no forward rider-lean controller,
so it supplies zero for LeanFwd. The clip clock advances once before crank
sampling, not again when rendering or afterStep repeats without a physics
step. Existing bunny-hop posing retains crank precedence; the host clock
retains its previous playback decision under the hop.

This change applies cadence/playing to the available pedal clip. BIKE_SPRINT
pose selection/blending, ordinary CBike rider fallback poses, clump-wide
synchronization, association lifetime and exact native float32 phase wrapping
remain open. The existing unbounded browser phase clock is preserved.
Script-driver replacement without an empty rider frame and complete native
vehicle/task scheduling are also outside this clock's ownership check.
Selected iOS execution does not establish whole-game original-PC parity.

## Verification

The 594 focused checks pass, including all 370 native decision cases and
existing BMX energy, hop and crank checks. Four final browser regressions pass
(51.9 seconds): all-model cadence/coast/freeze/remount/crank checks, existing
pedal articulation and hop poses, actual BMX input/energy, and phone bunny hop.
The initial cadence spec incorrectly assumed playback would remain below
real time; the executable's Mountain Bike calculation disproved that bound,
and the assertion now verifies variable cadence instead.

All **408 recorded live rider decisions** independently replay through the
selected native code with **408 exact matches** for mode, cadence and actual
playing flag, including the native speed write on playing frames. Clock-rate
and crank-phase assertions use the actual loaded IFP durations. Evidence:
`artifacts/bicycle-rider-browser-final.log`,
`artifacts/bicycle-rider-cadence-live.json`,
`artifacts/bicycle-rider-live-native.json` and
`artifacts/bicycle-rider-live-verification.json`.

```sh
PYTHONPATH=artifacts/reversing-deps python scripts/research/emulate-bicycle-rider-decision.py \
  --binary artifacts/gta3sa-ios-reference --output artifacts/bicycle-rider-decision-regenerated.json
cmp tests/fixtures/bicycle-rider-decision-reference.json artifacts/bicycle-rider-decision-regenerated.json
```

The complete unit suite passes **10,346 tests / 51 skipped** across 872 passing
files (203.53 seconds), recorded in `artifacts/bicycle-rider-full-unit-stable.log`.
The fixed native fixture regenerates byte-identically.

A final enum/descriptor cross-check corrected the name of the blocking
association from exit to drive-by (native IDs 202–204). The final caller
supplies association presence rather than treating dismounting or firing as
that association. Numeric cadence/playing decisions are unchanged.

After the drive-by association correction, the affected all-model cadence and
live BMX energy checks pass again (32.2 seconds), and all 408 native live
replays remain exact. The final full suite above includes that correction.
Its first attempt exposed the unrelated stale anonymous type-52 critical-hit
test, corrected separately in the
[deterministic critical regression](NPC_CRITICAL_HEADS.md#deterministic-anonymous-fixed-round-regression-october-27-2026).
The final stable rerun passes every active test. No damage behavior changes
were needed. Evidence: `artifacts/bicycle-rider-browser-corrected.log`.

The final TypeScript/production build and built-game smoke also pass, covering
save resume, walking, car entry/driving, map, pause, takeoff and gear checks
with no page errors or failed requests. Evidence:
`artifacts/bicycle-rider-build-final.log` and
`artifacts/bicycle-rider-production-final.log`.
