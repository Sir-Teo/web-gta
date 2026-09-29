/** CDamageManager and CAutomobile::VehicleDamage rules for ordinary cars. */
/** eVehicleCollisionComponent: the COL surface piece byte. */
export const COLLISION_COMPONENT={default:0,bonnet:1,boot:2,bumpFront:3,bumpRear:4,doorLF:5,doorRF:6,doorLR:7,doorRR:8,wingLF:9,wingRF:10,wingLR:11,wingRR:12,windscreen:0x13} as const;
/** ePanelDamageState / eDoorStatus. */
export const DAMSTATE={ok:0,opened:1,damaged:2,openedDamaged:3,notPresent:4} as const;
/** tComponent. */
export const COMPONENT={wheelLF:1,wheelRF:2,wheelLR:3,wheelRR:4,bonnet:5,boot:6,doorLF:7,doorRF:8,doorLR:9,doorRR:10,wingLF:11,wingRF:12,wingLR:13,wingRR:14,windscreen:15,bumpFront:16,bumpRear:17} as const;
/** ePanels order and eDoors order, with their frame base names. */
export const PANEL_FRAMES=['wing_lf','wing_rf','wing_lr','wing_rr','windscreen','bump_front','bump_rear'] as const;
export const DOOR_FRAMES=['bonnet','boot','door_lf','door_rf','door_lr','door_rr'] as const;
const GROUP_MULT=[2.5,1.25,3.2,1.4,2.5,2.8,.5];
export interface NativeCarDamage {panels:number[];doors:number[];lights:boolean[];wheels:number[]}
export const createCarDamage=():NativeCarDamage=>({panels:[0,0,0,0,0,0,0],doors:[0,0,0,0,0,0],lights:[false,false,false,false],wheels:[0,0,0,0]});
export type ComponentChange={kind:'panel'|'door'|'wheel';index:number;state:number};
/** CDamageManager::ProgressPanelDamage. */
export function progressPanel(damage:NativeCarDamage,panel:number,random:()=>number){
 const state=damage.panels[panel];
 if(state===DAMSTATE.openedDamaged)return false;
 if(state===DAMSTATE.damaged){if(Math.floor(random()*(panel===4?2:8))!==0)return false;damage.panels[panel]=DAMSTATE.openedDamaged;return true;}
 damage.panels[panel]=state+1;return true;
}
/** CDamageManager::ProgressDoorDamage. */
export function progressDoor(damage:NativeCarDamage,door:number,random:()=>number){
 const state=damage.doors[door];
 if(state===DAMSTATE.ok||state===DAMSTATE.opened){damage.doors[door]=DAMSTATE.damaged;return true;}
 if(state===DAMSTATE.damaged){damage.doors[door]=DAMSTATE.openedDamaged;return true;}
 if(state===DAMSTATE.openedDamaged){if(Math.floor(random()*8)!==0)return false;damage.doors[door]=DAMSTATE.notPresent;return true;}
 return false;
}
/** CDamageManager::ApplyDamage: group multiplier, windscreen 0.6, progression above 150. */
export function applyComponentDamage(damage:NativeCarDamage,component:number,intensity:number,random:()=>number):ComponentChange|undefined{
 let group:number,index:number;
 if(component>=COMPONENT.wheelLF&&component<=COMPONENT.wheelRR){group=1;index=component-1;}
 else if(component===COMPONENT.bonnet){group=3;index=0;}
 else if(component===COMPONENT.boot){group=4;index=1;}
 else if(component>=COMPONENT.doorLF&&component<=COMPONENT.doorRR){group=2;index=component-COMPONENT.bonnet;}
 else if(component>=COMPONENT.wingLF&&component<=COMPONENT.wingRR){group=5;index=component-COMPONENT.wingLF;}
 // GetComponentGroup puts the windscreen with the bumpers as a panel (upstream fix db11601c08; the pinned mapping
 // lit a fifth light).
 else if(component===COMPONENT.windscreen||component===COMPONENT.bumpFront||component===COMPONENT.bumpRear){group=0;index=component-COMPONENT.wingLF;}
 else return undefined;
 let value=intensity*GROUP_MULT[group];if(component===COMPONENT.windscreen)value*=.6;
 if(value<=150)return undefined;
 if(group===1){if(damage.wheels[index]>=2)return undefined;damage.wheels[index]++;return {kind:'wheel',index,state:damage.wheels[index]};}
 if(group===2||group===3||group===4)return progressDoor(damage,index,random)?{kind:'door',index,state:damage.doors[index]}:undefined;
 if(group===5)damage.lights[index]=true;
 return progressPanel(damage,index,random)?{kind:'panel',index,state:damage.panels[index]}:undefined;
}
/** CAutomobile::VehicleDamage component routing for one collision (collision path, intensity ×4). */
export function applyCollisionComponents(damage:NativeCarDamage,piece:number,intensity:number,mass:number,sideways:{localDir:number;dirDotRight:number;van?:boolean},random:()=>number,weapon=false){
 const changes:ComponentChange[]=[],apply=(component:number)=>{const change=applyComponentDamage(damage,component,intensity*4,random);if(change)changes.push(change);};
 switch(piece){
  case COLLISION_COMPONENT.bonnet:apply(COMPONENT.bonnet);break;
  case COLLISION_COMPONENT.boot:apply(COMPONENT.boot);break;
  case COLLISION_COMPONENT.bumpFront:{
   apply(COMPONENT.bumpFront);
   const {localDir,dirDotRight}=sideways;
   if(localDir>.7||localDir>.5&&dirDotRight< -.5&&mass*.35<intensity)apply(COMPONENT.wingRF);
   else if(localDir>-.7||localDir>-.5&&dirDotRight>.5&&mass*.35<intensity)apply(COMPONENT.wingLF);
   if(damage.panels[5]!==DAMSTATE.ok&&mass*.2<intensity||weapon&&Math.floor(random()*3)===0)apply(COMPONENT.bonnet);
   if(damage.panels[5]>=DAMSTATE.damaged&&mass*.2<intensity)apply(COMPONENT.windscreen);
   break;
  }
  case COLLISION_COMPONENT.bumpRear:
   apply(COMPONENT.bumpRear);
   // A van's back doors take a hard enough rear hit on their side.
   if(sideways.van&&mass*.35<intensity){if(sideways.localDir>.1)apply(COMPONENT.doorRR);else if(sideways.localDir< -.1)apply(COMPONENT.doorLR);}
   if(damage.panels[6]<DAMSTATE.damaged)apply(COMPONENT.boot);
   break;
  case COLLISION_COMPONENT.doorLF:apply(COMPONENT.doorLF);break;
  case COLLISION_COMPONENT.doorRF:apply(COMPONENT.doorRF);break;
  case COLLISION_COMPONENT.doorLR:apply(COMPONENT.doorLR);break;
  case COLLISION_COMPONENT.doorRR:apply(COMPONENT.doorRR);break;
  case COLLISION_COMPONENT.wingLF:apply(COMPONENT.wingLF);break;
  case COLLISION_COMPONENT.wingRF:apply(COMPONENT.wingRF);break;
  case COLLISION_COMPONENT.windscreen:apply(COMPONENT.windscreen);break;
 }
 return changes;
}
/** CAutomobile::VehicleDamage health loss for the collision path (collForceMult 1). */
/** CAutomobile::VehicleDamage's collision health loss before the player/rammed-by-player divisors (the value its
 * CEventVehicleDamageCollision test reads: over 5). */
export function collisionHealthLossRaw(input:{intensity:number;mass:number;collisionDamageMultiplier:number;modelId?:number;damagerModelId?:number;damagerIsPlayer?:boolean}){
 const minimum=input.mass/1500*25;if(input.intensity<=minimum)return 0;
 let loss=(input.intensity-minimum)*input.collisionDamageMultiplier*.6;
 // The Securicar takes seven times from the player, the RC Raider, Goblin and Tiger thirty times, and anything a
 // Rhino hits fifteen times.
 if(input.modelId===428&&input.damagerIsPlayer)loss*=7;
 else if(input.modelId===465||input.modelId===501||input.modelId===564)loss*=30;
 if(input.damagerModelId===432)loss*=15;
 return loss>0?loss:0;
}
export function collisionHealthLoss(input:{intensity:number;mass:number;collisionDamageMultiplier:number;playerVehicle:boolean;hitByPlayerVehicle:boolean;modelId?:number;damagerModelId?:number;
 /** vehicleFlags.bTakeLessDamage (SET_CAR_STRONG): a sixth for the player's car, a twelfth for any other. */
 takeLessDamage?:boolean}){
 const loss=collisionHealthLossRaw({...input,damagerIsPlayer:input.hitByPlayerVehicle});if(loss<=0)return 0;
 if(input.playerVehicle)return input.takeLessDamage?loss/6:loss/2;
 if(input.takeLessDamage)return loss/12;
 return input.hitByPlayerVehicle?loss/1.5:loss/4;
}
/** Native burn-out: below 250 health a car burns and blows up after 5000 ms. */
export const CAR_FIRE_HEALTH=250,CAR_BURN_SECONDS=5;
/** CVehicle::ExtinguishCarFire: a car put out is lifted to 300 health (unless wrecked). */
export const CAR_EXTINGUISHED_HEALTH=300;
