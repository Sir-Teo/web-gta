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
export interface ScmGarage {name:string;type:number;doorState:number;inactive:boolean;
 /** m_bRespraysAlwaysFree, which SET_GARAGE_RESPRAY_FREE sets. */
 resprayFree:boolean;
 /** m_bUsedRespray: a respray happened here since HAS_RESPRAY_HAPPENED last asked. */
 usedRespray:boolean;
 /** m_nTimeToOpen: when a Pay 'n' Spray's shut door opens on the resprayed car; 0 while none is in the spray. */
 timeToOpen:number;
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
/** The respray's price (GA_2, GA_3 and GA_XX all name $100) and re3's TIME_TO_RESPRAY, how long the door stays shut. */
export const RESPRAY_PRICE=100,TIME_TO_RESPRAY=2000;
/** eStats' STAT_VEHICLE_RESPRAYS, which the respray adds one to. */
export const STAT_VEHICLE_RESPRAYS=138;
/** What CGarage::Update's PAYNSPRAY case reaches in the world (FindPlayerVehicle, CWorld::Players, the wanted level). */
export interface GarageResprayWorld {
 nowMs:number;
 /** IsStaticPlayerCarEntirelyInside and not IsAnyOtherCarTouchingGarage: the player's vehicle, at rest, wholly in the
  * garage's box, and no other car touching it. */
 playerCarParkedInside(garage:ScmGarage):boolean;
 /** CGarages::IsCarSprayable for the player's vehicle, and SET_CAN_RESPRAY_CAR's word on it. */
 playerCarSprayable():boolean;
 /** IsPlayerOutsideGarage: neither the player nor his vehicle is in the box any more. */
 playerOutside(garage:ScmGarage):boolean;
 money():number;wantedLevel():number;
 /** The work on the car: fixed and its fire out (`repaired` when its health had been under 1000), and a new paint
  * chosen (`recoloured` when it differs). Nothing when he has no vehicle by then. */
 respray():{repaired:boolean;recoloured:boolean}|undefined;
 pay(amount:number):void;clearWanted():void;
 /** CPad's PLAYERCONTROL_GARAGE and CWanted::m_bPoliceBackOffGarage, held while the car is in the spray. */
 holdPlayer(on:boolean):void;
 /** CGarages::TriggerMessage(id, -1, 4000, -1). */
 message(id:string):void;
 /** CGeneral::GetRandomTrueFalse. */
 coin():boolean;
}
/** CGarages::IsCarSprayable (0x4479A0, reversed): not a law-enforcement vehicle (CVehicle::IsLawEnforcementVehicle:
 * the Enforcer, Predator, Rhino, Barracks, FBI Rancher and truck, the police bike, the four police cars and the SWAT
 * van), not a BMX-class bike (BMX, Bike, Mountain Bike), and not the Bus, Coach, articulated trailer, Fire Truck or
 * Ambulance. */
const UNSPRAYABLE=new Set([427,430,432,433,490,523,528,596,597,598,599,601,481,509,510,431,437,435,407,416]);
export const isCarSprayable=(model:number)=>!UNSPRAYABLE.has(model);
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
   // CGarages::AddOne / InitDoorsAtStart are unreversed: as in re3's AddOne, the bomb shops and the Pay 'n' Sprays
   // stand open with their doors up, and every other garage starts shut.
   const open=garage.type>=GARAGE_TYPE.bombshopTimed&&garage.type<=GARAGE_TYPE.paynspray;
   this.garages.push({name:garage.name,type:garage.type,doorState:open?GARAGE_DOOR_OPEN:GARAGE_DOOR_CLOSED,inactive:false,resprayFree:false,usedRespray:false,timeToOpen:0,
    doorPosition:open?1:0,flags:garage.flags??0,box});
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
 /** A sphere wholly in the garage's box (re3's IsEntityEntirelyInside3D test of each collision sphere, over SA's turned
  * box): within the floor and top, and its radius clear of every side. */
 static sphereInside(garage:ScmGarage,p:readonly [number,number,number],r:number){
  const b=garage.box;if(!b||p[2]-r<b.base[2]||p[2]+r>b.topZ)return false;
  const dx=p[0]-b.base[0],dy=p[1]-b.base[1],a=dx*b.dirA[0]+dy*b.dirA[1],d=dx*b.dirB[0]+dy*b.dirB[1];
  return a>=r&&a<=b.width-r&&d>=r&&d<=b.depth-r;
 }
 /** A sphere reaching into the garage's box (re3's IsEntityTouching3D, sphere by sphere). */
 static sphereTouching(garage:ScmGarage,p:readonly [number,number,number],r:number){
  const b=garage.box;if(!b||p[2]+r<b.base[2]||p[2]-r>b.topZ)return false;
  const dx=p[0]-b.base[0],dy=p[1]-b.base[1],a=dx*b.dirA[0]+dy*b.dirA[1],d=dx*b.dirB[0]+dy*b.dirB[1];
  return a>=-r&&a<=b.width+r&&d>=-r&&d<=b.depth+r;
 }
 /** CGarages::IsPointWithinHideOutGarage: a point inside a safehouse garage. CWorld::ClearExcitingStuffFromArea
  * leaves the vehicles there alone; in the game CloseHideOutGaragesBeforeSave has already stored them for the
  * door's next opening (CStoredCar, unreversed), so what the player sees is his cars still in his garage. */
 isPointWithinHideOut(p:readonly [number,number,number]){return this.garages.some(garage=>isHideOutGarageType(garage.type)&&ScmGarages.pointInside(garage,p));}
 /** What a Pay 'n' Spray asks of the world; without it a respray garage's door only travels. */
 respray?:GarageResprayWorld;
 /** CGarages::NoResprays and RespraysAreFree (SET_NO_RESPRAYS and SET_FREE_RESPRAYS). */
 noResprays=false;freeResprays=false;
 /** CGarage::Update's door travel (the routine is unreversed; the speeds are re3's): an opening door slides up to
  * 1 and is then open, a closing one down to 0 and shut. IS_GARAGE_OPEN and IS_GARAGE_CLOSED wait on these. */
 update(timeStepMs:number){
  const step=timeStepMs/20;
  for(const garage of this.garages){
   if(garage.type===GARAGE_TYPE.paynspray&&this.respray&&!garage.inactive){this.updateRespray(garage,step,this.respray);continue;}
   if(garage.doorState===GARAGE_DOOR_OPENING){garage.doorPosition=Math.min(1,garage.doorPosition+GARAGE_DOOR_OPEN_SPEED*step);if(garage.doorPosition>=1)garage.doorState=GARAGE_DOOR_OPEN;}
   else if(garage.doorState===GARAGE_DOOR_CLOSING){garage.doorPosition=Math.max(0,garage.doorPosition-GARAGE_DOOR_CLOSE_SPEED*step);if(garage.doorPosition<=0)garage.doorState=GARAGE_DOOR_CLOSED;}
  }
 }
 /** CGarage::Update's PAYNSPRAY case. Update is unreversed in the reference, so this is AUTHORED from re3's and reVC's
  * GARAGE_RESPRAY case with SA's door states and SA's own lines: a sprayable car parked still and wholly inside, with
  * no other car in the way, shuts the door on the player (his controls and the police held off meanwhile) if he has
  * the $100 or resprays are free; else GA_3 (no money) or GA_1 (a car the garage will not touch), and the door waits
  * for him to leave. Two seconds after the door is down the car is fixed and repainted, the wanted level cleared,
  * the money taken if there was a wanted level or damage to put right, and the door opens. SET_NO_RESPRAYS's doors
  * go down and stay down, and come back up when it is lifted. */
 private updateRespray(garage:ScmGarage,step:number,world:GarageResprayWorld){
  switch(garage.doorState){
   case GARAGE_DOOR_OPEN:
    if(this.noResprays){garage.doorState=GARAGE_DOOR_CLOSING;break;}
    if(!world.playerCarParkedInside(garage))break;
    if(!world.playerCarSprayable()){world.message('GA_1');garage.doorState=GARAGE_DOOR_WAITING_PLAYER_TO_EXIT;break;}
    if(world.money()<RESPRAY_PRICE&&!this.resprayIsFree(garage)){world.message('GA_3');garage.doorState=GARAGE_DOOR_WAITING_PLAYER_TO_EXIT;break;}
    garage.doorState=GARAGE_DOOR_CLOSING;garage.timeToOpen=-1;world.holdPlayer(true);
    break;
   case GARAGE_DOOR_CLOSING:
    garage.doorPosition=Math.max(0,garage.doorPosition-GARAGE_DOOR_CLOSE_SPEED*step);
    if(garage.doorPosition<=0){garage.doorState=GARAGE_DOOR_CLOSED;if(garage.timeToOpen<0)garage.timeToOpen=world.nowMs+TIME_TO_RESPRAY;}
    break;
   case GARAGE_DOOR_CLOSED:
    if(garage.timeToOpen>0){
     if(world.nowMs<=garage.timeToOpen)break;
     garage.timeToOpen=0;garage.doorState=GARAGE_DOOR_OPENING;this.doRespray(garage,world);world.holdPlayer(false);
    }else if(!this.noResprays)garage.doorState=GARAGE_DOOR_OPENING;
    break;
   case GARAGE_DOOR_OPENING:
    garage.doorPosition=Math.min(1,garage.doorPosition+GARAGE_DOOR_OPEN_SPEED*step);
    if(garage.doorPosition>=1)garage.doorState=GARAGE_DOOR_WAITING_PLAYER_TO_EXIT;
    break;
   case GARAGE_DOOR_WAITING_PLAYER_TO_EXIT:
    if(world.playerOutside(garage))garage.doorState=GARAGE_DOOR_OPEN;
    break;
  }
 }
 private resprayIsFree(garage:ScmGarage){return this.freeResprays||garage.resprayFree;}
 /** The respray itself, as the door starts up: GA_2 when it took a wanted level off him, GA_XX for the repair alone
  * (each $100 unless resprays are free, when it is GA_16, complimentary), and for a car that only changed colour one of
  * GA_15 and GA_16 at random, free. */
 private doRespray(garage:ScmGarage,world:GarageResprayWorld){
  const wanted=world.wantedLevel()>0;if(wanted)world.clearWanted();
  const done=world.respray();garage.usedRespray=true;
  const free=this.resprayIsFree(garage);
  if(wanted||done?.repaired){if(free)world.message('GA_16');else{world.pay(RESPRAY_PRICE);world.message(wanted?'GA_2':'GA_XX');}}
  else if(done?.recoloured)world.message(world.coin()?'GA_15':'GA_16');
 }
 /** CGarages::HasResprayHappened (0x447E10): the flag is read and cleared. */
 hasResprayHappened(name:string){const garage=this.at(name);if(!garage)return false;const used=garage.usedRespray;garage.usedRespray=false;return used;}
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
/** re3's DISTANCE_TO_CONSIDER_DOOR_FOR_GARAGE: a door model within this of a garage's centre, in x and in y, is its. */
export const GARAGE_DOOR_REACH=20;
/** The middle of a garage's box (re3's GetGarageCenterX/Y over SA's turned box). */
export function garageCentre(garage:ScmGarage){
 const b=garage.box;if(!b)return undefined;
 return {x:b.base[0]+b.dirA[0]*b.width/2+b.dirB[0]*b.depth/2,y:b.base[1]+b.dirA[1]*b.width/2+b.dirB[1]*b.depth/2};
}
/** CGarages::FindDoorHeightForMI (0x449C30): the door model's collision box height less a tenth. */
export const garageDoorHeight=(bounds:{min:{z:number};max:{z:number}})=>bounds.max.z-bounds.min.z-.1;
/** A garage door's matrix (native axes) for a door position of 0 (shut) to 1 (open), from where the map has it shut
 * and its heading (radians, forward = (-sin, cos)). The placing is unreversed in SA (CGarage::Update and the slide
 * routines), so this is re3's UpdateDoorsHeight: a door rises by its height as it opens; a garage whose row has the
 * 0x1 flag (the door opens up and turns) rises by half that less a tenth, as re3's SetGarageDoorToRotate sets it,
 * while CGarage::BuildRotatedDoorMatrix (0x4479F0, reversed) turns it a quarter turn about its forward axis. */
export function garageDoorPose(home:{x:number;y:number;z:number},heading:number,height:number,rotates:boolean,position:number){
 const forward={x:-Math.sin(heading),y:Math.cos(heading),z:0};
 if(!rotates)return {position:{x:home.x,y:home.y,z:home.z+position*height},right:{x:forward.y,y:-forward.x,z:0},forward,up:{x:0,y:0,z:1}};
 const angle=position*-Math.PI/2,s=Math.sin(angle),c=Math.cos(angle);
 const up={x:-s*forward.y,y:s*forward.x,z:c};
 // CrossProduct(forward, up).
 const right={x:forward.y*up.z-forward.z*up.y,y:forward.z*up.x-forward.x*up.z,z:forward.x*up.y-forward.y*up.x};
 return {position:{x:home.x,y:home.y,z:home.z+position*(height/2-.1)},right,forward,up};
}
