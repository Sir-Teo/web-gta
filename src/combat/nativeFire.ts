/* CFire and CFireManager, pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166
 * (Fire.cpp, FireManager.cpp). A pool of 60 fires, each either at a world position or
 * attached to a ped, the player, a vehicle or an object. Fires set the player alight
 * within the square root of 1.2 units, set vehicles within 2 units alight one frame in
 * 32, merge with weak neighbours, and die down one strength step at a time once their
 * burn time runs out. Native units, Z up; `timeStep` is 1 per 1/50 s. */

type V3={x:number;y:number;z:number};
export const MAX_NUM_FIRES=60;
/** (uint8)m_nMaxFireGenerationsAllowed: 999'999 truncated to a byte. */
export const MAX_FIRE_GENERATIONS=999999&0xff;

export type FireTarget={kind:'ped'|'vehicle'|'object';key:unknown}|{kind:'player';key:unknown};
export class NativeFire {
 active=false;script=false;firstGeneration=true;beingExtinguished=false;
 position:V3={x:0,y:0,z:0};timeToBurn=0;target?:FireTarget;creator?:unknown;strength=1;generations=100;removalDistance=60;
 /** Bumped whenever CreateFxSysForStrength would recreate the effect. */
 fxSerial=0;
 /** GetFireParticleNameForStrength. */
 get fxName(){return this.strength>1?this.strength>2?'fire_large':'fire_med':'fire';}
 extinguish(){if(!this.active)return;this.timeToBurn=0;this.active=false;this.beingExtinguished=false;this.firstGeneration=true;this.target=undefined;}
}

/** What CFire::ProcessFire reads from and does to the world. */
export interface FireWorld {
 nowMs:number;timeStep:number;
 /** CGeneral::GetRandomNumber() / RAND_MAX in [0, 1). */
 random:()=>number;
 /** A burning target's position, or undefined once it no longer exists. */
 targetPosition:(target:FireTarget)=>V3|undefined;
 /** Peds: dead or dying (the fire sits a unit lower). */
 targetDead?:(target:FireTarget)=>boolean;
 /** InflictDamage(WEAPON_FLAMETHROWER, 1.2 x timeStep) on a burning vehicle. */
 damageVehicle?:(target:FireTarget,amount:number)=>void;
 /** A vehicle fire's position: the main front light dummy, 0.15 up. */
 vehicleFirePosition?:(target:FireTarget)=>V3|undefined;
 /** The player when it can catch fire: on foot, not burning, not fireproof. */
 ignitablePlayer?:()=>{key:unknown;position:V3}|undefined;
 /** Vehicles whose position is within `radius`, for the one-in-32 spread. */
 vehiclesNear?:(position:V3,radius:number)=>FireTarget[];
 cameraPosition:V3;
}

export class NativeFireManager {
 readonly fires=Array.from({length:MAX_NUM_FIRES},()=>new NativeFire());
 /** CFire::ExtinguishWithWater's two prt_smokeII_3_expand puffs (native position and upward speed). */
 onSteam?:(position:V3,rise:number)=>void;
 random:()=>number=Math.random;
 get active(){return this.fires.filter(f=>f.active);}
 fireOn(key:unknown){return this.fires.find(f=>f.active&&f.target?.key===key);}
 /** GetNextFreeFire(false). */
 private free(){return this.fires.find(f=>!f.active&&!f.script);}
 /** CFireManager::StartFire at a position (0x539F00). */
 startFire(position:V3,timeToBurnMs:number,generations:number,world:{nowMs:number;random:()=>number;underwater?:boolean},creator?:unknown){
  if(world.underwater)return undefined;
  const fire=this.free();if(!fire)return undefined;
  Object.assign(fire,{active:true,script:false,beingExtinguished:false,firstGeneration:true,target:undefined,creator,generations:Math.min(MAX_FIRE_GENERATIONS,generations),strength:1,position:{...position}});
  fire.timeToBurn=world.nowMs+Math.trunc((1+.3*world.random())*timeToBurnMs);fire.fxSerial++;
  return fire;
 }
 /* CFireManager::StartScriptFire (0x53A300) as the mirror of a script's own table: the browser keeps one fire
  * for each of the script's, at the place its record says, and lets it go when that record does. A script's
  * fire takes a slot the streamer will not reclaim, which is what the script flag is for. */
 syncScriptFires(records:readonly {key:number;position:V3;strength:number;generations:number}[]){
  const wanted=new Map(records.map(record=>[record.key,record]));
  for(const [key,fire] of this.scripted)if(!wanted.has(key)){fire.script=false;fire.extinguish();this.scripted.delete(key);}
  for(const record of records){
   let fire=this.scripted.get(record.key);
   if(fire&&!fire.active){this.scripted.delete(record.key);fire=undefined;}
   if(!fire){
    const free=this.fires.find(f=>!f.active);if(!free)continue;
    Object.assign(free,{active:true,script:true,beingExtinguished:false,firstGeneration:true,target:undefined,
     creator:undefined,timeToBurn:Number.POSITIVE_INFINITY});
    free.fxSerial++;this.scripted.set(record.key,free);fire=free;
   }
   fire.position={...record.position};
   if(Math.trunc(fire.strength)!==Math.trunc(record.strength))fire.fxSerial++;
   fire.strength=record.strength;fire.generations=record.generations;
  }
 }
 private readonly scripted=new Map<number,NativeFire>();
 /** CFireManager::StartFire on an entity (0x53A050). */
 startFireOn(target:FireTarget,position:V3,lifetimeMs:number,generations:number,world:{nowMs:number;random:()=>number},creator?:unknown,options:{fireproof?:boolean;inControl?:boolean;engineDamaged?:boolean}={}){
  if(this.fireOn(target.key)||options.fireproof)return undefined;
  if((target.kind==='ped'||target.kind==='player')&&options.inControl===false)return undefined;
  if(target.kind==='vehicle'&&options.engineDamaged)return undefined;
  const fire=this.free();if(!fire)return undefined;
  Object.assign(fire,{active:true,script:false,beingExtinguished:false,firstGeneration:true,target,creator,generations:Math.min(MAX_FIRE_GENERATIONS,generations),strength:1,position:{...position}});
  // Integer GetRandomNumberInRange(0, 1000) is [0, 999].
  const extra=Math.trunc(999*world.random());
  fire.timeToBurn=world.nowMs+(target.kind==='player'?2333:target.kind==='vehicle'?extra+3000:extra+lifetimeMs);
  fire.fxSerial++;
  return fire;
 }
 /** CFireManager::GetNumFiresInRange: non-script fires within `radius` in 2D. */
 numFiresInRange(point:V3,radius:number){return this.fires.filter(f=>f.active&&!f.script&&Math.hypot(f.position.x-point.x,f.position.y-point.y)<=radius).length;}
 /** CFireManager::ExtinguishPoint. */
 extinguishPoint(point:V3,radius:number){for(const f of this.fires)if(f.active&&dist2(f.position,point)<=radius*radius){f.script=false;f.extinguish();}}
 /** CFireManager::ExtinguishPointWithWater and CFire::ExtinguishWithWater. */
 extinguishPointWithWater(point:V3,radius:number,waterStrength:number,dtSeconds:number){
  let any=false;
  for(const f of this.fires){
   if(!f.active||dist2(f.position,point)>radius*radius)continue;
   any=true;const before=f.strength;f.strength-=waterStrength*dtSeconds;
   if(this.onSteam){const r=this.random,at={x:f.position.x+(r()*2-1)*1.28,y:f.position.y+(r()*2-1)*1.28,z:f.position.z+(r()*2-1)*.64};this.onSteam(at,.8);this.onSteam(at,1.4);}
   f.beingExtinguished=true;
   if(f.strength<0)f.extinguish();else if(Math.trunc(before)!==Math.trunc(f.strength))f.fxSerial++;
  }
  return any;
 }
 /** CFireManager::Update: CFire::ProcessFire for every active fire. Returns the targets newly set alight. */
 update(world:FireWorld){
  const ignited:{target:FireTarget;creator?:unknown}[]=[];
  for(const fire of this.fires)if(fire.active)this.process(fire,world,ignited);
  return ignited;
 }
 /** CFire::ProcessFire (0x53A570). */
 private process(fire:NativeFire,world:FireWorld,ignited:{target:FireTarget;creator?:unknown}[]){
  // Only an integer crossing would change the strength here, which a frame's growth never makes.
  const grown=Math.min(3,fire.strength+world.timeStep/500);if(Math.trunc(fire.strength)!==Math.trunc(grown))fire.strength=grown;
  const target=fire.target;
  if(target){
   const at=world.targetPosition(target);
   if(!at){fire.extinguish();return;}
   fire.position={...at};
   if((target.kind==='ped')&&world.targetDead?.(target))fire.position.z-=1;
   if(target.kind==='vehicle'){
    if(!fire.script)world.damageVehicle?.(target,world.timeStep*1.2);
    const light=world.vehicleFirePosition?.(target);if(light)fire.position={...light};
   }
  }
  if(!target||target.kind!=='vehicle'){
   const player=world.ignitablePlayer?.();
   if(player&&dist2(player.position,fire.position)<1.2){
    const lit=this.startFireOn({kind:'player',key:player.key},player.position,7000,100,world,fire.creator);
    if(lit)ignited.push({target:{kind:'player',key:player.key},creator:fire.creator});
   }
  }
  if(Math.trunc(world.random()*32)===0){
   for(const vehicle of world.vehiclesNear?.(fire.position,2)??[]){
    const at=world.targetPosition(vehicle);if(!at)continue;
    if(this.startFireOn(vehicle,at,7000,100,world,fire.creator))ignited.push({target:vehicle,creator:fire.creator});
   }
  }
  // CCreepingFire::TryToStartFireAtCoors never starts a fire: its status table starts at zero.
  if(fire.strength<=2&&fire.generations&&Math.trunc(world.random()*16)===0){
   const nearby=this.fires[Math.trunc(world.random()*MAX_NUM_FIRES)];
   if(nearby!==fire&&nearby.active&&!nearby.script&&nearby.strength<=1&&Math.sqrt(dist2(nearby.position,fire.position))<3.5){
    nearby.position={x:nearby.position.x*.3+fire.position.x*.7,y:nearby.position.y*.3+fire.position.y*.7,z:nearby.position.z*.3+fire.position.z*.7};
    fire.strength+=1;fire.timeToBurn=Math.max(fire.timeToBurn,world.nowMs+7000);fire.fxSerial++;
    fire.generations=Math.max(fire.generations,nearby.generations);nearby.extinguish();
   }
  }
  const burning=world.nowMs<fire.timeToBurn&&Math.sqrt(dist2(world.cameraPosition,fire.position))<fire.removalDistance;
  if(fire.script||burning)return;
  if(fire.strength<=1)fire.extinguish();
  else{fire.strength-=1;fire.timeToBurn=world.nowMs+7000;fire.fxSerial++;}
 }
 clear(){for(const f of this.fires){f.extinguish();f.script=false;}}
}
const dist2=(a:V3,b:V3)=>(a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2;

/** Fires AddExplosion lights around a molotov, rocket or object blast: (rand - 2) % 4 for
 * molotovs and (rand + 1) % 4 otherwise, each within 4 units, burning 5.6 to 12.6 s x 0.4. */
export function explosionFireCount(type:'molotov'|'other',randomInt:number){
 const n=type==='molotov'?(randomInt-2)%4:(randomInt+1)%4;
 return Math.max(0,n);
}
