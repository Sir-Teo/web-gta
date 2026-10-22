import {expect,test} from 'vitest';
import {nativeQuaternionBasis,reorthogonaliseVehicleBasis,vehicleQuaternionRotation} from '../src/simulation/nativeVehicleQuaternion';

test('CQuaternion::Get preserves a non-unit input instead of normalizing it',()=>{
 expect(nativeQuaternionBasis({x:0,y:0,z:1,w:1})).toEqual({right:{x:-1,y:2,z:0},forward:{x:-2,y:-1,z:0},up:{x:0,y:0,z:1}});
 expect(nativeQuaternionBasis({x:0,y:0,z:0,w:0})).toEqual({right:{x:1,y:0,z:0},forward:{x:0,y:1,z:0},up:{x:0,y:0,z:1}});
});

test('physical reorthogonalization follows the matrix axes, producing a different rotation from input normalization',()=>{
 const b=nativeQuaternionBasis({x:0,y:0,z:1,w:1}),r=reorthogonaliseVehicleBasis(b),s=1/Math.sqrt(5);
 expect(r.right.x).toBeCloseTo(-s,6);expect(r.right.y).toBeCloseTo(2*s,6);expect(r.forward.x).toBeCloseTo(-2*s,6);expect(r.forward.y).toBeCloseTo(-s,6);expect(r.up).toEqual({x:0,y:0,z:1});
 const q=vehicleQuaternionRotation(b);expect(q.x).toBe(0);expect(q.z).toBe(-0);expect(Math.hypot(q.x,q.y,q.z,q.w)).toBeCloseTo(1,12);
 // Native z becomes renderer y: yaw is atan2(2, -1), not the normalized input quaternion's 90 degrees.
 expect(2*Math.atan2(q.y,q.w)).toBeCloseTo(Math.atan2(2,-1),6);
});

test('DECON’s exact SCM quaternion retains its non-rigid basis before the physical pass',()=>{
 const q={x:-.04479999840259552,y:.017799999564886093,z:1.003000020980835,w:-.06109999865293503},b=nativeQuaternionBasis(q),physical=reorthogonaliseVehicleBasis(b);
 expect(Math.hypot(b.right.x,b.right.y,b.right.z)).toBeGreaterThan(1.02);
 for(const v of Object.values(physical))expect(Math.hypot(v.x,v.y,v.z)).toBeCloseTo(1,6);
 const length=Math.hypot(q.x,q.y,q.z,q.w),normalized=nativeQuaternionBasis({x:q.x/length,y:q.y/length,z:q.z/length,w:q.w/length});
 expect(Math.abs(physical.forward.x-normalized.forward.x)).toBeGreaterThan(.001);
 expect(b.right.x).toBeLessThan(-1);
});
