# Gunfire from an attached player

An attached player can now fire normally while his collision is disabled. The browser's weapon
guard previously rejected every shot with a disabled player collider, although ATTACH_CHAR_TO_CAR,
ATTACH_CHAR_TO_BIKE and ATTACH_CHAR_TO_OBJECT deliberately disable that collider. The body-enabled,
health and ordinary input/task gates still apply. Keyboard fire now spends ammunition aboard.

## Native carrier exclusion

The pinned iOS ordinary FireInstantHit branches at `0x1004956bc` and `0x100495efc` select
CWorld::pIgnoreEntity from the firing ped. An occupied vehicle is ignored if its
bVehicleCanBeTargetted flag is clear. Otherwise the code checks the attached entity; an attached
vehicle with that flag clear is ignored. A flagged vehicle is exposed to the ray. Bikes have
no special exception in this rule. A flagged occupied vehicle can fall through to a different
unflagged attachment. Non-vehicle attachments do not take this vehicle exception.

This is separate from automatic occupant targeting and from general bullet eligibility.
SET_VEHICLE_CAN_BE_TARGETTED does not grant somebody else's vehicle or occupants bullet immunity.
The reversed PC FireInstantHitFromCar2 (`0x73CBA0`) unconditionally excludes its vehicle,
so ordinary drive-by firing retains that separate behavior.

## Browser integration and checks

The main host supplies the current occupied/attached vehicle to the ordinary handheld bullet
path. The chosen body is excluded consistently from source-to-muzzle validation, the camera's
aim line, central instant hit, twin-pistol follow-up and shotgun pellets. Analytic wheel spheres
belonging to that excluded body are filtered too; excluding only its physical colliders left
those wheels able to intercept its own shots. Sniper, projectile, area and vehicle-gun paths
keep their separate rules.

Five unit checks cover native selection priority, collision-disabled firing, exposed bodywork,
shotgun pellets, wheel interception and unconditional drive-by exclusion. The live check uses
keyboard fire aboard, executes SYN6's original 084E instruction with the carrier handle, and
observes damage switching from the external pedestrian to the carrier's bodywork and back.
The carrier is now held through SCM freeze with active collision after the separate
[freeze correction](FROZEN_VEHICLES.md); the initial check used fixed colliders while diagnosing that bug. Car/bike attachment and occupant
targeting browser regressions pass. Full SYN6 and attached-platform mission completion remain
unverified.

The command remains authored: native automatic scanning and complete NPC task/event coverage
remain incomplete. This addition covers the ordinary player firing path; it does not establish
all firing-ped, attachment, sniper or shared world-query behavior. Source identity is recorded
in [VEHICLE_PED_TARGETING.md](VEHICLE_PED_TARGETING.md).
