# Vehicle occupants as automatic weapon targets

`SET_VEHICLE_CAN_BE_TARGETTED` (084E) now changes the live vehicle's pedestrian lock-on eligibility.
SYN6 (mission 62, Toreno's Last Flight) enables its helicopter with local 149 at SCM 1637887.
The command remains authored because the port uses its existing touch angular picker rather than
the full native target scanner, priorities and target-breaking rules.

## Native evidence

The pinned executable is identified in [AIRCRAFT_WEAPONS.md](AIRCRAFT_WEAPONS.md#source-observations).
Its handler at `0x1001fe2b0` collects two operands and updates bit 42 of vehicle flags at +0x568.
Any nonzero second operand sets the bit. This is distinct from the heat-seeker targeting flag.

In gta-reversed revision `4281f82d8af83e14935ac84a69dfd1ceebb9f256`,
CVehicle::CVehicle (`0x6D5F10`) clears both vehicle flag words and does not enable
bVehicleCanBeTargetted; it separately enables bVehicleCanBeTargettedByHS.
CPlayerPed::PedCanBeTargettedVehicleWise (`0x609D90`) accepts an on-foot ped. An occupant
requires a vehicle and either a bike or bVehicleCanBeTargetted. TaskSimplePlayerOnFoot uses
the helper when deciding whether to release an existing target. The native target-scanning
functions remain retail calls in this reference.

The flag does not give general bullet immunity. The iOS instant-hit code does read it at
`0x1004956cc`/`0x1004956ec` and `0x100495f0c`/`0x100495f2c` when choosing a vehicle to
ignore for the firing pedestrian. The ordinary player firing path now applies that carrier
exception ([integration and limits](ATTACHED_PLAYER_GUNFIRE.md)); complete NPC/path coverage
remains incomplete. A free-aim ray into somebody else's unflagged vehicle can still hit its occupant.

## Integration and checks

WeaponSystem.automaticAimTargets supplies the existing touch camera picker with on-foot candidates
and eligible seated candidates from the live occupant provider. It gives each vehicle/seat pair a
stable negative key, independent of list order and on-foot Rapier collider handles. It uses drawn
head nodes when ready and the existing seated head offset otherwise. Script bike riders and
pillions now enter that provider as well as car, boat and aircraft occupants.

The provider keeps automatic targeting and bullet eligibility separate: never-targeted peds are
excluded from lock-on; can-be-shot-in-vehicle affects head intersection. Known crew membership,
dead drivers, occupied player vehicles, disposed vehicles and wrecks are excluded or marked for
the existing picker. Pedestrian targeting, shot and scorched flags survive the body's rebuild
when it gets into or out of a vehicle. Heat-seeker selection continues using hsTargetable.

Native general scanning, target priority and break rules, precise native aim-bone selection,
ambient bike population and complete occupant task/event coverage remain incomplete. Mouse
crosshair-ray detection continues through its existing path.

Units exercise the native gate, default flag, bike exception, original SYN6 operands, stable
seat keys, exclusions, real head-coordinate conversion and independent bullet/HS behavior.
The live browser check executes the original instruction against a helicopter pilot, verifies
selection with the touch picker and bullet head intersection, tests the bike exception and
round-trips the pedestrian flags through getting out and back in. Full SYN6 completion remains
unverified.
