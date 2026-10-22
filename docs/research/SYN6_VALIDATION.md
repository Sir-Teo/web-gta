# SYN6 focused validation, October 22, 2026

The original SYN6 (mission 62, Toreno's Last Flight) now reaches its native mission-passed
registration, rewards and cleanup in a controlled checkpoint browser regression. Its uninterrupted
drive and chase remain unverified. The vehicle-target instruction also passes against a live
helicopter pilot; see [vehicle targeting](VEHICLE_PED_TARGETING.md).

Three separate sweep probes exercised the original mission without changing its variables:

| Probe | Observed progress | Limit |
| --- | --- | --- |
| Player-only locate sweep, 120 seconds | Opening loads, phone dialogue runs, SYN6_01 prints; no skipped commands, gave-up records or page errors | Locate-only automation does not follow the coordinate blip |
| Stage trace, 90 seconds | TIMERA advances; local 84 progresses through 30 and 70 to -13, local 142 returns to zero after the call | Confirms the phone sequence ends; the persistent WAIT at relative 1610 also serves the mission's objective loop |
| Objective bot, 90 seconds | The pad unlocks, CJ finds a car, gets into it and drives toward -1680,705 using the car mission route | Time budget ends during travel; the helicopter chase and mission result are not reached |

All three probes report zero skipped commands, zero script failures and zero page errors. They
reach 17.2% by the sweep's instruction-offset metric; that metric alone does not distinguish a
completed opening from a stalled phone call. The stage trace and bot actions provide the distinction.
The bot's movement is an automation aid, not evidence of original-game movement parity.

The window installation also emits the existing warning that the new terrain obstructs the current
player position. These probes do not resolve that placement/support issue. Six created NPCs remain
reported as waiting for collision during the opening; later longer probes below reach their active guard behavior.

Raw probe files are kept separately under ignored artifacts/port/syn6-*.json, with the original
saved sweep.json restored. Historical mission outcomes in STATUS.md are unchanged.

A further 120-second player-only opening probe after the frozen-vehicle collision correction
also reports zero skipped commands, script failures and page errors. Local 84 progresses to
-13 and local 142 returns to zero; the persistent WAIT remains the ordinary objective loop.
The result is saved separately in `artifacts/port/frozen-vehicle-mission-openings-oct22.json`.
Coverage remains 17.2%; helicopter combat and mission completion remain unverified.

## Longer objective probes

Two subsequent 300-second player-only objective-bot runs distinguish travel and
automation limits from mission-script failures:

- The first crossed San Fierro and reached the helipad approach, where the bot
  repeatedly drove toward a weapon pickup above the road. The car burned and the
  script ended with M_FAIL. There were no skipped commands, interpreter give-ups
  or page errors. This does not establish a native vehicle-controller defect.
- The bot now leaves its car within 40 horizontal units of a pickup more than
  three units above it, then uses its existing on-foot approach. The next run
  collected the weapon, advanced local 60 through the cutscene to stage 8, created
  the recorded helicopter (local 149 = 1032) and entered the chase. The guards
  became active and pursued CJ. The report reached 59.7% and remained active at
  the shared WAIT loop, without skips, give-ups or page errors. Its remaining
  limit was the bot chasing an aircraft on foot until within fifteen units before
  firing. Full mission completion remains unverified.

These are diagnostic-bot changes, not product movement changes. The bot's on-foot
placement and controlled setup remain automation aids, and its progress does not
prove a manual play-through. Typechecks pass. Outputs are kept separately as
`syn6-long-player-bot-oct22.json` and `syn6-raised-pickup-player-bot-oct22.json`
under ignored `artifacts/port/`; historical sweep bytes are restored after each run.

## Aircraft classification and further probes

The bot's aircraft-specific RPG decision exposed a product bug: the registered
vehicle query returned automobile for the recorded helicopter. The player snapshot
also classified an occupied helicopter as a plane. Both now use the native handling
flag selection, verified against all sixteen category-bit combinations and real
browser vehicles ([captures and checks](VEHICLE_APPEARANCE.md)).

The pre-fix RPG bot run reached the chase at 60.8% without recognizing an aircraft.
The subsequent 300-second run with the appearance correction never reached the
helipad: its chosen car became stuck with no wheels on the ground near -2067,51.
It remained active at 17.2%, with zero skips, give-ups or page errors. This run
does not test the corrected RPG decision or establish the cause of the stuck car.
Reports are `syn6-rpg-player-bot-oct22.json` and
`syn6-appearance-rpg-player-bot-oct22.json`. Historical sweep bytes are preserved.

A focused checkpoint at the original debug approach (-1704.324,637.513,23.896)
revealed another automation limit. Going straight to the RPG collected it before
the cutscene created local 149. The original script adds its helicopter blip only
inside that pickup event, so the bot subsequently had no chase objective and the
mission eventually failed with SYN6_08/M_FAIL. This is not evidence of a failed
radar implementation. A second setup enters the original stair trigger
(-1683.820,686.513,23.969), waits through the original camera sequence, then follows
the pickup blip. That sequence creates the chase blip correctly and reaches stage
8 with the helicopter classified as appearance 3, health 1500 and 85 RPG rounds
(25 already held plus the original pickup's 60). The old 55-unit firing threshold
then remained out of reach while chasing on foot; the run stayed active with no
shots, skips, give-ups or page errors. Raw logs and JSON are
`artifacts/syn6-helipad-probe.*` and `artifacts/syn6-stairs-probe.*`.

The diagnostic bot now estimates an RPG intercept from the existing native launch
speed (20 units/second), acceleration (20 units/second squared), three-second fuse
and the aircraft's velocity. This replaces the incorrect constant-speed reach
assumption. The helipad rerun still found no reachable clear shot before the
aircraft pulled away. A further grounded checkpoint, twenty horizontal units
from the live flight path with a checked clear ray, reached the RPG branch at
27–41 units. Its unchanged ammo and empty projectile list exposed another bot
omission: rocket launchers require the actual first-person aim mode. Direct
`fireAt` calls correctly fail outside that mode. These probes are kept as
`artifacts/syn6-rpg-leading-probe.*` and `artifacts/syn6-combat-probe.*`.

The sweep now holds the real right mouse button while tracking an aircraft with
RPG ammunition, releasing it when leaving that objective. The bot reports an aim
attempt when the fire call returns false, rather than claiming that a rocket
fired. Its walking helper now passes feet height to the host, without adding the
ped-origin offset a second time; the old extra unit kept CJ falling after each
step and interrupted grounded weapon aim. These are diagnostic input changes.
The controlled CJ placements and health maintenance do not establish a manual
mission play-through.

Tracing that combat path also exposed missing product behavior beyond the bot:
bikes, boats and aircraft did not consume their assigned weapon immunity flags
or retain the last weapon/attacker. Those paths now follow captured native gates
and storage; live shots verify the script queries across all vehicle families
([checks and limits](VEHICLE_DAMAGE_GATES.md)). This repairs the data needed by
SYN6's later HAS_CAR_BEEN_DAMAGED_BY_CHAR check without changing its script.

## Permanent combat, result and reward regression

`tests/browser/syn6-rpg.spec.ts` passes in 1.7 minutes. It runs the original phone,
stair trigger, camera sequence, pickup event and recorded flight. Only CJ is
placed at approach/stair/firing checkpoints; the firing checkpoint is a clear
floor ahead of the live aircraft. The real aim button enables the rocket camera.
The bot fires until substantial RPG damage, then normal rifle fire finishes the
helicopter. The script owns its crash stage, result and cleanup.

The passing run verifies:

- One player-owned RPG spends a round (85 to 84), reduces helicopter health from
  1500 to 400, records explosion weapon 51 and identifies CJ through the original
  script's attacker query.
- Rifle hits reduce the helicopter to zero health. The original stage 99 is
  observed before the mission thread ends with registration `SYND_6`.
- Money rises from $0 to $18,000 and the mission-respect accumulator rises by 50.
  The script removes the RPG, restores control and leaves CJ unfrozen.
- Skipped commands, interpreter give-ups and page errors remain empty.

The inspected `artifacts/syn6-rpg-result.png` shows Mission Passed, the $18,000
reward and restored HUD. `artifacts/syn6-rpg.json` retains the setup, RPG damage,
rifle/crash timeline and final rewards. A preceding result probe independently
reached `SYND_6`; earlier probes reached RPG damage without completing the chase.

CJ's health is maintained at 100 and the finisher receives rifle ammunition.
All NPC state, mission locals, vehicle health and recording changes come from the
original script and normal combat system. This validates the native combat/result
sequence from controlled checkpoints; it does not establish an uninterrupted
journey or manual play-through. Historical sweep outcomes remain unchanged.
