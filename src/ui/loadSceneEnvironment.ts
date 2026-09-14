import type {SceneEnvironmentFiles} from '../assets/sceneEnvironment';
import {validateNativeVegetationFiles} from '../assets/nativeVegetationFolder';
type Loader={load(file:File,weather?:number):Promise<boolean>};
/** Reuse the pickers' parsing, cancellation, ownership and status reporting. */
export async function loadSceneEnvironment(value:unknown,loaders:Record<'lighting'|'water'|'particle',Loader> & Partial<Record<'surfaceAudio'|'surfaceInfo',Loader>>,loadFootsteps?:(files:NonNullable<SceneEnvironmentFiles['footsteps']>)=>Promise<boolean>,loadPlayer?:(files:NonNullable<SceneEnvironmentFiles['player']>)=>Promise<boolean>):Promise<string[]> {
  if(value===undefined)return [];
  if(!value||typeof value!=='object')throw new Error('Invalid local scene environment.');
  const data=value as SceneEnvironmentFiles;
  // Vegetation travels with the scene for its dedicated owner. The general
  // environment pickers validate its envelope but do not install the grass pass.
  if(data.vegetation!==undefined)validateNativeVegetationFiles(data.vegetation);
  if(data.weather!==undefined&&(!Number.isInteger(data.weather)||data.weather<0||data.weather>22))throw new Error('Invalid local scene weather.');
  const keys=['lighting','water','particle','surfaceAudio','surfaceInfo'] as const;
  for(const key of keys)if(data[key]!==undefined&&!(data[key] instanceof File))throw new Error(`Invalid local ${key} file.`);
  if(data.footsteps!==undefined){
    if(!data.footsteps||typeof data.footsteps!=='object'||!['bankLookup','packageLookup','feet'].every(key=>data.footsteps![key as keyof typeof data.footsteps] instanceof File))throw new Error('Invalid local footstep files.');
  }
  if(data.player!==undefined&&(!data.player||!Array.isArray(data.player.body)||data.player.body.length===0||data.player.body.length>64||!data.player.body.every(file=>file instanceof File)||!(data.player.animations instanceof File)))throw new Error('Invalid local player files.');
  const results=await Promise.all(keys.map(async key=>!data[key]||await loaders[key]?.load(data[key]!,key==='lighting'?data.weather:undefined)?undefined:key));
  const warnings:string[]=results.filter((key):key is typeof keys[number]=>!!key);
  if(data.footsteps&&!await loadFootsteps?.(data.footsteps))warnings.push('footsteps');
  if(data.player&&!await loadPlayer?.(data.player))warnings.push('player');
  return warnings;
}
