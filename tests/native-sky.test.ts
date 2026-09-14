import { expect, test } from 'vitest';
import { Scene, PerspectiveCamera, Group } from 'three';
import { NativeSky } from '../src/render/NativeSky';
import { belowHorizonColor } from '../src/world/nativeSkyColors';
const dry={foggyness:0,underwaterness:0};
test('below-horizon gray follows native day boundaries, altitude and weather blends',()=>{
  for(const [minute,gray] of [[0,30],[300,30],[360,30],[420,50],[720,60],[1140,60],[1200,50],[1320,35],[1440,30]])
    expect(belowHorizonColor(minute,0,[200,100,0],dry)).toEqual([gray,gray,gray]);
  expect(belowHorizonColor(1380,0,[200,100,0],dry)).toEqual([32,32,32]);
  expect(belowHorizonColor(720,25,[200,100,0],dry)).toEqual([60,60,60]);
  expect(belowHorizonColor(720,65,[200,100,0],dry)).toEqual([130,80,30]);
  expect(belowHorizonColor(720,105,[200,100,0],dry)).toEqual([200,100,0]);
  expect(belowHorizonColor(720,0,[200,100,0],{...dry,foggyness:.5})).toEqual([130,80,30]);
  expect(belowHorizonColor(720,0,[200,100,0],{...dry,underwaterness:1})).toEqual([200,100,0]);
  expect(()=>belowHorizonColor(720,NaN,[0,0,0],dry)).toThrow();
});
test('native sky has five source quads and follows world camera position and yaw without pitch',()=>{
  const scene=new Scene(),sky=new NativeSky(scene,{}),camera=new PerspectiveCamera(70,1,.08,20),parent=new Group();
  parent.position.set(10,65,20);parent.add(camera);scene.add(parent);
  camera.rotation.set(.3,0,0);scene.updateMatrixWorld(true);
  const source={top:[255,0,0] as [number,number,number],bottom:[0,0,255] as [number,number,number]};
  sky.update(camera,source,720,dry);
  expect(sky.mesh.position.toArray()).toEqual([10,65,20]);expect(sky.mesh.rotation.y).toBeCloseTo(0);
  expect(sky.mesh.geometry.getAttribute('position').count).toBe(20);expect(sky.mesh.geometry.index?.count).toBe(30);
  expect(Array.from(sky.mesh.geometry.getAttribute('position').array).slice(0,12)).toEqual([-42,15,-30,42,15,-30,-42,0,-30,42,0,-30]);
  parent.rotation.y=Math.PI/2;scene.updateMatrixWorld(true);sky.update(camera,source,720,dry);
  expect(sky.mesh.rotation.y).toBeCloseTo(Math.PI/2);expect(sky.mesh.rotation.x).toBe(0);
  sky.update(camera,undefined,720,dry);expect(sky.mesh.visible).toBe(false);
  sky.dispose();expect(scene.children).not.toContain(sky.mesh);
});
