import {test,expect} from '@playwright/test';
test('native altitude limits fog and camera clipping using world-space camera height',async({page})=>{
 await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const threePath='/node_modules/three/build/three.module.js',lightingPath='/src/render/WorldLighting.ts';
  const THREE=await import(threePath);
  const {WorldLighting}=await import(lightingPath);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(70,1,.08,2000),parent=new THREE.Group();parent.add(camera);parent.position.y=350;
  const lighting=new WorldLighting(scene,[],[]);
  const source={top:[0,0,0],horizon:[0,0,0],ambient:[0,0,0],sunCore:[0,0,0],sunCorona:[0,0,0],sunSize:0,fog:{start:10,end:1600}};
  lighting.nativeTimecycle=()=>source;
  lighting.update(720,{x:0,y:0,z:0},camera,0,0,70,false);
  const elevated={far:camera.far,fog:scene.fog.far,start:scene.fog.near,source:source.fog.end};
  parent.position.y=0;lighting.update(720,{x:0,y:0,z:0},camera,0,0,70,false);
  const ground={far:camera.far,fog:scene.fog.far};
  lighting.nativeTimecycle=undefined;lighting.update(720,{x:0,y:0,z:0},camera,0,0,70,false);
  const restored=camera.far;lighting.dispose();return {elevated,ground,restored};
 });
 expect(result).toEqual({elevated:{far:1300,fog:1300,start:10,source:1600},ground:{far:1600,fog:1600},restored:2000});
});
