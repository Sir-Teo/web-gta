import {openStaticWorldSource,readStaticWorldRegion} from './staticWorldSource';
let ready:ReturnType<typeof openStaticWorldSource>|undefined;
let busy=false;
/** Coalesce overlapping follow requests instead of failing: only the latest follow region matters for streaming
 * (CStreaming-style: camera position wins). Transfer requests (negative ids: a save point, a hangar flight, an
 * interior) are never dropped; they queue in order behind whatever is being read. */
type QueuedRequest={id:number;region:any;resident?:string[]};
const queue:QueuedRequest[]=[];
function enqueue(request:QueuedRequest){
 if(request.id>0){for(let i=queue.length-1;i>=0;i--)if(queue[i].id>0)queue.splice(i,1);}
 queue.push(request);
}
self.onmessage=async({data})=>{
 let activeId:number|undefined=data?.id;
 try{
   if(data.action==='initialize'){
    if(ready)throw new Error('World source is already initialized.');ready=openStaticWorldSource(data.base);const world=await ready;self.postMessage({type:'ready',carGenerators:world.carGenerators,occluders:world.occluders,pickups:world.pickups,stuntJumps:world.stuntJumps,savePoints:world.savePoints,radarBlips:world.radarBlips,restartPoints:world.restartPoints,entryExits:{...world.entryExits,archives:world.source.archives},tags:world.tags,setPieces:world.setPieces,worldZones:world.worldZones,zoneInitialization:{...world.zoneInitialization,population:undefined},script:world.scriptBytes});return;
   }
   if(data.action==='effects'&&ready){
    // 2d effects for models a prebuilt scene package carried without them, per geometry.
    const {source,geometryCache}=await ready,byName=new Map(source.entries.map(e=>[e.name.toLowerCase(),e]));
    const effects:Record<string,unknown[][]>={};
    for(const name of new Set<string>((data.names as string[]).map(n=>String(n).toLowerCase()))){
     const entry=byName.get(name+'.dff');if(!entry)continue;
     try{const model=await geometryCache.read(entry);if(model.geometries.some(g=>g.effects))effects[name]=model.geometries.map(g=>g.effects??[]);}catch{}
    }
    self.postMessage({type:'effects',effects});return;
   }
   if(data.action!=='region'||!ready){throw new Error('Invalid world terrain request.');}
   if(busy){enqueue({id:data.id,region:data.region,resident:data.resident});return;}
   activeId=data.id;
   let activeRegion:any=data.region,activeResident:string[]|undefined=data.resident;
   busy=true;
   try{
   for(;;){
   const next=queue.shift();if(next){activeId=next.id;activeRegion=next.region;activeResident=next.resident;}
   const current={id:activeId,region:activeRegion};
   const world=await ready!;
   const started=performance.now();console.debug(`[world] window ${current.id} at ${Math.round(current.region.x)},${Math.round(current.region.y)} (${Array.isArray(activeResident)?activeResident.length:0} resident)`);
   const window=await readStaticWorldRegion(world,current.region,Array.isArray(activeResident)?activeResident:[]);
   console.debug(`[world] window ${current.id} read in ${Math.round(performance.now()-started)} ms, ${window.parts.length} parts; posting`);
   self.postMessage({type:'terrain',followId:current.id,...window});
   console.debug(`[world] window ${current.id} posted after ${Math.round(performance.now()-started)} ms`);
   if(!queue.length)break;
   // More arrived while decoding: the latest follow region and every transfer, in order.
   continue;
   }
   }finally{busy=false;}
  }catch(error){
    const pending=queue.splice(0);
    self.postMessage({type:'error',followId:activeId,message:error instanceof Error?error.message:'World streaming failed.'});
    for(const request of pending)self.postMessage({type:'error',followId:request.id,message:'Superseded by a newer terrain request.'});
  }
};
