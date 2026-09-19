/** CTagManager::ALPHA_TAGGED: a tag counts as the player's above this alpha. */
export const ALPHA_TAGGED=228;
/** SPRAY_ALPHA_CHANGE (0x8CDEF0): alpha a spray-can shot adds to each tag it reaches. */
export const SPRAY_ALPHA_CHANGE=8;
/** An IPL tag placement: its native position and model. */
export interface WorldTag {position:readonly [number,number,number];modelId:number}
/** A placement's key: its position to the centimetre. */
export const tagKey=(position:readonly number[])=>position.slice(0,3).map(v=>v.toFixed(2)).join(',');
export type SprayPaintState='notFound'|'discovered'|'painted';

/** CTagManager (TagManager.cpp, reversed): every tag in the world in IPL load order (AddTag), its alpha (the player's
 * tag drawn over the rival one) and the count tagged. */
export class NativeTagManager {
 readonly tags:{key:string;position:[number,number,number];modelId:number;alpha:number}[];
 private byKey=new Map<string,number>();
 numTagged=0;
 constructor(tags:readonly WorldTag[]){
  this.tags=tags.map(t=>({key:tagKey(t.position),position:[t.position[0],t.position[1],t.position[2]],modelId:t.modelId,alpha:0}));
  this.tags.forEach((t,i)=>this.byKey.set(t.key,i));
 }
 get numTags(){return this.tags.length;}
 alpha(key:string){const i=this.byKey.get(key);return i===undefined?0:this.tags[i].alpha;}
 /** CTagManager::SetAlpha (0x49CEC0). Returns the message to trigger when the tag just passed ALPHA_TAGGED: TAG_ALL once
  * every tag is the player's, otherwise TAG_ONE with the count. */
 setAlpha(key:string,alpha:number):{message:'TAG_ONE'|'TAG_ALL';tagged:number;total:number}|undefined{
  const i=this.byKey.get(key);if(i===undefined)return undefined;
  const tag=this.tags[i],justTagged=alpha>ALPHA_TAGGED&&tag.alpha<=ALPHA_TAGGED;
  tag.alpha=alpha&255;this.updateNumTagged();
  if(!justTagged)return undefined;
  return {message:this.numTagged===this.numTags?'TAG_ALL':'TAG_ONE',tagged:this.numTagged,total:this.numTags};
 }
 /** CTagManager::UpdateNumTagged (0x49CDE0). */
 updateNumTagged(){this.numTagged=this.tags.filter(t=>t.alpha>ALPHA_TAGGED).length;}
 /** CTagManager::GetPercentageTagged (0x49CDA0). */
 percentageTagged(){return this.numTags?Math.trunc(this.numTagged/this.numTags*100):0;}
 /** CWorld::SprayPaintWorld (0x565B70) for the tags within `radius` (3D, from each tag's origin) of a spray-can shot:
  * each gains 8 alpha, capped at 255. `painted` when one reached 255 this time. The original takes the first 15
  * buildings CWorld::FindObjectsInRange returns, tag or not; only tags are considered here. */
 sprayPaint(point:readonly [number,number,number],radius:number,onChange:(key:string,alpha:number,message:ReturnType<NativeTagManager['setAlpha']>)=>void):SprayPaintState{
  let found=false,painted=false,count=0;
  for(const tag of this.tags){
   if(Math.hypot(tag.position[0]-point[0],tag.position[1]-point[1],tag.position[2]-point[2])>=radius)continue;
   if(++count>15)break;
   found=true;
   const next=Math.min(tag.alpha+SPRAY_ALPHA_CHANGE,255);
   if(tag.alpha!==255&&next===255)painted=true;
   onChange(tag.key,next,this.setAlpha(tag.key,next));
  }
  return painted?'painted':found?'discovered':'notFound';
 }
 /** CTagManager::Save and Load: the alphas that are not 0, by key. */
 saved(){return this.tags.filter(t=>t.alpha>0).map(t=>[t.key,t.alpha] as [string,number]);}
 load(entries:readonly (readonly [string,number])[]){for(const [key,alpha] of entries){const i=this.byKey.get(key);if(i!==undefined&&Number.isInteger(alpha)&&alpha>=0&&alpha<=255)this.tags[i].alpha=alpha;}this.updateNumTagged();}
}
