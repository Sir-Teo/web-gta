import type {BoatHandlingData} from '../assets/boatHandling';
import type {NativeVec} from './nativeBuoyancy';
/** CVehicle::ProcessBoatControl drive section (thrust, aquaplane lift, traction,
 * handbrake, resistance, turn damping, wave hits). Skimmer branches are omitted
 * (no skimmer vehicle); cheat flying is omitted. Speeds are native 50 Hz-step
 * units in the world frame; orientations are native-frame unit vectors. */
export interface NativeBoatDriveInput {
  gasPedal:number;steerAngle:number;handbrake:boolean;player:boolean;
  collidedWithWorld:boolean;postCollision:boolean;onWater:boolean;
  /** Host gravity over native gravity (20 m/s²), which the buoyancy is scaled by; the lift cap follows it. */
  gravityScale?:number;
  upZ:number;immersionDepth:number;lastImmersionDepth:number;
  buoyancyForceZ:number;buoyancyTurn:NativeVec;
  move:NativeVec;turn:NativeVec;
  forward:NativeVec;right:NativeVec;up:NativeVec;
  mass:number;turnMass:number;centerOfMass:NativeVec;
  boundsMinY:number;boundsMinZ:number;
  position:NativeVec;level:(x:number,y:number)=>number|undefined;
  timeStep:number;boat:BoatHandlingData;
  car:{tractionBias:number;tractionMultiplier:number;tractionLoss:number;suspensionLowerLimit:number;suspensionForceLevel:number;suspensionBiasBetweenFrontAndRear:number;brakeDeceleration:number;brakeBias:number;engineAcceleration:number};
}
export interface NativeBoatDriveOutput {move:NativeVec;turn:NativeVec;wake:boolean;engineInWater:boolean;waveVolume:number}
const dot=(a:NativeVec,b:NativeVec)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const add=(a:NativeVec,b:NativeVec):NativeVec=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const scale=(a:NativeVec,s:number):NativeVec=>[a[0]*s,a[1]*s,a[2]*s];
const sub=(a:NativeVec,b:NativeVec):NativeVec=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a:NativeVec,c:NativeVec):NativeVec=>[a[1]*c[2]-a[2]*c[1],a[2]*c[0]-a[0]*c[2],a[0]*c[1]-a[1]*c[0]];
const mag=(a:NativeVec)=>Math.hypot(a[0],a[1],a[2]);
/** CPhysical::ApplyTurnForce torque for a world-frame force at a world point. */
const turnTorque=(force:NativeVec,point:NativeVec,com:NativeVec,turnMass:number)=>{
 const arm=sub(point,com),q=cross(arm,force);
 return [q[0]/turnMass,q[1]/turnMass,q[2]/turnMass] as NativeVec;
};
export function nativeBoatDrive(input:NativeBoatDriveInput):NativeBoatDriveOutput{
 const {boat,car,timeStep:ts}=input;
 const toLocal=(v:NativeVec):NativeVec=>[dot(v,input.right),dot(v,input.forward),dot(v,input.up)];
 const toWorld=(l:NativeVec):NativeVec=>[input.right[0]*l[0]+input.forward[0]*l[1]+input.up[0]*l[2],input.right[1]*l[0]+input.forward[1]*l[1]+input.up[1]*l[2],input.right[2]*l[0]+input.forward[2]*l[1]+input.up[2]*l[2]];
 const com=toWorld(input.centerOfMass);
 let move:[number,number,number]=[...input.move] as NativeVec;
 let turn:[number,number,number]=[...input.turn] as NativeVec;
 let wake=false,engineInWater=true,waveVolume=0;
 // 0x6DBF0A: with the hull against the world, ApplyTurnForce(vecBuoyancyForce × 0.4, vecBuoyancyTurnPoint).
 if(input.collidedWithWorld&&input.buoyancyForceZ){
  const wallTurn:NativeVec=[0,0,input.buoyancyForceZ*.4*(input.gravityScale??1)];
  turn=add(turn,turnTorque(wallTurn,input.buoyancyTurn,com,input.turnMass));
 }
 // 0x6DC1E2 aquaplane lift.
 if(!input.postCollision&&input.onWater&&input.upZ>0){
  let fMoveForce=mag(input.move)**2*boat.aqPlaneForce*ts*input.buoyancyForceZ*.5;
  if(input.gasPedal<=.05)fMoveForce=0;else fMoveForce*=input.gasPedal;
  fMoveForce=Math.min(fMoveForce,ts*boat.aqPlaneLimit*input.mass/125*(input.gravityScale??1));
  const used=scale(input.up,fMoveForce);
  move=add(move,scale(used,1/input.mass));
  turn=add(turn,turnTorque(used,sub(input.buoyancyTurn,scale(input.forward,boat.aqPlaneOffset)),com,input.turnMass));
 }
 // 0x6DC3AF thrust.
 if(input.upZ>-.6){
  let fMoveSpeed=1;
  if(Math.abs(input.gasPedal)<=.05)fMoveSpeed=Math.hypot(input.move[0],input.move[1]);
  if(Math.abs(input.gasPedal)>.05||fMoveSpeed>.01){
   if(input.onWater&&fMoveSpeed>.05)wake=true;
   let traction=1;
   if(input.player){
    let loss=dot(input.move,input.forward)*car.tractionBias;
    if(input.handbrake)loss*=.5;
    traction=Math.max(0,Math.min(1,1-loss));
   }
   const change=-(traction*input.steerAngle),sin=Math.sin(change),cos=Math.cos(change);
   const thrustLocal:NativeVec=[0,input.boundsMinY*boat.thrustY,input.boundsMinZ*boat.thrustZ];
   const thrustPoint=toWorld(thrustLocal);
   const thrustPos=add(input.position,thrustPoint);
   const water=input.level(thrustPos[0],thrustPos[1]);
   if(water!==undefined&&thrustPos[2]-.5>=water)engineInWater=false;
   else{
    const depth=water===undefined?0:Math.min((water-thrustPos[2]+.5)**2,1);
    let slowing=false;
    const gasState=Math.abs(input.gasPedal);
    if(gasState<.01)slowing=true;
    else{
     if(gasState<.5)slowing=true;
     const angle=Math.abs(input.steerAngle);
     const steer:NativeVec=[-sin,cos,-angle];
     const forceWorld=toWorld(steer);
     const scaled=scale(forceWorld,depth*input.gasPedal*40*car.engineAcceleration*input.mass);
     if(scaled[2]>.2)scaled[2]=(1.2-scaled[2])**2+.2;
     if(input.postCollision){
      if(input.gasPedal<0){scaled[0]*=5;scaled[1]*=5;}
      scaled[2]=Math.max(0,scaled[2]);
      move=add(move,scale(scaled,ts/input.mass));
     }else{
      move=add(move,scale(scaled,ts/input.mass));
      const turnPoint=sub(thrustPoint,scale(input.up,boat.thrustAppZ));
      turn=add(turn,turnTorque(scale(scaled,ts),turnPoint,com,input.turnMass));
      const side=-dot(scaled,input.right)*car.tractionMultiplier;
      turn=add(turn,turnTorque(scale(input.right,side*ts),input.up,com,input.turnMass));
     }
    }
    if(!input.postCollision&&slowing){
     let loss=dot(input.move,input.forward)*car.tractionLoss;
     loss=Math.min(loss,input.turnMass*.01);
     if(gasState>.01){
      loss*=0.55-gasState;
      loss*=input.player?2.6:5;
     }
     if(input.gasPedal<0&&loss>0||input.gasPedal>0&&loss<0)loss*=-1;
     const lossWorld=toWorld(scale([-sin,0,0],loss));
     const applied=scale(lossWorld,depth*ts);
     move=add(move,scale(applied,1/input.mass));
     turn=add(turn,turnTorque(applied,thrustPoint,com,input.turnMass));
     const usedTs=Math.max(ts,.01);
     const vecTurn=scale(input.right,usedTs/traction*loss*sin*-.75);
     turn=add(turn,turnTorque(vecTurn,input.up,com,input.turnMass));
    }
   }
  }
 }
 if(car.suspensionBiasBetweenFrontAndRear!==0){
  const fwd=input.forward;
  // GetForward().Cross(ZAxis).
  const right:NativeVec=[fwd[1],-fwd[0],0];
  const mult=dot(right,input.move)*car.suspensionBiasBetweenFrontAndRear*ts*input.immersionDepth*input.mass*-.1;
  const x=right[0]*.3;
  const skewed:NativeVec=[right[0]-right[1]*.3,right[1]+x,right[2]];
  move=add(move,scale(skewed,mult/input.mass));
 }
 if(input.player&&input.handbrake){
  const fwdSpeed=dot(input.move,input.forward);
  if(fwdSpeed>0){
   const mult=fwdSpeed*car.suspensionLowerLimit*ts*input.immersionDepth*input.mass*-.1;
   move=add(move,scale(scale(input.forward,mult),1/input.mass));
  }
 }
 if(input.onWater&&!input.postCollision&&!input.collidedWithWorld){
  // ApplyBoatWaterResistance.
  const fSpeedMult0=(input.immersionDepth**2)*car.suspensionForceLevel*input.mass/1000;
  const fwdSpeed=dot(input.move,input.forward);
  let fSpeedMult=fSpeedMult0*(fwdSpeed*fwdSpeed+.05)+1;
  fSpeedMult=Math.abs(fSpeedMult);fSpeedMult=1/fSpeedMult;
  const usedTs=ts*.5;
  const res:NativeVec=[boat.moveRes[0]*fSpeedMult,boat.moveRes[1]*fSpeedMult,boat.moveRes[2]*fSpeedMult];
  const vecSpeedMult:NativeVec=[res[0]**usedTs,res[1]**usedTs,res[2]**usedTs];
  const local=toLocal(move);
  const damped:NativeVec=[local[0]*vecSpeedMult[0],local[1]*vecSpeedMult[1],local[2]*vecSpeedMult[2]];
  const fMassMult=(vecSpeedMult[1]-1)*damped[1]*input.mass;
  move=toWorld(damped);
  turn=add(turn,turnTorque(scale(input.forward,fMassMult),scale(input.up,-1),com,input.turnMass));
  if(move[2]<=0)move[2]*=(1-vecSpeedMult[2])*.5+vecSpeedMult[2];
  else move[2]*=vecSpeedMult[2];
 }
 if(!input.collidedWithWorld){
  const res:NativeVec=[boat.turnRes[0]**ts,boat.turnRes[1]**ts,boat.turnRes[2]**ts];
  let local=toLocal(turn);
  local=[local[0],local[1]*res[1],local[2]*res[2]];
  // The 1 / (1000x² + 1) factor is once a game frame with no timestep: a step takes its share of a frame of it.
  const fMult=res[0]*(1/(local[0]*local[0]*1000+1))**(ts*.6)*local[0]-local[0];
  const turnForce=scale(input.up,fMult*input.turnMass);
  turn=toWorld(local);
  turn=add(turn,turnTorque(turnForce,add(input.forward,com),com,input.turnMass));
 }
 // Wave hits.
 if(!input.postCollision&&input.onWater&&input.upZ>0){
  // The native measures the change in depth over one 30 fps frame and pushes once a frame: a step's change is scaled
  // up to a frame's, and the push takes the step's share of a frame.
  const share=ts*.6,fWaveMult=Math.floor((input.immersionDepth-input.lastImmersionDepth)*10000/share);
  waveVolume=fWaveMult*boat.waveAudioMult;
  if(fWaveMult>200){
   let zComp=mag(input.move)**2*fWaveMult/1000;
   zComp=Math.min(zComp,car.brakeDeceleration-input.move[2]);
   zComp=Math.max(zComp,0);
   const fMoveDotProd=dot(input.move,input.forward);
   const fTurnForceMult=fWaveMult*car.brakeBias*-.01;
   const waveMove=scale(input.forward,fTurnForceMult*fMoveDotProd);
   const total:NativeVec=[0,0,zComp];
   const summed=add(total,waveMove);
   const forced=scale(summed,input.mass*share);
   move=add(move,scale(forced,1/input.mass));
   turn=add(turn,turnTorque(forced,input.buoyancyTurn,com,input.turnMass));
  }
 }
 return {move,turn,wake,engineInWater,waveVolume};
}
