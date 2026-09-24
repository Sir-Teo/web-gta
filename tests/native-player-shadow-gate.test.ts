import {expect,test} from 'vitest';
import {drawsRealTimeShadow} from '../src/render/NativeCharacterShadow';

const standing={submerged:false,alive:true,originZ:11,spine1Z:11.1,ducking:false};
test('CPed::PreRenderAfterTest keeps the real-time shadow on bikes and drops it in cars, in water and lying down',()=>{
 expect(drawsRealTimeShadow(standing)).toBe(true);
 expect(drawsRealTimeShadow({...standing,vehicle:'bike'})).toBe(true);
 expect(drawsRealTimeShadow({...standing,vehicle:'other'})).toBe(false);
 // Walking to a car's door as its driver: the target's type decides.
 expect(drawsRealTimeShadow({...standing,enteringAsDriver:'other'})).toBe(false);
 expect(drawsRealTimeShadow({...standing,enteringAsDriver:'bike'})).toBe(true);
 expect(drawsRealTimeShadow({...standing,submerged:true})).toBe(false);
 expect(drawsRealTimeShadow({...standing,vehicle:'bike',submerged:true})).toBe(false);
 // Lying: the position is more than 0.2 above the spine; only a ducking ped keeps the shadow, and the dead are not asked.
 expect(drawsRealTimeShadow({...standing,spine1Z:10.3})).toBe(false);
 expect(drawsRealTimeShadow({...standing,spine1Z:10.3,ducking:true})).toBe(true);
 expect(drawsRealTimeShadow({...standing,spine1Z:10.3,alive:false})).toBe(true);
});
