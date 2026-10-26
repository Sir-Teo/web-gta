# Surviving wounds through traffic and gang exits

Traffic and gang occupants previously retained death descriptions when leaving
their vehicle, but omitted surviving health. The foot-body reconstruction
therefore used its constructor defaults. A wounded driver or gunner could
recover to 100 HP when dragged out or when leaving after CJ took the car.
Traffic fire/flee and road-rage exits used the same default-body path.

## Native contract

CTaskSimpleCarSetPedSlowDraggedOut::ProcessPed (PC `0x64C220`, gta-reversed
revision `4281f82d8af83e14935ac84a69dfd1ceebb9f256`) operates on the existing
CPed. It removes vehicle membership, chooses the default task, restores
collision and weapon selection, positions the ped and resets movement state.
It does not create a new pedestrian or reset health/armour. The browser's
separate seat and foot representations therefore need to copy those fields.

LeavingDriver now has optional generic vitals. Traffic drivers, gang drivers,
gang front passengers and the undragged gang passenger's exit description
supply their current health and zero armour. Existing police descriptions
retain their officer-specific vitals route. The main host forwards live wounds
through jacking, the passenger's delayed automatic exit and traffic fire,
leave-and-flee and road-rage callbacks.

The common spawnFromCar path restores supplied vitals before after-spawn
callbacks, dragged-out/get-up reactions or flee responses. This copies an
existing state: it applies no damage factor, threshold, kill event or revival.
Positive fractional health produced by direct scripted damage remains positive.
Calls with no retained vitals keep the constructor defaults. Counted corpses
continue through the existing separate corpse-restoration path.

## Verification and scope

The regression tests expose nine failures before the change. They cover named
native models and packaged roster indices, all three foot spawn routes, default
construction, fractional health, callback ordering and seat descriptions.
The surrounding focused checks cover cop armour and seated kill accounting.
The live trial wounds real generated traffic and native adopted gang crews,
then uses CJ's ordinary door entry to check the dragged-out and undragged
occupants from both gang-car doors.

All three door trials pass: the traffic driver retains 72.5 HP, and each gang
occupant retains its own 75/60 HP from either door, including when both models
are identical. A separate burning-car trial observes the restored driver at
the actual flee handoff: the same model, 75 HP, zero armour and the native
15-unit flee target. The build and 52 focused tests pass.

The full suite passes 5,741 tests (51 skipped). Existing burning-driver,
previously counted dead-cop drag-out and fatal traffic-driver coast checks
also pass, alongside the wounded fire handoff: seven live browser checks.
Production walking, driving, map, takeoff and gear checks pass. The first
production takeoff collided near the boneyard after a low hop; the dedicated
plane case and an instrumented reproduction pass. Production verification
then passes with the same speed/height criteria at a regular 100 ms control
cadence; the initial failure capture remains available for flight investigation.

This preserves health/armour for the named transitions. Other CPed fields,
complete emergency-crew damage and native task/render identity remain open.
