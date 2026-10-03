import {expect,test} from 'vitest';
import {PLANE_GUN_SHAKE,crashShake,runOverShake,thunderShake} from '../src/engine/nativePadShakes';
test('a crash shakes the player\'s pad over 50, harder for a light car, for 40000 over the strength in ms',()=>{
 expect(crashShake(50,1500)).toBeUndefined();
 // 300 into a 1500 car: 300 / 1500 × 800 + 100 = 260, held at 250: 160 ms.
 expect(crashShake(300,1500)).toEqual({time:160,frequency:250,delayMs:2000});
 expect(crashShake(60,1500)).toEqual({time:303,frequency:132,delayMs:2000});
});
test('running a ped over, and thunder, shake it as the original does',()=>{
 // A 1500 car at 0.5 a frame: 0.5 / 1500 × 200000 + 80 = 146.
 expect(runOverShake(.5,1500)).toEqual({time:273,frequency:146});expect(runOverShake(5,1500)).toEqual({time:160,frequency:250});
 expect(thunderShake(10)).toEqual({time:500,frequency:100});
 expect(PLANE_GUN_SHAKE[425]).toBe(160);expect(PLANE_GUN_SHAKE[520]).toBe(123);expect(PLANE_GUN_SHAKE[593]).toBeUndefined();
});
