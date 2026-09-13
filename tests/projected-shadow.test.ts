import {expect,test} from 'vitest';
import {Texture} from 'three';
import {ProjectedShadow} from '../src/render/ProjectedShadow';
const receiver={positions:new Float32Array([0,0,0,0,0,1,1,0,0]),uvs:new Float32Array([0,0,0,1,1,0]),lights:new Uint8Array([255,255,255]),faces:new Uint32Array([0,0,0])};
test('shadow uploads retain capacity, replace draw ranges, and reject incomplete updates atomically',()=>{
 const shadow=new ProjectedShadow(6),texture=new Texture(),geometry=shadow.mesh.geometry,positions=geometry.getAttribute('position').array;
 shadow.update([receiver,receiver],texture,255,0);expect(geometry.drawRange.count).toBe(6);expect(shadow.mesh.visible).toBe(true);
 expect(()=>shadow.update([receiver,receiver,receiver],texture,255,0)).toThrow('capacity');expect(geometry.drawRange.count).toBe(6);
 expect(()=>shadow.update([receiver],texture,256,0)).toThrow('lighting');expect(geometry.drawRange.count).toBe(6);
 expect(()=>shadow.update([{...receiver,uvs:new Float32Array()}],texture,255,0)).toThrow('receiver');expect(geometry.drawRange.count).toBe(6);
 shadow.update([receiver],texture,128,1);expect(geometry.getAttribute('position').array).toBe(positions);expect(geometry.drawRange.count).toBe(3);
 expect((geometry.getAttribute('position') as any).updateRanges).toEqual([{start:0,count:9}]);
 expect(shadow.mesh.material.uniforms.shadowStrength.value).toBe(128);expect(shadow.mesh.material.uniforms.nightBalance.value).toBe(1);
 shadow.dispose();texture.dispose();
});
test('shadow owns its geometry and material but borrows textures through clear and disposal',()=>{
 const shadow=new ProjectedShadow(3),texture=new Texture();let textures=0,geometries=0,materials=0;
 texture.addEventListener('dispose',()=>textures++);shadow.mesh.geometry.addEventListener('dispose',()=>geometries++);shadow.mesh.material.addEventListener('dispose',()=>materials++);
 shadow.update([receiver],texture,255,0);shadow.clear();expect(shadow.mesh.visible).toBe(false);expect(shadow.mesh.material.uniforms.shadowTexture.value).toBeNull();expect(textures).toBe(0);
 shadow.update([receiver],undefined,255,0);expect(shadow.mesh.visible).toBe(false);
 shadow.update([receiver],texture,0,0);expect(shadow.mesh.visible).toBe(false);
 shadow.dispose();shadow.dispose();expect([textures,geometries,materials]).toEqual([0,1,1]);
 expect(()=>shadow.update([receiver],texture,255,0)).toThrow('disposed');texture.dispose();
});
