import {expect,test} from 'vitest';
import * as THREE from 'three';
import {ProgramWarmer} from '../src/render/programWarmer';

/** A renderer stand-in: compile gives each material a program that links after `linkFrames` checks (a cached one is
 * linked already), as KHR_parallel_shader_compile reports it. */
function fakeRenderer(parallel=true){
 const props=new Map<THREE.Material,{currentProgram?:{isReady():boolean}}>(),linked=new Set<THREE.Material>();
 const compiled:THREE.Material[]=[];let lightsSeen=0;
 const renderer={
  extensions:{has:(name:string)=>parallel&&name==='KHR_parallel_shader_compile'},
  properties:{get:(m:THREE.Material)=>{let p=props.get(m);if(!p){p={};props.set(m,p);}return p;}},
  compile:(batch:THREE.Object3D,_camera:THREE.Camera,target:THREE.Scene)=>{
   target.traverseVisible(o=>{if((o as THREE.Light).isLight)lightsSeen++;});
   const out=new Set<THREE.Material>();
   batch.traverse(o=>{const m=(o as THREE.Mesh).material as THREE.Material|undefined;if(!m)return;out.add(m);compiled.push(m);
    const p=renderer.properties.get(m);p.currentProgram??={isReady:()=>linked.has(m)};});
   return out;
  },
 };
 return {renderer:renderer as unknown as THREE.WebGLRenderer,link:(m:THREE.Material)=>linked.add(m),compiled,lights:()=>lightsSeen};
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
