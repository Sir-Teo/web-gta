import {Group,Object3D,PerspectiveCamera,Sphere,Frustum,Matrix4,Vector3,type Scene} from 'three';
import {nativeAmbientState} from '../assets/nativeMaterial';
import {openStaticWorld} from '../assets/staticWorldArchive';
import {ModelReadCache,readModel} from '../assets/readModel';
import {modelObject} from '../assets/ModelObjects';
import {INTERIOR_HEIGHT,PICKUP_TYPE,type ScmPickup} from '../assets/scmPickups';
import type {Simulation} from './Simulation';
/** AmmoForWeapon_OnStreet, indexed by eWeaponType. */
export const AMMO_ON_STREET=[0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,8,8,8,8,4,4,30,10,10,15,10,10,60,60,80,80,60,20,10,4,3,100,500,5,1,500,500,36,0,0,1] as const;
/** CPickup::Update pickup radius on foot: |dz| < 2 and 2D distance < √1.8; bribes also touch a vehicle within 2 units. */
export const PICKUP_REACH={height:2,radius:Math.sqrt(1.8),bribeVehicle:2};
/** CPickup::Update regeneration: ON_STREET 30 s, ON_STREET_SLOW 36 s (bribes 30 s), then only once the player is 10 units away. */
export function regenerationSeconds(type:number,category:string){return type===PICKUP_TYPE.onStreet?30:type===PICKUP_TYPE.onStreetSlow?category==='bribe'?30:36:undefined;}
export interface PickupHost {
 /** eWeaponType for a weapon model ID, when the weapon is supported. */
 weaponForModel(model:string,modelId:number):number|undefined;
 /** CPed::GiveWeapon: adds ammunition and selects the weapon when unarmed. */
 giveWeapon(weapon:number,ammo:number):boolean;
 wantedLevel():number;setWantedLevel(level:number):void;
 armour():number;setArmour(value:number):void;
 onCollect?(pickup:ScmPickup,message?:string):void;
 /** A PICKUPSAVE disc the player walked into: the PSAVE threads run the save menu and put the player back beside it. */
 onSave?(pickup:ScmPickup):void;
}
interface State {pickup:ScmPickup;disabled:boolean;regenerateAt:number;object?:Object3D;loading:boolean}
const COLLECTABLE={horseshoe:'HO',oyster:'OY',snapshot:'SN'} as const;
/** Native CPickups for the new-game pickup set: streamed models within 100 units of the camera, collection, regeneration and collectables. */
export class WorldPickups {
 private states:State[]=[];private seconds=0;private disposed=false;private ambient=nativeAmbientState();
 private source?:ReturnType<typeof openStaticWorld>;private cache?:ModelReadCache;
 private models=new Map<string,Promise<{model:import('../assets/dff').DffModel;textures:import('../assets/modelTextures').ModelTexture[]}|undefined>>();
 /** ONCE pickups and collectables already taken, by ScmPickup id. */
 readonly collected:Set<string>;
 readonly totals={horseshoe:0,oyster:0,snapshot:0};
 error?:string;
 constructor(private sim:Simulation,private scene:Scene,private base:string,private host:PickupHost,collected=new Set<string>()){this.collected=collected;}
 setPickups(pickups:readonly ScmPickup[]){
  for(const state of this.states)state.object?.removeFromParent();
  // Interiors (z ≥ 900) are not streamed in the browser world.
  this.states=pickups.filter(p=>p.position[2]<INTERIOR_HEIGHT).map(pickup=>({pickup,disabled:this.collected.has(pickup.id),regenerateAt:0,loading:false}));
  for(const key of Object.keys(this.totals) as (keyof typeof this.totals)[])this.totals[key]=pickups.filter(p=>p.category===key).length;
 }
 counts(){const count=(category:string)=>this.states.filter(s=>s.pickup.category===category&&this.collected.has(s.pickup.id)).length;return {horseshoe:count('horseshoe'),oyster:count('oyster'),snapshot:count('snapshot')};}
 private world(p:ScmPickup){return new Vector3(p.position[0],p.position[2],-p.position[1]);}
 private load(p:ScmPickup){
  const key=`${p.model}|${p.dictionary}`.toLowerCase();let promise=this.models.get(key);
  if(!promise){
   promise=(async()=>{
    this.source??=openStaticWorld(this.base);const source=await this.source;this.cache??=new ModelReadCache(source.file,source.entries);
    const entry=source.entries.find(e=>e.name.toLowerCase()===`${p.model.toLowerCase()}.dff`),textureEntry=source.entries.find(e=>e.name.toLowerCase()===`${p.dictionary.toLowerCase()}.txd`);
    if(!entry)return undefined;const read=await readModel({file:source.file,entry,textureEntry},this.cache);return {model:read.model,textures:read.textures};
   })().catch(error=>{this.error=String(error);return undefined;});
   this.models.set(key,promise);
  }
  return promise;
 }
 /** CPickup::GiveUsAPickUpObject: SetOrientation(0, 0, −π/2) at the pickup position, no collision. */
 private spawn(state:State){
  if(state.object||state.loading)return;state.loading=true;
  void this.load(state.pickup).then(asset=>{
   state.loading=false;if(!asset||this.disposed||state.disabled||state.object)return;
   const object=modelObject(asset.model,asset.textures,undefined,undefined,{worldLighting:true,ambient:this.ambient}),holder=new Group();
   // Weapon models carry their muzzle-flash atomic, which only renders while firing.
   for(const binding of object.materialBindings)if(binding.source.texture?.toLowerCase().startsWith('muzzle'))binding.material.visible=false;
   object.root.traverse(o=>{o.frustumCulled=false;});holder.add(object.root);holder.position.copy(this.world(state.pickup));holder.userData.dispose=()=>object.dispose();
   // Oysters sit under water in the original (m_bUnderwater); they keep their script position here.
   this.scene.add(holder);state.object=holder;
  });
 }
 private despawn(state:State){if(!state.object)return;state.object.removeFromParent();(state.object.userData.dispose as (()=>void)|undefined)?.();state.object=undefined;}
 /** CPickups::Update and CPickup::Update for the player; `vehicle` is CVehicle::IsSphereTouchingVehicle for the player's vehicle. */
 step(dt:number,vehicle?:(point:Vector3,radius:number)=>boolean){
  this.seconds+=dt;const player=this.sim.player,p=player.position;
  for(const state of this.states){
   const {pickup}=state,world=this.world(pickup),distance=Math.hypot(world.x-p.x,world.y-(p.y+1),world.z-p.z);
   if(state.disabled){
    if(this.collected.has(pickup.id))continue;
    if(this.seconds>state.regenerateAt&&distance>10)state.disabled=false;else continue;
   }
   if(pickup.category==='snapshot'||player.health<=0)continue;
   const xy=Math.hypot(world.x-p.x,world.z-p.z),dz=Math.abs(p.y+1-world.y);
   const touched=pickup.category==='bribe'&&vehicle?.(world,PICKUP_REACH.bribeVehicle)||!vehicle&&dz<PICKUP_REACH.height&&xy<PICKUP_REACH.radius;
   if(touched)this.collect(state);
  }
 }
 private collect(state:State){
  const {pickup}=state,host=this.host;let message:string|undefined;
  switch(pickup.category){
   case 'armour':if(host.armour()>100-.2)return;host.setArmour(100);break;
   case 'health':if(this.sim.player.health>100-.2)return;this.sim.player.health=100;break;
   case 'bribe':if(host.wantedLevel()===0)return;host.setWantedLevel(host.wantedLevel()-1);break;
   case 'horseshoe':case 'oyster':{
    // CPickups::PickedUpHorseShoe / PickedUpOyster: $100 each, $100,000 for the full set.
    this.sim.money+=100;this.collected.add(pickup.id);const done=this.counts()[pickup.category],total=this.totals[pickup.category];
    if(done>=total){this.sim.money+=100000;message=`${COLLECTABLE[pickup.category]}_ALL`;}else message=`${COLLECTABLE[pickup.category]}_ONE ${done}/${total}`;break;
   }
   case 'weapon':{
    const weapon=host.weaponForModel(pickup.model,pickup.modelId);if(weapon===undefined)return;
    if(!host.giveWeapon(weapon,pickup.ammo||AMMO_ON_STREET[weapon]))return;break;
   }
   // PSAVE1 removes and immediately recreates the disc, so it stays where it is.
   case 'save':host.onSave?.(pickup);return;
   case 'info':case 'propertyLocked':case 'propertyForSale':case 'revenue':case 'keycard':case 'briefcase':case 'clothes':case 'other':return;
  }
  const regen=regenerationSeconds(pickup.type,pickup.category);
  if(regen!==undefined){state.regenerateAt=this.seconds+regen;state.disabled=true;}
  else{state.disabled=true;this.collected.add(pickup.id);}
  this.despawn(state);host.onCollect?.(pickup,message);
 }
 /** CPickups::PassTime: regeneration timers move forward with the clock. */
 passTime(seconds:number){this.seconds+=Math.max(0,seconds);}
 /** CPickups::PictureTaken: the nearest snapshot within 90/FOV × 20 units whose 0.2-unit sphere is on screen. */
 pictureTaken(camera:PerspectiveCamera){
  const frustum=new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  const range=90/camera.fov*20;let best:State|undefined,bestDistance=Infinity;
  for(const state of this.states){
   if(state.pickup.category!=='snapshot'||state.disabled)continue;
   const world=this.world(state.pickup),distance=world.distanceTo(camera.position);
   if(distance<range&&distance<bestDistance&&frustum.intersectsSphere(new Sphere(world,.2))){best=state;bestDistance=distance;}
  }
  if(!best)return false;
  best.disabled=true;this.collected.add(best.pickup.id);this.despawn(best);this.sim.money+=100;
  const done=this.counts().snapshot,total=this.totals.snapshot;if(done>=total)this.sim.money+=100000;
  this.host.onCollect?.(best.pickup,done>=total?'SN_ALL':`SN_ONE ${done}/${total}`);return true;
 }
 /** CPickup::IsVisible streams objects within 100 units (2D) of the camera; DoMoneyEffects/DoCollectableEffects spin them. */
 render(camera:{x:number;z:number},milliseconds:number){
  for(const state of this.states){
   const world=this.world(state.pickup),visible=!state.disabled&&Math.hypot(world.x-camera.x,world.z-camera.z)<100;
   if(!visible){this.despawn(state);continue;}
   this.spawn(state);if(!state.object)continue;
   const collectable=state.pickup.category==='horseshoe'||state.pickup.category==='oyster'||state.pickup.category==='snapshot';
   // SetRotateZOnly: 4096 ms per turn for collectables; DoPickUpEffects is not reversed, so other pickups use the 2048 ms money rate.
   const angle=collectable?(milliseconds%4096)*.0015283204:(milliseconds%2048)*.0030566407;
   state.object.rotation.set(0,angle,0);
  }
 }
 setAmbient(rgb:readonly number[]|undefined,multiplier=1){if(rgb)this.ambient.color.value.set(rgb[0]*multiplier,rgb[1]*multiplier,rgb[2]*multiplier);this.ambient.enabled.value=!!rgb;this.ambient.directMultiplier.value=1;}
 snapshot(){return {pickups:this.states.length,active:this.states.filter(s=>!s.disabled).length,spawned:this.states.filter(s=>s.object).length,collected:this.collected.size,counts:this.counts(),totals:{...this.totals},error:this.error??null};}
 dispose(){this.disposed=true;for(const state of this.states)this.despawn(state);this.states=[];}
}
