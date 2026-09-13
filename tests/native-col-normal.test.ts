import {expect,test} from 'vitest';
import {nativeColNormal} from '../src/assets/nativeColNormal';
const zero={x:0,y:0,z:0},b={x:0,y:1,z:0};
test('native triangle normals reverse winding and truncate signed components at 1/4096',()=>{
 expect(nativeColNormal(zero,b,{x:1,y:0,z:1}).toArray()).toEqual([-2896/4096,0,2896/4096]);
 expect(nativeColNormal(zero,{x:1,y:0,z:1},b).toArray()).toEqual([2896/4096,0,-2896/4096]);
});
test('near-parallel components quantize to zero and degenerate normals follow source fallback',()=>{
 const normal=nativeColNormal(zero,b,{x:1,y:0,z:.0001});expect(Math.abs(normal.x)).toBe(0);expect(normal.z).toBe(1);
 expect(nativeColNormal(zero,zero,zero).toArray()).toEqual([1,0,0]);
});
