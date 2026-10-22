# Object/world intersection

Research continuation, October 21, 2026. IS_OBJECT_INTERSECTING_WORLD (09FC) now reaches a current-pose COL query. ZERO4 calls it three times for its moving objects.

The hash-verified ARM64 executable identified in [remote control](REMOTE_CONTROL.md#evidence) has the 2500-range
command dispatcher at 0x100204ef4, with signed relative jump table at 0x100206d74. Entry 56 is handler
0x100205a94: collect the object handle, resolve the object pool entry, call virtual slot +0x70 with argument false,
and forward its boolean to UpdateCompareFlag through 0x100206ce0. The virtual routine is
CPhysical::TestCollision at 0x10024c8a4 (also present in the plane vtable, 0x1005c0d08 + 0x70).

The routine matches the fully reversed pinned gta-reversed implementation (revision
`4281f82d8af83e14935ac84a69dfd1ceebb9f256`, `source/game_sa/Entity/Physical.cpp`, PC 0x54DEC0):

- Save the matrix and collision-enabled bit; set force-hit-return-false and skip-line flags, then temporarily clear
  the object's own uses-collision bit. The query still tests its model even if its original collision bit was clear.
- ApplySpeed is conditional on the argument; this command passes false, so it tests the current pose.
- CheckCollision (iOS 0x10024a1dc; reversed PC 0x54D920) visits sectors intersecting the object's bound rectangle.
  ProcessCollisionSectorList checks buildings, vehicles, peds and objects, skips self, already-scanned and
  collision-disabled candidates, and honors collision-ignore relationships.
- In this query path, a nonignored collision with at least one ProcessColModels contact returns true immediately.
  It is not a past collision-record query and does not require SET_OBJECT_RECORDS_COLLISIONS.
- Restore the matrix, collision bit and temporary flags. The object does not move as a result of asking.

The browser already has live script-object COL geometry, current native object matrices and explicit ignored body
pairs. HAS_OBJECT_COLLIDED_WITH_ANYTHING currently uses a 0.1 contact margin and a records-collisions gate;
SLIDE_OBJECT tests peds/vehicles only. Neither is the contract of this command. A current-pose query needs its own
host method, must wait for pending geometry, must include fixed world and other physical entities, and must test
an object's shapes even while its own colliders are disabled (for example, a held object). Native per-pair collision
filters and the no triangle-versus-triangle rule need to be preserved or called out explicitly.


## Integration and checks

`nativeObjectIntersection.ts` caches query shapes from original COL spheres, boxes and triangles. It converts native
axes once, rotates each primitive at the script record's current pose and tests candidates from the physics world.
There is no touching margin or collision-record gate. Sphere/box/triangle pair selection follows ProcessColModels:
box/box, box/triangle and triangle/triangle do not create contacts. The existing pedestrian capsule represents a
ped's collision geometry. No query body is created or moved, and the object's own collision bit can stay off.

`ScriptObjectViews` waits for the model COL independently of visual readiness. `ScmMission` retries the instruction
while geometry is pending. The host excludes self (including an adopted map placement), disabled/sensor candidates,
explicit ignored body pairs, attachment parents/children and objects sharing a parent. Other script objects' current
collision bits are checked even if their physical views have not yet mirrored that change.

Six geometry/filter tests plus an adapter test pass. The live `object-world-intersection` case uses ZERO4's barrel2:
no contact with only itself, contact with a physical sphere, a positive query while its own collision and collision
records are off, immediate false/true results after moving its script record away/back without a physics frame, and
false after removing the obstacle. The existing `script-touching` regression also passes. Production build passes.

The query uses the port's Rapier primitive geometry and available entity/attachment flags. It does not reproduce
native sector ordering, contact-point selection or CPhysical flags that the surrounding engine has not modeled.
The focused checks do not establish a complete ZERO4 pass. Its interior RC handoff and keyboard climb subsequently passed after extending SORT_OUT_OBJECT_COLLISION_WITH_CAR to aircraft.


### ZERO4's collision-ignore binding

The first mission run gave up on SORT_OUT_OBJECT_COLLISION_WITH_CAR for its RC helicopter. The ARM64 handler
0x1001e4364, through 0x1001e4580–0x1001e45c4, resolves the object and **vehicle** pools and stores the vehicle
pointer at object +0x180 without an automobile/model check. The host now accepts a physical body from any supported
vehicle class, retains the existing ignore hooks and drops them when the pair separates or either entity disappears.
Its existing bounding-volume release approximation remains. A live RC-helicopter/barrel check passes alongside the
original van/crate regression; the object/world query honors the same ignored body pair.
