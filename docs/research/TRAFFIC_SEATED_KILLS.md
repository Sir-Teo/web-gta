# Traffic-driver damage and kill accounting

Traffic drivers now use the drawn model's peds.ide type and pedstats.dat
weakness. Accepted fatal damage reports the existing creator classification
immediately. A later driver coast, exit, drag-out or vehicle destruction
preserves the accounting marker instead of counting a replacement corpse.

## Reference and implementation

CEventHandler::RegisterKill (PC `0x4B9340`, gta-reversed revision
`4281f82d8af83e14935ac84a69dfd1ceebb9f256`) reports the fatal damage response
before subsequent tasks. The existing host distinguishes the player ped,
mapped player vehicle and remote source. The counter routes and remaining
source-identity limitations are described in [police accounting](POLICE_SEATED_KILLS.md#reference).

Model metadata comes from the existing native peds.ide/pedstats.dat parser;
looking it up does not request another model. Numeric VehicleOccupants models
index the shared packaged civilian roster. A gang assigned by the population
system retains its existing type override. A model's name does not imply the
DEALER ped type: the native drug models are CRIMINAL in peds.ide.

The original weapon factor is multiplied by the model's weakness using float32
arithmetic. The ordinary death threshold remains below one HP, with exactly
one surviving (ComputeWillKillPed, PC `0x4B3210`). Float32 subtraction prevents
JavaScript double rounding from incorrectly killing a one-HP remainder.
Forced instant-hit head death is separate from that factor, so a driver with
more than 1,000 HP still dies from an accepted fatal head shot.

WorldTraffic records death and its accounting marker before onDriverKilled.
Repeated contacts during the two-second coast return a corpse result without
another report. Driver descriptions and both death-body callbacks carry the
marker into the shared corpse restoration path. A later car explosion retains
it as well. CEventVehicleOnFire::AffectsPed (PC `0x4B4FD0`) requires IsAlive;
dead and dying drivers therefore cannot take the live fire/flee exit bridge.

## Checks and limits

Focused tests cover weakness, the exact-one boundary, forced death above 1,000
HP, all mapped creators, repeated/rejected contacts, destruction metadata and
living versus dead fire exits. The live trial reads the native metadata files
independently and uses generated traffic drivers with rendered heads. Actual
pistol and mounted-weapon shots test player-ped, vehicle and remote creators;
the trial waits for normal coast and body creation, checking counters at the
fatal hit, after repeated contacts and after reconstruction.

Complete source identity, NPC-to-ambient seated routing, arbitrary script
changes to ambient ped records, all native accounting fields and matched
retail task/render parity remain open. This change does not establish parity
for every non-bullet traffic death.

Validation: 30 focused tests, 5,712 full-suite tests (51 skipped), a build and
the live three-creator trial pass. Existing burning-driver, vehicle-explosion
and both carjacking response/get-up checks also pass.
