import {test,expect} from '@playwright/test';
test('native stars render through short far clips, freeze twinkle, borrow rasters and hide behind scenery',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/models.html');
  const result=await page.evaluate(async()=>{
    const tp='/node_modules/three/build/three.module.js',sp='/src/render/NativeStars.ts';
    const T=await import(tp),{NativeStars}=await import(sp);
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(70,1,.08,20);camera.lookAt(100,10,0);camera.updateMatrixWorld(true);
    const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(256,256);
    const stars=new NativeStars(scene),texture=new T.DataTexture(new Uint8Array([255,0,0,255]),1,1);texture.needsUpdate=true;
    let disposed=0;texture.addEventListener('dispose',()=>disposed++);
    const pixel=()=>{renderer.render(scene,camera);const p=new Uint8Array(4),gl=renderer.getContext();gl.readPixels(128,128,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return Array.from(p);};
    stars.update(camera,0,true,texture,70,false);const red=pixel(),east=stars.meshes.filter((m:any)=>m.visible).length;
    stars.update(camera,0,true,texture,70,true);const strengths=stars.meshes.map((m:any)=>m.material.uniforms.strength.value);
    stars.update(camera,0,true,texture,70,false);const paused=stars.meshes.map((m:any)=>m.material.uniforms.strength.value);
    const wall=new T.Mesh(new T.PlaneGeometry(2,2),new T.MeshBasicMaterial({color:0x00ff00}));
    wall.position.set(5,.5,0);wall.quaternion.copy(camera.quaternion);scene.add(wall);const blocked=pixel();scene.remove(wall);
    stars.update(camera,0,true,undefined,70,false);const fallback=pixel();
    camera.lookAt(-100,10,0);camera.updateMatrixWorld(true);stars.update(camera,0,true,texture,70,false);const west=stars.meshes.filter((m:any)=>m.visible).length;
    stars.update(camera,720,true,texture,70,false);const day=stars.meshes.some((m:any)=>m.visible);
    stars.update(camera,0,false,texture,70,false);const disabled=stars.meshes.some((m:any)=>m.visible);
    stars.dispose();const borrowed=disposed===0,removed=stars.meshes.every((m:any)=>!m.parent);texture.dispose();wall.geometry.dispose();wall.material.dispose();renderer.dispose();
    return {red,east,west,strengths,paused,blocked,fallback,day,disabled,borrowed,removed};
  });
  expect(result.red.slice(0,3)).toEqual([255,0,0]);expect(result.east).toBe(10);expect(result.west).toBe(2);
  expect(result.paused).toEqual(result.strengths);expect(result.blocked.slice(0,3)).toEqual([0,255,0]);
  expect(result.fallback[0]).toBeGreaterThan(0);expect(result.fallback[0]).toBe(result.fallback[1]);expect(result.fallback[1]).toBe(result.fallback[2]);
  expect(result.day||result.disabled).toBe(false);expect(result.borrowed&&result.removed).toBe(true);expect(errors).toEqual([]);
});

test('WorldLighting uses only native stars and suppresses them in interiors',async({page})=>{
  await page.goto('/models.html');
  const result=await page.evaluate(async()=>{
    const tp='/node_modules/three/build/three.module.js',lp='/src/render/WorldLighting.ts';
    const T=await import(tp),{WorldLighting}=await import(lp),scene=new T.Scene(),camera=new T.PerspectiveCamera(70,1.6,.08,650);
    camera.lookAt(100,45,45);camera.updateMatrixWorld(true);
    const lighting=new WorldLighting(scene),renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(640,400);
    const nativeSource=()=>({skyColors:{top:[0,0,8],bottom:[8,8,16]},top:[0,0,.002],horizon:[.002,.002,.005],ambient:[0,0,0],sunCore:[0,0,0],sunCorona:[0,0,0],sunSize:0});
    const points=scene.children.find((o:any)=>o.isPoints),native=scene.children.filter((o:any)=>o.name.startsWith('Native star '));
    const update=()=>lighting.update(0,{x:0,y:0,z:0},camera,0,0,70,false);
    lighting.nativeTimecycle=nativeSource;update();const imported={authored:!!points?.visible,native:native.filter((o:any)=>o.visible).length};
    lighting.area=1;update();const interior=native.some((o:any)=>o.visible);
    lighting.area=0;lighting.nativeTimecycle=undefined;update();const restored={authored:!!points?.visible,native:native.some((o:any)=>o.visible)};
    lighting.nativeTimecycle=nativeSource;update();renderer.render(scene,camera);
    renderer.domElement.dataset.nativeStars='true';renderer.domElement.style.cssText='position:fixed;left:0;top:0;z-index:99999';document.body.append(renderer.domElement);
    (window as any).cleanupStars=()=>{lighting.dispose();renderer.dispose();renderer.domElement.remove();};return {imported,interior,restored};
  });
  expect(result.imported.authored).toBe(false);expect(result.imported.native).toBeGreaterThan(0);expect(result.interior).toBe(false);
  expect(result.restored).toEqual({authored:false,native:false});
  await page.locator('canvas[data-native-stars]').screenshot({path:'artifacts/native-night-sky.png'});
  await page.evaluate(()=>(window as any).cleanupStars());
});
