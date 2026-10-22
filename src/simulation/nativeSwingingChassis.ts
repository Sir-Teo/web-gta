import {NativeDoor,DOOR_AXIS,type CarAxes,type Vec} from './nativeDoor';
const f=Math.fround;
const dot=(a:Vec,b:Vec)=>f(f(f(a[0]*b[0])+f(a[1]*b[1]))+f(a[2]*b[2]));
/** CAutomobile's seventh CDoor. The fire ladder and handling's swinging chassis keep a fixed active door state.
 * CDoor::Process runs in PreRender, once per game frame, and adds angular velocity without timestep scaling. */
export class NativeSwingingChassis extends NativeDoor {
 constructor(readonly kind:'chassis'|'firetruck',limit:number){super(f(limit*Math.PI),f(-limit*Math.PI),DOOR_AXIS.negY|0x80|(kind==='chassis'?0x40:0x100),DOOR_AXIS.z);}
 step(deltaVelocity:Vec,axes:CarAxes,timeStep:number,reduced=false){
  const world:Vec=[deltaVelocity[0],deltaVelocity[1],f(deltaVelocity[2]+f(f(timeStep)*f(.008)))],local:Vec=[dot(world,axes.right),dot(world,axes.forward),dot(world,axes.up)],direction=this.direction();
  const torque=f(f(local[0]*f(direction[1]))-f(local[1]*f(direction[0]))),t=f(timeStep);
  if(this.kind==='chassis'){
   this.angVel=f(this.angVel+f(f(reduced?0:.025)*torque));
   this.angVel=f(f(f(Math.pow(f(reduced?.95:.98),t))*this.angVel)-f(f(t*this.angle)*f(.06)));
  }else{
   if(Math.abs(torque)>f(.001)||Math.abs(this.angVel)>f(.001))this.angVel=f(this.angVel+torque);
   this.angVel=f(f(f(.92)*this.angVel)-f(f(t*this.angle)*f(.01)));
  }
  const cap=f(this.kind==='chassis'?.02:.05);this.angVel=Math.max(-cap,Math.min(cap,this.angVel));
  this.angle=f(this.angle+this.angVel);
  if(this.angle>this.openAngle){this.angle=this.openAngle;this.angVel=f(this.angVel*f(-.8));}
  else if(this.angle<this.closedAngle){this.angle=this.closedAngle;this.angVel=f(this.angVel*f(-.4));}
 }
}
/** CAutomobile constructor: m_bSwingingChassis takes precedence over the fire-truck special case. */
export function createSwingingChassis(model:number,handlingFlags:number){
 if(handlingFlags&0x10000000)return new NativeSwingingChassis('chassis',model===598||model===419?.03:model===409?.01:.02);
 if(model===544)return new NativeSwingingChassis('firetruck',.1);
}
