import {gxtHudText,gxtText} from '../assets/gxt';
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
 /** CPlayerInfo::m_nMaxHealth and m_nMaxArmour (100 each until a script raises them). */
 maxHealth?():number;maxArmour?():number;
 onCollect?(pickup:ScmPickup,message?:string):void;
 /** A help text a pickup shows without being taken (CHud::SetHelpMessage). */
 onNotice?(pickup:ScmPickup,text:string):void;
 /** A PICKUPSAVE disc the player walked into: the PSAVE threads run the save menu and put the player back beside it. */
 onSave?(pickup:ScmPickup):void;
 /** A jetpack the player walked into: GivePlayerGoodiesWithPickUpMI hands him CTaskSimpleJetPack. It refuses the
  * pickup while he already wears one. */
 onJetPack?():boolean;
 /** CPickups::PlayerCanPickUpThisWeaponTypeAtThisMoment: a weapon not aimed with the arm is refused on the jetpack. */
 canPickUpWeapon?(weapon:number):boolean;
}
interface State {pickup:ScmPickup;disabled:boolean;regenerateAt:number;object?:Object3D;loading:boolean;quietUntil?:number;helpShown?:boolean;
 /** PICKUP_ONCE_TIMEOUT_SLOW: the second the pickup gives up and removes itself. */
 expiresAt?:number}
const COLLECTABLE={horseshoe:'HO',oyster:'OY',snapshot:'SN'} as const;
/** Native CPickups for the new-game pickup set: streamed models within 100 units of the camera, collection, regeneration and collectables. */
export class WorldPickups {
 private states:State[]=[];private seconds=0;private disposed=false;private ambient=nativeAmbientState();
 private source?:ReturnType<typeof openStaticWorld>;private cache?:ModelReadCache;
 private models=new Map<string,Promise<{model:import('../assets/dff').DffModel;textures:import('../assets/modelTextures').ModelTexture[]}|undefined>>();
  /** ONCE pickups and collectables already taken, by ScmPickup id. */
  readonly collected:Set<string>;
  /** Session revenue accrued per revenue pickup id (ownership persists; accrual restarts each session). */
  private takings=new Map<string,number>();
 readonly totals={horseshoe:0,oyster:0,snapshot:0};
 error?:string;
 constructor(private sim:Simulation,private scene:Scene,private base:string,private host:PickupHost,collected=new Set<string>()){this.collected=collected;}
 setPickups(pickups:readonly ScmPickup[]){
  for(const state of this.states)state.object?.removeFromParent();
  // Exterior plus interior discs: interiors stream by 3D distance like exteriors.
  this.states=pickups.map(pickup=>({pickup,disabled:this.collected.has(pickup.id),regenerateAt:0,loading:false}));this.revenueLinks=undefined;
  for(const key of Object.keys(this.totals) as (keyof typeof this.totals)[])this.totals[key]=pickups.filter(p=>p.category===key).length;
 }
 counts(){const count=(category:string)=>this.states.filter(s=>s.pickup.category===category&&this.collected.has(s.pickup.id)).length;return {horseshoe:count('horseshoe'),oyster:count('oyster'),snapshot:count('snapshot')};}
 /** A pickup's renderer-space position, made once per pickup (pickups do not move); callers only read it. */
 private readonly worlds=new WeakMap<ScmPickup,Vector3>();
 private world(p:ScmPickup){let w=this.worlds.get(p);if(!w){w=new Vector3(p.position[0],p.position[2],-p.position[1]);this.worlds.set(p,w);}return w;}
 /** Each revenue pickup's property, linked once per change of the pickup list. */
 private revenueLinks?:Map<ScmPickup,ScmPickup|undefined>;
 private load(p:ScmPickup){
  const key=`${p.model}|${p.dictionary}`.toLowerCase();let promise=this.models.get(key);
  if(!promise){
   promise=(async()=>{
    this.source??=openStaticWorld(this.base);const source=await this.source;this.cache??=new ModelReadCache(source.file,source.entries);
    const entry=source.entry(`${p.model}.dff`),textureEntry=source.entry(`${p.dictionary}.txd`);
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
 /** CPickups::GenerateNewOne (0x456F20, unreversed): a pickup made during play rather than by the script, such as the
  * jetpack a flier drops. PICKUP_ONCE_TIMEOUT_SLOW pickups give up after a while; the original's timeout is in that
  * routine, so 5 minutes stands in. It is never saved. */
 generate(pickup:ScmPickup,timeoutSeconds=300){
  this.states.push({pickup,disabled:false,regenerateAt:0,loading:false,expiresAt:this.seconds+timeoutSeconds});this.revenueLinks=undefined;
 }
 /** Changes what a generated pickup carries, as a script's UPDATE_PICKUP_MONEY_PER_DAY does. */
 patchGenerated(id:string,patch:Partial<ScmPickup>){const state=this.states.find(s=>s.pickup.id===id);if(state)state.pickup={...state.pickup,...patch};}
 /** Takes a generated pickup back out of the world by the id it was made with, which is how a script's own
  * removal reaches it. */
 removeGenerated(id:string){const state=this.states.find(s=>s.pickup.id===id);if(state)this.remove(state);}
 /** Takes a generated pickup back out of the world. */
 private remove(state:State){const index=this.states.indexOf(state);if(index>=0)this.states.splice(index,1);this.revenueLinks=undefined;this.despawn(state);}
 private despawn(state:State){if(!state.object)return;state.object.removeFromParent();(state.object.userData.dispose as (()=>void)|undefined)?.();state.object=undefined;}
  /** CPickups::Update and CPickup::Update for the player; `vehicle` is CVehicle::IsSphereTouchingVehicle for the player's vehicle. */
  step(dt:number,vehicle?:(point:Vector3,radius:number)=>boolean){
   this.seconds+=dt;const player=this.sim.player,p=player.position;
   // CPickup::Update for PICKUP_ASSET_REVENUE: by the frame's own milliseconds, a day's takings every 1,440,000 ms (one
   // game day), and only while the player is more than 10 units off; PassTime does not touch it.
   if(dt>0){
    if(!this.revenueLinks){
     const forSale=this.states.map(s=>s.pickup).filter(q=>q.category==='propertyForSale');
     this.revenueLinks=new Map(this.states.filter(s=>s.pickup.category==='revenue'&&s.pickup.revenueLimit!==undefined).map(s=>[s.pickup,linkRevenue(s.pickup,forSale)]));
    }
    for(const [pickup,link] of this.revenueLinks){
     if(!link||!this.collected.has(link.id)){this.takings.delete(pickup.id);continue;}
     const w=this.world(pickup);if(Math.hypot(w.x-p.x,w.y-(p.y+1),w.z-p.z)<=10)continue;
     this.takings.set(pickup.id,Math.min(pickup.revenueLimit??0,(this.takings.get(pickup.id)??0)+dt*1000*(pickup.revenueRate??0)/1440000));
    }
   }
  // Backwards, so a timed-out pickup can remove itself without a copy of the list.
  for(let i=this.states.length-1;i>=0;i--){
   const state=this.states[i];if(!state)continue;
   const {pickup}=state,world=this.world(pickup),distance=Math.hypot(world.x-p.x,world.y-(p.y+1),world.z-p.z);
   // CPickup::Update: a timed-out pickup removes itself.
   if(state.expiresAt!==undefined&&this.seconds>state.expiresAt){this.remove(state);continue;}
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
   // CPickups::GivePlayerGoodiesWithPickUpMI fills to the player's maximum, and CPickup::Update refuses within 0.2 of it.
   case 'armour':{const max=host.maxArmour?.()??100;if(host.armour()>max-.2)return;host.setArmour(max);break;}
   case 'health':{const max=host.maxHealth?.()??100;if(this.sim.player.health>max-.2)return;this.sim.player.health=max;break;}
   // PICKUP_MONEY and MONEY_DOESNTDISAPPEAR pay the pickup's amount.
   case 'money':this.sim.money+=pickup.ammo;break;
   case 'bribe':if(host.wantedLevel()===0)return;host.setWantedLevel(host.wantedLevel()-1);break;
   case 'horseshoe':case 'oyster':{
    // CPickups::PickedUpHorseShoe / PickedUpOyster: $100 each, $100,000 for the full set.
    this.sim.money+=100;this.collected.add(pickup.id);const done=this.counts()[pickup.category],total=this.totals[pickup.category];
    if(done>=total){this.sim.money+=100000;message=`${COLLECTABLE[pickup.category]}_ALL`;}else message=`${COLLECTABLE[pickup.category]}_ONE ${done}/${total}`;break;
   }
   case 'weapon':{
    const weapon=host.weaponForModel(pickup.model,pickup.modelId);if(weapon===undefined||host.canPickUpWeapon?.(weapon)===false)return;
    if(!host.giveWeapon(weapon,pickup.ammo||AMMO_ON_STREET[weapon]))return;break;
   }
    // PSAVE1 removes and immediately recreates the disc, so it stays where it is.
    case 'save':host.onSave?.(pickup);return;
    // A locked property shows its text once (bHelpMessageDisplayed): PROP_4 unless the script gave its own label.
    case 'propertyLocked':if(!state.helpShown){state.helpShown=true;host.onNotice?.(pickup,gxtHudText(gxtText(pickup.text||'PROP_4',"You can't buy this property yet.")));}return;
    case 'propertyForSale':{
     if(this.collected.has(pickup.id))return;
     const price=pickup.price??0;
     if(this.sim.money<price){
      if(this.seconds>=(state.quietUntil??-Infinity)){state.quietUntil=this.seconds+3;host.onNotice?.(pickup,gxtHudText(gxtText('PROP_1',`Not enough cash · $${price}`)));}
      return;
     }
     this.sim.money-=price;state.disabled=true;this.collected.add(pickup.id);this.despawn(state);
     host.onCollect?.(pickup,`Property purchased · -$${price}`);return;
    }
    case 'revenue':{
     const link=linkRevenue(pickup,this.states.map(s=>s.pickup).filter(q=>q.category==='propertyForSale'));
     if(!link||!this.collected.has(link.id))return;
     const amount=Math.floor(this.takings.get(pickup.id)??0);
     // CPickup::Update refuses the pickup under $10, silently; collecting pays with the money sound and no text.
     if(amount<10)return;
     this.takings.set(pickup.id,0);this.sim.money+=amount;
     host.onCollect?.(pickup);return;
    }
    // CPickups::GivePlayerGoodiesWithPickUpMI: 20 s of adrenaline and a full sprint (ResetSprintEnergy).
   case 'adrenaline':this.sim.player.adrenaline=20;this.sim.player.stamina=100;this.sim.player.sprintExhausted=false;break;
   // CPickups::GivePlayerGoodiesWithPickUpMI: MODEL_JETPACK gives the jetpack task. CPickup::Update refuses a flier
   // who already wears one.
   case 'jetpack':if(!host.onJetPack?.())return;break;
   // Any other model has nothing to give (GivePlayerGoodiesWithPickUpMI) and is simply taken, which is what a script
   // waiting on HAS_PICKUP_BEEN_COLLECTED looks for.
   case 'info':case 'keycard':case 'briefcase':case 'clothes':case 'other':break;
  }
  const regen=regenerationSeconds(pickup.type,pickup.category);
  if(regen!==undefined){state.regenerateAt=this.seconds+regen;state.disabled=true;}
  else{state.disabled=true;this.collected.add(pickup.id);}
  this.despawn(state);host.onCollect?.(pickup,message);
 }
  /** CPickups::PassTime: regeneration timers move forward with the clock. */
  passTime(seconds:number){this.seconds+=Math.max(0,seconds);}
 /** CPickups::PictureTaken: the nearest snapshot within 90/FOV × 20 units whose 0.2-unit sphere is on screen. `fov` is
  * the camera's native FOV (the camera's zoom), not the vertical angle of the projection. */
 pictureTaken(camera:PerspectiveCamera,fov=camera.fov){
  const frustum=new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  const range=90/fov*20;let best:State|undefined,bestDistance=Infinity;
  for(const state of this.states){
   if(state.pickup.category!=='snapshot'||state.disabled)continue;
   const world=this.world(state.pickup),distance=world.distanceTo(camera.position);
   if(distance<range&&distance<bestDistance&&frustum.intersectsSphere(new Sphere(world,.2))){best=state;bestDistance=distance;}
  }
  if(!best)return false;
  // CPickups::PictureTaken pays $100,000 a photograph, and as much again for the last one.
  best.disabled=true;this.collected.add(best.pickup.id);this.despawn(best);this.sim.money+=100000;
  const done=this.counts().snapshot,total=this.totals.snapshot;if(done>=total)this.sim.money+=100000;
  this.host.onCollect?.(best.pickup,done>=total?'SN_ALL':`SN_ONE ${done}/${total}`);return true;
 }
 /** CPickup::IsVisible streams objects within 100 units of the camera; DoPickUpEffects glows them. */
 render(camera:{x:number;y:number;z:number},milliseconds:number){
  for(const state of this.states){
   const world=this.world(state.pickup),visible=!state.disabled&&Math.hypot(world.x-camera.x,world.z-camera.z)<100;
   if(!visible){this.despawn(state);continue;}
   this.spawn(state);if(!state.object)continue;
   const category=state.pickup.category,collectable=category==='horseshoe'||category==='oyster'||category==='snapshot';
   // CEntity::PreRender's pickup effects: money only turns (DoMoneyEffects, 2048 ms a turn) and a briefcase turns twice
   // as fast (DoMineEffects, 1024 ms; its red `coronaringb` torus corona and shadow are not drawn here). Everything else
   // goes through DoPickUpEffects, which is not reversed. DoCollectableEffects is for MI_COLLECTABLE1, `package1`, which
   // SA never places, so the horseshoes', oysters' and snapshots' 4096 ms turn here is AUTHORED, as are the others'
   // money turn and breathing scale.
   const angle=category==='briefcase'?(milliseconds%1024)*.0061132815:collectable?(milliseconds%4096)*.0015283204:(milliseconds%2048)*.0030566407;
   state.object.rotation.set(0,angle,0);
   state.object.scale.setScalar(category==='money'||category==='briefcase'?1:1+Math.sin(milliseconds*0.006+world.x)*0.08);
  }
 }
 setAmbient(rgb:readonly number[]|undefined,multiplier=1){if(rgb)this.ambient.color.value.set(rgb[0]*multiplier,rgb[1]*multiplier,rgb[2]*multiplier);this.ambient.enabled.value=!!rgb;this.ambient.directMultiplier.value=1;}
 snapshot(){return {pickups:this.states.length,active:this.states.filter(s=>!s.disabled).length,spawned:this.states.filter(s=>s.object).length,collected:this.collected.size,counts:this.counts(),totals:{...this.totals},error:this.error??null,
   // The pickups a script made, which it can ask after by the handle it holds them with.
   scripted:this.states.filter(s=>s.pickup.section==='script').map(s=>({id:s.pickup.id,drawn:!!s.object}))};}
  dispose(){this.disposed=true;for(const state of this.states)this.despawn(state);this.states=[];}
}
/** Asset revenue linkage (authored): each revenue pickup belongs to its nearest
 * for-sale property within half a kilometre. Native linkage is script state. */
export function linkRevenue(revenue:ScmPickup,forSale:readonly ScmPickup[]){
 let best:ScmPickup|undefined,bestDistance=500;
 for(const property of forSale){
  const d=Math.hypot(property.position[0]-revenue.position[0],property.position[1]-revenue.position[1],property.position[2]-revenue.position[2]);
  if(d<bestDistance){bestDistance=d;best=property;}
 }
 return best;
}
