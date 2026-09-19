import {mkdirSync,writeFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {openStaticWorldSource,readStaticWorldRegion} from '../src/assets/staticWorldSource';
import {planSceneCollision} from '../src/assets/sceneCollision';
/** Streams a grid of 180-unit windows over the whole published world, as the game's follower would while
 * driving, and records every window that fails or carries placements without a model or collision. Opt-in: it
 * needs a server for `public/play/world` (the Vite dev server by default) and takes several minutes. */
test.skipIf(process.env.GTA_WORLD_COVERAGE!=='1')('every grid window of the published world streams',async()=>{
 const base=process.env.GTA_WORLD_BASE??'http://127.0.0.1:5191/play/world/';
 const started=performance.now(),world=await openStaticWorldSource(base),openMs=Math.round(performance.now()-started);
 const step=Number(process.env.GTA_WORLD_STEP??400),extent=Number(process.env.GTA_WORLD_EXTENT??2900);
 const rows:Record<string,unknown>[]=[],points:[number,number][]=[];
 // GTA_WORLD_POINTS="x,y;x,y" probes named windows instead of the grid.
 if(process.env.GTA_WORLD_POINTS)for(const pair of process.env.GTA_WORLD_POINTS.split(';'))points.push(pair.split(',').map(Number) as [number,number]);
 else for(let y=-extent;y<=extent;y+=step)for(let x=-extent;x<=extent;x+=step)points.push([x,y]);
 for(const [x,y] of points){
  const at=performance.now();
  try{
   const window=await readStaticWorldRegion(world,{x,y,radius:180,includeCollisionBounds:true});
   const collision=planSceneCollision(window.parts);
   const placements=window.parts.reduce((n,p)=>n+p.placements.length,0);
   rows.push({x,y,ms:Math.round(performance.now()-at),parts:window.parts.length,placements,omitted:window.omitted,missingCollision:collision.missing,notices:window.notices.slice(0,4),
    detailed:window.parts.filter(p=>!(p.definition?.drawDistance!==undefined&&Math.fround(p.definition.drawDistance)>300)).length,
    triangles:window.parts.reduce((n,p)=>n+p.placements.length*p.model.atomics.filter(a=>a.flags&4).reduce((m,a)=>m+p.model.geometries[a.geometry].indices.length/3,0),0)});
  }catch(error){
   const message=error instanceof Error?error.message:String(error);
   rows.push({x,y,ms:Math.round(performance.now()-at),error:message,empty:/1–4,096 placements|No scene models/.test(message)});
  }
 }
 const failures=rows.filter(r=>r.error&&!r.empty),omitted=rows.filter(r=>(r.omitted as number)>0),missingCollision=rows.filter(r=>Array.isArray(r.missingCollision)&&r.missingCollision.length);
 const loaded=rows.filter(r=>!r.error) as {ms:number;parts:number;placements:number;detailed:number;triangles:number}[];
 const report={measuredAt:new Date().toISOString(),base,openMs,step,extent,windows:rows.length,loaded:loaded.length,empty:rows.filter(r=>r.empty).length,failures:failures.length,
  omittedWindows:omitted.length,missingCollisionWindows:missingCollision.length,
  maxMs:Math.max(0,...loaded.map(r=>r.ms)),medianMs:loaded.map(r=>r.ms).sort((a,b)=>a-b)[loaded.length>>1]??0,
  maxParts:Math.max(0,...loaded.map(r=>r.parts)),maxDetailed:Math.max(0,...loaded.map(r=>r.detailed)),maxPlacements:Math.max(0,...loaded.map(r=>r.placements)),maxTriangles:Math.max(0,...loaded.map(r=>r.triangles)),rows};
 mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/static-world-coverage.json',JSON.stringify(report,null,1));
 console.info(JSON.stringify({...report,rows:undefined}));
 for(const row of failures)console.info(JSON.stringify(row));
 expect(loaded.length).toBeGreaterThan(0);
},1200000);
