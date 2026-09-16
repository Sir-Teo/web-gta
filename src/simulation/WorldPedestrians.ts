import {characterMovement} from './characterMovement';
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
 id:number;deadTime:number; officer:boolean;fireWait:number;arrest:number;gun?:ReturnType<typeof modelObject>; health:number; actor:Pick<Simulation,'player'>; body:RAPIER.RigidBody; collider:RAPIER.Collider;
 controller:RAPIER.KinematicCharacterController; view:NativeCharacter; target:PathNode; previousNode?:PathNode;
 down:number; flee:number; impulse:{x:number;z:number}; blocked:number;
 /** Seconds into CTaskSimpleStealthKill as the victim. */
 stealth?:number;
 /** A cop who left a police car seat (CPed::m_pVehicle), and the door point it is heading back to. */
 crew?:{unit:object;seat:number};goTo?:{x:number;z:number;walk:boolean};
}
/** Bounded civilian population on native sidewalk links, sharing the physics world. */
export class WorldPedestrians {
 private people:Pedestrian[]=[];
 onShot?:(from:{x:number;y:number;z:number},to:{x:number;y:number;z:number})=>void;
 /** CPed::PlayFootSteps for a walking, running or sprinting pedestrian (browser position one unit above the feet, like the player's). */
 onFootstep?:(ped:object,position:{x:number;y:number;z:number},move:'walk'|'run'|'sprint',foot:'left'|'right')=>void;
 private catalog?:Catalog;
 private disposed=false;
 private busy=false;
 private nextCheck=0;
 private nextId=0;
 private routeChoice=0;
 private cooldown=0;
 private hits=0;
 private error?:string;
 constructor(private sim:Simulation,private scene:Scene,base:string,private playerView:()=>NativeCharacter|undefined,private law?:WantedSystem){
  void openWorldPedestrians(base,!!law).then(c=>{if(this.disposed)return;this.catalog=c;this.installPlayerReactions();}).catch(e=>{this.error=String(e);});
 }
 private reactions(c:Catalog){return {...Object.fromEntries(['fighta_1','ko_skid_front','getup_front'].filter(n=>c.animations[n]).map(n=>[n,c.animations[n]])),...Object.fromEntries(['kill_knife_ped_damage','kill_knife_ped_die','kill_knife_player'].filter(n=>c.stealth[n]).map(n=>[n,c.stealth[n]]))};}
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
 snapshot(){return {ready:!!this.catalog,pending:this.busy,error:this.error??null,hits:this.hits,people:this.people.map(p=>({id:p.id,officer:p.officer,position:{...p.actor.player.position},heading:p.actor.player.heading,health:p.health,state:p.stealth!==undefined&&p.health>0?'stealth':p.health<=0?'dead':p.down>0?'down':p.flee>0?'flee':'walk',visible:p.view.root.visible}))};}
 /** Player damage to a pedestrian; the weapon system reports the native crime for the returned victim. */
 damageCollider(handle:number,damage:number,direction:{x:number;z:number}){
  const p=this.people.find(p=>p.collider.handle===handle);if(!p||p.health<=0)return false;
  p.health=Math.max(0,p.health-damage);this.hit(p,direction.x,direction.z,Math.min(7,damage*.1));
  if(p.health===0){p.down=Infinity;p.view.playReaction('ko_skid_front',Infinity);}
  return {id:p.id,officer:p.officer};
 }
 /** CWanted::WorkOutPolicePresence: living officers within `radius` of a point. */
 policePresence(point:{x:number;y:number;z:number},radius:number){return this.people.filter(p=>p.officer&&p.health>0&&Math.hypot(p.actor.player.position.x-point.x,p.actor.player.position.y+1-point.y,p.actor.player.position.z-point.z)<radius).length;}
 frighten(position:{x:number;z:number},radius:number){for(const p of this.people)if(!p.officer&&p.health>0&&Math.hypot(p.actor.player.position.x-position.x,p.actor.player.position.z-position.z)<radius)p.flee=Math.max(p.flee,8);}
 targets(){return this.people.filter(p=>p.health>0).map(p=>({handle:p.collider.handle,position:{...p.body.translation()}}));}
 private remove(p:Pedestrian){p.gun?.dispose();p.view.dispose();this.sim.world.removeCharacterController(p.controller);this.sim.world.removeRigidBody(p.body);}
 update(now:number){
  if(this.disposed||!this.catalog||this.busy||now<this.nextCheck)return;
  this.nextCheck=now+1500;
  const player=this.sim.player.position;
  this.people=this.people.filter(p=>{if(p.deadTime<45&&Math.hypot(p.actor.player.position.x-player.x,p.actor.player.position.z-player.z)<100&&p.actor.player.position.y>player.y-25)return true;this.remove(p);return false;});
  const catalog=this.catalog;this.busy=true;
  void catalog.loadAround(player.x,player.z).then(()=>{
   if(this.disposed)return;
   const center=this.sim.player.position;
   const nodes=[...catalog.areas.values()].flatMap(a=>a.nodes).filter(n=>this.allowed(n)&&Math.hypot(n.position[0]-center.x,-n.position[1]-center.z)<65&&Math.hypot(n.position[0]-center.x,-n.position[1]-center.z)>7).sort((a,b)=>Math.hypot(a.position[0]-center.x,-a.position[1]-center.z)-Math.hypot(b.position[0]-center.x,-b.position[1]-center.z));
   for(const node of nodes){
    const desiredOfficers=this.footOfficerLimit(),officer=!!catalog.officer&&this.people.filter(p=>p.officer&&p.health>0).length<desiredOfficers;
    if(this.people.length>=18||!officer&&this.people.filter(p=>!p.officer).length>=12)break;
    const x=node.position[0],z=-node.position[1];
    if(officer&&Math.hypot(x-center.x,z-center.z)<20)continue;
    if(this.people.some(p=>Math.hypot(p.actor.player.position.x-x,p.actor.player.position.z-z)<5))continue;
    const top=node.position[2]+3,hit=this.sim.world.castRay(new RAPIER.Ray({x,y:top,z},{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
    if(!hit)continue;
    const position={x,y:top-hit.timeOfImpact+.03,z},p=this.createPed({position,heading:this.sim.player.heading,source:officer?catalog.officer!:catalog.models[this.nextId%catalog.models.length],officer,node,weapon:officer?catalog.weapon:undefined,speed:1.2});
    this.chooseTarget(p);
   }
  }).catch(e=>{this.error=String(e);}).finally(()=>{this.busy=false;});
 }
 /** Officers the street spawner may add: the native pursuit cap (CWanted::m_MaxCopsInPursuit) less cops already committed elsewhere. */
 footOfficerLimit:()=>number=()=>this.law?.native.maxCopsInPursuit??0;
 private createPed(o:{position:{x:number;y:number;z:number};heading:number;source:import('../render/NativeCharacter').CharacterSource;officer:boolean;node:PathNode;weapon?:Awaited<Catalog['weapon']>;flee?:number;speed?:number}){
  const catalog=this.catalog!,body=this.sim.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(o.position.x,o.position.y+.9,o.position.z));
  const collider=this.sim.world.createCollider(RAPIER.ColliderDesc.capsule(.6,.3),body),controller=this.sim.world.createCharacterController(.025);
  controller.enableAutostep(.3,.2,false);controller.enableSnapToGround(.25);
  const view=new NativeCharacter(o.source);view.installReactions(this.reactions(catalog));view.startFirstCycleAt(Math.random());this.scene.add(view.root);
  let gun:ReturnType<typeof modelObject>|undefined;
  if(o.officer&&o.weapon?.asset){const asset=o.weapon.asset;gun=modelObject(asset.model,asset.textures);gun.root.rotation.set(0,0,0);gun.root.traverse(obj=>{const i=obj.userData.nativeFrame;if(i!==undefined&&asset.model.frames[i].parent<0)obj.matrix.identity();delete obj.userData.nativeFrame;});view.hand()?.add(gun.root);if(o.weapon.clip)view.installReactions({police_fire:o.weapon.clip},true);}
  const p:Pedestrian={id:this.nextId++,deadTime:0,officer:o.officer,fireWait:1.5,arrest:0,gun,health:o.officer?150:100,actor:{player:{...this.sim.player,position:{...o.position},previous:{...o.position},heading:o.heading,health:100,stamina:100,crouched:false,grounded:true,speed:o.speed??0}},body,collider,controller,view,target:o.node,down:0,flee:o.flee??0,impulse:{x:0,z:0},blocked:0};
  this.people.push(p);return p;
 }
 private nearestNode(position:{x:number;z:number}){return [...(this.catalog?.areas.values()??[])].flatMap(a=>a.nodes).filter(n=>this.allowed(n)).sort((a,b)=>Math.hypot(a.position[0]-position.x,-a.position[1]-position.z)-Math.hypot(b.position[0]-position.x,-b.position[1]-position.z))[0];}
 /** A driver dragged out or leaving a car becomes a street ped that flees (the usual decision-maker response to EVENT_DRAGGED_OUT_CAR). */
 spawnFleeing(modelIndex:number,position:{x:number;y:number;z:number},heading:number){
  const catalog=this.catalog;if(!catalog||this.disposed)return false;
  const node=this.nearestNode(position);if(!node)return false;
  this.createPed({position,heading,source:catalog.models[modelIndex%catalog.models.length],officer:false,node,flee:8});return true;
 }
 /** A police crew member stepping out of a cop car (CCopPed type model and weapon). */
 async spawnOfficer(model:string,weapon:number,position:{x:number;y:number;z:number},heading:number,crew?:{unit:object;seat:number}){
  const catalog=this.catalog;if(!catalog||this.disposed)return false;
  const [source,armed]=await Promise.all([catalog.character(model),catalog.armedWith(weapon)]);
  const node=this.nearestNode(position);if(!node||this.disposed)return false;
  this.createPed({position,heading,source,officer:true,node,weapon:armed}).crew=crew;return true;
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
  for(const other of this.people)if(!other.officer&&other!==p&&Math.hypot(other.actor.player.position.x-p.actor.player.position.x,other.actor.player.position.z-p.actor.player.position.z)<12)other.flee=8;
 }
 punch(){
  if(this.cooldown>0||this.sim.player.health<=0||!this.sim.player.grounded||this.sim.player.crouched)return false;
  this.cooldown=.65;this.playerView()?.playReaction('fighta_1',.6);
  const origin=this.sim.player.position,heading=this.sim.player.heading;
  const target=this.people.filter(p=>p.down===0).map(p=>({p,dx:p.actor.player.position.x-origin.x,dz:p.actor.player.position.z-origin.z,dy:p.actor.player.position.y-origin.y})).filter(t=>Math.hypot(t.dx,t.dz)<1.9&&Math.abs(t.dy)<1&&(t.dx*Math.sin(heading)+t.dz*Math.cos(heading))/Math.max(.01,Math.hypot(t.dx,t.dz))>.35).sort((a,b)=>Math.hypot(a.dx,a.dz)-Math.hypot(b.dx,b.dz))[0];
  if(target){
   const distance=Math.hypot(target.dx,target.dz),ray=new RAPIER.Ray({...origin,y:origin.y+1},{x:target.dx/distance,y:0,z:target.dz/distance});
   if(distance>.01&&this.sim.world.castRay(ray,distance,true,RAPIER.QueryFilterFlags.ONLY_FIXED))return false;
   this.law?.crime(target.p.officer?CRIME.damagedCop:CRIME.damagedPed,`ped:${target.p.id}`);this.law?.registerCrime(target.p.officer?CRIME.damagedCop:CRIME.damagedPed,`ped:${target.p.id}`);this.hit(target.p,Math.sin(heading),Math.cos(heading),3);return true;
  }
  return false;
 }
 beforeStep(dt:number,cars:Iterable<WorldCar>){
  this.cooldown=Math.max(0,this.cooldown-dt);
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
   let dx=p.target.position[0]-state.position.x,dz=-p.target.position[1]-state.position.z;
   if(Math.hypot(dx,dz)<.8||p.blocked>2){this.chooseTarget(p);p.blocked=0;dx=p.target.position[0]-state.position.x;dz=-p.target.position[1]-state.position.z;}
   if(!p.officer&&p.flee>0&&p.down===0){const player=this.sim.player.position;dx=state.position.x-player.x;dz=state.position.z-player.z;}
   let policeSpeed:number|undefined;
   if(p.officer){
    p.fireWait=Math.max(0,p.fireWait-dt);p.view.setWeaponAim();p.view.setWeaponPose();
    const law=this.law!,target=this.sim.player.position,eye={...state.position,y:state.position.y+1.3},aim={...target,y:target.y+1},offset=new Vector3(aim.x-eye.x,aim.y-eye.y,aim.z-eye.z),distance=offset.length();
    const hit=distance>0?this.sim.world.castRay(new RAPIER.Ray(eye,offset.clone().normalize()),distance+.5,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,p.collider,p.body):null;
    const occupied=[...cars].find(c=>c.occupied),visible=!!hit&&(hit.collider.handle===this.sim.playerCollider.handle||!!occupied&&hit.collider.parent()?.handle===occupied.car.body.handle);
    if(p.goTo&&p.down===0){dx=p.goTo.x-state.position.x;dz=p.goTo.z-state.position.z;policeSpeed=p.goTo.walk?1.2:3.8;p.arrest=0;}
    else if(law.level&&state.health>0&&p.health>0&&p.down===0&&this.sim.player.health>0){
     if(visible&&distance<45)law.see(target);
     const chase=law.lastKnown??target;dx=chase.x-state.position.x;dz=chase.z-state.position.z;policeSpeed=visible&&distance<12&&!law.surrendering||!visible&&Math.hypot(dx,dz)<2?0:3.8;
     if(law.surrendering&&visible&&distance<2.2&&this.sim.playerBody.isEnabled()){p.arrest+=dt;policeSpeed=0;if(p.arrest>1.2)law.arrest();}else p.arrest=0;
     if(visible&&distance<28&&!law.surrendering){p.view.setWeaponPose('police_fire');p.view.setWeaponAim(offset.clone().normalize());if(p.fireWait===0){p.fireWait=Math.max(.65,1.6-law.level*.12);p.view.playReaction('police_fire',.3,true);this.onShot?.(eye,aim);if(occupied)occupied.damage(12);else this.sim.damagePlayer(6);}}
    }else p.arrest=0;
    if(p.gun)for(const binding of p.gun.materialBindings)if(binding.source.texture.toLowerCase().startsWith('muzzle'))binding.material.visible=false;
   }
   const length=Math.hypot(dx,dz),speed=p.down>0?0:policeSpeed??(p.flee>0?3.7:1.2);
   if(length>.01&&(speed||p.officer&&!!this.law?.level))state.heading=Math.atan2(dx,dz);
   state.speed=speed;
   const controls={x:0,y:speed?-1:0,cameraYaw:state.heading,walk:true,sprint:p.flee>0&&p.down===0,jump:false};
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
