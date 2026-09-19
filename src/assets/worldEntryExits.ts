import {requireAsset} from './binary';
import {readIpl} from './ipl';
import type {IplEntryExit} from './iplEntryExit';

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
