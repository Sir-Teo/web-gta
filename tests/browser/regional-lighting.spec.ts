import {test,expect} from '@playwright/test';
test('regional lighting responds to parented camera movement before altitude correction and restores fallback',async({page})=>{
 await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const p='/node_modules/three/build/three.module.js',w='/src/render/WorldLighting.ts',l='/src/world/LocalTimecycle.ts';
  const THREE=await import(p),{WorldLighting}=await import(w),{LocalTimecycle}=await import(l);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(70,1,.08,2000),parent=new THREE.Group();parent.add(camera);
  const local=new LocalTimecycle(),lighting=new WorldLighting(scene,[],[]);
  const rows=Array.from({length:184},(_,i)=>{const v=Array(51).fill(0);v[9]=i>=168?0:200;v[11]=i>=168?200:0;v[0]=i>=168?128:32;v[27]=1600;v[28]=10;return v.join(' ');}).join('\n');
  local.setModifiers([{min:[10,20,300],max:[20,30,400],farClip:800,extraColor:0,strengthPercent:100,falloff:10,lodDistanceMultiplier:.9,line:1}]);local.load(rows,'probe.dat');
  lighting.nativeTimecycle=(m:number,position:any)=>local.sample(m,position);
  const draw=(x:number)=>{parent.position.set(x,350,-25);lighting.update(720,{x:0,y:0,z:0},camera,0,0,70,false);return {far:camera.far,fog:scene.fog.far,ambient:lighting.nativeWorldAmbient?.[0],sky:scene.background.toArray()};};
  const inside=draw(15),outside=draw(100),back=draw(15);local.clear();const cleared=draw(15);lighting.dispose();return {inside,outside,back,cleared};
 });
 expect(result.inside.far).toBe(800);expect(result.inside.fog).toBe(800);expect(result.inside.ambient).toBeCloseTo(128/255);
 expect(result.outside.far).toBe(1300);expect(result.outside.ambient).toBeCloseTo(32/255);expect(result.back).toEqual(result.inside);expect(result.cleared.far).toBe(2000);
});
