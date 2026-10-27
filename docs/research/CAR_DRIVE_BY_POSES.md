# Player car drive-by poses, weapon state and rays

## Behavior

A seated player driver draws the right-hand SMG when looking left/right. The
normal or low-car shooting partial blends at 16, plays once and holds its final
frame. Shots wait for that pose to stop playing and blend strictly above native
float32 0.99. Releasing the look keys fades the partial at -8 and stops shooting.
Neutral fire alone does not shoot from the driver seat. Looking without firing
poses the gun without spending a round. Only the right-hand weapon model is shown.

The steering, look-back and shooting partials now share the native scalar blend
and clump update. Driving partials fade at -4 while any shooting association is
present. CarEntry sends simultaneous track-aware partials to NativeCharacter,
rather than layering steering clips sequentially. The existing full-body entry,
idle and exit task/transition owner remains separate.

Car shots use the loaded hand-24 matrix and selected vehicle axis, standard-skill
weapon offset/range, movement lead, three native scatter draws and pedestrian
auto-aim. They enter the impact path without extra handheld spread. The native
weapon-state owner introduced for bikes also supplies the car's owner-null update,
strict unsigned retry gate and 70 ms attempt overwrite. For cars, clip refill is
on releasing the look condition; looking without firing keeps the existing clip.
The special Rhino/S.W.A.T. controls and boat firing retain their separate owners.

## Independent executable reference

Pinned iOS universal binary: 14,226,544 bytes, SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.

`scripts/research/emulate-car-driving.py` executes actual
`CVehicle::DoDriveByShootings` (`0x10049b674`) with a null bike ride-data return,
actual `CVehicle::ProcessDrivingAnims` (`0x100480498..0x100480868`), association
lookup/blend and scalar clump update. Optional `nativeWeapon` profiles also
execute actual owner-null `CWeapon::Update` (`0x10049adf8`) and `FireFromCar`
(`0x100497908`). The native program counter at `0x10049b96c` independently
records passing the animation gate before the timestamp check.

Native PED descriptor rows start at `0x100624418` for the selected car IDs.
Ride tables at `0x100654260..0x1006542d0` and the actual native selector execute;
the skill threshold is 50 and the float32 3D move-speed threshold is 0.4. This
slice captured the iOS two-tier implementation. The subsequent
[PC ride-set change](PC_DRIVING_RIDE_SETS.md) restores the PC three-tier policy,
validates its selector against compiled reversed source and supplies those PC
tables as declared input to the native partial/controller capture.
The mapping preserves the existing exported clip-name casing.

Declared external services are player/pad lookup and look/fire results, the
driving stat, weapon info/reload duration, completion percentage, shot effects,
audio and asset/clump construction. Clip durations and full-body idle presence/
blend are declared inputs. The fake idle is not evidence of full native entry
or idle-task scheduling. Partial association state is compared independently of
that full-body owner. Native skeleton callbacks are not executed by this capture.

The 260 fixed cases cover car/low-car look and firing, directional
priority, stopped/fading poses, steering/reverse, skill/speed boundaries,
boat/truck/kart selection, offscreen/player gates, radio interruption, first-person
look-back behavior and complete native weapon-state attempts.
Fixtures compare all selected partial writes and final clump output, as well as
native ride selection and firing eligibility. Generic bicycle blend helpers now
accept explicit native descriptor flags; existing bike behavior stays covered
by its independent reference suite.

Muzzle and auto-aim use the separate actual-native captures documented in
[the ray research](BIKE_DRIVE_BY_RAYS.md). Native weapon-state details and
on-foot timer entry/exit boundaries remain as described in
[the weapon-state research](BIKE_DRIVE_BY_WEAPON_STATE.md). No independent original
PC 1.0 capture equivalence is claimed by this slice.

## Live validation

Real Q/E and fire keys pass on Greenwood (492), Remington (534), Linerunner (403)
and Kart (571). Checks include neutral fire, looking without firing, both shot
directions, readiness, visible/mounted right gun, hidden left gun, release and
scripted warp out before deleting each test car. The first fixture's exit wait
was corrected to accept the snapshot's null phase; the final four-model run
passes with no page errors.

All **1,020 live frames match native output exactly**: ride selection, partial
association/clump state, pre-timestamp animation readiness, weapon state, clip,
total ammo, next-shot time and firing result. They include 316 animation-ready
frames and 66 successful shots. Evidence:

- `artifacts/car-driveby-browser-final.log`
- `artifacts/car-driveby-live.json`
- `artifacts/car-driving-live-native.json`
- `artifacts/car-driving-live-verification.json`

All **66 muzzle/seed and final aimed ray endpoints match native output exactly**,
including one accepted automatic target. Evidence:
`artifacts/car-driveby-rays-live-verification.json` and its native seed/aim captures.
Screenshots `artifacts/car-driveby-left-{492,534,403,571}.png` are current-state
visual evidence, not a claimed matched original-PC before/after pair.

All **1,135 focused checks** and TypeScript pass. The entry, driver weapon,
real-key bike and all-fourteen-bike pose browser regression run passes nine
checks; its steering fixture initially read the removed `overlays` field and
was updated to inspect `partials`, retaining the same playback/cross-fade
assertions. The affected steering check and boat-driver steering both pass on
rerun. Evidence: `artifacts/car-driveby-browser-regression.log` and
`artifacts/car-driveby-steering-boat-regression.log`.

After the shared descriptor/hand adapter changes, all **2,156 bike pose frames**,
**1,137 weapon-state phases** and **49 bike rays** still match native output
exactly. Evidence is in `artifacts/car-driveby-bike-*-verification.json`.

Full units: **17,238 passed / 51 skipped**, across 891 passing files
(223.38 seconds), in `artifacts/car-driveby-full-unit.log`. The final TypeScript/production build and built-game smoke pass
(`artifacts/car-driveby-build.log`, `artifacts/car-driveby-production.log`).
Saved-game resume, walking, car entry/driving, map waypoint, pause/resume,
aircraft takeoff and landing gear report no page errors or failed requests. Full native physics, hand IK, window handling,
asset key sampling and task/render timing remain outside this slice.
