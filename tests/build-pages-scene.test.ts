import {readSceneVegetation} from '../src/world/WalkingVegetation';
import {nativeScenePlantEntities} from '../src/world/nativeScenePlants';
import {readNativeProcAssets} from '../src/assets/nativeProcAssets';
import {readSceneCollisionSources} from '../src/assets/sceneCollisionSources';
import {readImgIndex} from '../src/assets/img';
import {PLAYER_CLASSIC_FILES} from '../src/assets/readPlayerBaseBody';
import {test,expect} from 'vitest';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {openAsBlob} from 'node:fs';
import {join,basename} from 'node:path';
import {gzipSync} from 'node:zlib';
import {planWorldFolder,type WorldFolderFile} from '../src/assets/worldFolder';
import {readScene} from '../src/assets/scene';

test.skipIf(!process.env.GTA_PUBLISH_PACK)('build the included GitHub Pages native scene',async()=>{
 const depot=process.env.GTA_CONTENT_DIR!;
 const archive=await openAsBlob(join(depot,'gta3.img'));Object.defineProperty(archive,'name',{value:'gta3.img'});
 const files:WorldFolderFile[]=[{path:'depot/gta3.img',file:archive as File}];
 const {resources}=JSON.parse(await readFile('scripts/content/world-sources.json','utf8'));
 for(const resource of resources){if(resource.path==='gta3.img'||resource.path==='scenes.json')continue;const path=resource.path;files.push({path:`depot/${path}`,file:new File([await readFile(join(depot,path))],basename(path))});}
 for(const path of [...PLAYER_CLASSIC_FILES.map(name=>`player/${name}`),'animations/ped.ifp'])files.push({path:`depot/${path}`,file:new File([await readFile(join(depot,path))],basename(path))});
 // The source lock uses the same manifest companion paths as the folder loader.
 const request=await planWorldFolder(files,'verdant-meadows'),loaded=await readScene(request);
 const vegetation=(await readSceneVegetation(request.environment))!;
 const entities=nativeScenePlantEntities(loaded.scene,vegetation.surfaceInfo,vegetation.objects,0);
 const surfaces=new Set(entities.flatMap(entity=>[...entity.collision.mesh.materials]));
 const names=[...new Set(vegetation.proceduralRules.filter(rule=>surfaces.has(rule.surface)).map(rule=>rule.modelName))];
 const collisions=await readSceneCollisionSources({file:request.file,allArchiveCollisions:true},await readImgIndex(request.file));
 const proceduralAssets=await readNativeProcAssets(names,{file:request.file,associations:request.associations,parents:request.parents,collisions:collisions.models!,objects:vegetation.objects});
 expect(proceduralAssets).toHaveLength(8);
 const buffers:string[]=[],ids=new WeakMap<object,number>();
 async function binary(key:object,bytes:()=>Promise<Buffer>|Buffer){let id=ids.get(key);if(id!==undefined)return id;id=buffers.length;ids.set(key,id);buffers.push('');buffers[id]=(await bytes()).toString('base64');return id;}
 async function encode(value:any):Promise<any>{
  if(value instanceof Blob)return {$native:'File',name:(value as File).name,type:value.type,buffer:await binary(value,async()=>Buffer.from(await value.arrayBuffer()))};
  if(ArrayBuffer.isView(value))return {$native:value.constructor.name,buffer:await binary(value.buffer,()=>Buffer.from(value.buffer)),offset:value.byteOffset,length:value.byteLength};
  if(Array.isArray(value))return Promise.all(value.map(encode));
  if(value&&typeof value==='object')return Object.fromEntries(await Promise.all(Object.entries(value).map(async([k,v])=>[k,await encode(v)])));
  return value;
 }
 const pack=await encode({parts:loaded.scene,proceduralAssets,environment:request.environment,datasetIdentity:'pages-verdant-v2',preferredSpawn:{x:400,z:-2500}});
 const json=JSON.stringify({version:1,buffers,scene:pack});const data=gzipSync(json,{level:9});expect(data.length).toBeLessThan(50*1024*1024);
 await mkdir('public/play',{recursive:true});await writeFile('public/play/verdant.scene.bin',data);
 await writeFile('/tmp/web-gta-pages-pack.json',JSON.stringify({bytes:data.length,expandedBytes:json.length,parts:loaded.scene.length,environment:Object.keys(request.environment)},null,2));
},120000);
