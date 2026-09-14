import {test,expect} from '@playwright/test';
test('native shooting star renders a fading line beyond far clip and stays behind scenery',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const tp='/node_modules/three/build/three.module.js',sp='/src/render/NativeStreak.ts',lp='/src/render/WorldLighting.ts';
  const T=await import(tp),{NativeStreak}=await import(sp),{WorldLighting}=await import(lp);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(70,1,.08,20);camera.lookAt(-5,.1,5);camera.updateMatrixWorld(true);
  const streak=new NativeStreak(scene);streak.update(camera,0,400,true);
  const renderer=new T.WebGLRenderer();renderer.setSize(512,512);
  const pixels=()=>{renderer.render(scene,camera);const gl=renderer.getContext(),data=new Uint8Array(512*512*4);gl.readPixels(0,0,512,512,gl.RGBA,gl.UNSIGNED_BYTE,data);const values=[];for(let i=0;i<data.length;i+=4)if(data[i]>0)values.push(data[i]);return values;};
  const visible=pixels();
  const wall=new T.Mesh(new T.PlaneGeometry(2,2),new T.MeshBasicMaterial({color:0x00ff00}));wall.position.set(-5,.1,5).normalize().multiplyScalar(5);wall.quaternion.copy(camera.quaternion);scene.add(wall);const occluded=pixels();scene.remove(wall);
  streak.update(camera,0,800,true);const absent=pixels();streak.dispose();wall.geometry.dispose();wall.material.dispose();renderer.dispose();
  const lighting=new WorldLighting(scene,[],[]);let extraSunny=true;
  lighting.nativeTimecycle=()=>({extraSunny,top:[0,0,0],horizon:[0,0,0],ambient:[0,0,0],sunCore:[0,0,0],sunCorona:[0,0,0],sunSize:0});
  const draw=(seconds:number,advance=true)=>lighting.update(0,{x:0,y:0,z:0},camera,seconds,0,70,advance);
  draw(.4);const line=scene.getObjectByName('Native shooting star'),initial=Array.from(line.geometry.attributes.position.array),started=line.visible;
  draw(2,false);const paused=line.visible&&JSON.stringify(Array.from(line.geometry.attributes.position.array))===JSON.stringify(initial);
  extraSunny=false;draw(0,false);const weatherHidden=!line.visible;extraSunny=true;lighting.area=1;draw(0,false);const interiorHidden=!line.visible;
  lighting.area=0;draw(.4);const expired=!line.visible;draw(7.392);const repeated=line.visible;
  lighting.nativeTimecycle=undefined;draw(0,false);const fallbackHidden=!line.visible;lighting.dispose();
  return {visible,occluded,absent,started,paused,weatherHidden,interiorHidden,expired,repeated,fallbackHidden};
 });
 expect(result.visible.length).toBeGreaterThan(8);expect(new Set(result.visible).size).toBeGreaterThan(5);
 expect(Math.max(...result.visible)).toBeGreaterThan(150);expect(Math.min(...result.visible)).toBeLessThan(80);
 expect(result.occluded).toEqual([]);expect(result.absent).toEqual([]);
 for(const key of ['started','paused','weatherHidden','interiorHidden','expired','repeated','fallbackHidden'] as const)expect(result[key],key).toBe(true);
 expect(errors).toEqual([]);
});
