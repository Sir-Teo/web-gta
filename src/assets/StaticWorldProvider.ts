import type {SceneRegion} from './sceneRegion';
/** One worker owns the source archive for the entire walk, independently of map workshops. */
export class StaticWorldProvider {
 private worker:Worker;
 /** `chunkCacheBytes`: the decoded world chunks the worker keeps (setChunkCacheBudget), less on a phone. */
 constructor(base:string,onMessage:(data:any)=>void,{chunkCacheBytes}:{chunkCacheBytes?:number}={}){
  this.worker=new Worker(new URL('./staticWorld.worker.ts',import.meta.url),{type:'module'});
  this.worker.onmessage=({data})=>onMessage(data);
  this.worker.onerror=()=>onMessage({type:'error',message:'The world content worker failed.'});
  this.worker.postMessage({action:'initialize',base:new URL(base,location.href).href,chunkCacheBytes});
 }
 /** `resident`: models the caller still holds, whose payload the window message may leave out. */
 request(id:number,region:SceneRegion,resident:readonly string[]=[]){this.worker.postMessage({action:'region',id,region,resident:[...resident]});}
 /** The 2d effects of these models, answered with an `effects` message. */
 effects(names:string[]){this.worker.postMessage({action:'effects',names});}
 dispose(){this.worker.terminate();}
}
