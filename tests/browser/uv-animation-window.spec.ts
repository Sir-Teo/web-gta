import {test,expect} from '@playwright/test';
/** UV-animated models stream and animate: the worker decodes the Mulholland window (lawns with RpUVAnim dictionaries,
 * which the reader rejected until September 19), the scene installs animators for their materials, and one fixed step
 * moves a material's texture matrix as CEntity::PreRender's MaterialUpdateUVAnimCB would. */
test('a streamed window with RpUVAnim materials animates their texture coordinates',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{installNativeScene},{THREE,RAPIER}]=await Promise.all(['/src/simulation/nativeScene.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));await RAPIER.init();
  const worker=new Worker('/src/assets/staticWorld.worker.ts',{type:'module'});
  const receive=()=>new Promise<any>((resolve,reject)=>{worker.onmessage=({data})=>data.type==='error'?reject(new Error(data.message)):resolve(data);worker.onerror=e=>reject(new Error(e.message));});
  const request=async(message:any)=>{const pending=receive();worker.postMessage(message);return pending;};
  try{
   await request({action:'initialize',base:new URL('/play/world/',location.href).href});
   const out:any[]=[];
   for(const [x,y] of [[1100,-1300],[1900,1900],[2300,2300]]){
    const started=performance.now(),data=await request({action:'region',id:1,region:{x,y,radius:180,includeCollisionBounds:true}}),decodeMs=Math.round(performance.now()-started);
    const animated=data.parts.filter((p:any)=>p.model.uvAnimations?.length).map((p:any)=>({name:p.name,animations:p.model.uvAnimations.map((a:any)=>[a.name,a.type.toString(16),a.duration,a.frames.length]),slots:p.model.geometries.flatMap((g:any)=>g.materials.flatMap((m:any)=>m.uvAnimations??[]))}));
    const world=new RAPIER.World({x:0,y:-9.81,z:0}),scene=new THREE.Scene();
    let installed:any;
    try{
     installed=installNativeScene(world,scene,data.parts,{datasetIdentity:data.datasetIdentity});
     const matrices=()=>{const found:number[][]=[];scene.traverse((o:any)=>{if(!o.isMesh)return;for(const m of [o.material].flat())if(m.map&&m.map.matrixAutoUpdate===false&&!found.some(f=>f===m.map.matrix.elements))found.push(m.map.matrix.elements);});return found.map(e=>[...e]);};
     const before=matrices();installed.advanceUvAnimations(.5);const after=matrices();
     out.push({x,y,decodeMs,parts:data.parts.length,omitted:data.omitted,animatedModels:animated,uvAnimatorCount:installed.uvAnimatorCount,animatedTextures:before.length,moved:before.filter((m,i)=>m.some((v,j)=>Math.abs(v-after[i][j])>1e-6)).length,sample:{before:before[0],after:after[0]}});
    }finally{installed?.dispose();world.free();}
   }
   return out;
  }finally{worker.terminate();}
 });
 console.log(JSON.stringify(result));
 for(const window of result){
  expect(window.omitted).toBe(0);
  expect(window.animatedModels.length).toBeGreaterThan(0);
  expect(window.uvAnimatorCount).toBeGreaterThan(0);
  expect(window.moved).toBeGreaterThan(0);
 }
});
