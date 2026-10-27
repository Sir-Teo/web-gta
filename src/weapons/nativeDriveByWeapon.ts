/** Selected owner-null CWeapon state, using native unsigned millisecond timestamps. */
export interface DriveByWeaponState {state:number;clip:number;total:number;nextShot:number}
export interface DriveByWeaponInput {timeMs:number;infinite:boolean;progress:number;entityByte:number;reloadMs:number}
/** CWeapon::Update(weapon, nullptr), 0x10049adf8: instant-hit weapon state/reload writes. */
export function updateDriveByWeapon(weapon:DriveByWeaponState,timeMs:number,magazine:number){
 const now=timeMs>>>0;
 if(weapon.state===1&&now>(weapon.nextShot>>>0))weapon.state=weapon.total===0?3:0;
 else if(weapon.state===2&&now>(weapon.nextShot>>>0)){if(weapon.total!==0)weapon.clip=Math.min(weapon.total>>>0,magazine>>>0);weapon.state=0;}
 else if(weapon.state===4)weapon.state=0;
}
/** CWeapon::FireFromCar 0x100497908. The selected iOS branch accepts ready/firing;
 * its caller updates first and checks now > nextShot before reaching it. */
export function fireFromCarWeapon(weapon:DriveByWeaponState,input:DriveByWeaponInput){
 if((weapon.state>>>0)>1||(weapon.clip|0)<1)return false;
 if(!input.infinite){
  weapon.clip=(weapon.clip-1)>>>0;
  if(((weapon.total-1)>>>0)<=24998&&(input.entityByte>7||Math.fround(input.progress)<100))weapon.total=(weapon.total-1)>>>0;
 }
 weapon.state=1;
 if(weapon.clip!==0)weapon.nextShot=(input.timeMs+1000)>>>0;
 else if(weapon.total!==0){weapon.state=2;weapon.nextShot=(input.timeMs+input.reloadMs)>>>0;}
 return true;
}
/** CVehicle::DoDriveByShootings refills the clip when the trigger/ammo condition fails. */
export function refillDriveByWeapon(weapon:DriveByWeaponState,magazine:number){if(weapon.total!==0)weapon.clip=Math.min(weapon.total>>>0,magazine>>>0);}
/** The controller overwrites the timestamp after every attempted FireFromCar, even a rejection. */
export function attemptDriveByWeapon(weapon:DriveByWeaponState,input:DriveByWeaponInput){
 if((input.timeMs>>>0)<=(weapon.nextShot>>>0))return false;
 const result=fireFromCarWeapon(weapon,input);weapon.nextShot=(input.timeMs+70)>>>0;return result;
}
