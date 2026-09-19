/* Dead pedestrians bloodying the tyres that roll over them.
 *
 * - CPed::DeadPedMakesTyresBloody (Ped.cpp 0x6B4200) is reversed: it scans the vehicles in the sectors within
 *   two units of the ped. Its per-vehicle half, CPed::MakeTyresMuddySectorList (0x6AE0D0), is a retail stub, so
 *   this follows the Vice City ancestor (reVC CPed::MakeTyresMuddySectorList), whose caller is the dead-ped
 *   branch of CPed::ProcessControl.
 * - A car within 10 units on each ground axis, moving faster than √0.05 units per frame across the ground, gets
 *   blood on each grounded, clean wheel whose approximate position lies within 1 unit of the body across the
 *   ground and 2 units vertically. The wheel positions are the collision box's corners at the car's height.
 * - A car heavier than 500 also takes an upward ApplyMoveForce of 50 × min(1, ped mass / 1000) and an upward
 *   ApplyTurnForce of 50 × min(1, ped turn mass / 2000) at the wheel.
 * Vectors are native (z up); speeds are per 1/50 s frame. The splatter sound and pad shake are not reproduced. */

type V3={x:number;y:number;z:number};
/** CPed's constructor: m_fMass and m_fTurnMass. */
export const PED_MASS=70,PED_TURN_MASS=100;
export interface TyreBloodCar {
 position:V3;right:V3;forward:V3;
 /** m_vecMoveSpeed.MagnitudeSqr2D(). */
 moveSpeed2DSq:number;
 mass:number;
 /** Collision bounding box, model space. */
 boundsMin:{x:number;y:number};boundsMax:{x:number;y:number};
 /** m_aSuspensionSpringRatio < 1, in eCarWheel order. */
 wheelsOnGround:readonly boolean[];
 /** m_wheelSkidmarkBloodState. */
 bloody:readonly boolean[];
}
export interface TyreBloodHit {
 wheel:number;
 /** ApplyMoveForce, then ApplyTurnForce(force, point − position), when the car is heavier than 500. */
 moveForce?:V3;turnForce?:{force:V3;point:V3};
}

/** One dead ped against one car: the wheels that turn bloody, with their forces. */
export function deadPedTyreBlood(ped:V3,car:TyreBloodCar,pedMass=PED_MASS,pedTurnMass=PED_TURN_MASS):TyreBloodHit[]{
 if(Math.abs(ped.x-car.position.x)>=10||Math.abs(ped.y-car.position.y)>=10||car.moveSpeed2DSq<=.05)return [];
 const {boundsMin:min,boundsMax:max}=car,hits:TyreBloodHit[]=[];
 // Front left, rear left, front right, rear right.
 const offsets=[[-max.x,max.y],[-max.x,min.y],[max.x,max.y],[max.x,min.y]];
 for(let wheel=0;wheel<4;wheel++){
  if(car.bloody[wheel]||!car.wheelsOnGround[wheel])continue;
  const [ox,oy]=offsets[wheel];
  const at={x:car.position.x+car.right.x*ox+car.forward.x*oy,y:car.position.y+car.right.y*ox+car.forward.y*oy,z:car.position.z+car.right.z*ox+car.forward.z*oy};
  if(Math.abs(at.z-ped.z)>=2||(at.x-ped.x)**2+(at.y-ped.y)**2>=1)continue;
  const hit:TyreBloodHit={wheel};
  if(car.mass>500){
   hit.moveForce={x:0,y:0,z:50*Math.min(1,pedMass*.001)};
   hit.turnForce={force:{x:0,y:0,z:50*Math.min(1,pedTurnMass*.0005)},point:{x:at.x-car.position.x,y:at.y-car.position.y,z:at.z-car.position.z}};
  }
  hits.push(hit);
 }
 return hits;
}
