import {expect,test} from 'vitest';
import {NativeCarReflection,nativeCarEnvStyle,nativeCarWaveStep} from '../src/assets/nativeCarEnvMap';

const env=(shininess:number)=>({scaleX:1,scaleY:1,transSclX:1,transSclY:1,shininess});
test('CustomPipeMaterialSetup: shininess and the env texture\'s first letter pick the reflection',()=>{
 expect(nativeCarEnvStyle(env(.09),'xvehicleenv128',true)).toBe('wave');
 expect(nativeCarEnvStyle(env(.09),'xvehicleenv128',false)).toBeUndefined();
 expect(nativeCarEnvStyle(env(.15),'vehicleenvmap128',false)).toBe('cam');
 expect(nativeCarEnvStyle(env(0),'vehicleenvmap128',true)).toBeUndefined();
 expect(nativeCarEnvStyle(undefined,'vehicleenvmap128',true)).toBeUndefined();
});
test('SHINE_WAVE: OffsetU follows the zigzag of the position, signed by travel along the car\'s forward',()=>{
 // tri over 50 units: at x = 10 it is 1 − 0.2 = 0.8, at x = 15 it is 0.7 (y = 0 adds 1 both times).
 const forward=nativeCarWaveStep(0,{x:10,y:0},{x:15,y:0},{x:1,y:0},{x:1,y:1});
 expect(forward).toBeCloseTo(.1,6);
 const back=nativeCarWaveStep(.5,{x:10,y:0},{x:15,y:0},{x:-1,y:0},{x:1,y:1});
 expect(back).toBeCloseTo(.4,6);
 // Wrapped into 0..1.
 expect(nativeCarWaveStep(.95,{x:10,y:0},{x:15,y:0},{x:1,y:0},{x:1,y:1})).toBeCloseTo(.05,6);
});
test('the per-frame update: gSpecIntensity × 1.85, the native position, and the wave v from the up axis',()=>{
 const r=new NativeCarReflection();
 r.update(.8,{x:3,y:1,z:-7},{x:0,y:0,z:0,w:1});
 expect(r.state.specIntensity.value).toBeCloseTo(1.48,6);
 expect(r.state.position.value.toArray()).toEqual([3,7]);
 // Upright: up (0,0,1) native gives v = clamp(0 + 0, 0, 0.1) = 0.
 expect(r.state.wave.value.y).toBe(0);
 // Upside down (180° about the forward axis): v = 1 − 0.
 r.update(.8,{x:3,y:1,z:-7},{x:0,y:0,z:1,w:0});
 expect(r.state.wave.value.y).toBe(1);
});
