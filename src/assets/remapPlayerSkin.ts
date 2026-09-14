import {requireAsset} from './binary';
import type {HAnimData,SkinData} from './skin';
/** Clothing palettes are part-local. Map positive influences by HAnim node ID,
 * then use the destination skeleton's inverse bind matrices as CreateSkinnedClump does. */
export function remapPlayerSkin(source:SkinData,sourceHierarchy:HAnimData,target:SkinData,targetHierarchy:HAnimData):SkinData{
 const palette=(skin:SkinData,hierarchy:HAnimData)=>{
  requireAsset(Number.isInteger(skin.boneCount)&&skin.boneCount>0&&skin.boneCount<=256,'Invalid skin bone count.');
  requireAsset(hierarchy.nodes.length===skin.boneCount,'Skin and hierarchy palette lengths disagree.');
  const indices=new Set<number>(),ids=new Set<number>();
  for(const n of hierarchy.nodes){requireAsset(Number.isInteger(n.id)&&Number.isInteger(n.index)&&n.index>=0&&n.index<skin.boneCount&&!indices.has(n.index)&&!ids.has(n.id),'Invalid skin hierarchy mapping.');indices.add(n.index);ids.add(n.id);}
  requireAsset(skin.inverseMatrices.length===skin.boneCount*16,'Invalid skin inverse matrix count.');
 };
 palette(source,sourceHierarchy);palette(target,targetHierarchy);
 requireAsset(source.indices.length===source.weights.length&&source.weights.length%4===0,'Invalid skin influence array lengths.');
 const destination=new Map(targetHierarchy.nodes.map(n=>[n.id,n.index])),mapping=new Map(sourceHierarchy.nodes.map(n=>[n.index,destination.get(n.id)]));
 const indices=new Uint8Array(source.indices.length),used=new Set<number>();
 for(let i=0;i<indices.length;i++){
  const weight=source.weights[i];requireAsset(Number.isFinite(weight)&&weight>=0&&weight<=1,'Invalid skin influence weight.');
  if(weight===0)continue;
  const mapped=mapping.get(source.indices[i]);requireAsset(mapped!==undefined,`Weighted clothing bone ${source.indices[i]} is absent from the target skeleton.`);
  indices[i]=mapped;used.add(mapped);
 }
 return {boneCount:target.boneCount,maxWeights:source.maxWeights,usedBones:new Uint8Array([...used].sort((a,b)=>a-b)),indices,weights:source.weights.slice(),inverseMatrices:target.inverseMatrices.slice()};
}
