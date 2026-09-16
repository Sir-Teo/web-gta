/** Acquire the verified PC footstep package, its two lookup files and the event-volume table. */
import {readFile} from 'node:fs/promises';
import {resolve,relative,isAbsolute,sep} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Readable} from 'node:stream';
import {createHash} from 'node:crypto';
import {matchesFile,installVerified} from './lib/verified-file.mjs';
import {mediafireDownloadUrl,readLimitedPage,acquireArchivePrefix} from './lib/feet-acquisition.mjs';
const [outputArg,...flags]=process.argv.slice(2);
if(!outputArg||flags.some(flag=>flag!=='--verify-only'))throw new Error('Usage: acquire-feet.mjs /absolute/content-depot [--verify-only]');
const output=resolve(outputArg),lock=JSON.parse(await readFile(new URL('./feet-sources.json',import.meta.url),'utf8'));
const destination=name=>{const path=resolve(output,name),rel=relative(output,path);if(!rel||rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel))throw new Error('Invalid audio destination.');return path;};
const missing=[];
for(const item of lock.files)if(!await matchesFile(destination(item.path),item))missing.push(item);
if(!missing.length){console.log(`Verified all ${lock.files.length} native audio files. No network requests.`);process.exit(0);}
if(flags.includes('--verify-only'))throw new Error(`Missing or changed audio: ${missing.map(item=>item.path).join(', ')}`);
const prefix=destination('.source-cache/audio-prefix.rar'),[start,end]=lock.downloadedRange;
if(!await matchesFile(prefix,{bytes:end-start+1,sha256:lock.prefixSha256})){
 const page=await readLimitedPage(await fetch(lock.source,{signal:AbortSignal.timeout(30000)}));
 console.log('Downloading the verified 4 MiB audio archive prefix…');
 await acquireArchivePrefix(prefix,lock,mediafireDownloadUrl(page));
}
const extracted=[];
for(const item of missing){
 const {stdout}=await promisify(execFile)('bsdtar',['-xOf',prefix,'--fast-read','Pasta audio/'+item.path],{encoding:'buffer',maxBuffer:item.bytes+65536,timeout:30000});
 if(stdout.length!==item.bytes||createHash('sha256').update(stdout).digest('hex')!==item.sha256)throw new Error(`Extracted audio mismatch: ${item.path}`);
 extracted.push({item,bytes:stdout});
}
for(const {item,bytes} of extracted){await installVerified(destination(item.path),item,Readable.from([bytes]));console.log(`${item.path}: extracted and verified`);}
console.log(`Ready: ${output}. Select this content folder in the model workshop.`);
