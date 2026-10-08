/* CCarCtrl's AI helicopter steering as the iOS executable has it: SteerAIHeliTowardsTargetCoors (0x10019c430), which
 * SteerAICarWithPhysics (0x1001984f0, mission switch 0x100198e04) runs for MISSION_HELI_FLYTOCOORS, and
 * FlyAIHeliInCertainDirection (0x10019fcf4) under it. gta-reversed has neither. They write CHeli's four control
 * fields, which FlyingControl then flies as it flies the player's (nativeFlyingControl.ts).
 *
 * Native units: world axes x east, y north, z up; moveSpeed in units a 50 Hz step; `ts` CTimer::ms_fTimeStep. */
import type {NativeVec} from './nativeFlyingControl';

/** eCarMission values the steering looks at. */
export const MISSION_HELI_FLYTOCOORS=20,MISSION_HELI_FOLLOW_ENTITY=39,MISSION_HELI_NEWS_BEHAVIOUR=41,MISSION_HELI_LAND=47,MISSION_HELI_LAND_TOUCHING_DOWN=48,MISSION_HELI_CRASH_AND_BURN=58;

/** CHeli's fields the AI flies by: the controls it writes (m_fLeftRightSkid +0xbcc, positive yawing right;
 * m_fSteeringUpDown +0xbd0, positive nose up; m_fSteeringLeftRight +0xbd4, negative rolling right;
 * m_fAccelerationBreakStatus +0xbd8, the collective), the altitude band TellHeliToGoToCoors sets (m_fMaxAltitude
 * +0xbe8, m_fMinAltitude +0xbf0), the height it is holding (+0xbec) and whether the way ahead is blocked (+0xbf8). */
export interface HeliAI {yaw:number;pitch:number;roll:number;accel:number;maxAltitude:number;minAltitude:number;holdHeight:number;blockedAhead:boolean}
/** CHeli's constructor: both altitudes 10. */
export function newHeliAI():HeliAI{return {yaw:0,pitch:0,roll:0,accel:0,maxAltitude:10,minAltitude:10,holdHeight:10,blockedAhead:false};}

/** The CAutoPilot fields the steering reads: the mission, m_nCruiseSpeed (+0x40), m_ucHeliSpeedMult (+0x49, signed),
 * m_ucHeliTargetDist2 (+0x4f, 10 from the constructor), m_vecDestinationCoors (+0x5c); bIsRCVehicle (CVehicle flag
 * bit 39); and CAutomobile::m_fForcedOrientation (−1 when none). */
export interface HeliPilot {mission:number;cruiseSpeed:number;heliSpeedMult:number;heliTargetDist2:number;destination:NativeVec;rc:boolean;forcedOrientation:number}
export interface HeliAIBody {position:NativeVec;moveSpeed:NativeVec;right:NativeVec;forward:NativeVec}
export interface HeliAIWorld {
 /** CWorld::ProcessLineOfSight against buildings alone (and shooting through what can be shot through): the point it
  * hits, or nothing. */
 lineOfSight(from:NativeVec,to:NativeVec):NativeVec|undefined;
 /** rand(), 0 to 32767. */
 rand():number;
}

const add=(a:NativeVec,b:NativeVec,k=1):NativeVec=>[a[0]+b[0]*k,a[1]+b[1]*k,a[2]+b[2]*k];
const flat=(v:NativeVec):NativeVec=>{const l=Math.hypot(v[0],v[1]);return l>0?[v[0]/l,v[1]/l,0]:[1,0,0];};
const distance=(a:NativeVec,b:NativeVec)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const clamp=(v:number,lo:number,hi:number)=>v<lo?lo:v>hi?hi:v;
/** The angle within (−π, π]. */
function wrap(a:number){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;}
/** CGeneral::GetATanOfXY: the angle of (x, y) from the x axis. Only differences of it are used, so its range does not
 * matter here. */
const atanOfXY=(x:number,y:number)=>x===0&&y===0?0:Math.atan2(y,x);

/** Whether this step crosses one of the heli's half-second marks: (now + seed) mod 500 wrapped round since the last
 * step. The line-of-sight look ahead runs only then. */
export function heliProbeDue(nowMs:number,previousMs:number,seed:number){return (Math.floor(nowMs)+seed)%500<(Math.floor(previousMs)+seed)%500;}

/** SteerAIHeliTowardsTargetCoors (iOS 0x10019c430): with no forced orientation, fly toward the destination along the
 * ground, `toTarget` set. (A forced orientation is FlyAIHeliToTarget_FixedOrientation, iOS 0x1001a068c, not ported:
 * the heli flies nose first all the same.) */
export function steerAIHeliTowardsTargetCoors(ai:HeliAI,body:HeliAIBody,pilot:HeliPilot,world:HeliAIWorld,probe:boolean,ts:number){
 const dx=pilot.destination[0]-body.position[0],dy=pilot.destination[1]-body.position[1];
 flyAIHeliInCertainDirection(ai,body,pilot,world,atanOfXY(dx,dy),Math.hypot(dx,dy),true,probe,ts);
}

/** SteerAIHeliToLand (iOS 0x10019de50), MISSION_HELI_LAND and _TOUCHING_DOWN: toward the spot as toward a target; within
 * 10 units of it along the ground and all but still (under 0.05 a frame), both altitudes go to nought so it sinks to
 * what is under it, and with a wheel on the ground (a suspension line short of full length) every control is let go. */
export function steerAIHeliToLand(ai:HeliAI,body:HeliAIBody,pilot:HeliPilot,world:HeliAIWorld,probe:boolean,ts:number,wheelOnGround:boolean){
 const dx=pilot.destination[0]-body.position[0],dy=pilot.destination[1]-body.position[1],along=Math.hypot(dx,dy);
 flyAIHeliInCertainDirection(ai,body,pilot,world,atanOfXY(dx,dy),along,true,probe,ts);
 if(along<10&&Math.hypot(body.moveSpeed[0],body.moveSpeed[1])<.05){
  ai.minAltitude=0;ai.maxAltitude=0;
  if(wheelOnGround){ai.yaw=0;ai.pitch=0;ai.roll=0;ai.accel=0;}
 }
}

/** CHeli's constructor (iOS 0x1004645cc): the yaw it spins at coming down in a crash, 2 to 8. */
export function heliCrashYaw(random:()=>number){return random()*6+2;}
/** SteerAICarWithPhysics' MISSION_HELI_CRASH_AND_BURN (iOS 0x100199928): nose down 0.3, the collective at −0.5, spinning
 * at its crash yaw and rolled full over, both one way or the other by the bottom bit of its random seed. */
export function steerAIHeliToCrashAndBurn(ai:HeliAI,seed:number,crashYaw:number){
 const odd=(seed&1)!==0;
 ai.pitch=-.3;ai.yaw=odd?crashYaw:-crashYaw;ai.roll=odd?1:-1;ai.accel=-.5;
}

/** SteerAIHeliToFollowEntity (iOS 0x10019d400), MISSION_HELI_FOLLOW_ENTITY: the destination is the entity's position
 * each step, and the height to hold its own, at least 6, or at least 25 while it is more than 50 units off along the
 * ground; then as toward a target. (The lead ahead of the entity, CAutoPilot +0x4a, is nought unless set, and the
 * police and news catch-up flags are not looked at here.) */
export function steerAIHeliToFollowEntity(ai:HeliAI,body:HeliAIBody,pilot:HeliPilot,world:HeliAIWorld,target:NativeVec,probe:boolean,ts:number){
 pilot.destination=[target[0],target[1],target[2]];
 const dx=target[0]-body.position[0],dy=target[1]-body.position[1],along=Math.hypot(dx,dy),low=Math.max(target[2],6);
 ai.maxAltitude=along>50?Math.max(low,25):low;
 flyAIHeliInCertainDirection(ai,body,pilot,world,atanOfXY(dx,dy),along,true,probe,ts);
}

/** FlyAIHeliInCertainDirection (iOS 0x10019fcf4): the heli's controls for flying on `heading` with `distance` (along
 * the ground) still to go.
 * - Every half second it holds m_fMaxAltitude, or more: from where it will be in a second it looks 60 units forward and
 *   down at 45 degrees, and holds at least m_fMinAltitude over what it sees (half that circling a news target). It
 *   looks straight ahead a hundred frames of its speed and 30 more (5 for an RC heli); with something there, it rolls
 *   away from the side, ten units out, that is nearer blocked, and brakes.
 * - The collective holds the height it will be at two seconds on: a fifth of the gap going down, a tenth going up,
 *   with a little noise, within −0.3 and 1.
 * - The yaw is twice the turn still to make, within ±1.
 * - The pitch is full forward (−0.8), eased within 60 units of a target to nothing at m_ucHeliTargetDist2, less
 *   while the nose is off the heading (none past 27 degrees), backing off (0.3) with the target behind it, less while
 *   it climbs hard, and no faster than the cruise speed allows. */
export function flyAIHeliInCertainDirection(ai:HeliAI,body:HeliAIBody,pilot:HeliPilot,world:HeliAIWorld,heading:number,distance2D:number,toTarget:boolean,probe:boolean,ts:number){
 const pos=body.position,ms=body.moveSpeed,F=body.forward;
 let circling=false;
 if(pilot.mission===MISSION_HELI_NEWS_BEHAVIOUR&&pilot.heliTargetDist2>distance2D&&Math.hypot(ms[0],ms[1])<.01){heading+=Math.PI/2;circling=true;}
 if(probe){
  ai.holdHeight=ai.maxAltitude;
  const ahead=add(pos,ms,50),s=Math.sin(heading),c=Math.cos(heading);
  const l=Math.hypot(c,s,1),ground=world.lineOfSight(ahead,add(ahead,[c/l,s/l,-1/l],60));
  if(ground)ai.holdHeight=Math.max(ai.holdHeight,ground[2]+ai.minAltitude*(circling?.5:1));
  const along:NativeVec=[c,s,0],reach=Math.hypot(ms[0],ms[1])*100+(pilot.rc?5:30);
  ai.blockedAhead=true;
  if(!world.lineOfSight(ahead,add(ahead,along,reach))){ai.blockedAhead=false;ai.roll=0;}
  else{
   const side=flat(body.right);
   const clear=(k:number)=>{
    const start=add(pos,side,10*k);if(world.lineOfSight(pos,start))return 0;
    const hit=world.lineOfSight(start,add(start,along,reach));return hit?distance(hit,start):1000;
   };
   const right=clear(1),left=clear(-1);
   ai.roll=left>right?.5:-.5;
  }
 }
 if(pilot.mission===MISSION_HELI_LAND_TOUCHING_DOWN){ai.blockedAhead=false;ai.roll=0;}
 const facing=atanOfXY(F[0],F[1]);
 const gap=ai.holdHeight-(pos[2]+ms[2]*100);
 const collective=(gap<=0?gap/5:gap/10)+((world.rand()&15)-7)*.002;
 ai.accel=Math.max(Math.min(collective,1),-.3);
 ai.yaw=clamp(wrap(heading-facing)*-2,-1,1);
 let pitch:number;
 if(!toTarget||distance2D>60){pitch=-.8;ai.pitch=pitch;}
 else{
  const left=Math.hypot(pos[0]+ms[0]*50-pilot.destination[0],pos[1]+ms[1]*50-pilot.destination[1])-pilot.heliTargetDist2;
  if(left<0)pitch=ai.pitch;else{pitch=left*-.8/(30-pilot.heliTargetDist2);ai.pitch=pitch;}
 }
 if(pitch<0){
  const off=Math.abs(wrap(facing-heading));
  pitch*=Math.max(off/-.47123894+1,0);ai.pitch=pitch;
  if(off>Math.PI/2&&ms[0]*F[0]+ms[1]*F[1]+ms[2]*F[2]>0){pitch=.3;ai.pitch=pitch;}
 }
 const climbing=collective-.5;
 if(climbing>0){pitch=(1-Math.min(climbing,1))*pitch;ai.pitch=pitch;}
 if(pitch<0){
  const allowed=clamp((pilot.cruiseSpeed+(ms[0]*F[0]+ms[1]*F[1]+ms[2]*F[2])*-60)/10,0,1);
  pitch=Math.max(pitch,-allowed);ai.pitch=pitch;
  if(pilot.heliSpeedMult!==0&&pitch<-.2&&!ai.blockedAhead){const k=pilot.heliSpeedMult*.001*ts;ms[0]+=F[0]*k;ms[1]+=F[1]*k;}
 }
 if(ai.blockedAhead){const f=flat(F);pitch=2*(f[0]*ms[0]+f[1]*ms[1]);}
 ai.pitch=clamp(pitch,-1,1);
}
