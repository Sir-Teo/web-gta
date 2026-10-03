import {afterEach,expect,test} from 'vitest';
import {DRAW_DISTANCE_DEFAULT,drawDistanceMultiplier,lodDistMultiplier,portLodDistScale,setDrawDistance} from '../src/render/lodDistance';
import {parseTouchSettings} from '../src/input/touchSettings';
afterEach(()=>setDrawDistance(DRAW_DISTANCE_DEFAULT));
test('the port\'s Draw Distance sets ms_lodDistScale to 0.875 + 0.875 × value / 100',()=>{
 expect(portLodDistScale(0)).toBe(.875);expect(portLodDistScale(100)).toBeCloseTo(1.75,6);
 // Its default, 70: 1.4875 (the multiplier, × 0.8 at FOV 70, 1.19).
 expect(portLodDistScale(DRAW_DISTANCE_DEFAULT)).toBeCloseTo(1.4875,6);
});
test('the game draws at the port\'s default, and the slider scales by its share of it',()=>{
 expect(lodDistMultiplier()).toBe(1);expect(drawDistanceMultiplier(70)).toBe(1);
 setDrawDistance(0);expect(lodDistMultiplier()).toBeCloseTo(1/1.7,6);
 setDrawDistance(100);expect(lodDistMultiplier()).toBeCloseTo(2/1.7,6);
 // Out of range is held to the slider's ends.
 setDrawDistance(-20);expect(lodDistMultiplier()).toBeCloseTo(1/1.7,6);
});
test('the touch settings keep a Draw distance from 0 to 100, 70 by default',()=>{
 expect(parseTouchSettings({}).drawDistance).toBe(70);
 expect(parseTouchSettings({drawDistance:35}).drawDistance).toBe(35);expect(parseTouchSettings({drawDistance:400}).drawDistance).toBe(100);
 expect(parseTouchSettings({drawDistance:'far'}).drawDistance).toBe(70);
});
