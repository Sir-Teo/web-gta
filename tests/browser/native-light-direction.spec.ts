import {test,expect} from '@playwright/test';

test('native illumination stays fixed across time and terrain height, independently of the visible sun',async({page})=>{
 await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const threePath='/node_modules/three/build/three.module.js',lightingPath='/src/render/WorldLighting.ts',sunPath='/src/world/sun.ts';
  const THREE=await import(threePath),{WorldLighting}=await import(lightingPath),{sampleSun}=await import(sunPath);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(70,1,.08,2000);
  const lighting=new WorldLighting(scene,[],[]);
  const light=scene.children.find((object:any)=>object.isDirectionalLight) as any;
  const direction=()=>light.position.clone().sub(light.target.position).normalize().toArray();
  lighting.update(720,{x:2495,y:0,z:1687},camera,0,0,70,false);
  const authored=direction();
  lighting.nativeTimecycle=()=>({top:[0,0,0],horizon:[0,0,0],ambient:[0,0,0],sunCore:[0,0,0],sunCorona:[0,0,0],sunSize:0});
  const samples=[0,360,720,1080].map((minutes,i)=>{
   const height=i*300;
   lighting.update(minutes,{x:2495,y:height,z:1687},camera,0,0,70,false);
   return {direction:direction(),height:light.target.position.y,distance:light.position.distanceTo(light.target.position),visibleSun:sampleSun(minutes).direction};
  });
  lighting.nativeTimecycle=undefined;
  lighting.update(720,{x:2495,y:0,z:1687},camera,0,0,70,false);
  const restored=direction();lighting.dispose();return {samples,authored,restored};
 });
 result.samples.forEach((sample,i)=>{
  expect(sample.direction[0]).toBeCloseTo(-.5,12);
  expect(sample.direction[1]).toBeCloseTo(Math.SQRT1_2,12);
  expect(sample.direction[2]).toBeCloseTo(.5,12);
  expect(sample.height).toBe(i*300);expect(sample.distance).toBeCloseTo(90,10);
 });
 expect(result.samples[0].visibleSun).not.toEqual(result.samples[2].visibleSun);
 expect(result.authored).not.toEqual(result.samples[2].direction);
 expect(result.restored).toEqual(result.authored);
});

test('native directional color is neutral and intensity uses the source multiplier with fallback restoration',async({page})=>{
 await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const threePath='/node_modules/three/build/three.module.js',lightingPath='/src/render/WorldLighting.ts';
  const THREE=await import(threePath),{WorldLighting}=await import(lightingPath);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(70,1,.08,2000);
  const lighting=new WorldLighting(scene,[],[]),light=scene.children.find((o:any)=>o.isDirectionalLight) as any;
  const snapshot=()=>({color:light.color.toArray(),intensity:light.intensity});
  const update=(minutes=720)=>lighting.update(minutes,{x:0,y:0,z:0},camera,0,0,70,false);
  update();const authored=snapshot();
  const source:any={top:[0,0,0],horizon:[0,0,0],ambient:[0,0,0],sunCore:[0,0,0],sunCorona:[0,0,0],sunSize:0,directionalMultiplier:1.5};
  lighting.nativeTimecycle=()=>source;update();const native=snapshot();
  update(0);const midnight=snapshot();
  source.directionalMultiplier=0;update();const zero=snapshot();
  source.directionalMultiplier=undefined;update();const missing=snapshot();
  lighting.nativeTimecycle=undefined;update();const restored=snapshot();
  lighting.dispose();return {authored,native,midnight,zero,missing,restored};
 });
 expect(result.native).toEqual({color:[1,1,1],intensity:1.494140625});
 expect(result.midnight).toEqual(result.native);
 expect(result.zero).toEqual({color:[1,1,1],intensity:0});
 expect(result.missing).toEqual(result.authored);expect(result.restored).toEqual(result.authored);
});
