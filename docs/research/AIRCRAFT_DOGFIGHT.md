# Aircraft dogfight steering

Ported October 21, 2026. This implements the steering behind MANSIO2's
`PLANE_ATTACK_PLAYER_USING_DOG_FIGHT`; aircraft AI weapon firing remains unfinished.

## Sources

- The [reversed command handler](https://github.com/gta-reversed/gta-reversed/blob/4281f82d8af83e14935ac84a69dfd1ceebb9f256/source/game_sa/Scripts/Commands/VehicleCommands.cpp#L117)
  sets mission 63 unless the plane is already on crash mission 57 or 58. It sets the minimum altitude even in those
  cases. The player parameter is unused in the single-player engine.
- The iOS executable pinned by `scripts/content/lib/ios-executable.mjs`, from
  [gta3sa.app revision 67f70cb72e](https://github.com/Google61/gta3sa.app/tree/67f70cb72eb207aeca650ea9e8c10b0e7dda166a),
  SHA-256 `9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`, arm64 slice.
  Its aircraft dispatch table at `0x100199e84` sends mission 63 to `0x100199a08`, which sets the target entity
  (`+0x550`) to the player's vehicle, or the player ped on foot. It then takes the same branch as mission 62,
  `0x100199bec`, into `GetAIPlaneToDoDogFight` at `0x10019e280`.

The dogfight instructions were inspected with Xcode's `llvm-objdump --macho --arch=arm64 --disassemble` against
the hash-verified executable. These are static assembly observations, not runtime captures or recovered original
source. Hopper/REA decompiled the smaller weapon checks, but became unreachable while decompiling the containing
dispatch routine; its cleanup could not be confirmed by REA, although its owned process had exited. No claim about
dogfight steering relies on that failed decompilation.

## Steering observations

`0x10019e280` through `0x10019e448` reads CAutoPilot's dogfight flag at `+0x561`:

- With the flag clear, it predicts the target's position by 50 native frames of its velocity, sets the heading
  toward that position and uses its height as the maximum altitude.
- When `(rand() & 1023) == 500`, it sets the flag and stores a breakaway destination. Its x and y are independently
  the predicted coordinate plus `rand() * 2^-31 * 600 - 300`; z is the predicted height plus 50.
- With the flag set, it heads for the saved destination at its height. Once within 50 horizontally, it clears the
  flag. The choosing frame still pursues; the arrival frame still heads for the saved point. The next frame changes
  behavior.
- Both paths use the existing `FlyAIPlaneInCertainDirection` routine at `0x10019f1c4` for the flight controls and
  obstacle search, then run the gun and missile checks at `0x10019fa50` and `0x10019fb60`.

Constants read directly from the executable: `0x1005908a0` = 50, `0x10058c95c` = 2^-31,
`0x10058fdc4` = 600, `0x100592e0c` = -300. The probability uses iOS's 31-bit `rand`, not the 15-bit random helper
some other routines use. `nativePlaneAI.ts` exposes this random input for deterministic tests.

## Verification and remaining work

- `tests/plane-ai.test.ts` covers pursuit, the breakaway destination, holding it while the target moves,
  clearing within 50 regardless of height, next-frame transition, missing targets and the exact random mark.
- `tests/browser/script-plane-goto.spec.ts` checks command-to-engine wiring, crash-mission preservation and a live
  plane turning toward the player. The browser pursuit leg fixes the random input; the unit tests exercise breakaway.
- This does not establish that MANSIO2 passes. AI aircraft guns/missiles, combat choreography and a complete mission
  play-through remain to be verified.

Validation on October 21: `npm run build` passed; `npm test -- --maxWorkers=4 --testTimeout=30000 --reporter=dot`
passed 3,257 tests (51 skipped). The unchanged cutscene-data corpus test exceeds its default five-second timeout
on this machine and passes with the longer limit. All four `script-plane-goto` browser cases passed; the `sam-site`
case passed on a clean rerun after an earlier run was interrupted by a source-edit reload. Browser checks used one
worker and no retries. No full story sweep was run for this change.

## Projectile attribution found during this work

The SAM launcher already created enemy heatseekers, but projectile expiration always passed `byPlayer=true` to the
explosion. Vehicle-destruction crime callbacks and explosion-created ground fires also attributed damage to the
player unconditionally. Projectiles now carry an explicit `byPlayer` value independent of their collision-excluded
owner body, preserved through explosions, satchel detonation and ground fires. Enemy blasts still damage victims;
they do not report CJ's crimes. Player launchers, throws and aircraft rockets retain player attribution.

`tests/projectile-attribution.test.ts` exercises launch → update → blast for SAM, player launcher and player aircraft
rockets, and verifies the creator of resulting ground fires. The SAM browser spec also checks enemy attribution.
