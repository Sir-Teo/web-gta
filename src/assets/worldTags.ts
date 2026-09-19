import {readIpl} from './ipl';
import type {IdeAssociation} from './ide';
import type {WorldTag} from '../world/nativeTagManager';
/** sItemDefinitionFlags::bIsTag. */
export const IDE_TAG=0x100000;
/** CEntity::Add's CTagManager::AddTag over the world's IPL placements in load order: every instance of an atomic IDE
 * model flagged as a tag (CTagManager::IsTag; no model starts with bTagDisabled). */
export function readWorldTags(loadList:readonly string[],ipls:ReadonlyMap<string,Uint8Array>,ide:readonly IdeAssociation[]):WorldTag[]{
 const models=new Set(ide.filter(d=>(d.section==='objs'||d.section==='tobj')&&(d.flags??0)&IDE_TAG).map(d=>d.id));
 const out:WorldTag[]=[];
 for(const path of loadList){
  const bytes=ipls.get(path.toLowerCase());if(!bytes)continue;
  for(const i of readIpl(bytes).instances)if(models.has(i.modelId))out.push({position:[...i.position],modelId:i.modelId});
 }
 return out;
}
