import type {WorldFolderFile} from './worldFolder';
import type {SceneRegion} from './sceneRegion';
import {planSceneCollision} from './sceneCollision';
/** A walk session owns its selected File inventory independently of the workshop
 * preview. The worker opens it once and reuses its metadata for later requests. */
export class FollowRegionProvider {
 private worker:Worker|undefined;
 private pending:number|undefined;
 private closed=false;
 constructor(private channel:BroadcastChannel,private source:{files:WorldFolderFile[];regionId:string;radius:number}){}
 request(id:number,region:SceneRegion){
  if(this.closed)return;
  if(!Number.isSafeInteger(id)||id<1||!region||region.radius!==this.source.radius||this.pending!==undefined){this.channel.postMessage({type:'region-source-error',followId:id,message:'Invalid or overlapping terrain request.'});return;}
  this.pending=id;
  const fresh=!this.worker;
  const worker=this.worker??=new Worker(new URL('./model.worker.ts',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{
   if(this.closed||worker!==this.worker)return;
   try{
    if(data.error)throw new Error(data.error);
    if(data.omitted||planSceneCollision(data.scene).missing.length)throw new Error('The next area has missing models or collision.');
    this.channel.postMessage({type:'replace-terrain',followId:id,datasetIdentity:data.datasetIdentity,parts:data.scene,timecycleBoxes:data.timecycleBoxes,preservePosition:true});
    this.pending=undefined;
   }catch(error){this.fail(error instanceof Error?error.message:'Terrain assembly failed.');}
  };
  worker.onerror=()=>{if(!this.closed&&worker===this.worker)this.fail('Terrain worker failed.');};
  worker.postMessage({action:fresh?'world-folder':'world-folder-region',files:fresh?this.source.files:undefined,regionId:this.source.regionId,region:{...region,includeCollisionBounds:true},discoverDistricts:true});
 }
 private fail(message:string){
  if(this.pending!==undefined)this.channel.postMessage({type:'region-source-error',followId:this.pending,message});
  this.pending=undefined;this.worker?.terminate();this.worker=undefined;
 }
 dispose(){if(this.closed)return;this.fail('The source workshop was closed.');this.closed=true;}
}
