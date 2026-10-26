# Predator fixed twin guns

The player-controlled Predator (430) previously had the ordinary boat drive-by
path, but no fixed machine guns. CBoat::ProcessControl calls both paths. Its
fixed guns now fire from Ctrl or the existing vehicle fire button, independently
of the driver's inventory and SET_PLAYER_CAN_DO_DRIVE_BY. Looking sideways or
behind, disabling player controls, or setting the vehicle's gun-off flag retains
the native fixed-gun gate.

## Source and executable evidence

The pinned gta-reversed revision is
`4281f82d8af83e14935ac84a69dfd1ceebb9f256`:

- CBoat::ProcessControl, PC `0x6F1770`, calls DoFixedMachineGuns for the
  player-status Predator, then DoDriveByShootings.
- CVehicle::DoFixedMachineGuns, PC `0x73F400`, requires the camera's forward
  looking direction and a car-gun trigger with bGunSwitchedOff clear.
  Otherwise it restores the clip to 20 strictly past last-shot time + 1400 ms.
- FireFixedMachineGuns, PC `0x73DF00`, and DoTankDoomAiming, PC `0x73D1E0`, are
  retail delegates at the pinned revision. Their selected numerical behavior
  below comes from the pinned iOS executable, not a reconstructed PC body.
- FireOneInstantHitRound, PC `0x73AF00`, is reversed. It creates a point light,
  line-tests, adds the explicit .02 / 750 ms / 150-alpha trace, and sends
  anonymous WEAPON_UZI_DRIVEBY damage to a living ped or MICRO_UZI damage to
  a vehicle. It does not use the driver's weapon ammo, DoBulletImpact blood,
  weapon-skill accounting or player gunfire crimes.

The selected iOS entry points are DoFixedMachineGuns `0x10049b9f8`,
FireFixedMachineGuns `0x10049baa4`, DoTankDoomAiming `0x10049a930` and
FireOneInstantHitRound `0x10049b350`.

Two optional Unicorn 2.1.4 harnesses execute the original instructions against
the existing 14,226,544-byte binary, SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
No binary download or application dependency is introduced:

- `emulate-predator-fixed-guns.py`: 46 timing, clip, camera, orientation and
  spread captures. Pad/RNG/aim/shot/audio calls are logged stubs. The actual
  matrix-transform helper `0x1002cb450` executes unchanged. The initial
  endpoints are explicitly captured before aiming correction.
- `emulate-predator-aim.py`: 58 aim captures with an explicit returned vehicle
  list replacing FindObjectsInRange. Native filters, nearest-candidate choice,
  endpoint adjustment and actual line-distance helper `0x10017fd10` execute
  unchanged. Candidate defaults are recorded explicitly in the fixture.

Both fixtures regenerate byte-identically. The adapter matches all 104
captured numerical cases exactly; these are selected-executable captures,
not matched original-PC recordings.

## Captured mechanism

A volley requires unsigned current time strictly greater than last-shot time
+ 150 ms, with uint32 addition before comparison. It emits both native model
points (2, 2.5, 1) and (−2, 2.5, 1). The forward XY vector is normalized with
length floored at .1; each endpoint advances 60 units along it. Each barrel
uses three independent random low bytes minus 128, scaled by .015 in XY and
.02 in Z. No velocity-based origin advance is added.

Both rounds have intensity 15. One volley decrements the 20-round-count clip
once. At zero, the clip restores to 20 and last-shot time becomes current
time + 1400 ms; the next volley still obeys the strict additional 150 ms
comparison. A non-forward camera skips the idle clip reset too.
The selected function reports audio event 149 with M4 type 31. It does not
request the ordinary aircraft gun's controller shake or gunshot FX.

DoTankDoomAiming queries at most 15 vehicles within the initial segment's
3D-length radius, using a 2D position test before its own filters. It excludes
the source, train statuses and scorched vehicles. A target must satisfy its
native height-to-distance window and be less than three collision-bound
radii from the XY segment. The nearest eligible candidate determines only the
endpoint's Z, projecting toward target Z + .3. Pedestrians are not aim targets.
The host includes trains in the candidate budget before rejecting their status.
Candidate order follows the host vehicle pools; exact native sector order is
not reconstructed. Matrix allocation is deferred until a volley is due.
The first round resolves before the second barrel draws spread and queries
targets again. Two regression checks expose an eager six-draw implementation
and stale target snapshot, including a vehicle retired by the first round.

## Shared round backend

WeaponSystem's FireOneInstantHitRound path now serves the Predator and the
existing SCM FIRE_SINGLE_BULLET adapter. It uses the animated pedestrian line
query, includes CJ, and emits the explicit native heavy trace. Live pedestrian
hits use type 52 with no creator: defend weakness, armor and proof checks
remain active, player-friendly scaling is absent, and ordinary instant-hit
head criticals are absent. Dead pedestrians receive no corpse treatment.
Vehicle hits carry type 28 with byPlayer false, preserving proof/only-player
eligibility and avoiding player destruction credit. No held-weapon ammo,
player crime/skill credit or ordinary gunshot/blood FX is added.

## Checks and boundaries

Focused checks cover captures, native timing/clip boundaries, twin origins,
vehicle proofs, NPC armor/proofs/head behavior, uncredited fatal hits, corpse
rejection, CJ damage and existing Hunter/script gun behavior.

The live original Predator test uses actual Ctrl input with drive-bys disabled.
It observes exactly one twin volley, native origins, M4 vehicle-fire audio,
an unchanged inventory and the expected 16.5-point wound on a 1.1-weakness
NPC, with anonymous attribution and no player crime or ordinary muzzle FX.
Side-looking and disabled controls suppress further volleys. SCM then fires
through the same backend and hits the NPC's current animated body for its
expected damage. The first SCM probe reused the old impact endpoint after a
reaction animation; the fixture now selects a valid current body ray.

Complete original line-test material flags, FireOneInstantHitRound's start
point light and ReportBulletHit surface/water audio, exact sector ordering,
full seated-ped/other-vehicle behavior and matched original-PC captures remain
separate compatibility work. These changes establish the represented fixed
gun mechanism, anonymous round behavior and player input bridge.

All 167 focused checks and 6,895 unit tests pass (51 skipped), including the
native sequencing fixes. Final live Predator input/SCM behavior and the
existing SCM Hunter/boat-fire regressions pass without page errors.
The final TypeScript/build validation passes as well.
Normal production smoke passes saved-game return, movement, car entry,
map/waypoint, pause/resume, Rustler takeoff and landing gear, without page
errors, failed requests or a development inspection hook.
