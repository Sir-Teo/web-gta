# Stat-derived player breath capacity

Player breath was initialized and reset to 100. Recovery and the HUD also
treated 100 as full, so lung-capacity and stamina stats could not extend
underwater time. The selected native stat modifier instead returns 1,150
for initial stats and 4,000 when both contributing stats are 1,000.

## Evidence

The pinned gta-reversed revision
`4281f82d8af83e14935ac84a69dfd1ceebb9f256` leaves
CStats::GetFatAndMuscleModifier (PC `0x559AF0`) as a retail delegate. Its
callers identify STAT_MOD_AIR_IN_LUNG as mode 8: CPlayerPed::ResetPlayerBreath
(`0x60A8A0`), HandlePlayerBreath (`0x60A8D0`), ProcessControl (`0x60EA90`)
and CHud::RenderBreathBar. This establishes ownership, not the modifier body.

The selected iOS ResetPlayerBreath at `0x100366508` passes 8 to
`0x100266300`. That function's jump table sends mode 8 to `0x1002667dc`,
which reads integer lung-capacity stat 225 and float stamina stat 22. It
converts the integer to float, adds stamina, divides by 2,000, multiplies by
3,000, and adds 1,000, rounding after each float instruction. It does not
clamp either stat in this mode. The reset caller stores the result and clears
the breath-ownership bit at player-data offset `0x48`, mask `0x80`.

`scripts/research/emulate-lung-capacity.py` executes the actual modifier and
the complete reset caller/callee path with Unicorn 2.1.4. It replaces no
arithmetic or external calls. The binary is pinned to SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
Its 63 cases cover zero, initial, intermediate, maximum, negative and
above-cap stats, fractional stamina and integer-to-float precision. Each
records capacity, reset breath and the preserved/cleared flags. Regeneration
is byte-identical:

```sh
PYTHONPATH=artifacts/reversing-deps python scripts/research/emulate-lung-capacity.py \
  --binary artifacts/gta3sa-ios-reference --output artifacts/lung-capacity-reference-regenerated.json
cmp tests/fixtures/lung-capacity-reference.json artifacts/lung-capacity-reference-regenerated.json
```

## Integration

The pure nativeLungCapacity helper follows those float operations. Simulation
starts with CStats::Init's lung 0/stamina 100 result. Its live capacity
provider reads the actual script stat storage; dry recovery, vehicle breath
handling, the swim task, reset and the HUD all use that provider. A stat
change changes the capacity without refilling or clamping current breath.
The existing source recovery overshoot and previous-frame breath ownership
remain intact. The HUD scales its fill and accessible maximum to current
capacity and hides full breath on land.

The browser drowning-delivery accumulator resets with player breath so a
previous drowning cycle cannot delay a fresh one. That accumulator belongs
to the browser's fixed-step adapter, not an additional native player field.

At an unmodified depletion multiplier of 1, the captured capacities represent
23 seconds initially and 80 seconds at maximum stats. The underwater stroke
association still raises actual depletion as previously implemented.

## Checks and limits

All 63 exact capture checks pass. Seven new integration checks initially fail
on fixed-100 initialization, reset/recovery, changed stats, surface recovery
and early drowning. They pass after wiring current capacity, alongside the
existing swimming and vehicle-breath unit checks (99 focused checks total).
Legacy helper checks that deliberately use capacity 100 now pass it
explicitly, retaining their recovery/overshoot assertions.

The live browser starts with actual SCM stats 0/100 and maximum 1,150. After
four simulated seconds in the underwater task, breath is about 945 and
health remains 100. Setting both stats to 1,000 changes capacity to 4,000
without changing current breath. Returning to land resumes recovery above
2,000 while the actual HUD shows about 50.7%, maximum 4,000. Reset fills
4,000 and the full breath bar hides on land. The fixture records all states
without page errors. Existing dry-land jump and real car, helicopter and
overturned-boat breath checks pass too.
All 7,156 unit tests pass (51 skipped). Final TypeScript validation and the
production build pass too.
Normal production smoke passes saved-game return, movement, car entry,
map/waypoint, pause/resume, takeoff and landing gear without page errors,
failed requests or a development inspection hook.

This change establishes the represented selected-executable modifier and
its host integration. Matched original-PC captures, natural swimming stat
training, complete stat persistence, native animation blending and complete
swim/drowning event behavior remain separate work.
