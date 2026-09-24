/** CTaskSimpleJetPack (TaskSimpleJetPack.cpp, reversed), the ROCKETMAN cheat's task. Everything here is in native
 * units and axes: x and y across the ground, z up, velocities in units a frame (×50 for metres a second) and angles in
 * radians. CCheat::JetpackCheat gives the player one with a cruise height of 10 and no target. */
const MAGIC=.008;
export const JET_PACK={
 /** THRUST_NOMINAL: the lift that always runs, halved while braking. Gravity is a full 0.008, so a hovering jetpack
  * sinks and only the forward thrust climbs. */
 nominal:.8,
 /** THRUST_FULL, with the forward tilt. */
 full:.6,
 /** THRUST_STRAFE. */
 strafe:.3,
 /** THRUST_STOP, the hover brake of the pad's look-behind button. */
 stop:.5,
 /** THRUST_MAX_ANGLE: 75° of tilt. */
 maxAngle:1.309,
 /** THRUST_MOVE_DAMPING. */
 moveDamping:.02,
 /** JETPACK_TURN_RATE and JETPACK_ANGLE_RATE. */
 turnRate:-.05,angleRate:.9,
 /** LEG_SWING_*: the legs hang and swing under the flier. */
 legSwingMax:.7854,legSwingDeltaV:-.2,legSwingGravity:.01,legSwingDamp:.98,
} as const;
type Vec3={x:number;y:number;z:number};
/** What CPad gives ProcessControlInput. The stick axes are the pad's ±128 units; the PC's keys are the extremes. */
export interface JetPackInput {
 walkUpDown:number;walkLeftRight:number;accelerate:boolean;brake:boolean;
 /** TheCamera.GetActiveCam().m_vecFront.Heading(), the native heading the player faces with the mouse camera. */
 cameraHeading:number;
 /** CPad::GetExitVehicle, which drops the pack while standing still. */
 exitVehicle?:boolean;
}
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));

export class NativeJetPack {
 /** m_ThrustFwd: 1 accelerating, -1 braking, 0 coasting. */
 thrustFwd=0;
 /** m_ThrustStrafe and m_ThrustAngle. */
 thrustStrafe=0;thrustAngle=0;
 /** m_ThrustStop, which only the pad's look-behind button sets. */
 thrustStop=false;
 /** m_LegSwing* and m_LegTwist. */
 legSwingFwd=0;legSwingSide=0;legSwingFwdSpeed=0;legSwingSideSpeed=0;legTwist=0;
 /** m_PrevVelocity, the move speed the previous frame ended with. */
 prevVelocity:Vec3={x:0,y:0,z:0};
 /** m_FxKeyTime: the thruster flame's key time, 0 to 1. */
 fxKeyTime=0;
 /** m_fAimingRotation, the heading the pack flies along. */
 heading=0;
 /** m_bIsFinished, set by MakeAbortable and DropJetPack. */
 finished=false;
 /** m_PrevHeading, for the pack model's roll. */
 prevHeading=0;
 /** m_fMoveBlendRatio while the pack flies. */
 moveBlend=0;
 constructor(heading=0){this.heading=heading;this.prevHeading=heading;}
 /** CTaskSimpleJetPack::ProcessControlInput (0x67E7B0) on the PC's mouse third-person camera (m_bUseMouse3rdPerson,
  * which the menu's default control method sets). Standing still, the exit-vehicle button drops the pack.
  *
  * The standing player takes the pad branch, where the walk axes are read as a stick heading rather than through the
  * camera. On foot the ped is still walking under CTaskSimplePlayerOnFoot there, so this port leaves his heading to
  * the walk and only reads the thrust, which is what lifts him off. */
 processControlInput(input:JetPackInput,standing:boolean,timeStep:number){
  if(standing&&input.exitVehicle&&!input.walkUpDown&&!input.walkLeftRight)return 'drop' as const;
  const magnitude=Math.hypot(input.walkUpDown,input.walkLeftRight)/60;
  const updateStrafe=(step:number,clampTo=1)=>{
   this.thrustStrafe+=step*timeStep;
   this.thrustStrafe=step>=0?Math.min(this.thrustStrafe,clampTo):Math.max(this.thrustStrafe,-clampTo);
  };
  // Standing with the stick pushed, the pad branch leans the thrust by the push: THRUST_MAX_ANGLE × padMoveMag ×
  // −0.3515625, so a take-off starts tipped forward (−0.98 for W alone).
  if(standing&&magnitude>0)this.thrustAngle=JET_PACK.maxAngle*magnitude*-.3515625;
  if(!standing){
   // The camera aims the flight; the walk axes tilt and strafe it.
   this.heading=input.cameraHeading;
   this.interpolateThrustAngle(input.walkUpDown,timeStep);
   if(input.walkLeftRight<0)updateStrafe(-.1);
   else if(input.walkLeftRight>0)updateStrafe(.1);
   else if(this.thrustStrafe>0)updateStrafe(-.05);
   else if(this.thrustStrafe<0)updateStrafe(.05);
  }
  // Nothing updated the thrust before this: the hover brake is on the pad's look-behind button, which the PC's
  // on-foot keys do not carry.
  this.thrustStop=false;
  this.thrustFwd=input.brake?-1:input.accelerate||input.walkUpDown!==0?1:0;
  if(this.thrustStrafe>0)updateStrafe(-.05,0);
  else if(this.thrustStrafe<0)updateStrafe(.05,0);
  this.moveBlend=magnitude<=0?0:Math.min(magnitude,this.moveBlend+timeStep*.07);
  return undefined;
 }
 /** CTaskSimpleJetPack::ProcessPed's dying branch: with the flier's health under 1 the pack runs away with him, the
  * thrust flat out sideways and his heading wobbling on a 2 s sine. gta-reversed's
  * `m_ThrustStrafe + CGeneral::DoCoinFlip() ? -1.f : 1.f` parses as `(strafe + flip) ? -1 : 1`, which would only ever
  * hold ±1; the intended sum is used. */
 dying(timeMs:number,timeStep:number,coinFlip:()=>boolean,random:()=>number=Math.random,frameDue=true){
  this.thrustStop=false;this.thrustFwd=0;this.thrustAngle=0;
  // The coin flip is per game frame (30 fps).
  if(frameDue)this.thrustStrafe=clamp(this.thrustStrafe+(coinFlip()?-1:1),-3,3);
  this.heading+=Math.sin(timeMs*.0015707964)*timeStep*JET_PACK.turnRate*random();
  this.moveBlend=0;
 }
 private interpolateThrustAngle(walkUpDown:number,timeStep:number){
  const target=walkUpDown/128*JET_PACK.maxAngle,t=Math.pow(JET_PACK.angleRate,timeStep);
  this.thrustAngle=target+(this.thrustAngle-target)*t;
 }
 /** CTaskSimpleJetPack::ProcessThrust (0x67EF20). `velocity` is the ped's move speed, changed in place;
  * `groundHeight` is TheCamera::CalculateGroundHeight(ENTITY_BB_TOP), which fades the climb out 100 units above it. */
 processThrust(velocity:Vec3,position:Vec3,groundHeight:number,standing:boolean,wasStanding:boolean,timeStep:number){
  const heading=this.heading;
  // A ped's matrix: forward (−sin h, cos h, 0), right (cos h, sin h, 0), up (0, 0, 1).
  const forward={x:-Math.sin(heading),y:Math.cos(heading),z:0},right={x:Math.cos(heading),y:Math.sin(heading),z:0},up={x:0,y:0,z:1};
  const previous={...velocity};
  // ApplyMoveForce over the ped's own mass: the move speed takes the thrust directly.
  const applyThrust=(direction:Vec3,multiplier:number)=>{
   const scale=MAGIC*timeStep*multiplier;
   velocity.x+=direction.x*scale;velocity.y+=direction.y*scale;velocity.z+=direction.z*scale;
  };
  if(this.thrustStop){
   applyThrust(up,1);
   const speedSq=velocity.x**2+velocity.y**2+velocity.z**2;
   let stopForce=timeStep*JET_PACK.stop*MAGIC;
   if(stopForce*stopForce>speedSq)stopForce*=.75;
   if(stopForce*stopForce<=speedSq){
    // The braking force alone is passed to ApplyMoveForce, so unlike the thrust it is divided by the ped's 70 mass.
    const speed=Math.sqrt(speedSq),scale=stopForce/(70*speed);
    velocity.x-=velocity.x*scale;velocity.y-=velocity.y*scale;velocity.z-=velocity.z*scale;
   }else{velocity.x=0;velocity.y=0;velocity.z=0;}
  }else{
   applyThrust(up,this.thrustFwd>=0?JET_PACK.nominal:JET_PACK.nominal*.5);
   if(this.thrustFwd>0){
    const tilt=-Math.sin(this.thrustAngle),cos=Math.cos(this.thrustAngle);
    const direction={x:forward.x*tilt,y:forward.y*tilt,z:Math.min(.75,forward.z*tilt)+cos};
    const heightMultiplier=clamp(1-(position.z-(groundHeight+100))/100,0,1);
    applyThrust(direction,JET_PACK.full*heightMultiplier);
   }
   if(this.thrustStrafe!==0)applyThrust(right,this.thrustStrafe*JET_PACK.strafe);
  }
  // The legs hang free, swung by the velocity the frame gained and pulled back level by gravity.
  const damping=Math.pow(JET_PACK.legSwingDamp,timeStep);
  const swing=(direction:Vec3,speed:number,angle:number)=>{
   if(!wasStanding&&!standing){
    const delta={x:velocity.x-this.prevVelocity.x,y:velocity.y-this.prevVelocity.y,z:velocity.z-this.prevVelocity.z};
    const applied={x:velocity.x-previous.x,y:velocity.y-previous.y,z:velocity.z-previous.z};
    const dot=(delta.x+applied.x)*direction.x+(delta.y+applied.y)*direction.y+(delta.z+applied.z)*direction.z;
    speed-=dot*JET_PACK.legSwingDeltaV;
   }
   speed-=Math.sin(angle)*timeStep*JET_PACK.legSwingGravity;
   speed*=damping;
   return {speed,angle:clamp(angle+speed*timeStep,-JET_PACK.legSwingMax,JET_PACK.legSwingMax)};
  };
  const forwardSwing=swing(forward,this.legSwingFwdSpeed,this.legSwingFwd);
  this.legSwingFwdSpeed=forwardSwing.speed;this.legSwingFwd=forwardSwing.angle;
  const sideSwing=swing(right,this.legSwingSideSpeed,this.legSwingSide);
  this.legSwingSideSpeed=sideSwing.speed;this.legSwingSide=sideSwing.angle;
  this.legTwist*=damping;
  // The flier slows the faster he goes: the whole move speed is scaled every frame.
  const speed=Math.hypot(velocity.x,velocity.y,velocity.z),scale=Math.pow(1-speed*JET_PACK.moveDamping,timeStep);
  velocity.x*=scale;velocity.y*=scale;velocity.z*=scale;
  this.prevVelocity={...velocity};
 }
 /** CTaskSimpleJetPack::ProcessPed (0x6801F0): the pack lifts the ped off the ground once it thrusts. */
 lifts(){return this.thrustFwd>0||Math.abs(this.thrustStrafe)>.1;}
 /** DoJetPackEffect (0x67B7F0): the thruster flame's key time. The original checks `m_ThrustFwd != 0`, so braking
  * shows the blue full-thrust flame; the fixed check is `== 1`. */
 updateEffect(frames=1){
  // 0.1 a game frame (30 fps), unscaled by the timestep; `frames` is how many of those this call covers.
  const thrusting=this.thrustFwd!==0||this.thrustStrafe!==0;
  this.fxKeyTime=thrusting?Math.min(this.fxKeyTime+.1*frames,1):Math.max(this.fxKeyTime-.1*frames,0);
  return this.fxKeyTime;
 }
 /** RenderJetPack (0x67F6A0): the pack's pitch, from the thrust angle less the heading the player turned through. */
 private lastPitch=0;
 /** `aimingHeading` is m_fAimingRotation (the camera's in flight, the walk's on the ground); `currentHeading` becomes
  * m_PrevHeading. RenderJetPack runs once a 30 fps frame, so between frames (`frameDue` false) the last pitch holds. */
 packPitch(currentHeading:number,aimingHeading=this.heading,frameDue=true){
  if(!frameDue)return this.lastPitch;
  let heading=aimingHeading;
  if(heading>=this.prevHeading+Math.PI)heading-=2*Math.PI;
  else if(heading<=this.prevHeading-Math.PI)heading+=2*Math.PI;
  const delta=clamp(heading-this.prevHeading,-.2,.2);
  this.prevHeading=currentHeading;
  return this.lastPitch=clamp(this.thrustAngle-delta*10,-Math.PI/2,Math.PI/2);
 }
 /** The jet balls swivel with the strafe and pitch, or circle while the hover brake holds. */
 ballRotation(pitch:number,left:boolean,timeMs:number):[number,number]{
  if(this.thrustStop){
   const t=timeMs/79.577469;
   return [Math.sin(t)*(left?Math.PI/4:-Math.PI/4),Math.cos(t)*Math.PI/4];
  }
  const y=this.thrustStrafe*Math.PI/4;
  return [pitch,left?Math.max(0,y):Math.min(0,y)];
 }
}
/** CGeneral::LimitRadianAngle. */
export function limitRadianAngle(angle:number){
 let a=angle;
 if(!Number.isFinite(a))return 0;
 while(a>=Math.PI)a-=2*Math.PI;
 while(a<-Math.PI)a+=2*Math.PI;
 return a;
}
