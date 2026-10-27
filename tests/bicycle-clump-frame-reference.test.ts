import {expect,test} from 'vitest';
import reference from './fixtures/bicycle-clump-frame-reference.json';
import {newBicycleAssociation,stepBicycleAssociations,type BicycleAssociation} from '../src/simulation/nativeBicycleBlend';
for(const [index,row] of reference.cases.entries())test(`native bicycle clump scalar frame ${index}`,()=>{
 const associations=row.input.associations.map((a:Partial<BicycleAssociation>&{identifier:number})=>({...newBicycleAssociation(a.identifier,a.duration??.73333335),amount:Math.fround(a.amount??0),delta:Math.fround(a.delta??0),time:Math.fround(a.time??0),speed:Math.fround(a.speed??1),timeStep:Math.fround(a.timeStep??0),flags:a.flags??newBicycleAssociation(a.identifier,a.duration??.73333335).flags}));
 const result=stepBicycleAssociations(associations,row.input.dt);
 expect(result).toEqual({rate:row.rate,removed:row.removed});
 expect(associations.map(({identifier,amount,delta,time,speed,timeStep,flags})=>({identifier,amount,delta,time,speed,timeStep,flags}))).toEqual(row.associations);
});
