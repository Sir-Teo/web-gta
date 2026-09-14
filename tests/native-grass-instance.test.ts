import {expect,test} from 'vitest';
import {readPlants} from '../src/assets/vegetation';
import {initializeNativePlants} from '../src/world/nativeVegetation';
import {nativeGrassInstance,nativeGrassDrawColor} from '../src/world/nativeGrassInstance';
const cover=()=>initializeNativePlants(readPlants('GRASS_SHORT_LUSH 0 0 0 1 220 210 165 160 22 40 1 2 2 4 3 2 .1')).values().next().value!.covers[0];
const vertices=[[0,0,0],[4,0,2],[0,4,0]] as const;
test('explicit grass samples reflect into the triangle and build native upright scale/shear',()=>{
 const instance=nativeGrassInstance(vertices,cover(),[.75,.75,.5,.25,.5],.5);
 expect(instance.position).toEqual([1,1,.5]);expect(instance.scale).toEqual([2,2,3]);expect(instance.bend).toBe(3);
 expect([...instance.matrix]).toEqual([2,0,0,0,0,2,0,0,3,3,3,0,1,1,.5,1]);
 expect(nativeGrassInstance(vertices,cover(),[.75,.75,.5,.25,.5],0).position).toEqual(instance.position);
 expect(nativeGrassInstance(vertices,cover(),[1,0,0,0,0],0).position).toEqual([4,0,2]);
 expect(nativeGrassInstance(vertices,cover(),[1,1,0,0,0],0).position).toEqual([0,0,0]);
});
test('fixed samples reproduce transforms without mutating the triangle or cover',()=>{
 const settings=cover(),snapshot=structuredClone(settings);
 const first=nativeGrassInstance(vertices,settings,[.1,.2,.3,.4,.5],-.2);
 const second=nativeGrassInstance(vertices,settings,[.1,.2,.3,.4,.5],-.2);
 expect(second.matrix).toEqual(first.matrix);expect(settings).toEqual(snapshot);
 expect(()=>nativeGrassInstance(vertices,settings,[0,0,0,0,1.1],0)).toThrow('samples');
 expect(()=>nativeGrassInstance(vertices,settings,[0,0,0,0,0],Infinity)).toThrow('wind');
});
test('grass intensity divides by 256 and far fading preserves source byte boundaries',()=>{
 expect(nativeGrassDrawColor([255,128,64,255],255,59,60)).toEqual([254,127,63,255]);
 expect(nativeGrassDrawColor([255,128,64,255],255,70,60)).toEqual([254,127,63,127]);
 expect(nativeGrassDrawColor([255,128,64,255],255,80,60)).toEqual([254,127,63,0]);
 expect(nativeGrassDrawColor([255,128,64,255],255,80.01,60)).toBeUndefined();
 expect(nativeGrassDrawColor([255,128,64,40],160,40,30)).toEqual([159,80,40,20]);
});
