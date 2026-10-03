import {expect,test} from 'vitest';
import {MeshBasicMaterial,Texture} from 'three';
import {CAR_REFLECTIONS,nativeCarEnvMaterial,nativeCarEnvState} from '../src/assets/nativeCarEnvMap';
import {parseTouchSettings} from '../src/input/touchSettings';

test('the Car reflections setting gates every car\'s reflection, both styles, as the car\'s own state does',()=>{
 for(const style of ['cam','wave'] as const){
  const material=nativeCarEnvMaterial(new MeshBasicMaterial(),new Texture(),{scaleX:1,scaleY:1,transSclX:1,transSclY:1,shininess:.5},style,nativeCarEnvState());
  const shader={uniforms:{} as Record<string,{value:unknown}>,vertexShader:'#include <fog_vertex>',fragmentShader:'#include <fog_fragment>'};
  material.onBeforeCompile(shader as never,undefined as never);
  // One shared uniform for every car: switching the setting needs no recompile.
  expect(shader.uniforms.nativeCarReflections).toBe(CAR_REFLECTIONS);
  expect(shader.fragmentShader).toContain('if ( nativeCarEnvOn && nativeCarReflections ) {');
 }
 expect(CAR_REFLECTIONS.value).toBe(true);
 expect(parseTouchSettings({}).carReflections).toBe(true);expect(parseTouchSettings({carReflections:false}).carReflections).toBe(false);
});
