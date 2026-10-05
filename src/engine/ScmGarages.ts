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
/** The door's travel a 50 Hz step: CGarage::SlideDoorOpen and SlideDoorClosed, unreversed in gta-reversed, from the
 * iOS executable (arm64 0x1001b5918 and the next): 0.011 and 0.013 of the way a step, a tenth of that for the two
 * hangars (HANGAR_AT400 and HANGAR_ABANDONED_AIRPORT, 44 and 45). */
export const GARAGE_DOOR_OPEN_SPEED=.011,GARAGE_DOOR_CLOSE_SPEED=.013;
const SLOW_DOOR_TYPES=new Set([44,45]);
/** CAEDoorAudioEntity's garage events the slides report to the garage's own door audio (m_GarageAudio). */
export const AE_GARAGE_DOOR_OPENING=159,AE_GARAGE_DOOR_OPENED=160,AE_GARAGE_DOOR_CLOSING=161,AE_GARAGE_DOOR_CLOSED=162;
/** The respray's price (GA_2, GA_3 and GA_XX all name $100) and re3's TIME_TO_RESPRAY, how long the door stays shut. */
export const RESPRAY_PRICE=100,TIME_TO_RESPRAY=2000;
/** eStats the respray touches: STAT_VEHICLE_RESPRAYS (one more), STAT_AUTO_REPAIR_AND_PAINTING_BUDGET (the $100), and the
 * kills since the last checkpoint, which the shut door adds to the legitimate ones and clears. */
export const STAT_VEHICLE_RESPRAYS=138,STAT_AUTO_REPAIR_AND_PAINTING_BUDGET=16,STAT_KILLS_SINCE_LAST_CHECKPOINT=176,STAT_TOTAL_LEGITIMATE_KILLS=177;
/** AE_FRONTEND_CAR_NO_CASH, _CAR_IS_HOT and _CAR_RESPRAY. */
export const AE_FRONTEND_CAR_NO_CASH=14,AE_FRONTEND_CAR_IS_HOT=15,AE_FRONTEND_CAR_RESPRAY=16;
/** What CGarage::Update's PAYNSPRAY case reaches in the world (FindPlayerVehicle, CWorld::Players, the wanted level). */
export interface GarageResprayWorld {
 nowMs:number;
 /** IsStaticPlayerCarEntirelyInside and not IsAnyOtherCarTouchingGarage: the player's vehicle, at rest, wholly in the
  * garage's box, and no other car touching it. */
 playerCarParkedInside(garage:ScmGarage):boolean;
 /** Why the garage turns the player's vehicle away: 'bmx' for a BMX-class bike (GA_1B); 'unsprayable' for one under
  * 250 health or one CGarages::IsCarSprayable refuses (GA_1); nothing for one it takes. */
 playerCarRefusal():'bmx'|'unsprayable'|undefined;
 /** IsPlayerOutsideGarage: neither the player nor his vehicle is in the box any more. */
 playerOutside(garage:ScmGarage):boolean;
 money():number;wantedLevel():number;
 /** The work on an automobile or bike: its health held to at least 1000 (`repaired` when it had been under 970), its
  * burn timer cleared and CVehicle::Fix, STAT_VEHICLE_RESPRAYS one more, set upright if it lay on its roof, and unless
  * it may not change colour (SET_CAN_RESPRAY_CAR off, or a paintjob) ChooseVehicleColour once (`recoloured` when any
  * of its four colours changed). Nothing when he has no vehicle by then. */
 respray():{repaired:boolean;recoloured:boolean}|undefined;
 pay(amount:number):void;clearWanted():void;
 /** CPad's PLAYERCONTROL_GARAGE and CWanted::m_bPoliceBackOffGarage, held while the car is in the spray. */
 holdPlayer(on:boolean):void;
 /** CGarages::TriggerMessage(id, -1, 4000, -1). */
 message(id:string):void;
 /** CGeneral::GetRandomTrueFalse. */
 coin():boolean;
 /** AudioEngine.ReportFrontendAudioEvent. */
 sound(event:number):void;
 /** CStats::GetStatValue, IncrementStat and SetStatValue. */
 stats:{get(id:number):number;increment(id:number,by:number):void;set(id:number,value:number):void};
}
/** AE_FRONTEND_CAR_ALREADY_RIGGED, and the first of the three fittings (_FIT_BOMB_TIMED, _BOOBY_TRAPPED and
 * _REMOTE_CONTROLLED, 18 to 20 for the shop types 2 to 4). */
export const AE_FRONTEND_CAR_ALREADY_RIGGED=17,AE_FRONTEND_CAR_FIT_BOMB_TIMED=18;
/** A car bomb's price (GA_4: "Car bombs are $500 each."), how long the door stays down over the fitting, and
 * STAT_KGS_OF_EXPLOSIVES_USED, which a fitting adds 10 to. */
export const BOMB_PRICE=500,TIME_TO_FIT_BOMB=2000,STAT_KGS_OF_EXPLOSIVES_USED=127;
/** BOMBSHOP_TIMED, BOMBSHOP_ENGINE and BOMBSHOP_REMOTE: the shop's type less 1 is the bomb it fits (eBombState
 * BOMB_TIMED_NOT_ACTIVATED, BOMB_IGNITION, BOMB_STICKY). */
const BOMB_SHOP_TYPES=new Set([2,3,4]);
/** The help each shop shows once it has fitted its bomb: GA_6, GA_7 and GA_8. */
const BOMB_SHOP_HELP:Readonly<Record<number,string>>={2:'GA_6',3:'GA_7',4:'GA_8'};
/** What CGarage::Update's bomb shop case reaches in the world. */
export interface GarageBombShopWorld {
 readonly nowMs:number;
 /** IsStaticPlayerCarEntirelyInside, as the Pay 'n' Spray asks it. */
 playerCarParkedInside(garage:ScmGarage):boolean;
 /** FindPlayerVehicle's m_nBombOnBoard when it is an automobile; undefined without one, or for a bike or BMX, which
  * the case turns away without a word. */
 playerCarBomb():number|undefined;
 /** IsPlayerOutsideGarage. */
 playerOutside(garage:ScmGarage):boolean;
 money():number;pay(amount:number):void;
 /** PLAYERCONTROL_GARAGE and CWanted::m_bPoliceBackOffGarage while the door is down on him. */
 holdPlayer(on:boolean):void;
 /** CGarages::TriggerMessage(id, -1, 4000, -1). */
 message(id:string):void;
 /** CHud::SetHelpMessage of a GXT key, added to the brief. */
 help(key:string):void;
 /** AudioEngine.ReportFrontendAudioEvent. */
 sound(event:number):void;
 stats:{increment(id:number,by:number):void};
 /** The fitting, on the player's vehicle if it is an automobile or bike (false when there is none to fit): its
  * m_nBombOnBoard the bomb, m_pWhoInstalledBombOnMe the player, and with `detonator` the player given the detonator
  * (one charge, ready) and set to hold it. */
 fitBomb(bomb:number,detonator:boolean):boolean;
}
/** CGarages::IsCarSprayable (0x4479A0, reversed): not a law-enforcement vehicle (CVehicle::IsLawEnforcementVehicle:
 * the Enforcer, Predator, Rhino, Barracks, FBI Rancher and truck, the police bike, the four police cars and the SWAT
 * van), not a BMX-class bike (BMX, Bike, Mountain Bike), and not the Bus, Coach, articulated trailer, Fire Truck or
 * Ambulance. */
const UNSPRAYABLE=new Set([427,430,432,433,490,523,528,596,597,598,599,601,481,509,510,431,437,435,407,416]);
export const isCarSprayable=(model:number)=>!UNSPRAYABLE.has(model);
/** CVehicle::IsSubBMX's models: the BMX, Bike and Mountain Bike. */
export const BMX_CLASS_MODELS:ReadonlySet<number>=new Set([481,509,510]);
/** CGarage::IsHideOut: the safehouse garages and the abandoned airport's hangar. */
const HIDEOUT_TYPES=new Set([16,17,18,24,25,26,27,28,29,30,31,32,39,40,41,42,45]);
export const isHideOutGarageType=(type:number)=>HIDEOUT_TYPES.has(type);
/** The garage types CGarage::Update runs as a hideout (the iOS type table's 0x1001b2c10): the safehouses and type 44,
 * the hangar that keeps no cars. */
const HIDEOUT_UPDATE_TYPES=new Set([...HIDEOUT_TYPES,44]);
/** MAX_NUM_CARS_IN_HIDEOUT: two for type 16, four for the rest. */
export const hideOutCapacity=(type:number)=>type===16?2:4;
/** CGarage's m_fLeftCoord, m_fRightCoord, m_fFrontCoord and m_fBackCoord: the box's reach in x and y. */
export function garageFootprint(garage:ScmGarage){
 const b=garage.box;if(!b)return undefined;
 const xs:number[]=[],ys:number[]=[];
 for(const [a,d] of [[0,0],[b.width,0],[0,b.depth],[b.width,b.depth]] as const){xs.push(b.base[0]+b.dirA[0]*a+b.dirB[0]*d);ys.push(b.base[1]+b.dirA[1]*a+b.dirB[1]*d);}
 return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};
}
/** CGarage::Update's distance squared in x and y from a point to the garage's footprint (nothing inside it). */
export function footprintDistance2(garage:ScmGarage,x:number,y:number){
 const f=garageFootprint(garage);if(!f)return Infinity;
 const dx=x<f.minX?x-f.minX:x>f.maxX?x-f.maxX:0,dy=y<f.minY?y-f.minY:y>f.maxY?y-f.maxY:0;
 return dx*dx+dy*dy;
}
/** CStoredCar (0x40 bytes in the game): what a hideout keeps of a car while its door is shut. CStoredCar::StoreCar and
 * RestoreCar are unreversed in gta-reversed; the iOS executable's (0x1001b7d00, 0x1001b7f20) are followed for the
 * parts the port's cars carry. */
export interface StoredCar {
 model:number;
 /** m_vPosn, in native axes. */
 position:[number,number,number];
 /** m_nPackedForwardX, Y and Z: the forward vector times 100, cut to whole numbers. */
 forward:[number,number,number];
 /** m_nPrimaryColor to m_nQuaternaryColor. */
 colours:[number,number,number,number];
 /** m_nStoredCarFlags: 1 bullet proof, 2 fire proof, 4 explosion proof, 8 collision proof, 16 melee proof, 128 nitro
  * fitted. */
 flags:number;
 /** m_nNitroBoosts. */
 nitroBoosts:number;
 /** m_nBombOnBoard, for an automobile or bike (absent for none). RestoreCar gives it back without its installer, so a
  * sticky bomb put back answers no detonator. */
 bomb?:number;
}
export const STORED_CAR={bulletProof:1,fireProof:2,explosionProof:4,collisionProof:8,meleeProof:16,nitro:128} as const;
/** NUM_GARAGE_STORED_CARS, and the twenty slots of CGarages::aCarsInSafeHouse. */
export const STORED_CARS_PER_GARAGE=4,HIDEOUT_SLOT_COUNT=20;
/** aCarsInSafeHouse's slot for a garage type (the iOS table at 0x100593290): the safehouses (16 to 18, 24 to 32, 39 to
 * 42, 45) and the impound lots (33 to 35); the table gives the rest slot 0. */
const HIDEOUT_SLOTS:Readonly<Record<number,number>>={16:0,17:1,18:2,24:3,25:4,26:5,27:6,28:7,29:8,30:9,31:10,32:11,33:12,34:13,35:14,39:15,40:16,41:17,42:18,45:19};
export const hideOutSlot=(type:number)=>HIDEOUT_SLOTS[type]??0;
/** The police impounds (IMPOUND_LS, _SF and _LV): CGarage::Update's case at iOS 0x1001b2d40. */
export const IMPOUND_TYPES:ReadonlySet<number>=new Set([33,34,35]);
/** How many cars an impound keeps (the first three of its four places). */
export const IMPOUND_CAPACITY=3;
/** The impound's line-up before its cars come back (iOS 0x1001b7240): in a row along the box's front, 4 units apart,
 * about the middle of the box half a unit over its floor, each facing across the row (the front's direction turned a
 * quarter to the right, packed). */
export function placeCarsInImpound(garage:ScmGarage,slot:(StoredCar|null)[]){
 const b=garage.box;if(!b)return;
 const l=Math.hypot(b.dirA[0],b.dirA[1])||1,nx=b.dirA[0]/l,ny=b.dirA[1]/l,vx=nx*4,vy=ny*4;
 const cx=b.base[0]+b.dirA[0]*b.width/2+b.dirB[0]*b.depth/2,cy=b.base[1]+b.dirA[1]*b.width/2+b.dirB[1]*b.depth/2,cz=b.base[2]+.5;
 for(let i=0;i<IMPOUND_CAPACITY;i++){
  const car=slot[i];if(!car)break;
  car.position=[cx-vx+i*vx,cy-vy+i*vy,cz];car.forward=[Math.trunc(ny*100),Math.trunc(nx*-100),0];
 }
}
/** A stored car from a save, checked; undefined for anything that is not one. */
export function readStoredCar(value:unknown):StoredCar|undefined{
 const v=value as Partial<StoredCar>|null;
 const ints=(a:unknown,n:number)=>Array.isArray(a)&&a.length===n&&a.every(x=>Number.isInteger(x));
 if(!v||!Number.isInteger(v.model)||!(v.model!>0)||!Array.isArray(v.position)||v.position.length!==3||!v.position.every(Number.isFinite)||!ints(v.forward,3)||!ints(v.colours,4)||!Number.isInteger(v.flags)||!Number.isInteger(v.nitroBoosts))return undefined;
 const bomb=Number.isInteger(v.bomb)&&v.bomb!>0&&v.bomb!<=5?v.bomb:undefined;
 return {model:v.model!,position:[...v.position] as StoredCar['position'],forward:[...v.forward!] as StoredCar['forward'],colours:[...v.colours!] as StoredCar['colours'],flags:v.flags!,nitroBoosts:v.nitroBoosts!,...(bomb?{bomb}:{})};
}
/** What a hideout garage asks of the world. */
export interface GarageHideoutWorld {
 /** FindPlayerCentreOfWorld: his vehicle's position, or his own, in native axes. */
 playerCentre():readonly [number,number,number];
 /** The vehicle he is in: 'bmx' for a BMX-class bike, 'vehicle' for any other, nothing on foot. */
 playerVehicle():'vehicle'|'bmx'|undefined;
 /** IsEntityEntirelyOutside(his vehicle, or him on foot, margin). */
 playerOutside(garage:ScmGarage,margin:number):boolean;
 /** CountCarsWithCenterPointWithinGarage, his own vehicle not counted. */
 carsInside(garage:ScmGarage):number;
 /** IsAnyCarBlockingDoor: a vehicle half in and half out. */
 carBlockingDoor(garage:ScmGarage):boolean;
 /** StoreAndRemoveCarsForThisHideOut's world part (reversed, 0x449900): every vehicle with its middle in the box that
  * is not a mission's is taken out of the world, and of those without a sphere a unit outside it the first `max` come
  * back stored (CStoredCar::StoreCar). Without it the garage keeps no cars of its own. */
 removeCarsInside?(garage:ScmGarage,max:number):StoredCar[];
 /** CStoredCar::RestoreCar with CWorld::Add: true once the car stands in the world again (or never can), false while
  * it is still being made. An impound's car is also set on its wheels (PlaceOnRoadProperly) and marked impounded. */
 restoreCar?(car:StoredCar,impound?:boolean):boolean;
 /** RemoveCarsBlockingDoorNotInside (iOS 0x1001b6b48): from the pool's end, the first vehicle touching the box with
  * its middle out of it, not locked and deletable, removed. */
 removeCarBlockingDoor?(garage:ScmGarage):void;
 /** For a full garage: whether the player's vehicle (FindPlayerEntity) is under `distance` from one of the garage's
  * doors (FindDoorsWithGarage) in x and y. */
 playerNearDoor?(garage:ScmGarage,distance:number):boolean;
 /** CHud::SetHelpMessage of a GXT key. */
 help?(key:string):void;
 /** CTimer::m_snTimeInMilliseconds. */
 readonly nowMs?:number;
}
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
 /** What a bomb shop asks of the world; without it a bomb shop's door only travels. */
 bombShops?:GarageBombShopWorld;
 /** CGarages::BombsAreFree (SET_FREE_BOMBS, which no script of SA's uses). */
 freeBombs=false;
 /** The door audio a slide reports (CAEDoorAudioEntity::AddAudioEvent on the garage's m_GarageAudio, at its first
  * door object): the host's. */
 onDoorSound?:(garage:ScmGarage,event:number)=>void;
 /** CGarage::SlideDoorOpen: the door slides up, opening sounding each step; at 1 it is up, and opened sounds. True
  * once up. */
 private slideDoorOpen(garage:ScmGarage,step:number){
  garage.doorPosition+=(SLOW_DOOR_TYPES.has(garage.type)?GARAGE_DOOR_OPEN_SPEED/10:GARAGE_DOOR_OPEN_SPEED)*step;
  if(garage.doorPosition<1){this.onDoorSound?.(garage,AE_GARAGE_DOOR_OPENING);return false;}
  garage.doorPosition=1;this.onDoorSound?.(garage,AE_GARAGE_DOOR_OPENED);return true;
 }
 /** CGarage::SlideDoorClosed, the other way: true once down. */
 private slideDoorClosed(garage:ScmGarage,step:number){
  garage.doorPosition-=(SLOW_DOOR_TYPES.has(garage.type)?GARAGE_DOOR_CLOSE_SPEED/10:GARAGE_DOOR_CLOSE_SPEED)*step;
  if(garage.doorPosition>0){this.onDoorSound?.(garage,AE_GARAGE_DOOR_CLOSING);return false;}
  garage.doorPosition=0;this.onDoorSound?.(garage,AE_GARAGE_DOOR_CLOSED);return true;
 }
 /** CGarage::Update's door travel (Update itself is unreversed): an opening door slides up to 1 and is then open, a
  * closing one down to 0 and shut. IS_GARAGE_OPEN and IS_GARAGE_CLOSED wait on these. */
 update(timeStepMs:number){
  const step=timeStepMs/20;
  for(const garage of this.garages){
   if(garage.type===GARAGE_TYPE.paynspray&&this.respray&&!garage.inactive){this.updateRespray(garage,step,this.respray);continue;}
   // Update leaves an inactive garage alone only while it is shut.
   if(HIDEOUT_UPDATE_TYPES.has(garage.type)&&this.hideouts&&!(garage.inactive&&garage.doorState===GARAGE_DOOR_CLOSED)){this.updateHideout(garage,step,this.hideouts);continue;}
   if(IMPOUND_TYPES.has(garage.type)&&this.hideouts&&!(garage.inactive&&garage.doorState===GARAGE_DOOR_CLOSED)){this.updateImpound(garage,this.hideouts);continue;}
   if(BOMB_SHOP_TYPES.has(garage.type)&&this.bombShops&&!(garage.inactive&&garage.doorState===GARAGE_DOOR_CLOSED)){this.updateBombShop(garage,step,this.bombShops);continue;}
   if(garage.doorState===GARAGE_DOOR_OPENING){if(this.slideDoorOpen(garage,step))garage.doorState=GARAGE_DOOR_OPEN;}
   else if(garage.doorState===GARAGE_DOOR_CLOSING){if(this.slideDoorClosed(garage,step))garage.doorState=GARAGE_DOOR_CLOSED;}
  }
 }
 /** CGarage::Update's PAYNSPRAY case, unreversed in the reference and read from the iOS executable (its type table at
  * 0x1001b534c sends a Pay 'n' Spray to 0x1001b30bc, which switches on the door at 0x1001b546c). Open (and resprays
  * allowed): the player's car parked still and wholly inside is turned away (GA_1B for a BMX, GA_1 for an unsprayable
  * one or one under 250 health, with AE_FRONTEND_CAR_IS_HOT) or, short of $100 when resprays are not free, GA_3 with
  * AE_FRONTEND_CAR_NO_CASH; either way the door waits for him to leave. Otherwise the door shuts on him, his controls
  * and the police held off. Shut: AE_FRONTEND_CAR_RESPRAY, the door to open 2 s on, and the kills since the last
  * checkpoint added to the legitimate ones and cleared. Once that time is past (resprays allowed) the door starts up
  * and the respray is done (doRespray). Opening: from halfway up, his controls and the police come back; once up, the
  * door waits for him to be wholly out. */
 private updateRespray(garage:ScmGarage,step:number,world:GarageResprayWorld){
  switch(garage.doorState){
   case GARAGE_DOOR_OPEN:{
    if(this.noResprays||!world.playerCarParkedInside(garage))break;
    const refusal=world.playerCarRefusal();
    if(refusal){world.message(refusal==='bmx'?'GA_1B':'GA_1');world.sound(AE_FRONTEND_CAR_IS_HOT);garage.doorState=GARAGE_DOOR_WAITING_PLAYER_TO_EXIT;break;}
    if(world.money()<RESPRAY_PRICE&&!this.freeResprays){world.message('GA_3');world.sound(AE_FRONTEND_CAR_NO_CASH);garage.doorState=GARAGE_DOOR_WAITING_PLAYER_TO_EXIT;break;}
    garage.doorState=GARAGE_DOOR_CLOSING;world.holdPlayer(true);
    break;
   }
   case GARAGE_DOOR_CLOSING:
    if(this.slideDoorClosed(garage,step)){
     garage.doorState=GARAGE_DOOR_CLOSED;world.sound(AE_FRONTEND_CAR_RESPRAY);garage.timeToOpen=world.nowMs+TIME_TO_RESPRAY;
     world.stats.increment(STAT_TOTAL_LEGITIMATE_KILLS,world.stats.get(STAT_KILLS_SINCE_LAST_CHECKPOINT));world.stats.set(STAT_KILLS_SINCE_LAST_CHECKPOINT,0);
    }
    break;
   case GARAGE_DOOR_CLOSED:
    if(this.noResprays||world.nowMs<=garage.timeToOpen)break;
    garage.doorState=GARAGE_DOOR_OPENING;this.doRespray(garage,world);
    break;
   case GARAGE_DOOR_OPENING:
    if(this.slideDoorOpen(garage,step))garage.doorState=GARAGE_DOOR_WAITING_PLAYER_TO_EXIT;
    if(garage.doorPosition>.5)world.holdPlayer(false);
    break;
   case GARAGE_DOOR_WAITING_PLAYER_TO_EXIT:
    if(world.playerOutside(garage))garage.doorState=GARAGE_DOOR_OPEN;
    break;
  }
 }
 /** CGarage::Update's bomb shop case (types 2 to 4), unreversed in the reference and read from the iOS executable
  * (0x1001b2cc0, its door switch at 0x1001b5458). Open: the player's car parked still and wholly inside (not a bike
  * or BMX) is turned away if it already carries a bomb (GA_5, AE_FRONTEND_CAR_ALREADY_RIGGED) or, short of $500
  * when bombs are not free, with GA_4 and AE_FRONTEND_CAR_NO_CASH; either way the door waits for him to leave.
  * Otherwise it shuts on him, his controls and the police held off. Shut: the door opens 2 s on, then, with its
  * fitting sound, the door starts up, $500 is taken (when he has any money and bombs are not free) and the bomb fitted
  * (fitBomb; STAT_KGS_OF_EXPLOSIVES_USED 10 more), and the shop's help shown (GA_6, GA_7 or GA_8). Opening: from
  * halfway up his controls and the police come back; once up, the door waits for him to be wholly out. */
 private updateBombShop(garage:ScmGarage,step:number,world:GarageBombShopWorld){
  switch(garage.doorState){
   case GARAGE_DOOR_OPEN:{
    if(!world.playerCarParkedInside(garage))break;
    const bomb=world.playerCarBomb();if(bomb===undefined)break;
    if(bomb&7){world.message('GA_5');garage.doorState=GARAGE_DOOR_WAITING_PLAYER_TO_EXIT;world.sound(AE_FRONTEND_CAR_ALREADY_RIGGED);break;}
    if(!this.freeBombs&&world.money()<BOMB_PRICE){world.message('GA_4');garage.doorState=GARAGE_DOOR_WAITING_PLAYER_TO_EXIT;world.sound(AE_FRONTEND_CAR_NO_CASH);break;}
    garage.doorState=GARAGE_DOOR_CLOSING;world.holdPlayer(true);
    break;
   }
   case GARAGE_DOOR_CLOSING:
    // (The cars near the door are not thrown out of the way, as at the Pay 'n' Spray.)
    if(this.slideDoorClosed(garage,step)){garage.doorState=GARAGE_DOOR_CLOSED;garage.timeToOpen=world.nowMs+TIME_TO_FIT_BOMB;}
    break;
   case GARAGE_DOOR_CLOSED:{
    if(world.nowMs<=garage.timeToOpen)break;
    // (The remote shop also waits for the detonator's model to be streamed in; the port's is always to hand.)
    world.sound(AE_FRONTEND_CAR_FIT_BOMB_TIMED+garage.type-2);
    garage.doorState=GARAGE_DOOR_OPENING;
    if(!this.freeBombs&&world.money()>=1)world.pay(BOMB_PRICE);
    if(world.fitBomb(garage.type-1,garage.type===4))world.stats.increment(STAT_KGS_OF_EXPLOSIVES_USED,10);
    world.help(BOMB_SHOP_HELP[garage.type]);
    break;
   }
   case GARAGE_DOOR_OPENING:
    if(this.slideDoorOpen(garage,step))garage.doorState=GARAGE_DOOR_WAITING_PLAYER_TO_EXIT;
    if(garage.doorPosition>.5)world.holdPlayer(false);
    break;
   case GARAGE_DOOR_WAITING_PLAYER_TO_EXIT:
    if(world.playerOutside(garage))garage.doorState=GARAGE_DOOR_OPEN;
    break;
  }
 }
 /** The respray, as the door starts up (iOS 0x1001b3118 on): the wanted level cleared, the car done (respray()), then
  * GA_22 at a garage whose resprays are always free (SET_GARAGE_RESPRAY_FREE: m_bRespraysAlwaysFree); else, for a
  * wanted level or a repair while resprays are not free everywhere, the $100 taken (no lower than nothing), the
  * repair-and-painting budget 100 more, and GA_2 (wanted) or GA_XX; else, for new paint, GA_15 or GA_16 at random.
  * The garage's m_bUsedRespray is set (HAS_RESPRAY_HAPPENED). */
 private doRespray(garage:ScmGarage,world:GarageResprayWorld){
  const wanted=world.wantedLevel()>0;if(wanted)world.clearWanted();
  const done=world.respray();
  if(garage.resprayFree)world.message('GA_22');
  else if((wanted||done?.repaired)&&!this.freeResprays){
   world.pay(RESPRAY_PRICE);world.stats.increment(STAT_AUTO_REPAIR_AND_PAINTING_BUDGET,RESPRAY_PRICE);world.message(wanted?'GA_2':'GA_XX');
  }else if(done?.recoloured)world.message(world.coin()?'GA_15':'GA_16');
  garage.usedRespray=true;
 }
 /** CGarage::Update's hideout case (the iOS executable's, 0x1001b2c10, its door switch at 0x1001b5410; unreversed in
  * the reference). Shut (and the player not in an interior): within 3.5 units of the box, or within 10 in a vehicle
  * other than a BMX, the door starts up once the stored cars are back (the hangar, type 44, at once). Up: it starts
  * down when he is over 15 units away, or over 4 on foot or on a BMX, unless a car stands in the doorway;
  * when he is in a vehicle wholly outside (by a quarter unit) a garage already holding its two or four cars; and in
  * any case over 70 units away. Going down: it goes up again while he (or his vehicle) is not wholly outside; down,
  * it is shut and keeps the cars inside (not the hangar). */
 private updateHideout(garage:ScmGarage,step:number,world:GarageHideoutWorld){
  const [px,py,pz]=world.playerCentre(),d2=footprintDistance2(garage,px,py),vehicle=world.playerVehicle(),capacity=hideOutCapacity(garage.type);
  switch(garage.doorState){
   case GARAGE_DOOR_CLOSED:
    if(pz>=950||!(d2<12.25||d2<100&&vehicle==='vehicle'))break;
    if(garage.type===44){garage.doorState=GARAGE_DOOR_OPENING;break;}
    // A full garage the player drives up to stays shut (iOS 0x1001b3d64), and with his vehicle within 5 units of one of
    // its doors says so (GA_21), at most once in 18 s. (Not in a helicopter or plane, which the port's hideouts do
    // not count as his vehicle anyway.)
    if(vehicle&&this.storedCount(garage)>=capacity){
     const now=world.nowMs??0;
     if(now-this.lastTimeHelpMessage>18000&&world.playerNearDoor?.(garage,5)){world.help?.('GA_21');this.lastTimeHelpMessage=now;}
     break;
    }
    if(this.restoreCarsForThisHideOut(garage,world))garage.doorState=GARAGE_DOOR_OPENING;
    break;
   case GARAGE_DOOR_OPEN:
    if((d2>225||d2>16&&vehicle!=='vehicle')&&!world.carBlockingDoor(garage)){garage.doorState=GARAGE_DOOR_CLOSING;break;}
    if(vehicle&&world.carsInside(garage)>=capacity&&world.playerOutside(garage,.25)){garage.doorState=GARAGE_DOOR_CLOSING;break;}
    if(d2>4900)garage.doorState=GARAGE_DOOR_CLOSING;
    break;
   case GARAGE_DOOR_CLOSING:
    this.slideDoorClosed(garage,step);
    if(!world.playerOutside(garage,0)){garage.doorState=GARAGE_DOOR_OPENING;break;}
    if(garage.doorPosition===0){garage.doorState=GARAGE_DOOR_CLOSED;if(garage.type!==44)this.storeAndRemoveCarsForThisHideOut(garage,world);}
    break;
   case GARAGE_DOOR_OPENING:
    if(this.slideDoorOpen(garage,step))garage.doorState=GARAGE_DOOR_OPEN;
    break;
  }
 }
 /** What a hideout garage asks of the world; without it a hideout's door only travels. */
 hideouts?:GarageHideoutWorld;
 /** CGarages::LastTimeHelpMessage. */
 lastTimeHelpMessage=0;
 /** CGarages::aCarsInSafeHouse: four cars a slot, twenty slots (hideOutSlot), kept in the save. */
 storedCars:(StoredCar|null)[][]=Array.from({length:HIDEOUT_SLOT_COUNT},()=>Array<StoredCar|null>(STORED_CARS_PER_GARAGE).fill(null));
 /** The cars a hideout keeps (the iOS executable counts the slot's four by their models). */
 storedCount(garage:ScmGarage){return this.storedCars[hideOutSlot(garage.type)]?.filter(Boolean).length??0;}
 /** StoreAndRemoveCarsForThisHideOut (0x449900, reversed): the slot cleared and refilled with the cars the world gives
  * up (at most four). */
 private storeAndRemoveCarsForThisHideOut(garage:ScmGarage,world:GarageHideoutWorld,max=STORED_CARS_PER_GARAGE){
  const slot=this.storedCars[hideOutSlot(garage.type)];if(!slot||!world.removeCarsInside)return;
  const kept=world.removeCarsInside(garage,max);
  for(let i=0;i<STORED_CARS_PER_GARAGE;i++)slot[i]=kept[i]??null;
 }
 /** CGarage::Update's impound case (types 33 to 35; iOS 0x1001b2d40, unreversed in the reference). The lot has no
  * door to move: its state says whether its cars are out. Shut, with the player (FindPlayerCoors) within 60 units of
  * its footprint in x and y and between its floor and 2 units under its roof, the kept cars are lined up in it
  * (placeCarsInImpound) and put back (RestoreCarsForThisImpoundingGarage); once all stand it is open. Open (or
  * closing), with him over 65 units off, or above that height or below the floor, it is shut and the cars inside are
  * kept again, three at most (StoreAndRemoveCarsForThisImpoundingGarage, iOS 0x1001b6fe4, as the hideouts'). */
 private updateImpound(garage:ScmGarage,world:GarageHideoutWorld){
  const b=garage.box;if(!b)return;
  const [px,py,pz]=world.playerCentre(),d2=footprintDistance2(garage,px,py),under=pz<b.topZ-2;
  switch(garage.doorState){
   case GARAGE_DOOR_CLOSED:{
    if(!under||d2>=3600||pz<=b.base[2])break;
    const slot=this.storedCars[hideOutSlot(garage.type)];if(!slot)break;
    placeCarsInImpound(garage,slot);
    let all=true;
    for(let i=0;i<IMPOUND_CAPACITY;i++){const car=slot[i];if(!car)continue;if(world.restoreCar?.(car,true)??true)slot[i]=null;else all=false;}
    if(all&&slot.slice(0,IMPOUND_CAPACITY).every(car=>!car))garage.doorState=GARAGE_DOOR_OPEN;
    break;
   }
   case GARAGE_DOOR_OPEN:case GARAGE_DOOR_CLOSING:
    if(under&&d2<=4225&&pz>b.base[2]&&garage.doorState!==GARAGE_DOOR_CLOSING)break;
    garage.doorState=GARAGE_DOOR_CLOSED;this.storeAndRemoveCarsForThisHideOut(garage,world,IMPOUND_CAPACITY);
    break;
  }
 }
 /** CGarages::PlayerArrestedOrDied (0x449E60, reversed) and each garage's (CGarage::PlayerArrestedOrDied, unreversed;
  * inlined in the iOS executable at 0x1001b86a8): a Pay 'n' Spray or bomb shop (types 2 to 5, and 13) whose door is
  * down or moving goes back up (OPENING; left open or waiting for him if so), every other garage that is open or
  * moving starts down (CLOSING); and the garage message is over (MessageStartTime and MessageEndTime 0). */
 playerArrestedOrDied(message?:ScmGarageMessage){
  for(const garage of this.garages){
   const t=garage.type,s=garage.doorState;if(!t||t>45)continue;
   if(t===1||t>=6&&t<=12||t>=14){if(s>=GARAGE_DOOR_OPEN&&s<=GARAGE_DOOR_OPENING)garage.doorState=GARAGE_DOOR_CLOSING;}
   else if(s!==GARAGE_DOOR_OPEN&&s<=GARAGE_DOOR_OPENING)garage.doorState=GARAGE_DOOR_OPENING;
  }
  if(message){message.start=0;message.end=0;}
 }
 /** CGarages::StoreCarInNearestImpoundingGarage (iOS 0x1001b8ab4; unreversed in the reference, 0x44A3C0): a car of
  * the player's taken off the streets goes to the impound whose corner (m_vPosn) is nearest in x and y. Its first
  * three places fill in turn; with all three taken the oldest goes and the others move up. Nothing without an
  * impound. */
 storeCarInNearestImpoundingGarage(car:StoredCar){
  let nearest:ScmGarage|undefined,best=99999.9;
  for(const garage of this.garages){
   if(!IMPOUND_TYPES.has(garage.type)||!garage.box)continue;
   const d=Math.hypot(car.position[0]-garage.box.base[0],car.position[1]-garage.box.base[1]);if(d<best){best=d;nearest=garage;}
  }
  const slot=nearest&&this.storedCars[hideOutSlot(nearest.type)];if(!slot)return;
  // The count as the executable makes it: the second place counts as the first's follower.
  let n=slot[0]?1:0;if(slot[1])n=slot[0]?2:1;if(slot[2])n++;
  if(n===3){slot[0]=slot[1];slot[1]=slot[2];n=2;}
  slot[n]=car;
 }
 /** CGarages::CloseHideOutGaragesBeforeSave (iOS 0x1001b8758): every safehouse garage not shut is shut on the spot,
  * its cars kept and those in its doorway cleared, before the game saves. (gta-reversed's 0x44A170 asks for an open
  * door; the iOS executable for any not closed.) */
 closeHideOutGaragesBeforeSave(){
  const world=this.hideouts;
  for(const garage of this.garages){
   if(!isHideOutGarageType(garage.type)||garage.doorState===GARAGE_DOOR_CLOSED)continue;
   garage.doorState=GARAGE_DOOR_CLOSED;
   if(world){this.storeAndRemoveCarsForThisHideOut(garage,world);world.removeCarBlockingDoor?.(garage);}
   garage.doorPosition=0;
  }
 }
 /** RestoreCarsForThisHideOut (iOS 0x1001b6efc): each stored car put back (RestoreCar), its place cleared once it
  * stands; true when the slot is empty. */
 private restoreCarsForThisHideOut(garage:ScmGarage,world:GarageHideoutWorld){
  const slot=this.storedCars[hideOutSlot(garage.type)];if(!slot)return true;
  for(let i=0;i<STORED_CARS_PER_GARAGE;i++){const car=slot[i];if(car&&(world.restoreCar?.(car)??true))slot[i]=null;}
  return slot.every(car=>!car);
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
