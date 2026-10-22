import RAPIER from '@dimforge/rapier3d-compat';
/** Rapier solver groups for contacts whose response is computed natively rather than
 * by the solver. Contacts are still detected; only the solver forces are skipped.
 * Car-to-pedestrian impacts follow CPhysical::ApplyCollision's ped branch in
 * WorldPedestrians, where the car counts ten times its mass instead of meeting a
 * kinematic wall. Memberships sit in the high 16 bits, filters in the low 16. */
const CAR=0x0002,PED=0x0004,FALLEN=0x0008,WORLD_MESH=0x0010,CAR_MESH=0x0020,POOL_BALL=0x0040,SCRIPT_OBJECT=0x0080;
const groups=(membership:number,filter:number)=>((membership<<16)|(filter&0xffff))>>>0;
export const CAR_SOLVER_GROUPS=groups(CAR,0xffff&~PED);
export const PED_SOLVER_GROUPS=groups(PED,0xffff&~CAR&~CAR_MESH);
/** CObject::ProcessEntityCollision for a lamp post (bIsLampPost) leaning past GetUp().z < 0.66: vehicles ignore its
 * collision entirely, so no solver response between them. */
export const FALLEN_LAMPPOST_SOLVER_GROUPS=groups(FALLEN,0xffff&~CAR&~CAR_MESH);
/** CCollision::ProcessColModels tests A's spheres against B's spheres, boxes and triangles, A's lines against B, and
 * B's spheres against A's boxes and triangles: never triangles against triangles. A vehicle's collision mesh meets
 * the world only through the world's spheres and boxes, and the world's mesh meets the vehicle only through the
 * vehicle's spheres and wheel lines. Without this a Picador's low tailgate faces sat on the road's faces and held the
 * pickup where it stood at full gas (INTRO2's drive from Ryder's driveway). */
export const WORLD_MESH_SOLVER_GROUPS=groups(WORLD_MESH,0xffff);
export const CAR_MESH_SOLVER_GROUPS=groups(CAR_MESH,0xffff&~PED&~WORLD_MESH&~CAR_MESH);
/** CObject::SpecialEntityPreCollisionStuff: rolling pool balls ignore ordinary CPhysicals.
 * Once pocketed they can collide with the table again; other pool balls retain bDisableZ in either state. */
export const POOL_BALL_ROLLING_SOLVER_GROUPS=groups(POOL_BALL,0xffff&~SCRIPT_OBJECT&~CAR&~PED&~CAR_MESH&~FALLEN);
export const POOL_BALL_FALLING_SOLVER_GROUPS=groups(POOL_BALL,0xffff);
export const SCRIPT_OBJECT_SOLVER_GROUPS=groups(SCRIPT_OBJECT,0xffff);
export const SCRIPT_OBJECT_MESH_SOLVER_GROUPS=groups(SCRIPT_OBJECT,0xffff&~CAR_MESH);
/** A vehicle collider's groups: its mesh apart from the rest. */
export const vehicleSolverGroups=(collider:RAPIER.Collider)=>collider.shapeType()===RAPIER.ShapeType.TriMesh?CAR_MESH_SOLVER_GROUPS:CAR_SOLVER_GROUPS;
