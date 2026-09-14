import {test,expect} from '@playwright/test';
test('packaged shrub responds to native ambient but not invented directional normals',async({page})=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const paths=['/tests/fixtures/native-render-dependencies.ts','/src/assets/scenePack.ts','/src/render/NativeProcObjects.ts'];
  const [{THREE,RAPIER},{readScenePack},{NativeProcObjects}]=await Promise.all(paths.map(p=>import(p)));
  await RAPIER.init();const pack=await readScenePack('/play/verdant.scene.bin');
  const asset=pack.proceduralAssets.find((a:any)=>a.name==='sm_bush_large_1');
  const world=new RAPIER.World({x:0,y:0,z:0}),adapter=new NativeProcObjects(world,[asset]);
  const renderer=new THREE.WebGLRenderer();renderer.setSize(128,128);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
  const target=new THREE.WebGLRenderTarget(128,128),scene=new THREE.Scene();scene.add(adapter.root);
  const entity=adapter.allocate({name:asset.name,id:asset.definition.id,minimumZ:asset.collision.bounds.min[2],kind:asset.entityKind},0);
  const matrix=new Float32Array(new THREE.Matrix4().elements);
  adapter.install(entity,{entityMatrix:matrix,renderMatrix:matrix},{candidate:{surface:0,lighting:0}},0);
  const box=new THREE.Box3().setFromObject(adapter.root),center=box.getCenter(new THREE.Vector3()),radius=box.getSize(new THREE.Vector3()).length();
  const camera=new THREE.PerspectiveCamera(45,1,.01,100);camera.position.copy(center).add(new THREE.Vector3(0,radius*.3,radius*1.5));camera.lookAt(center);
  const sun=new THREE.DirectionalLight(0xffffff,0);sun.position.set(2,5,4);scene.add(sun);
  const capture=(ambient:number,intensity:number)=>{
   adapter.setEntityLighting([.2,.2,.2],[ambient,ambient,ambient],1);sun.intensity=intensity;
   renderer.setRenderTarget(target);renderer.render(scene,camera);const pixels=new Uint8Array(128*128*4);renderer.readRenderTargetPixels(target,0,0,128,128,pixels);return pixels;
  };
  const dark=capture(0,0),bright=capture(.8,0),sunny=capture(.8,20);
  let changed=0,directionalChanges=0,delta=0;
  for(let i=0;i<dark.length;i+=4){if(dark[i]!==bright[i])changed++;if(bright[i]!==sunny[i])directionalChanges++;delta+=bright[i]-dark[i];}
  const materials:string[]=[];adapter.root.traverse((n:any)=>{if(n.isMesh)for(const m of Array.isArray(n.material)?n.material:[n.material])materials.push(m.type);});
  adapter.dispose();world.free();target.dispose();renderer.dispose();return {changed,directionalChanges,delta,materials};
 });
 expect(result.changed).toBeGreaterThan(100);expect(result.delta).toBeGreaterThan(1000);expect(result.directionalChanges).toBe(0);
 expect(result.materials.every(m=>m==='MeshLambertMaterial')).toBe(true);expect(errors).toEqual([]);
});
