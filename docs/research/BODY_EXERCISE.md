# Native exercise counters and body-stat changes

Running, sprinting and moving/underwater swimming now invoke the captured
CStats body-exercise routine before their stamina/lung awards. Exercise
changes current fat, muscle and maximum-health stat values through the same
store used by scripts and saved body values. Idle periods retain partial
counter work.

## Evidence and boundary

Pinned gta-reversed revision `4281f82d8af83e14935ac84a69dfd1ceebb9f256`
leaves CStats::UpdateFatAndMuscleStats (`0x55C470`) as a PC retail delegate.
The reversed sprinting/running callers invoke it before their own awards;
the [selected swimming capture](SWIMMING_STAT_TRAINING.md) supplies its
surface/underwater exercise rates.

The independent harness executes the complete selected routine at
`0x100265280..0x100265518`, including counter arithmetic, direct float-stat
writes, caps, message state and feedback conditions. Its binary SHA-256 is
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
The packaged AR_STATS.DAT supplies declared runtime inputs and its SHA-256
is recorded in the fixture. CheckForStatsMessage (`0x100260300`) and
DisplayScriptStatUpdateMessage (`0x1002b0620`) are explicit logged stubs.
The harness captures feedback attempts; it does not execute their native
stat-condition/player/HUD side effects or establish original-PC equivalence.

The 141 cases cover threshold equality and the following call, both sides
of zero fat, lower/upper stat bounds, negative/above-cap script values,
message states 0–3, hidden updates, fractional/non-positive tuning, unsigned
counter/product wrap, frame timesteps and the actual live caller profiles.
All captured stat/counter/state values, condition-check counts and feedback
arguments match exactly. The fixture regenerates byte-identically:

```sh
PYTHONPATH=artifacts/reversing-deps python scripts/research/emulate-body-exercise.py \
  --binary artifacts/gta3sa-ios-reference --output artifacts/body-exercise-reference-regenerated.json
cmp tests/fixtures/body-exercise-reference.json artifacts/body-exercise-reference-regenerated.json
```

## Native behavior

The routine first compares the old unsigned fat counter, converted to
float32, against AR 42 × 1,000. The comparison is strictly greater than;
equality adds this frame's contribution and waits for another call.
Native milliseconds truncate float32(timeStep / 50 × 1,000). The contribution
is floor(unsigned32(milliseconds × exerciseRate) / 10), and counter addition
also wraps to unsigned32. The default threshold is 150,000 weighted ms.
Running uses rate 5, sprinting/surface swimming 10, and crawl/underwater
swimming 15. Integer truncation matters at the fixed game-frame timestep.

At the threshold the counter resets. Positive pre-update fat loses AR 23
(15), floored at zero, and muscle gains AR 9 (10), capped at 1,000.
Non-positive fat instead loses AR 24 muscle (15), floored at zero. A call
that exhausts the remaining fat still follows the positive-fat gain branch.
Positive-fat feedback alternates fat loss and muscle gain; the no-fat branch
selects muscle loss. Hidden feedback does not freeze that state change.

An independent counter adds unweighted native milliseconds. Above AR 45 ×
1,000 (600,000), stat 24 gains AR 11 (20), capped at 1,000, and the counter
resets. This is the raw maximum-health stat (initially 569), not a claim that
the player health cap increases by 20. Player-cap propagation and native
stat-condition-check side effects remain separate work. Raw stat 24 now also
uses the [saved training-stat binding](TRAINING_STAT_PERSISTENCE.md).

## Integration and checks

The body routine applies direct stat writes through the authoritative
ScmStats store, including its saved fat/muscle bindings. It runs before the
caller awards stamina/lungs. Three new ordering checks exposed the missing
callback and verify the distinction: when energy is negative, a subsequent
stamina gain may burn fat too. A fourth check verifies bound ownership,
retained counter work, message alternation and hidden feedback. All 261
focused body/caller/save/swimming checks pass.

The live check holds actual W, then W+Shift, then teleports through the
ordinary world adapter into underwater state 4. Only threshold counters are
seeded; ordinary game tasks execute the awards. The run call at rate 5
changes 200/50/569 to 185/60/589, sprint rate 10 changes body to 170/70,
and no-fat underwater rate 15 changes muscle 70 to 55. Every seeded call
matches a complete independent native profile, including counter resets,
message state, condition-check count and feedback arguments. Idle calls
pause. The existing surface/underwater swimming-training regression also
passes. Both browser checks have no page errors; terrain streaming reported
a retry/support warning during the distant water transfer. Evidence is
`artifacts/body-exercise.json` and `artifacts/body-exercise-browser.log`.

The existing hour-based hunger routine is separate and unchanged. Cycling,
fighting, other native exercise callers, full task scheduling, native HUD
side effects, player maximum-health integration and complete original-PC
matching remain separate work. Fresh browser worlds start fresh exercise counters;
earned fat/muscle/raw maximum-health values use
the existing save binding.

All 8,720 unit tests pass (51 skipped).
TypeScript validation and the production build pass.
Production smoke also passes save resume, walking, car entry, map waypoint,
pause/resume, aircraft takeoff and landing gear with no page errors or failed requests.
