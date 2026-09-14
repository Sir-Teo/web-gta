import {test,expect} from '@playwright/test';
import {openAsBlob} from 'node:fs';
import {join} from 'node:path';
import {readImgIndex,readImgEntry} from '../../src/assets/img';
test('native Greenwood wheel clones render and release shared GPU geometry',async({page})=>{
 test.skip(!process.env.GTA_CONTENT_DIR,'Requires native public content depot.');
 const file=await openAsBlob(join(process.env.GTA_CONTENT_DIR!,'gta3.img'));
 const entry=(await readImgIndex(file)).find(e=>e.name==='greenwoo.dff')!;
 const bytes=await readImgEntry(file,entry);
 await page.route('**/test-greenwood.dff',route=>route.fulfill({body:Buffer.from(bytes),contentType:'application/octet-stream'}));
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const paths=['/tests/fixtures/native-render-dependencies.ts','/src/assets/dff.ts','/src/assets/prepareCarModel.ts','/src/assets/ModelObjects.ts','/src/assets/carWheelFrames.ts'];
  const [{THREE},{readDff},{prepareCarModel},{modelObject},{resolveCarWheelFrames}]=await Promise.all(paths.map(p=>import(p)));
  const raw=readDff(new Uint8Array(await(await fetch('/test-greenwood.dff')).arrayBuffer())),prepared=prepareCarModel(raw);
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(900,600);renderer.setClearColor(0x25303b);
  renderer.domElement.id='car-diagnostic';renderer.domElement.style.cssText='position:fixed;inset:0;z-index:99999';document.body.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1.5,.1,100);camera.position.set(7,4,8);camera.lookAt(0,0,0);
  const visual=modelObject(prepared);scene.add(visual.root);
  // Close-range inspection isolates the high-detail model; runtime distance
  // callback selection is a separate unfinished step.
  visual.root.getObjectByName('chassis_vlo').visible=false;
  renderer.render(scene,camera);
  const wheelFrames=resolveCarWheelFrames(prepared),meshes=Object.values(wheelFrames).map(index=>visual.root.getObjectByName(prepared.frames[index as number].name).children.find((c:any)=>c.isMesh));
  const capture=()=>renderer.domElement.toDataURL();const withWheels=capture();
  meshes.forEach((m:any)=>m.visible=false);renderer.render(scene,camera);const withoutWheels=capture();
  meshes.forEach((m:any)=>m.visible=true);renderer.render(scene,camera);
  const shared=meshes.every((m:any)=>m.geometry===meshes[0].geometry),positions=meshes.map((m:any)=>m.getWorldPosition(new THREE.Vector3()).toArray());
  const before=renderer.info.memory.geometries;
  (window as any).__disposeCarDiagnostic=()=>{visual.dispose();renderer.render(scene,camera);const after=renderer.info.memory.geometries;renderer.dispose();return after;};
  return {shared,positions,changed:withWheels!==withoutWheels,before};
 });
 expect(result.shared).toBe(true);expect(result.changed).toBe(true);expect(new Set(result.positions.map(p=>JSON.stringify(p))).size).toBe(4);expect(result.before).toBeGreaterThan(0);
 await page.locator('#car-diagnostic').screenshot({path:'artifacts/native-greenwood-prepared.png'});
 expect(await page.evaluate(()=>(window as any).__disposeCarDiagnostic())).toBe(0);expect(errors).toEqual([]);
});
