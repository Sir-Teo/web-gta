import {readIpl} from './ipl';
import type {IdeAssociation} from './ide';
import type {WorldTag} from '../world/nativeTagManager';
/** sItemDefinitionFlags::bIsTag. */
export const IDE_TAG=0x100000;
/** The placement matrix's forward (y) axis: an IPL quaternion is stored conjugated. */
export function iplForward(q:readonly [number,number,number,number]):[number,number,number]{
 const [x,y,z,w]=[-q[0],-q[1],-q[2],q[3]];
 // (0, 1, 0) rotated by (x, y, z, w).
 return [2*(x*y-w*z),1-2*(x*x+z*z),2*(y*z+w*x)];
}
/** CEntity::Add's CTagManager::AddTag over the world's IPL placements in load order: every instance of an atomic IDE
 * model flagged as a tag (CTagManager::IsTag; no model starts with bTagDisabled). */
export function readWorldTags(loadList:readonly string[],ipls:ReadonlyMap<string,Uint8Array>,ide:readonly IdeAssociation[]):WorldTag[]{
 const models=new Set(ide.filter(d=>(d.section==='objs'||d.section==='tobj')&&(d.flags??0)&IDE_TAG).map(d=>d.id));
 const out:WorldTag[]=[];
 for(const path of loadList){
  const bytes=ipls.get(path.toLowerCase());if(!bytes)continue;
  for(const i of readIpl(bytes).instances)if(models.has(i.modelId))out.push({position:[...i.position],modelId:i.modelId,forward:iplForward(i.rotation)});
 }
 return out;
}
