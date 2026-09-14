import {requireAsset} from './binary';
import {readPlayerBaseBody,PLAYER_BASE_FILES,PLAYER_CLASSIC_FILES,type PlayerBodyVariant} from './readPlayerBaseBody';
export type PlayerOutfit='bare'|'vest'|'classic';
export function playerFilesForOutfit(outfit:PlayerOutfit):readonly string[]{
  requireAsset(['bare','vest','classic'].includes(outfit),'Unknown player outfit.');
  return outfit==='classic'?PLAYER_CLASSIC_FILES:outfit==='vest'?[...PLAYER_BASE_FILES,'vest.dff','vest.txd']:PLAYER_BASE_FILES;
}
/** Decode selected local files in the model worker; never resolve duplicate basenames by order. */
export async function readPlayerFiles(files:File[],variant:PlayerBodyVariant,outfit:PlayerOutfit){
  requireAsset(['normal','fat','ripped'].includes(variant),'Unknown player body variant.');
  const required=playerFilesForOutfit(outfit);
  requireAsset(files.length>0&&files.length<=64&&files.reduce((n,f)=>n+f.size,0)<=64*1024*1024,'Player selection requires 1–64 files totaling at most 64 MiB.');
  const byName=new Map<string,File>();
  for(const file of files){const name=file.name.toLowerCase();requireAsset(!byName.has(name),`Duplicate player file: ${name}.`);byName.set(name,file);}
  for(const name of required)requireAsset(byName.has(name),`Missing player base file: ${name}.`);
  const bytes=new Map<string,Uint8Array>();
  for(const name of required)bytes.set(name,new Uint8Array(await byName.get(name)!.arrayBuffer()));
  return {...readPlayerBaseBody(bytes,variant,outfit),outfit,sourceFiles:[...required]};
}
