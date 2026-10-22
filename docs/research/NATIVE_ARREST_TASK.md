# Captured arrest-task choices and reach

The existing on-foot police arrest helper now uses the executable's horizontal radius and
separate height limit. TASK_CHAR_ARREST_CHAR itself remains skipped while its complete task
integration is developed; the captures below establish task decisions, not a completed port.

## Reproduction

`scripts/research/native-arrest-task.py` runs the pinned arm64 iOS executable under Unicorn
2.1.4. It verifies SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`, maps its Mach-O
segments and invokes the actual task selectors on synthetic object records. It intercepts
allocations, task constructors/factory requests, fall/weapon/clearance queries and down-time
writes. Unknown native calls fail the run. No executable bytes are published.

```
PYTHONPATH=/path/to/unicorn python3 scripts/research/native-arrest-task.py /path/to/executable
```

The checked-in `tests/fixtures/native-arrest-task.json` contains 44 captures, the executable
hash and function addresses. The functions are initial subtask `10042ABE4`, next subtask
`10042A1E8` and control `10042ADD8`. The command's inspected handler is `1001F0E94` with its
constructor tail at `1001F24D8`; task constructor `10042A0A4` installs vtable `1005BF478`.
Source/reference identities are recorded in [BUILDING_MODEL_SWAPS.md](BUILDING_MODEL_SWAPS.md).

## Initial tasks

A missing target yields no task. An on-foot target starts KillPedOnFoot with arguments
(−1, 0, 0, 0, 1). A bike or quad target starts DragPedFromCar with a 100,000 ms timeout.
An upright ordinary car starts OpenDriverDoor; an overturned/on-side car starts DestroyCar.
A boat starts DestroyCar after selecting an actual firearm when the actor holds a melee weapon:
prefer an owned shotgun (25), otherwise an owned pistol (22), or give a pistol with ten rounds.

The original sites are MUSIC3 at 1016025 (array-selected actor, CJ target) and TRUTH2 at
1346098 (actor local 37, NPC target global byte offset 584, while the NPC is in a vehicle).
A player-only instant-busted adapter would not implement those task requests.

## Reach correction

Control at `10042AF28..10042AF6C` computes float32 XY squared distance and absolute Z
difference separately. A falling suspect qualifies when XY² ≤ 9 and |Z| ≤ 2. The native
point (3, 0, 2) therefore qualifies, even though its full 3D distance exceeds three. An X
input of 3.00000001 rounds to 3 in native float storage and qualifies too; 3.0001 fails.
A height of 2.0001 fails. The next-subtask path uses the same horizontal/height limits.

The pinned PC ControlSubTask body follows a retail-call return and uses a full 3D radius;
that candidate is not evidence for the observed executable's reach. `copCanArrest` now follows
the captured float32 test in both renderer Y-up and native Z-up frames. Eleven captured
eligibility cases compare against real SetDownTime(100000) calls, including rejection and
float boundaries. The down-time call occurs before the current task's abort check: a task
that refuses to abort can still receive the down-time update while retaining its current task.

## Other captured transitions and limits

The control method finishes for dead/missing targets, retains combat when the target is
getting up, seeks a falling target out of reach, and seeks a target another officer is already
arresting. The arresting task itself is retained. Vehicle-door clearance can switch sides;
a target entering a car or bike switches the current task accordingly. Successful driver or
passenger door next-subtask cases select ArrestPed; a failed driver-door case resumes combat.

Captures describe isolated method inputs. For example, the next method alone can select an
arrest task for a zero-health input, while the control method finishes that target first.
This does not establish that the isolated next-method input occurs during normal gameplay.
Task constructors/factory internals, vehicle forces, animation/ped-state changes, player-specific
speech/pursuit queries and the complete native scheduler are outside the probe. The full
script command, vehicle-door choreography and NPC arrested-state integration remain unfinished.

## Validation

All 3,556 unit tests pass (51 skipped), and the build passes. Both browser regressions
pass: a one-star cop knocks unarmed CJ down with a nightstick, busts him and completes
the restart/cleanup, and a cop pulls CJ from a bike and arrests him while falling. They
report no page errors. These regressions validate the existing arrest integration after
the reach correction; they do not complete the skipped scripted-arrest command. Census
classifications and historical mission outcomes are unchanged.
