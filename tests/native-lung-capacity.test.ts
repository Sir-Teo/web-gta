import {expect,test} from 'vitest';
import reference from './fixtures/lung-capacity-reference.json';
import {nativeLungCapacity} from '../src/simulation/nativeLungCapacity';
for(const [i,row] of reference.cases.entries())test(`captured native lung capacity ${i}`,()=>{
 expect(nativeLungCapacity(row.lung,row.stamina)).toBe(row.capacity);
});
