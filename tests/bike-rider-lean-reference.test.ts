import {expect,test} from 'vitest';
import reference from './fixtures/bike-rider-lean-reference.json';
import {controlBikeRiderLean} from '../src/simulation/nativeBikeRiderLean';
import {newBicycleAssociation} from '../src/simulation/nativeBicycleBlend';
for(const [index,row] of reference.cases.entries())test(`native bike filtered lean pose ${index}`,()=>{
 const associations=[196,197,198,199].map(id=>newBicycleAssociation(id,row.input.duration));
 controlBikeRiderLean(associations,row.input);
 expect(associations.map(({identifier,amount,time,flags})=>({identifier,amount,time,flags}))).toEqual(row.associations);
});
