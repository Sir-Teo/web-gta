# PC 1.0 player damage evidence

Inspected local gta-reversed revision `0076f9017b4aeef7433957ac2bd8b6988e9df166` on September 17, 2026.

## Verified source branches now used

- `CEventHandler::ComputeVehicleDiedResponse` (0x4BA8B0) sets occupant health directly to zero, then selects a dying or bike knock-off task. `CVehicle::KillPedsInVehicle` (0x6D1C80) dispatches that event to occupants. The browser formerly sent vehicle destruction through `damagePlayer`, which multiplied the amount by 0.4 and let armour absorb it. Cars, aircraft, boats and bikes now invoke `Simulation.vehicleOccupantDied`, bypassing that arithmetic. This does not yet reproduce the native event queue, scorch visuals or death animation tasks; bike destruction triggering itself remains authored.
- `CPedDamageResponseCalculator::ComputeWillKillPed` (0x4B3210), ordinary branch: remaining health **below 1.0** is fatal; exactly 1.0 survives. The browser formerly clamped only at zero. Forced death, cheats and the special protected-fall branch require their own event context and are not claimed here.
- `CEventDamage::AffectsPed` rejects an ordinary new event for a dead ped. `damagePlayer` now ignores new hits after death so fire/projectile callbacks cannot continually restart the browser's respawn timer. Native precomputed-event exceptions and task dispatch are not represented by this simplified adapter.

## Unverified assumptions retained explicitly

`AccountForPedDamageStats` (0x4AD430) delegates to the retail executable in this source. The STAT_PLAYER defend value of 0.4 is present in the data, but that alone does not establish which damage types it scales or the ordering. The current global multiplier remains a compatibility gap, not a proven source port. Removing it without a replacement would also be a guess.

`AccountForPedArmour` includes a reconstruction behind an early call/return and is marked unreversed/not tested. The browser armour adapter, including fall/drowning bypass, still needs retail validation. Landing damage and the four-second death/recovery flow remain authored. Full damage-event semantics, immunities, body-part rules, NPCs, passengers and leave-car events are open.

## Verification

`tests/health.test.ts` checks the one-HP boundary, forced occupant death, armour preservation and repeated-hit timer behavior. `tests/browser/vehicle-occupant-death.spec.ts` destroys original-asset car, helicopter, boat and motorcycle instances with an armoured driver and checks fatality and idempotence. The car fixture explicitly calls destruction: bullet damage alone leaves the car burning first and would not exercise the death event.

## Wasted and busted respawn (CGameLogic)

Source: pinned gta-reversed `0076f9017b4aeef7433957ac2bd8b6988e9df166`,
`GameLogic.cpp` (`Update`, `PassTime`, `RestorePlayerStuffDuringResurrection`),
`Restart.cpp` and `PlayerInfo.cpp` (`KillPlayer`, `ArrestPlayer`). All three
are fully reversed, so this replaces the previous authored recovery.

- `NativeRestart` ports the CRestart tables. A lookup consumes a pending
  OVERRIDE_NEXT_RESTART first, then a mission respawn base, then an extra
  point inside its radius, and otherwise searches the table. Candidates above
  `STAT_CITY_UNLOCKED` are skipped, and a candidate outside the query's level
  costs six times its distance unless the query is in the countryside. When
  nothing qualifies the source leaves the caller's output untouched, which the
  port reproduces by returning the supplied fallback.
- The eight hospital and seven police points are literal ADD_HOSPITAL_RESTART
  and ADD_POLICE_RESTART commands in the INITIAL mission and are extracted by
  `readInitialRestartPoints`, alongside the existing save-point, pickup and
  stunt-jump extractors. This is data extraction, not script execution. Two
  hospitals and one police station carry town identifier zero, so a retail new
  game restarts in Los Santos wherever the player dies. The browser opens the
  whole map with no missions, so it passes an unlocked value of two; that is a
  deliberate deviation recorded here, not a source behaviour.
- `NativeGameLogic` reproduces the sequence: the wasted branch holds three
  seconds and the busted branch four, the fade to black is raised on the one
  frame where the previous frame's clock was still inside the window, progress
  waits for the fade to finish, the fee is then charged and the player is
  resurrected before a three second fade back. The hospital fee is a flat 100;
  the police fee follows the wanted level through 100, 200, 400, 600, 900 and
  1500, and retail charges 100 at level zero. `m_bFreeHealthCare` and
  `m_bGetOutOfJailFree` absorb one penalty each, and the penalty flags disable
  them entirely. Both sequences advance the clock twelve hours through the
  ported `PassTime`, including its weekday wrap to one.
- Not reproduced: the co-op branches, trip skip, the cutscene gate, the
  mission failed and passed states, and the streaming, camera, clothing and
  audio-zone side effects of `RestorePlayerStuffDuringResurrection`, which
  belong to those systems. The busted voice line needs the engine-wide CRT
  random stream, which the browser does not share yet, so no line is selected.
- The simulation's four second death timer no longer respawns the player when
  `externalDeathRecovery` is set; it only releases the vehicle seat, and the
  state machine owns the respawn.

Tests: `tests/native-restart.test.ts` (extraction against the packaged script,
city gating, the sixfold penalty, overrides and the empty table) and
`tests/native-game-logic.test.ts` (both sequences, fade ordering, fees, the
one-shot flags and `PassTime`).

## Player float fields and one-HP survival (October 26, 2026)

Simulation.damagePlayer used double arithmetic after loading its native float
multipliers. A raw 25-damage hit at the retained 0.33 profile could leave
9.25 HP just below 1 rather than exactly 1, start recovery and emit a death
event. Armour, friendly scaling and intro1 scaling had the same field-rounding
gap.

The adapter now rounds its input/profile multiply, friendly factor, armour
fields, intro1 product and health subtraction to float32, and reports native
float damage responses. The existing armour-bypass decision, safety/proof gates,
mega-punch order, one-HP threshold and recovery behavior are retained. Direct
DAMAGE_CHAR continues to use its separate already-float field operation.

Seven focused integration cases expose six failures before repair. They check
exact-one survival without a death timer, armour, partial armour, friendly and
intro1 scaling, drowning bypass and a genuine below-one death with once-only
recovery. Twenty-five focused checks pass with the existing health, player-safe
and native source/group tests.

The current 0.33 profile is supported by the pinned iOS branch at
0x10028a070/0x100593cb0. The PC AccountForPedDamageStats entry at 0x4AD430 remains
a retail delegate in both inspected revisions. STAT_PLAYER's 0.4 data row does
not establish that player branch. A later audit statement and code comment
claiming the PC branch reads it were unsupported and have been corrected.
This precision repair retains the chosen profile; PC multiplier equivalence
and the complete calculator remain explicit compatibility gaps.

The live precision fixture uses the public scripted Hunter gun on CJ's real
physical body, car head-transfer and exposed-bike contacts. It checks one HP,
partial armour, absorption and below-one death, together with health/armour
loss events, blood and death-timer state. Native weapon data and the selected
profile seed representable native field boundaries; surviving one-HP results
are checked exactly.

The build and all six live checks pass. The initial twelve actual mounted hits cover the
physical, car and bike paths at one-HP, partial-armour, absorption and below-one
boundaries. One-HP survivors retain a zero recovery timer and a nonfatal damage
event; genuine below-one hits report fatal events. Health/armour losses and
blood match the resulting fields without vehicle damage. Existing Families
and script-group protection scenarios also pass in all three collision modes,
with no page errors.
Eleven additional intro1, mounted-seat and burning-player-in-car regression
checks pass.

All 6,040 unit tests pass (51 skipped) with the player float fields updated.

### Native response amount versus stored health loss

PC ComputeWillKillPed (`0x4B3210`) reports pre-hit health when the result is
fatal. On survival, it reports the remaining damage factor in DamageHealth,
then writes the float health subtraction. That factor can differ from the
quantized change in the stored field. At 5,000 HP, a small hit exposes the
difference; a sub-ULP hit can retain a positive response while health stays
unchanged. The adapter now preserves this native distinction. Two additional
cases failed before that correction, and 38 focused checks pass afterward.
The expanded live trial adds a large-health response case in every collision
mode, independently checking the native event amount.

All fifteen expanded mounted contacts pass across foot/car/bike, including the
large-health native-response case. The previously passing family/group checks
remain covered by the same source gates. No page errors occur.
All 6,042 unit tests pass (51 skipped) with the native response distinction.
The final build and full production smoke pass with the player float and native
response fields, including walking, native car entry, saved-game return,
map/waypoint, pause/resume, Rustler takeoff and gear. No page errors or failed
requests occur. The takeoff/gear verifier corrections and retained failure
traces are described in PLAYABLE_AIRCRAFT.md.
