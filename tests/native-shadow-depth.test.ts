import {expect,test} from 'vitest';
import {nativeShadowNearClip} from '../src/render/nativeShadowDepth';
test('native clip bias scales with depth range and downward view while upward views retain full bias',()=>{
 const near=1,far=1025;
 expect(nativeShadowNearClip(near,far,0)).toBe(1+2**-13);
 expect(nativeShadowNearClip(near,far,1)).toBe(1+2**-13);
 expect(nativeShadowNearClip(near,far,-1)).toBe(1+2**-15);
 expect(nativeShadowNearClip(near,far,-.5)).toBe(1+5*2**-16);
 expect(nativeShadowNearClip(1,513,0)-1).toBe(2**-14);
});
test('invalid clip ranges and non-direction inputs are rejected',()=>{
 for(const [near,far,y] of [[0,10,0],[10,1,0],[1,10,2],[1,Infinity,0],[1,10,NaN]])expect(()=>nativeShadowNearClip(near,far,y)).toThrow('camera');
});
