import {stepNpcGun,type NpcGunState} from './npcGun';
import type {DamageKind} from '../weapons/WeaponSystem';
import {characterMovement} from './characterMovement';
import { NATIVE_UNARMED_STAGES, NATIVE_UNARMED_RANGE, NATIVE_UNARMED_GROUND_DAMAGE, NATIVE_UNARMED_MOVING_DAMAGE, NATIVE_UNARMED_GROUND_HIT, NATIVE_UNARMED_MOVING_HIT, attackLineDistance } from './nativeMelee';
import { onscreenSpawnBand, offscreenSpawnBand, pedCreationDistMultiplier, gangPartySize, gangFormationOffset } from './nativePopulation';
import RAPIER from '@dimforge/rapier3d-compat';
import {Vector3,type Scene} from 'three';
import {modelObject} from '../assets/ModelObjects';
import type {WantedSystem} from './WantedSystem';
import {CRIME} from './nativeWanted';
import {NativeCharacter} from '../render/NativeCharacter';
import {openWorldPedestrians} from '../assets/worldPedestrians';
import type {PathNode} from '../assets/pathNodes';
import type {Simulation} from './Simulation';
import type {WorldCar} from './WorldCar';

type Catalog=Awaited<ReturnType<typeof openWorldPedestrians>>;
interface Pedestrian {
 id:number;deadTime:number; officer:boolean;arrest:number;gun?:ReturnType<typeof modelObject>; health:number; actor:Pick<Simulation,'player'>; body:RAPIER.RigidBody; collider:RAPIER.Collider;
 controller:RAPIER.KinematicCharacterController; view:NativeCharacter; target:PathNode; previousNode?:PathNode;
 weapon?:NonNullable<Catalog['weapon']>;gunState?:NpcGunState;aimPoint?:{x:number;y:number;z:number};flash:number;
 down:number; flee:number;fleeFrom?:{x:number;z:number}; impulse:{x:number;z:number}; blocked:number;
 /** Seconds into CTaskSimpleStealthKill as the victim. */
 stealth?:number;
 /** Street brawl: counts down while this ped fights the player back (EVENT_DAMAGE). */
 retaliate:number;retaliateCooldown:number;
 /** A cop who left a police car seat (CPed::m_pVehicle), and the door point it is heading back to. */
 crew?:{unit:object;seat:number};goTo?:{x:number;z:number;walk:boolean};
 /** Nightstick beat-down pacing per officer. */
 meleeCooldown:number;
 /** Variant root-motion speeds (animgrp.dat walkcycle via peds.ide), defaulting to `man`. */
 walkSpeed:number;runSpeed:number;sprintSpeed:number;
 /** pedstats.dat damage multipliers for this ped's stat row (1.0/1.0 ordinary). */
 attackMult:number;defendMult:number;
 /** pedstats.dat temper: 60+ hotheads trade punches, the rest flee. */
 temper:number;
 /** Hit-reaction stagger: a struck ped reels briefly instead of sprinting on
  * (CTaskSimpleHit tasks own locomotion mid-reaction; 0.5 s authored). */
 stagger:number;
 /** Smoothed locomotion speed toward the gait target (CPed velocity easing). */
 gait:number;
 /** pedgrp.dat gang index for turf party members; civilians stay undefined. */
 gang?:number;
}
/** Bounded civilian population on native sidewalk links, sharing the physics world. */
/** Native ped locomotion speeds (m/s) from ped.ifp root motion in the verified
 * depot: WALK_civi 1.725m/1.133s = 1.522, RUN_civi 3.156m/0.733s = 4.304,
 * SPRINT_panic 3.542m/0.6s = 5.903. Replaces authored 1.2/3.7/3.8. */
export const NATIVE_PED_WALK_SPEED = 1.522;
export const NATIVE_PED_RUN_SPEED = 4.304;
export const NATIVE_PED_SPRINT_SPEED = 5.903;
/** pedstats.dat STAT_PLAYER row: attack strength 3.0x, defend weakness 0.4x.
 * Ordinary street peds use 1.0/1.0. Applied to player punch damage dealt and
 * damage taken so brawls match the native stat table instead of flat values. */
export const NATIVE_PLAYER_ATTACK_MULT = 3.0;
export const NATIVE_PLAYER_DEFEND_MULT = 0.4;
/** melee.dat UNARMED range re-exported from the native table (targetRange 10.0
 * is the AI acquisition range). The browser punch uses the 1.6 m strike reach. */
export { NATIVE_UNARMED_RANGE } from './nativeMelee';
/** Authored obstacle slide: rotate the desired direction ±65° while blocked so
 * pedestrians slide around obstacles instead of pushing straight into them. */
export function sidestepDirection(dx:number,dz:number,side:1|-1){const a=side*Math.PI*.36,c=Math.cos(a),s=Math.sin(a);return {x:dx*c-dz*s,z:dx*s+dz*c};}
export class WorldPedestrians {
 private people:Pedestrian[]=[];
 onShot?:(from:{x:number;y:number;z:number},to:{x:number;y:number;z:number},weapon:number,hit:boolean)=>void;
 /** CPed::PlayFootSteps for a walking, running or sprinting pedestrian (browser position one unit above the feet, like the player's). */
 onFootstep?:(ped:object,position:{x:number;y:number;z:number},move:'walk'|'run'|'sprint',foot:'left'|'right')=>void;
 playerArmed:()=>boolean=()=>false;
 canSpawn:(point:{x:number;y:number;z:number},radius:number)=>boolean=()=>true;
 private catalog?:Catalog;
 private disposed=false;
 private busy=false;
 private nextCheck=0;
 private nextId=0;
 private routeChoice=0;
  private cooldown=0;
  private combo=0;
  private lastPunchAt=-10;
  private pendingStrikes:{target:number;heading:number;damage:number;delay:number;ground:boolean;combo:number}[]=[];
  private hits=0;
 private error?:string;
 constructor(private sim:Simulation,private scene:Scene,base:string,private playerView:()=>NativeCharacter|undefined,private law?:WantedSystem){
  void openWorldPedestrians(base,!!law).then(c=>{if(this.disposed)return;this.catalog=c;this.installPlayerReactions();}).catch(e=>{this.error=String(e);});
 }
  private reactions(c:Catalog){return {...Object.fromEntries(['fighta_1','fighta_2','fighta_3','ko_skid_front','getup_front','hit_front','hit_back','hit_l','hit_r'].filter(n=>c.animations[n]).map(n=>[n,c.animations[n]])),...Object.fromEntries(['kill_knife_ped_damage','kill_knife_ped_die','kill_knife_player'].filter(n=>c.stealth[n]).map(n=>[n,c.stealth[n]]))};}
 private reactionOwner?:NativeCharacter;
 /** The player uses KILL_Partial as an upper-body partial and KILL_Knife_Player as a full-body clip. */
 installPlayerReactions(){const view=this.playerView(),c=this.catalog;if(!view||!c||view===this.reactionOwner)return;this.reactionOwner=view;view.installReactions(this.reactions(c));if(c.stealth.kill_partial)view.installReactions({kill_partial:c.stealth.kill_partial},true);}
 /** CPedIntelligence::TestForStealthKill(target,false): a standing, unhurried victim within 2.5 m, facing away. */
 stealthTarget(origin:{x:number;y:number;z:number}){
  if(!this.catalog?.stealth.kill_knife_ped_die)return undefined;
  return this.people.filter(p=>p.health>=1&&p.down===0&&p.stealth===undefined&&p.actor.player.speed<3).map(p=>{const q=p.actor.player.position,dx=q.x-origin.x,dz=q.z-origin.z,dy=q.y-origin.y;return {p,dx,dz,dy,d2:dx*dx+dy*dy+dz*dz};})
   .filter(t=>t.d2<=2.5*2.5&&Math.abs(t.dy)<1&&t.dx*Math.sin(t.p.actor.player.heading)+t.dz*Math.cos(t.p.actor.player.heading)>0).sort((a,b)=>a.d2-b.d2).map(t=>({id:t.p.id,officer:t.p.officer,handle:t.p.collider.handle,position:{...t.p.actor.player.position},heading:t.p.actor.player.heading}))[0];
 }
 /** CTaskSimpleStealthKill victim: KILL_Knife_Ped_Damage, then KILL_Knife_Ped_Die with death. */
 stealthKill(id:number,attacker:{x:number;z:number}){
  const p=this.people.find(p=>p.id===id);if(!p||p.health<=0||p.down>0)return false;
  const q=p.actor.player.position;p.actor.player.heading=Math.atan2(q.x-attacker.x,q.z-attacker.z);p.stealth=0;p.flee=0;p.impulse={x:0,z:0};p.actor.player.speed=0;
  p.view.playReaction('kill_knife_ped_damage');return true;
 }
 snapshot(){return {ready:!!this.catalog,pending:this.busy,error:this.error??null,hits:this.hits,people:this.people.map(p=>({id:p.id,officer:p.officer,weapon:p.weapon?.info.type,gun:p.gunState&&{...p.gunState},position:{...p.actor.player.position},heading:p.actor.player.heading,health:p.health,state:p.stealth!==undefined&&p.health>0?'stealth':p.health<=0?'dead':p.down>0?'down':p.gunState?.reload?'reload':p.gunState?.active?'shoot':p.flee>0?'flee':'walk',visible:p.view.root.visible}))};}
  /** Player damage to a pedestrian; the weapon system reports the native crime for the returned victim. */
  damageCollider(handle:number,damage:number,direction:{x:number;z:number},kind:DamageKind='bullet'){
   const p=this.people.find(p=>p.collider.handle===handle);if(!p||p.health<=0)return false;
   // Keep the existing melee strength modifier separate from weapon.dat bullet damage.
   p.health=Math.max(0,p.health-damage*(kind==='melee'?NATIVE_PLAYER_ATTACK_MULT:1));
   if(kind==='explosion'||kind==='melee'||p.health===0)this.hit(p,direction.x,direction.z,Math.min(7,damage*.1));
   else {this.hits++;p.view.playReaction('hit_front');p.stagger=0.5;this.frighten(p.actor.player.position,12);}
  if(p.health===0){p.down=Infinity;p.view.playReaction('ko_skid_front',Infinity);}
  return {id:p.id,officer:p.officer};
 }
 /** CWanted::WorkOutPolicePresence: living officers within `radius` of a point. */
 policePresence(point:{x:number;y:number;z:number},radius:number){return this.people.filter(p=>p.officer&&p.health>0&&Math.hypot(p.actor.player.position.x-point.x,p.actor.player.position.y+1-point.y,p.actor.player.position.z-point.z)<radius).length;}
 frighten(position:{x:number;z:number},radius:number){for(const p of this.people)if(!p.officer&&p.health>0&&Math.hypot(p.actor.player.position.x-position.x,p.actor.player.position.z-position.z)<radius){p.flee=Math.max(p.flee,8);p.fleeFrom={...position};}}
 targets(){return this.people.filter(p=>p.health>0).map(p=>({handle:p.collider.handle,position:{...p.body.translation()}}));}
 private remove(p:Pedestrian){p.gun?.dispose();p.view.dispose();this.sim.world.removeCharacterController(p.controller);this.sim.world.removeRigidBody(p.body);}
  update(now:number){
   if(this.disposed||!this.catalog||this.busy||now<this.nextCheck)return;
   this.nextCheck=now+1500;
   const player=this.sim.player.position;
   // Native ManagePed bands (re3/CPopulation): live peds survive to 51 m
   // (65 m far-cull), dead peds fade after 30 s. Visible peds are never
   // removed outright; the grace keeps recent spawns from flickering.
   this.people=this.people.filter(p=>{if(!this.canSpawn(p.actor.player.position,2))return true;const d=Math.hypot(p.actor.player.position.x-player.x,p.actor.player.position.z-player.z);if(p.health<=0)return p.deadTime<30&&d<51;return d<65&&p.actor.player.position.y>player.y-25;});
   const catalog=this.catalog;this.busy=true;
   void catalog.loadAround(player.x,player.z).then(async()=>{
    if(this.disposed)return;
    const center=this.sim.player.position;
    // Native creation bands: offscreen 15-25 m, onscreen 40-50 m (PCDM=1 on
    // foot). The visibility guard (canSpawn) already rejects onscreen nodes,
    // so the filter accepts the union 15-50 m and lets the guard pick the band.
    const pcdm=pedCreationDistMultiplier(0),on=onscreenSpawnBand(pcdm),off=offscreenSpawnBand(pcdm);
    const minD=Math.min(on.min,off.min),maxD=Math.max(on.max,off.max);
    const nodes=[...catalog.areas.values()].flatMap(a=>a.nodes).filter(n=>this.allowed(n)&&Math.hypot(n.position[0]-center.x,-n.position[1]-center.z)<maxD&&Math.hypot(n.position[0]-center.x,-n.position[1]-center.z)>minD).sort((a,b)=>Math.hypot(a.position[0]-center.x,-a.position[1]-center.z)-Math.hypot(b.position[0]-center.x,-b.position[1]-center.z));
    for(const node of nodes){
     const desiredOfficers=this.footOfficerLimit(),officer=!!catalog.officer&&this.people.filter(p=>p.officer&&p.health>0).length<desiredOfficers;
     const cap=this.limits?.()??{civilians:12,total:18};
     if(this.people.length>=cap.total||!officer&&this.people.filter(p=>!p.officer).length>=cap.civilians)break;
    const x=node.position[0],z=-node.position[1];
    if(officer&&Math.hypot(x-center.x,z-center.z)<35)continue;
    if(!this.canSpawn({x,y:node.position[2]+1,z},2))continue;
    // Turf gangs claim the node first (CPopulation gang-density roll): the
    // party holds formation instead of joining the civilian round-robin.
    if(!officer){
     const turf=this.gangTurf?.(x,z);
     if(turf&&turf.gang>=0&&turf.gang<10&&Math.random()*255<turf.strength){
      const size=gangPartySize(Math.floor(Math.random()*100));
      if(size>0&&this.people.length+size<=cap.total){await this.spawnGangParty(turf.gang,size,node,center);}
      continue;
     }
    }
    if(this.people.some(p=>Math.hypot(p.actor.player.position.x-x,p.actor.player.position.z-z)<5))continue;
    const top=node.position[2]+3,hit=this.sim.world.castRay(new RAPIER.Ray({x,y:top,z},{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
    if(!hit)continue;
    const position={x,y:top-hit.timeOfImpact+.03,z},modelIndex=this.nextId%catalog.models.length;
    const speeds=officer?catalog.officerSpeeds??{walk:NATIVE_PED_WALK_SPEED,run:NATIVE_PED_RUN_SPEED,sprint:NATIVE_PED_SPRINT_SPEED}:catalog.modelSpeeds[modelIndex]??{walk:NATIVE_PED_WALK_SPEED,run:NATIVE_PED_RUN_SPEED,sprint:NATIVE_PED_SPRINT_SPEED};
    const stats=officer?catalog.officerStats??{attack:1,defend:1}:catalog.modelStats[modelIndex]??{attack:1,defend:1};
    const p=this.createPed({position,heading:this.sim.player.heading,source:officer?catalog.officer!:catalog.models[modelIndex],officer,node,weapon:officer?catalog.weapon:undefined,speed:speeds.walk,speeds,stats});
    this.chooseTarget(p);
   }
  }).catch(e=>{this.error=String(e);}).finally(()=>{this.busy=false;});
 }
   /** Officers the street spawner may add: the native pursuit cap (CWanted::m_MaxCopsInPursuit) less cops already committed elsewhere. */
   footOfficerLimit:()=>number=()=>this.law?.native.maxCopsInPursuit??0;
   /** Popcycle density caps for the current zone and clock (fleet provider; 12/18 fallback). */
   limits?:()=>{civilians:number;total:number}|undefined;
   /** Gang turf at a native point: pedgrp.dat gang index 0–9 with INITIAL strength 0–255. */
   gangTurf?:(x:number,z:number)=>{gang:number;strength:number}|undefined;
  /** A turf gang party (CPopulation::AddToPopulation + PlaceGangMembers):
   * native party size with formation offsets around the leader's node. */
  private async spawnGangParty(gang:number,size:number,node:PathNode,center:{x:number;z:number}){
   const catalog=this.catalog!;
   const members=catalog.gangs[gang]??[];
   if(!members.length)return;
   let leader:Pedestrian|undefined;
   for(let i=0;i<size;i++){
    if(this.disposed)return;
    const model=members[Math.floor(Math.random()*members.length)];
    const offset=i===0?{x:0,z:0}:gangFormationOffset(i);
    const x=node.position[0]+offset.x,z=-node.position[1]+offset.z;
    if(Math.hypot(x-center.x,z-center.z)>65)continue;
    if(!this.canSpawn({x,y:node.position[2]+1,z},2))continue;
    const top=node.position[2]+3,hit=this.sim.world.castRay(new RAPIER.Ray({x,y:top,z},{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
    if(!hit)continue;
    let built:{source:import('../render/NativeCharacter').CharacterSource;speeds:{walk:number;run:number;sprint:number};stats:{attack:number;defend:number}};
    try{built={source:await catalog.character(model),speeds:await catalog.characterSpeeds(model),stats:await catalog.characterStats(model)};}
    catch{return;}
    const position={x,y:top-hit.timeOfImpact+.03,z};
    const p=this.createPed({position,heading:this.sim.player.heading,source:built.source,officer:false,node,weapon:undefined,speed:built.speeds.walk,speeds:built.speeds,stats:built.stats,gang});
    if(leader){p.target=leader.target;p.previousNode=leader.previousNode;}
    else{this.chooseTarget(p);leader=p;}
   }
  }
  private createPed(o:{position:{x:number;y:number;z:number};heading:number;source:import('../render/NativeCharacter').CharacterSource;officer:boolean;node:PathNode;weapon?:Awaited<Catalog['weapon']>;flee?:number;speed?:number;speeds?:{walk:number;run:number;sprint:number};stats?:{attack:number;defend:number;temper?:number};gang?:number}){
  const catalog=this.catalog!,body=this.sim.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(o.position.x,o.position.y+.9,o.position.z));
  const collider=this.sim.world.createCollider(RAPIER.ColliderDesc.capsule(.6,.3),body),controller=this.sim.world.createCharacterController(.025);
  controller.enableAutostep(.3,.2,false);controller.enableSnapToGround(.25);
  const view=new NativeCharacter(o.source);view.installReactions(this.reactions(catalog));view.startFirstCycleAt(Math.random());this.scene.add(view.root);
  let gun:ReturnType<typeof modelObject>|undefined;
  if(o.officer&&o.weapon?.asset){const asset=o.weapon.asset;gun=modelObject(asset.model,asset.textures);gun.root.rotation.set(0,0,0);gun.root.traverse(obj=>{const i=obj.userData.nativeFrame;if(i!==undefined&&asset.model.frames[i].parent<0)obj.matrix.identity();delete obj.userData.nativeFrame;});view.hand()?.add(gun.root);if(o.weapon.clip)view.installReactions({police_fire:o.weapon.clip},true);if(o.weapon.reloadClip)view.installReactions({police_reload:o.weapon.reloadClip},true);}
  const p:Pedestrian={id:this.nextId++,weapon:o.weapon,gunState:o.weapon?{time:0,rounds:o.weapon.info.clip,reload:0,active:false}:undefined,flash:0,deadTime:0,officer:o.officer,arrest:0,gun,health:o.officer?150:100,actor:{player:{...this.sim.player,position:{...o.position},previous:{...o.position},heading:o.heading,health:100,stamina:100,crouched:false,grounded:true,speed:o.speed??0}},body,collider,controller,view,target:o.node,down:0,flee:o.flee??0,impulse:{x:0,z:0},blocked:0,retaliate:0,retaliateCooldown:0,meleeCooldown:0,walkSpeed:o.speeds?.walk??NATIVE_PED_WALK_SPEED,runSpeed:o.speeds?.run??NATIVE_PED_RUN_SPEED,sprintSpeed:o.speeds?.sprint??NATIVE_PED_SPRINT_SPEED,attackMult:o.stats?.attack??1,defendMult:o.stats?.defend??1,temper:o.stats?.temper??50,stagger:0,gait:o.speed??0,gang:o.gang};
  this.people.push(p);return p;
 }
 private nearestNode(position:{x:number;z:number}){return [...(this.catalog?.areas.values()??[])].flatMap(a=>a.nodes).filter(n=>this.allowed(n)).sort((a,b)=>Math.hypot(a.position[0]-position.x,-a.position[1]-position.z)-Math.hypot(b.position[0]-position.x,-b.position[1]-position.z))[0];}
  /** Living on-foot pedestrians as wading walkers for foot splashes (stable keys). */
  walkers(){return this.people.filter(p=>p.health>0&&p.down===0).map(p=>({key:p as object,position:{...p.actor.player.position},speed:p.actor.player.speed,grounded:true}));}
  /** A driver dragged out or leaving a car becomes a street ped that flees (the usual decision-maker response to EVENT_DRAGGED_OUT_CAR). */
  spawnFleeing(modelIndex:number,position:{x:number;y:number;z:number},heading:number){
  const catalog=this.catalog;if(!catalog||this.disposed)return false;
  const node=this.nearestNode(position);if(!node)return false;
  this.createPed({position,heading,source:catalog.models[modelIndex%catalog.models.length],officer:false,node,flee:8,speeds:catalog.modelSpeeds[modelIndex%catalog.models.length],stats:catalog.modelStats[modelIndex%catalog.models.length]});return true;
 }
 /** A police crew member stepping out of a cop car (CCopPed type model and weapon). */
 async spawnOfficer(model:string,weapon:number,position:{x:number;y:number;z:number},heading:number,crew?:{unit:object;seat:number}){
  const catalog=this.catalog;if(!catalog||this.disposed)return false;
  const [built,armed]=await Promise.all([catalog.character(model).then(async source=>({source,speeds:await catalog.characterSpeeds(model),stats:await catalog.characterStats(model)})),catalog.armedWith(weapon)]);
  const node=this.nearestNode(position);if(!node||this.disposed)return false;
  this.createPed({position,heading,source:built.source,officer:true,node,weapon:armed,speeds:built.speeds,stats:built.stats}).crew=crew;return true;
 }
 /** A police unit's living crew on foot. */
 footCrew(unit:object){return this.people.filter(p=>p.crew?.unit===unit&&p.health>0).map(p=>({id:p.id,seat:p.crew!.seat,position:{...p.actor.player.position},down:p.down>0||p.stealth!==undefined}));}
 /** CTaskComplexGoToCarDoorAndStandStill: run to a car door point, walking within 4 units; undefined resumes the pursuit. */
 sendOfficer(id:number,point?:{x:number;z:number},walk=false){const p=this.people.find(p=>p.id===id);if(p)p.goTo=point&&{...point,walk};}
 /** The cop reached the door: the car's entry sequence takes over from the street ped. */
 boardOfficer(id:number){const i=this.people.findIndex(p=>p.id===id);if(i<0)return false;this.remove(this.people[i]);this.people.splice(i,1);return true;}
 private allowed(n:PathNode){return n.kind==='pedestrian'&&!n.water&&!n.switchedOff&&!n.dontWander&&n.linkCount>0;}
 private chooseTarget(p:Pedestrian){
  const a=this.catalog?.areas.get(p.target.address.area);if(!a)return;
  const options=a.links.slice(p.target.baseLink,p.target.baseLink+p.target.linkCount).map(ref=>this.catalog?.areas.get(ref.area)?.nodes[ref.node]).filter((n):n is PathNode=>!!n&&this.allowed(n));
  const choices=options.filter(n=>n!==p.previousNode),next=(choices.length?choices:options)[(p.id+this.routeChoice++)%Math.max(1,choices.length||options.length)];
  if(next){p.previousNode=p.target;p.target=next;}
 }
 private hit(p:Pedestrian,x:number,z:number,strength:number){
  if(p.down>0)return;
  p.down=3.5;p.flee=8;this.hits++;
  const length=Math.hypot(x,z)||1;p.impulse={x:x/length*strength,z:z/length*strength};
  p.view.playReaction('ko_skid_front',3.5);
  // A low collider allows the vehicle to pass over a knocked-down civilian.
  p.collider.setShape(new RAPIER.Ball(.3));
  this.frighten(p.actor.player.position,12);p.fleeFrom={x:p.actor.player.position.x-x/length*2,z:p.actor.player.position.z-z/length*2};
 }
  punch(){
   if(this.cooldown>0||this.sim.player.health<=0||!this.sim.player.grounded||this.sim.player.crouched)return false;
   // Native UNARMED_1 chain (melee.dat frames/30): stage chains
   // 0.333/0.567/0.667 s open the next link; damage lands on the hit frame.
   // Only landed strikes advance the chain: whiffs swing (cooldown) and reset
   // to the jab, so a fresh exchange always opens jab, cross, hook.
   const now=typeof performance!=='undefined'?performance.now()/1000:0;
   const prevStage=NATIVE_UNARMED_STAGES[this.combo];
   const next=this.combo=(now-this.lastPunchAt<prevStage.chain+0.25?(this.combo+1)%3:0);
   const stage=NATIVE_UNARMED_STAGES[next];
   const anim=next===1?'fighta_2':next===2?'fighta_3':'fighta_1';
   this.cooldown=stage.chain;
   // Lock on via FindPedToAttack: closest to the camera-forward line (gang discount).
   // Lock-on only corrects inside the frontal cone: swings from behind whiff
   // instead of snapping the fighter 180° (CTaskSimpleFight faces first, the
   // hit lands only while aligned at its hit frame).
   const origin=this.sim.player.position;let heading=this.sim.player.heading;
   const fwd={x:Math.sin(heading),z:Math.cos(heading)};
   const frontal=(dx:number,dz:number,hx:number,hz:number)=>Math.hypot(dx,dz)<1e-4||(dx*hx+dz*hz)/Math.hypot(dx,dz)>.35;
   const candidate=this.people.filter(p=>p.health>0).map(p=>({p,dx:p.actor.player.position.x-origin.x,dz:p.actor.player.position.z-origin.z,dy:p.actor.player.position.y-origin.y}))
    .filter(t=>Math.hypot(t.dx,t.dz)<NATIVE_UNARMED_RANGE+0.6&&Math.abs(t.dy)<1&&frontal(t.dx,t.dz,fwd.x,fwd.z))
    .sort((a,b)=>attackLineDistance(origin,fwd,{x:a.p.actor.player.position.x,z:a.p.actor.player.position.z},false)-attackLineDistance(origin,fwd,{x:b.p.actor.player.position.x,z:b.p.actor.player.position.z},false))[0];
   if(candidate){heading=Math.atan2(candidate.dx,candidate.dz);this.sim.player.heading=heading;}
   this.playerView()?.playReaction(this.catalog?.animations[anim]?anim:'fighta_1',.55);
   const moving=this.sim.player.speed>6;
   const target=this.people.filter(p=>p.health>0).map(p=>({p,dx:p.actor.player.position.x-origin.x,dz:p.actor.player.position.z-origin.z,dy:p.actor.player.position.y-origin.y})).filter(t=>Math.hypot(t.dx,t.dz)<NATIVE_UNARMED_RANGE&&Math.abs(t.dy)<1&&(t.dx*Math.sin(heading)+t.dz*Math.cos(heading))/Math.max(.01,Math.hypot(t.dx,t.dz))>.35).sort((a,b)=>Math.hypot(a.dx,a.dz)-Math.hypot(b.dx,b.dz))[0];
   if(target){
    const distance=Math.hypot(target.dx,target.dz),ray=new RAPIER.Ray({...origin,y:origin.y+1},{x:distance>1e-4?target.dx/distance:Math.sin(heading),y:0,z:distance>1e-4?target.dz/distance:Math.cos(heading)});
    if(distance>.01&&this.sim.world.castRay(ray,distance,true,RAPIER.QueryFilterFlags.ONLY_FIXED)){this.combo=0;return false;}
    const ground=target.p.down>0;
    // AGROUND 25 vs downed victims, AMOVING 5 while sprinting, else stage damage.
    const base=ground?NATIVE_UNARMED_GROUND_DAMAGE:moving?NATIVE_UNARMED_MOVING_DAMAGE:stage.damage;
    const delay=ground?NATIVE_UNARMED_GROUND_HIT:moving?NATIVE_UNARMED_MOVING_HIT:stage.hit;
    this.lastPunchAt=now;
    this.pendingStrikes.push({target:target.p.id,heading,damage:base,delay,ground,combo:next});
    return true;
   }
   this.combo=0;
   return false;
  }
  private resolveStrike(s:{target:number;heading:number;damage:number;ground:boolean;combo:number}){
   const target=this.people.find(p=>p.id===s.target);if(!target||target.health<=0)return;
   const origin=this.sim.player.position;
   const dx=target.actor.player.position.x-origin.x,dz=target.actor.player.position.z-origin.z;
   if(Math.hypot(dx,dz)>NATIVE_UNARMED_RANGE+0.3||Math.abs(target.actor.player.position.y-origin.y)>1.2)return;
   // Hit-frame alignment: turning away during the swing wastes the strike.
   const hx=Math.sin(this.sim.player.heading),hz=Math.cos(this.sim.player.heading),flat=Math.hypot(dx,dz);
   if(flat>1e-4&&(dx*hx+dz*hz)/flat<=.35)return;
   this.law?.crime(target.officer?CRIME.damagedCop:CRIME.damagedPed,`ped:${target.id}`);this.law?.registerCrime(target.officer?CRIME.damagedCop:CRIME.damagedPed,`ped:${target.id}`);
   target.health=Math.max(0,target.health-s.damage*NATIVE_PLAYER_ATTACK_MULT*target.defendMult);
   if(s.combo===2||s.ground||!target.health){this.hit(target,Math.sin(s.heading),Math.cos(s.heading),4);if(!target.health){target.down=Infinity;target.view.playReaction('ko_skid_front',Infinity);}}
   else{this.hits++;target.view.playReaction('hit_front');target.stagger=0.5;this.frighten(target.actor.player.position,12);}
   // pedstats.dat temper decides the EVENT_DAMAGE response: hotheads (60+)
   // stand and trade punches (CTaskComplexFight), the rest flee.
   if(!target.officer&&target.health>0&&(target.temper>=60||target.retaliate>0)){target.retaliate=6;target.flee=0;}
   else if(!target.officer){target.flee=Math.max(target.flee,8);target.fleeFrom={...origin};}
  }
  beforeStep(dt:number,cars:Iterable<WorldCar>){
   this.cooldown=Math.max(0,this.cooldown-dt);
   for(let i=this.pendingStrikes.length-1;i>=0;i--){const s=this.pendingStrikes[i];s.delay-=dt;if(s.delay<=0){this.pendingStrikes.splice(i,1);this.resolveStrike(s);}}
   this.installPlayerReactions();
  for(const p of this.people){
   const state=p.actor.player;if(p.health<=0)p.deadTime+=dt;state.previous={...state.position};
   if(p.stealth!==undefined&&p.health>0){
    const damage=this.catalog?.stealth.kill_knife_ped_damage?.duration??2.23;p.stealth+=dt;
    if(p.stealth>=damage){p.health=0;p.down=Infinity;p.collider.setShape(new RAPIER.Ball(.3));p.view.playReaction('kill_knife_ped_die',Infinity);}
    else{p.view.step(dt,{x:0,y:0,cameraYaw:state.heading,walk:true,sprint:false,jump:false},p.actor);continue;}
   }
   for(const car of cars){
    if(!car.car.body.isEnabled())continue;
    const velocity=car.car.body.linvel(),speed=Math.hypot(velocity.x,velocity.z);if(speed<2||p.down>0)continue;
    for(let i=0;i<car.car.body.numColliders();i++){
     const collider=car.car.body.collider(i);
     if(!collider.isSensor()&&collider.intersectsShape(new RAPIER.Capsule(.6,.42),p.body.translation(),p.body.rotation())){this.hit(p,velocity.x,velocity.z,Math.min(10,speed*.6));if(car.occupied)this.law?.registerCrime(p.officer?CRIME.killCopPedWithCar:CRIME.killPedWithCar,`ped:${p.id}`);break;}
    }
   }
   if(p.down>0){
    p.down=Math.max(0,p.down-dt);
    if(p.down<=.7&&p.down+dt>.7)p.view.playReaction('getup_front',.7,true);
    if(p.down===0){
     const position=p.body.translation(),standing={...position,y:position.y+.6};
     const shape=new RAPIER.Capsule(.6,.3);
     if(this.sim.world.intersectionWithShape(standing,p.body.rotation(),shape,undefined,undefined,p.collider,p.body)){p.down=.8;p.view.playReaction('ko_skid_front',.8);}
     else {p.collider.setShape(shape);p.body.setTranslation(standing,true);p.collider.setTranslation(standing);}
    }
   }else p.flee=Math.max(0,p.flee-dt);
   p.retaliate=Math.max(0,p.retaliate-dt);p.retaliateCooldown=Math.max(0,p.retaliateCooldown-dt);p.meleeCooldown=Math.max(0,p.meleeCooldown-dt);p.stagger=Math.max(0,p.stagger-dt);
   let dx=p.target.position[0]-state.position.x,dz=-p.target.position[1]-state.position.z;
   if(Math.hypot(dx,dz)<.8||p.blocked>2){this.chooseTarget(p);p.blocked=0;dx=p.target.position[0]-state.position.x;dz=-p.target.position[1]-state.position.z;}
   if(!p.officer&&p.flee>0&&p.down===0&&p.retaliate<=0){const threat=p.fleeFrom??this.sim.player.position;dx=state.position.x-threat.x;dz=state.position.z-threat.z;}
   // Street retaliation: tough victims stop fleeing and trade punches (CTaskComplexFight).
   if(!p.officer&&p.retaliate>0&&p.health>0&&p.down===0&&this.sim.player.health>0){
     const target=this.sim.player.position;
     dx=target.x-state.position.x;dz=target.z-state.position.z;
     const dist=Math.hypot(dx,dz);
     if(dist<1.7&&p.retaliateCooldown<=0){
       p.retaliateCooldown=0.9;state.heading=Math.atan2(dx,dz);
       p.view.playReaction(this.catalog?.animations['fighta_1']?'fighta_1':'hit_front',0.5);
       // pedstats.dat attack strength for this ped's stat row (STAT_PLAYER defend applies inside).
       this.sim.damagePlayer(10*p.attackMult);
       this.law?.registerCrime(CRIME.damagedPed,`ped:${p.id}`);
     }
   }
   let policeSpeed:number|undefined;
   if(p.officer){
    p.flash=Math.max(0,p.flash-dt);p.view.setWeaponAim();p.view.setWeaponPose();let engaged=false;
    const law=this.law!,gunAllowed=law.level>1||law.level===1&&this.playerArmed(),target=this.sim.player.position,eye={...state.position,y:state.position.y+1.3},aim={...target,y:target.y+1},offset=new Vector3(aim.x-eye.x,aim.y-eye.y,aim.z-eye.z),distance=offset.length();
    const hit=distance>0?this.sim.world.castRay(new RAPIER.Ray(eye,offset.clone().normalize()),distance+.5,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,p.collider,p.body):null;
    const occupied=[...cars].find(c=>c.occupied),visible=!!hit&&(hit.collider.handle===this.sim.playerCollider.handle||!!occupied&&hit.collider.parent()?.handle===occupied.car.body.handle);
     if(p.goTo&&p.down===0){dx=p.goTo.x-state.position.x;dz=p.goTo.z-state.position.z;policeSpeed=p.goTo.walk?p.walkSpeed:p.runSpeed;p.arrest=0;}
      else if(law.level&&state.health>0&&p.health>0&&p.down===0&&this.sim.player.health>0){
       if(visible&&distance<45)law.see(target);
       // CTaskComplexPolicePursuit::SetWeapon: 1 star vs unarmed player = nightstick.
       // Browser nightstick: close in and beat the suspect (no gun branch).
       const nightstick=!gunAllowed&&law.level===1&&!law.surrendering;
       if(nightstick){
         const chase=visible?target:law.lastKnown??target;
         dx=chase.x-state.position.x;dz=chase.z-state.position.z;
         const flat=Math.hypot(dx,dz);
         policeSpeed=flat>1.7?p.runSpeed:0;
         if(visible&&distance<1.9){
           policeSpeed=0;state.heading=Math.atan2(offset.x,offset.z);
           if(p.meleeCooldown<=0){
             p.meleeCooldown=1.0;
             p.view.playReaction(this.catalog?.animations['fighta_1']?'fighta_1':'hit_front',0.5);
             this.sim.damagePlayer(12);
             p.arrest+=0.4;
           }
         }
         if((law.surrendering||this.sim.player.speed<.5)&&visible&&distance<2.2&&this.sim.playerBody.isEnabled()){p.arrest+=dt;policeSpeed=0;if(p.arrest>1.2)law.arrest();}else if(!(visible&&distance<1.9))p.arrest=Math.max(0,p.arrest-dt);
       } else {
       const chase=law.lastKnown??target;dx=chase.x-state.position.x;dz=chase.z-state.position.z;policeSpeed=gunAllowed&&visible&&distance<(p.weapon?.info.targetRange??12)&&!law.surrendering||!visible&&Math.hypot(dx,dz)<2?0:p.runSpeed;
      if((law.surrendering||!gunAllowed&&law.level===1&&this.sim.player.speed<.5)&&visible&&distance<2.2&&this.sim.playerBody.isEnabled()){p.arrest+=dt;policeSpeed=0;if(p.arrest>1.2)law.arrest();}else p.arrest=0;
       }
     if(gunAllowed&&visible&&p.weapon&&distance<p.weapon.info.weaponRange&&!law.surrendering&&policeSpeed===0){
      engaged=true;p.view.setWeaponPose('police_fire');p.view.setWeaponAim(offset.clone().normalize());
     }
    }else p.arrest=0;
    if(p.weapon&&p.gunState){
     const gun=p.gunState,weapon=p.weapon;
     if(gun.reload>0)p.view.setWeaponAim();
     if(engaged&&!gun.active&&!gun.reload){p.aimPoint={...aim};p.view.playReaction('police_fire',weapon.info.loop.end);}
     const oldTime=gun.time,oldReload=gun.reload;
     const fire=stepNpcGun(gun,weapon.info,weapon.reloadSeconds,dt,engaged);
     if(gun.reload>oldReload&&weapon.reloadClip)p.view.playReaction('police_reload',weapon.reloadSeconds,true);
     if(fire){
      state.heading=Math.atan2(offset.x,offset.z);p.view.update(p.actor,1);
      const muzzle=p.gun?.root.getObjectByName('gunflash')?.getWorldPosition(new Vector3())??p.view.hand()?.getWorldPosition(new Vector3())??new Vector3(eye.x,eye.y,eye.z);
      const direction=new Vector3().copy(p.aimPoint??aim).sub(muzzle).normalize();
      const shot=this.sim.world.castRay(new RAPIER.Ray(muzzle,direction),weapon.info.weaponRange,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,p.collider,p.body);
      const end=muzzle.clone().addScaledVector(direction,shot?.timeOfImpact??weapon.info.weaponRange);p.flash=.06;
      this.onShot?.(muzzle,end,weapon.info.type,!!shot);this.frighten(state.position,35);
      if(shot?.collider.handle===this.sim.playerCollider.handle)this.sim.damagePlayer(weapon.info.damage);
      else if(shot){const car=[...cars].find(c=>shot.collider.parent()?.handle===c.car.body.handle);if(car)car.damage(weapon.info.damage);else {const victim=this.people.find(other=>other.collider.handle===shot.collider.handle);if(victim){victim.health=Math.max(0,victim.health-weapon.info.damage);if(!victim.health){this.hit(victim,direction.x,direction.z,2);victim.down=Infinity;victim.view.playReaction('ko_skid_front',Infinity);}else victim.view.playReaction('hit_front');}}}
     }
     if(gun.active&&gun.time<oldTime){p.aimPoint={...aim};p.view.playReaction('police_fire',weapon.info.loop.end,false,weapon.info.loop.start);}
    }
    if(p.gun)p.gun.root.visible=gunAllowed;
    if(p.gun)for(const binding of p.gun.materialBindings)if(binding.source.texture.toLowerCase().startsWith('muzzle'))binding.material.visible=p.flash>0;
   }
    const length0=Math.hypot(dx,dz);
    if(p.blocked>.3&&p.down===0&&length0>.01){const slide=sidestepDirection(dx/length0,dz/length0,p.id%2?1:-1);dx=slide.x*length0;dz=slide.z*length0;}
     const retaliating=!p.officer&&p.retaliate>0&&p.health>0&&p.down===0;
     const retaliateDist=retaliating?Math.hypot(this.sim.player.position.x-state.position.x,this.sim.player.position.z-state.position.z):Infinity;
     const length=Math.hypot(dx,dz),target=p.down>0||p.stagger>0?0:policeSpeed??retaliating?(retaliateDist>1.6?p.runSpeed:0):(p.flee>0?p.sprintSpeed:p.walkSpeed);
    // Eased gait: peds burst from their current pace instead of teleporting
    // to full sprint, so hit-frame strikes still connect mid-exchange.
    p.gait+=(target-p.gait)*(1-Math.exp(-8*dt));
    const speed=p.gait;
   if(length>.01&&(speed>.05||p.officer&&!!this.law?.level))state.heading=Math.atan2(dx,dz);
   state.speed=speed;
   const controls={x:0,y:speed>.05?-1:0,cameraYaw:state.heading,walk:speed<=p.walkSpeed,sprint:p.flee>0&&p.down===0,jump:false};
   p.view.step(dt,controls,p.actor);
   const footstep=p.health>0&&p.down===0?p.view.footstep():undefined;if(footstep)this.onFootstep?.(p,{...state.position,y:state.position.y+1},footstep.move,footstep.foot);
   const center=p.down>0?.3:.9,position=p.body.translation();
   const {movement}=characterMovement(p.controller,p.collider,{x:(length?dx/length*speed:0)*dt+p.impulse.x*dt,y:-5*dt+(state.position.y+center-position.y),z:(length?dz/length*speed:0)*dt+p.impulse.z*dt});
   if(speed&&Math.hypot(movement.x,movement.z)<speed*dt*.2)p.blocked+=dt;else p.blocked=0;
   p.body.setNextKinematicTranslation({x:position.x+movement.x,y:position.y+movement.y,z:position.z+movement.z});
   p.impulse.x*=Math.exp(-5*dt);p.impulse.z*=Math.exp(-5*dt);
  }
 }
 afterStep(){for(const p of this.people){const center=p.body.translation();p.actor.player.position={x:center.x,y:center.y-(p.down>0?.3:.9),z:center.z};}}
 render(alpha:number,ambient:readonly number[]|undefined,night:number,thermal=false){for(const p of this.people){p.view.setThermal(thermal);p.view.setAmbient(ambient);p.view.setNight(night);p.view.update(p.actor,alpha);}}
 dispose(){this.disposed=true;for(const p of this.people)this.remove(p);this.people=[];}
}
