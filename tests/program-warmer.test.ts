import {expect,test} from 'vitest';
import * as THREE from 'three';
import {ProgramWarmer} from '../src/render/programWarmer';

/** A renderer stand-in: compile gives each material a program that links after `linkFrames` checks (a cached one is
 * linked already), as KHR_parallel_shader_compile reports it. */
function fakeRenderer(parallel=true){
 const props=new Map<THREE.Material,{currentProgram?:{isReady():boolean}}>(),linked=new Set<THREE.Material>();
 const compiled:THREE.Material[]=[],fogs:(THREE.Fog|THREE.FogExp2|null)[]=[];let lightsSeen=0;
 const renderer={
  extensions:{has:(name:string)=>parallel&&name==='KHR_parallel_shader_compile'},
  properties:{get:(m:THREE.Material)=>{let p=props.get(m);if(!p){p={};props.set(m,p);}return p;}},
  // As three's: lights from the target scene and from the batch, materials from every object in the batch.
  compile:(batch:THREE.Object3D,_camera:THREE.Camera,target:THREE.Scene)=>{
   let lights=0;const count=(o:THREE.Object3D)=>{if((o as THREE.Light).isLight)lights++;};
   target.traverseVisible(count);batch.traverseVisible(count);lightsSeen=lights;fogs.push(target.fog);
   const out=new Set<THREE.Material>();
   batch.traverse(o=>{const m=(o as THREE.Mesh).material as THREE.Material|undefined;if(!m)return;out.add(m);compiled.push(m);
    const p=renderer.properties.get(m);p.currentProgram??={isReady:()=>linked.has(m)};});
   return out;
  },
 };
 return {renderer:renderer as unknown as THREE.WebGLRenderer,link:(m:THREE.Material)=>linked.add(m),unlink:(m:THREE.Material)=>linked.delete(m),compiled,fogs,lights:()=>lightsSeen};
}

test('a new object waits out of the camera layers until its programs link, then draws',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),fake=fakeRenderer();
 scene.add(new THREE.DirectionalLight());
 const warmer=new ProgramWarmer(fake.renderer,scene,camera);
 const material=new THREE.MeshLambertMaterial(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),material),group=new THREE.Group();group.add(mesh);
 scene.add(group);
 warmer.beforeRender(0);
 expect(fake.compiled).toContain(material);expect(fake.lights()).toBe(1);
 expect(mesh.layers.test(camera.layers)).toBe(false);expect(warmer.holding).toBe(1);
 warmer.beforeRender(16);
 expect(mesh.layers.test(camera.layers)).toBe(false);
 fake.link(material);warmer.beforeRender(33);
 expect(mesh.layers.test(camera.layers)).toBe(true);expect(warmer.holding).toBe(0);
});

test('a linked program draws at once; nothing is held back without the extension',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),fake=fakeRenderer();
 const warmer=new ProgramWarmer(fake.renderer,scene,camera);
 const material=new THREE.MeshBasicMaterial();fake.link(material);
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(),material);scene.add(mesh);warmer.beforeRender(0);
 expect(mesh.layers.test(camera.layers)).toBe(true);
 const off=fakeRenderer(false),offScene=new THREE.Scene(),offWarmer=new ProgramWarmer(off.renderer,offScene,camera);
 const other=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());offScene.add(other);offWarmer.beforeRender(0);
 expect(off.compiled).toEqual([]);expect(other.layers.test(camera.layers)).toBe(true);
});

test('an object removed before the next frame is not compiled',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),fake=fakeRenderer();
 const warmer=new ProgramWarmer(fake.renderer,scene,camera);
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());scene.add(mesh);scene.remove(mesh);
 warmer.beforeRender(0);expect(fake.compiled).toEqual([]);
});

test('a light added with the first objects is counted once, as the frame will draw it',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),fake=fakeRenderer();
 const warmer=new ProgramWarmer(fake.renderer,scene,camera);
 scene.add(new THREE.HemisphereLight(),new THREE.DirectionalLight(),new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()));
 warmer.beforeRender(0);
 expect(fake.lights()).toBe(2);
});

test('when the fog changes kind every program starts linking again, nothing held back; one added to a group is warmed',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),fake=fakeRenderer();
 scene.fog=new THREE.FogExp2(0,.004);
 const warmer=new ProgramWarmer(fake.renderer,scene,camera);
 const hidden=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());hidden.visible=false;
 const signs=new THREE.Group();scene.add(hidden,signs);
 warmer.beforeRender(0);
 expect(fake.compiled).toEqual([hidden.material]);expect(fake.fogs.at(-1)).toBe(scene.fog);
 fake.link(hidden.material);warmer.beforeRender(16);
 // The timecycle's linear fog arrives: the hidden mesh's program is made again for it, and it is not held back.
 scene.fog=new THREE.Fog(0,10,500);fake.compiled.length=0;fake.unlink(hidden.material);
 warmer.beforeRender(33);
 expect(fake.compiled).toEqual([hidden.material]);expect(fake.fogs.at(-1)).toBe(scene.fog);
 expect(hidden.layers.test(camera.layers)).toBe(true);
 // The same fog again starts nothing.
 fake.compiled.length=0;warmer.beforeRender(50);expect(fake.compiled).toEqual([]);
 // A sign put up in a group already in the scene is warmed and held until it links.
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshBasicMaterial());signs.add(sign);
 warmer.beforeRender(66);
 expect(fake.compiled).toEqual([sign.material]);expect(sign.layers.test(camera.layers)).toBe(false);
 fake.link(sign.material);warmer.beforeRender(83);expect(sign.layers.test(camera.layers)).toBe(true);
});
