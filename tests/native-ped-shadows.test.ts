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
