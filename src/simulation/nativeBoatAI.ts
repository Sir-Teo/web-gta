/* A script's boat under CAutoPilot as the iOS executable drives it. BOAT_GOTO_COORDS (0x02D3, iOS 0x1001d5f30) and
 * BOAT_STOP (0x02D4, iOS 0x1001d5f80) set the mission (+0x4ea), the destination (+0x51c), the cruise speed (+0x500) and
 * bEngineOn, and make the boat STATUS_PHYSICS. CBoat::ProcessControl (iOS 0x10045c26c) then runs SteerAICarWithPhysics
 * (0x1001984f0) on it with or without a driver, which writes m_fSteerAngle (+0x600), m_fGasPedal (+0x608) and
 * m_fBreakPedal (+0x60c) from SteerAICarWithPhysics_OnlyMission (0x100198dbc). gta-reversed has none of these. */
export const MISSION_NONE=0,MISSION_GOTOCOORDINATES_ASTHECROWSWIMS=14,MISSION_PLANE_CRASH_AND_BURN=57,MISSION_HELI_CRASH_AND_BURN=58;
/** CAutoPilot's m_nCruiseSpeed as its constructor sets it. */
export const DEFAULT_CRUISE_SPEED=10;
export interface BoatPilot {mission:number;target:{x:number;y:number;z:number};cruiseSpeed:number;engineOn:boolean}
export interface BoatAIBody {position:{x:number;y:number};forward:{x:number;y:number};moveSpeed:{x:number;y:number}}
export interface BoatAIControls {steer:number;gas:number;brake:number;handbrake:boolean}
/** A mission the stop and the go-to leave alone: a plane's or a heli's crash. */
const crashing=(mission:number)=>mission===MISSION_PLANE_CRASH_AND_BURN||mission===MISSION_HELI_CRASH_AND_BURN;
/** SET_BOAT_CRUISE_SPEED (0x02DB, iOS 0x1001d6064): the float truncated and stored in the byte. */
export function boatCruiseSpeed(speed:number){return Math.trunc(speed)&0xff;}
/** BOAT_GOTO_COORDS: MISSION_GOTOCOORDINATES_ASTHECROWSWIMS to (x, y); a z at or under -100 is the water's level there
 * (`waterAt`), any other the handler stores as 0. The engine is on unless broken, and a cruise speed under 2 is 1. */
export function boatGotoCoords(pilot:BoatPilot,x:number,y:number,z:number,engineBroken:boolean,waterAt:(x:number,y:number)=>number|undefined){
 if(!crashing(pilot.mission))pilot.mission=MISSION_GOTOCOORDINATES_ASTHECROWSWIMS;
 pilot.target={x,y,z:z<=-100?waterAt(x,y)??0:0};
 pilot.engineOn=!engineBroken;
 if(pilot.cruiseSpeed<=1)pilot.cruiseSpeed=1;
}
/** BOAT_STOP: no mission (unless crashing), the engine off, the cruise speed 0. */
export function boatStop(pilot:BoatPilot){
 if(!crashing(pilot.mission))pilot.mission=MISSION_NONE;
 pilot.engineOn=false;pilot.cruiseSpeed=0;
}
/** CGeneral::GetATanOfXY: the angle of (x, y) from the x axis. Only differences of it are used. */
const atanOfXY=(x:number,y:number)=>x===0&&y===0?0:Math.atan2(y,x);
/** SteerAIBoatWithPhysicsHeadingForTarget (iOS 0x10019c4dc): turn toward the point by the angle between the bow and
 * it, wrapped into (−π, π] and held within ±0.5; open the throttle by how far the speed (60 × the move speed a frame,
 * in 2D) falls short of the cruise speed, fully once it is a quarter short, easing to none at the cruise speed; over
 * it, reverse at 0.1, or 0.2 when 5 over, with the steering turned round. No brake. */
export function steerAIBoatHeadingForTarget(body:BoatAIBody,target:{x:number;y:number},cruiseSpeed:number):BoatAIControls{
 const len=Math.hypot(body.forward.x,body.forward.y),fx=len===0?1:body.forward.x/len,fy=len===0?body.forward.y:body.forward.y/len;
 let turn=atanOfXY(target.x-body.position.x,target.y-body.position.y)-atanOfXY(fx,fy);
 while(turn<-Math.PI)turn+=Math.PI*2;
 while(turn>Math.PI)turn-=Math.PI*2;
 let steer=Math.min(.5,Math.max(-.5,turn)),gas:number;
 const short=cruiseSpeed-Math.hypot(body.moveSpeed.x,body.moveSpeed.y)*60;
 if(short>0){const ratio=short/cruiseSpeed;gas=ratio>.25?1:1-(.25-ratio)*4;}
 else{gas=short<-5?-.2:-.1;steer=-steer;}
 return {steer,gas,brake:0,handbrake:false};
}
/** SteerAICarWithPhysics_OnlyMission for a boat's missions: the go-to above, and MISSION_NONE's (0x100198e68) no steer
 * or gas, half brake and the handbrake. */
export function steerAIBoat(pilot:BoatPilot,body:BoatAIBody):BoatAIControls{
 if(pilot.mission===MISSION_GOTOCOORDINATES_ASTHECROWSWIMS)return steerAIBoatHeadingForTarget(body,pilot.target,pilot.cruiseSpeed);
 return {steer:0,gas:0,brake:.5,handbrake:true};
}
