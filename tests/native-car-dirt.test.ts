import {expect,test} from 'vitest';
import {MeshLambertMaterial,Texture} from 'three';
import {bindNativeCarDirt} from '../src/render/nativeCarDirt';

test('SetDirtTextures: the vehiclegrunge256 materials fade toward white by the dirt level over sixteen',()=>{
 const grunge=new MeshLambertMaterial({map:new Texture()}),paint=new MeshLambertMaterial({map:new Texture()});
 const bindings=[{material:grunge,texture:{name:'vehiclegrunge256'}},{material:paint,texture:{name:'greenwood92body'}}] as never;
 const dirt=bindNativeCarDirt(bindings);expect(dirt.count).toBe(1);
 const shader={uniforms:{} as Record<string,{value:number}>,fragmentShader:'#include <map_fragment>',vertexShader:''};
 grunge.onBeforeCompile(shader as never,undefined as never);
 expect(shader.fragmentShader).toContain('mix( vec3( 1.0 ), sampledDiffuseColor.rgb, nativeDirt )');
 dirt.setLevel(14.7);expect(shader.uniforms.nativeDirt.value).toBeCloseTo(14/16);
 dirt.setLevel(0);expect(shader.uniforms.nativeDirt.value).toBe(0);
 expect(grunge.customProgramCacheKey()).toContain('native-car-dirt');
});
