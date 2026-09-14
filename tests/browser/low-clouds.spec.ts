import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
test('low-cloud GPU pass preserves raw tint, camera roll and foreground occlusion',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const tp='/node_modules/three/build/three.module.js',cp='/src/render/NativeLowClouds.ts';
  const T=await import(tp),{NativeLowClouds}=await import(cp),scene=new T.Scene(),camera=new T.PerspectiveCamera(70,1,.08,20);
  camera.lookAt(800,40,0);camera.updateMatrixWorld(true);
  const clouds=new NativeLowClouds(scene),texture=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1);texture.needsUpdate=true;
  const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(256,256);
  const source={color:[200,100,40],visibility:.5};
  const update=()=>{clouds.update(camera,source,texture,70);clouds.meshes.slice(1).forEach((m:any)=>m.visible=false);};
  const pixel=(x=128,y=128)=>{renderer.render(scene,camera);const p=new Uint8Array(4),gl=renderer.getContext();gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return Array.from(p);};
  update();const tint=pixel(),horizontal=pixel(180,128),vertical=pixel(128,180);camera.rotateZ(Math.PI/2);camera.updateMatrixWorld(true);update();const rolled=pixel(),rotatedHorizontal=pixel(180,128),rotatedVertical=pixel(128,180),rotation=clouds.meshes[0].material.uniforms.rotation.value.toArray();
  const wall=new T.Mesh(new T.PlaneGeometry(2,2),new T.MeshBasicMaterial({color:0x00ff00}));wall.position.set(5,.25,0);wall.quaternion.copy(camera.quaternion);scene.add(wall);const blocked=pixel();
  scene.remove(wall);clouds.update(camera,source,undefined,70);const absent=pixel();clouds.dispose();texture.dispose();wall.geometry.dispose();wall.material.dispose();renderer.dispose();
  return {tint,rolled,rotation,blocked,absent,horizontal,vertical,rotatedHorizontal,rotatedVertical};
 });
 expect(result.tint.slice(0,3)).toEqual([100,50,20]);expect(result.rolled).toEqual(result.tint);
 expect(result.horizontal).toEqual(result.tint);expect(result.vertical.slice(0,3)).toEqual([0,0,0]);
 expect(result.rotatedHorizontal.slice(0,3)).toEqual([0,0,0]);expect(result.rotatedVertical).toEqual(result.tint);
 expect(result.rotation[0]).toBeCloseTo(0,8);expect(result.rotation[1]).toBeCloseTo(-1,8);
 expect(result.blocked.slice(0,3)).toEqual([0,255,0]);expect(result.absent.slice(0,3)).toEqual([0,0,0]);expect(errors).toEqual([]);
});

test('public particle reference loads through the worker and renders its native cloud raster',async({page})=>{
 test.skip(!process.env.GTA_PARTICLE_REFERENCE,'Optional local particle dictionary');
 const encoded=readFileSync(process.env.GTA_PARTICLE_REFERENCE!).toString('base64');await page.goto('/models.html');
 const result=await page.evaluate(async(encoded)=>{
  const tp='/node_modules/three/build/three.module.js',lp='/src/render/WorldLighting.ts';
  const T=await import(tp),{WorldLighting}=await import(lp),scene=new T.Scene(),camera=new T.PerspectiveCamera(70,1.6,.08,120);
  camera.lookAt(800,40,0);camera.updateMatrixWorld(true);const lighting=new WorldLighting(scene,[],[]);
  const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));await lighting.sunTexture.load(new File([bytes],'particle.txd'));
  lighting.nativeTimecycle=()=>({skyColors:{top:[20,50,100],bottom:[60,90,140]},top:[0,0,0],horizon:[0,0,0],ambient:[0,0,0],sunCore:[0,0,0],sunCorona:[0,0,0],sunSize:0,lowClouds:{color:[180,180,180],visibility:1}});
  const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(640,400);
  const draw=()=>{lighting.update(720,{x:0,y:0,z:0},camera,0,0,70,false);renderer.render(scene,camera);};draw();
  const clouds=scene.children.filter((o:any)=>o.name.startsWith('Native low cloud ')),visible=clouds.filter((o:any)=>o.visible).length;
  const texture=lighting.sunTexture.cloudTexture,metadata={name:texture.name,width:texture.image.width,height:texture.image.height};
  const pixel=()=>{const p=new Uint8Array(4),gl=renderer.getContext();gl.readPixels(320,200,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return Array.from(p);};
  const withCloud=pixel();renderer.domElement.dataset.clouds='true';renderer.domElement.style.cssText='position:fixed;left:0;top:0;z-index:99999';document.body.append(renderer.domElement);
  (window as any).clearCloudProbe=()=>{lighting.sunTexture.clear();draw();const withoutCloud=pixel(),hidden=clouds.every((o:any)=>!o.visible);lighting.dispose();renderer.dispose();renderer.domElement.remove();return {withoutCloud,hidden};};
  return {visible,metadata,withCloud};
 },encoded);
 expect(result.metadata).toEqual({name:'cloud1',width:64,height:64});expect(result.visible).toBeGreaterThan(0);
 await page.locator('canvas[data-clouds]').screenshot({path:'artifacts/native-low-clouds.png'});
 const cleared=await page.evaluate(()=>(window as any).clearCloudProbe());expect(cleared.hidden).toBe(true);
 expect(result.withCloud[0]).toBeGreaterThan(cleared.withoutCloud[0]);
});
