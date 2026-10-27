# Anonymous round contact audio

FireOneInstantHitRound, shared by Predator fixed guns and SCM
FIRE_SINGLE_BULLET, previously drew its trace and routed damage without
reporting contact audio. It now reports the native facing-surface contact and
missed-line water fallback through the existing collision-audio backend.

## Source rules

CWeapon's reversed FireOneInstantHitRound, PC `0x73AF00`, at gta-reversed
`4281f82d8af83e14935ac84a69dfd1ceebb9f256` supplies the behavior:

- After the damage path, normalize the original segment and dot it with the
  hit normal. Only a strictly negative dot reports ReportBulletHit. Its angle
  is asin(−dot) in degrees. Tangent and back-facing normals stay silent.
- Rejected damage does not suppress contact sound. Dead pedestrians skip the
  damage event but retain the physical hit report.
- On a miss, ask GetWaterLevel at the original endpoint XY, endpoint Z + 10,
  with touching-water true. If present, report SURFACE_WATER_SHALLOW (39), at
  that endpoint XY and sampled water height, with angle zero.
- This path adds no DoBulletImpact particles or ordinary gunshot/blood FX.

CAECollisionAudioEntity::ReportBulletHit (`0x4DBDF0`) and
PlayBulletHitCollisionSound (`0x4DB7C0`) already use SURFAUD.DAT, the native
bullet-hit bank and event volume. Flesh uses samples 7–9. Water uses 16–18,
with +6 dB and rolloff 2. Vehicle material is SURFACE_CAR (63).

## Integration

The anonymous round backend reports contacts after damage, including its
returning ped/vehicle branches. Ped recognition is independent of wound
acceptance, so proofed or dead contacts reach the flesh reporter. Vehicle kind
is recorded before damage and passed as an optional hint; a synchronous
retirement cannot force the audio callback to dereference a freed Rapier body.
Ordinary bullet reports sample the parent identity once and recognize cars,
boats, bikes, planes and trains.

The weapon water callback now forwards height and touching-water arguments to
the existing native water sampler. That preserves its vertical window: water
more than 20 below the query or limited-depth water too far above it does not
qualify. Existing two-argument callers retain their previous behavior.

## Checks

Eight initial checks expose missing reports. The focused suite covers front,
tangent and back-facing hits, proofed/dead flesh, vehicle retirement and the
original water query, including a zero surface level and an absent surface.
Tests also use actual SURFAUD.DAT and NativeCollisionAudio/NativeSoundManager
to verify native water samples, position, volume/rolloff and flesh playback
when bullet proofing rejects CJ's wound. No impact particles are added.

The live Predator/SCM fixture intercepts the actual collision-audio reporter
and records the native sounds it starts. A keyboard volley produces flesh 62
and water 39 reports with samples from the original bank slot 3; the water
sound uses rolloff 2 and the native +6 dB offset. A later SCM round produces
another flesh contact. A bullet-proof occupied hull keeps its health while
reporting metal 63. A high, unobstructed miss has no water report because the
original endpoint-height query rejects the surface.

The initial hull check incorrectly expected the only-player flag to protect
an occupied player vehicle; the existing native exception permits that hit.
The fixture now uses actual bullet proofing for the rejected-wound check.
No game damage rule was changed to satisfy that assumption.

This closes contact/water sound routing for the represented shared round.
Original dynamic start-point lighting, complete line-test material flags,
exact native sector/seated behavior and matched original-PC captures remain
separate work; the fixed-gun numerical profile retains its documented selected
executable evidence.

All 176 focused checks and 6,908 unit tests pass (51 skipped). The live
expanded Predator/SCM regression passes without page errors.
The final TypeScript/build validation passes as well.
Normal production smoke passes saved-game return, movement, car entry,
map/waypoint, pause/resume, Rustler takeoff and landing gear, without page
errors, failed requests or a development inspection hook.
