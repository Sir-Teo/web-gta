import {expect,test} from 'vitest';
import {Scene,PerspectiveCamera,Texture} from 'three';
import {NativeLowClouds,LOW_CLOUD_POSITIONS} from '../src/render/NativeLowClouds';
import {viewerLowCloudVisibility} from '../src/world/viewerWeather';
test('viewer low-cloud layer appears only for ordinary sunny SA entries',()=>{
 for(let i=0;i<23;i++)expect(viewerLowCloudVisibility(i)).toBe([1,3,5,10,14,18].includes(i)?1:0);
 expect(()=>viewerLowCloudVisibility(23)).toThrow();
});
test('clouds retain source world heights as the camera rises and honor missing data',()=>{
 const clouds=new NativeLowClouds(new Scene()),camera=new PerspectiveCamera(70,1,.08,20),texture=new Texture();
 camera.lookAt(800,40,0);camera.updateMatrixWorld(true);
 const source={color:[200,100,40] as [number,number,number],visibility:.5};
 clouds.update(camera,source,texture,70);const mesh=clouds.meshes[0],center=mesh.material.uniforms.center.value.y;
 expect(LOW_CLOUD_POSITIONS).toHaveLength(12);expect(LOW_CLOUD_POSITIONS[0]).toEqual({x:800,y:40,z:-0});
 expect(LOW_CLOUD_POSITIONS[11].y).toBe(142);expect(mesh.visible).toBe(true);
 expect(mesh.material.uniforms.tint.value.toArray()).toEqual([100,50,20].map(v=>v/255));
 camera.position.y=100;camera.updateMatrixWorld(true);clouds.update(camera,source,texture,70);
 expect(mesh.material.uniforms.center.value.y).toBeLessThan(center-.1);
 clouds.update(camera,source,undefined,70);expect(clouds.meshes.every(m=>!m.visible)).toBe(true);
 clouds.update(camera,{...source,visibility:0},texture,70);expect(clouds.meshes.every(m=>!m.visible)).toBe(true);
 let disposed=0;texture.addEventListener('dispose',()=>disposed++);clouds.dispose();expect(disposed).toBe(0);texture.dispose();
});
