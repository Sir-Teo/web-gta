import {openStaticWorldSource,readStaticWorldRegion} from './staticWorldSource';
let ready:ReturnType<typeof openStaticWorldSource>|undefined;
let busy=false;
/** Coalesce overlapping follow requests instead of failing: only the latest
 * region matters for streaming (CStreaming-style: camera position wins). */
let queued:{id:number;region:any}|undefined;
self.onmessage=async({data})=>{
 let activeId:number|undefined=data?.id;
 try{
   if(data.action==='initialize'){
    if(ready)throw new Error('World source is already initialized.');ready=openStaticWorldSource(data.base);const world=await ready;self.postMessage({type:'ready',carGenerators:world.carGenerators,pickups:world.pickups,stuntJumps:world.stuntJumps,savePoints:world.savePoints,radarBlips:world.radarBlips,restartPoints:world.restartPoints,entryExits:{...world.entryExits,archives:world.source.archives},tags:world.tags,setPieces:world.setPieces,worldZones:world.worldZones,zoneInitialization:{...world.zoneInitialization,population:undefined}});return;
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
   if(busy){queued={id:data.id,region:data.region};return;}
   activeId=data.id;
   let activeRegion:any=data.region;
   busy=true;
   try{
   for(;;){
   if(queued!==undefined){activeId=queued.id;activeRegion=queued.region;queued=undefined;}
   const current={id:activeId,region:activeRegion};
   const world=await ready!;
   const window=await readStaticWorldRegion(world,current.region);
   self.postMessage({type:'terrain',followId:current.id,...window});
   if(!queued)break;
   // A newer follow request arrived while decoding: load the latest next.
   continue;
   }
   }finally{busy=false;}
  }catch(error){
    const pendingQueued=queued;queued=undefined;
    self.postMessage({type:'error',followId:activeId,message:error instanceof Error?error.message:'World streaming failed.'});
    if(pendingQueued)self.postMessage({type:'error',followId:pendingQueued.id,message:'Superseded by a newer terrain request.'});
  }
};
