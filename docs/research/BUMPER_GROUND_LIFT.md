# First-person vehicle ground lift

The selected first-person vehicle camera adds a world-Z lift when the physical
vehicle's up-Z is at or below float32 −0.9. This prevents the flipped vehicle's
bumper camera from staying below its normal source. It is a per-camera-call
state transition, not a time-scaled spring.

## Evidence

`scripts/research/emulate-bumper-ground.py` executes the pinned iOS binary's
`Process_1stPerson` guard at `0x100217a90..0x100217af0`, including the actual
`CVehicle::IsUpsideDown` at `0x100479678`. The optional prefix executes
`0x10021769c..0x100217750`, with a declared present vehicle RenderWare object,
to capture reset-statistics behavior. It replaces no guard arithmetic.
The binary size is 14,226,544 bytes and its SHA-256 is
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.

The 180 fixed cases vary prior state, up-Z values around the threshold, source
height, and reset presence. They retain native output in
`tests/fixtures/bumper-ground-reference.json`.

The independently pinned reversed-PC `Cam.cpp` (`0x517EA0`) and
`Vehicle.cpp` (`IsUpsideDown`) agree on the scalar transition and reset. Their
SHA-256 values are respectively
`2df8f5b892109c4f71173b09558877dbdc79ef0ec6cf3fb15bbfcce9962a214d` and
`58cb9544808afd23f3de1b5e43ad73463fabb66a438a394f6ffb0cd5cd3b19d8`
at revision `4281f82d8af83e14935ac84a69dfd1ceebb9f256`.

When upside down, an old state below 0.5 adds float32 0.03. Otherwise it becomes
0.5. The comparison uses the old state: 0.49 first becomes about 0.52 and only
the following call caps it. Upright nonnegative state clears immediately;
a negative state subtracts 0.03. Reset clears the state before the update.
The resulting state is added to the existing source in world Z, after the
bike neck/visibility or boat height stage and before side/rear look routines.

## Integration boundaries

The host maps entry into the active bumper camera to reset and holds its lift
state during paused redraws. These are explicit host lifecycle adapters.
The complete native `m_bResetStatics` writer and pause scheduling are outside
the capture. The native wheelie camera path is also outside this change.
Source math and native captures do not establish complete retail-PC camera
ownership, rendering, FPU or frame scheduling equivalence.

## Validation

The unchanged browser build misses the captured lift, reaching a maximum
missing height of 0.5100005 metres (`artifacts/bumper-ground-baseline.json` and
`.log`). The corrected real vehicle check passes growth, overshoot, cap,
leaving/re-entering bumper mode, three held redraws, rear look and upright
recovery. The native replay matches all 38 active, unpaused state transitions
exactly and all 34 forward-view camera heights exactly. Paused redraws are
checked separately because native pause scheduling is outside the capture.

Evidence: `artifacts/bumper-ground-live.json`,
`artifacts/bumper-ground-live-native.json`,
`artifacts/bumper-ground-live-verification.json` and
`artifacts/bumper-ground-browser.log`.

All 855 focused reference/ownership tests and TypeScript pass. All five browser
specs pass: the new lift check, vehicle/body culling, six-model side/rear looks,
all fourteen bike/quad height paths with movement and visibility fallback, and
all ten boats. All 54 side/rear sources also retain exact native replay matches.
Evidence: `artifacts/bumper-ground-height-browser.log` and
`artifacts/bumper-ground-look-live-verification.json`.

The full suite passes **18,607 tests / 51 skipped** across 896 passing files
(`artifacts/bumper-ground-full-unit.log`). The production build and smoke pass,
including save/resume, walking, car entry, map waypoint, pause/resume and
aircraft takeoff/gear, with no browser errors or failed requests
(`artifacts/bumper-ground-build.log` and
`artifacts/bumper-ground-production.log`).
