/** How the published static world groups archive entries into independently downloaded chunks.
 *
 * A window, a pedestrian or a weapon needs single entries, but a chunk downloads, verifies and inflates whole. The
 * first packing sorted entries by file type and filled 4 MiB chunks, so one model's .dff and .txd sat hundreds of
 * megabytes apart and a streamed window needing 17-23 MB of entries downloaded 63-89 MB across 30-38 chunks; boot's
 * twenty-odd main-thread entries (1.1 MB) pulled 26 MB. The original IMG keeps related entries near each other, so
 * chunks now follow archive order and hold at most 512 KiB of entries (an entry larger than that is a chunk of its
 * own). On the same recorded reads a window downloads 17-23 MB and boot 2.2 MB, and the whole archive packs smaller. */
export const STATIC_WORLD_CHUNK_BYTES=512*1024;
export function planStaticWorldChunks<T extends {offset:number;length:number}>(entries:readonly T[],limit=STATIC_WORLD_CHUNK_BYTES):T[][]{
 if(!Number.isSafeInteger(limit)||limit<=0)throw new Error('Invalid static world chunk size.');
 const chunks:T[][]=[];let current:T[]=[],size=0;
 for(const entry of [...entries].sort((a,b)=>a.offset-b.offset)){
  if(size&&size+entry.length>limit){chunks.push(current);current=[];size=0;}
  current.push(entry);size+=entry.length;
 }
 if(current.length)chunks.push(current);
 return chunks;
}
