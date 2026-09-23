/* vehicleFlags.bFreebies, pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166 (Vehicle.cpp). Every vehicle
 * is made with it set (CVehicle's constructor), and CVehicle::SetDriver spends it the first time the player takes
 * the wheel: an ambulance heals 20, a taxi pays $12, an Enforcer fills the armour, a hot dog van feeds 40 calories.
 * A Caddy streams the golf club and a police car the shotgun, which CVehicle::RemoveDriver hands over as the player
 * leaves. The port counts the club as loaded only after that first drive, so both come once per vehicle. */

export const FREEBIE_MODEL={ambulance:416,taxi:420,cabbie:438,enforcer:427,caddy:457,hotdog:588} as const;
/** MODEL_COPCARLA, MODEL_COPCARSF, MODEL_COPCARVG, MODEL_COPCARRU. */
const COP_CARS=new Set([596,597,598,599]);
export const WEAPON_GOLFCLUB=2,WEAPON_SHOTGUN=25;

export interface FreebieVehicle {modelId:number;freebies:boolean;
 /** The weapon model SetDriver asked the streaming for, which RemoveDriver needs loaded. */
 freebieModelRequested?:boolean}
export type DriverFreebie={kind:'health';amount:number}|{kind:'money';amount:number}|{kind:'armour'}|{kind:'calories';amount:number};

/** CVehicle::SetDriver for the player. */
export function setDriverFreebie(car:FreebieVehicle):DriverFreebie|undefined{
 if(!car.freebies)return;
 car.freebies=false;
 switch(car.modelId){
  case FREEBIE_MODEL.ambulance:return {kind:'health',amount:20};
  case FREEBIE_MODEL.taxi:case FREEBIE_MODEL.cabbie:return {kind:'money',amount:12};
  case FREEBIE_MODEL.enforcer:return {kind:'armour'};
  case FREEBIE_MODEL.caddy:car.freebieModelRequested=true;return;
  case FREEBIE_MODEL.hotdog:return {kind:'calories',amount:40};
 }
 if(COP_CARS.has(car.modelId)){car.freebieModelRequested=true;car.freebies=true;}
}
/** CVehicle::RemoveDriver for the player: the weapon to give (GiveWeapon, or GrantAmmo when the slot is taken). */
export function removeDriverFreebie(car:FreebieVehicle):{weapon:number;ammo:number}|undefined{
 if(!car.freebieModelRequested)return;
 if(car.modelId===FREEBIE_MODEL.caddy){car.freebieModelRequested=false;return {weapon:WEAPON_GOLFCLUB,ammo:1};}
 if(COP_CARS.has(car.modelId)&&car.freebies){car.freebies=false;car.freebieModelRequested=false;return {weapon:WEAPON_SHOTGUN,ammo:5};}
}
