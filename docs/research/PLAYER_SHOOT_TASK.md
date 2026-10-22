# Scripted shooting on the player

Air Raid's original defence ends with TASK_SHOOT_AT_COORD on CJ for 3,000 ms
at native `(-2237.220, 170.550, 58.450)` (SCM 1871902). The player controller
previously accepted aim tasks but rejected firing tasks, so ZERO1 gave up before
its reward even after the full defence survived with all antennae intact.

PlayerScriptTasks now accepts coordinate and entity shooting orders. It aims
through the existing script aim state and requests actual WeaponSystem shots
from CJ's eye toward the target. The weapon system retains ammo, cooldown,
reload, muzzle obstruction, ray damage and projectile handling. A script can
fire with pad controls disabled or while CJ is attached to a vehicle/object.
Target disappearance, expiry, clearing and replacement release the task.

Gun bursts reuse the existing native-derived burst length and pause helpers
with CPed's default shooting rate of 40. Failed requests do not spend burst
rounds. The weapon system owns actual shot timing. Thrown weapons request one
throw, ignoring the gun duration, and wait for the existing throw animation.

## Evidence and scope

`scripts/research/native-player-shoot-task.py` executes the pinned iOS handler
at `0x1001edf98`. Thirty-two captures vary sequence-recording handle, thrown flag,
duration and coordinates. The capture intercepts parameter collection, weapon
info lookup, allocation, controller constructors and task assignment; it does
not execute either controller's ProcessPed. SHA-256 is
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.

The native gun branch constructs GunControl at `0x1003afb08` with null target
and move target, command FIREBURST (3), burst argument 5 and the raw duration.
The thrown branch constructs ThrowControl at `0x1003b0cfc` without a duration.
Recorded sequences choose GunControl without querying a ped's current weapon.
The capture fixture preserves these distinctions rather than claiming an entire
native task graph has been reproduced.

Focused tests cover constructor evidence, cooldown retries, burst pauses,
moving targets, cancellation, expiry, task replacement and single throws.
Player weapon animation/task blending and native frame timing remain partial;
this implementation reuses the browser's existing weapon execution pipeline.

All 4,799 unit tests pass (51 skipped) at the shooting change, and the build
passes. Live pistol and attached minigun tests confirm real ammo consumption
with controls disabled, GET_SCRIPT_TASK_STATUS reaching 7, aim release and no
further ammunition use. The existing aim-only regression also passes.
Traces: `artifacts/script-player-shoot-false.json` and
`artifacts/script-player-shoot-true.json`.

The next original Air Raid run survived at signal 100, fired its celebration
without fixture fire requests and progressed to the subsequent partner-chat
sequence. Its separate blocker and implementation are documented in
[partner conversations](PARTNER_CHAT_TASK.md).
