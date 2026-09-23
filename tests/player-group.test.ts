import {expect,test} from 'vitest';
import {maxGroupMembers} from '../src/simulation/nativePopulation';

test('CStats::FindMaxNumberOfGroupMembers: no followers under 10 respect, up to 7 from 800',()=>{
 expect([0,9.9,10,59,60,159,160,329,330,539,540,799,800,1000].map(r=>maxGroupMembers(r))).toEqual([0,0,2,2,3,3,4,4,5,5,6,6,7,7]);
 // The browser's starting respect, 40 of 100, reads as 400 of the stat's thousand.
 expect(maxGroupMembers()).toBe(5);
});
