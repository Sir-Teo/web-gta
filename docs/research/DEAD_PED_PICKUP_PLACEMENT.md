# Captured dead-ped pickup placement

GET_DEAD_CHAR_PICKUP_COORDS calls CPed::CreateDeadPedPickupCoors at iOS
`0x1001c4140`, which reads the ped position and tail-calls
CPickups::CreatePickupCoorsCloseToCoors at `0x1001c416c`. The pinned PC reference
still delegates the latter routine to the executable.

Each of up to 32 attempts takes one rand() low byte, multiplies it by float32
2π/256, and uses a paired sine/cosine to choose a point 1.5 units around the ped.
The port previously drew separate X/Y angles, creating a square distribution
that could exceed two units diagonally and consuming twice as many random values.
The live dead-ped pickup browser exposed this with a 2.05-unit drop.

The corrected helper uses the shared angle and captured float32 arithmetic for
candidate coordinates, ground +0.5, middle/outer-edge positions, player distance,
radii and fallback height. It keeps the native 32 tries, vehicle/object line tests
for the first sixteen attempts, and relaxed player/pickup/vehicle exclusions from
attempt eighteen. Failure returns the ped's original point raised by float32 0.4.

`scripts/research/native-dead-ped-pickup.py` executes that routine in the pinned
executable using Unicorn 2.1.4. It intercepts RNG, sincosf, player position, ground,
line and vehicle queries. The pickup-pool scan executes over synthetic compressed
records. Seventeen fixtures cover several angles, differing successive draws,
world-scale rounding, exact/near player-distance boundaries, blocked pickup/car,
blocked line and absent ground. Host sin/cos rounded to float32 stands in for the
imported sincosf; this does not independently validate native libm.

All seventeen comparisons failed before the correction. They now match points,
draw counts and every captured ground/line/vehicle query exactly. The browser's
1.6-unit distance assertion is retained; its corpse and drop samples are taken
together to avoid frame-to-frame movement in the assertion.

The host still delegates occupancy to its existing world queries. Complete native
pickup-slot reuse, stale pool entries, collision ordering and libm parity remain
outside these captures. The fixtures do not establish every corpse or mission path.

All 3,749 unit tests pass (51 skipped), the build and four pickup browser checks
pass. The live drop remains within the original 1.6-unit assertion. The combined
browser also passes standard-command ground placement, pickup collection/rewards,
regeneration, repeated save-disc reporting and reporting collection to the SCM.
Census classifications and historical mission sweep bytes remain unchanged.
