import type {DffModel} from '../assets/dff';
import type {BikeWheelFrames} from '../assets/bikeWheelFrames';
/* Where a bike's wheels hold it up.
 *
 * CBike rides on suspension lines set up from its wheel dummies (CBike::SetupSuspensionLines, like the car's: from
 * each wheel's position, down past the handling's lower limit by the wheel radius), not on its collision model, whose
 * spheres cover the frame and the rider. The browser's bike is a rigid body without springs: a ball the size of each
 * wheel (vehicles.ide's wheel size is its diameter), centred on the wheel dummy, stands in for the line, so the tyres
 * rest on the ground where SA's would instead of the frame dropping onto its spheres with the wheels sunk in. */
export interface BikeWheelSupport {center:{x:number;y:number;z:number};radius:number}
/** The frame's position in the clump's own (native, Z-up) space: its matrix composed up through its parents. */
export function frameModelPosition(model:Pick<DffModel,'frames'>,index:number){
 let x=0,y=0,z=0;
 for(let i=index;i>=0;i=model.frames[i].parent){
  const m=model.frames[i].matrix;
  const nx=m[0]*x+m[4]*y+m[8]*z+m[12],ny=m[1]*x+m[5]*y+m[9]*z+m[13],nz=m[2]*x+m[6]*y+m[10]*z+m[14];
  x=nx;y=ny;z=nz;
  if(model.frames[i].parent<0)break;
 }
 return {x,y,z};
}
/** One support per wheel dummy; a wheel without a size in vehicles.ide falls back on the other end's, then 0.6. */
export function bikeWheelSupports(model:Pick<DffModel,'frames'>,frames:BikeWheelFrames,frontSize?:number,rearSize?:number):BikeWheelSupport[]{
 const front=(frontSize??rearSize??.6)/2,rear=(rearSize??frontSize??.6)/2;
 return [...frames.front.map(i=>({center:frameModelPosition(model,i),radius:front})),...frames.rear.map(i=>({center:frameModelPosition(model,i),radius:rear}))]
  .filter(s=>s.radius>0&&[s.center.x,s.center.y,s.center.z].every(Number.isFinite));
}
