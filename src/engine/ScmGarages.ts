import {requireAsset} from '../assets/binary';
/* CGarages as a script addresses them, pinned gta-reversed ead3051 (`Garages.cpp`: `GetGarageNumberByName`
 * 0x447680, `ActivateGarage` 0x447CD0, `DeActivateGarage` 0x447CB0, `ChangeGarageType` 0x4476D0,
 * `IsGarageOpen` 0x447D00 and `IsGarageClosed` 0x447D30, all reversed). The garages themselves come from the
 * world's own data, which a host loads; a name no garage carries looks up as -1 and the command then does
 * nothing, which is what keeps a script running past a garage this world does not have. */
/** eGarageDoorState (Garage.h). */
export const GARAGE_DOOR_CLOSED=0,GARAGE_DOOR_OPEN=1,GARAGE_DOOR_CLOSING=2,GARAGE_DOOR_OPENING=3,GARAGE_DOOR_WAITING_PLAYER_TO_EXIT=4,GARAGE_DOOR_CLOSED_DROPPED_CAR=5;
/** eGarageType values the script-facing routines test (Garage.h). */
export const GARAGE_TYPE={bombshopTimed:2,paynspray:5,closesOnTouch:11,burglary:43} as const;
/** The grge row's box as CGarage keeps it: m_vPosn (the first corner), m_vDirectionA along the door's front for
 * m_fWidth, m_vDirectionB to the far corner for m_fHeight (the depth), and m_fTopZ. */
export interface ScmGarageBox {base:readonly [number,number,number];dirA:readonly [number,number];dirB:readonly [number,number];width:number;depth:number;topZ:number}
export interface ScmGarage {name:string;type:number;doorState:number;inactive:boolean;resprayFree:boolean;
 /** m_fDoorPosition, 0 shut to 1 open. */
 doorPosition:number;
 /** m_pTargetCar, by script handle. */
 targetCar?:number;
 /** m_nFlags as the row gives them (0x1 the door opens up, 0x2 it goes in). */
 flags:number;
 box?:ScmGarageBox}
/** What a host loads a garage from: the grge row, or a bare name and type for a world without geometry. */
export interface ScmGarageRow {name:string;type:number;corner?:readonly [number,number,number];front?:readonly [number,number];far?:readonly [number,number,number];flags?:number}
/** The door's travel a 50 Hz step. CGarage::Update is unreversed; these are re3's DEFAULT_DOOR_OPEN_SPEED and
 * DEFAULT_DOOR_CLOSE_SPEED (0.035 and 0.04 units a step) over a three-unit door, as a fraction of its height. */
export const GARAGE_DOOR_OPEN_SPEED=.035/3,GARAGE_DOOR_CLOSE_SPEED=.04/3;
/** CGarage::IsHideOut: the safehouse garages and the abandoned airport's hangar. */
const HIDEOUT_TYPES=new Set([16,17,18,24,25,26,27,28,29,30,31,32,39,40,41,42,45]);
export const isHideOutGarageType=(type:number)=>HIDEOUT_TYPES.has(type);
export class ScmGarages {
 readonly garages:ScmGarage[]=[];
 /** What a host calls with the world's own garages. */
 load(garages:readonly ScmGarageRow[]){
  this.garages.length=0;
  for(const garage of garages){
   let box:ScmGarageBox|undefined;
   if(garage.corner&&garage.front&&garage.far){
    // CGarages::AddOne's box (unreversed; the fields of CGarage above): the front direction and its length as the
    // width, the far corner's direction and its length as the depth, the far corner's height as the top.
    const [x1,y1,z1]=garage.corner,ax=garage.front[0]-x1,ay=garage.front[1]-y1,width=Math.hypot(ax,ay)||1,bx=garage.far[0]-x1,by=garage.far[1]-y1,depth=Math.hypot(bx,by)||1;
    box={base:[x1,y1,z1],dirA:[ax/width,ay/width],dirB:[bx/depth,by/depth],width,depth,topZ:garage.far[2]};
   }
   this.garages.push({name:garage.name,type:garage.type,doorState:GARAGE_DOOR_CLOSED,inactive:false,resprayFree:false,doorPosition:0,flags:garage.flags??0,box});
  }
 }
 /** CGarage::IsPointInsideGarage (unreversed, from the box CGarage keeps): between the floor and the top, and within
  * the width along the front and the depth towards the far corner. */
 static pointInside(garage:ScmGarage,p:readonly [number,number,number]){
  const b=garage.box;if(!b)return false;
  if(p[2]<b.base[2]||p[2]>b.topZ)return false;
  const dx=p[0]-b.base[0],dy=p[1]-b.base[1],a=dx*b.dirA[0]+dy*b.dirA[1],d=dx*b.dirB[0]+dy*b.dirB[1];
  return a>=0&&a<=b.width&&d>=0&&d<=b.depth;
 }
 /** CGarages::IsPointWithinHideOutGarage: a point inside a safehouse garage. CWorld::ClearExcitingStuffFromArea
  * leaves the vehicles there alone; in the game CloseHideOutGaragesBeforeSave has already stored them for the
  * door's next opening (CStoredCar, unreversed), so what the player sees is his cars still in his garage. */
 isPointWithinHideOut(p:readonly [number,number,number]){return this.garages.some(garage=>isHideOutGarageType(garage.type)&&ScmGarages.pointInside(garage,p));}
 /** CGarage::Update's door travel (the routine is unreversed; the speeds are re3's): an opening door slides up to
  * 1 and is then open, a closing one down to 0 and shut. IS_GARAGE_OPEN and IS_GARAGE_CLOSED wait on these. */
 update(timeStepMs:number){
  const step=timeStepMs/20;
  for(const garage of this.garages){
   if(garage.doorState===GARAGE_DOOR_OPENING){garage.doorPosition=Math.min(1,garage.doorPosition+GARAGE_DOOR_OPEN_SPEED*step);if(garage.doorPosition>=1)garage.doorState=GARAGE_DOOR_OPEN;}
   else if(garage.doorState===GARAGE_DOOR_CLOSING){garage.doorPosition=Math.max(0,garage.doorPosition-GARAGE_DOOR_CLOSE_SPEED*step);if(garage.doorPosition<=0)garage.doorState=GARAGE_DOOR_CLOSED;}
  }
 }
 /** CGarages::GetGarageNumberByName (0x447680): by name, ignoring case, or -1. */
 numberByName(name:string){const wanted=name.toLowerCase();return this.garages.findIndex(garage=>garage.name.toLowerCase()===wanted);}
 private at(name:string){const index=this.numberByName(name);return index<0?undefined:this.garages[index];}
 /** ActivateGarage: the garage wakes, and a close-on-touch garage whose door is not shut starts opening. */
 activate(name:string){
  const garage=this.at(name);if(!garage)return;
  garage.inactive=false;
  if(garage.type===GARAGE_TYPE.closesOnTouch&&garage.doorState!==GARAGE_DOOR_CLOSED)garage.doorState=GARAGE_DOOR_OPENING;
 }
 /** DeActivateGarage. */
 deactivate(name:string){const garage=this.at(name);if(garage)garage.inactive=true;}
 /** ChangeGarageType (0x4476D0): the bomb shops and the Pay 'n' Spray stand open, a burglary garage is left as it
  * is, and every other type shuts with its door back at rest. (gta-reversed's body edits a copy of the garage, a
  * refactor slip; this follows what it plainly means.) */
 changeType(name:string,type:number){
  const garage=this.at(name);if(!garage)return;
  requireAsset(Number.isInteger(type),'Invalid garage type.');
  garage.type=type;
  if(type<GARAGE_TYPE.bombshopTimed||type>GARAGE_TYPE.paynspray){
   if(type===GARAGE_TYPE.burglary)return;
   garage.doorState=GARAGE_DOOR_CLOSED;garage.doorPosition=0;return;
  }
  if(garage.doorState===GARAGE_DOOR_CLOSED){garage.doorState=GARAGE_DOOR_OPEN;garage.doorPosition=1;}
 }
 /** CGarage::OpenThisGarage (0x447D50): only a shut or shutting door starts opening. */
 open(name:string){const garage=this.at(name);if(garage&&(garage.doorState===GARAGE_DOOR_CLOSED||garage.doorState===GARAGE_DOOR_CLOSING||garage.doorState===GARAGE_DOOR_CLOSED_DROPPED_CAR))garage.doorState=GARAGE_DOOR_OPENING;}
 /** CGarage::CloseThisGarage (0x447D70): only an open or opening door starts closing. */
 close(name:string){const garage=this.at(name);if(garage&&(garage.doorState===GARAGE_DOOR_OPEN||garage.doorState===GARAGE_DOOR_OPENING))garage.doorState=GARAGE_DOOR_CLOSING;}
 /** CGarage::IsOpen (open, or waiting for the player to leave) and IsClosed (shut): a moving door is neither. A
  * garage this world does not carry answers no to both. */
 isOpen(name:string){const garage=this.at(name);return garage?.doorState===GARAGE_DOOR_OPEN||garage?.doorState===GARAGE_DOOR_WAITING_PLAYER_TO_EXIT;}
 isClosed(name:string){const garage=this.at(name);return garage?.doorState===GARAGE_DOOR_CLOSED;}
 /** CGarages::SetTargetCarForMissionGarage (0x447C40): a garage that dropped its last car shuts again for the new one. */
 setTargetCar(name:string,car:number|undefined){
  const garage=this.at(name);if(!garage)return;
  garage.targetCar=car;if(car!==undefined&&garage.doorState===GARAGE_DOOR_CLOSED_DROPPED_CAR)garage.doorState=GARAGE_DOOR_CLOSED;
 }
 /** CGarages::AllRespraysCloseOrOpen (0x448B30), with SET_NO_RESPRAYS's flag passed straight through as the game does. */
 allRespraysCloseOrOpen(open:boolean){for(const garage of this.garages)if(garage.type===GARAGE_TYPE.paynspray)garage.doorState=open?GARAGE_DOOR_OPEN:GARAGE_DOOR_CLOSED;}
 setResprayFree(name:string,free:boolean){const garage=this.at(name);if(garage)garage.resprayFree=free;}
}
/** CGarages' one message line (MessageIDString, MessageStartTime/EndTime, MessageNumberInString/2): the pickup and
 * tag tallies. TriggerMessage (0x447B80) restarts a different or finished message, ignores a repeat within its first
 * 500 ms and otherwise restarts it 500 ms back; PrintMessages (0x447790) clears the tag once its time is over. While
 * the tag is set, CHud::SetHelpMessage and its kin do nothing. */
export class ScmGarageMessage {
 id='';start=0;end=0;number=-1;number2=-1;
 trigger(tag:string,number:number,timeMs:number,number2:number,nowMs:number){
  if(tag!==this.id||nowMs<this.start||nowMs>=this.end){this.id=tag;this.start=nowMs;}
  else{if(nowMs-this.start<=500)return;this.start=nowMs-500;}
  this.end=this.start+timeMs;this.number=number;this.number2=number2;
 }
 /** PrintMessages' draw: the tag and its numbers while the message runs, and nothing (the tag dropped) after. */
 current(nowMs:number){
  if(!this.id)return undefined;
  if(nowMs<this.start||nowMs>=this.end){this.id='';return undefined;}
  return {id:this.id,number:this.number,number2:this.number2};
 }
 /** CGarages::MessageIDString[0]: a message tag is set until a draw finds its time over. */
 get showing(){return !!this.id;}
}
