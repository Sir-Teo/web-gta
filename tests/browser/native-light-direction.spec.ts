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
