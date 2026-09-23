import type {openStaticWorld} from './staticWorldArchive';
import {readImgEntry} from './img';
import {readPathNodes,type PathArea} from './pathNodes';

/** Lazy exterior path neighborhood, bounded to nine native areas. */
export function worldPaths(source:Awaited<ReturnType<typeof openStaticWorld>>){
 const areas=new Map<number,PathArea>();
 return {areas,async loadAround(x:number,z:number){
  const column=Math.floor((x+3000)/750),row=Math.floor((-z+3000)/750);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const cx=column+dx,cy=row+dy;if(cx<0||cx>7||cy<0||cy>7)continue;
   const id=cy*8+cx;if(areas.has(id))continue;
   const entry=source.entry(`nodes${id}.dat`);
   if(entry)areas.set(id,readPathNodes(await readImgEntry(source.file,entry),id));
  }
  for(const id of areas.keys())if(Math.abs(id%8-column)>1||Math.abs(Math.floor(id/8)-row)>1)areas.delete(id);
 }};
}
