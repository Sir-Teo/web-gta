# Bike drive-by animation readiness

Player bike shots previously fired as soon as the trigger and inventory cooldown
allowed them. They now wait for the selected left/right/forward shooting
association to stop playing and blend strictly above float32 0.99. Direction
changes and restarting a fading finished pose must pass that gate again.

The ordinary bike/quad and bicycle association owners sample readiness after
`controlBikeDriveBy`, before their single rider/clump update. `WorldBike` exposes
that sampled result for the current simulation step. Main attempts the shot
after the bike controller has run. The per-step flag clears before every step,
so frozen, inactive and departed-player bikes cannot reuse old readiness.

## Native evidence

The existing pinned iOS executable capture executes actual
`CVehicle::DoDriveByShootings` (`0x10049b674`), association lookup, blend and
scalar clump update. The gate at `0x10049b93c..0x10049b964` first rejects the
playing flag and compares blend against the literal at `0x10058cb5c`,
**0.9900000095367432**. The timestamp comparison that follows is strict unsigned
`now > nextShot`. Weapon update/fire and player/pad services remain declared
external calls in this capture.

The reference generator now contains **465 fixed cases**, adding the exact
threshold and next representable values, playing/stopped flags, fading/steady
poses, finished/intermediate times and all directional combinations. The tests
compare the animation decision plus the observed timestamp gate against native
fire-attempt events, as well as all existing association/clump outputs.

An initial 0.95 assumption failed the existing independent reference test and
was corrected after reading the actual literal; the expanded boundary capture
prevents that assumption from passing unnoticed.

## Remaining scope

Inventory cooldowns and reload duration still control repeat shots. This change
implements the animation gate, not native FireFromCar ammo/state transitions or
the controller's 70 ms timestamp overwrite. The final shot uses the existing
sampled hand skeleton and the post-physics host body state; full original-PC task,
render and firing phase equivalence remains open. The separate external hop task
and its cross-fades remain as described in the pose research.

## Validation

All **2,156 live controller frames** across fourteen bikes match independent
native association, filter, clump and readiness outputs exactly. This includes
462 bicycle frames, 762 ready-to-fire frames and 14 NPC-handoff frames. The
all-model browser check also verifies freeze clears readiness while preserving
the held pose. Evidence: `artifacts/bike-readiness-live-native.json`,
`artifacts/bike-readiness-live-verification.json` and
`artifacts/bike-readiness-browser.log`.

Real firing/Q/E keys on PCJ-600, BMX and quad produce **37 shots**, covering all
three directions per model. Every shot passes readiness. Replaying their muzzle
and final automatic aim against native output still gives exact endpoints,
including six accepted targets (`artifacts/bike-readiness-shot-verification.json`).
The browser run recovered from one terrain-request timeout and passed both
specs; no assertions or timeouts were relaxed.

All **1,398 focused tests** pass and TypeScript passes. Full units:
**16,080 passed / 51 skipped**, across 887 passing files (259.33 seconds),
in `artifacts/bike-readiness-full-unit.log`. The workspace connection briefly
dropped after the suite, then recovered with source and evidence intact.
TypeScript and production build pass (`artifacts/bike-readiness-build.log`).
Built-game smoke passes saved-game resume, walking, car entry/driving, waypoint,
pause/resume, aircraft takeoff and landing gear with no page errors or failed
requests (`artifacts/bike-readiness-production.log`).
