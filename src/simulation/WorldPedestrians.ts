import {stepNpcGun,npcAimSpread,type NpcGunState} from '../weapons/gunnery';
import type {DamageKind} from '../weapons/WeaponSystem';
import {characterMovement} from './characterMovement';
import {NATIVE_DAMAGE_CLIPS,PED_PIECE,PEDMOVE,WEAPON,browserLocalDirection,computeDamageEventAnim,computeDeathAnim,type DamageAnimResult} from '../combat/nativeDamageAnim';
import {PED_CAR_KILL_INTENSITY,PED_MASS,carHitsPed,killPedWithCarTask} from '../combat/nativeCarPedHit';
import {VEHICLE_ELASTICITY} from './nativeObjectDamage';
import {PED_SOLVER_GROUPS} from './solverGroups';
import {WindowsCrtRandom} from '../core/WindowsCrtRandom';
import { NATIVE_UNARMED_STAGES, NATIVE_UNARMED_RANGE, NATIVE_MELEE_COMBOS, attackLineDistance } from './nativeMelee';
import { nextChainIndex, resolveStrike, chainCooldown, inStrikeCone } from '../combat/meleeChain';
import { decideDamageResponse, applyDamageResponse, PedTaskAdapter } from '../ped/brain';
import { playerPunchDamage, scaleBlow, npcPunchDamage } from '../ped/damage';
import { gunAllowed as pursuitGunAllowed, ARREST_HOLD_SECONDS, NIGHTSTICK_DAMAGE, stepArrest } from '../police/pursuit';
import { onscreenSpawnBand, offscreenSpawnBand, pedCreationDistMultiplier, gangPartySize, gangFormationOffset, gangHostile, gangPartyArmed, separationPush } from './nativePopulation';
import RAPIER from '@dimforge/rapier3d-compat';
import {Quaternion,Vector3,type Scene} from 'three';
import {modelObject} from '../assets/ModelObjects';
import type {WantedSystem} from './WantedSystem';
import {CRIME} from './nativeWanted';
import {NativeCharacter} from '../render/NativeCharacter';
import {openWorldPedestrians} from '../assets/worldPedestrians';
import type {PathNode} from '../assets/pathNodes';
import type {Simulation} from './Simulation';
import type {WorldCar} from './WorldCar';

type Catalog=Awaited<ReturnType<typeof openWorldPedestrians>>;
const PED_VEHICLE_PROBE = new RAPIER.Capsule(.6,.42);
const PED_STAND_PROBE = new RAPIER.Capsule(.6,.3);
interface Pedestrian {
 id:number;deadTime:number; officer:boolean;arrest:number;gun?:ReturnType<typeof modelObject>; health:number; actor:Pick<Simulation,'player'>; body:RAPIER.RigidBody; collider:RAPIER.Collider;
 controller:RAPIER.KinematicCharacterController; view:NativeCharacter; target:PathNode; previousNode?:PathNode;
 weapon?:NonNullable<Catalog['weapon']>;gunState?:NpcGunState;aimPoint?:{x:number;y:number;z:number};flash:number;
 /** CCopPed shooting accuracy (street 60, SWAT 68, FBI 76, army 84). */
 gunAccuracy:number;
 down:number; flee:number;fleeFrom?:{x:number;z:number}; impulse:{x:number;z:number}; blocked:number;
 /** Seconds into CTaskSimpleStealthKill as the victim. */
 stealth?:number;
 /** Street brawl: counts down while this ped fights the player back (EVENT_DAMAGE). */
 retaliate:number;retaliateCooldown:number;
  /** A cop who left a police car seat (CPed::m_pVehicle), and the door point it is heading back to. */
  crew?:{unit:object;seat:number};goTo?:{x:number;z:number;walk:boolean};
  /** Nightstick beat-down pacing per officer. */
  meleeCooldown:number;
  /** Gun drop already reported for this death. */
  dropped:boolean;
 /** Variant root-motion speeds (animgrp.dat walkcycle via peds.ide), defaulting to `man`. */
 walkSpeed:number;runSpeed:number;sprintSpeed:number;
 /** pedstats.dat damage multipliers for this ped's stat row (1.0/1.0 ordinary). */
 attackMult:number;defendMult:number;
 /** pedstats.dat temper: 60+ hotheads trade punches, the rest flee. */
 temper:number;
 /** Hit-reaction stagger: a struck ped reels briefly instead of sprinting on
  * (CTaskSimpleHit tasks own locomotion mid-reaction; 0.5 s authored). */
 stagger:number;
 /** Bump shove cooldown (CEventPlayerCollisionWithPed complain-and-shove). */
 bumpCooldown:number;
 /** Smoothed locomotion speed toward the gait target (CPed velocity easing). */
 gait:number;
 /** pedgrp.dat gang index for turf party members; civilians stay undefined. */
 gang?:number;
 /** Roster reference for re-spawns (ambient index or gang model name). */
 modelRef:number|string;
 /** Recruited Grove crew: shadows the player and shares their enemies. */
 follow:boolean;
 /** Animation id of the last CEventDamage reaction, for the native re-pick. */
 damageAnimId?:number;
 /** Current enemy for crew and brawlers (undefined means the player). */
 foe?:Pedestrian;
  /** Corner dealers hold their post instead of wandering until spooked. */
  loiter:boolean;
  /** 1:1-track brain mirror (src/ped/brain.ts): synced from legacy timers each
   * step; legacy timers stay authoritative until the task cutover completes. */
  brain:PedTaskAdapter;
  /** NPC brawl chain stage (melee.dat jab/cross/hook cycle for cooldown pacing). */
  fightStage:0|1|2;
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
  /** Landed fist/nightstick blows (combat bank unarmed impact sample). */
  onMeleeHit?:(position:{x:number;y:number;z:number},byPlayer:boolean)=>void;
  /** Dead armed peds drop their gun with leftover rounds (one-shot pickup). */
  onDropWeapon?:(position:{x:number;y:number;z:number},weapon:number,rounds:number)=>void;
 /** A ped killed by player damage (mission kill tracking; NPC-vs-NPC deaths excluded). */
 onKill?:(victim:{id:number;officer:boolean;gang?:number})=>void;
 /** CTaskSimpleKillPedWithCar's AE_PED_CRUNCH on the striking vehicle. */
 onCarCrunch?:(car:WorldCar)=>void;
 /** Pain, flee and threat vocals (CAEPedSpeechAudioEntity comments). */
 onPain?:(ped:object,position:{x:number;y:number;z:number})=>void;
 onFlee?:(ped:object,position:{x:number;y:number;z:number})=>void;
 onThreat?:(ped:object,position:{x:number;y:number;z:number})=>void;
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
 /** CGeneral samples for the damage re-pick. A private stream: the engine-wide CRT stream is not shared yet. */
 private damageRandom=new WindowsCrtRandom(1);
 private error?:string;
 constructor(private sim:Simulation,private scene:Scene,base:string,private playerView:()=>NativeCharacter|undefined,private law?:WantedSystem){
  void openWorldPedestrians(base,!!law).then(c=>{if(this.disposed)return;this.catalog=c;this.installPlayerReactions();}).catch(e=>{this.error=String(e);});
 }
  private reactions(c:Catalog){return {...Object.fromEntries([...new Set(['fighta_1','fighta_2','fighta_3','hita_1','hita_2','hita_3','ko_skid_front','getup_front','hit_front','hit_back','hit_l','hit_r',...NATIVE_DAMAGE_CLIPS])].filter(n=>c.animations[n]).map(n=>[n,c.animations[n]])),...Object.fromEntries(['kill_knife_ped_damage','kill_knife_ped_die','kill_knife_player'].filter(n=>c.stealth[n]).map(n=>[n,c.stealth[n]]))};}
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
 /** Development: stand a living civilian still at a renderer-frame point. Returns its id. */
 debugPlace(point:{x:number;y:number;z:number},heading=0){
  const p=this.people.find(p=>!p.officer&&p.health>0&&p.down===0);if(!p)return undefined;
  p.actor.player.position={...point};p.actor.player.heading=heading;p.actor.player.speed=0;p.impulse={x:0,z:0};p.flee=0;p.loiter=true;
  p.body.setTranslation({x:point.x,y:point.y+.9,z:point.z},true);p.collider.setTranslation({x:point.x,y:point.y+.9,z:point.z});
  return p.id;
 }
 snapshot(){return {ready:!!this.catalog,pending:this.busy,error:this.error??null,hits:this.hits,people:this.people.map(p=>({id:p.id,officer:p.officer,loiter:p.loiter,gang:p.gang,follow:p.follow,down:p.down,weapon:p.weapon?.info.type,gun:p.gunState&&{...p.gunState},position:{...p.actor.player.position},heading:p.actor.player.heading,health:p.health,state:p.stealth!==undefined&&p.health>0?'stealth':p.health<=0?'dead':p.down>0?'down':p.gunState?.reload?'reload':p.gunState?.active?'shoot':p.flee>0?'flee':'walk',brain:p.brain.stack.current?.name??null,visible:p.view.root.visible}))};}
   /** Player damage to a pedestrian; the weapon system reports the native crime for the returned victim. */
   damageCollider(handle:number,damage:number,direction:{x:number;z:number},kind:DamageKind='bullet',hit?:{weapon?:number;point?:{x:number;y:number;z:number};fight?:{move:number}}){
    const p=this.people.find(p=>p.collider.handle===handle);if(!p||p.health<=0)return false;
    // Shared pedstats scaling (src/ped/damage.ts); ground finishers share the 25 row.
    const base=kind==='melee'&&p.down>0?25:damage,applied=base*(kind==='melee'?playerPunchDamage(1,p.defendMult):1);
    p.health=Math.max(0,p.health-applied);
    const q=p.actor.player.position,from={x:q.x-direction.x,z:q.z-direction.z};
    const weapon=hit?.weapon??(kind==='melee'?WEAPON.unarmed:kind==='explosion'?WEAPON.explosion:kind==='fire'?WEAPON.flamethrower:kind==='spray'?WEAPON.spraycan:WEAPON.pistol);
    // Gun hits and every death take CEventDamage::ComputeAnim. Surviving melee
    // and blast victims keep the browser knockdown: melee combo sets and the
    // CExplosion push are separate systems not ported here, but the clip is
    // still the native knockout for the hit direction.
    const fight=kind==='melee'&&hit?.fight&&p.down===0?hit.fight:undefined;
    const reaction=this.damageReaction(p,weapon,applied,from,hit?.point,true,fight);
    if(p.health>0&&(kind==='explosion'||kind==='melee'&&!fight)){
     const knockout=computeDeathAnim({weapon:kind==='melee'?WEAPON.unarmed:WEAPON.explosion,pedPiece:PED_PIECE.torso,direction:browserLocalDirection(p.actor.player.heading,from.x-q.x,from.z-q.z),health:0,damageArmour:0,damageHealth:applied,victim:{player:false,inVehicle:false,moveState:PEDMOVE.still},source:{ped:true,player:true}});
     this.hit(p,direction.x,direction.z,Math.min(7,damage*.1),knockout.clip);
    }else if(!this.applyReaction(p,reaction,from)&&p.health>0){this.frighten(q,12);this.onPain?.(p,{...q});}
    if(p.health===0)this.onKill?.({id:p.id,officer:p.officer,gang:p.gang});
    return {id:p.id,officer:p.officer};
   }
 /** Browser stand-in for the twelve CPedModelInfo hit spheres. Their bone,
  * offset and radius table lives in retail data (0x8A6308) and is not in the
  * reversed source, so height above the feet picks head, torso, midsection
  * or legs and the side of the ped picks the limb. */
 private hitPiece(p:Pedestrian,point?:{x:number;y:number;z:number}){
  if(!point)return PED_PIECE.torso;
  const q=p.actor.player.position,height=point.y-q.y,h=p.actor.player.heading;
  // The ped's left on the browser x/z plane when it faces (sin h, cos h).
  const left=(point.x-q.x)*Math.cos(h)-(point.z-q.z)*Math.sin(h);
  if(height>=1.45)return PED_PIECE.head;
  if(height>=1)return Math.abs(left)>.22?left>0?PED_PIECE.leftArm:PED_PIECE.rightArm:PED_PIECE.torso;
  if(height>=.85)return PED_PIECE.ass;
  return left>=0?PED_PIECE.leftLeg:PED_PIECE.rightLeg;
 }
 private moveState(p:Pedestrian){
  const speed=p.actor.player.speed;
  return speed<.1?PEDMOVE.still:speed<(p.walkSpeed+p.runSpeed)/2?PEDMOVE.walk:speed<(p.runSpeed+p.sprintSpeed)/2?PEDMOVE.run:PEDMOVE.sprint;
 }
 /** CEventDamage::ComputeAnim for a pedestrian struck from `from`. */
 private damageReaction(p:Pedestrian,weapon:number,damage:number,from:{x:number;z:number},point:{x:number;y:number;z:number}|undefined,attackerIsPlayer:boolean,fight?:{move:number}):DamageAnimResult{
  const q=p.actor.player.position;
  // The attacker's CTaskSimpleFight: combo set UNARMED_1 or a weapon set (4 and above) and
  // its current move. IsComboSet is a retail stub; it is taken as the combo's final move,
  // so the third hit floors the victim. Victims play the ped.ifp HitA clips for every set.
  const sourceFight=fight&&{comboSet:4,currentMove:fight.move,comboActive:fight.move===2,hitComboActive:false,hitClip:(move:number)=>`hita_${move+1}`,group:'melee_1'};
  const result=computeDamageEventAnim({weapon,pedPiece:point?this.hitPiece(p,point):fight?PED_PIECE.torso:this.hitPiece(p,point),direction:browserLocalDirection(p.actor.player.heading,from.x-q.x,from.z-q.z),
   health:p.health,damageArmour:0,damageHealth:damage,
   victim:{player:false,inVehicle:false,moveState:this.moveState(p),fallingOrGettingUp:p.down>0,headBelowRoot:p.down>0},
   source:{ped:true,player:attackerIsPlayer,fight:sourceFight},previousAnimId:p.damageAnimId,nextRandom:()=>this.damageRandom.next()});
  p.damageAnimId=result.id;return result;
 }
 /** CPhysical::ApplyMoveForce divides by the ped's 70 mass into move speed per 1/50 s frame. */
 private static nativeImpulse(force:number){return force*50/70;}
 /** Plays a native reaction. Deaths hold their clip; floored victims are
  * pushed away from the source; everyone else staggers. Returns whether the
  * victim was floored. The native vertical force of 5 is not applied: NPC
  * bodies are kinematic here. */
 private applyReaction(p:Pedestrian,result:DamageAnimResult,from:{x:number;z:number}){
  const q=p.actor.player.position,away={x:q.x-from.x,z:q.z-from.z};
  if(p.health<=0){
   this.hit(p,away.x,away.z,WorldPedestrians.nativeImpulse(result.force),result.clip??'ko_shot_front');
   p.down=Infinity;p.view.playReaction(result.clip??'ko_shot_front',Infinity);return true;
  }
  if(result.fallDown){this.hit(p,away.x,away.z,WorldPedestrians.nativeImpulse(result.force),result.clip??'ko_skid_front');return true;}
  this.hits++;if(result.clip)p.view.playReaction(result.clip);p.stagger=.5;return false;
 }
 /** CWanted::WorkOutPolicePresence: living officers within `radius` of a point. */
 policePresence(point:{x:number;y:number;z:number},radius:number){return this.people.filter(p=>p.officer&&p.health>0&&Math.hypot(p.actor.player.position.x-point.x,p.actor.player.position.y+1-point.y,p.actor.player.position.z-point.z)<radius).length;}
  frighten(position:{x:number;z:number},radius:number){for(const p of this.people)if(!p.officer&&p.health>0&&Math.hypot(p.actor.player.position.x-position.x,p.actor.player.position.z-position.z)<radius){p.flee=Math.max(p.flee,8);p.fleeFrom={...position};this.onFlee?.(p,{...p.actor.player.position});}}
  targets(){return this.people.filter(p=>p.health>0).map(p=>({handle:p.collider.handle,position:{...p.body.translation()},officer:p.officer,armed:!!p.weapon,attacking:p.retaliate>0,down:p.down>0}));}
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
     const cap=this.limits?.()??{civilians:18,total:26};
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
      if(size>0&&this.people.length+size<=cap.total){await this.spawnGangParty(turf.gang,size,node,center,turf.strength);}
      continue;
     }
     // Corner dealers loiter on dealer turf instead of wandering past it.
     const dealerStrength=this.dealerTurf?.(x,z)??0;
     if(dealerStrength>0&&Math.random()*255<dealerStrength&&this.people.length<cap.total){await this.spawnDealer(node,center);continue;}
    }
    if(this.people.some(p=>Math.hypot(p.actor.player.position.x-x,p.actor.player.position.z-z)<5))continue;
    const top=node.position[2]+3,hit=this.sim.world.castRay(new RAPIER.Ray({x,y:top,z},{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
    if(!hit)continue;
    const position={x,y:top-hit.timeOfImpact+.03,z},modelIndex=this.nextId%catalog.models.length;
    const speeds=officer?catalog.officerSpeeds??{walk:NATIVE_PED_WALK_SPEED,run:NATIVE_PED_RUN_SPEED,sprint:NATIVE_PED_SPRINT_SPEED}:catalog.modelSpeeds[modelIndex]??{walk:NATIVE_PED_WALK_SPEED,run:NATIVE_PED_RUN_SPEED,sprint:NATIVE_PED_SPRINT_SPEED};
    const stats=officer?catalog.officerStats??{attack:1,defend:1}:catalog.modelStats[modelIndex]??{attack:1,defend:1};
    const p=this.createPed({position,heading:this.sim.player.heading,source:officer?catalog.officer!:catalog.models[modelIndex],officer,node,weapon:officer?catalog.weapon:undefined,speed:speeds.walk,speeds,stats,modelRef:officer?'lapd1':modelIndex});
    this.chooseTarget(p);
   }
  }).catch(e=>{this.error=String(e);}).finally(()=>{this.busy=false;});
 }
   /** Officers the street spawner may add: the native pursuit cap (CWanted::m_MaxCopsInPursuit) less cops already committed elsewhere. */
   footOfficerLimit:()=>number=()=>this.law?.native.maxCopsInPursuit??0;
   /** Popcycle density caps for the current zone and clock (fleet provider; 18/26 fallback). */
   limits?:()=>{civilians:number;total:number}|undefined;
   /** Gang turf at a native point: pedgrp.dat gang index 0–9 with INITIAL strength 0–255. */
   gangTurf?:(x:number,z:number)=>{gang:number;strength:number}|undefined;
   /** Dealer corner strength (INITIAL SET_ZONE_DEALER_STRENGTH 0–255). */
   dealerTurf?:(x:number,z:number)=>number|undefined;
  /** A corner dealer (pedgrp.dat dealers): loiters on the spot until spooked. */
  private async spawnDealer(node:PathNode,center:{x:number;z:number}){
   const catalog=this.catalog!;
   const dealers=catalog.dealers??[];
   if(!dealers.length)return;
   const model=dealers[Math.floor(Math.random()*dealers.length)];
   const x=node.position[0],z=-node.position[1];
   if(Math.hypot(x-center.x,z-center.z)>65)return;
   if(!this.canSpawn({x,y:node.position[2]+1,z},2))return;
   const top=node.position[2]+3,hit=this.sim.world.castRay(new RAPIER.Ray({x,y:top,z},{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
   if(!hit||this.disposed)return;
   let built:{source:import('../render/NativeCharacter').CharacterSource;speeds:{walk:number;run:number;sprint:number};stats:{attack:number;defend:number;temper?:number}};
   try{built={source:await catalog.character(model),speeds:await catalog.characterSpeeds(model),stats:await catalog.characterStats(model)};}
   catch{return;}
   const position={x,y:top-hit.timeOfImpact+.03,z};
   const p=this.createPed({position,heading:Math.random()*Math.PI*2,source:built.source,officer:false,node,weapon:undefined,speed:0,speeds:built.speeds,stats:built.stats,modelRef:model,loiter:true});
   p.target=node;p.previousNode=undefined;
  }
  /** A turf gang party (CPopulation::AddToPopulation + PlaceGangMembers):
   * native party size with formation offsets around the leader's node. */
  private async spawnGangParty(gang:number,size:number,node:PathNode,center:{x:number;z:number},strength=255){
   const catalog=this.catalog!;
   const members=catalog.gangs[gang]??[];
   if(!members.length)return;
   // Escalated turf: one pistol on strong turf in an armed-or-wanted pursuit.
   const armedIndex=gangPartyArmed(size,this.playerArmed(),this.law?.level??0,strength)?1+Math.floor(Math.random()*(size-1)): -1;
   let armed:Awaited<Catalog['weapon']>|undefined;
   if(armedIndex>=0&&this.law){
    try{armed=await catalog.armedWith(22);}catch{armed=undefined;}
   }
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
   const p=this.createPed({position,heading:this.sim.player.heading,source:built.source,officer:false,node,weapon:i===armedIndex?armed:undefined,speed:built.speeds.walk,speeds:built.speeds,stats:built.stats,gang,modelRef:model});
    if(leader){p.target=leader.target;p.previousNode=leader.previousNode;}
    else{this.chooseTarget(p);leader=p;}
   }
  }
  private createPed(o:{position:{x:number;y:number;z:number};heading:number;source:import('../render/NativeCharacter').CharacterSource;officer:boolean;node:PathNode;weapon?:Awaited<Catalog['weapon']>;flee?:number;speed?:number;speeds?:{walk:number;run:number;sprint:number};stats?:{attack:number;defend:number;temper?:number};gang?:number;modelRef:number|string;loiter?:boolean;gunAccuracy?:number}){
  const catalog=this.catalog!,body=this.sim.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(o.position.x,o.position.y+.9,o.position.z));
  const collider=this.sim.world.createCollider(RAPIER.ColliderDesc.capsule(.6,.3).setSolverGroups(PED_SOLVER_GROUPS),body),controller=this.sim.world.createCharacterController(.025);
  controller.enableAutostep(.3,.2,false);controller.enableSnapToGround(.25);
  const view=new NativeCharacter(o.source);view.installReactions(this.reactions(catalog));view.startFirstCycleAt(Math.random());this.scene.add(view.root);
  let gun:ReturnType<typeof modelObject>|undefined;
  if(o.weapon?.asset){const asset=o.weapon.asset;gun=modelObject(asset.model,asset.textures);gun.root.rotation.set(0,0,0);gun.root.traverse(obj=>{const i=obj.userData.nativeFrame;if(i!==undefined&&asset.model.frames[i].parent<0)obj.matrix.identity();delete obj.userData.nativeFrame;});view.hand()?.add(gun.root);if(o.weapon.clip)view.installReactions({police_fire:o.weapon.clip},true);if(o.weapon.reloadClip)view.installReactions({police_reload:o.weapon.reloadClip},true);}
  const p:Pedestrian={id:this.nextId++,weapon:o.weapon,gunState:o.weapon?{time:0,rounds:o.weapon.info.clip,reload:0,active:false}:undefined,flash:0,deadTime:0,officer:o.officer,arrest:0,gun,health:o.officer?150:100,actor:{player:{...this.sim.player,position:{...o.position},previous:{...o.position},heading:o.heading,health:100,stamina:100,crouched:false,grounded:true,speed:o.speed??0}},body,collider,controller,view,target:o.node,down:0,flee:o.flee??0,impulse:{x:0,z:0},blocked:0,retaliate:0,retaliateCooldown:0,meleeCooldown:0,walkSpeed:o.speeds?.walk??NATIVE_PED_WALK_SPEED,runSpeed:o.speeds?.run??NATIVE_PED_RUN_SPEED,sprintSpeed:o.speeds?.sprint??NATIVE_PED_SPRINT_SPEED,attackMult:o.stats?.attack??1,defendMult:o.stats?.defend??1,temper:o.stats?.temper??50,gunAccuracy:o.gunAccuracy??60,stagger:0,bumpCooldown:0,dropped:false,gait:o.speed??0,gang:o.gang,modelRef:o.modelRef,loiter:!!o.loiter,follow:false,foe:undefined,brain:new PedTaskAdapter(),fightStage:0};
  this.people.push(p);return p;
 }
 private nearestNode(position:{x:number;z:number}){return [...(this.catalog?.areas.values()??[])].flatMap(a=>a.nodes).filter(n=>this.allowed(n)).sort((a,b)=>Math.hypot(a.position[0]-position.x,-a.position[1]-position.z)-Math.hypot(b.position[0]-position.x,-b.position[1]-position.z))[0];}
  /** Living on-foot pedestrians as wading walkers for foot splashes (stable keys). */
  walkers(){return this.people.filter(p=>p.health>0&&p.down===0).map(p=>({key:p as object,position:{...p.actor.player.position},speed:p.actor.player.speed,grounded:true}));}
  /** A driver dragged out or leaving a car becomes a street ped that flees (the usual decision-maker response to EVENT_DRAGGED_OUT_CAR). */
  spawnFleeing(modelIndex:number,position:{x:number;y:number;z:number},heading:number){
  const catalog=this.catalog;if(!catalog||this.disposed)return false;
  const node=this.nearestNode(position);if(!node)return false;
  this.createPed({position,heading,source:catalog.models[modelIndex%catalog.models.length],officer:false,node,flee:8,speeds:catalog.modelSpeeds[modelIndex%catalog.models.length],stats:catalog.modelStats[modelIndex%catalog.models.length],modelRef:modelIndex%catalog.models.length});return true;
 }
 /** A police crew member stepping out of a cop car (CCopPed type model and weapon). */
 async spawnOfficer(model:string,weapon:number,position:{x:number;y:number;z:number},heading:number,crew?:{unit:object;seat:number},accuracy=60){
  const catalog=this.catalog;if(!catalog||this.disposed)return false;
  const [built,armed]=await Promise.all([catalog.character(model).then(async source=>({source,speeds:await catalog.characterSpeeds(model),stats:await catalog.characterStats(model)})),catalog.armedWith(weapon)]);
  const node=this.nearestNode(position);if(!node||this.disposed)return false;
  this.createPed({position,heading,source:built.source,officer:true,node,weapon:armed,speeds:built.speeds,stats:built.stats,gunAccuracy:accuracy,modelRef:model}).crew=crew;return true;
 }
 /** A police unit's living crew on foot. */
 footCrew(unit:object){return this.people.filter(p=>p.crew?.unit===unit&&p.health>0).map(p=>({id:p.id,seat:p.crew!.seat,position:{...p.actor.player.position},down:p.down>0||p.stealth!==undefined}));}
 /** CTaskComplexGoToCarDoorAndStandStill: run to a car door point, walking within 4 units; undefined resumes the pursuit. */
 sendOfficer(id:number,point?:{x:number;z:number},walk=false){const p=this.people.find(p=>p.id===id);if(p)p.goTo=point&&{...point,walk};}
 /** The cop reached the door: the car's entry sequence takes over from the street ped. */
 boardOfficer(id:number){const i=this.people.findIndex(p=>p.id===id);if(i<0)return false;this.remove(this.people[i]);this.people.splice(i,1);return true;}
 /** A follower climbs into a passenger seat: leaves the street, keeping crew state for the ride. */
 boardPassenger(id:number){
  const i=this.people.findIndex(p=>p.id===id);if(i<0)return undefined;
  const [p]=this.people.splice(i,1);this.remove(p);
  return {modelRef:p.modelRef,follow:p.follow,gang:p.gang};
 }
 /** A passenger climbs out at a door point and rejoins the street. */
 async spawnPassenger(modelRef:number|string,position:{x:number;y:number;z:number},heading:number,follow:boolean){
  const catalog=this.catalog;if(!catalog||this.disposed)return false;
  const node=this.nearestNode(position);if(!node)return false;
  if(typeof modelRef==='number'){
   const index=((modelRef%catalog.models.length)+catalog.models.length)%catalog.models.length;
   this.createPed({position,heading,source:catalog.models[index],officer:false,node,speed:catalog.modelSpeeds[index]?.walk??NATIVE_PED_WALK_SPEED,speeds:catalog.modelSpeeds[index],stats:catalog.modelStats[index],modelRef:index});
  }else{
   let built:{source:import('../render/NativeCharacter').CharacterSource;speeds:{walk:number;run:number;sprint:number};stats:{attack:number;defend:number;temper?:number}};
   try{built={source:await catalog.character(modelRef),speeds:await catalog.characterSpeeds(modelRef),stats:await catalog.characterStats(modelRef)};}
   catch{return false;}
   if(this.disposed)return false;
   this.createPed({position,heading,source:built.source,officer:false,node,speed:built.speeds.walk,speeds:built.speeds,stats:built.stats,modelRef});
  }
  const p=this.people[this.people.length-1];
  p.follow=follow;p.flee=0;
  return true;
 }
 private allowed(n:PathNode){return n.kind==='pedestrian'&&!n.water&&!n.switchedOff&&!n.dontWander&&n.linkCount>0;}
 private chooseTarget(p:Pedestrian){
  const a=this.catalog?.areas.get(p.target.address.area);if(!a)return;
  const options=a.links.slice(p.target.baseLink,p.target.baseLink+p.target.linkCount).map(ref=>this.catalog?.areas.get(ref.area)?.nodes[ref.node]).filter((n):n is PathNode=>!!n&&this.allowed(n));
  const choices=options.filter(n=>n!==p.previousNode),next=(choices.length?choices:options)[(p.id+this.routeChoice++)%Math.max(1,choices.length||options.length)];
  if(next){p.previousNode=p.target;p.target=next;}
 }
  /** Crew share the player's attackers (gang backup); homie-on-player violence never recruits the crew. */
  private defendPlayer(attacker:Pedestrian){
   if(attacker.follow)return;
   for(const m of this.people){
    if(m===attacker||m.officer||!m.follow||m.health<=0||m.down>0)continue;
    if(Math.hypot(m.actor.player.position.x-this.sim.player.position.x,m.actor.player.position.z-this.sim.player.position.z)>25)continue;
    m.foe=attacker;m.retaliate=Math.max(m.retaliate,4);m.flee=0;
   }
  }
  /** One crew punch into a shared enemy: staged damage with reactions, and the victim answers the crew. */
  private punchFoe(p:Pedestrian,foe:Pedestrian,dx:number,dz:number){
   p.view.playReaction(this.catalog?.animations['fighta_1']?'fighta_1':'hit_front',0.5);
   this.onThreat?.(p,{...p.actor.player.position});
   // Shared pedstats scaling (src/ped/damage.ts).
   foe.health=Math.max(0,foe.health-scaleBlow(10,p.attackMult,foe.defendMult));
   this.onMeleeHit?.({...foe.actor.player.position},false);
   const length=Math.hypot(dx,dz)||1;
   if(!foe.health){const fq=foe.actor.player.position,ffrom={x:fq.x-dx/length,z:fq.z-dz/length};this.applyReaction(foe,this.damageReaction(foe,WEAPON.unarmed,10,ffrom,undefined,false),ffrom);p.foe=undefined;}
   else{foe.view.playReaction('hit_front');foe.stagger=0.5;
    if(!foe.officer){foe.foe=p;foe.retaliate=Math.max(foe.retaliate,4);foe.flee=0;}
   }
  }
  /** G recruit gesture: the nearest living Families member within five metres
   * joins (three max); an empty-handed press disbands. Attacking a homie
   * makes them leave the crew. */
  recruit():'joined'|'full'|'dismissed'|'none'{
   if(this.sim.player.health<=0)return 'none';
   const origin=this.sim.player.position;
   const gold=this.people.filter(p=>!p.officer&&p.health>0&&p.down===0&&p.gang===1&&!p.follow).map(p=>({p,d:Math.hypot(p.actor.player.position.x-origin.x,p.actor.player.position.z-origin.z)})).filter(t=>t.d<5).sort((a,b)=>a.d-b.d)[0];
   const crew=this.people.filter(p=>p.follow&&p.health>0);
   if(!gold){
    if(!crew.length)return 'none';
    for(const m of crew){m.follow=false;m.foe=undefined;}
    return 'dismissed';
   }
   if(crew.length>=3)return 'full';
   gold.p.follow=true;gold.p.flee=0;gold.p.foe=undefined;
   return 'joined';
  }
  /** A car touching an upright pedestrian. The response is the ped branch of
   * CPhysical::ApplyCollision, with the car counting ten times its mass; car and ped
   * colliders do not push each other in the solver. Above PED_CAR_KILL_INTENSITY
   * (authored, because CPed::KillPedWithCar is a retail stub) the reversed
   * CTaskSimpleKillPedWithCar runs. Faster than 2 m/s the ped is knocked down;
   * slower, it is only pushed. Normal and contact point are taken from the ped
   * centre towards the car's centre of mass. */
  private carStrikesPed(car:WorldCar,p:Pedestrian){
   type V={x:number;y:number;z:number};
   const toNative=(v:V):V=>({x:v.x,y:-v.z,z:v.y}),fromNative=(v:V):V=>({x:v.x,y:v.z,z:-v.y});
   const body=car.car.body,com=body.worldCom(),at=p.body.translation(),linvel=body.linvel(),angvel=body.angvel();
   const flat={x:com.x-at.x,z:com.z-at.z},reach=Math.hypot(flat.x,flat.z);if(reach<1e-4)return;
   const normal={x:flat.x/reach,y:0,z:flat.z/reach},physics=car.nativeBody;
   const heading=p.actor.player.heading,pedSpeed=p.actor.player.speed;
   const pedMove={x:(Math.sin(heading)*pedSpeed+p.impulse.x)/50,y:0,z:(Math.cos(heading)*pedSpeed+p.impulse.z)/50};
   const impact=carHitsPed({mass:physics.mass,turnMass:physics.turnMass,elasticity:VEHICLE_ELASTICITY,offset:toNative({x:at.x-com.x,y:at.y-com.y,z:at.z-com.z}),
    moveSpeed:toNative({x:linvel.x/50,y:linvel.y/50,z:linvel.z/50}),turnSpeed:toNative({x:angvel.x/50,y:angvel.y/50,z:angvel.z/50})},toNative(pedMove),toNative(normal));
   if(!impact)return;
   const addCarForce=(force:V)=>{const dv=fromNative(force);body.setLinvel({x:linvel.x+dv.x/physics.mass*50,y:linvel.y+dv.y/physics.mass*50,z:linvel.z+dv.z/physics.mass*50},true);};
   const speed=Math.hypot(linvel.x,linvel.z),crime=()=>{if(car.occupied)this.law?.registerCrime(p.officer?CRIME.killCopPedWithCar:CRIME.killPedWithCar,`ped:${p.id}`);};
   if(impact.pedIntensity>PED_CAR_KILL_INTENSITY){
    const r=body.rotation(),q=new Quaternion(r.x,r.y,r.z,r.w),axis=(x:number,y:number,z:number)=>toNative(new Vector3(x,y,z).applyQuaternion(q));
    // CPedGeometryAnalyser::ComputePedHitSide(ped, car) is a retail stub: the side facing the car's approach.
    const pos=p.actor.player.position,side=browserLocalDirection(heading,-linvel.x,-linvel.z) as 0|1|2|3;
    const t=body.translation();
    const kill=killPedWithCarTask({carPosition:toNative(t),right:axis(1,0,0),forward:axis(0,0,-1),up:axis(0,1,0),boundsMin:physics.boundsMin,boundsMax:physics.boundsMax,
     carMoveSpeed:toNative({x:linvel.x/50,y:linvel.y/50,z:linvel.z/50}),carMass:physics.mass,pedPosition:toNative(at),pedHitSide:side});
    p.health=0;
    const death=computeDeathAnim({weapon:kill.weapon,pedPiece:kill.pedPiece,direction:kill.direction,health:0,damageArmour:0,damageHealth:kill.damage,
     victim:{player:false,inVehicle:false,moveState:this.moveState(p),fallingOrGettingUp:false,headBelowRoot:false},source:{ped:false,player:car.occupied},nextRandom:()=>this.damageRandom.next()});
    const thrown=fromNative(kill.pedMoveSpeed),clip=death.clip??'ko_skid_front';
    this.hit(p,thrown.x||pos.x-t.x,thrown.z||pos.z-t.z,0,clip);
    p.impulse={x:thrown.x*50,z:thrown.z*50};p.down=Infinity;p.view.playReaction(clip,Infinity);
    addCarForce({x:impact.vehicleForce.x+kill.vehicleForce.x,y:impact.vehicleForce.y+kill.vehicleForce.y,z:impact.vehicleForce.z+kill.vehicleForce.z});
    if(kill.crunch)this.onCarCrunch?.(car);
    crime();this.onKill?.({id:p.id,officer:p.officer,gang:p.gang});
    return;
   }
   addCarForce(impact.vehicleForce);
   const push=fromNative(impact.pedForce);
   if(speed>=2){this.hit(p,linvel.x,linvel.z,Math.min(10,speed*.6));crime();}
   else{p.impulse.x+=push.x/PED_MASS*50;p.impulse.z+=push.z/PED_MASS*50;}
  }
  private hit(p:Pedestrian,x:number,z:number,strength:number,clip='ko_skid_front'){
  if(p.down>0)return;
  p.down=3.5;p.flee=8;this.hits++;
  const length=Math.hypot(x,z)||1;p.impulse={x:x/length*strength,z:z/length*strength};
  p.view.playReaction(clip,3.5);
  // A low collider allows the vehicle to pass over a knocked-down civilian.
  p.collider.setShape(new RAPIER.Ball(.3));
  this.frighten(p.actor.player.position,12);p.fleeFrom={x:p.actor.player.position.x-x/length*2,z:p.actor.player.position.z-z/length*2};
 }
   punch(){
    if(this.cooldown>0||this.sim.player.health<=0||!this.sim.player.grounded||this.sim.player.crouched)return false;
    // Module 1 shared chain (src/combat/meleeChain.ts, melee.dat UNARMED_1):
    // landed strikes link jab->cross->hook inside chain+0.25 s, whiffs reset.
    const now=typeof performance!=='undefined'?performance.now()/1000:0;
    const prevStage=NATIVE_UNARMED_STAGES[this.combo];
    const next=this.combo=nextChainIndex(this.combo, now-this.lastPunchAt, prevStage.chain);
    const stage=NATIVE_UNARMED_STAGES[next];
    const anim=next===1?'fighta_2':next===2?'fighta_3':'fighta_1';
    this.cooldown=chainCooldown(NATIVE_MELEE_COMBOS.UNARMED, next);
   // Lock on via FindPedToAttack: closest to the camera-forward line (gang discount).
   // Lock-on only corrects inside the frontal cone: swings from behind whiff
   // instead of snapping the fighter 180° (CTaskSimpleFight faces first, the
   // hit lands only while aligned at its hit frame).
    const origin=this.sim.player.position;let heading=this.sim.player.heading;
    const fwd={x:Math.sin(heading),z:Math.cos(heading)};
    const frontal=(dx:number,dz:number,hx:number,hz:number)=>inStrikeCone(dx,dz,hx,hz);
    const candidate=this.people.filter(p=>p.health>0).map(p=>({p,dx:p.actor.player.position.x-origin.x,dz:p.actor.player.position.z-origin.z,dy:p.actor.player.position.y-origin.y}))
     .filter(t=>Math.hypot(t.dx,t.dz)<NATIVE_UNARMED_RANGE+0.6&&Math.abs(t.dy)<1&&frontal(t.dx,t.dz,fwd.x,fwd.z))
     .sort((a,b)=>attackLineDistance(origin,fwd,{x:a.p.actor.player.position.x,z:a.p.actor.player.position.z},false)-attackLineDistance(origin,fwd,{x:b.p.actor.player.position.x,z:b.p.actor.player.position.z},false))[0];
    if(candidate){heading=Math.atan2(candidate.dx,candidate.dz);this.sim.player.heading=heading;}
    this.playerView()?.playReaction(this.catalog?.animations[anim]?anim:'fighta_1',.55);
    const moving=this.sim.player.speed>6;
    const target=this.people.filter(p=>p.health>0).map(p=>({p,dx:p.actor.player.position.x-origin.x,dz:p.actor.player.position.z-origin.z,dy:p.actor.player.position.y-origin.y})).filter(t=>Math.hypot(t.dx,t.dz)<NATIVE_UNARMED_RANGE&&Math.abs(t.dy)<1&&inStrikeCone(t.dx,t.dz,Math.sin(heading),Math.cos(heading))).sort((a,b)=>Math.hypot(a.dx,a.dz)-Math.hypot(b.dx,b.dz))[0];
    if(target){
     const distance=Math.hypot(target.dx,target.dz),ray=new RAPIER.Ray({...origin,y:origin.y+1},{x:distance>1e-4?target.dx/distance:Math.sin(heading),y:0,z:distance>1e-4?target.dz/distance:Math.cos(heading)});
     if(distance>.01&&this.sim.world.castRay(ray,distance,true,RAPIER.QueryFilterFlags.ONLY_FIXED)){this.combo=0;return false;}
     const ground=target.p.down>0;
     // Shared melee.dat resolution: AGROUND 25, AMOVING 5, else stage damage.
     const struck=resolveStrike(NATIVE_MELEE_COMBOS.UNARMED, { stage: next, moving, victimDown: ground });
     this.lastPunchAt=now;
     this.pendingStrikes.push({target:target.p.id,heading,damage:struck.damage,delay:struck.delay,ground,combo:next});
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
    target.health=Math.max(0,target.health-playerPunchDamage(s.damage,target.defendMult));
   if(target.follow){target.follow=false;target.foe=undefined;}
   if(!target.health)this.onKill?.({id:target.id,officer:target.officer,gang:target.gang});
   if(!target.health){const tq=target.actor.player.position,tfrom={x:tq.x-Math.sin(s.heading),z:tq.z-Math.cos(s.heading)};this.applyReaction(target,this.damageReaction(target,WEAPON.unarmed,s.damage,tfrom,undefined,true),tfrom);}
   else if(s.combo===2||s.ground)this.hit(target,Math.sin(s.heading),Math.cos(s.heading),4);
   else{this.hits++;target.view.playReaction('hit_front');target.stagger=0.5;this.frighten(target.actor.player.position,12);this.onPain?.(target,{...target.actor.player.position});}
    this.onMeleeHit?.({...target.actor.player.position},true);
    // Shared EVENT_DAMAGE routing (src/ped/brain.ts): hotheads fight, rest flee.
    const decision=decideDamageResponse({ temper: target.temper, officer: target.officer, alreadyFighting: target.retaliate>0, healthAfter: target.health });
    applyDamageResponse(target, decision);
    if(decision==='flee')target.fleeFrom={...origin};
  }
  /** Eye/aim raycast against the suspect (shared by foot officers and armed turf gangs). */
  private spotTarget(p:Pedestrian,target:{x:number;y:number;z:number},cars:Iterable<WorldCar>){
   const state=p.actor.player,eye={...state.position,y:state.position.y+1.3},aim={...target,y:target.y+1},offset=new Vector3(aim.x-eye.x,aim.y-eye.y,aim.z-eye.z),distance=offset.length();
   const hit=distance>0?this.sim.world.castRay(new RAPIER.Ray(eye,offset.clone().normalize()),distance+.5,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,p.collider,p.body):null;
   const occupied=[...cars].find(c=>c.occupied),visible=!!hit&&(hit.collider.handle===this.sim.playerCollider.handle||!!occupied&&hit.collider.parent()?.handle===occupied.car.body.handle);
   return {eye,aim,offset,distance,visible};
  }
  /** Muzzle-ray firing sequence with reloads, flashes and dispersion. */
  private stepPedGun(p:Pedestrian,weapon:NonNullable<Pedestrian['weapon']>,eye:{x:number;y:number;z:number},aim:{x:number;y:number;z:number},aimOffset:Vector3,cars:Iterable<WorldCar>,dt:number,engaged:boolean){
   const state=p.actor.player,gun=p.gunState!;
   if(gun.reload>0)p.view.setWeaponAim();
   if(engaged&&!gun.active&&!gun.reload){p.aimPoint={...aim};p.view.playReaction('police_fire',weapon.info.loop.end);}
   const oldTime=gun.time,oldReload=gun.reload;
   const fire=stepNpcGun(gun,weapon.info,weapon.reloadSeconds,dt,engaged);
   if(gun.reload>oldReload&&weapon.reloadClip)p.view.playReaction('police_reload',weapon.reloadSeconds,true);
   if(fire){
    state.heading=Math.atan2(aimOffset.x,aimOffset.z);p.view.update(p.actor,1);
    const muzzle=p.gun?.root.getObjectByName('gunflash')?.getWorldPosition(new Vector3())??p.view.hand()?.getWorldPosition(new Vector3())??new Vector3(eye.x,eye.y,eye.z);
    const direction=new Vector3().copy(p.aimPoint??aim).sub(muzzle).normalize();
    // Native weapon dispersion: the muzzle ray scatters inside the
    // weapon.dat radius instead of striking the aim point every shot.
    const scattered=npcAimSpread(direction,weapon.info,p.gunAccuracy);
    direction.set(scattered.vector.x,scattered.vector.y,scattered.vector.z);
    const shot=this.sim.world.castRay(new RAPIER.Ray(muzzle,direction),weapon.info.weaponRange,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,p.collider,p.body);
    const end=muzzle.clone().addScaledVector(direction,shot?.timeOfImpact??weapon.info.weaponRange);p.flash=.06;
    this.onShot?.(muzzle,end,weapon.info.type,!!shot);this.frighten(state.position,35);
    if(shot?.collider.handle===this.sim.playerCollider.handle){this.sim.damagePlayer(weapon.info.damage);this.defendPlayer(p);}
    else if(shot){const car=[...cars].find(c=>shot.collider.parent()?.handle===c.car.body.handle);if(car)car.damage(weapon.info.damage);else {const victim=this.people.find(other=>other.collider.handle===shot.collider.handle);if(victim){victim.health=Math.max(0,victim.health-weapon.info.damage);const vq=victim.actor.player.position,vfrom={x:vq.x-direction.x,z:vq.z-direction.z};this.applyReaction(victim,this.damageReaction(victim,weapon.info.type,weapon.info.damage,vfrom,end,false),vfrom);}}}
   }
   if(gun.active&&gun.time<oldTime){p.aimPoint={...aim};p.view.playReaction('police_fire',weapon.info.loop.end,false,weapon.info.loop.start);}
  }
  beforeStep(dt:number,cars:Iterable<WorldCar>){
   this.cooldown=Math.max(0,this.cooldown-dt);
   for(let i=this.pendingStrikes.length-1;i>=0;i--){const s=this.pendingStrikes[i];s.delay-=dt;if(s.delay<=0){this.pendingStrikes.splice(i,1);this.resolveStrike(s);}}
   this.installPlayerReactions();
   const bodies=this.people.filter(p=>p.health>0&&p.down===0).map(p=>p.actor.player.position);
   for(const p of this.people){
    const state=p.actor.player;if(p.health<=0)p.deadTime+=dt;state.previous={...state.position};
   // Crowd separation: standing bodies push apart before anything steers.
   // Scaled by the impulse decay so overlapping peds part at ~push speed.
   if(p.health>0&&p.down===0){
    const push=separationPush(state.position,bodies.filter(q=>q!==state.position));
    p.impulse.x+=push.x*dt*5;p.impulse.z+=push.z*dt*5;
   }
    if(p.health<=0&&!p.dropped){p.dropped=true;if(p.weapon&&p.gunState)this.onDropWeapon?.({...state.position},p.weapon.info.type,p.gunState.rounds);}
   if(p.stealth!==undefined&&p.health>0){
    const damage=this.catalog?.stealth.kill_knife_ped_damage?.duration??2.23;p.stealth+=dt;
    if(p.stealth>=damage){p.health=0;p.down=Infinity;p.collider.setShape(new RAPIER.Ball(.3));p.view.playReaction('kill_knife_ped_die',Infinity);}
    else{p.view.step(dt,{x:0,y:0,cameraYaw:state.heading,walk:true,sprint:false,jump:false},p.actor);continue;}
   }
   for(const car of cars){
    if(!car.car.body.isEnabled()||p.down>0||p.health<=0)continue;
     for(let i=0;i<car.car.body.numColliders();i++){
      const collider=car.car.body.collider(i);
      if(!collider.isSensor()&&collider.intersectsShape(PED_VEHICLE_PROBE,p.body.translation(),p.body.rotation())){this.carStrikesPed(car,p);break;}
    }
   }
   if(p.down>0){
    p.down=Math.max(0,p.down-dt);
    if(p.down<=.7&&p.down+dt>.7)p.view.playReaction('getup_front',.7,true);
    if(p.down===0){
      const position=p.body.translation(),standing={...position,y:position.y+.6};
      if(this.sim.world.intersectionWithShape(standing,p.body.rotation(),PED_STAND_PROBE,undefined,undefined,p.collider,p.body)){p.down=.8;p.view.playReaction('ko_skid_front',.8);}
     else {p.collider.setShape(PED_STAND_PROBE);p.body.setTranslation(standing,true);p.collider.setTranslation(standing);}
    }
   }else p.flee=Math.max(0,p.flee-dt);
   p.retaliate=Math.max(0,p.retaliate-dt);p.retaliateCooldown=Math.max(0,p.retaliateCooldown-dt);p.meleeCooldown=Math.max(0,p.meleeCooldown-dt);p.stagger=Math.max(0,p.stagger-dt);p.bumpCooldown=Math.max(0,p.bumpCooldown-dt);
   // 1:1-track mirror: brain task follows legacy timers (authoritative this round).
   p.brain.syncFromTimers(p, typeof performance!=='undefined'?performance.now()/1000:0);
   let dx=p.target.position[0]-state.position.x,dz=-p.target.position[1]-state.position.z;
   if(!p.loiter&&(Math.hypot(dx,dz)<.8||p.blocked>2)){this.chooseTarget(p);p.blocked=0;dx=p.target.position[0]-state.position.x;dz=-p.target.position[1]-state.position.z;}
   if(p.loiter&&p.flee<=0&&p.down===0&&p.retaliate<=0){dx=0;dz=0;}
   if(!p.officer&&p.flee>0&&p.down===0&&p.retaliate<=0){const threat=p.fleeFrom??this.sim.player.position;dx=state.position.x-threat.x;dz=state.position.z-threat.z;}
   // Barged shoulders (CEventPlayerCollisionWithPed): a moving player shoves
   // the ped aside; it turns to face them, and hotheads swing back. No crime.
   if(!p.officer&&p.health>0&&p.down===0&&p.bumpCooldown<=0&&this.sim.player.health>0&&this.sim.player.speed>0.5){
    const px=this.sim.player.position.x-state.position.x,pz=this.sim.player.position.z-state.position.z;
    if(Math.hypot(px,pz)<1.1){
     const push=2/Math.max(.3,Math.hypot(px,pz));
     p.impulse.x+=-px*push;p.impulse.z+=-pz*push;
     state.heading=Math.atan2(px,pz);p.bumpCooldown=2;
     if(p.temper>=60){p.retaliate=Math.max(p.retaliate,4);p.flee=0;}
    }
   }
   // Turf hostiles: rival gangs jump a Grove player on sight, then hold turf.
   if(!p.officer&&p.health>0&&p.down===0&&this.sim.player.health>0){
    const t=this.sim.player.position;
    if(gangHostile(p.gang,Math.hypot(t.x-state.position.x,t.z-state.position.z))){p.retaliate=Math.max(p.retaliate,2);p.flee=0;}
   }
   // Armed turf gangs stand and shoot instead of brawling (escalated pursuit).
   let gunHold:number|undefined,gunEngaged=false;
   let spot:ReturnType<WorldPedestrians['spotTarget']>|undefined;
   if(!p.officer&&p.weapon&&p.health>0&&p.down===0&&this.sim.player.health>0){
    spot=this.spotTarget(p,this.sim.player.position,cars);
    p.view.setWeaponAim();p.view.setWeaponPose();
    gunEngaged=(p.retaliate>0||gangHostile(p.gang,Math.hypot(this.sim.player.position.x-state.position.x,this.sim.player.position.z-state.position.z)))&&spot.visible&&spot.distance<p.weapon.info.weaponRange;
    if(gunEngaged){p.view.setWeaponPose('police_fire');p.view.setWeaponAim(spot.offset.clone().normalize());gunHold=0;}
   }
   // Street retaliation: victims trade punches with their enemy (CTaskComplexFight).
   // Crew share the player's enemies; everyone else answers the player.
   if(!p.officer&&p.retaliate>0&&p.health>0&&p.down===0&&this.sim.player.health>0){
     const foe=p.foe&&p.foe.health>0?p.foe:undefined;
     if(!foe)p.foe=undefined;
     if(p.follow&&!foe){
       // No enemy: fall through to the wedge below.
     }else{
     const target=foe?foe.actor.player.position:this.sim.player.position;
     dx=target.x-state.position.x;dz=target.z-state.position.z;
     const dist=Math.hypot(dx,dz);
     if(dist<1.7&&p.retaliateCooldown<=0&&!gunEngaged){
       // 1:1-track pacing (melee.dat UNARMED_1 chain 0.333/0.567/0.667):
       // NPC swings cycle jab/cross/hook cooldowns instead of a fixed 0.9 s.
       p.retaliateCooldown=chainCooldown(NATIVE_MELEE_COMBOS.UNARMED,p.fightStage);
       p.fightStage=((p.fightStage+1)%3) as 0|1|2;
       state.heading=Math.atan2(dx,dz);
       if(foe)this.punchFoe(p,foe,dx,dz);
       else{
       p.view.playReaction(this.catalog?.animations['fighta_1']?'fighta_1':'hit_front',0.5);
       // Shared NPC blow (src/ped/damage.ts; STAT_PLAYER defend applies inside).
       this.sim.damagePlayer(npcPunchDamage(10,p.attackMult));
       this.onMeleeHit?.({...this.sim.player.position},false);
       this.defendPlayer(p);
       this.law?.registerCrime(CRIME.damagedPed,`ped:${p.id}`);
       }
     }
     }
   }
   let policeSpeed:number|undefined;
    // Recruited crew hold a loose wedge behind the player on foot and ride
    // passenger seats (front-right plus rear bench) when the mark drives.
   let followSpeed:number|undefined;
   if(p.follow&&!p.officer&&p.health>0&&p.down===0){
    if(this.sim.player.health<=0){p.follow=false;p.foe=undefined;}
    else{
     const ride=[...cars].find(c=>c.occupied);
     const pp=ride?ride.car.body.translation():this.sim.player.position;
     const gap=Math.hypot(pp.x-state.position.x,pp.z-state.position.z);
     if(ride&&gap>40){p.follow=false;p.foe=undefined;}
     else if(p.retaliate<=0){
      const hx=this.sim.player.heading,side=p.id%2?1.3:-1.3;
      dx=pp.x-Math.sin(hx)*2.5-Math.cos(hx)*side-state.position.x;
      dz=pp.z-Math.cos(hx)*2.5+Math.sin(hx)*side-state.position.z;
      followSpeed=Math.hypot(dx,dz)>2.2?p.runSpeed:0;
     }
    }
   }
   if(p.officer){
    p.flash=Math.max(0,p.flash-dt);p.view.setWeaponAim();p.view.setWeaponPose();let engaged=false;
    // Shared pursuit rules (src/police/pursuit.ts): 1-star vs unarmed = nightstick.
    const law=this.law!,gunAllowed=pursuitGunAllowed(law.level,this.playerArmed(),law.surrendering),target=this.sim.player.position;
    const {eye,aim,offset,distance,visible}=this.spotTarget(p,target,cars);
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
              this.sim.damagePlayer(NIGHTSTICK_DAMAGE);
              this.onMeleeHit?.({...this.sim.player.position},false);
              this.defendPlayer(p);
              p.arrest+=0.4;
            }
          }
          if((law.surrendering||this.sim.player.speed<.5)&&visible&&distance<2.2&&this.sim.playerBody.isEnabled()){p.arrest=stepArrest(p.arrest,dt,true);policeSpeed=0;if(p.arrest>ARREST_HOLD_SECONDS)law.arrest();}else if(!(visible&&distance<1.9))p.arrest=stepArrest(p.arrest,dt,false);
       } else {
       const chase=law.lastKnown??target;dx=chase.x-state.position.x;dz=chase.z-state.position.z;policeSpeed=gunAllowed&&visible&&distance<(p.weapon?.info.targetRange??12)&&!law.surrendering||!visible&&Math.hypot(dx,dz)<2?0:p.runSpeed;
      // CTaskComplexArrestPed hold: the officer faces the suspect while the bust builds.
      if(law.surrendering&&visible)state.heading=Math.atan2(offset.x,offset.z);
      if((law.surrendering||!gunAllowed&&law.level===1&&this.sim.player.speed<.5)&&visible&&distance<2.2&&this.sim.playerBody.isEnabled()){p.arrest=stepArrest(p.arrest,dt,true);policeSpeed=0;if(p.arrest>ARREST_HOLD_SECONDS)law.arrest();}else p.arrest=0;
       }
     if(gunAllowed&&visible&&p.weapon&&distance<p.weapon.info.weaponRange&&!law.surrendering&&policeSpeed===0){
      engaged=true;p.view.setWeaponPose('police_fire');p.view.setWeaponAim(offset.clone().normalize());
     }
    }else p.arrest=0;
    if(p.weapon&&p.gunState)this.stepPedGun(p,p.weapon,eye,aim,offset,cars,dt,engaged);
    if(p.gun)p.gun.root.visible=gunAllowed;
    if(p.gun)for(const binding of p.gun.materialBindings)if(binding.source.texture.toLowerCase().startsWith('muzzle'))binding.material.visible=p.flash>0;
   }else if(!p.officer&&p.weapon&&spot){
    p.flash=Math.max(0,p.flash-dt);
    this.stepPedGun(p,p.weapon,spot.eye,spot.aim,spot.offset,cars,dt,gunEngaged);
    if(p.gun)for(const binding of p.gun.materialBindings)if(binding.source.texture.toLowerCase().startsWith('muzzle'))binding.material.visible=p.flash>0;
   }
    const length0=Math.hypot(dx,dz);
    if(p.blocked>.3&&p.down===0&&length0>.01){const slide=sidestepDirection(dx/length0,dz/length0,p.id%2?1:-1);dx=slide.x*length0;dz=slide.z*length0;}
     const retaliating=!p.officer&&p.retaliate>0&&p.health>0&&p.down===0&&(!p.follow||(p.foe?.health??0)>0);
     const retaliateDist=retaliating?Math.hypot((p.foe&&p.foe.health>0?p.foe.actor.player.position:this.sim.player.position).x-state.position.x,(p.foe&&p.foe.health>0?p.foe.actor.player.position:this.sim.player.position).z-state.position.z):Infinity;
     const length=Math.hypot(dx,dz),target=p.down>0||p.stagger>0||p.loiter&&p.flee<=0&&p.retaliate<=0?0:policeSpeed??gunHold??followSpeed??retaliating?(retaliateDist>1.6?p.runSpeed:0):(p.flee>0?p.sprintSpeed:p.walkSpeed);
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
