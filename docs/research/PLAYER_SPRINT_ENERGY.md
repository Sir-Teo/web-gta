# Native player sprint input and energy

The player used an authored 0–100 stamina meter, a fixed 7-per-second drain
and a 30% recovery threshold. Earned stamina did not extend that budget.
The player now uses the captured native stat-derived sprint resource,
retained button state, exhaustion floor and recovery rules.

## Evidence

The pinned gta-reversed revision
`4281f82d8af83e14935ac84a69dfd1ceebb9f256` fully reverses
CPlayerPed::ResetSprintEnergy (`0x60A530`), HandleSprintEnergy (`0x60A550`)
and the ProcessControl (`0x60EA90`) recovery caller. The stat modifier
(`0x559AF0`), ControlButtonSprint (`0x60A610`) and GetButtonSprintResults
(`0x60A820`) remain retail delegates. The legacy body after the latter's
return is not treated as independent original-PC executable evidence.

The new harness executes these selected iOS routines:

| Routine | Address |
| --- | --- |
| Stat modifier, mode 7 | `0x100266300` |
| ResetSprintEnergy | `0x100366240` |
| HandleSprintEnergy | `0x100360ad0` |
| ControlButtonSprint | `0x10036626c` |
| GetButtonSprintResults | `0x100361af8` |
| Four sprint tuning rows | `0x100651264` |

The binary SHA-256 is
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
Actual float, branch, state and table instructions execute unchanged.
ControlButtonSprint's pad and vehicle queries are explicit logged input
stubs: GetPad, SprintJustDown, GetSprint, FindPlayerVehicle and the two walk
axes. Its fixture does not execute those external input implementations.
The selected mobile pad has widget-specific behavior; the browser supplies
the target PC's Shift/edge and movement inputs through the input contract.
PC GetSprint/SprintJustDown (`0x5407A0`/`0x5407F0`) share their configured
sprint button, independently of the sprint mode.

The 741 cases contain 560 control cases, five modifier/reset cases, 144
energy cases and 32 result cases. They include the browser's usual
50/60-native-unit frame, both sides of the energy floor, button presses,
holds/releases, four modes, moving/stationary and vehicle queries,
never-tired/adrenaline flags and the native player sprint-disabled field.
The fixture regenerates byte-identically:

```sh
PYTHONPATH=artifacts/reversing-deps python scripts/research/emulate-player-sprint.py \
  --binary artifacts/gta3sa-ios-reference --output artifacts/player-sprint-reference-regenerated.json
cmp tests/fixtures/player-sprint-reference.json artifacts/player-sprint-reference-regenerated.json
```

## Resource and button rules

Mode 7 computes float stamina stat 22 / 1,000 × 3,000 + 150 with native
intermediate rounding. Initial stat 100 gives 450 energy units; maximum stat
1,000 gives 3,150. A stat change changes the capacity without refilling or
clamping the current budget. ResetSprintEnergy uses current capacity and
does not clear the separate button-speed field.

A sprint press adds 4 to button speed, capped at 10. A held button eases it
down by 0.7 per native timestep, retaining at least 1; release eases it down
by 0.2, retaining zero. Positive button memory can continue requesting sprint
below zero energy. The resource accepts the call that reaches -150; the
following draining call fails and clears button speed. A newly positive
budget can start a new burst without a percentage threshold.

| Mode | Base cost | Cost above button speed 5 | Result curve |
| --- | ---: | ---: | ---: |
| Ground | 1 | 0.5 | 0.3 |
| BMX | 0 | 0.4 | 1 |
| Surface water | 1 | 0.3 | 0.3 |
| Underwater | 0 | 0 | 1 |

Costs multiply the native timestep. Sprint results above the threshold
follow the captured table curve. No energy is spent while stationary with
no vehicle. Never-tired, adrenaline and zero-cost branches bypass spending.
The ground task's weapon/surface/aim eligibility is separate from the
controller's player-data flag and from the water task's own input rules.

ProcessControl recovers after the movement task: running adds 0.15 per
native timestep, other ordinary non-sprint ground movement adds 0.5, and a
non-BMX vehicle uses the ordinary recovery path. Recovery may overshoot the
capacity. The swim task recovers at multiplier 0.5 in the breaststroke and 1
outside the crawl; underwater non-positive energy is first raised to 0.1,
then its zero-cost row runs. The existing adrenaline timer and broader task
ownership are still host adapters.

## Integration

Simulation stores raw native energy and button speed separately from script
stat 22. The saved stat provider supplies capacity. Initialization, player
reset, cutscene/reset callers, adrenaline pickups/cheat and the save-point
restore use current capacity. The source pickup at PC `0x4564F0` explicitly
calls ResetSprintEnergy; the stamina cheat (`0x439930`) changes the stat
without resetting energy.

State selection and the character read a pure preview. The simulation
commits the same pad controller once. Raw sprint input survives independently
of the animation's selected move state, including WALK_START and stop
associations, so recovery follows the resulting movement state. Unsupported
and airborne paths preserve their original controls object unchanged.

Surface crawl selection and underwater stroke/glide selection use native
sprint results. A new underwater association starts at speed 1 and refreshes
its playback speed at a loop restart, following ProcessSwimAnims. NPC hosts
without the player controller retain their separate movement requests.
Full animation-manager equivalence remains outside this adapter.

## Checks and limits

All 741 captured cases match exactly. Integration checks cover initial and
stat-derived budgets, read-only previews, one actual debit, post-association
recovery, release memory, floor-reaching/following calls, newly positive
restarts, blocked ground input, the independent water caller and the
underwater 0.1 branch. The complete focused run passes 870 checks (one
existing skip), including unchanged airborne/unsupported return checks,
adrenaline duration, crouch and save-point regressions. Missing run clips and
non-arm gun-movement ownership also retain their no-debit paths; two focused
checks expose and verify the raw-input adapter repair for those cases.
The first full run exposed the untouched-controls identity regression and
remaining percentage-era assertions. The adapter was repaired while keeping
the same identity checks; resource expectations now follow the captured
floor/capacity behavior. All 8,018 unit tests pass (51 skipped), including the final no-run/gun-task ownership repair.
Final TypeScript validation and the production build pass.

The live game with stamina stat 1,000 resets to energy 3,150 and runs at about
9.48 m/s after two simulated seconds. A controlled energy seed while the
real keyboard is held reproduces a captured frame exactly: energy
-149.89999389648438 reaches -150, button speed becomes 3.4166667461395264 and
factor remains 1. The next frame returns factor 0 and button speed 0; the
actual association requests running, and subsequent frames recover energy.
A newly positive controlled budget restarts real sprint movement while the
budget becomes negative again. There is no old percentage gate. Native
swimming-training and ordinary save/reload checks pass in the same live run,
without page errors.

The final targeted browser run passes all four checks: keyboard energy and
restart, script-disabled sprint, and restricted/unrestricted surface sprint.
Production smoke also passes saved-game return, walking, car entry, map and
waypoint, pause/resume, aircraft takeoff and landing gear, with no page errors
or failed requests. Logs are `artifacts/player-sprint-targeted-final.log` and
`artifacts/player-sprint-production.log`.

The controller fixture establishes selected-executable computation with
declared external inputs, rather than matched original-PC input traces.
The [later ground playback port](GROUND_SPRINT_PLAYBACK.md) applies the
captured tapping result to ordinary-camera SPRINT associations and their
synchronised root travel. Adrenaline/fixed-camera host behavior,
complete task/air/weapon ownership, mobile widget semantics and the BMX
pedal/controller integration remain separate work. Capturing the BMX table
row does not establish its live vehicle integration.
