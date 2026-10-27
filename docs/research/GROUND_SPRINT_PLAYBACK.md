# Ground sprint tapping and root motion

Ground sprint associations previously played at speed 1 even when the native
button controller produced a result above 1. Repeated sprint presses now
change the association's playback and its extracting root motion. Held input
decays back to ordinary sprint through the existing captured controller.

## Executable evidence

The pinned gta-reversed revision
`4281f82d8af83e14935ac84a69dfd1ceebb9f256` leaves PC
CPlayerPed::SetRealMoveAnim (`0x60A9C0`) as a retail delegate. The independent
capture executes the entire selected iOS routine at `0x10035eaa4..0x10035f644`
with established walk/run/sprint associations. The selected binary SHA-256 is
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.

The 48 cases cover twelve button-speed values across the threshold at 5,
ordinary versus MODE_FIXED (15) cameras, and steady versus resuming sprint
blend deltas. Association lookup (`0x1001405a8`) supplies declared existing
objects; UpdateStatsWhenSprinting (`0x100265518`) is an explicit logged stub.
This harness establishes playback and resume behavior; it does not establish
the lookup implementation, training side effects, other animation states or
original-PC executable equivalence.

The ordinary-camera path at `0x10035f25c..0x10035f2bc` inlines the ground
GetButtonSprintResults arithmetic and stores max(1, result) in association
speed. Button speed 10 gives float32 1.3; speed at or below 5 gives 1.
MODE_FIXED stores float32 0.7 instead. A negative sprint blend delta resumes
at +2, with run at -2, before the playback update.

```sh
PYTHONPATH=artifacts/reversing-deps python scripts/research/emulate-ground-sprint-playback.py \
  --binary artifacts/gta3sa-ios-reference --output artifacts/ground-sprint-playback-regenerated.json
cmp tests/fixtures/ground-sprint-playback-reference.json artifacts/ground-sprint-playback-regenerated.json
```

## Host integration

The character forwards this frame's read-only sprint-controller preview to
its movement associations; Simulation still commits the controller once.
The association stores its native playback speed, including while fading.
The next clump update advances both pose and extracted root travel at that
speed. A newly added sprint association receives its playback immediately.

The reversed PC RpAnimBlendClumpUpdateAnimations (`0x4D34F0`) accumulates
sum(duration / speed × blend) for synchronised clips. Their common phase
rate is sum(blend) divided by that sum. UpdateTimeStep (`0x4D13A0`) then
uses duration × phase rate for synced associations and speed otherwise.
The host previously omitted the speed divisor because every speed was 1.
It now uses the native formula, keeping walk, run and sprint in phase while
their blended root motion responds to tapping. Existing timing, blend,
stop and ordinary speed checks remain in place.

## Scope

The movement-association adapter covers the captured fixed-camera playback
override. The host carries the native mode with the camera transform when
it is applied. Script MODE_FIXED and the existing stunt camera supply mode
15; attached and entity-follow transforms retain their own modes, and
cutscene fly-by transforms do not inherit a prior fixed-camera mode.
Adrenaline's animation/time-scale lifecycle, tired partial idle, the complete movement
association manager and fallback single-role rigs remain separate work.
This change does not claim full SetRealMoveAnim equivalence.

## Checks

All 48 captured cases match exactly and regenerate byte-identically. The
focused animation/character/controller run passes 129 checks (one existing
skip). Fifty new checks failed before the repair on playback speed, shared
phase and extracting travel. Existing resume behavior also matches the
captured blend deltas.

The live browser starts ordinary W+Shift movement and records the animation
motion passed into Simulation. Normal sprint extracts 9.564 m/s averaged
across more than two game seconds. Frame-scheduled DOM sprint key edges then
extract 12.340 m/s; all 119 boosted frames match the native playback formula,
and button speed reaches 10. Held input decays back to button speed/playback
1. There are no page errors. The screenshot shows the real player sprinting.
These are extracting root-travel rates; scenery can block actual world
displacement.

The rapid-tap portion uses the existing SCM SET_TIME_SCALE host at 0.1 so
software rendering does not run six physics steps between DOM key edges.
Ordinary held movement runs at normal scale, and the test restores scale 1.
The controller state and playback are never seeded. Initial test attempts
used an unstable one-frame velocity assertion or taps too slow relative to
game time; their replacements measure complete strides and declare event
cadence. One interrupted run was invalidated by a Vite reload from a source
comment edit. The final run keeps source fixed throughout.

All 8,068 unit tests pass (51 skipped). TypeScript validation and the
production build pass. The existing live keyboard energy/exhaustion check
also passes with playback integrated.
Production smoke passes saved-game return, walking, car entry, map/waypoint,
pause/resume, aircraft takeoff and landing gear with no page errors or failed
requests (`artifacts/ground-sprint-playback-production.log`).

## Active fixed-camera integration

The host now forwards the active camera configuration's native mode through
Controls to the movement associations. A generic renderer `fixedCamera`
transform also represents attached, entity-follow and cutscene cameras, so
its presence alone cannot select the 0.7 override. The applied configuration
carries `nativeMode`; pending script `modeToGoTo` changes take effect when
their new camera configuration is applied. Restoring the camera removes that
configuration and the sprint association returns to its ordinary result.

The new browser check first reproduced speed 1 after a script fixed camera
had visibly taken control, where the independent capture requires float32
0.7. The change uses the existing captured formula and does not change the
pad controller or its resource debit. Existing stunt-camera creation also
declares MODE_FIXED; its wider task/vehicle lifecycle is unchanged.

All 147 focused animation/controller/camera checks pass (one existing skip).
The live check passes ordinary follow mode 4, active fixed mode 15 at
0.699999988079071, attached mode 47 at 1 despite a renderer-fixed transform,
and restored follow mode 4 at 1. Sprint energy continues spending in fixed
mode. The existing script-camera regression also passes. TypeScript,
production build and production smoke pass with no page errors or failed
requests. Logs use `artifacts/fixed-camera-sprint-*`; the complete 8,068-test
unit run belongs to the preceding ground-playback checkpoint.
