import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('scorched native lighting keeps prelight and replaces normal lighting with 0.18 ambient in both pipelines',async({page})=>{
 await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const paths=['/tests/fixtures/native-render-dependencies.ts','/src/assets/nativeMaterial.ts','/src/assets/nativeScorched.ts','/src/assets/buildingMaterial.ts'],[{THREE},{nativeLitMaterial},{setNativeScorched},{buildingMaterial,buildingLightingState}]=await Promise.all(paths.map(p=>import(p))),renderer=new THREE.WebGLRenderer();renderer.setSize(64,64);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
  const failures:string[]=[];renderer.debug.onShaderError=()=>failures.push('shader compilation');const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=2;
  const target=new THREE.WebGLRenderTarget(64,64),geometry=new THREE.PlaneGeometry(2,2),colors=Array.from({length:4},()=>[.2,.2,.2]).flat();geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('nativeDay',new THREE.Float32BufferAttribute(Array.from({length:4},()=>[.2,.2,.2,1]).flat(),4));geometry.setAttribute('nativeNight',geometry.getAttribute('nativeDay'));
  const ambient=new THREE.AmbientLight(0xffffff,.8),sun=new THREE.DirectionalLight(0xffffff,1);sun.position.z=2;scene.add(ambient,sun);const mesh=new THREE.Mesh(geometry);scene.add(mesh);
  const capture=()=>{renderer.setRenderTarget(target);renderer.render(scene,camera);const pixels=new Uint8Array(4);renderer.readRenderTargetPixels(target,32,32,1,1,pixels);return pixels[0];},state=buildingLightingState();state.ambient.value.setScalar(.8);
  const source=new THREE.MeshBasicMaterial(),materials=[nativeLitMaterial({vertexColors:true},[1,0,1]),buildingMaterial(source,1,state,false,false)],rows=[];
  for(const material of materials){mesh.material=material;ambient.intensity=.8;sun.intensity=1;const normal=capture();setNativeScorched(material,true);const scorched=capture();ambient.intensity=5;sun.intensity=5;const brightScorched=capture();setNativeScorched(material,false);ambient.intensity=.8;sun.intensity=1;const restored=capture();rows.push({normal,scorched,brightScorched,restored});}
  materials.forEach(m=>m.dispose());source.dispose();geometry.dispose();target.dispose();renderer.dispose();return {rows,failures};
 });
 for(const row of result.rows){expect(row.normal).toBe(255);expect(row.scorched).toBeCloseTo(97,0);expect(row.brightScorched).toBe(row.scorched);expect(row.restored).toBe(row.normal);}expect(result.failures).toEqual([]);
});

test('both original QUARRY array instructions change a live object’s materials and restore normal lighting',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const handle=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;return m.runtime.game.objects.create('dyn_wine_big',{x:p.x+6,y:-p.z,z:p.y+1},{external:false,missionCleanup:false}).handle;});
 await page.waitForFunction(h=>!!(window as any).__game.scriptObjectViews().groupFor(h),handle,{timeout:60000});
 const result=await page.evaluate(async handle=>{
  const path='/src/assets/scm.ts',{readScmHeader,decodeScmInstructions}=await import(/* @vite-ignore */ path),g=(window as any).__game,m=g.missionForProfiling(),views=g.scriptObjectViews(),bytes=new Uint8Array(await(await fetch('/play/world/files/scripts/main.scm')).arrayBuffer()),block=readScmHeader(bytes).missions[118],sites=decodeScmInstructions(bytes,block.start,block.end).filter((i:any)=>i.opcode===0x654),materials=new Set<any>();views.groupFor(handle).traverse((o:any)=>{if(o.isMesh)for(const material of [o.material].flat())materials.add(material);});
  const rows=sites.map((site:any,n:number)=>{const code=new Uint8Array(site.end-site.offset+2);code.set(bytes.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;slot.thread.locals.setInt32((n?48:50)*4,0,true);slot.thread.locals.setInt32((n?111:114)*4,handle,true);slot.thread.run(g.gameTimeMs(),100,1);views.update(m.scriptObjects(),0);const enabled=objectsFlag()&&[...materials].every(mat=>mat.userData.nativeRenderScorched.value===true);m.runtime.world.setObjectRenderScorched(handle,false);views.update(m.scriptObjects(),0);return {enabled,restored:!objectsFlag()&&[...materials].every(mat=>mat.userData.nativeRenderScorched.value===false)};});
  function objectsFlag(){return !!m.runtime.game.objects.at(handle).renderScorched;}
  return {rows,materials:materials.size,skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};
 },handle);
 expect(result.materials).toBeGreaterThan(0);expect(result.rows).toEqual([{enabled:true,restored:true},{enabled:true,restored:true}]);expect(result.skipped).toEqual([]);expect(result.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
