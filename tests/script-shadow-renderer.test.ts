import {expect,test} from 'vitest';
import * as THREE from 'three';
import {NativeScriptShadows} from '../src/render/NativeScriptShadows';
import {scriptShadow,SCRIPT_SHADOW_TEXTURES} from '../src/render/nativeScriptShadow';

test('all six script rasters use native blend modes, first-occurrence batching, projected geometry and one-frame lifetime',()=>{
 const scene=new THREE.Scene(),renderer=new NativeScriptShadows(scene),textures=new Map(SCRIPT_SHADOW_TEXTURES.map(name=>[name,new THREE.Texture()])),receivers=()=>({chunks:[{geometry:{positions:new Float32Array([0,9,0,1,9,0,0,9,-1]),uvs:new Float32Array(6)}}]});
 const types=[5,2,1,6,3,4],shadows=types.map((type,id)=>({...scriptShadow(type,0,0,10,0,1,150,0,0,0)!,id}));
 renderer.frame(shadows,[0,0,10],receivers,name=>textures.get(name as typeof SCRIPT_SHADOW_TEXTURES[number]));expect(renderer.drawn).toBe(6);expect(renderer.types).toEqual([1,2,3,4,5,6]);
 const meshes=scene.children as THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>[];
 for(let i=0;i<6;i++){expect(meshes[i].material.uniforms.raster.value).toBe(textures.get(SCRIPT_SHADOW_TEXTURES[i]));expect(meshes[i].material.blendSrc).toBe(i===2||i===4?THREE.OneFactor:THREE.SrcAlphaFactor);expect(meshes[i].material.blendDst).toBe(i===2||i===4?THREE.OneFactor:THREE.OneMinusSrcAlphaFactor);expect(meshes[i].geometry.drawRange.count).toBe(3);}
 expect(meshes[4].renderOrder).toBeLessThan(meshes[1].renderOrder);expect(meshes[1].renderOrder).toBeLessThan(meshes[0].renderOrder);
 renderer.frame([],[0,0,10],receivers,()=>undefined);expect(renderer.drawn).toBe(0);expect(meshes.every(mesh=>!mesh.visible)).toBe(true);renderer.dispose();expect(scene.children).toHaveLength(0);
});
