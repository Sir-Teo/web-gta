/** CDoor: hinged vehicle panels in native Z-up space; speeds are units per 50 Hz step. */
export const DOOR_AXIS={x:0,y:1,z:2,negX:3,negY:4,negZ:5} as const;
export const DOOR_EXTRA={based:0x10,lowGravity:0x20} as const;
/** eVehicleHandlingModelFlags used by door setup and entry. */
export const MODEL_FLAG={van:0x1,bus:0x2,low:0x4,big:0x8,reverseBonnet:0x10,hangingBoot:0x20,tailgateBoot:0x40,noswingBoot:0x80,noDoors:0x100,tandemSeats:0x200,convertible:0x800,bouncePanels:0x10000000} as const;
/** eDoors order (bonnet, boot, LF, RF, LR, RR) with the DFF frame that carries each panel. */
export const DOOR_NODES=['bonnet_dummy','boot_dummy','door_lf_dummy','door_rf_dummy','door_lr_dummy','door_rr_dummy'] as const;
export const DOOR={bonnet:0,boot:1,leftFront:2,rightFront:3,leftRear:4,rightRear:5} as const;
export type Vec=[number,number,number];
/** Orthonormal native world axes of the car matrix. */
export interface CarAxes {right:Vec;forward:Vec;up:Vec}
const DOOR_SPEED_MAX_CAPPED=.5,DOOR_DAMP_RATE=.97,DOOR_DAMP_RATE_BONNET=.97,DOOR_SPEED_MIN_LIMIT=.001,DOOR_SLAM_SHUT_SPEED=.1,POP_OPEN_DOOR_ACCEL_LIMIT=.1;
const dot=(a:Vec,b:Vec)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:Vec,b:Vec):Vec=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export class NativeDoor {
 angle=0;angVel=0;prevAngle=0;
 /** DOOR_HIT_MAX_END from the latest Open or Process. */
 hitOpenStop=false;
 constructor(readonly openAngle:number,readonly closedAngle:number,readonly dirn:number,readonly axis:number){}
 /** CDoor::Open. */
 open(ratio:number){this.prevAngle=this.angle;if(ratio>=1){this.angle=this.openAngle;this.hitOpenStop=true;}else{this.angle=ratio*this.openAngle;if(this.angle===0)this.angVel=0;}}
 /** CDoor::GetAngleOpenRatio. */
 get ratio(){return this.openAngle!==0?this.angle/this.openAngle:0;}
 /** CDoor::IsClosed. */
 get closed(){return this.angle===this.closedAngle;}
 /** CDoor::IsFullyOpen. */
 get fullyOpen(){return Math.abs(this.openAngle)-.5<=Math.abs(this.angle);}
 /** Door direction at the current angle. The pinned gta-reversed transcription negates the first rotated
  * component, which mirrors side doors inward and makes bonnets fall open; this is the plain rotation. */
 private direction():Vec{
  const dir:Vec=[0,0,0],d=this.dirn&0x0f;if(d<3)dir[d]=1;else dir[d-3]=-1;
  const sin=Math.sin(this.angle),cos=Math.cos(this.angle),a=(this.axis+1)%3,b=(this.axis+2)%3,newA=cos*dir[a]-sin*dir[b],newB=sin*dir[a]+cos*dir[b];dir[a]=newA;dir[b]=newB;return dir;
 }
 /** CDoor::Process. `deltaVelocity` is the world velocity change of the door point since the previous step.
  * Integration and the open/closed limits are scaled by the timestep; the damping is per 30 fps frame. Returns true when
  * slammed shut. */
 process(deltaVelocity:Vec,axes:CarAxes,timeStep:number){
  const lowGravity=!!(this.dirn&DOOR_EXTRA.lowGravity),world:Vec=[deltaVelocity[0],deltaVelocity[1],deltaVelocity[2]+timeStep*(lowGravity?.0016:.008)];
  const local:Vec=[dot(world,axes.right),dot(world,axes.forward),dot(world,axes.up)],ang=cross(local,this.direction())[this.axis];
  if(Math.abs(ang)>DOOR_SPEED_MIN_LIMIT||Math.abs(this.angVel)>DOOR_SPEED_MIN_LIMIT)this.angVel+=ang;
  // DOOR_DAMP_RATE (and the bonnet's) is applied once per game frame, unscaled: 30 frames for CTimer's 50 steps.
  this.angVel*=Math.pow(lowGravity?DOOR_DAMP_RATE_BONNET:DOOR_DAMP_RATE,timeStep*30/50);
  this.angVel=Math.max(-DOOR_SPEED_MAX_CAPPED,Math.min(DOOR_SPEED_MAX_CAPPED,this.angVel));
  this.prevAngle=this.angle;this.angle+=this.angVel*timeStep;this.hitOpenStop=false;
  const positive=this.openAngle>=this.closedAngle;
  if(positive?this.angle>this.openAngle:this.angle<this.openAngle){this.angVel*=-.8;this.angle=this.openAngle;this.hitOpenStop=true;}
  else if(positive?this.angle<this.closedAngle:this.angle>this.closedAngle){
   this.angle=this.closedAngle;
   if(this.dirn&DOOR_EXTRA.based&&Math.abs(this.angVel)>DOOR_SLAM_SHUT_SPEED){this.angVel=0;return true;}
   this.angVel*=lowGravity?-.9:-.4;
  }
  return false;
 }
 /** CDoor::ProcessImpact: a closed door pops open when the collision acceleration about its hinge exceeds 0.1 × U(0.75, 1.5).
  * The native code indexes the world-space cross product with the local hinge axis. */
 processImpact(deltaVelocity:Vec,axes:CarAxes,random:()=>number){
  const d=this.dirn&0x0f,base=[axes.right,axes.forward,axes.up][d%3],direction=(d<3?base:base.map(v=>-v)) as Vec;
  const ang=cross(deltaVelocity,direction)[this.axis],limit=(.75+random()*.75)*POP_OPEN_DOOR_ACCEL_LIMIT;
  return this.openAngle>=this.closedAngle?ang>limit:ang< -limit;
 }
}
/** CAutomobile::SetupModelNodes door initialisation from handling model flags. */
export function createCarDoors(modelFlags:number,modelId=0){
 const HALF_PI=Math.PI/2,PI=Math.PI,based=DOOR_EXTRA.based,bus=!!(modelFlags&MODEL_FLAG.bus),van=!!(modelFlags&MODEL_FLAG.van);
 const front=bus?HALF_PI:.4*PI;
 const bonnet=modelFlags&MODEL_FLAG.reverseBonnet?new NativeDoor(-.3*PI,0,DOOR_AXIS.negY|DOOR_EXTRA.lowGravity,DOOR_AXIS.x):new NativeDoor(.3*PI,0,DOOR_AXIS.y|DOOR_EXTRA.lowGravity,DOOR_AXIS.x);
 const boot=modelFlags&MODEL_FLAG.hangingBoot?new NativeDoor(-.4*PI,0,DOOR_AXIS.negZ|based,DOOR_AXIS.x):modelFlags&MODEL_FLAG.tailgateBoot?new NativeDoor(.5*PI,0,DOOR_AXIS.z|based,DOOR_AXIS.x):new NativeDoor(-.3*PI,0,DOOR_AXIS.negY|based,DOOR_AXIS.x);
 const rearLeft=van&&modelId!==432?new NativeDoor(-HALF_PI,0,DOOR_AXIS.x|based,DOOR_AXIS.z):new NativeDoor(-.4*PI,0,DOOR_AXIS.negY|based,DOOR_AXIS.z);
 const rearRight=van&&modelId!==432?new NativeDoor(HALF_PI,0,DOOR_AXIS.negX|based,DOOR_AXIS.z):new NativeDoor(.4*PI,0,DOOR_AXIS.negY|based,DOOR_AXIS.z);
 return [bonnet,boot,new NativeDoor(-front,0,DOOR_AXIS.negY|based,DOOR_AXIS.z),new NativeDoor(front,0,DOOR_AXIS.negY|based,DOOR_AXIS.z),rearLeft,rearRight];
}
