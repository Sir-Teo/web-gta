// Publishes a gzip copy of every loose world resource (public/play/world/files) under public/play/world/packed, named
// by its content like the archive chunks, and records it in the manifest as `packed`. GitHub Pages only compresses
// text types it recognizes: ped.ifp, the .txd/.fxp/.scm files and the .dat/.ide/.ipl tables all went out raw.
// The raw files stay where they are for the tools and tests that read them from disk.
// Usage: node scripts/pack-world-resources.mjs
import {readFileSync,writeFileSync,readdirSync,mkdirSync,rmSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const root='public/play/world',manifestPath=`${root}/manifest.json`;
const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
mkdirSync(`${root}/packed`,{recursive:true});
const kept=new Set();let raw=0,packed=0;
for(const resource of manifest.resources){
 const bytes=readFileSync(`${root}/files/${resource.path}`);
 if(bytes.length!==resource.bytes||createHash('sha256').update(bytes).digest('hex')!==resource.sha256)throw Error(`Checksum mismatch: ${resource.path}`);
 const gz=gzipSync(bytes,{level:9});
 // A resource that gzip barely shrinks is served as it is.
 if(gz.length>bytes.length*.95){delete resource.packed;raw+=bytes.length;packed+=bytes.length;continue;}
 const file=`packed/${createHash('sha256').update(gz).digest('hex').slice(0,20)}.bin`;
 if(!existsSync(`${root}/${file}`))writeFileSync(`${root}/${file}`,gz);
 resource.packed={file,bytes:gz.length};kept.add(file.slice('packed/'.length));
 raw+=bytes.length;packed+=gz.length;
}
for(const name of readdirSync(`${root}/packed`))if(!kept.has(name))rmSync(`${root}/packed/${name}`);
writeFileSync(manifestPath,JSON.stringify(manifest)+'\n');
console.log(JSON.stringify({resources:manifest.resources.length,packedFiles:kept.size,rawBytes:raw,publishedBytes:packed}));
