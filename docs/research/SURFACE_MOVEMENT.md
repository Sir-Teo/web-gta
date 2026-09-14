# Native surface movement restrictions

Imported content folders now pass `surfinfo.dat` to the game with the other
local environment files. The existing bounded reader decodes all 179 records
in the acquired dataset. `readSurfaceSprintRestrictions` uses native surface
name-to-ID lookup, signed-integer-to-bool conversion and last-record precedence.
Unknown names map to DEFAULT, matching the existing source name lookup.

The pinned [LoadSurfaceInfos](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/SurfaceInfos_c.cpp)
assigns `bCantSprintOn = (bool)si.Sprint`; `CantSprintOn` returns that field.
[TaskSimplePlayerOnFoot.cpp](https://github.com/gta-reversed/gta-reversed/blob/0076f9017b4aeef7433957ac2bd8b6988e9df166/source/game_sa/Tasks/TaskTypes/TaskSimplePlayerOnFoot.cpp)
checks the contact surface and sets `PEDMOVE_RUN` when sprint is pressed on a
restricted surface, instead of selecting `PEDMOVE_SPRINT`.

Before each imported on-foot simulation step, the browser queries the native
support surface under grounded feet. A restricted material clears the sprint
request before both NativeCharacter gait selection and Simulation movement.
Walking input and other controls retain their current behavior. Vehicles and
entry/exit transitions do not use this pedestrian restriction. The diagnostic
state records loaded definition count and whether the current surface blocks
sprinting. Missing files or unresolved support contacts preserve existing input
behavior; invalid file loads are reported through environment warnings.

The material query is the existing bounded support ray used for ground lighting.
It is not the original CPed contact solver, and this change does not reproduce
all original restrictions involving held entities, weapons, stamina or airborne
contact retention. Steep-slope rules, stair handling, soft-land behavior and
native adhesion integration remain unfinished. Running and sprinting still use
their existing authored speeds unless native animation motion is installed.

Validation uses two imported collision-floor browser fixtures with the same
held Shift/W input and opposite source flags. Restricted contact reaches running
speed (below 4 world units/second) and retains full stamina; unrestricted contact
reaches sprint speed (above 6.5) and consumes stamina. The Santa Maria browser
case confirms automatic transfer of all 179 real definitions and grounded
walking; the normal-CJ locomotion regression also passes. Unit coverage checks
signed bool conversion, duplicate precedence, unknown-name fallback, optional
file validation and folder selection. All 683 tests / 144 files pass, four
browser cases pass, and production build/smoke verification passes. The optional
fat-player browser case was skipped without its separate reference directory.
Logs: `/tmp/web-gta-surface-sprint-{unit,browser,production}.log`.
