# Bike drive-by weapon state, ammo and retry timing

Player bike, bicycle and quad drive-by fire now uses a native weapon-state owner
while an eligible SMG is selected. Owner-null weapon update runs on the game's
absolute unsigned millisecond clock. The selected pose gate still runs before
shot attempts. Attempts require strict `now > nextShot`; the controller writes
`now + 70` after every attempted FireFromCar, including a rejected attempt.

A shot empties its clip without immediately refilling. Native update reloads it
after the retry deadline; equality keeps it waiting. Releasing the trigger
refills the clip from total ammo using standard-skill weapon info. Infinite ammo
keeps clip/total unchanged. Total ammo is also preserved at 25,000 or above, and
for a player vehicle at full completion, while its clip still empties. The three
SMGs keep their data-defined standard magazine sizes (Uzi/Tec-9 50, MP5 30).

## Independent executable evidence

Reference: pinned 14,226,544-byte iOS binary, SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.

- `emulate-driveby-weapon-state.py`: actual `FireFromCar` (`0x100497908`)
  and owner-null `CWeapon::Update` (`0x10049adf8`). **496 fixed cases** cover
  states, clip/total boundaries, timestamp equality/wrap, infinite ammo,
  completion, entity-status bytes, empty clip reload and absent driver/audio.
- `emulate-bike-driveby-weapon.py`: actual `DoDriveByShootings`
  (`0x10049b674`), owner-null update, FireFromCar, association lookup/blend and
  scalar clump update. **393 fixed cases** include both playing/finished poses,
  ready/reloading/out-of-ammo states, clip refill on release and timestamp
  retries, with motorbike/quad/bicycle button modes. The fixed capture includes
  86 attempts and 72 successful FireFromCar calls.

Instant-hit effects, audio, player/pad lookup, percentage completion, weapon info,
reload duration, ride-data return and asset/clump construction are declared
external services. Selected weapon-state, ammo, readiness and timestamp
arithmetic executes in the original binary. Scripts accept `--binary`,
`--output` and optional observed `--profiles`; fixed captured outputs live under
`tests/fixtures`.

The selected iOS wrapper accepts states 0 and 1 and ignores the instant-hit
return value. The reversed PC FireFromCar source instead requires READY and has
a return-value branch. The integrated player controller updates the weapon and
checks its timestamp first. This capture does not establish complete original
PC 1.0 equivalence or NPC/task caller equivalence.

## Host integration limits

The native state owner applies only to the player's eligible bike SMG path.
Entering from an existing handheld timer converts its remaining time to an
absolute timestamp; this is an adapter boundary. Leaving returns the remaining
cooldown/reload to existing inventory timing. Public ammo/timer changes invalidate
the cached state, and selecting another weapon cannot reuse the old slot's ammo.
The host retains its on-foot and car/boat weapon systems.

Rendering, bullet impacts, task scheduling and the shared CRT RNG remain the
boundaries described by the muzzle/pose research. Owner-null update produces no
handheld reload audio while the native bike owner runs. The host's reload display
uses a positive sentinel at exact timestamp equality while native state remains
RELOADING; no round refills until the next strictly later update.

## Validation

All **889 fixed native checks** and **935 focused integration/regression checks**
pass. Inventory checks include exact retry equality, empty-clip reload, release,
full-completion/large-ammo preservation, returning to ordinary fire, script ammo
changes, weapon switching and standard vs skilled magazines. TypeScript passes.
The real-key PCJ/BMX/quad browser run passes and records **1,113 native-matched
weapon decisions**: 633 owner-null updates and 480 fire/release controller phases.
The one-round clip empties, waits through the retry gate and reloads; all state,
clip, total and next-shot outputs match exactly. Evidence:
`artifacts/driveby-weapon-live-verification.json`, the corresponding
`driveby-weapon-{update,control}-live-native.json` files and
`artifacts/driveby-weapon-browser.log`.

All **49 live shot seeds and final ray endpoints** still match native output
exactly, including nine automatic targets
(`artifacts/driveby-weapon-rays-live-verification.json`). All fourteen pose groups
pass the separate browser regression.

An existing Molotov browser test failed on both the changed tree and unchanged
checkpoint 82cba524: it expected >10 health loss within five wall seconds. The
native multiplier remains 0.33. The test now waits two simulated seconds, retains
the same health threshold and bounds ignition within one simulated second. The
unchanged checkpoint passes; its two-second burn took 8.524 wall seconds. Saved
baseline evidence is under `artifacts/driveby-weapon-baseline-native-fire-*`.

The repaired Molotov check also passes on the changed tree, as does the full
arsenal/equip/M4 fire/reload/pause browser check
(`artifacts/driveby-weapon-onfoot-browser.log`). TypeScript passes after the
reload-audio guard. Full units: **16,977 passed / 51 skipped**, across 890
passing files (179.36 seconds), in `artifacts/driveby-weapon-full-unit.log`.
The final TypeScript/production build passes (`artifacts/driveby-weapon-build.log`).
Built-game smoke passes saved-game resume, walking, car entry/driving, map
waypoint, pause/resume, aircraft takeoff and landing gear with no page errors
or failed requests (`artifacts/driveby-weapon-production.log`).
