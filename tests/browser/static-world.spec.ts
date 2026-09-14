import {test,expect} from '@playwright/test';
test('complete static world resolves distant regions through one archive source',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const path='/src/assets/staticWorld.worker.ts',worker=new Worker(path,{type:'module'});
  const receive=()=>new Promise<any>((resolve,reject)=>{worker.onmessage=({data})=>data.type==='error'?reject(new Error(data.message)):resolve(data);worker.onerror=event=>reject(new Error(event.message));});
  try{
   let pending=receive();worker.postMessage({action:'initialize',base:new URL('/play/world/',location.href).href});const ready=await pending;if(ready.carGenerators.length!==1043)throw new Error('Incomplete vehicle generator index');
   const regions=[{x:2570,y:-1687,radius:180,includeCollisionBounds:true},{x:400,y:2500,radius:180,includeCollisionBounds:true},{x:-2020,y:-100,radius:160,includeCollisionBounds:true}];
   const results=[];
   for(const [i,region] of regions.entries()){
    pending=receive();worker.postMessage({action:'region',id:i+1,region});const data=await pending;
    results.push({generators:data.carGenerators.length,districts:data.sourceDistricts,models:data.parts.length,placements:data.parts.reduce((n:number,p:any)=>n+p.placements.length,0),identity:data.datasetIdentity,stats:data.stats});
   }
   return results;
  }finally{worker.terminate();}
 });
 expect(new Set(result.map(r=>r.identity)).size).toBe(1);expect(result.map(r=>r.generators)).toEqual([2,4,0]);
 for(const region of result){expect(region.models).toBeGreaterThan(10);expect(region.placements).toBeGreaterThan(30);expect(region.stats.retainedBytes).toBeLessThanOrEqual(64*1024*1024);expect(region.stats.pending).toBe(0);}
 expect(result[0].districts.some((d:string)=>d.startsWith('la/'))).toBe(true);expect(result[1].districts.some((d:string)=>d.startsWith('country/'))).toBe(true);expect(result[2].districts.some((d:string)=>d.startsWith('sf/'))).toBe(true);
 console.log(JSON.stringify(result));
});

test('complete world source audits every vehicle and reports unresolved source data',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const paths=['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts'];
  const [{openStaticWorld},{openStaticWorldVehicles}]=await Promise.all(paths.map(p=>import(p)));
  const source=await openStaticWorld(new URL('/play/world/',location.href).href),catalog=await openStaticWorldVehicles(source),results=[];
  const failures=[];
  for(const id of catalog.definitions.map((v:any)=>v.id)){
   try{const asset=await catalog.load(id);results.push({id,type:asset.vehicle.type,name:asset.vehicle.model,textures:asset.textures.length,missing:asset.missingTextures,collision:!!asset.collision,handling:asset.handling.name,supplements:asset.supplements.length,flyingHandling:asset.flyingHandling});}catch(error){failures.push({id,name:catalog.definitions.find((v:any)=>v.id===id).model,error:(error as Error).message});}
  }
  return {carGroups:catalog.carGroups.map((g:any)=>({index:g.index,models:g.models,unresolved:g.unresolved,ignored:g.ignored})),failures,count:catalog.definitions.length,available:catalog.definitions.every((v:any)=>source.entries.some((e:any)=>e.name===v.model+'.dff')&&source.entries.some((e:any)=>e.name===v.dictionary+'.txd')),results};
 });
 expect(result.carGroups).toHaveLength(34);expect(result.carGroups.flatMap((g:{unresolved:string[]})=>g.unresolved)).toEqual([]);expect(result.carGroups[19].models).toEqual([492,567,412]);
 expect(result.failures.map(f=>({id:f.id,name:f.name}))).toEqual([{id:457,name:'caddy'},{id:518,name:'buccanee'},{id:584,name:'petrotr'},{id:594,name:'rccam'}]);
 expect(result.failures.slice(0,3).every(f=>f.error==='Non-finite model coordinate.')).toBe(true);expect(result.failures[3].error).toContain('Unsupported collision format:');
 expect(result.results).toHaveLength(208);expect(result.count).toBe(212);expect(result.available).toBe(true);
 for(const asset of result.results){expect(asset.textures).toBeGreaterThan(0);expect(asset.missing).toEqual([]);expect(asset.collision).toBe(true);}
 const aircraft=result.results.filter(a=>a.type==='plane'||a.type==='heli');expect(aircraft).toHaveLength(24);
 for(const aircraftAsset of aircraft){expect(aircraftAsset.flyingHandling?.name).toBe(aircraftAsset.handling);expect(aircraftAsset.flyingHandling?.handlingId).toBeGreaterThanOrEqual(186);expect(Object.keys(aircraftAsset.flyingHandling!.values)).toHaveLength(21);}
 console.log(JSON.stringify({decoded:result.results.length,unresolved:result.failures}));
});

test('a changed world chunk is rejected before native decoding',async({page})=>{
 await page.route('**/play/world/chunks/*.bin',async route=>{const response=await route.fetch(),bytes=await response.body();bytes[0]^=1;await route.fulfill({response,body:bytes});});
 await page.goto('/models.html');
 const message=await page.evaluate(async()=>{
  const paths=['/src/assets/staticWorldArchive.ts','/src/assets/img.ts'];const [{openStaticWorld},{readImgEntry}]=await Promise.all(paths.map(p=>import(p)));
  const source=await openStaticWorld(new URL('/play/world/',location.href).href);
  try{await readImgEntry(source.file,source.entries.find((e:any)=>e.name==='greenwoo.dff'));return 'unexpected success';}catch(error){return (error as Error).message;}
 });
 expect(message).toContain('World content checksum mismatch:');
});

test('temporary hosting errors retry the same world chunk before decoding',async({page})=>{
 let attempts=0;
 await page.route('**/play/world/chunks/*.bin',async route=>{attempts++;if(attempts===1)await route.fulfill({status:503,body:'Temporary hosting error'});else await route.continue();});
 await page.goto('/models.html');
 const size=await page.evaluate(async()=>{
  const paths=['/src/assets/staticWorldArchive.ts','/src/assets/img.ts'];const [{openStaticWorld},{readImgEntry}]=await Promise.all(paths.map(p=>import(p)));
  const source=await openStaticWorld(new URL('/play/world/',location.href).href);return (await readImgEntry(source.file,source.entries.find((e:any)=>e.name==='greenwoo.dff'))).length;
 });
 expect(size).toBe(251904);expect(attempts).toBe(2);
});
