import {expect,test} from 'vitest';
import reference from './fixtures/bike-driveby-weapon-reference.json';
import {updateDriveByWeapon,refillDriveByWeapon,attemptDriveByWeapon} from '../src/weapons/nativeDriveByWeapon';
import {controlBikeDriveBy,bikeDriveByAnimationReady} from '../src/simulation/nativeBikeDriveBy';
import {newBicycleAssociation} from '../src/simulation/nativeBicycleBlend';
for(const [index,row] of reference.cases.entries())test(`native bike controller and weapon state ${index}`,()=>{
 const i=row.input,weapon={state:i.state,clip:i.clip,total:i.ammo,nextShot:i.nextShot};
 updateDriveByWeapon(weapon,i.timeMs,i.magazine);expect(weapon).toEqual(row.updated);
 const fire=i.subtype===10?i.fire===1:i.fire!==0,associations=i.associations.map(a=>({...newBicycleAssociation(a.identifier,a.duration),...a}));
 if(!fire||weapon.total<1)refillDriveByWeapon(weapon,i.magazine);
 const selected=controlBikeDriveBy(associations,{enabled:true,fire:i.fire,left:i.left,right:i.right,ammo:weapon.total,bicycle:i.subtype===10},id=>(i.durations as Record<string,number>)[id]);
 const attempts=bikeDriveByAnimationReady(associations,selected)&&(i.timeMs>>>0)>(weapon.nextShot>>>0),results=attempts?[attemptDriveByWeapon(weapon,{timeMs:i.timeMs,infinite:i.infinite,progress:i.progress,entityByte:i.entityByte,reloadMs:i.reloadMs})]:[];
 expect(results).toEqual(row.fireResults);expect(attempts?1:0).toBe(row.fireAttempts.length);expect(weapon).toEqual(row.weapon);
});
