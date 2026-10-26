# Seated police kill timing and creator accounting

Police crews now report a bullet death when accepted damage first reduces the
occupant's health to zero. The report carries the existing player-ped,
player-vehicle or remote creator classification. A later corpse contact,
driver coast, door exit or body reconstruction does not report that death again.
Previously the driver could be counted only when spawnDead applied a synthetic
explosion to a replacement body. That delayed the report and lost the creator;
a passenger or driver that stayed dead in the seat could remain uncounted.

## Reference

CEventHandler::RegisterKill (PC `0x4B9340`), in pinned gta-reversed revision
`4281f82d8af83e14935ac84a69dfd1ceebb9f256`, selects the raw source:

- A player ped calls CDarkel::RegisterKillByPlayer.
- A vehicle equal to FindPlayerVehicle increments STAT_PEOPLE_YOUVE_WASTED (121).
- Other sources call CDarkel::RegisterKillNotByPlayer (STAT_PEOPLE_WASTED_BY_OTHERS, 120).

The event handler invokes this as part of the fatal damage response, before
subsequent vehicle/foot tasks. The existing browser onKill host routes the
mapped creator cases to those counter/respect paths. A COP player-ped kill
increments 121 and 176 and adds 1.5 to respect; the mapped vehicle case increments
121 alone; remote increments 120 without cop respect.

## Integration

WorldPolice emits onCrewKilled only for a live-to-dead accepted hit. Both seat
death states and a per-seat accounting marker are present before the callback.
Repeated driver-coast contacts preserve the armour remainder. A replacement
living cop entering that seat clears the old accounting marker.

The marker and armour travel through driver/front-passenger drag descriptions
and the stopped driver's death-exit callback. spawnDead restores an already
counted corpse directly, with its remaining armour and no cash; it does not
apply another weapon hit. Generic unaccounted vehicle-death callers retain
their existing path. A zero-health driver is identified as dead even before
its coast timer completes, so dragging that body out does not create a living
officer.

## Verification and scope

Units cover all mapped creators, surviving armour hits, fatal heads, stale
contacts, invalid/dead entries, corpse metadata and reconstruction without a
second weapon hit. A live dispatched FBI unit supplies the creator counter
trial; the driver then completes its native two-second coast and death-exit
path, retaining armour while the counters remain unchanged.

This covers seated police bullet deaths through the existing creator mapping.
Complete native source identity (including all passenger/remote vehicle cases),
havoc/chase/group fields, weapon/headshot-specific accounting, non-bullet police
deaths, other ambient crews and full task/retail parity remain open.

The live dead-passenger drag-out check kills a patrol cop with a remote
creator, then runs CJ's normal right-door entry and pull-out. The reconstructed
body remains at zero health with no cash, while kill/respect counters stay at
the values recorded immediately after the shot. Living driver/passenger jack
and fatal-driver exit regressions also pass. Validation: 37 focused units,
5,681 full-suite tests (51 skipped), a build and seven live browser checks.
