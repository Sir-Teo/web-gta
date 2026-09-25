import {test,expect} from '@playwright/test';

test('packaged Grove Street house is a day/night building: the world ambient lights it and the object ambient does not',async({page})=>{
 test.setTimeout(90000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const paths=['/tests/fixtures/native-render-dependencies.ts','/src/assets/scenePack.ts','/src/simulation/nativeScene.ts'];
  const [{THREE,RAPIER},{readScenePack},{installNativeScene}]=await Promise.all(paths.map(p=>import(p)));
  await RAPIER.init();const pack=await readScenePack('/play/world-start.scene.bin'),part=pack.parts.find((p:any)=>p.name==='carlshou1_lae2');
  const world=new RAPIER.World({x:0,y:0,z:0}),scene=new THREE.Scene(),owner=installNativeScene(world,scene,[part]);
  const renderer=new THREE.WebGLRenderer();renderer.setSize(128,128);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
  const failures:string[]=[];renderer.debug.onShaderError=()=>failures.push('shader compilation');
  const target=new THREE.WebGLRenderTarget(128,128),box=new THREE.Box3().setFromObject(owner.root),center=box.getCenter(new THREE.Vector3()),radius=box.getSize(new THREE.Vector3()).length();
  const camera=new THREE.PerspectiveCamera(45,1,.1,1000);camera.position.copy(center).add(new THREE.Vector3(radius*.5,radius*.4,radius));camera.lookAt(center);owner.updateView(camera);
  // Night colours and prelight make it a building (IsCBPCPipelineAttached), so it never gets m_bLightObject.
  const capture=(amount:number,object=.4)=>{
   owner.setTime(720,[amount,amount,amount],1,[object,object,object]);renderer.setRenderTarget(target);renderer.render(scene,camera);
   const data=new Uint8Array(128*128*4);renderer.readRenderTargetPixels(target,0,0,128,128,data);return data;
  };
  const dark=capture(0),bright=capture(.8),objectLit=capture(.8,.9);let changed=0,delta=0,objectChanges=0;
  for(let i=0;i<dark.length;i+=4){if(dark[i]!==bright[i])changed++;delta+=bright[i]-dark[i];if(bright[i]!==objectLit[i])objectChanges++;}
  const count=owner.colliderCount,handles=[...owner.sources.keys()];owner.setTime(720,[.2,.2,.2],1,[.4,.4,.4]);
  const physicalUnchanged=count===owner.colliderCount&&handles.every(h=>owner.sources.has(h));
  owner.dispose();world.free();target.dispose();renderer.dispose();return {changed,delta,objectChanges,physicalUnchanged,failures};
 });
 expect(result.changed).toBeGreaterThan(100);expect(result.delta).toBeGreaterThan(1000);expect(result.objectChanges).toBe(0);expect(result.physicalUnchanged).toBe(true);expect(result.failures).toEqual([]);
});
