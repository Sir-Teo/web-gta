import {expect,test} from 'vitest';
import reference from './fixtures/bike-rider-lean-filter-reference.json';
import {filterBikeRiderLean} from '../src/simulation/nativeBikeRiderLean';
for(const [index,row] of reference.cases.entries())test(`native bike lean filter with declared powf boundary ${index}`,()=>{
 const i=row.input,result=filterBikeRiderLean(i.previous,i.lean,i.fullAnimLean,i.timeStep,i.reverse);
 expect(result).toEqual({target:row.target,decay:row.calls[0].result,filtered:row.filtered});
});
