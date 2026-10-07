/* CVehicle::FlyingControl for fixed-wing aircraft as the iOS executable has it (0x10047a098 .. 0x10047c008; the plane
 * branch 0x10047ab78 .. 0x10047bbe4, the common tail 0x10047bbe8 .. 0x10047bfc0), with what CPhysical::ProcessControl does
 * first (ApplyGravity 0x1002493e4, ApplyAirResistance 0x100249680) and CPlane::ProcessFlyingCarStuff around it
 * (0x100469e9c). gta-reversed has only a fragment of FlyingControl; the browser's flight had been authored.
 *
 * Native units throughout: world axes x east, y north, z up; moveSpeed in units a 50 Hz step, turnSpeed in radians a
 * step, `ts` CTimer::ms_fTimeStep (1 at 50 fps). Every force FlyingControl applies is premultiplied by the mass and
 * every torque by the turn mass, which ApplyMoveForce and ApplyTurnForce divide back out, so the code below works in
 * the resulting changes of speed and spin; a turn force D applied at comW + X turns by X × D. */
import type {FlyingHandling} from '../assets/flyingHandling';

/** An aircraft's controls as the browser gathers them: the throttle (gas − brake), pitch (positive nose up), roll
 * (positive to the right), rudder (positive to the right) and the brakes. */
export interface PlaneControls {throttle:number;pitch:number;roll:number;rudder:number;brake:boolean}

export type NativeVec=[number,number,number];
const dot=(a:NativeVec,b:NativeVec)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:NativeVec,b:NativeVec):NativeVec=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const add=(a:NativeVec,b:NativeVec,k=1):NativeVec=>[a[0]+b[0]*k,a[1]+b[1]*k,a[2]+b[2]*k];
const scale=(a:NativeVec,k:number):NativeVec=>[a[0]*k,a[1]*k,a[2]*k];
const length=(a:NativeVec)=>Math.hypot(a[0],a[1],a[2]);

/** CVehicle::FlyingControl's flight models (eFlightModel): the RC Baron, and every other plane. */
export const FLIGHT_MODEL={baron:1,plane:3} as const;
/** CVehicle::HeightAboveCeiling (iOS 0x10047a004): 800 for planes; the RC Baron's band starts at 500. */
export function heightAboveCeiling(z:number,model:number){
 if(model===1||model===2)return z<500?-1:z<950?z-500:z<1500?-1:z-500;
 return z<800?-1:z-800;
}
/** The aircraft as FlyingControl reads and changes it. `tailY` is the collision box's min.y (negative); `comWorld` the
 * centre of mass turned into world axes; `allWheelsInAir` whether all four suspension compressions are 1. */
export interface FlyingBody {
 moveSpeed:NativeVec;turnSpeed:NativeVec;position:NativeVec;
 right:NativeVec;forward:NativeVec;up:NativeVec;comWorld:NativeVec;
 tailY:number;allWheelsInAir:boolean;
 /** CPlane::m_fLandingGearStatus: 0 down, 1 up. */
 gearStatus:number;
}
/** FlyingControl's four arguments for a plane: the rudder (m_fLeftRightSkid, positive to the right), the pitch
 * (m_fSteeringUpDown, positive nose up), the roll (m_fSteeringLeftRight, positive rolling right) and the throttle
 * (m_fAccelerationBreakStatus, (gas − brake) / 255). */
export interface FlyingInputs {rudder:number;pitch:number;roll:number;accel:number}

/** The iOS stick factor (0x10047a6b4): 1 / cos of the stick's angle from its nearest axis, 1 on an axis and √2 on a
 * diagonal, mapping the round stick onto a square. It scales the rudder and the pitch. */
export function stickFactor(rudder:number,pitch:number){
 const angle=Math.atan2(pitch,rudder),q=Math.PI/4;
 const off=angle>-q&&angle<=q?0:angle>q&&angle<=3*q?-Math.PI/2:angle>3*q?-Math.PI:angle>-3*q?Math.PI/2:Math.PI;
 return 1/Math.cos(angle+off);
}

/** CPhysical::ApplyGravity and ApplyAirResistance for an aircraft (a vehicle: the resistance grows with speed, and the
 * spin loses 1% a step whatever the step). `airResistance` is fDragMult / 2000, × fGearUpR with the gear up. */
export function applyGravityAndAirResistance(body:FlyingBody,airResistance:number,ts:number){
 body.moveSpeed[2]-=.008*ts;
 const k=airResistance*length(body.moveSpeed);
 body.moveSpeed=scale(body.moveSpeed,Math.pow(Math.max(0,1-k),ts));
 body.turnSpeed=scale(body.turnSpeed,.99);
}

/** FlyingControl's plane branch and common tail for `model` 3 (planes) or 1 (the RC Baron). `vortex` is the hovercraft
 * (539), whose thrust steers and which never counts as airborne. `wind` is −CWeather::WindDir × fWindMult (none for a
 * mission vehicle). Returns the stall time FlyingControl adds for the audio, in ms. */
export function planeFlyingControl(body:FlyingBody,flight:FlyingHandling['values'],input:FlyingInputs,model:number,ts:number,o:{vortex?:boolean;wind?:NativeVec}={}){
 const F=body.forward,R=body.right,U=body.up,wind=o.wind??[0,0,0];
 const vel=add(body.moveSpeed,wind),K=stickFactor(input.rudder,input.pitch);
 const turn=(D:NativeVec,X:NativeVec,c:number)=>{body.turnSpeed=add(body.turnSpeed,cross(X,D),c);};
 // CPhysical::GetSpeed at a point: the move speed plus the spin about the centre of mass.
 const speedAt=(point:NativeVec)=>add(body.moveSpeed,cross(body.turnSpeed,add(point,body.comWorld,-1)));
 // The RC Baron carries half its weight.
 if(model===FLIGHT_MODEL.baron)body.moveSpeed[2]+=.004*ts;
 const fwd=dot(vel,F),accel=input.accel;
 // Thrust: in the air (or with the throttle open) 0.5 × fThrust × (accel + 1), falling off with the forward speed; on
 // its wheels with the throttle shut, none, or a reverse push when nearly still.
 let thrust:number;
 const airborne=!o.vortex&&body.allWheelsInAir;
 if(airborne||accel>0){
  thrust=o.vortex?accel*flight.thrust:.5*flight.thrust*(accel+1);
  if(fwd>0&&flight.thrustFallOff<1){
   const d=flight.thrustFallOff>=0?fwd-flight.thrustFallOff:fwd+flight.thrustFallOff,k=flight.thrustFallOff>=0?-.65:-3;
   thrust*=Math.max(1+k*d*d,0);
  }
 }else{
  thrust=0;
  if(accel<0&&dot(F,body.moveSpeed)<.02)thrust=Math.min(accel-7.76*fwd,0)*flight.thrust;
 }
 body.moveSpeed=add(body.moveSpeed,F,.008*thrust*ts);
 // Quadratic side slip.
 const side=dot(vel,R);
 body.moveSpeed=add(body.moveSpeed,R,-flight.sideSlip*side*Math.abs(side)*ts);
 // Yaw through the tail: the rudder by the forward speed (the Vortex's thrust steers too), and the tail's side speed
 // stabilising it.
 const tail=scale(F,body.tailY),tailSpeed=speedAt(tail),tailSide=-dot(tailSpeed,R);
 let yaw=o.vortex?(fwd>0?Math.max(fwd,thrust):Math.min(fwd,thrust))*input.rudder*K*flight.yaw:fwd*input.rudder*K*flight.yaw;
 yaw+=flight.yawStabilization*tailSide*Math.abs(tailSide);
 turn(R,tail,yaw*ts);
 // Roll by the forward speed, and the roll stabiliser levelling the wings (fRollStab is negative in the data).
 turn(R,U,flight.roll*input.roll*fwd*ts);
 let H:NativeVec=[F[1],-F[0],0];if(U[2]<=0)H=scale(H,-1);
 const s=R[2]>0?-1:1;
 turn(R,U,s*(1-dot(H,R))*(1-Math.abs(F[2]))*flight.rollStabilization*.5*ts);
 // Pitch through the tail: the elevator by the forward speed, and the tail's up speed stabilising it.
 const tailUp=dot(tailSpeed,U);
 turn(U,tail,(-flight.pitchStabilization*tailUp*Math.abs(tailUp)-input.pitch*K*flight.pitch*fwd)*ts);
 // Lift: fwd² × (fFormLift − fAttackLift × the angle of attack); fFormLift × fGearDownL while the gear is not fully up
 // (the RC Baron's capped instead). Above the ceiling, lift past the weight is cut to the weight, fading to none 50 up.
 const aoa=Math.asin(Math.max(-1,Math.min(1,dot(vel,U)/Math.max(length(vel),.01))));
 const stallMs=aoa< -.733?Math.trunc(ts/50*1000):0;
 let formLift=flight.formLift;
 if(model===FLIGHT_MODEL.baron){if(fwd*fwd*formLift>.004)formLift=.004/(fwd*fwd);}
 else if(body.gearStatus<1)formLift*=flight.gearDownLift;
 let lift=fwd*fwd*(formLift-flight.attackLift*aoa)*ts;
 if(lift>.008*ts){const h=heightAboveCeiling(body.position[2],model);if(h>0)lift=.008*ts*Math.max(1-h/50,0);}
 body.moveSpeed=add(body.moveSpeed,U,lift);
 flyingControlTail(body,flight,model,ts);
 return {stallMs};
}

/** FlyingControl's common tail: the turn resistance and speed resistance on each local axis (about R, F and U), the
 * speed-resistance part applied as a torque scaled by S (2|v| for planes, 6|v| for the RC Baron), then the caps of 1.5
 * units a step (75 m/s) and 0.2 radians a step. */
export function flyingControlTail(body:FlyingBody,flight:FlyingHandling['values'],model:number,ts:number){
 const axes=[body.right,body.forward,body.up],w=body.turnSpeed;
 const turnRes=[flight.turnResistanceX,flight.turnResistanceY,flight.turnResistanceZ],speedRes=[flight.speedResistanceX,flight.speedResistanceY,flight.speedResistanceZ];
 const v=length(body.moveSpeed),S=model===3||model===4||model===5?2*v:model===6||model===8?v+1:model===1?6*v:1;
 const local=axes.map(a=>dot(w,a)),deltas=[0,0,0];
 for(let i=0;i<3;i++){
  const k=Math.pow(turnRes[i],ts),l=local[i];
  if(speedRes[i]>0)deltas[i]=l*Math.pow(k/(speedRes[i]*l*l+1),ts)-l;
  else local[i]=Math.pow(k,S)*l;
 }
 body.turnSpeed=add(add(scale(axes[0],local[0]),axes[1],local[1]),axes[2],local[2]);
 for(let i=0;i<3;i++)if(S*deltas[i])body.turnSpeed=add(body.turnSpeed,axes[i],S*deltas[i]);
 const v2=dot(body.moveSpeed,body.moveSpeed);if(v2>2.25)body.moveSpeed=scale(body.moveSpeed,1.5/Math.sqrt(v2));
 const w2=dot(body.turnSpeed,body.turnSpeed);if(w2>.04)body.turnSpeed=scale(body.turnSpeed,.2/Math.sqrt(w2));
}

/** CPlane::ProcessControlInputs' smoothing of the pitch, roll and rudder toward the stick: 0.069 of the way a step. */
export function smoothPlaneInput(current:number,target:number,ts:number){
 return Math.max(-1,Math.min(1,current+(target-current)*.069*ts));
}
/** CPlane::ProcessFlyingCarStuff's propeller (m_fPropSpeed): toward 0.18 at idle, 0.34 at full throttle and 0.05
 * braking, 1 % of the way a step; the plane flies only with it over 0.05 (or moving faster than √0.05 a step). */
export function stepPropSpeed(prop:number,accel:number,ts:number){
 const target=.18+(accel>0?accel*(.34-.18):accel<0?accel*(.18-.05):0);
 return prop+(target-prop)*.01*ts;
}
