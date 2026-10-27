# Gang-wave ownership across asset waits

Native CreateAttackWave is synchronous. The browser loads gang models, weapons,
path data and car assets asynchronously. Previously a released wave could
continue creating attackers after those waits, and its completion could mark
an ended war ready again or generate pickups and a drive-by car. The car host
also used the same string pending marker for every request, so an older request
could mistake a newer war's marker for its own.

## Release and completion

WorldPedestrians captures a generation when a wave or defender group begins.
ReleaseAttackWave advances that generation before releasing existing members.
Each spawn checks it before continuing the loop, after character metadata
loads and after weapon loads. A partial batch keeps its existing return count;
release already handles the peds that actually entered the population.

The main host also advances its generation and clears pending/ready state on
release. Old successful and failed batch callbacks cannot overwrite a newer
generation's state. Stale batches cannot generate their health/armour pickups
or request a drive-by car.

Every car request uses its own Symbol as an ownership marker. Its original gang
is captured with the model selection. Both placement completion and car-load
completion check the generation and marker; a stale placement creates nothing,
and an already-created stale car is removed instead of being adopted. Completion
and failure clear only the request's own marker.

## Script-car cleanup

The overlapping-load trial exposed a separate cleanup mismatch: the stale car
was rejected, but remained in the fleet. Wave cars use spawnScriptCar, which
does not set trafficOrigin; removeTrafficCar deliberately ignores them.
Stale creation now calls the general removeVehicle path. The wave manager's
distant-car retirement and disposal use that same path and forget their car
missions. Ordinary ambient drive-bys retain traffic-specific removal.

The unit fleet fixture now models the trafficOrigin guard instead of deleting
every car unconditionally. The live check completes two native car loads in
overlapping war generations: the older one must be disposed without clearing
the newer request, and only the newer one may receive the gang crew. That car
is then placed beyond the active radius at an unseen point; actual fleet,
manager and driving-task ownership must all clear.

These guards implement browser ownership across waits. They do not introduce a
new native war timer or change the existing wave composition. Native release
semantics follow ReleasePedsInAttackWave (PC `0x445C30`) and
[ReleaseCarsInAttackWave](GANG_WAVE_CAR_LIFETIME.md#evidence), with the native
attack setup decoded from the pinned iOS CreateAttackWave (`0x1001b0b58`).

## Verification and limits

Deferred-load tests cover character, movement, stats and weapon boundaries,
partial waves, a replacement generation, rejected loads and defenders. The live
host trial holds native model results, ends the war, then releases them. A second
case holds a point selected by the native car-placement routine before ending
the war, proving that stale delivery cannot invoke the car factory. A later
war must still create its own first and second waves and its own drive-by car.

This scope covers gang-wave creation and release. General population streaming,
complete native vehicle removal and matched retail task behavior remain open.

Validation: 25 focused tests, the two live host trials and the build pass.
The full suite passes all 5,729 tests (51 skipped) without concurrent build or
browser work. An earlier build/full-suite overlap exceeded the existing
15-second cutscene-bundle decoding limit; that file passes alone in 6.24 seconds
with the original limit, and the uncontended full run also passes.
