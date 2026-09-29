import {expect,test} from 'vitest';
import {scalePedLimits,scalePedTargets} from '../src/assets/populationCycle';

// CPopulation::PedDensityMultiplier, 1 at Initialise and set by SET_PED_DENSITY_MULTIPLIER, scales how many peds the
// street holds (FindNumberOfPedsWeCanPlaceOnBenches); a mission's 0 empties it.
test('the ped density multiplier scales the popcycle targets and the caps, and 1 leaves them as they are',()=>{
 const targets={dealers:1,gangs:4,cops:2,other:10,noCops:false};
 expect(scalePedTargets(targets,1)).toBe(targets);
 expect(scalePedTargets(targets,.5)).toEqual({dealers:.5,gangs:2,cops:1,other:5,noCops:false});
 expect(scalePedTargets(targets,0)).toMatchObject({dealers:0,gangs:0,cops:0,other:0});
 expect(scalePedLimits({civilians:18,total:26},1)).toEqual({civilians:18,total:26});
 expect(scalePedLimits({civilians:18,total:26},.5)).toEqual({civilians:9,total:13});
 expect(scalePedLimits({civilians:18,total:26},0)).toEqual({civilians:0,total:0});
 expect(scalePedLimits(undefined,0)).toBeUndefined();
});
