# Mission fade ownership and cleanup

The original ZERO4 result registered ZERO_4, awarded $7,000 and restored
controls, but its last fade remained black. The mission deliberately finishes
faded out. CMissionCleanup::Process supplies the fade back in; the host had
omitted that part of cleanup.

The native DO_FADE handler at 0x1001d2600 calls CCamera::Fade, then updates
CTheScripts::bScriptHasFadedOut at 0x10079d221 only when the calling thread uses
mission cleanup. A mission fade-out sets it, a fade-in clears it, and a regular
thread leaves it alone. The pinned reference's CameraCommands.cpp DoCamFade
agrees with this ownership rule.

The cleanup prefix at 0x1001ca0bc..0x1001ca130 consumes the flag. If the player's
state is neither restarting after death nor restarting after arrest, it calls
Fade(0.5, 1) and clears bit 5 (bPlayerSafe) of pad 0's DisablePlayerControls.
The other pad bits are preserved. During either restart the flag is still
cleared, but the restart retains its fade and pad state.

`scripts/research/native-mission-fade-cleanup.py` verifies the executable SHA-256
9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78 and executes
those actual instructions in Unicorn 2.1.4. Sixteen handler cases vary mission
ownership, direction, prior flag and duration. Twenty cleanup cases vary the
flag, five player-state values and pad bits. CollectParameters, CCamera::Fade
and CPad::GetPad are intercepted; native branches, flag reads/writes and pad
masking execute. The remaining cleanup body and camera internals are outside
this capture. Fixture: tests/fixtures/native-mission-fade-cleanup.json.

The runtime now tracks scriptHasFadedOut and its current script clock. Cleanup
requests the captured 500 ms fade, clears the pad's player-safe flag and updates
the host control mirror. This does not call MakePlayerSafe or rewrite proof,
damage or unrelated pad flags. ScmThread records ownership using the requested
DO_FADE direction, before any host-specific cutscene override changes rendering.

All 36 capture cases match. A further encoded-script regression uses the real
camera-fade class to reach full black, terminate and clear the overlay through
cleanup. Fifteen of these 37 checks failed before the change. The live browser
regression uses actual SET_PLAYER_CONTROL, DO_FADE, WAIT and TERMINATE_THIS_SCRIPT
bytecode against the shared game camera. The full ZERO4 check also requires
exterior ground, controls, remote-mode hand-back and a cleared fade.

The prior full-route failure, after correcting the occupied-bike teleport but
before this fade fix, is retained in artifacts/zero4-route-before-cleanup-fade.json
and .png. Its reward and grounded return did not hide the black-screen failure.
See [the player teleport correction](PLAYER_VEHICLE_TELEPORT.md) and
[full mission evidence and remaining limits](ZERO4_VALIDATION.md).

All 5,227 unit tests pass (51 skipped), and the build passes. The shared-camera
browser regression passes, and the full original ZERO4 route/result/return
passes with fade zero and finished. Its inspected screenshot shows MISSION
PASSED! $7000 over the visible San Fierro street.
