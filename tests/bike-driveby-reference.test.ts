import {expect,test} from 'vitest';
import reference from './fixtures/bike-driveby-reference.json';
import {controlBikeDriveBy,bikeDriveByAnimationReady} from '../src/simulation/nativeBikeDriveBy';
import {newBicycleAssociation,stepBicycleAssociations,type BicycleAssociation} from '../src/simulation/nativeBicycleBlend';
for(const [index,row] of reference.cases.entries())test(`native bike drive-by association and clump frame ${index}`,()=>{
 const i=row.input,associations=i.associations.map((a:Partial<BicycleAssociation>&{identifier:number})=>({...newBicycleAssociation(a.identifier,a.duration!),...a}));
 const selected=controlBikeDriveBy(associations,{enabled:i.driver&&i.playerData&&i.pad&&i.allowed&&i.slot===4,fire:i.fire,left:i.left,right:i.right,ammo:i.ammo,bicycle:i.subtype===10},id=>Math.fround((i.durations as Record<string,number>)[id]));
 const snapshot=()=>associations.map(({identifier,amount,delta,time,speed,timeStep,flags})=>({identifier,amount,delta,time,speed,timeStep,flags}));
 expect(bikeDriveByAnimationReady(associations,selected)&&i.timeMs>i.nextShot).toBe(row.fireAttempts.length>0);
 expect(snapshot()).toEqual(row.control);expect(stepBicycleAssociations(associations,i.dt)).toEqual({rate:row.rate,removed:row.removed});expect(snapshot()).toEqual(row.frame);
});
