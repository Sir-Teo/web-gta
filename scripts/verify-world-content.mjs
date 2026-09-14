import {readFileSync} from 'node:fs';
import {writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=process.argv[2]??'https://sir-teo.github.io/web-gta/play/world/';
const expected=JSON.parse(readFileSync('public/play/world/manifest.json','utf8'));
const response=await fetch(new URL('manifest.json',base));if(!response.ok)throw Error('World manifest unavailable');
const manifest=await response.json();if(JSON.stringify(manifest)!==JSON.stringify(expected))throw Error('Published world manifest differs');
const resources=[manifest.archive.directory,...manifest.chunks,...manifest.resources.map(r=>({...r,file:'files/'+r.path}))];
let next=0;const verified=[],failed=[];
await mkdir('artifacts',{recursive:true});
await Promise.all(Array.from({length:2},async()=>{for(;;){
 const entry=resources[next++];if(!entry)return;
 try{
  for(let attempt=0;;attempt++){
   const response=await fetch(new URL(entry.file,base));
   if([408,429,500,502,503,504].includes(response.status)&&attempt<2){await response.body?.cancel();await new Promise(resolve=>setTimeout(resolve,1000));continue;}
   if(!response.ok)throw Error(`HTTP ${response.status}`);
   const bytes=Buffer.from(await response.arrayBuffer());
   if(bytes.length!==entry.bytes||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error('Checksum mismatch');
   verified.push(entry.file);break;
  }
 }catch(error){failed.push({file:entry.file,error:String(error)});}
 if((verified.length+failed.length)%50===0)console.log(`${verified.length} verified; ${failed.length} failed`);
}}));
const result={base,checked:verified.length,bytes:resources.filter(r=>verified.includes(r.file)).reduce((n,r)=>n+r.bytes,0),verified,failed,allPublishedFilesVerified:failed.length===0&&verified.length===resources.length};
await writeFile('artifacts/world-content-verification.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,verified:undefined}));if(!result.allPublishedFilesVerified)process.exitCode=1;
