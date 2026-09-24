import {test,expect} from '@playwright/test';
test('shipped Greenwood loads all native resources and installs without a content depot',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const paths=['/tests/fixtures/native-render-dependencies.ts','/src/assets/includedGreenwood.ts','/src/simulation/installNativeCar.ts'];
  const [{THREE,RAPIER},{loadIncludedGreenwood},{installNativeCar}]=await Promise.all(paths.map(path=>import(path)));
  await RAPIER.init();const assets=await loadIncludedGreenwood('/play/vehicles/greenwood/');
  const world=new RAPIER.World({x:0,y:-9.81,z:0}),scene=new THREE.Scene();
  const car=installNativeCar(world,scene,assets,{position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0,w:1}},{friction:.4,restitution:0});
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(900,600);renderer.setClearColor(0x25303b);
  renderer.domElement.id='included-greenwood';renderer.domElement.style.cssText='position:fixed;inset:0;z-index:99999';document.body.append(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(40,1.5,.1,300);camera.position.set(7,4,8);camera.lookAt(0,0,0);
  scene.add(new THREE.AmbientLight(0xffffff,1));car.setViewDistance(camera.position.lengthSq(),1);renderer.render(scene,camera);
  const result={model:assets.vehicle.model,textures:assets.textures.length,colliders:world.colliders.len(),paint:assets.colors,geometries:renderer.info.memory.geometries};
  (window as any).__disposeIncludedGreenwood=()=>{car.dispose();renderer.render(scene,camera);const remaining={colliders:world.colliders.len(),geometries:renderer.info.memory.geometries};world.free();renderer.dispose();return remaining;};
  return result;
 });
 expect(result.model).toBe('greenwoo');expect(result.textures).toBe(15);/* the model's twelve, its two env textures (xvehicleenv128, vehicleenvmap128) and vehicle.txd's vehiclelightson128 */expect(result.colliders).toBe(20);expect(result.paint[0]).toEqual([66,31,33]);expect(result.geometries).toBeGreaterThan(0);
 await page.locator('#included-greenwood').screenshot({path:'artifacts/included-greenwood.png'});
 expect(await page.evaluate(()=>(window as any).__disposeIncludedGreenwood())).toEqual({colliders:0,geometries:0});expect(errors).toEqual([]);
});
test('shipped Greenwood rejects changed asset bytes before creating scene resources',async({page})=>{
 await page.route('**/play/vehicles/greenwood/greenwoo.dff',async route=>{
  const response=await route.fetch(),bytes=await response.body();bytes[0]^=1;await route.fulfill({response,body:bytes});
 });
 await page.goto('/models.html');
 const message=await page.evaluate(async()=>{
  const path='/src/assets/includedGreenwood.ts';const {loadIncludedGreenwood}=await import(path);
  try{await loadIncludedGreenwood('/play/vehicles/greenwood/');return 'unexpected success';}catch(error){return (error as Error).message;}
 });
 expect(message).toContain('Changed Greenwood resource: greenwoo.dff');
});

test('native Greenwood uses instance-owned vehicle ambient instead of scene ambient',async({page})=>{
 await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const paths=['/tests/fixtures/native-render-dependencies.ts','/src/assets/includedGreenwood.ts','/src/simulation/installNativeCar.ts'];
  const [{THREE:T,RAPIER:R},{loadIncludedGreenwood},{installNativeCar}]=await Promise.all(paths.map(p=>import(p)));
  await R.init();const assets=await loadIncludedGreenwood('/play/vehicles/greenwood/'),world=new R.World({x:0,y:0,z:0}),scene=new T.Scene();
  const car=installNativeCar(world,scene,assets,{position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0,w:1}},{friction:.4,restitution:0});
  const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(128,128);renderer.outputColorSpace=T.SRGBColorSpace;renderer.setClearColor(0,1);
  const camera=new T.PerspectiveCamera(40,1,.1,100);camera.position.set(7,4,8);camera.lookAt(0,0,0);
  scene.add(new T.AmbientLight(0x00ffff,1));
  const capture=()=>{renderer.render(scene,camera);const gl=renderer.getContext(),pixels=new Uint8Array(128*128*4);gl.readPixels(0,0,128,128,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;};
  car.setAmbient([0,0,0],1,0);const dark=capture();car.setAmbient([1,0,0],1,0);const red=capture();
  let redDelta=0,otherDelta=0;for(let i=0;i<red.length;i+=4){redDelta+=red[i]-dark[i];otherDelta+=Math.abs(red[i+1]-dark[i+1])+Math.abs(red[i+2]-dark[i+2]);}
  let rejected=false;try{car.setAmbient([NaN,1,1]);}catch{rejected=true;}const unchanged=capture().every((value:number,i:number)=>value===red[i]);
  car.dispose();world.free();renderer.dispose();return {redDelta,otherDelta,rejected,unchanged};
 });
 expect(result.redDelta).toBeGreaterThan(1000);expect(result.otherDelta).toBe(0);expect(result.rejected).toBe(true);expect(result.unchanged).toBe(true);
});
