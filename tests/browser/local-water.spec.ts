import {test,expect} from '@playwright/test';
test('water GPU pass preserves transparency, occlusion and visibility filtering',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const tp='/node_modules/three/build/three.module.js',wp='/src/render/LocalWater.ts';const T=await import(tp),{LocalWater}=await import(wp);
  const scene=new T.Scene(),owner=new LocalWater(scene),camera=new T.PerspectiveCamera(60,1,.1,20);camera.position.set(1,5,-1);camera.lookAt(1,0,-1);
  const quad=(z:number,flag:number)=>`0 0 ${z} 0 0 0 0 2 0 ${z} 0 0 0 0 0 2 ${z} 0 0 0 0 2 2 ${z} 0 0 0 0 ${flag}`;
  owner.load([quad(0,1),quad(1,0),quad(1000,3)].join('\n'),'test.dat');owner.update(0,{color:[1,1,1],opacity:.5});
  const renderer=new T.WebGLRenderer();renderer.setSize(128,128);
  const pixel=()=>{renderer.render(scene,camera);const gl=renderer.getContext(),p=new Uint8Array(4);gl.readPixels(64,64,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return Array.from(p).slice(0,3);};
  const water=pixel();const wall=new T.Mesh(new T.PlaneGeometry(2,2),new T.MeshBasicMaterial({color:0x00ff00,side:T.DoubleSide}));wall.rotation.x=-Math.PI/2;wall.position.set(1,.5,-1);scene.add(wall);const blocked=pixel();scene.remove(wall);
  owner.update(0,undefined);const noTimecycle=pixel();owner.update(1,{color:[1,1,1],opacity:.5});const interiorAbsentAtExteriorCamera=pixel();
  owner.clear();const cleared=pixel();owner.dispose();wall.geometry.dispose();wall.material.dispose();renderer.dispose();return {water,blocked,noTimecycle,interiorAbsentAtExteriorCamera,cleared};
 });
 expect(result.water[0]).toBeGreaterThanOrEqual(127);expect(result.water[0]).toBeLessThanOrEqual(128);expect(result.water[1]).toBe(result.water[0]);
 expect(result.blocked).toEqual([0,255,0]);for(const key of ['noTimecycle','interiorAbsentAtExteriorCamera','cleared'] as const)expect(result[key]).toEqual([0,0,0]);expect(errors).toEqual([]);
});
test('local water controls load public surfaces, retain valid content after errors and clear',async({page})=>{
 const root=process.env.GTA_CONTENT_DIR;test.skip(!root,'Set GTA_CONTENT_DIR for the public water input.');await page.goto('/');
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game)).toBe(true);
 await page.locator('#water-file').setInputFiles(`${root}/water.dat`);await expect(page.locator('#water-status')).toContainText('304 exterior and 1 interior water polygons');
 await page.locator('#water-file').setInputFiles({name:'broken.dat',mimeType:'text/plain',buffer:Buffer.from('broken')});await expect(page.locator('#water-status')).toContainText('Current water retained.');
 await page.getByRole('button',{name:'Lighting',exact:true}).click();await page.locator('summary').filter({hasText:'Water surfaces'}).click();
 await page.getByRole('button',{name:'Clear water surfaces',exact:true}).click();await expect(page.locator('#water-status')).toHaveText('Imported water cleared.');
});

test('public water raster passes through the particle worker and textures the surfaces',async({page})=>{
 test.skip(!process.env.GTA_PARTICLE_REFERENCE,'Set GTA_PARTICLE_REFERENCE for native water raster.');
 const {readFileSync}=await import('node:fs'),encoded=readFileSync(process.env.GTA_PARTICLE_REFERENCE!).toString('base64');await page.goto('/models.html');
 const result=await page.evaluate(async(encoded)=>{
  const tp='/node_modules/three/build/three.module.js',wp='/src/render/LocalWater.ts',pp='/src/render/LocalSunTexture.ts';
  const T=await import(tp),{LocalWater}=await import(wp),{LocalSunTexture}=await import(pp),particle=new LocalSunTexture();
  await particle.load(new File([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],'particle.txd'));
  const texture=particle.waterTexture,metadata={name:texture.name,width:texture.image.width,height:texture.image.height};
  const scene=new T.Scene(),water=new LocalWater(scene);water.load('0 0 0 0 0 0 0 50 0 0 0 0 0 0 0 50 0 0 0 0 0 50 50 0 0 0 0 0 1','water.dat');
  const camera=new T.PerspectiveCamera(45,1,.1,200);camera.position.set(25,40,-25);camera.lookAt(25,0,-25);
  const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(256,256);const source={color:[1,1,1],opacity:1};water.update(0,source,texture);renderer.render(scene,camera);
  const gl=renderer.getContext(),pixels=new Uint8Array(256*256*4);gl.readPixels(0,0,256,256,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  const red=[];for(let y=64;y<192;y++)for(let x=64;x<192;x++)red.push(pixels[(y*256+x)*4]);
  const uv=Array.from(scene.children[0].geometry.attributes.uv.array);
  renderer.domElement.style.cssText='position:fixed;left:0;top:0;z-index:99999';renderer.domElement.dataset.waterProbe='true';document.body.append(renderer.domElement);
  (window as any).clearWaterTextureProbe=()=>{particle.clear();water.update(0,source,particle.waterTexture);renderer.render(scene,camera);const pixel=new Uint8Array(4);gl.readPixels(128,128,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);water.dispose();particle.dispose();renderer.dispose();renderer.domElement.remove();return Array.from(pixel);};
  return {metadata,uv,variation:new Set(red).size};
 },encoded);
 expect(result.metadata).toEqual({name:'waterclear256',width:128,height:128});expect(result.uv).toEqual([0,0,2,0,0,2,2,2]);expect(result.variation).toBeGreaterThan(10);
 await page.locator('canvas[data-water-probe]').screenshot({path:'artifacts/native-water-texture.png'});
 expect((await page.evaluate(()=>(window as any).clearWaterTextureProbe())).slice(0,3)).toEqual([255,255,255]);
});
