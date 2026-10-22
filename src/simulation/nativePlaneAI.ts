import type {NativeVec} from './nativeFlyingControl';
/* CCarCtrl's AI plane steering as the iOS executable has it: SteerAICarWithPhysics' mission switch (0x100198e04) sends
 * MISSION_PLANE_FLYTOCOORS (0x10019939c) and MISSION_PLANE_FLYINDIRECTION (0x100199648) to FlyAIPlaneInCertainDirection
 * (0x10019f1c4), which gta-reversed has only as a call into the exe. It writes CPlane's four control fields, which
 * CPlane::ProcessControl flies through FlyingControl as it flies the player's (nativeFlyingControl.ts).
 *
 * Once a second (staggered by the plane's random seed) it looks for a heading to take: the desired one, or one 15
 * degrees at a time either side of it, toward the way it faces first, the first whose ground ahead lies under 150 (rays
 * from where it will be 50 frames on, 200 long, at 3, 0, -20, -40 and -60 degrees; one at 6 degrees that strikes
 * anything blocks the heading), and holds the minimum height over that ground or its maximum altitude, whichever is
 * higher. None clear, it turns back. Every frame: on its wheels (and for 4 seconds after) it keeps its creation heading
 * by the rudder and lifts the nose 0.4 above 32 (7 for an RC plane) of speed; in the air it puts its gear up, pitches
 * toward the height (a thirtieth of the gap, within 0.4, by where it will be 100 frames on) and banks into the turn
 * (1.5 the heading's error, within 0.9 and 0.7 for an RC plane, less when slow), pulling up with the bank. The throttle
 * is m_fAccelerationBreakStatusPrev, which SET_PLANE_THROTTLE sets and the constructor makes 1.
 *
 * Native units: world axes x east, y north, z up; moveSpeed in units a 50 Hz step; `ts` CTimer::ms_fTimeStep. */
export const MISSION_PLANE_FLYTOCOORS=22,MISSION_PLANE_ATTACK_PLAYER=35,MISSION_PLANE_FLYINDIRECTION=36,MISSION_PLANE_FOLLOW_ENTITY=37,
 MISSION_PLANE_ATTACK_PLAYER_POLICE=59,MISSION_PLANE_DOG_FIGHT_ENTITY=62,MISSION_PLANE_DOG_FIGHT_PLAYER=63;
/** CPlane's fields the AI flies by (gta-reversed's Plane.h names, iOS +0xbc8 on): the four controls FlyingControl takes
 * (the rudder, the pitch, the roll and the throttle), the throttle the AI copies in, the roll it last read
 * (m_fSteeringFactor), the heading it was made with, the altitudes (TellPlaneToGoToCoors' two and the height it is
 * holding), the heading it wants and the one it takes, the pitch it last read (m_forwardZ), when its wheels last
 * touched, and its gear. */
export interface PlaneAI {
 rudder:number;pitch:number;roll:number;accel:number;accelPrev:number;steeringFactor:number;creationHeading:number;
 maxAltitude:number;altitude:number;minAltitude:number;heading:number;headingPrev:number;forwardZ:number;
 startedFlyingTime:number;gearUp:boolean;
}
/** CPlane's constructor: the controls at rest, the throttle to come full, 15, 25 and 20 for the altitudes; the creation
 * heading as the plane was placed. */
export function newPlaneAI(creationHeading:number):PlaneAI{
 return {rudder:0,pitch:0,roll:0,accel:0,accelPrev:1,steeringFactor:0,creationHeading,maxAltitude:15,altitude:25,minAltitude:20,
  heading:0,headingPrev:0,forwardZ:0,startedFlyingTime:0,gearUp:false};
}
/** The CAutoPilot fields the steering reads: the mission, m_vecDestinationCoors, m_nTempAction (16 to 18 take the way
 * the plane faces, or two radians either side, for the search; 15 pulls up until slow), and bIsRCVehicle. */
export interface PlanePilot {mission:number;destination:NativeVec;tempAction:number;rc:boolean;
 /** CAutoPilot::m_bPlaneDogfightSomething (+0x561 on iOS): flying to its breakaway point. */
 dogfightBreakaway?:boolean;
}
/** The plane: its place, speed and rows, and whether a wheel touches (CAutomobile's suspension compression under 1). */
export interface PlaneAIBody {position:NativeVec;moveSpeed:NativeVec;right:NativeVec;forward:NativeVec;up:NativeVec;onGround:boolean}
export interface PlaneAIWorld {
 /** CWorld::ProcessLineOfSight against buildings alone: the point it hits, or nothing. */
 lineOfSight(from:NativeVec,to:NativeVec):NativeVec|undefined;
 /** iOS rand(): an integer from 0 through 2^31-1, used for the dogfight's breakaway. */
 rand?():number;
}

const clamp=(v:number,lo:number,hi:number)=>v<lo?lo:v>hi?hi:v;
/** The angle within [−π, π]. */
function wrap(a:number){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;}
/** CGeneral::GetATanOfXY: the angle of (x, y) from the x axis. */
export const atanOfXY=(x:number,y:number)=>x===0&&y===0?0:Math.atan2(y,x);
/** A plane's speed for the AI (iOS 0x10019f488): along its heading across, times 60. */
const forwardSpeed=(b:PlaneAIBody)=>(b.forward[0]*b.moveSpeed[0]+b.forward[1]*b.moveSpeed[1])*60;
/** The speed (times 60) over which the nose lifts on the ground, and under which the climb is held to 0.25. */
const ROTATE_SPEED=32,ROTATE_SPEED_RC=7;
/** The search's step either side, its turn past the found direction, the height the ground ahead must stay under,
 * and the height held when no way is clear. */
const SEARCH_STEP=.2617994,SEARCH_OVERSHOOT=1.1,CLEAR_GROUND=150,NO_WAY_HEIGHT=500;
/** The look-ahead's pitches: the first blocks the heading if it strikes anything, the rest find the ground. */
const BLOCK_PITCH=.1047198,GROUND_PITCHES=[.05235988,0,-.3490659,-.6981317,-1.047198];
/** It flies on its wheels for this long after the last touched, in ms. */
const TAKEOFF_MS=4000;

/** GetAIPlaneToDoDogFight (iOS 0x10019e280). Normally chase the target's position plus 50 frames of its speed.
 * On rand() & 1023 == 500, save a breakaway point: up to 300 either side of that predicted position, 50 higher.
 * Keep flying to it until within 50 across, then resume chasing on the next step. The frame that chooses the point
 * still steers toward the target; the frame that reaches it still steers toward the point. */
export function planeDogfightHeading(ai:PlaneAI,body:PlaneAIBody,pilot:PlanePilot,world:PlaneAIWorld,target:NativeVec){
 if(pilot.dogfightBreakaway){
  const d=pilot.destination;
  ai.heading=atanOfXY(d[0]-body.position[0],d[1]-body.position[1]);ai.maxAltitude=d[2];
  if(Math.hypot(d[0]-body.position[0],d[1]-body.position[1])<50)pilot.dogfightBreakaway=false;
 }else{
  ai.heading=atanOfXY(target[0]-body.position[0],target[1]-body.position[1]);ai.maxAltitude=target[2];
  const rand=world.rand??(()=>Math.floor(Math.random()*0x80000000));
  if((rand()&1023)===500){
   pilot.dogfightBreakaway=true;
   pilot.destination=[target[0]+rand()*(1/0x80000000)*600-300,target[1]+rand()*(1/0x80000000)*600-300,target[2]+50];
  }
 }
}

/** Whether this step crosses one of the plane's one-second marks: (now + seed) mod 1000 wrapped since the last step. */
export function planeSearchDue(nowMs:number,previousMs:number,seed:number){return (Math.floor(nowMs)+seed)%1000<(Math.floor(previousMs)+seed)%1000;}

/** The look-ahead ray (iOS 0x10019ef60): from where the plane will be in 50 frames, 200 along the heading at the pitch;
 * the height it strikes at. */
function rayHeight(body:PlaneAIBody,world:PlaneAIWorld,pitch:number,heading:number){
 const from:NativeVec=[body.position[0]+body.moveSpeed[0]*50,body.position[1]+body.moveSpeed[1]*50,body.position[2]+body.moveSpeed[2]*50];
 const c=Math.cos(pitch),dir:NativeVec=[c*Math.cos(heading),c*Math.sin(heading),Math.sin(pitch)];
 return world.lineOfSight(from,[from[0]+dir[0]*200,from[1]+dir[1]*200,from[2]+dir[2]*200])?.[2];
}
/** The ground ahead along a heading (iOS 0x10019f0a4): 100000 when the ray just above the nose strikes anything, else
 * the highest the others strike (0 for none). */
export function planeGroundAhead(body:PlaneAIBody,world:PlaneAIWorld,heading:number){
 if(rayHeight(body,world,BLOCK_PITCH,heading)!==undefined)return 100000;
 let height=0;
 for(const pitch of GROUND_PITCHES){const z=rayHeight(body,world,pitch,heading);if(z!==undefined)height=Math.max(height,z);}
 return height;
}

/** The once-a-second search (iOS 0x10019f1c4 to 0x10019f400). */
function searchHeading(ai:PlaneAI,body:PlaneAIBody,pilot:PlanePilot,world:PlaneAIWorld){
 const facing=atanOfXY(body.forward[0],body.forward[1]),desired=ai.heading;
 const base=pilot.tempAction===18?facing+2:pilot.tempAction===17?facing-2:pilot.tempAction===16?facing:desired;
 ai.altitude=NO_WAY_HEIGHT;ai.headingPrev=desired+Math.PI;
 const d=wrap(facing-base),limit=Math.abs(d)<Math.PI/6?Math.abs(d):d*1.5;
 const offset=(i:number)=>(i>>1)*(i&1?SEARCH_STEP:-SEARCH_STEP);
 // Between the desired heading and the way it faces first, then the rest (the desired heading itself among them).
 const toward=(o:number)=>o<0&&o>limit||o>0&&o<limit;
 for(const first of [true,false])for(let i=1;i<20;i++){
  const o=offset(i);if(toward(o)!==first)continue;
  const ground=planeGroundAhead(body,world,base+o);
  if(ground<CLEAR_GROUND){ai.headingPrev=desired+o*SEARCH_OVERSHOOT;ai.altitude=Math.max(ground+ai.minAltitude,ai.maxAltitude);return;}
 }
}

/** FlyAIPlaneInCertainDirection (iOS 0x10019f1c4): the four controls for this step. */
export function flyAIPlaneInCertainDirection(ai:PlaneAI,body:PlaneAIBody,pilot:PlanePilot,world:PlaneAIWorld,nowMs:number,searchDue:boolean,ts:number){
 if(searchDue)searchHeading(ai,body,pilot,world);
 const rotate=pilot.rc?ROTATE_SPEED_RC:ROTATE_SPEED,facing=atanOfXY(body.forward[0],body.forward[1]),speed=forwardSpeed(body);
 if(body.onGround)ai.startedFlyingTime=nowMs;
 let pitch:number,ground:boolean;
 if(nowMs-ai.startedFlyingTime<=TAKEOFF_MS){
  ground=true;pitch=speed<rotate?0:.4;ai.pitch=pitch;
 }else{
  ground=false;
  if(!ai.gearUp)ai.gearUp=true;
  const ahead=body.position[2]+body.moveSpeed[2]*100,angle=Math.asin(clamp(body.forward[2],-1,1));
  const predicted=angle+(angle-ai.forwardZ)*(100/ts);ai.forwardZ=angle;
  let wanted=clamp((ai.altitude-ahead)/30,-.4,.4);if(speed<rotate)wanted=Math.min(wanted,.25);
  pitch=(wanted-predicted)*.5;ai.pitch=pitch;
 }
 const error=wrap(ai.headingPrev-facing);
 if(ground){
  // On its wheels: the rudder holds the creation heading; no roll.
  ai.rudder=clamp((ai.creationHeading-facing)*-10,-1,1);ai.roll=0;
 }else{
  let bank=clamp(error*-1.5,-.9,.9);
  if(pilot.rc)bank=clamp(bank,-.7,.7);
  ai.rudder=Math.abs(bank)<.1?bank*4:bank;
  // The bank it rolls to is the other way from the rudder: into the turn (a wing up on the side it turns from).
  let wantedBank=Math.abs(bank)<.1?0:-bank;
  // Under 1.2 times the lift-off speed it banks less, none at 0.7 of it.
  if(speed<rotate*1.2)wantedBank*=Math.max((rotate*1.2-speed)/(-.5*rotate)+1,0);
  const across=Math.hypot(body.right[0],body.right[1]),roll=Math.atan2(body.right[2],body.up[2]<0?-across:across);
  const predicted=roll+(roll-ai.steeringFactor)*(30/Math.max(ts,1));ai.steeringFactor=roll;
  const e=wrap(wantedBank-predicted);
  ai.roll=Math.max(e>-1?-e:1,-1);
  // Pulling up with the bank; a nose that wants down goes down at most half the way.
  const withBank=Math.abs(roll*.23)+pitch;
  pitch=pitch<0?Math.min(withBank,pitch*.5):withBank;
 }
 ai.pitch=clamp(pitch,-1,1);
 ai.accel=ai.accelPrev;
 if(pilot.tempAction===15){ai.pitch=1;if(speed<20)pilot.tempAction=0;}
}

/** SteerAICarWithPhysics for a plane's mission (iOS 0x100198e04): flying to coordinates sets the heading there first
 * (0x10019939c); following an entity (0x1001995e4) the heading to it and its height as m_maxAltitude; attacking the
 * player (GetAIPlaneToAttackPlayer, 0x10019d134) the same for where the player will be in 50 frames (`target`, his
 * place and speed); flying in a direction keeps the one it was given. Nothing for another mission, or for a followed
 * entity that has gone. The attack/dogfight weapon checks after flying (iOS 0x10019fa50 and 0x10019fb60) run through
 * nativePlaneWeapons.ts and WeaponSystem; helicopter AI weapons remain unfinished. */
export function steerAIPlane(ai:PlaneAI,body:PlaneAIBody,pilot:PlanePilot,world:PlaneAIWorld,nowMs:number,searchDue:boolean,ts:number,target?:NativeVec){
 if(pilot.mission===MISSION_PLANE_FLYTOCOORS)ai.heading=atanOfXY(pilot.destination[0]-body.position[0],pilot.destination[1]-body.position[1]);
 else if(pilot.mission===MISSION_PLANE_ATTACK_PLAYER||pilot.mission===MISSION_PLANE_ATTACK_PLAYER_POLICE){
  if(!target)return false;
  ai.heading=atanOfXY(target[0]-body.position[0],target[1]-body.position[1]);ai.maxAltitude=target[2];
 }
 else if(pilot.mission===MISSION_PLANE_FOLLOW_ENTITY){
  if(!target)return false;
  ai.heading=atanOfXY(target[0]-body.position[0],target[1]-body.position[1]);ai.maxAltitude=target[2];
 }
 else if(pilot.mission===MISSION_PLANE_DOG_FIGHT_ENTITY||pilot.mission===MISSION_PLANE_DOG_FIGHT_PLAYER){
  if(!target)return false;
  planeDogfightHeading(ai,body,pilot,world,target);
 }
 else if(pilot.mission!==MISSION_PLANE_FLYINDIRECTION)return false;
 flyAIPlaneInCertainDirection(ai,body,pilot,world,nowMs,searchDue,ts);
 return true;
}
