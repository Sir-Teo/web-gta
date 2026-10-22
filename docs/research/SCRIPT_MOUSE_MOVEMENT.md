# Mouse input for original scripts

GET_PC_MOUSE_MOVEMENT now receives browser input instead of a permanently zero state.
This supplies POOL2's cue pull-back/strike input while its script controls the player and camera.

The pinned PC source (see [POOL_BALLS.md](POOL_BALLS.md)) implements the command in
PadCommands.cpp by returning CPad::NewMouseControllerState.m_AmountMoved. CPad::UpdateMouse
(53F3C0) fills that state from device deltas, applies configured inversion outside the
frontend and replaces it each frame. The handler's source carries an ASM-check TODO;
this change follows that source contract without claiming a new executable capture of
the PC input backend.

Input accumulates script mouse deltas separately from camera look. Motion over the game
canvas, a captured pointer or an active game drag reaches this channel even when ordinary
player controls are disabled. Motion over menus/outside the game does not. The main frame
samples before Renderer consumes camera look, writes float32 pad mouse values and applies
the existing vertical-inversion setting. Sampling continues on held frames that skip drawing;
paused-frame motion is discarded and the first frontend-return frame writes zero. Blur clears
pending motion. Camera input remains available to its own consumer.

Touch/pad look supplies the script's view control when that axis has no physical mouse delta.
That is an authored browser mapping; CSS movement units, mixed-device arbitration, gyro-only
input and native device/DPI calibration are not reproduced as a PC input backend.

The same investigation found that the frozen-player input branch also skipped stepping
PlayerScriptTasks. A physical freeze now lets those animation/task sequences advance while
Simulation continues holding CJ's physical motion. POOL2 can finish its cue-start clip and
reach the shot association it checks before reading mouse movement.

Three input checks cover independent delta accumulation/draining, retained camera input,
touch/pad fallback, ignored outside/menu movement and blur cleanup. Existing pad checks pass.
Non-Node window event targets are ignored safely by the canvas-membership check.

The permanent browser enters the real bar, launches POOL2 with F, commits its wager and
uses Shift to proceed through aiming and the cue-start animation. It positions the pointer
on the wager screen: moving it into place during aiming would itself rotate the cue. The
test verifies the script's initial cue direction points at its selected ball before proceeding.
Only real mouse movement pulls the cue back and strikes forward; no task/shot outcomes or
ball positions are injected. The script-visible and Rapier velocities agree, several balls
move, the script hands off the turn and the NPC makes its responding shot. One captured run
observed nine balls moving and 1.39 units of numbered-ball travel. The table, opponent,
interior and committed $450 balance are retained, with no script/page errors. The two-player
toggle remains skipped. A separate normal-entry regression covers back/quit cleanup.

This flow also depends on the [segment-intersection fix](SCRIPT_LINE_INTERSECTION.md).
The later [complete-match regression](POOL_MATCH.md) verifies result accounting,
the rematch wager/refund and quit. Multiplayer remains unimplemented.

All 3,671 unit tests pass (51 skipped), and the build passes. Three pool browser regressions
pass together: normal entry/back/quit, player stroke/NPC response and original pocket scoring.
The static census and historical mission sweep outcomes are unchanged.
