/** Package the locked PC FONTS.DAT/FONTS.TXD files, without rebuilding the world archive.
 * node scripts/content/package-fonts.mjs /path/to/fonts.dat /path/to/fonts.txd */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {dirname} from 'node:path';
const [dat,txd]=process.argv.slice(2);if(!dat||!txd)throw Error('Supply PC fonts.dat and fonts.txd');
const root='public/play/world',lock=JSON.parse(await readFile('scripts/content/world-sources.json','utf8')),manifest=JSON.parse(await readFile(`${root}/manifest.json`,'utf8'));
const records=[];
for(const [path,local] of [['data/fonts.dat',dat],['models/fonts.txd',txd]]){
 const source=lock.resources.find(r=>r.path===path),bytes=await readFile(local),hash=b=>createHash('sha256').update(b).digest('hex');
 if(!source||bytes.length!==source.bytes||hash(bytes)!==source.sha256)throw Error(`Not the locked PC ${path}`);
 records.push({source,bytes,compressed:gzipSync(bytes,{level:9})});
}
for(const {source,bytes,compressed} of records){
 const file=`packed/${createHash('sha256').update(compressed).digest('hex').slice(0,20)}.bin`,raw=`${root}/files/${source.path}`;
 await mkdir(dirname(raw),{recursive:true});await mkdir(`${root}/packed`,{recursive:true});await writeFile(raw,bytes);await writeFile(`${root}/${file}`,compressed);
 const resource={...source,packed:{file,bytes:compressed.length}},index=manifest.resources.findIndex(r=>r.path===source.path);
 if(index<0)manifest.resources.push(resource);else manifest.resources[index]=resource;
}
await writeFile(`${root}/manifest.json`,JSON.stringify(manifest)+'\n');console.log(records.map(r=>`${r.source.path}: ${r.bytes.length} bytes, ${r.compressed.length} packed`).join('\n'));
