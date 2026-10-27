import {expect,test} from 'vitest';
import reference from './fixtures/driveby-weapon-state-reference.json';
import {fireFromCarWeapon,updateDriveByWeapon} from '../src/weapons/nativeDriveByWeapon';
for(const [index,row] of reference.cases.entries())test(`native drive-by weapon state ${index}`,()=>{
 const i=row.input,weapon={state:i.state,clip:i.clip,total:i.total,nextShot:i.nextShot};
 if(i.operation==='fire'){expect(fireFromCarWeapon(weapon,i)).toBe(row.result);if(i.callerDelay!==null)weapon.nextShot=(i.timeMs+i.callerDelay)>>>0;}
 else updateDriveByWeapon(weapon,i.timeMs,i.magazine);
 expect(weapon).toEqual(row.fired);
 if(i.updateTime!==null)updateDriveByWeapon(weapon,i.updateTime,i.magazine);
 expect(weapon).toEqual(row.updated);
});
