import {expect,test} from 'vitest';
import reference from './fixtures/bicycle-rider-associations-reference.json';
import {controlBicycleAssociations} from '../src/simulation/nativeBicycleRider';
import {newBicycleAssociation,stepBicycleAssociations,type BicycleAssociation} from '../src/simulation/nativeBicycleBlend';
const snapshot=(associations:BicycleAssociation[])=>associations.map(({identifier,amount,delta,time,speed,timeStep,flags})=>({identifier,amount,delta,time,speed,timeStep,flags}));
for(const [index,row] of reference.cases.entries())test(`native bicycle controller and clump frame ${index}`,()=>{
 const duration=(id:number)=>row.input.model===510?(id===207?.6666667:.8):(id===207?.73333335:.6666667);
 const associations=row.input.associations.map((a:Partial<BicycleAssociation>&{identifier:number})=>{
  const result={...newBicycleAssociation(a.identifier,duration(a.identifier)),...a};
  for(const key of ['amount','delta','time','speed','duration','timeStep'] as const)result[key]=Math.fround(result[key]);
  return result;
 });
 const result=controlBicycleAssociations(associations,{...row.input,gear:1,maxFlatVelocity:.50777864,leanFwd:0,status:0},duration);
 expect(snapshot(associations)).toEqual(row.control);
 expect(result.crank).toEqual(row.crank);
 expect(Number(result.fallback)).toEqual(row.fallbackCalls);
 expect(stepBicycleAssociations(associations,row.input.dt)).toEqual({rate:row.rate,removed:row.removed});
 expect(snapshot(associations)).toEqual(row.frame);
});
