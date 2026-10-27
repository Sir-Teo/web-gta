# Natural swimming stat training

Swimming now trains the actual player stamina and lung-capacity stats. The
previous movement loop trained foot running and motorbike riding but omitted
CStats::UpdateStatsWhenSwimming. Its gains now reach the captured breath
capacity provider and HUD without refilling current breath.

## Native evidence

The pinned gta-reversed revision
`4281f82d8af83e14935ac84a69dfd1ceebb9f256` contains the
CTaskSimpleSwim::ProcessSwimAnims caller at PC `0x6899F0`. It calls the stat
routine only for a player with move blend strictly above 0.5 or underwater
state 4, passing whether the task is underwater and whether it is sprinting
at the surface. CStats::UpdateStatsWhenSwimming (PC `0x55C990`) itself
remains a retail delegate.

The independent harness executes selected iOS `0x100265a34..0x100265c6c`,
with its actual float arithmetic, unsigned counters, stat storage, capping
and negative-energy fat reactions. It is pinned to executable SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
The actual packaged AR_STATS.DAT supplies the recorded configuration:

| Counter | Threshold | Gain | Config indices |
| --- | ---: | ---: | --- |
| Swimming stamina | 180,000 ms | 50 stamina | 34, 1 |
| Underwater breath | 60,000 ms | 50 lung capacity | 44, 10 |

Each call checks the previous unsigned counter. It pays out only when that
counter is strictly over its threshold, resets it to zero, and otherwise
adds the frame's float milliseconds truncated to unsigned integer. The
underwater counter changes only underwater; the swimming counter changes
for either eligible surface or underwater swimming. Out-of-water time and
idle treading preserve partial training. At the host's 30-fps game cadence,
the counter adds 33 ms per call, so thresholds describe accumulated counter
time rather than exact wall-clock minutes.

The native routine delegates to UpdateFatAndMuscleStats with exercise rate
10 for ordinary surface swimming and 15 for underwater or sprint swimming.
The capture logs that external call at `0x100265280`, as well as
CheckForStatsMessage (`0x100260300`) and DisplayScriptStatUpdateMessage
(`0x1002b0620`), and returns from those stubs without executing them. Those
physiology and HUD routine bodies were outside this initial swimming capture.
The [later body-exercise port](BODY_EXERCISE.md) independently captures the
physiology arithmetic and invokes it before swimming awards. The rate remains
available to observers. Existing stat increments retain their native
negative-energy fat deduction and cap at 1,000.

## Integration and validation

NativeStatReactions owns separate swimming and underwater counters. The
ordinary movement loop calls it after swim state/input selection, once per
game frame, for the source's movement gate. Foot running/sprint training is
suppressed while the player swims. Current script stat storage receives the
gains, and the existing stat-update UI handles its ordinary display gates.

The 96 independent fixture cases cover both flags, exact and exceeded
thresholds, fractional timesteps, separate counters, capped stats and
negative energy. All match, and regeneration is byte-identical:

```sh
PYTHONPATH=artifacts/reversing-deps python scripts/research/emulate-swim-training.py \
  --binary artifacts/gta3sa-ios-reference --output artifacts/swim-training-reference-regenerated.json
cmp tests/fixtures/swim-training-reference.json artifacts/swim-training-reference-regenerated.json
```

Additional checks cover the caller's strict movement gate and retained
underwater training across surface visits. All 108 focused checks pass,
including existing running/motorbike and lung-capacity integration checks.

The live fixture places CJ in real water, seeds the counters just beyond
their original thresholds, and lets ordinary game frames perform the awards.
Underwater, stamina 100→150 and lung capacity 0→50 raise capacity 1,150→1,300
without changing breath at the award. Returning to land pauses training.
Idle surface treading also pauses it; actual keyboard forward swimming then
raises stamina to 200 while lung capacity stays 50, giving capacity 1,375.
The partially accumulated underwater counter remains intact. No foot-running
training is delivered during swimming, and there are no page errors. The
earlier live breath/recovery/HUD regression passes in the same run.
All 7,254 unit tests pass (51 skipped), along with final TypeScript validation
and the production build.
Normal production smoke passes saved-game return, movement, car entry,
map/waypoint, pause/resume, takeoff and landing gear without page errors,
failed requests or a development inspection hook.

This verifies controlled game wiring and the represented native counter
routine. It does not establish uninterrupted multi-minute original-PC swim
trials, animation-manager readiness/blend parity, the delegated physiology
routine or full swim-task equivalence. The following
[persistence change](TRAINING_STAT_PERSISTENCE.md) saves earned stamina/lung
values; complete native stat/save coverage remains separate work.
