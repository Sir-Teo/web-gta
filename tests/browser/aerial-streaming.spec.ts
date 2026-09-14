import {test,expect} from '@playwright/test';
test('aerial windows add native distant scenery without extending playable collision',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const collisionPath='/src/assets/sceneCollision.ts';const {planSceneCollision}=await import(collisionPath);
  const [{installNativeScene},{THREE,RAPIER}]=await Promise.all(['/src/simulation/nativeScene.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));await RAPIER.init();
  const worker=new Worker('/src/assets/staticWorld.worker.ts',{type:'module'});
  const receive=()=>new Promise<any>((resolve,reject)=>{worker.onmessage=({data})=>data.type==='error'?reject(new Error(data.message)):resolve(data);worker.onerror=e=>reject(new Error(e.message));});
  const request=async(message:any)=>{const pending=receive();worker.postMessage(message);try{return await pending;}catch(error){throw new Error(JSON.stringify(message)+' '+String(error));}};
  try{
   await request({action:'initialize',base:new URL('/play/world/',location.href).href});const results=[];
   for(const [x,y] of [[400,2500],[2495,-1687],[-2020,-100],[2020,1500]]){
    const region={x,y,radius:180,includeCollisionBounds:true};
    const near=await request({action:'region',id:1,region});
    const far=await request({action:'region',id:2,region:{...region,lodRadius:1000}});
    const keys=(data:any)=>data.parts.flatMap((p:any)=>p.sourceRefs.map((r:any)=>`${r.sourceName.toLowerCase()}:${r.index}`));
    const collisions=(data:any)=>planSceneCollision(data.parts).indices.flatMap((indices:number[],i:number)=>indices.map(j=>{const r=data.parts[i].sourceRefs[j];return `${r.sourceName.toLowerCase()}:${r.index}`;})).sort();
    const nearKeys=new Set(keys(near)),farKeys=keys(far);
    const world=new RAPIER.World({x:0,y:-9.81,z:0}),scene=new THREE.Scene();
    try{const installed=installNativeScene(world,scene,far.parts);installed.dispose();if(scene.children.length)throw new Error("Distant scene leaked render objects");}finally{world.free();}
    results.push({x,y,near:nearKeys.size,far:farKeys.length,added:farKeys.filter((k:string)=>!nearKeys.has(k)).length,missing:[...nearKeys].filter(k=>!farKeys.includes(k)),sameCollision:JSON.stringify(collisions(near))===JSON.stringify(collisions(far)),stats:far.stats});
   }return results;
  }finally{worker.terminate();}
 });
 console.log(JSON.stringify(result));for(const region of result){expect(region.added).toBeGreaterThan(0);expect(region.missing).toEqual([]);expect(region.sameCollision).toBe(true);expect(region.stats.retainedBytes).toBeLessThanOrEqual(64*1024*1024);}
});
