# Aircraft weapons and script Hunter fire

The attack-player and dogfight-player missions now fire the existing fixed forward guns and enemy heat-seekers.
The firing checks follow the pinned iOS executable. Helicopter attack guns and
unguided rockets are now integrated separately ([native evidence and scope](HELICOPTER_AI_WEAPONS.md)). Scripted Hunter
fire is connected separately through `FIRE_HUNTER_GUN` (0541).

## Source observations

The executable is the hash-verified arm64 slice selected by `scripts/content/lib/ios-executable.mjs`:
gta3sa.app revision `67f70cb72eb207aeca650ea9e8c10b0e7dda166a`, SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
The instructions below were disassembled with Capstone 5.0.7. These are static assembly observations.

- `GetAIPlaneToAttackPlayer` (`0x10019d134`) calls the gun check at `0x10019d218` and the missile check at
  `0x10019d240`, both with `FindPlayerVehicle(-1, false)`. No vehicle means no weapon target, even though steering
  continues toward CJ on foot.
- `GetAIPlaneToDoDogFight` (`0x10019e280`) calls the same checks at `0x10019e420` and `0x10019e448`, with its
  actual target entity. Mission 63 sets that to the player's vehicle or ped. Breaking away does not suppress firing.
- `TestWhetherToFirePlaneGuns` (`0x10019fa50`) clears the gun flag first. It sets it only with a target, weapon
  selection 0 or 1, distance strictly below 150, and normalized target-offset dot forward strictly above float32 0.8.
  It uses the current target position, independently of the steering prediction. Constants: `0x1005908dc` = 150,
  `0x10058ca08` = float32 0.8.
- `TestWhetherToFirePlaneMissiles` (`0x10019fb60`) compares current and previous clock values divided by 2000:
  the unsigned multiply by `0x10624dd3`, shifted right 39, implements that division. It fires only on a crossed
  boundary, at distance strictly above 30 and below 160, with the same forward-dot test. The older audit's
  once-a-second description was incorrect. Constant: `0x10058e844` = 160.
- The missile check has no weapon-selection or model gate. It calls `CProjectileInfo::AddProjectile`
  (`0x100491668`) directly with WEAPON_ROCKET_HS (20), force 1, the plane's forward direction and the target entity,
  from position + 4 forward - 3 up. This is one heat-seeker, distinct from the player's pair of unguided rockets.

## Integration

`nativePlaneWeapons.ts` implements those geometric and clock checks. `WeaponSystem` evaluates them for live,
unoccupied, unfrozen fixed-wing aircraft in missions 35, 59 and 63. Each aircraft has its own gun timestamp,
shared by AI, pilot controls and script fire. Guns reuse the supported models' rates and weapon.dat
damage/range. The shared gun path still uses the port's single fixed forward trace; native per-model muzzle
positions, multiple gun barrels and gun spread have not been added by this change. The RC Baron's single M4 nose gun was subsequently connected by the remote-control work (REMOTE_CONTROL.md).

Missiles inherit the launcher's speed and use the existing native projectile flight, homing, fuse, collision and
blast code. The target resolver now also accepts CJ's body for dogfight missiles aimed at him on foot. Enemy rounds
carry `byPlayer: false` through pedestrian, vehicle and scripted-object damage, immediate aircraft blasts, missile
blasts and resulting ground fires, without reporting player crimes or shaking his controller on firing.

Projectile collision excludes its actual owner independently of player attribution. A missing owner excludes
nothing. SAM's negative owner sentinel is checked before querying Rapier: `getRigidBody(-1)` can resolve to body 0
in this binding, which otherwise excluded CJ from the SAM's collision line. Removed aircraft owners likewise do
not fall back to excluding CJ.

## Verification and limits

`tests/plane-weapons.test.ts` checks boundary distances, aim angle, selection, the two-second clock, independent
gun cooldowns, walls, player/pedestrian/vehicle hits, enemy attribution, missile spawn/speed/homing/blast, and mission
and aircraft-state gates. `tests/projectile-attribution.test.ts` additionally checks collision with CJ before the
fuse expires, both for a SAM and after its aircraft owner has been removed.

`tests/browser/script-plane-weapons.spec.ts` gives a live Hydra the script's dogfight command and observes its guns,
missiles and enemy damage to CJ's aircraft. The target is held by a fixed collision body for this controlled check. This is a controlled combat check, not a
complete MANSIO2 play-through. Police-helicopter-specific weapons, the extra aircraft-avoidance call in attack-player steering,
entity-dogfight mission 62 and full combat choreography still need integration or verification.

Validation on October 21: `npm run build` passed and the full unit suite passed 3,267 tests (51 skipped), using
`--maxWorkers=4 --testTimeout=30000 --reporter=dot`. Seven targeted browser cases passed: the new plane-weapons
case, all four plane navigation/pursuit cases, the SAM site and the existing player prop-shot regression.
Browser checks used system Chromium, one worker and no retries; the local config override is kept under ignored
`artifacts/`. No full mission sweep was run.

## FIRE_HUNTER_GUN and the shared vehicle timer (October 22)

DESERT5 uses 0541 once, in flight school's helicopter-weapons exercise. The iOS handler at `0x1001e4a78`
resolves the vehicle, then its tail at `0x1001e569c–0x1001e5798` does the following:

- Require `now > uint32(vehicle.m_nGunFiringTime + 150)`. Equality does not fire; unsigned addition wraps
  before the comparison. The timestamp at vehicle offset `0x65c` is the same field used by ordinary plane guns.
- Construct a fresh minigun (weapon 38) with 5,000 rounds. It has no model, health, occupancy or control gate.
- Transform `CAutomobile::vecHunterGunPos` through the current vehicle matrix, then add native move speed times
  `CTimer::ms_fTimeStep`. The reversed reference supplies the static offset `{0, 4.8, -1.3}` (PC `0x8d3394`);
  the iOS handler reads the corresponding BSS global at `0x1008f7e84`.
- Pass this position as both origin arguments to `CWeapon::Fire`, with the vehicle as creator, and add a shell
  with XY direction `{0, float32(0.1)}` and size `float32(0.025)`. Report weapon-fire audio, then store the time.

`nativeHunterGun.ts` preserves the unsigned clock comparison and float32 origin arithmetic. The live host uses
the existing mounted-gun hit, tracer, surface and damage paths with minigun data. It carries vehicle ownership
through damage and does not add player-input crime or pad-shake calls. It does not consume CJ's inventory ammo.
The vehicle timer also replaces the port's separate AI and global player gun clocks, so changing aircraft leaves
each aircraft's timer intact and entering an AI aircraft does not reset its gun.

The shell path uses the creator's bound sphere for the camera-frustum check and the creator position for the
native ten-metre camera-distance gate (`CWeapon::AddGunshell`, PC `0x73a3e0`). It does not use muzzle distance for
that gate or emit the ordinary aircraft casing a second time.

The unit checks cover strict and wrapping timing, rotated/velocity-offset origins, enemy hits on CJ, shared
pilot/script timing, independent vehicles, ammo preservation and the shell camera boundary. Actual 0541 bytecode
in the browser fires the original Hunter model into a collision target, emits the expected origin and shell
parameters, preserves enemy attribution and suppresses a second call in the same frame. The existing live Hydra
dogfight check covers AI guns and missiles after the shared-timer change.

This does not establish a complete DESERT5 pass. The mounted-gun trace still inherits the port's collision,
weapon spread and impact-force coverage; native `FireInstantHit` has not been completely reproduced by this work.
