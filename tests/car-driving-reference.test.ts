import {updateDriveByWeapon,refillDriveByWeapon,attemptDriveByWeapon} from '../src/weapons/nativeDriveByWeapon';
import {expect,test} from 'vitest';
import reference from './fixtures/car-driving-reference.json';
import {controlCarDriveBy,controlCarDriving,carDrivingRideIds,CAR_DRIVING_CLIPS,carDrivingAssociationFlags} from '../src/simulation/nativeCarDriving';
import {stepBicycleAssociations,type BicycleAssociation} from '../src/simulation/nativeBicycleBlend';
import {NativeDrivingAnims} from '../src/simulation/nativeDrivingAnims';
import {bikeDriveByAnimationReady} from '../src/simulation/nativeBikeDriveBy';
for(const [index,row] of reference.cases.entries())test(`native car drive-by/driving partial frame ${index}`,()=>{
 const i=row.input,associations:BicycleAssociation[]=i.associations.filter(a=>a.flags&16).map(a=>({...a,group:0})),duration=(id:number)=>(i.durations as Record<string,number>)[id],ride=carDrivingRideIds({low:i.low,boat:i.boat,sitInBoat:i.sitInBoat,kart:i.kart,truck:i.truck,skill:i.drivingSkill,velocity:i.velocity});
 const selected=i.withDriveBy?controlCarDriveBy(associations,{enabled:i.driver&&i.playerData&&i.pad&&i.allowed&&i.slot===4,fire:i.fire,left:i.left,right:i.right,ammo:i.ammo,low:i.low},duration):undefined;
 const snapshot=()=>associations.map(({identifier,amount,delta,time,speed,timeStep,flags})=>({identifier,amount,delta,time,speed,timeStep,flags}));
 expect(snapshot()).toEqual(row.control.filter(a=>a.flags&16));expect(!!i.fire&&bikeDriveByAnimationReady(associations,selected)&&i.timeMs>i.nextShot).toBe(row.fireAttempts.length>0);
 if(row.usedRide.length)expect(ride).toEqual(row.usedRide[0]);
 const idle=i.associations.find(a=>a.identifier===ride[0]);if(i.driving)controlCarDriving(associations,{steer:i.steer,reversing:!i.low&&i.gas<0,idleFull:!!idle&&idle.amount>=1,ride:{left:CAR_DRIVING_CLIPS[ride[1]],right:CAR_DRIVING_CLIPS[ride[2]],back:CAR_DRIVING_CLIPS[ride[3]]},offscreen:i.offscreen,player:i.player,blendRadio:i.blendRadio,cameraBehind:i.cameraMode===16&&i.cameraDirection===1},duration);
 expect(snapshot()).toEqual(row.drivingControl.filter(a=>a.flags&16));stepBicycleAssociations(associations,i.dt);expect(snapshot()).toEqual(row.frame.filter(a=>a.flags&16));
 const owner=new NativeDrivingAnims();owner.associations.push(...i.associations.filter(a=>a.flags&16).map(a=>({...a,group:0})));
 owner.step(i.dt,{steer:i.steer,reversing:!i.low&&i.gas<0,idleFull:!!idle&&idle.amount>=1,ride:{left:CAR_DRIVING_CLIPS[ride[1]],right:CAR_DRIVING_CLIPS[ride[2]],back:CAR_DRIVING_CLIPS[ride[3]]},offscreen:i.offscreen,player:i.player,blendRadio:i.blendRadio,cameraBehind:i.cameraMode===16&&i.cameraDirection===1,duration:name=>duration(Number(Object.entries(CAR_DRIVING_CLIPS).find(([,clip])=>clip===name)?.[0])),driveByControl:i.withDriveBy?{enabled:i.driver&&i.playerData&&i.pad&&i.allowed&&i.slot===4,fire:i.fire,left:i.left,right:i.right,ammo:i.ammo,low:i.low}:undefined});
 expect(owner.associations.map(({identifier,amount,delta,time,speed,timeStep,flags})=>({identifier,amount,delta,time,speed,timeStep,flags}))).toEqual(row.frame.filter(a=>a.flags&16));
 if(i.nativeWeapon){const weapon={state:i.state,clip:i.clip,total:i.ammo,nextShot:i.nextShot};updateDriveByWeapon(weapon,i.timeMs,i.magazine);if(!(i.left||i.right)||weapon.total<1)refillDriveByWeapon(weapon,i.magazine);const fired=row.animationReady?attemptDriveByWeapon(weapon,{timeMs:i.timeMs,infinite:i.infinite,progress:i.progress,entityByte:i.entityByte,reloadMs:i.reloadMs}):false;expect(fired).toBe(row.fireResults.at(-1)??false);expect(weapon).toEqual(row.weapon);}
 for(const a of associations)expect(a.flags&~1).toBe(carDrivingAssociationFlags(a.identifier));
});
