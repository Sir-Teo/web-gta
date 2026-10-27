import {expect,test} from 'vitest';
import reference from './fixtures/bicycle-rider-decision-reference.json';
import {nativeBicycleRiderDecision} from '../src/simulation/nativeBicycleRider';
for(const [index,row] of reference.cases.entries())test(`native bicycle rider/cadence decision ${index}`,()=>{
 if(row.playing)expect(row.pedalSpeed).toBe(row.cadence);
 expect(nativeBicycleRiderDecision(row.input)).toEqual({mode:row.mode,cadence:row.cadence,playing:row.playing});
});
