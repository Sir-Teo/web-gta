import {expect,test} from 'vitest';
import {SWAT_ROPE_LENGTH,SWAT_ROPE_SHARE_PER_SECOND,swatRopePoint} from '../src/simulation/nativeScriptedPedTasks';

test('a SWAT rope hangs 20 straight down, its nodes resting on the ground; a rider covers it in under seven seconds',()=>{
 expect(SWAT_ROPE_LENGTH).toBe(20);
 // FindCoorsAlongRope: the share times 31 spans, between nodes 20/31 apart.
 expect(swatRopePoint(30,0,0)).toBe(30);
 expect(swatRopePoint(30,0,.5)).toBeCloseTo(20,5);
 // Held under the end, and no node below the ground.
 expect(swatRopePoint(30,0,2)).toBeCloseTo(30-.999*20,4);
 expect(swatRopePoint(30,25,.5)).toBe(25);
 // 0.003 of the rope a 50 Hz frame: 3 units a second.
 expect(SWAT_ROPE_SHARE_PER_SECOND*SWAT_ROPE_LENGTH).toBeCloseTo(3,6);
});
