import {nativeWeaponInfo,nativeWeaponReloadMs} from '../weapons/weaponData';
import {openStaticWorld} from './staticWorldArchive';
import {readModel,ModelReadCache} from './readModel';
import {readIfp,resolveTrackBones} from './ifp';
import {readImgEntry} from './img';
import {readPedAnimGroups,pedLocomotion} from './pedAnimGroups';
import {readPedsIde,readPedGroups,readPedStats} from './pedGroups';
import {openWeaponAssets} from '../weapons/assets';
import {worldPaths} from './worldPaths';
import type {CharacterSource} from '../render/NativeCharacter';

/** Native civilian variety beyond the core trio: old and old-fat street models.
 * Turf gangs (Families/Ballas around Grove) spawn only as zone-weighted
 * parties through the gang roster, never in the civilian round-robin. */
const CIVILIAN_ROSTER=['bmydj','wmybmx','wfyri'] as const;
const EXTENDED_ROSTER=['omokung','wfost'] as const;
export interface PedLocomotionSpeeds {walk:number;run:number;sprint:number}
export interface PedDamageStats {attack:number;defend:number;temper:number;
 /** pedstats column K, the default decision maker: 0 group, 1 cop, 2 rand_norm, 3 rand_tough, 4 rand_weak. */
 decisionMaker:number;
 /** CPedStats::m_flags, which LoadPedStats fills from the shooting-rate column. */
 flags:number;
 /** pedstats heading change rate, degrees per frame. */
 headingChange:number}
export async function openWorldPedestrians(base:string,includePolice=false){
 const source=await openStaticWorld(base),cache=new ModelReadCache(source.file,source.entries);
 const resource=source.manifest.resources.find(r=>r.path==='animations/ped.ifp');
 if(!resource)throw new Error('Missing pedestrian animations.');
 const pack=readIfp(new Uint8Array(await (await source.resource(resource)).arrayBuffer()));
 const text=async(path:string)=>{const found=source.manifest.resources.find(r=>r.path===path);if(!found)throw new Error(`Missing ${path}.`);return await (await source.resource(found)).text();};
 // Native locomotion identity: animgrp.dat walkcycles via peds.ide anim groups
 // (gang1/gang2/swat/sexywoman/oldman/oldfatwoman, not just `man`), with gang
 // membership from pedgrp.dat for the turf pass. Speeds below come from each
 // variant's own root motion, so variant feet stop sliding.
 const animGroups=readPedAnimGroups(await text('data/animgrp.dat'));
 const pedIde=readPedsIde(await text('data/peds.ide'));
 const pedGroups=readPedGroups(await text('data/pedgrp.dat'));
 const pedStats=readPedStats(await text('data/pedstats.dat'));
 const man=animGroups.get('man')!;
 const statsFor=(name:string):PedDamageStats=>{const stat=pedStats.get(pedIde.get(name.toLowerCase())?.stat??'');return stat?{attack:stat.attack,defend:stat.defend,temper:stat.temper,decisionMaker:stat.decisionMaker,flags:stat.shootingRate,headingChange:stat.headingChange}:{attack:1,defend:1,temper:50,decisionMaker:2,flags:40,headingChange:7.5};};
 const locomotionFor=(name:string)=>pedLocomotion(pack,animGroups.get(pedIde.get(name)?.animGroup??'man')??man);
 // HANDSUP, HANDSCOWER and a few other ped.ifp clips carry name-only tracks.
 const animations=Object.fromEntries(pack.animations.map(clip=>{let resolved=clip;try{resolved=resolveTrackBones(clip,pack);}catch{/* left as is; binding it reports the bone */}return [clip.name.toLowerCase(),resolved];}));
 for(const name of ['fighta_1','ko_skid_front','getup_front'])if(!animations[name])throw new Error(`Missing native interaction animation: ${name}.`);
 const models:CharacterSource[]=[],modelSpeeds:PedLocomotionSpeeds[]=[],modelStats:PedDamageStats[]=[];
 const hasModel=(name:string)=>source.entries.some(e=>e.name.toLowerCase()===`${name}.dff`)&&source.entries.some(e=>e.name.toLowerCase()===`${name}.txd`);
 const loadModel=async(name:string)=>{
  const entry=source.entries.find(e=>e.name.toLowerCase()===`${name}.dff`),textureEntry=source.entries.find(e=>e.name.toLowerCase()===`${name}.txd`);
  if(!entry||!textureEntry)throw new Error(`Missing civilian ${name}.`);
  const asset=await readModel({file:source.file,entry,textureEntry},cache);
  const loco=locomotionFor(name);
  return {source:{model:asset.model,textures:asset.textures,convention:'san-andreas-ped',clip:loco.walk.clip,track:loco.walk.track!,idle:loco.idle,run:loco.run,sprint:loco.sprint} as CharacterSource,speeds:loco.speeds,stats:statsFor(name)};
 };
 for(const name of [...CIVILIAN_ROSTER,...(includePolice?['lapd1' as const]:[])]){
  const built=await loadModel(name);
  models.push(built.source);modelSpeeds.push(built.speeds);modelStats.push(built.stats);
 }
 // Pop the officer before turf variety joins the civilian round-robin.
 const officer=includePolice?models.pop():undefined,officerSpeeds=includePolice?modelSpeeds.pop():undefined,officerStats=includePolice?modelStats.pop():undefined,weapons=includePolice?await openWeaponAssets(base):undefined;
 // Turf and age variety beyond the core trio; absent archive entries are
 // skipped so an incomplete pack still yields the required roster.
 for(const name of EXTENDED_ROSTER){
  if(!hasModel(name))continue;
  const built=await loadModel(name);
  models.push(built.source);modelSpeeds.push(built.speeds);modelStats.push(built.stats);
 }
 const data=weapons?await weapons.weaponData():undefined;
 const loadArmed=async(id:number)=>{const info=nativeWeaponInfo(data!,id,3)??nativeWeaponInfo(data!,id,1)!;return {...await weapons!.load(id,info.animGroup),info,reloadSeconds:nativeWeaponReloadMs(data!,info)/1000};};
 const weapon=weapons?await loadArmed(22):undefined;
 // CCopPed carries a nightstick: its model and the BBALLBAT combo's swings from baseball.ifp.
 const nightstick=weapons?await weapons.load(3,undefined,'BBALLBAT'):undefined;
 const characters=new Map<string,Promise<{source:CharacterSource;speeds:PedLocomotionSpeeds;stats:PedDamageStats}>>(),armed=new Map<number,ReturnType<typeof loadArmed>>();
 /** Any pedestrian model by name with its native walkcycle, such as the per-level cop models. */
 const loadCharacter=(name:string)=>{let promise=characters.get(name.toLowerCase());if(!promise){promise=loadModel(name);characters.set(name.toLowerCase(),promise);}return promise;};
 const character=(name:string)=>loadCharacter(name).then(built=>built.source);
 const characterSpeeds=(name:string)=>loadCharacter(name).then(built=>built.speeds);
 const characterStats=(name:string)=>loadCharacter(name).then(built=>built.stats);
 /** Native anim group for a model (peds.ide), defaulting to `man`. */
 const animGroupOf=(name:string)=>pedIde.get(name.toLowerCase())?.animGroup??'man';
 /** Held weapon model and native fire clip for an armed officer type. */
 const armedWith=(id:number)=>{if(!weapons)throw new Error('Police weapons are unavailable.');let promise=armed.get(id);if(!promise){promise=loadArmed(id);armed.set(id,promise);}return promise;};
 // stealth_kn association group (knife.ifp): KILL_Partial, KILL_Knife_Player, KILL_Knife_Ped_Damage, KILL_Knife_Ped_Die.
 const knifeEntry=source.entries.find(e=>e.name.toLowerCase()==='knife.ifp'),stealth=knifeEntry?Object.fromEntries(readIfp(await readImgEntry(source.file,knifeEntry)).animations.filter(c=>/^kill_/i.test(c.name)).map(c=>[c.name.toLowerCase(),c])):{};
 return {models,modelSpeeds,modelStats,officer,officerSpeeds,officerStats,weapon,nightstick,character,characterSpeeds,characterStats,animGroupOf,gangs:pedGroups.gangs,dealers:pedGroups.dealers,armedWith,animations,stealth,...worldPaths(source)};
}
