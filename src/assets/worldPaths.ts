import type {openStaticWorld} from './staticWorldArchive';
import {readImgEntry} from './img';
import {readPathNodes,type PathArea} from './pathNodes';

/** Every path loader's loaded areas, so CPathFind's switches reach all of them (each of the browser's systems keeps
 * its own neighbourhood of areas where the original has one CPathFind). */
export const pathAreaMaps=new Set<Map<number,PathArea>>();
/** LoadPathFindData's end, which the host sets: the stored switches onto an area just loaded. */
export const pathAreaLoaded:{hook?:(areas:ReadonlyMap<number,PathArea>,areaId:number)=>void}={};
/** Lazy exterior path neighborhood, bounded to nine native areas. */
export function worldPaths(source:Awaited<ReturnType<typeof openStaticWorld>>){
 const areas=new Map<number,PathArea>();pathAreaMaps.add(areas);
 return {areas,async loadAround(x:number,z:number){
  const column=Math.floor((x+3000)/750),row=Math.floor((-z+3000)/750);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const cx=column+dx,cy=row+dy;if(cx<0||cx>7||cy<0||cy>7)continue;
   const id=cy*8+cx;if(areas.has(id))continue;
   const entry=source.entry(`nodes${id}.dat`);
   if(entry){areas.set(id,readPathNodes(await readImgEntry(source.file,entry),id));pathAreaLoaded.hook?.(areas,id);}
  }
  for(const id of areas.keys())if(Math.abs(id%8-column)>1||Math.abs(Math.floor(id/8)-row)>1)areas.delete(id);
 }};
}
