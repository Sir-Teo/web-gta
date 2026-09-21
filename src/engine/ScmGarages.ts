import {requireAsset} from '../assets/binary';
/* CGarages as a script addresses them, pinned gta-reversed ead3051 (`Garages.cpp`: `GetGarageNumberByName`
 * 0x447680, `ActivateGarage` 0x447CD0, `DeActivateGarage` 0x447CB0, `ChangeGarageType` 0x4476D0,
 * `IsGarageOpen` 0x447D00 and `IsGarageClosed` 0x447D30, all reversed). The garages themselves come from the
 * world's own data, which a host loads; a name no garage carries looks up as -1 and the command then does
 * nothing, which is what keeps a script running past a garage this world does not have. */
/** eGarageDoorState. */
export const GARAGE_DOOR_CLOSED=0,GARAGE_DOOR_OPEN=1,GARAGE_DOOR_CLOSING=2,GARAGE_DOOR_OPENING=3;
/** eGarageType: below this the type change closes the door and resets it. */
export const BOMBSHOP_TIMED=7;
export interface ScmGarage {name:string;type:number;doorState:number;inactive:boolean;resprayFree:boolean}
export class ScmGarages {
 readonly garages:ScmGarage[]=[];
 /** What a host calls with the world's own garages. */
 load(garages:readonly {name:string;type:number}[]){
  this.garages.length=0;
  for(const garage of garages)this.garages.push({name:garage.name,type:garage.type,doorState:GARAGE_DOOR_CLOSED,inactive:false,resprayFree:false});
 }
 /** CGarages::GetGarageNumberByName (0x447680): by name, ignoring case, or -1. */
 numberByName(name:string){const wanted=name.toLowerCase();return this.garages.findIndex(garage=>garage.name.toLowerCase()===wanted);}
 private at(name:string){const index=this.numberByName(name);return index<0?undefined:this.garages[index];}
 /** ActivateGarage: the garage wakes, and a close-on-touch garage whose door is not shut starts opening. */
 activate(name:string){
  const garage=this.at(name);if(!garage)return;
  garage.inactive=false;
  if(garage.type===BOMBSHOP_TIMED-1&&garage.doorState!==GARAGE_DOOR_CLOSED)garage.doorState=GARAGE_DOOR_OPENING;
 }
 /** DeActivateGarage. */
 deactivate(name:string){const garage=this.at(name);if(garage)garage.inactive=true;}
 /** ChangeGarageType: the lower types shut the door and put it back where it was. */
 changeType(name:string,type:number){
  const garage=this.at(name);if(!garage)return;
  requireAsset(Number.isInteger(type),'Invalid garage type.');
  garage.type=type;
  if(type<BOMBSHOP_TIMED)garage.doorState=GARAGE_DOOR_CLOSED;
 }
 open(name:string){const garage=this.at(name);if(garage)garage.doorState=GARAGE_DOOR_OPENING;}
 close(name:string){const garage=this.at(name);if(garage)garage.doorState=GARAGE_DOOR_CLOSING;}
 /** IsGarageOpen and IsGarageClosed, which a garage this world does not carry answers no to. */
 isOpen(name:string){const garage=this.at(name);return garage?.doorState===GARAGE_DOOR_OPEN||garage?.doorState===GARAGE_DOOR_OPENING;}
 isClosed(name:string){const garage=this.at(name);return garage?.doorState===GARAGE_DOOR_CLOSED||garage?.doorState===GARAGE_DOOR_CLOSING;}
 setResprayFree(name:string,free:boolean){const garage=this.at(name);if(garage)garage.resprayFree=free;}
}
