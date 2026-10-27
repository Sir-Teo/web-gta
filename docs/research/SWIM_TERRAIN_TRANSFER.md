# Water-supported terrain replacement

A script teleport into deep water previously waited for a floor within 0.4 m
below the player capsule. An ocean window cannot satisfy that standing-player
test. The follower retried and eventually installed through its advisory
fallback, holding gameplay and warning about missing support at a valid swim
position.

The new live regression reproduced this before repair: the ordinary
SET_CHAR_COORDINATES_NO_OFFSET world adapter moved an on-foot CJ to native
(2600, -2600, -4). Swimming had not started yet, and the boundary hold was
active. The installed window added one support override and emitted the
missing-floor warning; the hold lasted 6,551 ms in that run. No page errors
occurred. Evidence is `artifacts/swim-terrain-transfer-before.json` and
`artifacts/swim-terrain-browser-before.log`.

## Acceptance policy

Automatic exterior on-foot replacement now supplies the same native water
query used by the swim task. A finite water level supports either a ped deep
enough to enter swimming through the existing CPed::ProcessBuoyancy-derived
`swimEntry` rule, or an active swimmer whose feet remain under the surface.
The entry path matters because a boundary hold prevents the first swim
simulation frame from running after a teleport.

Both prebuilt-window preflight and final candidate validation apply this
rule. Underwater characters still require an unobstructed standing/crouched
capsule. Dry/shallow/invalid water retains the existing floor test. Vehicle,
aircraft, remote-control and interior transfer policies keep their existing
paths. Candidate-only direct queries retain the same policy as the isolated
reference world, and never step or relocate the live player.

This is a browser streaming-adapter correction. It reuses the existing native
swim-entry condition; it does not claim an original-game terrain transaction
trace or introduce different swimming physics.

## Verification

Seven new unit checks cover pending deep-water entry, active surface swimming,
both query paths, missing/shallow/dry/nonfinite water, underwater obstruction,
invalid coordinates and removed candidate collision. Two fail before repair.
All 51 focused scene/support/swimming checks pass (two existing skips).
TypeScript validation passes.

The new browser regression passes after repair with no support overrides,
terrain warnings or page errors. The on-foot transfer starts outside the swim
task under a boundary hold, installs the ocean window and enters underwater
state 4 at the requested position. The recorded hold is 2,645.8 ms versus
6,551 ms before repair; transfer-to-swimming wall time is 3,484 ms versus
7,399 ms. These are individual runs, not a controlled loading benchmark;
the behavioral assertion is removal of the false support fallback. Evidence
is `artifacts/swim-terrain-transfer.json`.

All four browser checks pass (3.5 minutes): the new underwater transfer,
ordinary underwater/surface training, dry-land script teleport support and
a player falling into an unloaded region. The water-transfer check has no
warnings or page errors. The dry-land and falling checks still exercise their
existing advisory support fallback and log its warnings. All four checks have
no page errors; the falling check reports no follower failures.
The complete unit suite passes all 8,874 tests (51 skipped).
Final TypeScript validation and the production build pass.
Production smoke passes old-save resume, walking, car entry, map waypoint,
pause/resume, aircraft takeoff and landing gear without page errors or failed requests.
