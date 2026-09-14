import {test,expect} from 'vitest';
import {openAsBlob,readFileSync,createReadStream} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {readImgIndex,readImgEntry} from '../src/assets/img';
import {decodeIncludedGreenwood,type GreenwoodFiles} from '../src/assets/includedGreenwood';
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
test.skipIf(process.env.GTA_PUBLISH_VEHICLE!=='1')('publish source-verified Greenwood resources for static hosting',async()=>{
 const depot=process.env.GTA_CONTENT_DIR;if(!depot)throw new Error('GTA_CONTENT_DIR is required.');
 const world=JSON.parse(readFileSync('scripts/content/world-sources.json','utf8'));
 const vehicle=JSON.parse(readFileSync('scripts/content/vehicle-sources.json','utf8'));
 const archivePath=join(depot,world.archive.path),digest=createHash('sha256');let size=0;
 for await(const chunk of createReadStream(archivePath)){digest.update(chunk);size+=chunk.length;}
 expect(size).toBe(world.archive.bytes);expect(digest.digest('hex')).toBe(world.archive.sha256);
 const archive=await openAsBlob(archivePath),index=await readImgIndex(archive);
 const files={} as GreenwoodFiles,provenance:Record<string,unknown>={};
 for(const name of ['greenwoo.dff','greenwoo.txd'] as const){
  const entries=index.filter(e=>e.name===name);expect(entries).toHaveLength(1);
  files[name]=await readImgEntry(archive,entries[0]);provenance[name]={url:world.compressedArchive.url,archiveSha256:world.archive.sha256,entry:name};
 }
 for(const name of ['vehicle.txd','vehicles.ide','handling.cfg','carcols.dat'] as const){
  const resource=vehicle.resources.find((r:{path:string})=>r.path===`vehicles/${name}`);expect(resource).toBeDefined();
  const bytes=new Uint8Array(readFileSync(join(depot,resource.path)));expect(bytes.length).toBe(resource.bytes);expect(hash(bytes)).toBe(resource.sha256);
  files[name]=bytes;provenance[name]={url:resource.url};
 }
 const assets=decodeIncludedGreenwood(files);expect(assets.textures).toHaveLength(12);expect(assets.collision.spheres).toHaveLength(19);
 const destination='public/play/vehicles/greenwood';await mkdir(destination,{recursive:true});
 for(const [name,bytes] of Object.entries(files))await writeFile(join(destination,name),bytes);
 await writeFile(join(destination,'manifest.json'),JSON.stringify({version:1,model:'greenwoo',description:'Unmodified resources from the inspected public dataset; not a retail-version certification.',files:Object.fromEntries(Object.entries(files).map(([name,bytes])=>[name,{bytes:bytes.length,sha256:hash(bytes),source:provenance[name]}]))},null,2)+'\n');
 console.log(`Published Greenwood: ${Object.values(files).reduce((sum,b)=>sum+b.length,0)} bytes.`);
},60000);
