import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {withSources} from '../port/ts.mjs';
mkdirSync('artifacts',{recursive:true});
const previousFetch=globalThis.fetch;
globalThis.fetch=async input=>{
 const url=new URL(input instanceof Request?input.url:String(input));
 if(url.origin!=='http://world.test')throw new Error('Unexpected research URL '+url.href);
 try{return new Response(new Uint8Array(readFileSync(resolve('public',url.pathname.slice(1)))));}catch{return new Response(null,{status:404});}
};
try{await withSources(async load=>{
 const {openStaticWorldSource}=await load('/src/assets/staticWorldSource.ts'),{readScene}=await load('/src/assets/scene.ts'),{installNativeScene}=await load('/src/simulation/nativeScene.ts'),RAPIER=(await import('@dimforge/rapier3d-compat')).default,{Scene}=await import('three');
 await RAPIER.init();const source=await openStaticWorldSource('http://world.test/play/world/'),point=source.savePoints.find(p=>p.slot===2),region={x:point.pickup[0],y:point.pickup[1],radius:80,includeCollisionBounds:true,lodRadius:300};
 const request=await source.planner.plan('grove-street',region,true),loaded=await readScene(request,source.geometryCache,undefined,2);
 const physics=new RAPIER.World({x:0,y:-9.81,z:0}),installed=installNativeScene(physics,new Scene(),loaded.scene,{allowMissingCollision:true,datasetIdentity:'verdant-save-research'});physics.step();
 const rays=[];
 for(const target of [point.pickup,point.respawn])for(const height of [40,15,10]){
  const hits=[];physics.intersectionsWithRay(new RAPIER.Ray({x:target[0],y:height,z:-target[1]},{x:0,y:-1,z:0}),60,true,hit=>{const source=installed.sources.get(hit.collider.handle);hits.push({z:height-hit.timeOfImpact,model:source?.modelName,kind:source?.source.kind,placement:source?.placement});return true;});
  hits.sort((a,b)=>b.z-a.z);rays.push({target,height,hits});
 }
 const result={point,region,parts:loaded.scene.length,instances:installed.instanceCount,missingCollision:installed.missingCollision,notices:loaded.notices,rays};writeFileSync('artifacts/verdant-save-support.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,notices:undefined,rays:rays.map(r=>({...r,hits:r.hits.slice(0,5)}))}));installed.dispose();physics.free();
});}finally{globalThis.fetch=previousFetch;}
