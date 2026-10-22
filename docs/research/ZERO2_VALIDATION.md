# ZERO2: controlled original combat and mission result

The original Supply Lines script (mission 73, ZERO2) reaches its native result
from controlled RC-aircraft checkpoints. Five courier drivers die through the
real RC Baron M4 gun path, the original counter reaches five, and returning the
Baron to the script's roof marker produces Mission Passed and $5,000. The
original script registers `ZERO_2`, removes the remote vehicle and restores CJ's
controls. Delayed hand-back finishes with remote mode off and CJ unfrozen.

This is controlled integration evidence. The fixture freezes and moves the
player-operated Baron to firing checkpoints, selects a clear bullet line and
maintains its original 1100 health. CJ remains in the mission van throughout
combat. NPC positions, health, driving, task changes, script locals, counters and
rewards are not written by the fixture. It does not establish uninterrupted
flight, fuel management, a manual play-through or complete NPC combat parity.

## Original sequence exercised

- The original cutscene/setup creates the van, couriers and remote Baron. The
  fixture skips supported cutscenes and waits for actual gameplay help, player
  control and a completed fade-in before firing.
- The Baron uses its real fire key, single nose M4 and weapon-system ray/damage
  path. Original targets are a Sanchez (468), Mountain Bike (510) and three
  Berkley's RC Vans (459). Each vehicle records player-attributed weapon 31.
- Driver handles occupy locals 36–40; vehicles occupy 46–50. Original first-hit
  flags at 103–107 trigger reactions. The bicycle driver leaves its seat, then
  receives ordinary gunfire on foot; its zero-health bicycle does not explode.
- The script owns death checks, dialogue, blip removal and local 121's increments.
  CJ's position and van occupancy remain unchanged through all five couriers.
- Returning the controlled Baron to `(-2237.310, 140.080, 57.230)` satisfies the
  original roof check at SCM 1882409. The script prints `M_PASS`, adds $5,000,
  runs its result dialogue and registers `ZERO_2` at SCM 1883905.
- The native cleanup calls REMOVE_RC_BUGGY again. Its repeat call restarts the
  existing hand-back timer, so mission-thread termination alone does not mean
  remote mode has ended. The fixture waits for the delayed release and return
  fade before checking remote state and CJ's controls.

The permanent `tests/browser/zero2-combat.spec.ts` completes in about 1.4 minutes without page errors,
skipped commands or give-ups. Its inspected screenshot shows the original
Mission Passed $5000 message and updated cash. It checks player-attributed M4
damage on every vehicle, all five driver deaths and original counter updates,
CJ's unchanged position/occupancy during combat, the reward and delayed cleanup.
The build passes; the latest full suite has 4,624 passing unit tests (51 skipped).
Trace: `artifacts/zero2-combat.json`; screenshots:
`artifacts/zero2-combat-passed.png` and `artifacts/zero2-combat-result.png`.
The separate historical sweep report is preserved byte-for-byte.

## Limits and remaining work

The [remote focus fix](REMOTE_VEHICLE_FOCUS.md) was necessary for the first
courier's collision to remain active while CJ stayed in the high frozen van.
The existing [remote-control coverage](REMOTE_CONTROL.md) separately checks roof
placement and keyboard throttle/flight handoff.

The later [script vehicle attack integration](SCRIPT_VEHICLE_ATTACK_TARGETS.md)
fixes the missing non-car combat entity, target-body sight check and ordinary
NPC bullet dispatch. A separate live gunman now damages a remote Baron with
non-player pistol fire, and the controlled ZERO2 result still passes afterward.
Existing task and camera approximations remain. The controlled result does not
establish native enemy pressure or complete mission fidelity. The fuel label
previously exposed an unresolved `~1~` placeholder in the DOM HUD; the
[captured numeric-token fix](HUD_NUMERIC_TOKENS.md) now removes it, with a live
fuel-label assertion in this same regression.
