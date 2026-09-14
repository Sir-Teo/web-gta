/** Inventory source texture sampling without rewriting or synthesizing native pixels.
 * node scripts/content/audit-texture-sampling.mjs /absolute/gta3.img /absolute/report.json */
import {openAsBlob} from 'node:fs';
import {writeFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'rolldown';
const [archiveArg,outputArg,...flags]=process.argv.slice(2);
if(!archiveArg||!outputArg||flags.some(flag=>flag!=='--alpha-pixels'))throw new Error('Usage: audit-texture-sampling.mjs /absolute/gta3.img /absolute/report.json [--alpha-pixels]');
const inspectAlpha=flags.includes('--alpha-pixels');
const temporary=await mkdtemp(join(tmpdir(),'web-gta-sampling-'));
try{
 await writeFile(join(temporary,'entry.ts'),`export {readImgIndex,readImgEntry} from ${JSON.stringify(resolve('src/assets/img.ts'))};export {readTxd,decodeTexture} from ${JSON.stringify(resolve('src/assets/txd.ts'))};`);
 await build({input:join(temporary,'entry.ts'),platform:'node',output:{file:join(temporary,'readers.mjs'),format:'esm'}});
 const {readImgIndex,readImgEntry,readTxd,decodeTexture}=await import(pathToFileURL(join(temporary,'readers.mjs')));
 const file=await openAsBlob(resolve(archiveArg)),entries=(await readImgIndex(file)).filter(e=>e.name.toLowerCase().endsWith('.txd'));
 const dictionaries=[],failures=[];
 const summary={dictionaries:entries.length,textures:0,alphaTextures:0,singleLevel:0,mipFilterWithoutMipLevels:0,nearestSingleLevel:0,incompleteStoredChains:0,emptyStoredLevels:0};
 const alphaSummary={decodedTextures:0,unflaggedWithNonOpaquePixels:0,flaggedWithOpaqueBase:0};
 for(const entry of entries){
  try{
   const bytes=await readImgEntry(file,entry),textures=readTxd(bytes).map(t=>{
    const mipFilter=t.filter>=3&&t.filter<=6,expectedLevels=1+Math.floor(Math.log2(Math.max(t.width,t.height)));
    const singleLevel=t.mips.length===1;
    summary.textures++;if(t.hasAlpha)summary.alphaTextures++;
    if(singleLevel)summary.singleLevel++;
    if(mipFilter&&singleLevel)summary.mipFilterWithoutMipLevels++;
    if(t.filter===1&&singleLevel)summary.nearestSingleLevel++;
    if(t.mips.length>1&&t.mips.length<expectedLevels)summary.incompleteStoredChains++;
    summary.emptyStoredLevels+=t.mips.filter(m=>!m.bytes.length).length;
    let baseAlpha;
    if(inspectAlpha){
     const pixels=decodeTexture(t,0);let zero=0,partial=0;
     for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)zero++;else if(pixels[i]<255)partial++;}
     baseAlpha={zero,partial,opaque:t.width*t.height-zero-partial};
     alphaSummary.decodedTextures++;
     if(!t.hasAlpha&&zero+partial>0)alphaSummary.unflaggedWithNonOpaquePixels++;
     if(t.hasAlpha&&zero+partial===0)alphaSummary.flaggedWithOpaqueBase++;
    }
    return {name:t.name,alpha:t.hasAlpha,baseAlpha,format:t.format,rasterFormat:t.rasterFormat,filter:t.filter,addressU:t.addressU,addressV:t.addressV,
     width:t.width,height:t.height,expectedLevels,mipFilterWithoutMipLevels:mipFilter&&singleLevel,
     mips:t.mips.map(m=>({width:m.width,height:m.height,bytes:m.bytes.length}))};
   });
   dictionaries.push({name:entry.name,sha256:createHash('sha256').update(bytes).digest('hex'),textures});
  }catch(error){failures.push({name:entry.name,error:String(error)});}
 }
 const report={checkedAt:new Date().toISOString(),archive:resolve(archiveArg),archiveBytes:file.size,scope:'All TXD entries; includes unplaced and non-world textures. Missing stored levels do not alone prove retail corruption. Optional alpha counts describe decoded level 0, not native blend-state eligibility.',summary,alphaSummary:inspectAlpha?alphaSummary:undefined,failures,dictionaries};
 await writeFile(resolve(outputArg),JSON.stringify(report,null,2));
 console.log(JSON.stringify(summary));console.log(`${failures.length} unreadable dictionaries. Report: ${resolve(outputArg)}`);
 if(inspectAlpha)console.log(JSON.stringify(alphaSummary));
 if(failures.length)process.exitCode=1;
}finally{await rm(temporary,{recursive:true,force:true});}
