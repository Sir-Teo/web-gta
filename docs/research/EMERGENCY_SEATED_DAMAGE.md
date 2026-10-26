# Seated emergency-crew damage and retained vitals

Ambulance and fire-engine crews were drawn in their seats but excluded from
the seated bullet targets. Their managers also held no seat health. The new
emergency target route includes the actual seated medics/firefighters, applies
the drawn model's native weakness and retains health/armour through foot exits,
returns and drag descriptions.

## Source and damage contract

CEmergencyPed::CEmergencyPed (PC `0x5DE340`, gta-reversed revision
`4281f82d8af83e14935ac84a69dfd1ceebb9f256`) uses CPed's ordinary 100 health and
zero armour. It sets the model and speech without a cop-style armour addition.
Native peds.ide assigns LA/SF/LV medics MEDIC/STAT_MEDIC and firefighters
FIREMAN/STAT_FIREMAN. The corresponding pedstats.dat weaknesses are 1.4 and
0.8, so an ordinary 25-point factor removes 35 or 20 health before armour.

The original weapon factor is retained separately from forced instant-hit head
death. Float32 damage multiplication/subtraction keeps the ordinary below-one
death boundary, with exactly one HP surviving. Armour uses the existing shared
absorption helper, with its fall/drowning exceptions. A dead, absent, occupied,
exiting or invalid seat cannot report another fatal transition. The renderer
uses the existing dead-in-car clips for occupied dead seats.

## Fatal state, creators and body ownership

The first fatal accepted hit marks its accounting state before the callback.
The main host routes its native ped type and mapped player-ped, player-vehicle
or remote creator through the existing onKill path. The counter routing and
source-identity limits follow [police accounting](POLICE_SEATED_KILLS.md#reference).
MEDIC and FIREMAN have no special respect award in
CDarkel::RegisterKillByPlayer (PC `0x43DCD0`).

A driver's fatal hit drops its car mission and starts the existing two-second
DieInCar coast. The stopped driver takes the animated exit/body bridge; a car
that cannot support that exit retains its dead seat. Counted body restoration
does not apply another synthetic weapon hit or produce cash. Driver death also
stops the fire engine's NPC cannon.

Carjacking takes ownership of the corpse when drag-out starts. The death coast
is cancelled then, preventing a second body callback after the drag. Player
ownership is checked before the emergency death controller, so it cannot keep
writing NPC brake controls after CJ takes the vehicle. The death and live-vitals
hooks are installed inside the emergency manager's asynchronous construction.

## Foot transitions

Normal medic and fireman exits pass their current seat vitals into spawnCrew.
The foot crew-state query exposes actual health/armour; a medic returning to a
seat copies these values before entry and clears the old seat's death marker.
Driver and fire-truck passenger descriptions use the shared live/dead
[occupant handoff](OCCUPANT_EXIT_VITALS.md). Dead crew cannot begin a live exit.

## Checks and remaining scope

Focused checks cover native model weakness/type, mapped creators, high-health
forced heads, armour, exact-one survival, eligibility, repeated hits, the death
coast and stopped/moving body choices, dead cannon control, foot wounds and
returns, player ownership and drag-out cancellation.

The live matrix requests real services through the native emergency-service
script command. It independently reads the model metadata files, tests both
actual rendered seats for both vehicle types and all three mapped creators,
and waits for every driver's normal coast/body. Two real pistol head shots
reduce 5,000-HP drivers to zero and emit fatal-head blood; the other fatal cases
exercise the seated damage adapter. All twelve deaths report immediately;
repeat contacts and all six later bodies preserve the recorded totals.

Two further live cases hit a medic while CJ opens the door and drag out a
previously counted dead fireman passenger. The medic produces one corpse and
no later death-exit callback. The fireman stays dead while his living driver
retains 80 HP. The 53 focused checks, six-case matrix and both drag-out cases
pass.

The healthy ambulance CPR/revival and fire-engine cannon/extinguishing checks
also pass. Their original wall-time arrival budget ended around 30 game
seconds, before the first eligible dispatch tick. The fixtures now wait for
the native 30/35-second cooldown before starting that same arrival budget;
they do not advance the clocks or shorten the service tasks. Captured dispatch
snapshots record enabled gates and successful services at 37.3/37.2 game seconds.
AddFiretruckOccupants (PC `0x41C600`) and
CTaskComplexDriveFireTruck::CreateFirstSubTask (`0x65B140`) confirm that the
driver owns the fire search/drive/cannon sequence; the passenger's initial
subtask is CarDrive.

The final build and full unit suite pass: 5,769 tests, with 51 skipped.
Production walking, driving, map, aircraft takeoff and gear checks also pass
with no page errors or failed requests.

Complete native source identity/accounting fields, NPC-to-ambient seated bullet
routing, non-bullet emergency deaths, full surviving-hit personality responses,
all CPed state across reconstruction and matched retail task/render parity
remain open.
