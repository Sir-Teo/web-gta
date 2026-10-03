/* What the game keeps on the device, in the pause menu's Controls page: the world's chunks (staticWorldArchive's Cache
 * Storage, up to the whole world's half a gigabyte for one who travels it all) and the data the service worker keeps
 * for an offline start. A phone's storage is the player's: the page says how much, whether the browser has promised
 * to keep it, and clears it on a second tap (a confirm dialog would leave fullscreen). The app shell stays: it is the
 * game itself, a few megabytes. */
import {WORLD_CACHE} from '../assets/staticWorldArchive';
/** The caches of downloaded game data: the world's and the service worker's (scripts/serviceWorker.mjs PLAY_CACHE). */
export const GAME_DATA_CACHES=[WORLD_CACHE,'web-gta-play-v1'] as const;
type Storage={estimate?():Promise<{usage?:number}>;persisted?():Promise<boolean>};
type Caches={delete(name:string):Promise<boolean>};
const mb=(bytes:number)=>bytes<1048576*10?(bytes/1048576).toFixed(1):String(Math.round(bytes/1048576));
/** The line the panel shows: how much the game keeps, and whether the browser keeps it for good. */
export function storageSummary(usage:number|undefined,persisted:boolean|undefined){
 if(usage===undefined)return 'Downloaded San Andreas data is kept on this device for quick starts and offline play.';
 const kept=`${mb(usage)} MB kept on this device for quick starts and offline play`;
 return persisted?`${kept}, until you clear it.`:`${kept}; the browser may clear it when space runs low.`;
}
/** Deletes the downloaded game data; the next play downloads it again. */
export async function clearGameData(caches:Caches){let cleared=0;for(const name of GAME_DATA_CACHES)if(await caches.delete(name).catch(()=>false))cleared++;return cleared;}
export function storagePanel(storage:Storage|undefined,caches:Caches|undefined,confirmMs=4000){
 const element=document.createElement('div');element.className='storage-settings';
 const title=document.createElement('b');title.textContent='Storage';
 const line=document.createElement('small');
 const button=document.createElement('button');button.type='button';button.textContent='Clear downloaded data';button.hidden=!caches;
 element.append(title,line,button);
 let usage:number|undefined,armed:ReturnType<typeof setTimeout>|undefined;
 const disarm=()=>{clearTimeout(armed);armed=undefined;button.textContent='Clear downloaded data';};
 const refresh=async()=>{
  const [estimate,persisted]=await Promise.all([storage?.estimate?.().catch(()=>undefined),storage?.persisted?.().catch(()=>undefined)]);
  usage=estimate?.usage;line.textContent=storageSummary(usage,persisted);
 };
 // The first tap asks, the second (within a few seconds) clears.
 button.addEventListener('click',()=>{
  if(!caches)return;
  if(armed===undefined){button.textContent=usage?`Tap again to clear ${mb(usage)} MB`:'Tap again to clear';armed=setTimeout(disarm,confirmMs);return;}
  disarm();button.disabled=true;
  void clearGameData(caches).then(()=>refresh()).finally(()=>{button.disabled=false;line.textContent=`Cleared. ${line.textContent}`;});
 });
 void refresh();
 return {element,refresh};
}
