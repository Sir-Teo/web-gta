import {test,expect} from '@playwright/test';
test('overlapping flight windows reuse bounded geometry without changing decoded models',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const worker=new Worker('/src/assets/staticWorld.worker.ts',{type:'module'});
  const request=(message:any)=>new Promise<any>((resolve,reject)=>{worker.onmessage=({data})=>data.type==='error'?reject(new Error(data.message)):resolve(data);worker.onerror=e=>reject(new Error(e.message));worker.postMessage(message);});
  const hash=async(data:any)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data.parts.map((p:any)=>({name:p.name,model:p.model}))))))).join(',');
  try{
   await request({action:'initialize',base:new URL('/play/world/',location.href).href});const region={x:400,y:2500,radius:180,lodRadius:1000,includeCollisionBounds:true};
   let time=performance.now();const cold=await request({action:'region',id:1,region}),coldMs=performance.now()-time,coldHash=await hash(cold);
   time=performance.now();const warm=await request({action:'region',id:2,region}),warmMs=performance.now()-time,warmHash=await hash(warm);
   const shifted=await request({action:'region',id:3,region:{...region,x:475}});
   return {coldMs,warmMs,coldHash,warmHash,cold:cold.stats.geometry,warm:warm.stats.geometry,shifted:shifted.stats.geometry};
  }finally{worker.terminate();}
 });
 console.log(JSON.stringify({...result,coldHash:undefined,warmHash:undefined}));
 expect(result.warmHash).toBe(result.coldHash);expect(result.warm.decodes).toBe(result.cold.decodes);expect(result.warm.hits-result.cold.hits).toBe(result.cold.decodes);
 expect(result.shifted.hits).toBeGreaterThan(result.warm.hits);for(const stats of [result.cold,result.warm,result.shifted]){expect(stats.retainedBytes).toBeLessThanOrEqual(32*1024*1024);expect(stats.pending).toBe(0);}
});
