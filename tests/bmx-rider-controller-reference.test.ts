import {expect,test} from 'vitest';
import reference from './fixtures/bmx-rider-controller-reference.json';
import {controlBmxRider} from '../src/simulation/nativeBicycleRider';
import {newBicycleAssociation,stepBicycleAssociations,type BicycleAssociation} from '../src/simulation/nativeBicycleBlend';
for(const [index,row] of reference.cases.entries())test(`native full BMX rider control and clump frame ${index}`,()=>{
 const associations=row.input.associations.map((a:Partial<BicycleAssociation>&{identifier:number})=>({...newBicycleAssociation(a.identifier,a.duration!),...a}));
 const state={lean:row.input.previousLean,forward:row.input.previousForward},duration=(id:number)=>Math.fround((row.input.durations as Record<string,number>)[id]);
 const result=controlBmxRider(associations,state,{...row.input,driveBy:associations.some(a=>a.identifier>=202&&a.identifier<=204)},duration,row.input.crank);
 const snapshot=()=>associations.map(({identifier,amount,delta,time,speed,timeStep,flags})=>({identifier,amount,delta,time,speed,timeStep,flags}));
 expect(snapshot()).toEqual(row.associations);expect([state.lean,state.forward]).toEqual(row.filtered);expect(result.crank).toBe(row.crank);
 expect(stepBicycleAssociations(associations,row.input.dt)).toEqual({rate:row.rate,removed:row.removed});expect(snapshot()).toEqual(row.frame);
});
