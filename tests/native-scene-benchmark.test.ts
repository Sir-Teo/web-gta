import {openAsBlob,mkdirSync,writeFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {basename,join} from 'node:path';
import {cpus} from 'node:os';
import {expect,test,vi} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Scene} from 'three';
import {planWorldFolder,type WorldFolderFile} from '../src/assets/worldFolder';
import {readScene} from '../src/assets/scene';
import {installNativeScene,type InstalledNativeScene} from '../src/simulation/nativeScene';
import * as visuals from '../src/assets/ModelObjects';
import {modelBuildStats} from '../src/assets/ModelObjects';
import * as collision from '../src/simulation/nativeCollision';
import * as visibility from '../src/render/sceneVisibility';

// Explicit opt-in: CPU construction timings are observations, never CI thresholds.
test.skipIf(!process.env.GTA_CONTENT_DIR||process.env.GTA_SCENE_BENCHMARK!=='1')('profiles native region replacement construction and retirement',async()=>{
 const depot=process.env.GTA_CONTENT_DIR!,manifest=JSON.parse(await readFile(join(depot,'scenes.json'),'utf8')).sa;
 const archive=await openAsBlob(join(depot,'gta3.img'));Object.defineProperty(archive,'name',{value:'gta3.img'});
 const files:WorldFolderFile[]=[{path:'depot/gta3.img',file:archive as File}];
 for(const kind of ['ide','ipl'])for(const path of manifest.paths[kind]){
  const relative=`${kind}/${path}.${kind}`;
  files.push({path:`depot/${relative}`,file:new File([await readFile(join(depot,relative))],basename(relative))});
 }
 const mountain=await readScene(await planWorldFolder(files,'mount-chiliad'));
 const east=await readScene(await planWorldFolder(files,'chiliad-east'));
 type Stages={visualBuild:number;visualDispose:number;collisionBuild:number;visibilityBuild:number};
 const empty=():Stages=>({visualBuild:0,visualDispose:0,collisionBuild:0,visibilityBuild:0});
 let stages=empty();
 const measure=<T>(key:keyof Stages,fn:()=>T)=>{const start=performance.now();try{return fn();}finally{stages[key]+=performance.now()-start;}};
 const buildVisual=visuals.placedModelObjects,buildCollision=collision.installNativeCollision,buildVisibility=visibility.sceneVisibility;
 const visualSpy=vi.spyOn(visuals,'placedModelObjects').mockImplementation((...args)=>{
  const result=measure('visualBuild',()=>buildVisual(...args)),dispose=result.dispose;
  result.dispose=()=>measure('visualDispose',dispose);return result;
 });
 const collisionSpy=vi.spyOn(collision,'installNativeCollision').mockImplementation((...args)=>measure('collisionBuild',()=>buildCollision(...args)));
 const visibilitySpy=vi.spyOn(visibility,'sceneVisibility').mockImplementation((...args)=>measure('visibilityBuild',()=>buildVisibility(...args)));
 await RAPIER.init();const world=new RAPIER.World({x:0,y:-9.81,z:0}),scene=new Scene();let current:InstalledNativeScene|undefined;
 const samples:{direction:string;totalMs:number;stagesMs:Stages;otherMs:number;instances:number;colliders:number;reusedPlacements:number}[]=[];
 try{
  current=installNativeScene(world,scene,mountain.scene,{datasetIdentity:'benchmark'});
  current.setTime(12*60,[.4,.4,.4]);
  for(let iteration=-3;iteration<20;iteration++)for(const [direction,parts] of [['east',east.scene],['mountain',mountain.scene]] as const){
   stages=empty();const start=performance.now();
   current=current.replace(parts,undefined,'benchmark');
   const totalMs=performance.now()-start,record={direction,totalMs,stagesMs:{...stages},otherMs:totalMs-Object.values(stages).reduce((a,b)=>a+b,0),instances:current.instanceCount,colliders:current.colliderCount,reusedPlacements:current.reusedPlacementCount};
   expect(current.reusedPlacementCount).toBe(48);expect(world.colliders.len()).toBe(current.colliderCount);expect(scene.children).toEqual([current.root]);
   if(iteration>=0)samples.push(record);
   // Spies record arguments/results; discard those references between swaps so
   // diagnostic instrumentation does not keep retired scenes alive for the run.
   visualSpy.mockClear();collisionSpy.mockClear();visibilitySpy.mockClear();
  }
  const stats=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b);return {medianMs:(sorted[9]+sorted[10])/2,p95Ms:sorted[18]};};
  const summaries=['east','mountain'].map(direction=>{const rows=samples.filter(row=>row.direction===direction);return {direction,total:stats(rows.map(row=>row.totalMs)),stages:Object.fromEntries(Object.keys(empty()).map(key=>[key,stats(rows.map(row=>row.stagesMs[key as keyof Stages]))])),other:stats(rows.map(row=>row.otherMs))};});
  const report={measuredAt:new Date().toISOString(),node:process.version,platform:process.platform,architecture:process.arch,cpu:cpus()[0]?.model,warmupRoundTrips:3,samplesPerDirection:20,
   scope:'Node CPU-only synchronous replacement, with midday state inheritance. Excludes folder planning, decoding, worker transfer, support validation, camera visibility update, WebGL upload/compilation and rendering. Instrumentation overhead and GC are included.',modelBuild:{...modelBuildStats},summaries,samples};
  mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/native-scene-construction-benchmark.json',JSON.stringify(report,null,2));
  console.info(JSON.stringify(summaries));
 }finally{current?.dispose();expect(world.colliders.len()).toBe(0);world.free();visualSpy.mockRestore();collisionSpy.mockRestore();visibilitySpy.mockRestore();}
},60000);
