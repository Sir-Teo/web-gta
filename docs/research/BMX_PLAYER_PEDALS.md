# BMX player pedal and energy decision

The BMX, Chopper and Mountain Bike previously skipped ordinary vehicle energy
recovery without running CBmx's own sprint controller. Their player energy
and button memory therefore stayed frozen while riding. The host now runs
the captured BMX decision once per active player bicycle control frame.
Retained sprint-button input can supply gas when both pedals are zero, and
the rider's pedal clock follows that resulting gas.

## Reference and scope

The harness executes selected iOS CBmx code `0x100459478..0x100459558`,
including branches at `0x1004597c0..0x100459884`. The actual native
ControlButtonSprint, GetButtonSprintResults, HandleSprintEnergy and capacity
stat modifier run unchanged. Pad queries and the existing BIKE_SPRINT
association are declared inputs; the final cycling-training call is logged,
not executed. This is a decision-block capture, not the complete rider task
or an independent original-PC execution.

The pinned binary is 14,226,544 bytes with SHA256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
The block starts with the original caller's S8=1 precondition. Native CBike
control clears the boost bit before the decision; the pure helper preserves
an existing supplied bit, while the host clears it each frame.

All 217 native profiles match exactly, covering retained/released/pressed
sprint input, energy at capacity/zero/exhaustion, steering cutoff, brake and
gas values, initial boost/coefficient, accelerator pressure/press edges,
fast-association blend boundaries, flags and six time steps.

```sh
PYTHONPATH=artifacts/reversing-deps python scripts/research/emulate-bmx-pedal-control.py \
  --binary artifacts/gta3sa-ios-reference --output artifacts/bmx-pedal-regenerated.json
cmp tests/fixtures/bmx-pedal-control-reference.json artifacts/bmx-pedal-regenerated.json
```

## Behavior and limits

The controller uses native sprint mode 1 and the player's shared energy and
button memory. It snaps steering angles smaller than float32(0.0001) to zero.
Straight nonzero accelerator input can set boost without a sprint-button
press. The fallback recovers energy with max(0.5, 1 - accelerator/255 × 0.5),
using native float32 steps. The divisor in the executable is **-255**.
Native recovery may overshoot capacity. Retained button input sets the pedal
coefficient to float32(4.9) and supplies gas only when both gas and brake are
zero. At negative energy, the accelerator's press edge and coefficient decay
follow the captured branches.

The host supplies the steering angle from its handling lock and smoothed
steering, current pedal/brake state and actual sprint press edges. Scripted
bicycle drivers and motor-driven vehicles do not consume this player branch.
Frozen, unloaded and skipped-physics bikes retain their existing early exits.
The host has no native BIKE_SPRINT association yet, so it supplies no fast
association. Boost/coefficient are retained as decision outputs; the full
native bicycle acceleration formula, sprint-animation blending and cycling
training are still open. Existing authored vehicle acceleration remains.

## Host validation

The 962 focused checks pass, including all 217 decision captures and the
741 existing sprint captures. TypeScript validation passes. The native
fixture regenerates byte-identically.

Three browser regressions pass (53.2 seconds): actual W/D/Shift riding,
crank/pedal articulation for all three bicycle models, and the phone's
Bunny hop control. The energy check observes live host steps and seeds only
energy to expose recovery below capacity. Idle and turning recovery agree
exactly with native float32 arithmetic; straight acceleration selects boost,
retained Shift input supplies gas and advances the pedal clip, and repeated
presses drain energy. Fast tap pairs use DOM keyboard events in one browser
turn because separate automation protocol calls can span enough physics
steps to lose released button memory. No controller result is injected.
Evidence: `artifacts/bmx-pedal-browser-final.log`,
`artifacts/bmx-player-energy.json` and `artifacts/bmx-pedal-focused.log`.

An earlier browser run was invalidated by a source-comment edit triggering
HMR. A subsequent attempt exposed an automation timing gap between Shift
release and press; its trace showed the intervening native decay. Both are
recorded separately and excluded from the final passing run.

The complete unit suite passes: **9,432 passed / 51 skipped** across
867 passing files (193.31 seconds), recorded in
`artifacts/bmx-pedal-full-unit.log`.
The production build and deployed-base-path smoke test also pass. The built
game resumes a save, walks, enters/drives a car, opens the map, pauses/resumes,
takes off and operates landing gear with no page errors or failed requests.
Evidence: `artifacts/bmx-pedal-build.log` and
`artifacts/bmx-pedal-production.log`.
