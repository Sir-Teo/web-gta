import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {flattenStaticModel} from '../src/assets/ModelObjects';
/** A frame hierarchy like a streamed building's: nested groups with one mesh at the bottom. */
function hierarchy(){
 const root=new THREE.Group(),frame=new THREE.Group(),inner=new THREE.Group();
 frame.position.set(2,0,-1);frame.rotation.y=Math.PI/3;inner.position.set(0,3,0);inner.scale.setScalar(2);
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1));mesh.position.set(.5,0,.25);
 inner.add(mesh);frame.add(inner);root.add(frame);
 const other=new THREE.Mesh(new THREE.BoxGeometry(1,1,1));other.position.set(-4,1,0);root.add(other);
 return {root,mesh,other};
}
describe('flattenStaticModel',()=>{
 it('keeps every mesh where it was in the world',()=>{
  const {root,mesh,other}=hierarchy();root.updateMatrixWorld(true);
  const before=[mesh,other].map(m=>m.matrixWorld.clone());
  flattenStaticModel(root);root.updateMatrixWorld(true);
  for(const [i,m] of [mesh,other].entries())expect(m.matrixWorld.elements.map(v=>Math.round(v*1e6)/1e6)).toEqual(before[i].elements.map(v=>Math.round(v*1e6)/1e6));
 });
 it('drops the empty frames and parents every mesh to the root',()=>{
  const {root}=hierarchy();
  expect(flattenStaticModel(root)).toBe(1);
  expect(root.children.length).toBe(2);
  expect(root.children.every(c=>(c as THREE.Mesh).isMesh)).toBe(true);
  expect(root.children.every(c=>!c.matrixAutoUpdate)).toBe(true);
 });
 it('is a no-op the second time, so a shared source can be reused',()=>{
  const {root,mesh}=hierarchy();flattenStaticModel(root);root.updateMatrixWorld(true);
  const world=mesh.matrixWorld.clone();
  expect(flattenStaticModel(root)).toBe(0);root.updateMatrixWorld(true);
  expect(mesh.matrixWorld.elements).toEqual(world.elements);
 });
 it('leaves a skinned model alone, since its bones move',()=>{
  const root=new THREE.Group(),bone=new THREE.Bone(),mesh=new THREE.SkinnedMesh(new THREE.BoxGeometry(1,1,1));
  bone.add(mesh);root.add(bone);
  expect(flattenStaticModel(root)).toBe(0);
  expect(root.children[0]).toBe(bone);
 });
 it('handles a model with no meshes at all',()=>{
  const root=new THREE.Group();root.add(new THREE.Group());
  expect(flattenStaticModel(root)).toBe(0);
  expect(root.children.length).toBe(1);
 });
});
