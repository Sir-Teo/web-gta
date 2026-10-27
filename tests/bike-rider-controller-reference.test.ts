import {expect,test} from 'vitest';
import reference from './fixtures/bike-rider-controller-reference.json';
import {controlOrdinaryBikeRider} from '../src/simulation/nativeBikeRiderController';
import {newBicycleAssociation,stepBicycleAssociations,type BicycleAssociation} from '../src/simulation/nativeBicycleBlend';
for(const [index,row] of reference.cases.entries())test(`native ordinary bike rider associations ${index}`,()=>{
 const associations=row.input.associations.map((a:Partial<BicycleAssociation>&{identifier:number})=>{
  const result={...newBicycleAssociation(a.identifier,a.duration??.73333335),...a};
  for(const key of ['amount','delta','time','speed','duration','timeStep'] as const)result[key]=Math.fround(result[key]);
  return result;
 });
 const state={lean:row.input.previousLean,forward:row.input.previousForward};
 const duration=(id:number)=>Math.fround((row.input.durations as Record<string,number>)[id]??.1);
 controlOrdinaryBikeRider(associations,state,row.input,duration);
 expect(associations.map(({identifier,amount,delta,time,speed,timeStep,flags})=>({identifier,amount,delta,time,speed,timeStep,flags}))).toEqual(row.associations);
 expect([state.lean,state.forward]).toEqual(row.filtered);
 expect(stepBicycleAssociations(associations,row.input.dt)).toEqual({rate:row.rate,removed:row.removed});
 expect(associations.map(({identifier,amount,delta,time,speed,timeStep,flags})=>({identifier,amount,delta,time,speed,timeStep,flags}))).toEqual(row.frame);
});
