import {expect,test} from 'vitest';
import {characterShadowBounds} from '../src/render/characterShadowBounds';
import type {DffModel,ModelMorphBounds} from '../src/assets/dff';
const model=(bounds:ModelMorphBounds[]):DffModel=>({frames:[],warnings:[],geometries:bounds.map(bound=>({morphBounds:[bound]} as any)),atomics:bounds.map((_,geometry)=>({frame:0,geometry,flags:4}))});
test('single native bounds remain exact and copied, while common-frame player parts are enclosed',()=>{
 const bounds:ModelMorphBounds[]=[{center:[0,0,0],radius:1},{center:[0,0,2],radius:.5},{center:[2,0,1],radius:.4}];
 expect(characterShadowBounds(model([bounds[0]]),false)).toEqual(bounds[0]);
 const result=characterShadowBounds(model(bounds),true)!;
 for(const bound of bounds)expect(Math.hypot(...bound.center.map((v,i)=>v-result.center[i]))+bound.radius).toBeLessThanOrEqual(result.radius+1e-12);
 result.center[0]=100;expect(bounds[0].center).toEqual([0,0,0]);
 expect(characterShadowBounds(model(bounds),false)).toBeUndefined();
});
test('missing part bounds and different atomic frames cannot silently produce partial captures',()=>{
 const source=model([{center:[0,0,0],radius:1},{center:[1,0,0],radius:1}]);
 source.atomics[1].frame=1;expect(characterShadowBounds(source,true)).toBeUndefined();
 source.atomics[1].frame=0;source.geometries[1].morphBounds=undefined;expect(characterShadowBounds(source,true)).toBeUndefined();
 source.atomics[1].flags=0;expect(characterShadowBounds(source,true)).toEqual({center:[0,0,0],radius:1});
 source.geometries[0].morphBounds![0].radius=NaN;expect(characterShadowBounds(source,true)).toBeUndefined();
});
