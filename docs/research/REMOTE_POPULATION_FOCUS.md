# Population and vehicle lifetime around remote control

The remote vehicle already owned streaming and active vehicle physics, but
population updates still measured from CJ. Released bikes, boats and aircraft
beside a remote Baron were deleted because CJ stood 500 units away. Traffic
loaded roads and checked completed spawns around CJ, while pedestrian creation
and retirement used the same stale centre. ZERO2's high frozen van also made
ordinary street peds fail the vertical population band.

Fleet retirement, traffic road loading/creation/retention and pedestrian
population updates now use the existing `Simulation.worldFocus`. Generator and
traffic asset-load completion checks read the current focus again, so an earlier
load does not retain CJ's old location. The existing range budgets, visibility
tests, mission ownership, occupied-vehicle protection and timers remain in use.
Direct interactions and pursuit targets continue to use actual player/entity
positions rather than the population centre.

## Native selection evidence

The pinned PC helpers FindPlayerCentreOfWorld (`0x56E250`) and its NoSniperShift
variant (`0x56E320`) prefer the remote vehicle over the occupied car or ped.
CarGenerator::CheckIfWithinRangeOfAnyPlayers (`0x6F2F40`) uses that centre;
CPopulation::ManagePopulation uses it for population retirement too. This differs
from FindPlayerCoors, which does not include the remote vehicle.

`scripts/research/native-world-centre.py` executes complete iOS helpers at
`0x10025680c` and `0x1002568c0` in Unicorn 2.1.4 with no intercepted calls. It
verifies SHA-256
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
Sixteen captures vary remote presence, occupancy and matrix/simple pose storage.
They establish returned entity/position priority with player index zero and
camera generation disabled. Camera-generated population policy and other player
indices are outside these captures.

The tests compare actual Simulation focus against every capture, then exercise
the fleet, traffic and pedestrian update methods with that focus. They cover all
retirement families, path-load coordinates, eligible distant ambient vehicles
and mission protection. Twenty-five of 49 cases failed before the fix. Together
with existing bike/boat focus checks, all 56 focused checks pass. The full suite
passes 4,762 unit tests (51 skipped), and the build passes.

The baseline browser releases a bicycle, boat and helicopter beside a held RC
Baron. All three were disposed within 2.2 seconds, while CJ remained at his
original coordinates. Baseline: `artifacts/remote-population-focus-before.json`.
The regression also checks retirement after the original remote hand-back.

The live regression now passes. Released vehicles stay through the RC phase and
retire after its original delayed hand-back. It also requires ordinary traffic
and pedestrians within the remote neighbourhood; the passing trace records five
peds and two traffic cars. CJ remains unchanged during remote control. The final
position check waits for home terrain and grounded state, using the existing
remote regression's 0.1-unit solver tolerance. The trace is
`artifacts/remote-population-focus.json`.

The ordinary Las Venturas car-park regression, scripted generator/suppression
regression and ZERO2's complete controlled combat/result/reward/cleanup also
pass on the same production code. Historical mission sweep bytes and census
classifications are unchanged.

This corrects centre ownership within existing population and streaming models.
It does not establish complete native population scheduling, range budgets,
camera policy, generation placement or reference lifetimes. See also
[bike/boat collision focus](REMOTE_VEHICLE_FOCUS.md) and
[remote-control integration](REMOTE_CONTROL.md).
