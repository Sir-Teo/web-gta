/** Rapier solver groups for contacts whose response is computed natively rather than
 * by the solver. Contacts are still detected; only the solver forces are skipped.
 * Car-to-pedestrian impacts follow CPhysical::ApplyCollision's ped branch in
 * WorldPedestrians, where the car counts ten times its mass instead of meeting a
 * kinematic wall. Memberships sit in the high 16 bits, filters in the low 16. */
const CAR=0x0002,PED=0x0004,FALLEN=0x0008;
const groups=(membership:number,filter:number)=>((membership<<16)|(filter&0xffff))>>>0;
export const CAR_SOLVER_GROUPS=groups(CAR,0xffff&~PED);
export const PED_SOLVER_GROUPS=groups(PED,0xffff&~CAR);
/** CObject::ProcessEntityCollision for a lamp post (bIsLampPost) leaning past GetUp().z < 0.66: vehicles ignore its
 * collision entirely, so no solver response between them. */
export const FALLEN_LAMPPOST_SOLVER_GROUPS=groups(FALLEN,0xffff&~CAR);
