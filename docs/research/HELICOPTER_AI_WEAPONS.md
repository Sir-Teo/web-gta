# Helicopter attack guns and unguided rockets

HELI_ATTACK_PLAYER's attack and fly-away phases (missions 23 and 56) now request
real gunfire and unguided rockets. Weapons reuse the mounted-gun, projectile,
collision and damage systems, retain the launcher as owner and attribute harm
to the enemy. They do not report player crimes or shake his controller on firing.

## Native evidence

`scripts/research/native-heli-weapons.py` executes the pinned arm64 executable
under Unicorn 2.1.4, verifying SHA-256
9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78.
The fixture tests/fixtures/native-heli-weapons.json has 109 weapon cases and four
complete player-entity selector cases. Only CProjectileInfo::AddProjectile is
intercepted in the weapon helpers; selector cases have no intercepted calls.

The inspected attack routine 0x10019d244..0x10019d3fc calls the shared gun helper
0x10019fa50 and helicopter rocket helper 0x1001a0ac0 with FindPlayerEntity at
0x1002567a0. The selector captures establish that an occupied vehicle is the
target, otherwise CJ's ped is used, including a null vehicle pointer while the
in-vehicle flag is set. On foot the host supplies the native ped origin, one
unit above its stored feet.

The gun helper clears its flag, then requests guns for selections 0/1, distance
strictly below 150 and normalized target-offset dot forward strictly above
float32 0.8. Native normalization executes in the capture, including its
zero-vector X-axis fallback.

Helicopter rockets use different rules from plane heat-seekers:

- Selection is 0 or 4. A uint32 clock crosses a 250 ms boundary.
- Target distance is strictly below 80. Its perpendicular distance to the
  infinite forward line is strictly below 7; there is no forward-dot test or
  minimum range. Captured targets behind the helicopter can qualify.
- One unguided rocket is added with native projectile weapon 19 (the host's
  rocket-launcher weapon 35), force 1 and no homing target. The helper has no
  model gate.
- Origin is position + 4 forward, plus 1.5 right on even quarters or minus 1.5
  right on odd quarters. Direction is the raw forward vector.

The native point-to-line helper at 0x10017fec0 executes too. Float32 addition of
position + forward precedes subtraction inside that helper; treating the raw
forward vector as the line would lose this rounding. Captures vary selections,
strict range/line boundaries, zero distance/forward, behind targets, rotated and
non-unit bases, alternating origins and clock wrap. Every gun flag and launch
origin/direction matches strict comparisons.

## Integration and verification

WeaponSystem evaluates the captured requests for live, unoccupied, unfrozen
helicopters in attack missions 23/56. Remote player control suppresses this AI
path. Supported armed models reuse their gun rates and shared per-vehicle gun
timestamp. Rockets use the existing creator-speed inheritance, fuse, flight,
collision and explosion paths. There is no helicopter model gate on this native
rocket request.

Sixteen binding tests cover both attack phases, all four captured target
selections, state/selection gates, shared and independent gun clocks, alternating
single unguided launches, and a real rocket impact/blast with enemy attribution.
Eight checks failed before the binding was added. All 5,353 unit tests pass
(51 skipped), and the build passes.

The live Hunter test invokes HELI_ATTACK_PLAYER and lets the enemy fly with its
own controls. Only the player target is held fixed and given extra health for
the check. The settled run records six gun shots, two alternating rocket
launches and two enemy damage calls, reducing target health from 100,000 to
99,893.6. Skipped commands, give-ups and page errors are empty. Trace:
artifacts/script-heli-weapons.json; screenshot: artifacts/script-heli-weapons.png.

The existing Hunter script-gun check passes. The fixed-wing dogfight regression
also passes its gun, heat-seeker and enemy-damage requirements after its fixture
waits for the actual destination scene to finish streaming. Its earlier run
fired guns/missiles but timed out on damage while terrain was loading. Neither
its damage requirement nor its timing thresholds were relaxed. Final trace:
artifacts/script-plane-weapons.json; combined settled run:
artifacts/heli-plane-weapons-settled-browser.log.

This covers helicopter attack requests and the existing host weapon paths.
Native per-model muzzle positions, multiple barrels, spread and complete
FireInstantHit behavior remain partial. Police-helicopter-specific weapons and
complete DES3/MANSIO2 combat play-throughs are not established by these checks.
