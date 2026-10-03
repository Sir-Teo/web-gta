import {expect,test} from 'vitest';
import {PLANE_GUN_SHAKE,crashShake,roadShake,runOverShake,thunderShake} from '../src/engine/nativePadShakes';
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
test('the road shakes the player\'s car: a bump, or a rough surface in the first 800 ms of every 2048',()=>{
 const at={speed:.5,mass:1500,timeStep:1};
 // A 0.5 jump: 200 × 0.5 × 0.5 × 2000 / 1500 + 100 = 166.7, for 20000 over it.
 expect(roadShake({...at,suspension:.5,roughness:0,timeMs:100})).toEqual({time:119,frequency:166});
 // Gravel's roughness 2 (× 0.1): 66.7, for 5000 over it; resting past 800 ms of the 2048.
 expect(roadShake({...at,suspension:0,roughness:.2,timeMs:100})).toEqual({time:75,frequency:66});
 expect(roadShake({...at,suspension:0,roughness:.2,timeMs:900})).toBeUndefined();
 // On the roughest ground a bump rests with it; on smoother ground it does not.
 expect(roadShake({...at,suspension:.5,roughness:.3,timeMs:900})).toBeUndefined();
 expect(roadShake({...at,suspension:.5,roughness:.2,timeMs:900})).toEqual({time:119,frequency:166});
 // Crawling, nothing.
 expect(roadShake({...at,speed:.05,suspension:.5,roughness:0,timeMs:100})).toBeUndefined();
});
