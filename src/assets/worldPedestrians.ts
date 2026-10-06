import {nativeWeaponInfo,nativeWeaponReloadMs} from '../weapons/weaponData';
import {openStaticWorld} from './staticWorldArchive';
import {readModel,ModelReadCache} from './readModel';
import {readIfp,resolveTrackBones} from './ifp';
import {readImgEntry} from './img';
import {readPedAnimGroups,pedLocomotion} from './pedAnimGroups';
import {readPedsIde,readPedGroups,readPedStats,readPopcycleGroups,pedCanDriveClass} from './pedGroups';
import {openWeaponAssets} from '../weapons/assets';
import {worldPaths} from './worldPaths';
import {DEFAULT_DECISION_MAKER_FILES,readDecisionMaker,readPedRelationships} from '../ped/nativeDecisionMaker';
import type {CharacterSource} from '../render/NativeCharacter';

/** Native civilian variety beyond the core trio: old and old-fat street models.
 * Turf gangs (Families/Ballas around Grove) spawn only as zone-weighted
 * parties through the gang roster, never in the civilian round-robin. */
const CIVILIAN_ROSTER=['bmydj','wmybmx','wfyri'] as const;
const EXTENDED_ROSTER=['omokung','wfost'] as const;
export interface PedLocomotionSpeeds {walk:number;run:number;sprint:number}
export interface PedDamageStats {attack:number;defend:number;temper:number;
 /** peds.ide ped type (CIVMALE, GANG1, DEALER, CRIMINAL...). */
 pedType?:string;
 /** In a business or casual-rich ped group (pedgrp.dat). */
 rich?:boolean;
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
 const pedGroupText=await text('data/pedgrp.dat'),pedGroups=readPedGroups(pedGroupText),popcycleGroups=readPopcycleGroups(pedGroupText);
 const pedStats=readPedStats(await text('data/pedstats.dat'));
 const man=animGroups.get('man')!;
 // CDecisionMakerTypesFileLoader::LoadDefaultDecisionMaker's pedstats decision makers, when published; without them the
 // peds keep the authored responses. ped.dat's acquaintances pick each decision's chance column.
 const decisionMakers=await Promise.all(DEFAULT_DECISION_MAKER_FILES.map(async name=>{const path=`data/decision/allowed/${name}`;return source.manifest.resources.some(r=>r.path===path)?readDecisionMaker(await text(path)):undefined;}));
 const acquaintances=readPedRelationships(await text('data/ped.dat'));
 // CPedStats::GetPedStatType gives STAT_SENSIBLE_GUY for a name pedstats.dat does not list.
 const statsFor=(name:string):PedDamageStats=>{const stat=pedStats.get(pedIde.get(name.toLowerCase())?.stat??'')??pedStats.get('STAT_SENSIBLE_GUY');const pedType=pedIde.get(name.toLowerCase())?.pedType,rich=pedGroups.rich.has(name.toLowerCase());return stat?{attack:stat.attack,defend:stat.defend,temper:stat.temper,decisionMaker:stat.decisionMaker,flags:stat.shootingRate,headingChange:stat.headingChange,pedType,rich}:{attack:1,defend:1,temper:50,decisionMaker:2,flags:40,headingChange:7.5,pedType,rich};};
 const locomotionFor=(name:string)=>pedLocomotion(pack,animGroups.get(pedIde.get(name)?.animGroup??'man')??man);
 /** A walkcycle's moves by its animgrp.dat name, for a ped a script gives another group; nothing for one ped.ifp
  * cannot play (the player's and the ones in other blocks). */
 const walkcycleLocomotion=(group:string)=>{const cycle=animGroups.get(group.toLowerCase());if(!cycle)return undefined;try{return pedLocomotion(pack,cycle);}catch{return undefined;}};
 // HANDSUP, HANDSCOWER and a few other ped.ifp clips carry name-only tracks.
 const animations=Object.fromEntries(pack.animations.map(clip=>{let resolved=clip;try{resolved=resolveTrackBones(clip,pack);}catch{/* left as is; binding it reports the bone */}return [clip.name.toLowerCase(),resolved];}));
 for(const name of ['fighta_1','ko_skid_front','getup_front'])if(!animations[name])throw new Error(`Missing native interaction animation: ${name}.`);
 /** CTaskSimpleDuck's ped.ifp clips, WEAPON_crouch standing and GunCrouchFwd moving, for a ped a script ducks. */
 const crouchWalk=animations['guncrouchfwd'],crouchTrack=crouchWalk?.tracks.findIndex(t=>t.boneId===0&&!!t.translations&&t.times.length>0)??-1;
 const crouch=animations['weapon_crouch']&&crouchWalk&&crouchTrack>=0?{crouchIdle:{clip:animations['weapon_crouch']},crouchWalk:{clip:crouchWalk,track:crouchTrack}}:{};
 const models:CharacterSource[]=[],modelNames:string[]=[],modelSpeeds:PedLocomotionSpeeds[]=[],modelStats:PedDamageStats[]=[];
 const hasModel=(name:string)=>!!source.entry(`${name}.dff`)&&!!source.entry(`${name}.txd`);
 const loadModel=async(name:string)=>{
  const entry=source.entry(`${name}.dff`),textureEntry=source.entry(`${name}.txd`);
  if(!entry||!textureEntry)throw new Error(`Missing civilian ${name}.`);
  const asset=await readModel({file:source.file,entry,textureEntry},cache);
  const loco=locomotionFor(name);
  return {source:{model:asset.model,textures:asset.textures,convention:'san-andreas-ped',clip:loco.walk.clip,track:loco.walk.track!,idle:loco.idle,run:loco.run,sprint:loco.sprint,...crouch} as CharacterSource,speeds:loco.speeds,stats:statsFor(name)};
 };
 for(const name of [...CIVILIAN_ROSTER,...(includePolice?['lapd1' as const]:[])]){
  const built=await loadModel(name);
  models.push(built.source);modelSpeeds.push(built.speeds);modelStats.push(built.stats);modelNames.push(name);
 }
 // Pop the officer before turf variety joins the civilian round-robin.
 const officer=includePolice?(modelNames.pop(),models.pop()):undefined,officerSpeeds=includePolice?modelSpeeds.pop():undefined,officerStats=includePolice?modelStats.pop():undefined,weapons=includePolice?await openWeaponAssets(base):undefined;
 // Turf and age variety beyond the core trio; absent archive entries are
 // skipped so an incomplete pack still yields the required roster.
 for(const name of EXTENDED_ROSTER){
  if(!hasModel(name))continue;
  const built=await loadModel(name);
  models.push(built.source);modelSpeeds.push(built.speeds);modelStats.push(built.stats);modelNames.push(name);
 }
 const data=weapons?await weapons.weaponData():undefined;
 // CPed::GetWeaponSkill: a cop's pistol takes the COP row of weapon.dat; every other ped its m_nWeaponSkill, STD
 // unless a script says otherwise.
 const loadArmed=async(id:number,cop=false,skill=1)=>{const info=(cop?nativeWeaponInfo(data!,id,3):undefined)??nativeWeaponInfo(data!,id,(skill>=0&&skill<=2?skill:1) as 0|1|2)??nativeWeaponInfo(data!,id,1)!;return {...await weapons!.load(id,info.animGroup),info,reloadSeconds:nativeWeaponReloadMs(data!,info)/1000};};
 const weapon=weapons?await loadArmed(22,true):undefined;
 // CCopPed carries a nightstick: its model and the BBALLBAT combo's swings from baseball.ifp.
 const nightstick=weapons?await weapons.load(3,undefined,'BBALLBAT'):undefined;
 const characters=new Map<string,Promise<{source:CharacterSource;speeds:PedLocomotionSpeeds;stats:PedDamageStats}>>(),armed=new Map<number,ReturnType<typeof loadArmed>>();
 /** Any pedestrian model by name with its native walkcycle, such as the per-level cop models. */
 /** Decoded ped models by name, most recently used last; the zone rosters stream through dozens of models on a
  * long drive, so the 32 least recently used are let go (living peds keep their own references). */
 const CHARACTER_CACHE=32;
 const loadCharacter=(name:string)=>{
  // CModelInfo matches model names without case, and a script's own names are upper case, so the archive
  // lookup and the cache both work from the folded name rather than whatever case the caller had.
  const key=name.toLowerCase();let promise=characters.get(key);
  if(promise){characters.delete(key);characters.set(key,promise);return promise;}
  promise=loadModel(key);characters.set(key,promise);promise.catch(()=>characters.delete(key));
  while(characters.size>CHARACTER_CACHE)characters.delete(characters.keys().next().value!);
  return promise;
 };
 const character=(name:string)=>loadCharacter(name).then(built=>built.source);
 const characterSpeeds=(name:string)=>loadCharacter(name).then(built=>built.speeds);
 const characterStats=(name:string)=>loadCharacter(name).then(built=>built.stats);
 /** Native anim group for a model (peds.ide), defaulting to `man`. */
 /** CModelInfo by id: the peds.ide model a ped model id names. */
 const modelNamesById=new Map([...pedIde.values()].map(def=>[def.id,def.model]));
 const pedModelName=(id:number)=>modelNamesById.get(id);
 const modelIdsByName=new Map([...pedIde.values()].map(def=>[def.model.toLowerCase(),def.id]));
 /** The peds.ide id of a model name, which is what GET_CHAR_MODEL hands a script. */
 const pedModelId=(name:string)=>modelIdsByName.get(name.toLowerCase());
 /** CPedModelInfo::m_nPedFlags' bit 0, from peds.ide: the model buys drugs. */
 const buysDrugs=(id:number)=>{const name=modelNamesById.get(id);return !!name&&((pedIde.get(name)?.flags??0)&1)===1;};
 const animGroupOf=(name:string)=>pedIde.get(name.toLowerCase())?.animGroup??'man';
 /** CPedModelInfo::CanPedDriveVehicleClass for a model and a vehicles.ide class name. */
 const canDrive=(name:string,vehicleClass:string|undefined)=>pedCanDriveClass(pedIde.get(name.toLowerCase()),vehicleClass);
 /** CPedModelInfo::m_nCarsCanDriveMask bit 0x1000: the model may be created on foot at attractors (ChooseCivilianOccupation's bOnlyOnFoots). */
 const onFoot=(name:string)=>(((pedIde.get(name.toLowerCase())?.drives??0)&0x1000)!==0);
 /** Held weapon model and native fire clip for an armed officer type. */
 const armedWith=(id:number,cop=false,skill=1)=>{if(!weapons)throw new Error('Police weapons are unavailable.');const key=cop&&id===22?-id:skill===1?id:id+1000*(skill+1);let promise=armed.get(key);if(!promise){promise=loadArmed(id,cop,skill);armed.set(key,promise);}return promise;};
 // stealth_kn association group (knife.ifp): KILL_Partial, KILL_Knife_Player, KILL_Knife_Ped_Damage, KILL_Knife_Ped_Die.
 const knifeEntry=source.entry('knife.ifp'),stealth=knifeEntry?Object.fromEntries(readIfp(await readImgEntry(source.file,knifeEntry)).animations.filter(c=>/^kill_/i.test(c.name)).map(c=>[c.name.toLowerCase(),c])):{};
 // The attractors anim block (attractors.ifp): Stepsit_in, Stepsit_loop and Stepsit_out for the STEP attractors.
 const attractorsEntry=source.entry('attractors.ifp'),attractorClips=attractorsEntry?Object.fromEntries(readIfp(await readImgEntry(source.file,attractorsEntry)).animations.filter(c=>/^stepsit_/i.test(c.name)).map(c=>[c.name.toLowerCase(),c])):{};
 // The gangs anim block (gangs.ifp): CTaskComplexGangLeader's partial talk clips prtial_gngtlkA to H.
 const gangsEntry=source.entry('gangs.ifp'),gangClips=gangsEntry?Object.fromEntries(readIfp(await readImgEntry(source.file,gangsEntry)).animations.filter(c=>/^prtial_gngtlk/i.test(c.name)).map(c=>[c.name.toLowerCase(),c])):{};
 /** A clip from an animation block a script asked for (REQUEST_ANIMATION, then TASK_PLAY_ANIM's file and name):
  * PED is ped.ifp itself, and any other block is its own .ifp in the archive, with name-only tracks resolved through
  * ped.ifp's skeleton. Nothing when the block or the clip is missing. */
 const scriptBlocks=new Map<string,Promise<import('./ifp').NativeAnimation[]|undefined>>();
 const scriptAnimation=async(file:string,name:string)=>{
  const block=file.toLowerCase(),wanted=name.toLowerCase();
  if(block==='ped')return animations[wanted];
  let pending=scriptBlocks.get(block);
  if(!pending){
   const entry=source.entry(`${block}.ifp`);
   pending=entry?readImgEntry(source.file,entry).then(bytes=>readIfp(bytes).animations,()=>undefined):Promise.resolve(undefined);
   scriptBlocks.set(block,pending);
  }
  const clip=(await pending)?.find(c=>c.name.toLowerCase()===wanted);
  if(!clip)return undefined;
  try{return resolveTrackBones(clip,pack);}catch{return clip;}
 };
 // CPopulation::IsSunbather: the BEACH_GUY and BEACH_GIRL pedstats.
 const sunbather=(name:string)=>/^STAT_BEACH_(GUY|GIRL)$/i.test(pedIde.get(name.toLowerCase())?.stat??'');
 return {pedModelName,pedModelId,buysDrugs,sunbather,models,modelSpeeds,modelStats,officer,officerSpeeds,officerStats,weapon,nightstick,character,characterSpeeds,characterStats,animGroupOf,walkcycles:animGroups,walkcycleLocomotion,modelNames,onFoot,gangs:pedGroups.gangs,dealers:pedGroups.dealers,popcycleGroups,hasModel,canDrive,decisionMakers,acquaintances,armedWith,animations,scriptAnimation,stealth,gangClips,attractorClips,...worldPaths(source)};
}
