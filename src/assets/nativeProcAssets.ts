import {requireAsset} from './binary';
import {readImgIndex} from './img';
import type {IdeAssociation} from './ide';
import type {ColModel} from './col';
import type {ObjectDataRecord} from './objectData';
import {readModel,ModelReadCache} from './readModel';

/** Resolve procedural dependencies independently of static IPL placements.
 * Missing assets fail the package, rather than producing untextured proxies.
 * Collision bounds are required by native procedural vertical placement. */
export async function readNativeProcAssets(names:readonly string[],source:{file:File;associations:readonly IdeAssociation[];parents:[string,string][];collisions:ColModel[];objects:ReadonlyMap<string,ObjectDataRecord>;textureFiles?:File[]}){
 requireAsset(names.length<=128&&names.every(name=>/^[a-z0-9_]+$/i.test(name)&&name.length<=63),'Invalid procedural model selection.');
 const selected=[...new Set(names.map(name=>name.toLowerCase()))];
 if(!selected.length)return [];
 const entries=await readImgIndex(source.file),cache=new ModelReadCache(source.file,entries,source.textureFiles);
 const plans=selected.map(name=>{
  const definitions=source.associations.filter(def=>def.model.toLowerCase()===name),definition=definitions[0];
  requireAsset(!!definition,`Missing procedural model definition: ${name}.`);
  requireAsset(definitions.every(def=>def.id===definition.id&&def.dictionary.toLowerCase()===definition.dictionary.toLowerCase()),`Ambiguous procedural model definition: ${name}.`);
  const entry=entries.find(entry=>entry.name.toLowerCase()===`${name}.dff`);
  requireAsset(!!entry,`Missing procedural model: ${name}.dff.`);
  const dictionary=definition.dictionary.toLowerCase(),textureEntry=entries.find(entry=>entry.name.toLowerCase()===`${dictionary}.txd`),textureFile=cache.externalDictionaries.get(`${dictionary}.txd`);
  requireAsset(!!textureEntry||!!textureFile,`Missing procedural dictionary: ${dictionary}.txd.`);
  const collisions=source.collisions.filter(col=>col.name.toLowerCase()===name);
  requireAsset(collisions.length===1,`Missing or ambiguous procedural collision bounds: ${name}.`);
  return {name,definition,entry,textureEntry,textureFile,collision:collisions[0]};
 });
 requireAsset(new Set(plans.map(plan=>plan.definition.id)).size===plans.length,'Ambiguous procedural model IDs.');
 const results=[];let bytes=0;const buffers=new Set<ArrayBufferLike>();
 for(const plan of plans){
  const part=await readModel({file:source.file,entry:plan.entry,textureEntry:plan.textureEntry,textureFile:plan.textureFile,parents:source.parents,collisionModels:[plan.collision]},cache);
  const textures=new Set(part.textures.map(texture=>texture.name.toLowerCase()));
  const missing=[...new Set(part.model.geometries.flatMap(g=>g.materials.map(m=>m.texture).filter(name=>name&&!textures.has(name.toLowerCase()))))];
  requireAsset(missing.length===0,`Unbound procedural textures in ${plan.name}: ${missing.join(', ')}.`);
  for(const g of part.model.geometries)for(const array of [g.positions,g.normals,g.colors,g.nightColors,g.indices,g.materialIds,g.skin?.indices,g.skin?.weights,g.skin?.inverseMatrices,g.skin?.usedBones,...g.uvs])if(array&&!buffers.has(array.buffer)){buffers.add(array.buffer);bytes+=array.buffer.byteLength;}
  for(const texture of part.textures)for(const mip of texture.mips)if(!buffers.has(mip.data.buffer)){buffers.add(mip.data.buffer);bytes+=mip.data.buffer.byteLength;}
  requireAsset(bytes<=128*1024*1024,'Procedural assets exceed 128 MiB decoded memory.');
  results.push({...part,name:plan.name,definition:plan.definition,collision:plan.collision,entityKind:source.objects.has(plan.name)?'object' as const:'building' as const});
 }
 return results;
}
