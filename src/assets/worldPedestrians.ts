import {openStaticWorld} from './staticWorldArchive';
import {readModel,ModelReadCache} from './readModel';
import {readIfp} from './ifp';
import {readImgEntry} from './img';
import {civilianPedMovement} from './normalPlayerMovement';
import {openWeaponAssets} from '../weapons/assets';
import {worldPaths} from './worldPaths';
import type {CharacterSource} from '../render/NativeCharacter';

/** Small native civilian roster; population groups and schedules remain separate. */
export async function openWorldPedestrians(base:string,includePolice=false){
 const source=await openStaticWorld(base),cache=new ModelReadCache(source.file,source.entries);
 const resource=source.manifest.resources.find(r=>r.path==='animations/ped.ifp');
 if(!resource)throw new Error('Missing pedestrian animations.');
 const pack=readIfp(new Uint8Array(await (await source.resource(resource)).arrayBuffer()));
 // animgrp.dat `man` walkcycle for street civilians (walk_civi/run_civi/sprint_panic),
 // not the player walk_player/run_player set. Speeds in WorldPedestrians match these clips.
 const {walk,...roles}=civilianPedMovement(pack);
 const animations=Object.fromEntries(pack.animations.map(clip=>[clip.name.toLowerCase(),clip]));
 for(const name of ['fighta_1','ko_skid_front','getup_front'])if(!animations[name])throw new Error(`Missing native interaction animation: ${name}.`);
 const models:CharacterSource[]=[];
 for(const name of ['bmydj','wmybmx','wfyri',...(includePolice?['lapd1']:[])]){
  const entry=source.entries.find(e=>e.name.toLowerCase()===`${name}.dff`),textureEntry=source.entries.find(e=>e.name.toLowerCase()===`${name}.txd`);
  if(!entry||!textureEntry)throw new Error(`Missing civilian ${name}.`);
  const asset=await readModel({file:source.file,entry,textureEntry},cache);
  models.push({model:asset.model,textures:asset.textures,convention:'san-andreas-ped',clip:walk.clip,track:walk.track!,...roles});
 }
 const officer=includePolice?models.pop():undefined,weapons=includePolice?await openWeaponAssets(base):undefined,weapon=weapons?await weapons.load(22):undefined;
 const characters=new Map<string,Promise<CharacterSource>>(),armed=new Map<number,ReturnType<NonNullable<typeof weapons>['load']>>();
 /** Any pedestrian model by name with the shared locomotion roles, such as the per-level cop models. */
 const character=(name:string)=>{let promise=characters.get(name);if(!promise){promise=(async()=>{const entry=source.entries.find(e=>e.name.toLowerCase()===`${name}.dff`),textureEntry=source.entries.find(e=>e.name.toLowerCase()===`${name}.txd`);if(!entry||!textureEntry)throw new Error(`Missing pedestrian ${name}.`);const asset=await readModel({file:source.file,entry,textureEntry},cache);return {model:asset.model,textures:asset.textures,convention:'san-andreas-ped' as const,clip:walk.clip,track:walk.track!,...roles};})();characters.set(name,promise);}return promise;};
 /** Held weapon model and native fire clip for an armed officer type. */
 const armedWith=(id:number)=>{if(!weapons)throw new Error('Police weapons are unavailable.');let promise=armed.get(id);if(!promise){promise=weapons.load(id);armed.set(id,promise);}return promise;};
 // stealth_kn association group (knife.ifp): KILL_Partial, KILL_Knife_Player, KILL_Knife_Ped_Damage, KILL_Knife_Ped_Die.
 const knifeEntry=source.entries.find(e=>e.name.toLowerCase()==='knife.ifp'),stealth=knifeEntry?Object.fromEntries(readIfp(await readImgEntry(source.file,knifeEntry)).animations.filter(c=>/^kill_/i.test(c.name)).map(c=>[c.name.toLowerCase(),c])):{};
 return {models,officer,weapon,character,armedWith,animations,stealth,...worldPaths(source)};
}
