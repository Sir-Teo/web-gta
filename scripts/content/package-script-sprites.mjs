/** Package the locked PC models/txd dictionaries used by main.scm and its streamed scripts.
 * node scripts/content/package-script-sprites.mjs /directory/containing/LD_*.txd */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {dirname,join} from 'node:path';
const [input]=process.argv.slice(2);if(!input)throw Error('Supply the PC script TXD directory');
const root='public/play/world',lock=JSON.parse(await readFile('scripts/content/world-sources.json','utf8')),manifest=JSON.parse(await readFile(`${root}/manifest.json`,'utf8')),sources=lock.resources.filter(r=>r.path.startsWith('models/txd/'));
if(sources.length!==21)throw Error('Expected the twenty-one main/streamed script dictionaries');
const hash=b=>createHash('sha256').update(b).digest('hex'),records=[];
// Validate every input before publishing any file.
for(const source of sources){const name=source.path.split('/').at(-1).slice(0,-4).toUpperCase()+'.txd',bytes=await readFile(join(input,name));if(bytes.length!==source.bytes||hash(bytes)!==source.sha256)throw Error(`Not the locked PC ${source.path}`);records.push({source,bytes,compressed:gzipSync(bytes,{level:9})});}
for(const {source,bytes,compressed} of records){
 const file=`packed/${hash(compressed).slice(0,20)}.bin`,raw=`${root}/files/${source.path}`;
 await mkdir(dirname(raw),{recursive:true});await mkdir(`${root}/packed`,{recursive:true});await writeFile(raw,bytes);await writeFile(`${root}/${file}`,compressed);
 const resource={...source,packed:{file,bytes:compressed.length}},index=manifest.resources.findIndex(r=>r.path===source.path);if(index<0)manifest.resources.push(resource);else manifest.resources[index]=resource;
}
await writeFile(`${root}/manifest.json`,JSON.stringify(manifest)+'\n');console.log(`${records.length} dictionaries: ${records.reduce((n,r)=>n+r.bytes.length,0)} raw bytes, ${records.reduce((n,r)=>n+r.compressed.length,0)} packed bytes`);
