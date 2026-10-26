# Gang-wave car lifetime and release

An attack-wave drive-by car previously reached the ambient drive-by's
45-second removal branch even though its wave task has no such timeout.
The car and both visible crew members could disappear during an active war.
Wave cars now stay on their existing task while ordinary ambient drive-bys
retain their existing lifetime budget.

## Evidence

The pinned iOS executable's CreateAttackWave tail (`0x1001b15c0` onward) calls
GenerateOneEmergencyServicesCar, marks bPartOfAttackWave (flag bit 43 at vehicle
offset `0x568`), and sets MISSION_DO_DRIVEBY_FARAWAY (61), cruise 10 and style 2.
It also sets bNeverUseSmallerRemovalRange (bit 38), then creates the passenger's
Micro SMG drive-by task. The executable SHA-256 is
`9bc5884cc0f671ad426b2d8143ec3db3a88c78ab756685ed4352af7a08471e78`.
These observations establish the attack-car setup; they do not independently
reverse the complete PC vehicle-removal routine.

The same executable's removal routine starts at `0x1001929b8` and calls
CanBeDeleted at `0x100477080`. The bit-38 check at `0x100192e80` branches to
the larger range path. That path reads 170 at `0x10058c690`; the smaller path
reads 45 at `0x10058c868`. These are distance operands, with camera and extended
removal-range scaling in the larger path, rather than a 45-second task timer.
The disassembly is retained in artifacts/gang-wave-native-removal.txt.

ReleaseCarsInAttackWave (PC `0x445E20`, gta-reversed revision
`4281f82d8af83e14935ac84a69dfd1ceebb9f256`) clears wave membership and changes
vehicle creation type to RANDOM_VEHICLE. It does not replace the car's current
mission or clear its crew tasks. The main host's previously empty release
callback now reaches the drive-by manager. Released wave cars lose their wave
driver blips, retain their crew/wounds and continue their current mission.

## Browser population budget

The browser still has a smaller population and collision window than retail.
A random wave car outside its existing 250-unit active radius can retire only
when the existing camera visibility predicate permits a population change.
Its script-car mission is forgotten when the manager removes it. A protected
mission car stays; taking a wave car releases manager ownership without
deleting the player's car. This radius is an existing browser budget, not a
claim that the complete native PossiblyRemoveVehicle logic has been ported.

## Verification

Fixed-step lifecycle tests cross 65 seconds without forcing the task clock.
They cover active and released wave cars, retained wounds and task identity,
the ordinary ambient deadline, visibility/radius/protection removal guards,
and player ownership. The live trial waits on the running game's own clock
past 50 seconds, then invokes the actual war-end host and checks the crew and
driving task after another five seconds. Normal war-wave progression is also
checked separately.

Complete native vehicle removal, pending async wave-generation cancellation,
defending-car ownership flags and matched retail task behavior remain open.

Validation: 25 focused tests, 5,720 full-suite tests (51 skipped), a build,
normal live war progression and the 50/55-second car-retention trial pass.
The first live attempt compared the transient per-frame steering controls;
the corrected trial compares the retained ScriptCarMissions task record.
