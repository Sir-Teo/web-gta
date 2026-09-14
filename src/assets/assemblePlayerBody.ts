import {requireAsset} from './binary';
import type {DffModel,ModelGeometry} from './dff';
import {remapPlayerSkin} from './remapPlayerSkin';
import {skinFrames} from '../animation/skeleton';
export const PLAYER_BODY_PARTS=['torso','head','hands','legs','feet'] as const;
export type PlayerBodyPart=typeof PLAYER_BODY_PARTS[number];
/** Assemble already selected body variants on the player's skeleton.
 * Texture names are explicit constructed slot bindings, not global TXD fallbacks. */
export function assemblePlayerBody(template:DffModel,parts:Record<PlayerBodyPart,DffModel>,textures:Record<PlayerBodyPart,string>):DffModel{
 requireAsset(template.atomics.length===1,'Player template requires one atomic.');
 const targetAtomic=template.atomics[0],target=template.geometries[targetAtomic.geometry]?.skin;
 requireAsset(target,'Player template requires skin data.');
 skinFrames(template,target.boneCount);
 const targetHierarchy=template.frames.find(f=>f.hanim?.nodes.length===target.boneCount)!.hanim!;
 let variant:string|undefined;
 const geometries:ModelGeometry[]=[],warnings=new Set(template.warnings);
 for(const name of PLAYER_BODY_PARTS){
  const part=parts[name];requireAsset(part&&part.atomics.length===1,`Player ${name} requires one selected atomic.`);
  const atomic=part.atomics[0],partVariant=part.frames[part.atomics[0].frame]?.name.toLowerCase();
  requireAsset(partVariant&&['normal','fat','ripped'].includes(partVariant)&&(!variant||variant===partVariant),'Player parts require one consistent named body variant.');variant=partVariant;
  const geometry=part.geometries[atomic.geometry];
  requireAsset(geometry?.skin&&geometry.uvs.length>0,`Player ${name} requires skinned textured geometry.`);
  requireAsset(typeof textures[name]==='string'&&textures[name].length>0,`Player ${name} requires an explicit texture binding.`);
  skinFrames(part,geometry.skin.boneCount);
  const hierarchy=part.frames.find(f=>f.hanim?.nodes.length===geometry.skin!.boneCount)!.hanim!;
  const copy=structuredClone(geometry);
  copy.skin=remapPlayerSkin(geometry.skin,hierarchy,target,targetHierarchy);
  copy.materials=copy.materials.map(m=>({...m,color:[255,255,255,255],texture:textures[name],mask:''}));
  geometries.push(copy);
  part.warnings.forEach(w=>warnings.add(`${name}: ${w}`));
 }
 warnings.add('Body parts assembled on the player skeleton; stat blending, clothing texture composition and seam processing are not applied.');
 return {frames:structuredClone(template.frames),geometries,atomics:geometries.map((_,geometry)=>({frame:targetAtomic.frame,geometry,flags:5})),warnings:[...warnings]};
}
