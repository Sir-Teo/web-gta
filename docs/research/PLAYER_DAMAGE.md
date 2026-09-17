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
