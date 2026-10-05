import type {ModelMesh} from './dff';
/** A model's draw spans with alike opaque ones joined, so a geometry draws them in one call. A DFF often gives several
 * materials the same texture, colour and effects (one per split of a mesh), and three draws each material group of a
 * geometry with a call of its own: on a phone a frame's calls are what it pays for most. `key` says which spans may
 * join (the same for spans whose materials would be built the same), or nothing for a span that keeps its own place:
 * only opaque spans join, as reordering opaque triangles cannot change the picture, while a translucent span's place
 * among the others is its draw order. The joined spans' triangles are moved together, at the first one's place, and the
 * index buffer rewritten; a model with nothing to join is returned as it is. */
export function mergeAlikeSpans(spans:readonly ModelMesh[],indices:Uint32Array,key:(span:ModelMesh)=>string|undefined):{spans:ModelMesh[];indices:Uint32Array}{
 const keys=spans.map(span=>span.count?key(span):undefined),first=new Map<string,number>(),members=new Map<number,number[]>();
 keys.forEach((k,i)=>{if(k===undefined)return;const at=first.get(k);if(at===undefined){first.set(k,i);members.set(i,[i]);}else members.get(at)!.push(i);});
 if(![...members.values()].some(list=>list.length>1))return {spans:[...spans],indices};
 const out=new Uint32Array(indices.length),merged:ModelMesh[]=[];let offset=0;
 spans.forEach((span,i)=>{
  const k=keys[i];
  if(k!==undefined&&first.get(k)!==i)return;
  const group=k===undefined?[i]:members.get(i)!;
  let min=Infinity,max=-1;const start=offset;
  for(const j of group){const s=spans[j];out.set(indices.subarray(s.start,s.start+s.count),offset);offset+=s.count;min=Math.min(min,s.min);max=Math.max(max,s.max);}
  merged.push({start,count:offset-start,material:span.material,min,max});
 });
 // Indices outside every span (none in a sound model) stay at the end, in their order.
 if(offset<indices.length){const used=new Uint8Array(indices.length);for(const s of spans)used.fill(1,s.start,s.start+s.count);for(let i=0;i<indices.length;i++)if(!used[i])out[offset++]=indices[i];}
 return {spans:merged,indices:out};
}
