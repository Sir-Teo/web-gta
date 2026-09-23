import {requireAsset} from './binary';
import {readIpl} from './ipl';
import type {IplEntryExit} from './iplEntryExit';
import type {IplAudioZone,IplGarage} from './ipl';

/** Every `enex` row in GTA.DAT's IPL order: CFileLoader::LoadEntryExit adds each to the entry exit pool as the
 * level loads, so a record's pool slot is its place in this list. `ipls` maps lowercase `ipl/…` paths to text. */
export function readWorldEntryExits(loadList:readonly string[],ipls:ReadonlyMap<string,Uint8Array>):IplEntryExit[]{
 const out:IplEntryExit[]=[];
 for(const path of loadList){
  const bytes=ipls.get(path.toLowerCase());if(!bytes)continue;
  for(const row of readIpl(bytes).entryExits)out.push(row);
  requireAsset(out.length<=400,'World entry exits exceed the 400-slot pool.');
 }
 return out;
}
/** The named `grge` rows in GTA.DAT's IPL order, as CGarages::AddOne fills its fifty slots (MAX_NUM_GARAGES) while
 * the level loads: exactly fifty in the shipped world. */
export function readWorldGarages(loadList:readonly string[],ipls:ReadonlyMap<string,Uint8Array>):IplGarage[]{
 const out:IplGarage[]=[];
 for(const path of loadList){
  const bytes=ipls.get(path.toLowerCase());if(!bytes)continue;
  for(const row of readIpl(bytes).garages)out.push(row);
 }
 requireAsset(out.length<=50,'World garages exceed the fifty CGarages slots.');
 return out;
}
/** Every `auzo` row in GTA.DAT's IPL order, as CFileLoader::LoadAudioZone registers them while the level loads. */
export function readWorldAudioZones(loadList:readonly string[],ipls:ReadonlyMap<string,Uint8Array>):IplAudioZone[]{
 const out:IplAudioZone[]=[];
 for(const path of loadList){const bytes=ipls.get(path.toLowerCase());if(bytes)out.push(...readIpl(bytes).audioZones??[]);}
 return out;
}
