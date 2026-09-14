import type {SceneEnvironmentFiles} from '../assets/sceneEnvironment';
type Loader={load(file:File,weather?:number):Promise<boolean>};
/** Reuse the pickers' parsing, cancellation, ownership and status reporting. */
export async function loadSceneEnvironment(value:unknown,loaders:Record<'lighting'|'water'|'particle',Loader> & Partial<Record<'surfaceAudio',Loader>>,loadFootsteps?:(files:NonNullable<SceneEnvironmentFiles['footsteps']>)=>Promise<boolean>):Promise<string[]> {
  if(value===undefined)return [];
  if(!value||typeof value!=='object')throw new Error('Invalid local scene environment.');
  const data=value as SceneEnvironmentFiles;
  if(data.weather!==undefined&&(!Number.isInteger(data.weather)||data.weather<0||data.weather>22))throw new Error('Invalid local scene weather.');
  const keys=['lighting','water','particle','surfaceAudio'] as const;
  for(const key of keys)if(data[key]!==undefined&&!(data[key] instanceof File))throw new Error(`Invalid local ${key} file.`);
  if(data.footsteps!==undefined){
    if(!data.footsteps||typeof data.footsteps!=='object'||!['bankLookup','packageLookup','feet'].every(key=>data.footsteps![key as keyof typeof data.footsteps] instanceof File))throw new Error('Invalid local footstep files.');
  }
  const results=await Promise.all(keys.map(async key=>!data[key]||await loaders[key]?.load(data[key]!,key==='lighting'?data.weather:undefined)?undefined:key));
  const warnings:string[]=results.filter((key):key is typeof keys[number]=>!!key);
  if(data.footsteps&&!await loadFootsteps?.(data.footsteps))warnings.push('footsteps');
  return warnings;
}
