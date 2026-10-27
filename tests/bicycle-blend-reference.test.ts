import {expect,test} from 'vitest';
import reference from './fixtures/bicycle-blend-reference.json';
import {blendBicycleAssociation,newBicycleAssociation,type BicycleAssociation} from '../src/simulation/nativeBicycleBlend';
for(const [index,row] of reference.cases.entries())test(`native bicycle scalar blend/sync profile ${index}`,()=>{
 const originals=row.input.associations.map((a:Partial<BicycleAssociation>&{identifier:number;otherGroup?:number})=>({...newBicycleAssociation(a.identifier,a.duration??.73333335,a.otherGroup??3),amount:Math.fround(a.amount??0),delta:Math.fround(a.delta??0),time:Math.fround(a.time??0),speed:Math.fround(a.speed??1)})),associations=[...originals];
 const returned=blendBicycleAssociation(associations,row.input.request,row.input.duration,row.input.blend);
 expect(returned.identifier).toBe(row.returned);
 expect(associations.map(a=>({identifier:a.identifier,new:!originals.includes(a),amount:a.amount,delta:a.delta,time:a.time,speed:a.speed,flags:a.flags}))).toEqual(row.associations);
});
