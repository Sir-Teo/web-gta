/** CBouncingPanel: a damaged bumper or panel that sways on its frame (native units per 50 Hz step). */
import type {Vec} from './nativeDoor';
const BOUNCE_SPRING_DAMP_MULT=.95,BOUNCE_SPRING_RETURN_MULT=.1,BOUNCE_VEL_CHANGE_LIMIT=.1,BOUNCE_HANGING_DAMP_MULT=.98,BOUNCE_HANGING_RETURN_MULT=.02;
export class NativeBouncingPanel {
 rotation:Vec=[0,0,0];position:Vec=[0,0,0];
 constructor(readonly frame:string,readonly axis:0|1|2,readonly angleLimit:number){}
 private change(velocity:number){return Math.max(-BOUNCE_VEL_CHANGE_LIMIT,Math.min(BOUNCE_VEL_CHANGE_LIMIT,velocity))*this.angleLimit;}
 /** CBouncingPanel::ProcessPanel with default multipliers. `localDeltaVelocity` is the car-space velocity change of the
  * frame point since the previous step. Returns the frame basis entries to overwrite: [column, row, value]. */
 process(localDeltaVelocity:Vec,timeStep:number):[number,number,number][]{
  const v=localDeltaVelocity,p=this.position,r=this.rotation;
  if(this.axis===0){p[1]+=this.change(v[2]);p[2]+=this.change(v[1]);}
  else if(this.axis===1){p[0]+=this.change(v[2]);p[2]+=this.change(v[1]);}
  else{p[0]+=this.change(v[1]);p[1]+=this.change(v[0]);}
  const returnMult=this.axis===2?BOUNCE_HANGING_RETURN_MULT:BOUNCE_SPRING_RETURN_MULT,damp=Math.pow(this.axis===2?BOUNCE_HANGING_DAMP_MULT:BOUNCE_SPRING_DAMP_MULT,timeStep);
  for(let i=0;i<3;i++){p[i]-=returnMult*r[i]*timeStep;p[i]*=damp;r[i]+=p[i]*timeStep;}
  return this.axis===0?[[0,1,r[2]],[0,2,r[1]]]:this.axis===1?[[1,0,r[2]],[1,2,r[0]]]:[[2,1,r[0]],[2,0,r[1]]];
 }
}
