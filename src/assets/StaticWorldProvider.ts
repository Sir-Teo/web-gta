import type {SceneRegion} from './sceneRegion';
/** One worker owns the source archive for the entire walk, independently of map workshops. */
export class StaticWorldProvider {
 private worker:Worker;
 constructor(base:string,onMessage:(data:any)=>void){
  this.worker=new Worker(new URL('./staticWorld.worker.ts',import.meta.url),{type:'module'});
  this.worker.onmessage=({data})=>onMessage(data);
  this.worker.onerror=()=>onMessage({type:'error',message:'The world content worker failed.'});
  this.worker.postMessage({action:'initialize',base:new URL(base,location.href).href});
 }
 request(id:number,region:SceneRegion){this.worker.postMessage({action:'region',id,region});}
 dispose(){this.worker.terminate();}
}
