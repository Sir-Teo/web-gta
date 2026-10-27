import {expect,test} from 'vitest';
import reference from './fixtures/quad-rider-lean-reference.json';
import {quadRiderLean} from '../src/simulation/nativeBikeLean';
for(const [index,row] of reference.cases.entries())test(`native quad rider lean arithmetic ${index}`,()=>{
 const i=row.input;
 expect(quadRiderLean(i.current,i.steerAngle,i.steerLock,i.fullAnimLean,i.desLean,i.timeStep)).toBe(row.lean);
});
