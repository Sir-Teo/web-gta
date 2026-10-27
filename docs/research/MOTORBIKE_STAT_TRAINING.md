# Captured motorbike training and saved riding skill

Motorbike skill now uses the captured native counter and integer-stat award
path. Raw skill 229 is shared by scripts, CPed::GetBikeRidingSkill and the
browser save. The previous browser counter used fractional host milliseconds
and did not preserve the earned skill across reloads.

## Source and capture

Pinned gta-reversed `4281f82d8af83e14935ac84a69dfd1ceebb9f256`
implements UpdateStatsWhenOnMotorBike (PC `0x55CD60`) with native speed,
contact and old-counter thresholds. The harness independently executes the
complete selected iOS routine `0x100265f94..0x100266120`, including raw
integer-stat mutation. Only CheckForStatsMessage and
DisplayScriptStatUpdateMessage are logged stubs. Velocity, suspension
contact-point count, AR_STATS.DAT configuration, counter and raw skill are
declared inputs. The fixture records the packaged configuration hash.

The pinned executable is 14,226,544 bytes, SHA256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
All **247 fixed profiles match exactly**, covering threshold boundaries,
three-dimensional speed, all contact counts 0–4, variable time steps,
unsigned counter saturation/precision, raw signed skill arithmetic, gains
and feedback gates.

## Counter and ownership

The old unsigned counter is converted to float32 and compared strictly above
float32(AR 40 × 1,000), normally 180,000. Above the threshold it resets and
positive AR 7 awards 25 skill. Native signed gain conversion/addition,
float32 conversion, the 1,000 cap and conversion back determine raw skill.
Feedback requires updates enabled, gain greater than 1 and resulting skill
below 1,000.

Otherwise native float32 three-dimensional speed above float32(0.6), or
fewer than three suspension contact points above float32(0.1), weighs time
by 1.5. Speed above float32(0.2) weighs time by 0.5. All other frames preserve
the counter. Milliseconds first truncate from the native float32 time step;
the weighted value is then added to the float32 old counter and saturating
conversion determines the next unsigned integer. This is not cycling's
ceil-and-wrap arithmetic. At 30 Hz fast riding adds **49**, rather than the
old browser calculation's 50; ordinary steady riding adds 16.

The caller follows the [captured vehicle ownership block](VEHICLE_STAT_DISPATCH.md):
quad automobiles do not train motorbike skill, and exact zero native squared
speed skips the call. Ten motorbike dispatch captures independently verify
that gate for signed/directional motion and float32-underflow inputs. Two browser wheel supports stand in for four native
suspension lines, so one supported physical wheel contributes two contact
points. Individual one-line contacts/native suspension geometry remain open.

The separate simplified NativeStatReactions motorbike path is removed. The
host supplies raw saved skill before GetStatValue's float32 conversion and
writes the captured result through stat 229. The saved binding is installed
after MAIN setup, alongside driving, cycling and body ownership. Old saves
and New Game start at native zero; signed integer saves retain their raw
values. Binding neither trains nor heals. Native training counters remain
session state in this browser-save subset.

The 574 focused native-counter, stat, cycling, save and progression checks
and TypeScript validation pass. Complete original-PC execution, full
CPlayerInfo scheduling/task ownership and whole-vehicle physics equivalence
remain open; independent selected-routine captures do not establish them.

```sh
PYTHONPATH=artifacts/reversing-deps python scripts/research/emulate-motorbike-training.py \
  --binary artifacts/gta3sa-ios-reference --output artifacts/motorbike-training-regenerated.json
cmp tests/fixtures/motorbike-training-reference.json artifacts/motorbike-training-regenerated.json
```

An attempted live exact-zero setup used FREEZE_CAR_POSITION's host flag, but
Rapier retained vertical velocity around -0.0000572 m/s in that kinematic
context. It was unsuitable as an exact-zero input. Zero dispatch is therefore
verified against the selected native routing block, while the live check
covers actual riding, awards and saved skill restoration. No freeze or
knock-off behavior is changed here.

## Live and complete validation

The final two riding checks pass (1.1 minutes): a model-471 quad makes no
motorbike calls/gains, while a real PCJ-600 ride awards skill 0→25 through the
ordinary caller with only the threshold counter seeded. Pagehide/reload and
MAIN preserve the earned 25, and CPed's host riding-skill provider restores
to 0.025. The existing cycling award/body/save regression also passes under
the new ownership. No page errors occur in these passing cases.

All **21 live motorbike inputs** independently replay through the selected
native routine with **21 exact matches** for counter, raw skill, check count
and ordered feedback arguments. Evidence:
`artifacts/motorbike-training-browser-final.log`,
`artifacts/motorbike-training-dispatch-461.json`,
`artifacts/motorbike-training-live-native.json` and
`artifacts/motorbike-training-live-verification.json`.

The complete unit suite passes **9,976 tests / 51 skipped** across 871 passing
files (162.71 seconds), recorded in `artifacts/motorbike-training-full-unit.log`.
Both native training and expanded dispatch fixtures regenerate byte-identically.
The TypeScript/production build and built-game smoke pass, with save resume,
walking, car entry/driving, map, pause, takeoff and gear checks and no page
errors or failed requests. Evidence: `artifacts/motorbike-training-build.log`
and `artifacts/motorbike-training-production.log`.
