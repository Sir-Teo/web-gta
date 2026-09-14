import {test,expect} from '@playwright/test';
test('sun raster stays centered for a transformed camera parent and a short camera range',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
  const result=await page.evaluate(async()=>{
    const tp='/node_modules/three/build/three.module.js',cp='/src/render/SunCoronas.ts',sp='/src/render/TexturedSun.ts',vp='/src/world/sun.ts';
    const T=await import(tp),{SunCoronas}=await import(cp),{TexturedSun}=await import(sp),{sampleSun}=await import(vp);
    const scene=new T.Scene(),parent=new T.Group(),camera=new T.PerspectiveCamera(55,1,.08,120);
    parent.position.set(1000,300,-400);parent.rotation.y=.9;camera.position.set(10,20,30);parent.add(camera);scene.add(parent);scene.updateMatrixWorld(true);
    const world=camera.getWorldPosition(new T.Vector3());camera.lookAt(world.clone().add(sampleSun(720).direction));camera.updateMatrixWorld(true);
    const state=new SunCoronas(),sun=new TexturedSun(scene),texture=new T.DataTexture(new Uint8Array([255,0,0,255]),1,1);texture.needsUpdate=true;
    for(let i=0;i<20;i++)state.update(720,camera,[1,1,1],[1,1,1],.02,0,undefined,2);
    sun.update(camera,texture,state.core,undefined,70);
    const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(256,256);renderer.render(scene,camera);
    const pixel=new Uint8Array(4),gl=renderer.getContext();gl.readPixels(128,128,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
    const distance=state.core.position.distanceTo(world),onScreen=!state.core.offScreen;
    sun.dispose();texture.dispose();renderer.dispose();return {pixel:Array.from(pixel),distance,onScreen};
  });
  expect(result.pixel.slice(0,3)).toEqual([255,0,0]);expect(result.distance).toBeCloseTo(114,8);expect(result.onScreen).toBe(true);expect(errors).toEqual([]);
});
