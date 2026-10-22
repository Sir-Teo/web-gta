# Scripted player jetpack task

`TASK_JETPACK` (07A7) now gives CJ the existing jetpack controller through the scripted-task path, with task
status and sequence recording. The original sites are MAF4 (mission 81, SCM 2029496) and DES10 (mission 82,
SCM 2035634); both read the player handle from global 12. Full Black Project and Green Goo completion is
unverified.

## Native evidence

The pinned, hash-verified iOS executable is identified in [AIRCRAFT_WEAPONS.md](AIRCRAFT_WEAPONS.md#source-observations).
Handler `0x1001f82c4` collects one ped handle, allocates a 0x90-byte task, and calls CTaskSimpleJetPack's
constructor (`0x10041ad54`) with no target position, cruise height 10, hover time 0 and no target entity. It
then calls GivePedScriptedTask (`0x1001ce2ec`) with command 07A7. It supports normal sequence recording rather
than being an instantaneous cheat call.

The reversed CTaskSimpleJetPack::MakeAbortable (PC 67E6E0) refuses events below priority 63, with its separate
damage/fire branches. CEventScriptCommand::GetEventPriority (4B0B20) gives ordinary script commands 53; direct
looped named animations, die, swim and phone tasks have 71. A complex sequence still has 53. An abort without
an event ends the task and its effects, rather than generating a dropped pickup.

## Integration and limits

The command records a jetpack task through the ordinary sequence/task dispatcher. The player task keeps the
pad free while the existing Simulation controller handles input, thrust, drawing, weapon switching and flames.
The task stays associated until the pack finishes; a sequence then advances. Explicit task clearing aborts the
pack. Ordinary script-task replacement is refused while it runs, and the rejected task does not overwrite the
existing script-task record; an accepted higher-priority replacement removes it without a pickup. Clearing
player tasks also reaches a pack already worn from a cheat or pickup.

The command remains **authored** in the census: NPC jetpack tasks are explicitly unsupported, and the existing
player controller, model readiness, attachment, physical integration and event handling keep their documented
coverage limits. This change does not add a general native event/task manager or NPC jetpack simulation.

Flight validation also exposed missing independent thrust buttons. CPad::GetAccelerate (5403F0) reads Cross
and GetBrake (540080) reads Square in modes 0–2. The default PC bindings in ControllerConfigManager map Space
to Cross (PED_SPRINT) and Left Shift to Square (PED_JUMPING). The jetpack now receives these as separate
held ascent/brake inputs, gated by player-control state, while W/S retain their walk/tilt axes. Previously
S was incorrectly treated as braking and there was no way to apply full upward thrust with a neutral tilt.

## Checks

Unit checks execute both original mission instructions, record the command into a sequence, keep NPC orders
unsupported, preserve a task record after a rejected replacement, and exercise pad freedom, sequence progress,
priority rejection/acceptance and explicit clearing. The browser check runs both original instructions, flies
CJ upward on Space while the task reports associated, clears the first pack, rejects an ordinary replacement
of the second, and accepts a looped animation replacement without a dropped pickup. The existing cheat flight,
braking, dropping and pickup regression covers the shared flight path separately.

Loading the replacement animation exposed a separate hierarchy bug: the animation binder traversed the
attached jetpack's model and rejected its repeated native frame indices. Model roots now carry an instance
boundary, and binding excludes nested models from frame lookup and skinned-bound updates. Peer instances in
a wrapper still fail the duplicate-frame validation. A dedicated binding regression checks attached-frame and
bound isolation; the live looped-animation replacement covers the original failure.
