# Player bike drive-by poses

The player now uses the loaded left/right/forward drive-by associations on
all fourteen supported motorcycles, bicycles and quads. Previously the game
fired shots while leaving the rider in the ordinary ride/pedal pose; the
bicycle controller's drive-by input was not supplied by the game loop.
The weapon model was also always hidden on bikes.

The native pose requests now share the existing rider association list and
its single scalar clump update. This suppresses ordinary lean availability
and bicycle pedalling while the drive-by association exists, including its
release fade. The right-hand SMG is visible while that pose has positive
blend; the second model of a dual-wield weapon stays hidden. Existing script
weapon visibility controls still apply.

Q/E select left/right; firing without either selects forward. Look-button
memory advances every bike frame rather than only while shooting. The game
passes its current trigger, eligible weapon and pre-shot ammo to the pose
owner. Empty ammo or releasing fire fades the association. A player-owned
shooting pose is cleared before a direct NPC handoff, rather than being
reused on the new ped's clump. Existing explicit scripted rider poses retain
their separate task ownership.

## Independent native capture

The pinned iOS executable is 14,226,544 bytes, SHA256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
`scripts/research/emulate-bike-driveby.py` enters CVehicle::DoDriveByShootings
at `0x10049b674` and runs the actual GetAssociation, BlendAnimation and
scalar clump update at `0x10013ad30`. Bike association slots are 202/203/204,
with their native descriptor flags. Blend requests use 16 and release/empty
ammo writes use -8. The BMX subtype accepts car-gun result exactly 1;
other bike/quad subtypes accept any nonzero result.

All **363 fixed controller/clump cases** compare exactly for scalar
association writes and the following clump frame. Cases vary trigger result,
direction, ammo, bike subtype, existing/fading/finished associations, retained
pedal and lean poses, and player/pad/weapon eligibility. Weapon fire-attempt
and timestamp observations are retained as research evidence.

Declared inputs/external boundaries are player-info/pad/weapon lookups and
updates, the ride-data virtual return, asset descriptor/construction and
decompression, allocation cleanup and pose-frame effects. The frontend
route through CPad look queries is selected; other mobile frontend routes
are outside the capture. Weapon firing and the look-at request are external.

Live profiles optionally execute the ordinary CBike or CBmx rider stage
between drive-by control and clump update. Ordinary skeletal vibration is
skipped at its epilogue; CBmx stops before hands. Neutral contact/pitch/turn
geometry and host-libm powf are the same declared boundaries as the earlier
[rider](BIKE_RIDER_ASSOCIATIONS.md) and [BMX](BMX_RIDER_CONTROLLER.md) captures.

Regenerate with Unicorn and `--binary` / `--output`. `--profiles` accepts rows
containing `nativeInput` and appends composite native results after the 363
fixed cases. Raw pre-step state and loaded durations are recorded by the
all-model browser spec.

## Validation and remaining scope

All **1,736 live composite frames**, including 372 bicycle frames and 14
NPC-handoff frames, match native association/filter/clump state exactly;
bicycle crank output matches too. Evidence:
`artifacts/bike-driveby-live-verification.json` and
`artifacts/bike-driveby-live-native.json`.

Loaded poses, direction changes, freeze, release, empty ammo and direct NPC
handoff pass for all fourteen bikes. Real firing/Q/E keys pass on the PCJ-600,
BMX and quad: ammo decreases, the right-hand model is mounted and visible,
the left model stays hidden and release returns to riding. Screenshots in
`artifacts/bike-driveby-keys-{461,481,471}.png` are current-state evidence.
The initial real-key fixture was corrected to exit each bike before warping
onto the next; its final run passes. The original screenshot behind a hedge
was replaced by an open-road setup, not a claimed before/after image pair.
Motorcycle/quad rider, bicycle cadence and phone-hop regressions pass.

Native weapon shot eligibility/timestamps are not implemented by this pose
change: firing keeps the existing host weapon timing. The subsequent
[muzzle and aim ray change](BIKE_DRIVE_BY_RAYS.md) captures and wires the
selected pre-impact calculations. The external PC hop task remains separate; simultaneous
hop/drive-by cross-fades, full ped task scheduling, hand IK and native key
sampling are outside this slice. Model visibility while blending is the
host integration policy, not a captured CPed weapon-render branch.

All **14,875 unit tests pass / 51 skipped**, across 885 passing files
(263.52 seconds). TypeScript passes after the handoff change. Evidence:
`artifacts/bike-driveby-full-unit.log` and
`artifacts/bike-driveby-types-complete.log`.

The final TypeScript/production build and built-game smoke pass. Saved-game
resume, walking, car entry/driving, map waypoint, pause/resume, aircraft
takeoff and landing gear report no page errors or failed requests. Evidence:
`artifacts/bike-driveby-build.log` and `artifacts/bike-driveby-production.log`.
