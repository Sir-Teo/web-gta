import {openStaticWorld} from '../assets/staticWorldArchive';
import {readModel,ModelReadCache} from '../assets/readModel';
import {readImgEntry} from '../assets/img';
import {readIfp,type AnimationPackage,type NativeAnimation} from '../assets/ifp';
import {readTxd,decodeTexture} from '../assets/txd';
import {weaponById} from './catalog';
import {WEAPON_ANIM_GROUPS,readWeaponData} from './weaponData';
export type WeaponAssets=Awaited<ReturnType<Awaited<ReturnType<typeof openWeaponAssets>>['load']>>;
export async function openWeaponAssets(base:string){
 const source=await openStaticWorld(base),cache=new ModelReadCache(source.file,source.entries),packs=new Map<string,AnimationPackage>();
 const entries=new Map(source.entries.map(e=>[e.name.toLowerCase(),e]));
 const pedPack=async()=>{let canonical=packs.get('');if(!canonical){const r=source.manifest.resources.find(r=>r.path==='animations/ped.ifp');if(!r)throw new Error('Missing ped animations.');canonical=readIfp(new Uint8Array(await (await source.resource(r)).arrayBuffer()));packs.set('',canonical);}return canonical;};
 const pack=async(name:string)=>{if(!name)return pedPack();let result=packs.get(name);if(!result){const e=entries.get(name+'.ifp');if(!e)throw new Error(`Missing ${name} animations.`);result=readIfp(await readImgEntry(source.file,e));packs.set(name,result);}return result;};
 /** Name-only tracks resolve to native skeleton bone IDs through the canonical pedestrian pack. */
 const resolveBones=async(clip:NativeAnimation)=>{
  if(!clip.tracks.some(t=>t.boneId<0))return clip;
  const canonical=await pedPack(),names=new Map<string,Set<number>>();for(const c of canonical.animations)for(const t of c.tracks)if(t.boneId>=0){const name=t.name.trim().toLowerCase();if(!names.has(name))names.set(name,new Set());names.get(name)!.add(t.boneId);}
  return {...clip,tracks:clip.tracks.map(t=>{if(t.boneId>=0)return t;const aliases:Record<string,string>={'r fingers':'r finger','l fingers':'l finger','root l finger01':'l finger01','root r finger01':'r finger01'};const name=t.name.trim().toLowerCase(),ids=names.get(aliases[name]??name);if(ids?.size!==1)throw new Error(`Unresolved native weapon bone: ${t.name}.`);return {...t,boneId:[...ids][0]};})};
 };
 const clipFrom=async(file:string,name:string)=>{const found=(await pack(file)).animations.find(c=>c.name.toLowerCase()===name.toLowerCase());return found&&resolveBones(found);};
 return {
  /** Original WEAPON.DAT from the static world resources. */
  async weaponData(){const r=source.manifest.resources.find(r=>r.path==='data/weapon.dat');if(!r)throw new Error('Missing native weapon data.');return readWeaponData(new TextDecoder('windows-1252').decode(await (await source.resource(r)).arrayBuffer()));},
  /** Loads the held model and the native animation association group selected by the current weapon skill. */
  async load(id:number,animGroup?:string){
  const w=weaponById(id);if(!w)throw new Error('Unknown weapon.');
  const group=animGroup?WEAPON_ANIM_GROUPS[animGroup]:undefined;
  let clip:NativeAnimation|undefined,crouchClip:NativeAnimation|undefined,reloadClip:NativeAnimation|undefined,crouchReloadClip:NativeAnimation|undefined;
  if(group){
   clip=await clipFrom(group.file,group.fire);if(!clip)throw new Error(`Missing ${w.name} animation: ${group.fire}.`);
   crouchClip=await clipFrom(group.file,group.crouchFire);
   if(group.reload){reloadClip=await clipFrom(group.file,group.reload);if(!reloadClip)throw new Error(`Missing ${w.name} reload animation.`);}
   if(group.crouchReload)crouchReloadClip=await clipFrom(group.file,group.crouchReload);
  }else{
   clip=await clipFrom(w.pack??'',w.clip??'');if(!clip)throw new Error(`Missing ${w.name} animation: ${w.clip}.`);
   if(w.reloadClip){reloadClip=await clipFrom(w.reloadPack!,w.reloadClip);if(!reloadClip)throw new Error(`Missing ${w.name} reload animation.`);}
  }
  const clips={clip:clip!,crouchClip,reloadClip,crouchReloadClip,animGroup:group?animGroup:undefined};
  if(!w.model)return {...clips,asset:undefined,icon:undefined,projectileAsset:undefined};
  const entry=entries.get(w.model+'.dff'),textureEntry=entries.get(w.model+'.txd');if(!entry||!textureEntry)throw new Error(`Missing native ${w.name} model or textures.`);
  const asset=await readModel({file:source.file,entry,textureEntry},cache);
  const names=new Set(asset.textures.map(t=>t.name.toLowerCase()));
  const missing=asset.model.geometries.flatMap(g=>g.materials.filter(m=>m.texture&&!names.has(m.texture.toLowerCase())));if(missing.length)throw new Error(`Unresolved ${w.name} textures.`);
  const raster=readTxd(await cache.dictionary(textureEntry)).find(t=>/icon$/i.test(t.name));
  const icon=raster?{width:raster.width,height:raster.height,data:decodeTexture(raster,0)}:undefined;
  const projectileAsset=w.kind==='rocket'||w.kind==='guided'?await readModel({file:source.file,entry:entries.get('missile.dff'),textureEntry:entries.get('missile.txd')},cache):undefined;
  return {...clips,asset,icon,projectileAsset};
 },async canopy(){
  const entry=entries.get('parachute.dff'),textureEntry=entries.get('paracx.txd');if(!entry||!textureEntry)throw new Error('Missing parachute canopy.');
  const asset=await readModel({file:source.file,entry,textureEntry},cache);
  const parachute=await pack('parachute'),clip=parachute.animations.find(c=>c.name.toLowerCase()==='para_float_o')!,playerClip=parachute.animations.find(c=>c.name.toLowerCase()==='para_float')!;
  if(!clip||!playerClip)throw new Error('Missing native canopy animation.');
  const names=new Set(asset.textures.map(t=>t.name.toLowerCase()));if(asset.model.geometries.some(g=>g.materials.some(m=>m.texture&&!names.has(m.texture.toLowerCase()))))throw new Error('Unresolved canopy textures.');
  return {...asset,clip,playerClip};
 }};
}
