import {test,expect,vi} from 'vitest';
import * as THREE from 'three';
import {buildingAlpha,setBuildingDualPass} from '../src/assets/buildingAlpha';
import {placementFade} from '../src/render/placementFade';

function fixture() {
  const material=new THREE.MeshBasicMaterial({transparent:true,alphaTest:1/255}),policy={enabled:true,threshold:128};buildingAlpha(material,policy);
  const geometry=new THREE.PlaneGeometry(),a=new THREE.Mesh(geometry,material),b=new THREE.Mesh(geometry,material),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
  const draws:{material:THREE.MeshBasicMaterial;opacity:number;depth:boolean;alpha:number;blending:THREE.Blending}[]=[];
  const renderer={renderBufferDirect:(_camera:unknown,_scene:unknown,_geometry:unknown,m:THREE.MeshBasicMaterial)=>draws.push({material:m,opacity:m.opacity,depth:m.depthWrite,alpha:m.alphaTest,blending:m.blending})} as unknown as THREE.WebGLRenderer;
  const render=(mesh:THREE.Mesh)=>{const m=mesh.material as THREE.MeshBasicMaterial;m.onBeforeRender(renderer,scene,camera,geometry,mesh,undefined as never);return m;};
  return {material,policy,geometry,a,b,draws,render};
}

test('dual materials copy actual placement state and own independent reusable high passes',()=>{
  const {material,geometry,a,b,draws,render}=fixture(),fa=placementFade(a),fb=placementFade(b,8);
  fa.setAlpha(128);fb.setAlpha(64);render(a);render(b);render(a);
  expect(draws.map(d=>d.opacity)).toEqual([128/255,64/255,128/255]);expect(draws.every(d=>d.depth&&d.alpha===128/255)).toBe(true);
  expect(draws[1].blending).toBe(THREE.AdditiveBlending);expect(draws[0].material).toBe(draws[2].material);expect(draws[0].material).not.toBe(draws[1].material);
  let disposed=0;new Set(draws.map(d=>d.material)).forEach(m=>m.addEventListener('dispose',()=>disposed++));
  fa.dispose();fa.dispose();expect(disposed).toBe(1);fb.dispose();expect(disposed).toBe(2);
  expect(material.opacity).toBe(1);material.dispose();geometry.dispose();
});

test('no-depth-write placements suppress the split at full visibility and while fading',()=>{
  const {material,geometry,a,draws,render}=fixture(),fade=placementFade(a,0x40);
  expect(render(a).depthWrite).toBe(false);expect((a.material as THREE.Material).alphaTest).toBe(0);
  fade.setAlpha(128);expect(render(a).depthWrite).toBe(false);expect(draws).toHaveLength(0);
  fade.dispose();render(a);expect(draws).toHaveLength(1);material.dispose();geometry.dispose();
});

test('disabled dual policy restores incoming alpha/depth settings and validates thresholds',()=>{
  const {material,geometry,a,policy,draws,render}=fixture();render(a);policy.enabled=false;render(a);
  expect(draws).toHaveLength(1);expect(material.depthWrite).toBe(true);expect(material.alphaTest).toBe(1/255);
  policy.enabled=true;material.transparent=false;render(a);expect(draws).toHaveLength(1);
  for(const value of [-1,256,.5,NaN]){policy.threshold=value;expect(()=>render(a)).toThrow('byte');}
  material.dispose();geometry.dispose();
});

test('a touch screen draws building alpha in one pass, as the mobile ports\' shaders do: no high pass, the material\'s own alpha test',()=>{
  const {material,geometry,a,draws,render}=fixture();
  try{
    setBuildingDualPass(false);render(a);
    expect(draws).toHaveLength(0);expect(material.alphaTest).toBe(1/255);expect(material.depthWrite).toBe(true);expect(material.userData.nativeDualActive).toBeFalsy();
    // Allowed again (a desktop session), the split comes back.
    setBuildingDualPass(true);render(a);expect(draws).toHaveLength(1);expect(material.userData.nativeDualActive).toBe(true);
  }finally{setBuildingDualPass(true);material.dispose();geometry.dispose();}
});

test('high passes read the source userData live and copy the whole material only when it changes',()=>{
  const {material,geometry,a,draws,render}=fixture();
  // Material.copy deep-copies userData through JSON: an env map held there would be serialised on every draw.
  const env={map:new THREE.Texture(),coefficient:1,fbAlpha:false};material.userData.nativeEnv=env;
  const serialised=vi.spyOn(THREE.Texture.prototype,'toJSON');
  render(a);render(a);
  expect(serialised).not.toHaveBeenCalled();
  const high=draws[0].material;expect(draws[1].material).toBe(high);
  expect(high.userData.nativeEnv).toBe(env);expect(high.userData.nativeDualHigh).toBe(true);expect(material.userData.nativeDualHigh).toBeUndefined();
  material.opacity=.25;render(a);expect(draws[2].opacity).toBe(.25);
  material.side=THREE.DoubleSide;render(a);expect(high.side).toBe(THREE.FrontSide);
  material.needsUpdate=true;render(a);expect(high.side).toBe(THREE.DoubleSide);
  serialised.mockRestore();env.map.dispose();material.dispose();geometry.dispose();
});
