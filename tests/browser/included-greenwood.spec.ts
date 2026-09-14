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
 expect(result.model).toBe('greenwoo');expect(result.textures).toBe(12);expect(result.colliders).toBe(20);expect(result.paint[0]).toEqual([66,31,33]);expect(result.geometries).toBeGreaterThan(0);
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
