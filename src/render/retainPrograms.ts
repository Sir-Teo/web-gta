/** Keeps every GPU program the renderer has linked for the rest of the session.
 *
 * three deletes a WebGLProgram as soon as the last material using it is disposed. Terrain windows retire their
 * per-placement fade copies, roadsign and grass materials on every swap, and their successors create theirs lazily
 * (a fade copy only when a placement starts fading), so the same handful of programs was deleted and linked again on
 * nearly every window: 77 links over a 60 s drive, each a synchronous compile, link and uniform query inside a frame.
 * The game draws a small, fixed family of shaders (about forty), so holding one reference per program costs little
 * and turns each into a one-time link. Past `limit` distinct programs three's own release policy applies again. */
export interface ProgramInfo {usedTimes:number}
const retained=new WeakMap<object,WeakSet<ProgramInfo>>(),counts=new WeakMap<object,number>();
export function retainPrograms(renderer:{info:{programs:readonly ProgramInfo[]|null}},limit=256){
 const programs=renderer.info.programs;if(!programs)return 0;
 let held=retained.get(renderer);if(!held){held=new WeakSet();retained.set(renderer,held);counts.set(renderer,0);}
 let count=counts.get(renderer)!;
 for(let i=0;i<programs.length&&count<limit;i++){
  const program=programs[i];if(held.has(program)||typeof program.usedTimes!=='number')continue;
  held.add(program);program.usedTimes++;count++;
 }
 counts.set(renderer,count);return count;
}
