# Saved stamina, lungs and body stats

Natural swimming gains and script stat changes previously lived only in the
current ScmStats instance. Reloading restored the browser's existing money,
weapons and driving practice but discarded earned stamina and lung capacity.
The browser save now includes stamina, lung capacity, fat and muscle and
binds them back to the actual script stat store when MAIN initializes.

## Source and scope

In pinned gta-reversed revision
`4281f82d8af83e14935ac84a69dfd1ceebb9f256`, CStats::Save
(`0x5D3B40`) writes StatTypesFloat and StatTypesInt, and CStats::Load
(`0x5D3BF0`) reads them back. Fat (21), stamina (22) and muscle (23) are float stats; lung capacity
(225) is an integer stat. The swimming and underwater training counters are
separate statics and are absent from this save list. Earned stat values
persist, while a fresh load starts fresh training counters.

This change implements that ownership for the browser's existing JSON-save
subset. It does not reproduce the native binary save layout or claim to save
all of CStats or the complete mission runtime.

## Behavior

The optional version-1 trainingStats object stores stamina, lungCapacity,
fat and muscle. Older saves retain stamina 100 and lungs 0. Missing body
fields adopt current startup values after MAIN finishes its setup.
CStats::Init zeroes fat/muscle; the supplied MAIN then sets 200/50.
Each incoming field is validated independently:
the float stats must be finite float32-representable numbers and are rounded
to float32; lungs must be a signed
32-bit integer. Valid script-set negative and above-1,000 values are retained
because CStats::SetStatValue does not apply the natural-increment cap.
Malformed fields retain their individual defaults without discarding the
other valid field or unrelated progress.

SET/INCREMENT_STAT, natural training, the save and the breath-capacity
and body-movement providers share the same bound values. Binding does not award gains, emit
notifications or refill current breath. During the one-time MAIN/player
initialization, reset breath then uses the restored stat-derived capacity.
Later stat gains continue to preserve current breath. Saving before the
script store has initialized retains the loaded training object.

The existing bounded-save limit, revision conflict handling, failed-write
behavior, unchanged-write suppression and New Game flow continue to apply.

## Initial stamina/lung checkpoint

Thirteen new checks cover actual native swimming awards across a save/new
stat store, float/int precision, negative and above-cap script values,
old-save defaults, fresh New Game, independently malformed fields and saving
before script binding. Ten expose the missing persistence before repair.
All 199 focused checks pass, including existing save/conflict/loadout tests,
the native swimming fixtures and captured lung-capacity cases.

The live browser increments the actual script stats, then reloads the page.
The normal pagehide handler saves stamina 150 and lung capacity 50. A fresh
world/script instance restores both, initializes full breath at capacity
1,300, updates the HUD's accessible maximum and hides the full bar on land.
No synthetic save or debug-save callback is used. The ordinary swimming
training regression also passes with the saved stat binding, without page
errors.
All 7,267 unit tests pass (51 skipped).
Final TypeScript validation and the production build pass too.
Normal production smoke returns from an older version-1 save without the new
fields and passes movement, car entry, map/waypoint, pause/resume, takeoff and
landing gear, with no page errors, failed requests or development hook.

## Fat and muscle extension

Fat and muscle previously remained in the current stat store even after
their effect on [landing](PLAYER_LANDING_PLAYBACK.md) and
[jump launch/force](PLAYER_JUMP_BODY_STATS.md) became native-derived. Their
values now share the existing save binding, so later script changes,
increments/decrements and reload consumers use the same stored floats.
CStats::Init zeroes both fields before world setup. The existing body rebuild
reads restored stats through its ordinary initialization path.

Fifteen new checks cover body float round trips, negative/above-cap script
values, actual increments/decrements, independently malformed fields,
older saves, New Game and saving before stat binding. Ten expose lost body
values before repair, and two further checks expose early binding across
MAIN's default-setting pass. No notifications are emitted during binding and
current breath/sprint energy are retained. All 518 focused save/stat and
captured movement checks pass.

The host binds stamina/lungs before their capacity reset, but defers body
binding until the same INTRO-start boundary already used to return to a saved
world (or a stopped setup script). Saved body fields retain ownership while
INITIAL writes to its temporary stat store. Fields missing from a save adopt
the script's completed defaults. Early saves serialize only established body
fields; they do not turn uninitialized zeros into a saved body profile.
Partially valid saves retain each valid field and adopt only the missing
counterpart. This is a browser replay/restore adapter; a native save loads
its stat arrays rather than replaying this new-game world setup.

The live browser starts with MAIN's 200/50 body defaults, increments actual
stats to stamina 150, lungs 50 and fat/muscle 500/500, then uses ordinary
pagehide/reload. All four saved values restore. Breath initializes to 1,300,
the HUD maximum updates, and the normal body rebuild completes. A real
Space-key jump after reload uses the captured body modifier
0.8776316046714783. No synthetic save or debug-save callback is used, and
there are no page errors. Evidence is `artifacts/training-stats-save.json`
and `artifacts/body-stats-save-browser-final.log`.

All 8,575 unit tests pass (51 skipped). TypeScript validation, production
build and production smoke pass. The production check returns from an older
version-1 save and verifies movement, car entry, map/waypoint, pause/resume,
takeoff and landing gear with no page errors or failed requests
(`artifacts/body-stats-save-production.log`).
