/** Inspect a local ped.ifp backup and record reproducible animation metadata.
 * node scripts/content/audit-ped.mjs /absolute/ped.ifp /absolute/output.json
 * No native animation bytes enter the repository or production build. */
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'rolldown';
const [input,output]=process.argv.slice(2);
if(!input||!output)throw new Error('Usage: audit-ped.mjs /absolute/ped.ifp /absolute/report.json');
const temporary=await mkdtemp(join(tmpdir(),'web-gta-ped-'));
try{
 await build({input:resolve('src/assets/ifp.ts'),platform:'node',output:{file:join(temporary,'ifp.mjs'),format:'esm'}});
 const {readIfp}=await import(pathToFileURL(join(temporary,'ifp.mjs'))),bytes=await readFile(input),pack=readIfp(bytes);
 const names=['WALK_player','run_player','sprint_civi','IDLE_stance','walk_start','JUMP_launch','JUMP_launch_R','JUMP_glide','JUMP_land','GunCrouchFwd','GunCrouchBwd','WEAPON_crouch'];
 const selected=names.map(name=>{
  const matches=pack.animations.filter(a=>a.name.toLowerCase()===name.toLowerCase());
  if(matches.length!==1)throw new Error(`Expected one ${name} clip, found ${matches.length}`);
  const clip=matches[0];
  return {name:clip.name,duration:clip.duration,tracks:clip.tracks.length,boneIds:clip.tracks.map(t=>t.boneId),translated:clip.tracks.flatMap((t,index)=>{
   if(!t.translations)return [];
   const start=Array.from(t.translations.slice(0,3)),end=Array.from(t.translations.slice(-3));
   return [{index,name:t.name,boneId:t.boneId,keys:t.times.length,start,end,horizontalSpeed:clip.duration?Math.hypot(end[0]-start[0],end[1]-start[1])/clip.duration:0}];
  })};
 });
 const report={checkedAt:new Date().toISOString(),input:resolve(input),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),format:pack.format,name:pack.name,animations:pack.animations.length,tracks:pack.animations.reduce((n,a)=>n+a.tracks.length,0),keyframes:pack.animations.reduce((n,a)=>n+a.tracks.reduce((n,t)=>n+t.times.length,0),0),selected};
 await writeFile(output,JSON.stringify(report,null,2));console.log(`${report.animations} clips, ${report.tracks} tracks, ${report.keyframes} keys; ${selected.length} named movement clips inspected.`);console.log(report.sha256);
}finally{await rm(temporary,{recursive:true,force:true});}
