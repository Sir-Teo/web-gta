# ZERO1: original Air Raid defence and result

The regression launches mission 72 from the original MAIN.SCM. Its own setup
places CJ on Zero's roof, attaches him to the minigun object, selects weapon 38,
protects him and starts the 210,000 ms defence timer. Supported cutscenes are
skipped. The fixture leaves CJ, NPCs, aircraft, antenna health, script locals,
timer and rewards under the original script and simulation.

During defence, controlled aim selects a live RC Baron among the original
handles in locals 35–42, within 100 units. `g.fireAt` uses CJ's real minigun,
ammo, cooldown, muzzle ray and damage pipeline. Aircraft record player-attributed
weapon 38 damage and wreck through the existing aircraft implementation.
The fixture does not move or heal CJ, move or damage targets directly, freeze
vehicles, edit mission counters or shorten the defence timer.

The first complete defence preserved antenna health at 100 but exposed the
unsupported player TASK_SHOOT_AT_COORD at SCM 1871902. Baseline trace:
`artifacts/zero1-combat-before-player-fire.json`. The thread gave up there with
`A_PLAYER_TASK_THE_BROWSER_DOES_NOT_RUN: gunAt`; no reward was granted.
[Player shooting support](PLAYER_SHOOT_TASK.md) addresses that actual blocker.
The next run fired the original celebration without fixture requests, then
stopped at the player partner-chat sequence (SCM 1873065). Its trace is
`artifacts/zero1-combat-before-player-chat.json`.
[PartnerChat support](PARTNER_CHAT_TASK.md) addresses the second blocker.

The permanent `tests/browser/zero1-combat.spec.ts` stops all fixture fire requests
when the native timer expires. Subsequent ammunition use must come from the
original three-second celebration task. It requires original registration
`ZERO_1`, $3,000 added to cash, restored player control, unfrozen CJ, restored
collision and empty skipped-command/give-up/page-error lists.

This is controlled aim integration coverage. It does not establish a manual
minigun play-through, original bomb/drop accuracy, complete aircraft steering,
NPC scheduling or native animation/task timing. Source census classification
alone does not establish mission completion.

## Passing result

The corrected regression passes together with the reciprocal-chat browser test.
The trace contains 1,768 samples, signal health stays at 100, and 89 controlled
minigun requests fire during defence. Once the original timer reaches zero,
fixture requests stop; ammunition falls from 99,910 to 99,901 through the
original celebration task. The result registers `ZERO_1`, raises cash from zero
to $3,000 and restores controls, collision and an unfrozen player. Skipped
commands, give-ups and page errors are empty.

Trace: `artifacts/zero1-combat.json`. Inspected screenshots
`artifacts/zero1-combat-passed.png` and `artifacts/zero1-combat-result.png` show
CJ back outside Zero's shop with $3,000. The original script requests its big
M_PASS message for only 100 ms; these screenshots do not capture that brief
title. The result assertions use the original registered key and actual cash.

All 4,956 unit tests pass (51 skipped), the build passes, and the native source
census retains its classifications. Historical mission sweep bytes are
preserved; this controlled result is separate evidence.
