# Player position during an occupied-vehicle teleport

ZERO4's original return executes SET_CHAR_COORDINATES on CJ while he remains
in its frozen BMX, then deletes that bicycle before another physics step.
The host moved the vehicle immediately but left `sim.player.position` at the
old arena until the later vehicle update. Deletion used that stale player
position for the exit, so CJ stayed in the arena and fell after its script
changed to area zero. The original result still registered ZERO_4 and paid
$7,000; those result fields alone therefore did not establish a usable return.

The initial full-route trace and black screenshot are preserved as
`artifacts/zero4-route-before-player-teleport.json` and `.png`. The focused
before-fix trace is `artifacts/script-player-vehicle-teleport-before.json`:
vehicle body X is -2244.668945, while both seated and just-exited player X
remain 2499.999756. No physics step intervenes between those observations.

The occupied branch of `teleportPlayer` in main.ts now updates the player's
current and previous position with the moved body immediately. A kinematic
body's next translation is updated too. The command's existing vehicle-base
offset, zero speeds and streaming request remain in use. This makes later
commands in the same script step see the destination, including vehicle
deletion and the scene-window selector.

The reference is CRunningScript::SetCharCoordinates in
`source/game_sa/Scripts/RunningScript.cpp` at revision
4281f82d8af83e14935ac84a69dfd1ceebb9f256, together with the actual ZERO4 return
at SCM offsets 1910762/1910819 and bicycle deletion at 1910883. This is a host
synchronization correction, not a new native-physics capture.

`tests/browser/script-player-vehicle-teleport.spec.ts` recreates the frozen-BMX
teleport and deletion in one browser evaluation. Immediate seated and exited
positions must retain the destination. Its return check also waits for terrain
installation, actual destination ground collision and a grounded player.
Other vehicle families share the occupied branch; this focused case does not
separately establish every family or passenger-seat pose.

All 5,190 unit tests pass (51 skipped) and the build passes after the correction.
The stricter focused browser check passes in 17.5 seconds, with the final player
at native (-2244.668945, 132.188248, 35.344850) on foot and all terrain holds and
pending installations clear. The existing house/street transfer passes in the
same run. No skipped commands, give-ups or page errors occur in the focused
check. Full ZERO4 route/result/return evidence is recorded separately in
[the mission validation](ZERO4_VALIDATION.md).
