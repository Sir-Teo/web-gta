import {expect,test} from 'vitest';
import reference from './fixtures/bike-shot-seed-reference.json';
import {nativeBikeShot} from '../src/weapons/nativeBikeShot';
for(const [index,row] of reference.cases.entries())test(`native bike/quad shot seed ${index}`,()=>{
 expect(nativeBikeShot(row.input)).toEqual({start:row.start,end:row.end});
});
