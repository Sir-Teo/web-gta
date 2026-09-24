import {expect,test} from 'vitest';
import {calcPedShadowValues,calculateShadowStrength,pedShadowPool} from '../src/render/nativePedShadows';

test('CShadows::CalcPedShadowValues points the blob away from the sun',()=>{
 // Noon: CTimeCycle's vector to the sun is (0.7 + sin(pi), -0.7, 0.2 - cos(pi)) normalised.
 const raw=[.7,-.7,1.2],l=Math.hypot(...raw),sun=raw.map(v=>v/l) as [number,number,number];
 const v=calcPedShadowValues(sun),d=Math.hypot(sun[0],sun[1]);
 expect(v.displacement[0]).toBeCloseTo(-sun[0]/2,9);expect(v.displacement[1]).toBeCloseTo(-sun[1]/2,9);
 expect(v.front[0]).toBeCloseTo(-sun[0]*(d+1)/d/2,9);expect(v.side[0]).toBeCloseTo(-sun[1]/d/2,9);expect(v.side[1]).toBeCloseTo(sun[0]/d/2,9);
 // The side half-vector is half a unit long and square to the front.
 expect(Math.hypot(...v.side)).toBeCloseTo(.5,9);expect(v.side[0]*v.front[0]+v.side[1]*v.front[1]).toBeCloseTo(0,9);
});
test('CalculateShadowStrength is full to half the distance, then fades to none',()=>{
 expect(calculateShadowStrength(3,15,200)).toBe(200);
 expect(calculateShadowStrength(7.5,15,200)).toBe(200);
 expect(calculateShadowStrength(11.25,15,200)).toBe(100);
 expect(calculateShadowStrength(14.99,15,200)).toBe(0);
});
test('StoreShadowForPedObject: shad_ped at the root bone plus the displacement, alpha and grey the strength, 4 units deep, none past 15',()=>{
 const sun:[number,number,number]=[.6,-.6,.52];
 const pool=pedShadowPool(9,[10,20,5],[10,30,8],sun,150)!;
 expect(pool.position).toEqual([10-.3,20+.3,5]);expect(pool.intensity).toBe(100);expect(pool.color).toEqual([100,100,100]);expect(pool.maxHeight).toBe(4);
 expect(pedShadowPool(9,[10,20,5],[10,35.5,8],sun,150)).toBeUndefined();
});

import {extraPlayerShadows} from '../src/render/nativePedShadows';
test('RenderExtraPlayerShadows casts shad_car away from each lamp the player is inside',()=>{
 const car={position:[0,0,0] as [number,number,number],forward:[0,1] as [number,number],right:[1,0] as [number,number],upZ:1,boundsMin:[-1,-2.5,-.5] as [number,number,number],boundsMax:[1,2.5,1] as [number,number,number]};
 const lamp={position:[3,0,4] as [number,number,number],radius:12,color:[200,180,120] as [number,number,number]};
 const [s]=extraPlayerShadows(car,car.position,[lamp,{...lamp,position:[30,0,4]},{...lamp,color:[0,0,0]}],160);
 expect(extraPlayerShadows(car,car.position,[lamp],160)).toHaveLength(1);
 // 5 units from the lamp: under half its radius, so 5/8 of 160 at full strength.
 expect(s.intensity).toBe(100);expect(s.color).toEqual([0,0,0]);expect(s.maxHeight).toBe(4.5);
 // 1.2 away from the lamp along its 2D direction (3/5 of it lies in x); half the box in each direction.
 expect(s.position[0]).toBeCloseTo(-.72,6);expect(s.position[1]).toBeCloseTo(0,6);
 expect(s.front).toEqual([0,2.5]);expect(s.side).toEqual([1,0]);
 // Upside down, the side flips back.
 expect(extraPlayerShadows({...car,upZ:-1},car.position,[lamp],160)[0].side).toEqual([-1,-0]);
 expect(extraPlayerShadows(car,car.position,[lamp],0)).toEqual([]);
});
