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
export interface ScmGarage {name:string;type:number;doorState:number;inactive:boolean;resprayFree:boolean;
 /** m_fDoorPosition, 0 shut to 1 open. */
 doorPosition:number;
 /** m_pTargetCar, by script handle. */
 targetCar?:number}
export class ScmGarages {
 readonly garages:ScmGarage[]=[];
 /** What a host calls with the world's own garages. */
 load(garages:readonly {name:string;type:number}[]){
  this.garages.length=0;
  for(const garage of garages)this.garages.push({name:garage.name,type:garage.type,doorState:GARAGE_DOOR_CLOSED,inactive:false,resprayFree:false,doorPosition:0});
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
