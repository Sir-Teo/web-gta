import {test,expect} from '@playwright/test';
test('native sky renders planar color bands, caps, foreground occlusion and the shared sun fallback',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/models.html');
  const result=await page.evaluate(async()=>{
    const threePath='/node_modules/three/build/three.module.js',skyPath='/src/render/NativeSky.ts';
    const T=await import(threePath),{NativeSky}=await import(skyPath);
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(90,1,.08,20);
    const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(256,256);renderer.outputColorSpace=T.SRGBColorSpace;
    const uniforms={coreDirection:{value:new T.Vector3(0,.25,-1).normalize()},coronaDirection:{value:new T.Vector3()},
      sunCore:{value:new T.Color(1,1,1)},sunCorona:{value:new T.Color(0,0,0)},coreVisible:{value:0},coronaVisible:{value:0}};
    const sky=new NativeSky(scene,uniforms),source={top:[255,0,0],bottom:[0,0,255]},dry={foggyness:0,underwaterness:0};
    const sample=(x:number,y:number)=>{const p=new T.Vector3(x,y,-30).project(camera),pixel=new Uint8Array(4);
      renderer.getContext().readPixels(Math.floor((p.x+1)*128),Math.floor((p.y+1)*128),1,1,renderer.getContext().RGBA,renderer.getContext().UNSIGNED_BYTE,pixel);return Array.from(pixel);};
    sky.update(camera,source,720,dry);renderer.render(scene,camera);
    const bands=[sample(0,20),sample(0,7.5),sample(18,7.5),sample(0,-1.5),sample(0,-6),sample(0,-15)];
    uniforms.coreVisible.value=1;renderer.render(scene,camera);const sun=sample(0,7.5);uniforms.coreVisible.value=0;
    const foreground=new T.Mesh(new T.PlaneGeometry(2,2),new T.MeshBasicMaterial({color:0x00ff00}));foreground.position.z=-5;scene.add(foreground);
    renderer.render(scene,camera);const occluded=sample(0,0);scene.remove(foreground);
    camera.position.set(10,0,20);camera.rotation.y=Math.PI/2;camera.updateMatrixWorld(true);sky.update(camera,source,720,dry);
    renderer.render(scene,camera);const pixel=new Uint8Array(4),gl=renderer.getContext();gl.readPixels(128,160,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
    sky.dispose();foreground.geometry.dispose();foreground.material.dispose();renderer.dispose();
    return {bands,sun,occluded,yawed:Array.from(pixel)};
  });
  const expected=[[255,0,0],[128,0,128],[128,0,128],[0,0,255],[30,30,158],[60,60,60]];
  result.bands.forEach((pixel:number[],i:number)=>pixel.slice(0,3).forEach((v,c)=>expect(Math.abs(v-expected[i][c])).toBeLessThanOrEqual(3)));
  expect(result.sun.slice(0,3)).toEqual([255,255,255]);expect(result.occluded.slice(0,3)).toEqual([0,255,0]);
  result.yawed.slice(0,3).forEach((v:number,c:number)=>expect(Math.abs(v-result.bands[1][c])).toBeLessThanOrEqual(1));
  expect(errors).toEqual([]);
});

test('WorldLighting activates imported sky bands and restores its authored background',async({page})=>{
  await page.goto('/models.html');
  const result=await page.evaluate(async()=>{
    const threePath='/node_modules/three/build/three.module.js',lightingPath='/src/render/WorldLighting.ts';
    const T=await import(threePath),{WorldLighting}=await import(lightingPath);
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(90,1,.08,20),lighting=new WorldLighting(scene,[],[]);
    const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(256,256);renderer.outputColorSpace=T.SRGBColorSpace;
    const native=scene.getObjectByName('Native sky bands');
    const draw=()=>{lighting.update(720,{x:0,y:0,z:0},camera,0,0,90,false);renderer.render(scene,camera);
      const p=new Uint8Array(4),gl=renderer.getContext();gl.readPixels(128,160,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return Array.from(p);};
    const authored=draw();
    lighting.nativeTimecycle=()=>({skyColors:{top:[255,0,0],bottom:[0,0,255]},top:[1,0,0],horizon:[0,0,1],ambient:[0,0,0],sunCore:[0,0,0],sunCorona:[0,0,0],sunSize:0});
    const imported=draw(),visible=native.visible;
    lighting.nativeTimecycle=undefined;const restored=draw(),hidden=!native.visible;
    lighting.dispose();const removed=!scene.getObjectByName('Native sky bands');renderer.dispose();return {authored,imported,restored,visible,hidden,removed};
  });
  expect(result.imported[0]).toBeGreaterThan(125);expect(result.imported[0]).toBeLessThan(132);
  expect(result.imported[1]).toBe(0);expect(result.imported[2]).toBeGreaterThan(123);expect(result.imported[2]).toBeLessThan(130);
  expect(result.restored).toEqual(result.authored);expect(result.visible&&result.hidden&&result.removed).toBe(true);
});
