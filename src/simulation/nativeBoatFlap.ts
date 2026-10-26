import {DOOR_AXIS,type CarAxes,type Vec} from './nativeDoor';
const f=Math.fround;
const add=(a:Vec,b:Vec):Vec=>[f(a[0]+b[0]),f(a[1]+b[1]),f(a[2]+b[2])];
const sub=(a:Vec,b:Vec):Vec=>[f(a[0]-b[0]),f(a[1]-b[1]),f(a[2]-b[2])];
const cross=(a:Vec,b:Vec):Vec=>[f(f(a[1]*b[2])-f(a[2]*b[1])),f(f(a[2]*b[0])-f(a[0]*b[2])),f(f(a[0]*b[1])-f(a[1]*b[0]))];
const dot=(a:Vec,b:Vec)=>f(f(f(a[0]*b[0])+f(a[1]*b[1]))+f(a[2]*b[2]));
export interface BoatFlapMotion {axes:CarAxes;moveSpeed:Vec;turnSpeed:Vec;centerOfMass:Vec}
/** CBoat's CDoor, selected executable axis Z (the PC transcription instead names Y).
 * Native velocities are units per 50 Hz step; Process is called once per PreRender. */
export class NativeBoatFlap {
 readonly openAngle=f(Math.PI/10);readonly closedAngle=f(-Math.PI/10);
 readonly dirn=DOOR_AXIS.negY;readonly axis=DOOR_AXIS.z;
 angle=0;angVel=0;state=0;
 private oldMove:Vec=[0,0,0];private oldTurn:Vec=[0,0,0];
 /** The independently captured ordinary-boat integration region of CDoor::Process. */
 integrate(torque:number){
  torque=f(torque);
  if(Math.abs(torque)>f(.001)||Math.abs(this.angVel)>f(.001))this.angVel=f(this.angVel+torque);
  this.angVel=Math.max(-.5,Math.min(.5,f(this.angVel*f(.98))));
  this.angle=f(this.angle+this.angVel);this.state=0;
  if(this.angle>this.openAngle){this.angle=this.openAngle;this.angVel=f(this.angVel*f(-.8));this.state=1;}
  else if(this.angle<this.closedAngle){this.angle=this.closedAngle;this.angVel=f(this.angVel*f(-.4));this.state=2;}
 }
 step(position:Vec,motion:BoatFlapMotion,timeStep:number){
  const {axes,moveSpeed,turnSpeed,centerOfMass}=motion;
  const transform=(v:Vec):Vec=>[0,1,2].map(i=>f(f(f(axes.right[i]*v[0])+f(axes.forward[i]*v[1]))+f(axes.up[i]*v[2]))) as Vec;
  const offset=transform(position),com=transform(centerOfMass);
  // GetSpeed subtracts the transformed COM; the previous-speed expression in CDoor deliberately does not.
  const current=add(cross(turnSpeed,sub(offset,com)),moveSpeed),previous=add(cross(this.oldTurn,offset),this.oldMove),delta=sub(current,previous);
  delta[2]=f(delta[2]+f(f(timeStep)*f(.008)));
  const local:Vec=[dot(delta,axes.right),dot(delta,axes.forward),dot(delta,axes.up)],sin=f(Math.sin(this.angle)),cos=f(Math.cos(this.angle));
  // Rotated negative-Y direction about native Z: (sin(angle), -cos(angle), 0).
  this.integrate(f(f(local[0]*-cos)-f(local[1]*sin)));
  this.oldMove=[...moveSpeed];this.oldTurn=[...turnSpeed];
 }
}
