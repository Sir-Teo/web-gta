# Saved stamina and lung-capacity gains

Natural swimming gains and script stat changes previously lived only in the
current ScmStats instance. Reloading restored the browser's existing money,
weapons and driving practice but discarded earned stamina and lung capacity.
The browser save now includes those two values and binds them back to the
actual script stat store when MAIN initializes.

## Source and scope

In pinned gta-reversed revision
`4281f82d8af83e14935ac84a69dfd1ceebb9f256`, CStats::Save
(`0x5D3B40`) writes StatTypesFloat and StatTypesInt, and CStats::Load
(`0x5D3BF0`) reads them back. Stamina (22) is a float stat; lung capacity
(225) is an integer stat. The swimming and underwater training counters are
separate statics and are absent from this save list. Earned stat values
persist, while a fresh load starts fresh training counters.

This change implements that ownership for the browser's existing JSON-save
subset. It does not reproduce the native binary save layout or claim to save
all of CStats or the complete mission runtime.

## Behavior

The optional version-1 trainingStats object stores stamina and lungCapacity.
Older saves retain the native initial values, stamina 100 and lungs 0.
Each incoming field is validated independently: stamina must be a finite
float32-representable number and is rounded to float32; lungs must be a signed
32-bit integer. Valid script-set negative and above-1,000 values are retained
because CStats::SetStatValue does not apply the natural-increment cap.
Malformed fields retain their individual defaults without discarding the
other valid field or unrelated progress.

SET/INCREMENT_STAT, natural training, the save and the breath-capacity
provider share the same bound values. Binding does not award gains, emit
notifications or refill current breath. During the one-time MAIN/player
initialization, reset breath then uses the restored stat-derived capacity.
Later stat gains continue to preserve current breath. Saving before the
script store has initialized retains the loaded training object.

The existing bounded-save limit, revision conflict handling, failed-write
behavior, unchanged-write suppression and New Game flow continue to apply.

## Checks

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
